import crypto from "crypto";
import { serverFeatureControlService } from "./featureControlService";

/**
 * SANATANMARGA 5.0 — SEO & DISCOVERY OS
 * Core Technical Foundation for Canonical URLs, Server-Visible Metadata,
 * Structured Data (JSON-LD), Multilingual SEO, Sitemap OS, Indexability Policy,
 * Internal Linking, and Snapshot SEO Artifacts.
 */

export const CANONICAL_DOMAIN = "https://sanatanmarga.com";
export const CANONICAL_HOST = CANONICAL_DOMAIN;
export const NEWS_SITEMAP_FRESHNESS_HOURS = 48;

export type SEOEntityType =
  | "ARTICLE"
  | "NEWS_ARTICLE"
  | "BLOG_POST"
  | "AUTHOR"
  | "TOPIC"
  | "KNOWLEDGE_ENTITY"
  | "PLACE"
  | "PERSON"
  | "ORGANIZATION"
  | "EVENT"
  | "COURSE"
  | "VIDEO"
  | "COMMUNITY_POST"
  | "PRODUCT"
  | "CATEGORY"
  | "DISTRICT"
  | "STATIC_PAGE";

export type PublicationStatus = "draft" | "review" | "scheduled" | "published" | "archived" | "deleted";
export type TranslationProvenance = "HUMAN_AUTHORED" | "HUMAN_TRANSLATED" | "AI_ASSISTED" | "AI_TRANSLATED" | "REVIEWED" | "PUBLISHED";
export type QualityGateSeverity = "BLOCKING" | "WARNING" | "RECOMMENDATION";

export interface SEOEntity {
  entityType: SEOEntityType;
  entityId: string;
  slug: string;
  canonicalUrl: string;
  title: string;
  seoTitle?: string;
  description: string;
  seoDescription?: string;
  language: "ne" | "en" | "hi";
  alternateLanguages?: Array<{ lang: "ne" | "en" | "hi"; url: string; provenance?: TranslationProvenance }>;
  featuredImage?: string;
  socialImage?: string;
  authorId?: string;
  authorName?: string;
  authorBio?: string;
  publisherName: string;
  publisherLogo: string;
  publishedAt?: string;
  modifiedAt?: string;
  status: PublicationStatus;
  isPrivate?: boolean;
  featureKey?: string;
  section?: string;
  topics?: string[];
  inboundLinkCount?: number;
  outboundLinks?: string[];
  translationProvenance?: TranslationProvenance;
  customJsonLd?: Record<string, any>;
  eventData?: {
    startDate: string;
    endDate?: string;
    eventStatus?: "EventScheduled" | "EventCancelled" | "EventPostponed" | "EventRescheduled";
    locationName?: string;
    locationAddress?: string;
    offers?: Array<{ price: number | string; currency: string; availabilityUrl?: string }>;
  };
  videoData?: {
    uploadDate?: string;
    durationIso?: string; // e.g. PT5M30S only if known
    embedUrl?: string;
    contentUrl?: string;
    thumbnailUrl?: string;
  };
  courseData?: {
    courseCode?: string;
    difficulty?: string;
    instructorName?: string;
  };
  communityData?: {
    commentCount?: number;
    upvotes?: number;
    isQa?: boolean;
    acceptedAnswerText?: string;
  };
}

export interface SEOQualityIssue {
  severity: QualityGateSeverity;
  code: string;
  message: string;
  field?: string;
}

export interface SEORedirectEntry {
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302 | 307 | 308;
  reason: string;
  createdAt: string;
}

export interface SEOHealthTelemetry {
  totalEntities: number;
  indexableCount: number;
  noindexCount: number;
  canonicalConflictsCount: number;
  orphanPagesCount: number;
  sitemapUrlCount: number;
  redirectsCount: number;
  qualityIssuesCount: {
    blocking: number;
    warning: number;
    recommendation: number;
  };
  lastEvaluatedAt: string;
}

// Future Content Decay Status Type (Phase 2F Foundation)
export type ContentDecayStatus = "FRESH" | "REVIEW_RECOMMENDED" | "STALE" | "ARCHIVAL";

// Future Search Performance Interface (Phase 2F Foundation)
export interface SearchPerformanceMetrics {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  averagePosition?: number;
  topQueries?: Array<{ query: string; clicks: number; impressions: number }>;
  lastSyncedAt?: string;
  isAvailable: boolean;
}

export class SEODiscoveryOS {
  private static instance: SEODiscoveryOS;
  private redirectsMap: Map<string, SEORedirectEntry> = new Map();
  private entityRegistry: Map<string, SEOEntity> = new Map();
  private canonicalUrlIndex: Map<string, string[]> = new Map(); // canonicalUrl -> entityIds
  private internalGraph: Map<string, Set<string>> = new Map(); // entityId -> Set of target entityIds/URLs
  private inboundCountMap: Map<string, number> = new Map();
  private cachedSitemaps: Map<string, { xml: string; generatedAt: string; hash: string }> = new Map();

  private constructor() {
    this.initDefaultRedirects();
  }

  public static getInstance(): SEODiscoveryOS {
    if (!SEODiscoveryOS.instance) {
      SEODiscoveryOS.instance = new SEODiscoveryOS();
    }
    return SEODiscoveryOS.instance;
  }

  // --- 1. CANONICAL URL ENGINE ---

