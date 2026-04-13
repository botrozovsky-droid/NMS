# User Guide

Complete guide to using OpenClaw NMS.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Basic Usage](#basic-usage)
4. [Advanced Features](#advanced-features)
5. [API Usage](#api-usage)

## Installation

```bash
git clone https://github.com/botrozovsky-droid/NMS.git
cd NMS
npm install
npm run setup
```

## Configuration

Edit `.env` file:
- `GEMINI_API_KEY` - Your Gemini API key (required)
- `DASHBOARD_PORT` - Dashboard port (default: 3000)
- `GEMINI_MODEL` - Model to use (default: gemini-1.5-flash)

## Basic Usage

### Store Memory
```javascript
import memoryManager from './memory-manager.js';

await memoryManager.store({
  type: 'conversation',
  content: 'User asked about memory systems',
  tags: ['memory', 'ai'],
  importance: 0.8
});
```

### Query Memory
```javascript
const results = await memoryManager.query('memory systems', {
  limit: 5,
  minRelevance: 0.6
});
```

### Run Consolidation
```bash
npm run consolidate
```

## Advanced Features

- **HNSW Vector Search** - Fast approximate search
- **Transactions** - ACID guarantees
- **Import System** - Load external data
- **Health Monitoring** - Quality checks
- **Obsidian Export** - Export to Markdown vault

## API Usage

See [API Reference](docs/API-REFERENCE.md) for complete documentation.

## Dashboard

```bash
npm run dashboard
```

Features:
- Interactive knowledge graph
- Health monitoring
- Search & filters
- Node explorer
- Import timeline
- Dark/light themes

## CLI Commands

```bash
npm run stats              # Show statistics
npm run consolidate        # Run consolidation
npm run search:info        # HNSW status
npm run import:file <path> # Import file
npm run export:obsidian    # Export to Obsidian
```

For more details, see [README.md](README.md).
