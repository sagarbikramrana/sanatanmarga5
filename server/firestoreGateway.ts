/**
 * SANATANMARGA 5.0 — Server-Side Central Data & Firestore Quota Gateway
 * 
 * Provides centralized, quota-aware, telemetry-monitored, and circuit-breaker-protected
 * access to Firestore / Admin SDK on the Node.js backend.
 */

export type ServerCircuitBreakerState = 'CLOSED' | 'OPEN_QUOTA' | 'HALF_OPEN';
export type GatewayPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface ServerGatewayReadOptions {
  operationName?: string;
  subsystem?: string;
  priority?: GatewayPriority;
  skipCircuitBreaker?: boolean;
  tenantId?: string;
}

export interface ServerGatewayWriteOptions {
  operationName?: string;
  subsystem?: string;
  priority?: GatewayPriority;
  tenantId?: string;
}

export interface ServerBreakerTelemetry {
  state: ServerCircuitBreakerState;
  lastOpenedAt: number | null;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  blockedReadCount: number;
  lastError: string | null;
  probeInFlight: boolean;
}

export function isServerQuotaError(err: any): boolean {
  if (!err) return false;

  const code = err?.code;
  if (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code === 7 ||
    code === 16
  ) {
    return false;
  }

  const str = (
    (typeof err === 'string' ? err : '') +
    (err?.message || '') +
    (err?.code || '') +
    (err?.stack || '') +
    JSON.stringify(err || {})
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
    code === 'resource-exhausted' ||
    code === 8 ||
    code === 14 ||
    err?.status === 8
  );
}

export class ServerFirestoreCircuitBreaker {
  private state: ServerCircuitBreakerState = 'CLOSED';
  private openedAt: number | null = null;
  private cooldownUntil: number | null = null;
  private consecutiveFailures = 0;
  private blockedReadCount = 0;
  private lastError: string | null = null;
  private probeInFlight = false;
  private probeLock: Promise<boolean> | null = null;

  public getState(): ServerCircuitBreakerState {
    this.checkCooldownTransition();
    return this.state;
  }

  private checkCooldownTransition() {
    if (this.state === 'OPEN_QUOTA' && this.cooldownUntil && Date.now() >= this.cooldownUntil) {
      console.info("[ServerCircuitBreaker] Cooldown window elapsed. Transitioning: OPEN_QUOTA -> HALF_OPEN (single probe allowed).");
      this.state = 'HALF_OPEN';
      this.probeInFlight = false;
      this.probeLock = null;
    }
  }

  public allowRead(isHealthProbe = false): boolean {
    this.checkCooldownTransition();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'HALF_OPEN') {
      if (isHealthProbe && !this.probeInFlight) {
        this.probeInFlight = true;
        console.info("[ServerCircuitBreaker] HALF_OPEN: Allowing single-flight health probe.");
        return true;
      }
      this.blockedReadCount++;
      return false;
    }

