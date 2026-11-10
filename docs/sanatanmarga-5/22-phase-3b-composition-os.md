# SanatanMarga 5.0 Beta — Phase 3B Architecture & Certification: Composition OS & Homepage Manager

## Executive Summary
Phase 3B establishes **Composition OS** and the **Homepage Manager**, transitioning SanatanMarga from arbitrary page-builder layouts into a structured, presentation-independent, rule-based layout and slot curation engine. It establishes a single canonical composition authority with strict lifecycle segregation (`draft`, `active`, `scheduled`, `archived`), enforces comprehensive input validation blocking arbitrary HTML/JS and unauthorized content, guarantees bounded incremental Snapshot rebuilds, and integrates seamlessly with Feature Control, ListenOS, RevenueOS, and Disaster Recovery.

---

## 1. Actual Homepage Authority & Lifecycle
The platform guarantees a single canonical authority for the public homepage:
- **Active / Published**: Singleton active composition (`id: "active"`) persisted at `data/homepage_composition_active.json`. Public readers consume this state via edge/cache/snapshot pipelines.
- **Draft**: Working composition (`id: "draft_v..."`) persisted at `data/homepage_composition_draft.json`. Modifying drafts has **zero** effect on the live public homepage.
- **Scheduled**: Compositions scheduled for future activation persisted at `data/homepage_composition_scheduled.json` and triggered server-side by timestamp.
- **Archived**: Past published versions retained immutably in `data/homepage_composition_history.json`.

---

## 2. Section Registry & Structural Constraints
Sections are strictly controlled by the `VALID_SECTION_TYPES` registry:
- Approved types: `hero`, `breaking_news`, `latest_feed`, `category_grid`, `video_showcase`, `trending_bento`, `live_broadcast`, `announcements`, `chautari_community`, `academy_courses`, `knowledge_spotlight`, `ads_slot`.
- Arbitrary section types (such as `UNKNOWN_SECTION`) or React component path strings (e.g. `../components/Widget.tsx`) are rejected by the validation engine.
- Section order is numeric and strictly sortable.
- Disabled sections are cleanly suppressed from public resolved output without deleting configuration history.

---

## 3. Slot Contract & Canonical Entity References
Pinned slots store canonical entity references (`entityType` and `entityId`), never duplicated content:
- Approved slot entity types: `article`, `blog_post`, `chautari_post`, `chautari_thread`, `event`, `academy_course`, `knowledge_entity`, `live_dispatch`, `announcement`, `ad_placement`.
- Pinned items resolve latest canonical title, summary, and media metadata at compile time.
- If a pinned entity is modified in the CMS, changes propagate automatically to the homepage upon compilation without re-pinning.
- If a pinned entity is deleted or unpublished, it is excluded from public output and generates an admin attention item (`BROKEN_HOMEPAGE_REFERENCE`).

---

## 4. Arbitrary Content Safety & Sanitization
The validation engine sanitizes and validates all payloads:
- Rejects `<script>alert(1)</script>`, raw HTML tags (`<iframe>`, `<img onerror...>`, `<svg onload...>`), and `javascript:` URLs.
- Rejects unrestricted database queries, `where` clauses, collection paths, or arbitrary query JSON in section rules.
- Limits `maxItems` strictly between 1 and 100.
- Payload remains strictly structured JSON data decoupled from visual presentation.

---

## 5. Automatic Source Rules & Deduplication
- Supported automatic strategies: `latest`, `most_read`, `category_matched`, `manual_only`.
- **Deduplication Priority**: Manual pinned placements win priority. Automatic sections exclude already-selected entity IDs across previous sections to avoid duplicate content in Hero, Featured, and Latest blocks.
- Explicit override: Section rule property `allowDuplicates: true` permits intentional repetition across sections where editorially required.

---

## 6. Card Projection Sanitization (Zero Article Body Bloat)
Homepage cards are projected using `projectHomepageCard`:
- Projected fields: `id`, `title`, `summary` (max 240 chars), `canonicalUrl`, `category`, `categoryId`, `publishedAt`, `media`, `isPinned`, `entityType`.
- **Zero Article Body Bloat**: Full article markdown, HTML bodies, and sensitive fields are stripped from homepage card payloads, keeping snapshot sizes lightweight.

---

## 7. Feature Control & Ecosystem Integration
- **Feature Flag Gating**: Sections linked to disabled feature flags (e.g. `homepage.sgisShowcase`) are suppressed from public resolved output while displaying `isFeatureSuppressed: true` in admin preview.
- **ListenOS / Radio**: Homepage radio references the global audio controller without instantiating competing controllers.
- **RevenueOS / Ads**: Ad slots store RevenueOS placement identities (`homepage_top`, `homepage_mid`, `homepage_bottom`) rather than hardcoded ad creative. Creative eligibility remains governed by RevenueOS.

---

## 8. Publishing Pipeline & Snapshot Safety
- **Authorization**: Publishing requires server verification of `homepage.publish` privilege or admin role (unauthorized requests return HTTP 403 Forbidden).
- **Pipeline Sequence**:
  1. Validate draft (blocking errors halt publish).
  2. Server authorization check.
  3. Promote draft to active with incremented version.
  4. Archive current active version to immutable history.
  5. Bounded incremental Snapshot rebuild (`rebuildHomepageSnapshot`) updating `homepage`, `homepage-ne`, and `homepage-en`.
  6. Update manifest last.
- **Failure Safety**: If snapshot compilation fails, publish is marked `DELIVERY_FAILED` and the previous live homepage remains deliverable.
- **Startup Safety**: Server boot with valid existing LKG snapshot store hydrates LKG and skips full platform rebuild.

---

