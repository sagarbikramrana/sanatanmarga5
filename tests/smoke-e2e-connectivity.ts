import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";

const PORT = 3008;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function waitForServer(child: ChildProcess, maxAttempts = 60, intervalMs = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          clearInterval(timer);
          resolve();
          return;
        }
      } catch {
        // server not yet listening
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
        reject(new Error(`Server failed to start on ${BASE_URL} after ${maxAttempts * intervalMs}ms`));
      }
    }, intervalMs);
  });
}

test("SANATANMARGA 5.0 — PRODUCTION SERVER & ROUTING SMOKE CHECK", async (t) => {
  let serverProcess: ChildProcess | null = null;

  // Start compiled production server
  const serverPath = path.resolve(process.cwd(), "dist", "server.cjs");
  serverProcess = spawn("node", [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      LOCAL_RECOVERY_MODE: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout?.on("data", (data) => {
    console.log("[Server]", data.toString().trim());
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error("[Server Err]", data.toString().trim());
  });

  try {
    await waitForServer(serverProcess);

    await t.test("1. /health endpoint responds 200 with server status", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.status === "ok" || data.status === "healthy" || data.uptime !== undefined);
    });

    await t.test("2. Root / serves index.html with SPA root container and assets", async () => {
      const res = await fetch(`${BASE_URL}/`);
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('<div id="root">'), "HTML must contain root container");
      assert.ok(html.includes("<script"), "HTML must contain script tag");
    });

    await t.test("3. Deep SPA routes rewrite to index.html with 200 OK", async () => {
      const routes = ["/admin/editorial", "/nepal-hub", "/knowledge", "/radio", "/models"];
      for (const route of routes) {
        const res = await fetch(`${BASE_URL}${route}`);
        assert.strictEqual(res.status, 200, `Route ${route} must return 200`);
        const html = await res.text();
        assert.ok(html.includes('<div id="root">'), `Route ${route} must serve SPA index.html`);
      }
    });

    await t.test("4. Public manifest.json is served with 200 OK", async () => {
      const res = await fetch(`${BASE_URL}/manifest.json`);
      assert.strictEqual(res.status, 200);
      const manifest = await res.json();
      assert.ok(manifest && typeof manifest === "object", "manifest.json must be valid JSON");
    });

    await t.test("5. Security gate on /api/editorial/candidates rejects unauthenticated calls", async () => {
      const res = await fetch(`${BASE_URL}/api/editorial/candidates`);
      assert.strictEqual(res.status, 401, "Unauthenticated request must be rejected with 401");
      const data = await res.json();
      assert.strictEqual(data.errorCode, "ERR_UNAUTHORIZED");
    });

    await t.test("6. Security gate on /api/editorial/candidates/:id/schedule rejects unauthorized calls", async () => {
      const res = await fetch(`${BASE_URL}/api/editorial/candidates/cand_dummy_123/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishAt: new Date(Date.now() + 3600000).toISOString() })
      });
      assert.strictEqual(res.status, 401);
    });

    await t.test("7. Scheduler trigger endpoint rejects query-parameter credentials", async () => {
      const res = await fetch(`${BASE_URL}/api/editorial/scheduler/process-due?token=leak_test`, {
        method: "POST"
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("prohibited"), "Must block query parameter credentials");
    });

    await t.test("8. Security headers are present on responses", async () => {
      const res = await fetch(`${BASE_URL}/`);
      const nosniff = res.headers.get("x-content-type-options");
      assert.strictEqual(nosniff, "nosniff", "X-Content-Type-Options must be nosniff");
    });

    await t.test("9. Ask Sanatan API enforces default gate and serves grounded research in preview mode", async () => {
      const gatedRes = await fetch(`${BASE_URL}/api/ask-sanatan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "चाँगुनारायण अभिलेख" })
      });
      assert.strictEqual(gatedRes.status, 403);
      const gatedData = await gatedRes.json();
      assert.strictEqual(gatedData.code, "PHASE_9_SCHEDULED");

      const researchRes = await fetch(`${BASE_URL}/api/ask-sanatan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "चाँगुनारायण मानदेव अभिलेख",
          domain: "sgis",
          previewResearchMode: true
        })
      });
      assert.strictEqual(researchRes.status, 200);
      const researchData = await researchRes.json();
      assert.strictEqual(researchData.success, true);
      assert.strictEqual(researchData.groundedInCorpus, true);
      assert.ok(Array.isArray(researchData.citations) && researchData.citations.length > 0, "Must return verified primary citations");
    });

    await t.test("10. Telemetry diagnostics endpoint enforces staff RBAC", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/telemetry/diagnostics`);
      assert.strictEqual(res.status, 403);
    });

    await t.test("11. /api/nepal/geography serves 7 provinces, 77 districts, and 12 canonical categories", async () => {
      const res = await fetch(`${BASE_URL}/api/nepal/geography`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.provincesCount, 7);
      assert.strictEqual(data.districtsCount, 77);
      assert.strictEqual(data.categoriesCount, 12);
    });

    await t.test("12. /api/market-data serves NRB Forex & Civic reference with Gold/Silver/NEPSE decommissioned", async () => {
      const res = await fetch(`${BASE_URL}/api/market-data`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.decommissionedFeatures), "Must explicitly list decommissioned features");
      assert.ok(data.decommissionedFeatures.includes("gold_rate"));
      assert.ok(data.decommissionedFeatures.includes("silver_rate"));
      assert.ok(data.decommissionedFeatures.includes("nepse_stock_market"));
      assert.strictEqual(data.gold, undefined, "Gold rate must be decommissioned");
      assert.strictEqual(data.silver, undefined, "Silver rate must be decommissioned");
      assert.strictEqual(data.nepse, undefined, "NEPSE stock market must be decommissioned");
    });

  } finally {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
  }
});
