/**
 * SANATANMARGA 5.0 — PHASE 4B.2 END-TO-END PLATFORM, TELEMETRY & SCHEDULER GATE
 *
 * Verifies:
 * 1. Phase 1B.3 Scheduler Configuration bounds validation & status telemetry
 * 2. Phase 4B.2 Structured Sentry & Telemetry capture (CAS_CONFLICT, OUTBOX_FAILURE, SCHEDULER_FAILURE, RATE_LIMIT_FALLBACK)
 * 3. Automatic CAS conflict telemetry recording on stale manifest writes (409 STALE_MANIFEST_WRITE)
 * 4. End-to-End Editorial Lifecycle: Candidate -> Approved -> Scheduled -> Tamper Guard Telemetry
 * 5. Production Runbook & Firestore Security Rules invariants (editorial_candidates, snapshot_invalidation_outbox, system_counters)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateAndNormalizeSchedulerConfig,
  SchedulerOS,
} from "../server/schedulerOs.js";
import {
  captureCASConflict,
  captureOutboxFailure,
  captureSchedulerFailure,
  captureRateLimitFallback,
  getTelemetryDiagnostics,
  resetTelemetryDiagnostics,
} from "../server/sentry.js";
import { uploadSnapshotObject } from "../server/mediaStorage.js";
import { ServerEditorialWorkflowOS } from "../server/editorialWorkflowOs.js";
import {
  CANONICAL_12_CATEGORIES,
  NEPAL_PROVINCES,
  NEPAL_77_DISTRICTS,
} from "../src/constants/nepalGeography.js";
import { ROLE_DEFINITIONS } from "../src/constants/permissions.js";
import { NepalMarketService } from "../src/services/nepalMarketService.js";

test("SANATANMARGA 5.0 — PHASE 4B.2 E2E PLATFORM, TELEMETRY & SCHEDULER GATE", async (suite) => {
  const testFetcher = async () => ({
    ok: true,
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<html><body><article><h1>फेज ४बी.२ स्वचालित प्रमाणीकरण</h1><p>यो वास्तविक समाचार सामग्री हो।</p></article></body></html>"
  });

  const workflowOs = new ServerEditorialWorkflowOS(null, testFetcher);
  for (const c of workflowOs.listCandidates({ limit: 1000 }).candidates) {
    if (c.schedulingStatus === "scheduled" || c.schedulingStatus === "processing") {
      c.schedulingStatus = "cancelled";
    }
  }
  workflowOs.saveToDisk();

  const schedulerOs = new SchedulerOS(null, workflowOs, {
    pollingIntervalMs: 5000,
    leaseDurationMs: 10000,
    maxAttempts: 3,
    baseBackoffSeconds: 1,
    maxBatchSize: 10
  });

  const editorActor = {
    uid: "editor_4b2",
    email: "editor@sanatanmarga.com",
    role: "editor",
    name: "Editor 4B.2"
  };

  await suite.test("1. Phase 1B.3 Scheduler Configuration & Bounds Validation", () => {
    const clampedLow = validateAndNormalizeSchedulerConfig({
      pollingIntervalMs: 500, // below min 5,000ms
      leaseDurationMs: 100,   // below min 10,000ms
      maxBatchSize: 0,        // below min 1
      maxAttempts: -3         // below min 1
    });
    assert.equal(clampedLow.pollingIntervalMs, 5000, "Clamps pollingIntervalMs below 5,000ms to 5,000ms");
    assert.equal(clampedLow.leaseDurationMs, 10000, "Clamps leaseDurationMs below 10,000ms to 10,000ms");
    assert.equal(clampedLow.maxBatchSize, 1, "Clamps maxBatchSize below 1 to 1");
    assert.equal(clampedLow.maxAttempts, 1, "Clamps maxAttempts below 1 to 1");

    const clampedHigh = validateAndNormalizeSchedulerConfig({
      pollingIntervalMs: 99999999, // above max 300,000ms
      maxBatchSize: 500,           // above max 25
      maxAttempts: 99              // above max 10
    });
    assert.equal(clampedHigh.pollingIntervalMs, 300000, "Clamps pollingIntervalMs above 300,000ms to 300,000ms");
    assert.equal(clampedHigh.maxBatchSize, 25, "Clamps maxBatchSize above 25 to 25");
    assert.equal(clampedHigh.maxAttempts, 10, "Clamps maxAttempts above 10 to 10");

    const schedStatus = schedulerOs.getSchedulerStatus();
    assert.equal(typeof schedStatus.scheduledCandidatesCount, "number", "Scheduler status exposes scheduledCandidatesCount");
    assert.equal(typeof schedStatus.config?.pollingIntervalMs, "number", "Scheduler status exposes active validated config");
  });

  await suite.test("2. Phase 4B.2 Structured Telemetry Ring Buffer & Scoped Counters", () => {
    resetTelemetryDiagnostics();
    const initialDiag = getTelemetryDiagnostics();
    assert.equal(initialDiag.counters.outboxFailures, 0);
    assert.equal(initialDiag.counters.casConflicts, 0);
    assert.equal(initialDiag.counters.schedulerFailures, 0);
    assert.equal(initialDiag.counters.rateLimitFallbacks, 0);

    captureOutboxFailure({
      jobId: "outbox_test_1",
      candidateId: "cand_test_1",
      articleId: "art_test_1",
      attempt: 2,
      maxAttempts: 5,
      reason: "Simulated R2 timeout"
    });
    captureCASConflict({
      objectKey: "manifest.json",
      incomingGeneration: 4,
      existingGeneration: 5,
      reason: "STALE_MANIFEST_WRITE"
    });
    captureSchedulerFailure({
      candidateId: "cand_sched_1",
      scheduledAt: new Date().toISOString(),
      attempt: 1,
      reason: "Source verification revoked"
    });
    captureRateLimitFallback({
      model: "gemini-2.5-flash",
      purpose: "NEWSROOM_SYNTHESIS",
      cooldownMs: 30000,
      reason: "429 RESOURCE_EXHAUSTED"
    });

    const afterDiag = getTelemetryDiagnostics();
    assert.equal(afterDiag.counters.outboxFailures, 1);
    assert.equal(afterDiag.counters.casConflicts, 1);
    assert.equal(afterDiag.counters.schedulerFailures, 1);
    assert.equal(afterDiag.counters.rateLimitFallbacks, 1);
    assert.equal(afterDiag.recentEvents.length, 4);
  });

  await suite.test("3. Automatic CAS Conflict Telemetry on Stale Manifest Write", async () => {
    const publicManifestPath = path.join(process.cwd(), "public", "manifest.json");
    const backupManifest = fs.existsSync(publicManifestPath) ? fs.readFileSync(publicManifestPath, "utf-8") : null;

    try {
      const gen50Payload = {
        manifestVersion: 50,
        publicationGeneration: 50,
        manifestHash: "hash_gen_50",
        generatedAt: new Date().toISOString(),
        modules: {}
      };
      fs.writeFileSync(publicManifestPath, JSON.stringify(gen50Payload, null, 2));

      const prevCasCount = getTelemetryDiagnostics().counters.casConflicts;
      const staleResult = await uploadSnapshotObject(
        "manifest.json",
        {
          manifestVersion: 42,
          publicationGeneration: 42,
          manifestHash: "hash_gen_42",
          generatedAt: new Date().toISOString(),
          modules: {}
        },
        "no-cache",
        { publicationGeneration: 42 }
      );

      assert.equal(staleResult.success, false);
      assert.equal(staleResult.statusCode, 409);
      assert.equal(
        getTelemetryDiagnostics().counters.casConflicts,
        prevCasCount + 1,
        "Automatically increments CAS_CONFLICT telemetry counter on stale manifest write"
      );
    } finally {
      if (backupManifest !== null) {
        fs.writeFileSync(publicManifestPath, backupManifest);
      }
    }
  });

  await suite.test("4. End-to-End Scheduled Editorial Governance & Tamper Telemetry", async () => {
    const uniqueKey = `4b2_${Date.now()}`;
    const candRes = await workflowOs.ingestCandidate(
      {
        title: `फेज ४बी.२ स्वचालित प्रमाणीकरण परीक्षण समाचार ${uniqueKey}`,
        category: "desh",
        sourceUrl: `https://setopati.com/politics/4b2-test-${uniqueKey}`,
        publishedAt: new Date(Date.now() - 1800000).toISOString(),
        excerpt: "यो वास्तविक समाचार सामग्री हो।",
        publisher: "Setopati",
        skipLiveNetworkProbe: true
      },
      editorActor
    );

    assert.equal(candRes.success, true);
    const candidate = candRes.candidate!;
    candidate.primarySource.verificationStatus = "verified";

    await workflowOs.transitionCandidateStatus(candidate.id, "source_verified", editorActor, { reason: "Verified" });
    await workflowOs.transitionCandidateStatus(candidate.id, "in_review", editorActor, { reason: "In review" });
    await workflowOs.transitionCandidateStatus(candidate.id, "approved", editorActor, { reason: "Approved" });

    const futureIso = new Date(Date.now() + 60000).toISOString();
    const schedRes = await schedulerOs.scheduleCandidate(
      candidate.id,
      { publishAt: futureIso, timezone: "Asia/Kathmandu" },
      editorActor
    );
    assert.equal(schedRes.success, true);
    assert.equal(schedRes.candidate?.schedulingStatus, "scheduled");

    // Simulate post-schedule tamper of primary source verification and make it due now
    candidate.primarySource.verificationStatus = "unverified";
    candidate.schedule!.publishAt = new Date(Date.now() - 5000).toISOString();

    const beforeSchedFailCount = getTelemetryDiagnostics().counters.schedulerFailures;
    const batchResult = await schedulerOs.processDueScheduledCandidates("worker_4b2");

    assert.ok(batchResult.failedCount >= 1, "Scheduler fails closed when primary source verification is tampered");
    assert.ok(Boolean(candidate.schedule?.failureReason), "Candidate schedule records explicit failureReason for UI display");
    assert.equal(
      getTelemetryDiagnostics().counters.schedulerFailures,
      beforeSchedFailCount + 1,
      "Scheduler failure automatically increments SCHEDULER_FAILURE telemetry counter"
    );

    // Clean up test candidate schedule so subsequent test runs start with a clean queue
    candidate.schedulingStatus = "cancelled";
    workflowOs.saveToDisk();
  });

  await suite.test("5. Firestore Rules & Production Runbook Verification", () => {
    const rulesText = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf-8");
    assert.ok(rulesText.includes("match /editorial_candidates/{candidateId}"), "firestore.rules protects editorial_candidates");
    assert.ok(rulesText.includes("match /snapshot_invalidation_outbox/{jobId}"), "firestore.rules protects snapshot_invalidation_outbox");
    assert.ok(rulesText.includes("match /system_counters/{counterId}"), "firestore.rules protects system_counters");
    assert.ok(rulesText.includes("match /radioPresenters/{docId}"), "firestore.rules defines radioPresenters rules");
    assert.ok(rulesText.includes("match /radioArchives/{docId}"), "firestore.rules defines radioArchives rules");
    assert.ok(rulesText.includes("match /academy_acharyas/{docId}"), "firestore.rules defines academy_acharyas rules");
    assert.ok(rulesText.includes("match /academy_scholarships/{docId}"), "firestore.rules defines academy_scholarships rules");
    assert.ok(rulesText.includes("'acharya'") && rulesText.includes("'radio_producer'"), "firestore.rules includes acharya and radio_producer in staff role matrix");

    const runbookText = fs.readFileSync(path.join(process.cwd(), "PRODUCTION_DEPLOYMENT_RUNBOOK.md"), "utf-8");
    assert.ok(
      runbookText.includes("INTERNAL_TASK_SECRET") && runbookText.includes("SCHEDULER_SERVICE_ACCOUNT_EMAIL"),
      "PRODUCTION_DEPLOYMENT_RUNBOOK.md documents Phase 4B.1W / 1B / 4B.2 security & scheduler variables"
    );
  });

  await suite.test("6. Canonical 12 Categories, 7-Province/77-District Registry, 19-Role RBAC & Decommissioned Market Verification", async () => {
    assert.equal(CANONICAL_12_CATEGORIES.length, 12, "Must define exactly 12 canonical news categories");
    const expectedSlugs = [
      "politics", "desh", "pradesh", "bishwo", "economy", "sports",
      "entertainment", "tech", "sanskar", "tourism", "bichar", "development"
    ];
    assert.deepEqual(
      CANONICAL_12_CATEGORIES.map((c) => c.slug),
      expectedSlugs,
      "Canonical 12 categories must match exact specification"
    );

    assert.equal(NEPAL_PROVINCES.length, 7, "Must define all 7 provinces of Nepal");
    assert.equal(NEPAL_77_DISTRICTS.length, 77, "Must define all 77 districts of Nepal");

    const roleKeys = Object.keys(ROLE_DEFINITIONS);
    assert.equal(roleKeys.length, 19, "RBAC matrix must define all 19 canonical platform roles");
    assert.ok(roleKeys.includes("acharya") && roleKeys.includes("radio_producer"), "Must include Acharya and Radio Producer roles");

    const marketSnapshot = await NepalMarketService.getMarketSnapshot();
    assert.ok(marketSnapshot.rates.length > 0, "Civic & Forex snapshot must return items");
    for (const item of marketSnapshot.rates) {
      assert.ok(
        item.category === "forex" || item.category === "civic",
        `Decommissioned market categories (gold, silver, stocks, commodities) must not appear; got ${item.category}`
      );
    }
  });
});
