#!/usr/bin/env node
/**
 * Sync OpenClaw Sessions to NMS
 *
 * Copies sessions from OpenClaw to NMS hippocampus for consolidation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const OPENCLAW_SESSIONS = path.join(dirname(__dirname), 'agents', 'main', 'sessions');
const NMS_SESSIONS = path.join(__dirname, 'hippocampus', 'sessions');
const NMS_CANDIDATES = path.join(__dirname, 'hippocampus', 'synaptic-candidates.json');
const SYNC_STATE_FILE = path.join(__dirname, 'meta', 'openclaw-sync-state.json');

/**
 * Load synchronization state
 */
async function loadSyncState() {
  try {
    const data = await fs.readFile(SYNC_STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { lastSync: 0, syncedSessions: [] };
  }
}

/**
 * Save synchronization state
 */
async function saveSyncState(state) {
  await fs.mkdir(path.dirname(SYNC_STATE_FILE), { recursive: true });
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Convert OpenClaw JSONL to NMS format
 */
async function convertOpenClawSession(sessionFile, sessionKey) {
  const lines = (await fs.readFile(sessionFile, 'utf-8')).trim().split('\n');
  const episodes = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Process messages
      if (entry.type === 'message' && entry.message) {
        const msg = entry.message;
        const role = msg.role;

        if (role === 'user' || role === 'assistant') {
          const content = Array.isArray(msg.content)
            ? msg.content.find(c => c.type === 'text')?.text || JSON.stringify(msg.content)
            : msg.content || '';

          episodes.push({
            episodeId: `openclaw-${entry.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            content,
            role,
            metadata: {
              source: 'openclaw',
              sessionKey,
              messageId: msg.id || entry.id,
              type: 'conversation'
            },
            type: 'conversation',
            confidence: 0.9
          });
        }
      }

      // Process tool calls
      if (entry.type === 'tool_call' && entry.tool_call) {
        episodes.push({
          episodeId: `openclaw-tool-${entry.id || Date.now()}`,
          timestamp: entry.timestamp || new Date().toISOString(),
          content: `Tool: ${entry.tool_call.name}\nInput: ${JSON.stringify(entry.tool_call.input || {})}`,
          role: 'tool',
          metadata: {
            source: 'openclaw',
            sessionKey,
            toolName: entry.tool_call.name,
            type: 'tool_call'
          },
          type: 'tool_call',
          confidence: 0.9
        });
      }

    } catch (error) {
      console.warn(`⚠️  Skipped line due to error: ${error.message}`);
    }
  }

  return episodes;
}

/**
 * Add to consolidation queue
 */
async function queueForConsolidation(episodes, sessionId) {
  let candidates = {
    version: '1.0.0',
    candidates: [],
    consolidationQueue: [],
    statistics: {
      totalCandidates: 0,
      consolidatedCount: 0,
      rejectedCount: 0
    }
  };

  try {
    const data = await fs.readFile(NMS_CANDIDATES, 'utf-8');
    candidates = JSON.parse(data);
  } catch {
    // File doesn't exist
  }

  for (const episode of episodes) {
    candidates.candidates.push({
      episodeId: episode.episodeId,
      sessionId,
      timestamp: new Date(episode.timestamp).getTime(),
      importance: 6, // Average importance for OpenClaw sessions
      addedToQueue: Date.now()
    });
  }

  candidates.statistics.totalCandidates += episodes.length;
  candidates.lastConsolidation = new Date().toISOString();

  await fs.writeFile(NMS_CANDIDATES, JSON.stringify(candidates, null, 2));
}

/**
 * Main synchronization function
 */
async function sync() {
  console.log('🔄 Synchronizing OpenClaw → NMS\n');

  const state = await loadSyncState();
  const now = Date.now();

  // Find all JSONL files in OpenClaw sessions
  let files;
  try {
    files = await fs.readdir(OPENCLAW_SESSIONS);
  } catch (error) {
    console.error(`❌ OpenClaw sessions directory not found: ${OPENCLAW_SESSIONS}`);
    console.log('   Make sure OpenClaw is installed and was running');
    process.exit(1);
  }

  const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.reset.'));
  console.log(`📁 Found ${jsonlFiles.length} sessions in OpenClaw`);

  let syncedCount = 0;
  let skippedCount = 0;
  let totalEpisodes = 0;

  for (const file of jsonlFiles) {
    const sessionKey = file.replace('.jsonl', '');

    // Skip already synchronized
    if (state.syncedSessions.includes(sessionKey)) {
      skippedCount++;
      continue;
    }

    const sessionPath = path.join(OPENCLAW_SESSIONS, file);
    const stats = await fs.stat(sessionPath);

    // Skip empty files
    if (stats.size === 0) {
      console.log(`   ⏭️  ${file}: empty file`);
      continue;
    }

    console.log(`   📥 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Convert session
    const episodes = await convertOpenClawSession(sessionPath, sessionKey);

    if (episodes.length === 0) {
      console.log(`      ⚠️  No episodes to import`);
      continue;
    }

    // Create NMS session
    const nmsSessionId = `openclaw-${sessionKey}-${now}`;
    const nmsSession = {
      sessionId: nmsSessionId,
      startTime: new Date(stats.birthtime).toISOString(),
      endTime: new Date(stats.mtime).toISOString(),
      type: 'openclaw',
      source: 'openclaw-sync',
      originalSessionKey: sessionKey,
      episodes
    };

    // Save to NMS hippocampus
    await fs.mkdir(NMS_SESSIONS, { recursive: true });
    const nmsPath = path.join(NMS_SESSIONS, `${nmsSessionId}.json`);
    await fs.writeFile(nmsPath, JSON.stringify(nmsSession, null, 2));

    // Add to consolidation queue
    await queueForConsolidation(episodes, nmsSessionId);

    console.log(`      ✅ ${episodes.length} episodes → NMS`);

    // Update state
    state.syncedSessions.push(sessionKey);
    totalEpisodes += episodes.length;
    syncedCount++;
  }

  state.lastSync = now;
  await saveSyncState(state);

  console.log(`\n✅ Synchronization complete:`);
  console.log(`   📊 Synchronized: ${syncedCount} sessions`);
  console.log(`   📝 Total episodes: ${totalEpisodes}`);
  console.log(`   ⏭️  Skipped: ${skippedCount} (already synced)`);

  if (totalEpisodes > 0) {
    console.log(`\n💡 Run consolidation:`);
    console.log(`   cd ~/.nms/`);
    console.log(`   npm run consolidate`);
  }
}

sync().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
