# API Reference - OpenClaw Memory v0.4.2

**Complete API documentation for developers**

---

## 📖 Contents

1. [MemoryManager API](#memorymanager-api)
2. [ImportManager API](#importmanager-api)
3. [SemanticSearch API](#semanticsearch-api)
4. [SessionManager API](#sessionmanager-api)
5. [TransactionManager API](#transactionmanager-api)
6. [ConsolidationEngine API](#consolidationengine-api)
7. [CLI Commands](#cli-commands)
8. [Dashboard REST API](#dashboard-rest-api)
9. [Data Formats](#data-formats)
10. [Configuration](#configuration)

---

## MemoryManager API

Main interface for memory operations.

### Import

```javascript
import MemoryManager from './memory-manager.js';

const memory = MemoryManager; // Singleton instance
await memory.initialize();
```

### Methods

#### `initialize()`

Initialize the memory system. Creates directory structure if needed.

```javascript
await memory.initialize();
```

**Returns:** `Promise<void>`

**Side effects:** Creates `neocortex/`, `hippocampus/`, `meta/` directories

---

#### `storeEpisode(episode)`

Store a single episode in short-term memory (hippocampus).

```javascript
const episode = {
  type: 'conversation',
  role: 'user',
  content: 'What is Python?',
  confidence: 0.95,
  metadata: {
    model: 'claude-sonnet-4.5',
    sessionId: 'session-123'
  }
};

await memory.storeEpisode(episode);
```

**Parameters:**
- `episode` (Object):
  - `type` (string): Episode type ('conversation', 'tool-call', 'imported')
  - `role` (string): 'user', 'assistant', or 'system'
  - `content` (string): Episode content
  - `confidence` (number): Confidence score (0-1)
  - `metadata` (Object): Additional metadata

**Returns:** `Promise<string>` - Episode ID

**Throws:** `Error` if episode is invalid

---

#### `query(queryText, options)`

Query the knowledge graph using semantic search.

```javascript
const results = await memory.query('Python programming', {
  maxResults: 10,
  threshold: 0.7,
  includeRelationships: true
});
```

**Parameters:**
- `queryText` (string): Search query
- `options` (Object):
  - `maxResults` (number): Maximum results to return (default: 10)
  - `threshold` (number): Similarity threshold (default: 0.7)
  - `includeRelationships` (boolean): Include related concepts (default: true)

**Returns:** `Promise<Array<Object>>` - Array of concepts:
```javascript
[
  {
    name: 'Python',
    type: 'programming-language',
    description: 'High-level interpreted language...',
    importance: 0.85,
    confidence: 0.95,
    relationships: [
      { target: 'dynamic typing', type: 'has-feature', strength: 0.9 }
    ]
  }
]
```

---

#### `recall(filters)`

Recall episodes from hippocampus.

```javascript
const episodes = await memory.recall({
  limit: 50,
  type: 'conversation',
  minConfidence: 0.8
});
```

**Parameters:**
- `filters` (Object):
  - `limit` (number): Maximum episodes to return (default: 50)
  - `type` (string): Filter by episode type
  - `minConfidence` (number): Minimum confidence threshold
  - `sessionId` (string): Filter by session ID

**Returns:** `Promise<Array<Object>>` - Array of episodes

---

#### `consolidate(options)`

Manually trigger consolidation (hippocampus → neocortex).

```javascript
const result = await memory.consolidate({
  force: true,
  autoConsolidate: true
});
```

**Parameters:**
- `options` (Object):
  - `force` (boolean): Force consolidation even if threshold not met
  - `autoConsolidate` (boolean): Auto-consolidate after import

**Returns:** `Promise<Object>` - Consolidation statistics:
```javascript
{
  success: true,
  newConcepts: 5,
  updatedConcepts: 3,
  newRelationships: 7,
  processedEpisodes: 42,
  duration: '12.5s'
}
```

---

#### `getStats()`

Get memory system statistics.

```javascript
const stats = await memory.getStats();
```

**Returns:** `Promise<Object>`:
```javascript
{
  neocortex: {
    totalConcepts: 157,
    totalRelationships: 243,
    averageImportance: 0.72,
    lastUpdated: '2024-01-15T10:00:00Z'
  },
  hippocampus: {
    totalEpisodes: 89,
    totalSessions: 12,
    oldestEpisode: '2024-01-10T08:00:00Z',
    newestEpisode: '2024-01-15T09:55:00Z'
  },
  search: {
    mode: 'hnsw',
    embeddingsCached: 157,
    cacheSize: '2.3 MB'
  }
}
```

---

#### `exportToObsidian(outputPath)`

Export knowledge graph to Obsidian-compatible Markdown files.

```javascript
await memory.exportToObsidian('./exports/obsidian/');
```

**Parameters:**
- `outputPath` (string): Directory to write Markdown files

**Returns:** `Promise<Object>`:
```javascript
{
  success: true,
  filesCreated: 157,
  outputPath: './exports/obsidian/'
}
```

---

## ImportManager API

Handles importing external data into memory system.

### Import

```javascript
import { ImportManager } from './src/import-manager.js';

const importer = new ImportManager();
await importer.initialize();
```

### Methods

#### `importFile(filePath, options)`

Import a single file.

```javascript
const result = await importer.importFile('./chat-export.json', {
  format: 'json',           // Auto-detect if omitted
  autoConsolidate: true,
  generateEmbeddings: true,
  source: 'ChatGPT Export',
  confidence: 0.8
});
```

**Parameters:**
- `filePath` (string): Path to file
- `options` (Object):
  - `format` (string): Force format ('json', 'text', 'csv', 'code')
  - `autoConsolidate` (boolean): Consolidate after import
  - `generateEmbeddings` (boolean): Generate embeddings
  - `source` (string): Source name for metadata
  - `confidence` (number): Default confidence score

**Returns:** `Promise<Object>`:
```javascript
{
  success: true,
  format: 'json',
  episodeCount: 42,
  duration: '1.5s',
  importId: 'import-1234567890'
}
```

---

#### `importBatch(filePaths, options)`

Import multiple files in batch.

```javascript
const result = await importer.importBatch(
  ['file1.txt', 'file2.md', 'file3.json'],
  { autoConsolidate: false }
);
```

**Parameters:**
- `filePaths` (Array<string>): Array of file paths
- `options` (Object): Same as `importFile`

**Returns:** `Promise<Object>`:
```javascript
{
  success: true,
  totalFiles: 3,
  successCount: 3,
  failCount: 0,
  totalEpisodes: 127,
  results: [ /* individual results */ ]
}
```

---

#### `importDirectory(dirPath, options)`

Import all supported files from directory recursively.

```javascript
const result = await importer.importDirectory('./docs/', {
  maxDepth: 5,
  autoConsolidate: false
});
```

**Parameters:**
- `dirPath` (string): Directory path
- `options` (Object):
  - All `importFile` options
  - `maxDepth` (number): Max recursion depth (default: 10)

**Returns:** `Promise<Object>` - Same as `importBatch`

---

#### `getImportHistory(filters)`

Get import history.

```javascript
const history = importer.getImportHistory({
  success: true,
  format: 'json',
  limit: 20
});
```

**Parameters:**
- `filters` (Object):
  - `success` (boolean): Filter by success status
  - `format` (string): Filter by format
  - `limit` (number): Max records to return

**Returns:** `Array<Object>`:
```javascript
[
  {
    id: 'import-1234567890',
    filePath: './chat.json',
    format: 'json',
    fileSize: 245670,
    episodeCount: 42,
    timestamp: '2024-01-15T10:00:00Z',
    duration: '1.5s',
    success: true
  }
]
```

---

#### `clearImportHistory()`

Clear import history.

```javascript
await importer.clearImportHistory();
```

**Returns:** `Promise<void>`

---

## SemanticSearch API

Handles vector embeddings and similarity search.

### Import

```javascript
import { SemanticSearch } from './semantic-search.js';

const search = new SemanticSearch();
await search.initialize();
```

### Methods

#### `search(queryText, topK)`

Search for similar concepts.

```javascript
const results = await search.search('Python programming', 10);
```

**Parameters:**
- `queryText` (string): Search query
- `topK` (number): Number of results to return (default: 10)

**Returns:** `Promise<Array<Object>>`:
```javascript
[
  {
    concept: { name: 'Python', type: 'programming-language', ... },
    similarity: 0.92
  }
]
```

---

#### `enableHNSW()`

Enable HNSW (Hierarchical Navigable Small World) fast search.

```javascript
await search.enableHNSW();
```

**Returns:** `Promise<void>`

**Note:** Requires rebuilding index with `rebuildHNSWIndex()`

---

#### `disableHNSW()`

Disable HNSW, switch to linear search.

```javascript
await search.disableHNSW();
```

**Returns:** `Promise<void>`

---

#### `rebuildHNSWIndex()`

Rebuild HNSW index from all concepts.

```javascript
const result = await search.rebuildHNSWIndex();
```

**Returns:** `Promise<Object>`:
```javascript
{
  success: true,
  conceptCount: 157,
  buildTime: '2.3s'
}
```

---

#### `generateEmbedding(text)`

Generate embedding vector for text.

```javascript
const embedding = await search.generateEmbedding('Python programming');
```

**Parameters:**
- `text` (string): Text to embed

**Returns:** `Promise<Array<number>>` - 768-dimensional vector

---

#### `benchmark()`

Benchmark Linear vs HNSW performance.

```javascript
const results = await search.benchmark();
```

**Returns:** `Promise<Object>`:
```javascript
{
  linear: { avgTime: 45.2, queries: 100 },
  hnsw: { avgTime: 0.8, queries: 100 },
  speedup: '56.5x faster'
}
```

---

## SessionManager API

Manages conversation sessions and session-end consolidation.

### Import

```javascript
import { getSessionManager } from './session-manager.js';

const sessionManager = getSessionManager();
await sessionManager.initialize();
```

### Methods

#### `startSession(sessionId, metadata)`

Start a new session.

```javascript
const session = await sessionManager.startSession('session-123', {
  user: 'claude-code',
  context: 'web-development',
  startTime: new Date().toISOString()
});
```

**Parameters:**
- `sessionId` (string): Unique session ID
- `metadata` (Object): Session metadata

**Returns:** `Promise<Object>` - Session object

---

#### `endSession(sessionId, options)`

End a session and optionally trigger mini-consolidation.

```javascript
const result = await sessionManager.endSession('session-123', {
  miniConsolidate: true
});
```

**Parameters:**
- `sessionId` (string): Session ID to end
- `options` (Object):
  - `miniConsolidate` (boolean): Run mini-consolidation (default: true)

**Returns:** `Promise<Object>`:
```javascript
{
  success: true,
  sessionId: 'session-123',
  episodeCount: 42,
  consolidation: {
    newConcepts: 3,
    updatedConcepts: 5,
    newRelationships: 7
  }
}
```

---

#### `getSessionStats()`

Get session statistics.

```javascript
const stats = await sessionManager.getSessionStats();
```

**Returns:** `Promise<Object>`:
```javascript
{
  totalSessions: 157,
  activeSessions: 3,
  completedSessions: 154,
  averageEpisodes: 28,
  averageDuration: '15m 30s'
}
```

---

## TransactionManager API

Manages ACID transactions for knowledge graph updates.

### Import

```javascript
import { getGraphTransactionManager } from './transaction-manager.js';

const txManager = getGraphTransactionManager('./neocortex/knowledge-graph.json');
await txManager.initialize();
```

### Methods

#### `execute(operation, operationName)`

Execute operation in a transaction.

```javascript
const result = await txManager.execute(async () => {
  // Modify graph
  graph.concepts.push(newConcept);

  // Save
  await saveJSON(graphPath, graph);

  return { success: true };
}, 'add-concept');
```

**Parameters:**
- `operation` (Function): Async function that modifies data
- `operationName` (string): Name for logging

**Returns:** `Promise<T>` - Result from operation

**Guarantees:**
- ✅ Atomicity: All-or-nothing execution
- ✅ Consistency: Automatic backup before operation
- ✅ Isolation: Sequential execution (no concurrent writes)
- ✅ Durability: Backup retained for recovery

---

#### `rollback()`

Rollback to last backup.

```javascript
await txManager.rollback();
```

**Returns:** `Promise<void>`

---

#### `cleanup()`

Remove old backups (keeps last 10).

```javascript
await txManager.cleanup();
```

**Returns:** `Promise<Object>`:
```javascript
{
  removed: 15,
  kept: 10,
  totalSize: '5.2 MB freed'
}
```

---

#### `getStats()`

Get transaction statistics.

```javascript
const stats = await txManager.getStats();
```

**Returns:** `Promise<Object>`:
```javascript
{
  totalTransactions: 342,
  successfulTransactions: 340,
  failedTransactions: 2,
  rollbacks: 2,
  backups: 10
}
```

---

## ConsolidationEngine API

Internal API for consolidation process (nightly and session-end).

### Import

```javascript
import { consolidate } from './consolidate.js';
import { miniConsolidate } from './mini-consolidate.js';
```

### Functions

#### `consolidate(options)`

Run full nightly consolidation.

```javascript
const result = await consolidate({
  batchSize: 50,
  threshold: 0.6,
  generateEmbeddings: true
});
```

**Parameters:**
- `options` (Object):
  - `batchSize` (number): Episodes per batch
  - `threshold` (number): Importance threshold
  - `generateEmbeddings` (boolean): Generate embeddings

**Returns:** `Promise<Object>` - Consolidation statistics

---

#### `miniConsolidate(session)`

Run session-end mini-consolidation (top 20 episodes).

```javascript
const result = await miniConsolidate({
  sessionId: 'session-123',
  episodes: [ /* episode array */ ]
});
```

**Parameters:**
- `session` (Object): Session object with episodes array

**Returns:** `Promise<Object>` - Consolidation statistics

---

## CLI Commands

### Memory Commands

```bash
# Show statistics
npm run stats

# Query knowledge graph
npm run query "search text"

# Recall recent episodes
npm run recall

# Run consolidation
npm run consolidate

# Run meta-learning
npm run meta-learn
```

### Import Commands

```bash
# Import single file
npm run import:file -- path/to/file.json

# Import multiple files
npm run import:batch -- file1.txt file2.md file3.csv

# Import directory
npm run import:dir -- path/to/directory

# Show import history
npm run import:history
```

### Search Commands

```bash
# Show search configuration
npm run search:info

# Enable HNSW mode
npm run search:enable-hnsw

# Disable HNSW mode
npm run search:disable-hnsw

# Rebuild HNSW index
npm run search:rebuild-hnsw

# Benchmark performance
npm run search:benchmark
```

### Quality Commands

```bash
# Check for contradictions
npm run check:contradictions

# Fix contradictions
npm run fix:contradictions

# Check data quality
npm run check-quality

# Fix low-quality data
npm run fix-quality

# Remove duplicates
npm run deduplicate
```

### Session Commands

```bash
# Show session statistics
npm run session-stats
```

### Transaction Commands

```bash
# Show transaction statistics
npm run tx-stats

# Cleanup old backups
npm run tx-cleanup
```

### Export Commands

```bash
# Export to Obsidian
npm run export:obsidian
```

### Dashboard

```bash
# Start dashboard server
npm run dashboard
```

### Testing

```bash
# Run all tests
npm test

# Run v0.3.x tests
npm run test:v03

# Run specific tests
npm run test:v03:semantic
npm run test:v03:transactions
npm run test:v03:sessions
npm run test:v03:export
```

---

## Dashboard REST API

### Base URL

```
http://localhost:3000
```

### Endpoints

#### `GET /api/stats`

Get memory system statistics.

**Response:**
```json
{
  "neocortex": {
    "totalConcepts": 157,
    "totalRelationships": 243,
    "averageImportance": 0.72
  },
  "hippocampus": {
    "totalEpisodes": 89,
    "totalSessions": 12
  },
  "search": {
    "mode": "hnsw",
    "embeddingsCached": 157
  }
}
```

---

#### `POST /api/query`

Query knowledge graph.

**Request:**
```json
{
  "query": "Python programming",
  "maxResults": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "name": "Python",
      "type": "programming-language",
      "description": "...",
      "importance": 0.85,
      "relationships": [ /* ... */ ]
    }
  ],
  "count": 1,
  "searchTime": "15ms"
}
```

---

#### `POST /api/import/file`

Import file via upload.

**Request:** `multipart/form-data`
- `file`: File to import
- `options`: JSON string with options

**Response:**
```json
{
  "success": true,
  "fileName": "chat-export.json",
  "episodeCount": 42,
  "message": "Imported 42 episodes"
}
```

---

#### `POST /api/import/text`

Import text content directly.

**Request:**
```json
{
  "content": "Text content to import...",
  "fileName": "imported-text.txt",
  "options": {
    "autoConsolidate": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "episodeCount": 3,
  "message": "Imported 3 episodes"
}
```

---

#### `GET /api/import/history`

Get import history.

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "import-1234567890",
      "filePath": "./chat.json",
      "format": "json",
      "episodeCount": 42,
      "timestamp": "2024-01-15T10:00:00Z",
      "success": true
    }
  ],
  "total": 157
}
```

---

#### `DELETE /api/import/history`

Clear import history.

**Response:**
```json
{
  "success": true,
  "message": "Import history cleared"
}
```

---

#### `GET /api/graph`

Get knowledge graph data for visualization.

**Response:**
```json
{
  "nodes": [
    {
      "id": "Python",
      "type": "programming-language",
      "importance": 0.85
    }
  ],
  "edges": [
    {
      "source": "Python",
      "target": "dynamic typing",
      "type": "has-feature",
      "strength": 0.9
    }
  ]
}
```

---

#### `POST /api/search/config`

Update search configuration.

**Request:**
```json
{
  "mode": "hnsw",
  "rebuildIndex": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Search mode updated to HNSW",
  "rebuildTime": "2.3s"
}
```

---

## Data Formats

### Episode Format

```json
{
  "episodeId": "session-123-ep0",
  "timestamp": "2024-01-15T10:00:00Z",
  "type": "conversation",
  "role": "user",
  "content": "What is Python?",
  "confidence": 0.95,
  "metadata": {
    "model": "claude-sonnet-4.5",
    "sessionId": "session-123",
    "source": "claude-code"
  }
}
```

### Concept Format

```json
{
  "name": "Python",
  "type": "programming-language",
  "description": "High-level interpreted programming language...",
  "importance": 0.85,
  "confidence": 0.95,
  "lastAccessed": "2024-01-15T10:00:00Z",
  "accessCount": 42,
  "createdAt": "2024-01-10T08:00:00Z",
  "flags": [],
  "metadata": {
    "creator": "Guido van Rossum",
    "releaseYear": 1991,
    "episodeIds": ["session-120-ep3", "session-123-ep1"]
  }
}
```

### Relationship Format

```json
{
  "source": "Python",
  "target": "dynamic typing",
  "type": "has-feature",
  "strength": 0.9,
  "confidence": 0.95,
  "lastReinforced": "2024-01-15T10:00:00Z",
  "reinforcementCount": 15,
  "createdAt": "2024-01-10T08:00:00Z",
  "flags": [],
  "metadata": {
    "episodeIds": ["session-120-ep3", "session-123-ep1"]
  }
}
```

### Session Format

```json
{
  "sessionId": "session-123",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T10:15:00Z",
  "type": "conversation",
  "episodes": [
    { /* episode objects */ }
  ],
  "metadata": {
    "user": "claude-code",
    "context": "web-development",
    "consolidated": true
  }
}
```

---

## Configuration

### Environment Variables

`.env` file:
```bash
# Required
GEMINI_API_KEY=AIzaSy...

# Optional
GEMINI_MODEL=gemini-1.5-flash
DASHBOARD_PORT=3000
LOG_LEVEL=info
```

### Learning Parameters

`neocortex/learning-params.json`:
```json
{
  "parameters": {
    "hebbian": {
      "learningRate": 0.1,
      "decayRate": 0.05,
      "reinforcementThreshold": 0.3,
      "decayHalfLife": 7,
      "pruneThreshold": 0.1
    },
    "consolidation": {
      "importanceThreshold": 0.6,
      "confidenceThreshold": 0.7,
      "minEpisodes": 3,
      "batchSize": 50,
      "maxBatches": 20
    },
    "semantic": {
      "similarityThreshold": 0.75,
      "maxResults": 10,
      "embeddingModel": "text-embedding-004"
    }
  },
  "quality": {
    "autoFlagLowConfidence": true,
    "lowConfidenceThreshold": 0.5,
    "contradictionThreshold": 0.3
  }
}
```

### Search Configuration

`neocortex/semantic-config.json`:
```json
{
  "mode": "hnsw",
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 100
  },
  "cache": {
    "enabled": true,
    "maxSize": 10000
  }
}
```

---

## Error Handling

All API methods throw errors with descriptive messages:

```javascript
try {
  await memory.query('search text');
} catch (error) {
  console.error('Query failed:', error.message);

  // Check error type
  if (error.message.includes('GEMINI_API_KEY')) {
    console.log('Please set GEMINI_API_KEY in .env');
  }
}
```

### Common Error Messages

- `"GEMINI_API_KEY not found in environment"` - Missing API key
- `"Failed to generate embedding"` - Gemini API error
- `"Knowledge graph file not found"` - Need to run consolidation first
- `"Invalid episode format"` - Episode missing required fields
- `"Transaction failed: [reason]"` - Transaction error with rollback
- `"HNSW index not found"` - Need to rebuild index

---

## TypeScript Types

For TypeScript users, type definitions:

```typescript
interface Episode {
  episodeId?: string;
  timestamp: string;
  type: 'conversation' | 'tool-call' | 'imported';
  role: 'user' | 'assistant' | 'system';
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

interface Concept {
  name: string;
  type: string;
  description: string;
  importance: number;
  confidence: number;
  lastAccessed: string;
  accessCount: number;
  createdAt: string;
  flags: string[];
  metadata: Record<string, any>;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
  strength: number;
  confidence: number;
  lastReinforced: string;
  reinforcementCount: number;
  createdAt: string;
  flags: string[];
  metadata: Record<string, any>;
}

interface QueryResult {
  concept: Concept;
  similarity: number;
}

interface ConsolidationResult {
  success: boolean;
  newConcepts: number;
  updatedConcepts: number;
  newRelationships: number;
  processedEpisodes: number;
  duration: string;
}
```

---

## Rate Limits

### Gemini API

- **Free tier:** 60 requests/minute
- **Paid tier:** 1000 requests/minute

**Consolidation impact:**
- Each batch = 1 API call
- 50 episodes/batch = ~1 call per 50 episodes
- 1000 episodes = ~20 API calls (~20 seconds)

### Dashboard API

- No rate limits
- Runs locally
- Limited by Node.js event loop

---

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch:

```javascript
try {
  const results = await memory.query('search text');
} catch (error) {
  console.error('Query failed:', error);
  // Handle error appropriately
}
```

### 2. Transaction Usage

Use transactions for graph modifications:

```javascript
await txManager.execute(async () => {
  // Modify graph
  graph.concepts.push(newConcept);

  // Save
  await saveJSON(graphPath, graph);
}, 'add-concept');
```

### 3. Batch Operations

Use batch import for multiple files:

```javascript
// Good: Single batch operation
await importer.importBatch(['f1.txt', 'f2.txt', 'f3.txt']);

// Bad: Multiple individual calls
await importer.importFile('f1.txt');
await importer.importFile('f2.txt');
await importer.importFile('f3.txt');
```

### 4. Search Mode Selection

- **Linear:** Small graphs (<100 concepts), exact results
- **HNSW:** Large graphs (100+ concepts), 5-100x faster

```javascript
if (conceptCount > 100) {
  await search.enableHNSW();
  await search.rebuildHNSWIndex();
}
```

### 5. Consolidation Frequency

- **Nightly:** Full consolidation (all episodes)
- **Session-end:** Mini-consolidation (top 20 episodes)
- **Manual:** On-demand via CLI or API

---

## Examples

### Complete Workflow Example

```javascript
import MemoryManager from './memory-manager.js';
import { ImportManager } from './src/import-manager.js';
import { SemanticSearch } from './semantic-search.js';

// 1. Initialize
const memory = MemoryManager;
const importer = new ImportManager();
const search = new SemanticSearch();

await memory.initialize();
await importer.initialize();
await search.initialize();

// 2. Import data
const importResult = await importer.importFile('./chat-export.json', {
  autoConsolidate: false
});
console.log(`Imported ${importResult.episodeCount} episodes`);

// 3. Consolidate
const consolidationResult = await memory.consolidate({ force: true });
console.log(`Created ${consolidationResult.newConcepts} concepts`);

// 4. Enable HNSW (if large graph)
const stats = await memory.getStats();
if (stats.neocortex.totalConcepts > 100) {
  await search.enableHNSW();
  await search.rebuildHNSWIndex();
  console.log('HNSW enabled');
}

// 5. Query
const results = await memory.query('Python programming', {
  maxResults: 5,
  threshold: 0.7
});

for (const result of results) {
  console.log(`- ${result.name} (${result.importance.toFixed(2)})`);
  console.log(`  ${result.description}`);
}

// 6. Export to Obsidian
await memory.exportToObsidian('./exports/obsidian/');
console.log('Exported to Obsidian');
```

---

## 🔗 См. также

- [GETTING-STARTED.md](GETTING-STARTED.md) - Quick start guide
- [IMPORT-GUIDE.md](IMPORT-GUIDE.md) - Import documentation
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [README.md](../README.md) - System overview

---

**OpenClaw Memory v0.4.2**
*API Reference*
*Last updated: 12 апреля 2026*
