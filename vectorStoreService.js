/* ══════════════════════════════════════════════════
   Vector Store & Retrieval Service
   TF-IDF based similarity search (no external DB needed)
   with optional FAISS acceleration when available
   ══════════════════════════════════════════════════ */
const fs   = require('fs');
const path = require('path');

const DATA_DIR   = path.join(__dirname, '../../data/vectorstore');
const CACHE_FILE = path.join(__dirname, '../../data/tfidf_cache.json');

/* ── Simple TF-IDF Implementation ── */

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function computeTF(tokens) {
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  const total = tokens.length;
  Object.keys(freq).forEach(t => { freq[t] /= total; });
  return freq;
}

function computeIDF(allDocs) {
  const idf = {};
  const N   = allDocs.length;
  const allTerms = new Set(allDocs.flatMap(d => Object.keys(d)));
  allTerms.forEach(term => {
    const df = allDocs.filter(d => term in d).length;
    idf[term] = Math.log((N + 1) / (df + 1)) + 1;
  });
  return idf;
}

function cosineSimilarity(a, b) {
  const keysA = Object.keys(a);
  let dot = 0, normA = 0, normB = 0;
  keysA.forEach(k => {
    dot   += (a[k] || 0) * (b[k] || 0);
    normA += a[k] * a[k];
  });
  Object.values(b).forEach(v => { normB += v * v; });
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load all chunks from all vectorstore JSON files
 */
function loadAllChunks() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const allChunks = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      data.chunks.forEach((chunk, idx) => {
        allChunks.push({
          docId:   data.id,
          docName: data.name,
          chunkId: idx,
          text:    chunk
        });
      });
    } catch { /* skip corrupt files */ }
  }
  return allChunks;
}

/**
 * Retrieve top-K most relevant chunks for a query using TF-IDF + cosine similarity
 * @param {string} query
 * @param {number} topK
 * @returns {Array<{text, docName, score}>}
 */
function retrieveRelevantChunks(query, topK = 5) {
  const allChunks = loadAllChunks();
  if (!allChunks.length) return [];

  const queryTokens = tokenize(query);
  const chunkTFs    = allChunks.map(c => computeTF(tokenize(c.text)));
  const queryTF     = computeTF(queryTokens);
  const idf         = computeIDF([...chunkTFs, queryTF]);

  // Build TF-IDF vectors
  const toTFIDF = (tf) => {
    const vec = {};
    Object.keys(tf).forEach(t => { vec[t] = tf[t] * (idf[t] || 1); });
    return vec;
  };

  const queryVec  = toTFIDF(queryTF);
  const scored    = allChunks.map((chunk, i) => ({
    ...chunk,
    score: cosineSimilarity(queryVec, toTFIDF(chunkTFs[i]))
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(c => c.score > 0);
}

/**
 * Build a context string from retrieved chunks for LLM prompt
 */
function buildRAGContext(query, topK = 5) {
  const chunks = retrieveRelevantChunks(query, topK);
  if (!chunks.length) {
    return { context: '', sources: [] };
  }

  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.docName}]\n${c.text}`)
    .join('\n\n---\n\n');

  const sources = [...new Set(chunks.map(c => c.docName))];
  return { context, sources, chunks };
}

/**
 * Simple keyword search across all chunks (for explore tab)
 */
function keywordSearch(query, limit = 20) {
  const allChunks = loadAllChunks();
  const lower     = query.toLowerCase();
  return allChunks
    .filter(c => c.text.toLowerCase().includes(lower))
    .slice(0, limit);
}

module.exports = { retrieveRelevantChunks, buildRAGContext, keywordSearch, loadAllChunks };
