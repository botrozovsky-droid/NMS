# Getting Started - OpenClaw Memory v0.4.2

**From zero to your first query in 5 minutes**

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** version 18 or higher
- **npm** version 9 or higher
- **Google Gemini API key** (free tier available)

### Check your versions:
```bash
node --version
# Should show v18.0.0 or higher

npm --version
# Should show 9.0.0 or higher
```

### Get a Gemini API key:
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** → **"Create API key in new project"**
4. Copy your API key (starts with `AIza...`)

---

## ⚡ Quick Install

### Step 1: Clone or Download

```bash
# Option A: If you have git
git clone <repository-url>
cd openclaw-memory

# Option B: If you downloaded a ZIP
unzip openclaw-memory-v0.4.2.zip
cd openclaw-memory
```

### Step 2: Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 50 packages in 5s
✅ Installation complete
```

### Step 3: Configure API Key

Create a `.env` file in the root directory:

```bash
# Windows
echo GEMINI_API_KEY=your_api_key_here > .env

# Mac/Linux
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

**Or manually create** `.env` file:
```
GEMINI_API_KEY=AIzaSyC...your_actual_key_here
```

⚠️ **Important:** Never commit `.env` to git! It's already in `.gitignore`.

### Step 4: Initialize System

The system creates its directory structure automatically on first use. Let's verify the installation:

```bash
npm run stats
```

**Expected output:**
```
🧠 OpenClaw Memory System - Statistics
=====================================

📊 Neocortex (Long-term Memory):
   Total Concepts: 0
   Total Relationships: 0
   Average Importance: N/A

📝 Hippocampus (Short-term Memory):
   Total Episodes: 0
   Total Sessions: 0

🔍 Semantic Search:
   Mode: Linear (switch to HNSW for 5-100x speedup)
   Embeddings: 0 cached

✅ System initialized successfully!
```

---

## 🎯 Your First Memory

Let's simulate a conversation that OpenClaw will remember.

### 1. Create a test session file:

Create `test-session.json`:
```json
{
  "sessionId": "test-session-001",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T10:05:00Z",
  "type": "conversation",
  "episodes": [
    {
      "episodeId": "test-session-001-ep0",
      "timestamp": "2024-01-15T10:00:00Z",
      "type": "conversation",
      "role": "user",
      "content": "What is Python?",
      "confidence": 0.95
    },
    {
      "episodeId": "test-session-001-ep1",
      "timestamp": "2024-01-15T10:00:05Z",
      "type": "conversation",
      "role": "assistant",
      "content": "Python is a high-level, interpreted programming language known for its simplicity and readability. It was created by Guido van Rossum and first released in 1991. Python supports multiple programming paradigms including procedural, object-oriented, and functional programming. It's widely used for web development, data science, machine learning, automation, and scripting.",
      "confidence": 0.95
    },
    {
      "episodeId": "test-session-001-ep2",
      "timestamp": "2024-01-15T10:01:00Z",
      "type": "conversation",
      "role": "user",
      "content": "What are Python's key features?",
      "confidence": 0.95
    },
    {
      "episodeId": "test-session-001-ep3",
      "timestamp": "2024-01-15T10:01:05Z",
      "type": "conversation",
      "role": "assistant",
      "content": "Python's key features include: dynamic typing, automatic memory management, extensive standard library (batteries included), cross-platform compatibility, strong community support, and clean syntax with indentation-based code blocks. Python also has excellent package management through pip and PyPI.",
      "confidence": 0.95
    }
  ]
}
```

### 2. Import the session:

```bash
# Copy to hippocampus
cp test-session.json hippocampus/sessions/

# Or use the import system
npm run import:file -- test-session.json
```

### 3. Consolidate the memory:

This converts short-term episodes into long-term concepts and relationships:

```bash
npm run consolidate
```

**Expected output (takes 10-30 seconds):**
```
🧠 OpenClaw Memory - Nightly Consolidation
=========================================

📊 Analysis Phase:
   Loading synaptic candidates...
   Found 4 episodes to process

🤖 Processing with Gemini...
   Analyzing batch 1/1 (4 episodes)...
   ✅ Analysis complete

💾 Storage Phase:
   New concepts: 2
   Updated concepts: 0
   New relationships: 1

🧹 Maintenance:
   Applied temporal decay
   Pruned weak connections: 0

✅ Consolidation completed in 12.5s
```

