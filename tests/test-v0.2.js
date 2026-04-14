#!/usr/bin/env node
/**
 * Test Suite for v0.2 Features
 * Tests metadata, deduplication, hallucination detection
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { canonicalize, findDuplicates, mergeDuplicates } from '../canonical-forms.js';
import { detectAllHallucinations } from '../hallucination-detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_GRAPH = path.join(__dirname, '..', 'neocortex', 'knowledge-graph.json');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ ${message}`);
    testsFailed++;
  }
}

async function testMetadata() {
  console.log('\n📝 Testing v0.2 Metadata...\n');

  const data = await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8');
  const graph = JSON.parse(data);

  // Test 1: Graph version
  assert(graph.version === '2.0.0', 'Graph version is 2.0.0');

  // Test 2: All nodes have extractionType
  let nodesWithExtraction = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.extractionType) nodesWithExtraction++;
  }
  assert(
    nodesWithExtraction === Object.keys(graph.nodes).length,
    `All ${Object.keys(graph.nodes).length} nodes have extractionType`
  );

  // Test 3: All nodes have confidence
  let nodesWithConfidence = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.confidence !== undefined) nodesWithConfidence++;
  }
  assert(
    nodesWithConfidence === Object.keys(graph.nodes).length,
    `All nodes have confidence scores`
  );

  // Test 4: Confidence range is valid (0-1)
  let invalidConfidence = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.confidence < 0 || node.confidence > 1) invalidConfidence++;
  }
  assert(invalidConfidence === 0, 'All confidence scores are in valid range (0-1)');

  // Test 5: All nodes have rationale
  let nodesWithRationale = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.rationale) nodesWithRationale++;
  }
  assert(
    nodesWithRationale === Object.keys(graph.nodes).length,
    'All nodes have rationale'
  );

  // Test 6: All nodes have canonicalForm
  let nodesWithCanonical = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.canonicalForm) nodesWithCanonical++;
  }
  assert(
    nodesWithCanonical === Object.keys(graph.nodes).length,
    'All nodes have canonicalForm'
  );

  // Test 7: All edges have extractionType
  let edgesWithExtraction = 0;
  for (const edge of Object.values(graph.edges)) {
    if (edge.extractionType) edgesWithExtraction++;
  }
  assert(
    edgesWithExtraction === Object.keys(graph.edges).length,
    `All ${Object.keys(graph.edges).length} edges have extractionType`
  );

  // Test 8: All edges have sentiment
  let edgesWithSentiment = 0;
  for (const edge of Object.values(graph.edges)) {
    if (edge.sentiment) edgesWithSentiment++;
  }
  assert(
    edgesWithSentiment === Object.keys(graph.edges).length,
    'All edges have sentiment'
  );

  // Test 9: Valid sentiment values
  let invalidSentiment = 0;
  for (const edge of Object.values(graph.edges)) {
    if (!['positive', 'negative', 'neutral'].includes(edge.sentiment)) {
      invalidSentiment++;
    }
  }
  assert(invalidSentiment === 0, 'All sentiments are valid (positive/negative/neutral)');
}

async function testCanonicalForms() {
  console.log('\n🔗 Testing Canonical Forms...\n');

  // Test 1: Canonicalize function
  assert(canonicalize('FastAPI') === 'fastapi', 'canonicalize("FastAPI") === "fastapi"');
  assert(canonicalize('fast-api') === 'fastapi', 'canonicalize("fast-api") === "fastapi"');
  assert(canonicalize('config.json') === 'configjson', 'canonicalize("config.json") === "configjson"');
  assert(canonicalize('Python 3.11') === 'python311', 'canonicalize("Python 3.11") === "python311"');

  // Test 2: Find duplicates
  const mockGraph = {
    nodes: {
      'fastapi': { name: 'FastAPI', canonicalForm: 'fastapi' },
      'fast-api': { name: 'fast-api', canonicalForm: 'fastapi' },
      'python': { name: 'Python', canonicalForm: 'python' }
    }
  };

  const duplicates = findDuplicates(mockGraph);
  assert(duplicates.length > 0, 'Duplicate detection works');

  // Test 3: Merge duplicates
  const testGraph = {
    nodes: {
      'fastapi': {
        name: 'FastAPI',
        weight: 0.8,
        activations: 10,
        evidenceEvents: ['e1'],
        sources: ['s1'],
        aliases: []
      },
      'fast-api': {
        name: 'fast-api',
        weight: 0.6,
        activations: 5,
        evidenceEvents: ['e2'],
        sources: ['s2'],
        aliases: []
      }
    },
    edges: {
      'python→fast-api': { source: 'python', target: 'fast-api' }
    },
    statistics: { totalNodes: 2 }
  };

  const result = mergeDuplicates(testGraph, 'fastapi', ['fast-api']);

  assert(result.totalActivations === 15, 'Activations merged correctly (10 + 5 = 15)');
  assert(result.evidenceCount === 2, 'Evidence merged correctly (2 events)');
  assert(!testGraph.nodes['fast-api'], 'Duplicate node removed');

  // Edge should be updated (check if it still exists with old or new key)
  const edgeExists = testGraph.edges['python→fastapi'] || testGraph.edges['python→fast-api'];
  assert(edgeExists !== undefined, 'Edge still exists after merge');
  if (edgeExists) {
    assert(edgeExists.target === 'fastapi', 'Edge target updated to canonical');
  }
}

async function testHallucinationDetection() {
  console.log('\n🔍 Testing Hallucination Detection...\n');

  const mockGraph = {
    nodes: {
      'hallucination': {
        name: 'Hallucination',
        extractionType: 'INFERRED',
        confidence: 0.3,
        evidenceEvents: [],
        flags: []
      },
      'real_node': {
        name: 'Real Node',
        extractionType: 'EXTRACTED',
        confidence: 0.95,
        evidenceEvents: ['e1', 'e2'],
        flags: []
      },
      'unused_code': {
        name: 'Unused Code',
        codeSource: { exists: true, foundIn: ['file.js'] },
        experienceSource: { activations: 0 },
        flags: []
      }
    },
    edges: {
      'broken→edge': {
        source: 'broken',
        target: 'edge',
        extractionType: 'INFERRED',
        confidence: 0.2,
        evidenceEvents: [],
        flags: []
      }
    }
  };

  const detections = detectAllHallucinations(mockGraph);

  assert(detections.total > 0, 'Hallucination detection finds issues');
  assert(
    detections.nodes.some(n => n.nodeId === 'hallucination'),
    'Detects potential hallucination (INFERRED + no evidence + low confidence)'
  );
  assert(
    detections.nodes.some(n => n.nodeId === 'unused_code'),
    'Detects unused imports (code exists but never used)'
  );
  assert(
    detections.edges.some(e => e.edgeId === 'broken→edge'),
    'Detects broken references'
  );
}

async function testBackwardCompatibility() {
  console.log('\n🔄 Testing Backward Compatibility...\n');

  const data = await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8');
  const graph = JSON.parse(data);

  // Test that all v0.1 fields are still present
  const firstNode = Object.values(graph.nodes)[0];

  assert(firstNode.id !== undefined, 'Node has id (v0.1 field)');
  assert(firstNode.weight !== undefined, 'Node has weight (v0.1 field)');
  assert(firstNode.activations !== undefined, 'Node has activations (v0.1 field)');
  assert(firstNode.sources !== undefined, 'Node has sources (v0.1 field)');

  const firstEdge = Object.values(graph.edges)[0];

  assert(firstEdge.source !== undefined, 'Edge has source (v0.1 field)');
  assert(firstEdge.target !== undefined, 'Edge has target (v0.1 field)');
  assert(firstEdge.weight !== undefined, 'Edge has weight (v0.1 field)');
  assert(firstEdge.coActivations !== undefined, 'Edge has coActivations (v0.1 field)');
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🧪 OpenClaw Memory v0.2 Test Suite  ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    await testMetadata();
    await testCanonicalForms();
    await testHallucinationDetection();
    await testBackwardCompatibility();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  📊 Test Results                      ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📊 Total: ${testsPassed + testsFailed}`);
    console.log('');

    if (testsFailed === 0) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
