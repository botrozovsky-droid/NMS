#!/usr/bin/env node
/**
 * Test Suite for Transaction System (v0.3)
 * Tests atomic operations, rollback, and data integrity
 */

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { TransactionManager, withTransaction } from '../transaction-manager.js';
import memoryManager from '../memory-manager.js';

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

console.log('🧪 Running Transaction Tests (v0.3)...\n');

// Setup test file
const TEST_FILE = './test-tx-data.json';
const INITIAL_DATA = { value: 0, items: [] };

async function setupTestFile() {
  await fs.writeFile(TEST_FILE, JSON.stringify(INITIAL_DATA, null, 2));
}

async function cleanupTestFile() {
  try {
    await fs.unlink(TEST_FILE);
    await fs.rm('./.tx-backups', { recursive: true, force: true });
    await fs.unlink('./transaction-log.json');
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Test 1: Transaction manager initialization
await asyncTest('TransactionManager initialization', async () => {
  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  assert.strictEqual(txManager.isActive, false, 'Should not have active transaction initially');
  assert.strictEqual(txManager.currentTxId, null, 'Should have no transaction ID');
});

// Test 2: Begin transaction creates backup
await asyncTest('Begin transaction creates backup', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  const txId = await txManager.begin('test-begin');

  assert.strictEqual(txManager.isActive, true, 'Should have active transaction');
  assert.strictEqual(txManager.currentTxId, txId, 'Should have transaction ID');

  // Verify backup exists
  const backupPath = txManager.currentTransaction.backupPath;
  const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
  assert(backupExists, 'Backup file should exist');

  await txManager.rollback('test cleanup');
  await cleanupTestFile();
});

// Test 3: Commit deletes backup
await asyncTest('Commit deletes backup', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  await txManager.begin('test-commit');
  const backupPath = txManager.currentTransaction.backupPath;

  // Modify data
  const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  data.value = 100;
  await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));

  // Commit
  await txManager.commit();

  // Verify backup deleted
  const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
  assert(!backupExists, 'Backup file should be deleted after commit');

  // Verify data persisted
  const finalData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(finalData.value, 100, 'Changes should persist after commit');

  await cleanupTestFile();
});

// Test 4: Rollback restores original data
await asyncTest('Rollback restores original data', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  // Begin transaction
  await txManager.begin('test-rollback');

  // Modify data
  const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  data.value = 999;
  await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));

  // Verify changes are visible
  const modifiedData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(modifiedData.value, 999, 'Modified value should be visible');

  // Rollback
  await txManager.rollback('test rollback');

  // Verify data restored
  const restoredData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(restoredData.value, 0, 'Value should be restored to original');

  await cleanupTestFile();
});

// Test 5: Execute with success commits
await asyncTest('Execute with success commits automatically', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  const result = await txManager.execute(async () => {
    const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
    data.value = 42;
    await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));
    return 'success';
  }, 'test-execute-success');

  assert.strictEqual(result, 'success', 'Should return operation result');

  // Verify data persisted
  const finalData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(finalData.value, 42, 'Changes should persist');

  await cleanupTestFile();
});

// Test 6: Execute with error rolls back
await asyncTest('Execute with error rolls back automatically', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  try {
    await txManager.execute(async () => {
      const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
      data.value = 999;
      await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));
      throw new Error('Simulated error');
    }, 'test-execute-error');

    assert.fail('Should have thrown error');
  } catch (error) {
    assert.strictEqual(error.message, 'Simulated error', 'Should propagate error');
  }

  // Verify data restored
  const finalData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(finalData.value, 0, 'Changes should be rolled back');

  await cleanupTestFile();
});

// Test 7: Statistics tracking
await asyncTest('Statistics tracking works', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  // Successful transaction
  await txManager.execute(async () => {
    const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
    data.value = 1;
    await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));
  }, 'test-stats-1');

  // Failed transaction
  try {
    await txManager.execute(async () => {
      throw new Error('Test error');
    }, 'test-stats-2');
  } catch (error) {
    // Expected
  }

  const stats = txManager.getStats();

  assert.strictEqual(stats.totalTransactions, 2, 'Should track total transactions');
  assert.strictEqual(stats.committed, 1, 'Should track commits');
  assert.strictEqual(stats.rolledBack, 1, 'Should track rollbacks');
  assert.strictEqual(stats.successRate, '50.0%', 'Should calculate success rate');

  await cleanupTestFile();
});

