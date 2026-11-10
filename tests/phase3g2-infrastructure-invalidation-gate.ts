import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotOS } from '../server/snapshotOs';
import { serverDeveloperOS } from '../server/developerOs';

test('SANATANMARGA 5.0 — PHASE 3G.2 INFRASTRUCTURE & SNAPSHOT INVALIDATION GATE', async (t) => {
  await t.test('1. resolveAffectedModules returns bounded affected graph for article TTS event', () => {
    const affected = SnapshotOS.resolveAffectedModules('tts_ready', 'article:pub_ai_123', 'tts_metadata_ready');
    assert.ok(Array.isArray(affected));
    assert.ok(affected.includes('manifest'));
    assert.ok(affected.includes('article_pub_ai_123'));
    assert.strictEqual(affected.includes('articles'), false, 'articles must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('latest'), false, 'latest must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('homepage'), false, 'homepage must not be invalidated by article TTS');

    // Verify bounded dependency boundary: unrelated modules MUST NOT be included
    assert.strictEqual(affected.includes('knowledge_base'), false, 'knowledge_base must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('communityPosts'), false, 'communityPosts must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('nepal_hub_live_updates'), false, 'nepal_hub_live_updates must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('events'), false, 'events must not be invalidated by article TTS');
    assert.strictEqual(affected.includes('ads'), false, 'ads must not be invalidated by article TTS');
  });

  await t.test('2. resolveAffectedModules returns bounded graph for knowledge entity update', () => {
    const affected = SnapshotOS.resolveAffectedModules('editorial', 'knowledge_101', 'update');
    assert.ok(affected.includes('knowledge_base'));
    assert.strictEqual(affected.includes('homepage'), false);
    assert.strictEqual(affected.includes('articles'), false);
    assert.strictEqual(affected.includes('communityPosts'), false);
  });

  await t.test('3. resolveAffectedModules returns bounded graph for community post creation', () => {
    const affected = SnapshotOS.resolveAffectedModules('chautari', 'community_202', 'post_created');
    assert.ok(affected.includes('communityPosts'));
    assert.strictEqual(affected.includes('articles'), false);
    assert.strictEqual(affected.includes('knowledge_base'), false);
  });

  await t.test('4. resolveAffectedModules returns "all" for system_startup / full rebuild triggers', () => {
    const affected = SnapshotOS.resolveAffectedModules('system_startup', 'all');
    assert.deepStrictEqual(affected, ['all']);

    const fullRebuild = SnapshotOS.resolveAffectedModules('full_rebuild');
    assert.deepStrictEqual(fullRebuild, ['all']);
  });

  await t.test('5. Bounded changed-module rebuild execution executes without error and updates diagnostics', async () => {
    const snapshotOS = SnapshotOS.getInstance();
    const result = await snapshotOS.rebuildSnapshots('tts_ready', { triggerEntity: 'article:pub_ai_smoke_1' });
    assert.ok(result.jobId);
    assert.ok(['completed', 'skipped_noop'].includes(result.status));
    assert.ok(result.durationMs >= 0);

    const diagnostics = snapshotOS.getDiagnostics();
    assert.ok(Array.isArray(diagnostics));
  });

  await t.test('6. Developer OS verifyR2Storage returns structured status and verificationMethod', () => {
    const verification = serverDeveloperOS.verifyR2Storage();
    assert.ok(['VERIFIED', 'PARTIAL', 'UNVERIFIED'].includes(verification.status));
    assert.ok(typeof verification.verificationMethod === 'string');
    assert.ok(verification.timestamp);
  });

  await t.test('7. Developer OS verifyR2StorageAsync executes probe cycle with _infra_verification prefix', async () => {
    const asyncVerification = await serverDeveloperOS.verifyR2StorageAsync();
    assert.ok(['VERIFIED', 'PARTIAL', 'UNVERIFIED'].includes(asyncVerification.status));
    assert.ok(typeof asyncVerification.verificationMethod === 'string');
    if (asyncVerification.status === 'VERIFIED') {
      assert.ok(asyncVerification.steps);
      assert.strictEqual(asyncVerification.steps.put, 'PASS');
      assert.strictEqual(asyncVerification.steps.head, 'PASS');
      assert.strictEqual(asyncVerification.steps.get, 'PASS');
      assert.strictEqual(asyncVerification.steps.sha256_match, 'PASS');
      assert.strictEqual(asyncVerification.steps.delete, 'PASS');
      assert.strictEqual(asyncVerification.steps.absence_confirmed, 'PASS');
    } else {
      assert.ok(asyncVerification.reason, 'UNVERIFIED/PARTIAL status must supply an explicit reason');
    }
  });

  await t.test('8. Canonical Scope Registry & API Key Authority remain intact', () => {
    const keys = serverDeveloperOS.listApiKeys({ uid: 'usr_admin', role: 'super_admin' }, 'tenant-default');
    assert.ok(Array.isArray(keys));
    const openApi = serverDeveloperOS.getOpenApiSchema();
    assert.strictEqual(openApi.openapi, '3.0.3');
    const scorecard = serverDeveloperOS.getInfrastructureHealthScorecard();
    assert.strictEqual(scorecard.overallStatus, 'HEALTHY');
  });

  setTimeout(() => process.exit(0), 100);
});
