# SanatanMarga 5.0 Beta — Phase 0 Summary & Safe Cleanup Plan

## 1. Executive Summary
Phase 0 of the SanatanMarga 5.0 Beta evolution conducted a thorough, read-only architectural audit of the entire existing codebase. Every subsystem—including Routing, Admin Workspaces, Data Architecture, Firestore Access, Realtime Listeners, Snapshot OS / R2, Offline/Sync, Notifications, IAM/Security, Tenant Isolation, AI Models, MediaOS, Academy, and Commerce—was traced to its actual implementation files without altering code or schemas.

## 2. High-Level Dependency Graph
```
[ Firebase Auth / Token Verifier ]
  ├── [ PermissionsContext & RBAC ]
  │     ├── [ Admin Panels / Workspaces ]
  │     ├── [ Newsroom Editor & Workflows ]
  │     └── [ Chautari Moderation ]
  └── [ User Profile / My Sanatan ]

[ Central Data Gateway & Firestore Circuit Breaker ]
  ├── [ Cloud Firestore Canonical Collections ]
  └── [ Server Snapshot OS Engine ]
        ├── [ Cloudflare R2 Snapshot Buckets ]
        │     ├── Public Homepage / Latest / Breaking
        │     ├── Canonical Article Snapshots
        │     ├── Saraswati Knowledge Graph
        │     ├── Nepal Hub & 77 Districts
        │     └── ListenOS / Radio Bulletins & Audio R2
        └── [ Local Continuity Edge Cache / IndexedDB ]

[ Feature Control OS ]
  ├── [ Route Feature Guards ]
  ├── [ Component Level Feature Gates ]
  └── [ Navigation OS Dynamic Menus ]

[ MediaOS Global Audio Controller ]
  ├── [ Sanatan Radio 24/7 Engine ]
  ├── [ Nepali TTS Streaming & R2 Pre-generation ]
  └── [ ListenOS Player Dock ]
```

## 3. Safe 5.0 Cleanup Sequence

### Phase A: Safe Removal After Verification (Zero Risk)
- Delete over 60 scratch scripts in repository root (`fix_*.py`, `fix_*.sh`, `patch_*.sh`, `patch_*.py`, `replace_*.py`).
- Delete orphaned pages: `src/pages/AdminMediaOS.tsx` and `src/pages/AdminMediaLibrary.tsx` (all routes already point to `AdminMediaAssetsPage.tsx`).

### Phase B: Merge Before Removal (Controlled Consolidation)
- Merge duplicate revenue services:
  - Merge `src/services/billingEngine.ts` into `src/services/revenue/billingEngine.ts`.
  - Merge `src/services/adDeliveryEventStore.ts` into `src/services/revenue/adDeliveryEventStore.ts`.
  - Merge `src/services/revenueLedger.ts` into `src/services/revenue/revenueLedgerService.ts`.
- Merge duplicate admin health dashboards:
  - Consolidate `AdminHealth`, `AdminPlatformHealth`, `AdminOperations` into `AdminMissionControl` and `AdminSystemHealth`.
- Merge duplicate governance pages:
  - Consolidate `AdminDataGovernance` and `AdminContentAudit` into `AdminGovernancePage`.

### Phase C: Compatibility Layer Retained Temporarily
- Retain `/chautari`, `/media`, `/story-evolution`, `/daily-briefing`, `/academy/training` route redirects for external link backwards compatibility.
- Retain `BACKUP_CATEGORIES` and `BACKUP_SITE_SETTINGS` as cold emergency boot fallbacks, but ensure SnapshotOS never publishes them to R2.

### Phase D: Data & Security Migration Required
- **SEC-01**: Remove client email-prefix role determination in `src/lib/auth.tsx`. Enforce server-side role assignment.
- **SEC-02**: Close open read/write holes on `store_products`, `store_orders`, `commerce_customers` in `firestore.rules`.
- **MIG-01**: Decouple startup database scans and batch deduplication jobs from `server.ts` boot sequence into scheduled/admin tasks.

### Phase E: Cannot Yet Remove
- Do not remove `offlineQueue` until `SyncOS 5.0` is built.
- Do not remove `RadioEngine` or `audioPlaybackManager` until unified audio dock is tested.
- Do not delete sample product fixtures in `StorePage.tsx` until actual transactional commerce is implemented.

## 4. Acceptance Criteria Verification Checklist
- [x] Current framework/tool versions repository-verified (React 19, Vite 6, TS 5.8, Express 4.21, Firebase 12.11 / Admin 13.8).
- [x] All major routes inventoried (80+ routes mapped).
- [x] Admin modules inventoried and grouped into 11 domains.
- [x] Major service/engine architecture mapped.
- [x] Firestore direct access paths inventoried.
- [x] Realtime listeners and pollers inventoried.
- [x] Startup side effects mapped (categorization migration and deduplication found).
- [x] Snapshot OS / R2 architecture mapped.
- [x] Offline/sync architecture audited (view counter pollution identified).
- [x] Notifications architecture mapped.
- [x] Users/roles/auth mapped (client-side role assignment vulnerability identified).
- [x] Feature Control mapped (route guard gaps identified).
- [x] Tenant architecture mapped (identified as UI-only).
- [x] Language / translation / transliteration mapped.
- [x] AI integrations mapped.
- [x] Article critical path mapped.
- [x] Homepage Manager mapped.
- [x] Community / social systems mapped.
- [x] Academy mapped (in-memory lock and non-transactional issuance identified).
- [x] Knowledge / SGIS / Nepal Hub / Timeline / Archive mapped.
- [x] Radio / MediaOS mapped (single playback controller verified).
- [x] Events mapped.
- [x] Store / Commerce mapped (identified as WhatsApp order mock).
- [x] Revenue / Ads mapped.
- [x] Reader activity / analytics mapped.
- [x] Settings / Developer / API keys mapped (mock API key generator identified).
- [x] Disaster Recovery capabilities mapped.
- [x] PWA / service worker mapped.
- [x] Legacy / duplicate / dead-code candidates documented without deletion.
- [x] Baseline build and typecheck verified.
- [x] Migration and Security Risk Registers created.
- [x] Safe cleanup sequence created.
