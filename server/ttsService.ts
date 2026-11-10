import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { uploadMediaBuffer, objectExistsInStorage, getStoragePublicUrl, isR2Configured } from "./mediaStorage";
import { serverFeatureControlService } from "./featureControlService";

// In-memory cache for audio buffers (fast RAM fallback & quick reuse)
const audioCache = new Map<string, { buffer: Buffer; mimeType: string; createdAt: number; cacheKey: string; publicUrl?: string }>();
const MAX_CACHE_SIZE = 100;

// Single-flight generation registry to prevent redundant simultaneous Gemini calls for identical payloads
const activeTTSJobs = new Map<string, Promise<TTSGenerationResult>>();

// Registered callback for TTS ready notification (triggers Snapshot OS rebuild)
type TTSReadyListener = (info: { contentId: string; contentType: string; objectKey: string; audioUrl: string; contentHash: string }) => void;
let ttsReadyListener: TTSReadyListener | null = null;

export function registerTTSReadyListener(listener: TTSReadyListener): void {
  ttsReadyListener = listener;
}

// Durable file storage for background pre-generation jobs across restarts
const JOBS_FILE_PATH = path.join(process.cwd(), "data", "tts_jobs.json");

export type TTSJobClassification = 
  | "USER_REQUESTED_PENDING"
  | "SYSTEM_PREGENERATED"
  | "LEGACY_ORPHAN"
  | "FAILED_RETRY"
  | "UNKNOWN";

