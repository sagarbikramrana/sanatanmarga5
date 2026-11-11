import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  getDocs as firebaseGetDocs,
  getDoc as firebaseGetDoc,
  getDocFromServer, 
  doc, 
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  endBefore,
  limitToLast,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDocsFromCache,
  getDocFromCache,
  setDoc as firebaseSetDoc,
  addDoc as firebaseAddDoc,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  writeBatch as firebaseWriteBatch,
  runTransaction as firebaseRunTransaction,
  terminate,
  clearIndexedDbPersistence,
  onSnapshot as firebaseOnSnapshot,
  QueryConstraint,
  setLogLevel
} from 'firebase/firestore';
import type {
  Query,
  QuerySnapshot,
  DocumentData,
  DocumentReference,
  CollectionReference,
  DocumentSnapshot,
  WriteBatch,
  Transaction,
  SetOptions,
  FirestoreError
} from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { 
  BACKUP_CATEGORIES, 
  BACKUP_EVENTS, 
  BACKUP_COMMUNITY_POSTS, 
  BACKUP_NOTIFICATIONS, 
  BACKUP_COMMENTS, 
  BACKUP_TENANTS, 
  BACKUP_MENU_ITEMS, 
  BACKUP_SITE_SETTINGS, 
  BACKUP_MEDIA_ASSETS 
} from "@/src/constants/backupData";
import { telemetry } from './telemetry';
import firebaseConfig from '@/firebase-applet-config.json';

// Re-export common Firestore primitives and types so components import centrally
export {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  endBefore,
  limitToLast,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDocsFromCache,
  getDocFromCache
};
export type {
  Query,
  QuerySnapshot,
  DocumentData,
  DocumentReference,
  CollectionReference,
  DocumentSnapshot,
  WriteBatch,
  Transaction,
  SetOptions,
  FirestoreError,
  QueryConstraint
};

// Set Firestore log level to silent to prevent benign gRPC stream lifecycle logs from polluting console
try {
  setLogLevel('silent');
} catch (e) {}

