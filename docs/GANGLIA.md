# Ganglia - Semantic Anchors

## Overview

Ganglia are manually curated high-value nodes that serve as semantic anchors in the knowledge graph. Unlike automatically extracted nodes, ganglia are created proactively with rich context and attract related knowledge automatically.

## Concept

**Traditional systems:**
- Extract nodes from data (reactive)
- Discover central nodes post-factum (PageRank, betweenness centrality)
- High computational cost, no user intent

**Ganglia approach:**
- User creates semantic anchors proactively
- AI enriches with contextual questions
- Automatic attraction of related knowledge
- Protection from decay/forgetting

## Architecture

### Core Components

**GangliaManager** (`lib/ganglia-manager.js`)
- Interactive enrichment via LLM
- CRUD operations for ganglia
- Health monitoring (bloat detection)
- Semantic auto-linking

**CLI** (`scripts/ganglia.js`)
- Interactive creation workflow
- List/show/delete operations
- Statistics

**Auto-linker** (`scripts/link-to-ganglia.js`)
- Semantic similarity calculation
- Batch linking of existing nodes
- Configurable threshold

### Database Schema

```sql
-- nodes table
is_manual BOOLEAN DEFAULT 0  -- Marks ganglia

-- Indexes
CREATE INDEX idx_nodes_manual ON nodes(is_manual);
```

Ganglia stored as regular nodes with `is_manual = 1` flag.

## Features

### 1. Interactive Enrichment

When creating a ganglia, LLM generates 3-5 contextual questions:

1. **Context** - commercial/research/hobby/learning
2. **Expertise level** - beginner/intermediate/expert
3. **Subtopics** - key areas of interest
4. **Relations** - connected projects/topics
5. **Time horizon** - one-time/short-term/long-term

Answers stored in metadata for semantic matching.

### 2. High Default Weight

- Initial weight: `10.0` (vs `0.0` for auto-nodes)
- Minimum after decay: `5.0`
- Protection from forgetting

### 3. Automatic Attraction

Semantic similarity check during consolidation:
- Threshold: `0.7` (configurable)
- Auto-creates edges to related nodes
- Tracks auto-link count

### 4. Health Monitoring

Detects "bloat" (spam connections):
- If >80% auto-linked with low confidence (<0.6)
- Flags for manual review
- Prevents context pollution

### 5. Soft Limit

Maximum 50 active ganglia to prevent over-structuring.

## Usage

### Create Ganglia

```bash
npm run ganglia:create
```

Interactive prompts:
```
Name: Fly Breeding
Type: project
Description: Commercial fly breeding for fishing industry

[AI generates contextual questions]

Q: Main context?
> Commercial

Q: Expertise level?
> Beginner

Q: Key subtopics? (comma-separated)
> drosophila care, breeding cycles, business model

...
```

### List Ganglia

```bash
npm run ganglia:list
```

Output:
```
Total: 3

📍 Fly Breeding (project)
   ID: ganglia_1739284562_abc123
   Weight: 10.00 | Connections: 12 (5 auto)
   Context: commercial | Horizon: long-term
   Created: 2026-04-14 15:30:00
```

### Show Details

```bash
npm run ganglia:show ganglia_1739284562_abc123
```

Shows:
- Full metadata
- All connections (edges)
- Health status
- Auto-link ratio

### Delete Ganglia

```bash
npm run ganglia:delete ganglia_1739284562_abc123
```

Requires confirmation. Removes ganglia and all edges.

### Statistics

```bash
npm run ganglia:stats
```

Shows:
- Total ganglia
- Connections count
- Average weight
- Distribution by type

### Auto-link Existing Nodes

```bash
# Dry run
npm run ganglia:link -- --dry-run

# Execute with default threshold (0.7)
npm run ganglia:link

# Custom threshold
npm run ganglia:link -- --threshold=0.6
```

Calculates semantic similarity for all non-ganglia nodes and creates edges above threshold.

## API

### GangliaManager

```javascript
import { GangliaManager } from './lib/ganglia-manager.js';

const manager = new GangliaManager(dbPath);

// Generate questions
const questions = await manager.generateEnrichmentQuestions(name, description);
// Returns: [{ q: "...", type: "context|expertise|..." }, ...]

// Create
const ganglia = await manager.createGanglia(name, type, description, answers);
// Returns: { id, name, type, weight, metadata, ... }

// List
const list = manager.listGanglia();
// Returns: [{ id, name, type, weight, connections, ... }, ...]

// Get details
const details = manager.getGanglia(gangliaId);
// Returns: { ...node, metadata, edges, health }

// Update
manager.updateGanglia(gangliaId, { weight: 12.0 });

// Delete
manager.deleteGanglia(gangliaId);

// Link node to ganglia
await manager.linkToGanglia(nodeId, gangliaId, similarity, metadata);

// Check health
const health = manager.checkHealth(gangliaId);
// Returns: { status: "healthy|bloated|new", message, auto_ratio }

manager.close();
```

