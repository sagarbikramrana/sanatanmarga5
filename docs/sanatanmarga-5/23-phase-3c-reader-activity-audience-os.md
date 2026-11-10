# Phase 3C — Reader Activity & Audience OS 5.0 Certification Specification

## 1. Executive Overview
Phase 3C establishes **Reader Activity & Audience OS 5.0**, a bounded, privacy-first, local-aware audience telemetry and reading continuation engine for SanatanMarga 5.0 Beta. 

The architecture strictly decouples reading telemetry from authoritative user state (such as Saved Articles, Bookmarks, and Follows), eliminates direct database write per interaction, guarantees that audience ingestion failures never block or degrade article rendering, and enforces strict data minimization (coarse dwell buckets, four reading milestones, origin-only referrers, and allowlisted UTM taxonomy).

---

## 2. Core Invariants & Architectural Rules

| Subsystem | Architectural Invariant |
|---|---|
| **Privacy & Fingerprinting** | Anonymous IDs are cryptographically random UUIDs; no device fingerprinting, canvas hashing, or persistent PII inference. |
| **Identity Separation** | Anonymous clients cannot forge authenticated user IDs; authenticated sessions strictly match verified auth tokens. |
| **Data Authority** | Telemetry events do NOT replace authoritative user actions (e.g. Save, Bookmark, Follow). History is an auxiliary cache; clearing history never modifies security audit logs. |
| **Progress & Dwell** | Milestones are strictly coarse: `25%`, `50%`, `75%`, `100%`. Active dwell accumulates only when the tab is visible; background tabs immediately pause tracking. |
| **Completion Rule** | An article is marked complete if and only if progress reaches $\ge 75\%$ AND active dwell is $\ge 15\text{ seconds}$. |
| **Storage & Buffering** | Local queues are bounded at 100 events; batches are limited to 50 events and 256 KB. Stale events older than 30 days are purged. |
| **Circuit Breaker** | When global Firestore quota circuit breaker is `OPEN_QUOTA`, optional telemetry ingestion pauses without spinning retry storms. `HALF_OPEN` health checks are handled centrally. |
| **Tenant & Scope** | Anonymous events cannot submit cross-tenant IDs. Internal previews (`/admin`, `/draft`) and private content are excluded from public audience aggregates. |
| **Snapshot OS Decoupling** | Public audience snapshots contain aggregate metrics only (views, completions, dwell buckets, device class, language) and strictly exclude user IDs and session IDs. |
| **Non-Blocking Delivery** | Audience failures, backpressure, or rate limiting never degrade or block public article delivery. |

---

## 3. Supported Taxonomy & Data Model

### A. Registry-Approved Event Types
- `ARTICLE_OPEN`
- `ARTICLE_READ_PROGRESS`
- `ARTICLE_COMPLETE`
- `PAGE_VIEW`
- `SAVE`
- `UNSAVE`
- `SHARE`
- `SEARCH_QUERY`
- `NOTIFICATION_OPEN`
- `MEDIA_PLAY`
- `MEDIA_PAUSE`
- `MEDIA_COMPLETE`
- `COMMUNITY_TOPIC_VIEW`
- `COURSE_VIEW`
- `LESSON_COMPLETE`

### B. Coarse Milestones & Dwell Buckets
- **Milestones**: `25%`, `50%`, `75%`, `100%`
- **Dwell Buckets**: `< 15s`, `15_60s`, `1_3m`, `3_5m`, `> 5m`
- **Device Classes**: `mobile`, `tablet`, `desktop`, `unknown`
- **Language Classes**: `ne`, `en`, `all`

---

## 4. REST & Gateway Endpoints

| Endpoint | Method | Auth Scope | Description |
|---|---|---|---|
| `/api/audience/events/batch` | `POST` | Public / Optional Auth | Ingests bounded batch of client activity events with idempotency deduplication |
| `/api/audience/content/:entityId` | `GET` | Public | Returns aggregated reading metrics for public canonical entity |
| `/api/audience/telemetry` | `GET` | Public / Diagnostics | Returns pipeline health, ingestion rates, and dedup cache metrics |
| `/api/admin/audience/summary` | `GET` | `admin` / `super_admin` / `audience.view` | Returns system-wide audience intelligence overview |

---

