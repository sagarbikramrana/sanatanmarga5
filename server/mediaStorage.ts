import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { captureCASConflict } from "./sentry.js";

// Environment variables for Cloudflare R2 / S3 (Supports MEDIA_R2_* and CLOUDFLARE_R2_*)
const ACCOUNT_ID = process.env.MEDIA_R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.MEDIA_R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.MEDIA_R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";
const BUCKET_NAME = process.env.MEDIA_R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || "sanatanos-assets";
const PUBLIC_BASE_URL = process.env.MEDIA_R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_DOMAIN || "";
const R2_ENDPOINT = process.env.MEDIA_R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT || (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

// Dedicated Snapshot R2 Configuration (Phase 15: Strict Storage Boundary Isolation)
const SNAPSHOT_ACCOUNT_ID = process.env.SNAPSHOT_R2_ACCOUNT_ID || process.env.CLOUDFLARE_SNAPSHOT_R2_ACCOUNT_ID || ACCOUNT_ID;
const SNAPSHOT_ACCESS_KEY_ID = process.env.SNAPSHOT_R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_SNAPSHOT_R2_ACCESS_KEY_ID || ACCESS_KEY_ID;
const SNAPSHOT_SECRET_ACCESS_KEY = process.env.SNAPSHOT_R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SNAPSHOT_R2_SECRET_ACCESS_KEY || SECRET_ACCESS_KEY;
const SNAPSHOT_BUCKET_NAME = process.env.SNAPSHOT_R2_BUCKET_NAME || process.env.CLOUDFLARE_SNAPSHOT_R2_BUCKET || process.env.SNAPSHOT_R2_BUCKET || BUCKET_NAME;
const SNAPSHOT_PUBLIC_URL = process.env.SNAPSHOT_R2_PUBLIC_URL || process.env.CLOUDFLARE_SNAPSHOT_R2_PUBLIC_URL || PUBLIC_BASE_URL;
const SNAPSHOT_R2_ENDPOINT = process.env.SNAPSHOT_R2_ENDPOINT || process.env.CLOUDFLARE_SNAPSHOT_R2_ENDPOINT || (SNAPSHOT_ACCOUNT_ID ? `https://${SNAPSHOT_ACCOUNT_ID}.r2.cloudflarestorage.com` : R2_ENDPOINT);

export function resolveS3ApiEndpoint(rawEndpoint: string, accountId: string): string | null {
  if (rawEndpoint && rawEndpoint.trim()) {
    let candidate = rawEndpoint.trim();
    if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
      candidate = `https://${candidate}`;
    }
    try {
      const u = new URL(candidate);
      // r2.dev hostnames are public CDN / asset delivery domains, NOT S3 API endpoints
      if (u.hostname.endsWith(".r2.dev")) {
        if (accountId && accountId.length >= 10 && !accountId.includes("test")) {
          return `https://${accountId}.r2.cloudflarestorage.com`;
        }
        return null;
      }
      return u.toString().replace(/\/$/, "");
    } catch {
      // Fall through to account ID derivation if URL parsing fails
    }
  }

  // Canonical Cloudflare S3 endpoint derivation from Account ID
  if (accountId && accountId.length >= 10 && !accountId.includes("test")) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return null;
}

export const isR2Configured = (): boolean => {
  const endpoint = resolveS3ApiEndpoint(R2_ENDPOINT, ACCOUNT_ID);
  return Boolean(
    endpoint &&
    ACCOUNT_ID && 
    ACCESS_KEY_ID && 
    SECRET_ACCESS_KEY && 
    ACCOUNT_ID !== "test_account_id" &&
    ACCESS_KEY_ID !== "test_access_key" &&
    SECRET_ACCESS_KEY !== "test_secret_key" &&
    ACCESS_KEY_ID !== SECRET_ACCESS_KEY &&
    SECRET_ACCESS_KEY.length >= 40
  );
};

