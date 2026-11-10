# Sanatan Marga - Master Architecture & Operational Specification

This master document serves as the absolute blueprint, technical specification, and operational registry for the **Sanatan Marga Digital Media Platform and Operating System**.

---

## 1. Vision

**Sanatan Marga** represents an enterprise-grade, digital-first news and cultural hub. Far beyond a generic blogging platform, it is a fully integrated media ecosystem featuring real-time collaborative workflows, a secure reader forum, talent agency management, event coverage scheduling, and interactive advertisement operations. 

The core philosophy revolves around merging high-fidelity Swiss-style typography with rapid React client execution, protected by a zero-trust server architecture and augmented with search-grounded AI co-pilot capabilities.

---

## 2. Tech Stack

The architecture is built for high speed, low-latency, and hardened cloud security:

*   **Client-Side SPA**:
    *   **Core**: React 18 + Vite + TypeScript.
    *   **Styling & Theme**: Tailwind CSS, utilizing fluid editorial typography pairing ("Space Grotesk" for display headings, "Inter" for interface controls, and "JetBrains Mono" for structured datasets).
    *   **Motion & Animations**: `motion/react` with customized natural cubic-bezier equations simulating real weights and inertia.
    *   **Data Visualization**: Recharts & D3 for real-time editorial dashboards and journalist productivity indexes.
*   **Server-Side Routing & Security**:
    *   **Environment**: Node.js executing with modern TypeScript compiler capabilities.
    *   **Framework**: Express.js serving on standard, hardcoded port `3000`.
    *   **Hardening**: 
        *   `trust proxy`: Explicitly configured (`app.set("trust proxy", 1)`) to trust upstream reverse proxies (Nginx / Cloud Run ingress), enabling accurate rate-limiting based on actual client IPs.
        *   `helmet`: Custom security headers, disabling intrusive CSP policies to ensure smooth dev-server HMR/iframe preview work seamlessly.
        *   `express-rate-limit`: Gated at `/api/` boundaries to prevent server exhaustion (configured for max 200 operations per 15-minute window).
*   **Persistent Database & Auth**:
    *   **Firebase Suite**: Google Firestore for highly reactive, offline-capable client state synchronization.
    *   **Authentication**: Firebase Auth with custom role evaluation mapping.
*   **AI Co-Pilot Node**:
    *   **Library**: `@google/genai` SDK with server-side proxy wrappers.
    *   **Model**: `gemini-3.5-flash` powering on-demand localized editorial assistance, translations, and live-grounded Google Search fact checks.

---

## 3. Database Schema (`firebase-blueprint.json`)

The Firestore layout utilizes highly normalized paths optimized for concurrent multi-editor reads and secure single-owner writes:

| Firestore Collection Path | Associated Schema Entity | Description / Purpose |
| :--- | :--- | :--- |
| `/users/{uid}` | `User` | Extended user records storing custom platform roles. |
| `/users/{uid}/bookmarks/{id}` | `Bookmark` | Saved articles for personalized reader bookmark directories. |
| `/articles/{id}` | `Article` | News articles holding content, status, and analytics indexes. |
| `/articleVersions/{id}` | `ArticleVersion` | Immutable revision history log for historical post restoration. |
| `/categories/{id}` | `Category` | Categorical navigation tags containing localization mappings. |
| `/events/{id}` | `Event` | Public events, religious holidays, and coverage entries. |
| `/communityPosts/{id}` | `CommunityPost` | High-engagement threads in our user discussion forum. |
| `/ads/{id}` | `Ad` | Legacy static visual banner placements. |
| `/campaigns/{id}` | `AdCampaign` | V2 Ad Operations tracks with budget, impressions, and ROI clicks. |
| `/agents/{id}` | `Agent` | Modeling and photography booking agency representatives. |
| `/auditLogs/{id}` | `AuditLog` | Strict, write-once immutable ledger of high-priority system actions. |
| `/storyAssignments/{id}` | `StoryAssignment` | News tasks distributed to staff reporters from Chief Editors. |
| `/coverageCalendar/{id}` | `CoverageCalendarEvent` | Planner tracking upcoming events scheduled for active coverage. |
| `/analytics/{id}` | `MediaAnalytics` | Telemetry records tracking average reading depth and bounce rate. |

---

## 4. Roles

Access controls are managed across distinct structural tiers to prevent role overlap and unauthorized escalations:

```
  [ Guest / Reader ] <--- Standard subscriber accounts (Default tier)
          |
          v
    [ Staff Tier ]   <--- Journalists, Photographers, Moderators, Fact Checkers
          |
          v
   [ Editorial Tier ] <--- Editors, Chief Editors (Workflow & publishing controllers)
          |
          v
    [ Admin Tier ]   <--- Super Admins & Admins (Complete billing and role control)
```

1.  **Super Admin / Admin**: Complete master privileges. Controls system configs, billing parameters, category creations, and modifies global user permissions.
2.  **Chief Editor / Editor**: Editorial gatekeepers. Responsible for reviewing articles, assigning tasks, scheduling coverage events, and pushing drafts to final publication.
3.  **Journalist / Staff**: Content producers. Allowed to write draft articles, upload photos, and update completion status for tasks assigned to them.
4.  **Moderator**: Forum regulators. Authorized to review flag counters and delete hostile community posts or comment chains.
5.  **Subscriber / Guest**: Authenticated readers. Permitted to save private bookmarks, upvote forum posts, and submit modeling/talent inquiries.

---

## 5. Permissions (`firestore.rules`)

Security permissions are tightly written to guarantee maximum threat vector coverage:

*   **Role Change Isolation**: Profile updates check `incoming().role == existing().role || isAdmin()`. This completely blocks client-side privilege escalation attempts.
*   **Story Assignment Immutability**: Staff journalists are restricted to updating only the `status` and `notes` fields of an assignment. Attempts to modify the assigned editor, deadline, or original task description are rejected.
*   **Immutable Revision Indexes**: Collections `/articleVersions` and `/auditLogs` reject all `update` and `delete` directives unconditionally.
*   **ID Integrity Guard**: Custom `isValidId(id)` functions prevent indices flooding or malicious ID payload poisonings by limiting key length to `<= 128` characters.

---

## 6. Route Map

The application's route paths map securely to designated roles through our structural `<ProtectedRoute>` controller:

### Public Directories
*   `/` -> Modern homepage featuring bento grids, trending carousels, and live status tickers.
*   `/login` -> Secure firebase authentication portal.
*   `/category/:slug` -> Filtered localized article streams.
*   `/article/:id` -> Single news layout integrated with reactive sharing options.
*   `/community` -> Discussion board for authenticated users.
*   `/community/post/:id` -> Deep thread details with comments and voting mechanisms.
*   `/events` -> Master listing of upcoming cultural and religious milestones.
*   `/models` -> Portal showcasing verified agency talents and portfolios.
*   `/live` -> Live coverage dashboard tracking active events.

### Editorial & Staff Portal (Restricted to Editor/Admin Roles)
*   `/admin` -> Central command center dashboard.
*   `/admin/media-os` -> **Enterprise Media Operations (V2)** (Consolidates assignments, planning, ad operations, breaking takeovers, and the AI Co-pilot).
*   `/admin/articles` -> Unified article listing and status tracker.
*   `/admin/editor` -> Multi-functional rich text workspace for composing news.
*   `/admin/editor/:id` -> Editing interface for existing articles.
*   `/admin/community` -> Moderation dashboard for community posts and reports.
*   `/admin/events` -> Event list management panel.

### Administrator Controls (Restricted Exclusively to Admin Roles)
*   `/admin/users` -> Secure user role assigning database.
*   `/admin/settings` -> Global corporate layouts and SMTP parameters.
*   `/admin/categories` -> Navigation slug builder.
*   `/admin/ads` -> Ad Operations campaign and placement dashboard.
*   `/admin/menu` -> Dynamic sitemap navigation builder.
*   `/admin/page-builder` -> Layout configuration module.

---

## 7. APIs

To hide secrets from the browser client, all external integrations are proxied through server-side endpoints in `/server.ts`:

### 7.1 AI Newsroom Controller (`/api/gemini/newsroom`)
Integrates the modern `@google/genai` TypeScript SDK to securely serve the editorial room:
*   **Story Angles Engine**: Takes a baseline topic and generates 5 culturally rich story hooks, headlines, and coverage angles in Nepali.
*   **Search-Grounded Fact Check**: Connects directly to **Google Search Tool Grounding** to perform real-time verification of raw user claims, outputting verdicts alongside live sources.
*   **SEO Optimization Node**: Translates draft texts into fluent Nepali while generating meta-descriptions, SEO keywords, and optimized search headers.