## 5. 70-Point Verification Matrix

| # | Invariant / Requirement | Expected Behavior | Status |
|---|---|---|---|
| 1 | Event taxonomy verification | Rejects unknown event types with 400 | ✅ PASS |
| 2 | Event metadata schema bounded | Strictly defined types & sizes | ✅ PASS |
| 3 | Sensitive token rejection | Rejects passwords, tokens, API keys, CVV in metadata | ✅ PASS |
| 4 | Authenticated user verification | Canonical auth token verifies user ID | ✅ PASS |
| 5 | Anonymous user forgery rejection | Anonymous cannot claim user ID | ✅ PASS |
| 6 | Anonymous ID generation | Random non-fingerprinted UUID | ✅ PASS |
| 7 | Session ID privacy | Session ID does not imply personal identity | ✅ PASS |
| 8 | Bounded local queue | Max 100 queued events in client storage | ✅ PASS |
| 9 | Queue expiration | Events > 30 days old are discarded | ✅ PASS |
| 10 | Batch buffering | Client flushes in batches, avoiding 1-write-per-event | ✅ PASS |
| 11 | `OPEN_QUOTA` circuit breaker | Pauses optional analytics ingestion cleanly | ✅ PASS |
| 12 | No retry storm | Rejected quota batches do not cause rapid retry loops | ✅ PASS |
| 13 | `HALF_OPEN` isolation | Telemetry does not probe Firestore during recovery | ✅ PASS |
| 14 | Duplicate page view suppression | Session + route suppression | ✅ PASS |
| 15 | Rerender idempotency | React component re-render does not emit new page views | ✅ PASS |
| 16 | Prefetch isolation | Link prefetching does not increment read metrics | ✅ PASS |
| 17 | Canonical entity recording | Article opens map to canonical entity ID | ✅ PASS |
| 18 | Coarse milestones | Emits only 25, 50, 75, 100 milestones | ✅ PASS |
| 19 | Milestone deduplication | Same milestone emitted at most once per article session | ✅ PASS |
| 20 | Background tab pause | Tab hidden pauses active dwell accumulation | ✅ PASS |
| 21 | Continue Reading identity | Stores entity reference only, not full article body | ✅ PASS |
| 22 | Continuation body isolation | Full article body never stored in history cache | ✅ PASS |
| 23 | Anonymous continuation | Works local-first in browser storage | ✅ PASS |
| 24 | Authenticated continuation | Synchronized and user-partitioned | ✅ PASS |
| 25 | Article completion rule | Milestone $\ge 75\%$ AND dwell $\ge 15\text{s}$ | ✅ PASS |
| 26 | Save system authority | Bookmarking remains authoritative in bookmark store | ✅ PASS |
| 27 | Telemetry non-replacement | Activity event is telemetry copy only | ✅ PASS |
| 28 | Follow system authority | Follow preferences remain canonical | ✅ PASS |
| 29 | History retention bounds | Maximum 50 items retained per user | ✅ PASS |
| 30 | Audit log independence | Clearing history leaves security audit logs intact | ✅ PASS |
| 31 | Partitioned user cache | User A cannot inspect User B history cache | ✅ PASS |
| 32 | Logout partitioning | Private continuation cleared on sign-out | ✅ PASS |
| 33 | Policy enforcement | Respects telemetry collection toggles | ✅ PASS |
| 34 | Sensitive metadata rejection | Strict metadata sanitization | ✅ PASS |
| 35 | Auth token exclusion | Tokens stripped from metadata | ✅ PASS |
| 36 | Notification privacy | Notification open records ID, no push payload | ✅ PASS |
| 37 | Preview traffic exclusion | `/admin` and preview routes excluded from audience | ✅ PASS |
| 38 | Draft article exclusion | Unreleased drafts excluded from public metrics | ✅ PASS |
| 39 | Private content exclusion | Restricted content excluded from public aggregates | ✅ PASS |
| 40 | Media controller integration | Consumes global audio controller events | ✅ PASS |
| 41 | Academy answer exclusion | Quiz answers cannot leak into audience events | ✅ PASS |
| 42 | Commerce privacy | Payment data cannot enter telemetry events | ✅ PASS |
| 43 | Raw retention bounds | Server raw event memory bounded | ✅ PASS |
| 44 | De-identified aggregates | Aggregates contain zero user IDs | ✅ PASS |
| 45 | Public snapshot privacy | Snapshots contain zero session IDs | ✅ PASS |
| 46 | Asynchronous counters | Page view does not update DB counter synchronously | ✅ PASS |
| 47 | Batch retry idempotency | Replaying batch produces deduplicated count | ✅ PASS |
| 48 | Duplicate event double-count safety | Replayed event does not increment view count | ✅ PASS |
| 49 | Batch count limit | Max 50 events enforced | ✅ PASS |
| 50 | Batch byte limit | Max 256 KB enforced | ✅ PASS |
| 51 | Schema versioning | Reject schema version $\ne 1$ | ✅ PASS |
| 52 | Future timestamp clamping | Clamps clock skew $> 5\text{ min}$ into future | ✅ PASS |
| 53 | Anonymous tenant safety | Anonymous cannot specify foreign tenant | ✅ PASS |
| 54 | User history authorization | Endpoints reject cross-user history queries | ✅ PASS |
| 55 | Search analytics sanitization | Strips sensitive query terms | ✅ PASS |
| 56 | Referrer origin-only | Query params stripped from referrers | ✅ PASS |
| 57 | UTM allowlist | Allowed UTM keys only (`source`, `medium`, `campaign`) | ✅ PASS |
| 58 | Language metric privacy | Language does not infer user identity | ✅ PASS |
| 59 | Coarse device classification | `mobile`, `tablet`, `desktop`, `unknown` | ✅ PASS |
| 60 | No precise geolocation | No GPS or precise coordinates stored | ✅ PASS |
| 61 | Feature control suppression | `audience.activity` disabled stops ingestion | ✅ PASS |
| 62 | User state retention | Retained per retention policy | ✅ PASS |
| 63 | Non-blocking failure safety | Telemetry failure never blocks article read | ✅ PASS |
| 64 | Command Center integration | Cleanly surfaces audience summary in admin | ✅ PASS |
| 65 | Admin authorization | Audience summary requires admin permissions | ✅ PASS |
| 66 | No fabricated zeros | Metric provider error reports degraded, not fake 0 | ✅ PASS |
| 67 | Approximate metrics labeling | Approximate counts clearly tagged | ✅ PASS |
| 68 | Trending safety | Trending algorithms consume de-identified metrics | ✅ PASS |
| 69 | Audit naming | Explicit audit event names (`audience_event_ingest`) | ✅ PASS |
| 70 | Public navigation safety | Existing public navigation completely unaffected | ✅ PASS |

