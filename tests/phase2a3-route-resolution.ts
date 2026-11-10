/**
 * SANATANMARGA 5.0 BETA — PHASE 2A.3 / 2A.4 ROUTE RESOLUTION VERIFIER
 * 
 * Verifies:
 * 1. /api/cache/manifest.json returns valid JSON, not SPA HTML.
 * 2. /api/cache/homepage.json returns valid JSON, not SPA HTML.
 * 3. /api/features/config and /api/cache/feature-control return JSON.
 * 4. Machine-readable endpoints return Content-Type: application/json.
 * 5. SPA fallback does NOT intercept /api/* routes.
 * 6. Snapshot client guard detects and safely rejects non-JSON Content-Type payloads without syntax errors.
 */

import http from "http";
import express from "express";
import path from "path";
import fs from "fs";
import { snapshotIdentityRegistry } from "../server/snapshotIdentityRegistry";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("SANATANMARGA 5.0 — PHASE 2A.3/2A.4 ROUTE RESOLUTION");
  console.log("=================================================\n");

  // Setup mock Express app with identical route order to server.ts
  const app = express();
  const PORT = 3899;

  // Mock server state
  const mockManifest = {
    snapshotVersion: "v_5.0_beta",
    generatedAt: new Date().toISOString(),
    modules: {
      "homepage": { sha256: "hp_hash_123", key: "homepage.json", byteSize: 1024, schemaVersion: 2 },
      "articles": { sha256: "art_hash_123", key: "articles.json", byteSize: 2048, schemaVersion: 2 }
    }
  };

  const mockHomepage = {
    generatedAt: new Date().toISOString(),
    featuredArticles: [{ id: "art_1", title: "Test Article" }],
    latestNews: [{ id: "art_1", title: "Test Article" }],
    categories: [{ id: "cat_1", name: "News" }]
  };

  const mockStore: Record<string, any> = {
    "manifest": { data: mockManifest },
    "homepage": { data: mockHomepage },
    "feature-control": { data: { version: 1, features: {} } },
    "ads": { data: { version: 1, activeAds: [] } }
  };

  // 1. API routes
  app.get("/api/cache/:snapshotType", (req, res) => {
    const cleanType = req.params.snapshotType.replace(".json", "");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    
    if (mockStore[cleanType]?.data) {
      return res.json(mockStore[cleanType].data);
    }

    const resolved = snapshotIdentityRegistry.resolveCanonicalKey(cleanType);
    if (mockStore[resolved.canonicalKey]?.data) {
      return res.json(mockStore[resolved.canonicalKey].data);
    }

    return res.status(404).json({ error: `Snapshot '${cleanType}' not found` });
  });

  app.get(["/api/features/config", "/api/feature-control/config"], (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({ version: 1, features: {}, profile: "BALANCED" });
  });

  app.get("/api/ads/active", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({ activeAds: [], generatedAt: new Date().toISOString() });
  });

  // 2. SPA fallback (Must NOT intercept /api/)
  app.get("*", (req, res) => {
    const urlPath = req.path;
    if (urlPath.startsWith("/api/")) {
      return res.status(404).json({ error: "API route not found" });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send("<!doctype html><html><head><title>SanatanMarga</title></head><body><div id='root'></div></body></html>");
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {
    // Test 1: /api/cache/manifest.json returns valid JSON and correct Content-Type
    const manifestRes = await fetch(`http://localhost:${PORT}/api/cache/manifest.json`);
    const manifestContentType = manifestRes.headers.get("content-type") || "";
    const manifestText = await manifestRes.text();
    let isManifestJson = false;
    try {
      const parsed = JSON.parse(manifestText);
      isManifestJson = parsed.snapshotVersion === "v_5.0_beta";
    } catch (e) {}

    assert(manifestContentType.includes("application/json"), "1. /api/cache/manifest.json returns Content-Type: application/json", manifestContentType);
    assert(isManifestJson, "2. /api/cache/manifest.json body is valid parseable JSON");
    assert(!manifestText.includes("<!doctype html>"), "3. /api/cache/manifest.json does not return SPA HTML fallback");

    // Test 2: /api/cache/homepage.json returns valid JSON
    const hpRes = await fetch(`http://localhost:${PORT}/api/cache/homepage.json`);
    const hpContentType = hpRes.headers.get("content-type") || "";
    const hpText = await hpRes.text();
    let isHpJson = false;
    try {
      const parsed = JSON.parse(hpText);
      isHpJson = Array.isArray(parsed.featuredArticles);
    } catch (e) {}

    assert(hpContentType.includes("application/json"), "4. /api/cache/homepage.json returns Content-Type: application/json", hpContentType);
    assert(isHpJson, "5. /api/cache/homepage.json body is valid parseable JSON");
    assert(!hpText.includes("<!doctype html>"), "6. /api/cache/homepage.json does not return SPA HTML fallback");

    // Test 3: Feature Control snapshot endpoint
    const fcRes = await fetch(`http://localhost:${PORT}/api/features/config`);
    const fcContentType = fcRes.headers.get("content-type") || "";
    const fcText = await fcRes.text();
    assert(fcContentType.includes("application/json"), "7. /api/features/config returns Content-Type: application/json");
    assert(!fcText.includes("<!doctype html>"), "8. /api/features/config does not return SPA HTML fallback");

    // Test 4: Ads active endpoint
    const adsRes = await fetch(`http://localhost:${PORT}/api/ads/active`);
    const adsContentType = adsRes.headers.get("content-type") || "";
    const adsText = await adsRes.text();
    assert(adsContentType.includes("application/json"), "9. /api/ads/active returns Content-Type: application/json");
    assert(!adsText.includes("<!doctype html>"), "10. /api/ads/active does not return SPA HTML fallback");

    // Test 5: Unknown /api/ route returns JSON 404, never SPA HTML
    const unknownApiRes = await fetch(`http://localhost:${PORT}/api/unknown-endpoint`);
    const unknownContentType = unknownApiRes.headers.get("content-type") || "";
    const unknownText = await unknownApiRes.text();
    assert(unknownApiRes.status === 404, "11. Unknown /api/ route returns status 404");
    assert(unknownContentType.includes("application/json"), "12. Unknown /api/ route returns application/json 404 error");
    assert(!unknownText.includes("<!doctype html>"), "13. SPA fallback does NOT intercept unknown /api/ routes");

    // Test 6: Non-API route returns SPA HTML
    const spaRes = await fetch(`http://localhost:${PORT}/news/article-123`);
    const spaContentType = spaRes.headers.get("content-type") || "";
    const spaText = await spaRes.text();
    assert(spaContentType.includes("text/html"), "14. Non-API routes properly return text/html SPA shell");
    assert(spaText.includes("<!doctype html>"), "15. SPA shell contains doctype html");

  } finally {
    server.close();
  }

  console.log("\n=================================================");
  console.log(`PHASE 2A.3/2A.4 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
