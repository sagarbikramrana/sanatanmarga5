/**
 * SANATANMARGA 5.0 — SNAPSHOT OS 5.0
 * RESTORE CONFLICT MODEL, BACKUP CONTRACT & AUDIT TRACEABILITY
 *
 * Principles:
 * 1. Restored records must NEVER directly overwrite active canonical delivery snapshots.
 * 2. Restore operations must be validated against existing production state.
 * 3. Bounded, structured conflict diagnostics without silent data replacement.
 * 4. Full audit trail of restore operations for Disaster Recovery OS.
 */

export type RestoreConflictType =
  | "NEWER_PRODUCTION_DATA"
  | "SCHEMA_VERSION_MISMATCH"
  | "MISSING_DEPENDENCY"
  | "OBJECT_HASH_MISMATCH"
  | "ENTITY_ID_COLLISION"
  | "MEDIA_ASSET_MISSING"
  | "TTS_ASSET_MISSING"
  | "TENANT_MISMATCH"
  | "AUTHORITY_INVALID";

export interface RestoreConflict {
  conflictType: RestoreConflictType;
  entityId: string;
  domain: string;
  severity: "CRITICAL" | "HIGH" | "WARNING";
  description: string;
  productionVersion?: string | number;
  restoreVersion?: string | number;
  productionUpdatedAt?: string;
  restoreUpdatedAt?: string;
  suggestedAction: "SKIP" | "OVERWRITE_WITH_AUDIT" | "MERGE" | "RENAME";
}

export interface BackupMetadataContract {
  backupId: string;
  createdAt: string;
  applicationVersion: string;
  schemaVersion: number;
  manifestHash: string;
  dataDomains: string[];
  manifestReference: string;
  snapshotCount: number;
  assetRegistryReference?: string;
  tenantScope?: string;
  reason: string;
  createdBy: string;
  integrityChecksum: string;
  isEncrypted?: boolean;
}

export interface RestoreAuditEvent {
  restoreId: string;
  backupId: string;
  domain: string;
  entityCount: number;
  startedAt: string;
  completedAt?: string;
  initiatedBy: string;
  dryRun: boolean;
  conflictCount: number;
  conflicts: RestoreConflict[];
  result: "SUCCESS" | "PARTIAL_SUCCESS" | "CONFLICT_ABORT" | "FAILED";
  snapshotPublicationResult?: {
    publishedModules: string[];
    skippedModules: string[];
    manifestUpdated: boolean;
    manifestHash?: string;
  };
  ttsReconciliationResult?: {
    reusedCount: number;
    queuedCount: number;
    missingCount: number;
  };
  error?: string;
}

/**
 * Validates whether a candidate restore record can be safely applied
 * against current production canonical state.
 */
export function evaluateRestoreConflict(
  restoreRecord: { id: string; updatedAt?: string; version?: number; schemaVersion?: number; tenantId?: string },
  productionRecord: { id: string; updatedAt?: string; version?: number; schemaVersion?: number; tenantId?: string } | null,
  options?: { currentSchemaVersion?: number; allowOlderOverwrite?: boolean }
): RestoreConflict | null {
  const currentSchema = options?.currentSchemaVersion || 5;

  // 1. Schema version compatibility check
  if (restoreRecord.schemaVersion !== undefined && restoreRecord.schemaVersion < currentSchema - 1) {
    return {
      conflictType: "SCHEMA_VERSION_MISMATCH",
      entityId: restoreRecord.id,
      domain: "canonical_entity",
      severity: "CRITICAL",
      description: `Restore record schema v${restoreRecord.schemaVersion} is incompatible with current platform schema v${currentSchema}.`,
      productionVersion: currentSchema,
      restoreVersion: restoreRecord.schemaVersion,
      suggestedAction: "SKIP"
    };
  }

  // If no production record exists, restore is safe (new insertion)
  if (!productionRecord) {
    return null;
  }

  // 2. Tenant isolation check
  if (restoreRecord.tenantId && productionRecord.tenantId && restoreRecord.tenantId !== productionRecord.tenantId) {
    return {
      conflictType: "TENANT_MISMATCH",
      entityId: restoreRecord.id,
      domain: "canonical_entity",
      severity: "CRITICAL",
      description: `Tenant ID mismatch: Restore belongs to '${restoreRecord.tenantId}', but production record belongs to '${productionRecord.tenantId}'. Cross-tenant restore prohibited.`,
      suggestedAction: "SKIP"
    };
  }

  // 3. Newer production data check (prevents restoring stale backup over recent live publication)
  if (productionRecord.updatedAt && restoreRecord.updatedAt) {
    const prodTime = new Date(productionRecord.updatedAt).getTime();
    const restoreTime = new Date(restoreRecord.updatedAt).getTime();

    if (!isNaN(prodTime) && !isNaN(restoreTime) && prodTime > restoreTime) {
      if (!options?.allowOlderOverwrite) {
        return {
          conflictType: "NEWER_PRODUCTION_DATA",
          entityId: restoreRecord.id,
          domain: "canonical_entity",
          severity: "HIGH",
          description: `Production record was updated at ${productionRecord.updatedAt}, which is NEWER than restore record (${restoreRecord.updatedAt}). Refusing stale restore.`,
          productionUpdatedAt: productionRecord.updatedAt,
          restoreUpdatedAt: restoreRecord.updatedAt,
          suggestedAction: "SKIP"
        };
      }
    }
  }

  // 4. Version number regression check
  if (typeof productionRecord.version === "number" && typeof restoreRecord.version === "number") {
    if (productionRecord.version > restoreRecord.version && !options?.allowOlderOverwrite) {
      return {
        conflictType: "NEWER_PRODUCTION_DATA",
        entityId: restoreRecord.id,
        domain: "canonical_entity",
        severity: "HIGH",
        description: `Production record is v${productionRecord.version}, restore record is older v${restoreRecord.version}.`,
        productionVersion: productionRecord.version,
        restoreVersion: restoreRecord.version,
        suggestedAction: "SKIP"
      };
    }
  }

  return null;
}
