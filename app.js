/* ══════════════════════════════════════════════════
   RecGenAI – Frontend Application
   ══════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3001/api';

/* ── State ── */
const state = {
  preferences: {
    diet: [],
    cuisine: '',
    cookTime: 60,
    ingredients: [],
    servings: 2
  },
  chatHistory: [],
  indexedDocs: [],
  currentRecipe: null,
  isTyping: false
};

/* ═══════════════ DOM REFERENCES ═══════════════ */
const $ = id => document.getElementById(id);
const chatMessages    = $('chatMessages');
const chatInput       = $('chatInput');
const sendBtn         = $('sendBtn');
const statusDot       = $('statusDot');
const statusText      = $('statusText');
const cookTimeSlider  = $('cookTimeSlider');
const cookTimeValue   = $('cookTimeValue');
const ingredientInput = $('ingredientInput');
const ingredientTags  = $('ingredientTags');
const servingCount    = $('servingCount');
const recipeOutput    = $('recipeOutput');
const docList         = $('docList');
const uploadProgressArea = $('uploadProgressArea');

/* ═══════════════ INITIALIZATION ═══════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPreferences();
  initChatInput();
  initSuggestionChips();
  initUpload();
  initRecipePanel();
  checkServerStatus();
  loadIndexedDocs();
  setInterval(checkServerStatus, 15000);
});

/* ═══════════════ NAVIGATION ═══════════════ */
function initNavigation() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

/* ═══════════════ PREFERENCES ═══════════════ */
function initPreferences() {
  // Cook time slider
  cookTimeSlider.addEventListener('input', () => {
    state.preferences.cookTime = +cookTimeSlider.value;
    cookTimeValue.textContent = `${cookTimeSlider.value} min`;
  });

  // Ingredient tags
  ingredientInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = ingredientInput.value.trim().replace(/,$/, '');
      if (val && !state.preferences.ingredients.includes(val)) {
        state.preferences.ingredients.push(val);
        renderIngredientTags();
      }
      ingredientInput.value = '';
    }
  });

  // Servings
  $('servingMinus').addEventListener('click', () => {
    if (state.preferences.servings > 1) {
      state.preferences.servings--;
      servingCount.textContent = state.preferences.servings;
    }
  });
  $('servingPlus').addEventListener('click', () => {
    state.preferences.servings++;
    servingCount.textContent = state.preferences.servings;
  });

  // Apply preferences button
  $('applyPrefsBtn').addEventListener('click', () => {
    const checked = [...document.querySelectorAll('#dietChips input:checked')].map(c => c.value);
    state.preferences.diet = checked;
    state.preferences.cuisine = $('cuisineSelect').value;
    showToast('Preferences applied! Your next recipe will be personalised.', 'success');
  });

  // Clear chat
  $('clearChatBtn').addEventListener('click', clearChat);
}

function renderIngredientTags() {
  ingredientTags.innerHTML = state.preferences.ingredients
    .map((ing, i) => `<span class="tag">${ing}<span class="tag-remove" data-i="${i}">×</span></span>`)
    .join('');
  ingredientTags.querySelectorAll('.tag-remove').forEach(el => {
    el.addEventListener('click', () => {
      state.preferences.ingredients.splice(+el.dataset.i, 1);
      renderIngredientTags();
    });
  });
}

/* ═══════════════ CHAT ═══════════════ */
function initChatInput() {
  sendBtn.addEventListener('click', submitChat);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChat(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });
}

function initSuggestionChips() {
  document.querySelectorAll('.sugg-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.textContent.replace(/^[^\s]+\s/, '').trim();
      submitChat();
    });
  });
}

