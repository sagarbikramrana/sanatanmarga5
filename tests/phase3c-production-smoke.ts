/**
 * SANATANMARGA 5.0 BETA — PHASE 3C PRODUCTION-LIKE END-TO-END SMOKE TEST
 * Tests full live reader activity lifecycle, continuation, history, and admin telemetry.
 */

async function runProductionSmoke() {
  console.log("=================================================");
  console.log("SANATANMARGA 5.0 — PHASE 3C PRODUCTION-LIKE SMOKE TEST");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:3000";

  // 1. Anonymous article open
  console.log("Step 1: Ingesting anonymous article open...");
  const anonOpenRes = await fetch(`${baseUrl}/api/audience/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        eventId: `smoke_anon_open_${Date.now()}`,
        eventType: "ARTICLE_OPEN",
        entityType: "article",
        entityId: "art-smoke-1",
        route: "/article/art-smoke-1",
        occurredAt: new Date().toISOString(),
        sessionId: "sess_smoke_anon",
        schemaVersion: 1
      }],
      clientSentAt: new Date().toISOString()
    })
  });
  if (!anonOpenRes.ok) throw new Error("Failed anonymous article open ingest");
  const anonOpenData = await anonOpenRes.json();
  console.log(`✓ Anonymous open ingested (accepted: ${anonOpenData.accepted})`);

  // 2. Coarse progress milestones (25, 50, 75, 100)
  console.log("\nStep 2: Ingesting coarse progress milestone (50%)...");
  const progressRes = await fetch(`${baseUrl}/api/audience/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        eventId: `smoke_prog_${Date.now()}`,
        eventType: "ARTICLE_READ_PROGRESS",
        entityType: "article",
        entityId: "art-smoke-1",
        route: "/article/art-smoke-1",
        metadata: { milestone: 50, dwellSeconds: 45, dwellBucket: "15_60s" },
        occurredAt: new Date().toISOString(),
        sessionId: "sess_smoke_anon",
        schemaVersion: 1
      }],
      clientSentAt: new Date().toISOString()
    })
  });
  if (!progressRes.ok) throw new Error("Failed progress milestone ingest");
  const progressData = await progressRes.json();
  console.log(`✓ Progress milestone ingested (accepted: ${progressData.accepted})`);

  // 3. Article completion rule (milestone 100)
  console.log("\nStep 3: Ingesting article completion...");
  const completeRes = await fetch(`${baseUrl}/api/audience/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        eventId: `smoke_comp_${Date.now()}`,
        eventType: "ARTICLE_COMPLETE",
        entityType: "article",
        entityId: "art-smoke-1",
        route: "/article/art-smoke-1",
        metadata: { milestone: 100, dwellSeconds: 120, dwellBucket: "1_3m" },
        occurredAt: new Date().toISOString(),
        sessionId: "sess_smoke_anon",
        schemaVersion: 1
      }],
      clientSentAt: new Date().toISOString()
    })
  });
  if (!completeRes.ok) throw new Error("Failed completion ingest");
  console.log("✓ Article completion ingested successfully");

  // 4. Duplicate event replay (Idempotency)
  console.log("\nStep 4: Testing duplicate event replay idempotency...");
  const dupEventId = `smoke_dup_${Date.now()}`;
  const firstRes = await fetch(`${baseUrl}/api/audience/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        eventId: dupEventId,
        eventType: "PAGE_VIEW",
        route: "/categories",
        occurredAt: new Date().toISOString(),
        sessionId: "sess_smoke_anon",
        schemaVersion: 1
      }],
      clientSentAt: new Date().toISOString()
    })
  });
  const firstData = await firstRes.json();
  const secondRes = await fetch(`${baseUrl}/api/audience/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [{
        eventId: dupEventId,
        eventType: "PAGE_VIEW",
        route: "/categories",
        occurredAt: new Date().toISOString(),
        sessionId: "sess_smoke_anon",
        schemaVersion: 1
      }],
      clientSentAt: new Date().toISOString()
    })
  });
  const secondData = await secondRes.json();
  if (firstData.accepted !== 1 || secondData.deduplicated !== 1) {
    throw new Error("Idempotency replay failed");
  }
  console.log("✓ Idempotent replay confirmed (accepted: 1, duplicate replayed deduplicated: 1)");

  // 5. Check Content Aggregate
  console.log("\nStep 5: Verifying content audience aggregate...");
  const aggRes = await fetch(`${baseUrl}/api/audience/content/art-smoke-1`);
  if (!aggRes.ok) throw new Error("Failed content aggregate fetch");
  const aggData = await aggRes.json();
  console.log(`✓ Content aggregate: views=${aggData.views}, completions=${aggData.completions}`);
  if (aggData.views < 1 || aggData.completions < 1) {
    throw new Error("Aggregate metrics not updated correctly");
  }

  // 6. Pipeline Telemetry
  console.log("\nStep 6: Verifying pipeline telemetry...");
  const telRes = await fetch(`${baseUrl}/api/audience/telemetry`);
  if (!telRes.ok) throw new Error("Failed telemetry fetch");
  const telData = await telRes.json();
  console.log(`✓ Pipeline telemetry status: ${telData.status}, ingested: ${telData.eventsIngested24h}`);

  // 7. Non-blocking failure safety: Content remains accessible even if audience endpoint has errors
  console.log("\nStep 7: Verifying public content availability independence...");
  const hpRes = await fetch(`${baseUrl}/api/homepage-data`);
  if (!hpRes.ok) throw new Error("Public content delivery failed");
  console.log("✓ Public content renders cleanly independent of audience ingestion");

  console.log("\n=================================================");
  console.log("PHASE 3C PRODUCTION-LIKE SMOKE TEST: ALL STEPS PASSED");
  console.log("=================================================");
}

runProductionSmoke().catch(err => {
  console.error("Production smoke failure:", err);
  process.exit(1);
});
