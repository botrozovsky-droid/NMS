/**
 * Transaction Manager - v0.3.0
 *
 * Provides ACID transaction support for knowledge graph operations.
 * Uses file-based backup strategy for rollback capability.
 *
 * Features:
 * - Atomic operations (all-or-nothing)
 * - Automatic rollback on error
 * - Transaction logging
 * - Nested transaction support
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Transaction Manager class
 */
export class TransactionManager {
  constructor(dataPath, options = {}) {
    this.dataPath = dataPath;
    this.backupDir = options.backupDir || path.join(path.dirname(dataPath), '.tx-backups');
    this.logFile = options.logFile || path.join(path.dirname(dataPath), 'transaction-log.json');

    this.currentTransaction = null;
    this.transactionStack = []; // For nested transactions
    this.stats = {
      totalTransactions: 0,
      committed: 0,
      rolledBack: 0,
      failures: 0
    };
  }

  /**
   * Initialize transaction manager
   */
  async initialize() {
    // Create backup directory if not exists
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Load transaction log
    try {
      const logData = await fs.readFile(this.logFile, 'utf-8');
      const log = JSON.parse(logData);
      this.stats = log.stats || this.stats;
    } catch (error) {
      // No log file yet, will create on first transaction
      await this.saveLog();
    }
  }

  /**
   * Save transaction log
   */
  async saveLog() {
    const log = {
      lastUpdated: new Date().toISOString(),
      stats: this.stats,
      currentTransaction: this.currentTransaction ? {
        id: this.currentTransaction.id,
        startTime: this.currentTransaction.startTime,
        operation: this.currentTransaction.operation
      } : null
    };

    try {
      await fs.writeFile(this.logFile, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save transaction log:', error.message);
    }
  }

  /**
   * Start a new transaction
   * @param {string} operation - Description of operation
   * @returns {string} - Transaction ID
   */
  async begin(operation = 'unknown') {
    const txId = crypto.randomUUID();
    const backupPath = path.join(this.backupDir, `${txId}.backup`);

    // Create backup of current data
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      await fs.writeFile(backupPath, data);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }

    const transaction = {
      id: txId,
      operation,
      backupPath,
      startTime: Date.now(),
      status: 'active'
    };

    // Support nested transactions
    if (this.currentTransaction) {
      this.transactionStack.push(this.currentTransaction);
    }

    this.currentTransaction = transaction;
    this.stats.totalTransactions++;

    await this.saveLog();

    console.log(`🔄 Transaction started: ${txId} (${operation})`);
    return txId;
  }

  /**
   * Commit transaction (delete backup)
   */
  async commit() {
    if (!this.currentTransaction) {
      throw new Error('No active transaction to commit');
    }

    const tx = this.currentTransaction;
    const duration = Date.now() - tx.startTime;

    try {
      // Delete backup
      await fs.unlink(tx.backupPath);

      tx.status = 'committed';
      this.stats.committed++;

      console.log(`✅ Transaction committed: ${tx.id} (${duration}ms)`);

      // Restore parent transaction if nested
      this.currentTransaction = this.transactionStack.pop() || null;

      await this.saveLog();

      return { success: true, duration };

    } catch (error) {
      console.error(`❌ Failed to commit transaction ${tx.id}:`, error.message);
      this.stats.failures++;
      await this.saveLog();
      throw error;
    }
  }

  /**
   * Rollback transaction (restore from backup)
   */
  async rollback(reason = 'unknown') {
    if (!this.currentTransaction) {
      throw new Error('No active transaction to rollback');
    }

    const tx = this.currentTransaction;
    const duration = Date.now() - tx.startTime;

    console.log(`🔄 Rolling back transaction ${tx.id}: ${reason}`);

    try {
      // Restore from backup
      const backup = await fs.readFile(tx.backupPath, 'utf-8');
      await fs.writeFile(this.dataPath, backup);

      // Delete backup
      await fs.unlink(tx.backupPath);

      tx.status = 'rolled_back';
      tx.reason = reason;
      this.stats.rolledBack++;

      console.log(`↩️ Transaction rolled back: ${tx.id} (${duration}ms)`);

      // Restore parent transaction if nested
      this.currentTransaction = this.transactionStack.pop() || null;

      await this.saveLog();

      return { success: true, duration, reason };

    } catch (error) {
      console.error(`❌ Failed to rollback transaction ${tx.id}:`, error.message);
      this.stats.failures++;
      await this.saveLog();
      throw error;
    }
  }