  /**
   * Builds normalized canonical URL strictly adhering to production domain rules.
   * Strips tracking params, query bloat, hash fragments, and trailing slashes.
   */
  public buildCanonicalUrl(pathname: string, queryParams?: Record<string, string | number>): string {
    let cleanPath = (pathname || "/").trim();
    if (!cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }

    // Strip hash fragments and query strings attached to path
    cleanPath = cleanPath.split("#")[0].split("?")[0];

    // Lowercase system static paths (preserve case-sensitive IDs if alphanumeric)
    if (
      cleanPath === "/news" ||
      cleanPath === "/latest" ||
      cleanPath === "/trending" ||
      cleanPath === "/blog" ||
      cleanPath === "/events" ||
      cleanPath === "/sgis" ||
      cleanPath === "/knowledge" ||
      cleanPath === "/nepal-hub" ||
      cleanPath === "/authors" ||
      cleanPath === "/about" ||
      cleanPath === "/editorial-policy" ||
      cleanPath === "/transparency" ||
      cleanPath === "/privacy" ||
      cleanPath === "/terms"
    ) {
      cleanPath = cleanPath.toLowerCase();
    }

    // Strip trailing slashes except for root
    if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Whitelist only legitimate pagination parameter (page > 1)
    let queryString = "";
    if (queryParams) {
      const pageVal = Number(queryParams.page);
      if (!isNaN(pageVal) && pageVal > 1) {
        queryString = `?page=${pageVal}`;
      }
    }

    return `${CANONICAL_DOMAIN}${cleanPath}${queryString}`;
  }

  // --- 2. REDIRECT REGISTRY & CYCLE DETECTION ---

  private initDefaultRedirects(): void {
    // Known historical legacy paths migrated cleanly to canonical routes
    this.addRedirect("/news/latest", "/latest", 301, "Legacy latest route alias");
    this.addRedirect("/articles", "/news", 301, "Plural articles path alias");
    this.addRedirect("/blogs", "/blog", 301, "Plural blog path alias");
    this.addRedirect("/saraswati-graph", "/knowledge", 301, "Legacy knowledge graph rebranding");
    this.addRedirect("/panchang", "/nepal-hub", 301, "Panchang merged into Nepal Hub");
    this.addRedirect("/rashifal", "/nepal-hub", 301, "Rashifal integrated into Nepal Hub");
  }

  public addRedirect(fromPath: string, toPath: string, statusCode: 301 | 302 | 307 | 308 = 301, reason = "Route Migration"): boolean {
    const cleanFrom = this.normalizePath(fromPath);
    const cleanTo = this.normalizePath(toPath);

    if (cleanFrom === cleanTo) {
      return false; // Self-redirect blocked
    }

    // Cycle check: verify cleanTo doesn't eventually point back to cleanFrom
    let current: string | undefined = cleanTo;
    const visited = new Set<string>([cleanFrom]);
    while (current) {
      if (visited.has(current)) {
        console.warn(`[SEO Redirect Engine] Cycle detected for ${fromPath} -> ${toPath}. Rejecting redirect.`);
        return false;
      }
      visited.add(current);
      const nextEntry = this.redirectsMap.get(current);
      current = nextEntry ? nextEntry.toPath : undefined;
    }

    // Chain flattening: if cleanTo itself redirects to finalTarget, flatten directly to finalTarget
    const finalTarget = this.resolveRedirectTarget(cleanTo) || cleanTo;

    this.redirectsMap.set(cleanFrom, {
      fromPath: cleanFrom,
      toPath: finalTarget,
      statusCode,
      reason,
      createdAt: new Date().toISOString()
    });

    return true;
  }

  public resolveRedirectTarget(pathname: string): string | null {
    const clean = this.normalizePath(pathname);
    const entry = this.redirectsMap.get(clean);
    if (!entry) return null;

    // Direct resolution
    return entry.toPath;
  }

  public getRedirects(): SEORedirectEntry[] {
    return Array.from(this.redirectsMap.values());
  }

