# SanatanMarga 5.0 Beta — Phase 2C Architecture: SEO & Discovery OS 5.0 Core Technical Foundation

## Executive Summary
Phase 2C establishes **SEO & Discovery OS 5.0** as a canonical-derived, server-visible, feature-governed discovery and indexing engine for SanatanMarga. SEO is never a parallel source of truth; it derives strictly from validated canonical data, Snapshot OS artifacts, and the Feature Control registry.

## Core Pillars

### 1. Canonical URL & Redirect Engine
- **Single Resolver**: `resolveCanonicalUrl` produces deterministic canonical URLs based on entity type, canonical ID, language context, and query parameter stripping.
- **Redirect Registry**: Detects redirect cycles (`A -> B -> A`), collapses multi-hop redirect chains (`A -> B -> C` becomes `A -> C`), and validates target URLs.

### 2. Server-Visible SEO Injection
- Search engines and crawlers inspecting public URLs (`/article/:id`, `/category/:id`, `/blog/:id`, `/events/:id`, `/knowledge/:id`, `/authors/:id`, `/topic/:id`, `/district/:id`) receive fully hydrated HTML tags (`<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta name="robots">`, OpenGraph tags, hreflang links, and JSON-LD structured data) directly in the initial HTTP response without requiring client-side JavaScript execution.
- HTML and JSON-LD values are strictly sanitized against XSS and closing tag injection (`</script>` -> `<\/script>`).

### 3. Structured Data OS (JSON-LD)
- Canonical entity mappings for:
  - `NewsArticle` / `Article` (retaining original `datePublished` and verified author profile references)
  - `BlogPosting` (with real author identities)
  - `Event` (actual dates, locations, status; omitting fabricated ticket prices)
  - `VideoObject` (real durations from MediaOS; omitting invented metadata)
  - `DiscussionForumPosting` (context-aware Chautari discussions)
  - `Course` (public Academy entities with strict learner privacy)
  - `BreadcrumbList` (reflecting actual URL routing hierarchy)
  - `Organization` (central publisher entity)

### 4. Indexability & Feature Control Integration
- `isIndexable(entity, context)` evaluates canonical publication state, Feature Control availability, and language provenance.
- Drafts, internal preview routes, unreviewed machine translations, and disabled Feature Control modules fail closed to `noindex, nofollow` and are omitted from sitemaps.
- Crawl explosion prevention for search, filter permutations, and deep pagination (`noindex, follow`).

### 5. Dynamic Sitemap OS & News Sitemap
- Modular Sitemap Index (`/sitemap.xml`) routing to:
  - `/sitemap-news.xml` (recent published news <= 48 hours via `NEWS_SITEMAP_FRESHNESS_HOURS = 48`)
  - `/sitemap-articles.xml` (all canonical published articles)
  - `/sitemap-pages.xml`, `/sitemap-events.xml`, `/sitemap-authors.xml`, etc.
- Excludes drafts, private entities, noindex routes, and disabled features.

### 6. Topic Authority & Knowledge Quality Policy
- Knowledge entities and topic hubs are eligible based on meaningful quality signals (verified status, canonical title, non-thin description/content, valid review state, and Feature Control eligibility). Arbitrary relationship counts are not sole gates.
- Internal linking suggestions distinguish `AUTO_SAFE`, `EDITOR_REVIEW`, and `NO_AUTO_LINK` to avoid keyword stuffing.
- Orphan page detection flags published content lacking inbound internal links.

### 7. Multilingual SEO & hreflang
- Strict symmetric and reciprocal hreflang generation only for real, published language versions (`ne`, `en`, `hi`).
- Machine/AI translations marked unreviewed are automatically restricted from indexing until editorial review.

### 8. Snapshot OS & Disaster Recovery Integration
- SEO snapshot artifacts derive strictly from canonical Firestore and Snapshot OS builds.
- RECOVERY fixtures are blocked from publishing canonical SEO snapshot artifacts.
- Following a DR restore, SEO artifacts regenerate deterministically from restored canonical records.

### 9. Admin SEO Health Observability
- Admin dashboard exposes real, computed technical health metrics (indexable entities, noindex count, canonical conflicts, orphan pages, active sitemap URLs) with zero fabricated or static mock scores.

---

## Phase 2C.1 Certification Summary

### Individual Test Suite Reconciliation:
- **Phase 1A (Security & Safety)**: 26 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase1a-security-safety.ts`)
- **Phase 1B (Gateway & Quota)**: 32 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase1b-gateway-quota.ts`)
- **Phase 1D (SyncOS)**: 21 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase1d-syncos.ts`)
- **Phase 1E (Feature Control OS)**: 50 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase1e-feature-control.ts`)
- **Phase 2A (Snapshot OS 5.0 Core)**: 29 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase2a-snapshot-os.ts`)
- **Phase 2A.3 (Route Resolution & Delivery)**: 15 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase2a3-route-resolution.ts`)
- **Phase 2B (Disaster Recovery & Backup OS)**: 30 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase2b-disaster-recovery.ts`)
- **Phase 2C (SEO & Discovery OS Core)**: 50 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase2c-seo-discovery.ts`)
- **Phase 2C.1 (Certification Smoke)**: 22 passed, 0 failed, Exit Code 0 (`npx tsx tests/phase2c1-certification-smoke.ts`)
- **Exact Mathematical Total**: **275 passed, 0 failed** (100% Pass Rate).

### Production Build & Lint Verification:
- `npm run lint`: Exit Code 0 (0 TypeScript errors across the entire repository).
- `npm run build`: Exit Code 0.
  - Client Build: Vite production bundle completed successfully (`dist/index.html` + 70+ asset chunks).
  - Server Build: esbuild CJS bundle completed successfully (`dist/server.cjs` 1.1MB).
