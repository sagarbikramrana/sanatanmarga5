# The Sanatan Marga Platform Manifest
*(The Constitutional Blueprint of Sanatan Media)*

This Platform Manifest serves as the absolute single source of truth describing the vision, technical operating systems, security models, release procedures, and operational governance of the **Sanatan Marga** digital media ecosystem.

---

## 1. Vision & Core Philosophy

**Sanatan Marga** is a digital-first, decentralized, and high-fidelity media platform designed to promote authentic spiritual heritage, cultural preservation, and civic community engagement. Rather than operating as a simple, static news website, the platform behaves as a highly cohesive **Digital Media Operating System** combining high-standard journalism with public civic discourse.

### 1.1 The Golden SRE Triad
*   **Aesthetic Honesty**: Pristine, high-contrast visual design, leveraging custom typography, rich analog spacing, and a total absence of generic visual noise.
*   **Operational Discipline**: Real-time observability, self-healing offline sync pipelines, and fully sandboxed environments.
*   **Community Integrity**: Self-moderating civic circles protected by decentralized reporting, transparent appeals, and strict RBAC governance.

---

## 2. Integrated Operating Systems (OS)

Sanatan Marga operates as a modular matrix of eight distinct server-and-client-side operating subsystems:

```
               ┌────────────────────────────────────────────────────────┐
               │              SANATAN MARGA OPERATING ENGINE            │
               └───────────────────────────────────────────┬────────────┘
                                                           │
          ┌──────────────────────┬─────────────────────────┼────────────────────────┬─────────────────────┐
          ▼                      ▼                         ▼                        ▼                     ▼
┌──────────────────┐   ┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐   ┌──────────────────┐
│  PUBLISHING OS   │   │ OBSERVABILITY OS │      │ COMMUNITY OS     │     │ MEDIA ASSET OS   │   │  MODERATION OS   │
│  Assignment Desk │   │  Live Telemetry  │      │  Chautari Feed   │     │ Soft Deletes     │   │  Immutable Logs  │
│  Coverage Plan   │   │  Health Checks   │      │  Nepali Input    │     │ Copyright Gov    │   │  Active Bans     │
└──────────────────┘   └──────────────────┘      └──────────────────┘     └──────────────────┘   └──────────────────┘
```

### 2.1 Editorial Publishing OS
*   **Assignment Desk**: Automates workflow handoffs from pitches, assignments, drafting, and editing to production-level deployment.
*   **Coverage Calendar**: Provides journalists and chief editors with real-time, interactive coordinate mappings of editorial assignments, category pipelines, and scheduling lanes.

### 2.2 Observability & Health OS
*   **Live Telemetry Hub**: Measures API health, query latencies, and transaction error rates in real-time.
*   **System Diagnostics**: Displays direct indicators for database accessibility, notification relay status, and Sentry exception logs.

### 2.3 Community (Chautari) OS
*   **Civic Feed**: Responsive, modern community noticeboard utilizing customized, smooth animation physics.
*   **Nepali Input Engine**: Integrated phonetic, transliterated keyboard mapping directly converting Latin keys into Devnagari characters on the fly.

### 2.4 Media Asset OS
*   **Soft Deletes**: Safety guard preventing irreversible asset purges. Erased assets are archived with timestamps and can be restored.
*   **Copyright Governance**: Rigorous metadata schemas enforcing creative licenses, usage restrictions, and photographer citation standards.

### 2.5 Moderation OS
*   **Reports Queue**: Flagging mechanics built directly into user posts and comments for spam, harassment, and misinformation.
*   **Active Restrictions Registry**: Granular, staff-governed user bans, mutes, warning levels, and shadow bans.
*   **Appeals Panel**: Public relief channel allowing penalized community members to file structured appeals directly.

### 2.6 Notification OS
*   **Sentry Pipeline**: Alerts staff on system warnings, database lag, and moderation escalations.
*   **Sponsor Campaign Engine**: Schedules, previews, and tracks monetization campaigns and client sponsorships.

---

## 3. Governance & Role-Based Access Control (RBAC)

The platform enforces zero-trust, attribute-based access control (ABAC) through secure Firestore rules aligned with three primary roles:

| Role | Operational Scope | Access Levels |
| :--- | :--- | :--- |
| **Reader (Community)** | Standard interaction & civic feedback. | Read articles, post in Chautari, flag violations, file appeals. |
| **Editor (Journalist)** | Content creation, draft validation, asset cataloging. | Write articles, moderate Chautari comments, dismiss flags. |
| **Admin (System Lead)** | Executive system configuration, financial audits, security. | Full database control, manage roles, enforce permanent bans. |

---

## 4. Deployment & Infrastructure Architecture

The platform follows a robust, cloud-native containerized architecture:

1.  **Frontend/Backend Runtime**: Express + Vite TypeScript app compiled to highly efficient CommonJS using `esbuild`.
2.  **Container Platform**: Served on fully managed Google Cloud Run containers, scaling down to zero for cost savings.
3.  **Reverse Proxy**: Nginx layer routing all incoming SSL traffic exclusively through Port `3000`.
4.  **Database Strategy**: High-performance Firebase Firestore integrated with locally cached Offline Synchronization queues.

---

## 5. Deployment Gates & Release Management

To guarantee high stability, every code modification must pass three automated deployment gates:

```
[ Code Change ] ────► [ Gate 1: Code Linting ] ────► [ Gate 2: Full Build Compile ] ────► [ Gate 3: SRE Rollback Plan Check ] ────► [ Production Deploy ]
```

*   **Gate 1 (Quality Check)**: Standardized ESLint syntax and structural rules validation.
*   **Gate 2 (Build Integrity)**: Full production-level asset compilation and bundling.
*   **Gate 3 (Disaster Readiness)**: Mandatory validation against the `/DISASTER_RECOVERY_TEST_REPORT.md` rollback runbook.

---

## 6. SRE Incident Playbook & Recovery Procedures

Our pre-launch Site Reliability Engineering (SRE) test suites guarantee high resilience under catastrophic conditions:

### 6.1 Database Recovery Procedure (RPO: 2h 35m)
In the event of database corruption or deletion, restore Firestore to a stable snapshot state:
```bash
gcloud firestore import gs://sanatan-marga-backups-prod/[TIMESTAMP]/
```

### 6.2 Hot Rollback Procedure (RTO: 32s)
In case of a faulty release crashing the container, run the instant rollback command:
```bash
gcloud run deploy sanatan-marga-prod \
  --image gcr.io/sanatan-marga/app:previous-stable \
  --region asia-east1
```

### 6.3 Graceful Degradation Strategy
If external microservices (Sentry, ad trackers, or alert channels) fail, the platform isolates the affected client process, caches pending logs, and maintains 100% functionality of critical editorial and community systems.

---

*Manifest ratified and approved for production readiness on:* **July 18, 2026**  
*Lead Systems Architect:* **Sanatan Marga Core Engineering**  
