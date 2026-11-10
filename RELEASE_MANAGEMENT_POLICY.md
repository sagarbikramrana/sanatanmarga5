# Sanatan Marga - Release Management & Governance Policy
*(Production Operations & Delivery Framework)*

This policy establishes the formal protocols, testing requirements, deployment gates, and disaster recovery strategies for pushing code updates and feature releases to the **Sanatan Marga** production environment.

---

## 1. Release Classification & Versioning

Sanatan Marga strictly adheres to the **Semantic Versioning (SemVer) 2.0.0** specification, structured as `MAJOR.MINOR.PATCH`.

```txt
  [MAJOR] . [MINOR] . [PATCH]
    │         │         │
    │         │         └─── Bug fixes, minor patches, or hotfixes (e.g., 1.4.1)
    │         └───────────── New features or sprint updates without breaking changes (e.g., 1.5.0)
    └─────────────────────── Structural architectural changes or major platform migrations (e.g., 2.0.0)
```

### 1.1 Patch Releases (`X.Y.Z` where `Z` increments)
*   **Definition**: Fast-tracked bug fixes, localization corrections, emergency security hotfixes, or performance tuning that does not modify database schemas.
*   **Approval**: Requires sign-off from the Tech Lead or Release Manager.
*   **Rollout Window**: Anytime, with automated testing validation.

### 1.2 Minor Releases (`X.Y.Z` where `Y` increments)
*   **Definition**: Delivery of completed Sprints (e.g., Sprint G - Moderation OS), introduction of non-destructive schema additions, or new secondary dashboards.
*   **Approval**: Requires joint sign-off from Product Operations and Engineering.
*   **Rollout Window**: Scheduled off-peak maintenance hours.

### 1.3 Major Releases (`X.Y.Z` where `X` increments)
*   **Definition**: Relational database structural changes, major authentication standard migrations, framework upgrades, or platform pivots.
*   **Approval**: Requires executive stakeholder approval following complete staging environment dress rehearsals.
*   **Rollout Window**: Pre-announced maintenance window (minimum 24-hour advance notice to editors).

---

## 2. Production Deployment Gates

Before any build is deployed to the live production server (Cloud Run / CDN), it **must** successfully pass all six production gates. Failure of a single gate halts the deployment pipeline.

```txt
┌──────────────┐    ┌──────────────┐    ┌───────────────────┐
│  1. LINT     │───>│  2. BUILD    │───>│  3. LAUNCH AUDIT  │
│  (No Errors) │    │  (Compile)   │    │  (Status Verified)│
└──────────────┘    └──────────────┘    └───────────────────┘
                                                  │
                                                  ▼
┌──────────────┐    ┌──────────────┐    ┌───────────────────┐
│ 6. OBSERV    │<───│  5. NOTIFY   │<───│  4. FIRE RULES    │
│ (Active Logs)│    │ (Alert Test) │    │  (Security Pass)  │
└──────────────┘    └──────────────┘    └───────────────────┘
```

### Gate 1: Lint Pass
*   **Command**: `npm run lint`
*   **Criteria**: Zero syntax errors, no dead import references, and strict adherence to TypeScript compiler types without using `any` overrides in new contributions.

### Gate 2: Build Pass
*   **Command**: `npm run build`
*   **Criteria**: Successful compilation of the client-side single page app into the `dist/` asset archive and bundling of `server.ts` into a self-contained production bundle.

### Gate 3: Launch Audit Pass
*   **File Checked**: `/LAUNCH_AUDIT_REPORT.md`
*   **Criteria**: Verification that no open "High" risk findings remain in the active ticket queue.

### Gate 4: Firestore Rules Pass
*   **Files Checked**: `firestore.rules` and `firebase-blueprint.json`
*   **Criteria**: Review rules configuration to ensure administrative and internal collections (e.g., `auditLogs`, `errorEvents`, `campaigns`) remain protected under zero-trust authorization claims.

### Gate 5: Notification Test Pass
*   **Validation**: Verify template rendering with localized strings and fallbacks. Check that user notification muted preferences are fully respected before broadcast dispatches.

### Gate 6: Observability Test Pass
*   **Validation**: Assure Sentry exceptions logging hooks and active diagnostics in the Operations Center are listening to platform health events.

---

## 3. Rollback & Emergency Recovery Rules

When live incidents occur post-deployment, Sanatan Marga prioritizes system availability and editorial continuity over active hotfixing.

### 3.1 Rollback Triggers (When to Rollback)
A rollback is immediately triggered if any of the following occur within 60 minutes of a release:
1.  **Availability Drop**: App loading times or API route response failures exceed 5% of active requests.
2.  **Editorial Lockout**: Editors or journalists cannot save drafts, transition status flags, or upload crucial media.
3.  **Security Breach / Data Leak**: Unauthorized users gain elevated access roles, or private collections are exposed.
4.  **Audit Integrity Breakdown**: System fail-safes prevent audit log insertion, compromising accountability tracking.

### 3.2 Rollback Authority (Who Approves)
*   **Emergency Rollback**: Can be initiated immediately by the **On-Call Operations Engineer** without higher approval if service degradation exceeds 10% (P0 Incident).
*   **Standard Rollback**: Requires approval from the **Technical Lead** or **Release Manager** following a quick diagnostic assessment (P1/P2 Incident).

### 3.3 Rollback Execution (How Rollback Happens)
1.  **VCS Shift**: Revert the production branch reference to the previous stable release tag (e.g., `git revert` or redeploying the previous stable container image).
2.  **Container Redeployment**: Trigger the deployment of the previous verified container version (`dist/server.cjs`) to Cloud Run. Execution completes in $<30$ seconds.
3.  **Database Protection**: 
    *   If the failed release did not modify the Firestore schema: Roll back immediately.
    *   If database migrations were introduced: Execute the pre-scripted schema rollback script to preserve backward compatibility before deploying the legacy container.
4.  **Post-Mortem**: Document the incident in `/auditLogs` and conduct a mandatory technical post-mortem before rescheduling the release.

---

## 4. Governance Verification Signature

This release governance standard represents Sanatan Marga's commitment to high availability and zero-downtime news operations.

*Policy Established By:* **Technical Operations Team**  
*Effective Date:* **July 18, 2026**  
*Document Version:* **1.0.0**
