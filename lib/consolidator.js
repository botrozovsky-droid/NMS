/**
 * Consolidator - v0.3.1
 *
 * Orchestrator for memory consolidation using Strategy pattern.
 * Integrates with transaction manager for ACID guarantees.
 *
 * Unifies consolidate.js and mini-consolidate.js into single, testable class.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadJSON, saveJSON } from './json-store.js';
import { getGraphTransactionManager } from '../transaction-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Consolidator - Orchestrates memory consolidation using strategies
 */
export class Consolidator {
  constructor(strategy, options = {}) {
    this.strategy = strategy;
    this.options = options;

    // Default paths
    this.paths = {
      hippocampusDir: options.hippocampusDir || path.join(__dirname, '..', 'hippocampus'),
      neocortexDir: options.neocortexDir || path.join(__dirname, '..', 'neocortex'),
      metaDir: options.metaDir || path.join(__dirname, '..', 'meta')
    };

    this.paths.synapticCandidates = path.join(this.paths.hippocampusDir, 'synaptic-candidates.json');
    this.paths.knowledgeGraph = path.join(this.paths.neocortexDir, 'knowledge-graph.json');
    this.paths.learningParams = path.join(this.paths.metaDir, 'learning-params.json');
  }

  /**
   * Execute consolidation with given strategy
   * @param {object} input - Input data (candidates or session)
   * @returns {Promise<object>} - Consolidation result
   */
  async consolidate(input) {
    console.log(`\n🌙 Starting ${this.strategy.name} consolidation...`);
    const startTime = Date.now();

    // Load data
    const graph = await loadJSON(this.paths.knowledgeGraph);
    const params = await loadJSON(this.paths.learningParams);

    if (!graph || !params) {
      throw new Error('Failed to load required files');
    }

    // Initialize transaction manager
    const txManager = getGraphTransactionManager(this.paths.knowledgeGraph);
    await txManager.initialize();

    // Execute within transaction
    return await txManager.execute(async () => {
      // Select candidates/events based on strategy
      const selected = await this.strategy.selectCandidates(input, params);

      if (!selected || selected.length === 0) {
        console.log('✅ No candidates to consolidate');
        return {
          success: false,
          reason: 'no_candidates',
          consolidationType: this.strategy.name
        };
      }

      // Load episode data
      const episodes = await this.loadEpisodes(selected, input);

      if (episodes.length === 0) {
        console.log('⚠️  No episodes found');
        return {
          success: false,
          reason: 'no_episodes',
          consolidationType: this.strategy.name
        };
      }

      // Process in batches
      const batchSize = this.strategy.getBatchSize(params);
      let totalStats = { newNodes: 0, updatedNodes: 0, newEdges: 0 };
      let consolidatedCount = 0;

      for (let i = 0; i < episodes.length; i += batchSize) {
        const batch = episodes.slice(i, Math.min(i + batchSize, episodes.length));
        console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(episodes.length / batchSize)}`);

        const stats = await this.strategy.processBatch(batch, graph, params, {
          ...this.paths,
          sessionId: input.id || input.sessionId
        });

        totalStats.newNodes += stats.newNodes;
        totalStats.updatedNodes += stats.updatedNodes;
        totalStats.newEdges += stats.newEdges;
        consolidatedCount += batch.length;

        console.log(`✅ Batch complete: ${stats.newNodes} new, ${stats.updatedNodes} updated, ${stats.newEdges} edges`);
      }

      // Mark episodes as consolidated (for nightly consolidation)
      if (this.strategy.name === 'nightly') {
        await this.markEpisodesConsolidated(episodes);
      }

      // Post-processing (decay, pruning)
      const postStats = await this.strategy.postProcess(graph, params);

      // Update graph metadata
      graph.lastUpdated = new Date().toISOString();
      graph.statistics.averageDegree =
        graph.statistics.totalNodes > 0
          ? graph.statistics.totalEdges / graph.statistics.totalNodes
          : 0;

      // Save updated graph
      await saveJSON(this.paths.knowledgeGraph, graph);

      // Update candidates (if applicable)
      if (input.candidates) {
        await this.updateCandidates(input, selected, consolidatedCount);
      }

      // Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ ${this.strategy.name} consolidation complete!`);
      console.log(`   📊 Consolidated: ${consolidatedCount} episodes`);
      console.log(`   📊 New nodes: ${totalStats.newNodes}`);
      console.log(`   🔄 Updated nodes: ${totalStats.updatedNodes}`);
      console.log(`   🔗 New edges: ${totalStats.newEdges}`);
      console.log(`   🧠 Graph size: ${graph.statistics.totalNodes} nodes, ${graph.statistics.totalEdges} edges`);

      if (postStats.prunedNodes || postStats.prunedEdges) {
        console.log(`   🧹 Pruned: ${postStats.prunedNodes} nodes, ${postStats.prunedEdges} edges`);
      }

      console.log(`   ⏱️  Duration: ${duration}s`);

      return {
        success: true,
        consolidatedCount,
        ...totalStats,
        ...postStats,
        duration: parseFloat(duration),
        consolidationType: this.strategy.name
      };

    }, `${this.strategy.name}-consolidation`);
  }

  /**
   * Load episode data from session files
   */
  async loadEpisodes(selected, input) {
    const episodes = [];

    for (const item of selected) {
      try {
        // Determine session ID and episode ID
        const sessionId = item.sessionId || input.id;
        const episodeId = item.episodeId || item.id;

        if (!sessionId || !episodeId) {
          console.warn('⚠️  Missing session or episode ID');
          continue;
        }

        const sessionFile = path.join(this.paths.hippocampusDir, 'sessions', `${sessionId}.json`);
        const sessionData = await loadJSON(sessionFile);

        if (sessionData && sessionData.episodes) {
          const episode = sessionData.episodes.find(e => e.id === episodeId || e.episodeId === episodeId);
          if (episode) {
            // Normalize: ensure episode has .id field
            if (!episode.id && episode.episodeId) {
              episode.id = episode.episodeId;
            }
            episodes.push(episode);
          }
        }
      } catch (error) {
        console.error(`⚠️  Failed to load episode:`, error.message);
      }
    }

    return episodes;
  }

  /**
   * Mark episodes as consolidated (BATCH optimized - v0.3.2)
   * Groups episodes by session to minimize I/O operations
   */
  async markEpisodesConsolidated(episodes) {
    // Group episodes by sessionId for batch processing
    const episodesBySession = new Map();

    for (const episode of episodes) {
      if (!episode.sessionId) continue;

      if (!episodesBySession.has(episode.sessionId)) {
        episodesBySession.set(episode.sessionId, []);
      }
      episodesBySession.get(episode.sessionId).push(episode.id);
    }

    // Process each session once (batch I/O)
    for (const [sessionId, episodeIds] of episodesBySession) {
      try {
        const sessionFile = path.join(this.paths.hippocampusDir, 'sessions', `${sessionId}.json`);
        const sessionData = await loadJSON(sessionFile);

        if (sessionData && sessionData.episodes) {
          // Mark all episodes from this session in one go
          for (const episode of sessionData.episodes) {
            if (episodeIds.includes(episode.id)) {
              episode.consolidated = true;
            }
          }

          // Single save per session
          await saveJSON(sessionFile, sessionData);
        }
      } catch (error) {
        console.error(`⚠️  Failed to mark session ${sessionId} episodes as consolidated:`, error.message);
      }
    }
  }

  /**
   * Update synaptic candidates after consolidation
   */
  async updateCandidates(input, consolidated, consolidatedCount) {
    const candidates = await loadJSON(this.paths.synapticCandidates);

    if (!candidates) return;

    // Remove consolidated candidates
    candidates.candidates = candidates.candidates.filter(c =>
      !consolidated.find(e => e.episodeId === c.episodeId)
    );

    candidates.statistics.consolidatedCount += consolidatedCount;
    candidates.lastConsolidation = new Date().toISOString();

    await saveJSON(this.paths.synapticCandidates, candidates);
  }
}
