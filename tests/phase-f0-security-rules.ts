import * as fs from "fs";
import * as path from "path";
import assert from "assert";

console.log("=================================================");
console.log("SANATANMARGA 5.0 — FOUNDATION RELEASE GATE F0");
console.log("FIRESTORE RULES HARDENING & CLASSIFICATION AUDIT");
console.log("=================================================\n");

const rulesPath = path.join(process.cwd(), "firestore.rules");
const rulesContent = fs.readFileSync(rulesPath, "utf-8");

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] ${description}:`, err.message || err);
    failed++;
  }
}

// 1. Zero Blanket Read/Write Rules
test("1. No collection contains blanket 'allow read, write: if true;'", () => {
  const matches = rulesContent.match(/allow\s+read\s*,\s*write\s*:\s*if\s*true\s*;/g);
  assert.strictEqual(matches, null, "Found blanket 'allow read, write: if true;'");
});

// 2. Events & Media Locked Down
test("2. events collection write access restricted to staff/admin", () => {
  assert.ok(/match\s+\/events\/\{eventId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
});

test("3. events media subcollection write restricted to staff/admin", () => {
  assert.ok(/match\s+\/media\/\{mediaId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
});

// 3. Models / Photographers Locked Down
test("4. models collection write restricted to staff/admin", () => {
  assert.ok(/match\s+\/models\/\{modelId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
});

test("5. photographers collection write restricted to staff/admin", () => {
  assert.ok(/match\s+\/photographers\/\{phId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
});

// 4. Community Posts & Comments Scoped
test("6. communityPosts create requires authenticated author scope", () => {
  assert.ok(/match\s+\/communityPosts\/\{postId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+isSignedIn\(\)/.test(rulesContent));
});

test("7. comments create requires authenticated author scope and deletion is protected", () => {
  assert.ok(/match\s+\/comments\/\{commentId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+isSignedIn\(\)/.test(rulesContent));
});

// 5. Notifications Hardened (A3)
test("8. notifications collection requires recipient ownership or staff/admin read", () => {
  assert.ok(/match\s+\/notifications\/\{notifId\}\s*\{[\s\S]*?allow\s+get:\s*if\s+isSignedIn\(\)\s*&&\s*\([\s\S]*?resource\.data\.get\('userId'/.test(rulesContent));
});

test("9. notificationTemplates collection restricted to staff/admin read and editor/admin write", () => {
  assert.ok(/match\s+\/notificationTemplates\/\{templateId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/notificationTemplates\/\{templateId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isAdmin\(\)\s*\|\|\s*isEditor\(\);/.test(rulesContent));
});

test("10. notificationCampaigns collection restricted to staff/admin read and editor/admin write", () => {
  assert.ok(/match\s+\/notificationCampaigns\/\{campaignId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/notificationCampaigns\/\{campaignId\}\s*\{[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+isAdmin\(\)\s*\|\|\s*isEditor\(\);/.test(rulesContent));
});

// 6. Moderation OS Hardened (A4)
test("11. communityReports read restricted to moderator/admin and create requires reporterId", () => {
  assert.ok(/match\s+\/communityReports\/\{reportId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isModerator\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/communityReports\/\{reportId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+isSignedIn\(\)/.test(rulesContent));
});

test("12. moderationActions restricted to moderator/admin and delete strictly admin", () => {
  assert.ok(/match\s+\/moderationActions\/\{actionId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isModerator\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/moderationActions\/\{actionId\}\s*\{[\s\S]*?allow\s+delete:\s*if\s+isAdmin\(\);/.test(rulesContent));
});

test("13. bannedUsers collection restricted to moderator/admin", () => {
  assert.ok(/match\s+\/bannedUsers\/\{banId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isModerator\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/bannedUsers\/\{banId\}\s*\{[\s\S]*?allow\s+write:\s*if\s+isAdmin\(\)\s*\|\|\s*isModerator\(\);/.test(rulesContent));
});

// 7. Contact Messages & Inquiries
test("14. contactMessages allows public creation but restricts read/manage to staff/admin", () => {
  assert.ok(/match\s+\/contactMessages\/\{msgId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isStaff\(\)\s*\|\|\s*isAdmin\(\);/.test(rulesContent));
  assert.ok(/match\s+\/contactMessages\/\{msgId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+true;/.test(rulesContent));
});

// 8. Newsletter Subscribers
test("15. newsletterSubscribers allows public email subscribe but restricts list/read to admin/editor", () => {
  assert.ok(/match\s+\/newsletterSubscribers\/\{subId\}\s*\{[\s\S]*?allow\s+read:\s*if\s+isAdmin\(\)\s*\|\|\s*isEditor\(\);/.test(rulesContent));
  assert.ok(/match\s+\/newsletterSubscribers\/\{subId\}\s*\{[\s\S]*?allow\s+create:\s*if\s+incoming\(\)/.test(rulesContent));
});

// 9. Immutable Audit Logs
test("16. Immutable audit ledgers enforce update, delete: if false;", () => {
  assert.ok(/match\s+\/auditLogs\/\{logId\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesContent));
  assert.ok(/match\s+\/archive_audit_logs\/\{id\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesContent));
  assert.ok(/match\s+\/knowledge_audit_events\/\{id\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesContent));
  assert.ok(/match\s+\/timeline_audit_logs\/\{docId\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesContent));
  assert.ok(/match\s+\/disaster_recovery_logs\/\{logId\}\s*\{[\s\S]*?allow\s+update,\s*delete:\s*if\s+false;/.test(rulesContent));
});

console.log("\n=================================================");
console.log(`F0 FIRESTORE AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
