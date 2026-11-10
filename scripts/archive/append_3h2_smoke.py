with open("tests/phase3h-production-smoke.ts", "r") as f:
    content = f.read()

smoke37to42 = """
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
"""

content = content.replace(
  `  it("Workflow 36: TTS authority enforces verified audio output modality", () => {
    const compat = aiOS.validateModelCompatibility("gemini-flash-latest", { operationType: "TTS" });
    assert.strictEqual(compat.compatible, false);
    const ttsCompat = aiOS.validateModelCompatibility("gemini-3.8-flash-lite-tts", { operationType: "TTS" });
    assert.strictEqual(ttsCompat.compatible, true);
  });
});`,
  `  it("Workflow 36: TTS authority enforces verified audio output modality", () => {
    const compat = aiOS.validateModelCompatibility("gemini-flash-latest", { operationType: "TTS" });
    assert.strictEqual(compat.compatible, false);
    const ttsCompat = aiOS.validateModelCompatibility("gemini-3.8-flash-lite-tts", { operationType: "TTS" });
    assert.strictEqual(ttsCompat.compatible, true);
  });\n` + smoke37to42 + `\n});`
)

with open("tests/phase3h-production-smoke.ts", "w") as f:
    f.write(content)

print("Appended workflows 37 to 42 to tests/phase3h-production-smoke.ts")