// Global Interceptor for Firestore Internal Assertion Errors & gRPC Idle Stream Timeouts
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const fullMsg = args
      .map((a) => (typeof a === 'string' ? a : a?.message || a?.stack || JSON.stringify(a) || ''))
      .join(' ');

    if (
      fullMsg.includes('Disconnecting idle stream') ||
      fullMsg.includes('Timed out waiting for new targets') ||
      fullMsg.includes('CANCELLED: Disconnecting idle stream') ||
      (fullMsg.includes('@firebase/firestore') && fullMsg.includes("GrpcConnection RPC 'Listen' stream") && fullMsg.includes('Code: 1'))
    ) {
      console.debug('[Firestore Idle Stream Disconnect]', ...args);
      return;
    }

    if (
      fullMsg.includes('FIRESTORE') && 
      (fullMsg.includes('INTERNAL ASSERTION FAILED') || fullMsg.includes('Unexpected state') || fullMsg.includes('ca9') || fullMsg.includes('b815'))
    ) {
      console.warn('[Firestore Assertion Trapped & Suppressed]:', ...args);
      handleGlobalFirestoreCrash(fullMsg);
      return;
    }

    originalConsoleError.apply(console, args);
  };

  const handleGlobalFirestoreCrash = (errorMsg: string, errObj?: any) => {
    const msg = String(errorMsg || '');
    const stack = errObj && errObj.stack ? String(errObj.stack) : '';
    const combined = `${msg} ${stack}`;

    const isGrpcIdleCancel = 
      combined.includes('Disconnecting idle stream') ||
      combined.includes('Timed out waiting for new targets') ||
      combined.includes('CANCELLED: Disconnecting idle stream') ||
      combined.includes('GrpcConnection RPC \'Listen\' stream');

    if (isGrpcIdleCancel) {
      return true;
    }

    if (
      combined.includes('permission-denied') ||
      combined.includes('insufficient permissions') ||
      combined.includes('Missing or insufficient permissions') ||
      combined.includes('unauthenticated') ||
      errObj?.code === 'permission-denied' ||
      errObj?.code === 'unauthenticated'
    ) {
      return false;
    }

    const isFirestoreCrash = 
      combined.includes('INTERNAL ASSERTION FAILED') || 
      combined.includes('Unexpected state') ||
      combined.includes('ve:-1') ||
      combined.includes('b815') ||
      combined.includes('ca9') ||
      combined.includes('resource-exhausted') ||
      combined.includes('RESOURCE_EXHAUSTED') ||
      combined.includes('WatchChangeAggregator');

    if (isFirestoreCrash) {
      console.warn("[Global Interceptor] Handled Firestore internal watch stream crash. Activating Continuity Mode.");
      localStorage.setItem('continuity_mode', 'true');
      localStorage.setItem('firestore_quota_status', 'true');
      
      try {
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
      } catch (e) {}
      
      try {
        if (typeof listenerRegistry !== 'undefined' && listenerRegistry) {
          listenerRegistry.killAll();
        }
      } catch (e) {}
      
      return true;
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    const isCrash = handleGlobalFirestoreCrash(event.message, event.error);
    if (isCrash) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || '');
    const isCrash = handleGlobalFirestoreCrash(msg, reason);
    if (isCrash) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

// Gateway Types and Interfaces
export type GatewayPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type GatewayDataSource = 
  | 'FIRESTORE'
  | 'MEMORY_CACHE'
  | 'INDEXEDDB'
  | 'SNAPSHOT_R2'
  | 'LAST_KNOWN_GOOD'
  | 'RECOVERY'
  | 'UNAVAILABLE';

export interface GatewayReadOptions {
  operationName?: string;
  subsystem?: string;
  priority?: GatewayPriority;
  quotaSensitivity?: 'HIGH' | 'NORMAL' | 'LOW' | 'IGNORE';
  cacheStrategy?: 'FIRESTORE_FIRST' | 'CACHE_FIRST' | 'CACHE_ONLY' | 'SNAPSHOT_R2';
  tenantId?: string;
  observabilityTag?: string;
  skipCircuitBreaker?: boolean;
  featureId?: string;
}

export interface GatewayWriteOptions {
  operationName?: string;
  subsystem?: string;
  priority?: GatewayPriority;
  allowOfflineQueue?: boolean;
  tenantId?: string;
  observabilityTag?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  TRANSACTION = 'transaction',
  BATCH = 'batch'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN_QUOTA' | 'HALF_OPEN';

export interface CircuitBreakerTelemetry {
  state: CircuitBreakerState;
  lastOpenedAt: number | null;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  blockedReadCount: number;
  fallbackServedCount: number;
  lastError: string | null;
  probeInFlight: boolean;
  activeListenersCount: number;
}

function createMockQuerySnapshot<T>(items: T[]): QuerySnapshot<T> {
  const docs = items.map((item, index) => ({
    id: (item as any).id || `backup_doc_${index}`,
    exists: () => true,
    data: () => item,
    get: (fieldPath: string) => (item as any)[fieldPath],
    ref: {} as any,
    metadata: { fromCache: true, hasPendingWrites: false }
  }));

  return {
    docs: docs as any[],
    empty: docs.length === 0,
    size: docs.length,
    metadata: { fromCache: true, hasPendingWrites: false },
    forEach: (callback: any) => docs.forEach(callback),
    map: (callback: any) => docs.map(callback),
    docChanges: () => []
  } as unknown as QuerySnapshot<T>;
}

function getFallbackDataForQuery(queryName: string): any[] {
  const qLower = queryName.toLowerCase();
  let baseData: any[] = [];
  let dynamicItems: any[] = [];

  if (typeof window !== 'undefined') {
    try {
      if (qLower.includes('category') || qLower.includes('cat')) {
        baseData = BACKUP_CATEGORIES;
      } else if (qLower.includes('event')) {
        baseData = BACKUP_EVENTS;
      } else if (qLower.includes('community') || qLower.includes('post')) {
        baseData = [];
        const storedPosts = localStorage.getItem('sg_dynamic_community_posts') || localStorage.getItem('community_posts') || localStorage.getItem('chautari_local_posts');
        if (storedPosts) dynamicItems = JSON.parse(storedPosts);
      } else if (qLower.includes('notification')) {
        baseData = BACKUP_NOTIFICATIONS;
        const storedNotifs = localStorage.getItem('sg_dynamic_notifications');
        if (storedNotifs) dynamicItems = JSON.parse(storedNotifs);
      } else if (qLower.includes('comment')) {
        baseData = [];
        const storedComments = localStorage.getItem('chautari_local_comments');
        if (storedComments) dynamicItems = JSON.parse(storedComments);
      } else if (qLower.includes('tenant')) {
        baseData = BACKUP_TENANTS;
      } else if (qLower.includes('menu')) {
        baseData = BACKUP_MENU_ITEMS;
      } else if (qLower.includes('ad')) {
        baseData = [];
        const storedAds = localStorage.getItem('sg_dynamic_ads');
        if (storedAds) dynamicItems = JSON.parse(storedAds);
      } else if (qLower.includes('media') || qLower.includes('asset')) {
        baseData = BACKUP_MEDIA_ASSETS;
        const storedMedia = localStorage.getItem('sg_dynamic_media_assets');
        if (storedMedia) dynamicItems = JSON.parse(storedMedia);
      } else {
        const storedArticles = localStorage.getItem('sg_dynamic_articles');
        if (storedArticles) dynamicItems = JSON.parse(storedArticles);
        const queued = localStorage.getItem('sg_offline_queue');
        if (queued) {
          try {
            const qParsed = JSON.parse(queued);
            qParsed.forEach((item: any) => {
              const action = item.action || item;
              if (action.data && (action.collection === 'articles' || action.type === 'ARTICLE_CREATE')) {
                dynamicItems.push({ id: action.docId || item.id || `q_${Date.now()}`, ...action.data });
              }
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  const itemsToReturn = dynamicItems.length > 0 ? dynamicItems : baseData;
  const map = new Map<string, any>();
  itemsToReturn.forEach(item => {
    const key = item.id || item.slug || item.title || JSON.stringify(item);
    if (!map.has(key)) map.set(key, item);
  });

  return Array.from(map.values());
}

// Initialize Firebase SDK
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function initFirestore() {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  if (dbId) {
    try {
      return getFirestore(app, dbId);
    } catch (e) {
      console.warn("Could not initialize custom firestoreDatabaseId, falling back to default db:", e);
      return getFirestore(app);
    }
  }
  return getFirestore(app);
}

export const db = initFirestore();
export const auth = getAuth(app);
export const messaging = (() => {
  if (typeof window === 'undefined') return null;
  try {
    return getMessaging(app);
  } catch (err) {
    console.warn("Firebase messaging not available in this browser environment:", err);
    return null;
  }
})();
export const googleProvider = new GoogleAuthProvider();

export class FirestoreCircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private openedAt: number | null = null;
  private cooldownUntil: number | null = null;
  private consecutiveFailures = 0;
  private blockedReadCount = 0;
  private fallbackServedCount = 0;
  private lastError: string | null = null;
  private probeInFlight = false;
  private probeLock: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('firestore_circuit_state') as CircuitBreakerState;
        const savedCooldown = localStorage.getItem('firestore_circuit_cooldown');
        if (
          savedState === 'OPEN_QUOTA' || 
          localStorage.getItem('continuity_mode') === 'true' || 
          localStorage.getItem('firestore_quota_status') === 'true'
        ) {
          this.state = 'OPEN_QUOTA';
          this.openedAt = Date.now();
          this.cooldownUntil = savedCooldown ? parseInt(savedCooldown, 10) : Date.now() + 5 * 60 * 1000;
        }
      } catch (e) {}
    }
  }

  public getState(): CircuitBreakerState {
    this.checkCooldownTransition();
    return this.state;
  }

  private checkCooldownTransition() {
    if (this.state === 'OPEN_QUOTA' && this.cooldownUntil && Date.now() >= this.cooldownUntil) {
      console.log("[CircuitBreaker] Cooldown elapsed. Transitioning: OPEN_QUOTA -> HALF_OPEN (single-flight health probe enabled).");
      this.state = 'HALF_OPEN';
      this.probeInFlight = false;
      this.probeLock = null;
    }
  }

  public allowRead(isHealthProbe = false): boolean {
    if (isFirestoreNetworkDisabled()) {
      this.blockedReadCount++;
      this.fallbackServedCount++;
      return false;
    }

    this.checkCooldownTransition();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'HALF_OPEN') {
      if (isHealthProbe && !this.probeInFlight) {
        this.probeInFlight = true;
        console.log("[CircuitBreaker] HALF_OPEN: Allowing single-flight health probe.");
        return true;
      }
      this.blockedReadCount++;
      this.fallbackServedCount++;
      return false;
    }

    // OPEN_QUOTA: Strict circuit open -> No network reads permitted
    this.blockedReadCount++;
    this.fallbackServedCount++;
    return false;
  }

  public trip(reason: string, error?: any) {
    const wasOpen = this.state === 'OPEN_QUOTA';
    this.consecutiveFailures++;
    this.state = 'OPEN_QUOTA';
    this.openedAt = Date.now();
    this.probeInFlight = false;
    this.probeLock = null;
    this.lastError = reason;

    // Exponential backoff cooldown: 5m -> 15m -> 30m -> 60m
    const backoffMs = Math.min(60 * 60 * 1000, 5 * 60 * 1000 * Math.pow(2, Math.min(3, this.consecutiveFailures - 1)));
    this.cooldownUntil = Date.now() + backoffMs;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('continuity_mode', 'true');
        localStorage.setItem('firestore_quota_status', 'true');
        localStorage.setItem('firestore_circuit_state', 'OPEN_QUOTA');
        localStorage.setItem('firestore_circuit_cooldown', this.cooldownUntil.toString());
      } catch (e) {}
    }

    console.warn(`[CircuitBreaker TRIP] State -> OPEN_QUOTA (Reason: ${reason}). Cooldown until ${new Date(this.cooldownUntil).toISOString()}.`);

    listenerRegistry.killAll();

    if (!wasOpen && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
      } catch (e) {}
    }
  }

  public recordSuccess() {
    if (this.state === 'HALF_OPEN' || this.state === 'OPEN_QUOTA') {
      console.log("[CircuitBreaker RESET] Probe succeeded. Transitioning -> CLOSED. Normal Firestore reads restored.");
      this.state = 'CLOSED';
      this.consecutiveFailures = 0;
      this.openedAt = null;
      this.cooldownUntil = null;
      this.probeInFlight = false;
      this.probeLock = null;
      this.lastError = null;

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('continuity_mode');
          localStorage.removeItem('firestore_quota_status');
          localStorage.setItem('firestore_circuit_state', 'CLOSED');
          localStorage.removeItem('firestore_circuit_cooldown');
          window.dispatchEvent(new CustomEvent('firestore-quota-reset'));
        } catch (e) {}
      }
    }
  }

  public recordFailure(err: any) {
    this.probeInFlight = false;
    this.probeLock = null;
    if (isQuotaOrContinuityError(err)) {
      this.trip(err?.message || 'Firestore Quota Limit Exhausted', err);
    }
  }

  public async executeHealthProbe(): Promise<boolean> {
    this.checkCooldownTransition();
    if (this.state !== 'HALF_OPEN') {
      return this.state === 'CLOSED';
    }

    if (this.probeLock) {
      return this.probeLock;
    }

    this.probeLock = (async () => {
      try {
        this.probeInFlight = true;
        const probeRef = doc(db, '_connection_test_', 'health_probe');
        await getDocFromServer(probeRef);
        this.recordSuccess();
        return true;
      } catch (err: any) {
        if (isQuotaOrContinuityError(err)) {
          this.recordFailure(err);
          return false;
        }
        // Non-quota error (e.g. permission-denied or document not found): connection is alive!
        if (err?.code === 'permission-denied' || err?.code === 'not-found') {
          this.recordSuccess();
          return true;
        }
        this.probeInFlight = false;
        return false;
      } finally {
        this.probeLock = null;
      }
    })();

    return this.probeLock;
  }

  public getTelemetry(): CircuitBreakerTelemetry {
    return {
      state: this.getState(),
      lastOpenedAt: this.openedAt,
      cooldownUntil: this.cooldownUntil,
      consecutiveFailures: this.consecutiveFailures,
      blockedReadCount: this.blockedReadCount,
      fallbackServedCount: this.fallbackServedCount,
      lastError: this.lastError,
      probeInFlight: this.probeInFlight,
      activeListenersCount: listenerRegistry.getActiveCount()
    };
  }

  // Testing helper to reset or force state
  public _forceState(state: CircuitBreakerState, cooldownUntil: number | null = null) {
    this.state = state;
    this.cooldownUntil = cooldownUntil;
    this.probeInFlight = false;
    this.probeLock = null;
  }
}