### 7.2 Core Utility Routes
*   `/api/health` -> Standard container uptime heartbeat monitor.
*   `/api/sitemap` -> Automatically crawls live articles and compiles search-engine compliant XML sitemaps.
*   `/api/newsletter` -> Distributes personalized digests of published articles to active newsletter subscribers.

---

## 8. Admin Modules (Media OS V2)

The **Admin Media OS V2** serves as the central nervous system for Sanatan Marga, combining several workflow modules into one seamless, premium-grade dashboard:

```
+-------------------------------------------------------------------------------+
|                                ADMIN MEDIA OS                                 |
+-------------------------------------------------------------------------------+
|  [Workflow]  [Assignments]  [Calendar]  [AdOps]  [Takeover]  [AI Co-pilot]    |
+-------------------------------------------------------------------------------+
|                                                                               |
|   * Kanban Publishing Board (Draft -> Review -> Fact Check -> Published)      |
|   * Story Assignment Tracker (Deadline reminders & staff dispatch)            |
|   * Coverage Planner (Culturally localized calendar nodes)                   |
|   * Ad Campaign Manager (V2 sponsorship budget and ROI counters)             |
|   * Homepage Takeover Toggles (Emergency alert banner control)                |
|   * Search-Grounded AI Co-Pilot (Claim verification & translation)            |
|                                                                               |
+-------------------------------------------------------------------------------+
```

*   **Kanban Editorial Board**: Interactive columnar layout where editors can drag and transition articles from मस्यौदा (Draft) -> समीक्षा (Review) -> तथ्य जाँच (Fact Check) -> प्रकाशित (Published).
*   **Task Assigner**: Editors dispatch story assignments to specific journalists, detailing descriptions, deadlines, and tracking real-time progress.
*   **Coverage Calendar**: Scheduled physical tracking of upcoming festivals, press conferences, and political assemblies.
*   **Takeover Command**: Instant site-wide emergency layout override mechanism. Generates custom alerts and forces a red high-contrast banner on the home screen.
*   **Ad Operations Desk**: Configures corporate advertisements, tracks financial campaign budgets, and measures reader impressions and clicks.

---

## 9. Deployment

Sanatan Marga is packaged to build and deploy dynamically inside containerized Cloud Run nodes:

*   **Server Compilation**:
    ```bash
    vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
    ```
    This bundles the entire backend server into a single self-contained, high-performance file, bypassing ESM path issues.
*   **Port Ingress**: The container binds exclusively to port `3000` on the network interface `0.0.0.0` as dictated by container proxy constraints.

---

## 10. Operational Maturity Sprints (Roadmap)

To elevate the platform's operational readiness and stability, development is structured around the following targeted sprints:

*   **Sprint A — Observability OS**: Integrate database-backed event streams (`/activityLogs`, `/systemHealth`, `/errorEvents`) to log active editors, failed API actions, and system uptime telemetry. Connect to lightweight monitoring hooks for React runtime exception tracking.
*   **Sprint B — Notification OS**: Design schemas and data structures for transactional, in-app, and external reminders (`/notifications`, `/notificationTemplates`, `/notificationCampaigns`) covering assignment deadlines, approval states, and breaking news alerts.
*   **Sprint C — Search Indexing**: Implement background index synchronization strategies to offload full-text search from Firestore. Future architecture targets an external serverless engine (e.g., Typesense) for high-performance typographic search.
*   **Sprint D — Media Asset OS**: Integrate a structured digital asset manager (`/mediaAssets`) tracking copyrights, captions, photographer references, and categorized media tags to streamline image recycling across staff.
*   **Sprint E — Membership Engine**: Build core monetization hooks (`/memberships`, `/subscriptions`, `/payments`) with pre-configured schema support for regional payment processors (e.g., eSewa, Khalti) and reader tier access controls.
*   **Sprint F — Disaster Recovery**: Establish automated Firestore backup and export triggers to cloud storage Buckets, mapping recovery timelines to strict recovery objectives (RPO = 24 Hours, RTO = 1 Hour).
*   **Sprint G — Community Moderation OS**: Introduce abuse-reporting states (`/reports`, `/moderationActions`, `/bannedUsers`) enabling moderators to flag, review, shadowban, or temporarily suspend hostile reader accounts.
*   **Sprint H — Corporate Revenue OS**: Extend static Ad campaigns into complete ledger-backed sponsorship tracks including `/advertisers`, `/contracts`, `/invoices`, and `/payments`.

