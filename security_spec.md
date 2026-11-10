# Sanatan Marga - Security Specification & Threat Model

This document serves as the master security blueprint and test verification record for the Sanatan Marga Media Operating System.

## Data Invariants
1. **Role Immature Escalation**: A user cannot self-assign any role of higher privilege (`super_admin`, `admin`, `editor`, `chief_editor`, `journalist`, `moderator`, `fact_checker`) on registration.
2. **Audit Integrity**: Audit logs are strictly **write-once**. Updates or deletions are physically impossible through client SDKs.
3. **Draft Privacy**: Staff assignments and unpublished drafts are protected against unauthorized reads from subscribers, guests, or public users.
4. **Campaign Segregation**: Advertiser campaigns can be updated only by verified admins or authenticated advertisers owning the specific creative.

---

## The "Dirty Dozen" Threat Vectors & Payloads

The following malicious JSON payloads represent real-world client-side exploits. Sanatan Marga's Firestore Rules protect against these exploits, returning `PERMISSION_DENIED`.

### 1. Privilege Escalation via Initial Sign-Up
* **Target Path**: `/users/{uid}`
* **Intent**: A malicious subscriber tries to set their role to `super_admin` upon account creation.
* **Payload**:
```json
{
  "uid": "attacker_123",
  "email": "malicious@domain.com",
  "displayName": "Hacker",
  "role": "super_admin"
}
```
* **Defense**: Enforced in `/users/{uid}` rules: `incoming().role == 'user' || incoming().role == 'subscriber' || incoming().role == 'guest'`.

### 2. Privilege Escalation via Profile Update
* **Target Path**: `/users/attacker_123`
* **Intent**: Changing role from standard user to `admin` after signing up.
* **Payload (Update)**:
```json
{
  "role": "admin"
}
```
* **Defense**: Rule check `incoming().role == existing().role || isAdmin()` prevents modifying role.

### 3. Audit Log Modification
* **Target Path**: `/auditLogs/log_abc123`
* **Intent**: Erasing a history track of an article deletion.
* **Payload (Update)**:
```json
{
  "action": "DELETED_NOTHING",
  "metadata": {}
}
```
* **Defense**: Rule check `allow update, delete: if false;` on `/auditLogs` matches.

### 4. Direct Unauthorized Draft Modification
* **Target Path**: `/articles/draft_secret_456`
* **Intent**: A normal reader attempts to edit a draft article in progress.
* **Payload (Update)**:
```json
{
  "content": "Malicious code injected."
}
```
* **Defense**: Rule `allow create, update: if (isEditor() || hasRole(['journalist']))` blocks this.

### 5. Assignment Hijacking (Self-Reassignment)
* **Target Path**: `/storyAssignments/task_789`
* **Intent**: A journalist attempts to reassign a task meant for another journalist to themselves, or change the deadline.
* **Payload (Update)**:
```json
{
  "assignedTo": "my_attacker_uid",
  "deadline": "2030-01-01T00:00:00Z"
}
```
* **Defense**: Rule `incoming().diff(existing()).affectedKeys().hasOnly(['status', 'notes', 'updatedAt'])` forces immutability of core fields.

### 6. PII Scraping on Other User Profiles
* **Target Path**: `/users/legit_reporter_789`
* **Intent**: Guest trying to read a reporter's private profile details.
* **Defense**: Rule `allow read: if isSignedIn() && (request.auth.uid == uid || isEditor())` blocks unauthenticated or non-admin users.

### 7. Global Settings Manipulation
* **Target Path**: `/settings/site`
* **Intent**: Unauthorized user changing the corporate branding or backup server locations.
* **Payload**:
```json
{
  "siteName": "Defaced Website",
  "smtpPort": "999"
}
```
* **Defense**: Rule `allow write: if isAdmin();` block matches.

### 8. Shadow Campaign Placement
* **Target Path**: `/campaigns/dashboard_campaign`
* **Intent**: Malicious advertiser tries to update spent budget to 0.
* **Payload**:
```json
{
  "spent": 0
}
```
* **Defense**: Blocked by `allow write: if isAdmin() || hasRole(['advertiser'])`.

### 9. System Config Override on Breaking News
* **Target Path**: `/breakingNews/home_takeover`
* **Intent**: Unauthorized user triggers homepage takeover alarm.
* **Payload**:
```json
{
  "homepageTakeover": true,
  "isActive": true
}
```
* **Defense**: Rule `allow write: if isEditor();` blocks the request.

### 10. Spam Contact Submissions Bypass
* **Target Path**: `/contactMessages/spam_message`
* **Intent**: A malicious client tries to delete other people's contact messages or list them to gather leads.
* **Defense**: Rule `allow read, list: if isEditor(); allow delete: if isAdmin();` isolates these resources.

### 11. Article Version Tampering
* **Target Path**: `/articleVersions/v1_abc`
* **Intent**: Malicious user trying to rewrite past editorial history.
* **Defense**: Rule `allow update, delete: if false;` enforces strict immutability.

### 12. Denial of Wallet via ID Poisoning
* **Target Path**: `/articles/VERY_LONG_STRING_OVER_10KB_...`
* **Intent**: Flooding firestore index storage with huge key values.
* **Defense**: Guarded by `isValidId(articleId)` which requires strings to be `<= 128` characters.
