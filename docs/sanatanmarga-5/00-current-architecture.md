# SanatanMarga 5.0 Beta — Architecture Audit (Current Baseline)

## 1. System Identity & Version Baseline
- **Application Version**: `4.2.8` (Source: `package.json`)
- **Target Upgrade**: `5.0 Beta`
- **Core Runtime**: React 19.0.0, Vite 6.2.0, TypeScript ~5.8.2, Node.js (Express 4.21.2 with `tsx 4.21.0` and `esbuild 0.28.1`)
- **Styling Architecture**: Tailwind CSS v4.1.14 (`@tailwindcss/vite` & `@import "tailwindcss";`)
- **PWA & Offline Architecture**: `vite-plugin-pwa 1.2.0`, Service Worker in `/public/service-worker.js`, CacheStorage + IndexedDB (`idb` patterns)
- **Database & Identity**:
  - Client SDK: `firebase 12.11.0`
  - Server Admin SDK: `firebase-admin 13.8.0`
  - Active Firestore Database ID: `ai-studio-sanatanmedia5-1f4c0dc0-3b80-470b-89b9-f341b51daaa1`
  - Project ID: `pod-studio-saas`
- **Object Storage & CDN**:
  - AWS SDK S3 clients: `@aws-sdk/client-s3 ^3.1095.0`, `@aws-sdk/s3-request-presigner ^3.1095.0`
  - Primary Media R2 Bucket: `sanatanos-assets` (`https://assets.sanatanmarga.com`)
  - Snapshot Delivery R2 Bucket: `sanatanos-snapshots`
- **Artificial Intelligence Integration**:
  - Google GenAI SDK: `@google/genai ^1.29.0`
  - Model Chains: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.0-pro` fallback rotation
- **Observability**: `@sentry/react ^10.66.0` and `@sentry/node ^10.66.0`

## 2. Server & Client Topology
```
                          [ Client Browser / PWA ]
                                     |
               +---------------------+---------------------+
               | (Static Asset / HTML / SPA routes)       | (API Calls /api/*)
               v                                           v
       [ Vite / Static Dist ]                     [ Express Server (3000) ]
                                                           |
          +-----------------------+------------------------+-----------------------+
          |                       |                        |                       |
          v                       v                        v                       v
[ Cloud Firestore ]    [ Cloudflare R2 Buckets ]  [ Gemini AI Gateway ]     [ ListenOS TTS ]
(ai-studio-sanatan...) (sanatanos-assets/snap)     (@google/genai SDK)    (Streaming / R2 Cache)
```

## 3. High-Level Subsystem Map
1. **Editorial & Newsroom**: `AdminEditor`, `AdminArticles`, `AdminDiscovery`, `AdminTranslationDashboard`, `AdminBlog`.
2. **Broadcast & Media (ListenOS & LiveOS)**: `RadioPage`, `AdminRadioPage`, `LivePage`, `AdminLive`, `audioPlaybackManager`, `playlistEngine`.
3. **Knowledge & Civilization**: `KnowledgeBasePage`, `AdminKnowledgePage`, `SgisDashboard`, `ArchivesPage`, `TimelinePage`, `FestivalEnginePage`.
4. **Community & Chautari**: `CommunityPage`, `CommunityPostPage`, `AdminCommunity`, `AdminModeration`, `AdminSocial`.
5. **Academy & Certification**: `AcademyPage`, `CourseDetailPage`, `CertificateVerificationPage`, `AdminAcademy`, `trainingEndpoints.ts`.
6. **RevenueOS & Commerce**: `AdminRevenueOS`, `AdminAds`, `StorePage`, `AdminStorePage`, `AdminCommerceAnalytics`.
7. **Nepal Hub**: `NepalHubPage`, `NepalHubLivePage`, `AdminNepalHubPage`, `nepalDistrictService`.
8. **Snapshot OS**: `SnapshotOS` (Server), `snapshotEngine` (Client), `continuityEngine`, SVRP (Snapshot Vault).
9. **Feature Control OS**: `featureRegistry.ts`, `featureControlOS.ts`, `FeatureControlContext.tsx`, `feature_control_config.json`.
10. **Tenant Federation**: `tenantContext.tsx`, `AdminTenantFederation.tsx`, `AdminTenantApiKeys.tsx`.
