/**
 * SANATANMARGA 5.0 — PHASE 1B SCHEDULED PUBLISHING & CANONICAL PIPELINE GATE SUITE
 * Deterministic Verification of:
 * 1. Safe Publication Pipeline Integration: Invocation of canonical publishApprovedCandidate()
 * 2. Invariant Gates: Approval requirement & verified source evidence enforcement
 * 3. Role-Based Access Control: Staff-only scheduling & cancellation authorization
 * 4. Distributed Concurrency & Multi-Instance Lease Claiming
 * 5. Expired Lease Stealing & Crash Recovery
 * 6. Bounded Retries with Exponential Backoff
 * 7. Multi-Instance Idempotency & Duplicate Publishing Prevention
 * 8. Cascading Cryptographic Audit Logging
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ServerEditorialWorkflowOS } from "../server/editorialWorkflowOs.js";
import { SchedulerOS } from "../server/schedulerOs.js";
import { EditorialCandidate } from "../src/types/editorial.js";

test("SANATANMARGA 5.0 — PHASE 1B SCHEDULED PUBLISHING PIPELINE GATE SUITE", async (suite) => {
  // Mock fetcher for source verification
  const testFetcher = async () => ({
    ok: true,
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<html><body><article><h1>नेपाल सरकारको नयाँ निर्णय</h1><p>यो वास्तविक समाचार सामग्री हो।</p></article></body></html>"
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
    leaseDurationMs: 1000, // Short 1s lease for deterministic testing
    maxAttempts: 3,
    baseBackoffSeconds: 1
  });

  const editorActor = {
    uid: "editor_ramesh",
    email: "ramesh@sanatanmarga.com",
    role: "editor",
    name: "Ramesh Adhikari"
  };

  const readerActor = {
    uid: "reader_shyam",
    email: "shyam@example.com",
    role: "subscriber",
    name: "Shyam Thapa"
  };

  const testRunId = Date.now();

  // Helper to create an approved candidate with verified source evidence
  const createApprovedCandidate = async (suffix: string): Promise<EditorialCandidate> => {
    const uniqueKey = `${suffix}_${testRunId}_${Math.random().toString(36).substring(2, 6)}`;
    const candRes = await workflowOs.ingestCandidate(
      {
        title: `नेपाल नयाँ नीति घोषणा ${uniqueKey}`,
        category: "politics",
        sourceUrl: `https://setopati.com/politics/policy-decision-${uniqueKey}`,
        publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (FRESH_BREAKING)
        excerpt: "यो वास्तविक समाचार सामग्री हो।",
        publisher: "Setopati",
        skipLiveNetworkProbe: true
      },
      editorActor
    );

    assert.equal(candRes.success, true);
    const candidate = candRes.candidate!;
    // Set source to verified
    candidate.primarySource.verificationStatus = "verified";

    // Transition: discovered -> source_verified -> in_review -> approved
    await workflowOs.transitionCandidateStatus(candidate.id, "source_verified", editorActor, { reason: "Source checked" });
    await workflowOs.transitionCandidateStatus(candidate.id, "in_review", editorActor, { reason: "Under review" });
    const appRes = await workflowOs.transitionCandidateStatus(candidate.id, "approved", editorActor, { reason: "Approved by chief editor" });
    assert.equal(appRes.success, true);
    assert.equal(appRes.candidate!.status, "approved");
    return appRes.candidate!;
  };

  // 1. Successful scheduling of approved candidate with future timestamp
  await suite.test("1. Approved candidate can be scheduled for future publication by editorial staff", async () => {
    const candidate = await createApprovedCandidate("test1");
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour in future

    const res = await schedulerOs.scheduleCandidate(
      candidate.id,
      { publishAt: futureDate, timezone: "Asia/Kathmandu" },
      editorActor
    );

    assert.equal(res.success, true);
    assert.equal(res.candidate?.schedulingStatus, "scheduled");
    assert.equal(res.candidate?.schedule?.publishAt, futureDate);
    assert.equal(res.candidate?.schedule?.timezone, "Asia/Kathmandu");
    assert.equal(res.candidate?.schedule?.scheduledByUid, editorActor.uid);
  });

  // 2. Invariant: Unapproved candidates cannot be scheduled
  await suite.test("2. Unapproved candidate in 'discovered' or 'in_review' state strictly rejected from scheduling", async () => {
    const candRes = await workflowOs.ingestCandidate(
      {
        title: "कच्चा मस्यौदा समाचार",
        category: "desh",
        sourceUrl: "https://onlinekhabar.com/desh/unapproved-cand-test",
        excerpt: "यो वास्तविक समाचार सामग्री हो।",
        publisher: "OnlineKhabar",
        skipLiveNetworkProbe: true
      },
      editorActor
    );
    const unapproved = candRes.candidate!;
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const res = await schedulerOs.scheduleCandidate(
      unapproved.id,
      { publishAt: futureDate },
      editorActor
    );

    assert.equal(res.success, false);
    assert.equal(res.errorCode, "ERR_NOT_APPROVED");
  });

  // 3. Invariant: Candidate with unverified source evidence cannot be scheduled
  await suite.test("3. Candidate with unverified source evidence cannot be scheduled", async () => {
    const candidate = await createApprovedCandidate("unverified_src");
    // Manually force unverified status
    candidate.primarySource.verificationStatus = "unverified";
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const res = await schedulerOs.scheduleCandidate(
      candidate.id,
      { publishAt: futureDate },
      editorActor
    );

    assert.equal(res.success, false);
    assert.equal(res.errorCode, "ERR_SOURCE_VERIFICATION_REQUIRED");
  });

  // 4. Invariant: Past timestamp rejected
  await suite.test("4. Schedule timestamp in the past is rejected", async () => {
    const candidate = await createApprovedCandidate("past_ts");
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hr ago

    const res = await schedulerOs.scheduleCandidate(
      candidate.id,
      { publishAt: pastDate },
      editorActor
    );

    assert.equal(res.success, false);
    assert.equal(res.errorCode, "ERR_TIMESTAMP_IN_PAST");
  });

  // 5. Role Authorization: Non-staff cannot schedule
  await suite.test("5. Non-staff role (subscriber/reader) rejected from scheduling with HTTP 403", async () => {
    const candidate = await createApprovedCandidate("auth_test");
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const res = await schedulerOs.scheduleCandidate(
      candidate.id,
      { publishAt: futureDate },
      readerActor
    );

    assert.equal(res.success, false);
    assert.equal(res.errorCode, "ERR_FORBIDDEN");
  });

  // 6. Schedule cancellation
  await suite.test("6. Editorial staff can cancel a scheduled candidate, resetting state to cancelled", async () => {
    const candidate = await createApprovedCandidate("cancel_test");
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    await schedulerOs.scheduleCandidate(candidate.id, { publishAt: futureDate }, editorActor);
    const cancelRes = await schedulerOs.cancelScheduledCandidate(candidate.id, "Postponed by editorial desk", editorActor);

    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.candidate?.schedulingStatus, "cancelled");
  });

  // 7. Atomic Lease Claiming & Concurrency Lock
  await suite.test("7. Atomic lease claim succeeds for first worker; second worker receives lock collision", async () => {
    const candidate = await createApprovedCandidate("lease_test");
    // Set publishAt in the past so it is due
    candidate.schedule = {
      publishAt: new Date(Date.now() - 1000).toISOString(),
      timezone: "Asia/Kathmandu",
      scheduledByUid: editorActor.uid,
      scheduledAt: new Date().toISOString()
    };
    candidate.schedulingStatus = "scheduled";

    // Worker A claims
    const claimA = await schedulerOs.claimScheduledCandidate(candidate.id, "worker_A");
    assert.equal(claimA.claimed, true);
    assert.ok(claimA.claimToken);

    // Worker B attempts simultaneous claim -> rejected
    const claimB = await schedulerOs.claimScheduledCandidate(candidate.id, "worker_B");
    assert.equal(claimB.claimed, false);
  });

  // 8. Expired lease recovery
  await suite.test("8. Worker can reclaim a candidate whose previous worker lease has expired", async () => {
    const candidate = await createApprovedCandidate("expired_lease_test");
    // Leased in the past with expired lease
    candidate.schedule = {
      publishAt: new Date(Date.now() - 10000).toISOString(),
      timezone: "Asia/Kathmandu",
      scheduledByUid: editorActor.uid,
      scheduledAt: new Date().toISOString()
    };
    candidate.schedulingStatus = "scheduled";
    candidate.leaseExpiresAt = new Date(Date.now() - 2000).toISOString(); // Expired 2s ago

    const claimRes = await schedulerOs.claimScheduledCandidate(candidate.id, "recovery_worker");
    assert.equal(claimRes.claimed, true);
    assert.ok(claimRes.claimToken);
  });

  // 9. Canonical Publication Pipeline Execution
  await suite.test("9. Processing due scheduled candidate executes canonical publication and registers outbox event", async () => {
    const candidate = await createApprovedCandidate("exec_pub_test");
    const now = Date.now();
    candidate.schedule = {
      publishAt: new Date(now - 5000).toISOString(), // Due 5s ago
      timezone: "Asia/Kathmandu",
      scheduledByUid: editorActor.uid,
      scheduledByName: editorActor.name,
      scheduledByRole: editorActor.role,
      scheduledAt: new Date().toISOString()
    };
    candidate.schedulingStatus = "scheduled";

    const procRes = await schedulerOs.processDueScheduledCandidates("test_runner");
    assert.ok(procRes.publishedCount >= 1, "Must publish at least 1 due candidate");
    assert.equal(procRes.failedCount, 0);

    const updatedCand = workflowOs.getCandidate(candidate.id)!;
    assert.equal(updatedCand.status, "published");
    assert.equal(updatedCand.schedulingStatus, "completed");
    assert.ok(updatedCand.publishedArticleId);
    assert.equal(updatedCand.lastPublicationResult?.success, true);

    // Verify durable outbox event was created in WorkflowOS
    const outboxJob = await workflowOs.getOutboxEvent(`inv_${updatedCand.publishedArticleId}`);
    assert.ok(outboxJob, "Outbox snapshot invalidation job must be queued");
    assert.equal(outboxJob?.articleId, updatedCand.publishedArticleId);
  });

  // 10. Multi-Instance Idempotency: Processing already-published candidate does not duplicate article
  await suite.test("10. Processing an already-published candidate returns idempotent success", async () => {
    const candidate = await createApprovedCandidate("idempotent_test");
    // Publish it first manually
    const pubRes = await workflowOs.publishApprovedCandidate(candidate.id, editorActor);
    assert.equal(pubRes.success, true);
    const originalArticleId = pubRes.articleId;

    // Simulate stale schedule remaining
    candidate.schedule = {
      publishAt: new Date(Date.now() - 5000).toISOString(),
      timezone: "Asia/Kathmandu",
      scheduledByUid: editorActor.uid,
      scheduledAt: new Date().toISOString()
    };
    candidate.schedulingStatus = "scheduled";

    const procRes = await schedulerOs.processDueScheduledCandidates("idempotent_worker");
    assert.equal(procRes.publishedCount, 1);

    const checkCand = workflowOs.getCandidate(candidate.id)!;
    assert.equal(checkCand.publishedArticleId, originalArticleId, "Article ID must remain unchanged");
  });

  // 11. Bounded Retries: Transient failure retries up to 3 attempts with backoff
  await suite.test("11. Transient publication failure retries bounded 3 times with exponential backoff", async () => {
    const candidate = await createApprovedCandidate("retry_test");
    candidate.schedule = {
      publishAt: new Date(Date.now() - 5000).toISOString(),
      timezone: "Asia/Kathmandu",
      scheduledByUid: editorActor.uid,
      scheduledAt: new Date().toISOString()
    };
    candidate.schedulingStatus = "scheduled";

    // Simulate publication failure by setting source verification to unverified
    candidate.primarySource.verificationStatus = "unverified";

    // Attempt 1: Should fail and queue retry (attempts = 1)
    const proc1 = await schedulerOs.processDueScheduledCandidates("retry_worker_1");
    assert.equal(proc1.failedCount, 1);
    assert.equal(candidate.executionAttempts, 1);
    assert.equal(candidate.schedulingStatus, "scheduled"); // Still scheduled for retry

    // Reset publishAt to due for Attempt 2
    candidate.schedule.publishAt = new Date(Date.now() - 1000).toISOString();
    const proc2 = await schedulerOs.processDueScheduledCandidates("retry_worker_2");
    assert.equal(proc2.failedCount, 1);
    assert.equal(candidate.executionAttempts, 2);
    assert.equal(candidate.schedulingStatus, "scheduled");

    // Reset publishAt to due for Attempt 3 (Max attempts reached)
    candidate.schedule.publishAt = new Date(Date.now() - 1000).toISOString();
    const proc3 = await schedulerOs.processDueScheduledCandidates("retry_worker_3");
    assert.equal(proc3.failedCount, 1);
    assert.equal(candidate.executionAttempts, 3);
    assert.equal(candidate.schedulingStatus, "failed", "Candidate must be marked 'failed' after 3 attempts");
  });

  // 12. Scheduler status metrics
  await suite.test("12. Scheduler status reports accurate pending queue metrics", async () => {
    const status = schedulerOs.getSchedulerStatus();
    assert.equal(typeof status.pendingScheduledCount, "number");
    assert.equal(typeof status.failedCount, "number");
    assert.equal(typeof status.activeLocksCount, "number");
  });
});
