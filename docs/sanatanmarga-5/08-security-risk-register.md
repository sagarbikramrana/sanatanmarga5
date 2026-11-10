# SanatanMarga 5.0 Beta — Security Risk Register

## 1. Security Risk Inventory

### SEC-01: Client-Side Role Determination Vulnerability (Email Prefix Matching)
- **Severity**: **CRITICAL**
- **Subsystem**: Authentication & Identity (`src/lib/auth.tsx`)
- **Evidence**:
  ```ts
  // src/lib/auth.tsx lines 33-72
  export const determineRoleFromEmail = (email?: string | null): UserRole => {
    if (!email) return 'user';
    const e = email.toLowerCase().trim();
    if (e.startsWith('admin') || e.includes('admin@')) return 'admin';
    if (e.startsWith('editor') || e.includes('editor@')) return 'editor';
    if (e.startsWith('superadmin') || e.includes('superadmin@')) return 'super_admin';
    ...
  }
  // line 88-92
  newUser.role = determineRoleFromEmail(email);
  await setDoc(doc(db, 'users', res.user.uid), newUser);
  ```
- **Impact**: Any user who registers with an arbitrary email address starting with `admin...` or containing `admin@` (e.g. `admin-attacker@mailinator.com`) is automatically assigned the `admin` role and writes it directly to Firestore during signup.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 1 (Auth & IAM Security Hardening). Server-side role assignment and admin claims must be strictly governed by trusted database documents or server verification.

---

### SEC-02: Unauthenticated Open Access on Store & Commerce Collections
- **Severity**: **CRITICAL**
- **Subsystem**: Firestore Security Rules (`firestore.rules`)
- **Evidence**:
  ```javascript
  // firestore.rules lines 78-93
  match /commerce_customers/{customerId} {
    allow read, write: if true;
  }
  match /store_products/{productId} {
    allow read, write: if true;
  }
  match /store_orders/{orderId} {
    allow read, write: if true;
  }
  match /store_order_audits/{auditId} {
    allow read, write: if true;
  }
  ```
- **Impact**: Completely unrestricted public read and write access to store products, customer details, orders, and order audit trails. Any unauthenticated caller can alter product prices, modify customer data, or delete orders.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 1 / Phase 2. Require server authentication or Admin verification for all store mutation rules.

---

### SEC-03: Hardcoded Fallback Cryptographic HMAC Secret
- **Severity**: **HIGH**
- **Subsystem**: Academy & Certification Security (`server/trainingSecurity.ts`)
- **Evidence**:
  ```ts
  // server/trainingSecurity.ts line 3
  export const TRAINING_HMAC_SECRET = process.env.TRAINING_HMAC_SECRET || "sanatan-marga-training-cryptographic-master-key-2026";
  ```
- **Impact**: If `TRAINING_HMAC_SECRET` is omitted from server environment variables, the system falls back to a public repository string. An attacker could forge valid cryptographic certificate hashes offline.
- **Likelihood**: MEDIUM
- **Recommended 5.0 Phase**: Phase 1 / Phase 6. Require strict environment variable assertion or secure key derivation at boot time.

---

### SEC-04: Non-Transactional Certificate Issuance (In-Memory Concurrency Lock)
- **Severity**: **HIGH**
- **Subsystem**: Certificate Issuance Engine (`server/trainingEndpoints.ts`)
- **Evidence**:
  ```ts
  // server/trainingEndpoints.ts line 504
  const lockKey = `${tenantId}:${userId}:${canonicalCertId}`;
  if (issuanceLocks.has(lockKey)) { return res.status(429)... }
  issuanceLocks.add(lockKey);
  // Followed by non-transactional get() and setDoc()
  ```
- **Impact**: The lock is kept in a single Node.js process `Set`. Across multi-instance deployments (e.g. Render autoscaling, Cloud Run), duplicate certificates can be issued concurrently.
- **Likelihood**: MEDIUM
- **Recommended 5.0 Phase**: Academy & Credential Engine Hardening (Phase 6). Use Firestore atomic transactions or distributed locks for credential issuance.

---

### SEC-05: Missing Tenant Isolation in Database Rules & Queries
- **Severity**: **HIGH**
- **Subsystem**: Multi-Tenant Federation (`src/lib/tenantContext.tsx`)
- **Evidence**:
  - `activeTenant` is stored in client `localStorage` (`sutra_active_tenant_id`).
  - Firestore queries in `articles`, `events`, and `community` do not filter by `tenantId`.
  - `firestore.rules` does not enforce tenant tenancy checks.
- **Impact**: Tenant isolation is UI-only. Any authenticated client can read or modify records belonging to other tenants.
- **Likelihood**: HIGH
- **Recommended 5.0 Phase**: Phase 1 / Tenant Safety phase.