async function submitChat() {
  const text = chatInput.value.trim();
  if (!text || state.isTyping) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  appendMessage('user', text);
  state.chatHistory.push({ role: 'user', content: text });

  showTyping();
  sendBtn.disabled = true;
  state.isTyping = true;

  try {
    const resp = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.chatHistory.slice(-10),
        preferences: state.preferences
      })
    });

    const data = await resp.json();
    removeTyping();

    if (!resp.ok) throw new Error(data.error || 'Unknown error');

    const botMsg = data.response || 'Sorry, I could not generate a response.';
    appendMessage('bot', botMsg);
    state.chatHistory.push({ role: 'assistant', content: botMsg });

    if (data.recipe) {
      renderRecipeCard(data.recipe);
    }
  } catch (err) {
    removeTyping();
    appendMessage('bot', `⚠️ Error: ${err.message}. Please ensure the backend server is running.`);
  } finally {
    sendBtn.disabled = false;
    state.isTyping = false;
  }
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
  div.innerHTML = `
    <div class="msg-avatar ${role === 'user' ? 'user-avatar' : 'bot-avatar'}">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="msg-content">${formatMessageContent(content)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessageContent(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^• (.+)/gm, '<li>$1</li>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot-message typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar bot-avatar">🤖</div>
    <div class="msg-content">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const el = $('typingIndicator');
  if (el) el.remove();
}

function clearChat() {
  chatMessages.innerHTML = '';
  state.chatHistory = [];
  recipeOutput.innerHTML = `<div class="empty-recipe-state"><div class="empty-recipe-icon">🍽️</div><p>Ask a question in the chat to see a detailed recipe here</p></div>`;
  appendMessage('bot', 'Chat cleared! Ask me anything about recipes.');
}

/* ═══════════════ UPLOAD ═══════════════ */
function initUpload() {
  const dropZone   = $('dropZone');
  const fileInput  = $('fileInput');
  const browseBtn  = $('browseBtnTrigger');
  const ingestUrl  = $('ingestUrlBtn');

  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', e => { if (e.target !== browseBtn) fileInput.click(); });
  fileInput.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  ingestUrl.addEventListener('click', () => {
    const url = $('urlInput').value.trim();
    if (!url) return showToast('Please enter a URL', 'error');
    ingestFromUrl(url);
  });
}

async function handleFiles(files) {
  for (const file of files) {
    const allowed = ['.pdf', '.txt', '.docx', '.md'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showToast(`Unsupported file: ${file.name}`, 'error');
      continue;
    }
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  const progressId = 'prog_' + Date.now();
  const progEl = document.createElement('div');
  progEl.className = 'progress-item';
  progEl.id = progressId;
  progEl.innerHTML = `
    <div class="progress-name"><span>${file.name}</span><span>0%</span></div>
    <div class="progress-bar-wrap"><div class="progress-bar" style="width:0%"></div></div>`;
  uploadProgressArea.appendChild(progEl);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/documents/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progEl.querySelector('.progress-bar').style.width = pct + '%';
        progEl.querySelector('.progress-name span:last-child').textContent = pct + '%';
      }
    };

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      setTimeout(() => progEl.remove(), 2000);
      if (xhr.status === 200) {
        showToast(`${file.name} indexed successfully!`, 'success');
        loadIndexedDocs();
      } else {
        showToast(`Failed to index ${file.name}: ${data.error}`, 'error');
      }
    };

    xhr.onerror = () => showToast(`Network error uploading ${file.name}`, 'error');
    xhr.send(formData);
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
    progEl.remove();
  }
}

async function ingestFromUrl(url) {
  showLoading('Ingesting content from URL…');
  try {
    const resp = await fetch(`${API_BASE}/documents/ingest-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await resp.json();
    hideLoading();
    if (!resp.ok) throw new Error(data.error);
    $('urlInput').value = '';
    showToast('URL content ingested & indexed!', 'success');
    loadIndexedDocs();
  } catch (err) {
    hideLoading();
    showToast(`Ingest failed: ${err.message}`, 'error');
  }
}

async function loadIndexedDocs() {
  try {
    const resp = await fetch(`${API_BASE}/documents`);
    const data = await resp.json();
    state.indexedDocs = data.documents || [];
    renderDocList();
    renderRecipeGrid();
  } catch (_) { /* server might be offline */ }
}

function renderDocList() {
  if (!state.indexedDocs.length) {
    docList.innerHTML = '<p class="empty-hint">No documents indexed yet. Upload some files to get started.</p>';
    return;
  }
  docList.innerHTML = state.indexedDocs.map(doc => `
    <div class="doc-card">
      <div class="doc-icon">${docIcon(doc.type)}</div>
      <div class="doc-info">
        <div class="doc-name">${doc.name}</div>
        <div class="doc-meta">${doc.chunks} chunks • ${doc.size}</div>
      </div>
      <span class="doc-status ${doc.status}">${doc.status}</span>
      <button class="doc-delete" data-id="${doc.id}" title="Remove">🗑️</button>
    </div>
  `).join('');

  docList.querySelectorAll('.doc-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteDoc(btn.dataset.id));
  });
}

function docIcon(type) {
  const icons = { pdf: '📕', txt: '📝', docx: '📘', md: '📋' };
  return icons[type] || '📄';
}

async function deleteDoc(id) {
  try {
    const resp = await fetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    if (resp.ok) { showToast('Document removed', 'info'); loadIndexedDocs(); }
  } catch (err) {
    showToast('Failed to delete document', 'error');
  }
}

/* ═══════════════ EXPLORE TAB ═══════════════ */
function renderRecipeGrid() {
  const grid = $('recipeGrid');
  const searchInput = $('exploreSearch');

  const recipeCards = state.indexedDocs.flatMap(doc =>
    (doc.recipes || []).map(r => ({ ...r, source: doc.name }))
  );

  const renderCards = (filter = '') => {
    const filtered = recipeCards.filter(r =>
      !filter || r.name.toLowerCase().includes(filter.toLowerCase())
    );
    if (!filtered.length) {
      grid.innerHTML = `<p class="empty-hint">${recipeCards.length ? 'No matching recipes found.' : 'Index some documents first to explore your recipe knowledge base.'}</p>`;
      return;
    }
    grid.innerHTML = filtered.map(r => `
      <div class="recipe-card" data-name="${r.name}">
        <div class="recipe-card-emoji">${r.emoji || '🍽️'}</div>
        <div class="recipe-card-name">${r.name}</div>
        <div class="recipe-card-meta">${r.source}</div>
        <div class="recipe-card-tags">${(r.tags || []).map(t => `<span class="recipe-card-tag">${t}</span>`).join('')}</div>
      </div>
    `).join('');

    grid.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        chatInput.value = `Tell me how to make ${card.dataset.name}`;
        document.querySelector('[data-tab="chat"]').click();
        submitChat();
      });
    });
  };

  renderCards();
  searchInput.addEventListener('input', () => renderCards(searchInput.value));
}

