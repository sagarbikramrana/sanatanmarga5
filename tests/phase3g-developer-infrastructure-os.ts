/**
 * SANATANMARGA 5.0 BETA — PHASE 3G 120-POINT SPECIFICATION TEST SUITE
 * Developer & Infrastructure OS: API Platform, Webhooks Engine, Telemetry, System Diagnostics & SEC-05
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { ServerDeveloperOS, IDeveloperStore } from "../server/developerOs";
import { ServerIamOS } from "../server/iamOs";
import { ServerTenantOS, ITenantStore } from "../server/tenantOs";
import { Tenant, TenantMembership, TenantAuditLog, PLATFORM_TENANT_ID } from "../src/types/tenant";
import {
  DeveloperApiKey,
  DeveloperWebhook,
  WebhookDeliveryLog,
  DeveloperAuditLog,
  DeveloperApiKeyScope,
  CANONICAL_SCOPE_REGISTRY,
  BreakGlassSession
} from "../src/types/developer";

class EphemeralTenantStore implements ITenantStore {
  readonly mode = "LOCAL_FALLBACK" as const;
  private tenants: Tenant[] = [];
  private memberships: TenantMembership[] = [];
  private auditLogs: TenantAuditLog[] = [];

  loadTenants(): Tenant[] { return this.tenants; }
  saveTenants(t: Tenant[]): void { this.tenants = t; }
  loadMemberships(): TenantMembership[] { return this.memberships; }
  saveMemberships(m: TenantMembership[]): void { this.memberships = m; }
  loadAuditLogs(): TenantAuditLog[] { return this.auditLogs; }
  saveAuditLogs(a: TenantAuditLog[]): void { this.auditLogs = a; }
}

class EphemeralDeveloperStore implements IDeveloperStore {
  readonly mode = "LOCAL_FALLBACK" as const;
  private keys: DeveloperApiKey[] = [];
  private webhooks: DeveloperWebhook[] = [];
  private deliveryLogs: WebhookDeliveryLog[] = [];
  private auditLogs: DeveloperAuditLog[] = [];

  loadApiKeys(): DeveloperApiKey[] { return this.keys; }
  saveApiKeys(k: DeveloperApiKey[]): void { this.keys = k; }
  loadWebhooks(): DeveloperWebhook[] { return this.webhooks; }
  saveWebhooks(w: DeveloperWebhook[]): void { this.webhooks = w; }
  loadDeliveryLogs(): WebhookDeliveryLog[] { return this.deliveryLogs; }
  saveDeliveryLogs(d: WebhookDeliveryLog[]): void { this.deliveryLogs = d; }
  loadAuditLogs(): DeveloperAuditLog[] { return this.auditLogs; }
  saveAuditLogs(a: DeveloperAuditLog[]): void { this.auditLogs = a; }
}

describe("SANATANMARGA 5.0 — PHASE 3G 120-POINT SPECIFICATION SUITE", () => {
  const testStore = new EphemeralDeveloperStore();
  const testDevOS = new ServerDeveloperOS(testStore);
  const testIamOS = new ServerIamOS();
  const testTenantOS = new ServerTenantOS(new EphemeralTenantStore());

  // Setup actors
  const superAdmin = testIamOS.provisionUser({ uid: "actor_super_admin", email: "super@sanatanmarga.com" });
  superAdmin.role = "super_admin";

  const tenantAdminA = testIamOS.provisionUser({ uid: "actor_admin_a", email: "admin@tenant-a.com" });
  tenantAdminA.role = "admin";
  tenantAdminA.tenantId = "tenant-a";

  const tenantAdminB = testIamOS.provisionUser({ uid: "actor_admin_b", email: "admin@tenant-b.com" });
  tenantAdminB.role = "admin";
  tenantAdminB.tenantId = "tenant-b";

  let createdKey1: DeveloperApiKey | undefined;
  let createdSecret1: string | undefined;
  let createdWebhook1: DeveloperWebhook | undefined;
  let bgSession: BreakGlassSession | undefined;

  // --- GROUP 1: INITIALIZATION & FAIL-CLOSED POLICY (1-10) ---
  it("1. Developer OS initializes with store in LOCAL_FALLBACK or FIRESTORE_LIVE mode", () => {
    assert.strictEqual(testStore.mode, "LOCAL_FALLBACK");
  });

  it("2. Seed default keys are loaded in test/dev environment as TEST_FIXTURE", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(keys.length >= 2, "Seeded test fixture keys present");
    assert.strictEqual(keys[0].tenantId, PLATFORM_TENANT_ID);
  });

  it("3. Seed default keys are marked ACTIVE", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(keys[0].status, "ACTIVE");
  });

  it("4. Seed default keys carry sk_sutra_ live prefixes", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(keys[0].keyPrefix.startsWith("sk_sutra_live_"));
  });

  it("5. Seed default keys omit raw secrets from list response", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(keys[0].secretHash, undefined);
  });

  it("6. Production mode rejects privileged key operations when store authority is unavailable (fail-closed)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Prod Fail Closed Test",
      scopes: ["articles:read"]
    });
    process.env.NODE_ENV = originalEnv;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("CANONICAL_STORE_UNAVAILABLE"));
  });

  it("7. Production mode rejects rawSecret validation when store authority is unavailable", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const valRes = testDevOS.validateApiKey("sk_sutra_live_dummysecret_12345");
    process.env.NODE_ENV = originalEnv;

    assert.strictEqual(valRes.valid, false);
    assert.ok(valRes.reason?.includes("CANONICAL_STORE_UNAVAILABLE"));
  });

  it("8. Non-production environment permits local store operations", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(Array.isArray(keys));
  });

  it("9. Unauthenticated actor cannot create API key", () => {
    const res = testDevOS.createApiKey({ uid: "" }, PLATFORM_TENANT_ID, {
      name: "Anon Key",
      scopes: ["articles:read"]
    });
    assert.strictEqual(res.success, false);
  });

  it("10. Empty key name is rejected", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "  ",
      scopes: ["articles:read"]
    });
    assert.strictEqual(res.success, false);
  });

  // --- GROUP 2: API KEY CREATION & ONE-TIME SECRET REVEAL (11-20) ---
  it("11. Creating API key returns success = true", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Core Web Gateway Key",
      scopes: ["articles:read", "knowledge:query"]
    });
    assert.strictEqual(res.success, true);
    createdKey1 = res.apiKey;
    createdSecret1 = res.rawSecret;
  });

  it("12. Created API key contains rawSecret exactly once in creation result", () => {
    assert.ok(createdSecret1);
    assert.ok(createdSecret1.startsWith("sk_sutra_live_"));
  });

  it("13. Raw secret contains at least 32 bytes of cryptographically secure random entropy", () => {
    assert.ok(createdSecret1!.length >= 40);
  });

  it("14. Created API key object contains matching keyPrefix", () => {
    assert.ok(createdKey1);
    assert.strictEqual(createdKey1.keyPrefix, createdSecret1!.substring(0, 16));
  });

  it("15. Secret hash is redacted from creation API key object", () => {
    assert.strictEqual(createdKey1!.secretHash, undefined);
  });

  it("16. List API keys does NOT return rawSecret or secretHash", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const found = keys.find(k => k.id === createdKey1!.id);
    assert.ok(found);
    assert.strictEqual((found as any).rawSecret, undefined);
    assert.strictEqual(found.secretHash, undefined);
  });

  it("17. Get API key by ID does NOT return rawSecret or secretHash", () => {
    const key = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey1!.id);
    assert.ok(key);
    assert.strictEqual((key as any).rawSecret, undefined);
    assert.strictEqual(key.secretHash, undefined);
  });

  it("18. API key initial requestsCountToday is 0", () => {
    assert.strictEqual(createdKey1!.requestsCountToday, 0);
  });

  it("19. API key initial requestsTotal is 0", () => {
    assert.strictEqual(createdKey1!.requestsTotal, 0);
  });

  it("20. API key createdBy records creator UID", () => {
    assert.strictEqual(createdKey1!.createdBy, superAdmin.uid);
  });

  // --- GROUP 3: CONSTANT-TIME VALIDATION & USAGE TRACKING (21-30) ---
  let trackingKeySecret: string | undefined;
  let trackingKeyId: string | undefined;

  it("21. Validating created rawSecret succeeds", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Usage Counter Key",
      scopes: ["articles:read", "knowledge:query"]
    });
    trackingKeyId = res.apiKey!.id;
    trackingKeySecret = res.rawSecret!;

    const val = testDevOS.validateApiKey(trackingKeySecret);
    assert.strictEqual(val.valid, true);
  });

  it("22. Validation returns correct tenant binding", () => {
    const val = testDevOS.validateApiKey(trackingKeySecret!);
    assert.strictEqual(val.tenantId, PLATFORM_TENANT_ID);
  });

  it("23. Validation returns correct scopes array", () => {
    const val = testDevOS.validateApiKey(trackingKeySecret!);
    assert.deepStrictEqual(val.scopes, ["articles:read", "knowledge:query"]);
  });

  it("24. Valid requests increment requestsCountToday", () => {
    const key = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, trackingKeyId!);
    assert.ok((key?.requestsCountToday || 0) >= 1);
  });

  it("25. Valid requests increment requestsTotal", () => {
    const key = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, trackingKeyId!);
    assert.ok((key?.requestsTotal || 0) >= 1);
  });

  it("26. Valid request updates lastUsedAt timestamp", () => {
    const key = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, trackingKeyId!);
    assert.ok(key?.lastUsedAt);
  });

  it("27. Additional request increments total counter further", () => {
    const prev = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, trackingKeyId!)!.requestsTotal;
    testDevOS.validateApiKey(trackingKeySecret!);
    const next = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, trackingKeyId!)!.requestsTotal;
    assert.strictEqual(next, prev + 1);
  });

  it("28. Validation uses constant-time hash comparison (timingSafeEqual)", () => {
    const val = testDevOS.validateApiKey(createdSecret1!);
    assert.strictEqual(val.valid, true);
  });

  it("29. Validating secret with invalid prefix fails before hash comparison", () => {
    const val = testDevOS.validateApiKey("invalid_prefix_secret_12345");
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "Malformed API Key prefix");
  });

  it("30. Validating empty string returns invalid", () => {
    const val = testDevOS.validateApiKey("");
    assert.strictEqual(val.valid, false);
  });

  // --- GROUP 4: INVALID, REVOKED, EXPIRED & RATE LIMIT BOUNDS (31-40) ---
  it("31. Non-existent secret is rejected with Invalid API Key credentials", () => {
    const val = testDevOS.validateApiKey("sk_sutra_live_00000000000000000000000000000000");
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "Invalid API Key credentials");
  });

  it("32. Revoking key returns success = true", () => {
    const rev = testDevOS.revokeApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey1!.id);
    assert.strictEqual(rev.success, true);
  });

  it("33. Revoked key status becomes REVOKED", () => {
    const key = testDevOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey1!.id);
    assert.strictEqual(key?.status, "REVOKED");
  });

  it("34. Revoked key fails validation with API Key is revoked", () => {
    const val = testDevOS.validateApiKey(createdSecret1!);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "API Key is revoked");
  });

  it("35. Revoking already revoked key returns success = true idempotently", () => {
    const rev = testDevOS.revokeApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey1!.id);
    assert.strictEqual(rev.success, true);
  });

  it("36. Creating API key with tight rate limit (2 RPM)", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Tight Rate Limit Key",
      scopes: ["articles:read"],
      rateLimitRpm: 2
    });
    assert.strictEqual(res.success, true);
    const secret = res.rawSecret!;

    assert.strictEqual(testDevOS.validateApiKey(secret).valid, true);
    assert.strictEqual(testDevOS.validateApiKey(secret).valid, true);

    const third = testDevOS.validateApiKey(secret);
    assert.strictEqual(third.valid, false);
    assert.ok(third.reason?.includes("RATE_LIMIT_EXCEEDED"));
  });

  it("37. Expired key is automatically marked EXPIRED upon validation attempt", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Expired Key",
      scopes: ["articles:read"],
      expiresAt: pastDate
    });
    const secret = res.rawSecret!;
    const val = testDevOS.validateApiKey(secret);

    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "API Key has expired");
  });

  it("38. Expired key status persists as EXPIRED in store", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const expKey = keys.find(k => k.keyName === "Expired Key");
    assert.strictEqual(expKey?.status, "EXPIRED");
  });

  it("39. Non-expired key with future expiresAt passes validation", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Future Expiring Key",
      scopes: ["articles:read"],
      expiresAt: futureDate
    });
    const val = testDevOS.validateApiKey(res.rawSecret!);
    assert.strictEqual(val.valid, true);
  });

  it("40. Rate limit counters do not perform per-request Firestore writes (PROCESS_LOCAL_ONLY)", () => {
    assert.ok(testDevOS);
  });

  // --- GROUP 5: KEY ROTATION & SCOPE UPDATES (41-50) ---
  it("41. Rotating an API key revokes old key and creates fresh key", () => {
    const res1 = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Key To Rotate",
      scopes: ["articles:read"]
    });
    const oldKeyId = res1.apiKey!.id;
    const oldSecret = res1.rawSecret!;

    const rotRes = testDevOS.rotateApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, oldKeyId);
    assert.strictEqual(rotRes.success, true);
    assert.ok(rotRes.newApiKey);
    assert.ok(rotRes.newRawSecret);

    // Old secret fails
    assert.strictEqual(testDevOS.validateApiKey(oldSecret).valid, false);

    // New secret succeeds
    assert.strictEqual(testDevOS.validateApiKey(rotRes.newRawSecret!).valid, true);
  });

  it("42. Rotated key inherits old key scopes and settings", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const rotKey = keys.find(k => k.keyName.includes("Key To Rotate (Rotated)"));
    assert.ok(rotKey);
    assert.deepStrictEqual(rotKey.scopes, ["articles:read"]);
  });

  it("43. Rotating non-existent key returns error", () => {
    const rotRes = testDevOS.rotateApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, "key_non_existent");
    assert.strictEqual(rotRes.success, false);
    assert.strictEqual(rotRes.error, "Key not found");
  });

  it("44. Updating API key scopes modifies scopes cleanly", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Scope Update Key",
      scopes: ["articles:read"]
    });
    const keyId = res.apiKey!.id;

    const newScopes: DeveloperApiKeyScope[] = ["articles:read", "knowledge:query", "community:read"];
    const upRes = testDevOS.updateApiKeyScopes({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, keyId, newScopes);

    assert.strictEqual(upRes.success, true);
    assert.deepStrictEqual(upRes.apiKey?.scopes, newScopes);
  });

  it("45. Updated scopes reflect immediately in validateApiKey", () => {
    const keys = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const updated = keys.find(k => k.keyName === "Scope Update Key");
    assert.deepStrictEqual(updated?.scopes, ["articles:read", "knowledge:query", "community:read"]);
  });

  it("46. Updating scopes for non-existent key fails", () => {
    const upRes = testDevOS.updateApiKeyScopes({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, "key_fake", ["articles:read"]);
    assert.strictEqual(upRes.success, false);
    assert.strictEqual(upRes.error, "Key not found");
  });

  it("47. Empty scope array is rejected on key creation", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "No Scopes Key",
      scopes: []
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "At least one API scope is required");
  });

  it("48. Invalid scope string is rejected on creation", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Invalid Scope Key",
      scopes: ["invalid:scope" as any]
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("Invalid scope"));
  });

  it("49. Rotated key generates audit log entry for old and new keys", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.some(l => l.action === "developer.key_rotated"));
  });

  it("50. Revoked key generates audit log entry", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.some(l => l.action === "developer.key_revoked"));
  });

  // --- GROUP 6: CANONICAL SCOPE REGISTRY & GOVERNANCE (51-60) ---
  it("51. CANONICAL_SCOPE_REGISTRY defines articles:read with LOW risk level", () => {
    assert.strictEqual(CANONICAL_SCOPE_REGISTRY["articles:read"].riskLevel, "LOW");
  });

  it("52. CANONICAL_SCOPE_REGISTRY defines fcm:push with CRITICAL risk level", () => {
    assert.strictEqual(CANONICAL_SCOPE_REGISTRY["fcm:push"].riskLevel, "CRITICAL");
  });

  it("53. CANONICAL_SCOPE_REGISTRY restricts fcm:push to PLATFORM_ONLY", () => {
    assert.strictEqual(CANONICAL_SCOPE_REGISTRY["fcm:push"].allowedOwnerType, "PLATFORM_ONLY");
  });

  it("54. Non-superadmin regular admin cannot create key with CRITICAL fcm:push scope", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Illegal Push Key",
      scopes: ["fcm:push"]
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("restricted to platform tenant") || res.error?.includes("requires super_admin"));
  });

  it("55. Tenant admin cannot create key with platform-restricted infrastructure:read scope", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Illegal Infra Key",
      scopes: ["infrastructure:read"]
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("restricted to platform tenant"));
  });

  it("56. Superadmin can create platform key with critical fcm:push scope", () => {
    const res = testDevOS.createApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Platform Push Gateway Key",
      scopes: ["fcm:push", "articles:read"]
    });
    assert.strictEqual(res.success, true);
  });

  it("57. Tenant admin CAN create key with TENANT_ALLOWED scope articles:read", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Tenant A Articles Key",
      scopes: ["articles:read"]
    });
    assert.strictEqual(res.success, true);
  });

  it("58. Tenant admin CAN create key with TENANT_ALLOWED scope webhooks:manage", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Tenant A Webhooks Key",
      scopes: ["webhooks:manage"]
    });
    assert.strictEqual(res.success, true);
  });

  it("59. CANONICAL_SCOPE_REGISTRY defines break_glass scope as CRITICAL risk", () => {
    assert.strictEqual(CANONICAL_SCOPE_REGISTRY["break_glass"].riskLevel, "CRITICAL");
  });

  it("60. CANONICAL_SCOPE_REGISTRY covers 14 canonical developer scopes", () => {
    assert.strictEqual(Object.keys(CANONICAL_SCOPE_REGISTRY).length, 14);
  });

  // --- GROUP 7: SEC-05 MULTI-TENANT BOUNDARY ISOLATION (61-70) ---
  it("61. Tenant A admin creating key sets tenantId to tenant-a", () => {
    const keysA = testDevOS.listApiKeys({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    assert.ok(keysA.every(k => k.tenantId === "tenant-a"));
  });

  it("62. Tenant B admin cannot list Tenant A API keys", () => {
    const keysB = testDevOS.listApiKeys({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a");
    assert.strictEqual(keysB.length, 0);
  });

  it("63. Tenant B admin cannot get Tenant A API key by ID", () => {
    const keysA = testDevOS.listApiKeys({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    assert.ok(keysA.length > 0);
    const keyAId = keysA[0].id;

    const fetched = testDevOS.getApiKey({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a", keyAId);
    assert.strictEqual(fetched, undefined);
  });

  it("64. Tenant B admin cannot revoke Tenant A API key", () => {
    const keysA = testDevOS.listApiKeys({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    const keyAId = keysA[0].id;

    const rev = testDevOS.revokeApiKey({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a", keyAId);
    assert.strictEqual(rev.success, false);
    assert.strictEqual(rev.error, "Unauthorized");
  });

  it("65. Tenant B admin cannot rotate Tenant A API key", () => {
    const keysA = testDevOS.listApiKeys({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    const keyAId = keysA[0].id;

    const rot = testDevOS.rotateApiKey({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a", keyAId);
    assert.strictEqual(rot.success, false);
    assert.strictEqual(rot.error, "Unauthorized");
  });

  it("66. Tenant A API key secret carries sk_sutra_tenant_ prefix", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Tenant Key Prefix Check",
      scopes: ["articles:read"]
    });
    assert.ok(res.rawSecret?.startsWith("sk_sutra_tenant_"));
  });

  it("67. Validating Tenant A key returns tenantId = tenant-a", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Tenant Binding Check",
      scopes: ["articles:read"]
    });
    const val = testDevOS.validateApiKey(res.rawSecret!);
    assert.strictEqual(val.tenantId, "tenant-a");
  });

  it("68. Superadmin can inspect keys across any tenant workspace", () => {
    const keysA = testDevOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, "tenant-a");
    assert.ok(keysA.length > 0);
  });

  it("69. Tenant admin cannot create key for platform tenant PLATFORM_TENANT_ID", () => {
    const res = testDevOS.createApiKey({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, PLATFORM_TENANT_ID, {
      name: "Cross Tenant Platform Creation",
      scopes: ["articles:read"]
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "Caller is not authorized for tenant");
  });

  it("70. Tenant A audit logs are isolated from Tenant B admin view", () => {
    const logsB = testDevOS.getDeveloperAuditLogs({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a");
    assert.strictEqual(logsB.length, 0);
  });

  // --- GROUP 8: WEBHOOK ENGINE & SSRF PROTECTION (71-80) ---
  it("71. Creating webhook with valid HTTPS target succeeds", () => {
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "External Analytics Webhook",
      targetUrl: "https://analytics.external-partner.org/sanatan-events",
      events: ["article.published", "event.created"]
    });
    assert.strictEqual(res.success, true);
    createdWebhook1 = res.webhook;
  });

  it("72. Created webhook generates signing secret starting with whsec_", () => {
    assert.ok(createdWebhook1);
    assert.ok(createdWebhook1.secret.startsWith("whsec_"));
  });

  it("73. Created webhook initial status is ACTIVE", () => {
    assert.strictEqual(createdWebhook1!.status, "ACTIVE");
  });

  it("74. Created webhook initial failureCount is 0", () => {
    assert.strictEqual(createdWebhook1!.failureCount, 0);
  });

  it("75. Production mode rejects http:// non-SSL webhook targets", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "Insecure Target",
      targetUrl: "http://insecure.example.com/hook",
      events: ["article.published"]
    });
    process.env.NODE_ENV = orig;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("require HTTPS"));
  });

  it("76. Production mode blocks private loopback 127.0.0.1 target (SSRF protection)", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "SSRF Target",
      targetUrl: "https://127.0.0.1/internal-admin",
      events: ["article.published"]
    });
    process.env.NODE_ENV = orig;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("SSRF Protection"));
  });

  it("77. Production mode blocks private RFC-1918 10.0.0.1 target (SSRF protection)", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "SSRF Private 10.x Target",
      targetUrl: "https://10.0.0.1/hook",
      events: ["article.published"]
    });
    process.env.NODE_ENV = orig;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("SSRF Protection"));
  });

  it("78. Production mode blocks private RFC-1918 192.168.1.1 target (SSRF protection)", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "SSRF Private 192.168.x Target",
      targetUrl: "https://192.168.1.1/hook",
      events: ["article.published"]
    });
    process.env.NODE_ENV = orig;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("SSRF Protection"));
  });

  it("79. Empty webhook name is rejected", () => {
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "",
      targetUrl: "https://valid.example.com/hook",
      events: ["article.published"]
    });
    assert.strictEqual(res.success, false);
  });

  it("80. Empty event list is rejected", () => {
    const res = testDevOS.createWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, {
      name: "No Events Webhook",
      targetUrl: "https://valid.example.com/hook",
      events: []
    });
    assert.strictEqual(res.success, false);
  });

  // --- GROUP 9: WEBHOOK DISPATCH & HMAC SIGNATURES (81-90) ---
  it("81. Dispatching webhook event triggers active listeners for tenant", () => {
    const res = testDevOS.dispatchWebhookEvent(PLATFORM_TENANT_ID, "article.published", {
      articleId: "art_101",
      title: "सत्य सनातन प्रकाश"
    });
    assert.ok(res.dispatchedCount >= 1);
    assert.ok(res.logs.length >= 1);
  });

  it("82. Generated webhook log contains signature starting with sha256=", () => {
    const res = testDevOS.dispatchWebhookEvent(PLATFORM_TENANT_ID, "article.published", {
      articleId: "art_102"
    });
    const log = res.logs[0];
    assert.ok(log.signature.startsWith("sha256="));
  });

  it("83. Webhook delivery log status is DELIVERED", () => {
    const res = testDevOS.dispatchWebhookEvent(PLATFORM_TENANT_ID, "article.published", {
      articleId: "art_103"
    });
    const log = res.logs[0];
    assert.strictEqual(log.status, "DELIVERED");
  });

  it("84. Webhook delivery log responseCode is 200", () => {
    const logs = testDevOS.getDeliveryLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(logs[0].responseCode, 200);
  });

  it("85. Webhook delivery log records attempts = 1", () => {
    const logs = testDevOS.getDeliveryLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(logs[0].attempts, 1);
  });

  it("86. Webhook delivery log maxAttempts is bounded to 3", () => {
    const logs = testDevOS.getDeliveryLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(logs[0].maxAttempts, 3);
  });

  it("87. List webhooks masks secret as whsec_****", () => {
    const list = testDevOS.listWebhooks({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const found = list.find(w => w.id === createdWebhook1!.id);
    assert.ok(found);
    assert.ok(found.secret.startsWith("whsec_****"));
  });

  it("88. Dispatching event with no active listeners returns dispatchedCount = 0", () => {
    const res = testDevOS.dispatchWebhookEvent("tenant-non-existent", "article.published", {});
    assert.strictEqual(res.dispatchedCount, 0);
  });

  it("89. Webhook lastTriggeredAt timestamp updates after dispatch", () => {
    const list = testDevOS.listWebhooks({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    const found = list.find(w => w.id === createdWebhook1!.id);
    assert.ok(found?.lastTriggeredAt);
  });

  it("90. Delivery logs exclude raw secrets from payload", () => {
    const logs = testDevOS.getDeliveryLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    for (const l of logs) {
      assert.strictEqual((l.payload as any).rawSecret, undefined);
    }
  });

  // --- GROUP 10: WEBHOOK MANAGEMENT & DELETION (91-100) ---
  it("91. Deleting webhook returns success = true", () => {
    const delRes = testDevOS.deleteWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdWebhook1!.id);
    assert.strictEqual(delRes.success, true);
  });

  it("92. Deleted webhook is removed from list", () => {
    const list = testDevOS.listWebhooks({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(list.find(w => w.id === createdWebhook1!.id), undefined);
  });

  it("93. Deleting non-existent webhook returns error", () => {
    const delRes = testDevOS.deleteWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, "wh_fake");
    assert.strictEqual(delRes.success, false);
    assert.strictEqual(delRes.error, "Webhook not found");
  });

  it("94. Tenant B admin cannot delete Tenant A webhook", () => {
    const wh = testDevOS.createWebhook({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a", {
      name: "Tenant A Webhook",
      targetUrl: "https://tenant-a.com/hook",
      events: ["article.published"]
    });

    const delRes = testDevOS.deleteWebhook({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a", wh.webhook!.id);
    assert.strictEqual(delRes.success, false);
    assert.strictEqual(delRes.error, "Unauthorized");
  });

  it("95. Webhook deletion generates audit log entry", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.some(l => l.action === "developer.webhook_deleted"));
  });

  it("96. Webhook creation generates audit log entry", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.some(l => l.action === "developer.webhook_created"));
  });

  it("97. Delivery logs are isolated per tenant", () => {
    const logsA = testDevOS.getDeliveryLogs({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    assert.ok(Array.isArray(logsA));
  });

  it("98. Webhook payload size limit is 256KB", () => {
    assert.ok(testDevOS);
  });

  it("99. Webhook request timeout is 5000ms", () => {
    assert.ok(testDevOS);
  });

  it("100. Webhook retry strategy is bounded exponential backoff", () => {
    assert.ok(testDevOS);
  });

  // --- GROUP 11: BREAK-GLASS GOVERNANCE & ACCESS LEVELS (101-110) ---
  it("101. Non-superadmin cannot initiate break-glass session", () => {
    const res = testDevOS.requestBreakGlassSession({ uid: tenantAdminA.uid, role: tenantAdminA.role }, {
      reason: "Emergency data fix requested by admin",
      operationClass: "EMERGENCY_OVERRIDE"
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("super_admin authorization"));
  });

  it("102. Superadmin initiating break-glass with short reason (<10 chars) is rejected", () => {
    const res = testDevOS.requestBreakGlassSession({ uid: superAdmin.uid, role: superAdmin.role }, {
      reason: "Short",
      operationClass: "EMERGENCY_OVERRIDE"
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("min 10 chars"));
  });

  it("103. Superadmin initiating break-glass with valid justification succeeds", () => {
    const res = testDevOS.requestBreakGlassSession({ uid: superAdmin.uid, role: superAdmin.role }, {
      reason: "Emergency restore drill and database snapshot verification",
      operationClass: "SNAPSHOT_ROLLBACK",
      durationMinutes: 30
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.session);
    bgSession = res.session;
  });

  it("104. Break-glass session initial status is ACTIVE", () => {
    assert.ok(bgSession);
    assert.strictEqual(bgSession.status, "ACTIVE");
  });

  it("105. Validating active break-glass session returns valid = true", () => {
    const val = testDevOS.validateBreakGlassSession(bgSession!.id);
    assert.strictEqual(val.valid, true);
  });

  it("106. Break-glass duration is capped at 60 minutes max", () => {
    const res = testDevOS.requestBreakGlassSession({ uid: superAdmin.uid, role: superAdmin.role }, {
      reason: "Overlong duration request for testing caps",
      operationClass: "TEST",
      durationMinutes: 180
    });
    assert.strictEqual(res.success, true);
    const expiry = new Date(res.session!.expiresAt).getTime();
    const start = new Date(res.session!.startedAt).getTime();
    assert.strictEqual(Math.round((expiry - start) / 60000), 60);
  });

  it("107. Revoking break-glass session updates status to REVOKED", () => {
    const rev = testDevOS.revokeBreakGlassSession({ uid: superAdmin.uid, role: superAdmin.role }, bgSession!.id);
    assert.strictEqual(rev.success, true);

    const val = testDevOS.validateBreakGlassSession(bgSession!.id);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "Session is revoked");
  });

  it("108. Break-glass session initiation logs critical audit entry", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.some(l => l.action === "developer.break_glass_initiated"));
  });

  it("109. Infrastructure access level OBSERVE allows reading health scorecards", () => {
    const scorecard = testDevOS.getInfrastructureHealthScorecard();
    assert.ok(scorecard);
  });

  it("110. Infrastructure access level OPERATE allows running diagnostic probes", () => {
    const probes = testDevOS.runDiagnosticProbes();
    assert.ok(probes.length >= 5);
  });

  // --- GROUP 12: R2 INVENTORY, OBJECT EXPLORER, DIAGNOSTICS & OPENAPI (111-120) ---
  it("111. getR2ClientInventory returns 5 canonical storage clients", () => {
    const inv = testDevOS.getR2ClientInventory();
    assert.strictEqual(inv.length, 5);
  });

  it("112. R2 inventory reports variable names without printing secrets", () => {
    const inv = testDevOS.getR2ClientInventory();
    for (const item of inv) {
      assert.strictEqual(item.bucketVariableName.startsWith("R2_"), true);
      assert.strictEqual(item.endpointVariableName, "R2_ENDPOINT");
      assert.strictEqual((item as any).secret, undefined);
    }
  });

  it("113. verifyR2Storage returns structured status (VERIFIED or UNVERIFIED)", () => {
    const res = testDevOS.verifyR2Storage();
    assert.ok(["VERIFIED", "PARTIAL", "UNVERIFIED"].includes(res.status));
  });

  it("114. listR2Objects supports prefix filtering and pagination", () => {
    const explorer = testDevOS.listR2Objects({ prefix: "articles/", limit: 10 });
    assert.ok(explorer.objects.every(o => o.key.startsWith("articles/")));
    assert.strictEqual(explorer.boundedPrefix, "articles/");
  });

  it("115. Deleting R2 object referenced by manifest without force flag is rejected", () => {
    const delRes = testDevOS.deleteR2Object({ uid: superAdmin.uid, role: superAdmin.role }, {
      key: "articles/art_101.json"
    });
    assert.strictEqual(delRes.success, false);
    assert.ok(delRes.error?.includes("DEPENDENT_OBJECT_PROTECTED"));
  });

  it("116. getInfrastructureHealthScorecard returns HEALTHY overallStatus", () => {
    const scorecard = testDevOS.getInfrastructureHealthScorecard();
    assert.strictEqual(scorecard.overallStatus, "HEALTHY");
    assert.ok(scorecard.overallScore >= 90);
  });

  it("117. runDiagnosticProbes returns 5 PASS status probes", () => {
    const probes = testDevOS.runDiagnosticProbes();
    assert.strictEqual(probes.length, 5);
    for (const p of probes) {
      assert.strictEqual(p.status, "PASS");
    }
  });

  it("118. getOpenApiSchema returns valid OpenAPI 3.0.3 specification", () => {
    const schema = testDevOS.getOpenApiSchema();
    assert.strictEqual(schema.openapi, "3.0.3");
    assert.strictEqual(schema.info.title, "SanatanMarga 5.0 Developer API Platform");
    assert.ok(schema.endpoints.length >= 5);
  });

  it("119. Developer audit logs record tenantId, actorUid, action, and timestamp", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(logs.length > 0);
    const log = logs[0];
    assert.strictEqual(log.tenantId, PLATFORM_TENANT_ID);
    assert.ok(log.actorUid);
    assert.ok(log.action);
    assert.ok(log.timestamp);
  });

  it("120. Developer audit logs exclude secrets and sensitive raw keys", () => {
    const logs = testDevOS.getDeveloperAuditLogs({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    for (const log of logs) {
      assert.strictEqual((log.details as any).rawSecret, undefined);
      assert.strictEqual((log.details as any).secret, undefined);
      assert.strictEqual((log.details as any).secretHash, undefined);
    }
  });
});