export const isSnapshotR2Configured = (): boolean => {
  const endpoint = resolveS3ApiEndpoint(SNAPSHOT_R2_ENDPOINT, SNAPSHOT_ACCOUNT_ID);
  return Boolean(
    endpoint &&
    SNAPSHOT_ACCOUNT_ID && 
    SNAPSHOT_ACCESS_KEY_ID && 
    SNAPSHOT_SECRET_ACCESS_KEY && 
    SNAPSHOT_ACCOUNT_ID !== "test_account_id" &&
    SNAPSHOT_ACCESS_KEY_ID !== "test_access_key" &&
    SNAPSHOT_SECRET_ACCESS_KEY !== "test_secret_key" &&
    SNAPSHOT_ACCESS_KEY_ID !== SNAPSHOT_SECRET_ACCESS_KEY &&
    SNAPSHOT_SECRET_ACCESS_KEY.length >= 40
  );
};

export const getR2BucketName = (): string => BUCKET_NAME;
export const getSnapshotR2BucketName = (): string => SNAPSHOT_BUCKET_NAME;

let s3Client: S3Client | null = null;
let snapshotS3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!isR2Configured()) return null;
  const endpoint = resolveS3ApiEndpoint(R2_ENDPOINT, ACCOUNT_ID);
  if (!endpoint) {
    console.warn("[R2_CONFIG_INVALID] Media R2 S3 API endpoint is invalid or lacks S3 API protocol. Falling back to local storage.");
    return null;
  }
  if (!s3Client) {
    try {
      s3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId: ACCESS_KEY_ID,
          secretAccessKey: SECRET_ACCESS_KEY,
        },
      });
    } catch (err: any) {
      console.warn("[R2_CONFIG_INVALID] Failed to initialize Media S3Client with endpoint:", err?.message || err);
      return null;
    }
  }
  return s3Client;
}

function getSnapshotS3Client(): S3Client | null {
  if (!isSnapshotR2Configured()) return null;
  const endpoint = resolveS3ApiEndpoint(SNAPSHOT_R2_ENDPOINT, SNAPSHOT_ACCOUNT_ID);
  if (!endpoint) {
    console.warn("[R2_CONFIG_INVALID] Snapshot R2 S3 API endpoint is invalid or lacks S3 API protocol. Falling back to local storage.");
    return null;
  }
  if (!snapshotS3Client) {
    try {
      snapshotS3Client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId: SNAPSHOT_ACCESS_KEY_ID,
          secretAccessKey: SNAPSHOT_SECRET_ACCESS_KEY,
        },
      });
    } catch (err: any) {
      console.warn("[R2_CONFIG_INVALID] Failed to initialize Snapshot S3Client with endpoint:", err?.message || err);
      return null;
    }
  }
  return snapshotS3Client;
}

export function getStoragePublicUrl(objectKey: string): string {
  const normKey = objectKey.replace(/^\//, '');
  if (isR2Configured() && PUBLIC_BASE_URL) {
    let base = PUBLIC_BASE_URL.trim().replace(/\/$/, '');
    if (!base.startsWith("http://") && !base.startsWith("https://")) {
      base = `https://${base}`;
    }
    return `${base}/${normKey}`;
  }
  // Server-mediated delivery route fallback when custom CDN domain (MEDIA_R2_PUBLIC_URL) is not configured or R2 credentials are non-operational
  const host = process.env.APP_URL || "http://localhost:3000";
  return `${host.replace(/\/$/, '')}/api/media/stream?key=${encodeURIComponent(normKey)}`;
}

export function getSnapshotPublicUrl(objectKey: string): string {
  const normKey = objectKey.replace(/^\//, '');
  if (isSnapshotR2Configured() && SNAPSHOT_PUBLIC_URL) {
    let base = SNAPSHOT_PUBLIC_URL.trim().replace(/\/$/, '');
    if (!base.startsWith("http://") && !base.startsWith("https://")) {
      base = `https://${base}`;
    }
    return `${base}/${normKey}`;
  }
  const host = process.env.APP_URL || "http://localhost:3000";
  return `${host.replace(/\/$/, '')}/api/snapshots/${encodeURIComponent(normKey)}`;
}

/**
 * Checks whether an object exists in Cloudflare R2 / S3 or local disk fallback
 */
export async function objectExistsInStorage(objectKey: string): Promise<boolean> {
  const client = getS3Client();
  if (client && isR2Configured()) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
        })
      );
      return true;
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // If R2 check encounters transient error, also check local
    }
  }

  // Check local fallback
  const localPath = path.join(process.cwd(), "public", "uploads", objectKey);
  return fs.existsSync(localPath);
}

