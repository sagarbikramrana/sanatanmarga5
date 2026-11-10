# SanatanMarga 5.0 Beta — Route Registry

## 1. Route Inventory Table

| Route | Component | Scope | Feature Flag | Role / Permission | Status | Primary Data Source | Notes |
|---|---|---|---|---|---|---|---|
| `/` | `Pages.HomePage` | Public | None | None | ACTIVE | R2 Homepage Snapshot / Firestore | Main landing page |
| `/login` | `Pages.LoginPage` | Public | None | None | ACTIVE | Firebase Auth | Google & Email auth |
| `/community` | `Pages.CommunityPage` | Public | `community.chautari` | None | ACTIVE | Snapshot / Firestore | Chautari Forum |
| `/chautari` | `Navigate -> /community` | Public | None | None | REDIRECT | None | Compatibility alias |
| `/community/post/:id` | `Pages.CommunityPostPage` | Public | `community.chautari` | None | ACTIVE | Firestore / Cache | Chautari thread |
| `/events` | `Pages.EventsPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Events listing |
| `/events/:id` | `Pages.EventPostPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Event detail |
| `/models` | `Pages.ModelsPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Talent / Model directory |
| `/models/:id` | `Pages.ModelProfilePage` | Public | None | None | ACTIVE | Snapshot / Firestore | Model profile |
| `/social` | `Pages.SocialHubPage` | Public | None | None | ACTIVE | Firestore / Static | Social aggregator |
| `/sanatan-social` | `Navigate -> /social` | Public | None | None | REDIRECT | None | Legacy redirect |
| `/timeline` | `Pages.TimelinePage` | Public | None | None | ACTIVE | Snapshot / Cache | Historical timeline |
| `/timeline/:id` | `Pages.TimelinePage` | Public | None | None | ACTIVE | Snapshot / Cache | Timeline event detail |
| `/transparency` | `Pages.TransparencyPage` | Public | None | None | ACTIVE | Static / Audit log | Editorial policy |
| `/archives` | `Pages.ArchivesPage` | Public | None | None | ACTIVE | Snapshot / Cache | Archives OS |
| `/archives/:id` | `Pages.ArchivesPage` | Public | None | None | ACTIVE | Snapshot / Cache | Archive record detail |
| `/ask-sanatan` | `Pages.AskSanatanPage` | Public | None | None | ACTIVE | `/api/gemini/ask-sanatan` | RAG QA interface |
| `/membership` | `Pages.MembershipPage` | Public | None | None | ACTIVE | Static / Auth | Patron & Member plans |
| `/patrons` | `Navigate -> /membership` | Public | None | None | REDIRECT | None | Legacy alias |
| `/academy` | `Pages.AcademyPage` | Public | `training.academy` | None | ACTIVE | Snapshot / Firestore | Course catalog |
| `/academy/course/:id` | `Pages.CourseDetailPage` | Public | `training.academy` | None | ACTIVE | Snapshot / Firestore | Course lessons |
| `/academy/results` | `Pages.StudentAcademyResultsPage`| Public | `training.academy` | None | ACTIVE | Firestore / API | Assessment scores |
| `/training` | `Pages.TrainingCenterPage` | Public | None | None | ACTIVE | Static Training Data | Institutional training |
| `/training/:trackId` | `Pages.TrainingCenterPage` | Public | None | None | ACTIVE | Static Training Data | Track lessons |
| `/training/:trackId/:lessonId` | `Pages.TrainingCenterPage` | Public | None | None | ACTIVE | Static Training Data | Specific lesson |
| `/academy/sanatanmarga-training` | `Navigate -> /training` | Public | None | None | REDIRECT | None | Legacy alias |
| `/academy/training` | `Navigate -> /training` | Public | None | None | REDIRECT | None | Legacy alias |
| `/demo` | `Pages.PublicDemoPage` | Public | None | None | ACTIVE | Static / Mock UI | Interactive demo |
| `/public-demo` | `Navigate -> /demo` | Public | None | None | REDIRECT | None | Alias |
| `/organization/compliance` | `Pages.OrganizationCompliancePage` | Public | None | None | ACTIVE | Firestore / API | Institutional compliance |
| `/training/compliance` | `Navigate -> /organization/compliance` | Public | None | None | REDIRECT | None | Alias |
| `/verify-certificate` | `Pages.CertificateVerificationPage` | Public | `training.certification` | None | ACTIVE | `/api/training/certificate/verify/:id` | Credential verification |
| `/verify-certificate/:certId` | `Pages.CertificateVerificationPage` | Public | `training.certification` | None | ACTIVE | Server HMAC verify | Direct verification link |
| `/verify/:certId` | `Pages.CertificateVerificationPage` | Public | None | None | ACTIVE | Server HMAC verify | Short URL |
| `/global-search` | `Pages.GlobalSearchPage` | Public | None | None | ACTIVE | Snapshot search index | Search OS |
| `/directory` | `Pages.InstitutionalDirectoryPage` | Public | None | None | ACTIVE | Static / Firestore | Institutions directory |
| `/festivals` | `Pages.FestivalEnginePage` | Public | None | None | ACTIVE | Snapshot / Panchang | Festivals & Patro |
| `/onboarding` | `Pages.TenantOnboardingPage` | Public | None | None | ACTIVE | Firestore | Tenant registration |
| `/nepal-hub` | `Pages.NepalHubPage` | Public | None | None | ACTIVE | Snapshot / Live feed | 77 Districts Hub |
| `/nepal-hub/live` | `Pages.NepalHubLivePage` | Public | None | None | ACTIVE | Live provider API | Live ticker & video |
| `/nepal-hub/live/:id` | `Pages.NepalHubLivePage` | Public | None | None | ACTIVE | Live provider API | Specific stream |
| `/listen` | `Pages.ListenPage` | Public | None | None | ACTIVE | Snapshot / MediaOS | ListenOS queue |
| `/radio` | `Pages.RadioPage` | Public | `media.radio` | None | ACTIVE | Snapshot / RadioEngine | 24/7 Sanatan Radio |
| `/media` | `Navigate -> /radio` | Public | None | None | REDIRECT | None | Alias |
| `/store` | `Pages.StorePage` | Public | `commerce.store` | None | ACTIVE | Firestore / Local / WhatsApp | Sanatan Store |
| `/knowledge` | `Pages.KnowledgeBasePage` | Public | None | None | ACTIVE | Snapshot / Graph cache | Saraswati Knowledge Base |
| `/knowledge/:id` | `Pages.KnowledgeBasePage` | Public | None | None | ACTIVE | Snapshot / Graph cache | Entity detail |
| `/knowledge/entity/:id` | `Pages.KnowledgeBasePage` | Public | None | None | ACTIVE | Snapshot / Graph cache | Entity detail alias |
| `/storylines` | `Pages.StorylinesPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Story evolution |
| `/story-evolution` | `Navigate -> /storylines` | Public | None | None | REDIRECT | None | Alias |
| `/my-sanatan` | `Pages.MySanatanPage` | Public/Auth | None | None | ACTIVE | LocalStorage / Auth | User bookmarks & reading history |
| `/saved` | `Pages.MySanatanPage` | Public/Auth | None | None | REDIRECT | None | Alias |
| `/notifications` | `Pages.MySanatanPage` | Public/Auth | None | None | REDIRECT | None | Alias to MySanatan notification tab |
| `/digest` | `Pages.DailyDigestPage` | Public | None | None | ACTIVE | Snapshot / Cache | Daily Briefing |
| `/daily-briefing` | `Navigate -> /digest` | Public | None | None | REDIRECT | None | Alias |
| `/blog` | `Pages.BlogHomePage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Sanatan Blog CMS |
| `/blog/:slug` | `Pages.BlogPostPage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Blog post detail |
| `/blog/category/:slug` | `Pages.BlogCategoryPage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Blog category |
| `/blog/series/:slug` | `Pages.BlogSeriesPage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Blog series |
| `/blog/tag/:tag` | `Pages.BlogTagPage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Blog tag |
| `/blog/author/:authorId` | `Pages.BlogAuthorPage` | Public | `blog.main` | None | ACTIVE | Snapshot / Firestore | Blog author profile |
| `/category/:slug` | `Pages.CategoryPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Category news feed |
| `/article/:id` | `Pages.ArticlePage` | Public | None | None | ACTIVE | Snapshot / Continuity / Live comments | Canonical Article Page |
| `/district/:districtName` | `Pages.DistrictPage` | Public | None | None | ACTIVE | District Intelligence / News | District news feed |
| `/search` | `Pages.SearchPage` | Public | None | None | ACTIVE | Snapshot search index | Search results |
| `/news` | `Pages.LatestNewsPage` | Public | None | None | ACTIVE | Snapshot / Firestore | News feed |
| `/latest` | `Pages.LatestNewsPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Latest news feed |
| `/trending` | `Pages.TrendingPage` | Public | None | None | ACTIVE | Snapshot / Firestore | Trending news |
| `/live` | `Pages.LivePage` | Public | `media.live` | None | ACTIVE | Snapshot / YouTube live | Live broadcast |
| `/live/:videoId` | `Pages.LivePage` | Public | `media.live` | None | ACTIVE | Snapshot / YouTube live | Live stream detail |
| `/about` | `Pages.AboutPage` | Public | None | None | ACTIVE | Static | Institutional page |
| `/contact` | `Pages.ContactPage` | Public | None | None | ACTIVE | Firestore / Email API | Contact form |
| `/profile` | `Pages.ProfilePage` | Authenticated | None | Auth Required | ACTIVE | Firebase Auth / User doc | User Profile |
| `/profile/:uid` | `Pages.ProfilePage` | Authenticated | None | Auth Required | ACTIVE | User doc | User Profile public view |
| `/dashboard` | `Pages.ProfilePage` | Authenticated | None | Auth Required | ALIAS | User doc | Points to ProfilePage |
| `/member-center` | `Pages.ProfilePage` | Authenticated | None | Auth Required | ALIAS | User doc | Points to ProfilePage |
| `/terms` | `Pages.TermsPage` | Public | None | None | ACTIVE | Static | Legal terms |
| `/privacy` | `Pages.PrivacyPage` | Public | None | None | ACTIVE | Static | Privacy policy |
| `/download` | `Pages.DownloadPage` | Public | None | None | ACTIVE | Static / PWA | Mobile app / PWA download |
| `/advertiser` | `Pages.AdvertiserDashboard` | Public/Auth | None | None | ACTIVE | Local / Firestore | Advertiser portal |
| `/advertiser/dashboard` | `Pages.AdvertiserDashboard` | Public/Auth | None | None | ALIAS | Local / Firestore | Alias |
| `/organization` | `Pages.OrganizationDashboard`| Public/Auth | None | None | ACTIVE | Local / Firestore | Org portal |
| `/organization/dashboard`| `Pages.OrganizationDashboard`| Public/Auth | None | None | ALIAS | Local / Firestore | Alias |
| `/org/dashboard` | `Pages.OrganizationDashboard`| Public/Auth | None | None | ALIAS | Local / Firestore | Alias |

## 2. Admin & Staff Route Inventory Table

| Route | Component | Allowed Roles | Feature Flag / Permission | Current Status | Notes |
|---|---|---|---|---|---|
| `/admin` | `Pages.AdminMissionControl` | admin, editor | None | ACTIVE | Mission Control operations |
| `/admin/social` | `Pages.AdminSocial` | admin, editor | None | ACTIVE | Social channels sync |
| `/admin/community` | `Pages.AdminCommunity` | admin, editor | None | ACTIVE | Community posts & moderation |
| `/admin/events` | `Pages.AdminEvents` | admin, editor | None | ACTIVE | Events management |
| `/admin/events/:id` | `Pages.AdminEventEditor` | admin, editor | None | ACTIVE | Event editor |
| `/admin/events/new` | `Pages.AdminEventEditor` | admin, editor | None | ACTIVE | New event |
| `/admin/models` | `Pages.AdminModels` | admin, editor | None | ACTIVE | Talents & Model CMS |
| `/admin/inquiries` | `Pages.AdminInquiries` | admin, editor | None | ACTIVE | Reader inquiries & CRM |
| `/admin/contact-messages` | `Pages.AdminContactMessages` | admin, editor | None | ACTIVE | Direct contact inquiries |
| `/admin/agents` | `Pages.AdminAgents` | admin | None | ACTIVE | Autonomous AI agents |
| `/editor` | `Pages.EditorDashboard` | editor | None | ACTIVE | Standalone editor view |
| `/admin/homepage` | `Pages.AdminHomepage` | admin, editor | None | ACTIVE | Homepage Manager OS |
| `/admin/design-os` | `Pages.AdminDesignOS` | admin, editor | None | ACTIVE | Editorial design controls |
| `/admin/articles` | `Pages.AdminArticles` | admin, editor | None | ACTIVE | Article library |
| `/admin/discovery` | `Pages.AdminDiscovery` | admin, editor | None | ACTIVE | AI News Discovery |
| `/admin/translation` | `Pages.AdminTranslationDashboard` | admin, editor | None | ACTIVE | Translation OS |
| `/admin/health` | `Pages.AdminSystemHealth` | admin, editor | None | ALIAS | Aliased to SystemHealth |
| `/admin/system-health` | `Pages.AdminSystemHealth` | admin, editor | None | ACTIVE | Acceptance suite & telemetry |
| `/admin/ai-observability` | `Pages.AdminAIObservability` | admin, editor | None | ACTIVE | AI tokens & requests |
| `/admin/editor` | `Pages.AdminEditor` | admin, editor | None | ACTIVE | Newsroom CMS editor |
| `/admin/editor/:id` | `Pages.AdminEditor` | admin, editor | None | ACTIVE | Edit specific article |
| `/admin/users` | `Pages.AdminUsers` | admin | `users.manage` | ACTIVE | RBAC User Management |
| `/admin/settings` | `Pages.AdminSettings` | admin | None | ACTIVE | Platform Settings OS |
| `/admin/feature-control` | `Pages.AdminFeatureControl` | admin | None | ACTIVE | Feature Control OS UI |
| `/admin/categories` | `Pages.AdminCategories` | admin | None | ACTIVE | Category CMS |
| `/admin/ads` | `Pages.AdminAds` | admin | None | ACTIVE | Ad placements & campaigns |
| `/admin/menu` | `Pages.AdminMenu` | admin | None | ACTIVE | Navigation menu editor |
| `/admin/setup-guide` | `Pages.AdminSetupGuide` | admin | None | ACTIVE | Setup wizard & environment |
| `/admin/command-center` | `Pages.AdminEditorialCommandCenter` | admin, editor | None | ACTIVE | Editorial Command Center |
| `/admin/page-builder` | `Pages.AdminPageBuilder` | admin | None | ACTIVE | Visual Page Builder |
| `/admin/media-os` | `Pages.AdminMediaAssetsPage` | admin, editor | None | ALIAS | Points to AdminMediaAssetsPage |
| `/admin/media-assets` | `Pages.AdminMediaAssetsPage` | admin, editor | None | ALIAS | Points to AdminMediaAssetsPage |
| `/admin/media` | `Pages.AdminMediaAssetsPage` | admin, editor | None | ACTIVE | Media asset manager |
| `/admin/media-library` | `Pages.AdminMediaAssetsPage` | admin, editor | None | ALIAS | Points to AdminMediaAssetsPage |
| `/admin/operations` | `Pages.AdminMissionControl` | admin, editor | None | ALIAS | Points to Mission Control |
| `/admin/notifications` | `Pages.AdminNotifications` | admin | None | ACTIVE | Push notifications broadcast |
| `/admin/moderation` | `Pages.AdminModeration` | admin, editor | None | ACTIVE | Content moderation |
| `/admin/revenue` | `Pages.AdminRevenueOS` | admin, editor | None | ALIAS | Points to RevenueOS |
| `/admin/revenue-os` | `Pages.AdminRevenueOS` | admin, editor | None | ACTIVE | RevenueOS Monetization |
| `/admin/intelligence-os` | `Pages.AdminNepalIntelligenceOS` | admin, editor | None | ACTIVE | Situation Room OS |
| `/admin/executive` | `Pages.ExecutiveDashboard` | admin | None | ACTIVE | Executive KPI board |
| `/admin/tenants` | `Pages.AdminTenantFederation` | admin | None | ACTIVE | Multi-tenant federation |
| `/admin/workflows` | `Pages.AdminWorkflowAutomation` | admin | None | ACTIVE | Newsroom Kanban |
| `/admin/developer-api` | `Pages.AdminTenantApiKeys` | admin | None | ACTIVE | Developer API keys |
| `/admin/nepal-hub` | `Pages.AdminNepalHubPage` | admin, editor | None | ACTIVE | District hubs management |
| `/admin/radio` | `Pages.AdminRadioPage` | admin, editor | None | ACTIVE | Radio OS station manager |
| `/admin/sponsor-audio` | `Pages.AdminSponsorAudioOS` | admin, editor | None | ACTIVE | Sponsor audio registry |
| `/admin/knowledge-hub` | `Pages.AdminNepalHubPage` | admin, editor | None | MISCONFIG | Points to NepalHubPage instead of Knowledge! |
| `/admin/hub-os` | `Pages.AdminNepalHubPage` | admin, editor | None | ALIAS | Points to NepalHubPage |
| `/admin/knowledge` | `Pages.AdminKnowledgePage` | admin, editor | None | ACTIVE | Knowledge base editor |
| `/admin/knowledge-os` | `Pages.AdminKnowledgePage` | admin, editor | None | ALIAS | Points to KnowledgePage |
| `/admin/archives` | `Pages.AdminArchivesPage` | admin, editor | None | ACTIVE | Historical archives CMS |
| `/admin/timeline` | `Pages.AdminTimelinePage` | admin, editor | None | ACTIVE | Timeline events CMS |
| `/admin/festivals` | `Pages.AdminKnowledgePage(tab=festivals)` | admin, editor | None | ACTIVE | Festival manager tab |
| `/admin/academy` | `Pages.AdminAcademy` | admin, editor | None | ACTIVE | Courses CMS |
| `/admin/video-ads` | `Pages.AdminAcademy` | admin, editor | None | ALIAS | Video ads tab in Academy |
| `/admin/data-governance`| `Pages.AdminGovernancePage` | admin, editor | None | ALIAS | Points to AdminGovernancePage |
| `/admin/disaster-recovery` | `Pages.AdminDisasterRecovery` | admin | None | ACTIVE | Snapshot Vault & Backups |
| `/admin/content-audit` | `Pages.AdminGovernancePage` | admin, editor | None | ALIAS | Points to AdminGovernancePage |
| `/admin/store` | `Pages.AdminStorePage` | admin, editor | None | ACTIVE | Sanatan Store admin |
| `/admin/commerce` | `Pages.AdminStorePage` | admin, editor | None | ALIAS | Points to AdminStorePage |
| `/admin/commerce-analytics`| `Pages.AdminCommerceAnalytics` | admin, editor | None | ACTIVE | Store analytics |
| `/admin/platform-health` | `Pages.AdminMissionControl` | admin, editor | None | ALIAS | Points to Mission Control |
| `/admin/mission-control` | `Pages.AdminMissionControl` | admin, editor | None | ALIAS | Points to Mission Control |
| `/admin/governance` | `Pages.AdminGovernancePage` | admin, editor | None | ACTIVE | Governance & Audit |
| `/admin/reader-analytics` | `Pages.AdminReaderAnalyticsPage` | admin | None | ACTIVE | Reader habits analytics |
| `/admin/system-integrity` | `Pages.AdminSystemIntegrity` | admin, editor | None | ACTIVE | System integrity checks |
| `/admin/training` | `Pages.AdminTrainingManagerPage` | admin, editor, super_admin | None | ACTIVE | Institutional training CMS |
| `/admin/blog` | `Pages.AdminBlog` | admin, editor | None | ACTIVE | Blog CMS |
| `/admin/newsroom` | `Pages.AdminEditor` | admin, editor | None | ALIAS | Points to AdminEditor |
| `/admin/audit` | `Pages.AdminGovernancePage` | admin, editor | None | ALIAS | Points to AdminGovernancePage |
| `/admin/live` | `Pages.AdminLive` | admin, editor | None | ACTIVE | Live video CMS |
| `/admin/analytics` | `Pages.AnalyticsOSDashboard` | admin, editor | None | ACTIVE | Analytics OS |
| `/admin/seo-os` | `Pages.AdminSeoOS` | admin, editor | None | ACTIVE | SEO engine manager |
| `/sgis` | `Pages.AdminKnowledgePage(tab=sgis)` | admin, editor | None | ACTIVE | SGIS OCR & Epigraphy |
| `/sgis/manuscript/:id` | `Pages.AdminKnowledgePage(tab=sgis)` | admin, editor | None | ACTIVE | SGIS Manuscript editor |
| `/admin/sgis` | `Pages.AdminKnowledgePage(tab=sgis)` | admin, editor | None | ACTIVE | SGIS CMS |
| `/admin/sgis/review/:id` | `Pages.AdminKnowledgePage(tab=sgis)` | admin, editor | None | ACTIVE | SGIS Scholar Review |

## 3. Key Findings & Routing Defects
1. **Misconfigured Target**: `/admin/knowledge-hub` points to `Pages.AdminNepalHubPage` instead of `Pages.AdminKnowledgePage`!
2. **Quadruple Duplication of Media Routes**: `/admin/media-os`, `/admin/media-assets`, `/admin/media`, `/admin/media-library` all point to `AdminMediaAssetsPage`, while `AdminMediaOS.tsx` and `AdminMediaLibrary.tsx` still exist as orphaned page components in `src/pages/`.
3. **Triple Health Aliases**: `/admin/health`, `/admin/system-health`, `/admin/platform-health`, `/admin/system-integrity` have overlapping destinations.
4. **Governance Overlaps**: `/admin/governance`, `/admin/data-governance`, `/admin/content-audit`, `/admin/audit` all map to `Pages.AdminGovernancePage`.