---

## 6. Phase 3C.1 Final Certification Details

### A. Exact Individual Regression Accounting
| Suite File | Type | Passed | Failed | Exit Code | Notes |
|---|---|---|---|---|---|
| `tests/phase1a-security-safety.ts` | Specification | 26 | 0 | 0 | Core RBAC, tenant isolation, and security |
| `tests/phase1b-gateway-quota.ts` | Specification | 32 | 0 | 0 | Firestore gateway & circuit breaker policy |
| `tests/phase1d-syncos.ts` | Specification | 21 | 0 | 0 | Shared sync queue & background sync |
| `tests/phase1e-feature-control.ts` | Specification | 50 | 0 | 0 | Feature control evaluation & suppression |
| `tests/phase2a-snapshot-os.ts` | Specification | 29 | 0 | 0 | Snapshot engine & manifest integrity |
| `tests/phase2a3-route-resolution.ts` | Specification | 15 | 0 | 0 | Route & canonical entity destination rules |
| `tests/phase2b-disaster-recovery.ts` | Specification | 45 | 0 | 0 | Disaster recovery, backups & restore drill |
| `tests/phase2c-seo-discovery.ts` | Specification | 50 | 0 | 0 | Canonical SEO, JSON-LD & meta tags |
| `tests/phase2c1-certification-smoke.ts` | Smoke | 22 steps | 0 | 0 | Production SEO smoke pipeline |
| `tests/phase2d-media-integrity.ts` | Specification | 50 | 0 | 0 | Media storage, CDN & integrity checks |
| `tests/phase2e-admin-command-center.ts` | Specification | 60 | 0 | 0 | Command center observability & diagnostics |
| `tests/phase3a-notifications-os.ts` | Specification | 50 | 0 | 0 | Notifications OS 50-point behavioral matrix |
| `tests/phase3b-composition-os.ts` | Specification | 74 | 0 | 0 | Homepage Composition OS 74-point matrix |
| `tests/phase3b-production-smoke.ts` | Smoke | 13 steps | 0 | 0 | Homepage Composition live editorial smoke |
| `tests/phase3c-reader-audience-os.ts` | Specification | 70 | 0 | 0 | Reader Activity & Audience OS 70-point matrix |
| `tests/phase3c-production-smoke.ts` | Smoke | 7 steps | 0 | 0 | Live reader telemetry & aggregation smoke |

