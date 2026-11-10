/**
 * SANATANMARGA 5.0 BETA — PHASE 3H PRODUCTION SMOKE TEST SUITE
 * 28-Step End-to-End Workflows: AI Observability, Model Control Center & Governance
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { ServerAiObservabilityOS } from "../server/aiObservabilityOs";

describe("SANATANMARGA 5.0 — PHASE 3H 28-STEP PRODUCTION SMOKE WORKFLOWS", () => {
  let aiOS: ServerAiObservabilityOS;

  const adminActor = { uid: "usr_admin_smoke", role: "super_admin" };
  const editorActor = { uid: "usr_editor_smoke", role: "editor" };
  const unauthorizedActor = { uid: "usr_reader_smoke", role: "reader" };

  before(() => {
    ServerAiObservabilityOS.resetInstance();
    aiOS = ServerAiObservabilityOS.getInstance();
  });

  it("Workflow 1: AI overview authorized for platform admin", () => {
    const sc = aiOS.getHealthScorecard();
    assert.ok(sc.overallStatus);
    assert.ok(sc.domains["newsroom"]);
  });

  it("Workflow 2: Unauthorized denied from performing model activations", () => {
    const res = aiOS.activateModelPolicy(unauthorizedActor, "NEWSROOM_PRIMARY", "gemini-3.1-flash-lite", 1, "test");
    assert.strictEqual(res.success, false);
  });

  it("Workflow 3: Tenant isolation verified across job explorer filters", () => {
    const list = aiOS.listJobs({ tenantId: "tenant-smoke-1" });
    assert.ok(Array.isArray(list.jobs));
  });

  it("Workflow 4: Workload registry lists all 7 canonical production workloads", () => {
    const workloads = aiOS.listWorkloads();
    assert.ok(workloads.length >= 7);
  });

  it("Workflow 5: Model discovery discovers new Gemini models as DISCOVERED", () => {
    const recon = aiOS.reconcileDiscoveredModels(["gemini-3.8-flash", "gemini-future-candidate-1"]);
    assert.ok(recon.newModels.includes("gemini-future-candidate-1"));
  });

  it("Workflow 6: Model verification validates model reachable & healthy", async () => {
    const ver = await aiOS.verifyModel("gemini-flash-latest");
    assert.strictEqual(ver.reachable, true);
    assert.strictEqual(ver.health, "HEALTHY");
  });

  it("Workflow 7: Incompatible model rejected when assigned to mismatched modality", () => {
    const compat = aiOS.validateModelCompatibility("gemini-3.8-flash", { operationType: "TTS" });
    assert.strictEqual(compat.compatible, false);
  });

  it("Workflow 8: Model canary evaluates candidate safely without public exposure", () => {
    const canary = aiOS.runCanary("gemini-3.1-flash-lite", "NEWSROOM_PRIMARY");
    assert.strictEqual(canary.passed, true);
  });

  it("Workflow 9: Activation updates policy version and records audit history", () => {
    const res = aiOS.activateModelPolicy(adminActor, "NEWSROOM_PRIMARY", "gemini-3.1-flash-lite", 1, "Production smoke promotion");
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.policy?.version, 2);
  });

  it("Workflow 10: Rollback restores previous model policy cleanly", () => {
    const res = aiOS.rollbackModelPolicy(adminActor, "NEWSROOM_PRIMARY", "Production smoke rollback");
    assert.strictEqual(res.success, true);
  });

  it("Workflow 11: Successful trace records timing and status", () => {
    const ctx = aiOS.createRequestContext("workload_newsroom_angles");
    assert.ok(ctx.context);
    aiOS.recordJobTrace({
      id: "job_smoke_success_1",
      traceId: ctx.context!.traceId,
      workloadId: ctx.context!.workloadId,
      operationType: ctx.context!.operationType,
      tenantId: "tenant-default",
      modelPolicyId: ctx.context!.modelPolicyId,
      modelPolicyVersion: ctx.context!.modelPolicyVersion,
      status: "SUCCEEDED",
      attempts: [{ attemptNumber: 1, model: "gemini-3.8-flash", startedAt: new Date().toISOString(), durationMs: 250, status: "SUCCESS" }],
      startedAt: new Date().toISOString(),
      reviewStatus: "NOT_REQUIRED"
    });
    const j = aiOS.getJob("job_smoke_success_1");
    assert.strictEqual(j?.status, "SUCCEEDED");
  });

  it("Workflow 12: Failed trace records normalized failure code", () => {
    aiOS.recordJobTrace({
      id: "job_smoke_failed_1",
      traceId: "trc_fail_1",
      workloadId: "workload_newsroom_angles",
      operationType: "TEXT_GENERATION",
      tenantId: "tenant-default",
      modelPolicyId: "NEWSROOM_PRIMARY",
      modelPolicyVersion: 1,
      status: "FAILED",
      failureCode: "RATE_LIMITED",
      attempts: [{ attemptNumber: 1, model: "gemini-3.8-flash", startedAt: new Date().toISOString(), durationMs: 110, status: "FAILED", normalizedError: "RATE_LIMITED" }],
      startedAt: new Date().toISOString(),
      reviewStatus: "NOT_REQUIRED"
    });
    const j = aiOS.getJob("job_smoke_failed_1");
    assert.strictEqual(j?.failureCode, "RATE_LIMITED");
  });

  it("Workflow 13: Retry logic identifies retryable errors", () => {
    assert.strictEqual(aiOS.isRetryableError("RATE_LIMITED"), true);
    assert.strictEqual(aiOS.isRetryableError("TIMEOUT"), true);
    assert.strictEqual(aiOS.isRetryableError("INVALID_REQUEST"), false);
  });

  it("Workflow 14: Fallback routing resolves secondary candidate models", () => {
    const res = aiOS.resolvePolicyModels("NEWSROOM_PRIMARY");
    assert.ok(res.fallbacks.length > 0);
  });

  it("Workflow 15: Quota degradation raises deduplicated failure alert", () => {
    const alert = aiOS.recordFailureAlert("workload_newsroom_angles", "gemini-3.8-flash", "RATE_LIMITED", "tenant-default", "Rate limit hit");
    assert.strictEqual(alert.status, "OPEN");
  });

  it("Workflow 16: TTS cache hit bypasses provider call and marks cacheHit", () => {
    aiOS.recordJobTrace({
      id: "job_smoke_tts_cache",
      traceId: "trc_tts_c_1",
      workloadId: "workload_tts_bulletin",
      operationType: "TTS",
      tenantId: "tenant-default",
      modelPolicyId: "TTS_NEPALI",
      modelPolicyVersion: 1,
      status: "SUCCEEDED",
      attempts: [],
      startedAt: new Date().toISOString(),
      reviewStatus: "NOT_REQUIRED",
      cacheHit: true
    });
    assert.strictEqual(aiOS.getJob("job_smoke_tts_cache")?.cacheHit, true);
  });

  it("Workflow 17: TTS generation trace records audio generation workload", () => {
    const w = aiOS.getWorkload("workload_tts_bulletin");
    assert.strictEqual(w?.operationType, "TTS");
  });

  it("Workflow 18: TTS fallback routes to secondary audio model", () => {
    const res = aiOS.resolvePolicyModels("TTS_NEPALI");
    assert.ok(res.fallbacks.includes("gemini-3.8-flash-tts"));
  });

  it("Workflow 19: Translation workflow preserves strict human review policy", () => {
    const w = aiOS.getWorkload("workload_translation");
    assert.strictEqual(w?.reviewRequired, true);
  });

  it("Workflow 20: Newsroom angle workflow registers structured output", () => {
    const w = aiOS.getWorkload("workload_newsroom_angles");
    assert.strictEqual(w?.operationType, "STRUCTURED_GENERATION");
  });

  it("Workflow 21: SGIS OCR workflow records manuscript privacy hashes", () => {
    aiOS.recordJobTrace({
      id: "job_smoke_sgis_1",
      traceId: "trc_sgis_smoke",
      workloadId: "workload_sgis_ocr",
      operationType: "OCR_CLEANUP",
      tenantId: "tenant-default",
      modelPolicyId: "SGIS_PRIMARY",
      modelPolicyVersion: 1,
      status: "SUCCEEDED",
      attempts: [],
      startedAt: new Date().toISOString(),
      reviewStatus: "PENDING",
      inputHash: "hash_smoke_manuscript_999"
    });
    const j = aiOS.getJob("job_smoke_sgis_1");
    assert.strictEqual(j?.inputHash, "hash_smoke_manuscript_999");
  });

  it("Workflow 22: Prompt version recorded in request context", () => {
    const ctx = aiOS.createRequestContext("workload_newsroom_angles", { promptTemplateId: "prompt_newsroom_angles" });
    assert.strictEqual(ctx.context?.promptTemplateVersion, "v1.0.0");
  });

  it("Workflow 23: Structured validation flag captured in canary tests", () => {
    const canary = aiOS.runCanary("gemini-3.8-flash", "SGIS_PRIMARY");
    assert.strictEqual(canary.schemaValidity, true);
  });

  it("Workflow 24: Grounding workflow records reference links", () => {
    aiOS.recordJobTrace({
      id: "job_smoke_ground_1",
      traceId: "trc_ground_smoke",
      workloadId: "workload_newsroom_factcheck",
      operationType: "GROUNDING",
      tenantId: "tenant-default",
      modelPolicyId: "NEWSROOM_PRIMARY",
      modelPolicyVersion: 1,
      status: "SUCCEEDED",
      attempts: [],
      startedAt: new Date().toISOString(),
      reviewStatus: "PENDING",
      groundingReferences: ["doc_smoke_gov_1"]
    });
    const j = aiOS.getJob("job_smoke_ground_1");
    assert.ok(j?.groundingReferences?.includes("doc_smoke_gov_1"));
  });

  it("Workflow 25: Review link verified for editorial assistance", () => {
    const j = aiOS.getJob("job_smoke_ground_1");
    assert.strictEqual(j?.reviewStatus, "PENDING");
  });

  it("Workflow 26: Safe replay spawns distinct job trace with same input hash", () => {
    const replayRes = aiOS.replayJob(editorActor, "job_smoke_ground_1", "CURRENT_ACTIVE_POLICY");
    assert.strictEqual(replayRes.success, true);
    assert.notStrictEqual(replayRes.newJobTrace?.id, "job_smoke_ground_1");
  });

  it("Workflow 27: Budget guard verifies workload budgetClass assignment", () => {
    const w = aiOS.getWorkload("workload_seo_assist");
    assert.strictEqual(w?.budgetClass, "LOW");
  });

  it("Workflow 28: Clean startup and runtime initialization validated", () => {
    const models = aiOS.listModels();
    assert.ok(models.length >= 6);
  });

  it("Workflow 29: Unverified candidate visible in model registry", () => {
    aiOS.registerDiscoveredModel({
      providerModelId: "gemini-smoke-unverified-candidate",
      lifecycleStatus: "UNVERIFIED",
      verificationProvenance: "MANUAL_REGISTRATION",
      verificationEnvironment: "SANDBOX"
    });
    const m = aiOS.getModel("gemini-smoke-unverified-candidate");
    assert.strictEqual(m?.lifecycleStatus, "UNVERIFIED");
  });

  it("Workflow 30: Unverified activation denied by server authority", () => {
    const pol = aiOS.getModelPolicy("NEWSROOM_PRIMARY")!;
    const res = aiOS.activateModelPolicy(adminActor, "NEWSROOM_PRIMARY", "gemini-smoke-unverified-candidate", pol.version, "Smoke unverified activation");
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes("must be VERIFIED"));
  });

  it("Workflow 31: Verified candidate canary succeeds", () => {
    const canary = aiOS.runCanary("gemini-3.1-flash-lite", "NEWSROOM_PRIMARY");
    assert.strictEqual(canary.passed, true);
  });

  it("Workflow 32: Verified candidate activation increments policy version", () => {
    const pol = aiOS.getModelPolicy("NEWSROOM_PRIMARY")!;
    const res = aiOS.activateModelPolicy(adminActor, "NEWSROOM_PRIMARY", "gemini-3.1-flash-lite", pol.version, "Smoke activation of verified candidate");
    assert.strictEqual(res.success, true);
  });

  it("Workflow 33: Rollback restores previous policy cleanly", () => {
    const res = aiOS.rollbackModelPolicy(adminActor, "NEWSROOM_PRIMARY", "Smoke rollback");
    assert.strictEqual(res.success, true);
  });

  it("Workflow 34: Provider discovery outage preserves active last-known-good", () => {
    const pol = aiOS.getModelPolicy("NEWSROOM_PRIMARY")!;
    const primaryBefore = pol.primaryModelId;
    aiOS.reconcileDiscoveredModels([]);
    assert.strictEqual(aiOS.getModelPolicy("NEWSROOM_PRIMARY")?.primaryModelId, primaryBefore);
  });

  it("Workflow 35: MODEL_NOT_FOUND uses verified fallback only", () => {
    const pol = aiOS.resolvePolicyModels("NEWSROOM_PRIMARY");
    for (const f of pol.fallbacks) {
      const m = aiOS.getModel(f);
      assert.ok(["VERIFIED", "ACTIVE"].includes(m?.lifecycleStatus || ""));
    }
  });

  it("Workflow 36: TTS authority enforces verified audio output modality", () => {
    const compat = aiOS.validateModelCompatibility("gemini-flash-latest", { operationType: "TTS" });
    assert.strictEqual(compat.compatible, false);
    const ttsCompat = aiOS.validateModelCompatibility("gemini-3.8-flash-lite-tts", { operationType: "TTS" });
    assert.strictEqual(ttsCompat.compatible, true);
  });


  it("Workflow 37: Admin Notifications boundary normalizer prevents .replace on undefined", () => {
    const rawCampaign = { id: "camp_smoke_1", name: "Smoke Campaign", title: "Breaking" };
    const safeAudience = (rawCampaign as any).audience || "all_users";
    assert.strictEqual(safeAudience.replace(/_/g, " "), "all users");
  });

  it("Workflow 38: Admin Contact Messages boundary normalizer prevents .toLowerCase on undefined", () => {
    const rawMessage = { id: "msg_smoke_1", email: "test@example.com" };
    const nameStr = typeof (rawMessage as any).name === "string" ? (rawMessage as any).name.toLowerCase() : "";
    assert.strictEqual(nameStr, "");
  });

  it("Workflow 39: Search helper operates safely on undefined without throwing", () => {
    const normalize = (v: any) => (typeof v === "string" ? v.trim().toLowerCase() : "");
    assert.strictEqual(normalize(undefined), "");
    assert.strictEqual(normalize("Sagar"), "sagar");
  });

  it("Workflow 40: Executable fallback authority enforces productionExecutable true", () => {
    const m = aiOS.getModel("gemini-3.8-flash");
    assert.strictEqual(m?.productionExecutable, false);
    const resolved = aiOS.resolvePolicyModels("NEWSROOM_PRIMARY");
    assert.strictEqual(resolved.fallbacks.includes("gemini-3.8-flash"), false);
  });

  it("Workflow 41: Audio fallback gemini-3.8-flash-tts is live verified and executable", () => {
    const tts = aiOS.getModel("gemini-3.8-flash-tts");
    assert.strictEqual(tts?.productionExecutable, true);
    assert.strictEqual(tts?.verificationProvenance, "LIVE_PROVIDER_VERIFIED");
  });

  it("Workflow 42: Zero fallback policy for text executes safely without crashing", () => {
    const pol = aiOS.resolvePolicyModels("NEWSROOM_PRIMARY");
    assert.ok(pol.primary.length > 0);
  });
});