export const firestoreCircuitBreaker = new FirestoreCircuitBreaker();

export function isFirestoreNetworkDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      localStorage.getItem('continuity_mode') === 'true' ||
      localStorage.getItem('firestore_quota_status') === 'true' ||
      localStorage.getItem('firestore_circuit_state') === 'OPEN_QUOTA' ||
      localStorage.getItem('simulated_firestore_kill') === 'true' ||
      localStorage.getItem('simulated_permission_denied') === 'true'
    );
  } catch {
    return false;
  }
}

export const isContinuityModeActive = isFirestoreNetworkDisabled;

export function isQuotaOrContinuityError(error: any): boolean {
  if (!error) return false;

  const code = error?.code || '';
  if (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code === 7 ||
    code === 16
  ) {
    return false;
  }

  const str = (
    (typeof error === 'string' ? error : '') +
    (error?.message || '') +
    (error?.code || '') +
    (error?.stack || '') +
    JSON.stringify(error || {})
  ).toLowerCase();

  if (
    str.includes('permission-denied') ||
    str.includes('insufficient permissions') ||
    str.includes('missing or insufficient permissions') ||
    str.includes('unauthenticated')
  ) {
    return false;
  }

  return (
    str.includes('resource-exhausted') ||
    str.includes('resource_exhausted') ||
    str.includes('quota') ||
    str.includes('rate limit') ||
    str.includes('rate-limit') ||
    str.includes('internal assertion failed') ||
    error?.code === 'resource-exhausted' ||
    error?.code === 'unavailable' ||
    error?.code === 8 ||
    error?.code === 14
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (
    errorMessage.includes('CANCELLED') ||
    errorMessage.includes('idle stream') ||
    errorMessage.includes('Disconnecting idle stream') ||
    errorMessage.includes('Timed out waiting for new targets') ||
    errorMessage.includes('Code: 1')
  ) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })) || []
    }
  };

  if (
    errorMessage.includes('permission-denied') ||
    errorMessage.includes('insufficient permissions') ||
    errorMessage.includes('Missing or insufficient permissions') ||
    (error as any)?.code === 'permission-denied'
  ) {
    console.warn(`[Firestore Security] Permission denied on ${operationType} at path "${path}". Check security rules.`);
    return errInfo;
  }

  if (
    errorMessage.includes('unauthenticated') ||
    (error as any)?.code === 'unauthenticated'
  ) {
    console.warn(`[Firestore Auth] Unauthenticated operation ${operationType} on path "${path}".`);
    return errInfo;
  }

  if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
    console.warn("Internal assertion in Firestore watch stream. Switching to Continuity Mode safely.");
    firestoreCircuitBreaker.trip("INTERNAL_ASSERTION_FAILED", error);
    return errInfo;
  }

  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  
  if (isQuotaOrContinuityError(error)) {
    firestoreCircuitBreaker.trip(errorMessage, error);
  }
  
  return errInfo;
}

