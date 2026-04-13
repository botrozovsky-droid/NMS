#!/usr/bin/env node
/**
 * Contradiction Detector - v0.3.3
 *
 * Detects contradictions between facts in knowledge graph.
 * Uses Gemini API to analyze semantic conflicts and temporal inconsistencies.
 *
 * Features:
 * - Semantic contradiction detection
 * - Temporal validation (old vs new facts)
 * - Confidence downgrade on conflicts
 * - Auto-flagging of conflicting nodes
 * - Resolution strategies (prefer_newer, prefer_higher_confidence, needs_review)
 *
 * Usage:
 *   node contradiction-detector.js [--fix]
 *   npm run check:contradictions
 *   npm run fix:contradictions
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { loadJSON, saveJSON } from './lib/json-store.js';
import { analyzeWithGemini } from './lib/consolidation-core.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_GRAPH = path.join(__dirname, 'neocortex', 'knowledge-graph.json');
const CONTRADICTION_REPORT = path.join(__dirname, 'neocortex', 'contradictions.json');

/**
 * Build prompt for contradiction detection
 */
function buildContradictionPrompt(facts) {
  return `You are a logical consistency checker. Analyze these facts for contradictions.

FACTS (JSON):
${JSON.stringify(facts, null, 2)}

INSTRUCTIONS:
1. Identify semantic contradictions (facts that cannot both be true)
2. Identify temporal inconsistencies (old fact conflicts with new fact)
3. For each contradiction, provide:
   - fact1_id: ID of first fact
   - fact2_id: ID of second fact
   - severity: 0.0-1.0 (1.0 = direct contradiction, 0.5 = weak conflict)
   - explanation: WHY they contradict
   - resolution: "prefer_newer" | "prefer_higher_confidence" | "needs_review"

EXAMPLES of contradictions:
- "User prefers Python" vs "User prefers JavaScript" (mutually exclusive preferences)
- "FastAPI is slow" vs "FastAPI is fast" (opposite evaluations)
- "Project uses React" (2025) vs "Project uses Vue" (2026) (temporal change)

EXAMPLES of NOT contradictions:
- "User knows Python" + "User knows JavaScript" (both can be true)
- "FastAPI is good for APIs" + "Django is good for web apps" (different contexts)

Respond with ONLY valid JSON:
{
  "contradictions": [
    {
      "fact1_id": "fact_123",
      "fact2_id": "fact_456",
      "severity": 0.9,
      "explanation": "Both facts claim exclusive preference, but for different languages",
      "resolution": "prefer_newer",
      "confidence": 0.95
    }
  ]
}

If NO contradictions found, return: {"contradictions": []}

DO NOT include markdown, explanations, or anything except pure JSON.`;
}

/**
 * Extract facts from knowledge graph
 */
function extractFacts(graph) {
  const facts = [];

  // 1. Explicit facts from graph.facts array
  if (graph.facts && Array.isArray(graph.facts)) {
    graph.facts.forEach(fact => {
      facts.push({
        id: fact.id || `fact_${facts.length}`,
        type: 'explicit_fact',
        statement: fact.statement,
        confidence: fact.confidence || 0.7,
        extractionType: fact.extraction_type || fact.extractionType || 'UNKNOWN',
        evidence: fact.evidence || '',
        created: fact.created || Date.now(),
        source: 'graph.facts'
      });
    });
  }

  // 2. Implicit facts from high-confidence nodes
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.confidence && node.confidence > 0.8 && node.rationale) {
      facts.push({
        id: `node_${nodeId}`,
        type: 'implicit_fact',
        statement: `"${node.name}" is a ${node.type}`,
        confidence: node.confidence,
        extractionType: node.extractionType || 'UNKNOWN',
        evidence: node.rationale,
        created: node.created,
        source: `node:${nodeId}`,
        nodeId: nodeId
      });
    }
  }

  // 3. Relationship facts from edges
  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (edge.confidence && edge.confidence > 0.8) {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode && targetNode) {
        facts.push({
          id: `edge_${edgeId}`,
          type: 'relationship_fact',
          statement: `"${sourceNode.name}" ${edge.type} "${targetNode.name}"`,
          confidence: edge.confidence,
          extractionType: edge.extractionType || 'UNKNOWN',
          evidence: edge.rationale || '',
          sentiment: edge.sentiment || 'neutral',
          created: edge.created,
          source: `edge:${edgeId}`,
          edgeId: edgeId
        });
      }
    }
  }

  return facts;
}

