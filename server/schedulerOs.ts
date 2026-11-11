/**
 * SANATANMARGA 5.0 — SERVER SCHEDULER OS (PHASE 1A / 1B)
 * Distributed, Idempotent Scheduled Publishing Engine
 * 
 * Features:
 * 1. Safe Publication Pipeline Integration: Invokes canonical publishApprovedCandidate()
 * 2. Multi-Tier Distributed Leases & Claim Tokens: Cross-instance atomic claiming with Firestore transactions
 * 3. Invariant Protection: Unapproved or unverified candidates can never be scheduled or published
 * 4. Resilient Retries & Exponential Backoff: Bounded 3 attempts with failure tracking
 * 5. Immutable Audit Trail: Cascading SHA-256 audit logs on all schedule, cancel, and publish events
 * 6. Graceful Shutdown & Controlled Lifecycle
 */

import crypto from "crypto";
import {
  EditorialCandidate,
  CandidateSchedule,
  SchedulingStatus,
  CandidatePublicationResult,
  ScheduleCandidateInput
} from "../src/types/editorial.js";
import { ServerEditorialWorkflowOS, serverEditorialWorkflowOS } from "./editorialWorkflowOs.js";
import { logAuditEvent } from "./middleware/permissions.js";
import { captureSchedulerFailure } from "./sentry.js";

export interface SchedulerConfig {
  pollingIntervalMs: number;
  leaseDurationMs: number;
  maxAttempts: number;
  baseBackoffSeconds: number;
  maxBatchSize: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollingIntervalMs: 15000, // 15 seconds
  leaseDurationMs: 60000,    // 60 seconds lease
  maxAttempts: 3,            // 3 attempts max
  baseBackoffSeconds: 30,    // 30s base backoff
  maxBatchSize: 20           // Maximum candidates processed per cycle
};

/**
 * Phase 1B.3: Validates and bounds scheduler configuration parameters at startup or runtime.
 */
export function validateAndNormalizeSchedulerConfig(partial?: Partial<SchedulerConfig>): SchedulerConfig {
  const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
    const num = typeof val === "number" && Number.isFinite(val) ? Math.floor(val) : fallback;
    return Math.max(min, Math.min(max, num));
  };

  return {
    pollingIntervalMs: clamp(partial?.pollingIntervalMs, 5000, 300000, DEFAULT_SCHEDULER_CONFIG.pollingIntervalMs),
    leaseDurationMs: clamp(partial?.leaseDurationMs, 10000, 600000, DEFAULT_SCHEDULER_CONFIG.leaseDurationMs),
    maxAttempts: clamp(partial?.maxAttempts, 1, 10, DEFAULT_SCHEDULER_CONFIG.maxAttempts),
    baseBackoffSeconds: clamp(partial?.baseBackoffSeconds, 1, 3600, DEFAULT_SCHEDULER_CONFIG.baseBackoffSeconds),
    maxBatchSize: clamp(partial?.maxBatchSize, 1, 25, DEFAULT_SCHEDULER_CONFIG.maxBatchSize)
  };
}

export class SchedulerOS {
  private adminDb: any | null = null;
  private workflowOs: ServerEditorialWorkflowOS;
  private config: SchedulerConfig;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isProcessingCycle: boolean = false;
  private inProcessJobLocks: Set<string> = new Set<string>();

  constructor(
    adminDb?: any,
    workflowOs?: ServerEditorialWorkflowOS,
    config?: Partial<SchedulerConfig>
  ) {
    this.adminDb = adminDb || null;
    this.workflowOs = workflowOs || serverEditorialWorkflowOS;
    this.config = validateAndNormalizeSchedulerConfig(config);
  }

  public configure(partial: Partial<SchedulerConfig>): SchedulerConfig {
    this.config = validateAndNormalizeSchedulerConfig({ ...this.config, ...partial });
    return { ...this.config };
  }

  public getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  public setAdminDb(db: any) {
    this.adminDb = db;
  }

