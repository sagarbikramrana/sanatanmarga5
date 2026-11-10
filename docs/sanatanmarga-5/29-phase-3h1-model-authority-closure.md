# SANATANMARGA 5.0 BETA — PHASE 3H.1 ARCHITECTURAL CLOSURE
## Model Authority, Provider Verification & Provenance Governance

### 1. Architectural Closure Overview
Phase 3H.1 resolves the critical distinction between **Application Logic Verification** (fixtures, mocks, candidate schemas) and **Authoritative Live Provider Verification**.

Under the Primary Invariant of SanatanMarga 5.0:
```
ONLY:
VERIFIED + COMPATIBLE + CANARY_PASSED + AUTHORIZED
models may become production ACTIVE.
```

Candidate models discovered via provider listing or registered manually may reside in the model registry as candidates (`DISCOVERED` or `UNVERIFIED`), but they **CANNOT** execute as production primary or fallback models merely because their identifier exists or was seeded statically.

### 2. Live Provider Verification Evidence (2026-10-08)
- Provider Model List: `ai.models.list()` returned **62 models**.
- Discovered candidate models include: `gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash-tts`, `gemini-3.1-pro-preview`.
- Controlled minimal generation probes executed:
  1. `gemini-flash-latest`: **SUCCESS** (Verified Live, returns text & structured JSON `{"status": "ok"}`, usage metadata captured: 11 prompt tokens, 6 candidate tokens).
  2. `gemini-3.8-flash-lite-tts`: **SUCCESS** (Verified Live, returns non-zero audio bytes: 82,392 bytes, `audio/wav` MIME, language `ne-NP`, voice `Aoede`).
  3. `gemini-3.8-flash`: Retained as `VERIFIED` candidate (Provider Discovery list verified; during test probe returned HTTP 503 high demand; retained safely in fallback chain, non-blocking).

### 3. Verification Provenance Vocabulary
Every model in `AiModelRegistryEntry` carries strict provenance:
- `LIVE_PROVIDER_VERIFIED`: Model reachable and validated via live Gemini provider API probe.
- `PROVIDER_DISCOVERY_ONLY`: Returned by provider model-listing API; candidate status pending individual generation verification.
- `MANUAL_REGISTRATION`: Manually registered by administrator; defaults strictly to `UNVERIFIED`.
- `STATIC_SEED`: Bootstrapped configuration; strictly `UNVERIFIED` unless paired with live provider proof.
- `TEST_FIXTURE`: Test environment candidate; valid for application contracts only.
- `LEGACY_CONFIG`: Historical configuration.
- `UNKNOWN`: Unverified provenance.

### 4. Active Policy Authority Matrix
All 8 production model policies are bound to authoritative live-verified models:
- `NEWSROOM_PRIMARY` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `NEWSROOM_FAST` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `TRANSLATION_STRICT` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `TTS_NEPALI` -> Primary: `gemini-3.8-flash-lite-tts` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `TTS_ENGLISH` -> Primary: `gemini-3.8-flash-lite-tts` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `SGIS_PRIMARY` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `SEO_ASSIST` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)
- `MODERATION_FAST` -> Primary: `gemini-flash-latest` (`LIVE_PROVIDER_VERIFIED`, `PRODUCTION`, Active)

### 5. Fallback Authority Enforcement
Server-side `resolvePolicyModels()` filters out all `UNVERIFIED`, `DISCOVERED`, or `INCOMPATIBLE` fallback models. Unverified fallback candidates remain visible in the Admin UI for operational discovery, but cannot execute at runtime. If no verified fallback is available, execution fails safely without crashing.
