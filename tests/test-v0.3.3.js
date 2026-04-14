#!/usr/bin/env node
/**
 * Tests for v0.3.3 features
 * - Obsidian export
 * - Contradiction detection
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportToObsidian } from '../export-obsidian.js';
import { extractFacts } from '../contradiction-detector.js';
import { loadJSON } from '../lib/json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    console.error(`❌ ${message}`);
    failed++;
  }
}

/**
 * Test Obsidian export
 */
async function testObsidianExport() {
  console.log('\n📓 Testing Obsidian Export...\n');

  const testVaultDir = path.join(__dirname, '..', 'test-exports', 'test-vault');

  try {
    // Export to test directory
    await exportToObsidian(testVaultDir);

    // Check that vault was created
    const stats = await fs.stat(testVaultDir);
    assert(stats.isDirectory(), 'Vault directory created');

    // Check INDEX.md exists
    const indexExists = await fs.access(path.join(testVaultDir, 'INDEX.md'))
      .then(() => true)
      .catch(() => false);
    assert(indexExists, 'INDEX.md created');

    // Check that .obsidian config exists
    const configExists = await fs.access(path.join(testVaultDir, '.obsidian', 'config.json'))
      .then(() => true)
      .catch(() => false);
    assert(configExists, '.obsidian/config.json created');

    // Check that at least one concept was exported
    const conceptsDir = path.join(testVaultDir, 'concepts');
    const conceptFiles = await fs.readdir(conceptsDir).catch(() => []);
    assert(conceptFiles.length > 0, `Exported ${conceptFiles.length} concept(s)`);

    // Check that a markdown file has correct structure
    if (conceptFiles.length > 0) {
      const sampleFile = path.join(conceptsDir, conceptFiles[0]);
      const content = await fs.readFile(sampleFile, 'utf-8');

      assert(content.includes('---'), 'Markdown has YAML frontmatter');
      assert(content.includes('type:'), 'Frontmatter has type field');
      assert(content.includes('weight:'), 'Frontmatter has weight field');
      assert(content.includes('## Metadata'), 'Markdown has Metadata section');
      assert(content.includes('[['), 'Markdown has wikilinks');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    failed++;
  }
}

/**
 * Test contradiction detection - fact extraction
 */
async function testContradictionDetection() {
  console.log('\n🔍 Testing Contradiction Detection...\n');

  try {
    // Load graph
    const graph = await loadJSON(path.join(__dirname, '..', 'neocortex', 'knowledge-graph.json'));
    assert(graph !== null, 'Knowledge graph loaded');

    // Extract facts
    const facts = extractFacts(graph);
    assert(Array.isArray(facts), 'Facts extracted as array');
    assert(facts.length > 0, `Extracted ${facts.length} fact(s)`);

    // Check fact structure
    if (facts.length > 0) {
      const fact = facts[0];
      assert(fact.id !== undefined, 'Fact has id');
      assert(fact.type !== undefined, 'Fact has type');
      assert(fact.statement !== undefined, 'Fact has statement');
      assert(fact.confidence !== undefined, 'Fact has confidence');
      assert(fact.source !== undefined, 'Fact has source');
    }

    // Check that facts include nodes
    const nodeFacts = facts.filter(f => f.type === 'implicit_fact');
    assert(nodeFacts.length > 0, `Found ${nodeFacts.length} node fact(s)`);

    // Check that facts include edges
    const edgeFacts = facts.filter(f => f.type === 'relationship_fact');
    assert(edgeFacts.length > 0, `Found ${edgeFacts.length} relationship fact(s)`);

    console.log('\n💡 Note: Full contradiction detection with Gemini requires API key');
    console.log('   Basic fact extraction tested successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    failed++;
  }
}

/**
 * Test Obsidian export file content quality
 */
async function testExportQuality() {
  console.log('\n📋 Testing Export Quality...\n');

  const testVaultDir = path.join(__dirname, '..', 'test-exports', 'test-vault');

  try {
    // Read INDEX.md
    const indexPath = path.join(testVaultDir, 'INDEX.md');
    const indexContent = await fs.readFile(indexPath, 'utf-8');

    assert(indexContent.includes('# 🧠 OpenClaw Knowledge Graph'), 'INDEX has title');
    assert(indexContent.includes('## Statistics'), 'INDEX has statistics');
    assert(indexContent.includes('Total Nodes:'), 'INDEX shows node count');
    assert(indexContent.includes('Total Edges:'), 'INDEX shows edge count');
    assert(indexContent.includes('## Top Concepts'), 'INDEX has top concepts');
    assert(indexContent.includes('## Extraction Quality'), 'INDEX shows quality metrics');

    // Check that wikilinks use correct format
    const wikilinkMatches = indexContent.match(/\[\[([^\]]+)\]\]/g);
    assert(wikilinkMatches && wikilinkMatches.length > 0, 'INDEX contains wikilinks');

    // Check concepts directory structure
    const conceptsPath = path.join(testVaultDir, 'concepts');
    const conceptFiles = await fs.readdir(conceptsPath);

    let properlyFormatted = 0;
    for (const file of conceptFiles.slice(0, 3)) { // Check first 3
      const content = await fs.readFile(path.join(conceptsPath, file), 'utf-8');

      if (content.includes('## Related Concepts') || content.includes('## Evidence')) {
        properlyFormatted++;
      }
    }

    assert(properlyFormatted > 0, `${properlyFormatted}/${Math.min(3, conceptFiles.length)} concepts properly formatted`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    failed++;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing v0.3.3 Features\n');
  console.log('=' .repeat(50));

  await testObsidianExport();
  await testExportQuality();
  await testContradictionDetection();

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
