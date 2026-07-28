/* ══════════════════════════════════════════════════
   Recipes Route — Direct recipe generation & search
   ══════════════════════════════════════════════════ */
const express = require('express');
const router  = express.Router();

const { generateRecipeJSON }               = require('../services/watsonxService');
const { buildRAGContext, keywordSearch }   = require('../services/vectorStoreService');
const { postProcessRecipe }                = require('../services/recipeAdaptationService');
const { buildFallbackRecipe }              = require('../utils/fallback');

/**
 * POST /api/recipes/generate
 * Body: { query, preferences }
 * Generates a full structured recipe
 */
router.post('/generate', async (req, res) => {
  const { query, preferences = {} } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query is required' });

  try {
    const { context } = buildRAGContext(query, 5);

    let recipe;
    if (process.env.IBM_WATSONX_API_KEY) {
      recipe = await generateRecipeJSON(context || query, query, preferences);
    } else {
      recipe = buildFallbackRecipe(query, preferences);
    }

    if (!recipe) {
      return res.status(422).json({ error: 'Could not generate a recipe for this request' });
    }

    recipe = postProcessRecipe(recipe, preferences);
    res.json({ recipe });
  } catch (err) {
    console.error('[RECIPE GEN ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/recipes/search?q=...
 * Full-text keyword search across all indexed chunks
 */
router.get('/search', (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

  try {
    const results = keywordSearch(q, parseInt(limit));
    res.json({ results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/recipes/substitutions
 * Body: { ingredients, diet }
 * Returns substitution suggestions
 */
router.post('/substitutions', (req, res) => {
  const { ingredients = [], diet = [] } = req.body;
  const { addSubstitutions, SUBSTITUTIONS } = require('../services/recipeAdaptationService');

  if (!ingredients.length) {
    return res.status(400).json({ error: 'ingredients array is required' });
  }

  const withSubs = addSubstitutions(
    ingredients.map(i => ({ item: i, substitute: null })),
    diet
  );

  res.json({ ingredients: withSubs, substitutionTable: SUBSTITUTIONS });
});

/**
 * POST /api/recipes/shopping-list
 * Body: { ingredients, availableIngredients }
 * Returns only the items user needs to buy
 */
router.post('/shopping-list', (req, res) => {
  const { ingredients = [], availableIngredients = [] } = req.body;
  const { buildShoppingList } = require('../services/recipeAdaptationService');

  const list = buildShoppingList(
    ingredients.map(i => ({ item: i })),
    availableIngredients
  );

  res.json({ shoppingList: list, count: list.length });
});

module.exports = router;
