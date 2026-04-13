# Import Guide - OpenClaw Memory v0.5.2

**How to import external data into the memory system**

---

## 📖 Table of Contents

1. [Why Import](#why-import)
2. [Supported Formats](#supported-formats)
3. [CLI Import](#cli-import)
4. [Dashboard Import](#dashboard-import)
5. [Data Formats](#data-formats)
6. [Examples](#examples)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Why Import

OpenClaw Memory works with data from Claude Code (tool calls, messages).
But often you need to load **external data**:

- 💬 **Past chats** from ChatGPT, Claude.ai, Gemini
- 📚 **Project documentation** (README, guides)
- 📝 **Notes** and articles
- 💻 **Code** with comments/docstrings
- 📊 **Structured data** (CSV tables)

**Import system** allows you to load this data into the memory system.

---

## Supported Formats

| Format | Extensions | What's Extracted |
|--------|------------|------------------|
| **JSON** | `.json` | Chat exports (ChatGPT, Claude, Gemini, custom) |
| **Text** | `.txt`, `.md` | Documents, notes, articles |
| **CSV** | `.csv` | Structured data (concepts, facts) |
| **Code** | `.js`, `.py`, `.ts`, `.java`, `.cpp`, `.go`, `.rs` | Docstrings, comments, function signatures |

---

## CLI Import

### Commands:

```bash
# Import single file
npm run import:file -- path/to/file.json

# Import multiple files (batch)
npm run import:batch -- file1.txt file2.md file3.csv

# Import directory (recursive)
npm run import:dir -- path/to/docs/

# Show import history
npm run import:history
```

### Options:

```bash
# With automatic consolidation
npm run import:file -- file.json --consolidate

# With embedding generation
npm run import:file -- file.json --embeddings

# Both options
npm run import:file -- file.json --consolidate --embeddings
```

### Examples:

```bash
# Import ChatGPT chat
npm run import:file -- ~/Downloads/chatgpt-export.json

# Import all project documentation
npm run import:dir -- ./docs/

# Import and immediately consolidate
npm run import:file -- notes.txt --consolidate
```

---

## Dashboard Import

### Open Dashboard:
```bash
npm run dashboard
# → http://localhost:3000
```

### In the right panel, find the "📥 Quick Import" section:

1. **Drag & Drop** files into the upload zone
2. Or **click** to browse files
3. Select one or multiple files
4. Click **"Import to Memory"**

### Features:

- ✅ Drag & drop support
- ✅ Multi-file batch import
- ✅ Progress bar for batch operations
- ✅ Real-time import status
- ✅ File format validation
- ✅ Size warnings for large files (>5MB)
- ✅ Remove files from queue before import
- ✅ Import history timeline

### Import Timeline:

After importing, check the **"📅 Import Timeline"** section to see:
- File name and format
- Number of episodes created
- File size
- Import duration
- Time ago ("just now", "2h ago")
- Success/failure status

---

## Data Formats

### JSON Format (Chat Exports)

OpenClaw Memory auto-detects chat export formats:

#### ChatGPT Export

```json
{
  "title": "Conversation about X",
  "create_time": 1234567890,
  "mapping": {
    "uuid1": {
      "message": {
        "author": {"role": "user"},
        "content": {"parts": ["User message"]}
      }
    },
    "uuid2": {
      "message": {
        "author": {"role": "assistant"},
        "content": {"parts": ["Assistant response"]}
      }
    }
  }
}
```

#### Claude Export

```json
{
  "name": "Conversation about Y",
  "created_at": "2024-01-01T00:00:00.000Z",
  "chat_messages": [
    {
      "sender": "human",
      "text": "User message"
    },
    {
      "sender": "assistant",
      "text": "Assistant response"
    }
  ]
}
```

#### Gemini Export

```json
{
  "title": "Chat Title",
  "history": [
    {
      "role": "user",
      "parts": [{"text": "User message"}]
    },
    {
      "role": "model",
      "parts": [{"text": "Model response"}]
    }
  ]
}
```

#### Generic Format

If your chat export doesn't match these formats, create a generic array:

```json
[
  {
    "role": "user",
    "content": "User message",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  {
    "role": "assistant",
    "content": "Assistant response",
    "timestamp": "2024-01-01T00:01:00.000Z"
  }
]
```

### Text Format (Documents)

Import `.txt` or `.md` files:

**Features:**
- Smart chunking (splits into logical sections)
- Preserves headers and structure
- Extracts metadata from Markdown frontmatter

**Example:**

```markdown
# Project Documentation

## Installation

Install with npm...

## Usage

Run with...
```

Becomes:
- Episode 1: "Installation" section
- Episode 2: "Usage" section

### CSV Format (Structured Data)

Import concepts and facts from CSV:

```csv
concept,description,tags
Hebbian Learning,Neurons that fire together wire together,"neuroscience,learning"
HNSW,Hierarchical Navigable Small World graph,"algorithm,search"
```

**Required columns:**
- `concept` or `name` - concept name
- `description` or `definition` - concept description

**Optional columns:**
- `tags` - comma-separated tags
- `importance` - importance score (0-1)
- `category` - concept category

### Code Format (Source Files)

Import code with documentation:

**Supported:**
- JavaScript/TypeScript - JSDoc comments
- Python - docstrings
- Java - JavaDoc
- C++/C - Doxygen comments
- Go - godoc comments
- Rust - rustdoc comments

**Example (JavaScript):**

```javascript
/**
 * Calculate Hebbian weight update
 * @param {number} pre - Pre-synaptic activation
 * @param {number} post - Post-synaptic activation
 * @param {number} rate - Learning rate
 * @returns {number} Weight delta
 */
function hebbianUpdate(pre, post, rate) {
  return rate * pre * post;
}
```

Extracted as episode:
- Function name: `hebbianUpdate`
- Description: "Calculate Hebbian weight update"
- Parameters: pre, post, rate
- Returns: Weight delta

---

## Examples

### Example 1: Import ChatGPT Conversation

1. **Export** chat from ChatGPT:
   - Settings → Data Controls → Export Data
   - Download `conversations.json`

2. **Import** via CLI:
   ```bash
   npm run import:file -- ~/Downloads/conversations.json
   ```

3. **Or** via Dashboard:
   - Open dashboard
   - Drag `conversations.json` into upload zone
   - Click "Import to Memory"

4. **Check** import timeline to verify

### Example 2: Import Project Documentation

```bash
# Import all Markdown docs recursively
npm run import:dir -- ./docs/

# With consolidation
npm run import:dir -- ./docs/ --consolidate
```

Creates episodes for:
- Each major section in each .md file
- Preserves document structure
- Tags with file path

### Example 3: Import Code Repository

```bash
# Import all Python files
npm run import:batch -- src/**/*.py

# Import all JavaScript files
npm run import:batch -- src/**/*.js
```

Extracts:
- Function/class docstrings
- Inline comments
- Type annotations
- Function signatures

### Example 4: Import CSV Knowledge Base

```csv
concept,description,importance
React,JavaScript UI library,0.9
Vue,Progressive JavaScript framework,0.8
Angular,TypeScript web framework,0.7
```

```bash
npm run import:file -- knowledge-base.csv
```

Creates nodes for each concept with:
- Name from `concept` column
- Description from `description` column
- Importance weight

---

## Troubleshooting

### Import Fails with "Unsupported Format"

**Problem:** File extension not recognized

**Solution:**
- Check file extension (must be `.json`, `.txt`, `.md`, `.csv`, `.js`, `.py`, etc.)
- For generic JSON, ensure valid JSON structure
- For text, try `.txt` or `.md` extension

### Import Succeeds but No Episodes Created

**Problem:** File parsed but no data extracted

**Solutions:**
- **JSON:** Check format matches one of supported chat formats
- **Text:** File might be too small (need multiple paragraphs)
- **CSV:** Ensure headers include `concept` or `name` column
- **Code:** Add docstrings/comments to functions

### Import Very Slow for Large Files

**Problem:** File >10MB takes long time

**Solutions:**
- Split large files into smaller chunks
- For text files, split by sections
- For CSV, split into batches
- Use CLI import (faster than dashboard)

### Episodes Not Appearing in Graph

**Problem:** Import successful but graph unchanged

**Solution:**
- Imported episodes go to **hippocampus** (episodic memory)
- They appear in graph after **consolidation**
- Run consolidation manually:
  ```bash
  npm run consolidate
  ```
- Or wait for automatic nightly consolidation

### Import History Shows Failures

**Problem:** Some imports in timeline marked as failed

**Solutions:**
- Click on failed import to see error
- Check file format and content
- Verify file not corrupted
- Check console for detailed errors:
  ```bash
  npm run dashboard
  # Check terminal output
  ```

---

## FAQ

### Q: What happens to imported data?

**A:** Imported data becomes **episodic memories** in hippocampus:
1. Stored in `hippocampus/sessions/import-{timestamp}.json`
2. Indexed in daily-index
3. Consolidated into knowledge graph during nightly consolidation
4. Becomes nodes and edges in neocortex

### Q: Can I import while memory is running?

**A:** Yes! Import is transaction-safe:
- Dashboard import works while dashboard is running
- CLI import works anytime
- Multiple imports can run concurrently
- All use transaction manager for safety

### Q: How to import password-protected files?

**A:** Currently not supported. Solutions:
- Decrypt files before import
- Convert to plain text
- Extract relevant sections manually

### Q: Can I undo an import?

**A:** Not directly, but you can:
1. Check import history for import ID
2. Find session file: `hippocampus/sessions/import-{id}.json`
3. Delete the file manually
4. Episodes will be removed from next consolidation

Or use graph forget function:
1. Find nodes created by import
2. Use dashboard "Forget" button to delete nodes

### Q: What's the maximum file size?

**A:** Current limits:
- Dashboard upload: **50MB** (configurable in server.js)
- CLI import: **No hard limit** (limited by memory)
- Recommended: **<10MB** per file for best performance

For larger files:
- Split into smaller chunks
- Process in batches
- Use CLI instead of dashboard

### Q: How to import from Notion/Obsidian/Roam?

**A:** Export to Markdown:

**Notion:**
1. Export as Markdown & CSV
2. Import .md files: `npm run import:dir -- notion-export/`

**Obsidian:**
1. Already in Markdown format
2. Import vault: `npm run import:dir -- ~/vault/`

**Roam:**
1. Export as Markdown
2. Import files: `npm run import:dir -- roam-export/`

### Q: Can I import images/PDFs?

**A:** Not directly. Workarounds:
- **Images:** Extract text with OCR, save as .txt, import
- **PDFs:** Convert to text with pdf2txt, import .txt

Support for these formats may be added in future versions.

### Q: How to automate imports?

**A:** Use CLI in scripts:

```bash
#!/bin/bash
# daily-import.sh - Import daily notes

# Import today's journal
npm run import:file -- ~/notes/$(date +%Y-%m-%d).md --consolidate

# Import new docs
npm run import:dir -- ~/documents/recent/
```

Schedule with cron (Linux/Mac) or Task Scheduler (Windows).

---

## Need Help?

- 📚 Check [Troubleshooting Guide](TROUBLESHOOTING.md)
- 🔧 See [API Reference](API-REFERENCE.md)
- 💬 Open an issue on [GitHub](https://github.com/botrozovsky-droid/NMS/issues)
