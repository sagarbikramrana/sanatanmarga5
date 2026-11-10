# SanatanMarga 5.0 Beta — Data & Firestore Access Registry

## 1. Firestore Access Architecture & Gateways
The application implements two primary database access layers:
1. **Central Wrapper (`src/lib/firebase.ts`)**:
   - Provides `getDoc`, `getDocs`, `safeOnSnapshot`, `getDocWithCacheFallback`, `getDocsWithCacheFallback`.
   - Wraps read operations with `FirestoreCircuitBreaker` (`CLOSED`, `OPEN_QUOTA`, `HALF_OPEN`).
   - Traps internal assertion crashes (`ca9`, `b815`, `ve:-1`) and idle stream disconnects.
2. **Direct Client SDK Calls**:
   - Scattered throughout several modules that bypass the circuit breaker or write directly via raw `firebase/firestore` functions (`setDoc`, `updateDoc`, `addDoc`, `deleteDoc`).
3. **Server Admin SDK (`server.ts` & `server/*.ts`)**:
   - Privileged operations using `firebase-admin` with read/write interceptors.
   - Falls back to Client SDK when `FIREBASE_SERVICE_ACCOUNT` is not present.

## 2. Identified Direct Access Paths & Quota Risks

| Module / Component | Firestore Call Type | Access Method | Quota Bypass Risk | Notes |
|---|---|---|---|---|
| `src/hooks/usePWAInstall.ts` | `addDoc(collection(db, "pwa_telemetry"))` | DIRECT CLIENT SDK | HIGH | Writes on every client device PWA event |
| `src/pages/ArticlePage.tsx` | `safeOnSnapshot(commentsQ)` | CENTRAL WRAPPER | MEDIUM | Attaches live query listener on every article view |
| `src/pages/ArticlePage.tsx` | `offlineQueue.queueAction(views+1)` | OFFLINE QUEUE | HIGH | Queues a view update on every single article open |
| `src/hooks/usePushNotifications.ts` | `updateDoc(userRef, fcmTokens)` | DIRECT CLIENT SDK | LOW | Saves device token |
| `src/pages/admin/AdminRadioPage.tsx` | `setDoc`, `updateDoc`, `getDocs` | DIRECT CLIENT SDK | MEDIUM | Writes station & program settings directly |
| `src/services/revenue/adDeliveryEventStore.ts` | `addDoc` / `setDoc` | DIRECT CLIENT SDK | HIGH | High-frequency ad telemetry event writes |
| `server.ts` (startup) | `collection("categories").get()`, `collection("articles").get()` | ADMIN / CLIENT SDK | CRITICAL | Full database scan at boot time |
| `server.ts` (dedup) | `cleanupDuplicatesAndGarbage` | ADMIN SDK | CRITICAL | Scans & deletes batch records at boot time |

## 3. Comprehensive Collection Registry

| Collection Name | Purpose | Primary Readers | Primary Writers | Access Tier | Inconsistency / Risk |
|---|---|---|---|---|---|
| `articles` | Editorial news articles | Public (via R2 snapshot / fallback) | Admin, Editor | Admin/Staff write, Public read | High-volume canonical store |
| `categories` | News taxonomies | Public, Staff | Admin, System migration | Public read, Admin write | Scanned and normalized at server startup |
| `users` | User profiles & RBAC | Staff, Self | Self (creation), Admin | Auth required (Self/Admin) | Vulnerable to self-assigned roles on signup |
| `comments` | User comments on articles | Public, Staff | Authenticated readers | Public read, Auth write | Realtime listeners active on ArticlePage |
| `community_posts` | Chautari forum posts | Public, Staff | Authenticated users | Public read, Auth write | Duplicate schema: `communityPosts` vs `community_posts` |
| `communityPosts` | Chautari forum posts (legacy) | Public, Staff | Authenticated users | Public read, Auth write | Old camelCase collection still referenced in DR |
| `community_comments` | Chautari post replies | Public, Staff | Authenticated users | Public read, Auth write | Duplicate schema: `communityComments` vs `community_comments` |
| `events` | Cultural & civic events | Public, Staff | Admin, Editor | Public read, Admin write | Snapshot naming inconsistency (`event_<id>` vs `event/<id>`) |
| `models` | Cultural talent profiles | Public, Staff | Admin, Editor | Public read, Admin write | Stored with direct URLs |
| `ads` | Ad placements & banners | Public (via R2), Staff | Admin, RevenueOS | Public read, Admin write | Legacy schema alongside `campaigns` |
| `campaigns` | RevenueOS campaigns | Staff | Admin, Advertiser | Staff read/write | Overlaps with `ads` |
| `commerce_products` | Store products (set 1) | Public, Staff | Admin, Editor | UNRESTRICTED READ/WRITE | In rules: `allow create, update, delete: if isAdmin() || isEditor() || request.auth != null;` |
| `store_products` | Store products (set 2) | Public, Staff | Anyone | UNRESTRICTED | In rules: `allow read, write: if true;` |
| `commerce_orders` | Orders (set 1) | Public, Staff | Anyone | UNRESTRICTED CREATE | In rules: `allow create: if true;` |
| `store_orders` | Orders (set 2) | Public, Staff | Anyone | UNRESTRICTED | In rules: `allow read, write: if true;` |
| `store_order_audits` | Order audit trail | Staff | Anyone | UNRESTRICTED | In rules: `allow read, write: if true;` |
| `commerce_customers` | Store customers | Public, Staff | Anyone | UNRESTRICTED | In rules: `allow read, write: if true;` |
| `training_attempts` | Academy exam attempts | Server, Staff | Server | Server-only | Non-transactional writes |
| `training_certifications`| Issued certificates | Server, Public verify | Server | Server-only | Cryptographic HMAC validation |
| `knowledge_base` | Saraswati Knowledge entities | Public (via R2), Staff | Admin, Editor | Public read, Admin write | Deduplication runs on this at startup |
| `knowledgeNodes` | Knowledge graph nodes | Public, Staff | Admin | Public read, Admin write | Duplicate schema name alongside `knowledge_base` |
| `nepal_hub_live_updates`| District situation room updates | Public, Staff | Staff, SourcePoller | Public read, Staff write | High update frequency |
| `pwa_telemetry` | PWA installation analytics | Server | Client SDK | Unrestricted client writes | Direct `addDoc` writes from client |
| `tenants` | Multi-tenant definitions | Staff | Super Admin | Staff read, Super Admin write | Client filters in-memory; no backend partition |
| `settings` | Site-wide configuration | Public, Staff | Super Admin | Public read, Admin write | Fallback embedded in backupData.ts |
