/**
 * Database Adapter for NMS v0.7.0
 * SQLite wrapper with same API as json-store.js for backward compatibility
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection and schema
   */
  initialize() {
    if (this.db) return; // Already initialized

    // Create database connection
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');

    // Load and execute schema
    const schemaPath = join(__dirname, 'db-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================
  // KNOWLEDGE GRAPH OPERATIONS
  // ============================================

  /**
   * Load entire knowledge graph (for backward compatibility)
   * @returns {Object} Graph with nodes and edges
   */
  loadGraph() {
    this.initialize();

    const nodesStmt = this.db.prepare(`
      SELECT * FROM nodes ORDER BY created DESC
    `);
    const edgesStmt = this.db.prepare(`
      SELECT * FROM edges ORDER BY created DESC
    `);

    const nodeRows = nodesStmt.all();
    const edgeRows = edgesStmt.all();

    // Convert to object format (like JSON storage)
    const nodes = {};
    nodeRows.forEach(row => {
      nodes[row.id] = this._deserializeNode(row);
    });

    const edges = {};
    edgeRows.forEach(row => {
      edges[row.id] = this._deserializeEdge(row);
    });

    return {
      version: '2.0.0',
      nodes,
      edges,
      metadata: this.getMetadata()
    };
  }

  /**
   * Save entire knowledge graph
   * @param {Object} graph - Graph object with nodes and edges
   */
  saveGraph(graph) {
    this.initialize();

    // Temporarily disable foreign keys for migration
    this.db.prepare('PRAGMA foreign_keys = OFF').run();

    const transaction = this.db.transaction(() => {
      // Clear existing data
      this.db.prepare('DELETE FROM nodes').run();
      this.db.prepare('DELETE FROM edges').run();

      // Insert nodes (use REPLACE to handle duplicates)
      const nodeStmt = this.db.prepare(`
        INSERT OR REPLACE INTO nodes (
          id, name, type, weight, confidence, activations, last_activation,
          created, extraction_type, rationale, canonical_form, aliases,
          flags, is_manual, embedding, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      Object.values(graph.nodes || {}).forEach(node => {
        const serialized = this._serializeNode(node);
        nodeStmt.run(...serialized);
      });

      // Insert edges
      const edgeStmt = this.db.prepare(`
        INSERT INTO edges (
          id, source_id, target_id, type, weight, created, last_updated,
          rationale, flags, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      Object.values(graph.edges || {}).forEach(edge => {
        const serialized = this._serializeEdge(edge);
        edgeStmt.run(...serialized);
      });

      // Update metadata
      if (graph.lastUpdated) {
        this.setMetadata('graph_last_updated', graph.lastUpdated);
      }
    });

    transaction();

    // Re-enable foreign keys
    this.db.prepare('PRAGMA foreign_keys = ON').run();
  }

  /**
   * Get single node by ID
   */
  getNode(nodeId) {
    this.initialize();
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    const row = stmt.get(nodeId);
    return row ? this._deserializeNode(row) : null;
  }

  /**
   * Get multiple nodes by IDs
   */
  getNodes(nodeIds) {
    this.initialize();
    const placeholders = nodeIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`);
    const rows = stmt.all(...nodeIds);
    return rows.map(row => this._deserializeNode(row));
  }

  /**
   * Update single node
   */
  updateNode(nodeId, updates) {
    this.initialize();
    const node = this.getNode(nodeId);
    if (!node) return false;

    Object.assign(node, updates);
    const serialized = this._serializeNode(node);

    const stmt = this.db.prepare(`
      UPDATE nodes SET
        name=?, type=?, weight=?, confidence=?, activations=?, last_activation=?,
        created=?, extraction_type=?, rationale=?, canonical_form=?, aliases=?,
        flags=?, is_manual=?, embedding=?, metadata=?
      WHERE id=?
    `);

    stmt.run(...serialized.slice(1), nodeId);
    return true;
  }

  /**
   * Delete node
   */
  deleteNode(nodeId) {
    this.initialize();
    const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    const result = stmt.run(nodeId);
    return result.changes > 0;
  }

  /**
   * Query nodes with filters
   */
  queryNodes(filters = {}) {
    this.initialize();
    let query = 'SELECT * FROM nodes WHERE 1=1';
    const params = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.minWeight !== undefined) {
      query += ' AND weight >= ?';
      params.push(filters.minWeight);
    }
    if (filters.isManual !== undefined) {
      query += ' AND is_manual = ?';
      params.push(filters.isManual ? 1 : 0);
    }

    query += ' ORDER BY weight DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(row => this._deserializeNode(row));
  }

  // ============================================
  // EPISODES OPERATIONS
  // ============================================

  /**
   * Save episodes to database
   */
  saveEpisodes(sessionId, episodes) {
    this.initialize();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO episodes (
        id, session_id, timestamp, content, type, role, importance,
        consolidated, metadata, source, format
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      episodes.forEach(ep => {
        // Skip episodes without content
        if (!ep.content && !ep.data) return;

        stmt.run(
          ep.episodeId || `${sessionId}-${Date.now()}`,
          sessionId,
          ep.timestamp ? new Date(ep.timestamp).getTime() : Date.now(),
          ep.content || JSON.stringify(ep.data || {}),
          ep.type || null,
          ep.role || null,
          ep.importance || 0.5,
          ep.consolidated ? 1 : 0,
          JSON.stringify(ep.metadata || {}),
          ep.source || null,
          ep.format || null
        );
      });
    });

    transaction();
  }

  /**
   * Load episodes by session
   */
  loadEpisodes(sessionId) {
    this.initialize();
    const stmt = this.db.prepare(`
      SELECT * FROM episodes WHERE session_id = ? ORDER BY timestamp ASC
    `);
    const rows = stmt.all(sessionId);
    return rows.map(row => ({
      episodeId: row.id,
      timestamp: new Date(row.timestamp).toISOString(),
      content: row.content,
      type: row.type,
      role: row.role,
      importance: row.importance,
      consolidated: row.consolidated === 1,
      metadata: JSON.parse(row.metadata || '{}'),
      source: row.source,
      format: row.format
    }));
  }

  /**
   * Get unconsolidated episodes
   */
  getUnconsolidatedEpisodes(limit = 100) {
    this.initialize();
    const stmt = this.db.prepare(`
      SELECT * FROM episodes
      WHERE consolidated = 0
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    return rows.map(row => ({
      episodeId: row.id,
      sessionId: row.session_id,
      timestamp: new Date(row.timestamp).toISOString(),
      content: row.content,
      importance: row.importance,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Mark episodes as consolidated
   */
  markConsolidated(episodeIds) {
    this.initialize();
    const placeholders = episodeIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE episodes SET consolidated = 1 WHERE id IN (${placeholders})
    `);
    stmt.run(...episodeIds);
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================

  /**
   * Load embedding cache
   */
  loadEmbeddingCache() {
    this.initialize();
    const stmt = this.db.prepare('SELECT * FROM embedding_cache');
    const rows = stmt.all();

    const cache = {};
    rows.forEach(row => {
      cache[row.text_hash] = {
        embedding: JSON.parse(row.embedding.toString()),
        model: row.model,
        created: row.created
      };
    });
    return cache;
  }

  /**
   * Save embedding cache
   */
  saveEmbeddingCache(cache) {
    this.initialize();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embedding_cache (text_hash, embedding, model, created)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      Object.entries(cache).forEach(([hash, data]) => {
        // Skip invalid entries
        if (!data || !data.embedding) return;

        stmt.run(
          hash,
          Buffer.from(JSON.stringify(data.embedding)),
          data.model || 'unknown',
          data.created || Date.now()
        );
      });
    });

    transaction();
  }

  // ============================================
  // METADATA OPERATIONS
  // ============================================

  getMetadata(key = null) {
    this.initialize();
    if (key) {
      const stmt = this.db.prepare('SELECT value FROM system_metadata WHERE key = ?');
      const row = stmt.get(key);
      if (!row) return null;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value; // Return as-is if not JSON
      }
    }

    const stmt = this.db.prepare('SELECT key, value FROM system_metadata');
    const rows = stmt.all();
    const metadata = {};
    rows.forEach(row => {
      try {
        metadata[row.key] = JSON.parse(row.value);
      } catch {
        metadata[row.key] = row.value; // Return as-is if not JSON
      }
    });
    return metadata;
  }

  setMetadata(key, value) {
    this.initialize();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO system_metadata (key, value, updated)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, JSON.stringify(value), Date.now());
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStatistics() {
    this.initialize();
    const stmt = this.db.prepare('SELECT * FROM graph_stats');
    return stmt.get();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  _serializeNode(node) {
    return [
      node.id,
      node.name,
      node.type,
      node.weight || 0.0,
      node.confidence || 0.7,
      node.activations || 0,
      node.lastActivation || null,
      node.created,
      node.extractionType || null,
      node.rationale || null,
      node.canonicalForm || null,
      JSON.stringify(node.aliases || []),
      JSON.stringify(node.flags || []),
      node.isManual ? 1 : 0,
      node.embedding ? Buffer.from(JSON.stringify(node.embedding)) : null,
      JSON.stringify(node.metadata || {})
    ];
  }

  _deserializeNode(row) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      weight: row.weight,
      confidence: row.confidence,
      activations: row.activations,
      lastActivation: row.last_activation,
      created: row.created,
      extractionType: row.extraction_type,
      rationale: row.rationale,
      canonicalForm: row.canonical_form,
      aliases: JSON.parse(row.aliases || '[]'),
      flags: JSON.parse(row.flags || '[]'),
      isManual: row.is_manual === 1,
      embedding: row.embedding ? JSON.parse(row.embedding.toString()) : null,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  _serializeEdge(edge) {
    return [
      edge.id,
      edge.source,
      edge.target,
      edge.type,
      edge.weight || 0.0,
      edge.created,
      edge.lastUpdated || null,
      edge.rationale || null,
      JSON.stringify(edge.flags || []),
      JSON.stringify(edge.metadata || {})
    ];
  }

  _deserializeEdge(row) {
    return {
      id: row.id,
      source: row.source_id,
      target: row.target_id,
      type: row.type,
      weight: row.weight,
      created: row.created,
      lastUpdated: row.last_updated,
      rationale: row.rationale,
      flags: JSON.parse(row.flags || '[]'),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }
}

// Singleton instance
let dbInstance = null;

export function getDatabase(dbPath = null) {
  if (!dbInstance) {
    const defaultPath = join(process.cwd(), 'neocortex', 'nms.db');
    dbInstance = new DatabaseAdapter(dbPath || defaultPath);
  }
  return dbInstance;
}

export default DatabaseAdapter;
