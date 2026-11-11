# Sanatan Marga - Production Deployment Runbook
*(Systems Operations & Site Reliability Engineering Manual)*

This runbook serves as the step-by-step operational guide for provisioning, deploying, scaling, and maintaining **Sanatan Marga** in a production environment. It covers infrastructure configuration, environment variables, multi-stage deployment commands, backup/recovery, and standard incident response checklists.

---

## 1. Production Architecture Overview

The production deployment of Sanatan Marga operates on a high-availability serverless topology utilizing **Google Cloud Platform (GCP)** and **Firebase** services.

```txt
  [ End Users / Public Readers ]
               │ (HTTPS/TLS)
               ▼
   ┌───────────────────────┐
   │    Nginx / CDN GSLB   │
   └───────────────────────┘
               │ (Reverse Proxy)
               ▼
   ┌───────────────────────┐
   │   Cloud Run Service   │ <─── Environment Variables (.env)
   │  (dist/server.cjs)    │
   └───────────────────────┘
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│  Firestore   │ │ Firebase Auth│
│  (Database)  │ │ (Identity)  │
└──────────────┘ └──────────────┘
```

---

## 2. Environment Configuration

The production server requires the following environment variables to be set in the GCP Secret Manager or the Cloud Run deployment configuration. **Do not embed these in source control.**

| Variable Name | Description | Source / Reference |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be set to `production`. Controls bundler optimizations. | Standard environment |
| `GEMINI_API_KEY` | Private key to authorize server-side smart-newsroom routines. | Google AI Studio / GCP Secret |
| `FIREBASE_PROJECT_ID` | Identifies the Firestore instance. | Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | Service Account email for admin SDK integrations. | GCP IAM Console |
| `FIREBASE_PRIVATE_KEY` | Service Account private key (multiline string). | GCP Secret Manager |
| `INTERNAL_TASK_SECRET` | Cryptographic secret (`>= 32` chars) for `X-Internal-Task-Secret` outbox/scheduler triggers. | GCP Secret Manager / Render Env |
| `SCHEDULER_SERVICE_ACCOUNT_EMAIL` | Authorized GCP Service Account email for Cloud Scheduler OIDC bearer tokens. | GCP IAM Console |
| `CLOUD_RUN_SERVICE_URL` | Canonical Cloud Run audience URL verified during OIDC token validation. | Cloud Run Console |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Server & client Sentry DSN for structured telemetry (`CAS_CONFLICT`, `OUTBOX_FAILURE`, `SCHEDULER_FAILURE`). | Sentry Organization Settings |
| `SNAPSHOT_R2_BUCKET_NAME` | Dedicated Cloudflare R2 bucket for SnapshotOS CAS manifests (`manifest.json`). | Cloudflare R2 Dashboard |
| `MEDIA_R2_BUCKET_NAME` | Dedicated Cloudflare R2 bucket for immutable media/audio assets. | Cloudflare R2 Dashboard |

---

## 2B. Multi-Platform Deployment Targets (GitHub, Render, Vercel, Netlify)

SanatanMarga 5.0 includes turnkey deployment configurations for all major cloud platforms:
- **GitHub Actions CI (`.github/workflows/ci.yml`)**: Automatically runs `npm run lint`, all Phase 4B.1 / 4B.1W / 1B / 4B.2 gates (`npm test`), and verifies `dist/index.html` + `dist/server.cjs` on every push and pull request.
- **Render Full-Stack Node Service (`render.yaml`)**: Runs `npm ci && npm run build` and starts `npm run start` (`NODE_ENV=production node dist/server.cjs`) with `/health` readiness probes.
- **Vercel (`vercel.json`) & Netlify (`netlify.toml`)**: Pre-configured with `dist` static output, immutable `/assets/*` caching, strict security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), and SPA fallback routing (`/* -> /index.html`).

---

## 3. Production Deployment Gates Checklist

Before launching, the deployment team must verify that each gate has passed successfully:

```bash
# Gate 1 & 2: Build & Lint Validation
npm run lint
npm run build
```

Verify that the following configurations are deployed:
- [ ] **Firestore Rules**: Ensure `firestore.rules` is pushed to Firebase.
- [ ] **Database Schema**: Validate `firebase-blueprint.json` schemas against target collections.
- [ ] **Media Assets Policy**: Verify that Soft Delete is active (`deleted: true` pattern is deployed).

---

## 4. Multi-Stage Deployment Procedure

To perform a zero-downtime rolling update on Cloud Run, follow these steps:

### Step 4.1: Deploy Firestore Rules & Blueprints
Deploy security rules using the Firebase CLI or the platform deployment system:
```bash
# Deploys security rules
firebase deploy --only firestore:rules
```

### Step 4.2: Package & Compile Server
Compile the server using the optimized `esbuild` configuration defined in `package.json`:
```bash
# Triggers client-side static build and server-side CommonJS bundling
npm run build
```
Verify that `dist/index.html` and `dist/server.cjs` exist in the build workspace.

### Step 4.3: Deploy Container to Cloud Run
Build the container image using Cloud Build and deploy it to Cloud Run:
```bash
# Build production container image
gcloud builds submit --tag gcr.io/sanatan-marga/app:latest

# Deploy to Cloud Run with 0.0.0.0 host binding on port 3000
gcloud run deploy sanatan-marga-prod \
  --image gcr.io/sanatan-marga/app:latest \
  --platform managed \
  --region asia-east1 \
  --port 3000 \
  --allow-unauthenticated
```

---

## 5. Automated Backup & Disaster Recovery (DR)

### 5.1 Firestore Backups (Daily Automated Cron)
Configure automated scheduled backups of the Firestore database using GCP Cloud Scheduler:
```bash
# Command executed daily via Cloud Scheduler
gcloud firestore export gs://sanatan-marga-backups-prod
```
*   **Backup Retaining Window**: 30 Days (governed by GCS lifecycle rules).
*   **Target Backup Bucket**: `gs://sanatan-marga-backups-prod`

### 5.2 Schema Rollback & Restoration
To restore a backup in the event of major database corruption:
```bash
# Restore specific timestamp collection
gcloud firestore import gs://sanatan-marga-backups-prod/2026-07-18T00:00:00/
```

---

## 6. Incident Response & On-Call Playbooks

### 6.1 Playbook A: Privilege Escalation Incident
*   **Symptom**: Unauthorized write attempts logged in `auditLogs` or alert warnings in `errorEvents`.
*   **Immediate Actions**:
    1.  Go to **Firebase Console** $\rightarrow$ **Firestore** $\rightarrow$ **Rules**.
    2.  Locate the collection allowing compromised access.
    3.  Change permission from `allow write: if isStaff()` to `allow write: if isAdmin()`.
    4.  Deploy rules instantly to lock down the collection.
    5.  Identify the compromised UID and set their role to `banned` or revoke authentication state.

### 6.2 Playbook B: Severe Latency / Server Crashing
*   **Symptom**: Cloud Run containers crashing (HTTP 500, 502, 503 errors).
*   **Immediate Actions**:
    1.  Check active logs in **Operations Center** (`/admin/operations`).
    2.  Verify if the Gemini API is timing out under extreme volume.
    3.  If a bug was introduced in the active release version, execute immediate rollback.
    4.  Force-deploy the previous container image to return the system to a stable state:
        ```bash
        # Rollback Cloud Run to stable tag
        gcloud run deploy sanatan-marga-prod --image gcr.io/sanatan-marga/app:previous-stable
        ```

---

*Manual Maintained By:* **System Operations & Site Reliability Engineering (SRE)**  
*Last Updated:* **July 18, 2026**  
*Status:* **Approved for Production Use**  
