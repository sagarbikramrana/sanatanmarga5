# SANATANMARGA 5.0 BETA — PHASE 3H ARCHITECTURAL SPECIFICATION
## AI Observability OS & Model Control Center

### 1. Architectural Overview
Phase 3H establishes the canonical **AI Observability OS and Model Control Center** for SanatanMarga 5.0 Beta. It introduces server-authoritative AI workload governance, dynamic model registry and discovery, capability validation, model policy aliasing, canary testing, non-destructive activations and rollbacks, granular request tracing, token accounting, and cost estimation.

Prior to Phase 3H, AI workloads scattered throughout the platform used hardcoded model identifiers without central governance. Phase 3H consolidates all AI interactions so that application and editorial code depend exclusively on **logical policy aliases** (e.g. `NEWSROOM_PRIMARY`, `TRANSLATION_STRICT`, `TTS_NEPALI`, `SGIS_PRIMARY`), allowing non-coder administrators to discover, verify, canary-test, and update Gemini models safely from the Admin panel without writing or deploying code.

### 2. Core Concepts & Registries

#### A. Canonical Workload Registry (`AiWorkload`)
Defines operational boundaries for every real AI workload across the platform:
- `workload_newsroom_angles`: Editorial story angle generation (Balanced, structured output).
- `workload_newsroom_factcheck`: Grounded claim verification and cross-referencing (Grounding required, human review required).
- `workload_translation`: Multilingual Nepali/English/Hindi translation (Strict, human review required).
- `workload_tts_bulletin`: Native audio bulletin synthesis for Sanatan Radio (Audio modality required).
- `workload_sgis_ocr`: Manuscript OCR transcription and structuring (Deterministic JSON, privacy-preserving).
- `workload_seo_assist`: Automated SEO metadata and JSON-LD enrichment.
- `workload_chautari_moderation`: Community discussion content safety moderation.

#### B. Dynamic Gemini Model Registry (`AiModelRegistryEntry`)
Server-authoritative catalog of available Gemini models:
- Lifecycle status: `DISCOVERED`, `VERIFIED`, `ACTIVE`, `DEPRECATED`, `UNAVAILABLE`, `INCOMPATIBLE`, `RETIRED`.
- Capability vocabulary: `TEXT_GENERATION`, `STRUCTURED_OUTPUT`, `STREAMING`, `IMAGE_INPUT`, `AUDIO_INPUT`, `TTS`, `EMBEDDING`, `GROUNDING`, `LONG_CONTEXT`, `TOOL_USE`.
- **Absolute Rule**: Discovered models are registered as `DISCOVERED` and NEVER automatically activate or replace a production policy.

#### C. Model Policy Aliases & Governance (`AiModelPolicy`)
Logical policies resolve primary and ordered fallback chains:
- `NEWSROOM_PRIMARY` -> Primary: `gemini-3.8-flash`, Fallbacks: [`gemini-3.1-flash-lite`, `gemini-flash-latest`]
- `TRANSLATION_STRICT` -> Primary: `gemini-3.8-flash`, Fallbacks: [`gemini-3.1-flash-lite`]
- `TTS_NEPALI` -> Primary: `gemini-3.8-flash-lite-tts`, Fallbacks: [`gemini-3.8-flash-tts`]
- `SGIS_PRIMARY` -> Primary: `gemini-3.8-flash`, Fallbacks: [`gemini-3.1-flash-lite`, `gemini-flash-latest`]

#### D. Non-Coder Model Update Wizard & Safety Gate
Admin workflow for upgrading models:
1. **Discover**: Reconcile models via provider API or administrative registration.
2. **Compatibility Check**: Reject assignment if candidate lacks required modality (e.g. text-only model assigned to TTS).
3. **Verify**: Controlled probe tests reachability and normalized error handling.
4. **Canary**: Run representative non-destructive fixtures comparing candidate vs current.
5. **Activate**: Optimistic concurrency (`expectedVersion`), server-side admin authorization, version increment, and audit history.
6. **Rollback**: Instant one-click rollback restores prior valid policy without code changes.

### 3. Observability, Tracing & Cost Accounting
- **Canonical Request Context**: Unique opaque `traceId` (no PII encoded), workload ID, and policy version.
- **Job Tracing**: Lifecycle tracking (`QUEUED`, `RUNNING`, `WAITING_RETRY`, `SUCCEEDED`, `FAILED`, `CANCELLED`), attempt history with latency and normalized error codes.
- **Token Accounting**: Truthful usage reporting with `NOT_REPORTED` fallback. No fabricated token counts.
- **Estimated Cost Signals**: Labeled `ESTIMATED_COST` bound to immutable pricing version (`2026-Q1-V1`).
- **Privacy & Sanitization**: Manuscripts and full prompts are not logged in operational telemetry; only SHA-256 hashes and canonical resource references are retained. Accidental API secrets in output references are automatically redacted.
- **Failure Inbox & Health Scorecard**: Deduplicated failure alerts (`firstSeen`, `lastSeen`, `count`) and real-time operational scorecard.

### 4. Verification & Baseline Compliance
- **150-Point Specification Suite**: `tests/phase3h-ai-observability-os.ts` -> 150/150 PASSED
- **28-Step Production Smoke**: `tests/phase3h-production-smoke.ts` -> 28/28 PASSED
- **Specification Baseline Total**: 962 (Pre-3H) + 150 (Phase 3H) = **1112 / 1112**
- **Production Smoke Baseline Total**: 114 (Pre-3H) + 28 (Phase 3H) = **142 / 142**
- **Snapshot Invalidation Gate**: 15 / 15 PASSED
- **Runtime Hook Integrity**: 6 / 6 PASSED
- **Lint & Build**: Clean production compile and TypeScript verification (0 errors).