---

## 11. Known Issues

*   **Vite Dev Server WebSockets**: Standard browser warning console logs such as `failed to connect to websocket` are expected due to iframe proxy sandbox environments and are safe to ignore.
*   **API Secret Warnings**: If the environment variable `GEMINI_API_KEY` is not populated in the control plane secrets panel, the AI co-pilot will fail gracefully and prompt the operator to configure the credentials without throwing hard runtime container crashes.

---

## 12. Completed Features

*   [x] **Immutable Security Rules**: Verified zero-trust configurations deployed directly to production databases.
*   [x] **Digital-First Theme**: Editorial typography hierarchies with seamless animations and transitions.
*   [x] **Admin Media OS V2**: Fully reactive workspace linking Kanban processes, task assignments, and ad tracking.
*   [x] **Search-Grounded AI**: Production-ready server-side Gemini 3.5 Flash implementation backed by live search retrieval.
*   [x] **Server Hardening**: Helmet integration and API rate-limiting rules.
*   [x] **Saraswati Knowledge OS**: Knowledge Graph & Entity Explorer (`/knowledge`) for authentic Nepalese heritage, scriptures, and institutions.
*   [x] **Sponsorship & Revenue OS**: Corporate sponsorship proposal builder and ledger analytics (`/admin/revenue`).
*   [x] **Executive Command Center**: Live operational telemetry across editorial, community, financial, and infrastructure pillars (`/admin/executive`).
*   [x] **Command Palette UX**: `⌘K` keyboard-driven command palette for instant navigation and action execution across the OS.
*   [x] **Multi-Tenant Federation OS V3.0**: SaaS multi-institution federation architecture supporting Media, Schools, Municipalities, Hospitals, NGOs, and Corporates (`/admin/tenants`).
*   [x] **Tenant Self-Service Onboarding**: 4-step wizard (`/onboarding`) with subdomain verification, module marketplace selection, and plan deployment.
*   [x] **Institutional Workflow OS**: Rule engine (`/admin/workflows`) for automated editorial reviews, sponsorship follow-ups, and civic escalations.
*   [x] **Developer API Platform**: REST/GraphQL API key provisioning (`/admin/developer-api`) with scope granularities and request metering.
*   [x] **Tenant Health Scorecard**: 0-100 retention and engagement score monitoring across the federation.
*   [x] **Nepal Intelligence Hub OS**: Daily-use utility dashboard (`/nepal-hub`) containing Living Nepali Calendar, Panchang, AD/BS Converter, Market Pulse (Forex, Gold, NEPSE, Fuel), Festival Command Center, District Intelligence, AI Morning Briefing, and Vedic Audio Chanting Hub.

---

## 13. SanatanOS Federation Platform v3.0 Architecture

With Release 3.0, Sanatan Media Sutra OS has transitioned into **SanatanOS Federation Platform** — a multi-tenant SaaS Operating System for Nepal's institutions.

```text
SanatanOS Federation Hub (Multi-Tenant SaaS)
│
├── MediaOS          (Sanatan Media Core)
├── EducationOS      (Nepal Sanskrit Gurukul)
├── MunicipalityOS   (Pokhara Metropolitan City)
├── HealthcareOS     (Janakpur Ayurveda Institute)
└── NGO / Corporate Workspaces
```

### 13.1 Control Plane Schema
*   `Tenant`: `id`, `name`, `code`, `type`, `subdomain`, `customDomain`, `ownerUid`, `modules`, `settings`, `billing`, `stats`.
*   `TenantWorkflow`: `id`, `tenantId`, `title`, `trigger`, `steps`, `isActive`, `runCount`.
*   `TenantApiKey`: `id`, `tenantId`, `keyName`, `publicKey`, `scopes`, `status`, `requestsCountToday`.
*   `TenantHealthScore`: `overallScore` (0-100), `usageScore`, `retentionScore`, `contentActivityScore`, `revenueScore`, `statusCategory`.

*   `TenantUser`: `userId`, `tenantId`, `tenantRole` (`tenant_admin` | `tenant_editor` | `tenant_member` | `tenant_viewer`).
*   `TenantContext`: Global React context (`useTenant()`) providing real-time active tenant context switching, onboarding workflows, and local storage state persistence.

