# SanatanMarga 5.0 Beta — Migration & Operational Risk Register

## 1. Migration Risk Inventory

### MIG-01: Server Startup Full Database Scans & Automated Batch Deletion
- **Severity**: **CRITICAL**
- **Subsystem**: Server Initialization (`server.ts` lines 501-569 & 11639-11641)
- **Evidence**:
  - `(async () => { ... categorization startup migration ... })()` scans all articles and categories at boot time.
  - `cleanupDuplicatesAndGarbage(adminDb)` scans `categories`, `menuItems`, `menus`, `knowledge_base`, `knowledgeNodes` and issues delete batches 2 seconds after server boot.
- **Impact**: Violates the SanatanMarga 5.0 startup rule ("Normal startup must NOT: scan the whole database, run data migrations, rebuild the full snapshot tree"). Causes immediate Firestore read spikes and quota exhaustion on server restart.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 1 (Startup Decoupling). Move deduplication and categorization into explicit, authenticated admin CLI/jobs.

---

### MIG-02: Article Open Triggers Queue Mutation and Continuous Sync Prompts
- **Severity**: **HIGH**
- **Subsystem**: Reader Experience & Sync Queue (`src/pages/ArticlePage.tsx`)
- **Evidence**:
  ```ts
  // ArticlePage.tsx lines 130 & 172
  offlineQueue.autoSync().catch(() => {});
  offlineQueue.queueAction({
    type: 'CUSTOM',
    collection: 'articles',
    docId: id,
    data: { views: (bundle.article.views || 0) + 1 }
  });
  ```
- **Impact**: Merely reading articles pushes items to `offlineQueue`, waking up the `SyncStatusBadge` and causing the UI to show pending/syncing states to ordinary readers.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 2 (SyncOS & Unified Offline Engine). View telemetry must be batched asynchronously without polluting the reader transaction queue.

---

### MIG-03: Realtime Query Listeners on Static Article Pages
- **Severity**: **HIGH**
- **Subsystem**: Reader Experience & Firestore Quota (`src/pages/ArticlePage.tsx`)
- **Evidence**:
  ```ts
  // ArticlePage.tsx line 228
  const unsubComments = safeOnSnapshot(commentsQ, (snapshot) => { ... }, "comments/article");
  ```
- **Impact**: Thousands of concurrent readers create thousands of active Firestore stream connections for static article comments.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 3 (Instant Article & Snapshot Delivery).

---

### MIG-04: Degradation / Fallback Snapshot Overwriting Canonical R2 Objects
- **Severity**: **HIGH**
- **Subsystem**: Snapshot OS & R2 Continuity (`server/snapshotOs.ts`)
- **Evidence**: If Firestore read fails, `SnapshotOS` can populate `snapshotStore` from `backupData.ts` and push the degraded store to R2.
- **Impact**: Production canonical snapshots can be replaced by historical backup fixtures if a transient network/quota drop occurs during a rebuild.
- **Likelihood**: MEDIUM
- **Recommended 5.0 Phase**: Phase 4 (SnapshotOS 5.0 Event-Driven Rebuilds).

---

### MIG-05: Unrestricted Client Telemetry Writes to Firestore
- **Severity**: **MEDIUM**
- **Subsystem**: PWA & Revenue Telemetry (`src/hooks/usePWAInstall.ts`, `adDeliveryEventStore.ts`)
- **Evidence**:
  - `addDoc(collection(db, "pwa_telemetry"), ...)`
  - Direct ad impression `addDoc` writes from client components.
- **Impact**: High-frequency writes exhaust daily Firestore write quotas and trigger circuit breaker trip states.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 2 / Phase 5.