## Configuration

### Constants

```javascript
// lib/ganglia-manager.js
const DEFAULT_WEIGHT = 10.0;
const MIN_WEIGHT_AFTER_DECAY = 5.0;
const MAX_ACTIVE_GANGLIA = 50;

// scripts/link-to-ganglia.js
const SIMILARITY_THRESHOLD = 0.7;
```

Modify as needed for your use case.

## Workflow

### 1. Create Ganglia

Define semantic anchors for key topics/projects before accumulating knowledge.

```bash
npm run ganglia:create
```

### 2. Consolidate Episodes

Normal consolidation process extracts nodes/edges from episodes.

```bash
npm run consolidate
```

### 3. Auto-link to Ganglia

After consolidation, connect new nodes to relevant ganglia.

```bash
npm run ganglia:link
```

### 4. Monitor Health

Periodically check for bloated ganglia.

```bash
npm run ganglia:list
npm run ganglia:show <id>
```

If health status is "bloated", review auto-linked edges manually.

## Performance

**Creation:**
- 3-5 LLM API calls (questions + parsing)
- ~2-5 seconds total

**Auto-linking:**
- 1 LLM API call per node-ganglia pair
- With 100 nodes and 5 ganglia: ~500 calls
- Rate limited to ~10 req/sec: ~50 seconds

**Recommendation:** Run `ganglia:link` as nightly batch job, not real-time.

## Comparison with Other Approaches

| System | Method | Pros | Cons |
|--------|--------|------|------|
| **SwarmVault** | Auto-detect hubs (connectivity) | No manual work | Reactive, no intent |
| **nashsu/llm_wiki** | Louvain clustering | Finds gaps | High compute cost |
| **Cuba-Memorys** | PageRank protection | Prevents forgetting | Complex (Rust + PostgreSQL) |
| **AI Context OS** | Spam detection | Cleans bloat | Manual micromanagement |
| **OmegaWiki** | Static foundations | Simple, reliable | No evolution |
| **NMS Ganglia** | Interactive + auto | Proactive, intent-driven | Requires user input |

NMS combines manual control with automatic enrichment and attraction.

## Limitations

1. **Manual effort** - User must create ganglia
2. **API cost** - Auto-linking requires LLM calls
3. **Not real-time** - Link after consolidation (batch)
4. **Soft limit** - Max 50 ganglia (can be increased)

## Future Enhancements

**Phase 2.1:**
- Direct integration in consolidation pipeline
- Real-time auto-linking during consolidation
- Dashboard UI for ganglia management

**Phase 2.2:**
- Ganglia templates (pre-defined question sets by domain)
- Bulk import from YAML/JSON
- Hierarchical ganglia (parent-child relationships)
- Auto-suggest ganglia based on episode analysis

## Implementation Details

### Node Structure

```javascript
{
  id: "ganglia_1739284562_abc123",
  name: "Fly Breeding",
  type: "project",
  weight: 10.0,
  confidence: 1.0,
  is_manual: true,
  metadata: {
    description: "Commercial fly breeding...",
    context: "commercial",
    expertise_level: "beginner",
    subtopics: ["drosophila_care", "breeding_cycles"],
    related_projects: ["fishing_equipment"],
    horizon: "long-term",
    creation_date: 1739284562000,
    enrichment_data: { /* original answers */ },
    health_status: "healthy",
    auto_link_count: 5
  }
}
```

### Edge Structure

```javascript
{
  id: "edge_...",
  source_id: "node_xyz",
  target_id: "ganglia_abc",
  type: "related_to",
  weight: 0.85,  // similarity score
  metadata: {
    auto_linked: true,
    confidence: 0.85,
    linked_at: 1739284600000,
    method: "auto-semantic"
  }
}
```

## Testing

```bash
# Create test ganglia
npm run ganglia:create
# Name: Test Project
# Type: project
# ...

# Check creation
npm run ganglia:list

# Test linking (dry run)
npm run ganglia:link -- --dry-run

# View details
npm run ganglia:show <id>

# Cleanup
npm run ganglia:delete <id>
```

## Troubleshooting

**"Maximum 50 ganglia allowed"**
- Delete unused ganglia
- Or increase `MAX_ACTIVE_GANGLIA` in `lib/ganglia-manager.js`

**"Ganglia already exists"**
- Use unique (name, type) combinations
- Or delete existing ganglia first

**Auto-linking too slow**
- Reduce threshold (`--threshold=0.8`)
- Run as background job
- Batch process smaller subsets

**Health status "bloated"**
- Review auto-linked edges manually
- Delete low-value connections
- Adjust similarity threshold

## Version

Introduced in **v0.8.0** (Phase 2 - Semantic Anchors)

Built on SQLite storage v0.7.0.
