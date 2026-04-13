# HNSW Vector Search Guide

**Fast semantic search for large knowledge graphs**

---

## What is HNSW?

Hierarchical Navigable Small World (HNSW) is an approximate nearest neighbor (ANN) algorithm that provides:

- **100-1000x faster** search than linear scan
- **High accuracy** (>95% recall)
- **Scalable** to millions of vectors

## When to Use

HNSW activates automatically when your knowledge graph exceeds 1000 nodes.

**Performance comparison:**

| Nodes | Linear Search | HNSW Search | Speedup |
|-------|---------------|-------------|---------|
| 100   | 0.02s         | 0.02s       | 1x      |
| 1,000 | 2.0s          | 0.01s       | 200x    |
| 10,000| 20s           | 0.02s       | 1000x   |

## Configuration

Edit `neocortex/search-config.json`:

```json
{
  "mode": "hnsw",
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 100
  },
  "autoActivate": {
    "enabled": true,
    "threshold": 1000
  }
}
```

### Parameters

- **M** (default: 16) - Number of connections per layer
  - Higher = better accuracy, more memory
  - Range: 8-64
  
- **efConstruction** (default: 200) - Index build quality
  - Higher = better accuracy, slower build
  - Range: 100-500
  
- **efSearch** (default: 100) - Search quality
  - Higher = better accuracy, slower search
  - Range: 50-500

## CLI Commands

```bash
# Check HNSW status
npm run search:info

# Enable HNSW manually
npm run search:enable-hnsw

# Disable HNSW
npm run search:disable-hnsw

# Rebuild index
npm run search:rebuild-hnsw

# Run benchmark
npm run search:benchmark
```

## Benchmark Results

```bash
npm run search:benchmark
```

Output:
```
🔬 Search Benchmark
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Linear Search:
  10 queries: 1.234s avg
  Recall: 100%

HNSW Search:
  10 queries: 0.006s avg
  Recall: 97.3%
  Speedup: 205x
```

## Tuning Guide

### For Speed
```json
{
  "M": 8,
  "efConstruction": 100,
  "efSearch": 50
}
```

### For Accuracy
```json
{
  "M": 32,
  "efConstruction": 400,
  "efSearch": 200
}
```

### Balanced (Recommended)
```json
{
  "M": 16,
  "efConstruction": 200,
  "efSearch": 100
}
```

## Troubleshooting

### Index Build Fails

**Problem:** Out of memory during index build

**Solution:**
- Reduce `efConstruction` to 100
- Reduce `M` to 8
- Build in batches

### Low Recall

**Problem:** Search returns irrelevant results

**Solution:**
- Increase `efSearch` to 200
- Rebuild index with higher `efConstruction`
- Check embedding quality

### Slow Search

**Problem:** Search slower than expected

**Solution:**
- Reduce `efSearch` to 50
- Check if index needs rebuild
- Verify HNSW is actually enabled

## How It Works

HNSW builds a multi-layer graph:

```
Layer 2:    o---o
           /     \
Layer 1:  o---o---o---o
         /|\ /|\ /|\ /|\
Layer 0: All nodes connected
```

Search process:
1. Start at top layer
2. Navigate to nearest neighbor
3. Drop to next layer
4. Repeat until bottom layer
5. Return k nearest neighbors

This logarithmic search is much faster than linear scan.

---

For more details, see [Semantic Search Documentation](docs/API-REFERENCE.md#semantic-search).