export function sanitizeTenantPath(tenantId: string = "sanatan-media"): string {
  return tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function generateObjectKey(tenantId: string = "sanatan-media", category: string = "general", fileName: string): string {
  const safeTenant = sanitizeTenantPath(tenantId);
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const ext = path.extname(fileName) || "";
  const nameWithoutExt = path.basename(fileName, ext).toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);

  return `tenants/${safeTenant}/${safeCategory}/${timestamp}_${random}_${nameWithoutExt}${ext}`;
}

export async function createPresignedUploadUrl({
  tenantId = "sanatan-media",
  category = "general",
  fileName,
  mimeType,
}: {
  tenantId?: string;
  category?: string;
  fileName: string;
  mimeType: string;
}) {
  const objectKey = generateObjectKey(tenantId, category, fileName);
  
  try {
    const client = getS3Client();

    if (client && isR2Configured()) {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        ContentType: mimeType,
      });

      // 15-minute presigned URL
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
      const publicUrl = getStoragePublicUrl(objectKey);

      return {
        isR2: true,
        uploadUrl,
        objectKey,
        publicUrl,
        bucket: BUCKET_NAME,
      };
    }
  } catch (error) {
    console.warn("S3/R2 presigned URL generation failed, falling back to local storage:", error);
  }

  // Fallback when R2 credentials are not set or fail: local disk server storage URL
  const host = process.env.APP_URL || "http://localhost:3000";
  const publicUrl = `${host.replace(/\/$/, '')}/uploads/${objectKey}`;
  const uploadUrl = `${host.replace(/\/$/, '')}/api/media/upload-direct?key=${encodeURIComponent(objectKey)}`;

  return {
    isR2: false,
    uploadUrl,
    objectKey,
    publicUrl,
    bucket: "local-fallback",
  };
}

export async function uploadMediaBuffer(
  paramOrBuffer: Buffer | { buffer: Buffer; objectKey: string; mimeType: string; cacheControl?: string },
  optObjectKey?: string,
  optMimeType?: string,
  optCacheControl?: string
): Promise<{ publicUrl: string; isR2: boolean }> {
  let buffer: Buffer;
  let objectKey: string;
  let mimeType: string;
  let cacheControl: string | undefined;

  if (Buffer.isBuffer(paramOrBuffer)) {
    buffer = paramOrBuffer;
    objectKey = optObjectKey || "general/audio.wav";
    mimeType = optMimeType || "audio/wav";
    cacheControl = optCacheControl || "public, max-age=31536000, immutable";
  } else {
    buffer = paramOrBuffer.buffer;
    objectKey = paramOrBuffer.objectKey;
    mimeType = paramOrBuffer.mimeType;
    cacheControl = paramOrBuffer.cacheControl || "public, max-age=31536000, immutable";
  }

  try {
    const client = getS3Client();

    if (client && isR2Configured()) {
      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: cacheControl,
        })
      );

      const publicUrl = PUBLIC_BASE_URL 
        ? `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${objectKey}`
        : `https://${BUCKET_NAME}.${ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`;

      return { publicUrl, isR2: true };
    }
  } catch (error) {
    console.warn("S3/R2 upload failed, falling back to local storage:", error);
  }

  // Save to local filesystem in public/uploads/
  const uploadsDir = path.join(process.cwd(), "public", "uploads", path.dirname(objectKey));
  fs.mkdirSync(uploadsDir, { recursive: true });

  const fullPath = path.join(process.cwd(), "public", "uploads", objectKey);
  fs.writeFileSync(fullPath, buffer);

  const host = process.env.APP_URL || "http://localhost:3000";
  const publicUrl = `${host.replace(/\/$/, '')}/uploads/${objectKey}`;

  return { publicUrl, isR2: false };
}

