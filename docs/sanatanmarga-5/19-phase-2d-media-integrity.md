# SanatanMarga 5.0 Beta — Phase 2D Architecture: Media & TTS Asset Integrity OS 5.0

## Executive Summary
Phase 2D establishes **Media & TTS Asset Integrity OS 5.0** as the authoritative, content-addressable storage, reference tracking, and recovery reconciliation layer for SanatanMarga. It guarantees that media files (images, audio, TTS audio, videos, SGIS manuscripts/PDFs, and advertisements) have deterministic identity, content verification, secure storage key namespaces, reference traceability, tenant isolation, and safe garbage collection.

---

## Core Pillars

### 1. Authoritative Media Asset Registry
- `MediaAsset` model tracking:
  - Content-Addressable Hash (`SHA-256`)
  - Storage Key (`media/original/...`, `tts/...`, `tenants/...`)
  - MIME type & verified magic bytes
  - Integrity Status (`VERIFIED`, `MISSING`, `HASH_MISMATCH`, `METADATA_MISMATCH`, `QUARANTINED`, `LEGACY_UNVERIFIED`, `REGENERATION_PENDING`)
  - Lifecycle Status (`ACTIVE`, `UNREFERENCED`, `ORPHAN_CANDIDATE`, `RETENTION_WAIT`, `DELETE_ELIGIBLE`, `DELETED`)
  - Origin (`USER_UPLOAD`, `EDITORIAL_UPLOAD`, `AI_GENERATED`, `TTS_GENERATED`, `DERIVED_IMAGE`, `RESTORED`, `LEGACY`, `SYSTEM`)
  - Reference Class (`REQUIRED`, `OPTIONAL`, `DERIVED_OPTIONAL`)

### 2. Hash-Based Content Addressing & Deduplication
- Identical bytes upload deduplication reuses verified existing storage objects without rewriting storage.
- Storage keys derive deterministically from content hash and entity type rather than user-supplied filenames.
- Path traversal sequences (`..`, `/`, `\`) and dangerous extensions are stripped and sanitized.

### 3. MIME & Magic Byte Security Validation
- Binary header inspection checks true magic numbers (JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `47 49 46 38`, WEBP `52 49 46 46`, WAV `52 49 46 46 ... WAVE`, PDF `25 50 44 46`).
- HTML or script disguised as media (`<svg><script>`, `<!doctype html>`) is quarantined immediately (`SVG_SCRIPT_INJECTION_DETECTED`, `HTML_DISGUISED_AS_IMAGE`).

### 4. Reference Tracking & Orphan Detection
- Tracks bidirectional entity references (`articles.heroImage`, `courses.syllabusPdf`, `events.gallery`, etc.).
- Missing optional media does not invalidate text reading; missing required media flags re-upload requirements.
- Orphan candidates require zero active canonical references, zero active snapshot manifest dependencies, zero backup dependencies, and non-protected status.

### 5. Deterministic TTS Management & Single-Flight Deduplication
- Deterministic hash identity derived from: `spokenText` (or title + text), language (`ne`), voice (`aoede`), model version, speed, and audio style.
- Existing valid audio objects are reused without re-calling Google GenAI TTS.
- In-flight request deduplication prevents duplicate simultaneous TTS model calls for identical content.
- Missing or stale derived TTS regenerates automatically; Feature Control (`ai.tts`) state is respected.

### 6. Disaster Recovery & Restore Reconciliation
- Restored records reconcile references against the current media registry.
- Valid existing binary assets are linked without duplicate uploads.
- Missing derived assets (TTS, thumbnails) queue automatic regeneration; missing originals report recovery issues.
- Restored older backups cannot overwrite newer valid assets.

### 7. Tenant & Private Asset Isolation
- Private or tenant-scoped assets reside in isolated namespaces (`tenants/{tenantId}/media/...`).
- Content hash deduplication respects visibility boundaries to prevent cross-tenant information disclosure.

### 8. Safe Garbage Collection (Dry-Run First)
- Garbage collection planner generates an `AssetCleanupPlan` without performing writes or deletions.
- Deletion execution requires verified admin privileges (`super_admin` / `admin`) and preserves protected/snapshot-dependent assets.

---

## Phase 2D Verification Results
- **Phase 2D Suite**: 50 passed, 0 failed, Exit Code 0 (`tests/phase2d-media-integrity.ts`)
- **Full Regression Total**: 340 passed, 0 failed (100% Pass Rate across 10 suites)
- **Typecheck**: Exit Code 0 (`npm run lint`)
- **Production Build**: Exit Code 0 (`npm run build` - Vite Client + esbuild Server)