/* ═══════════════ RECIPE PANEL ═══════════════ */
function initRecipePanel() {
  $('copyBtn').addEventListener('click', () => {
    if (!state.currentRecipe) return;
    const text = buildRecipeText(state.currentRecipe);
    navigator.clipboard.writeText(text).then(() => showToast('Recipe copied!', 'success'));
  });

  $('printBtn').addEventListener('click', () => {
    if (!state.currentRecipe) return;
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:sans-serif;padding:24px">${buildRecipeText(state.currentRecipe)}</pre>`);
    win.print();
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.currentRecipe) return;
    const blob = new Blob([buildRecipeText(state.currentRecipe)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.currentRecipe.title.replace(/\s+/g, '_')}.txt`;
    a.click();
  });
}

function renderRecipeCard(recipe) {
  state.currentRecipe = recipe;
  recipeOutput.innerHTML = `
    <div class="recipe-result">
      <div>
        <div class="recipe-title">${recipe.title}</div>
        <div class="recipe-subtitle">${recipe.description || ''}</div>
        <div class="recipe-badges">
          ${recipe.diet ? `<span class="recipe-badge badge-diet">🌿 ${recipe.diet}</span>` : ''}
          ${recipe.cookTime ? `<span class="recipe-badge badge-time">⏱ ${recipe.cookTime}</span>` : ''}
          ${recipe.cuisine ? `<span class="recipe-badge badge-cuisine">🌍 ${recipe.cuisine}</span>` : ''}
          ${recipe.servings ? `<span class="recipe-badge badge-servings">👥 ${recipe.servings} servings</span>` : ''}
        </div>
      </div>

      ${recipe.ingredients ? `
      <div class="recipe-section">
        <div class="recipe-section-title">Ingredients</div>
        <ul class="ingredient-list">
          ${recipe.ingredients.map(ing => `
            <li>
              ${typeof ing === 'string' ? ing : ing.item}
              ${ing.substitute ? `<span class="ingredient-sub">sub: ${ing.substitute}</span>` : ''}
            </li>`).join('')}
        </ul>
      </div>` : ''}

      ${recipe.steps ? `
      <div class="recipe-section">
        <div class="recipe-section-title">Instructions</div>
        <ol class="step-list">
          ${recipe.steps.map((step, i) => `
            <li class="step-item">
              <span class="step-num">${i + 1}</span>
              <span class="step-text">${step}</span>
            </li>`).join('')}
        </ol>
      </div>` : ''}

      ${recipe.nutrition ? `
      <div class="recipe-section">
        <div class="recipe-section-title">Nutrition (per serving)</div>
        <div class="nutrition-grid">
          ${Object.entries(recipe.nutrition).map(([k, v]) => `
            <div class="nutrition-item">
              <div class="nutrition-value">${v}</div>
              <div class="nutrition-label">${k}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${recipe.shoppingList ? `
      <div class="recipe-section">
        <div class="recipe-section-title">Shopping List</div>
        <ul class="shopping-list">
          ${recipe.shoppingList.map(item => `
            <li class="shopping-item">
              <input type="checkbox" onchange="this.parentElement.classList.toggle('checked', this.checked)" />
              ${item}
            </li>`).join('')}
        </ul>
      </div>` : ''}
    </div>
  `;
}

function buildRecipeText(recipe) {
  let out = `${recipe.title}\n${'='.repeat(recipe.title.length)}\n\n`;
  if (recipe.description) out += `${recipe.description}\n\n`;
  if (recipe.diet)      out += `Diet: ${recipe.diet} | `;
  if (recipe.cookTime)  out += `Time: ${recipe.cookTime} | `;
  if (recipe.cuisine)   out += `Cuisine: ${recipe.cuisine}\n\n`;
  if (recipe.ingredients) {
    out += `INGREDIENTS\n-----------\n${recipe.ingredients.map(i => `• ${typeof i === 'string' ? i : i.item}`).join('\n')}\n\n`;
  }
  if (recipe.steps) {
    out += `INSTRUCTIONS\n------------\n${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
  }
  if (recipe.nutrition) {
    out += `NUTRITION\n---------\n${Object.entries(recipe.nutrition).map(([k,v]) => `${k}: ${v}`).join(' | ')}\n`;
  }
  return out;
}

/* ═══════════════ SERVER STATUS ═══════════════ */
async function checkServerStatus() {
  try {
    const resp = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (resp.ok) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Connected';
    } else throw new Error();
  } catch {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Offline';
  }
}

/* ═══════════════ UTILITIES ═══════════════ */
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  $('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showLoading(msg = 'Processing…') {
  $('loadingText').textContent = msg;
  $('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  $('loadingOverlay').style.display = 'none';
}
