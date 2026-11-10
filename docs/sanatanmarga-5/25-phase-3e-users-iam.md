# SANATANMARGA 5.0 BETA — PHASE 3E ARCHITECTURE DOCUMENTATION
## Users, Staff, IAM & Multi-Role Governance OS

### 1. Architectural Overview & Authority Separation
SanatanMarga 5.0 Beta establishes an uncompromising separation of authority:
- **Identity Proof:** Handled exclusively by Firebase Authentication (`verifyIdToken(token, true)` on server).
- **Security & Authorization Authority:** Handled exclusively by the Canonical IAM Store (`ServerIamOS` and Firestore `users` collection).
- **Custom Claims:** Bounded advisory projection/cache only. Never a competing authority. If a token presents stale custom claims that contradict the canonical IAM record, the canonical IAM store and `securityVersion` take precedence and deny stale privilege.

### 2. Canonical User & Role Model
The canonical identity is the Firebase UID (`uid`). 
- **Roles:**
  - `guest` (rank 10)
  - `reader` / `member` (rank 20)
  - `contributor` (rank 30)
  - `reporter` (rank 40)
  - `editor` (rank 50)
  - `senior_editor` (rank 60)
  - `admin` (rank 80)
  - `super_admin` (rank 100)
- **Default Role:** All newly registered users receive `member` with unprivileged read-only rights.
- **Bootstrap Superadmin Invariant:** An initial superadmin bootstrap email (`sagarrana@gmail.com`) is only granted `super_admin` during zero-superadmin initialization. In normal runtime (when at least one superadmin exists), signing up with ANY email yields `member`. No email string acts as a permanent runtime bypass.

### 3. Permissions Matrix & Evaluator
- Single source of truth: `CANONICAL_PERMISSIONS_REGISTRY` (in `server/iamOs.ts`) and `ROLE_DEFINITIONS` (in `src/constants/permissions.ts`).
- Effective permissions resolver computes: `(Role Inherited Permissions) + (Known Canonical Custom Permissions) - (Explicit DENYs starting with '-')`.
- **Fail-Closed Unknown Permissions:** Any unrecognized permission key or malformed wildcard (`admin.*`, `system.*`, `*`) in custom permissions is rejected. Only `super_admin` has governed root wildcard capability.

### 4. Field Mutation Policy & Self-Escalation Prevention
`PATCH /api/me/profile` strictly allowlists `USER_EDITABLE` fields:
- Allowed: `displayName`, `photoURL`, `bio`, `district`, `location`, `website`, `socialLinks`, `primaryLanguage`, `publicProfileVisibility`, `notificationPreferences`.
- Strictly Rejected / Ignored: `role`, `roles`, `customPermissions`, `status`, `securityVersion`, `tenantMemberships`, `uid`, `createdAt`.
- Any attempt to mutate privileged fields logs an audit event (`AUDIT_UNAUTHORIZED_PROFILE_FIELD_MUTATION_ATTEMPT`) and mutates zero security attributes.

### 5. Account Restrictions & Token Revocation
- **Immediate Denial:** When an account is marked `DISABLED` or `BANNED`, `authenticateRequestUser` immediately revokes all active capabilities, zeroes effective permissions, and blocks protected endpoints. The system does NOT wait for token expiration.
- **Security Versioning:** `securityVersion` increments on role changes, account status changes, and session revocations. Tokens with older security versions are detected as stale.
- **Last-Superadmin Invariant:** The last remaining active `super_admin` cannot be demoted, banned, disabled, or deleted.

### 6. Session Operations & Privacy
- **IP Privacy:** Raw IP addresses are NOT persisted in `UserSession`.
- **Minimized Device Metadata:** Only coarse labels (`deviceClass`, `clientLabel`, `userAgentSummary`) are stored. No hardware or canvas fingerprinting.
- **Session Revocation:** Per-session revocation (`revokeSingleSession`) and user-wide revocation (`revokeAllUserSessions`) are supported with immediate timestamp and security version invalidation.

### 7. Feature Control Integration
Privileged IAM operations fail closed if the canonical feature (`core.auth`) is disabled or in an unresolved state (`HTTP 503 FEATURE_DISABLED`).