    // OPEN_QUOTA: Strict circuit open -> No network reads permitted
    this.blockedReadCount++;
    return false;
  }

  public trip(reason: string, error?: any) {
    this.consecutiveFailures++;
    this.state = 'OPEN_QUOTA';
    this.openedAt = Date.now();
    this.probeInFlight = false;
    this.probeLock = null;
    this.lastError = reason;

    // Exponential backoff cooldown: 5m -> 15m -> 30m -> 60m
    const backoffMs = Math.min(60 * 60 * 1000, 5 * 60 * 1000 * Math.pow(2, Math.min(3, this.consecutiveFailures - 1)));
    this.cooldownUntil = Date.now() + backoffMs;

    console.warn(`[ServerCircuitBreaker TRIP] State -> OPEN_QUOTA (Reason: ${reason}). Server Firestore reads blocked. Cooldown until ${new Date(this.cooldownUntil).toISOString()}.`);
  }

  public recordSuccess() {
    if (this.state === 'HALF_OPEN' || this.state === 'OPEN_QUOTA') {
      console.info("[ServerCircuitBreaker RESET] Probe succeeded. Transitioning -> CLOSED. Normal Firestore access restored.");
      this.state = 'CLOSED';
      this.consecutiveFailures = 0;
      this.openedAt = null;
      this.cooldownUntil = null;
      this.probeInFlight = false;
      this.probeLock = null;
      this.lastError = null;
    }
  }

  public recordFailure(err: any) {
    this.probeInFlight = false;
    this.probeLock = null;
    if (isServerQuotaError(err)) {
      this.trip(err?.message || 'Server Firestore Quota Limit Exhausted', err);
    }
  }

  public async executeHealthProbe(adminDb: any): Promise<boolean> {
    this.checkCooldownTransition();
    if (this.state !== 'HALF_OPEN') {
      return this.state === 'CLOSED';
    }

    if (this.probeLock) {
      return this.probeLock;
    }

    this.probeLock = (async () => {
      try {
        if (!adminDb) return false;
        this.probeInFlight = true;
        await adminDb.collection("_health_probe_").doc("test").get();
        this.recordSuccess();
        return true;
      } catch (err: any) {
        if (isServerQuotaError(err)) {
          this.recordFailure(err);
          return false;
        }
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

  public getTelemetry(): ServerBreakerTelemetry {
    return {
      state: this.getState(),
      lastOpenedAt: this.openedAt,
      cooldownUntil: this.cooldownUntil,
      consecutiveFailures: this.consecutiveFailures,
      blockedReadCount: this.blockedReadCount,
      lastError: this.lastError,
      probeInFlight: this.probeInFlight
    };
  }

  public _forceState(state: ServerCircuitBreakerState, cooldownUntil: number | null = null) {
    this.state = state;
    this.cooldownUntil = cooldownUntil;
    this.probeInFlight = false;
    this.probeLock = null;
  }
}

export const serverCircuitBreaker = new ServerFirestoreCircuitBreaker();

export function isServerQuotaBlocked(): boolean {
  return serverCircuitBreaker.getState() === 'OPEN_QUOTA';
}

/**
 * Server Central Gateway getDoc.
 */
export async function serverGetDoc(
  dbInstance: any,
  docRefOrPath: any,
  options: ServerGatewayReadOptions = {}
): Promise<any> {
  if (!dbInstance) return null;

  const opName = options.operationName || 'serverGetDoc';
  const subsystem = options.subsystem || 'server_general';
  const startTime = Date.now();

  const allowRead = options.skipCircuitBreaker ? true : serverCircuitBreaker.allowRead(false);
  if (!allowRead) {
    console.info(`[SERVER_READ_AUDIT] BLOCKED_BY_BREAKER op: ${opName}, sub: ${subsystem}`);
    return null;
  }

  try {
    const docRef = typeof docRefOrPath === 'string' 
      ? (docRefOrPath.includes('/') ? dbInstance.doc(docRefOrPath) : dbInstance.collection('misc').doc(docRefOrPath))
      : docRefOrPath;

    const snap = await docRef.get();
    serverCircuitBreaker.recordSuccess();
    const duration = Date.now() - startTime;
    console.log(`[SERVER_READ_AUDIT] op: ${opName}, sub: ${subsystem}, exists: ${snap.exists}, duration: ${duration}ms`);
    return snap;
  } catch (err: any) {
    console.warn(`[SERVER_READ_ERROR] op: ${opName}, sub: ${subsystem}, error:`, err?.message || err);
    if (isServerQuotaError(err)) {
      serverCircuitBreaker.recordFailure(err);
    }
    throw err;
  }
}

/**
 * Server Central Gateway getDocs.
 */
export async function serverGetDocs(
  dbInstance: any,
  queryOrCollection: any,
  options: ServerGatewayReadOptions = {}
): Promise<any> {
  if (!dbInstance) return { empty: true, size: 0, docs: [] };

  const opName = options.operationName || 'serverGetDocs';
  const subsystem = options.subsystem || 'server_general';
  const startTime = Date.now();

  const allowRead = options.skipCircuitBreaker ? true : serverCircuitBreaker.allowRead(false);
  if (!allowRead) {
    console.info(`[SERVER_READ_AUDIT] BLOCKED_BY_BREAKER op: ${opName}, sub: ${subsystem}`);
    return { empty: true, size: 0, docs: [] };
  }

  try {
    const target = typeof queryOrCollection === 'string' ? dbInstance.collection(queryOrCollection) : queryOrCollection;
    const snap = await target.get();
    serverCircuitBreaker.recordSuccess();
    const duration = Date.now() - startTime;
    console.log(`[SERVER_READ_AUDIT] op: ${opName}, sub: ${subsystem}, count: ${snap.size || (snap.docs ? snap.docs.length : 0)}, duration: ${duration}ms`);
    return snap;
  } catch (err: any) {
    console.warn(`[SERVER_READ_ERROR] op: ${opName}, sub: ${subsystem}, error:`, err?.message || err);
    if (isServerQuotaError(err)) {
      serverCircuitBreaker.recordFailure(err);
    }
    throw err;
  }
}

/**
 * Server Central Gateway setDoc.
 */
export async function serverSetDoc(
  dbInstance: any,
  docRefOrPath: any,
  data: any,
  setOptions?: any,
  writeOptions: ServerGatewayWriteOptions = {}
): Promise<void> {
  if (!dbInstance) {
    if (writeOptions.priority === 'CRITICAL') {
      throw new Error("Server database unavailable for critical write");
    }
    return;
  }

  const opName = writeOptions.operationName || 'serverSetDoc';
  const subsystem = writeOptions.subsystem || 'server_general';
  const priority = writeOptions.priority || 'NORMAL';
  const startTime = Date.now();

  try {
    const docRef = typeof docRefOrPath === 'string'
      ? (docRefOrPath.includes('/') ? dbInstance.doc(docRefOrPath) : dbInstance.collection('misc').doc(docRefOrPath))
      : docRefOrPath;

    if (setOptions) {
      await docRef.set(data, setOptions);
    } else {
      await docRef.set(data);
    }
    console.log(`[SERVER_WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, priority: ${priority}, status: SUCCESS, duration: ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.warn(`[SERVER_WRITE_ERROR] op: ${opName}, sub: ${subsystem}, error:`, err?.message || err);
    if (isServerQuotaError(err)) {
      serverCircuitBreaker.recordFailure(err);
    }
    throw err;
  }
}

/**
 * Server Central Gateway updateDoc.
 */
export async function serverUpdateDoc(
  dbInstance: any,
  docRefOrPath: any,
  data: any,
  writeOptions: ServerGatewayWriteOptions = {}
): Promise<void> {
  if (!dbInstance) {
    if (writeOptions.priority === 'CRITICAL') {
      throw new Error("Server database unavailable for critical update");
    }
    return;
  }

  const opName = writeOptions.operationName || 'serverUpdateDoc';
  const subsystem = writeOptions.subsystem || 'server_general';
  const startTime = Date.now();

  try {
    const docRef = typeof docRefOrPath === 'string'
      ? (docRefOrPath.includes('/') ? dbInstance.doc(docRefOrPath) : dbInstance.collection('misc').doc(docRefOrPath))
      : docRefOrPath;

    await docRef.update(data);
    console.log(`[SERVER_WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, status: SUCCESS, duration: ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.warn(`[SERVER_WRITE_ERROR] op: ${opName}, sub: ${subsystem}, error:`, err?.message || err);
    if (isServerQuotaError(err)) {
      serverCircuitBreaker.recordFailure(err);
    }
    throw err;
  }
}

/**
 * Server Central Gateway deleteDoc.
 */
export async function serverDeleteDoc(
  dbInstance: any,
  docRefOrPath: any,
  writeOptions: ServerGatewayWriteOptions = {}
): Promise<void> {
  if (!dbInstance) {
    if (writeOptions.priority === 'CRITICAL') {
      throw new Error("Server database unavailable for critical delete");
    }
    return;
  }

  const opName = writeOptions.operationName || 'serverDeleteDoc';
  const subsystem = writeOptions.subsystem || 'server_general';
  const startTime = Date.now();

  try {
    const docRef = typeof docRefOrPath === 'string'
      ? (docRefOrPath.includes('/') ? dbInstance.doc(docRefOrPath) : dbInstance.collection('misc').doc(docRefOrPath))
      : docRefOrPath;

    await docRef.delete();
    console.log(`[SERVER_WRITE_AUDIT] op: ${opName}, sub: ${subsystem}, status: SUCCESS, duration: ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.warn(`[SERVER_WRITE_ERROR] op: ${opName}, sub: ${subsystem}, error:`, err?.message || err);
    if (isServerQuotaError(err)) {
      serverCircuitBreaker.recordFailure(err);
    }
    throw err;
  }
}

/**
 * Server Safe onSnapshot with quota guard and cleanup.
 */
export function serverSafeOnSnapshot(
  queryOrCollection: any,
  onNext: (snap: any) => void,
  options: ServerGatewayReadOptions = {}
): () => void {
  const opName = options.operationName || 'serverOnSnapshot';
  const subsystem = options.subsystem || 'server_general';

  if (!serverCircuitBreaker.allowRead(false)) {
    console.info(`[SERVER_SNAPSHOT] Quota breaker OPEN/HALF_OPEN. Subscription skipped for ${opName} (${subsystem}).`);
    return () => {};
  }

  try {
    const unsub = queryOrCollection.onSnapshot(
      (snapshot: any) => {
        serverCircuitBreaker.recordSuccess();
        onNext(snapshot);
      },
      (err: any) => {
        console.warn(`[SERVER_SNAPSHOT_ERROR] ${opName} (${subsystem}):`, err?.message || err);
        if (isServerQuotaError(err)) {
          serverCircuitBreaker.recordFailure(err);
        }
      }
    );
    return unsub || (() => {});
  } catch (err: any) {
    console.warn(`[SERVER_SNAPSHOT_INIT_ERROR] ${opName}:`, err?.message || err);
    return () => {};
  }
}
