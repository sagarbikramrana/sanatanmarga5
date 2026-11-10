/**
 * SANATANMARGA 4.2.8 — FEATURE CONTROL OS v1
 * Server-side Feature Control & Kill-Switch Governance Service
 */

import * as fs from "fs";
import * as path from "path";
import {
  FeatureState,
  FeatureLifecycleState,
  FeatureExposure,
  FeatureDefinition,
  FeatureEvaluation,
  FeatureControlConfig,
  FeatureAuditRecord,
  CANONICAL_FEATURE_REGISTRY,
  ROLLOUT_PROFILES,
  RolloutPresetName,
  mapStateToLifecycle
} from "../src/config/featureRegistry";
import type { Request, Response, NextFunction } from "express";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "feature_control_config.json");

class ServerFeatureControlService {
  private config: FeatureControlConfig;
  private registryMap: Map<string, FeatureDefinition> = new Map();
  private sourceAuthority: "AUTHORITATIVE_DURABLE" | "LOCAL_RECOVERY_ONLY" = "LOCAL_RECOVERY_ONLY";

  constructor() {
    CANONICAL_FEATURE_REGISTRY.forEach(item => {
      this.registryMap.set(item.id, item);
    });

    this.config = this.getCompiledDefaults();
    this.hydrateFromDisk();
  }

  public getSourceAuthority(): "AUTHORITATIVE_DURABLE" | "LOCAL_RECOVERY_ONLY" {
    return this.sourceAuthority;
  }

  private getCompiledDefaults(): FeatureControlConfig {
    const overrides: Record<string, FeatureState> = {};
    CANONICAL_FEATURE_REGISTRY.forEach(item => {
      overrides[item.id] = item.defaultState;
    });

    return {
      version: 1,
      updatedAt: "2026-09-24T00:00:00.000Z",
      updatedBy: "system_compiler",
      overrides,
      auditTrail: []
    };
  }

