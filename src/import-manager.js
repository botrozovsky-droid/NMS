/**
 * OpenClaw Memory - Import Manager
 * Handles importing external data into the memory system
 *
 * Supported formats:
 * - JSON (chat exports from ChatGPT, Claude, Gemini)
 * - Text (TXT, MD - documentation, notes)
 * - CSV (structured data)
 * - Code (JS, PY - with docstrings/comments)
 *
 * @version 0.4.2
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Format parsers
import { parseJSON } from './formats/json-parser.js';
import { parseText } from './formats/text-parser.js';
import { parseCSV } from './formats/csv-parser.js';
import { parseCode } from './formats/code-parser.js';

// Paths
const HIPPOCAMPUS_PATH = path.join(dirname(__dirname), 'hippocampus');
const IMPORT_HISTORY_PATH = path.join(dirname(__dirname), 'meta', 'import-history.json');

/**
 * Import Manager Class
 */
export class ImportManager {
  constructor() {
    this.importHistory = [];
  }

  /**
   * Initialize import manager
   */
  async initialize() {
    // Load import history
    await this.loadImportHistory();

    console.log('✅ Import Manager initialized');
  }

  /**
   * Load import history
   */
  async loadImportHistory() {
    try {
      const data = await fs.readFile(IMPORT_HISTORY_PATH, 'utf-8');
      this.importHistory = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, create empty history
      this.importHistory = [];
      await this.saveImportHistory();
    }
  }

  /**
   * Save import history
   */
  async saveImportHistory() {
    try {
      await fs.writeFile(
        IMPORT_HISTORY_PATH,
        JSON.stringify(this.importHistory, null, 2)
      );
    } catch (error) {
      console.error('Error saving import history:', error.message);
    }
  }

  /**
   * Detect file format
   * @param {string} filePath - Path to file
   * @returns {string} Format type (json, text, csv, code, unknown)
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const formatMap = {
      '.json': 'json',
      '.txt': 'text',
      '.md': 'text',
      '.markdown': 'text',
      '.csv': 'csv',
      '.js': 'code',
      '.mjs': 'code',
      '.ts': 'code',
      '.py': 'code',
      '.java': 'code',
      '.cpp': 'code',
      '.c': 'code',
      '.go': 'code',
      '.rs': 'code',
    };

    return formatMap[ext] || 'unknown';
  }

  /**
   * Import single file
   * @param {string} filePath - Path to file
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  async importFile(filePath, options = {}) {
    const startTime = Date.now();

    console.log(`\n📥 Importing file: ${filePath}`);

    try {
      // Check file exists
      await fs.access(filePath);

      // Detect format
      const format = options.format || this.detectFormat(filePath);
      console.log(`   Format: ${format.toUpperCase()}`);

      // Read file
      const content = await fs.readFile(filePath, 'utf-8');
      const fileSize = Buffer.byteLength(content, 'utf-8');
      console.log(`   Size: ${(fileSize / 1024).toFixed(2)} KB`);

      // Parse based on format
      let parsed;
      switch (format) {
        case 'json':
          parsed = parseJSON(content, options);
          break;
        case 'text':
          parsed = parseText(content, filePath, options);
          break;
        case 'csv':
          parsed = parseCSV(content, options);
          break;
        case 'code':
          parsed = parseCode(content, filePath, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      console.log(`   Parsed: ${parsed.episodes.length} episodes`);

      // Process episodes
      const processedEpisodes = await this.processEpisodes(
        parsed.episodes,
        {
          source: options.source || path.basename(filePath),
          format,
          filePath,
          ...options
        }
      );

      // Store in hippocampus
      const stored = await this.storeEpisodes(processedEpisodes, options);

      // Optional: Auto-consolidate
      if (options.autoConsolidate) {
        console.log('   🔄 Auto-consolidating...');
        // TODO: Trigger consolidation
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Add to import history
      const importRecord = {
        id: `import-${Date.now()}`,
        filePath,
        format,
        fileSize,
        episodeCount: processedEpisodes.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        options,
        success: true
      };

      this.importHistory.push(importRecord);
      await this.saveImportHistory();

      console.log(`✅ Import completed in ${duration}s`);

      return {
        success: true,
        format,
        episodeCount: processedEpisodes.length,
        duration,
        importId: importRecord.id
      };

    } catch (error) {
      console.error(`❌ Import failed: ${error.message}`);

      // Add failed import to history
      this.importHistory.push({
        id: `import-${Date.now()}`,
        filePath,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
      await this.saveImportHistory();

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import multiple files (batch)
   * @param {string[]} filePaths - Array of file paths
   * @param {Object} options - Import options
   * @returns {Object} Batch import result
   */
  async importBatch(filePaths, options = {}) {
    console.log(`\n📦 Batch import: ${filePaths.length} files`);

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let totalEpisodes = 0;

    for (const filePath of filePaths) {
      const result = await this.importFile(filePath, options);
      results.push(result);

      if (result.success) {
        successCount++;
        totalEpisodes += result.episodeCount;
      } else {
        failCount++;
      }
    }

    console.log(`\n📊 Batch import complete:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total episodes: ${totalEpisodes}`);

    return {
      success: true,
      totalFiles: filePaths.length,
      successCount,
      failCount,
      totalEpisodes,
      results
    };
  }

