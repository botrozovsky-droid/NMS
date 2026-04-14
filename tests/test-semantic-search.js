#!/usr/bin/env node
/**
 * Test Suite for Semantic Search (v0.3)
 * Tests embedding generation, vector search, and hybrid search
 */

import assert from 'assert';
import {
  generateEmbedding,
  embedNode,
  cosineSimilarity,
  VectorIndex,
  buildIndexFromGraph,
  semanticSearch,
  hybridSearch,
  getCacheStats
} from './semantic-search.js';

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

console.log('🧪 Running Semantic Search Tests (v0.3)...\n');

// Test 1: Embedding generation
await asyncTest('Embedding generation works', async () => {
  const embedding = await generateEmbedding('FastAPI web framework');
  assert(Array.isArray(embedding), 'Embedding should be an array');
  assert.strictEqual(embedding.length, 3072, 'Embedding should have 3072 dimensions');
  assert(embedding.every(v => typeof v === 'number'), 'All values should be numbers');
});

// Test 2: Embedding caching
await asyncTest('Embedding caching works', async () => {
  const text = 'test cache string';
  const emb1 = await generateEmbedding(text);
  const emb2 = await generateEmbedding(text);

  assert.deepStrictEqual(emb1, emb2, 'Cached embeddings should be identical');

  const stats = getCacheStats();
  assert(stats.size > 0, 'Cache should have entries');
});

// Test 3: Node embedding
await asyncTest('Node embedding works', async () => {
  const node = {
    name: 'Python',
    type: 'programming_language',
    rationale: 'User uses Python for development',
    aliases: ['python3', 'py']
  };

  const embedding = await embedNode(node);
  assert(Array.isArray(embedding), 'Node embedding should be an array');
  assert.strictEqual(embedding.length, 3072, 'Node embedding should have 3072 dimensions');
});

// Test 4: Cosine similarity
test('Cosine similarity calculation', () => {
  const vec1 = [1, 0, 0];
  const vec2 = [1, 0, 0];
  const vec3 = [0, 1, 0];

  const sim1 = cosineSimilarity(vec1, vec2);
  const sim2 = cosineSimilarity(vec1, vec3);

  assert.strictEqual(sim1, 1.0, 'Identical vectors should have similarity 1.0');
  assert.strictEqual(sim2, 0, 'Orthogonal vectors should have similarity 0');
});

// Test 5: Vector index creation
test('VectorIndex creation and basic operations', () => {
  const index = new VectorIndex();

  assert.strictEqual(index.size, 0, 'New index should be empty');

  index.addVector('node1', [1, 0, 0], { name: 'Node 1' });
  index.addVector('node2', [0, 1, 0], { name: 'Node 2' });

  assert.strictEqual(index.size, 2, 'Index should have 2 vectors');
});

// Test 6: Vector search
test('VectorIndex search works', () => {
  const index = new VectorIndex();

  index.addVector('python', [1, 0, 0], { name: 'Python', type: 'language' });
  index.addVector('javascript', [0.8, 0.2, 0], { name: 'JavaScript', type: 'language' });
  index.addVector('fastapi', [0.9, 0.1, 0], { name: 'FastAPI', type: 'library' });

  const results = index.search([1, 0, 0], 2);

  assert.strictEqual(results.length, 2, 'Should return 2 results');
  assert.strictEqual(results[0].nodeId, 'python', 'Top result should be python');
  assert(results[0].similarity > results[1].similarity, 'Results should be sorted by similarity');
});

// Test 7: Build index from graph
await asyncTest('Build index from knowledge graph', async () => {
  const mockGraph = {
    nodes: {
      'python': {
        name: 'Python',
        type: 'programming_language',
        rationale: 'User prefers Python',
        weight: 0.98
      },
      'fastapi': {
        name: 'FastAPI',
        type: 'library_module',
        rationale: 'Web framework',
        weight: 0.95
      }
    }
  };

  const index = await buildIndexFromGraph(mockGraph);

  assert.strictEqual(index.size, 2, 'Index should have 2 nodes');
  assert(mockGraph.nodes.python.embedding, 'Python node should have embedding');
  assert(mockGraph.nodes.fastapi.embedding, 'FastAPI node should have embedding');
});