### 8. Endpoints Specification
- `GET /api/me` — Current user profile and capability projection
- `PATCH /api/me/profile` — User-editable profile fields update
- `GET /api/me/security` — Security state and active session count
- `GET /api/me/sessions` — User active session list
- `POST /api/me/sessions/revoke-all` — Self-service session revocation
- `GET /api/admin/users` — Paginated and bounded user directory search
- `GET /api/admin/users/:uid` — Administrative detail view
- `PATCH /api/admin/users/:uid/status` — Status mutation (enforces last-superadmin invariant)
- `POST /api/admin/users/:uid/roles` — Role assignment (enforces superadmin elevation gate)
- `DELETE /api/admin/users/:uid/roles/:role` — Role removal (enforces last-superadmin invariant)
- `POST /api/admin/users/:uid/revoke-sessions` — Administrative session revocation
- `GET /api/admin/iam/health` — IAM health telemetry
- `GET /api/admin/iam/roles` — Canonical role definitions
- `GET /api/admin/iam/permissions` — Canonical permission definitions
- `POST /api/admin/iam/reconcile` — Auth/profile reconciliation diagnostic

### 9. CANONICAL REGRESSION BASELINE AS OF PHASE 3E

#### Counting Definitions
- **SPECIFICATION RULE:** One canonical behavioral item reported and evaluated by the test suite.
- **RAW ASSERTION:** Individual `assert()`, `expect()`, or equivalent checks inside rules.
- **SMOKE WORKFLOW:** One end-to-end multi-step scenario verified in a production-like environment.

#### Canonical Specification Suites (15 Suites)
1. `tests/phase1a-security-safety.ts`: **26 passed, 0 failed, 1 unverified** (exit code 0)
   - *Deferred Item:* Full database-level multi-tenant collection isolation (SEC-05) — Classified as `LIVE_INFRASTRUCTURE_REQUIRED` / `ENVIRONMENT_DEPENDENT`
2. `tests/phase1b-gateway-quota.ts`: **32 passed, 0 failed** (exit code 0)
3. `tests/phase1d-syncos.ts`: **21 passed, 0 failed** (exit code 0)
4. `tests/phase1e-feature-control.ts`: **50 passed, 0 failed** (exit code 0)
5. `tests/phase2a-snapshot-os.ts`: **29 passed, 0 failed** (exit code 0)
6. `tests/phase2a3-route-resolution.ts`: **15 passed, 0 failed** (exit code 0)
7. `tests/phase2b-disaster-recovery.ts`: **45 passed, 0 failed** (exit code 0)
8. `tests/phase2c-seo-discovery.ts`: **50 passed, 0 failed** (exit code 0)
9. `tests/phase2d-media-integrity.ts`: **50 passed, 0 failed** (exit code 0)
10. `tests/phase2e-admin-command-center.ts`: **60 passed, 0 failed** (exit code 0)
11. `tests/phase3a-notifications-os.ts`: **50 passed, 0 failed** (exit code 0)
12. `tests/phase3b-composition-os.ts`: **74 passed, 0 failed** (exit code 0)
13. `tests/phase3c-reader-audience-os.ts`: **70 passed, 0 failed** (exit code 0)
14. `tests/phase3d-language-os.ts`: **80 passed, 0 failed** (exit code 0)
15. `tests/phase3e-users-iam.ts`: **90 passed, 0 failed** (exit code 0)

**CANONICAL SPECIFICATION RULE TOTAL: 742 Passed, 0 Failed (100% passing)**

#### Canonical Production Smoke Suites (5 Suites)
1. `tests/phase2c1-certification-smoke.ts`: **22 passed**
2. `tests/phase3b-production-smoke.ts`: **13 passed**
3. `tests/phase3c-production-smoke.ts`: **7 passed**
4. `tests/phase3d-production-smoke.ts`: **16 passed**
5. `tests/phase3e-production-smoke.ts`: **16 passed**

**CANONICAL SMOKE BASELINE: 74 / 74 Workflows Passed (100% passing)**

