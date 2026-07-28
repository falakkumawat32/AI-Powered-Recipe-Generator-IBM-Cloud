/* ══════════════════════════════════════════════════
   RecGenAI – Express Server Entry Point
   ══════════════════════════════════════════════════ */
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const chatRoutes     = require('./routes/chat');
const documentRoutes = require('./routes/documents');
const recipeRoutes   = require('./routes/recipes');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Security & Middleware ── */
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ── Rate Limiting ── */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

/* ── Serve frontend + uploaded files statically ── */
app.use(express.static(path.join(__dirname, '../..', 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/* ── Routes ── */
app.use('/api/chat',      chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/recipes',   recipeRoutes);

/* ── Health check ── */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RecGenAI RAG Agent',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ibmWatsonx: !!process.env.IBM_WATSONX_API_KEY
  });
});

/* ── Serve frontend for any non-API route ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../..', 'frontend', 'index.html'));
});

/* ── 404 handler (API only) ── */
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Route not found' }));

/* ── Global error handler ── */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`🍳 RecGenAI Backend running on http://localhost:${PORT}`);
  console.log(`   IBM Watsonx: ${process.env.IBM_WATSONX_API_KEY ? '✅ Configured' : '⚠️  Not configured (set IBM_WATSONX_API_KEY)'}`);
});

module.exports = app;
