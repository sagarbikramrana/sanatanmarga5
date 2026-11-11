/**
 * SANATANMARGA 5.0 — SNAPSHOT OS 5.0
 * CANONICAL SNAPSHOT IDENTITY & NAMESPACE REGISTRY
 *
 * Principles:
 * 1. Single Logical Identity: Every logical snapshot has exactly ONE canonical key.
 * 2. Deterministic Object Naming: R2 keys are deterministic from domain + entity ID.
 * 3. Legacy Aliasing: Legacy publication forms (e.g. event_<id> vs event/<id>) map
 *    transparently to canonical keys without destructive deletion.
 * 4. Namespace Isolation:
 *    - Canonical delivery: Root / domain-prefixed (e.g. "events/evt_1.json")
 *    - Backups: "backups/snapshots/..." and "backups/manifests/..."
 *    - Emergency: "emergency/..."
 */

export interface SnapshotIdentityMapping {
  logicalId: string;
  canonicalKey: string;
  legacyAliases: string[];
  category: "core" | "article" | "events" | "knowledge" | "community" | "nepal_hub" | "ads" | "media" | "infra";
  schemaVersion: number;
}

export const CANONICAL_SNAPSHOT_NAMESPACES = {
  CANONICAL_ROOT: "",
  BACKUP_SNAPSHOTS: "backups/snapshots/",
  BACKUP_MANIFESTS: "backups/manifests/",
  EMERGENCY: "emergency/",
  TTS_MEDIA: "audio/tts/",
} as const;

/**
 * Registry of canonical snapshot mappings and legacy aliases
 */
class SnapshotIdentityRegistry {
  private canonicalMap: Map<string, SnapshotIdentityMapping> = new Map();
  private aliasToCanonical: Map<string, string> = new Map();

  constructor() {
    this.registerStandardIdentities();
  }

