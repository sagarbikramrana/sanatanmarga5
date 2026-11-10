import test from 'node:test';
import assert from 'node:assert/strict';
import { auditNavigationIntegrity, classifyRoute, CANONICAL_NAVIGATION_REGISTRY } from '../src/services/navigationOS';
import { featureControlOS } from '../src/services/featureControlOS';
import { 
  recoverIncompleteTTSJobs, 
  classifyTTSJob, 
  getOrGenerateTTSAudio, 
  setTTSQuotaCooldown, 
  resetTTSQuotaCooldown, 
  getTTSQuotaCooldownUntil,
  PersistedTTSJob 
} from '../server/ttsService';
import { SnapshotOS } from '../server/snapshotOs';

test('SANATANMARGA 5.0 — PHASE 4A.3 NAVIGATION + TTS STARTUP + BOUNDED SNAPSHOT INVALIDATION CLOSURE', async (t) => {
  // =========================================================================
  // SECTION L — NAVIGATION HEALTH & ASK SANATAN CLASSIFICATION
  // =========================================================================
  await t.test('L1: Ask Sanatan feature is OFF and roadmap-gated', () => {
    const isAskSanatanEnabled = featureControlOS.isFeatureEnabled('ai.ask_sanatan');
    assert.strictEqual(isAskSanatanEnabled, false, 'ai.ask_sanatan must remain disabled by default in Phase 9');
  });

  await t.test('L2: Ask Sanatan is absent from public navigation registry', () => {
    const hasNavPublicAskSanatan = CANONICAL_NAVIGATION_REGISTRY.some(item => 
      item.id === 'nav-public-ask-sanatan' || item.path === '/ask-sanatan'
    );
    assert.strictEqual(hasNavPublicAskSanatan, false, 'Ask Sanatan must NOT appear in CANONICAL_NAVIGATION_REGISTRY');
  });

  await t.test('L3: /ask-sanatan route classification is non-navigation (preview-safe)', () => {
    const cls = classifyRoute('/ask-sanatan');
    assert.strictEqual(cls, 'non-navigation', '/ask-sanatan must be classified as non-navigation');
  });

  await t.test('L4: NavigationOS integrity is 100% healthy with zero permission mismatches', () => {
    const report = auditNavigationIntegrity();
    assert.strictEqual(report.isHealthy, true, 'NavigationOS isHealthy must be true');
    assert.deepStrictEqual(report.permissionMismatches, [], 'permissionMismatches must be empty');
    assert.deepStrictEqual(report.brokenTargets, [], 'brokenTargets must be empty');
    assert.deepStrictEqual(report.unclassifiedRoutes, [], 'unclassifiedRoutes must be empty');
  });

  // =========================================================================
  // SECTION M — TTS STARTUP POLICY & QUOTA AWARENESS
  // =========================================================================
  await t.test('M1: Startup recovery classifies incomplete jobs correctly', () => {
    const staleJob: PersistedTTSJob = {
      objectKey: 'audio/stale.wav',
      contentType: 'article',
      contentId: 'stale_123',
      title: 'Stale Article',
      text: 'Stale text',
      language: 'ne',
      voice: 'Aoede',
      contentHash: 'hash1',
      status: 'queued',
      createdAt: Date.now() - 48 * 60 * 60 * 1000, // 48h old
      updatedAt: Date.now() - 48 * 60 * 60 * 1000,
    };
    assert.strictEqual(classifyTTSJob(staleJob), 'LEGACY_ORPHAN');

    const userJob: PersistedTTSJob = {
      objectKey: 'audio/user.wav',
      contentType: 'article',
      contentId: 'user_123',
      title: 'User Requested',
      text: 'User text',
      language: 'ne',
      voice: 'Aoede',
      contentHash: 'hash2',
      status: 'queued',
      originType: 'USER_REQUESTED',
      createdAt: Date.now() - 60 * 1000,
      updatedAt: Date.now() - 60 * 1000,
    };
    assert.strictEqual(classifyTTSJob(userJob), 'USER_REQUESTED_PENDING');

    const pregenJob: PersistedTTSJob = {
      objectKey: 'audio/pregen.wav',
      contentType: 'article',
      contentId: 'pregen_123',
      title: 'Pregen Article',
      text: 'Pregen text',
      language: 'ne',
      voice: 'Aoede',
      contentHash: 'hash3',
      status: 'queued',
      originType: 'SYSTEM_PREGEN',
      createdAt: Date.now() - 60 * 1000,
      updatedAt: Date.now() - 60 * 1000,
    };
    assert.strictEqual(classifyTTSJob(pregenJob), 'SYSTEM_PREGENERATED');
  });

  await t.test('M2: Startup recoverIncompleteTTSJobs does NOT invoke Gemini synthesis', async () => {
    let aiCallsCount = 0;
    const mockAiClient: any = {
      models: {
        generateContent: async () => {
          aiCallsCount++;
          throw new Error('Should not be called during startup recovery');
        }
      }
    };

    const count = await recoverIncompleteTTSJobs(() => mockAiClient);
    assert.strictEqual(aiCallsCount, 0, 'Recovery worker must make ZERO provider calls on startup');
    assert.ok(count >= 0);
  });

  await t.test('M3: Quota cooldown circuit-breaker blocks provider requests when exhausted', async () => {
    setTTSQuotaCooldown(10000);
    assert.ok(getTTSQuotaCooldownUntil() > Date.now());

    let aiCallsCount = 0;
    const mockAiClient: any = {
      models: {
        generateContent: async () => {
          aiCallsCount++;
          return { candidates: [{ content: { parts: [{ inlineData: { data: 'fake_pcm' } }] } }] };
        }
      }
    };

    await assert.rejects(async () => {
      await getOrGenerateTTSAudio(mockAiClient, {
        contentType: 'article',
        contentId: 'art_circuit_breaker',
        text: 'परीक्षण वाचन सामग्री',
        title: 'परीक्षण',
        forceRegenerate: true
      });
    }, (err: any) => {
      assert.strictEqual(err.status, 429);
      assert.strictEqual(err.code, 'RATE_LIMITED');
      return true;
    });

    assert.strictEqual(aiCallsCount, 0, 'Zero provider calls when quota cooldown is active');
    resetTTSQuotaCooldown();
    assert.strictEqual(getTTSQuotaCooldownUntil(), 0);
  });

  // =========================================================================
  // SECTION N — BOUNDED TTS_READY SNAPSHOT INVALIDATION & EXECUTOR
  // =========================================================================
  await t.test('N1: SnapshotOS.normalizeArticleId normalizes all article prefixes', () => {
    assert.strictEqual(SnapshotOS.normalizeArticleId('pub_ai_101'), 'pub_ai_101');
    assert.strictEqual(SnapshotOS.normalizeArticleId('article:pub_ai_101'), 'pub_ai_101');
    assert.strictEqual(SnapshotOS.normalizeArticleId('article_pub_ai_101'), 'pub_ai_101');
    assert.strictEqual(SnapshotOS.normalizeArticleId('article/pub_ai_101'), 'pub_ai_101');
  });

  await t.test('N2: resolveAffectedModules for tts_ready does NOT include unrelated domains', () => {
    const affected = SnapshotOS.resolveAffectedModules('tts_ready', 'article:pub_ai_smoke_test', 'tts_ready');
    assert.ok(affected.includes('manifest'));
    assert.ok(affected.includes('article_pub_ai_smoke_test'));
    assert.strictEqual(affected.includes('articles'), false, 'articles must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('latest'), false, 'latest must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('homepage'), false, 'homepage must not be in tts_ready affected list');

    // Verify bounded dependency boundary: Unrelated collections MUST NOT be affected
    assert.strictEqual(affected.includes('knowledge_base'), false, 'knowledge_base must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('communityPosts'), false, 'communityPosts must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('nepal_hub_live_updates'), false, 'nepal_hub must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('events'), false, 'events must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('ads'), false, 'ads must not be in tts_ready affected list');
    assert.strictEqual(affected.includes('commentsList'), false, 'commentsList must not be in tts_ready affected list');
  });

  await t.test('N3: rebuildSnapshots with tts_ready executes bounded rebuild of only the affected article', async () => {
    const snapshotOS = SnapshotOS.getInstance();
    const result = await snapshotOS.rebuildSnapshots('tts_ready', { triggerEntity: 'article:pub_ai_targeted_1' });
    
    assert.ok(result.jobId);
    assert.ok(['completed', 'skipped_noop'].includes(result.status));
    assert.ok(result.durationMs >= 0);

    const diagnostics = snapshotOS.getDiagnostics();
    const lastDiag = diagnostics[0];
    assert.ok(lastDiag, 'Diagnostic must be recorded');
    assert.strictEqual(lastDiag.source, 'tts_ready');
    assert.strictEqual(lastDiag.module, 'article_pub_ai_targeted_1');
    assert.strictEqual(lastDiag.eventType, 'local_store_serialized');
    assert.strictEqual(lastDiag.reason, 'LOCAL_STORE_SERIALIZATION');
  });

  setTimeout(() => process.exit(0), 100);
});
