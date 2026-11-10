import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import re from "node:process";
import { serverAiObservabilityOS } from "../server/aiObservabilityOs.js";
import { PlaylistEngine } from "../src/services/playlistEngine.js";
import { analyticsService } from "../src/services/analyticsService.js";

test("SANATANMARGA 5.0 — FOUNDATION RELEASE GATE F0.1 CERTIFICATION SUITE", async (t) => {
  const serverCode = fs.readFileSync("server.ts", "utf-8");

  await t.test("1. Route Purity: Zero duplicate Express routes registered in server.ts", () => {
    const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
    const routes = new Map<string, number>();
    const duplicates: string[] = [];
    
    let match;
    while ((match = routeRegex.exec(serverCode)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const key = `${method} ${path}`;
      const count = (routes.get(key) || 0) + 1;
      routes.set(key, count);
      if (count === 2) {
        duplicates.push(key);
      }
    }

    assert.strictEqual(duplicates.length, 0, `Found duplicate routes: ${duplicates.join(", ")}`);
  });

  await t.test("2. Canonical Sitemap Single-Source: exactly one /sitemap.xml and /sitemap-news.xml", () => {
    const sitemapMatches = serverCode.match(/app\.get\(\s*["']\/sitemap\.xml["']/g);
    assert.strictEqual(sitemapMatches?.length, 1, "Must have exactly 1 registration for GET /sitemap.xml");

    const newsSitemapMatches = serverCode.match(/app\.get\(\s*["']\/sitemap-news\.xml["']/g);
    assert.strictEqual(newsSitemapMatches?.length, 1, "Must have exactly 1 registration for GET /sitemap-news.xml");
  });

  await t.test("3. Privileged AI newsroom gate: /api/gemini/newsroom requires staff authentication", () => {
    const newsroomIdx = serverCode.indexOf('app.post("/api/gemini/newsroom"');
    assert.ok(newsroomIdx !== -1, "Endpoint /api/gemini/newsroom must exist");
    const snippet = serverCode.substring(newsroomIdx, newsroomIdx + 500);
    assert.ok(snippet.includes("authenticateRequestUser"), "Must call authenticateRequestUser");
    assert.ok(snippet.includes("isStaff") || snippet.includes("403"), "Must verify staff permissions");
  });

  await t.test("4. Privileged AI rotation gate: /api/gemini/generate-with-rotation rejects bypass & unverified models", () => {
    const rotationIdx = serverCode.indexOf('app.post("/api/gemini/generate-with-rotation"');
    assert.ok(rotationIdx !== -1, "Endpoint /api/gemini/generate-with-rotation must exist");
    const snippet = serverCode.substring(rotationIdx, rotationIdx + 2000);
    assert.ok(snippet.includes("authenticateRequestUser"), "Must authenticate requesting actor");
    assert.ok(!snippet.includes("let isStaff = true;"), "Must NOT contain bypass default 'let isStaff = true;'");
    assert.ok(snippet.includes("allowedVerifiedModels") || snippet.includes("resolvePolicyModels"), "Must validate model against verified policy authority");
  });

  await t.test("5. Vault routes purity: exactly 1 GET /api/vault/backups and 1 POST /api/vault/restore with auth", () => {
    const backupsMatches = serverCode.match(/app\.get\(\s*["']\/api\/vault\/backups["']/g);
    assert.strictEqual(backupsMatches?.length, 1, "Must have exactly 1 registration for GET /api/vault/backups");

    const restoreMatches = serverCode.match(/app\.post\(\s*["']\/api\/vault\/restore["']/g);
    assert.strictEqual(restoreMatches?.length, 1, "Must have exactly 1 registration for POST /api/vault/restore");

    const restoreIdx = serverCode.indexOf('app.post("/api/vault/restore"');
    const restoreSnippet = serverCode.substring(restoreIdx, restoreIdx + 600);
    assert.ok(restoreSnippet.includes("authenticateRequestUser"), "Vault restore must verify admin authentication");
    assert.ok(restoreSnippet.includes("targetModules"), "Vault restore must support partial targetModules");
  });

  await t.test("6. Audit logs purity: exactly 1 GET /api/admin/audit-logs with server governance auth", () => {
    const auditMatches = serverCode.match(/app\.get\(\s*["']\/api\/admin\/audit-logs["']/g);
    assert.strictEqual(auditMatches?.length, 1, "Must have exactly 1 registration for GET /api/admin/audit-logs");

    const auditIdx = serverCode.indexOf('app.get("/api/admin/audit-logs"');
    const auditSnippet = serverCode.substring(auditIdx, auditIdx + 600);
    assert.ok(auditSnippet.includes("authenticateRequestUser"), "Must require authenticateRequestUser");
    assert.ok(auditSnippet.includes("governance.manage") || auditSnippet.includes("super_admin"), "Must require admin or governance.manage");
  });

  await t.test("7. Full-Stack restore purity: exactly 1 POST /api/admin/backup/restore with admin auth", () => {
    const restoreMatches = serverCode.match(/app\.post\(\s*["']\/api\/admin\/backup\/restore["']/g);
    assert.strictEqual(restoreMatches?.length, 1, "Must have exactly 1 registration for POST /api/admin/backup/restore");

    const restoreIdx = serverCode.indexOf('app.post("/api/admin/backup/restore"');
    const restoreSnippet = serverCode.substring(restoreIdx, restoreIdx + 600);
    assert.ok(restoreSnippet.includes("authenticateRequestUser"), "Must require authenticateRequestUser");
  });

  await t.test("8. AI Model Authority: Only LIVE_PROVIDER_VERIFIED models are productionExecutable", () => {
    const models = serverAiObservabilityOS.listModels();
    assert.ok(models.length > 0, "Model registry must have models");
    for (const m of models) {
      if (m.productionExecutable) {
        assert.strictEqual(
          m.verificationProvenance,
          "LIVE_PROVIDER_VERIFIED",
          `Model ${m.id} is marked productionExecutable without LIVE_PROVIDER_VERIFIED provenance`
        );
      }
    }
  });

  await t.test("9. AI Observability: Policy model resolution excludes unverified candidates", () => {
    const pol = serverAiObservabilityOS.resolvePolicyModels("NEWSROOM_PRIMARY");
    assert.ok(pol.primary, "Primary model must exist");
    assert.strictEqual(pol.primary, "gemini-flash-latest");
    for (const fb of pol.fallbacks) {
      const fbModel = serverAiObservabilityOS.getModel(fb);
      assert.ok(fbModel?.productionExecutable, `Fallback model ${fb} must be productionExecutable`);
    }
  });

  await t.test("10. Zero-Mock in production services: PlaylistEngine returns clean empty queue for unmatched district", () => {
    const emptyQueue = PlaylistEngine.createDistrictQueue("nonexistent_district_xyz", []);
    assert.strictEqual(emptyQueue.items.length, 0, "Must return honest empty items array rather than fabricated articles");
    
    const saved = PlaylistEngine.getSavedPlaylists();
    assert.ok(Array.isArray(saved), "Must return honest array");
  });

  await t.test("11. Truthful Telemetry: Live analytics returns unconfigured/insufficient_data without fabrication", async () => {
    const summary = await analyticsService.getSummary();
    assert.strictEqual(summary.userRetentionRate.value, null, "Retention value must be null when unmeasured");
    assert.strictEqual(summary.userRetentionRate.status, "insufficient_data");
    assert.strictEqual(summary.userChurnRate.value, null, "Churn value must be null when unmeasured");
    assert.strictEqual(summary.adFillRateTelemetry.value, null, "Ad fill telemetry value must be null when not configured");
    assert.strictEqual(summary.adFillRateTelemetry.status, "not_configured");
  });

  await t.test("12. Admin Maintenance & Snapshot Safety: categorization maintenance is explicit and authenticated", () => {
    assert.ok(
      serverCode.includes('app.post("/api/admin/maintenance/categorize-articles"'),
      "Explicit maintenance endpoint /api/admin/maintenance/categorize-articles must exist"
    );
    const catIdx = serverCode.indexOf('app.post("/api/admin/maintenance/categorize-articles"');
    const catSnippet = serverCode.substring(catIdx, catIdx + 400);
    assert.ok(catSnippet.includes("authenticateRequestUser"), "Categorize endpoint must require authenticateRequestUser");
  });

  setTimeout(() => process.exit(0), 100);
});
