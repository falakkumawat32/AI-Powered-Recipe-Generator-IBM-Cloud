/* ══════════════════════════════════════════════════
   IBM Watsonx AI Service
   Handles all LLM API calls via WatsonxAI SDK
   ══════════════════════════════════════════════════ */
const { WatsonXAI }        = require('@ibm-cloud/watsonx-ai');         // capital X ← correct
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

let watsonxClient = null;

/**
 * Build (and cache) the SDK client, authenticated via IAM API key.
 */
function getClient() {
  if (watsonxClient) return watsonxClient;

  const apiKey = process.env.IBM_WATSONX_API_KEY;
  const url    = process.env.IBM_WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';

  if (!apiKey) {
    throw new Error('IBM_WATSONX_API_KEY is not set. Add it to backend/.env');
  }

  watsonxClient = WatsonXAI.newInstance({
    version:       '2024-05-31',
    serviceUrl:    url,
    authenticator: new IamAuthenticator({ apikey: apiKey })
  });

  return watsonxClient;
}

/**
 * Generate text using IBM Watsonx AI (Granite / Llama models)
 * @param {string} prompt
 * @param {object} options
 * @returns {Promise<string>}
 */
async function generateText(prompt, options = {}) {
  const client    = getClient();
  const projectId = process.env.IBM_WATSONX_PROJECT_ID;
  const modelId   = options.modelId
    || process.env.IBM_WATSONX_MODEL_ID
    || 'ibm/granite-13b-instruct-v2';

  if (!projectId) {
    throw new Error('IBM_WATSONX_PROJECT_ID is not set. Add it to backend/.env');
  }

  const response = await client.generateText({
    input:     prompt,
    modelId,
    projectId,
    parameters: {
      decoding_method:    'greedy',
      max_new_tokens:     options.maxTokens  || 1024,
      min_new_tokens:     options.minTokens  || 20,
      stop_sequences:     options.stopSequences || [],
      repetition_penalty: 1.1,
      temperature:        options.temperature || 0.7,
    }
  });

  const generated = response?.result?.results?.[0]?.generated_text || '';
  return generated.trim();
}

/**
 * Generate embeddings for semantic similarity search
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function generateEmbeddings(texts) {
  const client    = getClient();
  const projectId = process.env.IBM_WATSONX_PROJECT_ID;
  const modelId   = process.env.IBM_WATSONX_EMBEDDING_MODEL || 'ibm/slate-125m-english-rtrvr';

  if (!projectId) throw new Error('IBM_WATSONX_PROJECT_ID is not set.');

  const response = await client.embedText({
    inputs:    texts,
    modelId,
    projectId
  });

  return response?.result?.results?.map(r => r.embedding) || [];
}

/**
 * Ask Granite to produce a structured recipe JSON object.
 * Falls back gracefully if the model doesn't return valid JSON.
 */
async function generateRecipeJSON(recipeContext, userRequest, preferences = {}) {
  const dietConstraints = preferences?.diet?.length
    ? `Dietary restrictions: ${preferences.diet.join(', ')}.`
    : 'No specific dietary restrictions.';

  const ingredientHints = preferences?.ingredients?.length
    ? `User already has: ${preferences.ingredients.join(', ')}.`
    : '';

  const timeConstraint = preferences?.cookTime
    ? `Maximum cooking time: ${preferences.cookTime} minutes.`
    : '';

  const cuisineHint = preferences?.cuisine
    ? `Preferred cuisine: ${preferences.cuisine}.`
    : '';

  const servings = preferences?.servings || 2;

  const prompt = `You are an expert chef. Generate a complete recipe as a JSON object.

KNOWLEDGE BASE CONTEXT:
${recipeContext || 'Use your culinary knowledge.'}

USER REQUEST: ${userRequest}

CONSTRAINTS:
- ${dietConstraints}
- ${ingredientHints || 'No specific ingredients listed.'}
- ${timeConstraint || 'No time limit.'}
- ${cuisineHint || 'Any cuisine.'}
- Servings: ${servings}

Output ONLY a valid JSON object in this exact format, no explanation:
{
  "title": "Recipe Name",
  "description": "One sentence description",
  "diet": "diet type or null",
  "cookTime": "X min",
  "cuisine": "Cuisine",
  "servings": ${servings},
  "ingredients": [
    {"item": "amount + ingredient", "substitute": null}
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ],
  "nutrition": {
    "Calories": "XXX kcal",
    "Protein": "Xg",
    "Carbs": "Xg",
    "Fat": "Xg",
    "Fiber": "Xg",
    "Sugar": "Xg"
  },
  "shoppingList": ["item with quantity"]
}`;

  const raw = await generateText(prompt, { maxTokens: 2048, temperature: 0.5 });

  // Extract the JSON block from the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // JSON was malformed — return null so caller uses fallback
      return null;
    }
  }
  return null;
}

module.exports = { generateText, generateEmbeddings, generateRecipeJSON };
