/* ══════════════════════════════════════════════════
   Recipe Adaptation Service
   Handles personalization, substitutions, and
   dietary-constraint enforcement
   ══════════════════════════════════════════════════ */

/* ── Substitution Table ── */
const SUBSTITUTIONS = {
  // Dairy-free
  'butter':        { 'dairy-free': 'vegan butter or coconut oil', 'vegan': 'vegan butter' },
  'milk':          { 'dairy-free': 'oat milk or almond milk', 'vegan': 'oat milk' },
  'cream':         { 'dairy-free': 'coconut cream', 'vegan': 'coconut cream' },
  'cheese':        { 'dairy-free': 'nutritional yeast', 'vegan': 'vegan cheese' },
  'yogurt':        { 'dairy-free': 'coconut yogurt', 'vegan': 'soy yogurt' },
  'parmesan':      { 'dairy-free': 'nutritional yeast flakes', 'vegan': 'vegan parmesan' },

  // Gluten-free
  'flour':         { 'gluten-free': 'almond flour or rice flour' },
  'all-purpose flour': { 'gluten-free': 'gluten-free flour blend (1:1)' },
  'bread':         { 'gluten-free': 'gluten-free bread' },
  'pasta':         { 'gluten-free': 'rice pasta or chickpea pasta' },
  'soy sauce':     { 'gluten-free': 'tamari or coconut aminos' },

  // Vegan
  'egg':           { 'vegan': 'flax egg (1 tbsp ground flax + 3 tbsp water)', 'paleo': 'whole egg' },
  'eggs':          { 'vegan': 'flax eggs (1 tbsp ground flax + 3 tbsp water per egg)' },
  'honey':         { 'vegan': 'maple syrup or agave nectar' },
  'chicken':       { 'vegan': 'chickpeas or jackfruit', 'vegetarian': 'tofu or tempeh' },
  'beef':          { 'vegan': 'lentils or beyond meat', 'vegetarian': 'mushrooms or lentils' },
  'pork':          { 'vegan': 'jackfruit', 'vegetarian': 'tempeh' },

  // Keto / Low-carb
  'sugar':         { 'keto': 'erythritol or stevia', 'diabetic': 'stevia or monk fruit sweetener' },
  'white sugar':   { 'keto': 'erythritol (1:1)', 'low-carb': 'erythritol' },
  'brown sugar':   { 'keto': 'brown swerve or erythritol', 'low-carb': 'coconut sugar (in moderation)' },
  'rice':          { 'keto': 'cauliflower rice', 'low-carb': 'cauliflower rice or konjac rice' },
  'potato':        { 'keto': 'turnip or cauliflower', 'low-carb': 'turnip' },

  // Nut-free
  'almond flour':  { 'nut-free': 'oat flour or sunflower seed flour' },
  'peanut butter': { 'nut-free': 'sunflower seed butter or tahini' },
  'almonds':       { 'nut-free': 'pumpkin seeds or sunflower seeds' },
  'cashews':       { 'nut-free': 'sunflower seeds or hemp seeds' },
  'walnuts':       { 'nut-free': 'pumpkin seeds' }
};

/**
 * Add dietary substitution hints to an ingredient list
 * @param {Array<{item, substitute}>} ingredients
 * @param {string[]} dietRestrictions
 */
function addSubstitutions(ingredients, dietRestrictions) {
  if (!dietRestrictions?.length) return ingredients;

  return ingredients.map(ing => {
    const item  = typeof ing === 'string' ? ing : ing.item;
    const lower = item.toLowerCase();

    for (const [keyword, subs] of Object.entries(SUBSTITUTIONS)) {
      if (lower.includes(keyword)) {
        for (const diet of dietRestrictions) {
          const sub = subs[diet.toLowerCase()];
          if (sub) {
            return typeof ing === 'string'
              ? { item: ing, substitute: sub }
              : { ...ing, substitute: ing.substitute || sub };
          }
        }
      }
    }
    return typeof ing === 'string' ? { item: ing, substitute: null } : ing;
  });
}

