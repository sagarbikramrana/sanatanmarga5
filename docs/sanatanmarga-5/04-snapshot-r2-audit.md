# SanatanMarga 5.0 Beta — Snapshot OS & Cloudflare R2 Audit

## 1. Snapshot Architecture Overview
Snapshot OS is the high-availability public delivery layer for SanatanMarga. It decouples reader traffic from live Firestore operations by compiling validated canonical JSON documents and publishing them to Cloudflare R2 and local static caches.

### Storage Buckets & Endpoints
- **Media R2 Bucket**: `sanatanos-assets` (`https://assets.sanatanmarga.com`)
- **Snapshot R2 Bucket**: `sanatanos-snapshots` (`SNAPSHOT_R2_PUBLIC_URL` or fallback to Media R2 endpoint)
- **Local Cache Vault**: `/public/snapshots/`, `/public/cache/`, `/data/snapshot_store.json`, `/data/snapshot_module_hashes.json`

## 2. Manifest Architecture & Chain
- **Manifest Endpoint**: `/api/cache/manifest.json` and `/api/vault/manifest`
- **Format**:
  ```json
  {
    "snapshotVersion": "v5.1.0-svrp",
    "generatedAt": "2026-09-28T...",
    "manifestVersion": 5,
    "previousVersionHash": "...",
    "manifestHash": "...",
    "continuityScore": 99.9,
    "totalSizeBytes": 1420580,
    "totalModules": 42,
    "modules": {
      "homepage": { "version": "1.0", "sha256": "...", "sizeBytes": 42800, "layer": "layer1" },
      "articles": { ... }
    },
    "historyChain": [ ... ]
  }
  ```

## 3. Snapshot Identity Inventory

| Snapshot Module | Target Object Key | Layer | Trigger Sources | Fallback Behavior |
|---|---|---|---|---|
| `homepage` | `homepage.json` | Layer 1 | Editorial publish, category change, hero update | Embedded `BACKUP_CATEGORIES` / `LAST_VERIFIED_ARTICLES` |
| `homepage-ne` | `homepage-ne.json` | Layer 1 | Nepali homepage build | Fallback to `homepage.json` |
| `homepage-en` | `homepage-en.json` | Layer 1 | English homepage build | Fallback to `homepage.json` |
| `latest` | `latest.json` | Layer 1 | New article publication | Dynamic articles cache |
| `breaking` | `breaking.json` | Layer 1 | Breaking news ticker toggle | Empty array if no active ticker |
| `trending` | `trending.json` | Layer 1 | Hourly view tally | Most recent top articles |
| `categories` | `categories.json` | Layer 1 | Category CRUD | `BACKUP_CATEGORIES` |
| `nepal_hub` | `nepalhub.json`, `nepal_hub/districts.json` | Layer 2 | Weather, forex, panchang updates | Static district data (`nepalData.ts`) |
| `knowledge` | `knowledge/entities.json`, `knowledge/graph.json` | Layer 3 | Knowledge graph mutations | Local knowledge cache |
| `archives` | `archives/records.json`, `archives/manifest.json` | Layer 3 | Archive document updates | Static record fixtures |
| `timeline` | `timeline/events.json`, `timeline/manifest.json` | Layer 3 | Timeline milestones CRUD | Static timeline fixtures |
| `events` | `events/upcoming.json`, `events/featured.json` | Layer 2 | Event editor | Static event list |
| Individual Article | `article_<id>.json` | Layer 2 | Editorial publish | Server adminDb fetch -> Dynamic local articles |
| Article Comments | `comments/article_<id>.json` | Layer 2 | Comment write | In-memory / empty comments |
| Chautari Thread | `chautari/thread/<id>.json` | Layer 2 | Forum reply | LocalStorage forum cache |

## 4. Key Structural Risks & Inconsistencies
1. **Duplicate Event Identifiers**:
   - Some files named `event_<id>.json` (e.g. `event_indra_jatra_2026.json`), while others are organized under `events/calendar.json` and `events/upcoming.json`.
2. **Article Identity Prefixing**:
   - Snapshot objects use `article_<id>.json` format. If `<id>` already starts with `article_` (e.g. `article_art-admin-sync-test`), the file becomes `article_article_...` in some legacy builder passes.
3. **Recovery Data Risk**:
   - If canonical data fails to load, `backupData.ts` records can be compiled into `snapshotStore` and inadvertently pushed to R2, overwriting canonical historical snapshots.
   - **5.0 Absolute Rule**: In SanatanMarga 5.0, degraded/fallback data must NEVER be published to R2 as a new canonical snapshot.
4. **Rebuild Coalescing**:
   - `SnapshotOS` in `server/snapshotOs.ts` implements a debounce queue (`setInterval` every 10s and coalesced timers), but multiple rapid edits can trigger full store re-evaluation.
