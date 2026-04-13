# NMS Architecture

**Technical architecture of OpenClaw Neurobiological Memory System**

---

## System Overview

```
┌─────────────────────────────────────────┐
│         APPLICATION LAYER               │
│  (Claude Code, Chatbots, AI Systems)    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│           API LAYER                     │
│  - Memory Manager (store, query, recall)│
│  - Dashboard Server (HTTP/REST API)     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         MEMORY LAYERS                   │
│                                         │
│  1. Sensory Buffer (session capture)    │
│  2. Hippocampus (episodic storage)      │
│  3. Neocortex (semantic graph)          │
│  4. Procedural (patterns & preferences) │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          STORAGE LAYER                  │
│  - JSON files (knowledge graph)         │
│  - HNSW index (vector search)           │
│  - Transaction logs (backups)           │
└─────────────────────────────────────────┘
```

## Core Components

### 1. Memory Manager

**File:** `memory-manager.js`

Main API for memory operations:
- `store()` - Add new episodic memory
- `query()` - Semantic search
- `recall()` - Retrieve by session/date
- `consolidate()` - Trigger consolidation
- `deleteNode()` - Remove from graph

### 2. Consolidation System

**Files:** `lib/consolidator.js`, `lib/consolidation-strategies.js`

Two strategies:
- **Nightly:** Full consolidation with decay and pruning
- **Session-end:** Fast mini-consolidation

Process:
1. Select important episodes
2. Analyze with LLM (Gemini)
3. Create/update graph nodes
4. Apply Hebbian learning
5. Temporal decay and pruning

### 3. Semantic Search

**File:** `semantic-search.js`

Modes:
- **Linear:** Exhaustive search (< 1000 nodes)
- **HNSW:** Approximate NN (>= 1000 nodes)

Features:
- Embedding generation (Gemini)
- Caching for performance
- Auto-mode switching

### 4. Transaction Manager

**File:** `transaction-manager.js`

ACID guarantees:
- Pre-transaction backups
- Atomic operations
- Automatic rollback on error
- Transaction history log

### 5. Import System

**Files:** `src/import-manager.js`, `src/formats/*.js`

Parsers:
- JSON (chat exports)
- Text (Markdown, plain text)
- CSV (structured data)
- Code (docstrings, comments)

### 6. Dashboard

**Files:** `dashboard/index.html`, `dashboard.js`, `dashboard/server.js`

Features:
- D3.js graph visualization
- Health monitoring
- Import interface
- Search & filters
- Node explorer

## Data Flow

### Storage Flow

```
User Input
    ↓
MemoryManager.store()
    ↓
Sensory Buffer (session)
    ↓
Hippocampus (episodic)
    ↓
[Consolidation]
    ↓
Neocortex (semantic graph)
```

### Query Flow

```
User Query
    ↓
MemoryManager.query()
    ↓
Generate Embedding
    ↓
Semantic Search (Linear or HNSW)
    ↓
Rank Results
    ↓
Return Top K
```

### Consolidation Flow

```
Trigger (nightly cron or manual)
    ↓
Load Episodic Candidates
    ↓
LLM Analysis (Gemini)
    ↓
Extract Concepts & Relationships
    ↓
Update Graph (Hebbian learning)
    ↓
Apply Decay & Pruning
    ↓
Save to Neocortex
```

## File Structure

```
memory/
├── memory-manager.js          # Main API
├── consolidate.js             # Nightly consolidation CLI
├── semantic-search.js         # Search engine
├── transaction-manager.js     # ACID transactions
├── session-manager.js         # Session lifecycle
│
├── lib/                       # Core libraries
│   ├── consolidator.js        # Consolidation orchestrator
│   ├── consolidation-core.js  # Shared consolidation logic
│   ├── consolidation-strategies.js  # Nightly & session-end strategies
│   └── json-store.js          # JSON I/O utilities
│
├── src/                       # Source modules
│   ├── import-manager.js      # Import orchestrator
│   └── formats/               # Format parsers
│       ├── json-parser.js
│       ├── text-parser.js
│       ├── csv-parser.js
│       └── code-parser.js
│
├── dashboard/                 # Web UI
│   ├── index.html
│   ├── dashboard.js
│   └── server.js
│
├── hippocampus/               # Episodic storage
│   ├── sessions/              # Session files
│   ├── backups/               # Transaction backups
│   ├── daily-index.json       # Date index
│   └── synaptic-candidates.json  # Consolidation queue
│
├── neocortex/                 # Semantic storage
│   ├── knowledge-graph.json   # Main graph
│   ├── learning-params.json   # Hebbian config
│   └── search-config.json     # HNSW config
│
├── meta/                      # Metadata
│   ├── consolidation-history.json
│   └── import-history.json
│
├── procedural/                # Procedural memory
│   ├── action-patterns.json
│   └── preferences.json
│
└── data/                      # Cache
    └── embedding-cache.json   # Embedding cache
```

## Key Algorithms

### Hebbian Learning

```javascript
function updateWeight(edge, activation) {
  const delta = learningRate * activation.pre * activation.post;
  edge.weight = Math.min(maxWeight, edge.weight + delta);
}
```

### Temporal Decay

```javascript
function applyDecay(edge, timeDelta) {
  const decay = Math.exp(-decayRate * timeDelta);
  edge.weight *= decay;
}
```

### HNSW Search

```javascript
function hnswSearch(query, k) {
  let current = entryPoint;
  
  for (let layer = topLayer; layer >= 0; layer--) {
    current = searchLayer(query, current, layer, efSearch);
  }
  
  return getTopK(current, k);
}
```

## Scaling Considerations

### Small Scale (<1000 nodes)
- Linear search
- In-memory operations
- Single file storage

### Medium Scale (1000-10,000 nodes)
- HNSW search
- Batched operations
- Indexed storage

### Large Scale (>10,000 nodes)
- Distributed HNSW
- Sharded storage
- Asynchronous consolidation

## Performance Metrics

- **Storage:** 1MB per 1000 nodes
- **Search:** O(log n) with HNSW
- **Consolidation:** 1000 episodes in ~30s
- **Memory Usage:** ~100MB for 10,000 nodes

---

For implementation details, see source code and [API Reference](docs/API-REFERENCE.md).
