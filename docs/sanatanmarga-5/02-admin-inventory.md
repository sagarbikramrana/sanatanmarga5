# SanatanMarga 5.0 Beta — Admin Panel Inventory

## 1. Classification by Proposed 5.0 Domains

### Domain 1: Command Center
- **AdminEditorialCommandCenter** (`/admin/command-center`): Active. Real-time newsroom pulse, story evolution tracking, breaking tickers.
- **AdminMissionControl** (`/admin`, `/admin/operations`, `/admin/mission-control`): Active. Central operational overview, health tabs, alert badges.
- **ExecutiveDashboard** (`/admin/executive`): Active. KPI dashboard (some financial metrics derived from mock defaults).

### Domain 2: Editorial
- **AdminEditor** (`/admin/editor`, `/admin/newsroom`): Active. Newsroom article creation, AI co-pilot hooks, categories.
- **EditorDashboard** (`/editor`): Active. Editor-specific queue.
- **AdminArticles** (`/admin/articles`): Active. Published, draft, and in-review article lists.
- **AdminCategories** (`/admin/categories`): Active. Standard category mapping (politics, desh, etc.).
- **AdminDiscovery** (`/admin/discovery`): Active. Topic trend discovery and wire feed monitoring.
- **AdminTranslationDashboard** (`/admin/translation`): Active. English <-> Nepali translation and IAST tools.
- **AdminWorkflowAutomation** (`/admin/workflows`): Active. Kanban board with 6-stage newsroom pipeline.
- **AdminBlog** (`/admin/blog`): Active. Long-form philosophy and Vedic thought CMS.

### Domain 3: Media
- **AdminMediaAssetsPage** (`/admin/media`, `/admin/media-os`, `/admin/media-assets`, `/admin/media-library`): Active. Cloudflare R2 upload center, asset inspection.
- **AdminRadioPage** (`/admin/radio`): Active. Broadcast clock, program scheduling, sound branding, 24/7 stream.
- **AdminSponsorAudioOS** (`/admin/sponsor-audio`): Active. Audio ad insertion and sound logos.
- **AdminLive** (`/admin/live`): Active. Live video broadcasting and multi-camera switcher.

### Domain 4: Knowledge & Civilization
- **AdminKnowledgePage** (`/admin/knowledge`, `/admin/knowledge-os`): Active. Entity graph management, Vedic references.
- **SgisDashboard / SGIS Studios** (`/sgis`, `/admin/sgis`): Active. Epigraphy, Licchavi/Brahmi paleography, OCR studio.
- **AdminArchivesPage** (`/admin/archives`): Active. Historical documents, treaties, copperplates, palm-leaf records.
- **AdminTimelinePage** (`/admin/timeline`): Active. Chronological civilizational milestones.
- **AdminNepalHubPage** (`/admin/nepal-hub`, `/admin/hub-os`): Active. 77 Districts local situation room and panchang.

### Domain 5: Community
- **AdminCommunity** (`/admin/community`): Active. Chautari forum thread curation and pin actions.
- **AdminModeration** (`/admin/moderation`): Active. Flagged posts and user reports queue.
- **AdminSocial** (`/admin/social`): Active. Social media channels aggregation and distribution config.
- **AdminInquiries** (`/admin/inquiries`): Active. Reader questions and inquiry handling.
- **AdminContactMessages** (`/admin/contact-messages`): Active. Direct contact submissions.

### Domain 6: Academy & Talent
- **AdminAcademy** (`/admin/academy`): Active. Course catalog, lesson structuring, competency benchmarks.
- **AdminTrainingManagerPage** (`/admin/training`): Active. Institutional training tracks, certification standards.
- **AdminModels** (`/admin/models`): Active. Talent profiles and cultural ambassadors directory.

### Domain 7: Events & Commerce
- **AdminEvents** (`/admin/events`): Active. Event listings and ticket tiers.
- **AdminEventEditor** (`/admin/events/new`, `/admin/events/:id`): Active. Event creation and schedule management.
- **AdminStorePage** (`/admin/store`, `/admin/commerce`): Partial / Mock UI. Books and merchandise product catalog (WhatsApp checkout).
- **AdminCommerceAnalytics** (`/admin/commerce-analytics`): Partial / Mock UI. Order conversions and product performance.

### Domain 8: Revenue
- **AdminRevenueOS** (`/admin/revenue-os`, `/admin/revenue`): Active. Rate cards, campaigns, advertiser ledger, billing invoices.
- **AdminAds** (`/admin/ads`): Active. Placement inventory configuration, banner scheduling.

### Domain 9: Audience
- **AnalyticsOSDashboard** (`/admin/analytics`): Active. Audience intelligence, article views, retention.
- **AdminReaderAnalyticsPage** (`/admin/reader-analytics`): Active. Reader engagement patterns and district breakdowns.

### Domain 10: AI & Automation
- **AdminAgents** (`/admin/agents`): Active. Autonomous agent registry definitions.
- **AdminAIObservability** (`/admin/ai-observability`): Active. Gemini model token usage, latency, error telemetry.

### Domain 11: Platform
- **AdminHomepage** (`/admin/homepage`): Active. Section ordering and pinned news configuration.
- **AdminDesignOS** (`/admin/design-os`): Active. Visual branding, typography, color tokens.
- **AdminPageBuilder** (`/admin/page-builder`): Active. Layout block configuration.
- **AdminMenu** (`/admin/menu`): Active. Navigation menu items manager.
- **AdminUsers** (`/admin/users`): Active. User accounts and role assignments.
- **AdminSettings** (`/admin/settings`): Active. General site configuration.
- **AdminFeatureControl** (`/admin/feature-control`): Active. Feature kill-switches and rollout profiles.
- **AdminTenantFederation** (`/admin/tenants`): Active. Multi-tenant institutions.
- **AdminTenantApiKeys** (`/admin/developer-api`): Placeholder / Mock UI. In-memory API key generator.
- **AdminDisasterRecovery** (`/admin/disaster-recovery`): Active. Snapshot vault, backup archives.
- **AdminSystemHealth** (`/admin/system-health`, `/admin/health`): Active. Acceptance criteria suite.
- **AdminSystemIntegrity** (`/admin/system-integrity`): Active. Cross-OS truth engine verification.
- **AdminGovernancePage** (`/admin/governance`, `/admin/data-governance`, `/admin/content-audit`): Active. Dual-key approvals and cryptographic audit log viewer.
- **AdminSetupGuide** (`/admin/setup-guide`): Active. Platform installation and environment variable checklists.
- **AdminNotifications** (`/admin/notifications`): Active. Broadcast push notifications sender.
- **AdminSeoOS** (`/admin/seo-os`): Active. Sitemap generator and meta robots inspector.
- **AdminNepalIntelligenceOS** (`/admin/intelligence-os`): Active. National situation room cockpit.

## 2. Status Classification Summary
- **ACTIVE**: 38 Admin Pages/Panels
- **PARTIAL / MOCK**: 3 (AdminStorePage, AdminCommerceAnalytics, AdminTenantApiKeys)
- **DUPLICATES / ALIASES**: 12 (AdminMediaOS, AdminMediaLibrary, AdminOperations, AdminDataGovernance, AdminContentAudit, AdminHealth, AdminPlatformHealth, AdminCommerce, AdminHubOS, AdminKnowledgeHub misroute)
- **UNUSED / ORPHANED**: 2 (`AdminMediaOS.tsx`, `AdminMediaLibrary.tsx` in `src/pages/`)
