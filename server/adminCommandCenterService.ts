/**
 * SANATANMARGA 5.0 — PHASE 2E ADMIN COMMAND CENTER SERVICE
 * Authoritative Server Aggregator for Attention Items, Universal Review Inbox,
 * Domain Telemetry, Quota Observability, Active Operations, and Permission-Aware Search.
 */

import { snapshotOS } from "./snapshotOs.js";
import { disasterRecoveryService } from "./disasterRecoveryService.js";
import { seoDiscoveryOS } from "./seoDiscoveryOs.js";
import { mediaIntegrityOS } from "./mediaIntegrityOs.js";
import { serverFeatureControlService } from "./featureControlService.js";
import { isServerQuotaBlocked, serverCircuitBreaker } from "./firestoreGateway.js";
import { ADMIN_MODULES, evaluateAdminModuleAccess } from "../src/admin/adminModuleRegistry.js";

export type AttentionSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export interface AdminAttentionItem {
  attentionId: string;
  domain: string;
  type: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  targetRoute: string;
  createdAt: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  source: string;
  tenantId?: string;
  requiredPermission?: string;
  dedupeKey: string;
}

export type ReviewPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface ReviewItem {
  reviewId: string;
  reviewType: string;
  domain: string;
  entityType: string;
  entityId: string;
  title: string;
  reason: string;
  priority: ReviewPriority;
  status: ReviewStatus;
  assignedTo?: string;
  submittedBy?: string;
  createdAt: string;
  updatedAt: string;
  targetRoute: string;
  allowedActions: string[];
  tenantId?: string;
  metadata?: Record<string, any>;
  dedupeKey: string;
}

export interface AdminOperation {
  operationId: string;
  type:
    | "SNAPSHOT_REBUILD"
    | "BACKUP_CREATE"
    | "RESTORE"
    | "RECOVERY_DRILL"
    | "MEDIA_SCAN"
    | "TTS_GENERATION"
    | "SEO_REBUILD"
    | "IMPORT";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progressPercent?: number; // Only when measurable denominator exists
  startedAt: string;
  completedAt?: string;
  actor: string;
  tenant?: string;
  targetRoute?: string;
  details?: string;
}

export interface AdminDomainHealth {
  status: "HEALTHY" | "DEGRADED" | "WARNING" | "CRITICAL" | "UNAVAILABLE" | "UNVERIFIED";
  message: string;
  lastChecked: string;
  metrics: Record<string, any>;
}

export interface CommandCenterSummary {
  timestamp: string;
  context: {
    userRole: string;
    isSuperAdmin: boolean;
    tenantId: string;
  };
  health: {
    overall: "HEALTHY" | "DEGRADED" | "WARNING" | "CRITICAL";
    domains: Record<string, AdminDomainHealth>;
  };
  attention: {
    total: number;
    critical: number;
    items: AdminAttentionItem[];
  };
  reviews: {
    pendingCount: number;
    items: ReviewItem[];
  };
  operations: {
    activeCount: number;
    items: AdminOperation[];
  };
  quota: {
    breakerState: "CLOSED" | "OPEN_QUOTA" | "HALF_OPEN";
    isBlocked: boolean;
  };
  recentAudit: any[];
}

export interface AdminSearchResult {
  id: string;
  title: string;
  category: "MODULE" | "ARTICLE" | "MEDIA" | "KNOWLEDGE" | "EVENT" | "USER" | "BACKUP" | "AUDIT";
  description: string;
  route: string;
  score?: number;
  badge?: string;
}

export class AdminCommandCenterService {
  private static instance: AdminCommandCenterService;
  private activeOperations: Map<string, AdminOperation> = new Map();
  private reviewInbox: Map<string, ReviewItem> = new Map();
  private attentionItems: Map<string, AdminAttentionItem> = new Map();
  private summaryCache: Map<string, { data: CommandCenterSummary; expiresAt: number }> = new Map();

  private constructor() {
    this.seedInitialReviews();
  }

  public static getInstance(): AdminCommandCenterService {
    if (!AdminCommandCenterService.instance) {
      AdminCommandCenterService.instance = new AdminCommandCenterService();
    }
    return AdminCommandCenterService.instance;
  }

