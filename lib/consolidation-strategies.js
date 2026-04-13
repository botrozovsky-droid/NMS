/**
 * Consolidation Strategies - v0.3.1
 *
 * Strategy Pattern implementation for different consolidation behaviors.
 *
 * NightlyStrategy: Full batch processing with decay and pruning
 * SessionEndStrategy: Quick top-20 processing without decay
 */

import path from 'path';
import * as core from './consolidation-core.js';
import { loadJSON } from './json-store.js';

/**
 * Nightly Consolidation Strategy
 * Full processing with decay and pruning
 */
export const NightlyStrategy = {
  name: 'nightly',

  /**
   * Select candidates for consolidation
   * Filters by importance and recency thresholds
   */
  async selectCandidates(candidatesData, params) {
    const now = Date.now();
    const consolidationParams = params.parameters.consolidation;

    return candidatesData.candidates.filter(c =>
      c.importance >= consolidationParams.minImportance &&
      (now - c.timestamp) >= consolidationParams.minRecency
    );
  },

  /**
   * Process batch of episodes with full Gemini analysis
   */
  async processBatch(episodes, graph, params, paths) {
    // Analyze with Gemini (detailed prompt)
    const analysis = await core.analyzeWithGemini(episodes, {
      temperature: 0.3,
      maxOutputTokens: 8192,
      timeout: 60000
    });

    if (!analysis) {
      console.log('⚠️  Analysis failed, skipping batch');
      return { newNodes: 0, updatedNodes: 0, newEdges: 0 };
    }

    const now = Date.now();
    const hebbianParams = params.parameters.hebbian;
    let newNodes = 0, updatedNodes = 0, newEdges = 0;

    // Process concepts
    for (const concept of analysis.concepts || []) {
      const nodeId = concept.canonical_form || concept.name.toLowerCase().replace(/\s+/g, '_');
      const episodeIds = episodes.map(e => e.id);

      if (!graph.nodes[nodeId]) {
        // Create new node
        graph.nodes[nodeId] = core.createNode(concept, episodeIds, now);
        core.autoFlagNode(graph.nodes[nodeId], episodes);

        // Generate embedding
        try {
          const { embedNode } = await import('../semantic-search.js');
          graph.nodes[nodeId].embedding = await embedNode(graph.nodes[nodeId]);
          console.log(`  📊 Embedded node: ${nodeId}`);
        } catch (error) {
          console.error(`  ❌ Failed to embed node ${nodeId}:`, error.message);
          graph.nodes[nodeId].embedding = null;
        }

        newNodes++;
        graph.statistics.totalNodes++;
      } else {
        // Update existing node
        core.updateNode(graph.nodes[nodeId], concept, hebbianParams, now);

        // Update evidence
        if (graph.nodes[nodeId].evidenceEvents) {
          graph.nodes[nodeId].evidenceEvents.push(...episodeIds);
        }
        if (graph.nodes[nodeId].sources) {
          graph.nodes[nodeId].sources.push(...episodeIds);
        }

        updatedNodes++;
      }
    }

    // Process relationships
    for (const rel of analysis.relationships || []) {
      const sourceId = rel.canonical_source || rel.source.toLowerCase().replace(/\s+/g, '_');
      const targetId = rel.canonical_target || rel.target.toLowerCase().replace(/\s+/g, '_');
      const edgeId = `${sourceId}→${targetId}`;
      const episodeIds = episodes.map(e => e.id);

      if (!graph.edges[edgeId]) {
        // Create new edge
        graph.edges[edgeId] = core.createEdge(rel, episodeIds, now);
        core.autoFlagEdge(graph.edges[edgeId], episodes);

        newEdges++;
        graph.statistics.totalEdges++;
      } else {
        // Update existing edge
        core.updateEdge(graph.edges[edgeId], rel, hebbianParams, now);

        // Update evidence
        if (graph.edges[edgeId].evidenceEvents) {
          graph.edges[edgeId].evidenceEvents.push(...episodeIds);
        }
      }
    }

    return { newNodes, updatedNodes, newEdges };
  },

  /**
   * Post-processing: Apply decay and pruning
   */
  async postProcess(graph, params) {
    const now = Date.now();
    const hebbianParams = params.parameters.hebbian;

    console.log('\n🧹 Applying temporal decay...');
    const decayStats = core.applyDecay(graph, hebbianParams, now);

    console.log('🗑️  Pruning weak connections...');
    const pruneStats = core.pruneWeakConnections(graph, hebbianParams);

    return { ...decayStats, ...pruneStats };
  },

  /**
   * Batch configuration
   */
  getBatchSize(params) {
    return params.parameters.consolidation.batchSize;
  }
};

