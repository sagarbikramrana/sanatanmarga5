# Sanatan Marga / Sanatan Media — Master System Architecture (v2.6)

## 1. System Overview & Core Philosophy
Sanatan Marga is a high-performance, resilient, bilingual (Nepali & English) digital media and knowledge platform. It operates under a **Zero-Quota-Exhaustion** and **Publish Once → Snapshot → Cache → Reader** content delivery architecture designed for 99.99% availability even under network disruptions, quota limits, or severe latency.

---

## 2. Core Architectural Pillars

```
+-----------------------------------------------------------------------------+
|                                Client Layer                                 |
|  (React 18 + TypeScript + Vite + Tailwind CSS + PWA Service Worker + i18n)  |
+-----------------------------------------------------------------------------+
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │  Snapshot Engine OS │               │ Offline Sync Queue  │
        │  (Memory & IndexedDB│               │ (IndexedDB + Mutex) │
        │   Cache-First Read) │               └──────────┬──────────┘
        └──────────┬──────────┘                          │
                   │                                     │
                   ▼                                     ▼
    ┌─────────────────────────────┐        ┌─────────────────────────────┐
    │  Firestore (Cloud Database) │        │ Express Full-Stack Server   │
    │  - ai-studio-sanatanmedia   │        │ - Port 3000 (0.0.0.0)       │
    │  - Bounded queries & rules  │        │ - AI Newsroom Proxy (Gemini)│
    │  - Aggregated Snapshots     │        │ - Push / Broadcast API      │
    └─────────────────────────────┘        └─────────────────────────────┘
```

### 2.1 Content Delivery & Snapshot OS (`src/services/snapshotEngine.ts`)
- **Publish Once → Snapshot → CDN/Cache → Reader**: Public readership traffic never hits raw Firestore queries. It reads strictly from pre-aggregated snapshot documents (`/snapshots/home_v1`, `/snapshots/nepal_hub`, etc.) or in-memory / local IndexedDB caches.
- **Cache-First Hydration**: When the UI loads, it renders immediately from IndexedDB/Memory snapshots, eliminating loading latency and quota overhead.
- **Background Invalidation**: Editors triggering publishes, edits, or deletes dispatch `snapshotEngine.triggerPublishRebuild()`, refreshing the consolidated snapshot for all readers.

### 2.2 Offline-First Queue & Continuity Engine (`src/lib/offlineQueue.ts`)
- **Resilient Operations**: Any mutation created while offline or during quota-constrained windows is safely serialized into IndexedDB.
- **Auto-Sync & Drain**: Background listeners (`online`, `focus`, `firestore-quota-reset`) drain the queue via transactional batches and notify the UI via custom events (`offline-queue-changed`, `snapshot-rebuilt`).
- **Null Safety**: Event payloads always pass structured counters (`detail: { count }`) and consumers guard against undefined/null event parameters.

### 2.3 Bilingual Localization (`src/contexts/LanguageProvider.tsx`)
- Native Nepali (Default) and English support.
- Centralized helper `getLocalized(item, field, currentLang)` dynamically resolves dual-language fields (e.g., `titleNe` vs `titleEn`).
- Built-in phonetic transliteration engine (`src/lib/nepaliTransliteration.ts`) with custom virtual keyboard support (`NepaliInput.tsx`).

### 2.4 AI Newsroom & Knowledge Graph Integration
- **Server-Side AI Gateway** (`server.ts`): All Gemini calls (`gemini-3.6-flash`) are proxied securely with fallback heuristics and graceful rate-limit handling (`RESOURCE_EXHAUSTED` / 429).
- **Sanatan Knowledge Graph Engine** (`src/services/knowledgeGraphService.ts`): Ingests entities, sacred scriptures, locations, and cultural nodes, auto-linking related coverage and articles with zero hallucination.

### 2.5 Security & Data Governance
- Comprehensive Firestore security rules (`firestore.rules`) with granular role-based permissions (`isEditor()`, `isAdmin()`, `isBannedUser()`).
- Data consistency blueprint (`firebase-blueprint.json`) governing collections: `/articles`, `/discoveryQueue`, `/hotTopics`, `/nepal_hub_*`, `/snapshots`, and `/auditLogs`.

---

## 3. Directory Topology
- `src/components/`: Modular UI, layout, knowledge graph visualizers, and admin suites.
- `src/services/`: Snapshot OS, AI Newsroom, Knowledge Graph, Media OS, and Settings OS.
- `src/lib/`: Firebase client SDK, Offline Queue, Telemetry, Transliteration, and Error Handling.
- `src/pages/`: Public reader views (Home, Nepal Hub, Knowledge Base, Community) and Admin suites.
- `server.ts`: Express backend, Vite SSR/Dev middleware, API proxies, and Admin SDK handlers.
