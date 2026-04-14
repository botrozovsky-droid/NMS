#!/usr/bin/env node
/**
 * Test Ganglia Functionality
 */

import { GangliaManager } from '../lib/ganglia-manager.js';
import { getDatabase } from '../lib/db-adapter.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'tests', 'test-ganglia.db');

console.log('═══════════════════════════════════════════════════════════');
console.log('  GANGLIA TESTS');
console.log('═══════════════════════════════════════════════════════════\n');

// Cleanup
if (existsSync(TEST_DB_PATH)) {
  unlinkSync(TEST_DB_PATH);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    failed++;
  }
}

async function runTests() {
  const manager = new GangliaManager(TEST_DB_PATH);
  const db = getDatabase(TEST_DB_PATH);
  db.initialize();

  try {
    // Test 1: Create ganglia
    console.log('Test 1: Create ganglia');
    const ganglia = await manager.createGanglia(
      'Machine Learning',
      'concept',
      'Advanced ML concepts',
      {
        context: 'learning',
        expertise: 'intermediate',
        subtopics: 'neural networks, transformers',
        relations: 'AI research',
        horizon: 'long-term'
      }
    );

    test('Ganglia created with ID', () => {
      if (!ganglia.id) throw new Error('No ID returned');
      if (!ganglia.id.startsWith('ganglia_')) throw new Error('Invalid ID format');
    });

    test('Ganglia has correct properties', () => {
      if (ganglia.name !== 'Machine Learning') throw new Error('Wrong name');
      if (ganglia.type !== 'concept') throw new Error('Wrong type');
      if (ganglia.weight !== 10.0) throw new Error('Wrong weight');
      if (!ganglia.is_manual) throw new Error('Not marked as manual');
    });

    test('Ganglia metadata stored', () => {
      const meta = typeof ganglia.metadata === 'string'
        ? JSON.parse(ganglia.metadata)
        : ganglia.metadata;
      if (meta.context !== 'learning') throw new Error('Wrong context');
      if (meta.subtopics.length !== 2) throw new Error('Wrong subtopics');
    });

    // Test 2: List ganglia
    console.log('\nTest 2: List ganglia');
    const list = manager.listGanglia();

    test('List returns array', () => {
      if (!Array.isArray(list)) throw new Error('Not an array');
      if (list.length !== 1) throw new Error('Wrong count');
    });

    test('List contains created ganglia', () => {
      const found = list.find(g => g.id === ganglia.id);
      if (!found) throw new Error('Ganglia not in list');
    });

    // Test 3: Get details
    console.log('\nTest 3: Get ganglia details');
    const details = manager.getGanglia(ganglia.id);

    test('Details retrieved', () => {
      if (!details) throw new Error('No details returned');
      if (details.id !== ganglia.id) throw new Error('Wrong ID');
    });

    test('Health check works', () => {
      if (!details.health) throw new Error('No health status');
      if (details.health.status !== 'new') throw new Error('Wrong health status');
    });

    // Test 4: Create test node
    console.log('\nTest 4: Auto-linking');
    const testNode = {
      id: 'test_node_1',
      name: 'Deep Learning',
      type: 'concept',
      weight: 1.0,
      confidence: 0.8,
      activations: 0,
      created: Date.now(),
      is_manual: false
    };

    db.addNode(testNode);

    test('Test node created', () => {
      const node = db.getNode('test_node_1');
      if (!node) throw new Error('Node not created');
    });

    // Test 5: Link node to ganglia
    const edgeId = await manager.linkToGanglia(testNode.id, ganglia.id, 0.85, {
      test: true
    });

    test('Edge created', () => {
      if (!edgeId) throw new Error('No edge ID returned');
    });

    test('Auto-link count incremented', () => {
      const updated = manager.getGanglia(ganglia.id);
      if (updated.metadata.auto_link_count !== 1) {
        throw new Error('Auto-link count not incremented');
      }
    });

    test('Edge exists in database', () => {
      const edges = db.getNodeEdges(ganglia.id);
      if (edges.length !== 1) throw new Error('Wrong edge count');
      const edge = edges[0];
      if (edge.weight !== 0.85) throw new Error('Wrong edge weight');
    });

    // Test 6: Query filter
    console.log('\nTest 6: Query filters');
    const manualNodes = db.queryNodes({ is_manual: 1 });

    test('Query finds ganglia', () => {
      if (manualNodes.length !== 1) throw new Error('Wrong count');
      if (manualNodes[0].id !== ganglia.id) throw new Error('Wrong node');
    });

    const autoNodes = db.queryNodes({ is_manual: 0 });

    test('Query excludes ganglia', () => {
      if (autoNodes.length !== 1) throw new Error('Wrong count');
      if (autoNodes[0].id !== testNode.id) throw new Error('Wrong node');
    });

    // Test 7: Update ganglia
    console.log('\nTest 7: Update ganglia');
    manager.updateGanglia(ganglia.id, { weight: 12.0 });

    test('Ganglia updated', () => {
      const updated = db.getNode(ganglia.id);
      if (updated.weight !== 12.0) throw new Error('Weight not updated');
    });

    // Test 8: Duplicate prevention
    console.log('\nTest 8: Duplicate prevention');
    try {
      await manager.createGanglia('Machine Learning', 'concept', 'Duplicate', {});
      test('Duplicate rejected', () => {
        throw new Error('Should have thrown error');
      });
    } catch (error) {
      test('Duplicate rejected', () => {
        if (!error.message.includes('already exists')) {
          throw new Error('Wrong error message');
        }
      });
    }

    // Test 9: Delete ganglia
    console.log('\nTest 9: Delete ganglia');
    const deleted = manager.deleteGanglia(ganglia.id);

    test('Ganglia deleted', () => {
      if (!deleted) throw new Error('Delete failed');
    });

    test('Ganglia not in database', () => {
      const node = db.getNode(ganglia.id);
      if (node) throw new Error('Ganglia still exists');
    });

    test('Edges cascade deleted', () => {
      const edges = db.getNodeEdges(ganglia.id);
      if (edges.length !== 0) throw new Error('Edges not deleted');
    });

    // Test 10: Stats
    console.log('\nTest 10: Statistics');
    await manager.createGanglia('Test 1', 'project', '', { context: 'test', expertise: 'beginner', subtopics: '', relations: '', horizon: 'short' });
    await manager.createGanglia('Test 2', 'concept', '', { context: 'test', expertise: 'expert', subtopics: '', relations: '', horizon: 'long' });

    const stats = manager.listGanglia();

    test('Multiple ganglia created', () => {
      if (stats.length !== 2) throw new Error('Wrong count');
    });

  } finally {
    manager.close();
    db.close();

    // Cleanup
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
