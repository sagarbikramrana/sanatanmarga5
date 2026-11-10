# SanatanMarga 5.0 Beta — Feature Control OS 5.0 Registry & Runtime Enforcement

## 1. Feature Control OS Architecture Overview
Feature Control OS 5.0 is the runtime control and lifecycle system for SanatanMarga. It moves beyond navigation visibility to govern all platform execution layers:
- **Navigation Visibility**: Determines if links/drawers expose the feature.
- **Route Access**: `<RouteFeatureGuard>` strictly intercepts direct URL navigations and prevents mounting.
- **Component Mount**: `<FeatureGate>` blocks rendering and execution of lifecycle hooks (`useEffect`, listeners).
- **Data Fetching**: Central Gateway blocks Firestore/network reads for disabled features, delivering cache or safe defaults.
- **Realtime Listeners**: `ListenerRegistry` tracks feature ownership (`featureId`), blocking listener creation and providing `killByFeature(featureId)` teardown when a feature is turned off.
- **Background Jobs**: Server-side jobs (such as TTS pre-generation and worker queues) evaluate feature state before executing.
- **Snapshot OS Compilation**: Modules (`community.chautari`, `nepalhub.main`, `community.events`, etc.) omit snapshot compilation when `snapshotAllowed` is false.
- **Push Notification Broadcasts**: Server endpoints (`/api/broadcast`, `/api/notifications/send-role-based`) reject requests when `notifications.push` is disabled.
- **SEO & Sitemaps**: `sitemapEndpoints.ts` omits URLs from dynamic XML sitemaps when `seoAllowed` is false.
- **Emergency Continuity Mode**: Automatically trips via Firestore Quota Circuit Breaker or manual activation, instantly shutting down high-cost operations (AI, TTS, Live video, community writes) while keeping core reading and snapshots alive.

---

## 2. Multi-Dimensional Feature Model

Feature Control 5.0 distinguishes between multiple semantic dimensions:

### A. Lifecycle State (`FeatureLifecycleState`)
- `BUILT`: Implementation is present in codebase but not ready for production release.
- `INTERNAL`: Restricted to core development and internal testing.
- `STAFF_PREVIEW`: Available for editorial and staff inspection.
- `BETA`: Open to enrolled beta audience and testers.
- `RELEASED`: Fully public, active across the platform.
- `MAINTENANCE`: Temporarily degraded or offline for scheduled updates.
- `RETIRED`: Deprecated and permanently decommissioned; fail-closed execution.

### B. Exposure (`FeatureExposure`)
- `HIDDEN`: No public discovery, direct links or sitemap indexing.
- `UTILITY`: Available via secondary toolbars, footers, or context menus.
- `SECONDARY`: Standard catalog/sub-navigation entry.
- `PRIMARY`: Main top-level navigation, primary drawers, and spotlight cards.
- `FEATURED`: Hero banners, homepage focus widgets, and promoted actions.

### C. Operational Controls (`FeatureControls`)
Each feature definition configures granular operational switches:
- `navigation?: boolean` (controls navigation bar display)
- `route?: boolean` (controls route access)
- `component?: boolean` (controls UI mounting)
- `api?: boolean` (controls API access)
- `backgroundJob?: boolean` (controls worker/timer execution)
- `snapshot?: boolean` (controls R2/Snapshot OS publishing)
- `seo?: boolean` (controls public indexing and sitemap generation)
- `listener?: boolean` (controls realtime Firestore subscriptions)

---

## 3. Canonical Rollout Profiles

SanatanMarga 5.0 Beta defines canonical operational profiles in `ROLLOUT_PROFILES`:
1. `LAUNCH_MINIMAL`: Core news, search, and static reading only; interactive and multimedia modules disabled.
2. `LAUNCH_STANDARD`: Standard production launch; ListenOS, Store, Nepal Hub, and notifications active.
3. `BETA_STANDARD`: Production baseline with Chautari, Academy, and interactive beta modules open to beta users.
4. `BETA_EXPANDED`: Full platform open with emerging experimental AI and live media features.
5. `FULL_PLATFORM`: All 55+ capabilities running at maximum production capacity.
6. `EMERGENCY_MODE`: Instant kill-switch for Gemini AI, ListenOS audio generation, live video, and community writes during Firestore quota exhaustion or external provider outage.

---

## 4. Canonical Feature Key Mapping & Enforcement Table

