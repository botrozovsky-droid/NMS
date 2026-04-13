#!/usr/bin/env node
/**
 * Memory Manager - Core neurobiological memory system
 * Handles all memory operations: encoding, storage, retrieval
 */

import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { hybridSearch, buildIndexFromGraph } from './semantic-search.js';
import { getGraphTransactionManager } from './transaction-manager.js';
import { loadJSON, saveJSON } from './lib/json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const HIPPOCAMPUS_DIR = path.join(__dirname, 'hippocampus');
const NEOCORTEX_DIR = path.join(__dirname, 'neocortex');
const PROCEDURAL_DIR = path.join(__dirname, 'procedural');
const META_DIR = path.join(__dirname, 'meta');

const DAILY_INDEX = path.join(HIPPOCAMPUS_DIR, 'daily-index.json');
const SYNAPTIC_CANDIDATES = path.join(HIPPOCAMPUS_DIR, 'synaptic-candidates.json');
const KNOWLEDGE_GRAPH = path.join(NEOCORTEX_DIR, 'knowledge-graph.json');
const ACTION_PATTERNS = path.join(PROCEDURAL_DIR, 'action-patterns.json');
const PREFERENCES = path.join(PROCEDURAL_DIR, 'preferences.json');
const LEARNING_PARAMS = path.join(META_DIR, 'learning-params.json');

/**
 * Synaptic Connection class - Hebbian learning implementation
 */
class Synapse {
  constructor(source, target, weight = 0.1) {
    this.id = crypto.randomUUID();
    this.source = source;
    this.target = target;
    this.weight = weight;
    this.coActivationCount = 0;
    this.lastActivation = Date.now();
    this.created = Date.now();
  }

  /**
   * Strengthen connection (Hebbian: "neurons that fire together, wire together")
   */
  strengthen(learningRate = 0.1) {
    this.weight = Math.min(1.0, this.weight + learningRate);
    this.coActivationCount++;
    this.lastActivation = Date.now();
  }

  /**
   * Temporal decay (forgetting curve)
   */
  decay(halfLife = 30 * 24 * 3600000) { // 30 days default
    const timeSince = Date.now() - this.lastActivation;
    this.weight *= Math.exp(-Math.log(2) * timeSince / halfLife);
    if (this.weight < 0.01) this.weight = 0; // Prune weak connections
  }

  /**
   * Calculate importance based on weight and recency
   */
  importance() {
    const recencyFactor = 1 / (1 + (Date.now() - this.lastActivation) / (7 * 24 * 3600000));
    return this.weight * recencyFactor * Math.log(this.coActivationCount + 1);
  }

  toJSON() {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      weight: this.weight,
      coActivationCount: this.coActivationCount,
      lastActivation: this.lastActivation,
      created: this.created
    };
  }
}

/**
 * Memory Manager class
 */
class MemoryManager {
  constructor() {
    this.params = null;
    this.vectorIndex = null;
    this.indexLastBuilt = null;
  }

  /**
   * Initialize memory system
   */
  async initialize() {
    this.params = await loadJSON(LEARNING_PARAMS);
    console.log('🧠 Memory system initialized');

    // Build vector index for semantic search
    await this.rebuildVectorIndex();
  }

  /**
   * Rebuild vector index from knowledge graph
   */
  async rebuildVectorIndex() {
    try {
      const graph = await loadJSON(KNOWLEDGE_GRAPH);
      if (!graph || !graph.nodes) {
        console.log('⚠️ No knowledge graph found, skipping index build');
        return;
      }

      console.log('🔨 Building vector index...');
      this.vectorIndex = await buildIndexFromGraph(graph);
      this.indexLastBuilt = Date.now();

      // Save updated graph with embeddings
      await saveJSON(KNOWLEDGE_GRAPH, graph);

      console.log(`✅ Vector index built: ${this.vectorIndex.size} nodes indexed`);
    } catch (error) {
      console.error('❌ Failed to build vector index:', error.message);
      this.vectorIndex = null;
    }
  }

  /**
   * Encode episodic memory (sensory buffer → hippocampus)
   */
  async encodeEpisode(sessionId, event) {
    const timestamp = Date.now();
    const dateKey = new Date(timestamp).toISOString().split('T')[0];

    // Calculate importance using attention mechanism
    const importance = this.calculateImportance(event);

    // Create episodic memory
    const episode = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp,
      dateKey,
      importance,
      event,
      consolidated: false
    };

