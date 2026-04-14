#!/usr/bin/env node
/**
 * Migration Script: JSON → SQLite
 * Migrates all NMS data from JSON files to SQLite database
 */

import { getDatabase } from '../lib/db-adapter.js';
import { loadJSON, saveJSON } from '../lib/json-store.js';
import { join } from 'path';
import { existsSync, readdirSync, mkdirSync, copyFileSync } from 'fs';

const NEOCORTEX_DIR = './neocortex';
const HIPPOCAMPUS_DIR = './hippocampus';
const DATA_DIR = './data';
const PROCEDURAL_DIR = './procedural';
const BACKUP_DIR = './migration-backup';

console.log('═══════════════════════════════════════════════════════════');
console.log('  NMS MIGRATION: JSON → SQLite v0.7.0');
console.log('═══════════════════════════════════════════════════════════\n');

async function createBackup() {
  console.log('📦 Creating backup...');

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filesToBackup = [
    join(NEOCORTEX_DIR, 'knowledge-graph.json'),
    join(DATA_DIR, 'embedding-cache.json'),
    join(PROCEDURAL_DIR, 'action-patterns.json'),
    join(PROCEDURAL_DIR, 'preferences.json')
  ];

  filesToBackup.forEach(file => {
    if (existsSync(file)) {
      const backupFile = join(BACKUP_DIR, file.replace(/\//g, '_'));
      copyFileSync(file, backupFile);
      console.log(`  ✓ Backed up: ${file}`);
    }
  });

  console.log('  ✅ Backup complete\n');
}

async function migrateKnowledgeGraph(db) {
  console.log('🧠 Migrating knowledge graph...');

  const graphPath = join(NEOCORTEX_DIR, 'knowledge-graph.json');

  if (!existsSync(graphPath)) {
    console.log('  ⚠️  No knowledge graph found, skipping...\n');
    return { nodes: 0, edges: 0 };
  }

  const graph = await loadJSON(graphPath);

  console.log(`  • Nodes: ${Object.keys(graph.nodes || {}).length}`);
  console.log(`  • Edges: ${Object.keys(graph.edges || {}).length}`);

  // Save to SQLite
  db.saveGraph(graph);

  // Verify
  const loadedGraph = db.loadGraph();
  const nodeCount = Object.keys(loadedGraph.nodes).length;
  const edgeCount = Object.keys(loadedGraph.edges).length;

  console.log('  ✅ Verification:');
  console.log(`     Original nodes: ${Object.keys(graph.nodes || {}).length}`);
  console.log(`     Migrated nodes: ${nodeCount}`);
  console.log(`     Original edges: ${Object.keys(graph.edges || {}).length}`);
  console.log(`     Migrated edges: ${edgeCount}\n`);

  return { nodes: nodeCount, edges: edgeCount };
}

async function migrateEpisodes(db) {
  console.log('📚 Migrating episodes...');

  const sessionsDir = join(HIPPOCAMPUS_DIR, 'sessions');

  if (!existsSync(sessionsDir)) {
    console.log('  ⚠️  No sessions found, skipping...\n');
    return { sessions: 0, episodes: 0 };
  }

  const sessionFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
  let totalEpisodes = 0;

  console.log(`  • Found ${sessionFiles.length} session files`);

  for (const sessionFile of sessionFiles) {
    const sessionPath = join(sessionsDir, sessionFile);
    const sessionData = await loadJSON(sessionPath);

    if (sessionData.episodes && sessionData.episodes.length > 0) {
      db.saveEpisodes(sessionData.sessionId, sessionData.episodes);
      totalEpisodes += sessionData.episodes.length;
    }
  }

  console.log(`  ✅ Migrated ${sessionFiles.length} sessions, ${totalEpisodes} episodes\n`);

  return { sessions: sessionFiles.length, episodes: totalEpisodes };
}

async function migrateEmbeddingCache(db) {
  console.log('🔍 Migrating embedding cache...');

  const cachePath = join(DATA_DIR, 'embedding-cache.json');

  if (!existsSync(cachePath)) {
    console.log('  ⚠️  No cache found, skipping...\n');
    return 0;
  }

  const cache = await loadJSON(cachePath);
  const cacheSize = Object.keys(cache).length;

  console.log(`  • Cache entries: ${cacheSize}`);

  db.saveEmbeddingCache(cache);

  console.log('  ✅ Cache migrated\n');

  return cacheSize;
}

async function migrateProceduralMemory(db) {
  console.log('⚙️  Migrating procedural memory...');

  // Action patterns
  const patternsPath = join(PROCEDURAL_DIR, 'action-patterns.json');
  let patternCount = 0;

  if (existsSync(patternsPath)) {
    const patterns = await loadJSON(patternsPath);
    // Patterns will be migrated in future phase
    patternCount = Object.keys(patterns || {}).length;
    console.log(`  • Action patterns: ${patternCount} (deferred to Phase 2)`);
  }

  // Preferences
  const prefsPath = join(PROCEDURAL_DIR, 'preferences.json');
  let prefCount = 0;

  if (existsSync(prefsPath)) {
    const prefs = await loadJSON(prefsPath);
    // Preferences will be migrated in future phase
    prefCount = Object.keys(prefs || {}).length;
    console.log(`  • Preferences: ${prefCount} (deferred to Phase 2)`);
  }

  console.log('  ℹ️  Procedural memory migration deferred to Phase 2\n');

  return { patterns: patternCount, preferences: prefCount };
}

async function runMigration() {
  const startTime = Date.now();

  try {
    // Step 1: Create backup
    await createBackup();

    // Step 2: Initialize database
    console.log('🔌 Initializing SQLite database...');
    const dbPath = join(NEOCORTEX_DIR, 'nms.db');
    const db = getDatabase(dbPath);
    db.initialize();
    console.log(`  ✅ Database created: ${dbPath}\n`);

    // Step 3: Migrate knowledge graph
    const graphStats = await migrateKnowledgeGraph(db);

    // Step 4: Migrate episodes
    const episodeStats = await migrateEpisodes(db);

    // Step 5: Migrate embedding cache
    const cacheSize = await migrateEmbeddingCache(db);

    // Step 6: Migrate procedural memory
    const proceduralStats = await migrateProceduralMemory(db);

    // Step 7: Update metadata
    db.setMetadata('migration_completed', Date.now());
    db.setMetadata('migration_from', 'json');
    db.setMetadata('migration_version', '0.7.0');

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MIGRATION COMPLETE ✅');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Duration: ${duration}s`);
    console.log(`  Nodes: ${graphStats.nodes}`);
    console.log(`  Edges: ${graphStats.edges}`);
    console.log(`  Sessions: ${episodeStats.sessions}`);
    console.log(`  Episodes: ${episodeStats.episodes}`);
    console.log(`  Cache entries: ${cacheSize}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📋 NEXT STEPS:');
    console.log('  1. Test the system: npm test');
    console.log('  2. Check stats: npm run stats');
    console.log('  3. Verify dashboard: npm run dashboard');
    console.log('  4. If all works, backup is in: ./migration-backup/\n');

    db.close();

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error.stack);
    console.log('\n💡 Your data is safe in the backup: ./migration-backup/');
    process.exit(1);
  }
}

// Run migration
runMigration();
