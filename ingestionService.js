/* ══════════════════════════════════════════════════
   Document Ingestion Service
   Parses PDFs, TXT, DOCX, MD and creates chunks
   ══════════════════════════════════════════════════ */
const fs      = require('fs');
const path    = require('path');
const pdf     = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const DATA_DIR    = path.join(__dirname, '../../data');
const DOCS_FILE   = path.join(DATA_DIR, 'documents.json');

/* Ensure directories exist */
[UPLOADS_DIR, DATA_DIR, path.join(DATA_DIR, 'vectorstore')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/** Load indexed docs manifest */
function loadDocuments() {
  if (!fs.existsSync(DOCS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8')); }
  catch { return []; }
}

/** Persist docs manifest */
function saveDocuments(docs) {
  fs.writeFileSync(DOCS_FILE, JSON.stringify(docs, null, 2));
}

/**
 * Extract raw text from a file
 */
async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data   = await pdf(buffer);
    return data.text;
  }

  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (ext === '.docx') {
    // Basic DOCX extraction — reads raw XML text
    try {
      const AdmZip = require('adm-zip');
      const zip    = new AdmZip(filePath);
      const xml    = zip.readAsText('word/document.xml');
      return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      return fs.readFileSync(filePath, 'utf8');
    }
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Split text into overlapping chunks suitable for RAG
 */
function chunkText(text, chunkSize = 600, overlap = 100) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current  = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > chunkSize) {
      if (current.trim()) chunks.push(current.trim());
      // Keep last `overlap` characters for context continuity
      const words = current.split(' ');
      current = words.slice(-Math.ceil(overlap / 5)).join(' ') + ' ' + sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 30);
}

/**
 * Simple keyword-based recipe title extractor
 */
function extractRecipeTitles(text) {
  const lines = text.split('\n');
  const recipeKeywords = /recipe|ingredients|instructions|serves|prep time|cook time|directions|method/i;
  const recipes = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (
      trimmed.length > 5 && trimmed.length < 80 &&
      !recipeKeywords.test(trimmed) &&
      (trimmed.endsWith(':') || /^[A-Z]/.test(trimmed)) &&
      lines[idx + 1] && recipeKeywords.test(lines[idx + 1])
    ) {
      recipes.push({
        name: trimmed.replace(/:$/, ''),
        emoji: '🍽️',
        tags: inferTags(trimmed)
      });
    }
  });

  return recipes.slice(0, 20); // cap per document
}

function inferTags(name) {
  const tags = [];
  const lower = name.toLowerCase();
  if (/cake|cookie|brownie|pie|tart|dessert/.test(lower)) tags.push('Dessert');
  if (/soup|stew|chili/.test(lower)) tags.push('Soup');
  if (/salad/.test(lower)) tags.push('Salad');
  if (/chicken|beef|pork|lamb|fish|shrimp/.test(lower)) tags.push('Protein');
  if (/vegan|vegetarian|tofu|plant/.test(lower)) tags.push('Vegan');
  if (/pasta|noodle|rice/.test(lower)) tags.push('Carbs');
  if (/breakfast|pancake|oat|egg/.test(lower)) tags.push('Breakfast');
  return tags;
}

/**
 * Format file size for display
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Main ingestion function — processes a file and returns doc metadata
 */
async function ingestFile(filePath, originalName) {
  const ext  = path.extname(originalName).toLowerCase().replace('.', '');
  const stat = fs.statSync(filePath);
  const text = await extractText(filePath, ext);

  if (!text || text.length < 20) throw new Error('Could not extract text from file');

  const chunks  = chunkText(text);
  const recipes = extractRecipeTitles(text);
  const id      = uuidv4();

  // Save chunks to vectorstore directory as JSON
  const chunksPath = path.join(DATA_DIR, 'vectorstore', `${id}.json`);
  fs.writeFileSync(chunksPath, JSON.stringify({ id, name: originalName, chunks, text }));

  const docMeta = {
    id,
    name: originalName,
    type: ext,
    size: formatSize(stat.size),
    chunks: chunks.length,
    recipes,
    status: 'indexed',
    indexedAt: new Date().toISOString(),
    filePath: chunksPath
  };

  const docs = loadDocuments();
  docs.unshift(docMeta);
  saveDocuments(docs);

  return docMeta;
}

/**
 * Ingest plain text (from URL scraping)
 */
async function ingestText(name, text) {
  if (!text || text.length < 20) throw new Error('No content to ingest');

  const chunks  = chunkText(text);
  const recipes = extractRecipeTitles(text);
  const id      = uuidv4();

  const chunksPath = path.join(DATA_DIR, 'vectorstore', `${id}.json`);
  fs.writeFileSync(chunksPath, JSON.stringify({ id, name, chunks, text }));

  const docMeta = {
    id,
    name,
    type: 'url',
    size: formatSize(Buffer.byteLength(text, 'utf8')),
    chunks: chunks.length,
    recipes,
    status: 'indexed',
    indexedAt: new Date().toISOString(),
    filePath: chunksPath
  };

  const docs = loadDocuments();
  docs.unshift(docMeta);
  saveDocuments(docs);

  return docMeta;
}

/**
 * Delete a document by ID
 */
function deleteDocument(id) {
  const docs    = loadDocuments();
  const doc     = docs.find(d => d.id === id);
  const updated = docs.filter(d => d.id !== id);
  saveDocuments(updated);

  if (doc?.filePath && fs.existsSync(doc.filePath)) {
    fs.unlinkSync(doc.filePath);
  }
  return true;
}

module.exports = { ingestFile, ingestText, loadDocuments, deleteDocument, chunkText };