    // Save to hippocampus session file
    const sessionFile = path.join(HIPPOCAMPUS_DIR, 'sessions', `${sessionId}.json`);
    let sessionData = await loadJSON(sessionFile) || { episodes: [] };
    sessionData.episodes = sessionData.episodes || [];
    sessionData.episodes.push(episode);
    await saveJSON(sessionFile, sessionData);

    // Update daily index
    await this.updateDailyIndex(dateKey, sessionId, episode.id);

    // Add to consolidation candidates if important
    if (importance >= this.params.parameters.consolidation.minImportance) {
      await this.addConsolidationCandidate(episode);
    }

    console.log(`📝 Encoded episode ${episode.id} (importance: ${importance.toFixed(2)})`);
    return episode;
  }

  /**
   * Calculate importance using attention mechanism
   */
  calculateImportance(event) {
    const weights = this.params.parameters.attention;
    let importance = 0;

    // Error events are highly important
    if (event.type === 'error' || event.hasError) {
      importance += weights.errorWeight;
    }

    // User mentions and explicit instructions
    if (event.userMention || event.explicitInstruction) {
      importance += weights.userMentionWeight;
    }

    // File edits and code changes
    if (event.filesModified && event.filesModified.length > 0) {
      importance += weights.fileEditWeight * Math.min(event.filesModified.length, 5) / 5;
    }

    // Code execution and tool usage
    if (event.toolCalls && event.toolCalls.length > 0) {
      importance += weights.codeExecutionWeight;
    }

    // Base conversational importance
    importance += weights.conversationWeight;

    return Math.min(importance, 10); // Cap at 10
  }

  /**
   * Update daily index
   */
  async updateDailyIndex(dateKey, sessionId, episodeId) {
    const index = await loadJSON(DAILY_INDEX);

    if (!index.indices[dateKey]) {
      index.indices[dateKey] = { sessions: {}, totalEvents: 0 };
    }

    if (!index.indices[dateKey].sessions[sessionId]) {
      index.indices[dateKey].sessions[sessionId] = [];
    }

    index.indices[dateKey].sessions[sessionId].push(episodeId);
    index.indices[dateKey].totalEvents++;
    index.statistics.totalEvents++;
    index.lastUpdated = new Date().toISOString();

    await saveJSON(DAILY_INDEX, index);
  }

  /**
   * Add candidate for consolidation
   */
  async addConsolidationCandidate(episode) {
    const candidates = await loadJSON(SYNAPTIC_CANDIDATES);
    candidates.candidates.push({
      episodeId: episode.id,
      sessionId: episode.sessionId,
      timestamp: episode.timestamp,
      importance: episode.importance,
      addedToQueue: Date.now()
    });
    candidates.statistics.totalCandidates++;
    await saveJSON(SYNAPTIC_CANDIDATES, candidates);
  }

  /**
   * Retrieve memories by query (hippocampal recall)
   */
  async recall(query, options = {}) {
    const {
      limit = 10,
      dateRange = null,
      minImportance = 0,
      sessionId = null
    } = options;

    const index = await loadJSON(DAILY_INDEX);
    const results = [];

    // Search through daily indices
    for (const [dateKey, dayData] of Object.entries(index.indices)) {
      if (dateRange && !this.isInDateRange(dateKey, dateRange)) continue;

      for (const [sid, episodeIds] of Object.entries(dayData.sessions)) {
        if (sessionId && sid !== sessionId) continue;

        const sessionFile = path.join(HIPPOCAMPUS_DIR, 'sessions', `${sid}.json`);
        const sessionData = await loadJSON(sessionFile);

        if (!sessionData) continue;

        for (const episode of sessionData.episodes) {
          if (episode.importance >= minImportance) {
            // Simple keyword matching (in production, use embeddings)
            if (this.matchesQuery(episode, query)) {
              results.push({
                ...episode,
                matchScore: episode.importance
              });
            }
          }
        }
      }
    }

    // Sort by importance and limit
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results.slice(0, limit);
  }

  /**
   * Simple keyword matching
   */
  matchesQuery(episode, query) {
    const queryLower = query.toLowerCase();
    const eventStr = JSON.stringify(episode.event).toLowerCase();
    return eventStr.includes(queryLower);
  }

  /**
   * Check if date is in range
   */
  isInDateRange(dateKey, range) {
    const date = new Date(dateKey);
    const { start, end } = range;
    return (!start || date >= new Date(start)) && (!end || date <= new Date(end));
  }

  /**
   * Query knowledge graph with semantic search (v0.3)
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async queryKnowledgeGraph(query, options = {}) {
    const {
      topK = 10,
      useKeyword = true,
      useSemantic = true,
      minConfidence = 0,
      keywordWeight = 0.4,
      semanticWeight = 0.6
    } = options;

    // Load knowledge graph
    const graph = await loadJSON(KNOWLEDGE_GRAPH);
    if (!graph || !graph.nodes) {
      return [];
    }

    // Rebuild index if needed
    if (!this.vectorIndex || !useSemantic) {
      if (useSemantic) {
        await this.rebuildVectorIndex();
      }
    }

    // Perform hybrid search
    const results = await hybridSearch(query, graph, this.vectorIndex, {
      useKeyword,
      useSemantic: useSemantic && this.vectorIndex !== null,
      topK,
      keywordWeight,
      semanticWeight
    });

    // Filter by confidence
    const filtered = results.filter(r => r.node.confidence >= minConfidence);

    return filtered.map(r => ({
      nodeId: r.nodeId,
      name: r.node.name,
      type: r.node.type,
      score: r.score,
      confidence: r.node.confidence,
      weight: r.node.weight,
      rationale: r.node.rationale,
      aliases: r.node.aliases || []
    }));
  }

  /**
   * Store procedural pattern (action learning)
   */
  async learnPattern(patternName, action, success) {
    const patterns = await loadJSON(ACTION_PATTERNS);

    if (!patterns.patterns[patternName]) {
      patterns.patterns[patternName] = {
        id: crypto.randomUUID(),
        name: patternName,
        action,
        executions: 0,
        successes: 0,
        failures: 0,
        lastUsed: null,
        weight: 0.1,
        created: Date.now()
      };
      patterns.statistics.totalPatterns++;
    }

    const pattern = patterns.patterns[patternName];
    pattern.executions++;
    pattern.lastUsed = Date.now();

    if (success) {
      pattern.successes++;
      pattern.weight = Math.min(1.0, pattern.weight + this.params.parameters.hebbian.learningRate);
    } else {
      pattern.failures++;
      pattern.weight = Math.max(0, pattern.weight - this.params.parameters.hebbian.learningRate / 2);
    }

    patterns.statistics.totalExecutions++;
    patterns.statistics.averageSuccessRate =
      Object.values(patterns.patterns).reduce((acc, p) => acc + (p.successes / p.executions), 0) /
      patterns.statistics.totalPatterns;

    await saveJSON(ACTION_PATTERNS, patterns);
    console.log(`🎯 Pattern learned: ${patternName} (weight: ${pattern.weight.toFixed(2)})`);
  }

  /**
   * Store user preference
   */
  async storePreference(key, value, confidence = 1.0) {
    const prefs = await loadJSON(PREFERENCES);

    prefs.preferences[key] = {
      value,
      confidence,
      lastUpdated: Date.now(),
      updateCount: (prefs.preferences[key]?.updateCount || 0) + 1
    };

    prefs.statistics.totalPreferences = Object.keys(prefs.preferences).length;
    prefs.statistics.totalUpdates++;
    prefs.lastUpdated = new Date().toISOString();

    await saveJSON(PREFERENCES, prefs);
    console.log(`✅ Preference stored: ${key} = ${value}`);
  }

  /**
   * Update node in knowledge graph (v0.3 - with transaction)
   * @param {string} nodeId - Node identifier
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} - Updated node
   */
  async updateNode(nodeId, updates) {
    const txManager = getGraphTransactionManager(KNOWLEDGE_GRAPH);
    await txManager.initialize();

    return await txManager.execute(async () => {
      const graph = await loadJSON(KNOWLEDGE_GRAPH);

      if (!graph || !graph.nodes) {
        throw new Error('Knowledge graph not found');
      }

      if (!graph.nodes[nodeId]) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Apply updates
      Object.assign(graph.nodes[nodeId], updates);
      graph.nodes[nodeId].lastActivation = Date.now();

      // Save graph
      await saveJSON(KNOWLEDGE_GRAPH, graph);

      console.log(`✅ Node updated: ${nodeId}`);
      return graph.nodes[nodeId];

    }, `update-node-${nodeId}`);
  }

  /**
   * Delete node from knowledge graph (v0.3 - with transaction)
   * @param {string} nodeId - Node identifier
   * @returns {Promise<object>} - Deletion result
   */
  async deleteNode(nodeId) {
    const txManager = getGraphTransactionManager(KNOWLEDGE_GRAPH);
    await txManager.initialize();

    return await txManager.execute(async () => {
      const graph = await loadJSON(KNOWLEDGE_GRAPH);

      if (!graph || !graph.nodes) {
        throw new Error('Knowledge graph not found');
      }

      if (!graph.nodes[nodeId]) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Delete node
      delete graph.nodes[nodeId];
      graph.statistics.totalNodes--;

      // Delete related edges
      let deletedEdges = 0;
      for (const [edgeId, edge] of Object.entries(graph.edges || {})) {
        if (edge.source === nodeId || edge.target === nodeId) {
          delete graph.edges[edgeId];
          deletedEdges++;
          graph.statistics.totalEdges--;
        }
      }

      // Save graph
      await saveJSON(KNOWLEDGE_GRAPH, graph);

      console.log(`✅ Node deleted: ${nodeId} (${deletedEdges} edges removed)`);

      return { nodeId, deletedEdges };

    }, `delete-node-${nodeId}`);
  }

  /**
   * Add edge to knowledge graph (v0.3 - with transaction)
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {object} edgeData - Edge properties
   * @returns {Promise<object>} - Created edge
   */
  async addEdge(sourceId, targetId, edgeData = {}) {
    const txManager = getGraphTransactionManager(KNOWLEDGE_GRAPH);
    await txManager.initialize();

    return await txManager.execute(async () => {
      const graph = await loadJSON(KNOWLEDGE_GRAPH);

      if (!graph || !graph.nodes) {
        throw new Error('Knowledge graph not found');
      }

      // Verify nodes exist
      if (!graph.nodes[sourceId]) {
        throw new Error(`Source node ${sourceId} not found`);
      }

      if (!graph.nodes[targetId]) {
        throw new Error(`Target node ${targetId} not found`);
      }

      const edgeId = `${sourceId}→${targetId}`;

      // Create or update edge
      if (!graph.edges) graph.edges = {};

      graph.edges[edgeId] = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: edgeData.type || 'related',
        weight: edgeData.weight || 0.5,
        coActivations: graph.edges[edgeId]?.coActivations + 1 || 1,
        lastActivation: Date.now(),
        created: graph.edges[edgeId]?.created || Date.now(),
        ...edgeData
      };

      if (!graph.edges[edgeId].created) {
        graph.statistics.totalEdges++;
      }

      // Save graph
      await saveJSON(KNOWLEDGE_GRAPH, graph);

      console.log(`✅ Edge created/updated: ${edgeId}`);

      return graph.edges[edgeId];

    }, `add-edge-${sourceId}-${targetId}`);
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const index = await loadJSON(DAILY_INDEX);
    const graph = await loadJSON(KNOWLEDGE_GRAPH);
    const patterns = await loadJSON(ACTION_PATTERNS);
    const prefs = await loadJSON(PREFERENCES);
    const candidates = await loadJSON(SYNAPTIC_CANDIDATES);

    return {
      hippocampus: {
        totalEvents: index.statistics.totalEvents,
        totalSessions: index.statistics.totalSessions,
        pendingConsolidation: candidates.candidates.length
      },
      neocortex: {
        totalNodes: graph.statistics.totalNodes,
        totalEdges: graph.statistics.totalEdges,
        totalClusters: graph.statistics.totalClusters
      },
      procedural: {
        totalPatterns: patterns.statistics.totalPatterns,
        averageSuccessRate: patterns.statistics.averageSuccessRate,
        totalPreferences: prefs.statistics.totalPreferences
      }
    };
  }
}

