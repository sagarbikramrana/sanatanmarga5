import { Request, Response, NextFunction } from "express";
import { ROLE_DEFINITIONS, UserPermission } from "../../src/constants/permissions";
import { serverIamOS } from "../iamOs";
import crypto from "crypto";

function computeSHA256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export const ROLE_HIERARCHY_RANKS: Record<string, number> = {
  super_admin: 100,
  admin: 80,
  senior_editor: 60,
  chief_editor: 60,
  editor: 50,
  district_editor: 45,
  reporter: 40,
  journalist: 40,
  contributor: 30,
  revenue_manager: 30,
  moderator: 30,
  fact_checker: 30,
  photographer: 30,
  video_editor: 30,
  advertiser: 20,
  subscriber: 20,
  member: 20,
  user: 20,
  public: 10,
  guest: 10,
};

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  tenantId: string;
  status: "active" | "suspended" | "banned";
  membershipTier: string;
  reputationScore: number;
  customPermissions: string[];
  effectivePermissions: Set<string>;
  isImpersonating?: boolean;
  originalUid?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetUid?: string;
  targetType?: string;
  resourceId?: string;
  before?: any;
  after?: any;
  details?: any;
  ip?: string;
  status: "SUCCESS" | "DENIED" | "FAILED";
  hash?: string;
  previousHash?: string;
}

// In-Memory Audit Trail Cache (max 500 recent entries)
const inMemoryAuditLogs: AuditLogEntry[] = [];

/**
 * Log a governance audit event to Firestore audit_logs collection & in-memory buffer
 */
export async function logAuditEvent(
  adminDb: any,
  entry: Omit<AuditLogEntry, "id" | "timestamp" | "hash" | "previousHash">
): Promise<AuditLogEntry> {
  let previousHash = "0000000000000000000000000000000000000000000000000000000000000000";
  if (adminDb) {
    try {
      const lastLogSnap = await adminDb.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
      if (!lastLogSnap.empty) {
        previousHash = lastLogSnap.docs[0].data().hash || previousHash;
      }
    } catch (e) {
      console.warn("[AuditOS] Failed to fetch last audit log for cascading hash:", e);
    }
  }

  const timestamp = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  // Compute block-by-block secure SHA-256 cascading hash
  const hashInput = `${previousHash}|${timestamp}|${entry.actorUid}|${entry.action}|${JSON.stringify(entry.details || {})}`;
  const currentHash = computeSHA256(hashInput);

  const fullLog: AuditLogEntry = {
    id,
    timestamp,
    ...entry,
    hash: currentHash,
    previousHash
  };

  // Add to in-memory cache (unshift to top)
  inMemoryAuditLogs.unshift(fullLog);
  if (inMemoryAuditLogs.length > 500) {
    inMemoryAuditLogs.pop();
  }

  // Persist to Firestore if available
  if (adminDb) {
    try {
      await adminDb.collection("audit_logs").doc(fullLog.id).set(fullLog);
      // Double write to auditLogs collection for public client view integration
      await adminDb.collection("auditLogs").doc(fullLog.id).set({
        action: fullLog.action,
        userId: fullLog.actorUid,
        userEmail: fullLog.actorEmail,
        userName: fullLog.actorEmail.split("@")[0],
        metadata: fullLog.details || {},
        timestamp: fullLog.timestamp,
        hash: fullLog.hash,
        previousHash: fullLog.previousHash
      });
    } catch (err) {
      console.warn("[AuditOS] Failed to write audit log to Firestore:", err);
    }
  }

  return fullLog;
}

export function getInMemoryAuditLogs(): AuditLogEntry[] {
  return inMemoryAuditLogs;
}

// In-memory user document cache to prevent exhausting Firestore read quota on every API request
const userProfileCache = new Map<string, { data: any; fetchedAt: number }>();
const USER_PROFILE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Authenticate request header & retrieve current User document from Firestore or Auth Token
 */
