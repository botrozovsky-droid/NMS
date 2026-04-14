/**
 * Storage Factory - Auto-detect and use SQLite or JSON
 * Provides unified interface regardless of storage backend
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { getDatabase } from './db-adapter.js';
import { loadJSON, saveJSON } from './json-store.js';

const NEOCORTEX_DIR = './neocortex';
const DB_PATH = join(NEOCORTEX_DIR, 'nms.db');
const JSON_PATH = join(NEOCORTEX_DIR, 'knowledge-graph.json');

class StorageAdapter {
  constructor() {
    this.useDatabase = existsSync(DB_PATH);
    this.db = null;

    if (this.useDatabase) {
      this.db = getDatabase(DB_PATH);
      this.db.initialize();
      console.log('📦 Using SQLite storage');
    } else {
      console.log('📦 Using JSON storage (legacy mode)');
    }
  }

  /**
   * Load knowledge graph
   */
  async loadGraph() {
    if (this.useDatabase) {
      return this.db.loadGraph();
    }
    return await loadJSON(JSON_PATH);
  }

  /**
   * Save knowledge graph
   */
  async saveGraph(graph) {
    if (this.useDatabase) {
      this.db.saveGraph(graph);
    } else {
      await saveJSON(JSON_PATH, graph);
    }
  }

  /**
   * Get node by ID
   */
  getNode(nodeId) {
    if (this.useDatabase) {
      return this.db.getNode(nodeId);
    }
    // JSON fallback - load full graph (inefficient but works)
    const graph = loadJSON(JSON_PATH);
    return graph.nodes[nodeId] || null;
  }

  /**
   * Update single node
   */
  async updateNode(nodeId, updates) {
    if (this.useDatabase) {
      return this.db.updateNode(nodeId, updates);
    }
    // JSON fallback
    const graph = await loadJSON(JSON_PATH);
    if (graph.nodes[nodeId]) {
      Object.assign(graph.nodes[nodeId], updates);
      await saveJSON(JSON_PATH, graph);
      return true;
    }
    return false;
  }

  /**
   * Query nodes
   */
  queryNodes(filters) {
    if (this.useDatabase) {
      return this.db.queryNodes(filters);
    }
    // JSON fallback
    const graph = loadJSON(JSON_PATH);
    let results = Object.values(graph.nodes);

    if (filters.type) {
      results = results.filter(n => n.type === filters.type);
    }
    if (filters.minWeight !== undefined) {
      results = results.filter(n => n.weight >= filters.minWeight);
    }

    results.sort((a, b) => b.weight - a.weight);

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    if (this.useDatabase) {
      return this.db.getStatistics();
    }
    // JSON fallback
    const graph = loadJSON(JSON_PATH);
    return {
      total_nodes: Object.keys(graph.nodes || {}).length,
      total_edges: Object.keys(graph.edges || {}).length,
      avg_node_weight: Object.values(graph.nodes || {}).reduce((sum, n) => sum + n.weight, 0) / Object.keys(graph.nodes || {}).length
    };
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton
let storageInstance = null;

export function getStorage() {
  if (!storageInstance) {
    storageInstance = new StorageAdapter();
  }
  return storageInstance;
}

export default StorageAdapter;
