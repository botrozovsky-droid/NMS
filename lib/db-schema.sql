-- NMS SQLite Schema v0.7.0
-- Migration from JSON-based storage to SQLite
-- Supports up to 50K+ nodes with optimal performance

-- ============================================
-- KNOWLEDGE GRAPH TABLES
-- ============================================

-- Nodes: Concepts, entities, knowledge points
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 0.0,
    confidence REAL DEFAULT 0.7,
    activations INTEGER DEFAULT 0,
    last_activation INTEGER,
    created INTEGER NOT NULL,

    -- Metadata
    extraction_type TEXT,
    rationale TEXT,
    canonical_form TEXT,
    aliases TEXT, -- JSON array
    flags TEXT, -- JSON array

    -- Manual nodes (ganglia) - Phase 2
    is_manual BOOLEAN DEFAULT 0,

    -- Embeddings for HNSW search
    embedding BLOB,

    -- Full metadata JSON blob
    metadata TEXT,

    UNIQUE(name, type)
);

CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_weight ON nodes(weight DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_manual ON nodes(is_manual);
CREATE INDEX IF NOT EXISTS idx_nodes_name_search ON nodes(name COLLATE NOCASE);

-- Edges: Relationships between nodes
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL DEFAULT 0.0,
    created INTEGER NOT NULL,
    last_updated INTEGER,

    -- Metadata
    rationale TEXT,
    flags TEXT, -- JSON array
    metadata TEXT,

    FOREIGN KEY(source_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON edges(weight DESC);

-- ============================================
-- EPISODIC MEMORY TABLES
-- ============================================

-- Episodes: Raw memory events
CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT,
    role TEXT,
    importance REAL DEFAULT 0.5,
    consolidated BOOLEAN DEFAULT 0,

    -- Metadata
    metadata TEXT,

    -- Source tracking
    source TEXT,
    format TEXT
);

CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_consolidated ON episodes(consolidated);
CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance DESC);

-- Sessions: Grouping of episodes
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    type TEXT,
    episode_count INTEGER DEFAULT 0,
    important_count INTEGER DEFAULT 0,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time DESC);

-- ============================================
-- PROCEDURAL MEMORY TABLES
-- ============================================

-- Action patterns
CREATE TABLE IF NOT EXISTS action_patterns (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    success_rate REAL DEFAULT 0.0,
    execution_count INTEGER DEFAULT 0,
    last_used INTEGER,
    metadata TEXT
);

-- User preferences
CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    importance REAL DEFAULT 0.5,
    updated INTEGER NOT NULL
);

-- ============================================
-- CACHE & OPTIMIZATION TABLES
-- ============================================

-- Embedding cache for semantic search
CREATE TABLE IF NOT EXISTS embedding_cache (
    text_hash TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    created INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_created ON embedding_cache(created DESC);

-- HNSW index metadata
CREATE TABLE IF NOT EXISTS hnsw_index (
    node_id TEXT PRIMARY KEY,
    layer INTEGER NOT NULL,
    neighbors TEXT, -- JSON array of neighbor IDs
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- ============================================
-- SYSTEM METADATA TABLES
-- ============================================

-- System configuration and metadata
CREATE TABLE IF NOT EXISTS system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated INTEGER NOT NULL
);

-- Consolidation history
CREATE TABLE IF NOT EXISTS consolidation_history (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'nightly' or 'session-end'
    episodes_processed INTEGER,
    nodes_created INTEGER,
    nodes_updated INTEGER,
    edges_created INTEGER,
    duration_ms INTEGER,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_consolidation_timestamp ON consolidation_history(timestamp DESC);

-- Import history
CREATE TABLE IF NOT EXISTS import_history (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    source TEXT NOT NULL,
    format TEXT NOT NULL,
    episodes_imported INTEGER,
    success BOOLEAN,
    error TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_timestamp ON import_history(timestamp DESC);

-- Transaction backups (for rollback)
CREATE TABLE IF NOT EXISTS transaction_backups (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    operation TEXT NOT NULL,
    backup_data TEXT NOT NULL, -- JSON blob
    restored BOOLEAN DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_backup_timestamp ON transaction_backups(timestamp DESC);

-- ============================================
-- MODEL INTERACTION (Phase 2)
-- ============================================

-- Model questions for interactive consolidation
CREATE TABLE IF NOT EXISTS model_questions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    context TEXT, -- JSON with node/edge being discussed
    node_id TEXT, -- Reference to node being clarified
    edge_id TEXT, -- Reference to edge being clarified
    status TEXT DEFAULT 'pending', -- pending/answered/dismissed
    created INTEGER NOT NULL,
    answered INTEGER,
    answer TEXT,

    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(edge_id) REFERENCES edges(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_status ON model_questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_created ON model_questions(created DESC);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Graph statistics view
CREATE VIEW IF NOT EXISTS graph_stats AS
SELECT
    (SELECT COUNT(*) FROM nodes) as total_nodes,
    (SELECT COUNT(*) FROM nodes WHERE is_manual = 1) as manual_nodes,
    (SELECT COUNT(*) FROM edges) as total_edges,
    (SELECT AVG(weight) FROM nodes) as avg_node_weight,
    (SELECT AVG(weight) FROM edges) as avg_edge_weight,
    (SELECT COUNT(*) FROM episodes) as total_episodes,
    (SELECT COUNT(*) FROM episodes WHERE consolidated = 1) as consolidated_episodes;

-- Top nodes by weight
CREATE VIEW IF NOT EXISTS top_nodes AS
SELECT id, name, type, weight, confidence, activations, is_manual
FROM nodes
ORDER BY weight DESC
LIMIT 100;

-- Recent episodes not consolidated
CREATE VIEW IF NOT EXISTS pending_consolidation AS
SELECT e.id, e.session_id, e.timestamp, e.content, e.importance
FROM episodes e
WHERE e.consolidated = 0
ORDER BY e.importance DESC, e.timestamp DESC;

-- ============================================
-- INITIAL METADATA
-- ============================================

INSERT OR IGNORE INTO system_metadata (key, value, updated) VALUES
    ('schema_version', '0.7.0', strftime('%s', 'now') * 1000),
    ('migrated_from_json', 'true', strftime('%s', 'now') * 1000),
    ('storage_type', 'sqlite', strftime('%s', 'now') * 1000);
