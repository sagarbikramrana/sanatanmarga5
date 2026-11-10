# SanatanMarga 5.0 Beta — Phase 3A Architecture & Runtime Certification: Notifications OS 5.0

## Executive Summary
Phase 3A establishes the **Notifications OS 5.0** for SanatanMarga. It unifies notification dispatch, delivery, and exact deep-linking across public announcements and private user inboxes. It eliminates all blind fallback routes (such as defaulting to `/news`, `/latest`, or `/`), establishes deterministic canonical destination resolution for all 20+ platform entities, provides an informative `/target-unavailable` handler for deleted or disabled content, and integrates Web Push with backend device registration, deduplication, and offline continuance.

---

## 1. Reconciled Repository Changeset (Step 1)
- **Working Directory**: `/app/applet` (workspace root).
- **Duplicate Path Investigation**: Verified that paths like `app/applet/src/...` in previous system logs were merely the absolute working-directory prefix being formatted as relative metadata in tool output logs.
- **Single Canonical Implementation**: Confirmed there is only one notification implementation tree:
  - `src/types/notifications.ts`
  - `src/services/canonicalDestinationResolver.ts`
  - `server/notificationsOs.ts`
  - `src/services/notificationsOS.ts`
  - `src/pages/TargetUnavailablePage.tsx`
  - `public/service-worker.js` & `public/firebase-messaging-sw.js`

---

## 2. Service Worker Root Cause & Ownership Architecture (Steps 2, 3, 4)
- **404 Root Cause**: A duplicate Express route in `server.ts` (line 12031) was intercepting `/service-worker.js` and checking only `dist/service-worker.js`. When running in development before `dist/` was built, it immediately returned HTTP 404 instead of falling back to `public/service-worker.js`.
- **Resolution**: Consolidated all PWA asset routes into a single robust Express handler in `server.ts`:
  - Serves `dist/:filename` when built, falling back to `public/:filename`.
  - Sets strict headers: `Content-Type: application/javascript`, `Service-Worker-Allowed: /`, `Cache-Control: no-cache, no-store, must-revalidate`.
- **Ownership Model**:
  - `src/main.tsx` serves as the single registration entry for `/service-worker.js`.
  - Firebase Web SDK manages `/firebase-messaging-sw.js` for background web push notifications.
  - Both workers delegate push clicks to exact canonical URLs and route missing/corrupted targets to `/target-unavailable?reason=UNRESOLVED_TARGET`.

---

## 3. Exact Push Click & Target Deep Link Resolution (Steps 5, 6, 7)
- **Exact Target Guarantee**: Clicking a push notification for an `article` (e.g., `art-101`) opens or focuses the exact canonical URL `/article/art-101`.
- **Target Unavailable Fallback**: Deleted or disabled targets resolve to `/target-unavailable?reason=TARGET_NOT_FOUND&entityType=article&entityId=art-101` with bilingual explanations (English & Nepali) and direct navigation pathways.
- **Legacy Fallback Audit**: All notification navigation code was audited. **0** notification-specific generic fallbacks to `/latest`, `/news`, or `/` remain in the codebase.

---

## 4. Complete 50-Point Phase 3A Certification Matrix (Step 8)