class ListenerRegistry {
  private listeners = new Set<{ unsub: () => void; name: string; registeredAt: number; featureId?: string }>();
  private activeNames = new Map<string, number>();

  register(unsub: () => void, name: string = 'unnamed_listener', featureId?: string): () => void {
    if (featureId) {
      try {
        const { featureControlOS } = require('@/src/services/featureControlOS');
        if (featureControlOS && !featureControlOS.isFeatureEnabled(featureId)) {
          console.warn(`[ListenerRegistry] Blocked listener "${name}" for disabled feature "${featureId}".`);
          try { unsub(); } catch (_) {}
          return () => {};
        }
      } catch (_) {}
    }

    const entry = { unsub, name, registeredAt: Date.now(), featureId };
    this.listeners.add(entry);
    
    const count = (this.activeNames.get(name) || 0) + 1;
    this.activeNames.set(name, count);
    if (count > 2) {
      console.warn(`[ListenerRegistry Warning] Multiple concurrent subscriptions detected for "${name}" (count: ${count}). Verify cleanup.`);
    }

    return () => {
      this.listeners.delete(entry);
      const curr = this.activeNames.get(name) || 1;
      if (curr <= 1) {
        this.activeNames.delete(name);
      } else {
        this.activeNames.set(name, curr - 1);
      }
      try {
        unsub();
      } catch (err) {
        console.warn(`[ListenerRegistry] Cleanup warning for ${name}:`, err);
      }
    };
  }

  killByFeature(featureId: string): number {
    let count = 0;
    const toDelete: Array<{ unsub: () => void; name: string; registeredAt: number; featureId?: string }> = [];
    this.listeners.forEach((entry) => {
      if (entry.featureId === featureId) {
        try {
          entry.unsub();
          count++;
        } catch (err) {
          console.warn(`[ListenerRegistry] Teardown failed for ${entry.name}:`, err);
        }
        toDelete.push(entry);
      }
    });
    toDelete.forEach((entry) => {
      this.listeners.delete(entry);
      const curr = this.activeNames.get(entry.name) || 1;
      if (curr <= 1) {
        this.activeNames.delete(entry.name);
      } else {
        this.activeNames.set(entry.name, curr - 1);
      }
    });
    if (count > 0) {
      console.info(`[ListenerRegistry] Cleaned up ${count} active listeners for feature "${featureId}".`);
    }
    return count;
  }

  getActiveByFeature(featureId: string): number {
    let count = 0;
    this.listeners.forEach((entry) => {
      if (entry.featureId === featureId) count++;
    });
    return count;
  }

  killAll(): number {
    let count = 0;
    this.listeners.forEach(({ unsub, name }) => {
      try {
        unsub();
        count++;
      } catch (err) {
        console.warn(`[ListenerRegistry] Emergency teardown failed for ${name}:`, err);
      }
    });
    this.listeners.clear();
    this.activeNames.clear();
    console.info(`[ListenerRegistry] Killed ${count} active listeners for Continuity Mode.`);
    return count;
  }

  getActiveCount(): number {
    return this.listeners.size;
  }
}

export const listenerRegistry = new ListenerRegistry();

const inFlightRequests = new Map<string, Promise<any>>();

export function executeSingleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export async function recoverFirestore() {
  const lastRecovery = typeof window !== 'undefined' ? sessionStorage.getItem('lastFirestoreRecovery') : null;
  const recoveryCount = typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('firestoreRecoveryCount') || '0', 10) : 0;
  const recoveryLockUntil = typeof window !== 'undefined' ? localStorage.getItem('firestore_recovery_lock_until') : null;
  const now = Date.now();
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('continuity_mode', 'true');
    localStorage.setItem('firestore_quota_status', 'true');
  }

  if (recoveryLockUntil && now < parseInt(recoveryLockUntil, 10)) {
    console.warn("Firestore recovery locked out due to recent repeated failures. Operating in Continuity Mode.");
    return;
  }

  if (recoveryCount >= 3) {
    console.error("Max Firestore recovery attempts reached. Locking recovery for 15 minutes.");
    if (typeof window !== 'undefined') {
      localStorage.setItem('firestore_recovery_lock_until', (now + 15 * 60 * 1000).toString());
    }
    return;
  }

  if (lastRecovery && now - parseInt(lastRecovery, 10) < 60000) {
    console.warn("Firestore recovery already attempted recently. Operating in Continuity Mode.");
    return;
  }

  try {
    sessionStorage.setItem('lastFirestoreRecovery', now.toString());
    sessionStorage.setItem('firestoreRecoveryCount', (recoveryCount + 1).toString());
    console.log(`Recovery attempt ${recoveryCount + 1}...`);
    
    await terminate(db).catch(() => {});
    await clearIndexedDbPersistence(db).catch(() => {});
    window.location.reload();
  } catch (err) {
    console.error("Deep recovery failed:", err);
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin;
    }
  }
}

/**
 * Enhanced onSnapshot with quota awareness, circuit breaker lock, and single-flight listener protection.
 */
