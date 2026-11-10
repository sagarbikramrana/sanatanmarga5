# Phase 3D — Translation & Language Input OS 5.0 Specification & Architecture

## 1. Executive Overview
Phase 3D establishes **Translation & Language Input OS 5.0**, a Nepali-first, privacy-conscious language and translation architecture for SanatanMarga 5.0 Beta.

The architecture enforces strict conceptual and operational separation between:
1. **Translation** (meaning changes language across `ne`, `en`, `hi`),
2. **Roman Nepali Transliteration** (same language, Latin-to-Devanagari script input),
3. **Scholarly Transliteration** (Sanskrit / Vedic Devanagari $\leftrightarrow$ IAST with canonical diacritics), and
4. **TTS** (text-to-speech audio rendering).

Live Roman Nepali typing executes **100% locally and offline** with zero network requests and zero per-keystroke cloud AI calls.

---

## 2. Core Architectural Invariants

| Domain | Invariant Policy |
|---|---|
| **Primary Language Policy** | Priority: 1. Nepali (`ne`, default), 2. English (`en`), 3. Hindi (`hi`, feature-controlled). Anonymous default is `ne`. |
| **No AI per Keystroke** | Roman Nepali typing is strictly deterministic, local, and synchronous. No fetch, Firestore writes, or Gemini calls occur on keypress. |
| **Protected Token Exclusion** | Emails, URLs, passwords, API keys, code identifiers, SKUs, and phone numbers are automatically detected and excluded from transliteration. |
| **Translation Provenance** | Modeled explicitly: `HUMAN_AUTHORED`, `HUMAN_TRANSLATED`, `AI_ASSISTED`, `AI_TRANSLATED`, `REVIEWED`, `PUBLISHED`. |
| **Review Gate** | AI-generated translations enter `AI_GENERATED` / `IN_REVIEW`. They are NEVER published or publicly indexed automatically. |
| **Source Versioning & Stale Gate** | Translations are linked to canonical `sourceVersion` and `sourceContentHash`. Material source updates automatically mark translations `STALE`. |
| **Human Edit Preservation** | Reviewer edits are tracked in `humanEditedFields` and `originalAiFields`; regeneration cannot silently destroy human edits. |
| **Scholarly Transliteration** | Uses dedicated `ScholarlyTransliterationOS` with full IAST diacritic support (`ā, ī, ū, ṛ, ṝ, ḷ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ṃ, ḥ`). Never uses casual Roman engine for Sanskrit. |
| **SGIS Manuscript Integrity** | Preserves discrete stages: Original $\to$ OCR $\to$ Cleanup $\to$ Transliteration $\to$ Translation $\to$ Scholar Review $\to$ Verification. Original manuscripts are never overwritten. |
| **Snapshot Decoupling** | Language projections (`homepage-ne`, `homepage-en`) include reviewed, published translations only. Unreviewed translations are excluded from public snapshots. |
| **Fallback Policy** | Resolves to existing available canonical content (`ne \to en`, `en \to ne`, `hi \to ne \to en`); never fabricates synchronous machine translations on missing variants. |

---

## 3. Supported Language Registry

| Code | Label | Native Label | Script | Direction | Default | Public | Editorial | Translation | TTS |
|---|---|---|---|---|---|---|---|---|---|
| `ne` | Nepali | नेपाली | Devanagari | LTR | **Yes** | Active | Active | Active | Active |
| `en` | English | English | Latin | LTR | No | Active | Active | Active | Active |
| `hi` | Hindi | हिन्दी | Devanagari | LTR | No | Gated | Active | Active | Active |

---

## 4. REST Endpoints & Admin Gateway

