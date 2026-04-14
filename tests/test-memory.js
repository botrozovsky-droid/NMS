#!/usr/bin/env node
/**
 * Memory System Test Suite
 * Validates all components of the neurobiological memory system
 */

import memoryIntegration from './integration.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_SESSION_ID = 'test-session-' + Date.now();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name, fn) {
  process.stdout.write(`\n🧪 ${name}... `);
  try {
    await fn();
    console.log('✅');
    return true;
  } catch (error) {
    console.log(`❌ ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  🧠 Memory System Test Suite                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  let passed = 0;
  let failed = 0;

  // Test 1: Initialize
  if (await test('Initialize memory system', async () => {
    await memoryIntegration.initialize();
  })) passed++; else failed++;

  // Test 2: Encode tool call
  if (await test('Encode tool call episode', async () => {
    await memoryIntegration.onToolCall(
      TEST_SESSION_ID,
      'Read',
      { file_path: '/test/file.js' },
      { success: true },
      { filesModified: ['/test/file.js'] }
    );
  })) passed++; else failed++;

  // Test 3: Encode user message
  if (await test('Encode user message', async () => {
    await memoryIntegration.onUserMessage(
      TEST_SESSION_ID,
      'Создай функцию для обработки данных',
      { mentionsUser: false }
    );
  })) passed++; else failed++;

  // Test 4: Encode error
  if (await test('Encode error event', async () => {
    await memoryIntegration.onError(
      TEST_SESSION_ID,
      new Error('Test error'),
      { context: 'test' }
    );
  })) passed++; else failed++;

  // Test 5: Store preference
  if (await test('Store user preference', async () => {
    await memoryIntegration.storePreference('editor', 'vscode', 0.9);
  })) passed++; else failed++;

  // Test 6: Learn pattern
  if (await test('Learn action pattern', async () => {
    await memoryIntegration.learnPattern('test_pattern', { type: 'test' }, true);
  })) passed++; else failed++;

  // Test 7: Query memory
  if (await test('Query episodic memory', async () => {
    const results = await memoryIntegration.queryMemory('test', { limit: 5 });
    if (!Array.isArray(results)) throw new Error('Results not an array');
  })) passed++; else failed++;

  // Test 8: Get statistics
  if (await test('Get memory statistics', async () => {
    const stats = await memoryIntegration.getStats();
    if (!stats.hippocampus || !stats.neocortex || !stats.procedural) {
      throw new Error('Invalid statistics structure');
    }
  })) passed++; else failed++;

  // Test 9: Session file created
  if (await test('Verify session file created', async () => {
    const sessionFile = path.join(__dirname, 'hippocampus', 'sessions', `${TEST_SESSION_ID}.json`);
    await fs.access(sessionFile);
  })) passed++; else failed++;

  // Test 10: Consolidation candidates added
  if (await test('Verify consolidation candidates', async () => {
    const candidatesFile = path.join(__dirname, 'hippocampus', 'synaptic-candidates.json');
    const data = JSON.parse(await fs.readFile(candidatesFile, 'utf-8'));
    if (data.candidates.length === 0) {
      throw new Error('No consolidation candidates added (error event should be high importance)');
    }
  })) passed++; else failed++;

  // Summary
  console.log('\n' + '═'.repeat(48));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ All tests passed! Memory system is working correctly.\n');
    return 0;
  } else {
    console.log(`\n❌ ${failed} test(s) failed. Check implementation.\n`);
    return 1;
  }
}

// Run tests
runTests()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
  });