export function safeOnSnapshot<T = DocumentData>(
  queryOrRef: Query<T> | DocumentReference<T>,
  onNext: (snapshot: any) => void,
  onErrorOrOptionsOrName?: ((error: any) => void) | GatewayReadOptions | string,
  optionsOrName?: GatewayReadOptions | string
): () => void {
  let customOnError: ((error: any) => void) | undefined;
  let opts: GatewayReadOptions = {};

  if (typeof onErrorOrOptionsOrName === 'function') {
    customOnError = onErrorOrOptionsOrName;
    if (typeof optionsOrName === 'string') {
      opts = { operationName: optionsOrName };
    } else if (optionsOrName) {
      opts = optionsOrName;
    }
  } else if (typeof onErrorOrOptionsOrName === 'string') {
    opts = { operationName: onErrorOrOptionsOrName };
  } else if (onErrorOrOptionsOrName) {
    opts = onErrorOrOptionsOrName;
  }

  const operationName = opts.operationName || "unnamed_snapshot";
  const subsystem = opts.subsystem || "client_subsystem";
  const isDoc = (queryOrRef as any).type === 'document';

  // Check Circuit Breaker FIRST before attaching any listener
  if (!firestoreCircuitBreaker.allowRead(false)) {
    console.info(`[safeOnSnapshot] Circuit OPEN_QUOTA/HALF_OPEN -> Delivering local cache for ${operationName}`);
    if (isDoc) {
      getDocWithCacheFallback(queryOrRef as DocumentReference<T>, opts).then(snap => {
        if (snap) onNext(snap);
      }).catch((e) => {
        if (customOnError) customOnError(e);
      });
    } else {
      getDocsWithCacheFallback(queryOrRef as Query<T>, opts).then(snap => {
        if (snap) onNext(snap);
      }).catch((e) => {
        if (customOnError) customOnError(e);
      });
    }
    return () => {};
  }

  let unsub = () => {};

  try {
    const rawUnsub = (firebaseOnSnapshot as any)(
      queryOrRef, 
      (snapshot: any) => {
        if (typeof window !== 'undefined' && snapshot && !snapshot.metadata?.fromCache) {
          firestoreCircuitBreaker.recordSuccess();
        }
        onNext(snapshot);
      },
      (err: FirestoreError) => {
        if (
          err.code === 'cancelled' ||
          err.message?.includes('CANCELLED') ||
          err.message?.includes('idle stream') ||
          err.message?.includes('Timed out waiting for new targets')
        ) {
          return;
        }
        console.warn(`safeOnSnapshot error [${operationName} | ${subsystem}]:`, err.message);

        if (customOnError) {
          try {
            customOnError(err);
          } catch (e) {}
        }

        if (isQuotaOrContinuityError(err)) {
          firestoreCircuitBreaker.recordFailure(err);

          if (isDoc) {
            getDocFromCache(queryOrRef as DocumentReference<T>).then(cachedDoc => {
              if (cachedDoc.exists()) onNext(cachedDoc);
            }).catch(() => {});
          } else {
            getDocsFromCache(queryOrRef as Query<T>).then(cachedDocs => {
              if (!cachedDocs.empty) onNext(cachedDocs);
            }).catch(() => {});
          }
          return;
        }

        handleFirestoreError(err, OperationType.GET, operationName);
        
        if (isDoc) {
          getDoc(queryOrRef as DocumentReference<T>, opts).then(snap => {
            onNext(snap);
          }).catch(() => {});
        } else {
          getDocs(queryOrRef as Query<T>, opts).then(snap => {
            onNext(snap);
          }).catch(() => {});
        }
      }
    );

    unsub = listenerRegistry.register(rawUnsub, operationName, opts.featureId);
  } catch (err) {
    console.error(`Error setting up safeOnSnapshot [${operationName}]:`, err);
  }

  return () => {
    try {
      if (typeof unsub === 'function') {
        unsub();
      }
    } catch (cleanupErr) {
      console.warn(`[${operationName}] Listener unsubscribe cleanup failed gracefully:`, cleanupErr);
    }
  };
}

export { safeOnSnapshot as onSnapshot };

function extractCollectionFromQuery(q: any, fallback = "unnamed_query"): string {
  try {
    const segs = q?._query?.path?.segments || q?.path?.segments;
    if (Array.isArray(segs) && segs.length > 0) {
      return segs[0];
    }
    if (typeof q?.path === "string" && q.path.trim()) {
      return q.path.split("/")[0];
    }
    if (typeof q?.id === "string" && q.id.trim()) {
      return q.id;
    }
  } catch {}
  return fallback;
}

function saveLocalCollectionDoc(col: string, docId: string, data: any, merge = true) {
  if (typeof window === "undefined" || !col || !docId) return;
  try {
    const itemKey = `sg_local_${col}_${docId}`;
    let existing: any = {};
    if (merge) {
      const prevStr = localStorage.getItem(itemKey);
      if (prevStr) existing = JSON.parse(prevStr);
    }
    const record = { ...existing, ...data, id: docId, _localSavedAt: Date.now() };
    localStorage.setItem(itemKey, JSON.stringify(record));

    const colKey = `sg_local_col_${col}`;
    const colRaw = localStorage.getItem(colKey);
    const colMap: Record<string, any> = colRaw ? JSON.parse(colRaw) : {};
    colMap[docId] = record;
    localStorage.setItem(colKey, JSON.stringify(colMap));
  } catch {}
}

function removeLocalCollectionDoc(col: string, docId: string) {
  if (typeof window === "undefined" || !col || !docId) return;
  try {
    localStorage.removeItem(`sg_local_${col}_${docId}`);
    const colKey = `sg_local_col_${col}`;
    const colRaw = localStorage.getItem(colKey);
    if (colRaw) {
      const colMap: Record<string, any> = JSON.parse(colRaw);
      delete colMap[docId];
      localStorage.setItem(colKey, JSON.stringify(colMap));
    }
  } catch {}
}

function getLocalCollectionDocs(col: string): any[] {
  if (typeof window === "undefined" || !col) return [];
  try {
    const colKey = `sg_local_col_${col}`;
    const colRaw = localStorage.getItem(colKey);
    if (colRaw) {
      const colMap = JSON.parse(colRaw);
      if (colMap && typeof colMap === "object") {
        return Object.values(colMap);
      }
    }
  } catch {}
  return [];
}

async function syncGatewayMutationToServer(
  type: "CREATE" | "UPDATE" | "DELETE",
  colName: string,
  docId: string,
  data?: any
): Promise<void> {
  if (typeof window === "undefined" || !colName || colName === "pwa_telemetry") return;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers["Authorization"] = `Bearer ${idToken}`;
        }
      } catch {}
    }

    const res = await fetch("/api/admin/sync-pending-posts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        actions: [
          {
            type,
            collection: colName,
            docId,
            data: data || {},
          },
        ],
      }),
    });

    if (res.ok) {
      window.dispatchEvent(
        new CustomEvent("snapshot-rebuilt", {
          detail: { collection: colName, docId, type, timestamp: Date.now() },
        })
      );
    }
  } catch (err) {
    console.warn(`[Gateway Server Sync] Background sync warning for ${colName}/${docId}:`, err);
  }
}

