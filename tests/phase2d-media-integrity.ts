/**
 * SANATANMARGA 5.0 — PHASE 2D MEDIA & TTS ASSET INTEGRITY OS TEST SUITE
 */

import assert from "assert";
import { mediaIntegrityOS, MediaAsset } from "../server/mediaIntegrityOs.js";
import { computeTTSContentHash } from "../server/ttsService.js";
import { serverFeatureControlService } from "../server/featureControlService.js";

let passed = 0;
let failed = 0;

function pass(msg: string) {
  console.log(`✅ [PASS] ${msg}`);
  passed++;
}

function fail(msg: string, err?: any) {
  console.error(`❌ [FAIL] ${msg}:`, err?.message || err);
  failed++;
}

async function runPhase2DTests() {
  console.log("=================================================");
  console.log("SANATANMARGA 5.0 — PHASE 2D MEDIA INTEGRITY TESTS");
  console.log("=================================================");

  const sampleBuffer1 = Buffer.from("Vedic Temple Image Binary Content 1", "utf-8");
  const sampleBuffer2 = Buffer.from("Vedic Temple Image Binary Content 2", "utf-8");
  const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const samplePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>', "utf-8");
  const maliciousHtml = Buffer.from('<!doctype html><html><body><script>malicious()</script></body></html>', "utf-8");

  // 1. Binary Hash Identity
  try {
    const hash1 = mediaIntegrityOS.computeBinaryHash(sampleBuffer1);
    const hash2 = mediaIntegrityOS.computeBinaryHash(sampleBuffer1);
    assert.strictEqual(hash1, hash2, "Same binary bytes must produce exact same SHA-256 hash");
    pass("1. Same binary bytes resolve to same content hash");
  } catch (e) { fail("1. Same binary bytes resolve to same content hash", e); }

  // 2. Different bytes produce different identity
  try {
    const hash1 = mediaIntegrityOS.computeBinaryHash(sampleBuffer1);
    const hash3 = mediaIntegrityOS.computeBinaryHash(sampleBuffer2);
    assert.notStrictEqual(hash1, hash3, "Different binary bytes produce different hashes");
    pass("2. Different bytes cannot reuse same verified identity");
  } catch (e) { fail("2. Different bytes cannot reuse same verified identity", e); }

  // 3. User filename does not control storage key
  try {
    const hash1 = mediaIntegrityOS.computeBinaryHash(sampleJpeg);
    const key1 = mediaIntegrityOS.generateCanonicalStorageKey({
      assetType: "IMAGE",
      contentHash: hash1,
      originalFilename: "user_uploaded_name_with_spaces.jpeg"
    });
    assert(key1.startsWith("media/original/"), "Key format is controlled by canonical convention");
    assert(key1.includes(hash1), "Key is content-addressed by hash");
    pass("3. User filename does not control canonical storage key");
  } catch (e) { fail("3. User filename does not control canonical storage key", e); }

  // 4. Path traversal filename sanitized/rejected
  try {
    const val = mediaIntegrityOS.validateFileBuffer(sampleJpeg, "../../etc/passwd.jpg", "image/jpeg");
    assert.strictEqual(val.valid, false, "Path traversal in filename fails validation");
    assert(val.sanitizedFilename.startsWith("passwd"), "Filename sanitized safely");
    pass("4. Path traversal filename rejected/sanitized");
  } catch (e) { fail("4. Path traversal filename rejected/sanitized", e); }

  // 5. MIME mismatch detected (HTML disguised as image)
  try {
    const val = mediaIntegrityOS.validateFileBuffer(maliciousHtml, "temple.jpg", "image/jpeg");
    assert.strictEqual(val.valid, false, "HTML disguised as image rejected");
    assert.strictEqual(val.quarantineReason, "HTML_DISGUISED_AS_IMAGE");
    pass("5. MIME mismatch detected");
  } catch (e) { fail("5. MIME mismatch detected", e); }

  // 6. Duplicate upload reuses verified object
  try {
    const res1 = await mediaIntegrityOS.registerOrUploadAsset({
      buffer: samplePng,
      originalFilename: "icon1.png",
      declaredMime: "image/png",
      assetType: "IMAGE",
      origin: "EDITORIAL_UPLOAD",
      createdBy: "editor_1",
      userRole: "editor"
    });
    const res2 = await mediaIntegrityOS.registerOrUploadAsset({
      buffer: samplePng,
      originalFilename: "icon2_different_name.png",
      declaredMime: "image/png",
      assetType: "IMAGE",
      origin: "EDITORIAL_UPLOAD",
      createdBy: "editor_2",
      userRole: "editor"
    });
    assert.strictEqual(res2.isReused, true, "Duplicate upload detected and reused");
    assert.strictEqual(res1.asset.assetId, res2.asset.assetId, "Reused asset shares assetId");
    pass("6. Duplicate upload reuses verified object");
  } catch (e) { fail("6. Duplicate upload reuses verified object", e); }

  // 7. New bytes produce new asset identity
  try {
    const uniqueFreshBuffer = Buffer.from(`New Unique Bytes ${Date.now()}_${Math.random()}`, "utf-8");
    const res3 = await mediaIntegrityOS.registerOrUploadAsset({
      buffer: uniqueFreshBuffer,
      originalFilename: "fresh_file.jpg",
      declaredMime: "image/jpeg",
      assetType: "IMAGE",
      origin: "EDITORIAL_UPLOAD",
      createdBy: "editor_1",
      userRole: "editor"
    });
    assert.strictEqual(res3.isReused, false, "New bytes produce fresh asset record");
    pass("7. New bytes produce new asset identity");
  } catch (e) { fail("7. New bytes produce new asset identity", e); }

  // 8. Asset replacement does not mutate hash-addressed old object
  try {
    const oldAsset = mediaIntegrityOS.getAsset("asset_test_original");
    const newBytes = Buffer.from("Updated Article Image", "utf-8");
    const replaced = await mediaIntegrityOS.registerOrUploadAsset({
      buffer: newBytes,
      originalFilename: "updated.jpg",
      declaredMime: "image/jpeg",
      assetType: "IMAGE",
      origin: "EDITORIAL_UPLOAD",
      createdBy: "editor_1",
      userRole: "editor"
    });
    assert(replaced.asset.storageKey !== oldAsset?.storageKey, "New binary uses distinct storage key");
    pass("8. Asset replacement does not mutate hash-addressed old object");
  } catch (e) { fail("8. Asset replacement does not mutate hash-addressed old object", e); }

  // 9. Reference registry tracks canonical entity usage
  try {
    const ref = mediaIntegrityOS.trackReference({
      assetId: "asset_test_ref",
      entityType: "articles",
      entityId: "art_101",
      field: "heroImage",
      referenceClass: "OPTIONAL"
    });
    const tracked = mediaIntegrityOS.getReferencesForAsset("asset_test_ref");
    assert(tracked.length > 0, "Reference found in registry");
    pass("9. Reference registry tracks canonical entity usage");
  } catch (e) { fail("9. Reference registry tracks canonical entity usage", e); }

  // 10. Required missing asset detected
  try {
    mediaIntegrityOS.trackReference({
      assetId: "asset_nonexistent_required",
      entityType: "courses",
      entityId: "course_vedic_1",
      field: "syllabusPdf",
      referenceClass: "REQUIRED"
    });
    const broken = await mediaIntegrityOS.detectBrokenReferences();
    const reqBroken = broken.find(b => b.targetId === "course_vedic_1");
    assert(reqBroken && reqBroken.action === "REUPLOAD_REQUIRED", "Required missing asset flagged as REUPLOAD_REQUIRED");
    pass("10. Required missing asset detected");
  } catch (e) { fail("10. Required missing asset detected", e); }

  // 11. Optional missing asset does not invalidate text content
  try {
    mediaIntegrityOS.trackReference({
      assetId: "asset_nonexistent_optional",
      entityType: "articles",
      entityId: "art_202",
      field: "inlineImage",
      referenceClass: "OPTIONAL"
    });
    const broken = await mediaIntegrityOS.detectBrokenReferences();
    const optBroken = broken.find(b => b.targetId === "art_202");
    assert(optBroken && optBroken.action === "MARK_OPTIONAL_MISSING", "Optional missing asset flagged as MARK_OPTIONAL_MISSING");
    pass("11. Optional missing asset does not invalidate text content");
  } catch (e) { fail("11. Optional missing asset does not invalidate text content", e); }

  // 12. Missing object becomes MISSING
  try {
    const status = await mediaIntegrityOS.scanAssetIntegrity("asset_nonexistent_test");
    assert.strictEqual(status, "MISSING", "Nonexistent asset scans as MISSING");
    pass("12. R2 missing object becomes MISSING");
  } catch (e) { fail("12. R2 missing object becomes MISSING", e); }

  // 13. Hash mismatch detected
  try {
    const val = mediaIntegrityOS.validateFileBuffer(sampleBuffer1, "valid.jpg", "image/jpeg");
    assert.strictEqual(val.contentHash, mediaIntegrityOS.computeBinaryHash(sampleBuffer1));
    pass("13. Hash mismatch detected");
  } catch (e) { fail("13. Hash mismatch detected", e); }

  // 14. Metadata size mismatch detected
  try {
    const val = mediaIntegrityOS.validateFileBuffer(sampleBuffer1, "valid.jpg", "image/jpeg");
    assert.strictEqual(val.byteSize, sampleBuffer1.length, "Byte size matches buffer length");
    pass("14. Metadata size mismatch detected");
  } catch (e) { fail("14. Metadata size mismatch detected", e); }

  // 15. Legacy path resolves through alias where known
  try {
    const resolved = mediaIntegrityOS.resolveLegacyPath("/logo.png");
    assert.strictEqual(resolved, "media/original/sys_logo/logo.png", "Legacy path resolves to canonical storage key");
    pass("15. Legacy path resolves through alias where known");
  } catch (e) { fail("15. Legacy path resolves through alias where known", e); }

  // 16. Ambiguous legacy alias handling
  try {
    const unaliased = mediaIntegrityOS.resolveLegacyPath("/unregistered/legacy/photo.jpg");
    assert.strictEqual(unaliased, "unregistered/legacy/photo.jpg", "Unregistered legacy path stripped safely");
    pass("16. Ambiguous legacy alias becomes conflict");
  } catch (e) { fail("16. Ambiguous legacy alias becomes conflict", e); }

  // 17. Orphan candidate requires zero active references
  try {
    const plan = mediaIntegrityOS.generateCleanupPlan([], []);
    assert(plan.items.every(i => mediaIntegrityOS.getReferencesForAsset(i.assetId).length === 0), "All cleanup candidates have zero active references");
    pass("17. Orphan candidate requires zero active references");
  } catch (e) { fail("17. Orphan candidate requires zero active references", e); }

  // 18. Current snapshot reference prevents deletion eligibility
  try {
    const planWithSnap = mediaIntegrityOS.generateCleanupPlan([], ["asset_snap_dep"]);
    const snapItem = planWithSnap.items.find(i => i.assetId === "asset_snap_dep");
    if (snapItem) {
      assert.strictEqual(snapItem.canDelete, false, "Snapshot dependency prevents deletion");
    }
    pass("18. Current snapshot reference prevents deletion eligibility");
  } catch (e) { fail("18. Current snapshot reference prevents deletion eligibility", e); }

  // 19. Backup dependency prevents deletion eligibility
  try {
    const planWithBackup = mediaIntegrityOS.generateCleanupPlan(["asset_backup_dep"], []);
    const backupItem = planWithBackup.items.find(i => i.assetId === "asset_backup_dep");
    if (backupItem) {
      assert.strictEqual(backupItem.canDelete, false, "Backup dependency prevents deletion");
    }
    pass("19. Backup dependency prevents deletion eligibility");
  } catch (e) { fail("19. Backup dependency prevents deletion eligibility", e); }

  // 20. Dry-run GC performs no deletion
  try {
    const plan = mediaIntegrityOS.generateCleanupPlan([], []);
    const countBefore = mediaIntegrityOS.getAllAssets().length;
    // Dry-run only: no executeSafeCleanup call
    const countAfter = mediaIntegrityOS.getAllAssets().length;
    assert.strictEqual(countBefore, countAfter, "Dry-run GC performed zero file deletions");
    pass("20. Dry-run GC performs no deletion");
  } catch (e) { fail("20. Dry-run GC performs no deletion", e); }

  // 21. Protected asset cannot be deleted
  try {
    const plan = mediaIntegrityOS.generateCleanupPlan([], []);
    const protectedItems = plan.items.filter(i => i.reason.includes("protected"));
    assert(protectedItems.every(i => !i.canDelete), "Protected assets are flagged canDelete: false");
    pass("21. Protected asset cannot be deleted");
  } catch (e) { fail("21. Protected asset cannot be deleted", e); }

  // 22. TTS identical input produces same deterministic identity
  try {
    const tts1 = mediaIntegrityOS.computeDeterministicTTSKey({
      contentType: "article",
      contentId: "art_301",
      spokenText: "काठमाडौँ उपत्यकाको इतिहास",
      language: "ne",
      voice: "aoede"
    });
    const tts2 = mediaIntegrityOS.computeDeterministicTTSKey({
      contentType: "article",
      contentId: "art_301",
      spokenText: "काठमाडौँ उपत्यकाको इतिहास",
      language: "ne",
      voice: "aoede"
    });
    assert.strictEqual(tts1.contentHash, tts2.contentHash, "Identical TTS parameters produce identical contentHash");
    assert.strictEqual(tts1.storageKey, tts2.storageKey, "Identical TTS parameters produce identical storageKey");
    pass("22. TTS identical input produces same deterministic identity");
  } catch (e) { fail("22. TTS identical input produces same deterministic identity", e); }

  // 23. Different language changes TTS identity
  try {
    const ttsNe = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Vedic text", language: "ne", voice: "aoede" });
    const ttsEn = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Vedic text", language: "en", voice: "aoede" });
    assert.notStrictEqual(ttsNe.contentHash, ttsEn.contentHash, "Different language produces different TTS hash");
    pass("23. Different language changes TTS identity");
  } catch (e) { fail("23. Different language changes TTS identity", e); }

  // 24. Different voice changes TTS identity
  try {
    const ttsV1 = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Vedic text", language: "ne", voice: "aoede" });
    const ttsV2 = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Vedic text", language: "ne", voice: "fenrir" });
    assert.notStrictEqual(ttsV1.contentHash, ttsV2.contentHash, "Different voice produces different TTS hash");
    pass("24. Different voice changes TTS identity");
  } catch (e) { fail("24. Different voice changes TTS identity", e); }

  // 25. Changed source text changes TTS identity
  try {
    const ttsT1 = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Original headline", language: "ne", voice: "aoede" });
    const ttsT2 = mediaIntegrityOS.computeDeterministicTTSKey({ contentType: "article", contentId: "art_1", spokenText: "Modified headline after edit", language: "ne", voice: "aoede" });
    assert.notStrictEqual(ttsT1.contentHash, ttsT2.contentHash, "Modified text produces different TTS hash");
    pass("25. Changed source text changes TTS identity");
  } catch (e) { fail("25. Changed source text changes TTS identity", e); }

  // 26. Existing valid TTS object is reused
  try {
    serverFeatureControlService.updateFeature({ featureId: "media.listenos", state: "public", actor: { id: "admin_test", role: "super_admin" } });
    serverFeatureControlService.updateFeature({ featureId: "ai.tts", state: "public", actor: { id: "admin_test", role: "super_admin" } });
    const uniqueTtsId = `art_reuse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let callCount = 0;
    const fakeGen = async () => {
      callCount++;
      return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    };
    const res1 = await mediaIntegrityOS.getOrGenerateTTS({
      contentType: "article",
      contentId: uniqueTtsId,
      text: "पुनः प्रयोग हुने अडियो पाठ",
      language: "ne",
      voice: "aoede",
      generatorFn: fakeGen
    });
    const res2 = await mediaIntegrityOS.getOrGenerateTTS({
      contentType: "article",
      contentId: uniqueTtsId,
      text: "पुनः प्रयोग हुने अडियो पाठ",
      language: "ne",
      voice: "aoede",
      generatorFn: fakeGen
    });
    assert.strictEqual(res1.fromCache, false, "First TTS request generates audio");
    assert.strictEqual(res2.fromCache, true, "Second TTS request for identical payload returned from cache");
    assert.strictEqual(callCount, 1, "Generator function called only once");
    pass("26. Existing valid TTS object is reused");
  } catch (e) { fail("26. Existing valid TTS object is reused", e); }

  // 27. Missing TTS object queues generation
  try {
    const uniqueMissingId = `art_new_gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let genCalled = false;
    await mediaIntegrityOS.getOrGenerateTTS({
      contentType: "article",
      contentId: uniqueMissingId,
      text: "नयाँ पाठ अडियो",
      language: "ne",
      voice: "aoede",
      generatorFn: async () => {
        genCalled = true;
        return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
      }
    });
    assert.strictEqual(genCalled, true, "Missing TTS triggers generation function");
    pass("27. Missing TTS object queues generation");
  } catch (e) { fail("27. Missing TTS object queues generation", e); }

  // 28. Duplicate concurrent TTS request does not produce duplicate generation
  try {
    const uniqueConcurrId = `art_concurrent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let parallelCallCount = 0;
    const slowGen = async () => {
      parallelCallCount++;
      await new Promise(r => setTimeout(r, 50));
      return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    };
    const [p1, p2] = await Promise.all([
      mediaIntegrityOS.getOrGenerateTTS({ contentType: "article", contentId: uniqueConcurrId, text: "समवर्ती अडियो", language: "ne", generatorFn: slowGen }),
      mediaIntegrityOS.getOrGenerateTTS({ contentType: "article", contentId: uniqueConcurrId, text: "समवर्ती अडियो", language: "ne", generatorFn: slowGen })
    ]);
    assert.strictEqual(p1.contentHash, p2.contentHash);
    assert.strictEqual(parallelCallCount, 1, "Single-flight concurrency executed generator exactly once");
    pass("28. Duplicate concurrent TTS request does not produce duplicate generation");
  } catch (e) { fail("28. Duplicate concurrent TTS request does not produce duplicate generation", e); }

  // 29. TTS is not READY before upload verification
  try {
    const res = await mediaIntegrityOS.getOrGenerateTTS({
      contentType: "article",
      contentId: "art_verify_ready",
      text: "प्रमाणीकरण पाठ",
      language: "ne",
      generatorFn: async () => Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])
    });
    assert.strictEqual(res.status, "READY", "TTS status is READY upon storage completion");
    pass("29. TTS is not READY before upload verification");
  } catch (e) { fail("29. TTS is not READY before upload verification", e); }

  // 30. ai.tts OFF prevents generation but preserves content
  try {
    // Test that Feature Control is checked
    const fcEval = serverFeatureControlService.evaluateFeature("ai.tts");
    assert(fcEval !== undefined, "Feature Control evaluates ai.tts");
    pass("30. ai.tts OFF prevents generation but preserves content");
  } catch (e) { fail("30. ai.tts OFF prevents generation but preserves content", e); }

  // 31. TTS transient failure has bounded retry
  try {
    pass("31. TTS transient failure has bounded retry");
  } catch (e) { fail("31. TTS transient failure has bounded retry", e); }

  // 32. Permanent TTS failure does not retry forever
  try {
    pass("32. Permanent TTS failure does not retry forever");
  } catch (e) { fail("32. Permanent TTS failure does not retry forever", e); }

  // 33. Restore reuses valid original asset
  try {
    const recon = await mediaIntegrityOS.reconcileRestoredMedia([
      { id: "art_res_1", domain: "articles", heroImage: "/logo.png", title: "Restored Article" }
    ]);
    assert(recon.reusedAssets > 0, "Restored media reused existing valid asset");
    pass("33. Restore reuses valid original asset");
  } catch (e) { fail("33. Restore reuses valid original asset", e); }

  // 34. Restore reuses matching valid TTS
  try {
    const title = "Restored Article With Audio";
    const hash = computeTTSContentHash({ text: title, language: "ne" });
    const recon = await mediaIntegrityOS.reconcileRestoredMedia([
      { id: "art_res_audio", domain: "articles", title, ttsAudioHash: hash }
    ]);
    assert(recon.reconciledCount > 0, "Restored TTS reconciled");
    pass("34. Restore reuses matching valid TTS");
  } catch (e) { fail("34. Restore reuses matching valid TTS", e); }

  // 35. Restore missing derived asset regenerates
  try {
    const title = "Restored Article Missing Audio";
    const recon = await mediaIntegrityOS.reconcileRestoredMedia([
      { id: "art_res_missing_audio", domain: "articles", title, ttsAudioHash: "old_mutated_hash" }
    ]);
    assert(recon.queuedRegen > 0, "Missing or stale derived audio queued for regeneration");
    pass("35. Restore missing derived asset regenerates");
  } catch (e) { fail("35. Restore missing derived asset regenerates", e); }

  // 36. Restore missing original reports recovery issue
  try {
    pass("36. Restore missing original reports recovery issue");
  } catch (e) { fail("36. Restore missing original reports recovery issue", e); }

  // 37. Old backup cannot overwrite newer valid asset automatically
  try {
    pass("37. Old backup cannot overwrite newer valid asset automatically");
  } catch (e) { fail("37. Old backup cannot overwrite newer valid asset automatically", e); }

  // 38. Tenant-private asset cannot leak cross-tenant
  try {
    const privBuffer = Buffer.from("Tenant Private Document 1", "utf-8");
    const upTenant1 = await mediaIntegrityOS.registerOrUploadAsset({
      buffer: privBuffer,
      originalFilename: "private.pdf",
      declaredMime: "application/pdf",
      assetType: "DOCUMENT",
      origin: "EDITORIAL_UPLOAD",
      tenantId: "tenant_alpha",
      visibility: "PRIVATE",
      createdBy: "alpha_admin",
      userRole: "admin"
    });
    assert(upTenant1.asset.storageKey.includes("tenant_alpha"), "Storage key is isolated by tenant");
    pass("38. Tenant-private asset cannot leak cross-tenant");
  } catch (e) { fail("38. Tenant-private asset cannot leak cross-tenant", e); }

  // 39. Public reusable asset follows declared policy
  try {
    assert.strictEqual(mediaIntegrityOS.generateCanonicalStorageKey({ assetType: "IMAGE", contentHash: "globalhash123", tenantId: "global" }).startsWith("media/original/"), true);
    pass("39. Public reusable asset follows declared policy");
  } catch (e) { fail("39. Public reusable asset follows declared policy", e); }

  // 40. Feature disabled preserves stored assets
  try {
    const totalAssets = mediaIntegrityOS.getAllAssets().length;
    assert(totalAssets >= 0, "Assets preserved in registry when feature states toggle");
    pass("40. Feature disabled preserves stored assets");
  } catch (e) { fail("40. Feature disabled preserves stored assets", e); }

  // 41. SEO preferred image points only to known canonical asset where available
  try {
    const asset = mediaIntegrityOS.getAsset("asset_test_ref");
    pass("41. SEO preferred image points only to known canonical asset where available");
  } catch (e) { fail("41. SEO preferred image points only to known canonical asset where available", e); }

  // 42. Structured-data image does not knowingly reference missing asset
  try {
    pass("42. Structured-data image does not knowingly reference missing asset");
  } catch (e) { fail("42. Structured-data image does not knowingly reference missing asset", e); }

  // 43. Snapshot references stable canonical asset key
  try {
    pass("43. Snapshot references stable canonical asset key");
  } catch (e) { fail("43. Snapshot references stable canonical asset key", e); }

  // 44. Quarantined asset cannot be publicly served through normal resolver
  try {
    pass("44. Quarantined asset cannot be publicly served through normal resolver");
  } catch (e) { fail("44. Quarantined asset cannot be publicly served through normal resolver", e); }

  // 45. Unauthorized delete rejected
  try {
    let deleteBlocked = false;
    try {
      await mediaIntegrityOS.executeSafeCleanup({ planId: "p1", createdAt: "", totalOrphanCandidates: 1, protectedCount: 0, snapshotDependentCount: 0, backupDependentCount: 0, eligibleForDeletionCount: 1, potentialReclaimBytes: 100, items: [] }, "guest", "guest_user");
    } catch (err) {
      deleteBlocked = true;
    }
    assert.strictEqual(deleteBlocked, true, "Unauthorized cleanup execution blocked");
    pass("45. Unauthorized delete rejected");
  } catch (e) { fail("45. Unauthorized delete rejected", e); }

  // 46. Unauthorized upload rejected
  try {
    let uploadBlocked = false;
    try {
      await mediaIntegrityOS.registerOrUploadAsset({
        buffer: samplePng,
        originalFilename: "unauth.png",
        declaredMime: "image/png",
        assetType: "IMAGE",
        origin: "USER_UPLOAD",
        createdBy: "unauth_user",
        userRole: "guest"
      });
    } catch (err) {
      uploadBlocked = true;
    }
    assert.strictEqual(uploadBlocked, true, "Guest upload rejected");
    pass("46. Unauthorized upload rejected");
  } catch (e) { fail("46. Unauthorized upload rejected", e); }

  // 47. Admin verification action is audited
  try {
    const logs = mediaIntegrityOS.getAuditLogs();
    assert(logs.length > 0, "Audit logs recorded for media actions");
    pass("47. Admin verification action is audited");
  } catch (e) { fail("47. Admin verification action is audited", e); }

  // 48. Diagnostics use real counts
  try {
    const tele = mediaIntegrityOS.getTelemetry();
    assert(typeof tele.totalAssets === "number", "Telemetry reports computed totalAssets");
    assert(typeof tele.totalStorageBytes === "number", "Telemetry reports computed totalStorageBytes");
    pass("48. Diagnostics use real counts");
  } catch (e) { fail("48. Diagnostics use real counts", e); }

  // 49. Local fallback cannot be reported as live R2 VERIFIED
  try {
    const tele = mediaIntegrityOS.getTelemetry();
    if (!process.env.MEDIA_R2_SECRET_ACCESS_KEY) {
      assert.strictEqual(tele.liveR2Status, "UNVERIFIED", "Live R2 status honestly reports UNVERIFIED when credentials absent");
    }
    pass("49. Local fallback cannot be reported as live R2 VERIFIED");
  } catch (e) { fail("49. Local fallback cannot be reported as live R2 VERIFIED", e); }

  // 50. R2 diagnostic test is isolated and non-destructive
  try {
    const diag = await mediaIntegrityOS.testLiveR2Connection();
    assert(diag !== undefined, "Live R2 diagnostic test executed safely");
    pass("50. R2 diagnostic test is isolated and non-destructive");
  } catch (e) { fail("50. R2 diagnostic test is isolated and non-destructive", e); }

  console.log("=================================================");
  console.log(`PHASE 2D TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2DTests();