| Feature ID | Category | Lifecycle | Default State | Route Guarded | Data Fetch Guarded | Snapshot Guarded | SEO Filtered |
|---|---|---|---|---|---|---|---|
| `core.news` | `core` | `RELEASED` | `public` | Core Route | Yes (Gateway) | Yes (SnapshotOS) | Yes (Sitemap) |
| `core.search` | `core` | `RELEASED` | `public` | Core Route | Yes (Gateway) | Yes (Index) | Yes |
| `core.auth` | `core` | `RELEASED` | `public` | Core Route | Yes (Gateway) | N/A | N/A |
| `homepage.hero` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes (Hero) | N/A |
| `homepage.breaking` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.ecosystem` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.bento` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.trendingStories` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.nepalMap` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.sgisShowcase` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.marketData` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `homepage.announcements` | `homepage` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.listen` | `article` | `RELEASED` | `public` | FeatureGate | Yes (TTS Cache) | N/A | N/A |
| `article.comments` | `article` | `BETA` | `public` | FeatureGate | Yes (Gateway) | Yes (Comments) | N/A |
| `article.provenance` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.districtImpact` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.storyNetwork` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.crossLinks` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.storeConnector` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.timeline` | `article` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `article.share` | `article` | `RELEASED` | `public` | FeatureGate | N/A | N/A | N/A |
| `sidebar.global` | `sidebar` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `sidebar.mostRead` | `sidebar` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `sidebar.newsletter` | `sidebar` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `sidebar.social` | `sidebar` | `RELEASED` | `public` | FeatureGate | N/A | N/A | N/A |
| `sidebar.ads` | `sidebar` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `sidebar.knowledgeGraph` | `sidebar` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `media.listenos` | `media` | `RELEASED` | `public` | `/listen` | Yes (Audio Pool) | Yes (Media) | Yes |
| `media.radio` | `media` | `RELEASED` | `public` | `/radio` | Yes (Audio Pool) | Yes | Yes |
| `media.live` | `media` | `BETA` | `admin_only` | `/live`, `/live/:id` | Yes (Stream Hub) | Yes | Yes |
| `media.video` | `media` | `RELEASED` | `public` | FeatureGate | Yes | Yes | N/A |
| `ai.tts` | `ai` | `RELEASED` | `public` | Server API | Yes (Worker Guard) | N/A | N/A |
| `ai.newsroom` | `ai` | `INTERNAL` | `admin_only` | Admin Guard | Server API | N/A | NoIndex |
| `ai.translation` | `ai` | `INTERNAL` | `admin_only` | Admin Guard | Server API | N/A | NoIndex |
| `ai.ocr` | `ai` | `INTERNAL` | `admin_only` | Admin Guard | Server API | N/A | NoIndex |
| `knowledge.base` | `knowledge` | `RELEASED` | `public` | `/knowledge/*`, `/discover` | Yes (Gateway) | Yes (Graph) | Yes |
| `knowledge.sgis` | `knowledge` | `RELEASED` | `public` | `/sgis/*` | Yes (Gateway) | Yes | Yes |
| `knowledge.timeline` | `knowledge` | `RELEASED` | `public` | `/timeline`, `/timeline/:id` | Yes (Gateway) | Yes | Yes |
| `knowledge.archives` | `knowledge` | `RELEASED` | `public` | `/archives`, `/archives/:id` | Yes (Gateway) | Yes | Yes |
| `knowledge.festivals` | `knowledge` | `RELEASED` | `public` | `/festivals` | Yes (Gateway) | Yes (Festivals)| Yes |
| `community.chautari` | `community` | `BETA` | `public` | `/community`, `/community/post/:id` | Yes (Gateway) | Yes (Chautari) | Yes |
| `community.writing` | `community` | `BETA` | `public` | Modal Gate | Yes (Write Gate) | N/A | N/A |
| `community.events` | `community` | `RELEASED` | `public` | `/events`, `/events/:id` | Yes (Gateway) | Yes (Events) | Yes |
| `commerce.store` | `commerce` | `RELEASED` | `public` | `/store` | Yes (Gateway) | Yes (Store) | Yes |
| `revenue.ads` | `revenue` | `RELEASED` | `public` | Admin Guard | Yes (Gateway) | Yes (Ads) | N/A |
| `revenue.membership` | `revenue` | `RELEASED` | `public` | `/membership`, `/patrons` | Yes (Gateway) | Yes (Member) | Yes |
| `training.academy` | `training` | `BETA` | `public` | `/academy/*`, `/training/*` | Yes (Gateway) | Yes (Academy) | Yes |
| `training.certification` | `training` | `RELEASED` | `public` | `/verify-certificate/*`, `/verify/*` | Yes (Gateway) | Yes | Yes |
| `notifications.push` | `notifications` | `RELEASED` | `public` | `/api/broadcast*` | Push API Guard | N/A | N/A |
| `notifications.center` | `notifications` | `RELEASED` | `public` | Component Gate | Yes (Gateway) | N/A | N/A |
| `nepalhub.main` | `nepal_hub` | `RELEASED` | `public` | `/nepal-hub` | Yes (Gateway) | Yes (NepalHub) | Yes |
| `nepalhub.situationRoom`| `nepal_hub` | `RELEASED` | `public` | `/nepal-hub/live/*` | Yes (Gateway) | Yes | Yes |
| `blog.main` | `blog` | `RELEASED` | `public` | `/blog/*` | Yes (Gateway) | Yes (Blog) | Yes |
| `infra.snapshotOs` | `infrastructure` | `RELEASED` | `public` | Server Subsystem | Yes | Yes (Core) | N/A |
| `infra.featureControl` | `infrastructure` | `RELEASED` | `public` | `/admin/feature-control` | Admin Protected | Yes | NoIndex |
| `infra.auditTrail` | `infrastructure` | `RELEASED` | `public` | Admin Protected | Yes | N/A | NoIndex |