export async function flushLocalStorageToServerAndR2(): Promise<void> {
  if (typeof window === "undefined" || !auth.currentUser) return;
  try {
    const idToken = await auth.currentUser.getIdToken().catch(() => undefined);
    if (!idToken) return;

    const actions: Array<{ type: string; collection: string; docId: string; data: any }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sg_local_") || k.startsWith("sg_local_col_")) continue;
      // Format: sg_local_${col}_${docId}
      const rest = k.slice("sg_local_".length);
      const sepIdx = rest.indexOf("_");
      if (sepIdx <= 0) continue;
      const col = rest.slice(0, sepIdx);
      const docId = rest.slice(sepIdx + 1);
      if (!col || !docId || col === "pwa" || col === "pwa_telemetry") continue;

      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && !parsed._syncedToR2) {
          actions.push({
            type: "UPDATE",
            collection: col,
            docId,
            data: parsed,
          });
        }
      } catch {}
    }

    if (actions.length === 0) return;

    const res = await fetch("/api/admin/sync-pending-posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ actions }),
    });

    if (res.ok) {
      for (const act of actions) {
        const k = `sg_local_${act.collection}_${act.docId}`;
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed._syncedToR2 = true;
            localStorage.setItem(k, JSON.stringify(parsed));
          }
        } catch {}
      }
      window.dispatchEvent(new CustomEvent("snapshot-rebuilt", { detail: { flushedCount: actions.length } }));
    }
  } catch (err) {
    console.warn("[Gateway R2 Flush] Warning flushing localStorage to R2:", err);
  }
}

if (typeof window !== "undefined") {
  try {
    auth.onAuthStateChanged((user) => {
      if (user) {
        setTimeout(() => {
          flushLocalStorageToServerAndR2().catch(() => {});
        }, 1500);
      }
    });
  } catch {}
}

/**
 * Central Gateway getDocs with multi-tier cache, backup fallback, single-flight locking, and telemetry.
 */
export async function getDocs<T = DocumentData>(
  q: Query<T>, 
  optionsOrQueryName: GatewayReadOptions | string = "unnamed_query"
): Promise<QuerySnapshot<T>> {
  const opts: GatewayReadOptions = typeof optionsOrQueryName === 'string' ? { operationName: optionsOrQueryName } : optionsOrQueryName;
  const inferredCol = extractCollectionFromQuery(q, "unnamed_query");
  const queryName = (opts.operationName && opts.operationName !== "unnamed_query") ? opts.operationName : inferredCol;
  const subsystem = opts.subsystem || "general";
  const allowNetwork = opts.skipCircuitBreaker ? true : firestoreCircuitBreaker.allowRead(false);
  let snapshot: QuerySnapshot<T> | null = null;
  let actualSource: GatewayDataSource = 'UNAVAILABLE';
  const startTime = performance.now();

  if (allowNetwork && opts.cacheStrategy !== 'CACHE_ONLY') {
    try {
      snapshot = await firebaseGetDocs(q);
      actualSource = snapshot.metadata.fromCache ? 'MEMORY_CACHE' : 'FIRESTORE';
      const duration = performance.now() - startTime;
      telemetry.trackRead(queryName, duration, snapshot.metadata.fromCache ? 'cache' : 'network', snapshot.size ?? 0);
      if (typeof window !== 'undefined' && !snapshot.metadata.fromCache) {
        firestoreCircuitBreaker.recordSuccess();
      }
    } catch (error: any) {
      console.warn(`[Gateway getDocs] Server fetch failed for "${queryName}" (${subsystem}):`, error?.message);
      
      if (isQuotaOrContinuityError(error)) {
        firestoreCircuitBreaker.recordFailure(error);
        handleFirestoreError(error, OperationType.GET, queryName);
        telemetry.trackQuotaRecovery();
      } else {
        telemetry.trackOfflineRecovery();
      }

      try {
        snapshot = await getDocsFromCache(q);
        actualSource = 'INDEXEDDB';
      } catch (cacheErr: any) {}
    }
  } else {
    try {
      snapshot = await Promise.race([
        getDocsFromCache(q),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Cache timeout")), 150))
      ]);
      actualSource = 'INDEXEDDB';
    } catch (e) {}
  }

  let serverDynamicItems: any[] = [];
  if ((!snapshot || snapshot.empty) && typeof window !== "undefined" && inferredCol && inferredCol !== "unnamed_query") {
    try {
      const r2Res = await fetch(`/api/cache/collection/${encodeURIComponent(inferredCol)}`);
      if (r2Res.ok) {
        const r2Data = await r2Res.json();
        if (Array.isArray(r2Data?.items) && r2Data.items.length > 0) {
          serverDynamicItems = r2Data.items;
          actualSource = 'SNAPSHOT_R2';
        }
      }
    } catch {}
  }

  const localFallbackData = getFallbackDataForQuery(queryName);
  const localColDocs = getLocalCollectionDocs(inferredCol);
  const firestoreItems = snapshot && !snapshot.empty ? snapshot.docs.map(d => ({ id: d.id, ...d.data() })) : [];

  if (firestoreItems.length > 0 && actualSource === 'UNAVAILABLE') {
    actualSource = 'MEMORY_CACHE';
  }

  const map = new Map<string, any>();
  localFallbackData.forEach(item => {
    const key = item.id || item.slug || item.title || JSON.stringify(item);
    map.set(key, item);
  });
  firestoreItems.forEach(item => {
    const key = (item as any).id || (item as any).slug || (item as any).title || JSON.stringify(item);
    map.set(key, { ...(map.get(key) || {}), ...item });
  });
  serverDynamicItems.forEach(item => {
    const key = item.id || item.slug || item.title || JSON.stringify(item);
    map.set(key, { ...(map.get(key) || {}), ...item });
  });
  localColDocs.forEach(item => {
    const key = item.id || item.slug || item.title || JSON.stringify(item);
    map.set(key, { ...(map.get(key) || {}), ...item });
  });

  const combined = Array.from(map.values());
  combined.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.updatedAt || a.date || 0).getTime();
    const timeB = new Date(b.createdAt || b.updatedAt || b.date || 0).getTime();
    return timeB - timeA;
  });

  if (actualSource === 'UNAVAILABLE' && combined.length > 0) {
    actualSource = 'LAST_KNOWN_GOOD';
  }

  const finalSnapshot = createMockQuerySnapshot(combined);
  const duration = performance.now() - startTime;
  console.log(`[READ_AUDIT] op: ${queryName}, sub: ${subsystem}, count: ${finalSnapshot.size}, source: ${actualSource}, duration: ${duration.toFixed(1)}ms`);

  return finalSnapshot;
}

/**
 * Central Gateway getDoc with cache, single-flight locking, backup fallback, and telemetry.
 */
