# SANATANMARGA 5.0 BETA — PHASE 3F ARCHITECTURAL SPECIFICATION
## Tenant Operations, Boundaries, Memberships, Multi-Tenant IAM & SEC-05

### 1. Architectural Philosophy
SanatanMarga 5.0 implements a lean, server-authoritative multi-tenant architecture designed to host partner institutions (schools, gurukuls, cultural trusts, regional media desks, and municipalities) while protecting the integrity and sovereignty of the primary platform workspace (`sanatan-media`).

Core distinctions:
- **TENANT != USER != ROLE != GLOBAL IAM != FEATURE != WORKSPACE != BRAND**
- **Server Authority**: Client React context (`TenantProvider` / `useTenant`) controls UI navigation perspectives only. All tenant-scoped operations validate authenticated credentials and active membership server-side.
- **Global vs. Tenant Roles**: A user with `editor` or `tenant_admin` status inside Tenant A holds operational authority strictly inside Tenant A and cannot perform actions in Tenant B or elevate to platform `super_admin`.

---

### 2. Canonical Data Models

#### Tenant Model
```typescript
interface Tenant {
  id: string; // Canonical immutable ID (e.g. "sanatan-media")
  slug: string;
  code?: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED" | "ARCHIVED";
  type: "PLATFORM" | "MEDIA" | "PARTNER" | "INSTITUTION" | "CLIENT";
  branding?: TenantBranding;
  settings: TenantSettings;
  enabledModules: string[];
  configurationVersion: number;
  tenantSecurityVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
```

#### Tenant Membership Model
```typescript
interface TenantMembership {
  id?: string; // `${tenantId}_${uid}`
  tenantId: string;
  uid: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
  roles: string[]; // e.g. ["tenant_admin", "editor", "contributor"]
  permissions?: string[];
  joinedAt: string;
  updatedAt: string;
  invitedBy?: string;
}
```

---

### 3. Key Invariants & Guarantees
1. **Last Tenant Admin Protection**: A tenant's sole remaining active administrator cannot be demoted or removed without first assigning an active successor.
2. **Settings Version Concurrency**: Settings mutations require matching `expectedVersion` against `configurationVersion` to prevent stale overwrites (rejecting conflicts with HTTP 409).
3. **Partitioned Cache Isolation**: Client caches are keyed by `(uid, tenantId)` so private workspace data never leaks when switching tenants.
4. **Feature Control Gating**: Tenant-level feature overrides cannot enable globally disabled features (`direct === 'off'` remains strictly disabled).
5. **No Global Snapshot Scans**: Tenant directory and membership listings are paginated and bounded.

---

### 4. SEC-05 Verification Matrix

| Collection | Tenant Scope | Rules Verified | Server Verified | Migration Status | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `articles` | TENANT_REQUIRED | VERIFIED | VERIFIED | MAPPED (`sanatan-media`) | PASS |
| `categories` | GLOBAL_ONLY / OPTIONAL | VERIFIED | VERIFIED | MAPPED | PASS |
| `mediaAssets` | TENANT_REQUIRED | VERIFIED | VERIFIED | MAPPED | PASS |
| `comments` | TENANT_SCOPED | VERIFIED | VERIFIED | MAPPED | PASS |
| `communityPosts` | PUBLIC_SHARED | VERIFIED | VERIFIED | MAPPED | PASS |
| `academyCourses` | OPTIONAL_TENANT | VERIFIED | VERIFIED | MAPPED | PASS |
| `knowledge_base` | GLOBAL_ONLY | VERIFIED | VERIFIED | CANONICAL_GLOBAL | PASS |
| `events` | OPTIONAL_TENANT | VERIFIED | VERIFIED | MAPPED | PASS |
| `ads` | TENANT_REQUIRED | VERIFIED | VERIFIED | MAPPED | PASS |
| `sponsorships` | TENANT_REQUIRED | VERIFIED | VERIFIED | MAPPED | PASS |
| `notifications` | USER_PRIVATE / TENANT | VERIFIED | VERIFIED | USER_SCOPED | PASS |
| `reader_activity` | USER_PRIVATE | VERIFIED | VERIFIED | USER_SCOPED | PASS |
| `translations` | TENANT_DERIVED | VERIFIED | VERIFIED | ENTITY_ALIGNED | PASS |
| `homepage_compositions`| TENANT_SCOPED | VERIFIED | VERIFIED | VERSIONED | PASS |
| `backups` | SECURITY_ONLY | VERIFIED | VERIFIED | REDACTED | PASS |

---

### 5. API Endpoints
- `GET /api/me/tenants` — List caller's accessible tenant memberships
- `GET /api/tenants` — Platform admin tenant directory (paginated)
- `POST /api/tenants` — Create new tenant (Platform admin only)
- `GET /api/tenants/:id` — Get single tenant detail
- `PATCH /api/tenants/:id` — Update tenant settings (with version check)
- `POST /api/tenants/:id/status` — Update tenant lifecycle status
- `GET /api/tenants/:id/members` — List tenant members
- `POST /api/tenants/:id/members` — Add or invite member
- `DELETE /api/tenants/:id/members/:uid` — Remove member (last-admin protected)
- `GET /api/tenants/:id/health` — Diagnostic scorecard and orphan check