export async function deleteMediaObject(objectKey: string): Promise<boolean> {
  try {
    const client = getS3Client();
    if (client && isR2Configured()) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: objectKey,
        })
      );
      return true;
    }

    // Try deleting local file
    const localPath = path.join(process.cwd(), "public", "uploads", objectKey);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return true;
  } catch (error) {
    console.error("Failed to delete media object:", error);
    return false;
  }
}

/**
 * Generates an immutable, versioned snapshot module object key.
 * Ensures that newly compiled revisions never overwrite previous revisions
 * referenced by older committed manifests.
 */
export function generateImmutableSnapshotKey(
  moduleKey: string,
  contentHash: string,
  generation: number = 1
): string {
  const safeModKey = moduleKey.replace(/[^a-zA-Z0-9_\-\/]/g, "_").replace(/^\//, "");
  const hashPrefix = contentHash.substring(0, 16);
  return `snapshots/modules/${safeModKey}_gen${generation}_${hashPrefix}.json`;
}

/**
 * Downloads the current snapshot manifest and its ETag from Cloudflare R2 / S3,
 * or from local disk fallback if R2 is not configured.
 */
export async function downloadSnapshotManifestWithETag(manifestKey: string = "manifest.json"): Promise<{
  manifest: any | null;
  etag: string | null;
  isR2: boolean;
}> {
  try {
    const client = getSnapshotS3Client();
    if (client && isSnapshotR2Configured()) {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: SNAPSHOT_BUCKET_NAME,
          Key: manifestKey,
        })
      );
      if (res.Body) {
        const str = await res.Body.transformToString();
        const parsed = JSON.parse(str);
        const rawEtag = res.ETag || null;
        return {
          manifest: parsed,
          etag: rawEtag,
          isR2: true,
        };
      }
    }
  } catch (r2Err: any) {
    if (r2Err.name !== "NoSuchKey" && r2Err.$metadata?.httpStatusCode !== 404) {
      console.warn(`[SNAPSHOT_OS] R2 download manifest with ETag warning:`, r2Err?.message || r2Err);
    }
  }

  // Fallback to local snapshot disk
  const checkPaths = [
    path.join(process.cwd(), "public", manifestKey),
    path.join(process.cwd(), "data", "snapshots", manifestKey)
  ];
  for (const p of checkPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        const fileHash = crypto.createHash("sha256").update(raw).digest("hex");
        const etag = `"${fileHash}"`;
        return { manifest: parsed, etag, isR2: false };
      }
    } catch {}
  }

  return { manifest: null, etag: null, isR2: false };
}

/**
 * Upload a JSON snapshot object to Cloudflare R2 (or fallback to local disk)
 * Enforces atomic publishing and durable storage with Compare-And-Swap (CAS) support.
 */