/**
 * Scale ingredient amounts for a different serving count
 * @param {Array} ingredients
 * @param {number} originalServings
 * @param {number} targetServings
 */
function scaleIngredients(ingredients, originalServings = 4, targetServings = 2) {
  if (originalServings === targetServings) return ingredients;
  const ratio = targetServings / originalServings;

  return ingredients.map(ing => {
    const item = typeof ing === 'string' ? ing : ing.item;
    // Replace all numeric quantities in the string
    const scaled = item.replace(/(\d+(?:\.\d+)?)/g, (match, num) => {
      const scaled = parseFloat(num) * ratio;
      return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
    });
    return typeof ing === 'string' ? scaled : { ...ing, item: scaled };
  });
}

/**
 * Generate a shopping list from ingredients, filtering out what user already has
 * @param {Array} ingredients
 * @param {string[]} availableIngredients
 */
function buildShoppingList(ingredients, availableIngredients = []) {
  const available = availableIngredients.map(i => i.toLowerCase().trim());

  return ingredients
    .map(ing => (typeof ing === 'string' ? ing : ing.item))
    .filter(item => {
      const lower = item.toLowerCase();
      return !available.some(a => lower.includes(a) || a.includes(lower.split(' ')[0]));
    });
}

/**
 * Build a contextual system prompt for the RAG agent
 */
function buildSystemPrompt(preferences = {}) {
  const constraints = [];
  if (preferences.diet?.length)       constraints.push(`Dietary restrictions: ${preferences.diet.join(', ')}`);
  if (preferences.cuisine)            constraints.push(`Preferred cuisine: ${preferences.cuisine}`);
  if (preferences.cookTime)           constraints.push(`Max cooking time: ${preferences.cookTime} minutes`);
  if (preferences.ingredients?.length) constraints.push(`Available ingredients: ${preferences.ingredients.join(', ')}`);
  if (preferences.servings)           constraints.push(`Servings: ${preferences.servings}`);

  return `You are RecGenAI, an expert AI chef and culinary assistant powered by IBM Watsonx AI. You help users discover, adapt, and personalize recipes from a curated knowledge base.

Your capabilities:
- Retrieve and adapt recipes from indexed documents
- Suggest ingredient substitutions based on dietary needs
- Provide step-by-step cooking instructions
- Calculate nutritional information
- Generate shopping lists
- Adapt recipes to available ingredients

Current user preferences:
${constraints.length ? constraints.join('\n') : 'No specific preferences set.'}

Always be helpful, precise, and culinary-informed. If the knowledge base has relevant recipes, refer to them. If adapting a recipe, explain the substitutions clearly.`;
}

/**
 * Post-process a recipe object — apply scaling + substitutions
 */
function postProcessRecipe(recipe, preferences = {}) {
  if (!recipe) return recipe;

  let processed = { ...recipe };

  // Apply serving scale
  if (preferences.servings && recipe.ingredients) {
    const origServings = parseInt(recipe.servings) || 4;
    if (origServings !== preferences.servings) {
      processed.ingredients = scaleIngredients(recipe.ingredients, origServings, preferences.servings);
      processed.servings    = preferences.servings;
    }
  }

  // Apply substitutions
  if (preferences.diet?.length && processed.ingredients) {
    processed.ingredients = addSubstitutions(processed.ingredients, preferences.diet);
  }

  // Rebuild shopping list after scaling/substitutions
  if (processed.ingredients) {
    processed.shoppingList = buildShoppingList(processed.ingredients, preferences.ingredients || []);
  }

  return processed;
}

module.exports = {
  addSubstitutions,
  scaleIngredients,
  buildShoppingList,
  buildSystemPrompt,
  postProcessRecipe,
  SUBSTITUTIONS
};