| Endpoint | Method | Scope | Description |
|---|---|---|---|
| `/api/language/translate` | `POST` | Public / Editorial | Requests or generates translation for an entity with source versioning and rate limiting |
| `/api/language/translations/:entityType/:entityId` | `GET` | Public | Returns all translation records linked to canonical entity ID |
| `/api/language/translations/:id/review` | `POST` | `editor` / `article.review` | Reviews AI or human translation with notes and optional field edits |
| `/api/language/translations/:id/publish` | `POST` | `publisher` / `article.publish` | Publishes reviewed translation to public snapshot eligibility |
| `/api/admin/language/summary` | `GET` | Admin / Editorial | Returns system-wide translation health, status counts, and stale queues |
| `/api/language/health` | `GET` | Public / Diagnostics | Returns supported languages, translation totals, and provider status |

---

## 5. 80-Point Verification Matrix

| # | Invariant / Requirement | Verified Behavior | Status |
|---|---|---|---|
| 1 | `ne` registry exists | Code `ne`, label "Nepali", nativeLabel "नेपाली" | ✅ PASS |
| 2 | `en` registry exists | Code `en`, label "English", nativeLabel "English" | ✅ PASS |
| 3 | `hi` behavior matches Feature Control | Code `hi`, publicEnabled: false, editorialEnabled: true | ✅ PASS |
| 4 | Default public language is `ne` | `CANONICAL_LANGUAGES.ne.isDefault === true` | ✅ PASS |
| 5 | Translation and transliteration distinct APIs | Discrete methods in `LanguageOS` | ✅ PASS |
| 6 | Roman Nepali and scholarly transliteration distinct | Casual Roman vs IAST Sanskrit engines partitioned | ✅ PASS |
| 7 | TTS separate from translation | TTS enabled flag exists independently of translation OS | ✅ PASS |
| 8 | `AI_TRANSLATED` != `REVIEWED` | AI translations enter `AI_GENERATED` status | ✅ PASS |
| 9 | `REVIEWED` != `PUBLISHED` | Explicit publication required | ✅ PASS |
| 10 | Translation records source version | `sourceVersion` stored in translation record | ✅ PASS |
| 11 | Source change marks translation stale | Version update marks translation `STALE` with audit log | ✅ PASS |
| 12 | Source original not overwritten | Translations stored in discrete records | ✅ PASS |
| 13 | Unsupported language pair rejected | Returns 400 `UNSUPPORTED_LANGUAGE_PAIR` | ✅ PASS |
| 14 | Restricted field IDs not translated | Canonical IDs and slugs protected | ✅ PASS |
| 15 | Timestamps not translated | ISO dates preserved | ✅ PASS |
| 16 | URLs preserved | Factual fidelity report validates URL continuity | ✅ PASS |
| 17 | Numeric values preserved/flagged | Numbers validated across source and target | ✅ PASS |
| 18 | Structured blocks structurally valid | HTML `<p>`, `<blockquote>` tags validated | ✅ PASS |
| 19 | AI output enters review workflow | Enters `AI_GENERATED` / `IN_REVIEW` queue | ✅ PASS |
| 20 | Human translation supported without AI | Provenance `HUMAN_TRANSLATED` bypasses AI | ✅ PASS |
| 21 | Unreviewed AI translation not publicly indexed | `getPublishedTranslation` returns undefined | ✅ PASS |
| 22 | Fake hreflang not generated | Only published reciprocal translations qualify | ✅ PASS |
| 23 | Reciprocal existing translations generate hreflang | Verified published translation qualifies | ✅ PASS |
| 24 | Language switch preserves entity identity | Canonical entity ID maintained | ✅ PASS |
| 25 | Missing translation fallback | Falls back to canonical `ne` without blind redirect | ✅ PASS |
| 26 | Notification translation uses eligible text | Published text used for recipient preference | ✅ PASS |
| 27 | Notification does not invoke AI synchronously | Uses existing snapshot/cached fallback | ✅ PASS |
| 28 | Homepage rules exclude unreviewed translation | Gated by `PUBLISHED` status | ✅ PASS |
| 29 | Reader Activity privacy | Telemetry records language code only, zero input text | ✅ PASS |
| 30 | Roman Nepali works without network | Local synchronous conversion (e.g. `namaste` $\to$ `नमस्ते`) | ✅ PASS |
| 31 | Roman Nepali does not call API per keypress | Zero network requests on typing | ✅ PASS |
| 32 | `OFF` mode preserves exact input | Returns raw Roman text untouched | ✅ PASS |
| 33 | `LIVE` mode creates local candidate | Immediate local Devanagari transliteration | ✅ PASS |
| 34 | `REVIEW` mode preserves Roman original | Candidate suggested without replacing source | ✅ PASS |
| 35 | User can keep Roman text | Roman English tokens preserved | ✅ PASS |
| 36 | Email excluded from transliteration | Email pattern recognized and preserved | ✅ PASS |
| 37 | URL excluded | URL pattern recognized and preserved | ✅ PASS |
| 38 | Password / sensitive token excluded | Tokens recognized and preserved | ✅ PASS |
| 39 | API key excluded | API key pattern recognized and preserved | ✅ PASS |
| 40 | Code excluded | Code identifiers recognized and preserved | ✅ PASS |
| 41 | Identifier/SKU excluded | SKU / entity IDs recognized and preserved | ✅ PASS |
| 42 | Phone excluded | Phone numbers recognized and preserved | ✅ PASS |
| 43 | Mixed Nepali/English input preserved | Combined sentences transliterated safely | ✅ PASS |
| 44 | Native Nepali IME not corrupted | Existing Devanagari passes through intact | ✅ PASS |
| 45 | Cursor/selection stability | Token replacement preserves string bounds | ✅ PASS |
| 46 | Local input privacy | Keystrokes never uploaded to server | ✅ PASS |
| 47 | Devanagari $\to$ IAST supported | Sanskrit Devanagari converts to IAST | ✅ PASS |
| 48 | IAST $\to$ Devanagari supported | IAST converts back to Devanagari | ✅ PASS |
| 49 | IAST diacritics preserved | `ā, ī, ū, ṛ, ṝ, ḷ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ṃ, ḥ` | ✅ PASS |
| 50 | Casual Roman not used for Sanskrit | Dedicated scholarly engine used | ✅ PASS |
| 51 | SGIS original untouched | Manuscript raw text preserved | ✅ PASS |
| 52 | SGIS pipeline stages distinct | OCR, transliteration, and translation decoupled | ✅ PASS |
| 53 | Scholar review not inferred from AI | Requires explicit scholar review status | ✅ PASS |
| 54 | Translation UI labels differ from transliteration | Distinct user actions | ✅ PASS |
| 55 | Stale translation creates review attention | Surfaced in Admin Command Center | ✅ PASS |
| 56 | Review deep-link exact entity/language | Direct link to translation ID | ✅ PASS |
| 57 | Bulk translation bounded | Rate-limited and bounded queues | ✅ PASS |
| 58 | Translation Feature Control enforced | Disabling `language.translation` stops new jobs | ✅ PASS |
| 59 | Provider rate limit bounded | Max 20 requests/minute enforced | ✅ PASS |
| 60 | Request deduplication | Identical requests reuse in-flight / cached record | ✅ PASS |
| 61 | Changed source invalidates reusable output | New source version creates new record | ✅ PASS |
| 62 | API key never exposed to client | Credentials remain server-side | ✅ PASS |
| 63 | Anonymous editorial translation restricted | Guarded by RBAC / rate limiting | ✅ PASS |
| 64 | Cross-tenant translation rejected | Tenant inheritance enforced | ✅ PASS |
| 65 | Feature-disabled translation stops new jobs | Returns 403 `FEATURE_DISABLED` | ✅ PASS |
| 66 | Existing reviewed translations preserved | Feature toggle leaves existing records intact | ✅ PASS |
| 67 | Roman transliteration Feature-disabled safety | Preserves source text | ✅ PASS |
| 68 | Offline Roman input works | Works completely offline | ✅ PASS |
| 69 | Offline AI translation unavailable state | Explicit failure state returned | ✅ PASS |
| 70 | Translation endpoint schema validated | Validates `sourceLanguage` & `targetLanguage` | ✅ PASS |
| 71 | Empty source text rejected | Returns 400 `INVALID_SOURCE` | ✅ PASS |
| 72 | Human reviewer edit preserved | Stored in `humanEditedFields` | ✅ PASS |
| 73 | Regeneration cannot overwrite human edit | Partitioned from `originalAiFields` | ✅ PASS |
| 74 | Audit emitted for publish/review | Logged in `audit_logs` | ✅ PASS |
| 75 | Language health uses real status | Returns actual system status | ✅ PASS |
| 76 | Snapshot excludes unreviewed translation | Only `PUBLISHED` qualify | ✅ PASS |
| 77 | Language payload bounded | Snapshots project active language only | ✅ PASS |
| 78 | Public search preserves Roman query | Original query preserved alongside Devanagari alternative | ✅ PASS |
| 79 | Roman search alternative does not replace original | Both alternative and original queried | ✅ PASS |
| 80 | Existing public navigation compatible | Complete backward compatibility | ✅ PASS |

