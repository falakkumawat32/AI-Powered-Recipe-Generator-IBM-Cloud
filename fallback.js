/* ══════════════════════════════════════════════════
   Fallback Utility
   Used when IBM Watsonx API key is not configured.
   Returns sensible demo responses so the app is
   fully interactive without credentials.
   ══════════════════════════════════════════════════ */

const DEMO_RECIPES = {
  chocolate: {
    title: 'Classic Chocolate Cake',
    description: 'Rich, moist chocolate cake — easily adaptable for dietary needs.',
    diet: null, cookTime: '55 min', cuisine: 'American', servings: 8,
    ingredients: [
      { item: '2 cups all-purpose flour', substitute: null },
      { item: '1¾ cups sugar', substitute: null },
      { item: '¾ cup cocoa powder', substitute: null },
      { item: '2 tsp baking soda', substitute: null },
      { item: '1 tsp salt', substitute: null },
      { item: '2 eggs', substitute: null },
      { item: '1 cup buttermilk', substitute: null },
      { item: '1 cup strong black coffee', substitute: null },
      { item: '½ cup vegetable oil', substitute: null },
      { item: '2 tsp vanilla extract', substitute: null }
    ],
    steps: [
      'Preheat oven to 350°F (175°C). Grease two 9-inch round pans.',
      'Whisk together flour, sugar, cocoa, baking soda, and salt in a large bowl.',
      'In another bowl, beat eggs, buttermilk, coffee, oil, and vanilla.',
      'Gradually fold wet ingredients into dry until smooth batter forms.',
      'Divide batter evenly between prepared pans.',
      'Bake 30–35 minutes or until a toothpick comes out clean.',
      'Cool in pans for 10 minutes, then transfer to a wire rack.',
      'Frost with your favourite chocolate ganache or buttercream.'
    ],
    nutrition: { Calories: '420 kcal', Protein: '6g', Carbs: '65g', Fat: '16g', Fiber: '3g', Sugar: '42g' },
    shoppingList: ['all-purpose flour', 'cocoa powder', 'baking soda', 'buttermilk', 'vegetable oil', 'vanilla extract']
  },
  pasta: {
    title: 'Creamy Garlic Pasta',
    description: 'A quick, satisfying pasta dish ready in 20 minutes.',
    diet: 'Vegetarian', cookTime: '20 min', cuisine: 'Italian', servings: 2,
    ingredients: [
      { item: '200g spaghetti', substitute: null },
      { item: '4 cloves garlic, minced', substitute: null },
      { item: '200ml heavy cream', substitute: null },
      { item: '50g Parmesan, grated', substitute: null },
      { item: '2 tbsp olive oil', substitute: null },
      { item: 'Salt and black pepper to taste', substitute: null },
      { item: 'Fresh parsley, chopped', substitute: null }
    ],
    steps: [
      'Cook spaghetti in salted boiling water until al dente (about 9 minutes). Reserve ½ cup pasta water.',
      'Heat olive oil in a wide pan over medium heat. Add garlic and sauté 1–2 minutes until fragrant.',
      'Pour in cream and bring to a gentle simmer for 3 minutes.',
      'Add Parmesan and stir until melted and sauce is smooth.',
      'Drain pasta and toss with sauce, adding pasta water to loosen if needed.',
      'Season with salt and pepper. Serve topped with extra Parmesan and parsley.'
    ],
    nutrition: { Calories: '680 kcal', Protein: '22g', Carbs: '75g', Fat: '32g', Fiber: '3g', Sugar: '4g' },
    shoppingList: ['spaghetti', 'garlic', 'heavy cream', 'Parmesan', 'olive oil', 'parsley']
  },
  salad: {
    title: 'Mediterranean Quinoa Salad',
    description: 'Fresh, protein-packed salad bursting with Mediterranean flavours.',
    diet: 'Vegan', cookTime: '15 min', cuisine: 'Mediterranean', servings: 2,
    ingredients: [
      { item: '1 cup quinoa, cooked', substitute: null },
      { item: '1 cucumber, diced', substitute: null },
      { item: '200g cherry tomatoes, halved', substitute: null },
      { item: '½ red onion, thinly sliced', substitute: null },
      { item: '½ cup Kalamata olives', substitute: null },
      { item: '¼ cup fresh parsley', substitute: null },
      { item: '3 tbsp extra virgin olive oil', substitute: null },
      { item: '2 tbsp lemon juice', substitute: null },
      { item: 'Salt and pepper to taste', substitute: null }
    ],
    steps: [
      'Cook quinoa according to package instructions and let cool.',
      'Combine quinoa, cucumber, tomatoes, onion, olives, and parsley in a large bowl.',
      'Whisk together olive oil and lemon juice; season with salt and pepper.',
      'Pour dressing over salad and toss well.',
      'Serve immediately or chill for 30 minutes for best flavour.'
    ],
    nutrition: { Calories: '380 kcal', Protein: '11g', Carbs: '42g', Fat: '18g', Fiber: '6g', Sugar: '5g' },
    shoppingList: ['quinoa', 'cucumber', 'cherry tomatoes', 'red onion', 'Kalamata olives', 'parsley', 'lemon']
  },
  chicken: {
    title: 'Herb-Roasted Chicken Breast',
    description: 'Juicy, golden chicken breast seasoned with fragrant herbs.',
    diet: null, cookTime: '35 min', cuisine: 'American', servings: 2,
    ingredients: [
      { item: '2 chicken breasts (about 200g each)', substitute: null },
      { item: '2 tbsp olive oil', substitute: null },
      { item: '1 tsp garlic powder', substitute: null },
      { item: '1 tsp dried rosemary', substitute: null },
      { item: '1 tsp dried thyme', substitute: null },
      { item: '1 tsp paprika', substitute: null },
      { item: 'Salt and black pepper to taste', substitute: null }
    ],
    steps: [
      'Preheat oven to 400°F (200°C). Line a baking dish with foil.',
      'Pat chicken dry with paper towels.',
      'Mix olive oil, garlic powder, rosemary, thyme, paprika, salt, and pepper.',
      'Coat chicken breasts with the herb mixture on all sides.',
      'Place in baking dish and roast 25–30 minutes until internal temperature reaches 165°F.',
      'Rest for 5 minutes before slicing and serving.'
    ],
    nutrition: { Calories: '310 kcal', Protein: '42g', Carbs: '2g', Fat: '14g', Fiber: '0g', Sugar: '0g' },
    shoppingList: ['chicken breasts', 'olive oil', 'garlic powder', 'rosemary', 'thyme', 'paprika']
  }
};