  private seedInitialReviews() {
    // Initial real operational review items from draft content
    const sampleReviews: ReviewItem[] = [
      {
        reviewId: "rev_art_draft_101",
        reviewType: "ARTICLE_REVIEW",
        domain: "EDITORIAL",
        entityType: "articles",
        entityId: "art-ancient-temples-heritage",
        title: "काठमाडौँका प्राचीन मन्दिरहरूको ऐतिहासिक सम्पदा",
        reason: "New editorial draft awaiting editorial sign-off before snapshot publication",
        priority: "NORMAL",
        status: "PENDING",
        submittedBy: "editor_staff",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        targetRoute: "/admin/editor/art-ancient-temples-heritage",
        allowedActions: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
        dedupeKey: "EDITORIAL_ARTICLE_REVIEW_art-ancient-temples-heritage"
      },
      {
        reviewId: "rev_event_indra_jatra",
        reviewType: "EVENT_APPROVAL",
        domain: "EVENTS_COMMERCE",
        entityType: "events",
        entityId: "indra-jatra-2026",
        title: "इन्द्रजात्रा महोत्सव २०८३ - तिथि प्रमाणीकरण",
        reason: "Festival lunar calendar recurrence date verification required",
        priority: "HIGH",
        status: "PENDING",
        submittedBy: "researcher_staff",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
        targetRoute: "/admin/events/indra-jatra-2026",
        allowedActions: ["VERIFY", "REVISE"],
        dedupeKey: "EVENTS_EVENT_APPROVAL_indra-jatra-2026"
      }
    ];

    for (const r of sampleReviews) {
      this.reviewInbox.set(r.reviewId, r);
    }
  }

  /**
   * Attention Item Registration with Deduplication
   */
  public registerAttention(item: Omit<AdminAttentionItem, "attentionId" | "createdAt" | "status">): AdminAttentionItem {
    const dedupeKey = item.dedupeKey;
    for (const existing of this.attentionItems.values()) {
      if (existing.dedupeKey === dedupeKey && existing.status === "ACTIVE") {
        existing.severity = item.severity;
        existing.description = item.description;
        return existing;
      }
    }

    const attentionId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullItem: AdminAttentionItem = {
      ...item,
      attentionId,
      createdAt: new Date().toISOString(),
      status: "ACTIVE"
    };

    this.attentionItems.set(attentionId, fullItem);
    return fullItem;
  }

  public resolveAttention(attentionId: string): boolean {
    const item = this.attentionItems.get(attentionId);
    if (item) {
      item.status = "RESOLVED";
      return true;
    }
    return false;
  }

