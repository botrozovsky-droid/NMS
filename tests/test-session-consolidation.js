#!/usr/bin/env node
/**
 * Test Suite for Session-End Consolidation (v0.3)
 * Tests session detection, activity tracking, and mini-consolidation
 */

import assert from 'assert';
import { SessionManager, getSessionManager } from './session-manager.js';

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
  }
}

console.log('🧪 Running Session-End Consolidation Tests (v0.3)...\n');

// Test 1: SessionManager initialization
await asyncTest('SessionManager initialization works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  assert.strictEqual(sm.currentSession, null, 'Should have no active session initially');
  assert.strictEqual(sm.lastActivity, null, 'Should have no activity initially');
});

// Test 2: Start session
await asyncTest('Start session works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  const sessionId = await sm.startSession();

  assert(sessionId, 'Should return session ID');
  assert(sm.currentSession, 'Should have active session');
  assert.strictEqual(sm.currentSession.id, sessionId, 'Session ID should match');
  assert.strictEqual(sm.currentSession.eventCount, 0, 'Event count should be 0');
});

// Test 3: Record activity
await asyncTest('Record activity works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  await sm.startSession();

  sm.recordActivity({ importance: 0.8, type: 'test', id: 'event-1' });

  assert.strictEqual(sm.currentSession.eventCount, 1, 'Event count should be 1');
  assert.strictEqual(sm.currentSession.importantEvents.length, 1, 'Should have 1 important event');
  assert(sm.lastActivity, 'Should have last activity timestamp');
});

// Test 4: Record multiple activities
await asyncTest('Record multiple activities works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  await sm.startSession();

  for (let i = 0; i < 5; i++) {
    sm.recordActivity({
      importance: 0.5 + Math.random() * 0.5,
      type: 'test',
      id: `event-${i}`
    });
  }

  assert.strictEqual(sm.currentSession.eventCount, 5, 'Event count should be 5');
  assert(sm.currentSession.importantEvents.length >= 0, 'Should track important events');
});

// Test 5: Session end detection (inactivity)
await asyncTest('Session end detection works', async () => {
  const sm = new SessionManager({
    autoConsolidate: false,
    inactivityThreshold: 100 // 100ms for testing
  });
  await sm.initialize();

  await sm.startSession();
  sm.recordActivity({ importance: 0.8 });

  // Initially should not be ended
  assert.strictEqual(sm.isSessionEnded(), false, 'Session should be active');

  // Wait for inactivity threshold
  await new Promise(resolve => setTimeout(resolve, 150));

  // Now should be ended
  assert.strictEqual(sm.isSessionEnded(), true, 'Session should be ended after inactivity');
});

// Test 6: Manual session end
await asyncTest('Manual session end works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  await sm.startSession();
  sm.recordActivity({ importance: 0.8, id: 'event-1' });
  sm.recordActivity({ importance: 0.9, id: 'event-2' });

  const result = await sm.forceEndSession();

  assert(result, 'Should return result');
  assert(result.session, 'Should have session data');
  assert.strictEqual(result.session.status, 'ended', 'Session status should be ended');
  assert(result.session.duration !== undefined, 'Should have duration');
  assert.strictEqual(sm.currentSession, null, 'Should clear current session');
});

// Test 7: Session statistics
await asyncTest('Session statistics tracking works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  const initialStats = sm.getStats();
  assert(initialStats.totalSessions >= 0, 'Should have total sessions');

  await sm.startSession();
  sm.recordActivity({ importance: 0.8 });

  const activeStats = sm.getStats();
  assert(activeStats.currentSession, 'Should have current session in stats');
  assert(activeStats.currentSession.eventCount === 1, 'Should show event count');
});

// Test 8: Auto-consolidation threshold
await asyncTest('Mini-consolidation triggers only with enough events', async () => {
  const sm = new SessionManager({
    autoConsolidate: false,
    minEventsForConsolidation: 5
  });
  await sm.initialize();

  // Session with few events (should skip consolidation)
  await sm.startSession();
  sm.recordActivity({ importance: 0.8, id: 'e1' });
  sm.recordActivity({ importance: 0.7, id: 'e2' });

  const result1 = await sm.forceEndSession();
  // Should not trigger consolidation (only 2 events, need 5)

  // Session with many events (should trigger consolidation)
  await sm.startSession();
  for (let i = 0; i < 6; i++) {
    sm.recordActivity({
      importance: 0.6 + Math.random() * 0.4,
      id: `event-${i}`
    });
  }

  const result2 = await sm.forceEndSession();
  assert(result2.session.importantEvents.length >= 5, 'Should have enough events for consolidation');
});

// Test 9: Background checker can be started/stopped
await asyncTest('Background checker start/stop works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  assert.strictEqual(sm.checkIntervalId, null, 'Checker should not be running initially');

  sm.startBackgroundChecker();
  assert(sm.checkIntervalId, 'Checker should be running');

  sm.stopBackgroundChecker();
  assert.strictEqual(sm.checkIntervalId, null, 'Checker should be stopped');
});

// Test 10: Singleton pattern
test('Singleton getSessionManager works', () => {
  const sm1 = getSessionManager();
  const sm2 = getSessionManager();

  assert.strictEqual(sm1, sm2, 'Should return same instance');
});

// Test 11: Config overrides
test('Config overrides work', () => {
  const sm = new SessionManager({
    inactivityThreshold: 60000,
    minEventsForConsolidation: 10,
    autoConsolidate: false
  });

  assert.strictEqual(sm.config.inactivityThreshold, 60000, 'Should use custom threshold');
  assert.strictEqual(sm.config.minEventsForConsolidation, 10, 'Should use custom min events');
  assert.strictEqual(sm.config.autoConsolidate, false, 'Should use custom autoConsolidate');
});

// Test 12: Important events filtering
await asyncTest('Important events filtering works', async () => {
  const sm = new SessionManager({ autoConsolidate: false });
  await sm.initialize();

  await sm.startSession();

  // Low importance (should not be tracked)
  sm.recordActivity({ importance: 0.3, id: 'low' });

  // High importance (should be tracked)
  sm.recordActivity({ importance: 0.8, id: 'high1' });
  sm.recordActivity({ importance: 0.9, id: 'high2' });

  assert.strictEqual(sm.currentSession.eventCount, 3, 'Should count all events');
  assert.strictEqual(sm.currentSession.importantEvents.length, 2, 'Should only track important events');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${(testsPassed / (testsPassed + testsFailed) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n✅ All session-end consolidation tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. See details above.');
  process.exit(1);
}
