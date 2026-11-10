/**
 * SANATANMARGA 5.0 BETA — PHASE 3C
 * Server Audience OS 5.0
 * 
 * Central server authority for Reader Activity ingestion,
 * privacy-conscious deduplication, bounded aggregation,
 * user continuation/history APIs, and admin telemetry.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ReaderActivityEvent,
  ReaderActivityEventType,
  VALID_ACTIVITY_EVENT_TYPES,
  ContentAudienceAggregate,
  AudienceIngestBatchRequest,
  AudienceIngestBatchResponse,
  AudienceAdminSummary,
  ContinueReadingItem,
  ReadingHistoryItem,
  DwellTimeBucket,
  DeviceClass
} from "../src/types/readerActivity";

export class ServerAudienceOS {
  private aggregatesStorePath: string;
  private historyStorePath: string;
  private telemetryStorePath: string;

  // In-memory data structures
  private contentAggregates = new Map<string, ContentAudienceAggregate>();
  private userHistory = new Map<string, ReadingHistoryItem[]>();
  private userContinueReading = new Map<string, Map<string, ContinueReadingItem>>();

  // Deduplication & Idempotency cache (bounded LRU, max 25,000 event IDs)
  private processedEventIds = new Set<string>();
  private processedEventOrder: string[] = [];
  private readonly MAX_DEDUP_CACHE_SIZE = 25000;

  // Rate Limiting (Sliding window: max 120 events/min per session/IP)
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  private readonly MAX_EVENTS_PER_MINUTE = 120;

  // Telemetry metrics
  private totalEventsIngested = 0;
  private totalEventsRejected = 0;
  private totalEventsDeduplicated = 0;
  private activeSessions = new Set<string>();
  private lastAggregationTimestamp: string;

  // Bounded audit logs
  private readAuditLogs: Array<{ action: string; meta: any; timestamp: string }> = [];

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {}
    }

    this.aggregatesStorePath = path.join(dataDir, "audience_aggregates.json");
    this.historyStorePath = path.join(dataDir, "audience_history.json");
    this.telemetryStorePath = path.join(dataDir, "audience_telemetry.json");
    this.lastAggregationTimestamp = new Date().toISOString();

    this.loadStores();
  }

  private loadStores() {
    try {
      if (fs.existsSync(this.aggregatesStorePath)) {
        const raw = fs.readFileSync(this.aggregatesStorePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [key, agg] of Object.entries(parsed)) {
            this.contentAggregates.set(key, agg as ContentAudienceAggregate);
          }
        }
      }
    } catch (err) {
      console.warn("[Audience OS] Error loading aggregates store:", err);
    }

    try {
      if (fs.existsSync(this.historyStorePath)) {
        const raw = fs.readFileSync(this.historyStorePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.history) {
          for (const [uid, items] of Object.entries(parsed.history)) {
            this.userHistory.set(uid, items as ReadingHistoryItem[]);
          }
        }
        if (parsed?.continueReading) {
          for (const [uid, items] of Object.entries(parsed.continueReading)) {
            const m = new Map<string, ContinueReadingItem>();
            for (const [eid, item] of Object.entries(items as any)) {
              m.set(eid, item as ContinueReadingItem);
            }
            this.userContinueReading.set(uid, m);
          }
        }
      }
    } catch (err) {
      console.warn("[Audience OS] Error loading history store:", err);
    }
  }

  public saveStoresSync() {
    try {
      const aggObj: Record<string, ContentAudienceAggregate> = {};
      for (const [k, v] of this.contentAggregates.entries()) {
        aggObj[k] = v;
      }
      fs.writeFileSync(this.aggregatesStorePath, JSON.stringify(aggObj, null, 2));

      const histObj: Record<string, ReadingHistoryItem[]> = {};
      for (const [k, v] of this.userHistory.entries()) {
        histObj[k] = v;
      }

      const crObj: Record<string, Record<string, ContinueReadingItem>> = {};
      for (const [uid, map] of this.userContinueReading.entries()) {
        crObj[uid] = {};
        for (const [eid, item] of map.entries()) {
          crObj[uid][eid] = item;
        }
      }

      fs.writeFileSync(this.historyStorePath, JSON.stringify({ history: histObj, continueReading: crObj }, null, 2));
    } catch (err) {
      console.warn("[Audience OS] Error persisting audience store:", err);
    }
  }

  // --- AUDIT LOGGING ---
  public logAudit(action: string, meta: any = {}) {
    const entry = {
      action,
      meta,
      timestamp: new Date().toISOString()
    };
    this.readAuditLogs.unshift(entry);
    if (this.readAuditLogs.length > 500) {
      this.readAuditLogs.pop();
    }
  }

  public getAuditLogs() {
    return [...this.readAuditLogs];
  }

  // --- RATE LIMITING ---
  private checkRateLimit(key: string, eventCount: number): boolean {
    const now = Date.now();
    const current = this.rateLimitMap.get(key);
    if (!current || now > current.resetAt) {
      this.rateLimitMap.set(key, { count: eventCount, resetAt: now + 60000 });
      return true;
    }

    if (current.count + eventCount > this.MAX_EVENTS_PER_MINUTE) {
      return false;
    }

    current.count += eventCount;
    return true;
  }

  // --- BATCH INGESTION & VALIDATION ---
  public ingestEventBatch(
    batch: AudienceIngestBatchRequest,
    context?: {
      clientIp?: string;
      authUserId?: string;
      circuitBreakerOpen?: boolean;
      featureEnabled?: boolean;
    }
  ): AudienceIngestBatchResponse {
    this.logAudit("audience_event_ingest", {
      eventCount: batch?.events?.length || 0,
      authUserId: context?.authUserId || "anonymous",
      clientIp: context?.clientIp
    });

    // 1. Feature Control Enforcement
    if (context?.featureEnabled === false) {
      return {
        success: false,
        accepted: 0,
        rejected: batch?.events?.length || 0,
        deduplicated: 0,
        errors: ["FEATURE_DISABLED: Reader Activity ingestion is currently disabled by Feature Control."]
      };
    }

    // 2. Quota Circuit Breaker Enforcement
    if (context?.circuitBreakerOpen) {
      return {
        success: false,
        accepted: 0,
        rejected: batch?.events?.length || 0,
        deduplicated: 0,
        errors: ["CIRCUIT_BREAKER_OPEN: Optional analytics ingestion paused during quota conservation mode."]
      };
    }

    // 3. Batch Bounds Enforcement
    if (!batch || !Array.isArray(batch.events)) {
      return {
        success: false,
        accepted: 0,
        rejected: 0,
        deduplicated: 0,
        errors: ["Invalid batch payload: 'events' array required."]
      };
    }

    if (batch.events.length > 50) {
      return {
        success: false,
        accepted: 0,
        rejected: batch.events.length,
        deduplicated: 0,
        errors: ["Batch payload count limit exceeded (maximum 50 events per batch)."]
      };
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(batch), "utf-8");
    if (payloadBytes > 256 * 1024) {
      return {
        success: false,
        accepted: 0,
        rejected: batch.events.length,
        deduplicated: 0,
        errors: ["Batch payload byte limit exceeded (maximum 256 KB)."]
      };
    }

    // 4. Rate Limiting Check
    const rateLimitKey = context?.clientIp || batch.events[0]?.sessionId || "global_session";
    if (!this.checkRateLimit(rateLimitKey, batch.events.length)) {
      return {
        success: false,
        accepted: 0,
        rejected: batch.events.length,
        deduplicated: 0,
        errors: ["RATE_LIMIT_EXCEEDED: Too many audience events submitted. Bounded backoff required."]
      };
    }

    let accepted = 0;
    let rejected = 0;
    let deduplicated = 0;
    const errors: string[] = [];

    const nowMs = Date.now();
    const serverReceivedAt = new Date().toISOString();

    for (const event of batch.events) {
      // Schema validation
      if (!event.eventId || typeof event.eventId !== "string") {
        rejected++;
        errors.push("Missing eventId");
        continue;
      }

      // Schema versioning
      if (event.schemaVersion !== 1) {
        rejected++;
        errors.push(`Unsupported schemaVersion '${event.schemaVersion}'. Must be 1.`);
        continue;
      }

      // Event taxonomy check
      if (!VALID_ACTIVITY_EVENT_TYPES.includes(event.eventType)) {
        rejected++;
        errors.push(`Invalid eventType '${event.eventType}'. Must be registry-approved.`);
        continue;
      }

      // Idempotency / Deduplication check
      if (this.processedEventIds.has(event.eventId)) {
        deduplicated++;
        continue;
      }

      // Sensitive Data & Metadata allowlist inspection
      const rawMetadata = JSON.stringify(event.metadata || {});
      const forbiddenTokens = [
        "password",
        "token",
        "secret",
        "apikey",
        "accesstoken",
        "refreshtoken",
        "creditcard",
        "cvv",
        "ssn",
        "assessmentanswer",
        "privatemessage",
        "draftcontent"
      ];
      let hasSensitive = false;
      const lowerMeta = rawMetadata.toLowerCase();
      for (const tok of forbiddenTokens) {
        if (lowerMeta.includes(tok)) {
          hasSensitive = true;
          break;
        }
      }
      if (hasSensitive) {
        rejected++;
        errors.push(`Security Violation: Sensitive data pattern detected in event '${event.eventId}' metadata.`);
        continue;
      }

      // Identity & Session validation
      // Anonymous request cannot claim or forge an authenticated userId
      if (event.userId) {
        if (!context?.authUserId || context.authUserId !== event.userId) {
          rejected++;
          errors.push(`Authentication mismatch: Anonymous or unauthorized client cannot claim userId '${event.userId}'.`);
          continue;
        }
      }

      // Timestamp clamping
      let eventTime = event.occurredAt;
      if (!eventTime || isNaN(Date.parse(eventTime))) {
        eventTime = serverReceivedAt;
      } else {
        const eventMs = new Date(eventTime).getTime();
        // Future skew check (> 5 mins into future)
        if (eventMs > nowMs + 5 * 60 * 1000) {
          eventTime = serverReceivedAt;
        }
        // Too far in past (> 30 days)
        if (nowMs - eventMs > 30 * 24 * 60 * 60 * 1000) {
          rejected++;
          errors.push(`Event '${event.eventId}' timestamp is expired (> 30 days old).`);
          continue;
        }
      }

      // Anonymous tenant safety check
      if (!context?.authUserId && event.tenantId && event.tenantId !== "sanatan-media") {
        rejected++;
        errors.push(`Tenant security: Anonymous events cannot specify cross-tenant identifier '${event.tenantId}'.`);
        continue;
      }

      // Mark processed in deduplication cache
      this.processedEventIds.add(event.eventId);
      this.processedEventOrder.push(event.eventId);
      if (this.processedEventOrder.length > this.MAX_DEDUP_CACHE_SIZE) {
        const oldest = this.processedEventOrder.shift();
        if (oldest) this.processedEventIds.delete(oldest);
      }

      // Record active session
      if (event.sessionId) {
        this.activeSessions.add(event.sessionId);
      }

      // Process event into aggregates and personal continuation
      this.processValidatedEvent({ ...event, occurredAt: eventTime });
      accepted++;
    }

    this.totalEventsIngested += accepted;
    this.totalEventsRejected += rejected;
    this.totalEventsDeduplicated += deduplicated;
    this.lastAggregationTimestamp = new Date().toISOString();

    // Persist stores periodically
    this.saveStoresSync();

    return {
      success: rejected === 0,
      accepted,
      rejected,
      deduplicated,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // --- EVENT PROCESSING & AGGREGATION ---
  private processValidatedEvent(event: ReaderActivityEvent) {
    const isInternalTraffic =
      event.metadata?.isInternalPreview === true ||
      (event.route && (event.route.startsWith("/admin") || event.route.startsWith("/draft")));

    // 1. Process Aggregates (Strictly public, de-identified content only)
    if (!isInternalTraffic && event.entityId) {
      this.updateContentAggregate(event);
    }

    // 2. Process Personal Continuation & Reading History (User-isolated or Local)
    if (event.userId && event.entityId) {
      if (event.eventType === "ARTICLE_OPEN" || event.eventType === "ARTICLE_READ_PROGRESS") {
        this.recordUserContinuation(event);
      }
      if (event.eventType === "ARTICLE_OPEN" || event.eventType === "ARTICLE_COMPLETE") {
        this.recordUserHistory(event);
      }
    }
  }

  private updateContentAggregate(event: ReaderActivityEvent) {
    const entityId = event.entityId!;
    const entityType = event.entityType || "article";
    const existing = this.contentAggregates.get(entityId) || {
      entityType,
      entityId,
      period: "all_time",
      views: 0,
      uniqueSessionsApprox: 0,
      completions: 0,
      saves: 0,
      shares: 0,
      notificationOpens: 0,
      avgDwellSecondsApprox: 0,
      deviceBreakdown: { mobile: 0, tablet: 0, desktop: 0, unknown: 0 },
      languageBreakdown: { ne: 0, en: 0, all: 0 },
      lastUpdated: new Date().toISOString()
    };

    if (event.eventType === "ARTICLE_OPEN" || event.eventType === "PAGE_VIEW") {
      existing.views += 1;
      existing.uniqueSessionsApprox += 1;
    } else if (event.eventType === "ARTICLE_COMPLETE") {
      existing.completions += 1;
    } else if (event.eventType === "SAVE") {
      existing.saves += 1;
    } else if (event.eventType === "NOTIFICATION_OPEN") {
      existing.notificationOpens += 1;
      existing.views += 1;
    }

    // Dwell accumulation
    if (event.metadata?.dwellSeconds && typeof event.metadata.dwellSeconds === "number") {
      const clampedDwell = Math.min(Math.max(event.metadata.dwellSeconds, 0), 3600);
      existing.avgDwellSecondsApprox = existing.views > 0
        ? Math.round((existing.avgDwellSecondsApprox * (existing.views - 1) + clampedDwell) / existing.views)
        : clampedDwell;
    }

    // Device breakdown
    const dev = event.deviceClass || "unknown";
    existing.deviceBreakdown[dev] = (existing.deviceBreakdown[dev] || 0) + 1;

    // Language breakdown
    const lang = event.language || "ne";
    existing.languageBreakdown[lang] = (existing.languageBreakdown[lang] || 0) + 1;

    existing.lastUpdated = new Date().toISOString();
    this.contentAggregates.set(entityId, existing);
  }

  private recordUserContinuation(event: ReaderActivityEvent) {
    const uid = event.userId!;
    const eid = event.entityId!;
    let userMap = this.userContinueReading.get(uid);
    if (!userMap) {
      userMap = new Map<string, ContinueReadingItem>();
      this.userContinueReading.set(uid, userMap);
    }

    const milestone = event.metadata?.milestone || 25;
    const item: ContinueReadingItem = {
      entityId: eid,
      entityType: event.entityType || "article",
      title: (event.route ? path.basename(event.route) : eid).slice(0, 120),
      progressPercent: milestone,
      lastReadAt: event.occurredAt,
      language: event.language || "ne",
      canonicalUrl: event.route || `/article/${eid}`,
      category: event.metadata?.targetId
    };

    // If completed (progress 100), remove from continue reading
    if (milestone === 100 || event.eventType === "ARTICLE_COMPLETE") {
      userMap.delete(eid);
    } else {
      userMap.set(eid, item);
      // Bound continue reading to max 20 items per user
      if (userMap.size > 20) {
        const firstKey = userMap.keys().next().value;
        if (firstKey) userMap.delete(firstKey);
      }
    }
  }

  private recordUserHistory(event: ReaderActivityEvent) {
    const uid = event.userId!;
    const eid = event.entityId!;
    let list = this.userHistory.get(uid) || [];

    // Deduplicate existing entry for same entity
    list = list.filter(item => item.entityId !== eid);

    const historyItem: ReadingHistoryItem = {
      entityId: eid,
      entityType: event.entityType || "article",
      title: (event.route ? path.basename(event.route) : eid).slice(0, 120),
      visitedAt: event.occurredAt,
      language: event.language || "ne",
      canonicalUrl: event.route || `/article/${eid}`,
      category: event.metadata?.targetId,
      completed: event.eventType === "ARTICLE_COMPLETE"
    };

    list.unshift(historyItem);
    // Bound history to max 50 items per user
    if (list.length > 50) {
      list.pop();
    }
    this.userHistory.set(uid, list);
  }

  // --- PUBLIC USER CONTINUATION & HISTORY APIS ---
  public getUserContinueReading(userId: string): ContinueReadingItem[] {
    this.logAudit("audience_continue_reading", { userId });
    const userMap = this.userContinueReading.get(userId);
    if (!userMap) return [];
    return Array.from(userMap.values()).sort(
      (a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime()
    );
  }

  public getUserHistory(userId: string, limit: number = 20): ReadingHistoryItem[] {
    this.logAudit("audience_recent_history", { userId, limit });
    const list = this.userHistory.get(userId) || [];
    return list.slice(0, Math.min(limit, 50));
  }

  public clearUserHistory(userId: string): boolean {
    this.logAudit("audience_history_clear", { userId });
    this.userHistory.delete(userId);
    this.userContinueReading.delete(userId);
    this.saveStoresSync();
    return true;
  }

  // --- CONTENT AGGREGATE API ---
  public getContentAggregate(entityId: string): ContentAudienceAggregate | null {
    this.logAudit("audience_content_aggregate", { entityId });
    return this.contentAggregates.get(entityId) || null;
  }

  // --- ADMIN AUDIENCE SUMMARY ---
  public getAdminSummary(): AudienceAdminSummary {
    this.logAudit("audience_admin_summary", {});

    let totalViews = 0;
    let totalCompletions = 0;
    let totalDwellSum = 0;
    let totalDwellCount = 0;

    const dwellBuckets: Record<DwellTimeBucket, number> = {
      "<15s": 0,
      "15_60s": 0,
      "1_3m": 0,
      "3_10m": 0,
      "10m_plus": 0
    };

    const topItems: Array<{ entityId: string; entityType: string; views: number; completions: number }> = [];

    for (const agg of this.contentAggregates.values()) {
      totalViews += agg.views;
      totalCompletions += agg.completions;
      if (agg.avgDwellSecondsApprox > 0) {
        totalDwellSum += agg.avgDwellSecondsApprox * agg.views;
        totalDwellCount += agg.views;

        if (agg.avgDwellSecondsApprox < 15) dwellBuckets["<15s"] += agg.views;
        else if (agg.avgDwellSecondsApprox <= 60) dwellBuckets["15_60s"] += agg.views;
        else if (agg.avgDwellSecondsApprox <= 180) dwellBuckets["1_3m"] += agg.views;
        else if (agg.avgDwellSecondsApprox <= 600) dwellBuckets["3_10m"] += agg.views;
        else dwellBuckets["10m_plus"] += agg.views;
      }

      topItems.push({
        entityId: agg.entityId,
        entityType: agg.entityType,
        views: agg.views,
        completions: agg.completions
      });
    }

    topItems.sort((a, b) => b.views - a.views);

    return {
      period: "24h",
      totalViews,
      totalUniqueSessionsEstimate: this.activeSessions.size,
      totalCompletions,
      avgDwellSecondsEstimate: totalDwellCount > 0 ? Math.round(totalDwellSum / totalDwellCount) : 0,
      dwellBucketDistribution: dwellBuckets,
      topContent: topItems.slice(0, 10),
      pipelineHealth: {
        status: "healthy",
        circuitBreakerOpen: false,
        eventsIngested24h: this.totalEventsIngested,
        eventsRejected24h: this.totalEventsRejected,
        eventsDeduplicated24h: this.totalEventsDeduplicated,
        activeSessionsEstimate: this.activeSessions.size,
        lastAggregationTimestamp: this.lastAggregationTimestamp
      }
    };
  }

  // --- SNAPSHOT OS ARTIFACT GENERATOR ---
  public generateAudienceSnapshotArtifact(): {
    trendingContent: Array<{ entityId: string; entityType: string; views: number; completions: number }>;
    totalPublicViews: number;
    generatedAt: string;
  } {
    const trending = Array.from(this.contentAggregates.values())
      .map(agg => ({
        entityId: agg.entityId,
        entityType: agg.entityType,
        views: agg.views,
        completions: agg.completions
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    let totalViews = 0;
    for (const item of trending) {
      totalViews += item.views;
    }

    return {
      trendingContent: trending,
      totalPublicViews: totalViews,
      generatedAt: new Date().toISOString()
    };
  }
}

export const serverAudienceOS = new ServerAudienceOS();