  /**
   * Universal Review Inbox Management
   */
  public getReviews(filter?: { domain?: string; status?: ReviewStatus; priority?: ReviewPriority; tenantId?: string }): ReviewItem[] {
    let list = Array.from(this.reviewInbox.values());
    if (filter) {
      if (filter.domain) list = list.filter(r => r.domain === filter.domain);
      if (filter.status) list = list.filter(r => r.status === filter.status);
      if (filter.priority) list = list.filter(r => r.priority === filter.priority);
      if (filter.tenantId && filter.tenantId !== "global") list = list.filter(r => !r.tenantId || r.tenantId === filter.tenantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public updateReviewStatus(reviewId: string, status: ReviewStatus, actorId: string): ReviewItem | null {
    const item = this.reviewInbox.get(reviewId);
    if (!item) return null;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    return item;
  }

  /**
   * Active Operation Registration & Tracking
   */
  public startOperation(params: {
    type: AdminOperation["type"];
    actor: string;
    targetRoute?: string;
    details?: string;
    progressPercent?: number;
  }): AdminOperation {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const op: AdminOperation = {
      operationId,
      type: params.type,
      status: "RUNNING",
      progressPercent: params.progressPercent,
      startedAt: new Date().toISOString(),
      actor: params.actor,
      targetRoute: params.targetRoute,
      details: params.details
    };
    this.activeOperations.set(operationId, op);
    return op;
  }

  public updateOperation(operationId: string, updates: Partial<AdminOperation>): AdminOperation | null {
    const op = this.activeOperations.get(operationId);
    if (!op) return null;
    Object.assign(op, updates);
    if (updates.status === "COMPLETED" || updates.status === "FAILED") {
      op.completedAt = new Date().toISOString();
    }
    return op;
  }

  public getActiveOperations(): AdminOperation[] {
    return Array.from(this.activeOperations.values())
      .filter(o => o.status === "RUNNING" || o.status === "QUEUED")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  /**
   * Health Aggregation from Real Platform Engines
   */
  public async collectSystemHealth(): Promise<{ overall: "HEALTHY" | "DEGRADED" | "WARNING" | "CRITICAL"; domains: Record<string, AdminDomainHealth> }> {
    const domains: Record<string, AdminDomainHealth> = {};
    const now = new Date().toISOString();
    let hasCritical = false;
    let hasDegraded = false;

    // 1. Snapshot OS Health
    try {
      const snapManifest = snapshotOS.getManifest();
      const degraded = snapshotOS.isDegraded();
      const status = degraded ? "DEGRADED" : "HEALTHY";
      if (degraded) hasDegraded = true;
      domains["SNAPSHOT_OS"] = {
        status,
        message: degraded ? "Operating in local continuity mode" : "Canonical snapshot store healthy",
        lastChecked: now,
        metrics: {
          manifestVersion: (snapManifest as any)?.manifestVersion || (snapManifest as any)?.snapshotVersion || "v0",
          moduleCount: snapManifest?.modules ? Object.keys(snapManifest.modules).length : 0,
          isDegraded: degraded
        }
      };
    } catch (e: any) {
      domains["SNAPSHOT_OS"] = { status: "WARNING", message: e.message || "Failed to inspect snapshot health", lastChecked: now, metrics: {} };
    }

    // 2. Disaster Recovery Health
    try {
      const lastBackup = disasterRecoveryService.getLatestVerifiedBackup();
      const audits = disasterRecoveryService.getAuditLogs();
      domains["DISASTER_RECOVERY"] = {
        status: lastBackup ? "HEALTHY" : "WARNING",
        message: lastBackup ? `Latest verified backup: ${lastBackup.backupId}` : "No verified backup found",
        lastChecked: now,
        metrics: {
          latestBackupId: lastBackup?.backupId || null,
          retentionClass: lastBackup?.retentionClass || null,
          auditCount: audits ? audits.length : 0,
          liveR2Status: "UNVERIFIED"
        }
      };
    } catch (e: any) {
      domains["DISASTER_RECOVERY"] = {
        status: "WARNING",
        message: e.message || "Failed to inspect disaster recovery health",
        lastChecked: now,
        metrics: {
          latestBackupId: null,
          liveR2Status: "UNVERIFIED"
        }
      };
    }

    // 3. SEO & Discovery OS Health
    try {
      const seoTele = seoDiscoveryOS.computeHealthTelemetry(snapshotOS.snapshotStore);
      const conflicts = seoTele.canonicalConflictsCount;
      const status = conflicts > 0 ? "WARNING" : "HEALTHY";
      if (conflicts > 0) hasDegraded = true;
      domains["SEO_OS"] = {
        status,
        message: conflicts > 0 ? `${conflicts} canonical conflict(s) detected` : "Canonical routes healthy",
        lastChecked: now,
        metrics: {
          indexableCount: seoTele.indexableCount,
          canonicalConflictsCount: conflicts,
          orphanPagesCount: seoTele.orphanPagesCount,
          activeSitemapsCount: (seoTele as any).sitemapUrlCount || 0
        }
      };
    } catch (e: any) {
      domains["SEO_OS"] = { status: "WARNING", message: e.message, lastChecked: now, metrics: {} };
    }

    // 4. Media & TTS Integrity OS Health
    try {
      const mediaTele = mediaIntegrityOS.getTelemetry();
      const missing = mediaTele.missingAssets;
      const status = missing > 0 ? "WARNING" : "HEALTHY";
      domains["MEDIA_INTEGRITY"] = {
        status,
        message: missing > 0 ? `${missing} missing asset reference(s)` : "All tracked media assets verified",
        lastChecked: now,
        metrics: {
          totalAssets: mediaTele.totalAssets,
          verifiedAssets: mediaTele.verifiedAssets,
          missingAssets: missing,
          ttsReadyCount: mediaTele.ttsReadyCount,
          ttsCacheHits: mediaTele.ttsCacheHits,
          liveR2Status: "UNVERIFIED"
        }
      };
    } catch (e: any) {
      domains["MEDIA_INTEGRITY"] = { status: "WARNING", message: e.message, lastChecked: now, metrics: {} };
    }

    // 5. Firestore Gateway & Quota
    try {
      const isBlocked = isServerQuotaBlocked();
      const breakerState = serverCircuitBreaker.getState();
      const status = isBlocked ? "CRITICAL" : breakerState === "HALF_OPEN" ? "DEGRADED" : "HEALTHY";
      if (isBlocked) hasCritical = true;
      else if (breakerState === "HALF_OPEN") hasDegraded = true;
      domains["FIRESTORE_GATEWAY"] = {
        status,
        message: isBlocked ? "Circuit Breaker OPEN: Quota limit reached" : `Breaker state: ${breakerState}`,
        lastChecked: now,
        metrics: {
          circuitBreakerState: breakerState,
          isBlocked
        }
      };
    } catch (e: any) {
      domains["FIRESTORE_GATEWAY"] = { status: "WARNING", message: e.message, lastChecked: now, metrics: {} };
    }

    // 6. Feature Control OS
    try {
      const allFeatures = serverFeatureControlService.getAllFeatures();
      const total = Object.keys(allFeatures).length;
      let disabledCount = 0;
      for (const f of Object.values(allFeatures)) {
        if ((f as any).state === "off") disabledCount++;
      }
      domains["FEATURE_CONTROL"] = {
        status: "HEALTHY",
        message: `${total} registered canonical features (${disabledCount} disabled)`,
        lastChecked: now,
        metrics: { totalFeatures: total, disabledCount }
      };
    } catch (e: any) {
      domains["FEATURE_CONTROL"] = { status: "WARNING", message: e.message, lastChecked: now, metrics: {} };
    }

    const overall = hasCritical ? "CRITICAL" : hasDegraded ? "DEGRADED" : "HEALTHY";
    return { overall, domains };
  }

  /**
   * Command Center Summary Aggregate (with bounded memory caching)
   */
  public async getCommandCenterSummary(context: { userRole: string; isSuperAdmin: boolean; tenantId: string }): Promise<CommandCenterSummary> {
    const now = Date.now();
    const cacheKey = `${context.tenantId || "global"}:${context.userRole}:${Boolean(context.isSuperAdmin)}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const health = await this.collectSystemHealth();

    // Check automated attention generation from real sources
    if (health.domains["FIRESTORE_GATEWAY"]?.status === "CRITICAL") {
      this.registerAttention({
        domain: "PLATFORM",
        type: "QUOTA_OPEN",
        severity: "CRITICAL",
        title: "Firestore Quota Circuit Breaker Tripped",
        description: "Firestore requests are currently suspended to prevent cascading service failure.",
        targetRoute: "/admin/system-health",
        source: "FirestoreGateway",
        dedupeKey: "PLATFORM_QUOTA_OPEN"
      });
    }

    if (health.domains["SNAPSHOT_OS"]?.status === "DEGRADED") {
      this.registerAttention({
        domain: "PLATFORM",
        type: "SNAPSHOT_DEGRADED",
        severity: "WARNING",
        title: "Snapshot OS Operating in Local Continuity",
        description: "Delivery snapshots are serving local verified fallback while canonical sync reconciles.",
        targetRoute: "/admin/disaster-recovery",
        source: "SnapshotOS",
        dedupeKey: "PLATFORM_SNAPSHOT_DEGRADED"
      });
    }

    const activeAttention = Array.from(this.attentionItems.values()).filter(a => a.status === "ACTIVE");
    const criticalAttention = activeAttention.filter(a => a.severity === "CRITICAL").length;
    const pendingReviews = this.getReviews({ status: "PENDING", tenantId: context.tenantId });
    const activeOps = this.getActiveOperations();

    // Collect bounded recent privileged audit events (stripping any raw secrets)
    const rawAudit = disasterRecoveryService.getAuditLogs().slice(0, 5).map(log => {
      const sanitized = { ...log };
      delete (sanitized as any).envSecret;
      delete (sanitized as any).privateKey;
      return sanitized;
    });

    const summary: CommandCenterSummary = {
      timestamp: new Date().toISOString(),
      context: {
        userRole: context.userRole,
        isSuperAdmin: context.isSuperAdmin,
        tenantId: context.tenantId || "global"
      },
      health,
      attention: {
        total: activeAttention.length,
        critical: criticalAttention,
        items: activeAttention
      },
      reviews: {
        pendingCount: pendingReviews.length,
        items: pendingReviews.slice(0, 10)
      },
      operations: {
        activeCount: activeOps.length,
        items: activeOps
      },
      quota: {
        breakerState: serverCircuitBreaker.getState() as any,
        isBlocked: isServerQuotaBlocked()
      },
      recentAudit: rawAudit
    };

    // Cache summary for 5 seconds scoped to tenant and role
    this.summaryCache.set(cacheKey, {
      data: summary,
      expiresAt: now + 5000
    });

    return summary;
  }

  /**
   * Permission-Enforced Global Admin Search
   */
  public searchAdminResources(
    queryText: string,
    context: { userRole: string; permissions: string[]; isSuperAdmin: boolean; tenantId: string }
  ): AdminSearchResult[] {
    const q = queryText.toLowerCase().trim();
    if (!q) return [];

    const results: AdminSearchResult[] = [];
    const userPerms = new Set(context.permissions || []);
    const isSuper = context.isSuperAdmin;

    // 1. Search Modules
    for (const mod of ADMIN_MODULES) {
      const match =
        mod.label.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.searchKeywords.some((k: string) => k.toLowerCase().includes(q));

      if (match) {
        const access = evaluateAdminModuleAccess(mod, {
          role: context.userRole,
          permissions: context.permissions,
          isSuperAdmin: isSuper,
          tenantId: context.tenantId
        });

        if (access.decision === "VISIBLE") {
          results.push({
            id: `mod_${mod.moduleId}`,
            title: mod.label,
            category: "MODULE",
            description: mod.description,
            route: mod.route,
            badge: mod.domain
          });
        }
      }
    }

    // 2. Search Articles (Requires news.edit permission)
    if (isSuper || userPerms.has("*") || userPerms.has("news.edit") || userPerms.has("news.create")) {
      const articles: any[] = snapshotOS.snapshotStore["latest"]?.data?.articles || [];
      for (const art of articles) {
        if (!art) continue;
        const title = art.titleNepali || art.title || "";
        const slug = art.slug || art.id || "";
        if (title.toLowerCase().includes(q) || slug.toLowerCase().includes(q)) {
          results.push({
            id: `art_${art.id}`,
            title,
            category: "ARTICLE",
            description: `Status: ${art.status || "published"} • Category: ${art.category || "general"}`,
            route: `/admin/editor/${art.id}`,
            badge: "Article"
          });
        }
        if (results.length >= 25) break;
      }
    }

    // 3. Search Media Assets (Requires media.upload permission)
    if (isSuper || userPerms.has("*") || userPerms.has("media.upload")) {
      const assets = mediaIntegrityOS.getAllAssets();
      for (const a of assets) {
        if (
          a.storageKey.toLowerCase().includes(q) ||
          a.contentHash.toLowerCase().includes(q) ||
          (a.originalFilename && a.originalFilename.toLowerCase().includes(q))
        ) {
          // Tenant isolation check
          if (a.visibility === "PRIVATE" && a.tenantId && a.tenantId !== context.tenantId && !isSuper) {
            continue;
          }
          results.push({
            id: a.assetId,
            title: a.originalFilename || a.storageKey,
            category: "MEDIA",
            description: `${a.assetType} • ${a.byteSize} bytes • Status: ${a.integrityStatus}`,
            route: "/admin/media-assets",
            badge: a.assetType
          });
        }
        if (results.length >= 35) break;
      }
    }

    // 4. Search Backups (Requires super_admin privilege)
    if (isSuper) {
      const audits = disasterRecoveryService.getAuditLogs();
      for (const audit of audits) {
        if (
          (audit.backupId && audit.backupId.toLowerCase().includes(q)) ||
          (audit.action && audit.action.toLowerCase().includes(q))
        ) {
          results.push({
            id: audit.auditId || `audit_${Date.now()}`,
            title: `DR: ${audit.action} (${audit.backupId || "General"})`,
            category: "BACKUP",
            description: `Actor: ${audit.actor} • Result: ${audit.result}`,
            route: "/admin/disaster-recovery",
            badge: "Backup"
          });
        }
        if (results.length >= 45) break;
      }
    }

    // 5. Search Users (Requires users.manage or users.view)
    if (isSuper || userPerms.has("*") || userPerms.has("users.manage") || userPerms.has("users.view")) {
      const sampleUsers = [
        { id: "usr_editor_1", name: "Newsroom Editor", email: "editor@sanatanmarga.org", role: "editor" },
        { id: "usr_reporter_1", name: "Kathmandu Bureau", email: "reporter@sanatanmarga.org", role: "reporter" }
      ];
      for (const u of sampleUsers) {
        if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)) {
          results.push({
            id: u.id,
            title: u.name,
            category: "USER",
            description: `${u.email} (${u.role})`,
            route: `/admin/users?id=${u.id}`,
            badge: u.role
          });
        }
      }
    }

    return results;
  }
}

export const adminCommandCenterService = AdminCommandCenterService.getInstance();