/**
 * Session-End Mini-Consolidation Strategy
 * Quick processing of top events, no decay/pruning
 */
export const SessionEndStrategy = {
  name: 'session-end',

  /**
   * Select top events from session
   * Top 20 by importance only
   */
  async selectCandidates(session, params) {
    // Get top 20 important events
    const topEvents = session.importantEvents
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20);

    console.log(`📊 Processing ${topEvents.length} top events`);
    return topEvents;
  },

  /**
   * Process events with quick Gemini analysis
   * Marks nodes with consolidationType='mini'
   */
  async processBatch(episodes, graph, params, paths) {
    // Quick analysis with simplified prompt
    const analysis = await core.analyzeWithGemini(episodes, {
      prompt: buildQuickPrompt(episodes),
      temperature: 0.2,
      maxOutputTokens: 2048,
      timeout: 30000
    });

    if (!analysis || !analysis.concepts) {
      console.log('⚠️  No analysis returned, skipping consolidation');
      return { newNodes: 0, updatedNodes: 0, newEdges: 0 };
    }

    const now = Date.now();
    const hebbianParams = params.parameters.hebbian;
    let newNodes = 0, updatedNodes = 0, newEdges = 0;

    // Process concepts (with mini marker)
    for (const concept of analysis.concepts || []) {
      const nodeId = concept.canonical_form || concept.name.toLowerCase().replace(/\s+/g, '_');
      const episodeIds = episodes.map(e => e.id);

      if (!graph.nodes[nodeId]) {
        // Create new node with mini consolidation marker
        graph.nodes[nodeId] = core.createNode(concept, episodeIds, now, {
          consolidationType: 'mini',
          miniConsolidationSession: paths.sessionId
        });

        // Generate embedding
        try {
          const { embedNode } = await import('../semantic-search.js');
          graph.nodes[nodeId].embedding = await embedNode(graph.nodes[nodeId]);
        } catch (error) {
          console.error(`❌ Failed to embed node ${nodeId}:`, error.message);
          graph.nodes[nodeId].embedding = null;
        }

        newNodes++;
        graph.statistics.totalNodes++;
      } else {
        // Update existing node
        core.updateNode(graph.nodes[nodeId], concept, hebbianParams, now);

        // Upgrade consolidation type
        if (graph.nodes[nodeId].consolidationType === 'mini') {
          graph.nodes[nodeId].consolidationType = 'both';
        }

        updatedNodes++;
      }
    }

    // Process relationships (validate nodes exist first)
    for (const rel of analysis.relationships || []) {
      const sourceId = rel.canonical_source || rel.source.toLowerCase().replace(/\s+/g, '_');
      const targetId = rel.canonical_target || rel.target.toLowerCase().replace(/\s+/g, '_');

      // Only create edge if both nodes exist (mini-consolidate validation)
      if (!graph.nodes[sourceId] || !graph.nodes[targetId]) {
        continue;
      }

      const edgeId = `${sourceId}→${targetId}`;
      const episodeIds = episodes.map(e => e.id);

      if (!graph.edges[edgeId]) {
        // Create new edge with mini marker
        graph.edges[edgeId] = core.createEdge(rel, episodeIds, now, {
          consolidationType: 'mini'
        });

        newEdges++;
        graph.statistics.totalEdges++;
      }
    }

    return { newNodes, updatedNodes, newEdges };
  },

  /**
   * Post-processing: Skip decay/pruning (preserve discoveries)
   */
  async postProcess(graph, params) {
    // No decay or pruning for mini-consolidation
    return { prunedNodes: 0, prunedEdges: 0 };
  },

  /**
   * No batching for session-end (process all at once)
   */
  getBatchSize(params) {
    return Infinity;
  }
};

/**
 * Build simplified prompt for quick analysis
 */
function buildQuickPrompt(events) {
  return `Extract key concepts from these events. Be concise and confident.

Events: ${JSON.stringify(events.slice(0, 20), null, 2)}

Respond with ONLY JSON:
{
  "concepts": [
    {
      "name": "concept name",
      "type": "concept_type",
      "importance": 0.8,
      "extraction_type": "EXTRACTED",
      "confidence": 0.9,
      "rationale": "why this matters",
      "canonical_form": "canonicalname",
      "aliases": []
    }
  ],
  "relationships": [
    {
      "source": "source",
      "target": "target",
      "type": "relation_type",
      "strength": 0.8,
      "extraction_type": "EXTRACTED",
      "confidence": 0.9,
      "rationale": "why connected",
      "sentiment": "positive",
      "canonical_source": "canonicalsource",
      "canonical_target": "canonicaltarget"
    }
  ]
}`;
}
