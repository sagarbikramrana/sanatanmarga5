# SanatanMarga 5.0 — Project Continuity & Handover

> **Purpose:** This file is the durable handover record for continuing SanatanMarga across OpenCode, DeepSeek Harness, Vibe Coding apps, VS Code, and other IDEs.
>
> **Last updated:** 2026-11-10  
> **Current repository:** `C:\Users\sagar\OneDrive\Documents\sanatanmedia5`  
> **Current branch:** `main`  
> **Latest reported starting HEAD:** `d2b7ea5795041f35f2b27803dc4bec0f66145229`  
> **Current implementation state:** Phase 1A changes are uncommitted.

## 1. How every coding agent must use this file

At the beginning of every work session:

1. Read this file completely.
2. Inspect the actual repository, Git HEAD, branch, and working tree.
3. Treat this file as a handover aid, not as proof that code or tests currently exist.
4. Reconcile its claims against the actual code and command output.
5. Do not overwrite user changes or assume the last reported commit is still HEAD.
6. Before ending a phase, update this file with verified changes, tests, build evidence, Git state, decisions, blockers, and next steps.
7. Keep the root `IMPLEMENTATION_PLAN.md` aligned when roadmap status genuinely changes.
8. Never store credentials, tokens, private keys, service-account JSON, or production secrets here.

If another handover file exists, reconcile it rather than creating competing continuity documents.

## 2. Project mission and operating principles

SanatanMarga is a civilizational journalism, manuscript-science, media/broadcasting, and training platform.

Core principle: **NO SOURCE = NO STORY.**

Architecture and operating constraints:

- Preserve the existing application architecture; extend rather than redesign.
- No fake or placeholder production implementations.
- Use server-side authorization and derive actor identity from verified authentication.
- Preserve editorial approval, source verification, copyright governance, auditability, and existing manual workflows.
- Use bounded, testable changes with clear acceptance criteria.
- Do not deploy or mutate production Firebase/Firestore/R2 without explicit authorization.
- Do not expose secrets in source code, logs, Git, prompts, or handover files.
- Report client build and server build separately. A TypeScript no-emit check is not a server production build.
- Never claim a test, runtime behavior, or deployment was verified unless the command was actually run and its output inspected.

## 3. Technical context

Reported stack:

- React 19, TypeScript, Vite, Tailwind
- Node.js and Express
- Firebase Authentication and Firestore
- Cloudflare R2
- Gemini AI
- Existing IAM/RBAC, editorial workflow, audit logging, Notification OS, Snapshot OS, AI Newsroom, SGIS, MediaOS, and Training & CompetencyOS.

Repository path reported by the user:
`C:\Users\sagar\OneDrive\Documents\sanatanmedia5`

Important previous infrastructure findings to re-verify before deployment:

- `firebase-applet-config.json` has been reported as ignored while statically imported by `server.ts` and `src/lib/firebase.ts`; fresh-checkout provisioning must be addressed and tested.
- `public/firebase-messaging-sw.js` has been reported as required but ignored/untracked.
- `npx vite build` creates the client bundle.
- A production `dist/server.cjs` bundle has not been verified.
- `node --import tsx ./server.ts` was reported to start the server locally, but this is not equivalent to a production server bundle.
- Private R2 storage has been designed in earlier phases but was not enabled or validated against production infrastructure. Do not enable it as part of unrelated feature work.
- Legacy media without publication state has previously been treated as public for compatibility; any migration requires a separate reviewed plan.

## 4. Previous security and media hardening checkpoints

The following commit history and phase outcomes were previously reported. Verify actual Git history before relying on them:

| Phase | Reported final commit | Summary |
|---|---|---|
| Baseline | `aa3de260f485bf65c5cf90eda7db79b1e1f09700` | Git baseline and ignore hardening |
| 0B | `ce2e28720224080d3ba48c4dbbcb1900d2c0b536` | Firebase token verification; removed trust in client identity headers |
| 0C1 | `e4827ecba5866e4840ed7439e458e97488dbe1c0` | Shared authorization middleware; protected snapshot and DR mutations |
| 0C1.1 | `d3d5e52a0f8fac7e3130e6e60d5f8e1b70dce1b3` | Hardened snapshot rebuild inputs, DR routes, AI News client auth |
| 0C1.2 | `1afeff078ebe1f3c74e06a18829e9e786cbe33c9` | Read-only DR route verification |
| 0C2A | `493e172cca8a2a4e9f15061e7b69340110a19843` | Protected homepage composition and notification mutations |
| 0C2A.1 | `b78e0bbca1cb89de26177ecdacfd3a0773b99f97` | Protected composition reads; notification health data minimization |
| 0C2B | `8ac7334b23eeae2035478961ccbf0afa1af40508` | Media upload/storage route hardening |
| 0C2B.1 | `fff76b905e3bbc4a2e042918439f5fe70bcd749d` | Authorization-aware media stream and completion validation |
| 0C2B.2 | `40f8a0e4e6870dca8f2d1587729f0046a23d2bc9` | Publication-aware local media delivery and private R2 migration plan |
| 0C2B.3 | `763b52f99beb18e176632fc23597d9d946c69937` | Read-only private R2 migration readiness audit |
| 0C2B.4 | `efc94db4896644843f6e7ea0786adc519b3f0af6` | Private R2 adapter architecture, disabled by default |
| 0C2B.5 | `743ee5c6de78bddd85207272b9471a46548d3254` | New uploads default draft; publication transitions guarded |
| 0C2B.6 | `9237c6cbd2bf4d15f636bcd87973b0ab74f5afcb` | Removed fabricated Data-URL fallback; explicit draft upload flow |
| 0C2B.7 | `d2b7ea5795041f35f2b27803dc4bec0f66145229` | Typed media mutation results and client failure handling; provenance was later reported reconciled |

Reported `bun.lock` SHA256: `B8D3329842FF767ECBC2B32B15720094D65F20690A72E62040E277A26E796590`. Recompute before asserting it remains unchanged.

## 5. Launch readiness and DEPLOY-0 findings

A read-only launch audit was reported as green for its checklist, including security/RBAC, Notification OS, observability, Media Asset OS, performance/SEO/mobile/offline, and SM-AUD-003 WebP/srcset work.

A later DEPLOY-0 report clarified:

- Code checks: reported verified.
- Client build: verified with `npx vite build`.
- Server start: reported working with `node --import tsx ./server.ts`.
- Production server bundle: **not verified**; `dist/server.cjs` was not generated by the Vite build.
- Infrastructure: not tested; requires local environment configuration.
- Production deployment: not performed.

Do not treat the green checklist as proof of deployment readiness. The original category totals and claimed 41-item total need reconciliation against the actual checklist IDs/evidence.

## 6. Phase 1A — Scheduled Publishing OS

### Reported implementation

User supplied a Phase 1A completion report on 2026-11-10.

Files reported changed:

| File | Reported purpose |
|---|---|
| `src/types/editorial.ts` | Added `schedule`, `schedulingStatus`, `executionAttempts`, `lastAttemptAt`, `lastPublicationResult` to `EditorialCandidate` |
| `server.ts` | Imported/initialized `SchedulerOS`; corrected `logAuditEvent` calls to two-argument format |
| `server/schedulerOs.ts` | New Firestore-backed scheduler with polling, transaction-based job claiming, in-process locks, bounded retries, audit events, graceful shutdown |

Reported design:

- Scheduling data stored in existing `editorial_candidates` collection.
- `news.publish` permission gates schedule management.
- Only candidates in `"approved"` state are eligible for scheduling.
- UTC timestamp used for execution; IANA timezone retained for display.
- Maximum three attempts, 30-second base backoff.
- Firestore transactions used for job claiming.
- In-process `Set<string>` used as an additional same-instance lock.
- Scheduler starts with Express server.

Reported verification:

- `tsc --noEmit --skipLibCheck`: passed.
- Vite client production build: passed.
- Server TypeScript no-emit check: passed.
- Local server start with `node --import tsx ./server.ts`: previously reported working in DEPLOY-0.
- No dedicated automated scheduler tests were implemented in Phase 1A.
- No production deployment or production Firebase/R2 mutations.

Git state in the Phase 1A report:

- Branch: `main`
- Starting HEAD: `d2b7ea5795041f35f2b27803dc4bec0f66145229`
- No commit created.
- Working tree modified with the three files above.

**Important limitation:** Phase 1A did not integrate the scheduler with the full existing `publishApprovedCandidate()` publication pipeline. The report says the scheduler marks status and the full pipeline integration was deferred to Phase 1B. Therefore automatic publishing must not be described as complete or production-ready yet.

### Phase 1A acceptance status

| Criterion | Reported status |
|---|---|
| Persistent server-side scheduling | Verified |
| Reuse existing publication logic | Partial — full pipeline integration missing |
| Authentication and permissions | Verified by code inspection; dedicated tests missing |
| Editorial approval cannot be bypassed | Reported verified; requires regression tests |
| Multi-instance duplicate prevention | Reported verified; must inspect actual Firestore transaction/lease implementation and test concurrency |
| Restart recovery | Reported verified by persistence design; runtime restart test not reported |
| Retry/failure handling | Reported implemented; automated tests missing |
| Audit logging | Reported implemented; automated tests missing |
| Editorial UI | Partial — API reported, frontend not implemented |
| Automated tests | Not implemented |
| TypeScript/build | Client build and no-emit type checks reported passing |
| Manual publishing regression | Reported no changes to existing API; regression test not reported |

