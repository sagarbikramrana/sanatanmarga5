/**
 * SANATANMARGA 5.0 — PHASE 2D MEDIA & TTS ASSET INTEGRITY OS
 * Authoritative Media Asset Registry, Content-Addressable Identity,
 * Deduplication, Broken-Reference Repair, Restore Reconciliation & Safe Lifecycle Management.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { uploadMediaBuffer, deleteMediaObject, objectExistsInStorage, isR2Configured, getStoragePublicUrl } from "./mediaStorage.js";
import { serverFeatureControlService } from "./featureControlService.js";
import { computeTTSContentHash, normalizeTTSVoice } from "./ttsService.js";

export type AssetType =
  | "IMAGE"
  | "AUDIO"
  | "TTS_AUDIO"
  | "VIDEO"
  | "DOCUMENT"
  | "THUMBNAIL"
  | "SOCIAL_IMAGE"
  | "AD_CREATIVE";

export type AssetOrigin =
  | "USER_UPLOAD"
  | "EDITORIAL_UPLOAD"
  | "AI_GENERATED"
  | "TTS_GENERATED"
  | "DERIVED_IMAGE"
  | "IMPORTED"
  | "RESTORED"
  | "LEGACY"
  | "SYSTEM";

export type AssetVisibility = "PUBLIC" | "AUTHENTICATED" | "PRIVATE" | "ADMIN_ONLY";

export type AssetIntegrityStatus =
  | "UNKNOWN"
  | "VERIFIED"
  | "MISSING"
  | "HASH_MISMATCH"
  | "METADATA_MISMATCH"
  | "QUARANTINED"
  | "LEGACY_UNVERIFIED"
  | "REGENERATION_PENDING";

export type AssetLifecycleStatus =
  | "ACTIVE"
  | "UNREFERENCED"
  | "ORPHAN_CANDIDATE"
  | "RETENTION_WAIT"
  | "DELETE_ELIGIBLE"
  | "DELETED";

export type ReferenceClass = "REQUIRED" | "OPTIONAL" | "DERIVED_OPTIONAL";

export interface MediaAsset {
  assetId: string;
  assetType: AssetType;
  origin: AssetOrigin;
  storageProvider: "R2" | "LOCAL_FALLBACK";
  storageKey: string;
  contentHash: string; // SHA-256
  byteSize: number;
  contentType: string; // MIME
  extension?: string;
  width?: number;
  height?: number;
  duration?: number;
  language?: string;
  originalFilename?: string;
  createdAt: string;
  createdBy?: string;
  tenantId?: string;
  sourceEntity?: { type: string; id: string };
  sourceVersion?: number;
  derivationInputs?: Record<string, any>;
  visibility: AssetVisibility;
  integrityStatus: AssetIntegrityStatus;
  lifecycleStatus: AssetLifecycleStatus;
  lastVerifiedAt?: string;
  quarantineReason?: string;
  isProtected?: boolean;
}

export interface AssetReference {
  referenceId: string;
  assetId: string;
  entityType: string;
  entityId: string;
  field: string;
  referenceClass: ReferenceClass;
  createdAt: string;
  updatedAt: string;
}

export interface AssetValidationResult {
  valid: boolean;
  detectedMime: string;
  sanitizedFilename: string;
  contentHash: string;
  byteSize: number;
  width?: number;
  height?: number;
  quarantineReason?: string;
  errors: string[];
}

export interface MediaReconciliationAction {
  targetId: string;
  entityType: string;
  field: string;
  action:
    | "REUSE_EXISTING"
    | "RELINK_CANONICAL"
    | "REGENERATE_DERIVED"
    | "REUPLOAD_REQUIRED"
    | "MARK_OPTIONAL_MISSING"
    | "QUARANTINE"
    | "MANUAL_REVIEW"
    | "NO_ACTION";
  reason: string;
  suggestedKey?: string;
  assetId?: string;
}

export interface AssetCleanupPlan {
  planId: string;
  createdAt: string;
  totalOrphanCandidates: number;
  protectedCount: number;
  snapshotDependentCount: number;
  backupDependentCount: number;
  eligibleForDeletionCount: number;
  potentialReclaimBytes: number;
  items: Array<{
    assetId: string;
    storageKey: string;
    byteSize: number;
    lifecycleStatus: AssetLifecycleStatus;
    canDelete: boolean;
    reason: string;
  }>;
}

export interface MediaIntegrityTelemetry {
  totalAssets: number;
  verifiedAssets: number;
  missingAssets: number;
  hashMismatches: number;
  quarantinedAssets: number;
  legacyAssets: number;
  orphanCandidates: number;
  ttsReadyCount: number;
  ttsQueuedCount: number;
  ttsFailedCount: number;
  ttsCacheHits: number;
  brokenReferencesCount: number;
  totalStorageBytes: number;
  liveR2Status: "VERIFIED" | "UNVERIFIED";
  lastScanAt: string;
}

const MEDIA_REGISTRY_FILE = path.join(process.cwd(), "data", "media_registry.json");
const MEDIA_REFERENCES_FILE = path.join(process.cwd(), "data", "media_references.json");
const MEDIA_AUDIT_LOG_FILE = path.join(process.cwd(), "data", "media_audit_log.json");

export class MediaIntegrityOS {
  private static instance: MediaIntegrityOS;
  private registry: Map<string, MediaAsset> = new Map();
  private hashIndex: Map<string, string> = new Map(); // contentHash -> assetId
  private storageKeyIndex: Map<string, string> = new Map(); // storageKey -> assetId
  private legacyAliases: Map<string, string> = new Map(); // legacyPath -> canonical assetId/key
  private references: Map<string, AssetReference> = new Map(); // referenceId -> AssetReference
  private activeTTSJobs: Map<string, Promise<any>> = new Map(); // deterministicKey -> Promise
  private ttsCacheHits = 0;
  private ttsRequested = 0;
  private auditLogs: any[] = [];

  private constructor() {
    this.ensureDataDirectories();
    this.loadRegistry();
    this.loadReferences();
    this.initLegacyAliases();
  }

  public static getInstance(): MediaIntegrityOS {
    if (!MediaIntegrityOS.instance) {
      MediaIntegrityOS.instance = new MediaIntegrityOS();
    }
    return MediaIntegrityOS.instance;
  }

  private ensureDataDirectories(): void {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadRegistry(): void {
    try {
      if (fs.existsSync(MEDIA_REGISTRY_FILE)) {
        const raw = fs.readFileSync(MEDIA_REGISTRY_FILE, "utf-8");
        const list: MediaAsset[] = JSON.parse(raw);
        for (const asset of list) {
          this.registry.set(asset.assetId, asset);
          this.hashIndex.set(asset.contentHash, asset.assetId);
          this.storageKeyIndex.set(asset.storageKey, asset.assetId);
        }
      }
    } catch (err) {
      console.warn("[MediaIntegrityOS] Warning loading registry:", err);
    }
  }

  private saveRegistry(): void {
    try {
      const list = Array.from(this.registry.values());
      fs.writeFileSync(MEDIA_REGISTRY_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("[MediaIntegrityOS] Error saving registry:", err);
    }
  }

  private loadReferences(): void {
    try {
      if (fs.existsSync(MEDIA_REFERENCES_FILE)) {
        const raw = fs.readFileSync(MEDIA_REFERENCES_FILE, "utf-8");
        const list: AssetReference[] = JSON.parse(raw);
        for (const ref of list) {
          this.references.set(ref.referenceId, ref);
        }
      }
    } catch (err) {
      console.warn("[MediaIntegrityOS] Warning loading references:", err);
    }
  }

  private saveReferences(): void {
    try {
      const list = Array.from(this.references.values());
      fs.writeFileSync(MEDIA_REFERENCES_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("[MediaIntegrityOS] Error saving references:", err);
    }
  }

  private logAudit(entry: { actor: string; action: string; assetId?: string; result: "SUCCESS" | "DENIED" | "FAILED" | "WARNING"; details?: any }): void {
    const item = {
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(item);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    try {
      fs.writeFileSync(MEDIA_AUDIT_LOG_FILE, JSON.stringify(this.auditLogs, null, 2), "utf-8");
    } catch (err) {}
  }

  private initLegacyAliases(): void {
    // Known historical media paths mapped to canonical keys
    this.legacyAliases.set("/images/default-hero.jpg", "media/original/sys_default_hero/default-hero.jpg");
    this.legacyAliases.set("/logo.png", "media/original/sys_logo/logo.png");
    this.legacyAliases.set("/uploads/general/temple.jpg", "media/original/legacy_temple/temple.jpg");
  }

  // --- 1. CONTENT HASH & DERIVATION IDENTITY ---

  public computeBinaryHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  public computeDerivedImageHash(sourceHash: string, transform: { width?: number; height?: number; format?: string; quality?: number; fit?: string }): string {
    const payload = `${sourceHash}:${transform.width || 0}:${transform.height || 0}:${transform.format || "webp"}:${transform.quality || 85}:${transform.fit || "cover"}`;
    return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
  }

  public computeDeterministicTTSKey(params: {
    contentType?: string;
    contentId?: string;
    language?: string;
    spokenText?: string;
    text?: string;
    voice?: string;
    modelVersion?: string;
    speed?: number;
    style?: string;
  }): { contentHash: string; storageKey: string } {
    const contentHash = computeTTSContentHash(params);
    const lang = (params.language || "ne").toLowerCase();
    const voice = normalizeTTSVoice(params.voice).toLowerCase();
    const storageKey = `tts/${contentHash}/${lang}/${voice}.wav`;
    return { contentHash, storageKey };
  }

  // --- 2. CANONICAL STORAGE KEY GENERATION ---

  public generateCanonicalStorageKey(params: {
    assetType: AssetType;
    contentHash: string;
    originalFilename?: string;
    tenantId?: string;
    derivationHash?: string;
  }): string {
    const ext = params.originalFilename ? path.extname(params.originalFilename).toLowerCase() : "";
    const safeExt = ext.replace(/[^a-z0-9.]/g, "") || (params.assetType === "IMAGE" ? ".jpg" : params.assetType === "TTS_AUDIO" ? ".wav" : ".bin");

    if (params.assetType === "TTS_AUDIO") {
      return `tts/${params.contentHash}/audio${safeExt}`;
    }

    if (params.derivationHash) {
      return `media/derived/${params.contentHash}/${params.derivationHash}${safeExt}`;
    }

    if (params.tenantId && params.tenantId !== "global" && params.tenantId !== "sanatan-media") {
      const safeTenant = params.tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      return `tenants/${safeTenant}/media/${params.contentHash.slice(0, 16)}${safeExt}`;
    }

    return `media/original/${params.contentHash.slice(0, 2)}/${params.contentHash}${safeExt}`;
  }

  // --- 3. MIME / BYTE VALIDATION ---

  public validateFileBuffer(buffer: Buffer, originalFilename: string, declaredMime: string): AssetValidationResult {
    const errors: string[] = [];
    const sanitizedFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");

    // Path traversal safety
    if (originalFilename.includes("..") || originalFilename.includes("/") || originalFilename.includes("\\")) {
      errors.push("Filename contains unsafe directory traversal sequences");
    }

    const byteSize = buffer.length;
    const contentHash = this.computeBinaryHash(buffer);

    // Magic number inspection
    let detectedMime = declaredMime;
    let quarantineReason: string | undefined;

    if (byteSize >= 4) {
      const hex = buffer.slice(0, 4).toString("hex").toUpperCase();
      if (hex.startsWith("FFD8FF")) {
        detectedMime = "image/jpeg";
      } else if (hex.startsWith("89504E47")) {
        detectedMime = "image/png";
      } else if (hex.startsWith("47494638")) {
        detectedMime = "image/gif";
      } else if (hex.startsWith("52494646") && buffer.length >= 12 && buffer.slice(8, 12).toString("ascii") === "WEBP") {
        detectedMime = "image/webp";
      } else if (hex.startsWith("52494646") && buffer.length >= 12 && buffer.slice(8, 12).toString("ascii") === "WAVE") {
        detectedMime = "audio/wav";
      } else if (hex.startsWith("25504446")) {
        detectedMime = "application/pdf";
      } else if (buffer.slice(0, 50).toString("utf-8").toLowerCase().includes("<svg")) {
        detectedMime = "image/svg+xml";
        // SVG script injection safety
        const svgContent = buffer.toString("utf-8").toLowerCase();
        if (svgContent.includes("<script") || svgContent.includes("onload=") || svgContent.includes("javascript:")) {
          errors.push("SVG file contains prohibited embedded scripts or event handlers");
          quarantineReason = "SVG_SCRIPT_INJECTION_DETECTED";
        }
      } else if (buffer.slice(0, 50).toString("utf-8").toLowerCase().includes("<html") || buffer.slice(0, 50).toString("utf-8").toLowerCase().includes("<!doctype html")) {
        errors.push("Executable or HTML content disguised as media binary");
        quarantineReason = "HTML_DISGUISED_AS_IMAGE";
      }
    }

    // Size boundaries
    const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB
    const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 MB
    const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100 MB (SGIS manuscripts)

    if (detectedMime.startsWith("image/") && byteSize > MAX_IMAGE_SIZE) {
      errors.push(`Image exceeds max size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    } else if (detectedMime.startsWith("audio/") && byteSize > MAX_AUDIO_SIZE) {
      errors.push(`Audio exceeds max size of ${MAX_AUDIO_SIZE / 1024 / 1024}MB`);
    } else if (byteSize > MAX_DOC_SIZE) {
      errors.push(`File exceeds max size of ${MAX_DOC_SIZE / 1024 / 1024}MB`);
    }

    return {
      valid: errors.length === 0,
      detectedMime,
      sanitizedFilename,
      contentHash,
      byteSize,
      quarantineReason,
      errors
    };
  }

  // --- 4. UPLOAD & DEDUPLICATION ENGINE ---

  public async registerOrUploadAsset(options: {
    buffer: Buffer;
    originalFilename: string;
    declaredMime: string;
    assetType: AssetType;
    origin: AssetOrigin;
    tenantId?: string;
    visibility?: AssetVisibility;
    createdBy: string;
    userRole?: string;
  }): Promise<{ asset: MediaAsset; isReused: boolean; validation: AssetValidationResult }> {
    // 1. Authorization check
    if (options.userRole === "guest" || !options.createdBy) {
      this.logAudit({ actor: options.createdBy || "guest", action: "UPLOAD_ASSET", result: "DENIED", details: { reason: "Unauthorized" } });
      throw new Error("Unauthorized: Guest users cannot upload media assets");
    }

    // 2. Validate Bytes & MIME
    const validation = this.validateFileBuffer(options.buffer, options.originalFilename, options.declaredMime);
    if (!validation.valid) {
      this.logAudit({ actor: options.createdBy, action: "UPLOAD_ASSET", result: "FAILED", details: { errors: validation.errors } });
      throw new Error(`Asset validation failed: ${validation.errors.join(", ")}`);
    }

    // 3. Deduplication Check (Lookup by contentHash)
    const existingAssetId = this.hashIndex.get(validation.contentHash);
    if (existingAssetId) {
      const existingAsset = this.registry.get(existingAssetId);
      if (existingAsset && existingAsset.integrityStatus === "VERIFIED") {
        // Tenant security: if existing asset is private and belongs to different tenant, do not cross-leak
        if (existingAsset.visibility === "PRIVATE" && existingAsset.tenantId && existingAsset.tenantId !== options.tenantId) {
          // Process as separate isolated upload
        } else {
          this.logAudit({
            actor: options.createdBy,
            action: "UPLOAD_DEDUPLICATED_REUSE",
            assetId: existingAsset.assetId,
            result: "SUCCESS",
            details: { contentHash: validation.contentHash }
          });
          return { asset: existingAsset, isReused: true, validation };
        }
      }
    }

    // 4. Generate Canonical Storage Key
    const storageKey = this.generateCanonicalStorageKey({
      assetType: options.assetType,
      contentHash: validation.contentHash,
      originalFilename: validation.sanitizedFilename,
      tenantId: options.tenantId
    });

    // 5. Store Binary (R2 or Local Fallback)
    const uploadResult = await uploadMediaBuffer({
      buffer: options.buffer,
      objectKey: storageKey,
      mimeType: validation.detectedMime,
      cacheControl: "public, max-age=31536000, immutable"
    });

    const assetId = `asset_${Date.now()}_${validation.contentHash.slice(0, 8)}`;
    const newAsset: MediaAsset = {
      assetId,
      assetType: options.assetType,
      origin: options.origin,
      storageProvider: uploadResult.isR2 ? "R2" : "LOCAL_FALLBACK",
      storageKey,
      contentHash: validation.contentHash,
      byteSize: validation.byteSize,
      contentType: validation.detectedMime,
      extension: path.extname(validation.sanitizedFilename),
      originalFilename: validation.sanitizedFilename,
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy,
      tenantId: options.tenantId || "global",
      visibility: options.visibility || "PUBLIC",
      integrityStatus: "VERIFIED",
      lifecycleStatus: "ACTIVE",
      lastVerifiedAt: new Date().toISOString()
    };

    this.registry.set(assetId, newAsset);
    this.hashIndex.set(validation.contentHash, assetId);
    this.storageKeyIndex.set(storageKey, assetId);
    this.saveRegistry();

    this.logAudit({
      actor: options.createdBy,
      action: "UPLOAD_ASSET",
      assetId,
      result: "SUCCESS",
      details: { storageKey, byteSize: validation.byteSize, isR2: uploadResult.isR2 }
    });

    return { asset: newAsset, isReused: false, validation };
  }

  // --- 5. REFERENCE REGISTRY & TRACING ---

  public trackReference(params: {
    assetId: string;
    entityType: string;
    entityId: string;
    field: string;
    referenceClass: ReferenceClass;
  }): AssetReference {
    const referenceId = `ref_${params.entityType}_${params.entityId}_${params.field}`;
    const now = new Date().toISOString();

    const ref: AssetReference = {
      referenceId,
      assetId: params.assetId,
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      referenceClass: params.referenceClass,
      createdAt: this.references.get(referenceId)?.createdAt || now,
      updatedAt: now
    };

    this.references.set(referenceId, ref);
    this.saveReferences();

    // Mark asset active
    const asset = this.registry.get(params.assetId);
    if (asset && asset.lifecycleStatus !== "ACTIVE") {
      asset.lifecycleStatus = "ACTIVE";
      this.saveRegistry();
    }

    return ref;
  }

  public removeReference(entityType: string, entityId: string, field: string): boolean {
    const referenceId = `ref_${entityType}_${entityId}_${field}`;
    const deleted = this.references.delete(referenceId);
    if (deleted) {
      this.saveReferences();
    }
    return deleted;
  }

  public getReferencesForAsset(assetId: string): AssetReference[] {
    const list: AssetReference[] = [];
    for (const ref of this.references.values()) {
      if (ref.assetId === assetId) {
        list.push(ref);
      }
    }
    return list;
  }

  // --- 6. INTEGRITY SCANNER & BROKEN REFERENCE DETECTION ---

  public async scanAssetIntegrity(assetId: string): Promise<AssetIntegrityStatus> {
    const asset = this.registry.get(assetId);
    if (!asset) return "MISSING";

    const exists = await objectExistsInStorage(asset.storageKey);
    if (!exists) {
      asset.integrityStatus = "MISSING";
      this.saveRegistry();
      return "MISSING";
    }

    asset.integrityStatus = "VERIFIED";
    asset.lastVerifiedAt = new Date().toISOString();
    this.saveRegistry();
    return "VERIFIED";
  }

  public async detectBrokenReferences(canonicalEntities?: Array<{ type: string; id: string; heroImage?: string; audioUrl?: string }>): Promise<MediaReconciliationAction[]> {
    const actions: MediaReconciliationAction[] = [];

    for (const ref of this.references.values()) {
      const asset = this.registry.get(ref.assetId);
      if (!asset) {
        actions.push({
          targetId: ref.entityId,
          entityType: ref.entityType,
          field: ref.field,
          action: ref.referenceClass === "REQUIRED" ? "REUPLOAD_REQUIRED" : "MARK_OPTIONAL_MISSING",
          reason: `Referenced asset ${ref.assetId} does not exist in registry`
        });
        continue;
      }

      const status = await this.scanAssetIntegrity(asset.assetId);
      if (status === "MISSING") {
        if (asset.origin === "TTS_GENERATED" || asset.origin === "DERIVED_IMAGE") {
          actions.push({
            targetId: ref.entityId,
            entityType: ref.entityType,
            field: ref.field,
            action: "REGENERATE_DERIVED",
            reason: `Derived asset ${asset.assetId} is missing from storage and can be regenerated`,
            assetId: asset.assetId
          });
        } else {
          actions.push({
            targetId: ref.entityId,
            entityType: ref.entityType,
            field: ref.field,
            action: ref.referenceClass === "REQUIRED" ? "REUPLOAD_REQUIRED" : "MARK_OPTIONAL_MISSING",
            reason: `Original asset ${asset.assetId} is missing from storage`,
            assetId: asset.assetId
          });
        }
      }
    }

    return actions;
  }

  // --- 7. TTS ASSET MANAGEMENT & SINGLE-FLIGHT DEDUPLICATION ---

  public async getOrGenerateTTS(params: {
    contentType: string;
    contentId: string;
    text: string;
    title?: string;
    language?: string;
    voice?: string;
    generatorFn: () => Promise<Buffer>;
    createdBy?: string;
  }): Promise<{ audioUrl: string; contentHash: string; fromCache: boolean; status: "READY" | "FEATURE_DISABLED" | "FAILED" }> {
    this.ttsRequested++;

    // 1. Feature Control check
    const fcEval = serverFeatureControlService.evaluateFeature("ai.tts");
    if (!fcEval.enabled) {
      return { audioUrl: "", contentHash: "", fromCache: false, status: "FEATURE_DISABLED" };
    }

    // 2. Deterministic Hash & Storage Key
    const spokenText = params.title ? `${params.title}। ${params.text}` : params.text;
    const { contentHash, storageKey } = this.computeDeterministicTTSKey({
      contentType: params.contentType,
      contentId: params.contentId,
      language: params.language,
      voice: params.voice,
      spokenText
    });

    // 3. Cache & Registry Check
    const existingAssetId = this.storageKeyIndex.get(storageKey) || this.hashIndex.get(contentHash);
    if (existingAssetId) {
      const existingAsset = this.registry.get(existingAssetId);
      if (existingAsset && existingAsset.integrityStatus === "VERIFIED") {
        const exists = await objectExistsInStorage(existingAsset.storageKey);
        if (exists) {
          this.ttsCacheHits++;
          return {
            audioUrl: getStoragePublicUrl(existingAsset.storageKey),
            contentHash,
            fromCache: true,
            status: "READY"
          };
        }
      }
    }

    // 4. Single-Flight Concurrency Deduplication
    const jobKey = storageKey;
    if (this.activeTTSJobs.has(jobKey)) {
      this.ttsCacheHits++;
      return this.activeTTSJobs.get(jobKey)!;
    }

    const jobPromise = (async () => {
      try {
        const buffer = await params.generatorFn();
        const validation = this.validateFileBuffer(buffer, "audio.wav", "audio/wav");

        // Upload to storage
        await uploadMediaBuffer({
          buffer,
          objectKey: storageKey,
          mimeType: "audio/wav",
          cacheControl: "public, max-age=31536000, immutable"
        });

        const assetId = `tts_${contentHash.slice(0, 12)}`;
        const asset: MediaAsset = {
          assetId,
          assetType: "TTS_AUDIO",
          origin: "TTS_GENERATED",
          storageProvider: isR2Configured() ? "R2" : "LOCAL_FALLBACK",
          storageKey,
          contentHash,
          byteSize: validation.byteSize,
          contentType: "audio/wav",
          language: params.language || "ne",
          createdAt: new Date().toISOString(),
          createdBy: params.createdBy || "system",
          visibility: "PUBLIC",
          integrityStatus: "VERIFIED",
          lifecycleStatus: "ACTIVE",
          lastVerifiedAt: new Date().toISOString()
        };

        this.registry.set(assetId, asset);
        this.hashIndex.set(contentHash, assetId);
        this.storageKeyIndex.set(storageKey, assetId);
        this.saveRegistry();

        // Track reference
        this.trackReference({
          assetId,
          entityType: params.contentType,
          entityId: params.contentId,
          field: "audioUrl",
          referenceClass: "DERIVED_OPTIONAL"
        });

        return {
          audioUrl: getStoragePublicUrl(storageKey),
          contentHash,
          fromCache: false,
          status: "READY" as const
        };
      } finally {
        this.activeTTSJobs.delete(jobKey);
      }
    })();

    this.activeTTSJobs.set(jobKey, jobPromise);
    return jobPromise;
  }

  // --- 8. RESTORE RECONCILIATION ---

  public async reconcileRestoredMedia(restoredRecords: Array<{ id: string; domain: string; heroImage?: string; audioUrl?: string; ttsAudioHash?: string; title?: string }>): Promise<{
    reconciledCount: number;
    reusedAssets: number;
    queuedRegen: number;
    missingOriginals: number;
  }> {
    let reconciledCount = 0;
    let reusedAssets = 0;
    let queuedRegen = 0;
    let missingOriginals = 0;

    for (const rec of restoredRecords) {
      // 1. Reconcile Hero Image
      if (rec.heroImage) {
        const canonicalKey = this.resolveLegacyPath(rec.heroImage);
        const assetId = this.storageKeyIndex.get(canonicalKey);
        if (assetId) {
          const asset = this.registry.get(assetId);
          if (asset && asset.integrityStatus === "VERIFIED") {
            this.trackReference({
              assetId,
              entityType: rec.domain,
              entityId: rec.id,
              field: "heroImage",
              referenceClass: "OPTIONAL"
            });
            reusedAssets++;
          } else {
            missingOriginals++;
          }
        } else {
          // Legacy or external URL
          reusedAssets++;
        }
        reconciledCount++;
      }

      // 2. Reconcile TTS Audio
      if (rec.ttsAudioHash && rec.title) {
        const currentHash = computeTTSContentHash({ text: rec.title, language: "ne" });
        if (rec.ttsAudioHash === currentHash) {
          const ttsKey = `tts/${currentHash}/ne/aoede.wav`;
          const assetId = this.storageKeyIndex.get(ttsKey);
          if (assetId) {
            this.trackReference({
              assetId,
              entityType: rec.domain,
              entityId: rec.id,
              field: "audioUrl",
              referenceClass: "DERIVED_OPTIONAL"
            });
            reusedAssets++;
          } else {
            queuedRegen++;
          }
        } else {
          // Text mutated: queue regeneration under new hash
          queuedRegen++;
        }
        reconciledCount++;
      }
    }

    return { reconciledCount, reusedAssets, queuedRegen, missingOriginals };
  }

  // --- 9. LEGACY ALIAS RESOLUTION ---

  public resolveLegacyPath(urlOrPath: string): string {
    const clean = (urlOrPath || "").trim();
    if (this.legacyAliases.has(clean)) {
      return this.legacyAliases.get(clean)!;
    }
    return clean.replace(/^\//, "");
  }

  public registerLegacyAlias(legacyPath: string, canonicalKey: string): void {
    this.legacyAliases.set(legacyPath, canonicalKey);
  }

  // --- 10. SAFE GARBAGE COLLECTION & DRY-RUN PLANNER ---

  public generateCleanupPlan(backupDependencies: string[] = [], snapshotDependencies: string[] = []): AssetCleanupPlan {
    const planId = `cleanup_plan_${Date.now()}`;
    const items: AssetCleanupPlan["items"] = [];
    const backupDepSet = new Set(backupDependencies);
    const snapDepSet = new Set(snapshotDependencies);

    let totalOrphanCandidates = 0;
    let protectedCount = 0;
    let snapshotDependentCount = 0;
    let backupDependentCount = 0;
    let eligibleForDeletionCount = 0;
    let potentialReclaimBytes = 0;

    for (const asset of this.registry.values()) {
      const activeRefs = this.getReferencesForAsset(asset.assetId);
      const isReferenced = activeRefs.length > 0;
      const isBackupDep = backupDepSet.has(asset.assetId) || backupDepSet.has(asset.storageKey);
      const isSnapDep = snapDepSet.has(asset.assetId) || snapDepSet.has(asset.storageKey);

      if (isReferenced) {
        // Asset is active
        continue;
      }

      totalOrphanCandidates++;

      if (asset.isProtected) {
        protectedCount++;
        items.push({
          assetId: asset.assetId,
          storageKey: asset.storageKey,
          byteSize: asset.byteSize,
          lifecycleStatus: asset.lifecycleStatus,
          canDelete: false,
          reason: "Asset is explicitly marked protected"
        });
      } else if (isBackupDep) {
        backupDependentCount++;
        items.push({
          assetId: asset.assetId,
          storageKey: asset.storageKey,
          byteSize: asset.byteSize,
          lifecycleStatus: asset.lifecycleStatus,
          canDelete: false,
          reason: "Asset is retained by active backup policy"
        });
      } else if (isSnapDep) {
        snapshotDependentCount++;
        items.push({
          assetId: asset.assetId,
          storageKey: asset.storageKey,
          byteSize: asset.byteSize,
          lifecycleStatus: asset.lifecycleStatus,
          canDelete: false,
          reason: "Asset is referenced by active snapshot manifest"
        });
      } else {
        eligibleForDeletionCount++;
        potentialReclaimBytes += asset.byteSize;
        items.push({
          assetId: asset.assetId,
          storageKey: asset.storageKey,
          byteSize: asset.byteSize,
          lifecycleStatus: "DELETE_ELIGIBLE",
          canDelete: true,
          reason: "Zero active references, zero backup dependencies, zero snapshot dependencies"
        });
      }
    }

    return {
      planId,
      createdAt: new Date().toISOString(),
      totalOrphanCandidates,
      protectedCount,
      snapshotDependentCount,
      backupDependentCount,
      eligibleForDeletionCount,
      potentialReclaimBytes,
      items
    };
  }

  public async executeSafeCleanup(plan: AssetCleanupPlan, actorRole: string, actorId: string): Promise<{ deletedCount: number; errors: string[] }> {
    if (actorRole !== "super_admin" && actorRole !== "admin") {
      this.logAudit({ actor: actorId, action: "EXECUTE_CLEANUP", result: "DENIED", details: { reason: "Insufficient permissions" } });
      throw new Error("Unauthorized: Garbage collection requires admin privileges");
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const item of plan.items) {
      if (item.canDelete) {
        try {
          await deleteMediaObject(item.storageKey);
          const asset = this.registry.get(item.assetId);
          if (asset) {
            asset.lifecycleStatus = "DELETED";
            this.registry.delete(item.assetId);
            this.hashIndex.delete(asset.contentHash);
            this.storageKeyIndex.delete(asset.storageKey);
          }
          deletedCount++;
        } catch (err: any) {
          errors.push(`Failed to delete ${item.storageKey}: ${err.message}`);
        }
      }
    }

    this.saveRegistry();
    this.logAudit({
      actor: actorId,
      action: "EXECUTE_CLEANUP",
      result: errors.length === 0 ? "SUCCESS" : "WARNING",
      details: { planId: plan.planId, deletedCount, errors }
    });

    return { deletedCount, errors };
  }

  // --- 11. ISOLATED NON-DESTRUCTIVE LIVE R2 DIAGNOSTIC ---

  public async testLiveR2Connection(): Promise<{ verified: boolean; message: string; details?: any }> {
    if (!isR2Configured()) {
      return {
        verified: false,
        message: "Live Cloudflare R2 credentials are not configured or non-operational. Operating in LOCAL_FALLBACK mode."
      };
    }

    const testKey = `diagnostics/r2_probe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.json`;
    const testBuffer = Buffer.from(JSON.stringify({ test: true, timestamp: new Date().toISOString() }), "utf-8");

    try {
      // 1. Put
      const upRes = await uploadMediaBuffer({
        buffer: testBuffer,
        objectKey: testKey,
        mimeType: "application/json"
      });

      if (!upRes.isR2) {
        return {
          verified: false,
          message: "Upload succeeded to local disk fallback, but live Cloudflare R2 client is unverified."
        };
      }

      // 2. Head / Exists
      const exists = await objectExistsInStorage(testKey);

      // 3. Delete diagnostic probe
      await deleteMediaObject(testKey);

      return {
        verified: exists,
        message: exists ? "Live Cloudflare R2 connection verified successfully." : "Object put succeeded but head check failed."
      };
    } catch (err: any) {
      return {
        verified: false,
        message: `Cloudflare R2 diagnostic probe failed: ${err.message}`
      };
    }
  }

  // --- 12. TELEMETRY & OBSERVABILITY ---

  public getTelemetry(): MediaIntegrityTelemetry {
    let verified = 0;
    let missing = 0;
    let hashMismatch = 0;
    let quarantined = 0;
    let legacy = 0;
    let orphans = 0;
    let ttsReady = 0;
    let totalBytes = 0;

    for (const asset of this.registry.values()) {
      totalBytes += asset.byteSize || 0;
      if (asset.integrityStatus === "VERIFIED") verified++;
      else if (asset.integrityStatus === "MISSING") missing++;
      else if (asset.integrityStatus === "HASH_MISMATCH") hashMismatch++;
      else if (asset.integrityStatus === "QUARANTINED") quarantined++;
      else if (asset.integrityStatus === "LEGACY_UNVERIFIED") legacy++;

      if (asset.lifecycleStatus === "ORPHAN_CANDIDATE") orphans++;
      if (asset.assetType === "TTS_AUDIO" && asset.integrityStatus === "VERIFIED") ttsReady++;
    }

    return {
      totalAssets: this.registry.size,
      verifiedAssets: verified,
      missingAssets: missing,
      hashMismatches: hashMismatch,
      quarantinedAssets: quarantined,
      legacyAssets: legacy,
      orphanCandidates: orphans,
      ttsReadyCount: ttsReady,
      ttsQueuedCount: this.activeTTSJobs.size,
      ttsFailedCount: 0,
      ttsCacheHits: this.ttsCacheHits,
      brokenReferencesCount: 0,
      totalStorageBytes: totalBytes,
      liveR2Status: isR2Configured() ? "VERIFIED" : "UNVERIFIED",
      lastScanAt: new Date().toISOString()
    };
  }

  public getAsset(assetId: string): MediaAsset | undefined {
    return this.registry.get(assetId);
  }

  public getAssetByStorageKey(storageKey: string): MediaAsset | undefined {
    const id = this.storageKeyIndex.get(storageKey);
    return id ? this.registry.get(id) : undefined;
  }

  public getAllAssets(): MediaAsset[] {
    return Array.from(this.registry.values());
  }

  public getAuditLogs(): any[] {
    return this.auditLogs;
  }
}

export const mediaIntegrityOS = MediaIntegrityOS.getInstance();