  private registerStandardIdentities(): void {
    // 1. Core Platform Modules
    this.register({
      logicalId: "homepage",
      canonicalKey: "homepage",
      legacyAliases: ["homepage-ne", "homepage-en"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "latest_news",
      canonicalKey: "latest",
      legacyAliases: ["news/latest", "news_latest"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "breaking_news",
      canonicalKey: "breaking",
      legacyAliases: ["news/breaking"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "categories_catalog",
      canonicalKey: "categories",
      legacyAliases: ["taxonomy/categories"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "search_index",
      canonicalKey: "search-index",
      legacyAliases: ["search/index", "search_index"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "feature_control",
      canonicalKey: "feature-control",
      legacyAliases: ["feature_control", "config/features"],
      category: "infra",
      schemaVersion: 5
    });

    // 2. Events Module (Eliminating event_<id> vs event/<id> conflict)
    this.register({
      logicalId: "events_upcoming",
      canonicalKey: "events/upcoming",
      legacyAliases: ["events_upcoming", "events"],
      category: "events",
      schemaVersion: 5
    });

    this.register({
      logicalId: "events_featured",
      canonicalKey: "events/featured",
      legacyAliases: ["events_featured"],
      category: "events",
      schemaVersion: 5
    });

    this.register({
      logicalId: "events_calendar",
      canonicalKey: "events/calendar",
      legacyAliases: ["events_calendar"],
      category: "events",
      schemaVersion: 5
    });

    // 3. Nepal Hub
    this.register({
      logicalId: "nepalhub_main",
      canonicalKey: "nepal_hub/live",
      legacyAliases: ["nepalhub", "nepal_hub"],
      category: "nepal_hub",
      schemaVersion: 5
    });

    this.register({
      logicalId: "nepalhub_festivals",
      canonicalKey: "nepal_hub/festivals",
      legacyAliases: ["nepalhub/festivals"],
      category: "nepal_hub",
      schemaVersion: 5
    });

    // 4. Community & Chautari
    this.register({
      logicalId: "chautari_recent",
      canonicalKey: "chautari/recent",
      legacyAliases: ["community/recent", "chautari_recent"],
      category: "community",
      schemaVersion: 5
    });

    this.register({
      logicalId: "chautari_trending",
      canonicalKey: "chautari/trending",
      legacyAliases: ["community/trending", "chautari_trending"],
      category: "community",
      schemaVersion: 5
    });

    // 5. Knowledge Base & Saraswati Graph
    this.register({
      logicalId: "knowledge_graph",
      canonicalKey: "knowledge/graph",
      legacyAliases: ["knowledge_graph", "knowledge_base"],
      category: "knowledge",
      schemaVersion: 5
    });

    this.register({
      logicalId: "knowledge_entities",
      canonicalKey: "knowledge/entities",
      legacyAliases: ["knowledge_entities"],
      category: "knowledge",
      schemaVersion: 5
    });

    // 6. Extended 13-Module Canonical Snapshot Contracts (SanatanMedia 5.0)
    this.register({
      logicalId: "live_tv_public",
      canonicalKey: "media/live-tv",
      legacyAliases: ["live_tv_public", "live_tv"],
      category: "media",
      schemaVersion: 5
    });

    this.register({
      logicalId: "radio_public",
      canonicalKey: "media/radio",
      legacyAliases: ["radio_public", "radio", "radio-schedule"],
      category: "media",
      schemaVersion: 5
    });

    this.register({
      logicalId: "listen_catalog",
      canonicalKey: "media/listen-catalog",
      legacyAliases: ["listen_catalog", "podcasts"],
      category: "media",
      schemaVersion: 5
    });

    this.register({
      logicalId: "sgis_catalog",
      canonicalKey: "knowledge/sgis-catalog",
      legacyAliases: ["sgis_catalog", "sgis"],
      category: "knowledge",
      schemaVersion: 5
    });

    this.register({
      logicalId: "academy_catalog",
      canonicalKey: "knowledge/academy-catalog",
      legacyAliases: ["academy_catalog", "academy"],
      category: "knowledge",
      schemaVersion: 5
    });

    this.register({
      logicalId: "panchang_daily",
      canonicalKey: "events/panchang-daily",
      legacyAliases: ["panchang_daily", "panchang"],
      category: "events",
      schemaVersion: 5
    });

    this.register({
      logicalId: "ad_slots_public",
      canonicalKey: "ads/slots-public",
      legacyAliases: ["ad_slots_public", "ads"],
      category: "ads",
      schemaVersion: 5
    });

    this.register({
      logicalId: "store_catalog",
      canonicalKey: "core/store-catalog",
      legacyAliases: ["store_catalog", "store"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "membership_plans",
      canonicalKey: "core/membership-plans",
      legacyAliases: ["membership_plans", "membership"],
      category: "core",
      schemaVersion: 5
    });

    this.register({
      logicalId: "navigation_config",
      canonicalKey: "core/navigation-config",
      legacyAliases: ["navigation_config", "menu"],
      category: "core",
      schemaVersion: 5
    });
  }

  public register(mapping: SnapshotIdentityMapping): void {
    this.canonicalMap.set(mapping.canonicalKey, mapping);
    this.canonicalMap.set(mapping.logicalId, mapping);
    
    mapping.legacyAliases.forEach(alias => {
      this.aliasToCanonical.set(alias, mapping.canonicalKey);
    });
  }

  /**
   * Resolves any input module key to its normalized canonical R2 delivery key.
   * Handles entity patterns dynamically (e.g. event_<id> -> events/<id>, article_<id> -> articles/<id>).
   */
  public resolveCanonicalKey(inputKey: string): {
    canonicalKey: string;
    isLegacyAlias: boolean;
    legacyAliases: string[];
    namespace: string;
  } {
    const cleanKey = inputKey.replace(/\.json$/, "").trim();

    // Check backup namespace
    if (cleanKey.startsWith(CANONICAL_SNAPSHOT_NAMESPACES.BACKUP_SNAPSHOTS) ||
        cleanKey.startsWith(CANONICAL_SNAPSHOT_NAMESPACES.BACKUP_MANIFESTS)) {
      return {
        canonicalKey: cleanKey,
        isLegacyAlias: false,
        legacyAliases: [],
        namespace: "backup"
      };
    }

    // Check emergency namespace
    if (cleanKey.startsWith(CANONICAL_SNAPSHOT_NAMESPACES.EMERGENCY)) {
      return {
        canonicalKey: cleanKey,
        isLegacyAlias: false,
        legacyAliases: [],
        namespace: "emergency"
      };
    }

    // Direct registry match
    const direct = this.canonicalMap.get(cleanKey);
    if (direct) {
      return {
        canonicalKey: direct.canonicalKey,
        isLegacyAlias: cleanKey !== direct.canonicalKey,
        legacyAliases: direct.legacyAliases,
        namespace: "canonical"
      };
    }

    // Static alias match
    const mappedCanonical = this.aliasToCanonical.get(cleanKey);
    if (mappedCanonical) {
      return {
        canonicalKey: mappedCanonical,
        isLegacyAlias: true,
        legacyAliases: [cleanKey],
        namespace: "canonical"
      };
    }

    // Dynamic Entity Naming: Events
    // event_<id> or event/<id> -> canonical is "events/<id>"
    if (cleanKey.startsWith("event_")) {
      const id = cleanKey.replace(/^event_/, "");
      return {
        canonicalKey: `events/${id}`,
        isLegacyAlias: true,
        legacyAliases: [`event_${id}`, `event/${id}`],
        namespace: "canonical"
      };
    }
    if (cleanKey.startsWith("event/")) {
      const id = cleanKey.replace(/^event\//, "");
      return {
        canonicalKey: `events/${id}`,
        isLegacyAlias: true,
        legacyAliases: [`event_${id}`, `event/${id}`],
        namespace: "canonical"
      };
    }

    // Dynamic Entity Naming: Articles
    // article_<id> or article/<id> -> canonical is "articles/<id>"
    if (cleanKey.startsWith("article_")) {
      const id = cleanKey.replace(/^article_/, "");
      return {
        canonicalKey: `articles/${id}`,
        isLegacyAlias: true,
        legacyAliases: [`article_${id}`, `article/${id}`],
        namespace: "canonical"
      };
    }
    if (cleanKey.startsWith("article/")) {
      const id = cleanKey.replace(/^article\//, "");
      return {
        canonicalKey: `articles/${id}`,
        isLegacyAlias: true,
        legacyAliases: [`article_${id}`, `article/${id}`],
        namespace: "canonical"
      };
    }

    // Dynamic Entity Naming: Comments
    // comments/article_<id> -> canonical is "comments/articles/<id>"
    if (cleanKey.startsWith("comments/article_")) {
      const id = cleanKey.replace(/^comments\/article_/, "");
      return {
        canonicalKey: `comments/articles/${id}`,
        isLegacyAlias: true,
        legacyAliases: [`comments/article_${id}`],
        namespace: "canonical"
      };
    }

    // Default canonical key
    return {
      canonicalKey: cleanKey,
      isLegacyAlias: false,
      legacyAliases: [],
      namespace: "canonical"
    };
  }

  /**
   * Safety check: Prevents backup files from directly overwriting active canonical R2 keys
   */
  public isDirectBackupOverwrite(targetKey: string, origin: "NORMAL_WRITE" | "MIGRATION" | "RESTORE" | "BACKUP_EXPORT"): boolean {
    const resolved = this.resolveCanonicalKey(targetKey);
    // If incoming write origin is marked as BACKUP_EXPORT but target key is in canonical namespace -> BLOCK!
    if (origin === "BACKUP_EXPORT" && resolved.namespace === "canonical") {
      return true;
    }
    return false;
  }
}

export const snapshotIdentityRegistry = new SnapshotIdentityRegistry();