// Export singleton
const memoryManager = new MemoryManager();
export default memoryManager;

// CLI interface
const isMainModule = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  const command = process.argv[2];

  await memoryManager.initialize();

  switch (command) {
    case 'stats':
      const stats = await memoryManager.getStatistics();
      console.log(JSON.stringify(stats, null, 2));
      break;

    case 'recall':
      const query = process.argv[3];
      const results = await memoryManager.recall(query);
      console.log(JSON.stringify(results, null, 2));
      break;

    case 'query':
      const searchQuery = process.argv[3];
      if (!searchQuery) {
        console.log('Usage: memory-manager.js query <search-term>');
        process.exit(1);
      }
      const searchResults = await memoryManager.queryKnowledgeGraph(searchQuery);
      console.log('🔍 Search results:');
      searchResults.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.name} (${r.type})`);
        console.log(`   Score: ${r.score.toFixed(3)} | Confidence: ${r.confidence.toFixed(2)} | Weight: ${r.weight.toFixed(2)}`);
        console.log(`   Rationale: ${r.rationale}`);
        if (r.aliases.length > 0) {
          console.log(`   Aliases: ${r.aliases.join(', ')}`);
        }
      });
      console.log(`\n📊 Total results: ${searchResults.length}`);
      break;

    default:
      console.log('Usage: memory-manager.js <stats|recall|query> [args]');
  }
}