/**
 * Detect contradictions using Gemini
 */
async function detectContradictions(facts) {
  console.log(`\n🔍 Analyzing ${facts.length} facts for contradictions...`);

  if (facts.length === 0) {
    console.log('   No facts to analyze.');
    return { contradictions: [] };
  }

  // Split into batches (max 50 facts per batch for Gemini)
  const batchSize = 50;
  const allContradictions = [];

  for (let i = 0; i < facts.length; i += batchSize) {
    const batch = facts.slice(i, Math.min(i + batchSize, facts.length));
    console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(facts.length / batchSize)}...`);

    const prompt = buildContradictionPrompt(batch);

    try {
      // Pass empty array as episodes since we're using custom prompt with facts
      const result = await analyzeWithGemini([], {
        prompt,
        temperature: 0.2, // Low temperature for logical consistency
        maxOutputTokens: 2048,
        timeout: 30000
      });

      if (result && result.contradictions) {
        allContradictions.push(...result.contradictions);
        console.log(`   ✅ Found ${result.contradictions.length} contradiction(s) in batch`);
      }
    } catch (error) {
      console.error(`   ⚠️  Batch analysis failed:`, error.message);
    }
  }

  return { contradictions: allContradictions };
}

/**
 * Apply resolution strategy to contradictions
 */
function resolveContradictions(contradictions, facts, graph) {
  const resolutions = [];

  for (const contradiction of contradictions) {
    const fact1 = facts.find(f => f.id === contradiction.fact1_id);
    const fact2 = facts.find(f => f.id === contradiction.fact2_id);

    if (!fact1 || !fact2) {
      console.warn(`⚠️  Cannot resolve: facts not found`);
      continue;
    }

    let resolution = { ...contradiction, action: 'no_action' };

    switch (contradiction.resolution) {
      case 'prefer_newer':
        // Keep newer fact, downgrade older
        if (fact1.created > fact2.created) {
          resolution.action = 'downgrade_fact2';
          resolution.keep = fact1.id;
          resolution.downgrade = fact2.id;
        } else {
          resolution.action = 'downgrade_fact1';
          resolution.keep = fact2.id;
          resolution.downgrade = fact1.id;
        }
        break;

      case 'prefer_higher_confidence':
        // Keep higher confidence fact
        if (fact1.confidence > fact2.confidence) {
          resolution.action = 'downgrade_fact2';
          resolution.keep = fact1.id;
          resolution.downgrade = fact2.id;
        } else {
          resolution.action = 'downgrade_fact1';
          resolution.keep = fact2.id;
          resolution.downgrade = fact1.id;
        }
        break;

      case 'needs_review':
        // Flag both for human review
        resolution.action = 'flag_both';
        resolution.flagged = [fact1.id, fact2.id];
        break;

      default:
        resolution.action = 'needs_review';
    }

    resolutions.push(resolution);
  }

  return resolutions;
}

/**
 * Apply fixes to knowledge graph
 */
function applyFixes(resolutions, graph) {
  let fixed = 0;

  for (const resolution of resolutions) {
    switch (resolution.action) {
      case 'downgrade_fact1':
      case 'downgrade_fact2':
        const downgradeId = resolution.downgrade;

        // Find source (node or edge) and downgrade confidence
        if (downgradeId.startsWith('node_')) {
          const nodeId = downgradeId.replace('node_', '');
          const node = graph.nodes[nodeId];
          if (node) {
            node.confidence = Math.max(0.3, node.confidence - 0.2);
            node.flags = node.flags || [];
            if (!node.flags.includes('contradicted')) {
              node.flags.push('contradicted');
            }
            fixed++;
          }
        } else if (downgradeId.startsWith('edge_')) {
          const edgeId = downgradeId.replace('edge_', '');
          const edge = graph.edges[edgeId];
          if (edge) {
            edge.confidence = Math.max(0.3, edge.confidence - 0.2);
            edge.flags = edge.flags || [];
            if (!edge.flags.includes('contradicted')) {
              edge.flags.push('contradicted');
            }
            fixed++;
          }
        }
        break;

      case 'flag_both':
        resolution.flagged.forEach(factId => {
          if (factId.startsWith('node_')) {
            const nodeId = factId.replace('node_', '');
            const node = graph.nodes[nodeId];
            if (node) {
              node.flags = node.flags || [];
              if (!node.flags.includes('needs_review')) {
                node.flags.push('needs_review');
              }
              fixed++;
            }
          } else if (factId.startsWith('edge_')) {
            const edgeId = factId.replace('edge_', '');
            const edge = graph.edges[edgeId];
            if (edge) {
              edge.flags = edge.flags || [];
              if (!edge.flags.includes('needs_review')) {
                edge.flags.push('needs_review');
              }
              fixed++;
            }
          }
        });
        break;
    }
  }

  return fixed;
}

/**
 * Main contradiction detection process
 */
async function checkContradictions(options = {}) {
  console.log('\n🔍 Contradiction Detector v0.3.3');
  const startTime = Date.now();

  // Load knowledge graph
  const graph = await loadJSON(KNOWLEDGE_GRAPH);

  if (!graph || !graph.nodes) {
    console.error('❌ Failed to load knowledge graph');
    return;
  }

  console.log(`   Loaded graph: ${graph.statistics.totalNodes} nodes, ${graph.statistics.totalEdges} edges`);

  // Extract facts
  const facts = extractFacts(graph);
  console.log(`   Extracted: ${facts.length} facts`);

  if (facts.length === 0) {
    console.log('✅ No facts to analyze.');
    return;
  }

  // Detect contradictions
  const result = await detectContradictions(facts);

  if (result.contradictions.length === 0) {
    console.log('\n✅ No contradictions detected!');
    console.log(`   All ${facts.length} facts are consistent.`);
    return;
  }

  console.log(`\n⚠️  Found ${result.contradictions.length} contradiction(s)`);

  // Resolve contradictions
  const resolutions = resolveContradictions(result.contradictions, facts, graph);

  // Display contradictions
  console.log('\n📋 Contradictions:\n');
  resolutions.forEach((res, i) => {
    const fact1 = facts.find(f => f.id === res.fact1_id);
    const fact2 = facts.find(f => f.id === res.fact2_id);

    console.log(`${i + 1}. Severity: ${res.severity.toFixed(2)}`);
    console.log(`   Fact 1: "${fact1?.statement}" (confidence: ${fact1?.confidence.toFixed(2)})`);
    console.log(`   Fact 2: "${fact2?.statement}" (confidence: ${fact2?.confidence.toFixed(2)})`);
    console.log(`   Explanation: ${res.explanation}`);
    console.log(`   Resolution: ${res.resolution} → ${res.action}`);
    console.log('');
  });

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalFacts: facts.length,
    contradictionsFound: result.contradictions.length,
    contradictions: resolutions,
    facts: facts
  };

  await saveJSON(CONTRADICTION_REPORT, report);
  console.log(`📄 Report saved: ${CONTRADICTION_REPORT}`);

  // Apply fixes if requested
  if (options.fix) {
    console.log('\n🔧 Applying fixes...');
    const fixed = applyFixes(resolutions, graph);

    graph.lastUpdated = new Date().toISOString();
    await saveJSON(KNOWLEDGE_GRAPH, graph);

    console.log(`✅ Fixed ${fixed} fact(s)`);
  } else {
    console.log('\n💡 Run with --fix flag to apply resolutions automatically.');
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Detection complete! (${duration}s)`);
}

// CLI execution
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const options = {
    fix: process.argv.includes('--fix')
  };

  checkContradictions(options).catch(error => {
    console.error('❌ Contradiction detection failed:', error);
    process.exit(1);
  });
}

export { checkContradictions, detectContradictions, extractFacts };
