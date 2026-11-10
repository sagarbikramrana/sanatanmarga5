import { 
  FirestoreCircuitBreaker, 
  isQuotaOrContinuityError, 
  executeSingleFlight 
} from '../src/lib/firebase';
import { 
  ServerFirestoreCircuitBreaker, 
  isServerQuotaError 
} from '../server/firestoreGateway';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, details || '');
    failed++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("SANATANMARGA 5.0 — PHASE 1B GATEWAY & QUOTA TESTS");
  console.log("=================================================\n");

  // TEST 1: Error Classification
  console.log("--- 1. Quota Error Classification ---");
  const permError = { code: 'permission-denied', message: 'Missing or insufficient permissions' };
  const authError = { code: 'unauthenticated', message: 'Unauthenticated request' };
  const quotaError1 = { code: 'resource-exhausted', message: 'Quota exceeded for metric' };
  const quotaError2 = { code: 8, message: 'Resource exhausted: rate limit exceeded' };
  const quotaError3 = new Error("Quota limit reached for free tier database");

  assert(!isQuotaOrContinuityError(permError), "Client: permission-denied is NOT classified as quota error");
  assert(!isQuotaOrContinuityError(authError), "Client: unauthenticated is NOT classified as quota error");
  assert(isQuotaOrContinuityError(quotaError1), "Client: resource-exhausted is classified as quota error");
  assert(isQuotaOrContinuityError(quotaError2), "Client: GRPC code 8 is classified as quota error");
  assert(isQuotaOrContinuityError(quotaError3), "Client: 'Quota limit reached' string is classified as quota error");

  assert(!isServerQuotaError(permError), "Server: permission-denied is NOT classified as quota error");
  assert(!isServerQuotaError(authError), "Server: unauthenticated is NOT classified as quota error");
  assert(isServerQuotaError(quotaError1), "Server: resource-exhausted is classified as quota error");
  assert(isServerQuotaError(quotaError2), "Server: GRPC code 8 is classified as quota error");

  // TEST 2: Client Circuit Breaker Semantics
  console.log("\n--- 2. Client Circuit Breaker Semantics ---");
  const breaker = new FirestoreCircuitBreaker();
  breaker._forceState('CLOSED');

  assert(breaker.getState() === 'CLOSED', "Client Breaker starts in CLOSED state");
  assert(breaker.allowRead(false) === true, "CLOSED state permits standard reads");

  // Trip to OPEN_QUOTA
  breaker.trip("Test quota exhaustion");
  assert(breaker.getState() === 'OPEN_QUOTA', "Breaker transitions to OPEN_QUOTA after trip");
  assert(breaker.allowRead(false) === false, "OPEN_QUOTA blocks standard reads");
  assert(breaker.allowRead(true) === false, "OPEN_QUOTA blocks health probes during active cooldown");

  // Transition to HALF_OPEN
  breaker._forceState('HALF_OPEN');
  assert(breaker.getState() === 'HALF_OPEN', "Breaker is in HALF_OPEN state");
  assert(breaker.allowRead(false) === false, "HALF_OPEN blocks arbitrary non-probe reads");

  // Single-flight health probe lock in HALF_OPEN
  const firstProbeAllowed = breaker.allowRead(true);
  assert(firstProbeAllowed === true, "HALF_OPEN allows exactly 1 single-flight health probe");

  const secondProbeAllowed = breaker.allowRead(true);
  assert(secondProbeAllowed === false, "HALF_OPEN blocks concurrent second probe while first is in-flight");

  const normalReadDuringProbe = breaker.allowRead(false);
  assert(normalReadDuringProbe === false, "HALF_OPEN blocks normal read while probe is in-flight");

  // Probe failure returns breaker to OPEN_QUOTA
  breaker.recordFailure({ code: 'resource-exhausted', message: 'Probe failed: quota exceeded' });
  assert(breaker.getState() === 'OPEN_QUOTA', "Probe failure on quota returns breaker to OPEN_QUOTA");

  // Transition back to HALF_OPEN and test probe success
  breaker._forceState('HALF_OPEN');
  breaker.allowRead(true); // acquire probe
  breaker.recordSuccess();
  assert(breaker.getState() === 'CLOSED', "Probe success transitions breaker back to CLOSED");
  assert(breaker.allowRead(false) === true, "CLOSED state restores normal reads");

  // TEST 3: Server Circuit Breaker Semantics
  console.log("\n--- 3. Server Circuit Breaker Semantics ---");
  const serverBreaker = new ServerFirestoreCircuitBreaker();
  serverBreaker._forceState('CLOSED');

  assert(serverBreaker.getState() === 'CLOSED', "Server Breaker starts in CLOSED state");
  assert(serverBreaker.allowRead(false) === true, "Server CLOSED state permits standard reads");

  serverBreaker.trip("Server quota limit exceeded");
  assert(serverBreaker.getState() === 'OPEN_QUOTA', "Server Breaker transitions to OPEN_QUOTA");
  assert(serverBreaker.allowRead(false) === false, "Server OPEN_QUOTA blocks standard reads");

  serverBreaker._forceState('HALF_OPEN');
  assert(serverBreaker.allowRead(false) === false, "Server HALF_OPEN blocks arbitrary reads");
  assert(serverBreaker.allowRead(true) === true, "Server HALF_OPEN allows single probe");
  assert(serverBreaker.allowRead(true) === false, "Server HALF_OPEN blocks duplicate probe in flight");

  serverBreaker.recordSuccess();
  assert(serverBreaker.getState() === 'CLOSED', "Server Breaker transitions to CLOSED on probe success");

  // TEST 4: Single Flight Deduplication
  console.log("\n--- 4. Single-Flight Request Deduplication ---");
  let executionCount = 0;
  const testFn = async () => {
    executionCount++;
    await new Promise(r => setTimeout(r, 50));
    return "result_value";
  };

  const [res1, res2, res3] = await Promise.all([
    executeSingleFlight("test_key", testFn),
    executeSingleFlight("test_key", testFn),
    executeSingleFlight("test_key", testFn)
  ]);

  assert(executionCount === 1, "Single-flight deduplication executed underlying function exactly once", { executionCount });
  assert(res1 === "result_value" && res2 === "result_value" && res3 === "result_value", "All concurrent callers received correct result");

  // Summary
  console.log("\n=================================================");
  console.log(`PHASE 1B TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution encountered an error:", err);
  process.exit(1);
});