  /**
   * Import directory (recursive)
   * @param {string} dirPath - Path to directory
   * @param {Object} options - Import options
   * @returns {Object} Directory import result
   */
  async importDirectory(dirPath, options = {}) {
    console.log(`\n📂 Importing directory: ${dirPath}`);

    try {
      // Get all files recursively
      const files = await this.getFilesRecursive(dirPath, options);
      console.log(`   Found ${files.length} files`);

      // Filter by supported formats
      const supportedFiles = files.filter(file => {
        const format = this.detectFormat(file);
        return format !== 'unknown';
      });

      console.log(`   Supported: ${supportedFiles.length} files`);

      // Batch import
      return await this.importBatch(supportedFiles, options);

    } catch (error) {
      console.error(`❌ Directory import failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get files recursively from directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Options (maxDepth, extensions)
   * @returns {string[]} Array of file paths
   */
  async getFilesRecursive(dirPath, options = {}) {
    const maxDepth = options.maxDepth || 10;
    const files = [];

    async function traverse(currentPath, depth = 0) {
      if (depth > maxDepth) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (!['node_modules', '.git', '.vscode', 'dist', 'build'].includes(entry.name)) {
            await traverse(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  /**
   * Process episodes (add metadata, generate embeddings)
   * @param {Array} episodes - Raw episodes
   * @param {Object} metadata - Additional metadata
   * @returns {Array} Processed episodes
   */
  async processEpisodes(episodes, metadata) {
    const processed = [];

    for (const episode of episodes) {
      processed.push({
        ...episode,
        type: 'imported',
        source: metadata.source,
        format: metadata.format,
        importedAt: new Date().toISOString(),
        confidence: metadata.confidence || 0.7, // Lower for imported data
        metadata: {
          ...episode.metadata,
          originalFile: metadata.filePath,
          importOptions: metadata
        }
      });
    }

    return processed;
  }

  /**
   * Store episodes in hippocampus
   * @param {Array} episodes - Processed episodes
   * @param {Object} options - Storage options
   * @returns {number} Number of stored episodes
   */
  async storeEpisodes(episodes, options = {}) {
    const sessionId = `import-${Date.now()}`;
    const sessionPath = path.join(HIPPOCAMPUS_PATH, 'sessions', `${sessionId}.json`);

    // Create session object
    const session = {
      sessionId,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      type: 'import',
      episodes: episodes.map((ep, idx) => ({
        episodeId: `${sessionId}-ep${idx}`,
        timestamp: new Date().toISOString(),
        ...ep
      }))
    };

    // Save session
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    console.log(`   💾 Stored ${episodes.length} episodes in session ${sessionId}`);

    // Update daily index
    await this.updateDailyIndex(session);

    // Generate embeddings if requested
    if (options.generateEmbeddings) {
      console.log('   🔢 Generating embeddings...');
      // TODO: Generate embeddings via semantic-search
    }

    return episodes.length;
  }

  /**
   * Update daily index
   * @param {Object} session - Session object
   */
  async updateDailyIndex(session) {
    const dailyIndexPath = path.join(HIPPOCAMPUS_PATH, 'daily-index.json');

    let dailyIndex = {};
    try {
      const data = await fs.readFile(dailyIndexPath, 'utf-8');
      dailyIndex = JSON.parse(data);
    } catch {
      dailyIndex = {};
    }

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (!dailyIndex[date]) {
      dailyIndex[date] = [];
    }

    dailyIndex[date].push({
      sessionId: session.sessionId,
      episodeCount: session.episodes.length,
      type: 'import',
      timestamp: session.startTime
    });

    await fs.writeFile(dailyIndexPath, JSON.stringify(dailyIndex, null, 2));
  }

  /**
   * Get import history
   * @param {Object} filters - Filter options
   * @returns {Array} Import history
   */
  getImportHistory(filters = {}) {
    let history = this.importHistory;

    if (filters.success !== undefined) {
      history = history.filter(record => record.success === filters.success);
    }

    if (filters.format) {
      history = history.filter(record => record.format === filters.format);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Clear import history
   */
  async clearImportHistory() {
    this.importHistory = [];
    await this.saveImportHistory();
    console.log('✅ Import history cleared');
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
🧠 OpenClaw Memory - Import Manager v0.4.2

Usage:
  node import-manager.js <command> [options]

Commands:
  file <path>              Import single file
  batch <path1> <path2>... Import multiple files
  dir <path>               Import directory (recursive)
  history                  Show import history
  clear-history            Clear import history

Examples:
  node import-manager.js file ./chats/export.json
  node import-manager.js dir ./docs/
  node import-manager.js batch file1.txt file2.md
    `);
    process.exit(0);
  }

  const manager = new ImportManager();
  await manager.initialize();

  switch (command) {
    case 'file':
      if (!args[1]) {
        console.error('❌ Please provide file path');
        process.exit(1);
      }
      await manager.importFile(args[1], {
        autoConsolidate: args.includes('--consolidate'),
        generateEmbeddings: args.includes('--embeddings')
      });
      break;

    case 'batch':
      const files = args.slice(1).filter(arg => !arg.startsWith('--'));
      if (files.length === 0) {
        console.error('❌ Please provide file paths');
        process.exit(1);
      }
      await manager.importBatch(files, {
        autoConsolidate: args.includes('--consolidate'),
        generateEmbeddings: args.includes('--embeddings')
      });
      break;

    case 'dir':
    case 'directory':
      if (!args[1]) {
        console.error('❌ Please provide directory path');
        process.exit(1);
      }
      await manager.importDirectory(args[1], {
        autoConsolidate: args.includes('--consolidate'),
        generateEmbeddings: args.includes('--embeddings'),
        maxDepth: 10
      });
      break;

    case 'history':
      const history = manager.getImportHistory({ limit: 20 });
      console.log('\n📋 Import History (last 20):');
      history.forEach(record => {
        const status = record.success ? '✅' : '❌';
        console.log(`${status} ${record.timestamp} - ${record.filePath || 'unknown'} (${record.episodeCount || 0} episodes)`);
      });
      break;

    case 'clear-history':
      await manager.clearImportHistory();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run CLI if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export default ImportManager;