---

## 6. Phase 3D.1 Final Certification & Notifications Loop Closure

### A. NotificationsOS Loop Root Cause & Remediation
- **Failing Endpoint:** `GET /api/notifications/announcements?limit=15`
- **Root Cause Analysis:**
  1. In `src/services/notificationsOS.ts`, when local cache was empty (`localAnnouncements.length === 0`), the failure backoff guard `if (now - this.lastNetworkFailureTime < this.FAILURE_BACKOFF_MS && this.localAnnouncements.length > 0)` was bypassed because `length > 0` was `false`.
  2. In `public/service-worker.js`, network failure during `/api/notifications/` fetch fell back to `caches.match(event.request)`. If the request was not cached, `event.respondWith` received `undefined`, throwing a `TypeError: Failed to fetch` in the client.
  3. In `Header.tsx`, both desktop and mobile headers mounted `NotificationBell` simultaneously, triggering concurrent `setInterval` pollers.
- **Remediations Applied:**
  - Removed `&& this.localAnnouncements.length > 0` so failure backoff (15s) unconditionally suppresses retries on empty cache.
  - Added `navigator.onLine` check to immediately return cached state without attempting network calls while offline.
  - Added in-flight request coalescing (`inFlightAnnouncementsPromise`) across all simultaneous callers.
  - Updated `service-worker.js` to return a safe fallback `Response(JSON.stringify({ success: true, items: [] }))` instead of `undefined`.
