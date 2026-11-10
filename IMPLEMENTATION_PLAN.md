# Sanatan Marga / Sanatan Media — Implementation Plan & Roadmap (v2.6)

## 1. Project Status Summary
Sanatan Marga has achieved stable production-grade operations across core news distribution, multimedia coverage, knowledge graph explorer, community interaction, and AI-assisted editorial workflows.

---

## 2. Completed Milestones & Stabilizations (v2.6)

- [x] **Snapshot OS Hydration**: Cache-first snapshot loading across Home, Nepal Hub, Categories, and Community channels.
- [x] **Robust Offline Queue**: Mutex-safe local queuing with automatic event dispatch and background synchronization.
- [x] **Discovery Center Permissions & Fallbacks**: Fully compliant Firestore rules for `/hotTopics` and `/discoveryQueue` with fallback logic on Gemini rate limits (429 handling).
- [x] **Safe JSON Extraction & Error Hardening**: `extractJson()` fortified against non-string inputs; safe optional chaining for event listeners across all banners and badges.
- [x] **Safe Broadcast Notification Handlers**: Asynchronous broadcast operations decoupled from the critical editor save path to eliminate unhandled promise rejections.
- [x] **Bilingual Infrastructure**: Comprehensive Nepali / English localization with live phonetic transliteration.

---

## 3. Active Workflows & Operations

1. **Editorial & Content Creation**:
   - Article Editor (`/admin/editor/:id?`) with AI Generator, SEO metadata, multimedia assets, and live preview.
   - Media OS (`/admin/media-os`) and Asset Library (`/admin/media`).
2. **Nepal Hub Live Intelligence**:
   - Live Dispatches, Market/Festival trackers, District coverage, and Breaking News banners.
3. **Sanatan Knowledge Base**:
   - Interactive Node Graphs, Scripture references, Geographic mapping, and Entity extraction.
4. **Platform Health & Governance**:
   - Quota Telemetry, Health Dashboard (`/admin/health`), Disaster Recovery (`/admin/disaster-recovery`), and Data Governance (`/admin/governance`).

---

## 4. Verification & Testing Protocol

- Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` (`npm run build`) to ensure full bundle compatibility.
- Ensure all custom event dispatches carry structured payloads (`detail: { count }`).
- Monitor Firestore usage against daily allocation metrics.
