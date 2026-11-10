/**
 * SanatanMarga 5.0 Beta — Phase 1E Feature Control OS Test Verifier
 * Comprehensive Verification for Multi-Dimensional State Model, Central Evaluator,
 * Dependency Graph, Rollout Profiles, Emergency Continuity Mode,
 * Listener Teardown, and Server Governance.
 */

import {
  CANONICAL_FEATURE_REGISTRY,
  ROLLOUT_PROFILES,
  mapStateToLifecycle,
  mapLifecycleToState,
  FeatureState,
  FeatureLifecycleState
} from '../src/config/featureRegistry';
import { featureControlOS } from '../src/services/featureControlOS';
import { serverFeatureControlService } from '../server/featureControlService';
import { listenerRegistry } from '../src/lib/firebase';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('SANATANMARGA 5.0 — PHASE 1E FEATURE CONTROL OS TESTS');
  console.log('=================================================\n');

  // -------------------------------------------------------------------------
  // 1. REGISTRY & STATE MODEL INTEGRITY
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Canonical Feature Registry & State Model ---');
  
  assert(CANONICAL_FEATURE_REGISTRY.length >= 50, `1. Registry contains full product catalog (found ${CANONICAL_FEATURE_REGISTRY.length} features)`);
  
  const hasEventsFeature = CANONICAL_FEATURE_REGISTRY.some(f => f.id === 'community.events');
  assert(hasEventsFeature, '2. Canonical registry includes community.events feature definition');

  const lifecycleMappedCorrectly = (
    mapStateToLifecycle('public') === 'RELEASED' &&
    mapStateToLifecycle('beta') === 'BETA' &&
    mapStateToLifecycle('admin_only') === 'INTERNAL' &&
    mapStateToLifecycle('off') === 'BUILT'
  );
  assert(lifecycleMappedCorrectly, '3. mapStateToLifecycle maps states to lifecycle dimensions correctly');

  const stateMappedCorrectly = (
    mapLifecycleToState('RELEASED') === 'public' &&
    mapLifecycleToState('BETA') === 'beta' &&
    mapLifecycleToState('INTERNAL') === 'admin_only' &&
    mapLifecycleToState('BUILT') === 'off' &&
    mapLifecycleToState('RETIRED') === 'off'
  );
  assert(stateMappedCorrectly, '4. mapLifecycleToState maps lifecycles to runtime states correctly');

  // -------------------------------------------------------------------------
  // 2. CENTRAL EVALUATOR & SAFE DEFAULTS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Central Evaluator & Compiled Defaults ---');

  const newsEval = featureControlOS.evaluateFeature('core.news');
  assert(newsEval.enabled === true, '5. Core feature (core.news) enabled by default in compiled defaults');
  assert(newsEval.routeAllowed === true, '6. Core feature permits route navigation');
  assert(newsEval.mountAllowed === true, '7. Core feature permits component mounting');
  assert(newsEval.seoAllowed === true, '8. Public core feature permits SEO indexing');

  const unknownEval = featureControlOS.evaluateFeature('nonexistent.fake.feature');
  assert(unknownEval.enabled === false, '9. Unknown feature fails closed (enabled: false)');
  assert(unknownEval.reason === 'UNKNOWN_FEATURE', '10. Unknown feature returns UNKNOWN_FEATURE reason code');

  // -------------------------------------------------------------------------
  // 3. PARENT-CHILD HIERARCHY ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Hierarchical Inheritance & Parent Enforcement ---');

  // Test actor
  const adminActor = { id: 'test_admin', email: 'admin@sanatanmarga.com', role: 'super_admin' };

  // Set parent 'community.chautari' to off
  await featureControlOS.setFeatureState('community.chautari', 'off', adminActor, 'Test parent disabled');
  
  const childEvalWhenParentOff = featureControlOS.evaluateFeature('community.writing');
  assert(childEvalWhenParentOff.enabled === false, '11. Child feature (community.writing) disabled when parent (community.chautari) is OFF');
  assert(childEvalWhenParentOff.effectiveState === 'off', '12. Child feature effectiveState becomes OFF');
  assert(childEvalWhenParentOff.reason === 'PARENT_DISABLED', '13. Child evaluation reports PARENT_DISABLED reason');

  // Restore parent
  await featureControlOS.setFeatureState('community.chautari', 'public', adminActor, 'Restore parent');
  const childEvalRestored = featureControlOS.evaluateFeature('community.writing');
  assert(childEvalRestored.enabled === true, '14. Child feature enabled when parent is restored to public');

  // -------------------------------------------------------------------------
  // 4. DEPENDENCY GRAPH ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Dependency Graph Enforcement ---');

  // 'ai.tts' depends on 'media.listenos'
  await featureControlOS.setFeatureState('media.listenos', 'off', adminActor, 'Test dependency disabled');
  
  const depEval = featureControlOS.evaluateFeature('ai.tts');
  assert(depEval.enabled === false, '15. Dependent feature (ai.tts) disabled when dependency (media.listenos) is OFF');
  assert(depEval.reason === 'DEPENDENCY_UNSATISFIED', '16. Dependent evaluation returns DEPENDENCY_UNSATISFIED');
  assert(Boolean(depEval.missingDependencies?.includes('media.listenos')), '17. Evaluation accurately reports missingDependencies');

  // Restore dependency
  await featureControlOS.setFeatureState('media.listenos', 'public', adminActor, 'Restore dependency');
  const depEvalRestored = featureControlOS.evaluateFeature('ai.tts');
  assert(depEvalRestored.enabled === true, '18. Dependent feature enabled when dependency is restored');

  // -------------------------------------------------------------------------
  // 5. TENANT OVERRIDE SAFETY (ADDITIVE RESTRICTION)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Tenant Overrides & Isolation ---');

  // Globally disabled feature: tenant cannot force enable it
  await featureControlOS.setFeatureState('media.live', 'off', adminActor, 'Set media.live to off');
  const tenantForcedEval = featureControlOS.evaluateFeature('media.live', {
    tenantId: 'tenant_kavre',
    tenantOverrides: { 'media.live': 'public' }
  });
  assert(tenantForcedEval.enabled === false, '19. Tenant override CANNOT force-enable a globally disabled feature');

  // Globally public feature: tenant CAN restrict it
  await featureControlOS.setFeatureState('commerce.store', 'public', adminActor, 'Set store to public');
  const tenantRestrictedEval = featureControlOS.evaluateFeature('commerce.store', {
    tenantId: 'tenant_mustang',
    tenantOverrides: { 'commerce.store': 'off' }
  });
  assert(tenantRestrictedEval.enabled === false, '20. Tenant override CAN restrict a globally public feature to OFF');

  // -------------------------------------------------------------------------
  // 6. ROLE & AUTHORIZATION EVALUATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Role & Authorization Access ---');

  await featureControlOS.setFeatureState('ai.newsroom', 'admin_only', adminActor, 'Set newsroom to admin_only');
  
  const readerNewsroomEval = featureControlOS.evaluateFeature('ai.newsroom', { role: 'reader' });
  assert(readerNewsroomEval.enabled === false, '21. Admin-only feature disabled for regular reader');
  assert(readerNewsroomEval.reason === 'STAFF_ONLY', '22. Admin-only feature returns STAFF_ONLY for reader');

  const staffNewsroomEval = featureControlOS.evaluateFeature('ai.newsroom', { role: 'editor' });
  assert(staffNewsroomEval.enabled === true, '23. Admin-only feature enabled for staff editor');
  assert(staffNewsroomEval.reason === 'STAFF_ACCESS', '24. Admin-only feature returns STAFF_ACCESS for staff');

  // Beta feature access
  await featureControlOS.setFeatureState('community.chautari', 'beta', adminActor, 'Set chautari to beta');
  const regularUserBetaEval = featureControlOS.evaluateFeature('community.chautari', { role: 'reader', isBetaUser: false });
  assert(regularUserBetaEval.enabled === false, '25. Beta feature disabled for non-beta reader');
  assert(regularUserBetaEval.reason === 'BETA_ONLY', '26. Beta feature returns BETA_ONLY reason');

  const betaUserEval = featureControlOS.evaluateFeature('community.chautari', { role: 'reader', isBetaUser: true });
  assert(betaUserEval.enabled === true, '27. Beta feature enabled for enrolled beta reader');

  // Restore chautari
  await featureControlOS.setFeatureState('community.chautari', 'public', adminActor, 'Restore chautari');

  // -------------------------------------------------------------------------
  // 7. CANONICAL ROLLOUT PROFILES
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Canonical Rollout Profiles ---');

  const requiredProfiles = ['LAUNCH_MINIMAL', 'LAUNCH_STANDARD', 'BETA_STANDARD', 'BETA_EXPANDED', 'FULL_PLATFORM', 'EMERGENCY_MODE'];
  for (const prof of requiredProfiles) {
    assert(Boolean(ROLLOUT_PROFILES[prof as any]), `28.${prof} Rollout profile '${prof}' exists in ROLLOUT_PROFILES`);
  }

  // Apply LAUNCH_MINIMAL profile
  await featureControlOS.applyRolloutProfile('LAUNCH_MINIMAL', adminActor, 'Apply Launch Minimal Profile');
  const chautariLaunchMin = featureControlOS.evaluateFeature('community.chautari');
  assert(chautariLaunchMin.enabled === false, '29. LAUNCH_MINIMAL profile disables non-essential community.chautari');
  const storeLaunchMin = featureControlOS.evaluateFeature('commerce.store');
  assert(storeLaunchMin.enabled === false, '30. LAUNCH_MINIMAL profile disables commerce.store');
  const newsLaunchMin = featureControlOS.evaluateFeature('core.news');
  assert(newsLaunchMin.enabled === true, '31. LAUNCH_MINIMAL profile preserves core.news');

  // Apply BETA_STANDARD profile
  await featureControlOS.applyRolloutProfile('BETA_STANDARD', adminActor, 'Apply Beta Standard Profile');
  const storeBetaStd = featureControlOS.evaluateFeature('commerce.store');
  assert(storeBetaStd.enabled === true, '32. BETA_STANDARD profile activates commerce.store for public');

  // Apply EMERGENCY_MODE profile
  await featureControlOS.applyRolloutProfile('EMERGENCY_MODE', adminActor, 'Apply Emergency Mode Profile');
  const ttsEmergency = featureControlOS.evaluateFeature('ai.tts');
  assert(ttsEmergency.enabled === false, '33. EMERGENCY_MODE shuts down AI TTS pregeneration');
  const liveEmergency = featureControlOS.evaluateFeature('media.live');
  assert(liveEmergency.enabled === false, '34. EMERGENCY_MODE shuts down live streaming');
  const pushEmergency = featureControlOS.evaluateFeature('notifications.push');
  assert(pushEmergency.enabled === false, '35. EMERGENCY_MODE shuts down push notifications');
  const newsEmergency = featureControlOS.evaluateFeature('core.news');
  assert(newsEmergency.enabled === true, '36. EMERGENCY_MODE keeps static news reading active');

  // Reset to defaults
  await featureControlOS.resetToDefaults(adminActor, 'Resetting test suite to defaults');
  const newsReset = featureControlOS.evaluateFeature('core.news');
  assert(newsReset.enabled === true, '37. Reset to defaults successfully restores baseline');

  // -------------------------------------------------------------------------
  // 8. REALTIME LISTENER ENFORCEMENT & TEARDOWN
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Realtime Listener Enforcement & Teardown ---');

  let unsubCalls = 0;
  const mockUnsub1 = () => { unsubCalls++; };
  const mockUnsub2 = () => { unsubCalls++; };

  // Register listener for feature
  listenerRegistry.register(mockUnsub1, 'test_listener_store_1', 'commerce.store');
  listenerRegistry.register(mockUnsub2, 'test_listener_store_2', 'commerce.store');

  const storeActiveListeners = listenerRegistry.getActiveByFeature('commerce.store');
  assert(storeActiveListeners >= 2, `38. ListenerRegistry tracks active listeners by feature (count: ${storeActiveListeners})`);

  // Kill by feature
  const killedCount = listenerRegistry.killByFeature('commerce.store');
  assert(killedCount >= 2, `39. killByFeature tore down active listeners (cleaned: ${killedCount})`);
  assert(unsubCalls >= 2, `40. Listener unsubscribe callbacks were invoked cleanly`);
  assert(listenerRegistry.getActiveByFeature('commerce.store') === 0, '41. Zero listeners remain for cleaned feature');

  // -------------------------------------------------------------------------
  // 9. SERVER-SIDE FEATURE EVALUATION & GOVERNANCE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Server Feature Control Governance ---');

  const serverEvalNews = serverFeatureControlService.evaluateFeature('core.news');
  assert(serverEvalNews.enabled === true, '42. ServerFeatureControlService evaluates core.news as enabled');
  assert(serverEvalNews.snapshotAllowed === true, '43. Server evaluates snapshotAllowed as true for core feature');

  const serverEvalUnknown = serverFeatureControlService.evaluateFeature('invalid_unknown_feature');
  assert(serverEvalUnknown.enabled === false, '44. Server evaluation fails closed for unrecognized features');

  // Server middleware simulation
  let middlewarePassed = false;
  let middlewareFailed = false;
  const mockReq = { user: { role: 'reader' } } as any;
  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => { middlewareFailed = true; }
    })
  } as any;
  const mockNext = () => { middlewarePassed = true; };

  const middleware = serverFeatureControlService.requireFeature('core.news');
  middleware(mockReq, mockRes, mockNext);
  assert(middlewarePassed && !middlewareFailed, '45. Server requireFeature middleware passes for active feature');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n=================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('=================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