The supplied report described “10 of 13” acceptance criteria, but its table listed 12 criteria. Reconcile this discrepancy against the actual acceptance checklist before using a completion percentage.

## 7. Next work — Phase 1B

Recommended scope, in this order:

### 1B.1 — Safe publication pipeline integration and automated tests

Highest priority. Inspect the actual `EditorialWorkflowOS` and `publishApprovedCandidate()` implementation.

- Reuse the existing full publication pipeline.
- Do not directly mark an article published from the scheduler.
- Revalidate approval, source requirements, copyright, publication eligibility, and current article state at execution time.
- Ensure publication side effects such as Snapshot OS invalidation/composition updates use existing mechanisms.
- Use atomic Firestore job claiming/lease semantics that work across multiple instances.
- Prove idempotency and duplicate prevention with tests.
- Test retries, cancellation, rescheduling, expired lease recovery, and already-published candidates.
- Test authentication, permissions, actor attribution, and manual publishing regression.
- Do not claim multi-instance safety based only on an in-process lock.

### 1B.2 — Editorial scheduling UI

- Add schedule/reschedule/cancel and status display to the existing editorial UI.
- Reuse existing components and authorization patterns.
- Use an explicit timezone selector or clearly display the resolved IANA timezone.
- Avoid optimistic success; show success only after server confirmation.
- Preserve existing manual publishing behavior.
- Show useful failure details without leaking internal secrets.

### 1B.3 — Configuration and operations

Only after scheduler behavior is tested:

- Add bounded configuration for polling interval, batch size/concurrency, lease duration, and retry policy.
- Validate configuration at startup.
- Document safe defaults.
- Ensure graceful startup/shutdown and multi-instance behavior.
- Do not add environment variables for settings that do not need to be configurable.

### Phase 1B acceptance gate

Do not mark Scheduled Publishing complete until:

1. Scheduler invokes the full existing publication pipeline.
2. No editorial approval or source/copyright gate can be bypassed.
3. Firestore claim/lease logic prevents duplicate publication across instances.
4. Retry and recovery behavior is covered by automated tests.
5. Scheduling API authorization and validation are covered by tests.
6. UI supports schedule creation, status, reschedule, and cancellation.
7. Manual publishing remains functional.
8. TypeScript checks and relevant client/server builds pass.
9. No production deployment or production data mutation occurs.
10. Git provenance and this continuity file are updated.

## 8. Immediate instructions for the next coding session

The next agent should:

1. Read this file.
2. Inspect `git status`, `git log -1`, and the actual current HEAD.
3. Inspect the uncommitted Phase 1A diff before editing.
4. Confirm that `server/schedulerOs.ts` and its route registration actually exist.
5. Inspect `EditorialWorkflowOS` and locate `publishApprovedCandidate()`.
6. Trace the full existing manual publication path and all side effects.
7. Inspect Firestore transaction semantics and whether the scheduler uses a persistent lease/token/expiry field rather than relying on the in-process lock.
8. Present a short findings/plan summary.
9. Implement Phase 1B.1 first. Do not combine all UI and configuration changes before the publication pipeline and concurrency behavior are proven.
10. Run focused tests and regression suites.
11. Update this file with exact evidence before handing off.

## 9. Phase update log

### 2026-11-10 — Phase 1A reported complete (partial acceptance)

- Added Firestore-backed `SchedulerOS`.
- Added scheduling fields to `EditorialCandidate`.
- Initialized scheduler from `server.ts`.
- Reported client build and TypeScript checks passing.
- No dedicated automated tests yet.
- Full `publishApprovedCandidate()` integration not yet complete.
- Frontend schedule-management UI not yet implemented.
- No commit created; working tree reported modified.
- No production deployment or production Firebase/R2 mutations.
- Next: Phase 1B.1 pipeline integration and tests, then UI and operational configuration.

---

## 10. Required update format for future phases

Append a dated entry to the Phase update log and update the relevant sections above. Every update must include:

- Phase name and status: COMPLETE / PARTIAL / BLOCKED.
- Starting HEAD and final HEAD.
- Branch and working-tree status.
- Files added, modified, and deleted.
- Actual implementation and architecture decisions.
- Exact test/build commands and observed results.
- Tests not run or failed.
- Security and production impact.
- Remaining blockers and risks.
- Next recommended phase.
- Confirmation that secrets were not added to the file.

Do not delete previous phase history. Keep the newest status easy to find near the top.