  private normalizePath(p: string): string {
    let clean = (p || "/").trim().split("?")[0].split("#")[0];
    if (!clean.startsWith("/")) clean = "/" + clean;
    if (clean.length > 1 && clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  }

  // --- 3. INDEXABILITY & ROBOTS ENGINE ---

  /**
   * Centralized indexability evaluator considering status, Feature Control,
   * language provenance, and route type.
   */
  public evaluateIndexability(
    entityOrPath: string | SEOEntity,
    options?: {
      status?: PublicationStatus;
      isPrivate?: boolean;
      translationProvenance?: TranslationProvenance;
      featureKey?: string;
    }
  ): { isIndexable: boolean; robotsDirective: string; reason: string } {
    let pathname = typeof entityOrPath === "string" ? entityOrPath : entityOrPath.canonicalUrl.replace(CANONICAL_DOMAIN, "");
    const cleanPath = this.normalizePath(pathname);

    // 1. Check strict private/internal/admin route patterns
    const noindexPatterns = [
      /^\/admin(\/.*)?$/,
      /^\/editor(\/.*)?$/,
      /^\/dashboard(\/.*)?$/,
      /^\/login$/,
      /^\/signup$/,
      /^\/account(\/.*)?$/,
      /^\/settings(\/.*)?$/,
      /^\/draft(\/.*)?$/,
      /^\/preview(\/.*)?$/,
      /^\/review(\/.*)?$/,
      /^\/search(\/.*)?$/,
      /^\/global-search(\/.*)?$/,
      /^\/my-sanatan(\/.*)?$/,
      /^\/notifications(\/.*)?$/,
      /^\/offline-queue(\/.*)?$/,
      /^\/diagnostics(\/.*)?$/,
      /^\/test(\/.*)?$/,
      /^\/smoke-test(\/.*)?$/,
      /^\/api(\/.*)?$/
    ];

    for (const pattern of noindexPatterns) {
      if (pattern.test(cleanPath)) {
        return {
          isIndexable: false,
          robotsDirective: "noindex, nofollow",
          reason: `Path matches internal/non-public route pattern: ${cleanPath}`
        };
      }
    }

    // 2. Query / Dynamic Filter explosion prevention (e.g. faceted search, complex tag queries)
    if (typeof entityOrPath === "string" && (entityOrPath.includes("filter=") || entityOrPath.includes("sort=") || entityOrPath.includes("query="))) {
      return {
        isIndexable: false,
        robotsDirective: "noindex, follow",
        reason: "Faceted filter or sorting parameter URL prevented from index explosion"
      };
    }

    // 3. Entity-level evaluation
    if (typeof entityOrPath !== "string") {
      const entity = entityOrPath;

      // Status check: non-published content must never be indexed
      if (entity.status && entity.status !== "published") {
        return {
          isIndexable: false,
          robotsDirective: "noindex, nofollow",
          reason: `Content publication status is '${entity.status}' (only 'published' is indexable)`
        };
      }

      // Private content check
      if (entity.isPrivate) {
        return {
          isIndexable: false,
          robotsDirective: "noindex, nofollow",
          reason: "Entity marked private/internal"
        };
      }

      // Feature Control Governance check
      if (entity.featureKey) {
        const featureEval = serverFeatureControlService.evaluateFeature(entity.featureKey);
        if (!featureEval.enabled || !featureEval.seoAllowed) {
          return {
            isIndexable: false,
            robotsDirective: "noindex, nofollow",
            reason: `Feature Control module '${entity.featureKey}' is disabled or SEO disallowed (${featureEval.reason})`
          };
        }
      }

      // Translation provenance check: unreviewed AI translations must NOT be indexed
      if (entity.translationProvenance === "AI_TRANSLATED") {
        return {
          isIndexable: false,
          robotsDirective: "noindex, follow",
          reason: "Machine-translated content pending editorial review"
        };
      }

      // Quality gate blocking issues
      const qualityIssues = this.evaluateQualityGate(entity);
      const hasBlocker = qualityIssues.some(q => q.severity === "BLOCKING");
      if (hasBlocker) {
        return {
          isIndexable: false,
          robotsDirective: "noindex, nofollow",
          reason: `Blocking SEO quality gate failure: ${qualityIssues.find(q => q.severity === "BLOCKING")?.message}`
        };
      }
    }

    // 4. Options override
    if (options?.status && options.status !== "published") {
      return {
        isIndexable: false,
        robotsDirective: "noindex, nofollow",
        reason: `Status '${options.status}' is not published`
      };
    }

    if (options?.featureKey) {
      const fEval = serverFeatureControlService.evaluateFeature(options.featureKey);
      if (!fEval.enabled || !fEval.seoAllowed) {
        return {
          isIndexable: false,
          robotsDirective: "noindex, nofollow",
          reason: `Feature Control key '${options.featureKey}' is not SEO-enabled`
        };
      }
    }

    if (options?.translationProvenance === "AI_TRANSLATED") {
      return {
        isIndexable: false,
        robotsDirective: "noindex, follow",
        reason: "Unreviewed AI translation is noindex"
      };
    }

    return {
      isIndexable: true,
      robotsDirective: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      reason: "Canonical public published content"
    };
  }

  // --- 4. SEO QUALITY GATES ---

  public evaluateQualityGate(entity: SEOEntity): SEOQualityIssue[] {
    const issues: SEOQualityIssue[] = [];

    // BLOCKING CHECKS
    if (!entity.canonicalUrl || !entity.canonicalUrl.startsWith("https://")) {
      issues.push({
        severity: "BLOCKING",
        code: "INVALID_CANONICAL",
        message: "Canonical URL is missing or does not use HTTPS scheme.",
        field: "canonicalUrl"
      });
    }

    if (!entity.title || entity.title.trim() === "") {
      issues.push({
        severity: "BLOCKING",
        code: "MISSING_TITLE",
        message: "Title is empty or missing.",
        field: "title"
      });
    }

    if (entity.isPrivate && entity.status === "published") {
      issues.push({
        severity: "BLOCKING",
        code: "PRIVATE_PUBLISHED_COLLISION",
        message: "Entity is marked private but has published status.",
        field: "isPrivate"
      });
    }

    // WARNING CHECKS
    if (!entity.description || entity.description.trim().length < 30) {
      issues.push({
        severity: "WARNING",
        code: "SHORT_DESCRIPTION",
        message: "Description is under 30 characters. Meta snippets may be suboptimal.",
        field: "description"
      });
    }

    if (!entity.featuredImage && !entity.socialImage) {
      issues.push({
        severity: "WARNING",
        code: "MISSING_HERO_IMAGE",
        message: "No featured or social share image provided; default logo fallback will be used.",
        field: "featuredImage"
      });
    }

    if (!entity.authorName || entity.authorName.trim() === "") {
      issues.push({
        severity: "WARNING",
        code: "INCOMPLETE_AUTHOR",
        message: "Author name is missing; editorial desk fallback assigned.",
        field: "authorName"
      });
    }

    // RECOMMENDATIONS
    if (entity.title && entity.title.length > 70) {
      issues.push({
        severity: "RECOMMENDATION",
        code: "LONG_TITLE",
        message: "Title exceeds 70 characters and may be truncated on Google desktop SERP.",
        field: "title"
      });
    }

    if (!entity.outboundLinks || entity.outboundLinks.length === 0) {
      issues.push({
        severity: "RECOMMENDATION",
        code: "NO_INTERNAL_LINKS",
        message: "Article has no outbound internal knowledge or topic links.",
        field: "outboundLinks"
      });
    }

    return issues;
  }

  // --- 5. STRUCTURED DATA OS (JSON-LD) ---

  public generateJsonLdGraph(entity: SEOEntity): Array<Record<string, any>> {
    const graph: Array<Record<string, any>> = [];

    // 1. Canonical Publisher / Organization Entity (Always present at root)
    const publisherSchema = this.generateOrganizationSchema();
    graph.push(publisherSchema);

    // 2. WebSite with SearchAction
    graph.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${CANONICAL_DOMAIN}/#website`,
      url: CANONICAL_DOMAIN,
      name: "SanatanMarga",
      alternateName: "सनातन मार्ग",
      description: "Nepal's leading digital platform for news, Vedic philosophy, Saraswati Knowledge Graph, and Himalayan civilization.",
      publisher: { "@id": `${CANONICAL_DOMAIN}/#organization` },
      inLanguage: ["ne-NP", "en-US", "hi-IN"]
    });

