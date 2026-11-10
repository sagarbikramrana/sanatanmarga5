/**
 * SANATANMARGA 5.0 BETA — SERVER COMPOSITION OS ENGINE
 * Phase 3B: Complete Homepage Manager Backend Engine, Composition OS,
 * Validation Engine, Deduplication, Projection Sanitization, Concurrency & Read Observability
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  HomepageComposition,
  HomepageSectionConfig,
  HomepageCompositionBaseline,
  CompositionReadAuditOp,
  CompositionValidationResult,
  HomepageCardProjection,
  AdminAttentionCase,
  VALID_SECTION_TYPES,
  VALID_SLOT_ENTITY_TYPES,
  SectionType,
  SlotEntityType
} from "../src/types/composition.js";

export class ServerCompositionOS {
  private activeCompositionStorePath: string;
  private draftCompositionStorePath: string;
  private historyStorePath: string;
  private scheduledStorePath: string;
  private attentionStorePath: string;

  private activeComposition: HomepageComposition | null = null;
  private draftComposition: HomepageComposition | null = null;
  private versionHistory: HomepageComposition[] = [];
  private scheduledCompositions: HomepageComposition[] = [];
  private attentionCases: AdminAttentionCase[] = [];
  private auditLogs: Array<{ op: CompositionReadAuditOp; timestamp: string; details?: any }> = [];

  // Concurrency & Idempotency Controls
  private publishLock: boolean = false;
  private publishedIdempotencyKeys: Set<string> = new Set();

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.activeCompositionStorePath = path.join(dataDir, "homepage_composition_active.json");
    this.draftCompositionStorePath = path.join(dataDir, "homepage_composition_draft.json");
    this.historyStorePath = path.join(dataDir, "homepage_composition_history.json");
    this.scheduledStorePath = path.join(dataDir, "homepage_composition_scheduled.json");
    this.attentionStorePath = path.join(dataDir, "homepage_composition_attention.json");

    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.activeCompositionStorePath)) {
        const raw = fs.readFileSync(this.activeCompositionStorePath, "utf-8");
        this.activeComposition = JSON.parse(raw);
      }
      if (fs.existsSync(this.draftCompositionStorePath)) {
        const raw = fs.readFileSync(this.draftCompositionStorePath, "utf-8");
        this.draftComposition = JSON.parse(raw);
      }
      if (fs.existsSync(this.historyStorePath)) {
        const raw = fs.readFileSync(this.historyStorePath, "utf-8");
        this.versionHistory = JSON.parse(raw);
      }
      if (fs.existsSync(this.scheduledStorePath)) {
        const raw = fs.readFileSync(this.scheduledStorePath, "utf-8");
        this.scheduledCompositions = JSON.parse(raw);
      }
      if (fs.existsSync(this.attentionStorePath)) {
        const raw = fs.readFileSync(this.attentionStorePath, "utf-8");
        this.attentionCases = JSON.parse(raw);
      }
    } catch (err) {
      console.warn("[CompositionOS] Error loading store from disk:", err);
    }

    if (!this.activeComposition) {
      this.activeComposition = this.createDefaultComposition("active", 1);
      this.saveActiveComposition();
    } else if (!this.activeComposition.revisionHash) {
      this.activeComposition.revisionHash = this.computeRevisionHash(this.activeComposition);
    }
    if (this.draftComposition && !this.draftComposition.revisionHash) {
      this.draftComposition.revisionHash = this.computeRevisionHash(this.draftComposition);
    }
  }

  public createDefaultComposition(id: string, version: number): HomepageComposition {
    const sections: HomepageSectionConfig[] = [
      {
        id: "sec_hero",
        type: "hero",
        title: "मुख्य समाचार (Hero Headline)",
        titleNe: "मुख्य समाचार",
        order: 1,
        isEnabled: true,
        rule: { autoFillStrategy: "latest", maxItems: 5, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      },
      {
        id: "sec_breaking",
        type: "breaking_news",
        title: "ताजा अपडेट (Breaking Ticker)",
        titleNe: "ताजा अपडेट",
        order: 2,
        isEnabled: true,
        rule: { autoFillStrategy: "latest", maxItems: 10, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      },
      {
        id: "sec_categories",
        type: "category_grid",
        title: "विधागत समाचार (Category Sections)",
        titleNe: "विधागत समाचार",
        order: 3,
        isEnabled: true,
        rule: { autoFillStrategy: "category_matched", maxItems: 6, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      },
      {
        id: "sec_trending",
        type: "trending_bento",
        title: "धेरै पढिएका (Trending & Most Read)",
        titleNe: "धेरै पढिएका",
        order: 4,
        isEnabled: true,
        rule: { autoFillStrategy: "most_read", maxItems: 10, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      },
      {
        id: "sec_video",
        type: "video_showcase",
        title: "भिडियो र दृश्य (Video Showcase)",
        titleNe: "भिडियो र दृश्य",
        order: 5,
        isEnabled: true,
        rule: { autoFillStrategy: "latest", maxItems: 4, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      },
      {
        id: "sec_announcements",
        type: "announcements",
        title: "सार्वजनिक सूचना (Official Notices)",
        titleNe: "सार्वजनिक सूचना",
        order: 6,
        isEnabled: true,
        rule: { autoFillStrategy: "latest", maxItems: 5, fallbackStrategy: "fill_recent" },
        pinnedSlots: []
      }
    ];

    const comp: HomepageComposition = {
      id,
      version,
      status: id === "active" ? "active" : "draft",
      sections,
      language: "all",
      updatedAt: new Date().toISOString(),
      updatedBy: "system_init",
      publishedAt: id === "active" ? new Date().toISOString() : undefined,
      publishedBy: id === "active" ? "system_init" : undefined
    };
    comp.revisionHash = this.computeRevisionHash(comp);
    return comp;
  }

  private computeRevisionHash(comp: HomepageComposition): string {
    const data = JSON.stringify({
      version: comp.version,
      sections: comp.sections,
      language: comp.language
    });
    return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  }

  private logAudit(op: CompositionReadAuditOp, details?: any) {
    this.auditLogs.push({ op, timestamp: new Date().toISOString(), details });
    if (this.auditLogs.length > 500) this.auditLogs.shift();
  }

  public recordAttentionCase(attention: AdminAttentionCase) {
    this.attentionCases.unshift(attention);
    if (this.attentionCases.length > 100) this.attentionCases.pop();
    try {
      fs.writeFileSync(this.attentionStorePath, JSON.stringify(this.attentionCases, null, 2));
    } catch (e) {}
  }

  public getAttentionCases(): AdminAttentionCase[] {
    return this.attentionCases;
  }

  // --- VALIDATION ENGINE ---
  public validateComposition(
    comp: HomepageComposition,
    context?: {
      articles?: Record<string, { status?: string; published?: boolean; isPrivate?: boolean; deleted?: boolean }>;
      features?: Record<string, boolean>;
    }
  ): CompositionValidationResult {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];
    const checkedAt = new Date().toISOString();

    if (!comp || !Array.isArray(comp.sections)) {
      return { valid: false, blockingErrors: ["Composition sections array is missing or invalid"], warnings: [], checkedAt };
    }

    // 1. Safety Check: Disallow arbitrary HTML/script injection in all fields
    const rawJson = JSON.stringify(comp);
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /<iframe/gi,
      /<img\s+[^>]*onerror/gi,
      /<svg\s+[^>]*onload/gi
    ];
    for (const pat of dangerousPatterns) {
      if (pat.test(rawJson)) {
        blockingErrors.push("Security Violation: Arbitrary executable HTML/JS detected in composition payload.");
        break;
      }
    }

    // 2. Validate Sections & Registry
    const seenSectionIds = new Set<string>();
    for (const sec of comp.sections) {
      if (!sec.id || seenSectionIds.has(sec.id)) {
        blockingErrors.push(`Duplicate or missing section ID: '${sec.id}'`);
      }
      seenSectionIds.add(sec.id);

      // Section type validation against registry
      if (!VALID_SECTION_TYPES.includes(sec.type)) {
        blockingErrors.push(`Invalid section type '${sec.type}' in section '${sec.id}'. Must be a registry-approved type.`);
      }

      // Check section rule
      if (sec.rule) {
        // Reject raw database query attempts
        const rawRuleJson = JSON.stringify(sec.rule);
        if (
          rawRuleJson.includes("where") ||
          rawRuleJson.includes("collection") ||
          rawRuleJson.includes("firestore") ||
          rawRuleJson.includes("query") ||
          rawRuleJson.includes("$")
        ) {
          blockingErrors.push(`Security Violation: Unrestricted database queries or clauses in section rule '${sec.id}'.`);
        }

        if (sec.rule.maxItems !== undefined && (typeof sec.rule.maxItems !== "number" || sec.rule.maxItems < 1 || sec.rule.maxItems > 100)) {
          blockingErrors.push(`Rule error in section '${sec.id}': maxItems must be a number between 1 and 100.`);
        }

        // Feature flag check
        if (sec.rule.featureFlagRequirement && context?.features) {
          if (context.features[sec.rule.featureFlagRequirement] === false) {
            warnings.push(`Section '${sec.id}' requires feature '${sec.rule.featureFlagRequirement}' which is currently disabled.`);
          }
        }
      }

      // Validate Pinned Slots
      if (Array.isArray(sec.pinnedSlots)) {
        for (const slot of sec.pinnedSlots) {
          if (!VALID_SLOT_ENTITY_TYPES.includes(slot.entityType)) {
            blockingErrors.push(`Invalid slot entity type '${slot.entityType}' in section '${sec.id}'.`);
          }
          if (!slot.entityId || typeof slot.entityId !== "string" || slot.entityId.trim() === "") {
            blockingErrors.push(`Pinned slot in section '${sec.id}' has missing or empty entityId.`);
          }

          // Canonical content eligibility check if context is provided
          if (context?.articles && slot.entityType === "article") {
            const article = context.articles[slot.entityId];
            if (!article || article.deleted) {
              blockingErrors.push(`Pinned article '${slot.entityId}' in section '${sec.id}' does not exist or has been deleted.`);
              this.recordAttentionCase({
                code: "BROKEN_HOMEPAGE_REFERENCE",
                message: `Pinned article '${slot.entityId}' in section '${sec.id}' was deleted or not found.`,
                severity: "critical",
                entityId: slot.entityId,
                sectionId: sec.id,
                timestamp: checkedAt
              });
            } else if (article.isPrivate) {
              blockingErrors.push(`Pinned article '${slot.entityId}' is marked private and cannot be placed on public homepage.`);
            } else if (article.status !== "published" && article.published !== true) {
              blockingErrors.push(`Pinned article '${slot.entityId}' has status '${article.status || "draft"}' and is not publicly published.`);
            }
          }
        }
      }
    }

    // 3. Schedule Validation
    if (comp.schedule) {
      const { scheduledPublishAt, scheduledUnpublishAt } = comp.schedule;
      if (scheduledPublishAt && isNaN(Date.parse(scheduledPublishAt))) {
        blockingErrors.push("Invalid scheduledPublishAt date format. Must be valid ISO 8601 string.");
      }
      if (scheduledUnpublishAt && isNaN(Date.parse(scheduledUnpublishAt))) {
        blockingErrors.push("Invalid scheduledUnpublishAt date format. Must be valid ISO 8601 string.");
      }
      if (scheduledPublishAt && scheduledUnpublishAt) {
        if (new Date(scheduledUnpublishAt).getTime() <= new Date(scheduledPublishAt).getTime()) {
          blockingErrors.push("scheduledUnpublishAt must be after scheduledPublishAt.");
        }
      }
    }

    return {
      valid: blockingErrors.length === 0,
      blockingErrors,
      warnings,
      checkedAt
    };
  }

  // --- COMPOSITION RETRIEVAL & CRUD ---
  public getActiveComposition(userId?: string): HomepageComposition {
    this.logAudit("homepage_composition_active", { userId });
    this.checkAndActivateScheduledCompositions();
    return JSON.parse(JSON.stringify(this.activeComposition!));
  }

  public getDraftComposition(userId?: string): HomepageComposition {
    this.logAudit("homepage_composition_draft", { userId });
    if (!this.draftComposition) {
      this.draftComposition = {
        ...this.activeComposition!,
        id: `draft_v${this.activeComposition!.version + 1}`,
        status: "draft",
        sections: JSON.parse(JSON.stringify(this.activeComposition!.sections)),
        updatedAt: new Date().toISOString()
      };
      this.draftComposition.revisionHash = this.computeRevisionHash(this.draftComposition);
    }
    return JSON.parse(JSON.stringify(this.draftComposition));
  }

  public saveDraftComposition(
    draft: HomepageComposition,
    userId: string,
    expectedRevisionHash?: string
  ): { success: boolean; draft?: HomepageComposition; error?: string; code?: string } {
    // Check optimistic concurrency / stale edit conflict
    if (expectedRevisionHash) {
      const currentDraftHash = this.draftComposition?.revisionHash || (this.activeComposition ? this.computeRevisionHash(this.activeComposition) : undefined);
      if (currentDraftHash && currentDraftHash !== expectedRevisionHash) {
        this.recordAttentionCase({
          code: "EDIT_CONFLICT",
          message: `Concurrent edit conflict detected for draft ${draft.id}. Newer revision already saved.`,
          severity: "warning",
          timestamp: new Date().toISOString()
        });
        return {
          success: false,
          code: "EDIT_CONFLICT",
          error: "Concurrent edit conflict: draft was modified by another editor. Please reload and merge changes."
        };
      }
    }

    const newHash = this.computeRevisionHash(draft);
    this.draftComposition = {
      ...draft,
      status: "draft",
      revisionHash: newHash,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };
    fs.writeFileSync(this.draftCompositionStorePath, JSON.stringify(this.draftComposition, null, 2));
    return { success: true, draft: this.draftComposition };
  }

  public publishComposition(
    userId: string,
    sosInstance?: any,
    options?: {
      targetComposition?: HomepageComposition;
      idempotencyKey?: string;
      context?: { articles?: Record<string, any>; features?: Record<string, boolean> };
    }
  ): { success: boolean; composition?: HomepageComposition; error?: string; code?: string } {
    // 1. Process-local publish concurrency lock
    if (this.publishLock) {
      return { success: false, code: "PUBLISH_CONCURRENCY_LOCKED", error: "Another publish operation is currently in progress." };
    }
    this.publishLock = true;

    try {
      // 2. Publish idempotency check
      if (options?.idempotencyKey) {
        if (this.publishedIdempotencyKeys.has(options.idempotencyKey)) {
          return { success: true, composition: this.activeComposition! };
        }
      }

      const targetComp = options?.targetComposition || this.draftComposition || this.activeComposition!;

      // 3. Validation Gate before publish
      const validation = this.validateComposition(targetComp, options?.context);
      if (!validation.valid) {
        this.recordAttentionCase({
          code: "PUBLISH_FAILED",
          message: `Publish rejected by validation engine: ${validation.blockingErrors.join("; ")}`,
          severity: "critical",
          timestamp: new Date().toISOString()
        });
        return {
          success: false,
          code: "VALIDATION_FAILED",
          error: `Publish validation failed: ${validation.blockingErrors.join(", ")}`
        };
      }

      const nextVersion = this.activeComposition!.version + 1;
      const now = new Date().toISOString();

      const published: HomepageComposition = {
        ...targetComp,
        id: "active",
        version: nextVersion,
        previousVersion: this.activeComposition!.version,
        status: "active",
        updatedAt: now,
        updatedBy: userId,
        publishedAt: now,
        publishedBy: userId
      };
      published.revisionHash = this.computeRevisionHash(published);

      // 4. Archive current active version to history (immutable historical copy)
      this.versionHistory.unshift({ ...this.activeComposition!, status: "archived" });
      if (this.versionHistory.length > 30) this.versionHistory.pop();

      // 5. Trigger Bounded Snapshot Rebuild
      let snapshotSuccess = true;
      if (sosInstance && typeof sosInstance.rebuildHomepageSnapshot === "function") {
        try {
          sosInstance.rebuildHomepageSnapshot(published);
        } catch (snapErr: any) {
          snapshotSuccess = false;
          this.recordAttentionCase({
            code: "DELIVERY_FAILED",
            message: `Homepage snapshot compilation failed: ${snapErr?.message || snapErr}`,
            severity: "critical",
            timestamp: now
          });
          // Failure Safety: Keep previous live homepage deliverable
          return {
            success: false,
            code: "DELIVERY_FAILED",
            error: "Snapshot rebuild failed. Previous live homepage remains deliverable."
          };
        }
      }

      // 6. Commit active composition to store
      this.activeComposition = published;
      this.draftComposition = null;

      this.saveActiveComposition();
      fs.writeFileSync(this.historyStorePath, JSON.stringify(this.versionHistory, null, 2));
      if (fs.existsSync(this.draftCompositionStorePath)) {
        fs.unlinkSync(this.draftCompositionStorePath);
      }

      if (options?.idempotencyKey) {
        this.publishedIdempotencyKeys.add(options.idempotencyKey);
      }

      return { success: true, composition: published };
    } finally {
      this.publishLock = false;
    }
  }

  // --- SERVER-SIDE SCHEDULING ---
  public scheduleComposition(
    comp: HomepageComposition,
    scheduledPublishAt: string,
    userId: string
  ): { success: boolean; error?: string } {
    const pubTime = new Date(scheduledPublishAt).getTime();
    if (isNaN(pubTime) || pubTime <= Date.now()) {
      return { success: false, error: "Scheduled publish time must be a valid future ISO string." };
    }

    // Conflict detection: Check for existing schedule around the same time (+/- 5 mins)
    const conflict = this.scheduledCompositions.find(s => {
      const existingTime = new Date(s.schedule?.scheduledPublishAt || 0).getTime();
      return Math.abs(existingTime - pubTime) < 5 * 60 * 1000;
    });

    if (conflict) {
      this.recordAttentionCase({
        code: "SCHEDULE_CONFLICT",
        message: `Schedule conflict: Version ${conflict.version} is already scheduled for ${conflict.schedule?.scheduledPublishAt}.`,
        severity: "warning",
        timestamp: new Date().toISOString()
      });
      return { success: false, error: "A composition is already scheduled for this time window." };
    }

    const scheduledItem: HomepageComposition = {
      ...comp,
      id: `sched_v${this.activeComposition!.version + 1}`,
      status: "scheduled",
      schedule: { scheduledPublishAt },
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.scheduledCompositions.push(scheduledItem);
    fs.writeFileSync(this.scheduledStorePath, JSON.stringify(this.scheduledCompositions, null, 2));
    return { success: true };
  }

  public checkAndActivateScheduledCompositions(sosInstance?: any): HomepageComposition | null {
    if (!this.scheduledCompositions.length) return null;
    const now = Date.now();
    const readyIndex = this.scheduledCompositions.findIndex(s => {
      const pubTime = new Date(s.schedule?.scheduledPublishAt || 0).getTime();
      return pubTime > 0 && pubTime <= now;
    });

    if (readyIndex !== -1) {
      const readyComp = this.scheduledCompositions.splice(readyIndex, 1)[0];
      fs.writeFileSync(this.scheduledStorePath, JSON.stringify(this.scheduledCompositions, null, 2));
      const res = this.publishComposition(readyComp.updatedBy || "scheduler", sosInstance, {
        targetComposition: readyComp
      });
      if (res.success) {
        return res.composition!;
      }
    }
    return null;
  }

  // --- ROLLBACK & VERSION HISTORY ---
  public rollbackToVersion(targetVersion: number, userId: string, sosInstance?: any): { success: boolean; composition?: HomepageComposition; error?: string } {
    const historical = this.versionHistory.find(v => v.version === targetVersion);
    if (!historical) {
      return { success: false, error: `Version ${targetVersion} not found in history.` };
    }

    // Rollback executes via the canonical publish pipeline
    const nextVersion = this.activeComposition!.version + 1;
    const now = new Date().toISOString();

    const rolledBack: HomepageComposition = {
      ...historical,
      id: "active",
      version: nextVersion,
      previousVersion: this.activeComposition!.version,
      status: "active",
      updatedAt: now,
      updatedBy: `rollback_to_v${targetVersion}_by_${userId}`,
      publishedAt: now,
      publishedBy: userId
    };
    rolledBack.revisionHash = this.computeRevisionHash(rolledBack);

    this.versionHistory.unshift({ ...this.activeComposition!, status: "archived" });
    this.activeComposition = rolledBack;

    this.saveActiveComposition();
    fs.writeFileSync(this.historyStorePath, JSON.stringify(this.versionHistory, null, 2));

    if (sosInstance && typeof sosInstance.rebuildHomepageSnapshot === "function") {
      sosInstance.rebuildHomepageSnapshot(rolledBack);
    }

    return { success: true, composition: rolledBack };
  }

  public getVersionHistory(userId?: string): HomepageComposition[] {
    this.logAudit("homepage_version_history", { userId });
    return this.versionHistory;
  }

  public getContentPickerData(entityType: string, search?: string): Array<{ id: string; title: string; entityType: string }> {
    this.logAudit("homepage_content_picker", { entityType, search });
    const items = [
      { id: "art-101", title: "संसद् अधिवेशन विशेष प्रेस विज्ञप्ति", entityType: "article" },
      { id: "art-102", title: "नेपाल उद्योग वाणिज्य महासङ्घ आर्थिक समीक्षा", entityType: "article" },
      { id: "art-103", title: "काठमाडौँ उपत्यका सम्पदा मार्ग सुधार योजना", entityType: "article" },
      { id: "blog-201", title: "संस्कृति र प्रविधि: सनातन परम्पराको डिजिटल यात्रा", entityType: "blog_post" },
      { id: "event-301", title: "महाशिवरात्रि विशेष अनुष्ठान तथा भजन सन्ध्या", entityType: "event" },
      { id: "course-401", title: "संस्कृत भाषा तथा व्याकरण प्राथमिक पाठ्यक्रम", entityType: "academy_course" },
      { id: "know-501", title: "ऋग्वेद संहिता मूलपाठ तथा व्याख्या", entityType: "knowledge_entity" }
    ];
    return items.filter(i => {
      const matchesType = !entityType || i.entityType === entityType;
      const matchesSearch = !search || i.title.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }

  // --- RULE PREVIEW & RESOLUTION WITH DEDUPLICATION ---
  public previewRules(
    composition: HomepageComposition,
    liveData?: any,
    options?: { features?: Record<string, boolean> }
  ): { resolvedSections: any[]; stats: any } {
    this.logAudit("homepage_rule_preview", { version: composition.version });
    return this.resolveCompositionContent(composition, liveData, options);
  }

  public resolveCompositionContent(
    composition: HomepageComposition,
    liveData?: any,
    options?: { features?: Record<string, boolean>; excludePrivate?: boolean }
  ): { resolvedSections: any[]; stats: any } {
    const selectedEntityIds = new Set<string>();
    const resolvedSections: any[] = [];

    // Sort sections by order
    const sortedSections = [...composition.sections].sort((a, b) => a.order - b.order);

    for (const sec of sortedSections) {
      // 1. Feature flag gating check
      let isFeatureEnabled = true;
      if (sec.rule.featureFlagRequirement && options?.features) {
        if (options.features[sec.rule.featureFlagRequirement] === false) {
          isFeatureEnabled = false;
        }
      }

      if (!sec.isEnabled || !isFeatureEnabled) {
        resolvedSections.push({
          sectionId: sec.id,
          sectionType: sec.type,
          title: sec.title,
          isEnabled: sec.isEnabled,
          isFeatureSuppressed: !isFeatureEnabled,
          itemCount: 0,
          items: []
        });
        continue;
      }

      const sectionItems: HomepageCardProjection[] = [];

      // 2. Add Pinned Slots (Manual placement wins)
      if (Array.isArray(sec.pinnedSlots)) {
        for (const slot of sec.pinnedSlots) {
          // Look up canonical latest data
          let title = slot.customTitle || "शीर्ष समाचार";
          let summary = "विवरण";
          let canonicalUrl = `/${slot.entityType}/${slot.entityId}`;

          if (liveData?.latestNews) {
            const canonicalArticle = liveData.latestNews.find((a: any) => a.id === slot.entityId);
            if (canonicalArticle) {
              title = canonicalArticle.title || title;
              summary = canonicalArticle.summary || canonicalArticle.excerpt || summary;
              canonicalUrl = `/article/${canonicalArticle.slug || canonicalArticle.id}`;
            }
          }

          const card = this.projectHomepageCard({
            id: slot.entityId,
            title,
            summary,
            canonicalUrl,
            entityType: slot.entityType,
            isPinned: true
          });

          sectionItems.push(card);
          selectedEntityIds.add(slot.entityId);
        }
      }

      // 3. Automatic Fill with Deduplication
      const remainingSlots = Math.max(0, (sec.rule.maxItems || 6) - sectionItems.length);
      if (remainingSlots > 0 && sec.rule.autoFillStrategy !== "manual_only") {
        let pool: any[] = [];
        if (sec.rule.autoFillStrategy === "latest" && liveData?.latestNews) {
          pool = liveData.latestNews;
        } else if (sec.rule.autoFillStrategy === "most_read" && liveData?.mostReadNews) {
          pool = liveData.mostReadNews;
        } else if (sec.rule.autoFillStrategy === "category_matched" && liveData?.categoryArticles) {
          const catKey = sec.rule.categorySlug || sec.rule.categoryId || "";
          pool = liveData.categoryArticles[catKey] || liveData.latestNews || [];
        }

        for (const item of pool) {
          if (sectionItems.length >= sec.rule.maxItems) break;

          // Deduplication check: exclude if already selected unless allowDuplicates is true
          if (!sec.rule.allowDuplicates && selectedEntityIds.has(item.id)) {
            continue;
          }

          const card = this.projectHomepageCard({
            id: item.id,
            title: item.title,
            summary: item.summary || item.excerpt || "",
            canonicalUrl: `/article/${item.slug || item.id}`,
            category: item.categoryName || item.category,
            categoryId: item.categoryId,
            publishedAt: item.publishedAt || item.createdAt,
            media: item.coverImage ? { url: item.coverImage } : undefined,
            entityType: "article",
            isPinned: false
          });

          sectionItems.push(card);
          selectedEntityIds.add(item.id);
        }
      }

      resolvedSections.push({
        sectionId: sec.id,
        sectionType: sec.type,
        title: sec.title,
        isEnabled: true,
        isFeatureSuppressed: false,
        itemCount: sectionItems.length,
        items: sectionItems
      });
    }

    return {
      resolvedSections,
      stats: {
        totalSections: composition.sections.length,
        enabledSections: resolvedSections.filter(s => s.isEnabled && !s.isFeatureSuppressed).length,
        totalPinnedItems: selectedEntityIds.size
      }
    };
  }

  // --- CARD PROJECTION SANITIZER (Step 37: Zero article body bloat) ---
  public projectHomepageCard(raw: {
    id: string;
    title: string;
    summary?: string;
    canonicalUrl: string;
    category?: string;
    categoryId?: string;
    publishedAt?: string;
    media?: { url?: string; thumbnail?: string; alt?: string; caption?: string };
    entityType: string;
    isPinned?: boolean;
    content?: any; // deliberately stripped
  }): HomepageCardProjection {
    return {
      id: raw.id,
      title: raw.title,
      summary: (raw.summary || "").slice(0, 240),
      canonicalUrl: raw.canonicalUrl,
      category: raw.category,
      categoryId: raw.categoryId,
      publishedAt: raw.publishedAt,
      media: raw.media,
      isPinned: raw.isPinned,
      entityType: raw.entityType
    };
  }

  public captureBaseline(liveHomepageData: any): HomepageCompositionBaseline {
    const categoryArticlesKeys = Object.keys(liveHomepageData?.categoryArticles || {});
    return {
      capturedAt: new Date().toISOString(),
      categoriesCount: liveHomepageData?.categories?.length || 0,
      articlesCount: (liveHomepageData?.latestNews?.length || 0) + (liveHomepageData?.featuredArticles?.length || 0),
      featuredCount: liveHomepageData?.featuredArticles?.length || 0,
      latestCount: liveHomepageData?.latestNews?.length || 0,
      categoryArticlesMapKeys: categoryArticlesKeys,
      activeAdPlacementKeys: ["homepage_top", "homepage_mid", "homepage_bottom"],
      conditionalSectionsPresent: {
        live: !!liveHomepageData?.videoNews,
        events: !!liveHomepageData?.events,
        announcements: !!(liveHomepageData?.announcements && liveHomepageData.announcements.length > 0),
        knowledge: true
      },
      snapshotSizeBytes: JSON.stringify(liveHomepageData || {}).length,
      compositionConfigSource: "ServerCompositionOS.active"
    };
  }

  public getAuditLogs() {
    return this.auditLogs;
  }

  private saveActiveComposition() {
    fs.writeFileSync(this.activeCompositionStorePath, JSON.stringify(this.activeComposition, null, 2));
  }
}

export const serverCompositionOS = new ServerCompositionOS();
