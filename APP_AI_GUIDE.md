# Prithvi Path Media v3.0 - AI Capabilities & Integration Blueprint

This document explains in detail how the artificial intelligence (AI) features are implemented, structured, and executed in the **Prithvi Path Media v3.0** platform. Use this guide to review our AI integration architecture with your engineering, content, and product teams.

---

## 1. Autonomous AI Journalist Engine
The platform includes a real-time, search-grounded content writer that allows editors and administrators to generate high-quality, professional news articles in Nepali.

### How it Works (Under the Hood)
1.  **Linguistic Grounding**: The AI is instructed to compose strictly in a formal, highly professional journalistic Nepali style.
2.  **Google Search Grounding**: Rather than relying purely on pre-trained parametric knowledge, the engine uses **Gemini's Google Search Tool**. This enables the AI to fetch, scan, and extract details from live web pages, traditional media houses, and government portals from today.
3.  **Search Modes**:
    *   **Standard Mode**: Performs general news queries across reputable portals.
    *   **Twitter Trending Mode**: Instructs the search engine to prioritize public discourse, trending hashtags, and emerging debates on X (formerly Twitter) about the topic.
    *   **Breaking News Mode**: Restricts search results to indexing updates published strictly within the last 1 to 4 hours to prioritize speed and immediate event reporting.
4.  **Automatic Duplication Prevention**:
    *   *Before writing*: The system queries Firestore for the last 15 published articles in the chosen category and sends their titles as an `avoidTopics` list to the AI.
    *   *After writing*: The system cross-checks the generated title in the Firestore database. If an article with that title already exists, the generation is rejected to keep the feed fresh and unique.
5.  **Multi-Dimensional Output Structure**: The AI returns a structured JSON payload containing:
    *   `title`: Catchy, factual news headline in Nepali.
    *   `excerpt`: Concise 3-4 sentence news summary.
    *   `content`: Full-length detailed article written in multi-paragraph HTML (`<p>`, `<h2>`, `<blockquote>`, `<strong>`) suitable for instant web rendering.
    *   `districts`: Specific Nepalese districts associated with the incident (selected from a validated list of 77 districts).
    *   `imageKeywords`: English descriptive keywords tailored to search for representative media.
    *   `sourceUrls`: Verifiable URLs of original web articles scanned during the search phase.
    *   `socialHook`: An engaging, highly clickable conversational social media hook (2-3 sentences) in Nepali with context-relevant emojis and open-ended questions for posting on Facebook.

---

## 2. Dynamic Media & Photo Acquisition
To match the written content with engaging visuals, the platform utilizes a fallback-safe dynamic media pipeline.

### How it Works
1.  **Context-Aware Keywords**: The AI identifies 3 to 5 English search keywords tailored to the news topic (e.g., `['Kathmandu', 'Nepal Elections', 'Parliament']`).
2.  **Wikimedia Commons Fetch**: The frontend executes a real-time, non-blocking query to the **Wikimedia Commons API** using the generated search string. If a free-use photo matches the tags, it is dynamically retrieved and embedded as the cover photo.
3.  **Seed-Based Scenic Backup**: If Wikimedia returns no results or is unreachable, the system automatically falls back to generating a thematic, styled placeholder photo using **Picsum Seeds** tied to the article title. This guarantees every article always displays a high-quality visual banner.

---

## 3. Smart Key Rotation & Quota Recovery System
To handle standard API rate limits (such as Google Gemini's 429 quota limits or user-defined billing exhaustion), we engineered a resilient, self-healing key rotation system.

### How it Works
1.  **Multi-Tier Key Pooling**: The service pulls keys from multiple locations:
    *   *Environment-Level*: Key defined directly inside the system container variables.
    *   *Database-Level*: Primary and fallback keys securely stored inside a specific Firestore settings document (`settings/keys`).
2.  **Active Quota Error Detection**: When a request to the Gemini API is sent, the wrapper monitors for specific error patterns (such as HTTP `429`, `Quota exceeded`, `rate limit`, or `RESOURCE_EXHAUSTED`).
3.  **Automatic Key Swapping**: If a key-limit error occurs, the server instantly logs a warning, skips to the next available API key in the pool, and retries the generation. This ensures continuous, uninterrupted editorial workflows even during peak traffic or quota limits.
4.  **Model Cascade Routing**: If a generation fails on a premium model, the system tries to cascade requests down a list of alternate Gemini models (`gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`, `gemini-flash-latest`) to secure the most intelligent available model at any given millisecond.

---

## 4. Phonetic Latin-to-Devanagari Transliteration Input
To simplify content entry for local writers and readers who may not have dedicated Devanagari keyboards configured on their devices, we integrated a real-time phonetic typing tool.

### How it Works
1.  **Dynamic Key Event Capture**: The platform monitors input fields wrapped in the custom `NepaliInput` component.
2.  **Sound-Based Transliteration Algorithm**: Converts Latin keyboard entries into phonetically matched Unicode Devanagari equivalents on-the-fly. For example:
    *   Typing `nepal` renders `नेपाल`.
    *   Typing `rajniti` renders `राजनीति`.
3.  **Seamless Integration**: Applied across comments, forum boards, administrative article composers, and global search bars, drastically lowering the friction for local language participation.
