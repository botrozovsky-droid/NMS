# OpenClaw NMS - Technical Whitepaper

**Neurobiological Memory System for AI**

---

## Abstract

OpenClaw NMS is a long-term memory system for AI agents inspired by neurobiology. It implements hippocampal-neocortical consolidation, Hebbian learning, and temporal decay to provide human-like memory capabilities.

## Architecture

### 4-Layer System

1. **Sensory Buffer** - Captures all session events (100% capture rate)
2. **Hippocampus** - Episodic memory with fast indexing
3. **Neocortex** - Semantic knowledge graph with weighted connections
4. **Procedural Memory** - Action patterns and preferences

### Consolidation Process

**Hippocampus → Neocortex**

Similar to sleep in humans, consolidation transforms episodic memories into semantic knowledge:

1. **Episode Selection** - Choose important episodes based on recency, importance, novelty
2. **Pattern Analysis** - LLM (Gemini) identifies concepts and relationships
3. **Graph Update** - Create/update nodes and edges
4. **Hebbian Learning** - Strengthen connections through repetition
5. **Temporal Decay** - Weaken old, unreinforced connections

## Hebbian Learning

**"Neurons that fire together, wire together"**

Weight update formula:
```
Δw = η × pre × post
```

Where:
- `η` = learning rate
- `pre` = pre-synaptic activation
- `post` = post-synaptic activation

Connections strengthen with co-activation and weaken over time without reinforcement.

## HNSW Vector Search

For graphs >1000 nodes, we use Hierarchical Navigable Small World (HNSW) algorithm:

- **100-1000x faster** than linear search
- Approximate Nearest Neighbor (ANN)
- Configurable precision/speed tradeoff
- Automatic activation based on graph size

## Transaction Safety

ACID guarantees:
- **Atomicity** - All-or-nothing operations
- **Consistency** - Valid states only
- **Isolation** - No interference between operations
- **Durability** - Persistent storage with backups

## Performance

- **Storage:** O(1) insertion
- **Search:** O(log n) with HNSW, O(n) linear fallback
- **Consolidation:** O(k) where k = batch size
- **Memory:** ~1MB per 1000 nodes

## Use Cases

- AI assistants with long-term memory
- Chatbots that remember conversations
- Knowledge management systems
- Personal AI companions
- Research assistants

## Future Work

- Multi-user support
- Distributed consolidation
- Advanced forgetting strategies
- Cross-modal memory (images, audio)
- Reinforcement learning integration

## References

1. Hebbian Learning - D.O. Hebb, 1949
2. HNSW Algorithm - Malkov & Yashunin, 2018
3. Memory Consolidation - McClelland et al., 1995

---

For implementation details, see [README.md](README.md) and [Architecture Guide](NMS-ARCHITECTURE.md).