### 4. Query your memory:

```bash
npm run query "programming languages"
```

**Expected output:**
```
🔍 Searching memory for: "programming languages"

📊 Search Results:

1. Python [importance: 0.85]
   Type: programming-language
   Description: High-level, interpreted programming language known for
                simplicity and readability. Created by Guido van Rossum
                in 1991. Supports multiple paradigms.

   Related to:
   → dynamic typing
   → standard library
   → package management (pip)

🎯 Found 1 concept matching your query
```

---

## 🎨 Dashboard UI

OpenClaw includes a web dashboard for visualization and import.

### Start the dashboard:

```bash
npm run dashboard
```

**Expected output:**
```
🧠 OpenClaw Memory - Dashboard Server
====================================
📁 Memory root: C:\Users\Vlad\.openclaw\memory
🌐 Server running at: http://localhost:3000
✅ Ready for requests
```

### Open in browser:

Visit [http://localhost:3000](http://localhost:3000)

**Features:**
- 📊 **Statistics** - System overview (concepts, episodes, embeddings)
- 🔍 **Search** - Query your knowledge graph with semantic search
- 📥 **Import** - Upload files or paste text (JSON, TXT, MD, CSV, Code)
- 🌐 **Graph View** - D3.js visualization of concepts and relationships
- ⚙️ **Settings** - Configure search mode (Linear vs HNSW)

---

## 🚀 Next Steps

### 1. Import Real Data

Import your existing data from other sources:

```bash
# Import a chat export from ChatGPT
npm run import:file -- ~/Downloads/chatgpt-export.json

# Import project documentation
npm run import:dir -- ./docs/

# Import code with docstrings
npm run import:file -- src/main.py
```

See [IMPORT-GUIDE.md](IMPORT-GUIDE.md) for detailed instructions.

### 2. Enable HNSW Search (Faster)

For large knowledge graphs (100+ concepts), enable HNSW for 5-100x faster search:

```bash
# Enable HNSW mode
npm run search:enable-hnsw

# Rebuild index
npm run search:rebuild-hnsw

# Benchmark the difference
npm run search:benchmark
```

**Result:** Search time drops from ~50ms to <1ms on 1000+ concepts.

### 3. Integrate with Claude Code

OpenClaw is designed to work with Claude Code for persistent memory across sessions.

**Setup:**
1. Place OpenClaw in `~/.openclaw/memory/`
2. Claude Code automatically records tool calls and messages
3. Run consolidation nightly or after each session
4. Query previous conversations anytime

### 4. Export to Obsidian

Export your knowledge graph to Obsidian for visualization and note-taking:

```bash
npm run export:obsidian
```

Creates Markdown files in `exports/obsidian/` with:
- One file per concept
- Wikilinks for relationships
- Metadata frontmatter
- Import into Obsidian vault

### 5. Check Data Quality

OpenClaw includes built-in quality assurance:

```bash
# Detect contradictions
npm run check:contradictions

# Detect potential hallucinations
npm run check-quality

# Find and remove duplicates
npm run deduplicate
```

---

## 📚 Learn More

- **[IMPORT-GUIDE.md](IMPORT-GUIDE.md)** - Comprehensive import documentation
- **[API-REFERENCE.md](API-REFERENCE.md)** - Complete API documentation
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions
- **[README.md](../README.md)** - Full system overview

---

## 🔧 Common Commands

### Memory Operations
```bash
npm run stats              # Show memory statistics
npm run query "topic"      # Query knowledge graph
npm run recall             # Recall recent episodes
npm run consolidate        # Convert episodes to concepts
```

### Import Operations
```bash
npm run import:file -- file.json     # Import single file
npm run import:batch -- f1 f2 f3    # Import multiple files
npm run import:dir -- ./docs/       # Import directory
npm run import:history              # Show import history
```

### Search Operations
```bash
npm run search:info              # Show search configuration
npm run search:enable-hnsw       # Enable fast HNSW search
npm run search:rebuild-hnsw      # Rebuild HNSW index
npm run search:benchmark         # Compare Linear vs HNSW
```

### Quality Assurance
```bash
npm run check:contradictions     # Detect contradictions
npm run fix:contradictions       # Fix detected contradictions
npm run check-quality            # Detect hallucinations
npm run fix-quality              # Fix low-quality data
npm run deduplicate              # Remove duplicates
```

### Dashboard & Export
```bash
npm run dashboard                # Start web dashboard
npm run export:obsidian          # Export to Obsidian
```

### Testing
```bash
npm test                         # Run all tests
npm run test:v03                 # Run v0.3.x tests
npm run test:v03:semantic        # Test semantic search
npm run test:v03:transactions    # Test transactions
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file:
```
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash  # Optional, default: gemini-1.5-flash
DASHBOARD_PORT=3000            # Optional, default: 3000
```

### Learning Parameters

Edit `neocortex/learning-params.json` to customize:

```json
{
  "parameters": {
    "hebbian": {
      "learningRate": 0.1,
      "decayRate": 0.05,
      "reinforcementThreshold": 0.3
    },
    "consolidation": {
      "importanceThreshold": 0.6,
      "minEpisodes": 3,
      "batchSize": 50
    },
    "semantic": {
      "similarityThreshold": 0.75,
      "maxResults": 10
    }
  }
}
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module"
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "GEMINI_API_KEY not found"
```bash
# Solution: Check .env file exists and has correct format
cat .env
# Should show: GEMINI_API_KEY=AIza...
```

### Issue: "Port 3000 already in use"
```bash
# Solution: Kill process on port 3000
# Windows
netstat -ano | grep ":3000"
taskkill //PID <pid> //F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: "Semantic search not working"
```bash
# Solution: Check search configuration
npm run search:info

# Rebuild embeddings cache if corrupted
rm -rf neocortex/embeddings-cache.json
npm run query "test"  # Will rebuild cache
```

### More Issues?

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

---

## 💡 Tips

1. **Run consolidation regularly** - Either nightly via cron/Task Scheduler, or after each session:
   ```bash
   npm run consolidate
   ```

2. **Use the dashboard for imports** - Easier than CLI for one-off imports:
   ```bash
   npm run dashboard
   # Then drag & drop files in the browser
   ```

3. **Enable HNSW early** - If you plan to have 100+ concepts, enable HNSW from the start:
   ```bash
   npm run search:enable-hnsw
   ```

4. **Back up your data** - The entire memory system is in these directories:
   ```bash
   # Backup
   cp -r neocortex neocortex.backup
   cp -r hippocampus hippocampus.backup

   # Restore
   cp -r neocortex.backup neocortex
   cp -r hippocampus.backup hippocampus
   ```

5. **Monitor memory usage** - Check stats regularly:
   ```bash
   npm run stats
   npm run session-stats
   npm run tx-stats
   ```

---

## 🎓 Understanding the System

### Memory Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Your Application                   │
│              (Claude Code, Custom App)              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Hippocampus (Short-term)               │
│  - Stores episodes (conversations, tool calls)      │
│  - Organized by sessions                            │
│  - Temporary storage (hours to days)                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼ Consolidation (nightly or on-demand)
┌─────────────────────────────────────────────────────┐
│               Neocortex (Long-term)                 │
│  - Stores concepts & relationships                  │
│  - Knowledge graph structure                        │
│  - Hebbian learning & decay                         │
│  - Permanent storage (months to years)              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│             Semantic Search (HNSW/Linear)           │
│  - Vector embeddings (Gemini API)                   │
│  - Fast similarity search                           │
│  - Cached for performance                           │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **Recording**: Your app records episodes → `hippocampus/sessions/`
2. **Consolidation**: Gemini analyzes episodes → extracts concepts/relationships → stores in `neocortex/knowledge-graph.json`
3. **Querying**: You query → system generates embedding → HNSW search → returns relevant concepts
4. **Learning**: Repeated access → Hebbian strengthening → concepts become more important

---

## ✅ You're Ready!

You've successfully:
- ✅ Installed OpenClaw Memory
- ✅ Configured your API key
- ✅ Created your first memory
- ✅ Consolidated episodes into concepts
- ✅ Queried your knowledge graph
- ✅ Explored the dashboard

**What's next?** Start importing your real data and integrating with your applications!

---

**OpenClaw Memory v0.4.2**
*Getting Started Guide*
*Last updated: 12 апреля 2026*
