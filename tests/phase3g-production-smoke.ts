/**
 * SANATANMARGA 5.0 BETA — PHASE 3G PRODUCTION-LIKE SMOKE TEST
 * Developer & Infrastructure OS 22-Step Production Endpoint & Runtime Verification
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { serverDeveloperOS } from "../server/developerOs";
import { serverIamOS } from "../server/iamOs";
import { PLATFORM_TENANT_ID } from "../src/types/tenant";
import { DeveloperApiKeyScope } from "../src/types/developer";

describe("SANATANMARGA 5.0 — PHASE 3G 22-STEP PRODUCTION SMOKE WORKFLOWS", () => {
  const superAdmin = serverIamOS.provisionUser({ uid: "usr_smoke_super_admin", email: "super@sanatanmarga.com" });
  superAdmin.role = "super_admin";

  const tenantAdminA = serverIamOS.provisionUser({ uid: "usr_smoke_tenant_a", email: "admin@tenant-a.com" });
  tenantAdminA.role = "admin";
  tenantAdminA.tenantId = "tenant-a";

  const tenantAdminB = serverIamOS.provisionUser({ uid: "usr_smoke_tenant_b", email: "admin@tenant-b.com" });
  tenantAdminB.role = "admin";
  tenantAdminB.tenantId = "tenant-b";

  let createdKey: any;
  let rawSecret: string;
  let webhookId: string;
  let breakGlassSessionId: string;

  it("Workflow 1: Platform default developer keys loaded and verified in runtime cache", () => {
    const keys = serverDeveloperOS.listApiKeys({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.ok(keys.length >= 2, "Default platform keys exist");
    assert.strictEqual(keys[0].tenantId, PLATFORM_TENANT_ID);
  });

  it("Workflow 2: Superadmin creates new platform developer API key with custom scopes", () => {
    const res = serverDeveloperOS.createApiKey(
      { uid: superAdmin.uid, role: superAdmin.role },
      PLATFORM_TENANT_ID,
      {
        name: "Smoke Test Gateway Key",
        scopes: ["articles:read", "knowledge:query"]
      }
    );
    assert.strictEqual(res.success, true);
    assert.ok(res.apiKey);
    assert.ok(res.rawSecret);
    createdKey = res.apiKey;
    rawSecret = res.rawSecret;
  });

  it("Workflow 3: Raw secret validated against server engine and returns valid credentials", () => {
    const val = serverDeveloperOS.validateApiKey(rawSecret);
    assert.strictEqual(val.valid, true);
    assert.strictEqual(val.tenantId, PLATFORM_TENANT_ID);
    assert.deepStrictEqual(val.scopes, ["articles:read", "knowledge:query"]);
  });

  it("Workflow 4: API key usage statistics recorded and incremented on valid request", () => {
    const keyDetail = serverDeveloperOS.getApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey.id);
    assert.ok(keyDetail);
    assert.strictEqual(keyDetail.requestsCountToday, 1);
    assert.strictEqual(keyDetail.requestsTotal, 1);
    assert.ok(keyDetail.lastUsedAt);
  });

  it("Workflow 5: Unauthenticated API request rejected when caller UID is empty", () => {
    const res = serverDeveloperOS.createApiKey({ uid: "" }, PLATFORM_TENANT_ID, {
      name: "Anon Key",
      scopes: ["articles:read"]
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "Unauthorized caller");
  });

  it("Workflow 6: Invalid API secret rejected with Invalid API Key credentials", () => {
    const val = serverDeveloperOS.validateApiKey("sk_sutra_live_invalid_secret_key_999");
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "Invalid API Key credentials");
  });

  it("Workflow 7: API key revoked by admin and future authentication requests fail", () => {
    const revRes = serverDeveloperOS.revokeApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey.id);
    assert.strictEqual(revRes.success, true);

    const val = serverDeveloperOS.validateApiKey(rawSecret);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "API Key is revoked");
  });

  it("Workflow 8: API key rotated cleanly, revoking old secret and returning new active secret", () => {
    const rotRes = serverDeveloperOS.rotateApiKey({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey.id);
    assert.strictEqual(rotRes.success, true);
    assert.ok(rotRes.newApiKey);
    assert.ok(rotRes.newRawSecret);

    // Old secret revoked
    assert.strictEqual(serverDeveloperOS.validateApiKey(rawSecret).valid, false);

    // New secret active
    const newVal = serverDeveloperOS.validateApiKey(rotRes.newRawSecret!);
    assert.strictEqual(newVal.valid, true);

    createdKey = rotRes.newApiKey;
    rawSecret = rotRes.newRawSecret!;
  });

  it("Workflow 9: API key scopes updated dynamically without invalidating credentials", () => {
    const newScopes: DeveloperApiKeyScope[] = ["articles:read", "community:write"];
    const upRes = serverDeveloperOS.updateApiKeyScopes({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, createdKey.id, newScopes);
    assert.strictEqual(upRes.success, true);
    assert.deepStrictEqual(upRes.apiKey?.scopes, newScopes);

    const val = serverDeveloperOS.validateApiKey(rawSecret);
    assert.strictEqual(val.valid, true);
    assert.deepStrictEqual(val.scopes, newScopes);
  });

  it("Workflow 10: Tenant admin creates tenant-isolated API key bound to tenant-a", () => {
    const res = serverDeveloperOS.createApiKey(
      { uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" },
      "tenant-a",
      { name: "Tenant A Web Key", scopes: ["articles:read"] }
    );
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.apiKey?.tenantId, "tenant-a");
  });

  it("Workflow 11: Cross-tenant access attempt by Tenant B admin against Tenant A key rejected", () => {
    const keysA = serverDeveloperOS.listApiKeys({ uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" }, "tenant-a");
    assert.ok(keysA.length > 0);
    const keyAId = keysA[0].id;

    const revRes = serverDeveloperOS.revokeApiKey({ uid: tenantAdminB.uid, role: tenantAdminB.role, tenantId: "tenant-b" }, "tenant-a", keyAId);
    assert.strictEqual(revRes.success, false);
    assert.strictEqual(revRes.error, "Unauthorized");
  });

  it("Workflow 12: Scope registry enforced: tenant admin blocked from requesting platform-only scopes", () => {
    const res = serverDeveloperOS.createApiKey(
      { uid: tenantAdminA.uid, role: tenantAdminA.role, tenantId: "tenant-a" },
      "tenant-a",
      { name: "Illegal Push Key", scopes: ["fcm:push"] }
    );
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("restricted to platform tenant") || res.error?.includes("requires super_admin"));
  });

  it("Workflow 13: Rate limit threshold enforced: exceeding RPM limit returns RATE_LIMIT_EXCEEDED", () => {
    const res = serverDeveloperOS.createApiKey(
      { uid: superAdmin.uid, role: superAdmin.role },
      PLATFORM_TENANT_ID,
      { name: "Low Limit Key", scopes: ["articles:read"], rateLimitRpm: 1 }
    );
    const sec = res.rawSecret!;

    assert.strictEqual(serverDeveloperOS.validateApiKey(sec).valid, true);
    const second = serverDeveloperOS.validateApiKey(sec);
    assert.strictEqual(second.valid, false);
    assert.ok(second.reason?.includes("RATE_LIMIT_EXCEEDED"));
  });

  it("Workflow 14: Expired API key validation automatically fails with EXPIRED status", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const res = serverDeveloperOS.createApiKey(
      { uid: superAdmin.uid, role: superAdmin.role },
      PLATFORM_TENANT_ID,
      { name: "Expired Key", scopes: ["articles:read"], expiresAt: pastDate }
    );
    const val = serverDeveloperOS.validateApiKey(res.rawSecret!);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.reason, "API Key has expired");
  });

  it("Workflow 15: Outbound webhook registered with HTTPS target and HMAC signing secret", () => {
    const res = serverDeveloperOS.createWebhook(
      { uid: superAdmin.uid, role: superAdmin.role },
      PLATFORM_TENANT_ID,
      {
        name: "Publish Event Webhook",
        targetUrl: "https://partner.sanatanmarga.org/webhook",
        events: ["article.published"]
      }
    );
    assert.strictEqual(res.success, true);
    assert.ok(res.webhook);
    assert.ok(res.webhook.secret.startsWith("whsec_"));
    webhookId = res.webhook.id;
  });

  it("Workflow 16: SSRF protection verified: private network webhook target blocked in production mode", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = serverDeveloperOS.createWebhook(
      { uid: superAdmin.uid, role: superAdmin.role },
      PLATFORM_TENANT_ID,
      { name: "Private Target", targetUrl: "https://10.0.0.1/internal", events: ["article.published"] }
    );
    process.env.NODE_ENV = origEnv;

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("SSRF Protection"));
  });

  it("Workflow 17: Outbound webhook event dispatched with HMAC SHA-256 signature and delivery log recorded", () => {
    const dispatchRes = serverDeveloperOS.dispatchWebhookEvent(PLATFORM_TENANT_ID, "article.published", {
      articleId: "art_smoke_101",
      title: "सत्य सनातन धर्म र सभ्यता"
    });
    assert.ok(dispatchRes.dispatchedCount >= 1);
    assert.ok(dispatchRes.logs.length >= 1);
    assert.ok(dispatchRes.logs[0].signature.startsWith("sha256="));
  });

  it("Workflow 18: Webhook configuration deleted cleanly and stops event dispatching", () => {
    const delRes = serverDeveloperOS.deleteWebhook({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID, webhookId);
    assert.strictEqual(delRes.success, true);

    const list = serverDeveloperOS.listWebhooks({ uid: superAdmin.uid, role: superAdmin.role }, PLATFORM_TENANT_ID);
    assert.strictEqual(list.find(w => w.id === webhookId), undefined);
  });

  it("Workflow 19: Time-bounded break-glass session requested with valid justification", () => {
    const bgRes = serverDeveloperOS.requestBreakGlassSession(
      { uid: superAdmin.uid, role: superAdmin.role },
      { reason: "Production emergency restore and snapshot validation", operationClass: "RESTORE" }
    );
    assert.strictEqual(bgRes.success, true);
    assert.ok(bgRes.session);
    breakGlassSessionId = bgRes.session.id;

    const val = serverDeveloperOS.validateBreakGlassSession(breakGlassSessionId);
    assert.strictEqual(val.valid, true);
  });

  it("Workflow 20: R2 storage inventory listed across 5 service clients without credential exposure", () => {
    const inv = serverDeveloperOS.getR2ClientInventory();
    assert.strictEqual(inv.length, 5);
    for (const item of inv) {
      assert.ok(item.clientName);
      assert.ok(item.bucketVariableName);
      assert.strictEqual((item as any).secret, undefined);
    }
  });

  it("Workflow 21: Infrastructure health scorecard evaluated returning HEALTHY status and component metrics", () => {
    const scorecard = serverDeveloperOS.getInfrastructureHealthScorecard();
    assert.strictEqual(scorecard.overallStatus, "HEALTHY");
    assert.ok(scorecard.overallScore >= 90);
    assert.ok(scorecard.components.firestoreGateway);
    assert.ok(scorecard.components.snapshotEngine);
    assert.ok(scorecard.components.developerOS);
  });

  it("Workflow 22: Diagnostic probes executed and OpenAPI 3.0 specification generated cleanly", () => {
    const probes = serverDeveloperOS.runDiagnosticProbes();
    assert.strictEqual(probes.length, 5);
    for (const p of probes) {
      assert.strictEqual(p.status, "PASS");
    }

    const openapi = serverDeveloperOS.getOpenApiSchema();
    assert.strictEqual(openapi.openapi, "3.0.3");
    assert.ok(openapi.endpoints.length >= 5);
  });
});
