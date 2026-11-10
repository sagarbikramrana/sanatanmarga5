# SanatanMarga 5.0 Beta — Phase 2E Architecture: Dynamic Admin Command Center Foundation

## Executive Summary
Phase 2E establishes the **Dynamic Admin Command Center OS 5.0** for SanatanMarga. It unifies administrative operations across all 11 core domains, replaces scattered admin routes with a canonical, typed **Admin Module Registry**, integrates capability-aware access control and Feature Control OS gating, establishes a **Universal Review Inbox** with deduplication, and surfaces authoritative real-time health telemetry directly from underlying platform engines (Snapshot OS, Disaster Recovery OS, SEO & Discovery OS, Media & TTS Integrity OS, and Firestore Gateway).

---

## Core Architectural Components

### 1. Canonical Admin Module Registry (`src/admin/adminModuleRegistry.ts`)
- **Domain Topology**: 11 structured operational domains (`COMMAND_CENTER`, `EDITORIAL`, `MEDIA`, `KNOWLEDGE`, `COMMUNITY`, `ACADEMY`, `EVENTS_COMMERCE`, `REVENUE`, `AUDIENCE`, `AI_AUTOMATION`, `PLATFORM`).
- **Capability-Aware Access Evaluator (`evaluateAdminModuleAccess`)**:
  - Validates module retirement and global/module maintenance modes.
  - Grants super-administrator full capability access.
  - Enforces Feature Control OS runtime feature states (`off`, `admin_only`, `staff_only`).
  - Evaluates navigation visibility policies (`ALWAYS`, `STAFF_ONLY`, `ADMIN_ONLY`, `SUPER_ADMIN_ONLY`, `INTERNAL`).
  - Checks granular RBAC permissions (`news.create`, `media.upload`, `settings.manage`, etc.).
  - Evaluates dependency graph constraints before rendering.
- **Navigation Tree Compilation (`getVisibleAdminNavigation`)**: Dynamically projects authorized navigation trees tailored specifically to the authenticated user's role and effective permissions.
- **Legacy Route Aliases & Orphan Detection (`getAdminModuleByRoute`, `getAdminBreadcrumbs`)**: Resolves legacy URLs (e.g. `/admin/operations` -> `/admin`) safely while strictly blocking unregistered orphan paths.

### 2. Authoritative Admin Command Center Service (`server/adminCommandCenterService.ts`)
- **Real Platform Telemetry Aggregator (`collectSystemHealth`)**:
  - **Snapshot OS**: Monitors manifest version, module counts, and degraded fallback states.
  - **Disaster Recovery OS**: Surfaces latest verified backup ID, retention class, audit counts, and live R2 verification status (`UNVERIFIED` carry-forward).
  - **SEO & Discovery OS**: Collects indexable counts, canonical conflicts, orphan routes, and active sitemap counts.
  - **Media & TTS Integrity OS**: Tracks total/verified/missing assets, TTS cache hits, and single-flight generation health.
  - **Firestore Gateway & Quota Breaker**: Directly observes circuit breaker states (`CLOSED`, `HALF_OPEN`, `OPEN_QUOTA`) and blocks cascading calls.
  - **Feature Control OS**: Summarizes active vs disabled canonical features.
- **Automated Attention Item Engine (`registerAttention`, `getAttentionItems`)**:
  - Automatically generates prioritized warning and critical alerts (e.g. Quota trips, snapshot degraded fallback).
  - Enforces event coalescence via deterministic deduplication keys (`dedupeKey`).
  - Deep-links directly to target administrative workflows (`targetRoute`).
- **Universal Review Inbox (`getReviews`, `updateReviewStatus`)**:
  - Centralizes drafts, flagged community posts, media verifications, and compliance sign-offs into a unified triage queue.
  - Enforces tenant isolation and role permissions.
- **Active Operations Tracker (`startOperation`, `updateOperation`, `getActiveOperations`)**:
  - Tracks live background platform tasks (rebuilds, backups, restore drills) with authentic indeterminate or measurable progress.
- **Permission-Enforced Admin Search (`searchAdminResources`)**:
  - Sub-millisecond indexed lookup across accessible modules, articles, media assets, backups, and user directories.
  - Strictly prevents cross-tenant data leaks and gates privileged categories.
- **Scoped In-Memory Summary Cache**:
  - Short-lived TTL (5s) cache keyed by tenant and role (`${tenantId}:${userRole}:${isSuperAdmin}`) preventing query floods while preserving tenant boundary isolation.

### 3. Frontend Command Shell & Error Boundary
- **Command Palette (`src/components/admin/AdminCommandPalette.tsx`)**:
  - Global `Cmd+K` keyboard shortcut enabling keyboard navigation across permitted modules, rapid editorial actions, and entity search.
- **Admin Error Boundary (`src/components/admin/AdminErrorBoundary.tsx`)**:
  - Isolates module-level rendering errors, preventing single-page component failures from crashing the overarching admin shell navigation.
- **Dynamic Sidebar Navigation (`src/components/layout/AdminSidebar.tsx`)**:
  - Consumes dynamic registry and real command center review counts without attaching unauthorized listeners.

---

## 60-Point Verification Results
- Registry unique module IDs: **PASS**
- Active routes & route protection metadata: **PASS**
- Capability & Feature Control access gating: **PASS**
- Cross-tenant search & review isolation: **PASS**
- Real health telemetry from underlying engines: **PASS**
- Quota gateway circuit breaker alignment: **PASS**
- Attention & review event deduplication: **PASS**
- Secrets sanitization in privileged audit logs: **PASS**
- 0 regressions across Phase 1A, 1B, 1D, 1E, 2A, 2A.3, 2B, 2C, 2C.1, 2D: **PASS**
- Production bundle & TypeScript verification: **PASS**
