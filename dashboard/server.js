import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import { tmpdir } from 'os';
import memoryManager from '../memory-manager.js';

const execAsync = promisify(exec);

// Configure multer for file uploads
const upload = multer({
  dest: join(tmpdir(), 'openclaw-uploads'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const memoryRoot = join(__dirname, '..');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Helper: Load JSON file
async function loadJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

// Helper: Save JSON file
async function saveJSON(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
}

// API: Get knowledge graph
app.get('/api/graph', async (req, res) => {
  const graphPath = join(memoryRoot, 'neocortex', 'knowledge-graph.json');
  const graph = await loadJSON(graphPath);

  if (!graph) {
    return res.status(500).json({ error: 'Failed to load graph' });
  }

  res.json(graph);
});

// API: Get search config
app.get('/api/config', async (req, res) => {
  const configPath = join(memoryRoot, 'meta', 'search-config.json');
  const config = await loadJSON(configPath);

  if (!config) {
    return res.status(500).json({ error: 'Failed to load config' });
  }

  res.json(config);
});

// API: Get statistics
app.get('/api/stats', async (req, res) => {
  const graphPath = join(memoryRoot, 'neocortex', 'knowledge-graph.json');
  const configPath = join(memoryRoot, 'meta', 'search-config.json');

  const graph = await loadJSON(graphPath);
  const config = await loadJSON(configPath);

  if (!graph || !config) {
    return res.status(500).json({ error: 'Failed to load data' });
  }

  const nodes = Object.keys(graph.nodes || {}).length;
  const edges = Object.keys(graph.edges || {}).length;
  const avgDegree = nodes > 0 ? (edges * 2 / nodes).toFixed(2) : 0;

  res.json({
    nodes,
    edges,
    avgDegree,
    mode: config.mode || 'linear',
    hnswEnabled: config.hnswEnabled || false,
    indexStats: config.indexStats || {},
    performance: config.performance || {}
  });
});

// API: Run search query
app.post('/api/search', async (req, res) => {
  const { query, k = 10 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Run search via CLI
    const cmd = `cd "${memoryRoot}" && node memory-manager.js query "${query}" ${k}`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Search stderr:', stderr);
    }

    // Parse output (simple JSON extraction)
    const results = [];
    const lines = stdout.split('\n');
    let jsonStarted = false;
    let jsonBuffer = '';

    for (const line of lines) {
      if (line.trim().startsWith('[') || line.trim().startsWith('{')) {
        jsonStarted = true;
      }
      if (jsonStarted) {
        jsonBuffer += line;
      }
    }

    try {
      const parsed = JSON.parse(jsonBuffer);
      res.json({
        query,
        results: Array.isArray(parsed) ? parsed : [parsed],
        timestamp: new Date().toISOString()
      });
    } catch {
      // Fallback: return raw output
      res.json({
        query,
        results: [{ concept: 'Search completed', output: stdout }],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Toggle search mode
app.post('/api/toggle-mode', async (req, res) => {
  const { mode } = req.body;

  if (!mode || !['linear', 'hnsw'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode (must be linear or hnsw)' });
  }

  const configPath = join(memoryRoot, 'meta', 'search-config.json');
  const config = await loadJSON(configPath);

  if (!config) {
    return res.status(500).json({ error: 'Failed to load config' });
  }

  // If switching to HNSW, check if index exists
  if (mode === 'hnsw' && !config.hnswEnabled) {
    return res.status(400).json({
      error: 'HNSW not enabled. Please enable HNSW first.',
      action: 'enable-hnsw'
    });
  }

  // Update config
  config.mode = mode;
  config.lastUpdated = new Date().toISOString();

  const saved = await saveJSON(configPath, config);

  if (!saved) {
    return res.status(500).json({ error: 'Failed to save config' });
  }

  res.json({
    success: true,
    mode,
    message: `Switched to ${mode.toUpperCase()} search mode`
  });
});

// API: Enable HNSW
app.post('/api/enable-hnsw', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node semantic-search.js enable-hnsw`;

    // This is a long-running operation, send immediate response
    res.json({
      success: true,
      message: 'HNSW build started. This may take 30-60 seconds...',
      status: 'building'
    });

    // Run in background
    execAsync(cmd).then(({ stdout, stderr }) => {
      console.log('HNSW build completed:', stdout);
      if (stderr) console.error('HNSW build stderr:', stderr);
    }).catch(error => {
      console.error('HNSW build error:', error);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Disable HNSW
app.post('/api/disable-hnsw', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node semantic-search.js disable-hnsw`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Disable HNSW stderr:', stderr);
    }

    res.json({
      success: true,
      message: 'Switched to Linear search mode',
      output: stdout
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Rebuild HNSW index
app.post('/api/rebuild', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node semantic-search.js rebuild-hnsw`;

    // Long-running operation
    res.json({
      success: true,
      message: 'HNSW rebuild started...',
      status: 'rebuilding'
    });

    // Run in background
    execAsync(cmd).then(({ stdout, stderr }) => {
      console.log('HNSW rebuild completed:', stdout);
      if (stderr) console.error('HNSW rebuild stderr:', stderr);
    }).catch(error => {
      console.error('HNSW rebuild error:', error);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Run benchmark
app.post('/api/benchmark', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node semantic-search.js benchmark`;

    // Long-running operation
    res.json({
      success: true,
      message: 'Benchmark started...',
      status: 'running'
    });

    // Run in background
    execAsync(cmd).then(({ stdout, stderr }) => {
      console.log('Benchmark completed:', stdout);
      if (stderr) console.error('Benchmark stderr:', stderr);
    }).catch(error => {
      console.error('Benchmark error:', error);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= HEALTH API ENDPOINTS =============

// API: Get health overview
app.get('/api/health', async (req, res) => {
  try {
    const graphPath = join(memoryRoot, 'neocortex', 'knowledge-graph.json');
    const graph = await loadJSON(graphPath);

    if (!graph) {
      return res.status(500).json({ error: 'Failed to load graph' });
    }

    const nodes = Object.values(graph.nodes || {});
    const edges = Object.values(graph.edges || {});

    // Calculate health metrics
    const lowConfidenceNodes = nodes.filter(n => (n.confidence || 0) < 0.5).length;
    const flaggedNodes = nodes.filter(n => n.flags && n.flags.length > 0).length;
    const suspiciousWeights = nodes.filter(n =>
      n.flags && n.flags.includes('suspicious_weight')
    ).length;

    // Check orphaned links
    const nodeIds = new Set(Object.keys(graph.nodes || {}));
    const orphanedLinks = edges.filter(e =>
      !nodeIds.has(e.source) || !nodeIds.has(e.target)
    ).length;

    // Calculate overall health score
    const totalIssues = lowConfidenceNodes + flaggedNodes + orphanedLinks;
    const healthScore = Math.max(0, Math.min(100,
      100 - (totalIssues / nodes.length * 100)
    ));

    res.json({
      healthScore: Math.round(healthScore),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      issues: {
        lowConfidence: lowConfidenceNodes,
        flagged: flaggedNodes,
        suspiciousWeights,
        orphanedLinks
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Check quality (hallucination detection)
app.post('/api/health/check-quality', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node hallucination-detector.js`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Quality check stderr:', stderr);
    }

    // Parse output
    const lowConfMatch = stdout.match(/(\d+)\s+low-confidence/i);
    const lowConfCount = lowConfMatch ? parseInt(lowConfMatch[1]) : 0;

    res.json({
      success: true,
      lowConfidenceNodes: lowConfCount,
      output: stdout
    });
  } catch (error) {
    console.error('Quality check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Check contradictions
app.post('/api/health/check-contradictions', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node contradiction-detector.js`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Contradiction check stderr:', stderr);
    }

    // Parse output
    const contradictionMatch = stdout.match(/(\d+)\s+potential contradiction/i);
    const contradictionCount = contradictionMatch ? parseInt(contradictionMatch[1]) : 0;

    res.json({
      success: true,
      contradictions: contradictionCount,
      output: stdout
    });
  } catch (error) {
    console.error('Contradiction check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Check orphaned links
app.post('/api/health/check-orphaned', async (req, res) => {
  try {
    const graphPath = join(memoryRoot, 'neocortex', 'knowledge-graph.json');
    const graph = await loadJSON(graphPath);

    if (!graph) {
      return res.status(500).json({ error: 'Failed to load graph' });
    }

    const nodeIds = new Set(Object.keys(graph.nodes || {}));
    const edges = Object.entries(graph.edges || {});

    const orphaned = edges.filter(([id, edge]) =>
      !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
    );

    res.json({
      success: true,
      orphanedLinks: orphaned.length,
      totalEdges: edges.length,
      examples: orphaned.slice(0, 5).map(([id, edge]) => ({
        id,
        source: edge.source,
        target: edge.target,
        sourceExists: nodeIds.has(edge.source),
        targetExists: nodeIds.has(edge.target)
      }))
    });
  } catch (error) {
    console.error('Orphaned links check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Fix orphaned links
app.post('/api/health/fix-orphaned', async (req, res) => {
  try {
    const cmd = `cd "${memoryRoot}" && node fix-orphaned-links.js`;

    res.json({
      success: true,
      message: 'Fixing orphaned links...',
      status: 'running'
    });

    // Run in background
    execAsync(cmd).then(({ stdout, stderr }) => {
      console.log('Fix orphaned completed:', stdout);
      if (stderr) console.error('Fix orphaned stderr:', stderr);
    }).catch(error => {
      console.error('Fix orphaned error:', error);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= IMPORT API ENDPOINTS =============

// API: Import file (upload)
app.post('/api/import/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFilePath = req.file.path;
    const originalName = req.file.originalname;
    const options = req.body.options ? JSON.parse(req.body.options) : {};

    console.log(`📥 Import request: ${originalName}`);

    // Run import via CLI
    const cmd = `cd "${memoryRoot}" && node src/import-manager.js file "${uploadedFilePath}"`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Import stderr:', stderr);
    }

    // Clean up uploaded file
    await fs.unlink(uploadedFilePath).catch(() => {});

    // Parse output to extract results
    const episodeMatch = stdout.match(/(\d+) episodes/);
    const episodeCount = episodeMatch ? parseInt(episodeMatch[1]) : 0;

    res.json({
      success: true,
      fileName: originalName,
      episodeCount,
      message: `Imported ${episodeCount} episodes from ${originalName}`,
      output: stdout
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Import text content (direct)
app.post('/api/import/text', async (req, res) => {
  try {
    const { content, fileName = 'imported-text.txt', options = {} } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    console.log(`📝 Import text: ${content.length} characters`);

    // Create temporary file
    const tmpPath = join(tmpdir(), `openclaw-${Date.now()}.txt`);
    await fs.writeFile(tmpPath, content);

    // Run import
    const cmd = `cd "${memoryRoot}" && node src/import-manager.js file "${tmpPath}"`;
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr) {
      console.error('Import stderr:', stderr);
    }

    // Clean up
    await fs.unlink(tmpPath).catch(() => {});

    // Parse output
    const episodeMatch = stdout.match(/(\d+) episodes/);
    const episodeCount = episodeMatch ? parseInt(episodeMatch[1]) : 0;

    res.json({
      success: true,
      episodeCount,
      message: `Imported ${episodeCount} episodes`,
      output: stdout
    });

  } catch (error) {
    console.error('Import text error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Get import history
app.get('/api/import/history', async (req, res) => {
  try {
    const historyPath = join(memoryRoot, 'meta', 'import-history.json');
    const history = await loadJSON(historyPath);

    if (!history) {
      return res.json({ history: [] });
    }

    // Return last 20 imports
    const recentHistory = Array.isArray(history) ? history.slice(-20) : [];

    res.json({
      success: true,
      history: recentHistory,
      total: Array.isArray(history) ? history.length : 0
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Clear import history
app.delete('/api/import/history', async (req, res) => {
  try {
    const historyPath = join(memoryRoot, 'meta', 'import-history.json');
    await fs.writeFile(historyPath, JSON.stringify([], null, 2));

    res.json({
      success: true,
      message: 'Import history cleared'
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Forget/Delete Node
app.delete('/api/nodes/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;

    if (!nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Node ID is required'
      });
    }

    // Delete node
    const result = await memoryManager.deleteNode(nodeId);

    console.log(`✅ Node deleted via API: ${nodeId}`);

    res.json({
      success: true,
      nodeId: result.nodeId,
      deletedEdges: result.deletedEdges,
      message: `Node and ${result.deletedEdges} related edge(s) deleted`
    });

  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API: Get search mode
app.get('/api/search/mode', async (req, res) => {
  try {
    const configPath = join(memoryRoot, 'neocortex', 'search-config.json');
    const config = await loadJSON(configPath);

    if (!config) {
      return res.json({
        mode: 'linear',
        hnswEnabled: false
      });
    }

    res.json({
      mode: config.mode || 'linear',
      hnswEnabled: config.hnswEnabled || false,
      autoActivate: config.autoActivate || {}
    });

  } catch (error) {
    console.error('Get search mode error:', error);
    res.json({
      mode: 'linear',
      hnswEnabled: false
    });
  }
});

// API: Toggle search mode
app.post('/api/search/toggle', async (req, res) => {
  try {
    const configPath = join(memoryRoot, 'neocortex', 'search-config.json');
    const graphPath = join(memoryRoot, 'neocortex', 'knowledge-graph.json');

    // Load current config
    const config = await loadJSON(configPath);
    if (!config) {
      return res.status(500).json({
        success: false,
        error: 'Search config not found'
      });
    }

    const currentMode = config.mode || 'linear';
    const newMode = currentMode === 'hnsw' ? 'linear' : 'hnsw';

    if (newMode === 'hnsw') {
      // Enable HNSW
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Run enable command in background
      execAsync(`cd "${memoryRoot}" && node semantic-search.js enable-hnsw`)
        .catch(err => console.error('HNSW enable background error:', err));

      // Immediately update config to show HNSW (actual build happens in background)
      config.mode = 'hnsw';
      config.hnswEnabled = true;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        mode: 'hnsw',
        message: 'HNSW enabled (building index in background)'
      });

    } else {
      // Disable HNSW
      config.mode = 'linear';
      config.hnswEnabled = false;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        mode: 'linear',
        message: 'Switched to linear search'
      });
    }

  } catch (error) {
    console.error('Toggle search mode error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GANGLIA API
// ============================================

// API: List ganglia
app.get('/api/ganglia', async (req, res) => {
  try {
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);

    const ganglia = manager.listGanglia();
    manager.close();

    res.json({ success: true, ganglia });
  } catch (error) {
    console.error('List ganglia error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Get ganglia details
app.get('/api/ganglia/:id', async (req, res) => {
  try {
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);

    const ganglia = manager.getGanglia(req.params.id);
    manager.close();

    if (!ganglia) {
      return res.status(404).json({ success: false, error: 'Ganglia not found' });
    }

    res.json({ success: true, ganglia });
  } catch (error) {
    console.error('Get ganglia error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Generate enrichment questions
app.post('/api/ganglia/questions', async (req, res) => {
  try {
    const { name, description } = req.body;
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);

    const questions = await manager.generateEnrichmentQuestions(name, description || '');
    manager.close();

    res.json({ success: true, questions });
  } catch (error) {
    console.error('Generate questions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Create ganglia
app.post('/api/ganglia', async (req, res) => {
  try {
    const { name, type, description, answers } = req.body;
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);

    const ganglia = await manager.createGanglia(name, type, description, answers);
    manager.close();

    res.json({ success: true, ganglia });
  } catch (error) {
    console.error('Create ganglia error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Update ganglia
app.put('/api/ganglia/:id', async (req, res) => {
  try {
    const { description, weight, enrichmentAnswers } = req.body;
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const { getDatabase } = await import('../lib/db-adapter.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);
    const db = getDatabase(dbPath);
    db.initialize();

    // Get current ganglia
    const current = manager.getGanglia(req.params.id);
    if (!current) {
      manager.close();
      db.close();
      return res.status(404).json({ success: false, error: 'Ganglia not found' });
    }

    // Parse updates
    const updates = {};
    if (description !== undefined) updates.description = description;
    if (weight !== undefined) updates.weight = weight;

    // Update enrichment in metadata
    if (enrichmentAnswers) {
      const metadata = typeof current.metadata === 'string'
        ? JSON.parse(current.metadata)
        : current.metadata;

      if (enrichmentAnswers.context !== undefined) metadata.context = enrichmentAnswers.context;
      if (enrichmentAnswers.expertise !== undefined) metadata.expertise_level = enrichmentAnswers.expertise;
      if (enrichmentAnswers.subtopics !== undefined) {
        metadata.subtopics = enrichmentAnswers.subtopics.split(',').map(s => s.trim()).filter(s => s);
      }
      if (enrichmentAnswers.relations !== undefined) {
        metadata.related_projects = enrichmentAnswers.relations.split(',').map(s => s.trim()).filter(s => s);
      }
      if (enrichmentAnswers.horizon !== undefined) metadata.horizon = enrichmentAnswers.horizon;

      // Update description in metadata too
      if (description) metadata.description = description;

      updates.metadata = JSON.stringify(metadata);
    }

    // Apply updates
    manager.updateGanglia(req.params.id, updates);

    // Get updated ganglia
    const updated = manager.getGanglia(req.params.id);

    manager.close();
    db.close();

    res.json({ success: true, ganglia: updated });
  } catch (error) {
    console.error('Update ganglia error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Delete ganglia
app.delete('/api/ganglia/:id', async (req, res) => {
  try {
    const { GangliaManager } = await import('../lib/ganglia-manager.js');
    const dbPath = join(memoryRoot, 'neocortex', 'nms.db');
    const manager = new GangliaManager(dbPath);

    const deleted = manager.deleteGanglia(req.params.id);
    manager.close();

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ganglia not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete ganglia error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 OpenClaw Memory Dashboard`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n   Server running on: http://localhost:${PORT}`);
  console.log(`\n   API Endpoints:`);
  console.log(`   • GET  /api/graph`);
  console.log(`   • GET  /api/config`);
  console.log(`   • GET  /api/stats`);
  console.log(`   • POST /api/search`);
  console.log(`   • POST /api/toggle-mode`);
  console.log(`   • POST /api/enable-hnsw`);
  console.log(`   • POST /api/disable-hnsw`);
  console.log(`   • POST /api/rebuild`);
  console.log(`   • POST /api/benchmark`);
  console.log(`   • POST /api/import/file (NEW v0.4.2)`);
  console.log(`   • POST /api/import/text (NEW v0.4.2)`);
  console.log(`   • GET  /api/import/history (NEW v0.4.2)`);
  console.log(`   • DELETE /api/nodes/:nodeId (NEW v0.5.2)`);
  console.log(`\n   Press Ctrl+C to stop`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