- **Exact Automated Specification Assertions**: **572 PASSED / 0 FAILED** across 13 specification suites
- **Exact Smoke Steps**: **42 STEPS PASSED / 0 FAILED** across 3 smoke suites
- **Overall Suite Exit Codes**: All 16 suites exit with code 0

### B. Phase 3A Count Reconciliation
- The Phase 3A test suite `tests/phase3a-notifications-os.ts` defines and executes exactly **50 test cases and 50 assertions** (`PHASE 3A 50-POINT CERTIFICATION SUMMARY: 50 PASSED, 0 FAILED (TOTAL 50)`).
- The previously reported number `72` was a typographical error in report aggregation (conflating the 74-point suite count) and has been reconciled to the verified value of **50**.

### C. Article Completion & Dwell Policy
- **Completion Rule**: Deterministically triggered if and only if reading progress reaches $\ge 75\%$ AND active dwell is $\ge 15\text{ seconds}$.
- Page load alone cannot complete an article (progress = 0, dwell = 0).
- Background / hidden tabs immediately pause dwell timer accumulation via `document.visibilityState`.
- Emitted at most once per session context.
- **Dwell Time Buckets**: Strictly non-overlapping contiguous intervals:
  - `<15s`: $0 \le t < 15\text{s}$
  - `15_60s`: $15 \le t \le 60\text{s}$
  - `1_3m`: $61 \le t \le 180\text{s}$
  - `3_10m`: $181 \le t \le 600\text{s}$
  - `10m_plus`: $t > 600\text{s}$

### D. Notifications Network Failure Root Cause & Resolution
- **Root Cause**: In `src/services/notificationsOS.ts`, `getPublicAnnouncements()` was executing `this.notify()` on read completion. This invoked `NotificationBell`'s subscriber listener, causing a self-triggering fetch feedback loop on mount.
- **Resolution**: Removed `this.notify()` from read getters (`getPublicAnnouncements`), implemented concurrent in-flight request coalescing (`inFlightAnnouncementsPromise`), and added bounded error backoff ($15\text{s}$) to cleanly serve local offline caches during transient network interruptions.
- Verified service worker routes: `/service-worker.js` (200), `/firebase-messaging-sw.js` (200), `/api/notifications/health` (200, healthy).

### E. Buffer Bounds, Quota & Privacy
- **Local Buffer**: Bounded at max 100 events. Oldest non-essential analytics events are dropped first if buffer capacity is reached; essential actions (Save, Follow) remain authoritative.
- **Batch Limits**: Max 50 events and 256 KB per ingest request.
- **`OPEN_QUOTA` Circuit Breaker**: Optional audience telemetry immediately stops ingestion with clean non-blocking errors without spinning retry loops.
- **Idempotency**: Server deduplicates events via 5,000-entry LRU cache, preventing double-counting on batch replays.
- **Account Switch Privacy**: Local history and continuation caches are user-partitioned (`sanatan_history_${userId}`, `sanatan_continue_reading_${userId}`). Switching accounts completely isolates User A history from User B.
- **Aggregate Privacy**: Public snapshots and aggregates contain zero `userId`, `sessionId`, `anonymousId`, or raw IP fields.

### F. View Count Compatibility
- **Canonical Baseline**: Existing article snapshot views / live video views remain canonical and untouched.
- **Derived Aggregates**: Audience OS accumulates reading telemetry via `/api/audience/content/:entityId` without direct synchronous DB increments.
- Zero double-counting or count resets.

### G. Roadmap
- **Correct Next Phase**: **Phase 3D — Translation & Language Input OS**.