export async function authenticateRequestUser(
  req: Request,
  adminApp: any,
  adminDb: any
): Promise<AuthenticatedUser | null> {
  // Test/Development bypass header for smoke & integration test actors
  if (req.headers["x-authenticated-user"]) {
    try {
      const parsed = JSON.parse(String(req.headers["x-authenticated-user"]));
      if (parsed && parsed.role) {
        const uid = parsed.uid || "test_actor";
        const incomingSessionId = (req.headers["x-session-id"] ? String(req.headers["x-session-id"]) : undefined) || parsed.sessionId;
        if (incomingSessionId) {
          const sessionValidation = serverIamOS.validateSession(uid, incomingSessionId);
          if (!sessionValidation.valid) {
            return null; // Deny revoked / spoofed session
          }
        }
        const role = parsed.role;
        const effectivePermissions = new Set<string>();
        const roleDef = ROLE_DEFINITIONS[role];
        if (roleDef) {
          roleDef.permissions.forEach((p: string) => effectivePermissions.add(p));
        }
        return {
          uid,
          email: parsed.email || "actor@sanatanmarga.com",
          displayName: parsed.displayName || "Test Actor",
          role,
          tenantId: parsed.tenantId || "sanatan-media",
          status: "active",
          membershipTier: "editorial",
          reputationScore: 100,
          customPermissions: [],
          effectivePermissions
        };
      }
    } catch (e) {}
  }

  if (!adminApp) return null;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = (decodedToken.email || "").toLowerCase().trim();

    let userDoc: any = null;
    const cachedProfile = userProfileCache.get(uid);
    if (cachedProfile && Date.now() - cachedProfile.fetchedAt < USER_PROFILE_CACHE_TTL_MS) {
      userDoc = cachedProfile.data;
    } else if (adminDb) {
      try {
        const snap = await adminDb.collection("users").doc(uid).get();
        if (snap.exists) {
          userDoc = snap.data();
          userProfileCache.set(uid, { data: userDoc, fetchedAt: Date.now() });
        }
      } catch (dbErr: any) {
        // Gracefully continue if Firestore quota is exceeded so valid Firebase tokens never fail with 401
        if (cachedProfile) {
          userDoc = cachedProfile.data;
        }
      }
    }

    // Canonical IAM store query (primary authority)
    const iamUser = serverIamOS.getUser(uid);

    // If account is disabled or banned in canonical store, deny permissions immediately
    if (iamUser && (iamUser.status === "DISABLED" || iamUser.status === "BANNED")) {
      return {
        uid,
        email,
        displayName: iamUser.displayName || decodedToken.name || "User",
        role: iamUser.role || "member",
        tenantId: iamUser.tenantId || decodedToken.tenantId || "sanatan-media",
        status: "banned",
        membershipTier: "free",
        reputationScore: 0,
        customPermissions: [],
        effectivePermissions: new Set<string>() // Zero permissions for restricted account
      };
    }

    // App-Level Session Binding & Revocation Check
    const incomingSessionId = req.headers["x-session-id"] ? String(req.headers["x-session-id"]) : undefined;
    if (incomingSessionId && iamUser) {
      const sessionValidation = serverIamOS.validateSession(uid, incomingSessionId);
      if (!sessionValidation.valid) {
        return null; // Session revoked, spoofed, or stale -> deny request immediately
      }
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || "sagarrana@gmail.com").toLowerCase().trim();
    const isSuperAdminEmail =
      email === configuredAdminEmail ||
      email === "sagarrana@gmail.com" ||
      email === "omsanatanmarga@gmail.com";

    // Role Authority: Canonical IAM store ALWAYS overrides token claims and unverified Firestore docs
    const role = iamUser?.role || userDoc?.role || (isSuperAdminEmail ? "super_admin" : (decodedToken.role || "member"));
    const tenantId = iamUser?.tenantId || userDoc?.tenantId || decodedToken.tenantId || "sanatan-media";
    const status = iamUser ? (iamUser.status === "ACTIVE" ? "active" : "banned") : (userDoc?.status || "active");
    const membershipTier = userDoc?.membershipTier || (isSuperAdminEmail ? "patron" : "free");
    const reputationScore = typeof userDoc?.reputationScore === "number" ? userDoc.reputationScore : 0;
    const customPermissions = iamUser?.customPermissions || (Array.isArray(userDoc?.customPermissions) ? userDoc.customPermissions : []);

    // Calculate effective permissions set via canonical IAM resolver if user exists in IAM store
    let effectivePermissions = new Set<string>();
    if (iamUser) {
      const resolved = serverIamOS.resolveEffectivePermissions(uid, tenantId);
      resolved.permissions.forEach(p => effectivePermissions.add(p));
    } else {
      const roleDef = ROLE_DEFINITIONS[role];
      if (roleDef) {
        roleDef.permissions.forEach((p) => effectivePermissions.add(p));
      }
      customPermissions.forEach((p) => effectivePermissions.add(p));
    }

    return {
      uid,
      email,
      displayName: iamUser?.displayName || userDoc?.displayName || decodedToken.name || email.split("@")[0] || "User",
      role,
      tenantId,
      status,
      membershipTier,
      reputationScore,
      customPermissions,
      effectivePermissions,
      isImpersonating: !!userDoc?.isImpersonating,
      originalUid: userDoc?.originalUid,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Check if the actor is permitted to perform actions on a target role (Privilege Escalation Protection)
 */
export function isPrivilegeAllowed(actorRole: string, targetRole: string): boolean {
  if (actorRole === "super_admin") return true;
  const actorRank = ROLE_HIERARCHY_RANKS[actorRole] || 10;
  const targetRank = ROLE_HIERARCHY_RANKS[targetRole] || 10;
  return actorRank > targetRank;
}

/**
 * Reputation Anti-Abuse Layer Daily Caps
 */
export const DAILY_REPUTATION_CAPS = {
  COMMUNITY_COMMENT: 20, // Max 20 points per day from comments
  COMMUNITY_POST: 10,    // Max 10 points per day from posts
  HELPFUL_ANSWER: 15,    // Max 15 points per day from answers
} as const;

export async function awardReputationPointsWithAntiAbuse(
  adminDb: any,
  uid: string,
  actionType: keyof typeof DAILY_REPUTATION_CAPS,
  pointsToAward: number
): Promise<{ awarded: number; capReached: boolean; newTotal: number }> {
  if (!adminDb) return { awarded: 0, capReached: false, newTotal: 0 };

  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const trackerRef = adminDb.collection("users").doc(uid).collection("reputation_tracker").doc(todayStr);

  let awarded = pointsToAward;
  let capReached = false;
  let newTotal = 0;

  try {
    const trackerSnap = await trackerRef.get();
    const trackerData = trackerSnap.exists ? trackerSnap.data() : {};
    const currentPointsToday = trackerData[actionType] || 0;
    const dailyCap = DAILY_REPUTATION_CAPS[actionType] || 50;

    if (currentPointsToday >= dailyCap) {
      awarded = 0;
      capReached = true;
    } else if (currentPointsToday + pointsToAward > dailyCap) {
      awarded = dailyCap - currentPointsToday;
      capReached = true;
    }

    if (awarded > 0) {
      // Update daily tracker
      await trackerRef.set(
        {
          [actionType]: currentPointsToday + awarded,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Update total reputation score on user document
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const currentScore = userSnap.exists && typeof userSnap.data()?.reputationScore === "number" ? userSnap.data().reputationScore : 0;
      newTotal = currentScore + awarded;
      await userRef.set({ reputationScore: newTotal }, { merge: true });
    } else {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      newTotal = userSnap.exists && typeof userSnap.data()?.reputationScore === "number" ? userSnap.data().reputationScore : 0;
    }
  } catch (err) {
    console.warn("[ReputationOS] Error updating anti-abuse score:", err);
  }

  return { awarded, capReached, newTotal };
}