export async function uploadSnapshotObject(
  objectKey: string,
  data: any,
  cacheControl: string = "public, max-age=60, s-maxage=300",
  options?: {
    expectedManifestVersion?: number;
    allowOverwriteStale?: boolean;
    ifMatch?: string;
    ifNoneMatch?: string;
    requireR2Success?: boolean;
    publicationGeneration?: number;
  }
): Promise<{
  success: boolean;
  isR2: boolean;
  etag?: string;
  error?: string;
  isPreconditionFailed?: boolean;
  statusCode?: number;
}> {
  const jsonString = typeof data === "string" ? data : JSON.stringify(data);
  const buffer = Buffer.from(jsonString, "utf-8");
  const computedHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const syntheticEtag = `"${computedHash}"`;

  // Stale-writer & Monotonic Generation protection for manifest.json
  const isManifest = objectKey === "manifest.json" || objectKey.endsWith("/manifest.json");
  if (isManifest && !options?.allowOverwriteStale) {
    try {
      let incomingVersion: number | undefined;
      let incomingGen: number | undefined;
      let incomingHash: string | undefined;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed) {
        if (typeof parsed.manifestVersion === "number") incomingVersion = parsed.manifestVersion;
        if (typeof parsed.publicationGeneration === "number") incomingGen = parsed.publicationGeneration;
        incomingHash = parsed.manifestHash;
      }
      if (options?.publicationGeneration !== undefined) {
        incomingGen = options.publicationGeneration;
      }

      const publicManifestPath = path.join(process.cwd(), "public", "manifest.json");
      const dataManifestPath = path.join(process.cwd(), "data", "snapshots", "manifest.json");
      const checkPaths = [publicManifestPath, dataManifestPath];

      for (const p of checkPaths) {
        if (fs.existsSync(p)) {
          const existingRaw = fs.readFileSync(p, "utf-8");
          const existing = JSON.parse(existingRaw);
          if (existing) {
            const existingGen = typeof existing.publicationGeneration === "number"
              ? existing.publicationGeneration
              : (typeof existing.manifestVersion === "number" ? existing.manifestVersion : 0);
            
            if (incomingGen !== undefined && existingGen >= incomingGen && existingGen > 0) {
              const errMsg = `STALE_MANIFEST_WRITE: Committed generation gen${existingGen} is newer than or equal to candidate gen${incomingGen}`;
              console.warn(`[SNAPSHOT_OS] ${errMsg} for ${objectKey}`);
              captureCASConflict({ objectKey, incomingGeneration: incomingGen, existingGeneration: existingGen, reason: errMsg });
              return { success: false, isR2: false, error: errMsg, statusCode: 409 };
            }

            if (incomingVersion !== undefined && typeof existing.manifestVersion === "number") {
              if (existing.manifestVersion > incomingVersion) {
                const errMsg = `STALE_MANIFEST_WRITE: Existing manifest version v${existing.manifestVersion} is newer than incoming v${incomingVersion}`;
                console.warn(`[SNAPSHOT_OS] ${errMsg} for ${objectKey}`);
                captureCASConflict({ objectKey, incomingGeneration: incomingVersion, existingGeneration: existing.manifestVersion, reason: errMsg });
                return { success: false, isR2: false, error: errMsg, statusCode: 409 };
              }
              if (existing.manifestVersion === incomingVersion && existing.manifestHash && incomingHash && existing.manifestHash !== incomingHash) {
                const errMsg = `STALE_MANIFEST_WRITE: Manifest version v${incomingVersion} already published with different hash`;
                console.warn(`[SNAPSHOT_OS] ${errMsg} for ${objectKey}`);
                captureCASConflict({ objectKey, incomingGeneration: incomingVersion, existingGeneration: existing.manifestVersion, reason: errMsg });
                return { success: false, isR2: false, error: errMsg, statusCode: 409 };
              }
            }
          }
        }
      }
    } catch (parseErr: any) {
      // Continue if parsing check fails
    }
  }

  // 1. Live R2 Upload with conditional headers (If-Match / If-None-Match)
  try {
    const client = getSnapshotS3Client();
    if (client && isSnapshotR2Configured()) {
      const putInput: any = {
        Bucket: SNAPSHOT_BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: "application/json",
        CacheControl: cacheControl,
      };
      if (options?.ifMatch) {
        putInput.IfMatch = options.ifMatch;
      }
      if (options?.ifNoneMatch) {
        putInput.IfNoneMatch = options.ifNoneMatch;
      }
      const putRes = await client.send(new PutObjectCommand(putInput));
      const committedEtag = putRes.ETag || syntheticEtag;
      console.log(`[SNAPSHOT_OS] R2 CAS upload success (${SNAPSHOT_BUCKET_NAME}): ${objectKey} (${buffer.length} bytes, ETag: ${committedEtag})`);

      // Write locally to mirror committed state
      try {
        const targetPath = path.join(process.cwd(), "data", "snapshots", objectKey);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetPath, buffer);

        const publicSnapPath = path.join(process.cwd(), "public", "snapshots", objectKey);
        const pubDir = path.dirname(publicSnapPath);
        if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
        fs.writeFileSync(publicSnapPath, buffer);

        if (isManifest) {
          const publicPath = path.join(process.cwd(), "public", "manifest.json");
          fs.writeFileSync(publicPath, buffer);
        }
      } catch (localMirrorErr) {
        console.warn(`[SNAPSHOT_OS] Local mirror write warning after R2 commit:`, localMirrorErr);
      }

      return { success: true, isR2: true, etag: committedEtag };
    }
  } catch (error: any) {
    const isPreconditionFailed =
      error.name === "PreconditionFailed" ||
      error.$metadata?.httpStatusCode === 412 ||
      error.Code === "PreconditionFailed" ||
      error.message?.includes("PreconditionFailed") ||
      error.message?.includes("412");

    if (isPreconditionFailed) {
      console.warn(`[SNAPSHOT_OS] R2 CAS PreconditionFailed for ${objectKey}:`, error?.message);
      captureCASConflict({ objectKey, expectedEtag: options?.ifMatch || options?.ifNoneMatch, reason: error?.message || "R2 PreconditionFailed (412)" });
      return {
        success: false,
        isR2: true,
        error: "PRECONDITION_FAILED: Manifest CAS race lost (ETag mismatch or already exists)",
        isPreconditionFailed: true,
        statusCode: 412
      };
    }

    console.warn(`[SNAPSHOT_OS] R2 snapshot upload error for ${objectKey}:`, error?.message || error);
    // Never silently succeed when a conditional write fails!
    return {
      success: false,
      isR2: true,
      error: error?.message || "R2 snapshot upload failed",
      statusCode: error.$metadata?.httpStatusCode || 500
    };
  }

  // 2. Local Disk CAS Simulation (when R2 is not configured, e.g. tests or local dev)
  if (options?.ifMatch || options?.ifNoneMatch) {
    const candidatePaths = [
      path.join(process.cwd(), "public", objectKey),
      path.join(process.cwd(), "data", "snapshots", objectKey),
      path.join(process.cwd(), "public", "snapshots", objectKey),
    ];
    if (isManifest) {
      candidatePaths.push(path.join(process.cwd(), "public", "manifest.json"));
    }
    const resolvedPath = candidatePaths.find(p => fs.existsSync(p));
    const exists = Boolean(resolvedPath);

    if (options.ifNoneMatch === "*") {
      if (exists) {
        const errMsg = "PRECONDITION_FAILED: Target object already exists (If-None-Match: * violated)";
        captureCASConflict({ objectKey, expectedEtag: "If-None-Match: *", reason: errMsg });
        return {
          success: false,
          isR2: false,
          error: errMsg,
          isPreconditionFailed: true,
          statusCode: 412
        };
      }
    } else if (options.ifMatch) {
      if (!exists || !resolvedPath) {
        const errMsg = "PRECONDITION_FAILED: Target object does not exist for If-Match";
        captureCASConflict({ objectKey, expectedEtag: options.ifMatch, reason: errMsg });
        return {
          success: false,
          isR2: false,
          error: errMsg,
          isPreconditionFailed: true,
          statusCode: 412
        };
      }
      const existingRaw = fs.readFileSync(resolvedPath, "utf-8");
      const existingHash = crypto.createHash("sha256").update(existingRaw).digest("hex");
      const currentEtag = `"${existingHash}"`;
      const cleanExpected = options.ifMatch.replace(/^W\//, '').replace(/"/g, '').trim();
      const cleanCurrent = currentEtag.replace(/^W\//, '').replace(/"/g, '').trim();
      if (cleanExpected !== cleanCurrent) {
        const errMsg = `PRECONDITION_FAILED: ETag mismatch (expected ${options.ifMatch}, found ${currentEtag})`;
        captureCASConflict({ objectKey, expectedEtag: options.ifMatch, actualEtag: currentEtag, reason: errMsg });
        return {
          success: false,
          isR2: false,
          error: errMsg,
          isPreconditionFailed: true,
          statusCode: 412
        };
      }
    }
  }

  // Write locally on local storage success
  try {
    const targetPath = path.join(process.cwd(), "data", "snapshots", objectKey);
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, buffer);

    const publicSnapPath = path.join(process.cwd(), "public", "snapshots", objectKey);
    const pubDir = path.dirname(publicSnapPath);
    if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
    fs.writeFileSync(publicSnapPath, buffer);

    if (isManifest) {
      const publicPath = path.join(process.cwd(), "public", "manifest.json");
      fs.writeFileSync(publicPath, buffer);
    }
  } catch (localErr: any) {
    console.error(`[SNAPSHOT_OS] Local snapshot write error for ${objectKey}:`, localErr);
    return { success: false, isR2: false, error: localErr?.message };
  }

  return { success: true, isR2: false, etag: syntheticEtag };
}

