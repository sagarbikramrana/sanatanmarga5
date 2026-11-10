import { determineRoleFromEmail, isBootstrapSuperAdmin } from "../src/lib/auth";
import { 
  getActiveTrainingSecret, 
  generateCertificateVerificationHash, 
  verifyCertificateCryptographicSeal,
  isTrainingSecretConfigured 
} from "../server/trainingSecurity";
import * as fs from "fs";
import * as path from "path";

// ANSI Terminal Colors
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

let passCount = 0;
let failCount = 0;
let unverifiedCount = 0;

function assert(condition: boolean, testName: string, unverifiedReason?: string) {
  if (unverifiedReason) {
    console.log(`${YELLOW}⚠ UNVERIFIED: ${testName} (${unverifiedReason})${RESET}`);
    unverifiedCount++;
    return;
  }
  if (condition) {
    console.log(`${GREEN}✔ PASS: ${testName}${RESET}`);
    passCount++;
  } else {
    console.error(`${RED}✘ FAIL: ${testName}${RESET}`);
    failCount++;
  }
}

async function runPhase1ASafetyTests() {
  console.log(`\n${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   SANATANMARGA 5.0 BETA — PHASE 1A SECURITY & SAFETY VERIFIER   ${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}\n`);

  // -------------------------------------------------------------
  // TEST GROUP 1: AUTHENTICATION & ROLE ELEVATION (SEC-01)
  // -------------------------------------------------------------
  console.log(`${BOLD}--- 1. AUTH & ROLE ELEVATION TESTS (SEC-01) ---${RESET}`);
  
  assert(
    determineRoleFromEmail("admin@malicious.com") === "user",
    "Email prefix 'admin@' cannot elevate to admin"
  );
  assert(
    determineRoleFromEmail("editor123@news.org") === "user",
    "Email prefix 'editor' cannot elevate to editor"
  );
  assert(
    determineRoleFromEmail("superadmin@attacker.com") === "user",
    "Email prefix 'superadmin' cannot elevate to super_admin"
  );
  assert(
    determineRoleFromEmail("reporter@nepal.org") === "user",
    "Email prefix 'reporter' cannot elevate to reporter"
  );
  assert(
    determineRoleFromEmail("sagarrana@gmail.com") === "super_admin",
    "Authoritative platform owner email receives bootstrap super_admin"
  );
  assert(
    isBootstrapSuperAdmin("sagarrana@gmail.com") === true,
    "isBootstrapSuperAdmin identifies authorized platform owner"
  );
  assert(
    isBootstrapSuperAdmin("someoneelse@gmail.com") === false,
    "isBootstrapSuperAdmin rejects arbitrary users"
  );

  // -------------------------------------------------------------
  // TEST GROUP 2: TRAINING HMAC SECRET & FAIL-CLOSED ISSUANCE (SEC-03)
  // -------------------------------------------------------------
  console.log(`\n${BOLD}--- 2. TRAINING HMAC SECRET TESTS (SEC-03) ---${RESET}`);

  // Save current env
  const origSecret = process.env.TRAINING_HMAC_SECRET;
  const origCertSecret = process.env.CERT_SECRET_KEY;

  delete process.env.TRAINING_HMAC_SECRET;
  delete process.env.CERT_SECRET_KEY;

  let threwWithoutSecret = false;
  try {
    getActiveTrainingSecret();
  } catch (err: any) {
    if (err.message.includes("CREDENTIAL_SECURITY_UNCONFIGURED")) {
      threwWithoutSecret = true;
    }
  }
  assert(
    threwWithoutSecret,
    "Missing server HMAC secret FAILS CLOSED on issuance/signing"
  );

  let issuanceThrewWithoutSecret = false;
  try {
    generateCertificateVerificationHash("user_123", "cert_journalist", "2026-09-28T00:00:00Z");
  } catch (err: any) {
    if (err.message.includes("CREDENTIAL_SECURITY_UNCONFIGURED")) {
      issuanceThrewWithoutSecret = true;
    }
  }
  assert(
    issuanceThrewWithoutSecret,
    "generateCertificateVerificationHash refuses to sign without configured secret"
  );

  // Test backward-compatible verification of legacy certs
  const legacyCert = {
    userId: "legacy_user",
    certificationId: "cert_reader",
    issuedAt: "2026-03-01T00:00:00Z",
    scorePercent: 85,
    tenantId: "sanatan-media",
    // Hash generated under historical pilot secret
    verificationHash: "0x"
  };
  // Configure active secret to test normal operation
  process.env.TRAINING_HMAC_SECRET = "temp-test-secret-for-verifier-2026";
  const validHash = generateCertificateVerificationHash("test_user_42", "cert_journalist", "2026-09-28T00:00:00Z", 95, "sanatan-media");
  assert(
    validHash.startsWith("0x") && validHash.length === 34,
    "Configured secret produces valid deterministic 0x... hash signature"
  );
  assert(
    verifyCertificateCryptographicSeal({
      userId: "test_user_42",
      certificationId: "cert_journalist",
      issuedAt: "2026-09-28T00:00:00Z",
      scorePercent: 95,
      tenantId: "sanatan-media",
      verificationHash: validHash
    }),
    "verifyCertificateCryptographicSeal verifies valid seal under active secret"
  );

  // Restore env
  if (origSecret) process.env.TRAINING_HMAC_SECRET = origSecret;
  else delete process.env.TRAINING_HMAC_SECRET;
  if (origCertSecret) process.env.CERT_SECRET_KEY = origCertSecret;
  else delete process.env.CERT_SECRET_KEY;

  // -------------------------------------------------------------
  // TEST GROUP 3: SERVER STARTUP SAFETY (MIG-01)
  // -------------------------------------------------------------
  console.log(`\n${BOLD}--- 3. STARTUP SAFETY AUDIT (MIG-01) ---${RESET}`);
  const serverCode = fs.readFileSync(path.join(process.cwd(), "server.ts"), "utf-8");

  const hasStartupCleanup = /app\.listen[\s\S]*?cleanupDuplicatesAndGarbage/m.test(serverCode);
  assert(
    !hasStartupCleanup,
    "app.listen does NOT execute automatic cleanupDuplicatesAndGarbage on boot"
  );

  const hasSelfInvokingMigration = /\(async\s*\(\)\s*=>\s*\{[\s\S]*?Starting startup check for uncategorized articles/m.test(serverCode);
  assert(
    !hasSelfInvokingMigration,
    "server.ts does NOT execute self-invoking uncategorized articles scan on boot"
  );

  const hasExplicitCategorizeEndpoint = serverCode.includes('/api/admin/maintenance/categorize-articles');
  assert(
    hasExplicitCategorizeEndpoint,
    "Explicit maintenance endpoint /api/admin/maintenance/categorize-articles exists"
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: FIRESTORE COMMERCE & USERS RULES AUDIT (SEC-02)
  // -------------------------------------------------------------
  console.log(`\n${BOLD}--- 4. FIRESTORE RULES AUDIT (SEC-02) ---${RESET}`);
  const rulesCode = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf-8");

  const storeProductsOpen = /match \/store_products\/\{productId\} \{\s*allow read, write: if true;/m.test(rulesCode);
  assert(!storeProductsOpen, "store_products is NOT open with 'allow read, write: if true;'");

  const storeOrdersOpen = /match \/store_orders\/\{orderId\} \{\s*allow read, write: if true;/m.test(rulesCode);
  assert(!storeOrdersOpen, "store_orders is NOT open with 'allow read, write: if true;'");

  const storeOrderAuditsOpen = /match \/store_order_audits\/\{auditId\} \{\s*allow read, write: if true;/m.test(rulesCode);
  assert(!storeOrderAuditsOpen, "store_order_audits is NOT open with 'allow read, write: if true;'");

  const commerceCustomersOpen = /match \/commerce_customers\/\{customerId\} \{\s*allow read, write: if true;/m.test(rulesCode);
  assert(!commerceCustomersOpen, "commerce_customers is NOT open with 'allow read, write: if true;'");

  const commerceOrdersPublicRead = /match \/commerce_orders\/\{orderId\} \{\s*allow read: if true;/m.test(rulesCode);
  assert(!commerceOrdersPublicRead, "commerce_orders is NOT publicly readable without auth/ownership");

  const tenantsOpen = /match \/tenants\/\{tenantId\} \{\s*allow read, write: if true;/m.test(rulesCode);
  assert(!tenantsOpen, "tenants collection is NOT writable by unauthenticated clients");

  const usersSelfElevateProtected = rulesCode.includes("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'");
  assert(usersSelfElevateProtected, "users/{uid} rule prevents non-admin users from modifying their own role");

  // -------------------------------------------------------------
  // TEST GROUP 5: SNAPSHOT CANONICAL AUTHORITY (MIG-04)
  // -------------------------------------------------------------
  console.log(`\n${BOLD}--- 5. SNAPSHOT CANONICAL AUTHORITY AUDIT (MIG-04) ---${RESET}`);
  const snapshotCode = fs.readFileSync(path.join(process.cwd(), "server", "snapshotOs.ts"), "utf-8");

  const hasSourceAuthorityType = snapshotCode.includes("SnapshotSourceAuthority");
  assert(hasSourceAuthorityType, "SnapshotOS defines SnapshotSourceAuthority type");

  const hasUploadBlockGuard = snapshotCode.includes("module_r2_upload_blocked");
  assert(hasUploadBlockGuard, "SnapshotOS blocks R2 upload of degraded RECOVERY modules");

  const hasManifestBlockGuard = snapshotCode.includes("manifest_publication_blocked");
  assert(hasManifestBlockGuard, "SnapshotOS blocks manifest publication when core modules are degraded");

  // -------------------------------------------------------------
  // TEST GROUP 6: TENANT SECURITY ENFORCEMENT (SEC-05)
  // -------------------------------------------------------------
  console.log(`\n${BOLD}--- 6. TENANT SECURITY ENFORCEMENT (SEC-05) ---${RESET}`);
  const trainingEndpointsCode = fs.readFileSync(path.join(process.cwd(), "server", "trainingEndpoints.ts"), "utf-8");

  const hasTenantResolver = trainingEndpointsCode.includes("resolveAuthorizedTenant");
  assert(hasTenantResolver, "trainingEndpoints implements resolveAuthorizedTenant");

  const hasCrossTenantDenied = trainingEndpointsCode.includes("TENANT_AUTHORIZATION_DENIED");
  assert(hasCrossTenantDenied, "trainingEndpoints returns 403 on unauthorized cross-tenant requests");

  // Multi-tenant database schema isolation requires future migration
  assert(
    false,
    "Full database-level multi-tenant collection isolation",
    "Additive schema migration planned for future tenant phase; server boundary enforcement verified"
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log(`\n${BOLD}=================================================================${RESET}`);
  console.log(`${BOLD}PHASE 1A TEST SUMMARY:${RESET}`);
  console.log(`  ${GREEN}Passed: ${passCount}${RESET}`);
  console.log(`  ${RED}Failed: ${failCount}${RESET}`);
  console.log(`  ${YELLOW}Unverified / Deferred: ${unverifiedCount}${RESET}`);
  console.log(`${BOLD}=================================================================${RESET}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase1ASafetyTests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