// Test 8: Nested transactions (stack support)
await asyncTest('Nested transactions work', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  await txManager.begin('outer-tx');

  assert.strictEqual(txManager.isActive, true, 'Outer transaction should be active');
  assert.strictEqual(txManager.transactionStack.length, 0, 'Stack should be empty');

  await txManager.begin('inner-tx');

  assert.strictEqual(txManager.isActive, true, 'Inner transaction should be active');
  assert.strictEqual(txManager.transactionStack.length, 1, 'Stack should have outer transaction');

  await txManager.commit(); // Commit inner

  assert.strictEqual(txManager.isActive, true, 'Outer transaction should still be active');
  assert.strictEqual(txManager.transactionStack.length, 0, 'Stack should be empty again');

  await txManager.commit(); // Commit outer

  assert.strictEqual(txManager.isActive, false, 'No transaction should be active');

  await cleanupTestFile();
});

// Test 9: withTransaction helper
await asyncTest('withTransaction helper works', async () => {
  await setupTestFile();

  const result = await withTransaction(TEST_FILE, async () => {
    const data = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
    data.value = 777;
    await fs.writeFile(TEST_FILE, JSON.stringify(data, null, 2));
    return 'helper-success';
  }, 'test-with-transaction');

  assert.strictEqual(result, 'helper-success', 'Should return result');

  const finalData = JSON.parse(await fs.readFile(TEST_FILE, 'utf-8'));
  assert.strictEqual(finalData.value, 777, 'Changes should persist');

  await cleanupTestFile();
});

// Test 10: Cleanup old backups
await asyncTest('Cleanup old backups works', async () => {
  await setupTestFile();

  const txManager = new TransactionManager(TEST_FILE);
  await txManager.initialize();

  // Create some test backups
  const backupDir = txManager.backupDir;
  await fs.mkdir(backupDir, { recursive: true });

  // Create old backup (simulate by creating file)
  const oldBackup = path.join(backupDir, 'old-backup.backup');
  await fs.writeFile(oldBackup, 'old data');

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100));

  // Cleanup with very short max age (should delete the file)
  const cleaned = await txManager.cleanup(10); // 10ms

  assert(cleaned >= 1, 'Should clean up old backups');

  await cleanupTestFile();
});

// Test 11: Memory manager node update with transaction
await asyncTest('Memory manager updateNode uses transactions', async () => {
  // Initialize memory manager
  await memoryManager.initialize();

  // Load graph
  const KNOWLEDGE_GRAPH = './neocortex/knowledge-graph.json';
  const graph = JSON.parse(await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8'));

  // Get a node ID
  const nodeId = Object.keys(graph.nodes)[0];
  if (!nodeId) {
    console.log('⚠️ Skipping test - no nodes in graph');
    testsPassed++;
    return;
  }

  const originalWeight = graph.nodes[nodeId].weight;

  try {
    // Test successful update
    await memoryManager.updateNode(nodeId, { weight: 0.99 });

    const updatedGraph = JSON.parse(await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8'));
    assert.strictEqual(updatedGraph.nodes[nodeId].weight, 0.99, 'Weight should be updated');

    // Restore original
    await memoryManager.updateNode(nodeId, { weight: originalWeight });

  } catch (error) {
    console.log(`⚠️ Test failed: ${error.message}`);
    throw error;
  }
});

// Test 12: Memory manager handles update failure
await asyncTest('Memory manager rolls back on update failure', async () => {
  await memoryManager.initialize();

  try {
    // Try to update non-existent node (should fail and rollback)
    await memoryManager.updateNode('non-existent-node-123', { weight: 0.5 });
    assert.fail('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('not found'), 'Should throw not found error');
  }

  // Verify graph is still intact (not corrupted)
  const KNOWLEDGE_GRAPH = './neocortex/knowledge-graph.json';
  const graph = JSON.parse(await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8'));
  assert(graph.nodes, 'Graph should still have nodes');
  assert(graph.version, 'Graph should still have version');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${(testsPassed / (testsPassed + testsFailed) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n✅ All transaction tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. See details above.');
  process.exit(1);
}
