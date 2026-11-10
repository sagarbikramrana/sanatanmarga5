# Launch Readiness Checklist — Sanatan Media

This checklist outlines the critical steps and validation criteria required to move Sanatan Media from a preview state to a production-grade live deployment. Use this document to guide testing, compliance, and systems auditing.

---

## 🔒 1. Security & Compliance Review
- [ ] **Firestore Rules Lockdown**: Verify that `firestore.rules` enforces attribute-based write security. No collection must allow blanket `write` or `read` access.
- [ ] **Role-Based Access Control (RBAC)**: Ensure that only users with the `admin` role can access the Admin panel, adjust notifications, and manage campaigns or media assets.
- [ ] **PII Protection**: Isolate sensitive user information (such as personal phone numbers or exact email verification records). Restrict profile field updates so users cannot self-assign administrative roles.
- [ ] **API Secret Key Secrecy**: Confirm that the Gemini API Key and other system-level secrets are never referenced in client-side bundles (e.g. they should remain server-side on Express proxy endpoints, without the `VITE_` prefix).

---

## 📣 2. Notification OS Validation
- [ ] **Pre-seeded Templates Integrity**: Confirm that all core event triggers (`ASSIGNMENT_CREATED`, `ARTICLE_APPROVED`, etc.) exist in the `notificationTemplates` collection and load correctly.
- [ ] **Enforced Preferences Check**: Verify that a user muting a specific category (e.g., *Business & Campaigns*) is strictly respected, preventing the system from dispatching any alert from that category to their dashboard.
- [ ] **Campaign Broadcast Latency**: Test dispatching a notification campaign to a group of subscribers and verify delivery counts in the control room metrics.
- [ ] **Foreground Event Handlers**: Ensure in-app alerts are delivered instantly without crashing or reloading when a user is active on the dashboard.

---

## 📈 3. Observability & System Health
- [ ] **Operations Logging coverage**: Confirm that every critical action (article status changes, role assignments, campaign broadcasts, media asset creations) writes a durable record to `auditLogs`.
- [ ] **System Error Logging**: Verify that any client-side crash or unhandled promise rejection writes a telemetry record to `systemErrors` for real-time tracking in the Admin Dashboard.
- [ ] **Services Latency Diagnostic**: Test the handshake latencies for Firebase, Gemini, and local servers from the operations console.

---

## 🖼️ 4. Media Asset OS Verification
- [ ] **Copyright Governance**: Verify that every uploaded or created media asset contains a strict `licenseType` (such as `owned`, `creative_commons`, or `restricted`) to prevent accidental copyright violations.
- [ ] **Entity Linking Check**: Confirm that articles, campaigns, or community posts successfully link to assets via their custom reference ID rather than hardcoded URLs.
- [ ] **MIME-Type Restrictions**: Validate that uploaded assets are categorized correctly under Images, Videos, Audio, or Documents, with active filtering on the Admin Media Library page.
- [ ] **Library Sort & Search**: Test real-time search by Title, Tag, Photographer, or License type, and sorting by Newest, Most Used, or Recently Uploaded.

---

## 🔋 5. Performance, SEO, & Mobile QA
- [ ] **Responsive Design Alignment**: Ensure the entire platform functions smoothly on mobile devices with touch targets of at least 44px.
- [ ] **SEO Meta Tags & Social Previews**: Ensure that articles render standard semantic HTML headers (`<title>`, `<meta description>`, and `<meta property="og:image">`) for maximum search indexation and sharing.
- [ ] **Offline Resilience & Sync**: Test updating an article or assignment while offline, ensuring it queues in standard local storage and merges cleanly upon network re-establishment.