  private hydrateFromDisk(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.overrides === "object" && typeof parsed.version === "number") {
          this.config = parsed;
          this.sourceAuthority = "LOCAL_RECOVERY_ONLY";
          console.log(`[FEATURE_CONTROL_SERVER] Hydrated LOCAL_RECOVERY_ONLY config v${parsed.version} from disk`);
        }
      }
    } catch (e) {
      console.warn("[FEATURE_CONTROL_SERVER] Local disk hydration warning, using compiled defaults:", e);
    }
  }

  /**
   * Hydrates canonical configuration from AUTHORITATIVE_DURABLE Firestore store.
   */
  public async hydrateFromFirestore(adminDbInstance: any): Promise<void> {
    if (!adminDbInstance) return;
    try {
      const docSnap = await adminDbInstance.collection("settings").doc("feature_control").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && typeof data.overrides === "object" && typeof data.version === "number") {
          this.config = {
            version: Number(data.version) || 1,
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || "firestore_authoritative",
            overrides: data.overrides || {},
            auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : []
          };
          this.sourceAuthority = "AUTHORITATIVE_DURABLE";
          console.log(`[FEATURE_CONTROL_SERVER] Hydrated AUTHORITATIVE_DURABLE config v${this.config.version} from Firestore`);
          this.persistToDisk();
        }
      }
    } catch (e: any) {
      console.warn("[FEATURE_CONTROL_SERVER] Firestore hydration bypassed (using local recovery/default):", e?.message || e);
    }
  }

  private persistToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (e) {
      console.warn("[FEATURE_CONTROL_SERVER] Failed to save local recovery disk snapshot:", e);
    }
  }

  public getAllFeatures(): FeatureDefinition[] {
    return Array.from(this.registryMap.values());
  }

  public getConfig(): FeatureControlConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public getDirectState(featureId: string): FeatureState {
    if (this.config.overrides && this.config.overrides[featureId] !== undefined) {
      return this.config.overrides[featureId];
    }
    const def = this.registryMap.get(featureId);
    return def ? def.defaultState : "off";
  }

  public getEffectiveState(featureId: string): FeatureState {
    return this.evaluateFeature(featureId).effectiveState;
  }

  /**
   * Canonical Feature Evaluator on server (Phase 1E)
   */
  public evaluateFeature(
    featureId: string,
    context?: { role?: string | null; email?: string | null; uid?: string | null; tenantId?: string | null; tenantOverrides?: Record<string, FeatureState> },
    visited?: Set<string>
  ): FeatureEvaluation {
    const def = this.registryMap.get(featureId);
    if (!def) {
      return {
        featureId,
        enabled: false,
        visible: false,
        routeAllowed: false,
        mountAllowed: false,
        backgroundAllowed: false,
        snapshotAllowed: false,
        seoAllowed: false,
        listenerAllowed: false,
        directState: "off",
        effectiveState: "off",
        lifecycleState: "BUILT",
        exposure: "HIDDEN",
        reason: "UNKNOWN_FEATURE"
      };
    }

    if (def.lifecycle === "RETIRED") {
      return {
        featureId,
        enabled: false,
        visible: false,
        routeAllowed: false,
        mountAllowed: false,
        backgroundAllowed: false,
        snapshotAllowed: false,
        seoAllowed: false,
        listenerAllowed: false,
        directState: "off",
        effectiveState: "off",
        lifecycleState: "RETIRED",
        exposure: "HIDDEN",
        reason: "FEATURE_RETIRED",
        isRetired: true
      };
    }

    // Cycle safety
    const currentVisited = visited ? new Set(visited) : new Set<string>();
    if (currentVisited.has(featureId)) {
      console.warn(`[FEATURE_CONTROL_SERVER] Dependency cycle detected involving '${featureId}'`);
      return {
        featureId,
        enabled: false,
        visible: false,
        routeAllowed: false,
        mountAllowed: false,
        backgroundAllowed: false,
        snapshotAllowed: false,
        seoAllowed: false,
        listenerAllowed: false,
        directState: "off",
        effectiveState: "off",
        lifecycleState: "BUILT",
        exposure: "HIDDEN",
        reason: "DEPENDENCY_CYCLE"
      };
    }
    currentVisited.add(featureId);

    let direct = this.getDirectState(featureId);

    // Tenant overrides
    if (context?.tenantOverrides && context.tenantOverrides[featureId] !== undefined) {
      const tenantState = context.tenantOverrides[featureId];
      if (direct === "off" && tenantState !== "off") {
        // cannot exceed global
      } else if (direct === "public" && tenantState !== "public") {
        direct = tenantState;
      }
    }

    let effectiveState = direct;
    let parentOff = false;

    // Check parent state
    if (def.parentId) {
      const parentEval = this.evaluateFeature(def.parentId, context, currentVisited);
      if (!parentEval.enabled || parentEval.effectiveState === "off") {
        effectiveState = "off";
        parentOff = true;
      } else if (parentEval.effectiveState === "admin_only" && direct === "public") {
        effectiveState = "admin_only";
      } else if (parentEval.effectiveState === "beta" && direct === "public") {
        effectiveState = "beta";
      }
    }

    // Check dependencies
    const missingDependencies: string[] = [];
    if (def.dependencies && def.dependencies.length > 0) {
      for (const depId of def.dependencies) {
        const depEval = this.evaluateFeature(depId, context, currentVisited);
        if (!depEval.enabled || depEval.effectiveState === "off") {
          effectiveState = "off";
          missingDependencies.push(depId);
        }
      }
    }

    const role = (context?.role || "").toLowerCase();
    const isStaff = ["admin", "super_admin", "superadmin", "editor", "chief_editor"].includes(role);

    let enabled = false;
    let reason = "OK";

    if (parentOff) {
      enabled = false;
      reason = "PARENT_DISABLED";
    } else if (missingDependencies.length > 0) {
      enabled = false;
      reason = "DEPENDENCY_UNSATISFIED";
    } else if (effectiveState === "public") {
      enabled = true;
      reason = "PUBLIC_ACCESS";
    } else if (effectiveState === "beta" || effectiveState === "admin_only") {
      if (isStaff) {
        enabled = true;
        reason = "STAFF_ACCESS";
      } else {
        enabled = false;
        reason = "STAFF_ONLY";
      }
    } else if (effectiveState === "off") {
      enabled = false;
      reason = "FEATURE_DISABLED";
    }

    const controls = def.controls || {};
    const exposure = def.exposure || (effectiveState === "public" ? "PRIMARY" : "SECONDARY");
    const lifecycle = def.lifecycle || mapStateToLifecycle(effectiveState);

    const visible = enabled && (controls.navigation !== false) && exposure !== "HIDDEN";
    const routeAllowed = enabled && (controls.route !== false);
    const mountAllowed = enabled && (controls.component !== false);
    const backgroundAllowed = enabled && (controls.backgroundJob !== false);
    const snapshotAllowed = enabled && (controls.snapshot !== false);
    const seoAllowed = enabled && (controls.seo !== false) && exposure !== "HIDDEN" && effectiveState === "public";
    const listenerAllowed = enabled && (controls.listener !== false);

    return {
      featureId,
      enabled,
      visible,
      routeAllowed,
      mountAllowed,
      backgroundAllowed,
      snapshotAllowed,
      seoAllowed,
      listenerAllowed,
      directState: direct,
      effectiveState,
      lifecycleState: lifecycle,
      exposure,
      reason,
      missingDependencies: missingDependencies.length > 0 ? missingDependencies : undefined,
      parentOff
    };
  }

  public isFeatureEnabled(featureId: string, userRole?: string | null): boolean {
    return this.evaluateFeature(featureId, { role: userRole }).enabled;
  }

  public isFeatureAllowed(featureId: string, userRole?: string | null): boolean {
    return this.evaluateFeature(featureId, { role: userRole }).enabled;
  }

  /**
   * Synchronous update fallback for local development or non-DB paths.
   */
  public updateFeature(
    featureId: string,
    newState: FeatureState,
    actor: { id: string; email?: string; role: string },
    reason?: string
  ): { success: boolean; error?: string; config?: FeatureControlConfig; noop?: boolean } {
    const def = this.registryMap.get(featureId);
    if (!def) return { success: false, error: "Feature not found in registry" };

    if (def.critical && newState === "off" && !["super_admin", "superadmin"].includes(actor.role)) {
      return { success: false, error: "Critical features cannot be turned off without Super Admin role" };
    }

    const previousState = this.getDirectState(featureId);
    if (previousState === newState) {
      return { success: true, config: this.getConfig(), noop: true };
    }

    const nextVersion = this.config.version + 1;
    const auditRecord: FeatureAuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      featureId,
      previousState,
      newState,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || "State mutation via API",
      configVersion: nextVersion
    };

    this.config = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.id,
      overrides: {
        ...this.config.overrides,
        [featureId]: newState
      },
      auditTrail: [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)]
    };

    this.persistToDisk();
    return { success: true, config: this.getConfig() };
  }

  /**
   * Authoritative Async Update with Firestore transaction, version conflict protection, and audit logging.
   */
  public async updateFeatureAsync(
    featureId: string,
    newState: FeatureState,
    actor: { id: string; email?: string; role: string },
    reason?: string,
    adminDbInstance?: any,
    expectedVersion?: number
  ): Promise<{ success: boolean; error?: string; errorCode?: string; config?: FeatureControlConfig; noop?: boolean }> {
    const def = this.registryMap.get(featureId);
    if (!def) return { success: false, error: "Feature not found in registry" };

    if (def.critical && newState === "off" && !["super_admin", "superadmin"].includes(actor.role)) {
      return { success: false, error: "Critical features cannot be turned off without Super Admin role" };
    }

    // Version Concurrency Conflict Guard
    if (expectedVersion !== undefined && expectedVersion !== this.config.version) {
      return {
        success: false,
        errorCode: "VERSION_CONFLICT",
        error: `Version conflict: Proposed mutation was based on config v${expectedVersion}, but current authoritative config is v${this.config.version}. Please refresh.`
      };
    }

    const previousState = this.getDirectState(featureId);
    if (previousState === newState) {
      return { success: true, config: this.getConfig(), noop: true };
    }

    const nextVersion = this.config.version + 1;
    const auditRecord: FeatureAuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      featureId,
      previousState,
      newState,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || "State mutation via API",
      configVersion: nextVersion
    };

    const proposedConfig: FeatureControlConfig = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.id,
      overrides: {
        ...this.config.overrides,
        [featureId]: newState
      },
      auditTrail: [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)]
    };

    // Commit AUTHORITATIVE_DURABLE Firestore Write
    if (adminDbInstance) {
      try {
        await adminDbInstance.collection("settings").doc("feature_control").set(proposedConfig);
        await adminDbInstance.collection("auditLogs").add({
          type: "FEATURE_CONTROL_MUTATION",
          featureId,
          previousState,
          newState,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          timestamp: proposedConfig.updatedAt,
          reason: reason || "State mutation via API",
          configVersion: nextVersion
        });
      } catch (dbErr: any) {
        console.error("[FEATURE_CONTROL_SERVER] Authoritative Firestore write failed:", dbErr?.message || dbErr);
        return {
          success: false,
          errorCode: "DURABLE_WRITE_FAILED",
          error: `Authoritative persistence failed: ${dbErr?.message || "Firestore database unavailable"}. Mutation aborted.`
        };
      }
    }

    // Only update in-memory cache & local recovery file on verified write success
    this.config = proposedConfig;
    this.persistToDisk();

    return { success: true, config: this.getConfig() };
  }

  public async applyProfileAsync(
    profileName: RolloutPresetName,
    actor: { id: string; email?: string; role: string },
    reason?: string,
    adminDbInstance?: any,
    expectedVersion?: number
  ): Promise<{ success: boolean; error?: string; errorCode?: string; config?: FeatureControlConfig }> {
    const profile = ROLLOUT_PROFILES[profileName];
    if (!profile) return { success: false, error: "Profile not found" };

    if (expectedVersion !== undefined && expectedVersion !== this.config.version) {
      return {
        success: false,
        errorCode: "VERSION_CONFLICT",
        error: `Version conflict: Proposed mutation was based on config v${expectedVersion}, but current authoritative config is v${this.config.version}. Please refresh.`
      };
    }

    const nextVersion = this.config.version + 1;
    const auditRecord: FeatureAuditRecord = {
      id: `audit_prof_${Date.now()}`,
      featureId: `preset:${profileName}`,
      previousState: "public",
      newState: "public",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || `Applied profile ${profile.nameEn}`,
      configVersion: nextVersion
    };

    const proposedConfig: FeatureControlConfig = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.id,
      overrides: {
        ...this.config.overrides,
        ...profile.overrides
      },
      auditTrail: [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)]
    };

    if (adminDbInstance) {
      try {
        await adminDbInstance.collection("settings").doc("feature_control").set(proposedConfig);
        await adminDbInstance.collection("auditLogs").add({
          type: "FEATURE_CONTROL_PROFILE_APPLIED",
          profileName,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          timestamp: proposedConfig.updatedAt,
          reason: reason || `Applied profile ${profile.nameEn}`,
          configVersion: nextVersion
        });
      } catch (dbErr: any) {
        console.error("[FEATURE_CONTROL_SERVER] Authoritative Firestore write failed for profile:", dbErr?.message || dbErr);
        return {
          success: false,
          errorCode: "DURABLE_WRITE_FAILED",
          error: `Authoritative persistence failed: ${dbErr?.message || "Firestore database unavailable"}. Mutation aborted.`
        };
      }
    }

    this.config = proposedConfig;
    this.persistToDisk();

    return { success: true, config: this.getConfig() };
  }

  public applyProfile(
    profileName: RolloutPresetName,
    actor: { id: string; email?: string; role: string },
    reason?: string
  ): { success: boolean; error?: string; config?: FeatureControlConfig } {
    const profile = ROLLOUT_PROFILES[profileName];
    if (!profile) return { success: false, error: "Profile not found" };

    const nextVersion = this.config.version + 1;
    const auditRecord: FeatureAuditRecord = {
      id: `audit_prof_${Date.now()}`,
      featureId: `preset:${profileName}`,
      previousState: "public",
      newState: "public",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || `Applied profile ${profile.nameEn}`,
      configVersion: nextVersion
    };

    this.config = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email || actor.id,
      overrides: {
        ...this.config.overrides,
        ...profile.overrides
      },
      auditTrail: [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)]
    };

    this.persistToDisk();
    return { success: true, config: this.getConfig() };
  }

  public async resetToDefaultsAsync(
    actor: { id: string; email?: string; role: string },
    reason?: string,
    adminDbInstance?: any,
    expectedVersion?: number
  ): Promise<{ success: boolean; error?: string; errorCode?: string; config?: FeatureControlConfig }> {
    if (!["super_admin", "superadmin"].includes(actor.role)) {
      return { success: false, error: "Only Super Admin can reset features to defaults" };
    }

    if (expectedVersion !== undefined && expectedVersion !== this.config.version) {
      return {
        success: false,
        errorCode: "VERSION_CONFLICT",
        error: `Version conflict: Proposed mutation was based on config v${expectedVersion}, but current authoritative config is v${this.config.version}. Please refresh.`
      };
    }

    const defs = this.getCompiledDefaults();
    defs.version = this.config.version + 1;
    defs.updatedAt = new Date().toISOString();
    defs.updatedBy = actor.email || actor.id;

    const auditRecord: FeatureAuditRecord = {
      id: `audit_reset_${Date.now()}`,
      featureId: "system:reset_defaults",
      previousState: "public",
      newState: "public",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || "Reset to compiled default states",
      configVersion: defs.version
    };

    defs.auditTrail = [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)];

    if (adminDbInstance) {
      try {
        await adminDbInstance.collection("settings").doc("feature_control").set(defs);
        await adminDbInstance.collection("auditLogs").add({
          type: "FEATURE_CONTROL_RESET_DEFAULTS",
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          timestamp: defs.updatedAt,
          reason: reason || "Reset to compiled default states",
          configVersion: defs.version
        });
      } catch (dbErr: any) {
        console.error("[FEATURE_CONTROL_SERVER] Authoritative Firestore write failed for reset:", dbErr?.message || dbErr);
        return {
          success: false,
          errorCode: "DURABLE_WRITE_FAILED",
          error: `Authoritative persistence failed: ${dbErr?.message || "Firestore database unavailable"}. Mutation aborted.`
        };
      }
    }

    this.config = defs;
    this.persistToDisk();

    return { success: true, config: this.getConfig() };
  }

  public resetToDefaults(
    actor: { id: string; email?: string; role: string },
    reason?: string
  ): { success: boolean; error?: string; config?: FeatureControlConfig } {
    if (!["super_admin", "superadmin"].includes(actor.role)) {
      return { success: false, error: "Only Super Admin can reset features to defaults" };
    }

    const defs = this.getCompiledDefaults();
    defs.version = this.config.version + 1;
    defs.updatedAt = new Date().toISOString();
    defs.updatedBy = actor.email || actor.id;

    const auditRecord: FeatureAuditRecord = {
      id: `audit_reset_${Date.now()}`,
      featureId: "system:reset_defaults",
      previousState: "public",
      newState: "public",
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
      reason: reason || "Reset to compiled default states",
      configVersion: defs.version
    };

    defs.auditTrail = [auditRecord, ...(this.config.auditTrail || []).slice(0, 49)];
    this.config = defs;
    this.persistToDisk();

    return { success: true, config: this.getConfig() };
  }

  /**
   * Express Middleware Guard
   * Protects backend endpoints against disabled features
   */
  public requireFeature(featureId: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const userRole = (req as any).user?.role || (req as any).userRole;
      if (!this.isFeatureEnabled(featureId, userRole)) {
        return res.status(403).json({
          error: "FEATURE_UNAVAILABLE",
          feature: featureId,
          message: `The requested feature '${featureId}' is currently unavailable.`
        });
      }
      next();
    };
  }
}

export const serverFeatureControlService = new ServerFeatureControlService();