export interface PersistedTTSJob {
  objectKey: string;
  contentType: string;
  contentId: string;
  title: string;
  text: string;
  language: string;
  voice: string;
  contentHash: string;
  status: "queued" | "processing" | "ready" | "failed" | "waiting_retry";
  originType?: "USER_REQUESTED" | "EDITORIAL_ACTION" | "SYSTEM_PREGEN" | "UNKNOWN";
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export function classifyTTSJob(job: PersistedTTSJob): TTSJobClassification {
  const ageMs = Date.now() - (job.createdAt || 0);
  const isStale = ageMs > 24 * 60 * 60 * 1000; // > 24 hours
  if (isStale) return "LEGACY_ORPHAN";
  if (job.status === "failed") return "FAILED_RETRY";
  if (job.originType === "USER_REQUESTED") return "USER_REQUESTED_PENDING";
  if (job.originType === "SYSTEM_PREGEN") return "SYSTEM_PREGENERATED";
  if (!job.contentId || !job.text) return "LEGACY_ORPHAN";
  return "UNKNOWN";
}

function loadPersistedTTSJobs(): Record<string, PersistedTTSJob> {
  try {
    if (fs.existsSync(JOBS_FILE_PATH)) {
      const raw = fs.readFileSync(JOBS_FILE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[TTS_OS] Warning reading tts_jobs.json:", err);
  }
  return {};
}

function savePersistedTTSJob(job: PersistedTTSJob): void {
  try {
    const dir = path.dirname(JOBS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const jobs = loadPersistedTTSJobs();
    jobs[job.objectKey] = job;
    fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.warn("[TTS_OS] Warning saving tts_jobs.json:", err);
  }
}

let ttsQuotaCooldownUntil = 0;

export function getTTSQuotaCooldownUntil(): number {
  return ttsQuotaCooldownUntil;
}

export function resetTTSQuotaCooldown(): void {
  ttsQuotaCooldownUntil = 0;
}

export function setTTSQuotaCooldown(durationMs: number = 60000): void {
  ttsQuotaCooldownUntil = Date.now() + durationMs;
}

/**
 * Restart Recovery & Stale Processing Recovery
 * Scans persisted job queue on boot or recovery trigger.
 * Conservative Policy: Zero Gemini TTS calls during ordinary startup or recovery!
 */
export async function recoverIncompleteTTSJobs(getAiClient?: () => GoogleGenAI): Promise<number> {
  console.log("[TTS_OS] recovery Checking for incomplete audio jobs...");
  const jobs = loadPersistedTTSJobs();
  let recoveredCount = 0;
  const now = Date.now();

  for (const [key, job] of Object.entries(jobs)) {
    if (job.status === "queued" || job.status === "processing" || job.status === "waiting_retry") {
      // 1. Check if R2 / storage object already exists
      const exists = await objectExistsInStorage(job.objectKey);
      if (exists) {
        console.log(`[TTS_OS] recovery Storage object already exists for ${key}, marking READY`);
        job.status = "ready";
        job.updatedAt = now;
        savePersistedTTSJob(job);
        if (ttsReadyListener) {
          ttsReadyListener({
            contentId: job.contentId,
            contentType: job.contentType,
            objectKey: job.objectKey,
            audioUrl: getStoragePublicUrl(job.objectKey),
            contentHash: job.contentHash,
          });
        }
        recoveredCount++;
        continue;
      }

      // 2. Classify job
      const classification = classifyTTSJob(job);
      console.log(`[TTS_OS] recovery Job for ${job.contentId} classified as: ${classification}`);

      // 3. Conservative Startup Policy:
      // Ordinary application startup, homepage prewarm, or restart MUST NOT trigger Gemini TTS provider calls.
      // Quota is 100% protected. Synthesis occurs strictly on explicit reader Listen action.
      if (classification === "LEGACY_ORPHAN") {
        job.status = "failed";
        job.error = "LEGACY_ORPHAN_EXPIRED";
        job.updatedAt = now;
        savePersistedTTSJob(job);
        console.log(`[TTS_OS] recovery Expired legacy/stale audio job for ${job.contentId}`);
      } else {
        job.status = "waiting_retry";
        job.updatedAt = now;
        savePersistedTTSJob(job);
        console.log(`[TTS_OS] recovery Deferred audio job for ${job.contentId} to waiting_retry (lazy on-demand only, zero startup provider calls)`);
      }
    }
  }

  return recoveredCount;
}

export type TTSContentType = "article" | "blog" | "sgis" | "knowledge" | "nepal_hub" | "editorial" | "custom";

export interface TTSMetadata {
  status: "ready" | "processing" | "failed" | "not_generated";
  contentHash: string;
  defaultLanguage: string;
  defaultVoice: string;
  audioUrl: string;
  objectKey: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  generatedAt: string;
  variants?: Record<string, {
    status: "ready" | "processing" | "failed";
    audioUrl: string;
    objectKey: string;
    generatedAt: string;
  }>;
}

export interface TTSGenerationResult {
  audioUrl: string;
  objectKey: string;
  contentHash: string;
  wavBuffer: Buffer;
  mimeType: string;
  fromCache: boolean;
  textLength: number;
  durationSeconds: number;
  sizeBytes: number;
}

export function invalidateServerAudioCache(articleIdOrPattern: string): number {
  if (!articleIdOrPattern) return 0;
  let deletedCount = 0;
  for (const [key] of audioCache.entries()) {
    if (key.includes(articleIdOrPattern)) {
      audioCache.delete(key);
      deletedCount++;
    }
  }
  return deletedCount;
}

export function clearServerAudioCache(): void {
  audioCache.clear();
}

export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return pcmBuffer;
  }

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataLength = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Strips HTML tags and clean up text for speech synthesis
 */
export function sanitizeTextForSpeech(raw: string): string {
  if (!raw) return "";
  let clean = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return clean;
}

/**
 * Normalizes voice identifier to supported Gemini TTS voices
 */
export function normalizeTTSVoice(requestedVoice?: string): string {
  const reqVoice = (requestedVoice || "").toLowerCase();
  const validVoices = ["Aoede", "Kore", "Fenrir", "Puck", "Charon", "Zephyr"];
  const matchedVoice = validVoices.find((v) => v.toLowerCase() === reqVoice);

  if (matchedVoice) return matchedVoice;
  if (reqVoice.includes("female") || reqVoice.includes("women") || reqVoice.includes("girl") || reqVoice === "kore") {
    return "Aoede";
  }
  if (reqVoice.includes("male") || reqVoice.includes("men") || reqVoice.includes("boy") || reqVoice === "puck") {
    return "Fenrir";
  }
  return "Aoede"; // Default primary anchor voice
}

/**
 * Normalizes spoken speech payload from title and body
 */
export function prepareSpokenPayload(text: string, title?: string): string {
  const cleanBody = sanitizeTextForSpeech(text);
  const cleanTitle = sanitizeTextForSpeech(title || "");

  let fullText = cleanBody;
  if (cleanTitle) {
    const normTitle = cleanTitle.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    const normBody = cleanBody.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

    if (normTitle && normBody.startsWith(normTitle)) {
      fullText = cleanBody;
    } else {
      fullText = `${cleanTitle}। ${cleanBody}`;
    }
  }

  return fullText
    .replace(/[।\.]+/g, "। ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits long spoken text into sequential sentence/paragraph chunks for 100% full-article synthesis with zero silent truncation
 */
export function splitSpokenTextIntoChunks(text: string, maxChunkLen = 3000): string[] {
  if (!text || text.length <= maxChunkLen) return [text];

  const sentences = text.split(/(?<=[।\.\!\?])\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).length > maxChunkLen && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Computes deterministic SHA-256 hash for spoken content
 */
export function computeTTSContentHash(params: {
  contentType?: string;
  contentId?: string;
  language?: string;
  spokenText?: string;
  text?: string;
  voice?: string;
  modelVersion?: string;
  speed?: number;
  style?: string;
} | string): string {
  if (typeof params === "string") {
    return crypto.createHash("sha256").update(params, "utf8").digest("hex").slice(0, 32);
  }
  const normType = (params.contentType || "article").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const normId = (params.contentId || "custom").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const normLang = (params.language || "ne").toLowerCase();
  const normVoice = normalizeTTSVoice(params.voice).toLowerCase();
  const normModel = (params.modelVersion || "gemini-3.1-flash-tts-preview").toLowerCase();
  const speedStr = params.speed !== undefined ? String(params.speed) : "1.0";
  const styleStr = (params.style || "standard").toLowerCase();
  const textVal = params.spokenText || params.text || "";

  const payload = `${normType}:${normId}:${normLang}:${normVoice}:${normModel}:${speedStr}:${styleStr}:${textVal}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}

/**
 * Computes deterministic Cloudflare R2 object key
 * Format: audio/tts/<contentType>/<contentId>/<contentHash>/<language>/<voiceId>.wav
 */
export function computeTTSObjectKey(params: {
  contentType?: string;
  contentId?: string;
  contentHash: string;
  language?: string;
  voice?: string;
}): string {
  const normType = (params.contentType || "articles").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const normId = (params.contentId || "generic").replace(/[^a-zA-Z0-9_-]/g, "");
  const normLang = (params.language || "ne").toLowerCase().replace(/[^a-z]/g, "");
  const voiceName = normalizeTTSVoice(params.voice);
  const hash = params.contentHash.replace(/[^a-f0-9]/g, "");

  // Canonical media R2 directory structure
  return `audio/tts/${normType}/${normId}/${hash}/${normLang}/${voiceName}.wav`;
}

/**
 * Event-Driven TTS Asset Reconciliation for Restore & Normal Publishing
 * Verifies if an existing durable R2 TTS audio asset matches the content hash.
 * Reuses existing audio if present; queues asynchronous generation if missing.
 */
export async function reconcileTTSAsset(
  content: {
    id: string;
    title?: string;
    text: string;
    contentType?: TTSContentType;
    language?: "ne" | "en";
    voice?: string;
    speed?: number;
    style?: string;
  },
  getAiClient?: () => GoogleGenAI
): Promise<{
  status: "REUSED" | "QUEUED" | "MISSING" | "SKIPPED";
  objectKey: string;
  contentHash: string;
  audioUrl: string;
}> {
  const fullText = prepareSpokenPayload(content.text, content.title);
  if (!fullText) {
    return { status: "MISSING", objectKey: "", contentHash: "", audioUrl: "" };
  }

  const voiceName = normalizeTTSVoice(content.voice);
  const language = content.language || "ne";
  const contentType = content.contentType || "article";
  const contentId = content.id || "custom";

  const contentHash = computeTTSContentHash({
    contentType,
    contentId,
    language,
    spokenText: fullText,
    voice: voiceName,
    speed: content.speed,
    style: content.style
  });

  const objectKey = computeTTSObjectKey({
    contentType,
    contentId,
    contentHash,
    language,
    voice: voiceName
  });

  const publicUrl = getStoragePublicUrl(objectKey);

  // 1. Check if asset already exists in durable R2 storage or local disk
  try {
    const exists = await objectExistsInStorage(objectKey);
    if (exists) {
      return {
        status: "REUSED",
        objectKey,
        contentHash,
        audioUrl: publicUrl
      };
    }
  } catch (_) {}

  // 2. Asset missing: Check Feature Control
  const ttsEval = serverFeatureControlService.evaluateFeature("ai.tts");
  if (!ttsEval.backgroundAllowed) {
    return {
      status: "SKIPPED",
      objectKey,
      contentHash,
      audioUrl: ""
    };
  }

  // 3. Queue generation if AI client provider is available
  if (getAiClient) {
    enqueueAsyncTTSPreGeneration(getAiClient, {
      id: content.id,
      title: content.title || content.id,
      content: content.text,
      contentType: content.contentType,
      language: content.language
    });
    return {
      status: "QUEUED",
      objectKey,
      contentHash,
      audioUrl: ""
    };
  }

  return {
    status: "MISSING",
    objectKey,
    contentHash,
    audioUrl: ""
  };
}

/**
 * Primary ListenOS R2 Audio Cache v2 Engine:
 * PUBLISH ONCE → GENERATE ONCE → STORE IN CLOUDFLARE R2 → CACHE → READ MANY
 */
export async function getOrGenerateTTSAudio(
  ai: GoogleGenAI,
  options: {
    contentType?: TTSContentType;
    contentId?: string;
    text: string;
    title?: string;
    language?: "ne" | "en";
    voice?: string;
    forceRegenerate?: boolean;
    originType?: "USER_REQUESTED" | "EDITORIAL_ACTION" | "SYSTEM_PREGEN" | "UNKNOWN";
  }
): Promise<TTSGenerationResult> {
  // 0. Quota Circuit Breaker Check: Fast-fail if cooldown is active to avoid provider quota storms
  if (Date.now() < ttsQuotaCooldownUntil) {
    const remainingSec = Math.ceil((ttsQuotaCooldownUntil - Date.now()) / 1000);
    console.warn(`[TTS_OS] Quota cooldown active (${remainingSec}s remaining). Rejecting synthesis without provider call.`);
    const quotaErr: any = new Error("वाचन सेवा हाल सीमित छ (Gemini TTS API rate limit). कृपया केही समयपछि पुनः प्रयास गर्नुहोस्।");
    quotaErr.status = 429;
    quotaErr.code = "RATE_LIMITED";
    throw quotaErr;
  }

  const fullText = prepareSpokenPayload(options.text, options.title);
  if (!fullText) {
    throw new Error("वाचनका लागि पाठ उपलब्ध छैन (Spoken text is empty).");
  }

  const voiceName = normalizeTTSVoice(options.voice);
  const language = options.language || "ne";
  const contentType = options.contentType || "article";
  const contentId = options.contentId || "custom";

  const contentHash = computeTTSContentHash({
    contentType,
    contentId,
    language,
    spokenText: fullText,
    voice: voiceName,
  });

  const objectKey = computeTTSObjectKey({
    contentType,
    contentId,
    contentHash,
    language,
    voice: voiceName,
  });

  const publicUrl = getStoragePublicUrl(objectKey);

  // 1. Check in-memory fast RAM cache
  const ramCached = audioCache.get(objectKey);
  if (ramCached && !options.forceRegenerate) {
    console.log(`[TTS_OS] cache_hit RAM cache reuse for ${objectKey}`);
    const durSec = Math.max(1, Math.round(fullText.length / 22));
    return {
      audioUrl: ramCached.publicUrl || publicUrl,
      objectKey,
      contentHash,
      wavBuffer: ramCached.buffer,
      mimeType: ramCached.mimeType,
      fromCache: true,
      textLength: fullText.length,
      durationSeconds: durSec,
      sizeBytes: ramCached.buffer.length,
    };
  }

  // 2. Check local disk or Cloudflare R2 / S3 persistent storage
  if (!options.forceRegenerate) {
    try {
      const localPath = path.join(process.cwd(), "public", "uploads", objectKey);
      if (fs.existsSync(localPath)) {
        console.log(`[TTS_OS] cache_hit Local disk persistent audio reuse: ${objectKey}`);
        const diskBuffer = fs.readFileSync(localPath);
        const durSec = Math.max(1, Math.round(fullText.length / 22));
        audioCache.set(objectKey, {
          buffer: diskBuffer,
          mimeType: "audio/wav",
          createdAt: Date.now(),
          cacheKey: objectKey,
          publicUrl,
        });
        return {
          audioUrl: publicUrl,
          objectKey,
          contentHash,
          wavBuffer: diskBuffer,
          mimeType: "audio/wav",
          fromCache: true,
          textLength: fullText.length,
          durationSeconds: durSec,
          sizeBytes: diskBuffer.length,
        };
      }

      const existsInR2 = await objectExistsInStorage(objectKey);
      if (existsInR2) {
        console.log(`[TTS_OS] cache_hit R2 persistent audio reuse: ${objectKey}`);
        const durSec = Math.max(1, Math.round(fullText.length / 22));
        return {
          audioUrl: publicUrl,
          objectKey,
          contentHash,
          wavBuffer: Buffer.alloc(0), // Client streams directly from audioUrl
          mimeType: "audio/wav",
          fromCache: true,
          textLength: fullText.length,
          durationSeconds: durSec,
          sizeBytes: 0,
        };
      }
    } catch (storageCheckErr: any) {
      console.warn(`[TTS_OS] Storage check warning for ${objectKey}:`, storageCheckErr?.message || storageCheckErr);
    }
  }

  // 3. Single-Flight Deduplication: If already generating for this exact key, join promise
  if (activeTTSJobs.has(objectKey)) {
    console.log(`[TTS_OS] single_flight Joining in-progress generation for: ${objectKey}`);
    return await activeTTSJobs.get(objectKey)!;
  }

  // 4. Generate audio via Gemini TTS
  const generationPromise = (async (): Promise<TTSGenerationResult> => {
    console.log(`[TTS_OS] cache_miss Starting Gemini audio generation for ${objectKey}`);
    console.log(`[TTS_OS] generation_started Content: ${contentType}:${contentId}`);
    
    savePersistedTTSJob({
      objectKey,
      contentType,
      contentId,
      title: options.title || "",
      text: fullText,
      language,
      voice: voiceName,
      contentHash,
      status: "processing",
      originType: options.originType || "USER_REQUESTED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const ttsModels = [
      "gemini-3.8-flash-lite-tts",
      "gemini-3.8-flash-tts",
      "gemini-3.1-flash-tts-preview",
      "gemini-2.5-flash-preview-tts"
    ];
    let lastError: any = null;

    const chunks = splitSpokenTextIntoChunks(fullText, 3000);
    const pcmBuffers: Buffer[] = [];

    for (const chunkText of chunks) {
      let chunkData: string | null = null;

      for (const modelName of ttsModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: chunkText }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          });
          const part = response?.candidates?.[0]?.content?.parts?.[0];
          if (part?.inlineData?.data) {
            chunkData = part.inlineData.data;
            break;
          }
        } catch (err: any) {
          const isQuota = err?.status === 429 || String(err?.message || "").includes("429") || String(err?.message || "").includes("RESOURCE_EXHAUSTED") || String(err?.message || "").includes("Quota exceeded");
          if (isQuota) {
            console.warn(`[TTS_OS] Gemini TTS quota limit reached for model ${modelName}. Halting further fallback attempts.`);
            ttsQuotaCooldownUntil = Date.now() + 60000; // 60s bounded backoff cooldown
            lastError = err;
            break; // Stop immediately on quota exhaustion, do not burn through fallback models!
          } else {
            console.warn(`[TTS_OS] Gemini TTS attempt with model ${modelName} failed:`, err?.message || err);
          }
          lastError = err;
        }
      }

      if (!chunkData) {
        const isQuota = lastError?.status === 429 || String(lastError?.message || "").includes("429") || String(lastError?.message || "").includes("RESOURCE_EXHAUSTED") || String(lastError?.message || "").includes("Quota exceeded");
        if (isQuota) {
          console.warn(`[TTS_OS] Audio synthesis deferred due to Gemini TTS quota limit for ${objectKey}`);
        } else {
          console.error(`[TTS_OS] generation_failed Audio synthesis failed for ${objectKey}`);
        }
        savePersistedTTSJob({
          objectKey,
          contentType,
          contentId,
          title: options.title || "",
          text: fullText,
          language,
          voice: voiceName,
          contentHash,
          status: "failed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          error: isQuota ? "QUOTA_EXCEEDED" : String(lastError?.message || lastError || "Failed synthesis"),
        });
        if (isQuota) {
          const quotaErr: any = new Error("वाचन सेवा हाल सीमित छ (Gemini TTS API rate limit). कृपया केही समयपछि पुनः प्रयास गर्नुहोस्।");
          quotaErr.status = 429;
          throw quotaErr;
        }
        throw lastError || new Error("अडियो उत्पादन गर्न सकिएन (Failed to synthesize audio from Gemini TTS).");
      }

      const rawBuffer = Buffer.from(chunkData, "base64");
      const pcmData = (rawBuffer.length >= 44 && rawBuffer.subarray(0, 4).toString("ascii") === "RIFF")
        ? rawBuffer.subarray(44)
        : rawBuffer;

      pcmBuffers.push(pcmData);
    }

    const combinedPcm = Buffer.concat(pcmBuffers);
    const wavBuffer = pcmToWav(combinedPcm, 24000, 1, 16);
    const mimeType = "audio/wav";

    // 5. Store permanently in Cloudflare Media R2 (with immutable cache-control)
    let isR2Verified = false;
    try {
      const uploadResult = await uploadMediaBuffer(
        wavBuffer,
        objectKey,
        mimeType,
        "public, max-age=31536000, immutable"
      );
      isR2Verified = uploadResult.isR2 || await objectExistsInStorage(objectKey);
      console.log(`[TTS_OS] r2_upload_success Uploaded audio to storage (${uploadResult.isR2 ? "R2" : "Local"}): ${uploadResult.publicUrl}`);
    } catch (uploadErr) {
      console.warn(`[TTS_OS] r2_upload_failed Storage upload warning for ${objectKey}:`, uploadErr);
    }

    // 6. Update local RAM cache & persisted state
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      if (oldestKey) audioCache.delete(oldestKey);
    }
    audioCache.set(objectKey, {
      buffer: wavBuffer,
      mimeType,
      createdAt: Date.now(),
      cacheKey: objectKey,
      publicUrl,
    });

    const finalStatus = isR2Verified ? "ready" : "failed";

    savePersistedTTSJob({
      objectKey,
      contentType,
      contentId,
      title: options.title || "",
      text: fullText,
      language,
      voice: voiceName,
      contentHash,
      status: finalStatus,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[TTS_OS] generation_ready Audio successfully generated for ${objectKey}`);

    // Trigger Snapshot OS metadata update callback if registered
    if (ttsReadyListener) {
      try {
        ttsReadyListener({
          contentId,
          contentType,
          objectKey,
          audioUrl: publicUrl,
          contentHash,
        });
        console.log(`[TTS_OS] snapshot_metadata_updated Triggered snapshot update for ${contentId}`);
      } catch (cbErr) {
        console.warn(`[TTS_OS] Warning executing ttsReadyListener:`, cbErr);
      }
    }

    const durationSeconds = Math.max(1, Math.round(fullText.length / 22));

    return {
      audioUrl: publicUrl,
      objectKey,
      contentHash,
      wavBuffer,
      mimeType,
      fromCache: false,
      textLength: fullText.length,
      durationSeconds,
      sizeBytes: wavBuffer.length,
    };
  })();

  activeTTSJobs.set(objectKey, generationPromise);

  try {
    const result = await generationPromise;
    return result;
  } finally {
    activeTTSJobs.delete(objectKey);
  }
}

/**
 * Backward compatibility wrapper for existing generateNepaliTTS calls
 */
export async function generateNepaliTTS(
  ai: GoogleGenAI,
  text: string,
  options: {
    voice?: "female" | "male" | "Aoede" | "Kore" | "Fenrir" | "Puck" | string;
    speed?: number;
    title?: string;
    articleId?: string;
    contentVersion?: string | number;
    language?: string;
  } = {}
): Promise<{ wavBuffer: Buffer; mimeType: string; fromCache: boolean; textLength: number; cacheKey: string; audioUrl?: string }> {
  const result = await getOrGenerateTTSAudio(ai, {
    contentType: "article",
    contentId: options.articleId || "custom",
    text,
    title: options.title,
    language: (options.language === "en" ? "en" : "ne"),
    voice: options.voice,
  });

  return {
    wavBuffer: result.wavBuffer,
    mimeType: result.mimeType,
    fromCache: result.fromCache,
    textLength: result.textLength,
    cacheKey: result.objectKey,
    audioUrl: result.audioUrl,
  };
}

/**
 * Asynchronous Publication Side-Effect:
 * Spawns background TTS pre-generation for canonical published content without blocking publishing.
 */
export function enqueueAsyncTTSPreGeneration(
  getAiClient: () => GoogleGenAI,
  content: {
    id: string;
    title: string;
    content: string;
    contentType?: TTSContentType;
    language?: "ne" | "en";
  }
): void {
  if (!content.id || !content.title) return;

  const ttsEval = serverFeatureControlService.evaluateFeature("ai.tts");
  const listenEval = serverFeatureControlService.evaluateFeature("media.listenos");
  if (!ttsEval.backgroundAllowed || !listenEval.backgroundAllowed) {
    console.log(`[ListenOS Pre-gen] Skipped async background TTS for ${content.id}: feature is disabled (ai.tts: ${ttsEval.enabled}, media.listenos: ${listenEval.enabled})`);
    return;
  }

  // Run in background without unhandled rejection
  setTimeout(async () => {
    try {
      const liveTtsEval = serverFeatureControlService.evaluateFeature("ai.tts");
      if (!liveTtsEval.backgroundAllowed) {
        console.log(`[ListenOS Pre-gen] Aborted async background TTS for ${content.id}: ai.tts turned off before execution`);
        return;
      }
      const ai = getAiClient();
      console.log(`[ListenOS Pre-gen] Triggered async background audio generation for ${content.contentType || "article"} ID: ${content.id}`);
      await getOrGenerateTTSAudio(ai, {
        contentType: content.contentType || "article",
        contentId: content.id,
        text: content.content || content.title,
        title: content.title,
        language: content.language || "ne",
        voice: "Aoede", // Pre-generate default Nepali anchor voice
        originType: "SYSTEM_PREGEN",
      });
      console.log(`[ListenOS Pre-gen] Successfully pre-cached audio in R2 for ${content.id}`);
    } catch (err: any) {
      console.warn(`[ListenOS Pre-gen] Non-blocking background generation warning for ${content.id}:`, err?.message || err);
    }
  }, 100);
}