  public setWorkflowOs(wos: ServerEditorialWorkflowOS) {
    this.workflowOs = wos;
  }

  /**
   * Starts background scheduler polling.
   */
  public startPolling(intervalMs?: number) {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    const interval = intervalMs || this.config.pollingIntervalMs;
    console.log(`[SchedulerOS] Starting scheduled publishing daemon (interval: ${interval}ms)`);
    this.pollingTimer = setInterval(() => {
      this.processDueScheduledCandidates("daemon_worker").catch(err => {
        console.error("[SchedulerOS] Background polling execution error:", err);
      });
    }, interval);
  }

  /**
   * Stops background polling.
   */
  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log("[SchedulerOS] Background scheduled publishing daemon stopped.");
    }
  }

  /**
   * Schedules an approved editorial candidate for future canonical publication.
   * Gated strictly by editorial staff permissions and candidate approval state.
   */
  public async scheduleCandidate(
    candidateId: string,
    input: ScheduleCandidateInput,
    actor: { uid: string; email?: string; role: string; name?: string }
  ): Promise<{
    success: boolean;
    candidate?: EditorialCandidate;
    error?: string;
    errorCode?: string;
  }> {
    // 1. Role Authorization Check: Only editorial staff can schedule news
    const isStaff = ["editor", "senior_editor", "chief_editor", "admin", "super_admin"].includes(actor.role);
    if (!isStaff) {
      return {
        success: false,
        error: "Forbidden: Editorial staff role required to schedule publication",
        errorCode: "ERR_FORBIDDEN"
      };
    }

    // 2. Validate Target Candidate Exists
    const candidate = this.workflowOs.getCandidate(candidateId);
    if (!candidate) {
      return {
        success: false,
        error: "Candidate not found",
        errorCode: "ERR_NOT_FOUND"
      };
    }

    // 3. Approval Invariant: ONLY candidates in 'approved' state can be scheduled
    if (candidate.status !== "approved") {
      return {
        success: false,
        error: `Cannot schedule candidate in '${candidate.status}' state. Candidate must be 'approved' first.`,
        errorCode: "ERR_NOT_APPROVED"
      };
    }

    // 4. Source Evidence Verification Invariant
    if (candidate.primarySource?.verificationStatus !== "verified") {
      return {
        success: false,
        error: "Cannot schedule candidate without verified source evidence",
        errorCode: "ERR_SOURCE_VERIFICATION_REQUIRED"
      };
    }

    // 5. Timestamp Validation: publishAt must be a valid ISO timestamp
    const publishDate = new Date(input.publishAt);
    if (isNaN(publishDate.getTime())) {
      return {
        success: false,
        error: "Invalid publishAt timestamp. Must be a valid ISO 8601 string.",
        errorCode: "ERR_INVALID_TIMESTAMP"
      };
    }

    const now = Date.now();
    // publishAt must not be far in the past (allow small 10s clock drift)
    if (publishDate.getTime() < now - 10000) {
      return {
        success: false,
        error: "publishAt timestamp must be in the future.",
        errorCode: "ERR_TIMESTAMP_IN_PAST"
      };
    }

    // 6. Mutate Scheduling State with Optimistic Concurrency
    const scheduledAt = new Date().toISOString();
    const schedulePayload: CandidateSchedule = {
      publishAt: publishDate.toISOString(),
      timezone: input.timezone || "Asia/Kathmandu",
      scheduledByUid: actor.uid,
      scheduledByName: actor.name || actor.email || "Editorial Staff",
      scheduledByEmail: actor.email,
      scheduledByRole: actor.role,
      scheduledAt
    };

    candidate.schedule = schedulePayload;
    candidate.schedulingStatus = "scheduled";
    candidate.executionAttempts = 0;
    candidate.leaseToken = null;
    candidate.leaseExpiresAt = null;
    candidate.version += 1;
    candidate.updatedAt = scheduledAt;

    candidate.history.push({
      id: `hist_${crypto.randomBytes(6).toString("hex")}`,
      fromStatus: candidate.status,
      toStatus: candidate.status,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: scheduledAt,
      reason: `Publication scheduled for ${publishPayloadTime(publishDate, input.timezone)}`,
      version: candidate.version
    });

    // 7. Persist to WorkflowOS (Memory, Disk, and Firestore)
    this.workflowOs.saveToDisk();

    if (this.adminDb) {
      try {
        await this.adminDb.collection("editorial_candidates").doc(candidate.id).set({
          ...candidate,
          updatedAt: candidate.updatedAt
        }, { merge: true });
      } catch (err) {
        console.warn("[SchedulerOS] Firestore sync warning for scheduled candidate:", err);
      }
    }

    // 8. Record Immutable Governance Audit Log
    try {
      await logAuditEvent(this.adminDb, {
        actorUid: actor.uid,
        actorEmail: actor.email || "staff@sanatanmarga.com",
        actorRole: actor.role,
        action: "candidate_publication_scheduled",
        targetUid: candidate.id,
        targetType: "editorial_candidate",
        resourceId: candidate.id,
        details: {
          candidateId: candidate.id,
          title: candidate.title,
          publishAt: schedulePayload.publishAt,
          timezone: schedulePayload.timezone,
          version: candidate.version
        },
        status: "SUCCESS"
      });
    } catch (auditErr) {
      console.warn("[SchedulerOS] Audit log emission warning:", auditErr);
    }

    return {
      success: true,
      candidate
    };
  }

  /**
   * Cancels a scheduled publication.
   */
  public async cancelScheduledCandidate(
    candidateId: string,
    reason: string,
    actor: { uid: string; email?: string; role: string; name?: string }
  ): Promise<{
    success: boolean;
    candidate?: EditorialCandidate;
    error?: string;
    errorCode?: string;
  }> {
    const isStaff = ["editor", "senior_editor", "chief_editor", "admin", "super_admin"].includes(actor.role);
    if (!isStaff) {
      return {
        success: false,
        error: "Forbidden: Editorial staff role required to cancel schedule",
        errorCode: "ERR_FORBIDDEN"
      };
    }

    const candidate = this.workflowOs.getCandidate(candidateId);
    if (!candidate) {
      return { success: false, error: "Candidate not found", errorCode: "ERR_NOT_FOUND" };
    }

    if (candidate.schedulingStatus !== "scheduled") {
      return {
        success: false,
        error: `Cannot cancel schedule: Candidate is in '${candidate.schedulingStatus || "idle"}' scheduling status.`,
        errorCode: "ERR_NOT_SCHEDULED"
      };
    }

    // If currently processing with a non-expired lease, lock prevents race
    if (candidate.leaseExpiresAt && new Date(candidate.leaseExpiresAt).getTime() > Date.now()) {
      return {
        success: false,
        error: "Cannot cancel schedule while candidate publication is actively processing.",
        errorCode: "ERR_JOB_LOCKED"
      };
    }

    const now = new Date().toISOString();
    candidate.schedulingStatus = "cancelled";
    candidate.leaseToken = null;
    candidate.leaseExpiresAt = null;
    candidate.version += 1;
    candidate.updatedAt = now;

    candidate.history.push({
      id: `hist_${crypto.randomBytes(6).toString("hex")}`,
      fromStatus: candidate.status,
      toStatus: candidate.status,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      reason: `Scheduled publication cancelled: ${reason || "No reason specified"}`,
      version: candidate.version
    });

    this.workflowOs.saveToDisk();

    if (this.adminDb) {
      try {
        await this.adminDb.collection("editorial_candidates").doc(candidate.id).set({
          schedulingStatus: "cancelled",
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
          version: candidate.version
        }, { merge: true });
      } catch (err) {
        console.warn("[SchedulerOS] Firestore sync warning for cancelled schedule:", err);
      }
    }

    try {
      await logAuditEvent(this.adminDb, {
        actorUid: actor.uid,
        actorEmail: actor.email || "staff@sanatanmarga.com",
        actorRole: actor.role,
        action: "candidate_schedule_cancelled",
        targetUid: candidate.id,
        targetType: "editorial_candidate",
        resourceId: candidate.id,
        details: { candidateId: candidate.id, reason, version: candidate.version },
        status: "SUCCESS"
      });
    } catch (auditErr) {
      console.warn("[SchedulerOS] Audit log emission warning:", auditErr);
    }

    return { success: true, candidate };
  }

  /**
   * Atomic Lease Claiming:
   * Prevents multi-instance races using Firestore transactions or in-memory fencing.
   */
  public async claimScheduledCandidate(
    candidateId: string,
    workerId: string = "scheduler_worker"
  ): Promise<{
    claimed: boolean;
    candidate?: EditorialCandidate;
    claimToken?: string;
    error?: string;
  }> {
    const candidate = this.workflowOs.getCandidate(candidateId);
    if (!candidate) {
      return { claimed: false, error: "Candidate not found" };
    }

    // In-process lock guard
    if (this.inProcessJobLocks.has(candidateId)) {
      return { claimed: false, error: "Candidate is currently locked by in-process worker" };
    }

    const now = Date.now();
    const leaseExpires = now + this.config.leaseDurationMs;
    const claimToken = `claim_${crypto.randomBytes(8).toString("hex")}_${now}`;

    // 1. Check if candidate is due and eligible
    if ((candidate.status !== "approved" && candidate.status !== "published") || candidate.schedulingStatus !== "scheduled") {
      return { claimed: false, error: "Candidate is not in approved/scheduled state" };
    }

    if (!candidate.schedule?.publishAt || new Date(candidate.schedule.publishAt).getTime() > now) {
      return { claimed: false, error: "Candidate is not yet due for publication" };
    }

    // Active unexpired lease check
    if (candidate.leaseExpiresAt && new Date(candidate.leaseExpiresAt).getTime() > now) {
      return { claimed: false, error: "Active lease held by another worker" };
    }

    // 2. Cross-instance atomic claim via Firestore transaction
    if (this.adminDb && typeof this.adminDb.runTransaction === "function") {
      try {
        let txSuccess = false;
        await this.adminDb.runTransaction(async (transaction: any) => {
          const docRef = this.adminDb.collection("editorial_candidates").doc(candidateId);
          const docSnap = await transaction.get(docRef);
          if (!docSnap.exists) {
            throw new Error("Candidate doc does not exist in Firestore");
          }
          const data = docSnap.data();
          if ((data.status !== "approved" && data.status !== "published") || data.schedulingStatus !== "scheduled") {
            throw new Error("Candidate is not approved/scheduled in Firestore");
          }

          if (data.leaseExpiresAt && new Date(data.leaseExpiresAt).getTime() > now) {
            throw new Error("Candidate is currently leased by another instance");
          }

          const attempts = (data.executionAttempts || 0) + 1;
          transaction.set(docRef, {
            schedulingStatus: "processing",
            leaseToken: claimToken,
            leaseExpiresAt: new Date(leaseExpires).toISOString(),
            executionAttempts: attempts,
            lastAttemptAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString()
          }, { merge: true });

          txSuccess = true;
        });

        if (!txSuccess) {
          return { claimed: false, error: "Transaction claim failed" };
        }
      } catch (txErr: any) {
        return { claimed: false, error: txErr?.message || "Transaction lease collision" };
      }
    }

    // Local / In-Memory update
    this.inProcessJobLocks.add(candidateId);
    candidate.schedulingStatus = "processing";
    candidate.leaseToken = claimToken;
    candidate.leaseExpiresAt = new Date(leaseExpires).toISOString();
    candidate.executionAttempts = (candidate.executionAttempts || 0) + 1;
    candidate.lastAttemptAt = new Date(now).toISOString();
    candidate.updatedAt = new Date(now).toISOString();

    return {
      claimed: true,
      candidate,
      claimToken
    };
  }

  /**
   * Processes all scheduled candidates that are due for publication.
   * Invokes the full canonical publishApprovedCandidate() pipeline.
   */
  public async processDueScheduledCandidates(workerId: string = "worker"): Promise<{
    processedCount: number;
    publishedCount: number;
    failedCount: number;
    skippedCount: number;
    details: Array<{ candidateId: string; status: string; articleId?: string; error?: string }>;
  }> {
    if (this.isProcessingCycle) {
      return {
        processedCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        details: [{ candidateId: "system", status: "SKIPPED_CYCLE_IN_PROGRESS" }]
      };
    }

    this.isProcessingCycle = true;
    const results: Array<{ candidateId: string; status: string; articleId?: string; error?: string }> = [];
    let publishedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      const now = Date.now();
      const allCandidates = this.workflowOs.listCandidates({ limit: 100 }).candidates;

      // Filter candidates that are due
      const dueCandidates = allCandidates.filter(c => {
        if (c.status !== "approved" && c.status !== "published") return false;
        if (c.schedulingStatus !== "scheduled") return false;
        if (!c.schedule?.publishAt) return false;
        return new Date(c.schedule.publishAt).getTime() <= now;
      }).slice(0, this.config.maxBatchSize);

      for (const cand of dueCandidates) {
        // Attempt atomic claim
        const claimRes = await this.claimScheduledCandidate(cand.id, workerId);
        if (!claimRes.claimed || !claimRes.candidate) {
          skippedCount++;
          results.push({
            candidateId: cand.id,
            status: "CLAIM_SKIPPED",
            error: claimRes.error
          });
          continue;
        }

        const candidate = claimRes.candidate;
        const claimToken = claimRes.claimToken;

        try {
          // Construct actor from scheduler metadata
          const executingActor = {
            uid: candidate.schedule?.scheduledByUid || "system_scheduler",
            email: candidate.schedule?.scheduledByEmail || "scheduler@sanatanmarga.com",
            role: candidate.schedule?.scheduledByRole || "editor",
            name: candidate.schedule?.scheduledByName || "Scheduled Publishing Daemon"
          };

          // INVENTORY REUSE: Invoke full canonical publication pipeline!
          const pubRes = await this.workflowOs.publishApprovedCandidate(candidate.id, executingActor, {
            idempotencyKey: `sched_pub_${candidate.id}_gen${candidate.version}`
          });

          if (pubRes.success && pubRes.articleId) {
            publishedCount++;
            candidate.schedulingStatus = "completed";
            candidate.leaseToken = null;
            candidate.leaseExpiresAt = null;
            candidate.lastPublicationResult = {
              success: true,
              articleId: pubRes.articleId,
              executedAt: new Date().toISOString()
            };

            results.push({
              candidateId: candidate.id,
              status: "PUBLISHED",
              articleId: pubRes.articleId
            });

            // Update in Firestore
            if (this.adminDb) {
              await this.adminDb.collection("editorial_candidates").doc(candidate.id).set({
                schedulingStatus: "completed",
                leaseToken: null,
                leaseExpiresAt: null,
                lastPublicationResult: candidate.lastPublicationResult,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }

            // Audit Log
            await logAuditEvent(this.adminDb, {
              actorUid: executingActor.uid,
              actorEmail: executingActor.email,
              actorRole: executingActor.role,
              action: "scheduled_candidate_published",
              targetUid: candidate.id,
              targetType: "editorial_candidate",
              resourceId: pubRes.articleId,
              details: {
                candidateId: candidate.id,
                articleId: pubRes.articleId,
                scheduledFor: candidate.schedule?.publishAt,
                executedAt: candidate.lastPublicationResult.executedAt
              },
              status: "SUCCESS"
            });
          } else {
            // Failure handling
            failedCount++;
            const attempts = candidate.executionAttempts || 1;
            const hasMoreAttempts = attempts < this.config.maxAttempts;
            candidate.schedulingStatus = hasMoreAttempts ? "scheduled" : "failed";
            candidate.leaseToken = null;
            candidate.leaseExpiresAt = null;
            const errMsg = pubRes.error || "Publication failed";
            candidate.lastPublicationResult = {
              success: false,
              error: errMsg,
              errorCode: pubRes.errorCode,
              executedAt: new Date().toISOString()
            };

            if (candidate.schedule) {
              candidate.schedule.failureReason = errMsg;
            }

            // Record structured Sentry / telemetry failure
            captureSchedulerFailure(candidate.id, attempts, errMsg);

            // Backoff for retry if attempts remain
            if (hasMoreAttempts && candidate.schedule) {
              const backoffMs = this.config.baseBackoffSeconds * 1000 * Math.pow(2, attempts - 1);
              candidate.schedule.publishAt = new Date(Date.now() + backoffMs).toISOString();
            }

            results.push({
              candidateId: candidate.id,
              status: hasMoreAttempts ? "RETRY_QUEUED" : "FAILED_PERMANENT",
              error: pubRes.error
            });

            if (this.adminDb) {
              await this.adminDb.collection("editorial_candidates").doc(candidate.id).set({
                schedulingStatus: candidate.schedulingStatus,
                leaseToken: null,
                leaseExpiresAt: null,
                lastPublicationResult: candidate.lastPublicationResult,
                schedule: candidate.schedule,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }

            await logAuditEvent(this.adminDb, {
              actorUid: executingActor.uid,
              actorEmail: executingActor.email,
              actorRole: executingActor.role,
              action: "scheduled_candidate_execution_failed",
              targetUid: candidate.id,
              targetType: "editorial_candidate",
              resourceId: candidate.id,
              details: {
                candidateId: candidate.id,
                attempt: attempts,
                hasMoreAttempts,
                error: pubRes.error,
                errorCode: pubRes.errorCode
              },
              status: "FAILED"
            });
          }
        } finally {
          this.inProcessJobLocks.delete(cand.id);
          this.workflowOs.saveToDisk();
        }
      }
    } finally {
      this.isProcessingCycle = false;
    }

    return {
      processedCount: publishedCount + failedCount + skippedCount,
      publishedCount,
      failedCount,
      skippedCount,
      details: results
    };
  }

  /**
   * Retrieves current scheduler operational status and queue metrics.
   */
  public getSchedulerStatus(): {
    active: boolean;
    pollingIntervalMs: number;
    pendingScheduledCount: number;
    scheduledCandidatesCount: number;
    processingCount: number;
    failedCount: number;
    activeLocksCount: number;
    nextDuePublishAt: string | null;
    config: SchedulerConfig;
  } {
    const candidates = this.workflowOs.listCandidates({ limit: 1000 }).candidates;
    const scheduled = candidates.filter(c => c.status === "approved" && c.schedulingStatus === "scheduled");
    const processing = candidates.filter(c => c.schedulingStatus === "processing");
    const failed = candidates.filter(c => c.schedulingStatus === "failed");

    let nextDue: string | null = null;
    if (scheduled.length > 0) {
      const sorted = scheduled
        .filter(c => !!c.schedule?.publishAt)
        .sort((a, b) => new Date(a.schedule!.publishAt).getTime() - new Date(b.schedule!.publishAt).getTime());
      if (sorted.length > 0) {
        nextDue = sorted[0].schedule!.publishAt;
      }
    }

    return {
      active: this.pollingTimer !== null,
      pollingIntervalMs: this.config.pollingIntervalMs,
      pendingScheduledCount: scheduled.length,
      scheduledCandidatesCount: scheduled.length,
      processingCount: processing.length,
      failedCount: failed.length,
      activeLocksCount: this.inProcessJobLocks.size,
      nextDuePublishAt: nextDue,
      config: { ...this.config }
    };
  }
}

function publishPayloadTime(date: Date, timezone?: string): string {
  try {
    return date.toLocaleString("en-US", { timeZone: timezone || "Asia/Kathmandu" });
  } catch {
    return date.toISOString();
  }
}

export const serverSchedulerOS = new SchedulerOS();