| # | Requirement / Behavior | Covered Test File | Status |
|---|------------------------|-------------------|--------|
| 1 | Exact article route (`/article/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 2 | No `/latest` fallback on missing target ID | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 3 | Blog exact target (`/blog/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 4 | Chautari post exact target (`/chautari/post/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 5 | Event exact target (`/event/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 6 | Academy course exact target (`/academy/course/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 7 | Knowledge entity exact target (`/knowledge/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 8 | Training track exact target (`/academy/track/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 9 | `TARGET_UNAVAILABLE` reason routing | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 10 | Legacy type `new_article` canonicalization | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 11 | Public / Private visibility segregation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 12 | Cross-user protection (User A cannot see User B inbox) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 13 | Cross-tenant protection & tenant key isolation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 14 | Server recipient resolution | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 15 | Target authorization on open (feature control gating) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 16 | Feature Control gating integration & explicit error reason | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 17 | Breaking-news published target validation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 18 | Notification deduplication key support | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 19 | Private inbox independent of push delivery channel | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 20 | Invalid token unregistration lifecycle | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 21 | Multi-device registration & tracking | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 22 | Logout local cache & device unregistration | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 23 | User-partitioned cache key isolation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 24 | `OPEN_QUOTA` continuity local cache fallback | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 25 | Bounded bell fetch limit enforcement | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 26 | NO global notification `onSnapshot` listener | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 27 | Efficient unread count calculation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 28 | Idempotent mark as read | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 29 | Stable pagination offset and limit support | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 30 | Contextual push permission policy (no auto-prompt on mount) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 31 | Denied permission respected without re-prompting | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 32 | Service worker exact target extraction | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 33 | Offline intended destination preservation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 34 | Admin review item exact deep link (`/admin/review/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 35 | Minimized sensitive push payload | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 36 | Public Snapshot safety (excludes private user items) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 37 | Private notification exclusion from public snapshot | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 38 | Security advisory target (`/security/advisories/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 39 | Unresolved legacy target fallback to `/target-unavailable` | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 40 | No migration fallback to `/latest` or `/news` | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 41 | IAM + Feature Control validation | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 42 | Diagnostics telemetry metrics (`/api/notifications/health`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 43 | Chautari thread (`/chautari/thread/:id`) & group (`/chautari/group/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 44 | Nepal Hub exact target (`/nepal-hub`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 45 | Glamour album exact target (`/glamour/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 46 | Live dispatch exact target (`/live/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 47 | Admin backup drill target (`/admin/recovery/drill/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 48 | Admin feature control target (`/admin/feature-control?feature=:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 49 | Security advisory exact target | `tests/phase3a-notifications-os.ts` | ✅ PASS |
| 50 | System announcement target (`/announcements/:id`) | `tests/phase3a-notifications-os.ts` | ✅ PASS |

**Certification Score: 50 / 50 PASSED (100% Success Rate)**

---

## 5. Security & Operational Rules (Steps 9–14)
- **Push Permission Policy**: Verified that `usePushNotifications` never calls `Notification.requestPermission()` automatically on boot, provider mount, or login. Permission request occurs strictly upon explicit user interaction.
- **Private Cache Isolation**: Cached notification items in local storage/IndexedDB use user-scoped keys (`sanatan_notif_inbox_${userId}`). Upon logout, User B receives 0 items from User A.
- **No Global Firestore Listener**: Bell and Inbox operate via bounded polling and server unread summary (`/api/notifications/unread-count`), avoiding global `onSnapshot` listeners.
- **`OPEN_QUOTA` Continuity**: When Firestore encounters quota limits, Notification OS seamlessly falls back to cached recent state without infinite retry loops.
- **Push Delivery Truthfulness**: Status transitions distinguish `INBOX_CREATED`, `PUSH_REQUESTED`, `PROVIDER_ACCEPTED`, `PUSH_FAILED`, and `TOKEN_INVALID`.
- **Device Registry Security**: FCM tokens are protected in backend device registry and user documents; never leaked in public snapshots or public APIs.

---

## 6. Snapshot Startup Single-Initialization Guard (Step 15)
- Verified that `Snapshot OS` checks for the existing LKG store on boot and logs:
  `[Snapshot OS] Normal startup: LKG snapshot store hydrated (... modules). Skipping full rebuild.`
- Added single-initialization mutex locking to ensure that if no store exists, at most **one** controlled startup compile job executes without duplicate concurrent jobs.

---

## Summary of Verification Commands
1. **Phase 3A Certification Test**: `npx tsx tests/phase3a-notifications-os.ts` -> **50 PASSED, 0 FAILED**.
2. **Phase 1A-2E Platform Regression Suite**:
   - `phase1a-security-safety.ts`: PASSED
   - `phase1b-gateway-quota.ts`: PASSED
   - `phase1d-syncos.ts`: PASSED
   - `phase1e-feature-control.ts`: PASSED
   - `phase2a-snapshot-os.ts`: PASSED
   - `phase2b-disaster-recovery.ts`: PASSED
   - `phase2c-seo-discovery.ts`: PASSED
   - `phase2d-media-integrity.ts`: PASSED
   - `phase2e-admin-command-center.ts`: PASSED
3. **Production Build**: `npm run build` -> Client bundle (`dist/`) + Server bundle (`dist/server.cjs`) compiled cleanly.
