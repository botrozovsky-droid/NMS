# Troubleshooting - OpenClaw Memory v0.4.2

**Solutions to common issues and error messages**

---

## 📖 Contents

1. [Installation Issues](#installation-issues)
2. [API Key & Authentication](#api-key--authentication)
3. [Import Issues](#import-issues)
4. [Search Issues](#search-issues)
5. [Dashboard Issues](#dashboard-issues)
6. [Memory Issues](#memory-issues)
7. [Performance Issues](#performance-issues)
8. [Data Issues](#data-issues)
9. [Transaction Issues](#transaction-issues)
10. [Known Issues](#known-issues)

---

## Installation Issues

### Issue: "Cannot find module"

**Error:**
```
Error: Cannot find module 'express'
```

**Cause:** Dependencies not installed or corrupted

**Solution:**
```bash
# Remove and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify installation
npm list --depth=0
```

---

### Issue: "Node.js version too old"

**Error:**
```
Error: The engine "node" is incompatible with this module
```

**Cause:** Node.js version <18

**Solution:**
```bash
# Check your version
node --version

# If < v18.0.0, update Node.js:
# - Windows: Download from https://nodejs.org/
# - Mac: brew install node@18
# - Linux: nvm install 18
```

---

### Issue: "npm install fails on Windows"

**Error:**
```
gyp ERR! build error
gyp ERR! stack Error: `C:\Program Files\...` failed with exit code: 1
```

**Cause:** Missing build tools for native modules

**Solution:**
```bash
# Install Windows Build Tools
npm install --global windows-build-tools

# Or use Visual Studio Build Tools:
# https://visualstudio.microsoft.com/downloads/
```

---

## API Key & Authentication

### Issue: "GEMINI_API_KEY not found"

**Error:**
```
Error: GEMINI_API_KEY not found in environment variables
```

**Cause:** `.env` file missing or improperly formatted

**Solution:**
```bash
# Create .env file in project root
echo "GEMINI_API_KEY=your_api_key_here" > .env

# Verify file exists and has correct format
cat .env
# Should show: GEMINI_API_KEY=AIza...

# Make sure .env is in the same directory as package.json
ls -la | grep .env
```

---

### Issue: "Invalid API key"

**Error:**
```
Error: Failed to generate embedding: 400 Bad Request - API key not valid
```

**Cause:** Incorrect API key or expired key

**Solution:**
1. **Verify your API key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Check if your key is listed and active
   - Generate a new key if needed

2. **Update .env:**
   ```bash
   # Replace with new key
   echo "GEMINI_API_KEY=new_key_here" > .env
   ```

3. **Restart any running processes:**
   ```bash
   # Ctrl+C to stop
   # Then restart (e.g., npm run dashboard)
   ```

---

### Issue: "API quota exceeded"

**Error:**
```
Error: Failed to generate embedding: 429 Too Many Requests - Quota exceeded
```

**Cause:** Hit Gemini API rate limit (60 req/min free tier)

**Solutions:**
1. **Wait and retry:**
   ```bash
   # Wait 1 minute, then retry
   sleep 60 && npm run consolidate
   ```

2. **Reduce batch size** (in `neocortex/learning-params.json`):
   ```json
   {
     "parameters": {
       "consolidation": {
         "batchSize": 20  // Reduce from 50 to 20
       }
     }
   }
   ```

3. **Upgrade to paid tier:**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Enable billing for higher limits (1000 req/min)

---

## Import Issues

### Issue: "Unknown JSON format"

**Error:**
```
Error: Unknown JSON format - could not detect structure
```

**Cause:** JSON doesn't match any supported format (ChatGPT, Claude, Gemini, Generic)

**Solution:**
Use the **Generic format**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Your message here",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Response here",
      "timestamp": "2024-01-15T10:00:05Z"
    }
  ]
}
```

Or **Custom format** for concepts:
```json
{
  "concepts": [
    {
      "name": "Python",
      "type": "programming-language",
      "description": "...",
      "importance": 0.8
    }
  ]
}
```

---

### Issue: "File too large"

**Error:**
```
Error: File size exceeds limit (50MB)
```

**Cause:** Import file >50MB

**Solutions:**
1. **Split file into smaller parts:**
   ```bash
   # Split JSON file (Unix)
   split -l 1000 large-file.json chunk_

   # Import each chunk
   npm run import:batch -- chunk_*
   ```

2. **Increase limit** (in `dashboard/server.js`):
   ```javascript
   const upload = multer({
     dest: join(tmpdir(), 'openclaw-uploads'),
     limits: { fileSize: 100 * 1024 * 1024 } // 100MB
   });
   ```

3. **Use CLI instead of Dashboard:**
   ```bash
   # CLI has no file size limit
   npm run import:file -- large-file.json
   ```

---

### Issue: "Import heap out of memory"

**Error:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

**Cause:** JavaScript memory limit exceeded (usually on repeated imports)

**Solutions:**
1. **Increase Node.js heap size:**
   ```bash
   # Increase to 4GB
   NODE_OPTIONS="--max-old-space-size=4096" npm run import:file -- large.json
   ```

2. **Restart dashboard between imports:**
   ```bash
   # Stop dashboard (Ctrl+C)
   npm run dashboard
   ```

3. **Import smaller batches:**
   ```bash
   # Split directory into subdirectories
   # Import one subdirectory at a time
   npm run import:dir -- ./docs/part1/
   npm run import:dir -- ./docs/part2/
   ```

**Note:** This is a known issue in v0.4.2, fixed in v0.4.3.

---

### Issue: "Text chunking too aggressive"

**Symptom:** Document split into too many small episodes

**Cause:** Plain text files split by character count

**Solutions:**
1. **Convert to Markdown with headers:**
   ```markdown
   # Section 1
   Content for section 1...

   ## Subsection 1.1
   Content for subsection...

   # Section 2
   Content for section 2...
   ```

   Markdown splits by headers (cleaner structure).

2. **Increase chunk size** (requires code change in `src/formats/text-parser.js`):
   ```javascript
   // Line 123
   const chunkSize = 2000;  // Increase from 1000 to 2000
   ```

---

### Issue: "Code docstrings not extracted"

**Symptom:** Importing code file creates 0 episodes

**Cause:** Docstrings not in expected format

**Solutions:**
1. **Check docstring format:**

   **Python** - Must use triple quotes:
   ```python
   def my_function():
       """This is a valid docstring."""
       pass

   # NOT extracted (single quotes):
   def my_function():
       'This will not be extracted'
       pass
   ```

   **JavaScript** - Must use JSDoc format:
   ```javascript
   /**
    * This is a valid JSDoc comment
    */
   function myFunction() {}

   /* This will NOT be extracted (not JSDoc) */
   function myFunction() {}
   ```

2. **Check file extension:**
   ```bash
   # Supported:
   .js, .mjs, .ts, .tsx, .py, .java, .cpp, .c, .go, .rs

   # Not supported:
   .php, .rb, .swift, .kt, etc.
   ```

---

## Search Issues

### Issue: "Semantic search returns no results"

**Symptom:** Query always returns 0 results

**Causes & Solutions:**

**1. No concepts in knowledge graph:**
```bash
npm run stats
# Check "Total Concepts"

# If 0, run consolidation:
npm run consolidate
```

**2. Similarity threshold too high:**
Edit `neocortex/learning-params.json`:
```json
{
  "parameters": {
    "semantic": {
      "similarityThreshold": 0.6  // Reduce from 0.75 to 0.6
    }
  }
}
```

**3. No embeddings cached:**
```bash
npm run search:info
# Check "Embeddings cached"

# If 0, run:
npm run query "test"  # Will rebuild cache
```

---

### Issue: "HNSW search not working"

**Error:**
```
Error: HNSW index not found
```

**Cause:** HNSW enabled but index not built

**Solution:**
```bash
# Rebuild HNSW index
npm run search:rebuild-hnsw

# Verify
npm run search:info
# Should show: Mode: HNSW, Index: 157 vectors
```

---

### Issue: "Search is slow"

**Symptom:** Queries take >1 second

**Causes & Solutions:**

**1. Using Linear mode on large graph:**
```bash
npm run stats
# If Total Concepts > 100:

npm run search:enable-hnsw
npm run search:rebuild-hnsw

# Benchmark improvement:
npm run search:benchmark
```

**2. Embeddings cache missing:**
```bash
# Check cache
ls -lh neocortex/embeddings-cache.json

# Rebuild if corrupted
rm neocortex/embeddings-cache.json
npm run query "test"  # Rebuilds cache
```

**3. HNSW parameters need tuning:**
Edit `neocortex/semantic-config.json`:
```json
{
  "hnsw": {
    "M": 16,
    "efConstruction": 200,
    "efSearch": 50  // Reduce for faster (less accurate) search
  }
}
```

---

## Dashboard Issues

### Issue: "Port 3000 already in use"

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause:** Another process using port 3000

**Solution:**

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual PID)
taskkill //PID <PID> //F
```

**Mac/Linux:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

**Alternative:** Change port in `dashboard/server.js`:
```javascript
const PORT = process.env.DASHBOARD_PORT || 3001;  // Change to 3001
```

Or use `.env`:
```bash
echo "DASHBOARD_PORT=3001" >> .env
```

---

### Issue: "Dashboard shows no data"

**Symptom:** Dashboard loads but shows 0 concepts, 0 episodes

**Causes & Solutions:**

**1. No data in system:**
```bash
npm run stats
# If all counts are 0, import some data:
npm run import:file -- test-data.json
npm run consolidate
```

**2. Dashboard pointing to wrong directory:**
Check `dashboard/server.js` line 20:
```javascript
const memoryRoot = process.env.MEMORY_ROOT || path.join(dirname(__dirname));
```

Set `MEMORY_ROOT` in `.env` if needed:
```bash
echo "MEMORY_ROOT=C:/Users/Vlad/.openclaw/memory" >> .env
```

**3. API endpoints not responding:**
```bash
# Test API directly
curl http://localhost:3000/api/stats

# Should return JSON with stats
# If not, check server logs
```

---

### Issue: "Import endpoint returns 404"

**Error:**
```
POST http://localhost:3000/api/import/file 404 Not Found
```

**Cause:** Old dashboard process still running with old code

**Solution:**
```bash
# Kill all Node processes
# Windows
taskkill //IM node.exe //F

# Mac/Linux
killall node

# Restart dashboard
npm run dashboard
```

---

### Issue: "File upload fails silently"

**Symptom:** File upload completes but nothing imported

**Causes & Solutions:**

**1. Check browser console:**
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

**2. Check server logs:**
   - Look at terminal where dashboard is running
   - Should see: "Import request received: filename.json"

**3. Check temp directory permissions:**
   ```bash
   # Windows
   echo %TEMP%
   # Should be writable

   # Mac/Linux
   ls -la /tmp/openclaw-uploads/
   ```

---

## Memory Issues

### Issue: "Episodes not consolidating"

**Symptom:** Run consolidation but 0 concepts created

**Causes & Solutions:**

**1. Not enough episodes:**
```bash
npm run stats
# Check "Total Episodes"

# Need at least 3 episodes (minEpisodes setting)
# Import more data or lower threshold in learning-params.json:
{
  "parameters": {
    "consolidation": {
      "minEpisodes": 1  // Lower from 3 to 1
    }
  }
}
```

**2. Episodes below importance threshold:**
Edit `neocortex/learning-params.json`:
```json
{
  "parameters": {
    "consolidation": {
      "importanceThreshold": 0.4  // Lower from 0.6
    }
  }
}
```

**3. Synaptic candidates empty:**
```bash
# Check candidates file
cat hippocampus/synaptic-candidates.json

# If empty or missing, regenerate:
npm run recall
npm run consolidate
```

---

### Issue: "Knowledge graph file not found"

**Error:**
```
Error: ENOENT: no such file or directory 'neocortex/knowledge-graph.json'
```

**Cause:** First run, knowledge graph not initialized

**Solution:**
```bash
# Initialize knowledge graph by running consolidation
npm run consolidate

# This creates:
# - neocortex/knowledge-graph.json
# - neocortex/learning-params.json
# - neocortex/meta-graph.json
```

---

### Issue: "Duplicates after import"

**Symptom:** Same concept appears multiple times

**Cause:** Import doesn't check for duplicates

**Solution:**
```bash
# Run deduplication
npm run deduplicate

# Shows detected duplicates and merges them
```

**Prevention:**
- Use canonical forms (e.g., "Python" not "python" or "PYTHON")
- Check existing concepts before importing similar data

---

## Performance Issues

### Issue: "Consolidation takes too long"

**Symptom:** Consolidation >5 minutes

**Causes & Solutions:**

**1. Too many episodes in one batch:**
```bash
# Check episode count
npm run stats

# If >1000 episodes, reduce batch size:
# Edit neocortex/learning-params.json
{
  "parameters": {
    "consolidation": {
      "batchSize": 20,  // Reduce from 50
      "maxBatches": 10  // Limit total batches
    }
  }
}
```

**2. Slow Gemini API responses:**
```bash
# Benchmark API speed
time npm run query "test"

# If >10s, check:
# - Internet connection
# - Gemini API status: https://status.cloud.google.com/
# - Try different Gemini model in .env:
echo "GEMINI_MODEL=gemini-1.5-pro" >> .env
```

**3. Embeddings generation slow:**
```bash
# Embeddings are cached, first run is slow
# Subsequent runs should be faster

# Check cache
ls -lh neocortex/embeddings-cache.json
```

---

### Issue: "High memory usage"

**Symptom:** Node.js process using >2GB RAM

**Causes & Solutions:**

**1. Large knowledge graph loaded in memory:**
```bash
# Check knowledge graph size
ls -lh neocortex/knowledge-graph.json

# If >50MB, consider pruning weak connections:
{
  "parameters": {
    "hebbian": {
      "pruneThreshold": 0.2  // Increase from 0.1 to prune more
    }
  }
}

npm run consolidate  # Applies pruning
```

**2. Embeddings cache too large:**
```bash
# Check cache size
ls -lh neocortex/embeddings-cache.json

# If >100MB, clear old embeddings:
rm neocortex/embeddings-cache.json
npm run query "test"  # Rebuilds cache
```

**3. Too many backups:**
```bash
# Check backup count
ls hippocampus/backups/ | wc -l

# Cleanup old backups (keeps last 10)
npm run tx-cleanup
```

---

## Data Issues

### Issue: "Contradictions detected"

**Warning:**
```
⚠️ Contradiction detected:
   Concept: Python
   Statement 1: "Python is statically typed"
   Statement 2: "Python uses dynamic typing"
```

**Cause:** Conflicting information in imported data

**Solution:**
```bash
# Check all contradictions
npm run check:contradictions

# Review and fix automatically (keeps higher confidence)
npm run fix:contradictions

# Or manually edit knowledge-graph.json
```

---

### Issue: "Low confidence warnings"

**Warning:**
```
⚠️ Low confidence concept flagged:
   Concept: "Unclear feature"
   Confidence: 0.45
```

**Cause:** Concept created from vague or inconsistent episodes

**Solution:**
```bash
# Check all quality issues
npm run check-quality

# Review flagged items
cat neocortex/knowledge-graph.json | grep '"flags"'

# Remove low-quality concepts
npm run fix-quality
```

---

### Issue: "Missing relationships"

**Symptom:** Concepts exist but aren't connected in graph

**Cause:** Relationships not recognized during consolidation

**Solutions:**

**1. Run consolidation again with more context:**
```bash
# Add more episodes about related concepts
npm run import:file -- additional-data.json

# Consolidate
npm run consolidate
```

**2. Manually add relationship** (in `knowledge-graph.json`):
```json
{
  "relationships": [
    {
      "source": "Python",
      "target": "Django",
      "type": "has-framework",
      "strength": 0.9,
      "confidence": 0.95,
      "lastReinforced": "2024-01-15T10:00:00Z",
      "reinforcementCount": 1,
      "createdAt": "2024-01-15T10:00:00Z",
      "flags": [],
      "metadata": {}
    }
  ]
}
```

---

## Transaction Issues

### Issue: "Transaction failed, rolled back"

**Error:**
```
❌ Transaction failed: [reason]
Rolling back to previous state...
✅ Rollback successful
```

**Cause:** Operation failed during transaction (e.g., write error, API error)

**Solution:**
1. **Check error message** for root cause
2. **Verify disk space:**
   ```bash
   df -h
   ```
3. **Check permissions:**
   ```bash
   ls -la neocortex/
   # Should be writable
   ```
4. **Retry operation:**
   ```bash
   npm run consolidate
   ```

---

### Issue: "Backup directory full"

**Symptom:** Many backup files in `hippocampus/backups/`

**Solution:**
```bash
# Check backup count
ls hippocampus/backups/*.backup.json | wc -l

# Cleanup old backups (keeps last 10)
npm run tx-cleanup

# Or manually remove old backups
rm hippocampus/backups/*.backup.json
```

---

### Issue: "Cannot rollback transaction"

**Error:**
```
Error: No backup found for rollback
```

**Cause:** Backup file deleted or corrupted

**Solution:**
1. **Check for recent backups:**
   ```bash
   ls -lht hippocampus/backups/ | head -5
   ```

2. **Restore from manual backup:**
   ```bash
   cp neocortex.backup/knowledge-graph.json neocortex/
   ```

3. **If no backup available:**
   - Restart from scratch (worst case)
   - Re-import data
   - Run consolidation

---

## Known Issues

### v0.4.2 Known Issues

**1. Memory leak on repeated imports via Dashboard**

- **Symptom:** Second import causes "heap out of memory" error
- **Impact:** Dashboard only, CLI imports work fine
- **Workaround:** Restart dashboard between large imports
- **Status:** Fixed in v0.4.3

---

**2. Large CSV imports slow**

- **Symptom:** Importing CSV with >10,000 rows takes >1 minute
- **Impact:** CSV imports only
- **Workaround:** Split CSV into smaller files
- **Status:** Performance improvements planned for v0.4.3

---

**3. HNSW rebuild required after every concept addition**

- **Symptom:** New concepts not found in search until index rebuilt
- **Impact:** HNSW mode only
- **Workaround:** `npm run search:rebuild-hnsw` after consolidation
- **Status:** Incremental index updates planned for v0.5.0

---

**4. Gemini API timeout on large batches**

- **Symptom:** Consolidation fails with "timeout" error when batch size >100
- **Impact:** Large batches only
- **Workaround:** Reduce `batchSize` in learning-params.json
- **Status:** Retry logic added in v0.4.3

---

## Diagnostic Commands

### General Health Check

```bash
# Check all components
npm run stats
npm run search:info
npm run session-stats
npm run tx-stats

# Test basic functionality
npm run query "test"
npm run recall
```

### File Integrity Check

```bash
# Check required files exist
ls neocortex/knowledge-graph.json
ls neocortex/learning-params.json
ls hippocampus/daily-index.json

# Check file sizes (should not be 0)
ls -lh neocortex/*.json
ls -lh hippocampus/*.json
```

### API Test

```bash
# Test Gemini API
node -e "
import('dotenv').then(dotenv => {
  dotenv.config();
  console.log('API Key:', process.env.GEMINI_API_KEY ? 'Found' : 'Missing');
});
"

# Test embedding generation
npm run query "hello world"
```

### Dashboard Test

```bash
# Start dashboard
npm run dashboard

# In another terminal, test endpoints
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/import/history
```

---

## Getting Help

### 1. Check Logs

Most errors include detailed error messages. Look for:
- Stack traces (file:line where error occurred)
- Error codes (e.g., ENOENT, EADDRINUSE)
- API error messages (e.g., "400 Bad Request")

### 2. Enable Debug Logging

Set `LOG_LEVEL=debug` in `.env`:
```bash
echo "LOG_LEVEL=debug" >> .env
```

Then run command again to see detailed logs.

### 3. Search Issues

Check existing issues on GitHub:
- [OpenClaw Memory Issues](https://github.com/openclaw/memory/issues)

### 4. File a Bug Report

Include:
- OpenClaw Memory version (`cat package.json | grep version`)
- Node.js version (`node --version`)
- Operating system
- Error message (full stack trace)
- Steps to reproduce
- Relevant configuration files

### 5. Community Support

- GitHub Discussions
- Discord server
- Stack Overflow (tag: `openclaw`)

---

## Emergency Recovery

### Complete Reset

If system is completely broken:

```bash
# 1. Backup existing data
cp -r neocortex neocortex.backup
cp -r hippocampus hippocampus.backup

# 2. Remove all generated files
rm -rf neocortex/*.json
rm -rf hippocampus/*.json
rm -rf node_modules

# 3. Reinstall
npm install

# 4. Re-import data
npm run import:dir -- ./backups/

# 5. Consolidate
npm run consolidate

# 6. Rebuild search index
npm run search:rebuild-hnsw
```

### Restore from Backup

```bash
# Restore from manual backup
cp -r neocortex.backup/* neocortex/
cp -r hippocampus.backup/* hippocampus/

# Verify
npm run stats
```

---

## Prevention Tips

1. **Regular backups:**
   ```bash
   # Automated backup script
   cp -r neocortex "neocortex.backup.$(date +%Y%m%d)"
   ```

2. **Run tests before major operations:**
   ```bash
   npm test
   ```

3. **Monitor stats after each import:**
   ```bash
   npm run import:file -- data.json
   npm run stats  # Verify episode count increased
   ```

4. **Keep system updated:**
   ```bash
   git pull  # Or download latest release
   npm install
   ```

5. **Check quality regularly:**
   ```bash
   npm run check:contradictions
   npm run check-quality
   npm run deduplicate
   ```

---

## 🔗 См. также

- [GETTING-STARTED.md](GETTING-STARTED.md) - Installation guide
- [IMPORT-GUIDE.md](IMPORT-GUIDE.md) - Import documentation
- [API-REFERENCE.md](API-REFERENCE.md) - API documentation
- [README.md](../README.md) - System overview

---

**OpenClaw Memory v0.4.2**
*Troubleshooting Guide*
*Last updated: 12 апреля 2026*