/**
 * Download a JSON snapshot object from Cloudflare R2 (with local disk fallback)
 */
export async function downloadSnapshotObject(objectKey: string): Promise<any | null> {
  try {
    const client = getSnapshotS3Client();
    if (client && isSnapshotR2Configured()) {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: SNAPSHOT_BUCKET_NAME,
          Key: objectKey,
        })
      );
      if (res.Body) {
        const str = await res.Body.transformToString();
        return JSON.parse(str);
      }
    }
  } catch (r2Err: any) {
    // S3/R2 object not found or network failure
  }

  // Fallback to local snapshot disk
  try {
    const targetPath = path.join(process.cwd(), "data", "snapshots", objectKey);
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (diskErr) {}

  return null;
}

/**
 * Check if a snapshot object exists in Cloudflare R2 or local disk
 */
export async function objectExistsInR2(objectKey: string): Promise<boolean> {
  try {
    const client = getSnapshotS3Client();
    if (client && isSnapshotR2Configured()) {
      await client.send(
        new HeadObjectCommand({
          Bucket: SNAPSHOT_BUCKET_NAME,
          Key: objectKey,
        })
      );
      return true;
    }
  } catch {}
  const targetPath = path.join(process.cwd(), "data", "snapshots", objectKey);
  return fs.existsSync(targetPath);
}