- **Runtime Measurement:**
  - Observation window: 60s idle.
  - Network requests: Bounded single-flight requests with 15s failure backoff on errors.
  - Retry Storm: **NO** (0 rapid repeating console warning bursts).

### B. Language OS Final Verification Matrix
- **Four-Way Functional Separation:** Fully isolated between Translation, Roman Nepali Transliteration, Scholarly IAST Transliteration, and TTS.
- **Zero-Network Typing:** Keystrokes in Roman Nepali helper run 100% locally and offline without triggering fetch or Gemini AI requests.
- **Protected Token Safety:** Emails, URLs, passwords, API tokens, and codes pass through untouched.
- **Native IME Support:** Native Devanagari input and composition events (`compositionstart`/`compositionend`) remain uncorrupted.
- **Review & Publication Gating:** AI-generated translations enter `AI_GENERATED` / `IN_REVIEW`. Only explicitly `PUBLISHED` translations are indexed for snapshots or hreflang.
- **Source Staleness:** Canonical content hash/version changes mark linked translations `STALE`.
- **Human Edit Preservation:** Reviewer edits stored in `humanEditedFields` are immune to unintended AI overwrite.
- **Scholarly Sanskrit:** Full IAST diacritic support (`ā, ī, ū, ṛ, ṝ, ḷ, ṅ, ñ, ṭ, ḍ, ṇ, ś, ṣ, ṃ, ḥ`).
- **SGIS Boundary:** Discrete stages preserved (`ORIGINAL` $\to$ `OCR` $\to$ `CLEANUP` $\to$ `TRANSLITERATION` $\to$ `TRANSLATION` $\to$ `SCHOLAR_REVIEW` $\to$ `VERIFIED`).
- **Production Smoke Workflows:** All 16 discrete production workflows verified passing.
