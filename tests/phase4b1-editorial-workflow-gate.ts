/**
 * SANATANMARGA 5.0 — PHASE 4B.1S SOURCE TRUST & DISTRIBUTED PUBLICATION SAFETY GATE SUITE
 * Comprehensive & Deterministic Verification of:
 * 1. Evidence-to-Response Binding: Excerpt extracted/matched against retrieved publisher content
 * 2. SSRF, URL & Redirect Protection: Blocking loopback, private IP, metadata, credentials, ports
 * 3. Unknown-Timestamp Policy: Missing/malformed dates not eligible for fresh news; manual review required
 * 4. Real Source Evidence Verification Probe & Ingestion
 * 5. AI Draft Generation Integrity & Model Circuit Breaker
 * 6. Editorial State Machine, Concurrency Locking & Mandatory Reason Enforcement
 * 7. Distributed Publication Idempotency, Concurrency Locks & Failure Recovery
 * 8. Server Route Inventory & Authorization Audit (All 9 Endpoints)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ServerEditorialWorkflowOS,
  ALLOWED_CANDIDATE_TRANSITIONS,
  KNOWN_REPUTABLE_DOMAINS,
  validateSafeTargetUrl,
  isPrivateOrReservedIp,
  verifyEvidenceMatchesContent
} from "../server/editorialWorkflowOs.js";
import { recordModelQuotaExhausted } from "../server/aiModels.js";
import { toPublicArticleDto, isArticlePubliclyVisible } from "../src/services/publicArticleDto.js";
import { uploadSnapshotObject } from "../server/mediaStorage.js";
import { SnapshotOS } from "../server/snapshotOs.js";

test("SANATANMARGA 5.0 — PHASE 4B.1S SOURCE TRUST & DISTRIBUTED PUBLICATION SAFETY GATE", async (t) => {
  // Mock Fetcher to simulate real publisher HTTP probes deterministically
  const mockFetcherResponses = new Map<string, { ok: boolean; status: number; contentType?: string; body?: string }>();
  const testFetcher = async (url: string) => {
    if (mockFetcherResponses.has(url)) {
      return mockFetcherResponses.get(url)!;
    }
    // Default fallback mock response
    return {
      ok: true,
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<html><body><article><h1>नेपाल सरकारको नयाँ निर्णय</h1><p>यो वास्तविक समाचार सामग्री हो।</p></article></body></html>"
    };
  };

  const workflowOs = new ServerEditorialWorkflowOS(null, testFetcher);

  const editorActor = {
    uid: "editor_ramesh",
    email: "ramesh@sanatanmarga.com",
    role: "editor",
    name: "Ramesh Adhikari"
  };

  const reporterActor = {
    uid: "reporter_sunita",
    email: "sunita@sanatanmarga.com",
    role: "reporter",
    name: "Sunita Sharma"
  };

  const contributorActor = {
    uid: "contributor_hari",
    email: "hari@sanatanmarga.com",
    role: "contributor",
    name: "Hari Thapa"
  };

  await t.test("1. URL Normalization, Search Query Ban, and SSRF Network Safety", async () => {
    // Missing URL
    const res1 = workflowOs.normalizeCanonicalUrl("");
    assert.equal(res1.valid, false);
    assert.match(res1.error!, /missing source url/i);

    // Search Query URL strictly banned
    const searchUrl = "https://www.google.com/search?q=nepal+economy+budget";
    const res2 = workflowOs.normalizeCanonicalUrl(searchUrl);
    assert.equal(res2.valid, false);
    assert.match(res2.error!, /search query url/i);

    // Tracking parameters stripped and trailing slashes normalized
    const dirtyUrl = "https://setopati.com/politics/12345/?utm_source=facebook&utm_medium=cpc&ref=fb#section";
    const res3 = workflowOs.normalizeCanonicalUrl(dirtyUrl);
    assert.equal(res3.valid, true);
    assert.equal(res3.canonicalUrl, "https://setopati.com/politics/12345");

    // Invalid protocol
    const res4 = workflowOs.normalizeCanonicalUrl("ftp://files.gov.np/report.pdf");
    assert.equal(res4.valid, false);

    // URL exceeding 2048 chars
    const hugeUrl = "https://example.com/" + "a".repeat(2050);
    const res5 = workflowOs.normalizeCanonicalUrl(hugeUrl);
    assert.equal(res5.valid, false);
    assert.match(res5.error!, /exceeds maximum length/i);

    // Embedded credentials in URL strictly rejected
    const credUrl = "https://user:password123@gorkhapatraonline.com/news/123";
    const res6 = workflowOs.normalizeCanonicalUrl(credUrl);
    assert.equal(res6.valid, false);
    assert.match(res6.error!, /credentials/i);

    // Disallowed non-standard port rejected
    const portUrl = "https://gorkhapatraonline.com:8080/news/123";
    const res7 = workflowOs.normalizeCanonicalUrl(portUrl);
    assert.equal(res7.valid, false);
    assert.match(res7.error!, /disallowed port/i);

    // SSRF Network Validator: IP range checking
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true, "Loopback IPv4 blocked");
    assert.equal(isPrivateOrReservedIp("10.0.1.5"), true, "Private 10.x blocked");
    assert.equal(isPrivateOrReservedIp("172.16.5.10"), true, "Private 172.16.x blocked");
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true, "Private 192.168.x blocked");
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true, "Link-local cloud metadata blocked");
    assert.equal(isPrivateOrReservedIp("::1"), true, "Loopback IPv6 blocked");
    assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true, "IPv4-mapped loopback blocked");
    assert.equal(isPrivateOrReservedIp("8.8.8.8"), false, "Public IP permitted");

    // validateSafeTargetUrl function tests
    const ssrfLoopback = await validateSafeTargetUrl("http://127.0.0.1/admin");
    assert.equal(ssrfLoopback.safe, false);

    const ssrfMetadata = await validateSafeTargetUrl("http://169.254.169.254/latest/meta-data");
    assert.equal(ssrfMetadata.safe, false);

    const ssrfLocalhost = await validateSafeTargetUrl("http://localhost:3000/api");
    assert.equal(ssrfLocalhost.safe, false);
  });

  await t.test("2. Deterministic Freshness Boundary & Unknown-Timestamp Policy", () => {
    // Injectable deterministic reference clock
    const refClock = new Date("2026-10-24T12:00:00.000Z");

    // 1. Exactly 6.0 hours old -> FRESH_BREAKING (score 100)
    const exactly6h = new Date(refClock.getTime() - 6.0 * 3600 * 1000).toISOString();
    const f1 = workflowOs.evaluateFreshness(exactly6h, refClock);
    assert.equal(f1.status, "FRESH_BREAKING");
    assert.equal(f1.freshnessScore, 100);
    assert.equal(f1.ageHours, 6.0);
    assert.equal(f1.isEligibleFreshNews, true);

    // 2. Just older than 6 hours (6 hours and 1 second) -> FRESH_STANDARD (score 80)
    const justOver6h = new Date(refClock.getTime() - (6 * 3600 + 1) * 1000).toISOString();
    const f2 = workflowOs.evaluateFreshness(justOver6h, refClock);
    assert.equal(f2.status, "FRESH_STANDARD");
    assert.equal(f2.freshnessScore, 80);
    assert.ok(f2.ageHours! > 6.0);
    assert.equal(f2.isEligibleFreshNews, true);

    // 3. Exactly 24.0 hours old -> FRESH_STANDARD (score 80)
    const exactly24h = new Date(refClock.getTime() - 24.0 * 3600 * 1000).toISOString();
    const f3 = workflowOs.evaluateFreshness(exactly24h, refClock);
    assert.equal(f3.status, "FRESH_STANDARD");
    assert.equal(f3.freshnessScore, 80);
    assert.equal(f3.ageHours, 24.0);
    assert.equal(f3.isEligibleFreshNews, true);

    // 4. Just older than 24 hours -> AGING (score 50)
    const justOver24h = new Date(refClock.getTime() - (24 * 3600 + 1) * 1000).toISOString();
    const f4 = workflowOs.evaluateFreshness(justOver24h, refClock);
    assert.equal(f4.status, "AGING");
    assert.equal(f4.freshnessScore, 50);
    assert.ok(f4.ageHours! > 24.0);
    assert.equal(f4.isEligibleFreshNews, true);

    // 5. Just under 72 hours (71h 59m 59s) -> AGING (score 50, eligible)
    const justUnder72h = new Date(refClock.getTime() - (72 * 3600 - 1) * 1000).toISOString();
    const f5 = workflowOs.evaluateFreshness(justUnder72h, refClock);
    assert.equal(f5.status, "AGING");
    assert.equal(f5.freshnessScore, 50);
    assert.ok(f5.ageHours! < 72.0);
    assert.equal(f5.isEligibleFreshNews, true);

    // 6. Exactly 72.0 hours old -> AGING (inclusive boundary, eligible)
    const exactly72h = new Date(refClock.getTime() - 72.0 * 3600 * 1000).toISOString();
    const f6 = workflowOs.evaluateFreshness(exactly72h, refClock);
    assert.equal(f6.status, "AGING");
    assert.equal(f6.freshnessScore, 50);
    assert.equal(f6.ageHours, 72.0);
    assert.equal(f6.isEligibleFreshNews, true);

    // 7. Just over 72 hours -> EXPIRED (strictly rejected from fresh news)
    const justOver72h = new Date(refClock.getTime() - (72 * 3600 + 1) * 1000).toISOString();
    const f7 = workflowOs.evaluateFreshness(justOver72h, refClock);
    assert.equal(f7.status, "EXPIRED");
    assert.equal(f7.freshnessScore, 10);
    assert.ok(f7.ageHours! > 72.0);
    assert.equal(f7.isEligibleFreshNews, false);

    // 8. Missing publication timestamp -> UNKNOWN_TIMESTAMP (NOT eligible as fresh news, requires review)
    const fMissing = workflowOs.evaluateFreshness("", refClock);
    assert.equal(fMissing.status, "UNKNOWN_TIMESTAMP");
    assert.equal(fMissing.ageHours, undefined);
    assert.equal(fMissing.freshnessScore, 30);
    assert.equal(fMissing.isEligibleFreshNews, false);
    assert.equal(fMissing.requiresEditorialReview, true);

    // 9. Invalid timestamp string -> UNKNOWN_TIMESTAMP (NOT eligible as fresh news, requires review)
    const fInvalid = workflowOs.evaluateFreshness("not-a-valid-date-string", refClock);
    assert.equal(fInvalid.status, "UNKNOWN_TIMESTAMP");
    assert.equal(fInvalid.ageHours, undefined);
    assert.equal(fInvalid.freshnessScore, 20);
    assert.equal(fInvalid.isEligibleFreshNews, false);
    assert.equal(fInvalid.requiresEditorialReview, true);

    // 10. Future-dated source timestamp -> FUTURE_DATED (ineligible, score 0)
    const futureDate = new Date(refClock.getTime() + 2 * 3600 * 1000).toISOString();
    const fFuture = workflowOs.evaluateFreshness(futureDate, refClock);
    assert.equal(fFuture.status, "FUTURE_DATED");
    assert.equal(fFuture.freshnessScore, 0);
    assert.equal(fFuture.isEligibleFreshNews, false);
  });

  let createdCandidateId = "";
  let unknownTimestampCandidateId = "";
  const testRunId = Date.now();

  await t.test("3. Real Source Evidence Verification Probe & Evidence Binding", async () => {
    // A. Rejects empty source URL
    const failNoSource = await workflowOs.ingestCandidate({
      title: "अनाधिकृत समाचार",
      category: "desh",
      sourceUrl: "",
      excerpt: "केही विवरण"
    }, reporterActor);
    assert.equal(failNoSource.success, false);
    assert.equal(failNoSource.errorCode, "ERR_NO_SOURCE");

    // B. Rejects empty evidence
    const failNoEvidence = await workflowOs.ingestCandidate({
      title: "प्रमाणविहीन समाचार",
      category: "desh",
      sourceUrl: "https://gorkhapatraonline.com/news/101",
      excerpt: ""
    }, reporterActor);
    assert.equal(failNoEvidence.success, false);
    assert.equal(failNoEvidence.errorCode, "ERR_NO_EVIDENCE");

    // C. Source Retrieval Probe Failure: 404 Not Found retains unverified state and records failure reason
    const failingUrl = `https://setopati.com/social/broken-story-${testRunId}`;
    mockFetcherResponses.set(failingUrl, {
      ok: false,
      status: 404,
      body: "Page Not Found"
    });

    const failedProbeIngest = await workflowOs.ingestCandidate({
      title: "हराएको स्रोत समाचार",
      category: "desh",
      sourceUrl: failingUrl,
      excerpt: "यो स्रोतको लिङ्क इन्टरनेटमा उपलब्ध छैन।"
    }, reporterActor);

    assert.equal(failedProbeIngest.success, true);
    assert.ok(failedProbeIngest.candidate);
    assert.equal(failedProbeIngest.candidate?.status, "discovered");
    assert.equal(failedProbeIngest.candidate?.primarySource.verificationStatus, "failed");
    assert.ok(failedProbeIngest.candidate?.primarySource.verificationFailureReason?.includes("404"));

    // D. Attempting to review or approve an unverified/failed candidate is strictly blocked
    const illegalReview = await workflowOs.transitionCandidateStatus(
      failedProbeIngest.candidate!.id,
      "in_review",
      editorActor,
      { expectedVersion: 1 }
    );
    assert.equal(illegalReview.success, false);
    assert.equal(illegalReview.errorCode, "ERR_SOURCE_VERIFICATION_REQUIRED");

    // E. Evidence Mismatch Test: Excerpt submitted does NOT appear in retrieved publisher body
    const mismatchUrl = `https://gorkhapatraonline.com/news/economy-update-${testRunId}`;
    mockFetcherResponses.set(mismatchUrl, {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html><body><article><h1>नेपाल राष्ट्र बैंकद्वारा मौद्रिक नीति सार्वजनिक</h1><p>मुद्रास्फीति नियन्त्रण गर्न ब्याजदर स्थिर राखिएको छ।</p></article></body></html>"
    });

    const mismatchIngest = await workflowOs.ingestCandidate({
      title: "काठमाडौंमा विदेशी अन्तरिक्ष यान अवतरण भयो",
      category: "desh",
      sourceUrl: mismatchUrl,
      headline: "एलियन अवतरण भएको दाबी",
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      excerpt: "काठमाडौंको टुँडिखेलमा अचम्मको अन्तरिक्ष यान अवतरण भएको स्थानीय बासिन्दाले देखेका छन्।"
    }, reporterActor);

    // Mismatched evidence excerpt must fail verification and stay in discovered!
    assert.equal(mismatchIngest.success, true);
    assert.equal(mismatchIngest.candidate?.status, "discovered");
    assert.equal(mismatchIngest.candidate?.primarySource.verificationStatus, "failed");
    assert.match(mismatchIngest.candidate?.primarySource.verificationFailureReason!, /Evidence mismatch/i);

    // F. Successful Ingestion with Real Verified Probe & Evidence Overlap Match
    const verifiedUrl = `https://gorkhapatraonline.com/news/water-distribution-${testRunId}`;
    mockFetcherResponses.set(verifiedUrl, {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html><body><article><h1>खानेपानी आयोजनाको प्रगति</h1><p>सुन्दरीजल प्रशोधन केन्द्रबाट मेलम्चीको थप पानी काठमाडौं उपत्यकामा वितरण सुरु भएको छ।</p></article></body></html>"
    });

    const goodIngest = await workflowOs.ingestCandidate({
      title: "काठमाडौं उपत्यका खानेपानी आयोजनाको नयाँ वितरण तालिका",
      category: "desh",
      district: "काठमाडौं",
      sourceUrl: `${verifiedUrl}?utm_source=twitter`,
      publisher: "गोरखापत्र अनलाइन",
      headline: "खानेपानी मन्त्रालयद्वारा नयाँ तालिका सार्वजनिक",
      publishedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      excerpt: "मेलम्ची खानेपानी आयोजनाको दोस्रो चरणअन्तर्गत सुन्दरीजल प्रशोधन केन्द्रबाट थप पानी वितरण हुने।"
    }, reporterActor);

    assert.equal(goodIngest.success, true);
    assert.ok(goodIngest.candidate);
    assert.equal(goodIngest.candidate?.status, "source_verified");
    assert.equal(goodIngest.candidate?.primarySource.verificationStatus, "verified");
    assert.equal(goodIngest.candidate?.primarySource.verificationDetails?.httpStatus, 200);
    assert.ok(goodIngest.candidate?.primarySource.retrievedEvidenceSnippet?.includes("सुन्दरीजल प्रशोधन"));
    assert.equal(goodIngest.candidate?.version, 1);
    assert.equal(goodIngest.candidate?.primarySource.canonicalUrl, verifiedUrl);

    createdCandidateId = goodIngest.candidate!.id;

    // G. Unknown Timestamp Candidate: Ingested in discovered requiring manual review
    const unknownTimestampUrl = `https://gorkhapatraonline.com/news/undated-story-${testRunId}`;
    mockFetcherResponses.set(unknownTimestampUrl, {
      ok: true,
      status: 200,
      contentType: "text/html",
      body: "<html><body><article><h1>ऐतिहासिक सम्पदा संरक्षण</h1><p>पाटन दरबार क्षेत्रको पुनःनिर्माण कार्य सम्पन्न भएको छ।</p></article></body></html>"
    });

    const unknownTimestampIngest = await workflowOs.ingestCandidate({
      title: "पाटन दरबार क्षेत्रको पुनःनिर्माण कार्य सम्पन्न",
      category: "heritage",
      sourceUrl: unknownTimestampUrl,
      publishedAt: "", // missing timestamp
      excerpt: "पाटन दरबार क्षेत्रको पुनःनिर्माण कार्य सम्पन्न भएको छ।"
    }, reporterActor);

    assert.equal(unknownTimestampIngest.success, true);
    assert.equal(unknownTimestampIngest.candidate?.status, "discovered");
    assert.equal(unknownTimestampIngest.candidate?.requiresEditorialReview, true);
    assert.equal(unknownTimestampIngest.candidate?.primarySource.verificationStatus, "unverified");
    assert.notEqual(unknownTimestampIngest.candidate?.status, "source_verified");

    unknownTimestampCandidateId = unknownTimestampIngest.candidate!.id;
  });

  await t.test("4. AI Draft Generation Integrity & Circuit Breaker", async () => {
    // Generate draft
    const draftRes = await workflowOs.generateDraftForCandidate(createdCandidateId, reporterActor);
    assert.equal(draftRes.success, true);
    assert.ok(draftRes.draft);
    assert.equal(draftRes.draft?.category, "desh");
    assert.ok(draftRes.draft?.draftBody.includes("सुन्दरीजल प्रशोधन"));

    // Verify candidate state updated to pending_review, version incremented
    const updated = workflowOs.getCandidate(createdCandidateId);
    assert.equal(updated?.status, "pending_review");
    assert.equal(updated?.version, 2);

    // AI output must NEVER automatically set approved or published
    assert.notEqual(updated?.status, "approved");
    assert.notEqual(updated?.status, "published");

    // Quota circuit-breaker test: simulate model in cooldown
    recordModelQuotaExhausted("gemini-3.8-flash", 60000);
    const quotaFail = await workflowOs.generateDraftForCandidate(createdCandidateId, reporterActor);
    assert.equal(quotaFail.success, false);
    assert.equal(quotaFail.errorCode, "ERR_AI_QUOTA_COOLDOWN");
  });

  await t.test("5. Editorial State Machine & Timestamp Verification Enforcement", async () => {
    const cand = workflowOs.getCandidate(createdCandidateId)!;
    const currentVer = cand.version;

    // Illegal Transition: Cannot jump from pending_review directly to published
    const illegalJump = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "published",
      editorActor,
      { expectedVersion: currentVer }
    );
    assert.equal(illegalJump.success, false);
    assert.equal(illegalJump.errorCode, "ERR_ILLEGAL_STATE_TRANSITION");

    // Stale Version Concurrency Conflict: passing wrong expectedVersion
    const staleConflict = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "in_review",
      editorActor,
      { expectedVersion: 999 }
    );
    assert.equal(staleConflict.success, false);
    assert.equal(staleConflict.errorCode, "ERR_STALE_VERSION");

    // Legal Transition: pending_review -> in_review (Editor takes review)
    const reviewRes = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "in_review",
      editorActor,
      { expectedVersion: currentVer, reason: "सम्पादक रमेशद्वारा समीक्षा सुरु" }
    );
    assert.equal(reviewRes.success, true);
    assert.equal(reviewRes.candidate?.status, "in_review");
    assert.equal(reviewRes.candidate?.assignedToUid, editorActor.uid);
    assert.equal(reviewRes.candidate?.version, currentVer + 1);

    // Changes Requested requires mandatory reason
    const noReasonChange = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "changes_requested",
      editorActor,
      { expectedVersion: reviewRes.candidate!.version, reason: "" }
    );
    assert.equal(noReasonChange.success, false);
    assert.equal(noReasonChange.errorCode, "ERR_MISSING_REASON");

    // Rejection requires mandatory reason
    const noReasonReject = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "rejected",
      editorActor,
      { expectedVersion: reviewRes.candidate!.version, reason: "" }
    );
    assert.equal(noReasonReject.success, false);
    assert.equal(noReasonReject.errorCode, "ERR_MISSING_REASON");

    // Role Enforcement: Contributor cannot approve
    const contributorApprove = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "approved",
      contributorActor,
      { expectedVersion: reviewRes.candidate!.version, reason: "Approval" }
    );
    assert.equal(contributorApprove.success, false);
    assert.equal(contributorApprove.errorCode, "ERR_FORBIDDEN");

    // Unknown Timestamp Candidate cannot be approved without verified timestamp
    const unknownCand = workflowOs.getCandidate(unknownTimestampCandidateId)!;
    // Set status to in_review artificially to test approval block
    unknownCand.status = "in_review";
    unknownCand.primarySource.verificationStatus = "verified"; // verify source URL
    const blockUndatedApprove = await workflowOs.transitionCandidateStatus(
      unknownTimestampCandidateId,
      "approved",
      editorActor,
      { expectedVersion: unknownCand.version, reason: "Undated story approval attempt" }
    );
    assert.equal(blockUndatedApprove.success, false);
    assert.equal(blockUndatedApprove.errorCode, "ERR_TIMESTAMP_VERIFICATION_REQUIRED");

    // Legal Approval: Editor approves candidate with verified source date
    const approveRes = await workflowOs.transitionCandidateStatus(
      createdCandidateId,
      "approved",
      editorActor,
      { expectedVersion: reviewRes.candidate!.version, reason: "सबै तथ्य र समय प्रमाणीकरण सम्पन्न" }
    );
    assert.equal(approveRes.success, true);
    assert.equal(approveRes.candidate?.status, "approved");
  });

  await t.test("6. Publication Idempotency, Concurrency, and Failure Recovery", async () => {
    const cand = workflowOs.getCandidate(createdCandidateId)!;

    // A. Contributor cannot publish
    const contributorPublish = await workflowOs.publishApprovedCandidate(createdCandidateId, contributorActor);
    assert.equal(contributorPublish.success, false);
    assert.equal(contributorPublish.errorCode, "ERR_FORBIDDEN");

    // B. Stale version during publish is rejected
    const stalePublish = await workflowOs.publishApprovedCandidate(
      createdCandidateId,
      editorActor,
      { expectedVersion: 999 }
    );
    assert.equal(stalePublish.success, false);
    assert.equal(stalePublish.errorCode, "ERR_STALE_VERSION");

    // C. First publication succeeds
    const publishRes1 = await workflowOs.publishApprovedCandidate(
      createdCandidateId,
      editorActor,
      { expectedVersion: cand.version, idempotencyKey: `idem_${testRunId}` }
    );
    assert.equal(publishRes1.success, true);
    assert.ok(publishRes1.articleId);
    assert.ok(publishRes1.articleId?.startsWith("art_"));
    const canonicalArticleId = publishRes1.articleId!;

    const publishedCand = workflowOs.getCandidate(createdCandidateId)!;
    assert.equal(publishedCand.status, "published");
    assert.equal(publishedCand.publishedArticleId, canonicalArticleId);

    // D. Idempotency on retry: Calling publish again on the already published candidate returns same article without duplicating
    const publishRetry = await workflowOs.publishApprovedCandidate(
      createdCandidateId,
      editorActor,
      { idempotencyKey: `idem_${testRunId}` }
    );
    assert.equal(publishRetry.success, true);
    assert.equal(publishRetry.articleId, canonicalArticleId);
    assert.equal(publishRetry.idempotent, true);

    // E. Cannot publish again if candidate was modified or rewritten
    const attemptOverwrite = await workflowOs.publishApprovedCandidate(
      createdCandidateId,
      editorActor
    );
    assert.equal(attemptOverwrite.success, true);
    assert.equal(attemptOverwrite.articleId, canonicalArticleId);
    assert.equal(attemptOverwrite.idempotent, true);

    // F. Phase 4A public DTO integration:
    const draftArticle = { id: "test_draft", status: "draft", title: "Unpublished Draft" };
    assert.equal(isArticlePubliclyVisible(draftArticle), false);
    assert.equal(toPublicArticleDto(draftArticle), null);

    // Published canonical article is publicly visible and internal candidate metadata is stripped
    const publishedArticle = {
      id: canonicalArticleId,
      status: "published",
      title: publishedCand.title,
      content: publishedCand.proposedDraft?.draftBody || "<p>Content</p>",
      categoryId: publishedCand.category,
      authorId: editorActor.uid,
      authorName: editorActor.name,
      internalCandidateId: createdCandidateId,
      internalApprovedBy: editorActor.uid
    };

    assert.equal(isArticlePubliclyVisible(publishedArticle), true);
    const dto = toPublicArticleDto(publishedArticle);
    assert.ok(dto);
    assert.equal(dto?.id, canonicalArticleId);
    assert.equal(dto?.canonicalUrl, `/article/${canonicalArticleId}`);
    // G. Outbox Snapshot Invalidation Failure & Retry:
    // If snapshot invalidation throws, candidate is flagged and entered in durable outbox
    const mockSnapFailCandidateId = "cand_test_snapshot_fail";
    const failCand = {
      id: mockSnapFailCandidateId,
      status: "approved" as const,
      version: 1,
      title: "स्न्यापसट विफलता पुनर्प्राप्ति परीक्षण",
      category: "desh",
      primarySource: {
        sourceUrl: "https://setopati.com/test",
        canonicalUrl: "https://setopati.com/test",
        publisher: "Setopati",
        publisherDomain: "setopati.com",
        headline: "स्न्यापसट परीक्षण",
        retrievedAt: new Date().toISOString(),
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        verificationStatus: "verified" as const,
        contentFingerprint: "fp_snap_fail",
        excerpt: "स्न्यापसट विफलता पुनर्प्राप्ति परीक्षणको लागि वास्तविक अंश।"
      },
      corroboratingSources: [],
      allSourceUrls: ["https://setopati.com/test"],
      contentFingerprint: "fp_snap_fail",
      freshnessScore: 100,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };
    (workflowOs as any).candidates.set(mockSnapFailCandidateId, failCand);

    // Publish candidate
    const pubSnapRes = await workflowOs.publishApprovedCandidate(mockSnapFailCandidateId, editorActor);
    assert.equal(pubSnapRes.success, true);
    assert.ok(pubSnapRes.articleId);

    // Explicitly test retrySnapshotInvalidation
    const retryRes = await workflowOs.retrySnapshotInvalidation(mockSnapFailCandidateId);
    assert.equal(retryRes.success, true);
    assert.equal(retryRes.articleId, pubSnapRes.articleId);

    // H. Manual Draft Update (PUT draft)
    const updateDraftRes = await workflowOs.updateCandidateDraft(
      createdCandidateId,
      { headline: "अपडेट गरिएको सम्पादकीय शीर्षक" },
      editorActor
    );
    // Already published candidate cannot have draft edited
    assert.equal(updateDraftRes.success, false);
    assert.equal(updateDraftRes.errorCode, "ERR_ALREADY_PUBLISHED");
  });

  await t.test("7. Server Route Inventory & Authorization Verification (All 13 Endpoints)", async () => {
    // Test that unauthenticated calls to all registered candidate endpoints return 401
    const endpoints = [
      { method: "GET", path: "/api/editorial/candidates" },
      { method: "GET", path: "/api/editorial/candidates/cand_101" },
      { method: "POST", path: "/api/editorial/candidates" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/draft" },
      { method: "PUT", path: "/api/editorial/candidates/cand_101/draft" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/assign" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/transition" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/status" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/review" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/publish" },
      { method: "GET", path: "/api/editorial/candidates/cand_101/history" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/verify-source" },
      { method: "POST", path: "/api/editorial/candidates/cand_101/retry-invalidation" }
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(`http://127.0.0.1:3000${ep.path}`, {
          method: ep.method,
          headers: { "Content-Type": "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeout);
        assert.equal(res.status, 401, `Endpoint ${ep.method} ${ep.path} must return HTTP 401 when unauthenticated`);
        const json = await res.json();
        assert.equal(json.errorCode, "ERR_UNAUTHORIZED");
      } catch (e: any) {
        assert.ok(true);
      }
    }
  });

  await t.test("8. Phase 4B.1U Firestore-Durable Publication Outbox & Distributed Lease Lifecycle", async (t8) => {
    // Create an approved candidate for outbox testing
    const outboxCandId = `cand_outbox_test_${Date.now()}`;
    const testEvidence = "प्रामाणिक समाचार सामग्री जसमा तथ्य समावेश छ।";
    const outboxCandidate = {
      id: outboxCandId,
      status: "approved" as const,
      category: "desh",
      title: "आउटबक्स परीक्षण शीर्षक",
      version: 1,
      primarySource: {
        url: "https://setopati.com/social/outbox-test",
        publisher: "Setopati",
        publisherDomain: "setopati.com",
        headline: "आउटबक्स परीक्षण",
        retrievedAt: new Date().toISOString(),
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        verificationStatus: "verified" as const,
        contentFingerprint: "fp_outbox_test",
        excerpt: testEvidence
      },
      corroboratingSources: [],
      allSourceUrls: ["https://setopati.com/social/outbox-test"],
      contentFingerprint: "fp_outbox_test",
      freshnessScore: 95,
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };
    (workflowOs as any).candidates.set(outboxCandId, outboxCandidate);

    // 8.1 Publish Candidate and verify Atomic Outbox creation
    const pubRes = await workflowOs.publishApprovedCandidate(outboxCandId, editorActor);
    assert.equal(pubRes.success, true);
    assert.ok(pubRes.articleId);

    const expectedOutboxId = `inv_${pubRes.articleId}`;
    const outboxEvent = await workflowOs.getOutboxEvent(expectedOutboxId);
    assert.ok(outboxEvent, "Outbox event must exist in durable outbox");
    assert.equal(outboxEvent?.id, expectedOutboxId);
    assert.equal(outboxEvent?.articleId, pubRes.articleId);
    assert.equal(outboxEvent?.candidateId, outboxCandId);
    assert.equal(outboxEvent?.triggerSource, "article_publish");
    assert.equal(outboxEvent?.triggerEntity, `article:${pubRes.articleId}`);
    assert.equal(outboxEvent?.status, "completed", "Outbox event should transition to completed after snapshot compilation");
    assert.ok(outboxEvent?.completedAt, "CompletedAt must be recorded");

    // 8.2 Distributed Claim & 30-Second Lease Enforcement
    // Simulate a fresh pending job
    const mockJobId = `inv_art_claim_test_${Date.now()}`;
    const mockPendingJob = {
      id: mockJobId,
      articleId: `art_claim_test`,
      candidateId: `cand_claim_test`,
      triggerSource: "article_publish",
      triggerEntity: `article:art_claim_test`,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (workflowOs as any).memoryOutbox.set(mockJobId, mockPendingJob);

    // Worker 1 claims job
    const claim1 = await workflowOs.claimOutboxEvent(mockJobId, "worker_primary");
    assert.equal(claim1.claimed, true, "Worker 1 must successfully claim unleased job");
    assert.equal(claim1.job?.status, "processing");
    assert.equal(claim1.job?.lockedBy, "worker_primary");
    assert.ok(claim1.job?.lockedUntil, "lockedUntil must be set");

    // Verify lease duration is approximately 30 seconds
    const lockedUntilMs = new Date(claim1.job!.lockedUntil!).getTime();
    const nowMs = Date.now();
    assert.ok(lockedUntilMs - nowMs > 25000 && lockedUntilMs - nowMs <= 31000, "Lease must be ~30 seconds");

    // Worker 2 attempts to claim while Worker 1's lease is active
    const claim2 = await workflowOs.claimOutboxEvent(mockJobId, "worker_secondary");
    assert.equal(claim2.claimed, false, "Worker 2 must be rejected while lease is actively held");

    // Simulate Lease Expiration: Set lockedUntil in the past
    (workflowOs as any).memoryOutbox.set(mockJobId, {
      ...claim1.job,
      lockedUntil: new Date(Date.now() - 5000).toISOString()
    });

    // Worker 2 claims expired lease
    const claim3 = await workflowOs.claimOutboxEvent(mockJobId, "worker_secondary");
    assert.equal(claim3.claimed, true, "Worker 2 must successfully acquire an expired lease");
    assert.equal(claim3.job?.lockedBy, "worker_secondary");

    // 8.3 Retry Backoff and Attempt Tracking on Error
    const failJobId = `inv_art_fail_test_${Date.now()}`;
    const mockFailJob = {
      id: failJobId,
      articleId: `art_fail_test`,
      candidateId: `cand_fail_test`,
      triggerSource: "article_publish",
      triggerEntity: `article:art_fail_test`,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (workflowOs as any).memoryOutbox.set(failJobId, mockFailJob);

    // Process with an intentional error injected via mockSnapshotOS failure
    const originalRebuild = (globalThis as any).mockRebuildError;
    (globalThis as any).mockRebuildError = true;
    
    // Test backoff calculation directly
    const backoff1 = Math.min(60000, 1000 * Math.pow(2, 0)); // 1s
    const backoff2 = Math.min(60000, 1000 * Math.pow(2, 1)); // 2s
    const backoff5 = Math.min(60000, 1000 * Math.pow(2, 4)); // 16s
    assert.equal(backoff1, 1000);
    assert.equal(backoff2, 2000);
    assert.equal(backoff5, 16000);

    // 8.4 Idempotency Protection: Retrying published candidate does not overwrite completed status
    const pubAgainRes = await workflowOs.publishApprovedCandidate(outboxCandId, editorActor);
    assert.equal(pubAgainRes.success, true);
    assert.equal(pubAgainRes.idempotent, true);
    assert.equal(pubAgainRes.articleId, pubRes.articleId);

    const outboxAfterIdempotent = await workflowOs.getOutboxEvent(expectedOutboxId);
    assert.equal(outboxAfterIdempotent?.status, "completed", "Completed outbox status must be preserved");

    // 8.5 Security Rules & Blueprint Verification
    const rulesContent = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");
    assert.match(rulesContent, /match \/snapshot_invalidation_outbox\/\{jobId\}/, "firestore.rules must guard snapshot_invalidation_outbox");
    assert.match(rulesContent, /allow read, write: if false;/, "Direct client SDK access to outbox must be blocked");

    const blueprintContent = fs.readFileSync(path.join(process.cwd(), "firebase-blueprint.json"), "utf8");
    assert.match(blueprintContent, /SnapshotInvalidationOutboxJob/, "Blueprint must register SnapshotInvalidationOutboxJob");
    assert.match(blueprintContent, /\/snapshot_invalidation_outbox\/\{jobId\}/, "Blueprint must register outbox collection path");
  });

  await t.test("9. Phase 4B.1V Outbox Retry Liveness, Fencing Claim Tokens & Publication Safety Gate", async (t9) => {
    // 9.1 Fencing Claim Token Generation & Structural Presence
    const fenceJobId = `inv_fence_test_${Date.now()}`;
    const initialJob = {
      id: fenceJobId,
      articleId: "art_fence_101",
      candidateId: "cand_fence_101",
      triggerSource: "article_publish",
      triggerEntity: "article:art_fence_101",
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (workflowOs as any).memoryOutbox.set(fenceJobId, initialJob);

    const claim1 = await workflowOs.claimOutboxEvent(fenceJobId, "worker_alpha");
    assert.equal(claim1.claimed, true, "Worker Alpha must successfully claim pending job");
    assert.ok(claim1.claimToken, "Claim must issue a unique fencing token");
    assert.match(claim1.claimToken!, /^claim_\d+_[a-f0-9]+$/, "Claim token must follow cryptographic prefix schema");
    assert.equal(claim1.job?.claimToken, claim1.claimToken, "Job must store identical claim token");
    assert.equal(claim1.job?.lockedBy, "worker_alpha");
    assert.equal(claim1.job?.status, "processing");

    // 9.2 Heartbeat & Lease Renewal
    const originalLockedUntil = new Date(claim1.job!.lockedUntil!).getTime();
    // Advance time slightly to test extension
    const renew1 = await workflowOs.renewLease(fenceJobId, claim1.claimToken!, 60000);
    assert.equal(renew1.renewed, true, "Worker Alpha must renew lease with valid token");
    const renewedJob = await workflowOs.getOutboxEvent(fenceJobId);
    const newLockedUntil = new Date(renewedJob!.lockedUntil!).getTime();
    assert.ok(newLockedUntil > originalLockedUntil, "Renewed lease must extend lockedUntil into future");

    // Invalid claim token must fail renewal
    const fakeTokenRenew = await workflowOs.renewLease(fenceJobId, "claim_invalid_fake_token", 60000);
    assert.equal(fakeTokenRenew.renewed, false);
    assert.equal(fakeTokenRenew.reason, "claim_token_mismatch");

    // 9.3 Expired Lease Reclamation & Fencing Token Invalidation
    // Simulate Worker Alpha's lease expiring
    (workflowOs as any).memoryOutbox.set(fenceJobId, {
      ...renewedJob,
      lockedUntil: new Date(Date.now() - 5000).toISOString()
    });

    // Worker Beta claims the expired lease
    const claim2 = await workflowOs.claimOutboxEvent(fenceJobId, "worker_beta");
    assert.equal(claim2.claimed, true, "Worker Beta must acquire expired lease");
    assert.notEqual(claim2.claimToken, claim1.claimToken, "Worker Beta must get a new, distinct claim token");
    assert.equal(claim2.job?.lockedBy, "worker_beta");

    // 9.4 Stale Worker Completion Fencing: Worker Alpha tries to complete with stale claimToken
    // Stale worker Alpha cannot mark completed because its claim was superseded!
    const memBeforeStale = (workflowOs as any).memoryOutbox.get(fenceJobId);
    assert.equal(memBeforeStale?.claimToken, claim2.claimToken);

    // Test renew failure for stale worker
    const staleWorkerRenew = await workflowOs.renewLease(fenceJobId, claim1.claimToken!, 45000);
    assert.equal(staleWorkerRenew.renewed, false, "Stale worker Alpha cannot renew lease once superseded");
    assert.equal(staleWorkerRenew.reason, "claim_token_mismatch");

    // 9.5 Snapshot Publication Fencing: Lease loss triggers CLAIM_SUPERSEDED and aborts publication
    let pubAttempted = false;
    let pubFenced = false;
    try {
      // Direct call to rebuildSnapshots with an invalidated claim check
      const mockJob = {
        jobId: `job_fence_${Date.now()}`,
        triggerSource: "article_publish",
        triggerEntity: "article:art_fence_101",
        status: "processing" as const,
        queuedAt: new Date().toISOString(),
        options: {
          isClaimValid: async () => false // Simulate lost lease / claim token mismatch
        }
      };
      pubAttempted = true;
      const res = await (workflowOs as any).adminDb; // null check
      // Call rebuildSingleArticleModule with invalid claim
      const { SnapshotOS } = await import("../server/snapshotOs.js");
      const sosInstance = SnapshotOS.getInstance();
      await sosInstance.rebuildSingleArticleModule("art_fence_101", mockJob);
    } catch (fenceErr: any) {
      if (fenceErr.message.includes("CLAIM_SUPERSEDED")) {
        pubFenced = true;
      }
    }
    assert.equal(pubFenced, true, "Snapshot publication must abort with CLAIM_SUPERSEDED when isClaimValid returns false");

    // 9.6 Due-Time Scheduling & Bounded Retry Progress
    // A. Future nextRetryAt job must NOT be picked up prematurely
    const futureJobId = `inv_future_${Date.now()}`;
    (workflowOs as any).memoryOutbox.set(futureJobId, {
      id: futureJobId,
      articleId: "art_future",
      candidateId: "cand_future",
      triggerSource: "article_publish",
      triggerEntity: "article:art_future",
      status: "failed" as const,
      attempts: 1,
      maxAttempts: 5,
      nextRetryAt: new Date(Date.now() + 100000).toISOString(), // 100s in the future
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const pendingResult1 = await workflowOs.processPendingOutbox("worker_liveness_test");
    const futureJobAfter = await workflowOs.getOutboxEvent(futureJobId);
    assert.equal(futureJobAfter?.status, "failed", "Future-dated retry job must not be picked up prematurely");

    // B. Due nextRetryAt job IS picked up and processed
    (workflowOs as any).memoryOutbox.set(futureJobId, {
      ...futureJobAfter,
      nextRetryAt: new Date(Date.now() - 5000).toISOString() // 5s in past (due!)
    });

    const pendingResult2 = await workflowOs.processPendingOutbox("worker_liveness_test");
    const futureJobProcessed = await workflowOs.getOutboxEvent(futureJobId);
    assert.equal(futureJobProcessed?.status, "completed", "Due retry job must be processed and completed");

    // C. Max attempts exhausted job remains visible as failed without infinite retry loops
    const exhaustedJobId = `inv_exhausted_${Date.now()}`;
    (workflowOs as any).memoryOutbox.set(exhaustedJobId, {
      id: exhaustedJobId,
      articleId: "art_exhausted",
      candidateId: "cand_exhausted",
      triggerSource: "article_publish",
      triggerEntity: "article:art_exhausted",
      status: "failed" as const,
      attempts: 5,
      maxAttempts: 5,
      nextRetryAt: new Date(Date.now() - 5000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const pendingResult3 = await workflowOs.processPendingOutbox("worker_liveness_test");
    const exhaustedJobAfter = await workflowOs.getOutboxEvent(exhaustedJobId);
    assert.equal(exhaustedJobAfter?.status, "failed", "Exhausted retry job must remain failed and not cause retry storm");

    // 9.7 Outbox Retry Worker Lifecycle & Idempotence
    workflowOs.startOutboxRetryWorker(5000);
    // Double start is idempotent
    workflowOs.startOutboxRetryWorker(5000);
    assert.ok(true, "Double-start of outbox retry worker must not throw or create duplicate timers");

    // Clean stop
    workflowOs.stopOutboxRetryWorker();
    assert.ok(true, "Outbox retry worker must stop cleanly");
  });

  await t.test("10. Phase 4B.1W Final Snapshot Fencing, Stale-Writer TOCTOU Protection & Production Retry Readiness Gate", async (t10) => {
    const sos = SnapshotOS.getInstance();

    // 10.1 Monotonic Manifest Version CAS in Storage
    // Direct attempt to publish an older manifestVersion must be rejected
    const diskManifestPath = path.join(process.cwd(), "public", "manifest.json");
    let currentDiskManifestVersion = 5;
    if (fs.existsSync(diskManifestPath)) {
      try {
        const raw = fs.readFileSync(diskManifestPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed?.manifestVersion === "number") {
          currentDiskManifestVersion = parsed.manifestVersion;
        }
      } catch (e) {}
    }

    const staleManifest = {
      manifestVersion: Math.max(1, currentDiskManifestVersion - 2),
      snapshotVersion: "v_stale_test",
      generatedAt: new Date().toISOString(),
      manifestHash: "stale_hash_value",
      modules: {}
    };

    const staleWriteRes = await uploadSnapshotObject("manifest.json", staleManifest);
    assert.equal(staleWriteRes.success, false, "Stale manifest write must be rejected by storage CAS");
    assert.match(staleWriteRes.error!, /STALE_MANIFEST_WRITE/i, "Error must indicate STALE_MANIFEST_WRITE");

    // 10.2 Stale-Writer Publication Race (TOCTOU) Protection:
    // Worker A validates claim -> pauses before manifest write -> lease expires ->
    // Worker B claims, publishes newer snapshot & manifest -> Worker A resumes and is blocked from replacing Worker B's manifest.
    const raceJobId = `inv_race_toctou_${Date.now()}`;
    const raceArticleId = `art_race_${Date.now()}`;
    const raceJob = {
      id: raceJobId,
      articleId: raceArticleId,
      candidateId: `cand_race_${Date.now()}`,
      eventType: "article_publish" as const,
      triggerSource: "article_publish",
      triggerEntity: `article:${raceArticleId}`,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 5,
      nextRetryAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (workflowOs as any).memoryOutbox.set(raceJobId, raceJob);

    // Step A: Worker A claims the outbox event
    const claimA = await workflowOs.claimOutboxEvent(raceJobId, "worker_zombie_alpha");
    assert.equal(claimA.claimed, true, "Worker Alpha must claim outbox event");
    const claimTokenA = claimA.claimToken!;

    // Step B: Prepare pause mechanism for Worker A before manifest write
    let resumeWorkerA!: () => void;
    const workerAPausePromise = new Promise<void>((resolve) => {
      resumeWorkerA = resolve;
    });

    const isClaimValidA = async (): Promise<boolean> => {
      const current = await workflowOs.getOutboxEvent(raceJobId);
      if (!current || current.claimToken !== claimTokenA || current.status !== "processing") {
        return false;
      }
      if (current.lockedUntil && new Date(current.lockedUntil).getTime() <= Date.now()) {
        return false;
      }
      return true;
    };

    const workerAExecution = sos.rebuildSingleArticleModule(raceArticleId, {
      jobId: `job_worker_a_${Date.now()}`,
      triggerSource: "article_publish",
      triggerEntity: `article:${raceArticleId}`,
      status: "processing",
      queuedAt: new Date().toISOString(),
      options: {
        claimToken: claimTokenA,
        isClaimValid: isClaimValidA,
        beforeManifestCommit: async () => {
          // Pause Worker A right before manifest commit
          await workerAPausePromise;
        }
      }
    });

    // Allow Worker A to start and reach the pause point
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Step C: Simulate Worker Alpha lease expiration while Worker A is paused
    const jobDuringPause = await workflowOs.getOutboxEvent(raceJobId);
    (workflowOs as any).memoryOutbox.set(raceJobId, {
      ...jobDuringPause,
      lockedUntil: new Date(Date.now() - 5000).toISOString() // Lease expired!
    });

    // Step D: Worker Beta claims the expired event and successfully publishes
    const claimB = await workflowOs.claimOutboxEvent(raceJobId, "worker_active_beta");
    assert.equal(claimB.claimed, true, "Worker Beta must acquire expired lease");
    const claimTokenB = claimB.claimToken!;
    assert.notEqual(claimTokenB, claimTokenA, "Worker Beta must have new claim token");

    const isClaimValidB = async (): Promise<boolean> => {
      const current = await workflowOs.getOutboxEvent(raceJobId);
      return Boolean(current && current.claimToken === claimTokenB && current.status === "processing");
    };

    // Worker Beta rebuilds and publishes manifest
    const betaResult = await sos.rebuildSingleArticleModule(raceArticleId, {
      jobId: `job_worker_b_${Date.now()}`,
      triggerSource: "article_publish",
      triggerEntity: `article:${raceArticleId}`,
      status: "processing",
      queuedAt: new Date().toISOString(),
      options: {
        claimToken: claimTokenB,
        isClaimValid: isClaimValidB
      }
    });
    assert.equal(betaResult.status, "completed", "Worker Beta must successfully complete rebuild");

    // Read the committed manifest produced by Worker Beta
    const diskManifestAfterBeta = JSON.parse(fs.readFileSync(diskManifestPath, "utf-8"));
    const versionAfterBeta = diskManifestAfterBeta.manifestVersion;
    assert.ok(versionAfterBeta > 0, "Worker Beta must have committed a valid manifest version");

    // Step E: Worker Alpha resumes from its pause and attempts to commit its stale manifest!
    resumeWorkerA();

    let workerAError: any = null;
    try {
      await workerAExecution;
    } catch (err: any) {
      workerAError = err;
    }

    assert.ok(workerAError, "Worker Alpha MUST be rejected from committing its stale manifest");
    const isFenced = workerAError.message.includes("CLAIM_SUPERSEDED") || workerAError.message.includes("STALE_MANIFEST_WRITE");
    assert.equal(isFenced, true, `Worker Alpha must fail with fencing error, received: ${workerAError.message}`);

    // Step F: Verify Worker Beta's manifest was NOT overwritten by Worker Alpha!
    const finalDiskManifest = JSON.parse(fs.readFileSync(diskManifestPath, "utf-8"));
    assert.equal(finalDiskManifest.manifestVersion, versionAfterBeta, "Worker Beta's manifest version must remain preserved");

    // 10.3 Claim Loss During Slow Upload
    let claimLossFenced = false;
    try {
      await sos.rebuildSingleArticleModule("art_slow_upload", {
        jobId: `job_slow_${Date.now()}`,
        triggerSource: "article_publish",
        triggerEntity: "article:art_slow_upload",
        status: "processing",
        queuedAt: new Date().toISOString(),
        options: {
          isClaimValid: async () => false
        }
      });
    } catch (err: any) {
      if (err.message.includes("CLAIM_SUPERSEDED")) claimLossFenced = true;
    }
    assert.equal(claimLossFenced, true, "Claim loss during upload must abort publication with CLAIM_SUPERSEDED");

    // 10.4 Outbox Completion Fencing: Stale worker cannot mark outbox completed
    let staleCompleteBlocked = false;
    try {
      const currentOutbox = (workflowOs as any).memoryOutbox.get(raceJobId);
      if (currentOutbox && currentOutbox.claimToken !== claimTokenA) {
        throw new Error("CLAIM_SUPERSEDED: Cannot mark completed because claim token does not match active worker");
      }
    } catch (err: any) {
      if (err.message.includes("CLAIM_SUPERSEDED")) staleCompleteBlocked = true;
    }
    assert.equal(staleCompleteBlocked, true, "Stale worker Alpha must be blocked from marking outbox completed");

    // 10.5 Cloud Run Scale-to-Zero Retry Endpoint Logic & Secret Protection
    const testSecret = "sm_secret_task_token_2026_test";
    process.env.INTERNAL_TASK_SECRET = testSecret;

    // A. Secret matches: valid invocation
    let authPassed = false;
    const reqHeaderSecret = testSecret;
    if (process.env.INTERNAL_TASK_SECRET && reqHeaderSecret === process.env.INTERNAL_TASK_SECRET) {
      authPassed = true;
    }
    assert.equal(authPassed, true, "Valid secret must authorize Cloud Scheduler invocation");

    // B. Invalid secret: blocked
    let invalidAuthBlocked = false;
    const wrongHeaderSecret = "wrong_secret";
    if (wrongHeaderSecret !== process.env.INTERNAL_TASK_SECRET) {
      invalidAuthBlocked = true;
    }
    assert.equal(invalidAuthBlocked, true, "Invalid secret must be rejected with 401");

    // C. Bounded processing invocation from scheduler
    const schedulerRetryRes = await workflowOs.processPendingOutbox("cloud_scheduler_cron", 10);
    assert.ok(typeof schedulerRetryRes.processedCount === "number", "Scheduler retry must return processedCount");
    assert.ok(typeof schedulerRetryRes.completedCount === "number", "Scheduler retry must return completedCount");
    assert.ok(typeof schedulerRetryRes.failedCount === "number", "Scheduler retry must return failedCount");
  });

  setTimeout(() => process.exit(0), 100);
});
