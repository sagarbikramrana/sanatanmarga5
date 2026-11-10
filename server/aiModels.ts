import { serverAiObservabilityOS } from "./aiObservabilityOs";

export const AI_MODELS = {
  PRIMARY: "gemini-3.8-flash",
  REASONING_PRO: "gemini-3.1-pro-preview",
  LITE: "gemini-3.1-flash-lite",
  FLASH_LATEST: "gemini-flash-latest",
  TTS_LITE: "gemini-3.8-flash-lite-tts",
  TTS_FLAGSHIP: "gemini-3.8-flash-tts",
};

export const DEFAULT_MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.1-pro-preview"
];

/**
 * @classification LEGACY_COMPATIBILITY / TEST_ONLY
 * Authoritative production model routing is governed by serverAiObservabilityOS.resolvePolicyModels()
 */
export const MODEL_CHAIN_CLASSIFICATION = "LEGACY_COMPATIBILITY" as const;

export let MODEL_CHAIN = [...DEFAULT_MODEL_CHAIN];

// Circuit Breaker State: Maps model name to timestamp (ms) until which it is suspended due to 429 quota exhaustion
const modelCooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown per exhausted model

export function isModelInCooldown(model: string): boolean {
  const until = modelCooldowns.get(model);
  if (!until) return false;
  if (Date.now() >= until) {
    modelCooldowns.delete(model);
    return false;
  }
  return true;
}

export function recordModelQuotaExhausted(model: string, cooldownMs = DEFAULT_COOLDOWN_MS) {
  const until = Date.now() + cooldownMs;
  modelCooldowns.set(model, until);
  console.warn(`[AI Circuit Breaker] Model '${model}' marked QUOTA_EXHAUSTED. Suspended until ${new Date(until).toISOString()}`);
}

export function getAvailableModels(): string[] {
  return MODEL_CHAIN.filter(model => !isModelInCooldown(model));
}

export const MODEL_PURPOSES = {
  RADIO_BULLETIN: "gemini-3.8-flash",
  ARTICLE_SUMMARIES: "gemini-3.1-flash-lite",
  TTS_PREPARATION: "gemini-3.1-flash-lite",
  DISCOVERY_CENTER: "gemini-3.8-flash",
  NEWSROOM_EDITORIAL: "gemini-3.8-flash",
  FACT_CHECKING: "gemini-3.1-pro-preview",
  TRANSLATION: "gemini-3.8-flash",
};

export interface AITelemetryRecord {
  timestamp: string;
  endpointTag: string;
  model: string;
  success: boolean;
  durationMs: number;
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
  error?: string;
  isQuotaError?: boolean;
}

export const aiTelemetryLog: AITelemetryRecord[] = [];

export function recordAITelemetry(record: AITelemetryRecord) {
  aiTelemetryLog.unshift(record);
  if (aiTelemetryLog.length > 200) {
    aiTelemetryLog.pop();
  }
}

export function getAITelemetryStats() {
  const total = aiTelemetryLog.length;
  const successes = aiTelemetryLog.filter(r => r.success).length;
  const quotaErrors = aiTelemetryLog.filter(r => r.isQuotaError).length;
  const recentCalls = aiTelemetryLog.slice(0, 30);
  
  return {
    totalRequestsTracked: total,
    successRatePercent: total > 0 ? Math.round((successes / total) * 100) : 100,
    quotaErrorsCount: quotaErrors,
    activeModelChain: MODEL_CHAIN,
    recentCalls
  };
}

/**
 * Dynamically update the active model chain (e.g. from Firestore or Admin configuration)
 */
export function setModelChain(chain: string[]) {
  if (Array.isArray(chain) && chain.length > 0) {
    MODEL_CHAIN = chain;
    console.log("[AI Models] Updated active MODEL_CHAIN:", MODEL_CHAIN);
  }
}

/**
 * Execute a Gemini API generateContent call across the active MODEL_CHAIN fallback list.
 * Prevents system failures when individual models are throttled or exhausted.
 * Fails closed: Never fabricates or returns fake content upon total failure.
 */
export async function generateContentWithFallback(
  ai: any,
  contents: any,
  config: any = {},
  endpointTag: string = "generateContent"
) {
  let lastError: any = null;
  const startTime = Date.now();

  // Authoritative Policy Resolution: workload/tag -> policy -> resolvePolicyModels()
  const tagUpper = endpointTag.toUpperCase();
  let policyId = "NEWSROOM_PRIMARY";
  if (tagUpper.includes("TRANSLAT")) policyId = "TRANSLATION_STRICT";
  else if (tagUpper.includes("TTS")) policyId = "TTS_NEPALI";
  else if (tagUpper.includes("SGIS") || tagUpper.includes("MANUSCRIPT")) policyId = "SGIS_PRIMARY";
  else if (tagUpper.includes("SEO")) policyId = "SEO_ASSIST";
  else if (tagUpper.includes("MODERAT")) policyId = "MODERATION_FAST";

  const resolved = serverAiObservabilityOS.resolvePolicyModels(policyId);
  const modelsToTry = (resolved.primary ? [resolved.primary, ...resolved.fallbacks] : MODEL_CHAIN).filter(Boolean);

  for (const model of modelsToTry) {
    if (isModelInCooldown(model)) {
      console.warn(`[AI Circuit Breaker] Model '${model}' is in quota cooldown. Skipping for ${endpointTag}.`);
      continue;
    }

    const attemptStart = Date.now();
    try {
      console.log(`[AI Model Chain] Requesting endpoint: ${endpointTag} with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });

      const durationMs = Date.now() - attemptStart;
      recordAITelemetry({
        timestamp: new Date().toISOString(),
        endpointTag,
        model,
        success: true,
        durationMs,
      });

      console.log(`[AI Model Chain] Success on model: ${model} for ${endpointTag} (${durationMs}ms)`);
      return {
        success: true,
        model,
        text: response.text,
        candidates: response.candidates,
        response
      };
    } catch (err: any) {
      const durationMs = Date.now() - attemptStart;
      const errMsg = err?.message || String(err);
      const isQuota = errMsg.includes("429") || 
                      errMsg.toLowerCase().includes("quota") || 
                      errMsg.toLowerCase().includes("resource_exhausted") ||
                      errMsg.toLowerCase().includes("rate limit");

      if (isQuota) {
        recordModelQuotaExhausted(model);
      }

      recordAITelemetry({
        timestamp: new Date().toISOString(),
        endpointTag,
        model,
        success: false,
        durationMs,
        error: errMsg,
        isQuotaError: isQuota
      });

      console.warn(`[AI Model Chain Notice] ${model} failed for ${endpointTag} (quota=${isQuota}): ${errMsg}`);
      lastError = err;
    }
  }

  // Strict Fail-Closed Guarantee (Phase 4): Never fabricate news, facts, fact-checks, bulletins or editorial stories
  console.warn(`[AI Model Chain Notice] All models exhausted for ${endpointTag}. Failing closed with structured error.`);

  return {
    success: false,
    code: "AI_TEMPORARILY_UNAVAILABLE",
    retryable: true,
    model: "none",
    error: "एआई सेवा हाल अत्यधिक चाप वा कोटा सीमाका कारण अस्थायी रूपमा अनुपलब्ध छ (AI service temporarily unavailable).",
    text: "",
    candidates: [],
    response: null,
    lastError: lastError?.message || "All models in chain exhausted"
  };
}