export async function getDoc<T = DocumentData>(
  docRef: DocumentReference<T>, 
  optionsOrQueryName: GatewayReadOptions | string = "unnamed_doc_query"
): Promise<DocumentSnapshot<T>> {
  const inferredName = docRef?.path ? `doc_${docRef.path.replace(/\//g, '_')}` : (docRef?.id ? `doc_${docRef.id}` : "unnamed_doc_query");
  const opts: GatewayReadOptions = typeof optionsOrQueryName === 'string' ? { operationName: optionsOrQueryName } : optionsOrQueryName;
  const queryName = (opts.operationName && opts.operationName !== "unnamed_doc_query") ? opts.operationName : inferredName;
  const subsystem = opts.subsystem || "general";
  const allowNetwork = opts.skipCircuitBreaker ? true : firestoreCircuitBreaker.allowRead(false);
  const startTime = performance.now();

  if (!allowNetwork || opts.cacheStrategy === 'CACHE_ONLY') {
    try {
      const cachedDoc = await Promise.race([
        getDocFromCache(docRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Cache timeout")), 150))
      ]);
      if (cachedDoc.exists()) {
        console.log(`[READ_AUDIT] op: ${queryName}, sub: ${subsystem}, id: ${docRef.id}, source: INDEXEDDB, duration: ${(performance.now() - startTime).toFixed(1)}ms`);
        return cachedDoc;
      }
    } catch (cacheErr) {}

    return await getFallbackDocSnapshot(docRef, queryName, subsystem, startTime);
  }

  try {
    const snapshot = await firebaseGetDoc(docRef);
    const duration = performance.now() - startTime;
    const source = snapshot.metadata.fromCache ? 'cache' : 'network';
    telemetry.trackRead(queryName, duration, source, 1);
    if (typeof window !== 'undefined' && !snapshot.metadata.fromCache) {
      firestoreCircuitBreaker.recordSuccess();
    }
    console.log(`[READ_AUDIT] op: ${queryName}, sub: ${subsystem}, id: ${docRef.id}, source: ${snapshot.metadata.fromCache ? 'MEMORY_CACHE' : 'FIRESTORE'}, duration: ${duration.toFixed(1)}ms`);
    return snapshot;
  } catch (error: any) {
    console.warn(`[Gateway getDoc] Server fetch failed for "${queryName}" (${subsystem}):`, error.message);
    
    if (isQuotaOrContinuityError(error)) {
      firestoreCircuitBreaker.recordFailure(error);
      handleFirestoreError(error, OperationType.GET, queryName);
      telemetry.trackQuotaRecovery();
    } else {
      telemetry.trackOfflineRecovery();
    }

    try {
      const cachedDoc = await getDocFromCache(docRef);
      if (cachedDoc.exists()) return cachedDoc;
    } catch (cacheErr: any) {
      if (cacheErr.message?.includes('INTERNAL ASSERTION FAILED')) {
        recoverFirestore();
      }
    }

    return await getFallbackDocSnapshot(docRef, queryName, subsystem, startTime);
  }
}

async function getFallbackDocSnapshot<T>(docRef: DocumentReference<T>, queryName: string, subsystem: string, startTime: number): Promise<DocumentSnapshot<T>> {
  const qLower = queryName.toLowerCase();
  const col = docRef.parent?.id || (docRef.path ? docRef.path.split('/')[0] : 'misc');
  let fallbackItem: any = null;

  // 1. Check localSaved doc first
  try {
    const key = `sg_local_${col}_${docRef.id}`;
    const localItemStr = localStorage.getItem(key);
    if (localItemStr) {
      fallbackItem = JSON.parse(localItemStr);
    }
  } catch (e) {}

  // 2. Check Server / R2 Dynamic Snapshot Cache
  if (!fallbackItem && typeof window !== "undefined" && col && docRef.id) {
    try {
      const res = await fetch(`/api/cache/doc/${encodeURIComponent(col)}/${encodeURIComponent(docRef.id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.exists && json?.data) {
          fallbackItem = json.data;
        }
      }
    } catch {}
  }

  // 3. Static backup fallback
  if (!fallbackItem) {
    if (qLower.includes('setting') || qLower.includes('site')) {
      fallbackItem = BACKUP_SITE_SETTINGS;
    } else if (qLower.includes('tenant')) {
      fallbackItem = BACKUP_TENANTS[0];
    }
  }

  const exists = !!fallbackItem;
  console.log(`[READ_AUDIT] op: ${queryName}, sub: ${subsystem}, id: ${docRef.id}, source: ${exists ? 'LAST_KNOWN_GOOD' : 'UNAVAILABLE'}, duration: ${(performance.now() - startTime).toFixed(1)}ms`);

  return {
    exists: () => exists,
    data: () => fallbackItem,
    get: (fieldPath: string) => (fallbackItem ? fallbackItem[fieldPath] : undefined),
    id: docRef.id,
    ref: docRef,
    metadata: { fromCache: true, hasPendingWrites: false }
  } as unknown as DocumentSnapshot<T>;
}

export async function getDocsWithCacheFallback<T = DocumentData>(
  q: Query<T>, 
  optionsOrKey?: GatewayReadOptions | string
): Promise<QuerySnapshot<T>> {
  const opts: GatewayReadOptions = typeof optionsOrKey === 'string' ? { operationName: optionsOrKey } : (optionsOrKey || {});
  const pathKey = opts.operationName || (q as any)?._query?.path?.segments?.join('/') || (q as any)?.path?.segments?.join('/') || "unnamed_query";
  opts.operationName = pathKey;
  const singleFlightKey = `getDocs_${pathKey}`;
  return executeSingleFlight(singleFlightKey, () => getDocs(q, opts));
}

export async function getDocWithCacheFallback<T = DocumentData>(
  docRef: DocumentReference<T>, 
  optionsOrKey?: GatewayReadOptions | string
): Promise<DocumentSnapshot<T>> {
  const opts: GatewayReadOptions = typeof optionsOrKey === 'string' ? { operationName: optionsOrKey } : (optionsOrKey || {});
  const pathKey = docRef?.path || opts.operationName || "unnamed_doc";
  opts.operationName = pathKey;
  const singleFlightKey = `getDoc_${pathKey}`;
  return executeSingleFlight(singleFlightKey, () => getDoc(docRef, opts));
}

/**
 * Central Gateway setDoc with write policy, quota handling, server+R2 sync, and telemetry.
 */
export async function setDoc<T = DocumentData>(
  reference: DocumentReference<T>, 
  data: any, 
  optionsOrWriteOptions?: any, 
  writeOptions?: GatewayWriteOptions
): Promise<void> {
  const isSetOptions = optionsOrWriteOptions && (optionsOrWriteOptions.merge !== undefined || optionsOrWriteOptions.mergeFields !== undefined);
  const setOpts = isSetOptions ? optionsOrWriteOptions : undefined;
  const wOpts: GatewayWriteOptions = isSetOptions ? (writeOptions || {}) : (optionsOrWriteOptions || {});
  const priority = wOpts.priority || 'NORMAL';
  const opName = wOpts.operationName || `setDoc_${reference.path}`;
  const subsystem = wOpts.subsystem || 'general';
  const col = reference.parent?.id || (reference.path ? reference.path.split('/')[0] : 'misc');

  const startTime = performance.now();

  // Always mirror locally and sync to Server/R2 SnapshotOS so frontend updates immediately
  saveLocalCollectionDoc(col, reference.id, data, Boolean(setOpts?.merge));
  syncGatewayMutationToServer("UPDATE", col, reference.id, data).catch(() => {});

  try {
    if (setOpts) {
      await firebaseSetDoc(reference, data, setOpts);
    } else {
      await firebaseSetDoc(reference, data);
    }
    telemetry.trackWrite();
    console.log(`[WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, path: ${reference.path}, priority: ${priority}, status: SUCCESS, duration: ${(performance.now() - startTime).toFixed(1)}ms`);
  } catch (err: any) {
    console.warn(`[Gateway setDoc] writing to ${reference.path} fell back (${subsystem}):`, err?.message || err);
    
    // For CRITICAL writes (payments, orders, certifications), do NOT silently succeed
    if (priority === 'CRITICAL') {
      handleFirestoreError(err, OperationType.WRITE, reference.path);
      throw err;
    }

    if (isQuotaOrContinuityError(err)) {
      firestoreCircuitBreaker.recordFailure(err);
      handleFirestoreError(err, OperationType.WRITE, reference.path);
      return;
    }

    throw err;
  }
}

/**
 * Central Gateway updateDoc with write policy, server+R2 sync, and telemetry.
 */
export async function updateDoc<T = DocumentData>(
  reference: DocumentReference<T>, 
  ...args: any[]
): Promise<void> {
  const startTime = performance.now();
  const col = reference.parent?.id || (reference.path ? reference.path.split('/')[0] : 'misc');
  const updatePayload = args[0] && typeof args[0] === 'object' ? args[0] : {};

  saveLocalCollectionDoc(col, reference.id, updatePayload, true);
  syncGatewayMutationToServer("UPDATE", col, reference.id, updatePayload).catch(() => {});

  try {
    await (firebaseUpdateDoc as any)(reference, ...args);
    telemetry.trackWrite();
    console.log(`[WRITE_AUDIT] op: updateDoc, path: ${reference.path}, status: SUCCESS, duration: ${(performance.now() - startTime).toFixed(1)}ms`);
  } catch (err: any) {
    console.warn(`[Gateway updateDoc] updating ${reference.path} fell back:`, err?.message || err);
    if (isQuotaOrContinuityError(err)) {
      firestoreCircuitBreaker.recordFailure(err);
      handleFirestoreError(err, OperationType.UPDATE, reference.path);
      return;
    }
    throw err;
  }
}

/**
 * Central Gateway addDoc with write policy, server+R2 sync, and telemetry.
 */
export async function addDoc<T = DocumentData>(
  reference: CollectionReference<T>, 
  data: any,
  writeOptions?: GatewayWriteOptions
): Promise<DocumentReference<T>> {
  const priority = writeOptions?.priority || 'NORMAL';
  const opName = writeOptions?.operationName || `addDoc_${reference.id}`;
  const subsystem = writeOptions?.subsystem || 'general';
  const col = reference.id || (reference.path ? reference.path.split('/')[0] : 'misc');
  const startTime = performance.now();

  try {
    const res = await firebaseAddDoc(reference, data);
    telemetry.trackWrite();
    saveLocalCollectionDoc(col, res.id, data, false);
    syncGatewayMutationToServer("CREATE", col, res.id, { id: res.id, ...data }).catch(() => {});
    console.log(`[WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, id: ${res.id}, priority: ${priority}, status: SUCCESS, duration: ${(performance.now() - startTime).toFixed(1)}ms`);
    return res as DocumentReference<T>;
  } catch (err: any) {
    console.warn(`[Gateway addDoc] adding to collection ${reference.id} fell back:`, err?.message || err);
    
    if (priority === 'CRITICAL') {
      handleFirestoreError(err, OperationType.CREATE, reference.id);
      throw err;
    }

    const mockId = (data && data.id) ? String(data.id) : `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    saveLocalCollectionDoc(col, mockId, { id: mockId, ...data }, false);
    syncGatewayMutationToServer("CREATE", col, mockId, { id: mockId, ...data }).catch(() => {});

    if (isQuotaOrContinuityError(err)) {
      firestoreCircuitBreaker.recordFailure(err);
      handleFirestoreError(err, OperationType.CREATE, reference.id);
    }

    return { id: mockId, path: `${reference.id}/${mockId}` } as unknown as DocumentReference<T>;
  }
}

/**
 * Central Gateway deleteDoc with write policy, server+R2 sync, and telemetry.
 */
export async function deleteDoc<T = DocumentData>(
  reference: DocumentReference<T>,
  writeOptions?: GatewayWriteOptions
): Promise<void> {
  const priority = writeOptions?.priority || 'NORMAL';
  const opName = writeOptions?.operationName || `deleteDoc_${reference.path}`;
  const subsystem = writeOptions?.subsystem || 'general';
  const col = reference.parent?.id || (reference.path ? reference.path.split('/')[0] : 'misc');
  const startTime = performance.now();

  removeLocalCollectionDoc(col, reference.id);
  syncGatewayMutationToServer("DELETE", col, reference.id).catch(() => {});

  try {
    await firebaseDeleteDoc(reference);
    telemetry.trackWrite();
    console.log(`[WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, path: ${reference.path}, priority: ${priority}, status: SUCCESS, duration: ${(performance.now() - startTime).toFixed(1)}ms`);
  } catch (err: any) {
    console.warn(`[Gateway deleteDoc] deleting ${reference.path} fell back:`, err?.message || err);
    if (priority === 'CRITICAL') {
      handleFirestoreError(err, OperationType.DELETE, reference.path);
      throw err;
    }
    if (isQuotaOrContinuityError(err)) {
      firestoreCircuitBreaker.recordFailure(err);
      handleFirestoreError(err, OperationType.DELETE, reference.path);
      return;
    }
    throw err;
  }
}

/**
 * Central Gateway writeBatch wrapper.
 */
export function writeBatch(firestoreInstance: any = db): WriteBatch {
  return firebaseWriteBatch(firestoreInstance);
}

/**
 * Central Gateway runTransaction wrapper.
 */
export async function runTransaction<T>(
  firestoreInstance: any, 
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const targetDb = (firestoreInstance && typeof firestoreInstance.runTransaction === 'function') ? firestoreInstance : db;
  return firebaseRunTransaction(targetDb, updateFunction);
}