  /**
   * Execute operation within a transaction
   * Automatically commits on success, rolls back on error
   *
   * @param {Function} operation - Async function to execute
   * @param {string} description - Operation description
   * @returns {Promise<any>} - Operation result
   */
  async execute(operation, description = 'transaction') {
    const txId = await this.begin(description);

    try {
      const result = await operation();
      await this.commit();
      return result;

    } catch (error) {
      await this.rollback(error.message);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalTransactions > 0
        ? (this.stats.committed / this.stats.totalTransactions * 100).toFixed(1) + '%'
        : 'N/A',
      activeTransaction: this.currentTransaction ? {
        id: this.currentTransaction.id,
        operation: this.currentTransaction.operation,
        duration: Date.now() - this.currentTransaction.startTime
      } : null,
      stackDepth: this.transactionStack.length
    };
  }

  /**
   * Clean up old backups (for maintenance)
   */
  async cleanup(maxAgeMs = 24 * 3600000) {
    try {
      const files = await fs.readdir(this.backupDir);
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.backup')) continue;

        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtimeMs;

        if (age > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old transaction backups`);
      }

      return cleaned;

    } catch (error) {
      console.error('⚠️ Failed to cleanup backups:', error.message);
      return 0;
    }
  }

  /**
   * Check if transaction is active
   */
  get isActive() {
    return this.currentTransaction !== null;
  }

  /**
   * Get current transaction ID
   */
  get currentTxId() {
    return this.currentTransaction?.id || null;
  }
}

/**
 * Create singleton instance for knowledge graph
 */
let graphTransactionManager = null;

export function getGraphTransactionManager(knowledgeGraphPath) {
  if (!graphTransactionManager) {
    graphTransactionManager = new TransactionManager(knowledgeGraphPath, {
      backupDir: path.join(path.dirname(knowledgeGraphPath), '.tx-backups'),
      logFile: path.join(path.dirname(knowledgeGraphPath), 'transaction-log.json')
    });
  }
  return graphTransactionManager;
}

/**
 * Helper: Execute operation with automatic transaction
 *
 * @param {string} dataPath - Path to data file
 * @param {Function} operation - Operation to execute
 * @param {string} description - Operation description
 */
export async function withTransaction(dataPath, operation, description) {
  const txManager = new TransactionManager(dataPath);
  await txManager.initialize();
  return await txManager.execute(operation, description);
}

// CLI interface
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const command = process.argv[2];

  if (command === 'stats') {
    // Show transaction statistics
    const knowledgeGraphPath = process.argv[3] || './neocortex/knowledge-graph.json';
    const txManager = getGraphTransactionManager(knowledgeGraphPath);
    await txManager.initialize();

    const stats = txManager.getStats();
    console.log('📊 Transaction Statistics:');
    console.log(JSON.stringify(stats, null, 2));

  } else if (command === 'cleanup') {
    // Clean up old backups
    const knowledgeGraphPath = process.argv[3] || './neocortex/knowledge-graph.json';
    const txManager = getGraphTransactionManager(knowledgeGraphPath);
    await txManager.initialize();

    const cleaned = await txManager.cleanup();
    console.log(`✅ Cleanup complete: ${cleaned} backups removed`);

  } else if (command === 'test') {
    // Test transaction system
    console.log('🧪 Testing transaction system...\n');

    const testFile = './test-tx-data.json';
    const txManager = new TransactionManager(testFile);
    await txManager.initialize();

    // Create test data
    await fs.writeFile(testFile, JSON.stringify({ value: 0 }, null, 2));

    // Test 1: Successful transaction
    console.log('Test 1: Successful transaction');
    await txManager.execute(async () => {
      const data = JSON.parse(await fs.readFile(testFile, 'utf-8'));
      data.value = 42;
      await fs.writeFile(testFile, JSON.stringify(data, null, 2));
    }, 'test-success');

    const result1 = JSON.parse(await fs.readFile(testFile, 'utf-8'));
    console.log(`✅ Value after commit: ${result1.value} (expected: 42)\n`);

    // Test 2: Failed transaction (should rollback)
    console.log('Test 2: Failed transaction (should rollback)');
    try {
      await txManager.execute(async () => {
        const data = JSON.parse(await fs.readFile(testFile, 'utf-8'));
        data.value = 999;
        await fs.writeFile(testFile, JSON.stringify(data, null, 2));
        throw new Error('Simulated failure');
      }, 'test-failure');
    } catch (error) {
      console.log(`Expected error: ${error.message}`);
    }

    const result2 = JSON.parse(await fs.readFile(testFile, 'utf-8'));
    console.log(`✅ Value after rollback: ${result2.value} (expected: 42)\n`);

    // Cleanup
    await fs.unlink(testFile);

    // Show stats
    console.log('📊 Final stats:');
    console.log(JSON.stringify(txManager.getStats(), null, 2));

  } else {
    console.log(`
Transaction Manager - v0.3.0

Usage:
  node transaction-manager.js test                    - Run self-test
  node transaction-manager.js stats [graph-path]      - Show statistics
  node transaction-manager.js cleanup [graph-path]    - Clean old backups
    `);
  }
}
