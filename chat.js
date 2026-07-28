/* ══════════════════════════════════════════════════
   Chat Route — Core RAG Q&A endpoint
   ══════════════════════════════════════════════════ */
const express = require('express');
const router  = express.Router();

const { generateText, generateRecipeJSON } = require('../services/watsonxService');
const { buildRAGContext }                  = require('../services/vectorStoreService');
const { buildSystemPrompt, postProcessRecipe } = require('../services/recipeAdaptationService');
const { fallbackResponse }                 = require('../utils/fallback');

/**
 * POST /api/chat
 * Body: { message, history, preferences }
 */
router.post('/', async (req, res) => {
  const { message, history = [], preferences = {} } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    /* ── Step 1: Retrieve relevant chunks from knowledge base ── */
    const { context, sources } = buildRAGContext(message, 6);

    /* ── Step 2: Build full LLM prompt ── */
    const systemPrompt = buildSystemPrompt(preferences);
    const historyText  = history
      .slice(-6)
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n');

    const hasContext   = context && context.length > 20;
    const contextBlock = hasContext
      ? `\n\nRELEVANT KNOWLEDGE BASE CONTEXT:\n${context}\n\nSources: ${sources.join(', ')}`
      : '\n\n(No documents indexed yet. Answering from general culinary knowledge.)';

    const fullPrompt = `${systemPrompt}
${historyText ? `\nCONVERSATION HISTORY:\n${historyText}\n` : ''}
${contextBlock}

User: ${message}
Assistant:`;

    /* ── Step 3: Detect if user wants a full recipe or just Q&A ── */
    const isRecipeRequest = /recipe|make|cook|prepare|how to|ingredients for|steps for|instructions for|salad|cake|pasta|ideas|quick/i.test(message);

    let responseText;
    let recipe = null;

    if (process.env.IBM_WATSONX_API_KEY) {
      /* ── IBM Watsonx AI path — with per-call fallback ── */
      try {
        responseText = await generateText(fullPrompt, { maxTokens: 1024 });
      } catch (ibmErr) {
        console.warn('[WATSONX TEXT WARN]', ibmErr.message);
        const fallback = fallbackResponse(message, preferences, context);
        responseText   = fallback.text + '\n\n⚠️ *IBM Watsonx error: ' + ibmErr.message + ' — showing demo recipe.*';
        recipe         = fallback.recipe;
        return res.json({ response: responseText, recipe, sources: [], model: 'fallback-on-error' });
      }

      if (isRecipeRequest) {
        try {
          recipe = await generateRecipeJSON(context || message, message, preferences);
          if (recipe) recipe = postProcessRecipe(recipe, preferences);
        } catch (recipeErr) {
          console.warn('[WATSONX RECIPE WARN]', recipeErr.message);
          // Still return the text response even if recipe JSON fails
          recipe = null;
        }
      }
    } else {
      /* ── Demo mode (no API key set) ── */
      const fallback = fallbackResponse(message, preferences, context);
      responseText   = fallback.text;
      recipe         = fallback.recipe;
    }

    return res.json({
      response: responseText,
      recipe,
      sources: hasContext ? sources : [],
      model: process.env.IBM_WATSONX_MODEL_ID || 'ibm/granite-13b-instruct-v2'
    });

  } catch (err) {
    console.error('[CHAT ERROR]', err.message);
    /* Always return a graceful fallback — never a raw 500 to the user */
    const fallback = fallbackResponse(req.body.message, req.body.preferences || {}, '');
    return res.json({
      response: fallback.text + `\n\n⚠️ *Server error: ${err.message}*`,
      recipe:   fallback.recipe,
      sources:  [],
      model:    'fallback-on-error'
    });
  }
});

module.exports = router;