## 9. Scheduling, Concurrency, Rollback & Disaster Recovery
- **Scheduling**: Server-side activation by timestamp. Overlapping schedules within the same time window trigger `SCHEDULE_CONFLICT`.
- **Concurrency**: Optimistic concurrency checking via `revisionHash` prevents stale overwrites (`EDIT_CONFLICT`).
- **Publish Idempotency**: Idempotency keys prevent duplicate published versions and duplicate rebuild jobs.
- **Rollback**: Canonical rollback restores a previous historical version through the standard publish pipeline and rebuilds the snapshot.
- **Disaster Recovery**: DR restore regenerates the homepage from canonical composition rather than directly overwriting snapshot JSON.

---

## 10. Read Observability
All Phase 3B operations carry explicit read-audit identifiers:
- `homepage_composition_active`
- `homepage_composition_draft`
- `homepage_content_picker`
- `homepage_rule_preview`
- `homepage_version_history`

---

## 11. 74-Point Certification Matrix

| Category | Assertions | Passed | Status |
|----------|------------|--------|--------|
| Canonical Authority & Lifecycle | 1–7 | 7 / 7 | ✅ PASS |
| Section Registry & Constraints | 8–14 | 7 / 7 | ✅ PASS |
| Slot Contract & Entity References | 15–24 | 10 / 10 | ✅ PASS |
| Content Safety & Sanitization | 25–29 | 5 / 5 | ✅ PASS |
| Canonical Placement & Eligibility | 30–36 | 7 / 7 | ✅ PASS |
| Automatic Source Rules | 37–42 | 6 / 6 | ✅ PASS |
| Rule Preview & Deduplication | 43–50 | 8 / 8 | ✅ PASS |
| Feature Control Gating | 51–53 | 3 / 3 | ✅ PASS |
| Ecosystem Domains (Live, Radio, Ads) | 54–57 | 4 / 4 | ✅ PASS |
| Preview, Validation & Publishing | 58–67 | 10 / 10 | ✅ PASS |
| Scheduling, Concurrency & Rollback | 68–74 | 7 / 7 | ✅ PASS |
| **Total** | **1–74** | **74 / 74** | **✅ 100% PASS** |

---

## 12. Phase 3B.2 Final Certification

### A. Exact Individual Regression Accounting
| Suite File | Passed | Failed | Exit Code | Notes |
|------------|--------|--------|-----------|-------|
| `tests/phase1a-security-safety.ts` | 26 | 0 | 0 | Specification suite |
| `tests/phase1b-gateway-quota.ts` | 32 | 0 | 0 | Specification suite |
| `tests/phase1d-syncos.ts` | 21 | 0 | 0 | Specification suite |
| `tests/phase1e-feature-control.ts` | 50 | 0 | 0 | Specification suite |
| `tests/phase2a-snapshot-os.ts` | 29 | 0 | 0 | Specification suite |
| `tests/phase2a3-route-resolution.ts` | 15 | 0 | 0 | Specification suite |
| `tests/phase2b-disaster-recovery.ts` | 45 | 0 | 0 | Specification suite |
| `tests/phase2c-seo-discovery.ts` | 50 | 0 | 0 | Specification suite |
| `tests/phase2c1-certification-smoke.ts` | 22 | 0 | 0 | Specification suite |
| `tests/phase2d-media-integrity.ts` | 50 | 0 | 0 | Specification suite |
| `tests/phase2e-admin-command-center.ts` | 60 | 0 | 0 | Specification suite |
| `tests/phase3a-notifications-os.ts` | 50 | 0 | 0 | Specification suite |
| `tests/phase3b-composition-os.ts` | 74 | 0 | 0 | Specification suite |
| **Exact Total Automated Assertions** | **524** | **0** | **0** | **13 Suites** |
| `tests/phase3b-production-smoke.ts` | 16 | 0 | 0 | 13 workflow steps + 3 edge cases |

### B. Canonical Production Build Evidence
- **Command**: `npm run build`
- **Script**: `NODE_OPTIONS="--max-old-space-size=2048" vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs`
- **Vite Client Production Build**:
  - Result: PASS
  - Duration: 36.48s
  - Output directory: `dist/` (`dist/assets/`, `dist/index.html`, etc.)
- **Server Production Build**:
  - Result: PASS
  - Bundle path: `dist/server.cjs`
  - Bundle size: 1.3 MB
  - Duration: 200ms
- **Overall Build Exit Code**: 0

### C. Typecheck & Lint Evidence
- **Command**: `npm run lint` (`NODE_OPTIONS="--max-old-space-size=2048" tsc --noEmit --skipLibCheck`)
- **Result**: Clean (0 errors)
- **Exit Code**: 0

### D. R2 Terminology & Truthfulness Classification
- **Environment Storage Adapter**: `LOCAL_FALLBACK` storage adapter (`server/mediaStorage.ts` routing to local disk `/uploads/` and `/data/snapshots/`).
- **Automated Tests**: Isolated `TEST_DOUBLE` fixtures.
- **Live Cloudflare R2 Status**: `UNVERIFIED` (honest classification; no local fallback is mislabeled as live R2).

### E. Multi-Instance Publish Lock Status
- **Status**: `PROCESS_LOCAL_ONLY`
- **Implementation**: Process-local in-memory mutex (`private publishLock = false;` in `server/compositionOs.ts`).
- **Carry-Forward**: Distributed coordination across multi-instance server clusters remains to be addressed in subsequent multi-instance platform phases.

### F. Roadmap Next Phase Correction
- **Correct Next Phase**: **Phase 3C — Reader Activity & Audience OS**
- *Note*: Article Experience belongs later under Product Domain Finalization.

