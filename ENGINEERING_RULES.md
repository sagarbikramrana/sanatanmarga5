# Sanatan Marga / Sanatan Media — Engineering Rules & Operational Standards

## 1. Primary Objectives
1. **Correctness Before Speed**: Never optimize for speed at the expense of architectural correctness, type safety, or security.
2. **Quota Preservation**: Maximize Firestore read/write efficiency. Bounded queries, cache-first snapshots, and batch aggregations are mandatory.
3. **Continuity First**: The application must remain fully functional offline, during quota-exhausted states, or under severe connectivity drops.

---

## 2. Mandatory Rules of Engagement

### 2.1 Truthfulness & Verification
- Never claim an issue is "fixed", "tested", or "verified" without direct execution evidence.
- Always run `compile_applet` and `lint_applet` before marking tasks as complete.

### 2.2 No Mock / Fake Implementations
- **Strictly Forbidden**: `// TODO: implement later`, placeholder data stubs, fake services, or returning arbitrary boolean defaults without real implementation.
- All services and components must operate on real database records, real snapshot entities, or real server API proxies.

### 2.3 Quota Protection & Database Access Patterns
- **Rule 1**: Public readership views must **never** execute raw, unbounded `getDocs()` on high-volume collections. Use `snapshotEngine` or `getDocsWithCacheFallback()`.
- **Rule 2**: Writers (Editors/Admins) write to Firestore, then immediately trigger `snapshotEngine.triggerPublishRebuild()` to update the read layer.
- **Rule 3**: Telemetry and audit writes must be throttled and bounded to prevent write loops.

### 2.4 Event-Driven Communication Contracts
- Custom events on `window` (`offline-queue-changed`, `quota-status-changed`, `snapshot-rebuilt`) must **always** pass safe event detail payloads.
- Event listeners must use safe optional chaining and fallback lookups:
  ```typescript
  const count = e?.detail?.count ?? offlineQueue.getPendingCount();
  ```

### 2.5 Error Handling & Safe Fallbacks
- All external API calls (Gemini AI, Push Broadcasts, Network requests) must be wrapped in `try/catch` blocks with graceful fallbacks.
- Never let unhandled promise rejections crash React render loops or editor save actions.
- Use `handleFirestoreError(err, OperationType.WRITE, path)` for standardized audit reporting.

### 2.6 Minimal Change Principle
- Make the smallest safe change required to satisfy the user request.
- Preserve existing APIs, established data schemas, and naming conventions.