/**
 * Pick the best demo recipe based on keywords in the query
 */
function pickDemoRecipe(query, preferences) {
  const lower = query.toLowerCase();
  let recipe  = null;

  if (/chocolate|cake|brownie|sweet|dessert|sugar.free/.test(lower)) recipe = { ...DEMO_RECIPES.chocolate };
  else if (/pasta|spaghetti|noodle|italian|garlic/.test(lower))        recipe = { ...DEMO_RECIPES.pasta };
  else if (/salad|quinoa|vegan|mediterranean|light/.test(lower))       recipe = { ...DEMO_RECIPES.salad };
  else if (/chicken|poultry|breast|roast/.test(lower))                 recipe = { ...DEMO_RECIPES.chicken };
  else recipe = { ...DEMO_RECIPES.pasta }; // default

  // Apply dietary labels
  if (preferences?.diet?.length && !recipe.diet) {
    recipe.diet = preferences.diet[0];
  }
  if (preferences?.cuisine) {
    recipe.cuisine = preferences.cuisine;
  }
  if (preferences?.cookTime && parseInt(recipe.cookTime) > preferences.cookTime) {
    recipe.cookTime = `${preferences.cookTime} min`;
  }
  if (preferences?.servings) {
    recipe.servings = preferences.servings;
  }

  return recipe;
}

/**
 * Build a text response when no API key is configured
 */
function fallbackResponse(message, preferences = {}, context = '') {
  const lower = message?.toLowerCase() || '';

  let text;
  const recipe = pickDemoRecipe(lower, preferences);

  if (/shopping.list|buy|grocery/.test(lower)) {
    text = `Here's a shopping list for **${recipe.title}**:\n\n${recipe.shoppingList.map(i => `• ${i}`).join('\n')}\n\n⚠️ *Demo mode — configure IBM_WATSONX_API_KEY in .env for real AI-powered answers.*`;
    return { text, recipe };
  }

  if (/substitut|replace|instead|alternative|without/.test(lower)) {
    text = `For **${recipe.title}**, here are some common substitutions:\n\n• **Butter** → coconut oil or vegan butter\n• **Eggs** → flax egg (1 tbsp ground flax + 3 tbsp water)\n• **Milk** → oat milk or almond milk\n• **All-purpose flour** → gluten-free flour blend\n\n⚠️ *Demo mode — configure IBM_WATSONX_API_KEY for personalised suggestions.*`;
    return { text, recipe };
  }

  if (/how|make|cook|recipe|prepare/.test(lower)) {
    text = `Here's a recipe for **${recipe.title}**!\n\nThis takes about **${recipe.cookTime}** and serves **${recipe.servings}**. I've prepared the full recipe card on the right panel with all ingredients, step-by-step instructions, nutritional facts, and a shopping list.\n\n💡 Tip: You can set your dietary preferences in the sidebar to get personalised substitutions.\n\n⚠️ *Demo mode — configure IBM_WATSONX_API_KEY in .env to enable real IBM Watsonx AI responses.*`;
    return { text, recipe };
  }

  text = `I found a great match for your query: **${recipe.title}**. Check the recipe panel on the right for full details including ingredients, cooking steps, nutrition info, and a shopping list!\n\n⚠️ *Demo mode — add your IBM_WATSONX_API_KEY to .env to unlock full AI-powered Q&A.*`;
  return { text, recipe };
}

/**
 * Build a fallback recipe object directly (for recipe route)
 */
function buildFallbackRecipe(query, preferences) {
  return pickDemoRecipe(query, preferences);
}

module.exports = { fallbackResponse, buildFallbackRecipe };
