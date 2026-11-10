# SANATANMARGA 5.0 BETA — PHASE 3G ARCHITECTURAL SPECIFICATION
## Developer & Infrastructure OS: API Platform, Webhooks, Telemetry, System Diagnostics & SEC-05

### 1. Architectural Overview
Phase 3G establishes the **Developer & Infrastructure OS** for SanatanMarga 5.0 Beta. It provides a server-authoritative, tenant-isolated developer platform enabling partner institutions, mobile apps, regional desks, and third-party integrations to exchange data securely via scoped REST APIs and signed Webhook events while giving platform administrators real-time system diagnostic visibility and telemetry.

Core capabilities:
- **Developer API Key Platform**: HMAC SHA-256 hashed secret keys (`sk_sutra_...`) with scope-based authorization (`articles:read`, `knowledge:query`, `community:write`, `fcm:push`, `webhooks:manage`, `telemetry:read`), per-key rate limiting, key rotation, and instant revocation.
- **Webhook Dispatcher Engine**: Event subscription management, payload generation, HMAC-SHA256 event signatures (`X-Sanatan-Signature`), retry policies, and audited delivery logs.
- **Infrastructure Health Scorecard & Diagnostic Probes**: Real-time non-destructive health checks across Firestore Gateway (Circuit Breaker state), Snapshot OS, Cloudflare R2 Storage, FCM Push Gateway, Feature Control, Sync OS, and Developer OS.
- **OpenAPI 3.0 Documentation**: Dynamic schema generation for API integration and client generation.
- **SEC-05 Compliance**: Multi-tenant isolation ensuring tenant administrators can only access and manage developer credentials and webhooks scoped to their own workspace.

---

### 2. Canonical Data Models

#### Developer API Key Model
```typescript
interface DeveloperApiKey {
  id: string;
  tenantId: string;
  keyName: string;
  keyPrefix: string; // e.g., "sk_sutra_live_9a8f..."
  secretHash?: string; // Redacted in responses
  scopes: DeveloperApiKeyScope[];
  status: "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
  rateLimitRpm: number;
  rateLimitDaily: number;
  requestsCountToday: number;
  requestsTotal: number;
  createdAt: string;
  lastUsedAt?: string;
  lastUsedIp?: string;
  expiresAt?: string;
  createdBy: string;
}
```

#### Webhook Model
```typescript
interface DeveloperWebhook {
  id: string;
  tenantId: string;
  name: string;
  targetUrl: string;
  secret: string; // HMAC signing secret
  events: DeveloperWebhookEvent[];
  status: "ACTIVE" | "PAUSED" | "DISABLED" | "FAILED_DISABLED";
  failureCount: number;
  lastTriggeredAt?: string;
  lastResponseCode?: number;
  createdAt: string;
  createdBy: string;
}
```

---

### 3. API Endpoints

- `GET /api/developer/keys` — List API keys for tenant
- `POST /api/developer/keys` — Create new API key (returns rawSecret ONCE)
- `POST /api/developer/keys/:keyId/revoke` — Instantly revoke API key
- `POST /api/developer/keys/:keyId/rotate` — Rotate key (revokes old key, issues new secret)
- `GET /api/developer/webhooks` — List tenant webhooks
- `POST /api/developer/webhooks` — Register new webhook listener
- `DELETE /api/developer/webhooks/:webhookId` — Remove webhook configuration
- `GET /api/developer/health` — Retrieve system health scorecard
- `POST /api/developer/diagnostics/run` — Run diagnostic probes
- `GET /api/developer/docs` — Retrieve OpenAPI 3.0 specification
- `GET /api/developer/audit` — Retrieve developer operation audit logs

---

### 4. Verification & Certification

- **100-Point Specification Suite**: `npx tsx tests/phase3g-developer-infrastructure-os.ts` -> **PASSED**
- **Production Smoke Suite**: `npx tsx tests/phase3g-production-smoke.ts` -> **PASSED**