// Test 8: Semantic search
await asyncTest('Semantic search works', async () => {
  const mockGraph = {
    nodes: {
      'python': {
        name: 'Python',
        type: 'programming_language',
        rationale: 'Programming language',
        weight: 0.98,
        embedding: null
      },
      'javascript': {
        name: 'JavaScript',
        type: 'programming_language',
        rationale: 'Programming language',
        weight: 0.95,
        embedding: null
      }
    }
  };

  const index = await buildIndexFromGraph(mockGraph);
  const results = await semanticSearch('python programming', index, 2);

  assert(results.length > 0, 'Should find results');
  assert(results[0].similarity > 0, 'Top result should have positive similarity');
});

// Test 9: Hybrid search (keyword only)
await asyncTest('Hybrid search with keyword only', async () => {
  const mockGraph = {
    nodes: {
      'python': {
        name: 'Python',
        type: 'programming_language',
        weight: 0.98,
        confidence: 1.0,
        aliases: ['python3']
      },
      'javascript': {
        name: 'JavaScript',
        type: 'programming_language',
        weight: 0.95,
        confidence: 1.0,
        aliases: ['js']
      }
    }
  };

  const index = new VectorIndex(); // Empty index
  const results = await hybridSearch('python', mockGraph, index, {
    useKeyword: true,
    useSemantic: false,
    topK: 5
  });

  assert(results.length > 0, 'Should find keyword matches');
  assert.strictEqual(results[0].nodeId, 'python', 'Should match python node');
  assert(results[0].score > 0, 'Should have positive score');
});

// Test 10: Hybrid search (semantic + keyword)
await asyncTest('Hybrid search with semantic + keyword', async () => {
  const mockGraph = {
    nodes: {
      'python': {
        name: 'Python',
        type: 'programming_language',
        rationale: 'Programming language',
        weight: 0.98,
        confidence: 1.0,
        aliases: []
      },
      'fastapi': {
        name: 'FastAPI',
        type: 'library_module',
        rationale: 'Web framework for Python',
        weight: 0.95,
        confidence: 1.0,
        aliases: []
      }
    }
  };

  const index = await buildIndexFromGraph(mockGraph);
  const results = await hybridSearch('python web framework', mockGraph, index, {
    useKeyword: true,
    useSemantic: true,
    topK: 5
  });

  assert(results.length > 0, 'Should find hybrid matches');
  assert(results.some(r => r.nodeId === 'python'), 'Should include python');
  assert(results.some(r => r.nodeId === 'fastapi'), 'Should include fastapi');
});

// Test 11: Embedding dimension consistency
await asyncTest('All embeddings have consistent dimensions', async () => {
  const texts = ['Python', 'FastAPI', 'web framework', 'REST API'];
  const embeddings = await Promise.all(texts.map(t => generateEmbedding(t)));

  const allSameDimension = embeddings.every(e => e.length === 3072);
  assert(allSameDimension, 'All embeddings should have 3072 dimensions');
});

// Test 12: Similarity scores are bounded
await asyncTest('Similarity scores are in valid range [0, 1]', async () => {
  const emb1 = await generateEmbedding('FastAPI framework');
  const emb2 = await generateEmbedding('Python library');
  const emb3 = await generateEmbedding('completely unrelated topic xyz123');

  const sim1 = cosineSimilarity(emb1, emb2);
  const sim2 = cosineSimilarity(emb1, emb3);

  assert(sim1 >= -1 && sim1 <= 1, 'Similarity should be in [-1, 1]');
  assert(sim2 >= -1 && sim2 <= 1, 'Similarity should be in [-1, 1]');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${(testsPassed / (testsPassed + testsFailed) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n✅ All semantic search tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. See details above.');
  process.exit(1);
}