/**
 * Delete a snapshot object from Cloudflare R2 and local disk
 */
export async function deleteSnapshotObject(objectKey: string): Promise<boolean> {
  try {
    const client = getSnapshotS3Client();
    if (client && isSnapshotR2Configured()) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: SNAPSHOT_BUCKET_NAME,
          Key: objectKey,
        })
      );
    }
  } catch {}

  try {
    const targetPath = path.join(process.cwd(), "data", "snapshots", objectKey);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch {}

  return true;
}

/**
 * Performs safe R2 live integration test if credentials exist
 */
export async function performR2IntegrationCheck(): Promise<{
  connect: boolean;
  write: boolean;
  head: boolean;
  readback: boolean;
  isConfigured: boolean;
  bucket: string;
  publicUrl?: string;
  error?: string;
}> {
  if (ACCESS_KEY_ID && SECRET_ACCESS_KEY && (ACCESS_KEY_ID === SECRET_ACCESS_KEY || SECRET_ACCESS_KEY.length < 40)) {
    return {
      connect: false,
      write: false,
      head: false,
      readback: false,
      isConfigured: false,
      bucket: BUCKET_NAME,
      error: "INVALID_CREDENTIALS: CLOUDFLARE_R2_SECRET_ACCESS_KEY is set to the 32-character Access Key ID. In Cloudflare R2 dashboard, Secret Access Key is a 64-character token generated with R2 API Token.",
    };
  }

  if (!isR2Configured()) {
    return {
      connect: false,
      write: false,
      head: false,
      readback: false,
      isConfigured: false,
      bucket: BUCKET_NAME,
      error: "POST_DEPLOYMENT_REQUIRED (R2 production credentials not set)",
    };
  }

  const testKey = `audio/tts/test_certification_${Date.now()}.wav`;
  const dummyBuffer = Buffer.from("RIFF36WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00", "binary");

  try {
    const client = getS3Client()!;
    // 1. Write
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: dummyBuffer,
        ContentType: "audio/wav",
      })
    );

    // 2. Head
    await client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );

    // 3. Get / Readback
    const getRes = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );
    const readbackStr = await getRes.Body?.transformToString("binary");

    // Clean up
    await client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );

    const pubUrl = getStoragePublicUrl(testKey);

    return {
      connect: true,
      write: true,
      head: true,
      readback: Boolean(readbackStr && readbackStr.length > 0),
      isConfigured: true,
      bucket: BUCKET_NAME,
      publicUrl: pubUrl,
    };
  } catch (err: any) {
    return {
      connect: false,
      write: false,
      head: false,
      readback: false,
      isConfigured: true,
      bucket: BUCKET_NAME,
      error: err?.message || String(err),
    };
  }
}

