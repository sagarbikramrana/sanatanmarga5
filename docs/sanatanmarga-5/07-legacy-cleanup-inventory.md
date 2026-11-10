# SanatanMarga 5.0 Beta — Legacy & Cleanup Inventory

## 1. Classification Guidelines
- **KEEP**: Core operational files with clean responsibility.
- **UPGRADE**: Working subsystems requiring 5.0 hardening (e.g. SnapshotOS, FeatureControlOS).
- **MERGE**: Duplicate subsystems performing identical jobs (e.g. multiple billing/revenue stores).
- **DEPRECATE**: Older compatibility wrappers or duplicate pages to be phased out safely.
- **DELETE_CANDIDATE**: Temporary scripts, test artifacts, or abandoned duplicate modules.
- **NEEDS_INVESTIGATION**: Items with complex or unclear cross-system dependencies.

## 2. Root Directory Scratch / Patch Scripts
*(Over 60 shell and python scripts in root left behind from historical hotfixes)*

| File | Classification | Evidence | Replacement | Risk | Recommendation |
|---|---|---|---|---|---|
| `/fix_adminsidebar.py` | `DELETE_CANDIDATE` | One-off patch script | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_editor_dashboard.sh` | `DELETE_CANDIDATE` | One-off bash patch | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_firebase.py` | `DELETE_CANDIDATE` | One-off patch script | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_firebase_import.py` | `DELETE_CANDIDATE` | One-off patch script | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_rebuild.py` | `DELETE_CANDIDATE` | One-off patch script | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_server_sos.py` | `DELETE_CANDIDATE` | One-off patch script | Git history | Zero | Remove in Phase 1 cleanup |
| `/fix_style.js`, `.py`, `.sh` | `DELETE_CANDIDATE` | One-off patch scripts | Git history | Zero | Remove in Phase 1 cleanup |
| `/patch_*.sh` (30+ files) | `DELETE_CANDIDATE` | Emergency sed/patch scripts | Git history | Zero | Remove in Phase 1 cleanup |
| `/patch_*.py` (10+ files) | `DELETE_CANDIDATE` | Python string replacements | Git history | Zero | Remove in Phase 1 cleanup |
| `/replace_*.py` (20+ files)| `DELETE_CANDIDATE` | Ad-hoc replacement scripts | Git history | Zero | Remove in Phase 1 cleanup |
| `/patch_content.txt` | `DELETE_CANDIDATE` | Scratch text buffer | None | Zero | Remove in Phase 1 cleanup |
| `/run-debug-compile.ts` | `KEEP` | Debug CLI runner | None | Low | Retain for local diagnostics |
| `/run-smoke-test.ts` | `KEEP` | Local smoke test script | None | Low | Retain for test suite |

## 3. Duplicate Pages & Components

| File / Component | Classification | Evidence | Replacement | Risk | Recommendation |
|---|---|---|---|---|---|
| `src/pages/AdminMediaOS.tsx` | `DELETE_CANDIDATE` | `AppRoutes.tsx` routes all media paths to `AdminMediaAssetsPage.tsx`. `AdminMediaOS.tsx` is an orphaned page. | `src/pages/AdminMediaAssetsPage.tsx` | Low | Deprecate in lazyPages and delete in media consolidation |
| `src/pages/AdminMediaLibrary.tsx` | `DELETE_CANDIDATE` | `AppRoutes.tsx` routes `/admin/media-library` to `AdminMediaAssetsPage.tsx`. Orphaned component. | `src/pages/AdminMediaAssetsPage.tsx` | Low | Deprecate in lazyPages and delete |
| `src/pages/AdminOperations.tsx` | `DEPRECATE` | `AppRoutes.tsx` routes `/admin/operations` to `AdminMissionControl`. | `src/pages/AdminMissionControl.tsx` | Low | Merge any unique operational diagnostics into MissionControl |
| `src/pages/AdminHealth.tsx` | `MERGE` | Duplicates `AdminSystemHealth.tsx`. | `src/pages/AdminSystemHealth.tsx` | Low | Merge into AdminSystemHealth |
| `src/pages/AdminPlatformHealth.tsx` | `MERGE` | Overlaps with `AdminMissionControl.tsx`. | `src/pages/AdminMissionControl.tsx` | Low | Merge into AdminMissionControl |
| `src/pages/AdminDataGovernance.tsx` | `MERGE` | Overlaps with `AdminGovernancePage.tsx`. | `src/pages/AdminGovernancePage.tsx` | Low | Consolidate tabs in AdminGovernancePage |
| `src/pages/AdminContentAudit.tsx` | `MERGE` | Overlaps with `AdminGovernancePage.tsx`. | `src/pages/AdminGovernancePage.tsx` | Low | Consolidate into AdminGovernancePage |

## 4. Duplicate Services & Engine Overlaps

| Module A | Module B | Classification | Recommendation |
|---|---|---|---|
| `src/services/billingEngine.ts` | `src/services/revenue/billingEngine.ts` | `MERGE` | Merge into single canonical `revenue/billingEngine.ts` |
| `src/services/adDeliveryEventStore.ts` | `src/services/revenue/adDeliveryEventStore.ts` | `MERGE` | Merge into single `revenue/adDeliveryEventStore.ts` |
| `src/services/revenueLedger.ts` | `src/services/revenue/revenueLedgerService.ts` | `MERGE` | Merge into single `revenue/revenueLedgerService.ts` |
| `src/services/knowledgeOS.ts` | `src/services/knowledge/` submodules | `MERGE` | Modularize knowledge resolvers into `services/knowledge/` |
| `src/services/archiveSnapshotService.ts` | `src/services/archive/archiveSnapshotService.ts` | `MERGE` | Use submodule version |
| `src/services/timelineSnapshotService.ts` | `src/services/timeline/timelineSnapshotService.ts` | `MERGE` | Use submodule version |

## 5. Duplicate Data Collections in Code

| Collection 1 | Collection 2 | Evidence in Code | Recommendation |
|---|---|---|---|
| `community_posts` | `communityPosts` | `disasterRecovery.ts`, `backupData.ts` | Standardize on snake_case `community_posts` in 5.0 |
| `community_comments` | `communityComments`| `disasterRecovery.ts`, `backupData.ts` | Standardize on snake_case `community_comments` in 5.0 |
| `commerce_products` | `store_products` | `firestore.rules`, `server.ts` | Standardize on `store_products` in 5.0 |
| `commerce_orders` | `store_orders` | `firestore.rules`, `server.ts` | Standardize on `store_orders` in 5.0 |
| `knowledge_base` | `knowledgeNodes` | `server.ts`, `disasterRecovery.ts` | Standardize on canonical `knowledge_base` in 5.0 |
