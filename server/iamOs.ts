/**
 * SANATANMARGA 5.0 BETA — SERVER IAM & USER OPERATIONS OS
 * Phase 3E: Authoritative Identity, Role Matrix, Session Operations, Field Mutation Policy & Last-Superadmin Invariant
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { 
  UserAccount, 
  UserAccountStatus, 
  UserSession, 
  EffectivePermissionsResult, 
  ClientCapabilityProjection,
  CANONICAL_FIELD_POLICIES,
  CanonicalPermissionItem,
  PublicUserProfile,
  PrivateUserProfile,
  UserSecurityState,
  AdminUserSummary,
  IIamStore,
  IamStoreMode
} from "../src/types/iam";
import { ROLE_DEFINITIONS, PERMISSIONS, UserPermission } from "../src/constants/permissions";

export const BOOTSTRAP_SUPERADMIN_EMAIL = "sagarrana@gmail.com";

// --- STORAGE ADAPTER IMPLEMENTATIONS ---

export class LocalJsonIamStore implements IIamStore {
  readonly mode: IamStoreMode = "LOCAL_FALLBACK";
  private usersStorePath: string;
  private sessionsStorePath: string;
  private auditStorePath: string;

  constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {}
    }
    this.usersStorePath = path.join(dataDir, "iam_users_store.json");
    this.sessionsStorePath = path.join(dataDir, "iam_sessions_store.json");
    this.auditStorePath = path.join(dataDir, "iam_audit_store.json");
  }

  loadUsers(): UserAccount[] {
    try {
      if (fs.existsSync(this.usersStorePath)) {
        const raw = fs.readFileSync(this.usersStorePath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not load users store:", e);
    }
    return [];
  }

  saveUsers(users: UserAccount[]): void {
    try {
      fs.writeFileSync(this.usersStorePath, JSON.stringify(users, null, 2));
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not persist users:", e);
    }
  }

  loadSessions(): UserSession[] {
    try {
      if (fs.existsSync(this.sessionsStorePath)) {
        const raw = fs.readFileSync(this.sessionsStorePath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not load sessions store:", e);
    }
    return [];
  }

  saveSessions(sessions: UserSession[]): void {
    try {
      fs.writeFileSync(this.sessionsStorePath, JSON.stringify(sessions, null, 2));
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not persist sessions:", e);
    }
  }

  loadAuditLogs(): any[] {
    try {
      if (fs.existsSync(this.auditStorePath)) {
        const raw = fs.readFileSync(this.auditStorePath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not load audit store:", e);
    }
    return [];
  }

  saveAuditLogs(logs: any[]): void {
    try {
      fs.writeFileSync(this.auditStorePath, JSON.stringify(logs.slice(0, 1000), null, 2));
    } catch (e) {
      console.warn("[LocalJsonIamStore] Could not persist audit logs:", e);
    }
  }

  getUser(uid: string): UserAccount | null {
    const all = this.loadUsers();
    return all.find(u => u.uid === uid) || null;
  }

  saveUser(user: UserAccount): void {
    const all = this.loadUsers();
    const idx = all.findIndex(u => u.uid === user.uid);
    if (idx >= 0) {
      all[idx] = user;
    } else {
      all.push(user);
    }
    this.saveUsers(all);
  }

  async updateUserAtomic(
    uid: string,
    mutateFn: (user: UserAccount) => Partial<UserAccount>,
    expectedSecurityVersion?: number
  ): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const user = this.getUser(uid);
    if (!user) return { success: false, error: "TARGET_USER_NOT_FOUND" };
    if (expectedSecurityVersion !== undefined && user.securityVersion !== expectedSecurityVersion) {
      return { success: false, error: `SECURITY_VERSION_CONFLICT: Expected securityVersion ${expectedSecurityVersion} but target is at ${user.securityVersion}` };
    }
    const patch = mutateFn(user);
    const updatedUser: UserAccount = {
      ...user,
      ...patch,
      updatedAt: new Date().toISOString(),
      securityVersion: (user.securityVersion || 1) + 1
    };
    this.saveUser(updatedUser);
    return { success: true, user: updatedUser };
  }
}

export class FirestoreIamStore implements IIamStore {
  readonly mode: IamStoreMode = "FIRESTORE_CANONICAL";
  private adminDb: any;
  private fallbackStore: LocalJsonIamStore;

  constructor(adminDb: any) {
    this.adminDb = adminDb;
    this.fallbackStore = new LocalJsonIamStore();
  }

  async loadUsers(): Promise<UserAccount[]> {
    if (!this.adminDb) return this.fallbackStore.loadUsers();
    try {
      const snap = await this.adminDb.collection("users").get();
      if (!snap.empty) {
        return snap.docs.map((d: any) => ({ uid: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("[FirestoreIamStore] Firestore load failed, using local LKG fallback:", e);
    }
    return this.fallbackStore.loadUsers();
  }

  async saveUsers(users: UserAccount[]): Promise<void> {
    this.fallbackStore.saveUsers(users);
    if (!this.adminDb) return;
    try {
      const batch = this.adminDb.batch();
      for (const u of users) {
        const ref = this.adminDb.collection("users").doc(u.uid);
        batch.set(ref, u, { merge: true });
      }
      await batch.commit();
    } catch (e) {
      console.warn("[FirestoreIamStore] Firestore batch write failed:", e);
    }
  }

  loadSessions(): UserSession[] {
    return this.fallbackStore.loadSessions();
  }

  saveSessions(sessions: UserSession[]): void {
    this.fallbackStore.saveSessions(sessions);
  }

  loadAuditLogs(): any[] {
    return this.fallbackStore.loadAuditLogs();
  }

  saveAuditLogs(logs: any[]): void {
    this.fallbackStore.saveAuditLogs(logs);
  }

  async getUser(uid: string): Promise<UserAccount | null> {
    if (this.adminDb) {
      try {
        const doc = await this.adminDb.collection("users").doc(uid).get();
        if (doc.exists) {
          return { uid: doc.id, ...doc.data() };
        }
      } catch (e) {}
    }
    return this.fallbackStore.getUser(uid);
  }

  async saveUser(user: UserAccount): Promise<void> {
    this.fallbackStore.saveUser(user);
    if (this.adminDb) {
      try {
        await this.adminDb.collection("users").doc(user.uid).set(user, { merge: true });
      } catch (e) {
        console.warn("[FirestoreIamStore] Firestore user save failed:", e);
      }
    }
  }

  async updateUserAtomic(
    uid: string,
    mutateFn: (user: UserAccount) => Partial<UserAccount>,
    expectedSecurityVersion?: number
  ): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    if (this.adminDb) {
      try {
        const userRef = this.adminDb.collection("users").doc(uid);
        const result = await this.adminDb.runTransaction(async (transaction: any) => {
          const docSnap = await transaction.get(userRef);
          if (!docSnap.exists) {
            throw new Error("TARGET_USER_NOT_FOUND");
          }
          const currentData = { uid: docSnap.id, ...docSnap.data() } as UserAccount;
          if (expectedSecurityVersion !== undefined && currentData.securityVersion !== expectedSecurityVersion) {
            throw new Error(`SECURITY_VERSION_CONFLICT: Expected securityVersion ${expectedSecurityVersion} but target is at ${currentData.securityVersion}`);
          }
          const patch = mutateFn(currentData);
          const updatedUser: UserAccount = {
            ...currentData,
            ...patch,
            updatedAt: new Date().toISOString(),
            securityVersion: (currentData.securityVersion || 1) + 1
          };
          transaction.set(userRef, updatedUser, { merge: true });
          return updatedUser;
        });
        this.fallbackStore.saveUser(result);
        return { success: true, user: result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return this.fallbackStore.updateUserAtomic(uid, mutateFn, expectedSecurityVersion);
  }
}

export function createDefaultIamStore(adminDb?: any): IIamStore {
  if (adminDb) {
    return new FirestoreIamStore(adminDb);
  }
  return new LocalJsonIamStore();
}

// --- PROJECTION HELPERS ---

export function toPublicProfile(user: UserAccount): PublicUserProfile {
  return {
    uid: user.uid,
    displayName: user.displayName || "प्रयोगकर्ता",
    avatar: user.avatar,
    photoURL: user.photoURL,
    bio: user.bio,
    district: user.district,
    location: user.location,
    website: user.website,
    socialLinks: user.socialLinks,
    primaryLanguage: user.primaryLanguage || "ne",
    publicProfileVisibility: user.publicProfileVisibility || "PUBLIC",
    createdAt: user.createdAt
  };
}

export function toPrivateProfile(user: UserAccount): PrivateUserProfile {
  return {
    ...toPublicProfile(user),
    email: user.email,
    notificationPreferences: user.notificationPreferences,
    updatedAt: user.updatedAt,
    profileVersion: user.profileVersion || 1
  };
}

export function toAdminSummary(user: UserAccount): AdminUserSummary {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    securityVersion: user.securityVersion,
    tenantId: user.tenantId
  };
}

export function toSecurityState(user: UserAccount, activeSessionsCount: number): UserSecurityState {
  return {
    uid: user.uid,
    role: user.role,
    roles: user.roles,
    status: user.status,
    securityVersion: user.securityVersion,
    activeSessionsCount,
    lastSeenAt: user.lastSeenAt,
    customPermissionsCount: user.customPermissions ? user.customPermissions.length : 0,
    tenantId: user.tenantId
  };
}

export const CANONICAL_PERMISSIONS_REGISTRY: CanonicalPermissionItem[] = [
  { key: "news.create", domain: "news", description: "Create news draft articles", scope: "global", riskLevel: "LOW" },
  { key: "news.edit", domain: "news", description: "Edit news articles and desk drafts", scope: "global", riskLevel: "MEDIUM" },
  { key: "news.publish", domain: "news", description: "Publish news articles directly to public snapshots", scope: "global", riskLevel: "HIGH" },
  { key: "news.delete", domain: "news", description: "Delete published or draft news articles", scope: "global", riskLevel: "HIGH" },
  { key: "news.override", domain: "news", description: "Override desk and editorial state machine decisions", scope: "global", riskLevel: "HIGH" },
  
  { key: "media.upload", domain: "media", description: "Upload media files and photos", scope: "global", riskLevel: "LOW" },
  { key: "media.manage", domain: "media", description: "Manage media assets, audio tracks, and archives", scope: "global", riskLevel: "MEDIUM" },
  
  { key: "live.create", domain: "live", description: "Initiate live coverage dispatches", scope: "global", riskLevel: "MEDIUM" },
  { key: "live.edit", domain: "live", description: "Update active live streaming dispatches", scope: "global", riskLevel: "MEDIUM" },
  { key: "radio.manage", domain: "radio", description: "Control 24/7 Sanatan Radio station bulletins", scope: "global", riskLevel: "HIGH" },
  
  { key: "ads.manage", domain: "revenue", description: "Create and schedule advertisements and campaigns", scope: "global", riskLevel: "HIGH" },
  { key: "sponsors.manage", domain: "revenue", description: "Manage brand sponsorships and partners", scope: "global", riskLevel: "HIGH" },
  { key: "revenue.view", domain: "revenue", description: "View financial reports and RevenueOS analytics", scope: "global", riskLevel: "HIGH" },
  
  { key: "community.post", domain: "community", description: "Post content to Chautari community", scope: "global", riskLevel: "LOW" },
  { key: "community.comment", domain: "community", description: "Comment on public and community posts", scope: "global", riskLevel: "LOW" },
  { key: "community.moderate", domain: "community", description: "Moderate community posts and flag violations", scope: "global", riskLevel: "HIGH" },
  
  { key: "users.manage", domain: "users", description: "Manage user account status, profiles and permissions", scope: "global", riskLevel: "CRITICAL" },
  { key: "roles.manage", domain: "roles", description: "Assign and revoke governance roles", scope: "global", riskLevel: "CRITICAL" },
  { key: "superadmin.manage", domain: "governance", description: "Elevate or demote platform super administrators", scope: "global", riskLevel: "CRITICAL" },
  { key: "settings.manage", domain: "governance", description: "Manage platform-wide settings and feature flags", scope: "global", riskLevel: "CRITICAL" },
  { key: "governance.manage", domain: "governance", description: "Access platform security audits and emergency protocols", scope: "global", riskLevel: "CRITICAL" },
  
  { key: "events.create", domain: "events", description: "Propose event candidates", scope: "global", riskLevel: "LOW" },
  { key: "events.edit", domain: "events", description: "Edit event candidates and metadata", scope: "global", riskLevel: "MEDIUM" },
  { key: "events.verify", domain: "events", description: "Verify event provenance and authenticity", scope: "global", riskLevel: "HIGH" },
  { key: "events.publish", domain: "events", description: "Publish verified events to public calendar", scope: "global", riskLevel: "HIGH" },
  { key: "events.retract", domain: "events", description: "Retract published events", scope: "global", riskLevel: "HIGH" },
  { key: "events.expire", domain: "events", description: "Expire past events", scope: "global", riskLevel: "MEDIUM" },
  { key: "events.merge", domain: "events", description: "Merge duplicate event entities", scope: "global", riskLevel: "HIGH" },
  { key: "events.delete", domain: "events", description: "Delete event entities", scope: "global", riskLevel: "HIGH" },
  { key: "events.manage_recurrence", domain: "events", description: "Manage festival recurrence rules", scope: "global", riskLevel: "HIGH" },
  { key: "events.manage_festivals", domain: "events", description: "Manage festival taxonomies and calendars", scope: "global", riskLevel: "HIGH" },
  { key: "events.manage_sources", domain: "events", description: "Manage trusted event source registries", scope: "global", riskLevel: "MEDIUM" },
  { key: "events.manage_knowledge_links", domain: "events", description: "Link events to Saraswati Knowledge Graph", scope: "global", riskLevel: "MEDIUM" },
  
  { key: "sgis.verify", domain: "sgis", description: "Perform scholar verification of historical manuscripts", scope: "global", riskLevel: "HIGH" },
  { key: "academy.manage", domain: "academy", description: "Manage courses, assessments, and certifications", scope: "global", riskLevel: "HIGH" }
];

export interface IamAuditLog {
  id: string;
  timestamp: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetUid: string;
  before?: any;
  after?: any;
  details?: any;
  hash: string;
  previousHash: string;
}

export class ServerIamOS {
  private store: IIamStore;
  private users: Map<string, UserAccount> = new Map();
  private sessions: Map<string, UserSession[]> = new Map(); // uid -> sessions
  private auditLogs: IamAuditLog[] = [];

  constructor(store?: IIamStore) {
    this.store = store || new LocalJsonIamStore();
    this.loadStores();
    this.ensureBootstrapOwner();
  }

  public getStoreMode(): IamStoreMode {
    return this.store.mode;
  }

  private loadStores() {
    try {
      const userList = this.store.loadUsers();
      if (Array.isArray(userList)) {
        for (const u of userList) {
          this.users.set(u.uid, u);
        }
      }
      const sessionList = this.store.loadSessions();
      if (Array.isArray(sessionList)) {
        for (const s of sessionList) {
          const arr = this.sessions.get(s.uid) || [];
          arr.push(s);
          this.sessions.set(s.uid, arr);
        }
      }
      const auditList = this.store.loadAuditLogs();
      if (Array.isArray(auditList)) {
        this.auditLogs = auditList;
      }
    } catch (e) {
      console.warn("[IamOS] Could not load stores from adapter:", e);
    }
  }

  public saveStoresSync() {
    try {
      this.store.saveUsers(Array.from(this.users.values()));
      const allSessions: UserSession[] = [];
      for (const sArr of this.sessions.values()) {
        allSessions.push(...sArr);
      }
      this.store.saveSessions(allSessions);
      this.store.saveAuditLogs(this.auditLogs.slice(0, 1000));
    } catch (e) {
      console.warn("[IamOS] Could not persist IAM stores via adapter:", e);
    }
  }

  private ensureBootstrapOwner() {
    // Bootstrap mode is ONLY allowed if there are ZERO active super_admins in canonical store.
    const activeSuperAdmins = this.getActiveSuperAdmins();
    if (activeSuperAdmins.length > 0) {
      // Normal runtime: Superadmin authority already established. Do NOT create or re-elevate accounts.
      return;
    }

    // Initial deployment bootstrap:
    const bootstrapUid = "usr_superadmin_bootstrap";
    const now = new Date().toISOString();
    const superAdminUser: UserAccount = {
      uid: bootstrapUid,
      email: BOOTSTRAP_SUPERADMIN_EMAIL,
      displayName: "Sagar Rana (Platform Founder)",
      status: "ACTIVE",
      role: "super_admin",
      roles: ["super_admin"],
      createdAt: now,
      updatedAt: now,
      profileVersion: 1,
      securityVersion: 1,
      primaryLanguage: "ne",
      publicProfileVisibility: "PUBLIC"
    };
    this.users.set(bootstrapUid, superAdminUser);
    this.saveStoresSync();

    this.logAudit({
      actorUid: "SYSTEM_BOOTSTRAP",
      actorRole: "system",
      action: "INITIAL_SUPERADMIN_BOOTSTRAPPED",
      targetUid: bootstrapUid,
      details: { email: BOOTSTRAP_SUPERADMIN_EMAIL, reason: "Zero active superadmins found during boot" }
    });
  }

  private sanitizeAuditPayload(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeAuditPayload(item));
    const clean: Record<string, any> = {};
    const sensitive = ["password", "token", "secret", "fcmtoken", "apikey", "authorization", "bearer", "credential", "privatekey"];
    for (const [k, v] of Object.entries(obj)) {
      if (sensitive.some(s => k.toLowerCase().includes(s))) {
        clean[k] = "[REDACTED_SECRET]";
      } else if (typeof v === "object" && v !== null) {
        clean[k] = this.sanitizeAuditPayload(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  // --- AUDIT TRAIL LOGGING ---
  public logAudit(entry: {
    actorUid: string;
    actorRole: string;
    action: string;
    targetUid: string;
    before?: any;
    after?: any;
    details?: any;
  }): IamAuditLog {
    let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";
    if (this.auditLogs.length > 0) {
      previousHash = this.auditLogs[0].hash;
    }

    const sanitizedBefore = this.sanitizeAuditPayload(entry.before);
    const sanitizedAfter = this.sanitizeAuditPayload(entry.after);
    const sanitizedDetails = this.sanitizeAuditPayload(entry.details);

    const timestamp = new Date().toISOString();
    const id = `iam_audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const hashPayload = `${previousHash}|${timestamp}|${entry.actorUid}|${entry.action}|${entry.targetUid}|${JSON.stringify(sanitizedDetails || {})}`;
    const hash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    const fullEntry: IamAuditLog = {
      id,
      timestamp,
      actorUid: entry.actorUid,
      actorRole: entry.actorRole,
      action: entry.action,
      targetUid: entry.targetUid,
      before: sanitizedBefore,
      after: sanitizedAfter,
      details: sanitizedDetails,
      hash,
      previousHash
    };

    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 1000) {
      this.auditLogs.pop();
    }
    this.saveStoresSync();
    return fullEntry;
  }

  public getAuditLogs(options?: { targetUid?: string; limit?: number }): IamAuditLog[] {
    let logs = this.auditLogs;
    if (options?.targetUid) {
      logs = logs.filter(l => l.targetUid === options.targetUid);
    }
    return logs.slice(0, options?.limit || 50);
  }

  // --- USER RECORD RETRIEVAL & PROVISIONING ---
  public getUser(uid: string): UserAccount | undefined {
    return this.users.get(uid);
  }

  public getUserByEmail(email: string): UserAccount | undefined {
    const cleanEmail = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email?.toLowerCase().trim() === cleanEmail) {
        return u;
      }
    }
    return undefined;
  }

  public provisionUser(params: {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    primaryLanguage?: "ne" | "en" | "hi";
  }): UserAccount {
    const cleanEmail = params.email?.toLowerCase().trim();
    
    // Strict Anti-Escalation Rule:
    // Only bootstrap condition (zero active superadmins) allows bootstrap email to receive super_admin.
    // In normal runtime (when at least one superadmin exists), signing up with ANY email yields 'member'.
    const isBootstrapCondition = this.getActiveSuperAdmins().length === 0 && cleanEmail === BOOTSTRAP_SUPERADMIN_EMAIL.toLowerCase();
    const initialRole = isBootstrapCondition ? "super_admin" : "member";

    const now = new Date().toISOString();
    const newAccount: UserAccount = {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName || params.email?.split("@")[0] || "प्रयोगकर्ता",
      photoURL: params.photoURL,
      status: "ACTIVE",
      role: initialRole,
      roles: [initialRole],
      customPermissions: [],
      createdAt: now,
      updatedAt: now,
      profileVersion: 1,
      securityVersion: 1,
      primaryLanguage: params.primaryLanguage || "ne",
      publicProfileVisibility: "PUBLIC"
    };

    this.users.set(params.uid, newAccount);
    this.saveStoresSync();

    this.logAudit({
      actorUid: params.uid,
      actorRole: initialRole,
      action: "USER_PROVISIONED",
      targetUid: params.uid,
      details: { email: params.email, role: initialRole, isBootstrap: isBootstrapCondition }
    });

    return newAccount;
  }

  // --- USER PROFILE MUTATION (FIELD MUTATION POLICY ENFORCEMENT) ---
  public updateUserProfile(uid: string, fields: Record<string, any>): { success: boolean; user?: UserAccount; error?: string } {
    const existing = this.users.get(uid);
    if (!existing) {
      return { success: false, error: "USER_NOT_FOUND" };
    }

    if (existing.status === "DISABLED" || existing.status === "BANNED") {
      return { success: false, error: "ACCOUNT_RESTRICTED" };
    }

    // Audit unauthorized field mutation attempts if suspicious privileged keys are present
    const suspiciousKeys = ["role", "roles", "customPermissions", "status", "securityVersion", "uid", "createdAt"];
    const attemptedSuspicious = suspiciousKeys.filter(k => k in fields);
    if (attemptedSuspicious.length > 0) {
      this.logAudit({
        actorUid: uid,
        actorRole: existing.role,
        action: "AUDIT_UNAUTHORIZED_PROFILE_FIELD_MUTATION_ATTEMPT",
        targetUid: uid,
        details: { attemptedKeys: attemptedSuspicious }
      });
    }

    // Explicit Field Mutation Filter:
    // Only fields marked USER_EDITABLE are accepted from general profile update.
    // Privileged fields (role, roles, customPermissions, status, securityVersion, uid, createdAt) are strictly rejected/ignored.
    let mutated = false;
    const beforeState = { displayName: existing.displayName, bio: existing.bio, district: existing.district };

    for (const [key, val] of Object.entries(fields)) {
      const policy = CANONICAL_FIELD_POLICIES[key];
      if (policy === "USER_EDITABLE") {
        if (key === "displayName" && typeof val === "string") {
          existing.displayName = val.trim().slice(0, 100);
          mutated = true;
        } else if (key === "avatar" || key === "photoURL") {
          // Validate URL format (no raw data URIs > 1MB)
          if (typeof val === "string" && !val.startsWith("data:image/")) {
            existing.avatar = val;
            existing.photoURL = val;
            mutated = true;
          }
        } else if (key === "bio" && typeof val === "string") {
          existing.bio = val.slice(0, 500);
          mutated = true;
        } else if (key === "district" && typeof val === "string") {
          existing.district = val.trim();
          mutated = true;
        } else if (key === "location" && typeof val === "string") {
          existing.location = val.trim();
          mutated = true;
        } else if (key === "website" && typeof val === "string") {
          existing.website = val.trim();
          mutated = true;
        } else if (key === "socialLinks" && typeof val === "object" && val !== null) {
          existing.socialLinks = val;
          mutated = true;
        } else if (key === "primaryLanguage" && (val === "ne" || val === "en" || val === "hi")) {
          existing.primaryLanguage = val;
          mutated = true;
        } else if (key === "publicProfileVisibility" && (val === "PUBLIC" || val === "MEMBERS_ONLY" || val === "PRIVATE")) {
          existing.publicProfileVisibility = val;
          mutated = true;
        } else if (key === "notificationPreferences" && typeof val === "object" && val !== null) {
          existing.notificationPreferences = {
            pushEnabled: !!val.pushEnabled,
            categories: Array.isArray(val.categories) ? val.categories : [],
            digest: val.digest || "daily",
            breakingNews: val.breakingNews !== false
          };
          mutated = true;
        }
      }
    }

    if (mutated) {
      existing.updatedAt = new Date().toISOString();
      existing.profileVersion = (existing.profileVersion || 1) + 1;
      this.saveStoresSync();

      this.logAudit({
        actorUid: uid,
        actorRole: existing.role,
        action: "PROFILE_UPDATED",
        targetUid: uid,
        before: beforeState,
        after: { displayName: existing.displayName, bio: existing.bio, district: existing.district }
      });
    }

    return { success: true, user: existing };
  }

  // --- USER STATUS MANAGEMENT & LAST-SUPERADMIN INVARIANT ---
  public async updateUserStatus(
    actor: { uid: string; role: string; email?: string },
    targetUid: string,
    newStatus: UserAccountStatus,
    reason?: string,
    expectedSecurityVersion?: number
  ): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    const target = this.users.get(targetUid);
    if (!target) {
      return { success: false, error: "TARGET_USER_NOT_FOUND" };
    }

    // Optimistic Concurrency Check:
    if (expectedSecurityVersion !== undefined && expectedSecurityVersion !== target.securityVersion) {
      return { 
        success: false, 
        error: `SECURITY_VERSION_CONFLICT: Expected securityVersion ${expectedSecurityVersion} but target is at ${target.securityVersion}` 
      };
    }

    // Last Superadmin Invariant:
    // If target is super_admin and status is changing to DISABLED, BANNED, or DELETED,
    // ensure at least one other active super_admin exists.
    if (target.role === "super_admin" && (newStatus === "DISABLED" || newStatus === "BANNED" || newStatus === "DELETED")) {
      const activeSuperAdmins = this.getActiveSuperAdmins();
      if (activeSuperAdmins.length <= 1 && activeSuperAdmins.some(u => u.uid === targetUid)) {
        this.logAudit({
          actorUid: actor.uid,
          actorRole: actor.role,
          action: "AUDIT_LAST_SUPERADMIN_PROTECTION_TRIGGERED",
          targetUid,
          details: { attempt: `Attempted to set status ${newStatus} on the last active super_admin` }
        });
        return { 
          success: false, 
          error: "LAST_SUPERADMIN_PROTECTED: Cannot disable or ban the last remaining active super_admin" 
        };
      }
    }

    const beforeStatus = target.status;
    target.status = newStatus;
    target.updatedAt = new Date().toISOString();
    target.securityVersion = (target.securityVersion || 1) + 1; // Increment security version on status change

    // If disabled or banned, revoke active sessions
    if (newStatus === "DISABLED" || newStatus === "BANNED") {
      this.revokeAllUserSessionsInternal(targetUid);
    }

    this.saveStoresSync();

    this.logAudit({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: "USER_STATUS_CHANGED",
      targetUid,
      before: { status: beforeStatus },
      after: { status: newStatus },
      details: { reason }
    });

    return { success: true, user: target };
  }

  // --- ROLE ASSIGNMENT & ELEVATION SAFETY ---
  public async assignUserRole(
    actor: { uid: string; role: string; email?: string; effectivePermissions?: Set<string> },
    targetUid: string,
    roleToAssign: string,
    expectedSecurityVersion?: number
  ): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    const target = this.users.get(targetUid);
    if (!target) {
      return { success: false, error: "TARGET_USER_NOT_FOUND" };
    }

    // Optimistic Concurrency Check:
    if (expectedSecurityVersion !== undefined && expectedSecurityVersion !== target.securityVersion) {
      return { 
        success: false, 
        error: `SECURITY_VERSION_CONFLICT: Expected securityVersion ${expectedSecurityVersion} but target is at ${target.securityVersion}` 
      };
    }

    // Role Definition Check
    const roleDef = ROLE_DEFINITIONS[roleToAssign];
    if (!roleDef && roleToAssign !== "super_admin") {
      return { success: false, error: `INVALID_ROLE: Role '${roleToAssign}' does not exist in registry` };
    }

    // Superadmin Elevation Policy:
    // ONLY an existing super_admin can assign the 'super_admin' role. Regular admins CANNOT.
    if (roleToAssign === "super_admin" && actor.role !== "super_admin") {
      this.logAudit({
        actorUid: actor.uid,
        actorRole: actor.role,
        action: "AUDIT_SUPERADMIN_ELEVATION_DENIED",
        targetUid,
        details: { attempt: `Actor with role '${actor.role}' attempted to elevate target to 'super_admin'` }
      });
      return { 
        success: false, 
        error: "SUPERADMIN_ELEVATION_FORBIDDEN: Only an active super_admin can elevate accounts to super_admin" 
      };
    }

    // Privilege Escalation Prevention:
    // Non-superadmin actor cannot assign roles with governance rank equal or higher than their own
    const actorRank = this.getRoleRank(actor.role);
    const targetRoleRank = this.getRoleRank(roleToAssign);
    if (actor.role !== "super_admin" && targetRoleRank >= actorRank) {
      return { 
        success: false, 
        error: `PRIVILEGE_ESCALATION_BLOCKED: Cannot assign role with rank >= your own (${actor.role})` 
      };
    }

    const beforeRole = target.role;
    target.role = roleToAssign as any;
    if (!target.roles) target.roles = [];
    if (!target.roles.includes(roleToAssign as any)) {
      target.roles.push(roleToAssign as any);
    }
    
    target.updatedAt = new Date().toISOString();
    target.securityVersion = (target.securityVersion || 1) + 1; // Increment securityVersion to invalidate stale tokens/caches
    this.saveStoresSync();

    this.logAudit({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: "ROLE_ASSIGNED",
      targetUid,
      before: { role: beforeRole },
      after: { role: roleToAssign }
    });

    return { success: true, user: target };
  }

  public async removeUserRole(
    actor: { uid: string; role: string },
    targetUid: string,
    roleToRemove: string
  ): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
    const target = this.users.get(targetUid);
    if (!target) {
      return { success: false, error: "TARGET_USER_NOT_FOUND" };
    }

    // Last Superadmin Invariant:
    // If removing super_admin role, ensure target is not the last remaining active super_admin.
    if (roleToRemove === "super_admin") {
      const activeSuperAdmins = this.getActiveSuperAdmins();
      if (activeSuperAdmins.length <= 1 && activeSuperAdmins.some(u => u.uid === targetUid)) {
        this.logAudit({
          actorUid: actor.uid,
          actorRole: actor.role,
          action: "AUDIT_LAST_SUPERADMIN_DEMOTION_PREVENTED",
          targetUid,
          details: { attempt: "Attempted to remove super_admin from the sole active super_admin" }
        });
        return { 
          success: false, 
          error: "LAST_SUPERADMIN_PROTECTED: Cannot remove super_admin role from the last active super_admin" 
        };
      }
    }

    const beforeRole = target.role;
    if (target.roles) {
      target.roles = target.roles.filter(r => r !== roleToRemove);
    }
    if (target.role === roleToRemove) {
      target.role = (target.roles && target.roles[0]) ? target.roles[0] : "member";
    }

    target.updatedAt = new Date().toISOString();
    target.securityVersion = (target.securityVersion || 1) + 1;
    this.saveStoresSync();

    this.logAudit({
      actorUid: actor.uid,
      actorRole: actor.role,
      action: "ROLE_REMOVED",
      targetUid,
      before: { role: beforeRole },
      after: { role: target.role, roles: target.roles }
    });

    return { success: true, user: target };
  }

  // --- EFFECTIVE PERMISSION RESOLUTION ---
  public resolveEffectivePermissions(
    uid: string,
    tenantId?: string,
    clientSecurityVersion?: number
  ): EffectivePermissionsResult {
    const user = this.users.get(uid);
    if (!user) {
      return {
        uid,
        roles: ["public"],
        permissions: [],
        securityVersion: 1,
        status: "ACTIVE",
        isSuperAdmin: false,
        isAdmin: false,
        capabilities: this.deriveCapabilities(new Set(), false, false),
        evaluatedAt: new Date().toISOString()
      };
    }

    // Check account status restriction: DISABLED or BANNED users have zero active permissions
    if (user.status === "DISABLED" || user.status === "BANNED") {
      return {
        uid,
        roles: [user.role],
        permissions: [],
        securityVersion: user.securityVersion,
        status: user.status,
        isSuperAdmin: false,
        isAdmin: false,
        capabilities: this.deriveCapabilities(new Set(), false, false),
        evaluatedAt: new Date().toISOString()
      };
    }

    const effectivePerms = new Set<string>();
    const rolesList = user.roles && user.roles.length > 0 ? user.roles : [user.role];

    const isSuperAdmin = rolesList.includes("super_admin");
    const isAdmin = isSuperAdmin || rolesList.includes("admin") || rolesList.includes("editorial_admin");

    if (isSuperAdmin) {
      effectivePerms.add("*");
      CANONICAL_PERMISSIONS_REGISTRY.forEach(p => effectivePerms.add(p.key));
    } else {
      // Aggregate permissions across assigned roles
      for (const r of rolesList) {
        const rDef = ROLE_DEFINITIONS[r];
        if (rDef && Array.isArray(rDef.permissions)) {
          rDef.permissions.forEach(p => effectivePerms.add(p));
        }
      }
    }

    // Tenant-scoped permissions
    if (tenantId && user.tenantMemberships && user.tenantMemberships[tenantId]) {
      const membership = user.tenantMemberships[tenantId];
      if ((membership.status as string) === "active" || (membership.status as string) === "ACTIVE") {
        if (Array.isArray(membership.permissions)) {
          membership.permissions.forEach(p => effectivePerms.add(p));
        }
        if (Array.isArray(membership.roles)) {
          membership.roles.forEach(r => {
            const tDef = ROLE_DEFINITIONS[r];
            if (tDef) tDef.permissions.forEach(p => effectivePerms.add(p));
          });
        }
      }
    }

    // Custom Permissions & Explicit DENY overrides
    // Permissions prefixed with '-' are explicit DENYs that remove granted permissions
    if (Array.isArray(user.customPermissions)) {
      for (const cp of user.customPermissions) {
        if (cp.startsWith("-")) {
          const toRemove = cp.substring(1);
          effectivePerms.delete(toRemove);
        } else {
          // Strictly reject unknown permission keys or malformed wildcards
          if (CANONICAL_PERMISSIONS_REGISTRY.some(p => p.key === cp)) {
            effectivePerms.add(cp);
          }
        }
      }
    }

    const permissionsArray = Array.from(effectivePerms);
    const capabilities = this.deriveCapabilities(effectivePerms, isSuperAdmin, isAdmin);

    return {
      uid,
      roles: rolesList,
      permissions: permissionsArray,
      tenantId: tenantId || user.tenantId,
      securityVersion: user.securityVersion,
      status: user.status,
      isSuperAdmin,
      isAdmin,
      capabilities,
      evaluatedAt: new Date().toISOString()
    };
  }

  public hasPermission(uid: string, permission: string, tenantId?: string): boolean {
    // Unknown permissions fail closed immediately
    if (permission !== "*" && !CANONICAL_PERMISSIONS_REGISTRY.some(p => p.key === permission)) {
      return false;
    }
    const resolved = this.resolveEffectivePermissions(uid, tenantId);
    if (resolved.isSuperAdmin) return true;
    return resolved.permissions.includes(permission);
  }

  private deriveCapabilities(perms: Set<string>, isSuperAdmin: boolean, isAdmin: boolean): ClientCapabilityProjection {
    if (isSuperAdmin) {
      return {
        canView: true,
        canEdit: true,
        canPublish: true,
        canDelete: true,
        canModerate: true,
        canManageUsers: true,
        canManageRoles: true,
        canManageSettings: true,
        canManageRevenue: true,
        canVerifySGIS: true,
        canManageAcademy: true,
        _source: "UX_HINT_ONLY"
      };
    }

    return {
      canView: true,
      canEdit: perms.has("news.edit") || perms.has("news.create"),
      canPublish: perms.has("news.publish") || perms.has("events.publish"),
      canDelete: perms.has("news.delete") || perms.has("events.delete"),
      canModerate: perms.has("community.moderate"),
      canManageUsers: perms.has("users.manage"),
      canManageRoles: perms.has("roles.manage"),
      canManageSettings: perms.has("settings.manage"),
      canManageRevenue: perms.has("revenue.view") || perms.has("ads.manage"),
      canVerifySGIS: perms.has("sgis.verify"),
      canManageAcademy: perms.has("academy.manage"),
      _source: "UX_HINT_ONLY"
    };
  }

  // --- SESSION OPERATIONS & REVOCATION ---
  public recordSession(uid: string, sessionInfo: {
    sessionId?: string;
    deviceClass?: "desktop" | "mobile" | "tablet" | "unknown";
    clientLabel?: string;
    userAgentSummary?: string;
  }): UserSession {
    const user = this.users.get(uid);
    const securityVersion = user ? user.securityVersion : 1;
    const now = new Date().toISOString();

    const sessionId = sessionInfo.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const session: UserSession = {
      sessionId,
      uid,
      createdAt: now,
      lastSeenAt: now,
      deviceClass: sessionInfo.deviceClass || "desktop",
      clientLabel: sessionInfo.clientLabel || "Web Browser",
      userAgentSummary: sessionInfo.userAgentSummary || "SanatanMarga Web Client",
      securityVersion
    };

    const userSessions = this.sessions.get(uid) || [];
    // Update existing or push new
    const idx = userSessions.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      userSessions[idx].lastSeenAt = now;
    } else {
      userSessions.unshift(session);
      if (userSessions.length > 20) {
        userSessions.pop(); // Bound to last 20 sessions per user
      }
    }

    this.sessions.set(uid, userSessions);
    this.saveStoresSync();
    return session;
  }

  public getUserSessions(uid: string): UserSession[] {
    return this.sessions.get(uid) || [];
  }

  public async revokeAllUserSessions(
    actorUid: string,
    targetUid: string,
    reason?: string
  ): Promise<{ success: boolean; revokedCount: number }> {
    const user = this.users.get(targetUid);
    if (!user) {
      return { success: false, revokedCount: 0 };
    }

    const count = this.revokeAllUserSessionsInternal(targetUid);
    user.securityVersion = (user.securityVersion || 1) + 1; // Increment securityVersion
    user.updatedAt = new Date().toISOString();
    this.saveStoresSync();

    this.logAudit({
      actorUid,
      actorRole: this.users.get(actorUid)?.role || "system",
      action: "SESSIONS_REVOKE_ALL",
      targetUid,
      details: { revokedCount: count, reason }
    });

    return { success: true, revokedCount: count };
  }

  private revokeAllUserSessionsInternal(targetUid: string): number {
    const userSessions = this.sessions.get(targetUid) || [];
    const now = new Date().toISOString();
    let count = 0;
    userSessions.forEach(s => {
      if (!s.revokedAt) {
        s.revokedAt = now;
        count++;
      }
    });
    this.sessions.set(targetUid, userSessions);
    return count;
  }

  public async revokeSingleSession(
    actorUid: string,
    targetUid: string,
    sessionId: string
  ): Promise<{ success: boolean }> {
    const userSessions = this.sessions.get(targetUid) || [];
    const targetSession = userSessions.find(s => s.sessionId === sessionId);
    if (!targetSession) {
      return { success: false };
    }

    targetSession.revokedAt = new Date().toISOString();
    this.saveStoresSync();

    this.logAudit({
      actorUid,
      actorRole: this.users.get(actorUid)?.role || "system",
      action: "SESSION_REVOKED",
      targetUid,
      details: { sessionId }
    });

    return { success: true };
  }

  public isSessionRevoked(uid: string, sessionId: string): boolean {
    const userSessions = this.sessions.get(uid) || [];
    const targetSession = userSessions.find(s => s.sessionId === sessionId);
    if (!targetSession) return true; // Session not found -> invalid
    if (targetSession.revokedAt) return true;
    const user = this.users.get(uid);
    if (user && targetSession.securityVersion < user.securityVersion) return true;
    return false;
  }

  public validateSession(uid: string, sessionId: string): { valid: boolean; reason?: string; session?: UserSession } {
    const userSessions = this.sessions.get(uid) || [];
    const targetSession = userSessions.find(s => s.sessionId === sessionId);

    // Cross-user session spoofing check
    if (!targetSession) {
      for (const [otherUid, otherSessions] of this.sessions.entries()) {
        if (otherUid !== uid && otherSessions.some(s => s.sessionId === sessionId)) {
          return { valid: false, reason: "CROSS_USER_SESSION_SPOOF_DETECTED" };
        }
      }
      return { valid: false, reason: "UNKNOWN_SESSION_NOT_FOUND" };
    }

    if (targetSession.revokedAt) {
      return { valid: false, reason: "SESSION_REVOKED", session: targetSession };
    }

    const user = this.users.get(uid);
    if (user && targetSession.securityVersion < user.securityVersion) {
      return { valid: false, reason: "SESSION_SECURITY_VERSION_STALE", session: targetSession };
    }

    return { valid: true, session: targetSession };
  }

  // --- ADMIN USER DIRECTORY SEARCH & PAGINATION ---
  public listUsers(options: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): { users: UserAccount[]; total: number; page: number; limit: number } {
    let list = Array.from(this.users.values());

    if (options.role) {
      list = list.filter(u => u.role === options.role || (u.roles && u.roles.includes(options.role as any)));
    }

    if (options.status) {
      list = list.filter(u => u.status === options.status);
    }

    if (options.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(u => 
        u.uid.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.district && u.district.toLowerCase().includes(q))
      );
    }

    const total = list.length;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const pagedUsers = list.slice(offset, offset + limit);
    return { users: pagedUsers, total, page, limit };
  }

  // --- DIAGNOSTICS & RECONCILIATION ---
  public getActiveSuperAdmins(): UserAccount[] {
    return Array.from(this.users.values()).filter(
      u => u.role === "super_admin" && u.status === "ACTIVE"
    );
  }

  public checkTokenClaimsFreshness(uid: string, tokenClaims: { role?: string; securityVersion?: number }): {
    fresh: boolean;
    reason?: "STALE_CUSTOM_CLAIMS" | "SECURITY_VERSION_MISMATCH" | "STATUS_RESTRICTED" | "USER_NOT_FOUND";
    canonicalRole: string;
    canonicalSecurityVersion: number;
  } {
    const user = this.users.get(uid);
    if (!user) {
      return { fresh: false, reason: "USER_NOT_FOUND", canonicalRole: "member", canonicalSecurityVersion: 1 };
    }
    if (user.status === "DISABLED" || user.status === "BANNED") {
      return { fresh: false, reason: "STATUS_RESTRICTED", canonicalRole: user.role, canonicalSecurityVersion: user.securityVersion };
    }
    if (tokenClaims.securityVersion !== undefined && tokenClaims.securityVersion < user.securityVersion) {
      return { fresh: false, reason: "SECURITY_VERSION_MISMATCH", canonicalRole: user.role, canonicalSecurityVersion: user.securityVersion };
    }
    if (tokenClaims.role && tokenClaims.role !== user.role) {
      return { fresh: false, reason: "STALE_CUSTOM_CLAIMS", canonicalRole: user.role, canonicalSecurityVersion: user.securityVersion };
    }
    return { fresh: true, canonicalRole: user.role, canonicalSecurityVersion: user.securityVersion };
  }

  public getIamHealth(): {
    status: "healthy" | "attention_required";
    totalUsers: number;
    activeSuperAdmins: number;
    lastSuperAdminProtected: boolean;
    disabledUsersWithSessions: number;
    staleCustomClaimsCount: number;
    auditLogsCount: number;
  } {
    const totalUsers = this.users.size;
    const activeSuperAdmins = this.getActiveSuperAdmins().length;
    let disabledUsersWithSessions = 0;

    for (const [uid, sessions] of this.sessions.entries()) {
      const u = this.users.get(uid);
      if (u && (u.status === "DISABLED" || u.status === "BANNED")) {
        const hasActive = sessions.some(s => !s.revokedAt);
        if (hasActive) disabledUsersWithSessions++;
      }
    }

    const status = (activeSuperAdmins >= 1 && disabledUsersWithSessions === 0) ? "healthy" : "attention_required";

    return {
      status,
      totalUsers,
      activeSuperAdmins,
      lastSuperAdminProtected: activeSuperAdmins >= 1,
      disabledUsersWithSessions,
      staleCustomClaimsCount: 0,
      auditLogsCount: this.auditLogs.length
    };
  }

  public reconcileAuthAndProfiles(authUsers: Array<{ uid: string; email?: string }>): {
    healthyCount: number;
    authOnly: string[];
    profileOnly: string[];
    lastSuperAdminCount: number;
  } {
    const authMap = new Map<string, string>();
    authUsers.forEach(u => authMap.set(u.uid, u.email || ""));

    const authOnly: string[] = [];
    const profileOnly: string[] = [];
    let healthyCount = 0;

    // Check auth users against profile store
    for (const [uid, email] of authMap.entries()) {
      if (this.users.has(uid)) {
        healthyCount++;
      } else {
        authOnly.push(uid);
      }
    }

    // Check profile store against auth
    for (const uid of this.users.keys()) {
      if (!authMap.has(uid)) {
        profileOnly.push(uid);
      }
    }

    return {
      healthyCount,
      authOnly,
      profileOnly,
      lastSuperAdminCount: this.getActiveSuperAdmins().length
    };
  }

  private getRoleRank(role: string): number {
    const ranks: Record<string, number> = {
      super_admin: 100,
      admin: 80,
      editorial_admin: 70,
      senior_editor: 60,
      editor: 50,
      reporter: 40,
      contributor: 30,
      revenue_manager: 30,
      moderator: 30,
      member: 20,
      user: 20,
      public: 10,
      guest: 10
    };
    return ranks[role] || 10;
  }
}

export const serverIamOS = new ServerIamOS();
