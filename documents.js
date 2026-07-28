/* ══════════════════════════════════════════════════
   Documents Route — Upload, ingest, list, delete
   ══════════════════════════════════════════════════ */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const axios    = require('axios');
const { parse } = require('node-html-parser');

const { ingestFile, ingestText, loadDocuments, deleteDocument } = require('../services/ingestionService');

/* ── Multer config ── */
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.docx', '.md'];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${ext}`));
  }
});

/**
 * GET /api/documents
 * Returns all indexed documents
 */
router.get('/', (req, res) => {
  try {
    const documents = loadDocuments();
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/upload
 * Multipart file upload + ingestion
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const docMeta = await ingestFile(req.file.path, req.file.originalname);
    res.json({ message: 'File ingested and indexed successfully', document: docMeta });
  } catch (err) {
    console.error('[UPLOAD ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/ingest-url
 * Scrape a URL and ingest its text content
 */
router.post('/ingest-url', async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });

  try {
    /* Fetch the page */
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'RecGenAI-RAG-Bot/1.0' },
      maxContentLength: 5 * 1024 * 1024 // 5 MB cap
    });

    /* Parse HTML and extract readable text */
    const root = parse(response.data);

    // Remove script/style/nav noise
    ['script', 'style', 'nav', 'footer', 'header', 'aside'].forEach(tag => {
      root.querySelectorAll(tag).forEach(el => el.remove());
    });

    const text = root.text
      .replace(/\s{3,}/g, '\n\n')
      .replace(/\t/g, ' ')
      .trim();

    if (text.length < 100) {
      return res.status(422).json({ error: 'Could not extract meaningful text from URL' });
    }

    const hostname = new URL(url).hostname.replace('www.', '');
    const docMeta  = await ingestText(`${hostname} – ingested`, text);

    res.json({ message: 'URL ingested and indexed successfully', document: docMeta });
  } catch (err) {
    console.error('[INGEST-URL ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Remove a document from the index
 */
router.delete('/:id', (req, res) => {
  try {
    deleteDocument(req.params.id);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
