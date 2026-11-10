# Sanatan Marga - Technical Architecture Blueprint
*(Enterprise Digital-First Media Operating System)*

This blueprint defines the architecture, data schemas, security standards, and AI integration strategies for **Sanatan Marga**, built to support high-throughput journalism, editorial workflows, ad operations, and secure reader communities.

---

## 1. System Topology & Architectural Overview

```
                      +---------------------------------------+
                      |           CLIENT (SPA)                |
                      |   React 18 + Vite + Tailwind CSS      |
                      +-------------------+-------------------+
                                          |
                                          | HTTPS / WebSockets
                                          v
                      +-------------------+-------------------+
                      |      EXPRESS BACKEND (PORT 3000)      |
                      |   Helmet, CORS, Express-Rate-Limit    |
                      +-------+-----------------------+-------+
                              |                       |
                              | SDK Calls             | POST /api/gemini/newsroom
                              v                       v
               +--------------+---------------+ +-----+-----------------------+
               |        FIREBASE SUITE        | |      GOOGLE GEMINI API      |
               | Firestore, Auth, Storage     | |   gemini-3.5-flash / Search |
               +------------------------------+ +-----------------------------+
```

---

## 2. Advanced Security Hardening (Zero-Trust RBAC)

We operate on a **Zero-Trust Role-Based Access Control (RBAC)** model. No client or server-side authorization checks rely on hardcoded email lists. Instead, authorization is derived dynamically from user role claims stored directly in the Firestore `/users` collection and verified via custom security functions in `firestore.rules`.

### 2.1 Server Security Middleware
The server entrypoint (`/server.ts`) is fortified using standard defensive packages:
*   **Trust Proxy**: Explicitly configured (`app.set("trust proxy", 1)`) to trust upstream headers from Cloud Run / Nginx reverse proxy. This ensures `express-rate-limit` identifies client IPs correctly instead of using the local container gateway IP.
*   **Helmet**: Sets HTTP security headers (including `Cross-Origin-Opener-Policy` configured for Firebase authentication popups).
*   **Express Rate Limiter**: Configured at `/api/` boundaries to prevent Denial of Service (DoS) attacks (max 200 requests per 15-minute window).

### 2.2 Security Rule Safeguards (`firestore.rules`)
All database reads and writes are gated at the database layer. 
*   **Admins**: Can read and write all collections (including billing, settings, user profiles, campaigns).
*   **Editors**: Authorized to manage articles, assign stories, and transition editorial queues.
*   **Journalists**: Only permitted to write articles in `draft` status and view assigned tasks.

---

## 3. Strict 5-Tier Editorial Workflow

Articles must transition through a standardized publishing pipeline before going live to public readers:

$$\text{Draft} \longrightarrow \text{Under Review} \longrightarrow \text{Fact Check} \longrightarrow \text{Approved} \longrightarrow \text{Published}$$

1.  **Draft (मस्यौदा)**: Initial writing phase. Editable only by the author or assigning Editor.
2.  **Under Review (समीक्षामा)**: Submitted to the editor queue. Editors review typography, spacing, styling, and flow.
3.  **Fact Check (तथ्य जाँच)**: Cross-referenced for accuracy. Editors leverage our search-grounded AI co-pilot to verify statistical and historical claims.
4.  **Approved (स्वीकृत)**: Approved for publication. Queued for scheduled posting or immediate release.
5.  **Published (प्रकाशित)**: Live on public feeds and distributed to rss/sitemap feeds.

---

## 4. Search-Grounded AI Newsroom Co-Pilot

Our server-side AI endpoints reside in `/api/gemini/newsroom` to prevent exposing sensitive API keys to browser clients. We utilize the modern `@google/genai` TypeScript SDK with lazy-initialization logic to prevent startup failures.

### 4.1 Co-Pilot Operations:
*   **Story Angle Generator (`generate-angles`)**: Suggeses 5 localized, culturally aligned journalistic story angles or hooks in Nepali based on brief topic briefs.
*   **Search-Grounded Fact-Checking (`fact-check`)**: Connects to the **Google Search tool** to fetch live references and cross-references.
*   **SEO & Translation Optimizer (`translate-and-seo`)**: Translates English text to professional Nepali while generating optimized search tags, SEO titles, and metadata.

---

## 5. Enterprise Data Schema (`firebase-blueprint.json`)

Our system utilizes standard, non-relational document hierarchies for optimal speed and reliability:

### `/users` (User Profiles & Roles)
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'editor' | 'journalist' | 'reader';
  createdAt: string;
}
```

### `/storyAssignments` (Editorial Tasks)
```typescript
{
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  assignedBy: string;
  assignedByName: string;
  status: 'assigned' | 'completed';
  createdAt: string;
}
```

### `/coverageCalendar` (Scheduled Events)
```typescript
{
  title: string;
  description: string;
  location: string;
  category: 'politics' | 'culture' | 'sports' | 'crime';
  eventDate: string;
  status: 'planned' | 'completed';
}
```

### `/campaigns` (Advertising Operations)
```typescript
{
  name: string;
  advertiserName: string;
  creativeUrl: string;
  placement: 'top_banner' | 'sidebar_box' | 'floating_skin';
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  isActive: boolean;
}
```

### `/auditLogs` (Immutable Security Logs)
```typescript
{
  action: string;
  userId: string;
  userEmail: string;
  userName: string;
  metadata: any;
  timestamp: string;
}
```

---

## 6. Immutable Audits & Disaster Recovery

*   **Immutable Logging**: Every sensitive action (admin role changes, category adjustments, campaign deletions, and story approvals) writes a document to `/auditLogs`.
*   **Local State Isolation**: Core client widgets use isolated state management to prevent rendering hangs, backed by offline-capable Firestore caching engines.

---

## 7. Observability OS (Sprint A) & Sentry Integration

To minimize operational risk before public launching, a centralized administrative operations suite is established to track platform health, trace editorial activities, and log exceptions.

### 7.1 Real-Time Monitoring Telemetry Collections
We introduce three collections for real-time error and activity observability:
*   **`/activityLogs`**: Log entries capturing critical user and editor actions.
    ```json
    {
      "actorId": "string",
      "actorName": "string",
      "actorEmail": "string",
      "actorRole": "string",
      "action": "string",
      "resourceType": "article | assignment | campaign | event | user | system | community | ad",
      "resourceId": "string",
      "metadata": {},
      "timestamp": "serverTimestamp()"
    }
    ```
*   **`/errorEvents`**: Application logs detailing backend or frontend exceptions.
    ```json
    {
      "severity": "low | medium | high | critical",
      "source": "frontend | backend",
      "message": "string",
      "route": "string",
      "actorId": "string",
      "actorEmail": "string",
      "extra": {
        "stack": "string"
      },
      "timestamp": "serverTimestamp()"
    }
    ```
*   **`/systemHealth`**: System heartbeat metrics (API latency, AI responsiveness, database access speed).

### 7.2 Sentry Error Tracking Architecture
*   **Frontend SDK (`@sentry/react` at `/src/lib/sentry.ts`)**: Initializes with custom environment variables (`VITE_SENTRY_DSN`). Hooks directly into the React `ErrorBoundary` component to automatically report uncaught components crashes to Sentry AND write a backup exception payload in `/errorEvents`.
*   **Backend SDK (`@sentry/node` at `/server/sentry.ts`)**: Initializes with `SENTRY_DSN`. Hooks into our Express application router context via `Sentry.setupExpressErrorHandler(app)` to catch API crashes and unhandled promise rejections.

### 7.3 Observability REST Endpoints
*   **`/api/system/health`**: Performs diagnostic pings on API pathways, Firestore DB connection parameters, Gemini AI co-pilot status, and FCM notification gateways.
*   **`/api/system/metrics`**: Performs real-time counts, querying `/activityLogs` and `/errorEvents` to compile metrics for Dashboard cards (Active Logins, Gemini Interactions, Sentry Error rates).

### 7.4 Admin Operations Control Room (`/admin/operations`)
*   An advanced, single-pane obsidian-styled monitoring dashboard designed with `lucide-react` icons and staggered Framer Motion transitions.
*   **Audit Trail Feed**: Lists live, scrolling audit logs in Nepalese typography.
*   **System Errors Console**: Visualizes reported crashes with expandable trace view diagnostics.
*   **Diagnostics Suite**: Allows admins to trigger diagnostic LATENCY checks, verify Gemini handshakes, and safely clear testing logs.


## 8. Notification OS (Sprint B)

To drive reader engagement and workflow coordination, a comprehensive notification engine is built directly into the platform core.

### 8.1 Database Collections
*   **`/notifications`**: Direct real-time alerts sent to individual users.
    ```json
    {
      "userId": "string",
      "title": "string",
      "message": "string",
      "type": "workflow | editorial | system | community | business",
      "isRead": "boolean",
      "createdAt": "ISOString",
      "extra": {}
    }
    ```
*   **`/notificationTemplates`**: Pre-seeded customizable message blueprints.
    ```json
    {
      "code": "ASSIGNMENT_CREATED | ARTICLE_SUBMITTED | etc",
      "category": "workflow | editorial | system | community | business",
      "title": "string (with placeholders)",
      "body": "string (with placeholders)",
      "isActive": "boolean",
      "updatedAt": "ISOString"
    }
    ```
*   **`/notificationCampaigns`**: Scheduled broadcast logs sent to massive target audiences.

### 8.2 Delivery Pipeline & Preference Enforcement
All alerting functions stream through `triggerNotificationFromTemplate()`. The engine:
1. Resolves the template code (e.g. `ASSIGNMENT_CREATED`).
2. Replaces placeholders (e.g. `{reporterName}`) with actual dynamic values.
3. Queries target user's `notificationPreferences` from `/users/{userId}`.
4. If the category is muted by the user, delivery is aborted.
5. If verified, the engine persists the notification to `/notifications`.

### 8.3 User Settings & Broadcast Control Room
*   **User Alerts Preferences Tab**: Located in User Profiles `/profile/:uid`, allows individuals to subscribe/unsubscribe from Workflow, Editorial, System, Community, or Business categories.
*   **Notification OS Control Center (`/admin/notifications`)**: Built-in broadcast system to dispatch push alerts to all users, staff, or subscribers based on customizable campaigns, alongside template configuration and real-time alerts streams.


## 9. Media Asset OS (Sprint D)
 
To ensure legally sound publications and robust asset tracking, we decouple media URLs from our content bodies and manage them under a centralized, copyright-governed operating system.
 
### 9.1 Database Collection (`/mediaAssets`)
*   **Schema Fields**:
    ```json
    {
      "title": "string",
      "caption": "string",
      "altText": "string",
      "tags": ["string"],
      "photographer": "string",
      "copyrightOwner": "string",
      "licenseType": "internal | owned | creative_commons | partner | sponsored | restricted",
      "storagePath": "string (URL)",
      "mimeType": "image | video | audio | document",
      "uploadedBy": "string (User UID)",
      "uploadedByName": "string (displayName)",
      "usageRights": "string (conditions of use clause)",
      "expirationDate": "string (ISO Date)",
      "linkedArticlesCount": "number",
      "createdAt": "ISOString",
      "deleted": "boolean",
      "deletedBy": "string (User UID)",
      "deletedByName": "string (displayName)",
      "deletedAt": "ISOString"
    }
    ```
 
### 9.2 Copyright Governance & Enforcement
Every media asset is explicitly cataloged with a `licenseType`. The platform safeguards publishing integrity via:
1.  **Strict Metadata Tagging**: Forbids uploading assets without specifying the Photographer, Copyright Owner, and License Type.
2.  **Asset References over URLs**: Promotes utilizing direct Asset Reference Codes (e.g. `[asset:docId]`) instead of hardcoding storage URLs directly inside article texts. This enables global, dynamic asset swapout and automated copyright expiry warnings.
3.  **Visual Status Badges**: Employs distinctive, semantic colors (Green for CC, Rose for Restricted Single Use, Blue for Owned) to allow immediate visual screening of copyright safety flags in the Media Grid.
 
### 9.3 Admin Media Library (`/admin/media-library`)
*   **Unified Media Control Desk**: Includes real-time keyword search (filtering titles, tags, photographers), and mime-type classification filters (All, Photo, Video, Audio, Document).
*   **Interactive Simulation Upload**: Features standard file selection and drag-and-drop uploads that auto-generate realistic preview models while exposing form fields for strict copyright details.
*   **Dynamic Usage Audit & Quick Copy**: Allows instant quick-copy of reference tags `[asset:id]` and raw storage paths, alongside detailed side-drawer panels for live metadata updates and item deletions.
*   **Resilient Archive Patterns (Soft Delete & Restore)**: Safeguards media continuity by replacing destructive deletions with a soft-delete mechanism (`deleted: true`). Soft-deleted assets move to a dedicated, easily filterable Trash Bin, protecting files from accidental deletion while allowing quick recovery. Only users with Administrative permissions are granted access to execute hard purges.


## 10. Release Management & Launch Governance (Sprint E)

To coordinate public delivery of our unified platform, we govern all code deployment and production operations under a formal release management protocol and SRE site reliability framework.

### 10.1 Semantic Release Classification
*   **Patch Releases (`X.Y.Z` where `Z` increments)**: Rapid security patches, localized label corrections, or light optimization.
*   **Minor Releases (`X.Y.Z` where `Y` increments)**: Feature sprints delivery (e.g., Sprint G - Moderation OS), non-destructive schema extensions, or newly structured admin views.
*   **Major Releases (`X.Y.Z` where `X` increments)**: High-impact relational migrations, standard identity providers upgrades, or major database schemas pivot.

### 10.2 Continuous Integration & Production Gates
All contributions to Sanatan Marga must pass through six rigorous quality gates before deploying to live instances:
1.  **Gate 1 (Lint Pass)**: Strict type checking and coding guidelines.
2.  **Gate 2 (Build Pass)**: Optimized client compilation and server CommonJS bundling.
3.  **Gate 3 (Launch Audit Pass)**: Zero open high-risk vulnerabilities/finding tickets.
4.  **Gate 4 (Firestore Rules Pass)**: Secure, zero-trust rules verifying database requests.
5.  **Gate 5 (Notification Test Pass)**: Valid templates and respecting user mute configuration.
6.  **Gate 6 (Observability Test Pass)**: Sentry error trackers and operations diagnostics listening.

### 10.3 Operations & Deployment Runbooks
Managed under `/PRODUCTION_DEPLOYMENT_RUNBOOK.md` to guide:
*   **Rolling Deployments**: Utilizing Google Cloud Build and zero-downtime container updates on Cloud Run (port `3000`, host `0.0.0.0`).
*   **Automated Backups**: Standard daily cron scheduling for exporting complete Firestore states to secure buckets.
*   **Emergency Incident Playbooks**: Standard, fast mitigation actions for privilege escalation breaches or regional latency spikes.


## 11. Moderation OS & Community Safety (Sprint G)

To secure the Chautari community and establish trust prior to monetization features, Sanatan Media introduces a centralized, high-fidelity **Moderation OS** to manage citizen-reported content, moderation enforcement, and active user restrictions.

### 11.1 Structural Data Models
The system operates on four dedicated Firestore collections to separate concerns and guarantee transactional auditability:
1.  **Reports Queue (`/reports/{reportId}`)**: Standardized reader-flagged items. Fields include `reporterId`, `reporterName`, `targetType` ("post" | "comment"), `targetId`, `reason`, `description`, `status` ("open" | "resolved" | "dismissed"), and timestamps.
2.  **Moderation Actions (`/moderationActions/{actionId}`)**: Completely immutable record of enforcement events taken by the staff. Fields include `moderatorId`, `moderatorName`, `targetUserId`, `targetUserName`, `action` ("warning" | "mute" | "temp_ban" | "perm_ban" | "shadow_ban"), `reason`, and `durationDays`.
3.  **User Appeals (`/appeals/{appealId}`)**: Dedicated relief channel allowing restricted users to appeal penalties. Fields include `userId`, `userName`, `actionId`, `appealText`, `status` ("pending" | "approved" | "rejected"), and `moderatorNotes`.
4.  **Banned Users Registry (`/bannedUsers/{banId}`)**: Registry of users currently restricted from participating. Fields include `userId`, `userName`, `banType`, `reason`, `expiresAt`, and `bannedBy`.

### 11.2 Access Control & Zero-Trust Policies
To enforce strict boundaries, Security Rules in `firestore.rules` mandate:
*   **Reports**: Read/list access is restricted to `isAdmin()` and `isModerator()` roles. Create is open to any authenticated user, verifying `incoming().reporterId == request.auth.uid`.
*   **Moderation Actions**: Completely immutable. Write operations are restricted to `isModerator()` or `isAdmin()`. Read is restricted to the target user or staff.
*   **Appeals**: Users can only view or create their own appeal tickets. Decisions/updates are strictly gated to staff.
*   **Banned Users**: Publicly read-only (to verify restriction states programmatically); writes are restricted to staff.

### 11.3 Enforcement & Integration Loops
*   **Community Feed Integration**: Chautari's `PostCard` includes a standard report modal that allows users to submit flags.
*   **Administrative Control Panel (`/admin/moderation`)**: A unified, tabbed operational hub for staff. This allows reviewing flags, executing penalties (with soft-deletes of posts/comments), approving or rejecting user appeals, and inspecting real-time visual statistics of moderation metrics.





