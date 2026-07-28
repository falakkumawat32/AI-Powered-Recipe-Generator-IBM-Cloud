# RecGenAI — Document Q&A RAG Agent for Recipe Generation

> **IBM Watsonx AI** + **RAG (Retrieval-Augmented Generation)** powered recipe assistant.
> Upload cookbooks, PDFs, and recipe blogs — then chat with your knowledge base to generate personalised, dietary-aware recipes.

---

## Project Structure

```
recipe-rag-agent/
├── frontend/                    # Vanilla HTML/CSS/JS UI
│   ├── index.html               # Main app shell
│   └── src/
│       ├── style.css            # Full dark-theme styles
│       └── app.js               # Frontend application logic
│
├── backend/                     # Node.js + Express API server
│   ├── package.json
│   ├── .env.example             # ← Copy to .env and fill credentials
│   └── src/
│       ├── server.js            # Express app entry point
│       ├── routes/
│       │   ├── chat.js          # POST /api/chat — RAG Q&A
│       │   ├── documents.js     # Upload / ingest / delete docs
│       │   └── recipes.js       # Generate, search, substitutions
│       ├── services/
│       │   ├── watsonxService.js        # IBM Watsonx AI SDK calls
│       │   ├── vectorStoreService.js    # TF-IDF retrieval engine
│       │   ├── ingestionService.js      # PDF/TXT/DOCX/MD parsing
│       │   └── recipeAdaptationService.js # Substitutions & scaling
│       └── utils/
│           └── fallback.js      # Demo mode (no API key needed)
│
├── package.json                 # Root workspace scripts
└── README.md
```

---

## Quick Start

### 1. Install backend dependencies

```bash
cd recipe-rag-agent/backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `IBM_WATSONX_API_KEY` | [IBM Cloud IAM → API Keys](https://cloud.ibm.com/iam/apikeys) |
| `IBM_WATSONX_PROJECT_ID` | [Watsonx.ai Projects page](https://dataplatform.cloud.ibm.com/projects/) |
| `IBM_WATSONX_URL` | Your region URL (default: `https://us-south.ml.cloud.ibm.com`) |
| `IBM_WATSONX_MODEL_ID` | `ibm/granite-13b-instruct-v2` (recommended) |

> **No API key yet?** The app runs in **demo mode** — all features work with pre-built sample recipes.

### 3. Start the backend

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Backend starts at **http://localhost:3001**

### 4. Open the frontend

Open `frontend/index.html` directly in your browser, **or** serve it:

```bash
# From project root
npx serve frontend -p 5500
```

Then visit **http://localhost:5500**

---

## Features

### Chat Q&A (RAG)
- Ask natural language questions: *"How do I make a gluten-free chocolate cake?"*
- The agent retrieves relevant chunks from your indexed documents
- IBM Granite model generates precise, context-aware answers
- Full recipe card rendered in the right panel

### Document Ingestion
- **Upload**: PDF, TXT, DOCX, Markdown (up to 20 MB each)
- **URL Ingest**: Paste any recipe blog URL — content is scraped and indexed automatically
- Documents are chunked with overlap for optimal retrieval quality

### Personalisation Sidebar
| Setting | Effect |
|---|---|
| Dietary chips | Auto-suggests ingredient substitutions |
| Cuisine | Biases recipe generation toward that cuisine |
| Cook time | Filters/adapts recipes to fit your schedule |
| Available ingredients | Removes owned items from shopping list |
| Servings | Auto-scales all ingredient amounts |

### Recipe Panel
- Structured output: title, badges, ingredients with substitution hints, numbered steps
- Nutritional facts grid (per serving)
- Interactive shopping list (check items off)
- Print / Copy / Download as `.txt`

---

## API Reference

### `POST /api/chat`
```json
{
  "message": "How do I make vegan brownies?",
  "history": [],
  "preferences": {
    "diet": ["vegan"],
    "cookTime": 45,
    "ingredients": ["cocoa", "flour"],
    "servings": 4
  }
}
```
Response: `{ response, recipe, sources, model }`

### `POST /api/documents/upload`
Multipart form — field name: `file`

### `POST /api/documents/ingest-url`
```json
{ "url": "https://example.com/recipe-blog" }
```

### `GET /api/documents`
Returns all indexed documents.

### `DELETE /api/documents/:id`
Removes document from index.

### `POST /api/recipes/generate`
```json
{ "query": "spicy Thai noodles", "preferences": {} }
```

### `GET /api/recipes/search?q=chocolate`
Keyword search across all indexed content.

### `POST /api/recipes/substitutions`
```json
{ "ingredients": ["butter", "eggs"], "diet": ["vegan"] }
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | IBM Watsonx AI — Granite 13B Instruct |
| Embeddings | IBM Slate 125M English Retriever |
| Retrieval | TF-IDF cosine similarity (in-process, no DB) |
| Backend | Node.js 18 + Express 4 |
| File parsing | `pdf-parse`, `node-html-parser`, `cheerio` |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES2020) |

---

## IBM Watsonx Models Supported

| Model ID | Best for |
|---|---|
| `ibm/granite-13b-instruct-v2` | Instruction following, recipes |
| `ibm/granite-13b-chat-v2` | Conversational Q&A |
| `meta-llama/llama-3-70b-instruct` | Longer, richer responses |
| `ibm/slate-125m-english-rtrvr` | Embeddings / semantic search |

---

## License

MIT © 2025 RecGenAI