    // 3. Type-Specific Schemas
    switch (entity.entityType) {
      case "NEWS_ARTICLE":
      case "ARTICLE": {
        const articleSchema: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": entity.entityType === "NEWS_ARTICLE" ? "NewsArticle" : "Article",
          "@id": `${entity.canonicalUrl}#article`,
          isPartOf: { "@id": `${CANONICAL_DOMAIN}/#website` },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": entity.canonicalUrl
          },
          headline: entity.title,
          description: entity.description,
          image: [entity.featuredImage || entity.socialImage || `${CANONICAL_DOMAIN}/logo.png`],
          datePublished: entity.publishedAt || new Date().toISOString(),
          dateModified: entity.modifiedAt || entity.publishedAt || new Date().toISOString(),
          publisher: { "@id": `${CANONICAL_DOMAIN}/#organization` },
          inLanguage: entity.language === "en" ? "en-US" : entity.language === "hi" ? "hi-IN" : "ne-NP"
        };

        // Canonical Author: Person entity only if genuine author exists
        if (entity.authorName && entity.authorName !== "SanatanMarga System" && entity.authorName !== "System") {
          articleSchema.author = {
            "@type": "Person",
            name: entity.authorName,
            url: entity.authorId ? `${CANONICAL_DOMAIN}/authors/${entity.authorId}` : `${CANONICAL_DOMAIN}/authors`
          };
        } else {
          articleSchema.author = { "@id": `${CANONICAL_DOMAIN}/#organization` };
        }

        if (entity.section) {
          articleSchema.articleSection = entity.section;
        }

        graph.push(articleSchema);
        break;
      }

      case "BLOG_POST": {
        const blogSchema: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${entity.canonicalUrl}#blogpost`,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": entity.canonicalUrl
          },
          headline: entity.title,
          description: entity.description,
          image: [entity.featuredImage || `${CANONICAL_DOMAIN}/logo.png`],
          datePublished: entity.publishedAt || new Date().toISOString(),
          dateModified: entity.modifiedAt || entity.publishedAt || new Date().toISOString(),
          author: {
            "@type": "Person",
            name: entity.authorName || "SanatanMarga Editorial Desk",
            url: entity.authorId ? `${CANONICAL_DOMAIN}/authors/${entity.authorId}` : `${CANONICAL_DOMAIN}/authors`
          },
          publisher: { "@id": `${CANONICAL_DOMAIN}/#organization` }
        };
        graph.push(blogSchema);
        break;
      }

      case "AUTHOR":
      case "PERSON": {
        graph.push({
          "@context": "https://schema.org",
          "@type": "Person",
          "@id": `${entity.canonicalUrl}#person`,
          name: entity.title || entity.authorName,
          description: entity.description || entity.authorBio,
          url: entity.canonicalUrl,
          image: entity.featuredImage,
          worksFor: { "@id": `${CANONICAL_DOMAIN}/#organization` }
        });
        break;
      }

      case "EVENT": {
        const eventObj: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": "Event",
          "@id": `${entity.canonicalUrl}#event`,
          name: entity.title,
          description: entity.description,
          startDate: entity.eventData?.startDate || entity.publishedAt || new Date().toISOString(),
          eventStatus: entity.eventData?.eventStatus ? `https://schema.org/${entity.eventData.eventStatus}` : "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location: {
            "@type": "Place",
            name: entity.eventData?.locationName || "Kathmandu, Nepal",
            address: {
              "@type": "PostalAddress",
              addressLocality: entity.eventData?.locationAddress || "Kathmandu",
              addressCountry: "NP"
            }
          },
          image: [entity.featuredImage || `${CANONICAL_DOMAIN}/logo.png`],
          organizer: { "@id": `${CANONICAL_DOMAIN}/#organization` }
        };

        if (entity.eventData?.endDate) {
          eventObj.endDate = entity.eventData.endDate;
        }

        // Only include offers if genuine offer data exists (no fabricated prices)
        if (entity.eventData?.offers && entity.eventData.offers.length > 0) {
          eventObj.offers = entity.eventData.offers.map(o => ({
            "@type": "Offer",
            price: o.price,
            priceCurrency: o.currency,
            url: o.availabilityUrl || entity.canonicalUrl
          }));
        }

        graph.push(eventObj);
        break;
      }

      case "VIDEO": {
        const vidObj: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "@id": `${entity.canonicalUrl}#video`,
          name: entity.title,
          description: entity.description,
          thumbnailUrl: [entity.videoData?.thumbnailUrl || entity.featuredImage || `${CANONICAL_DOMAIN}/logo.png`],
          uploadDate: entity.videoData?.uploadDate || entity.publishedAt || new Date().toISOString()
        };

        // Omits unknown duration rather than inventing it
        if (entity.videoData?.durationIso) {
          vidObj.duration = entity.videoData.durationIso;
        }
        if (entity.videoData?.embedUrl) {
          vidObj.embedUrl = entity.videoData.embedUrl;
        }
        if (entity.videoData?.contentUrl) {
          vidObj.contentUrl = entity.videoData.contentUrl;
        }

        graph.push(vidObj);
        break;
      }

      case "COMMUNITY_POST": {
        if (entity.communityData?.isQa && entity.communityData.acceptedAnswerText) {
          graph.push({
            "@context": "https://schema.org",
            "@type": "QAPage",
            "@id": `${entity.canonicalUrl}#qa`,
            mainEntity: {
              "@type": "Question",
              name: entity.title,
              text: entity.description,
              answerCount: entity.communityData.commentCount || 1,
              acceptedAnswer: {
                "@type": "Answer",
                text: entity.communityData.acceptedAnswerText
              }
            }
          });
        } else {
          graph.push({
            "@context": "https://schema.org",
            "@type": "DiscussionForumPosting",
            "@id": `${entity.canonicalUrl}#discussion`,
            headline: entity.title,
            articleBody: entity.description,
            interactionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/CommentAction",
              userInteractionCount: entity.communityData?.commentCount || 0
            }
          });
        }
        break;
      }

      case "COURSE": {
        graph.push({
          "@context": "https://schema.org",
          "@type": "Course",
          "@id": `${entity.canonicalUrl}#course`,
          name: entity.title,
          description: entity.description,
          provider: { "@id": `${CANONICAL_DOMAIN}/#organization` }
        });
        break;
      }

      case "KNOWLEDGE_ENTITY":
      case "TOPIC": {
        graph.push({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": `${entity.canonicalUrl}#about`,
          name: entity.title,
          description: entity.description,
          mainEntity: {
            "@type": "Thing",
            name: entity.title,
            description: entity.description
          }
        });
        break;
      }

      default:
        break;
    }

    // Breadcrumbs
    const breadcrumbs = this.generateBreadcrumbs(entity);
    if (breadcrumbs.length > 1) {
      graph.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: b.name,
          item: b.item
        }))
      });
    }

    return graph;
  }

  public generateOrganizationSchema(): Record<string, any> {
    return {
      "@context": "https://schema.org",
      "@type": "NewsMediaOrganization",
      "@id": `${CANONICAL_DOMAIN}/#organization`,
      name: "SanatanMarga",
      alternateName: "सनातन मार्ग",
      url: CANONICAL_DOMAIN,
      logo: {
        "@type": "ImageObject",
        url: `${CANONICAL_DOMAIN}/logo.png`,
        width: 512,
        height: 512
      },
      sameAs: [
        "https://twitter.com/SanatanMarga",
        "https://facebook.com/SanatanMarga",
        "https://youtube.com/@SanatanMarga"
      ]
    };
  }

  public generateBreadcrumbs(entity: SEOEntity): Array<{ name: string; item: string }> {
    const list = [{ name: "Home", item: CANONICAL_DOMAIN }];

    if (entity.entityType === "ARTICLE" || entity.entityType === "NEWS_ARTICLE") {
      list.push({ name: "News", item: `${CANONICAL_DOMAIN}/news` });
      if (entity.section) {
        list.push({ name: entity.section, item: `${CANONICAL_DOMAIN}/category/${entity.section.toLowerCase()}` });
      }
      list.push({ name: entity.title, item: entity.canonicalUrl });
    } else if (entity.entityType === "BLOG_POST") {
      list.push({ name: "Blog", item: `${CANONICAL_DOMAIN}/blog` });
      list.push({ name: entity.title, item: entity.canonicalUrl });
    } else if (entity.entityType === "EVENT") {
      list.push({ name: "Events", item: `${CANONICAL_DOMAIN}/events` });
      list.push({ name: entity.title, item: entity.canonicalUrl });
    } else if (entity.entityType === "KNOWLEDGE_ENTITY") {
      list.push({ name: "Knowledge", item: `${CANONICAL_DOMAIN}/knowledge` });
      list.push({ name: entity.title, item: entity.canonicalUrl });
    } else if (entity.entityType === "COURSE") {
      list.push({ name: "Academy", item: `${CANONICAL_DOMAIN}/academy` });
      list.push({ name: entity.title, item: entity.canonicalUrl });
    }

    return list;
  }

  // --- 6. SERVER HTML INJECTION ENGINE ---

  /**
   * Safely injects title, meta description, canonical, robots, OpenGraph,
   * Twitter Card, hreflang tags, and JSON-LD graphs into the raw HTML shell.
   */
  public injectServerSeo(html: string, urlPath: string, snapshotStore?: any): string {
    const cleanPath = this.normalizePath(urlPath);
    const canonicalUrl = this.buildCanonicalUrl(cleanPath);

    // Default metadata values
    let pageTitle = "SanatanMarga — Sanatan Dharma, News, Knowledge & Himalayan Civilization";
    let metaDescription = "SanatanMarga is an authoritative platform for Sanatan Dharma, Vedic philosophy, news, SGIS manuscript preservation, and Himalayan civilization.";
    let robotsDirective = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
    let ogImage = `${CANONICAL_DOMAIN}/logo.png`;
    let ogType = "website";
    let alternateHreflangs: Array<{ lang: string; url: string }> = [];
    let jsonLdGraph: Array<Record<string, any>> = [];

    // Check Redirects First
    const redirectTarget = this.resolveRedirectTarget(cleanPath);
    if (redirectTarget) {
      robotsDirective = "noindex, follow";
    }

    // Resolve Entity from Path / Snapshot Store
    const entity = this.resolveEntityForPath(cleanPath, snapshotStore);

    if (entity) {
      const indexEval = this.evaluateIndexability(entity);
      robotsDirective = indexEval.robotsDirective;

      if (entity.seoTitle) {
        pageTitle = `${entity.seoTitle} | SanatanMarga`;
      } else {
        pageTitle = `${entity.title} | SanatanMarga`;
      }

      metaDescription = entity.seoDescription || entity.description || metaDescription;
      ogImage = entity.socialImage || entity.featuredImage || ogImage;
      ogType = entity.entityType === "ARTICLE" || entity.entityType === "NEWS_ARTICLE" || entity.entityType === "BLOG_POST" ? "article" : "website";

      if (entity.alternateLanguages && entity.alternateLanguages.length > 0) {
        alternateHreflangs = entity.alternateLanguages
          .filter(a => a.provenance !== "AI_TRANSLATED") // exclude unreviewed translations from hreflangs
          .map(a => ({ lang: a.lang, url: a.url }));
        alternateHreflangs.push({ lang: entity.language, url: entity.canonicalUrl });
        alternateHreflangs.push({ lang: "x-default", url: entity.canonicalUrl });
      }

      jsonLdGraph = this.generateJsonLdGraph(entity);
    } else {
      // Check generic route indexability
      const genericEval = this.evaluateIndexability(cleanPath);
      robotsDirective = genericEval.robotsDirective;

      if (cleanPath === "/latest") {
        pageTitle = "ताजा समाचार (Latest News) | SanatanMarga";
      } else if (cleanPath === "/trending") {
        pageTitle = "चर्चामा रहेका विषय (Trending) | SanatanMarga";
      } else if (cleanPath === "/blog") {
        pageTitle = "सनातन ब्लग (Perspectives & Commentary) | SanatanMarga";
      } else if (cleanPath === "/sgis") {
        pageTitle = "सरस्वती ज्ञान सञ्जाल (SGIS Manuscripts) | SanatanMarga";
      } else if (cleanPath === "/knowledge") {
        pageTitle = "सनातन ज्ञानकोष (Civilization Knowledge Base) | SanatanMarga";
      } else if (cleanPath === "/nepal-hub") {
        pageTitle = "नेपाल हब (Nepal Hub & Panchang) | SanatanMarga";
      } else if (cleanPath === "/events") {
        pageTitle = "धार्मिक तथा सांस्कृतिक कार्यक्रम (Events) | SanatanMarga";
      }

      // Root Organization & WebSite schema fallback
      jsonLdGraph.push(this.generateOrganizationSchema());
    }

    // Safe HTML Escaping
    const safeTitle = this.escapeHtml(pageTitle);
    const safeDescription = this.escapeHtml(metaDescription.slice(0, 160));
    const safeCanonical = this.escapeHtml(canonicalUrl);
    const safeRobots = this.escapeHtml(robotsDirective);
    const safeOgImage = this.escapeHtml(ogImage);

    // Generate Hreflang Tags
    const hreflangTags = alternateHreflangs
      .map(h => `<link rel="alternate" hreflang="${this.escapeHtml(h.lang)}" href="${this.escapeHtml(h.url)}" />`)
      .join("\n    ");

    // Safe JSON-LD Serialization (Escapes closing script tag to prevent injection)
    const jsonLdString = JSON.stringify({ "@context": "https://schema.org", "@graph": jsonLdGraph })
      .replace(/<\/script>/gi, "<\\/script>")
      .replace(/<!--/g, "<\\!--");

    const metaTagsBlock = `
    <!-- SANATANMARGA 5.0 SEO & DISCOVERY OS SERVER INJECTION -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="${safeRobots}" />
    <link rel="canonical" href="${safeCanonical}" />
    ${hreflangTags}
    
    <!-- OpenGraph -->
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeOgImage}" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="SanatanMarga" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeOgImage}" />
    
    <!-- Structured Data Graph -->
    <script type="application/ld+json">${jsonLdString}</script>
    <!-- /SEO OS INJECTION -->
    `;

    // Replace existing <title> and meta if found, or inject into <head>
    let outputHtml = html;
    if (outputHtml.includes("<title>")) {
      outputHtml = outputHtml.replace(/<title>[\s\S]*?<\/title>/i, "");
    }
    if (outputHtml.includes("</head>")) {
      outputHtml = outputHtml.replace("</head>", `${metaTagsBlock}\n</head>`);
    } else {
      outputHtml = metaTagsBlock + outputHtml;
    }

    return outputHtml;
  }

  private resolveEntityForPath(cleanPath: string, snapshotStore?: any): SEOEntity | null {
    // 1. In-memory registry lookup
    for (const entity of this.entityRegistry.values()) {
      if (this.normalizePath(entity.canonicalUrl.replace(CANONICAL_DOMAIN, "")) === cleanPath) {
        return entity;
      }
    }

    // 2. Snapshot store inspection
    if (snapshotStore) {
      if (cleanPath.startsWith("/article/")) {
        const id = cleanPath.replace("/article/", "").trim();
        const artModule = snapshotStore[`article_${id}`] || snapshotStore[`article/${id}`];
        const artData = artModule?.data || snapshotStore["latest"]?.data?.articles?.find((a: any) => a.id === id || a.slug === id);
        if (artData) {
          return {
            entityType: "NEWS_ARTICLE",
            entityId: artData.id,
            slug: artData.slug || artData.id,
            canonicalUrl: `${CANONICAL_DOMAIN}/article/${artData.slug || artData.id}`,
            title: artData.titleNepali || artData.title || "समाचार",
            description: artData.excerpt || (artData.content ? artData.content.substring(0, 160) : "समाचार"),
            language: artData.language === "en" ? "en" : "ne",
            publishedAt: artData.publishedAt || artData.createdAt,
            modifiedAt: artData.updatedAt || artData.publishedAt || artData.createdAt,
            featuredImage: artData.featuredImage,
            authorName: artData.authorName || "SanatanMarga Editorial Desk",
            authorId: artData.authorId,
            publisherName: "SanatanMarga",
            publisherLogo: `${CANONICAL_DOMAIN}/logo.png`,
            status: (artData.status as PublicationStatus) || "published",
            section: artData.categoryName || artData.categoryId || "देश",
            featureKey: "core.news"
          };
        }
      } else if (cleanPath.startsWith("/events/")) {
        const id = cleanPath.replace("/events/", "").trim();
        const evData = snapshotStore["events"]?.data?.events?.find((e: any) => e.id === id || e.slug === id);
        if (evData) {
          return {
            entityType: "EVENT",
            entityId: evData.id,
            slug: evData.id,
            canonicalUrl: `${CANONICAL_DOMAIN}/events/${evData.id}`,
            title: evData.titleNepali || evData.title || "कार्यक्रम",
            description: evData.descriptionNepali || evData.description || "सनातन मार्ग सांस्कृतिक कार्यक्रम",
            language: "ne",
            publishedAt: evData.createdAt,
            featuredImage: evData.imageUrl || evData.image,
            publisherName: "SanatanMarga",
            publisherLogo: `${CANONICAL_DOMAIN}/logo.png`,
            status: "published",
            featureKey: "community.events",
            eventData: {
              startDate: evData.startDate || evData.date || new Date().toISOString(),
              endDate: evData.endDate,
              locationName: evData.location || "Kathmandu, Nepal"
            }
          };
        }
      }
    }

    return null;
  }

  // --- 7. SITEMAP OS 5.0 ---

  public generateMasterSitemapIndex(): string {
    const sitemaps = [
      { file: "pages.xml", feature: "core.news" },
      { file: "news.xml", feature: "core.news" },
      { file: "articles.xml", feature: "core.news" },
      { file: "blog.xml", feature: "blog.main" },
      { file: "events.xml", feature: "community.events" },
      { file: "knowledge.xml", feature: "knowledge.base" },
      { file: "authors.xml", feature: "core.news" },
      { file: "academy.xml", feature: "academy.main" }
    ];

    const allowedSitemaps = sitemaps.filter(s => {
      const evalRes = serverFeatureControlService.evaluateFeature(s.feature);
      return evalRes.enabled && evalRes.seoAllowed;
    });

    const now = new Date().toISOString();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const s of allowedSitemaps) {
      xml += '  <sitemap>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}/sitemaps/${s.file}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '  </sitemap>\n';
    }

    xml += '</sitemapindex>';
    return xml;
  }

  public generateSubSitemap(type: string, snapshotStore?: any): string {
    const now = new Date().toISOString();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

    if (type === "news") {
      // Google News XML Sitemap: strictly recent published news (last 48 hours)
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';
      const articles: any[] = snapshotStore?.["latest"]?.data?.articles || [];
      const recentNews = articles.filter((a: any) => {
        if (!a || a.status !== "published") return false;
        const pubTime = new Date(a.publishedAt || a.createdAt || 0).getTime();
        const cutoff = Date.now() - NEWS_SITEMAP_FRESHNESS_HOURS * 60 * 60 * 1000;
        return pubTime >= cutoff;
      });

      for (const art of recentNews) {
        const canonical = this.buildCanonicalUrl(`/article/${art.slug || art.id}`);
        const pubDate = art.publishedAt || art.createdAt || now;
        const title = this.escapeXml(art.titleNepali || art.title || "समाचार");
        const lang = art.language === "en" ? "en" : "ne";

        xml += '  <url>\n';
        xml += `    <loc>${canonical}</loc>\n`;
        xml += `    <lastmod>${pubDate}</lastmod>\n`;
        xml += '    <news:news>\n';
        xml += '      <news:publication>\n';
        xml += '        <news:name>SanatanMarga</news:name>\n';
        xml += `        <news:language>${lang}</news:language>\n`;
        xml += '      </news:publication>\n';
        xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
        xml += `      <news:title>${title}</news:title>\n`;
        xml += '    </news:news>\n';
        xml += '  </url>\n';
      }
      xml += '</urlset>';
      return xml;
    }

    // Standard URL set
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    if (type === "pages") {
      const staticPages = [
        { path: "/", priority: "1.0", freq: "daily", feature: "core.news" },
        { path: "/latest", priority: "0.9", freq: "hourly", feature: "core.news" },
        { path: "/trending", priority: "0.8", freq: "hourly", feature: "core.news" },
        { path: "/news", priority: "0.9", freq: "hourly", feature: "core.news" },
        { path: "/blog", priority: "0.8", freq: "daily", feature: "blog.main" },
        { path: "/events", priority: "0.8", freq: "daily", feature: "community.events" },
        { path: "/knowledge", priority: "0.9", freq: "daily", feature: "knowledge.base" },
        { path: "/sgis", priority: "0.9", freq: "daily", feature: "knowledge.sgis" },
        { path: "/nepal-hub", priority: "0.9", freq: "daily", feature: "nepalhub.main" },
        { path: "/about", priority: "0.6", freq: "monthly", feature: "core.news" },
        { path: "/editorial-policy", priority: "0.6", freq: "monthly", feature: "core.news" },
        { path: "/transparency", priority: "0.6", freq: "monthly", feature: "core.news" },
        { path: "/authors", priority: "0.7", freq: "weekly", feature: "core.news" },
        { path: "/privacy", priority: "0.4", freq: "yearly", feature: "core.news" },
        { path: "/terms", priority: "0.4", freq: "yearly", feature: "core.news" }
      ];

      for (const p of staticPages) {
        const fEval = serverFeatureControlService.evaluateFeature(p.feature);
        if (!fEval.enabled || !fEval.seoAllowed) continue;

        xml += '  <url>\n';
        xml += `    <loc>${CANONICAL_DOMAIN}${p.path}</loc>\n`;
        xml += `    <lastmod>${now}</lastmod>\n`;
        xml += `    <changefreq>${p.freq}</changefreq>\n`;
        xml += `    <priority>${p.priority}</priority>\n`;
        xml += '  </url>\n';
      }
    } else if (type === "articles") {
      const articles: any[] = snapshotStore?.["latest"]?.data?.articles || [];
      for (const art of articles) {
        if (!art || art.status !== "published") continue;
        const canonical = this.buildCanonicalUrl(`/article/${art.slug || art.id}`);
        xml += '  <url>\n';
        xml += `    <loc>${canonical}</loc>\n`;
        xml += `    <lastmod>${art.updatedAt || art.publishedAt || art.createdAt || now}</lastmod>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        if (art.featuredImage) {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${this.escapeXml(art.featuredImage)}</image:loc>\n`;
          xml += `      <image:title>${this.escapeXml(art.titleNepali || art.title || "Image")}</image:title>\n`;
          xml += '    </image:image>\n';
        }
        xml += '  </url>\n';
      }
    } else if (type === "events") {
      const events: any[] = snapshotStore?.["events"]?.data?.events || [];
      for (const ev of events) {
        if (!ev) continue;
        const canonical = this.buildCanonicalUrl(`/events/${ev.id}`);
        xml += '  <url>\n';
        xml += `    <loc>${canonical}</loc>\n`;
        xml += `    <lastmod>${ev.createdAt || now}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }
    } else if (type === "authors") {
      const authors = ["dr-sagar-rana", "acharya-ramesh-sharma", "editorial-desk"];
      for (const aId of authors) {
        xml += '  <url>\n';
        xml += `    <loc>${CANONICAL_DOMAIN}/authors/${aId}</loc>\n`;
        xml += `    <lastmod>${now}</lastmod>\n`;
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.6</priority>\n';
        xml += '  </url>\n';
      }
    }

    xml += '</urlset>';
    return xml;
  }

  // --- 8. ROBOTS.TXT GENERATOR ---

  public generateRobotsTxt(environment: "production" | "staging" | "preview" = "production"): string {
    if (environment !== "production") {
      return `# SanatanMarga Non-Production Staging Policy
User-agent: *
Disallow: /
`;
    }

    return `# SanatanMarga Production Robots.txt Policy
User-agent: *
Allow: /
Allow: /news/
Allow: /article/
Allow: /blog/
Allow: /sgis/
Allow: /knowledge/
Allow: /nepal-hub/
Allow: /category/
Allow: /events/
Allow: /storylines/
Allow: /about
Allow: /editorial-policy
Allow: /transparency
Allow: /authors
Allow: /contact
Allow: /privacy
Allow: /terms
Allow: /sitemap.xml
Allow: /sitemaps/

Disallow: /admin/
Disallow: /editor/
Disallow: /dashboard/
Disallow: /login
Disallow: /signup
Disallow: /account/
Disallow: /settings/
Disallow: /draft/
Disallow: /preview/
Disallow: /review/
Disallow: /search
Disallow: /global-search
Disallow: /my-sanatan
Disallow: /notifications
Disallow: /offline-queue
Disallow: /api/

Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml
`;
  }

  // --- 9. TOPIC AUTHORITY GRAPH & ORPHAN DETECTION ---

  public registerEntity(entity: SEOEntity): { success: boolean; issues: SEOQualityIssue[] } {
    const issues = this.evaluateQualityGate(entity);
    this.entityRegistry.set(entity.entityId, entity);

    // Track canonical URLs for conflict detection
    const existing = this.canonicalUrlIndex.get(entity.canonicalUrl) || [];
    if (!existing.includes(entity.entityId)) {
      existing.push(entity.entityId);
      this.canonicalUrlIndex.set(entity.canonicalUrl, existing);
    }

    // Graph tracking
    if (entity.outboundLinks) {
      this.internalGraph.set(entity.entityId, new Set(entity.outboundLinks));
      for (const target of entity.outboundLinks) {
        const count = this.inboundCountMap.get(target) || 0;
        this.inboundCountMap.set(target, count + 1);
      }
    }

    return {
      success: !issues.some(i => i.severity === "BLOCKING"),
      issues
    };
  }

  public detectCanonicalConflicts(): Array<{ canonicalUrl: string; entityIds: string[] }> {
    const conflicts: Array<{ canonicalUrl: string; entityIds: string[] }> = [];
    for (const [url, ids] of this.canonicalUrlIndex.entries()) {
      if (ids.length > 1) {
        conflicts.push({ canonicalUrl: url, entityIds: ids });
      }
    }
    return conflicts;
  }

  public detectOrphanPages(): string[] {
    const orphans: string[] = [];
    for (const [entityId, entity] of this.entityRegistry.entries()) {
      if (entity.status === "published" && !entity.isPrivate) {
        const inCount = this.inboundCountMap.get(entityId) || 0;
        if (inCount === 0 && entity.entityType !== "STATIC_PAGE") {
          orphans.push(entityId);
        }
      }
    }
    return orphans;
  }

  // --- 10. SEO HEALTH TELEMETRY ---

  public computeHealthTelemetry(snapshotStore?: any): SEOHealthTelemetry {
    let indexable = 0;
    let noindex = 0;
    let blocking = 0;
    let warning = 0;
    let recommendation = 0;

    for (const entity of this.entityRegistry.values()) {
      const evalRes = this.evaluateIndexability(entity);
      if (evalRes.isIndexable) indexable++;
      else noindex++;

      const issues = this.evaluateQualityGate(entity);
      for (const issue of issues) {
        if (issue.severity === "BLOCKING") blocking++;
        else if (issue.severity === "WARNING") warning++;
        else if (issue.severity === "RECOMMENDATION") recommendation++;
      }
    }

    const conflicts = this.detectCanonicalConflicts();
    const orphans = this.detectOrphanPages();

    // Sitemap count
    let sitemapUrls = 15; // default static pages
    if (snapshotStore?.["latest"]?.data?.articles) {
      sitemapUrls += snapshotStore["latest"].data.articles.filter((a: any) => a.status === "published").length;
    }

    return {
      totalEntities: this.entityRegistry.size,
      indexableCount: indexable,
      noindexCount: noindex,
      canonicalConflictsCount: conflicts.length,
      orphanPagesCount: orphans.length,
      sitemapUrlCount: sitemapUrls,
      redirectsCount: this.redirectsMap.size,
      qualityIssuesCount: {
        blocking,
        warning,
        recommendation
      },
      lastEvaluatedAt: new Date().toISOString()
    };
  }

  // --- HELPER METHODS ---

  private escapeHtml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export const seoDiscoveryOS = SEODiscoveryOS.getInstance();
