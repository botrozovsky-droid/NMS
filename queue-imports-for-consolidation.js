#!/usr/bin/env node
/**
 * Queue Import Sessions for Consolidation
 * Adds imported episodes to synaptic-candidates.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSIONS_PATH = path.join(__dirname, 'hippocampus', 'sessions');
const CANDIDATES_PATH = path.join(__dirname, 'hippocampus', 'synaptic-candidates.json');

async function main() {
  console.log('🔄 Queueing import sessions for consolidation...\n');

  // Load existing candidates
  let candidatesData;
  try {
    const data = await fs.readFile(CANDIDATES_PATH, 'utf-8');
    candidatesData = JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading synaptic candidates:', error.message);
    process.exit(1);
  }

  console.log(`📊 Current queue: ${candidatesData.candidates.length} episodes\n`);

  // Find all import sessions
  const files = await fs.readdir(SESSIONS_PATH);
  const importSessions = files.filter(f => f.startsWith('import-') && f.endsWith('.json'));

  console.log(`📁 Found ${importSessions.length} import sessions\n`);

  let addedCount = 0;
  let skippedCount = 0;

  // Process each import session
  for (const sessionFile of importSessions) {
    const sessionPath = path.join(SESSIONS_PATH, sessionFile);
    const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

    if (!sessionData.episodes || sessionData.episodes.length === 0) {
      console.log(`   ⏭️  ${sessionFile}: No episodes`);
      continue;
    }

    console.log(`   📥 ${sessionFile}: ${sessionData.episodes.length} episodes`);

    // Add each episode to candidates (if not already there)
    for (const episode of sessionData.episodes) {
      // Check if already in queue
      const alreadyQueued = candidatesData.candidates.some(
        c => c.episodeId === episode.episodeId
      );

      if (alreadyQueued) {
        skippedCount++;
        continue;
      }

      // Calculate importance (based on metadata)
      let importance = 5; // Default for imports

      if (episode.metadata) {
        // Higher importance for documentation
        if (episode.metadata.type === 'documentation') importance = 7;
        // Higher importance for code
        if (episode.metadata.type === 'code') importance = 6;
        // Boost for headings
        if (episode.metadata.level && episode.metadata.level <= 2) importance += 1;
        // Boost for longer content
        if (episode.metadata.wordCount > 50) importance += 0.5;
      }

      // Add to candidates
      candidatesData.candidates.push({
        episodeId: episode.episodeId,
        sessionId: sessionData.sessionId,
        timestamp: new Date(episode.timestamp).getTime(),
        importance,
        addedToQueue: Date.now()
      });

      addedCount++;
    }
  }

  // Update statistics
  candidatesData.statistics.totalCandidates += addedCount;

  // Save updated candidates
  await fs.writeFile(CANDIDATES_PATH, JSON.stringify(candidatesData, null, 2));

  console.log(`\n✅ Queueing complete:`);
  console.log(`   Added: ${addedCount} episodes`);
  console.log(`   Skipped: ${skippedCount} episodes (already queued)`);
  console.log(`   Total queue: ${candidatesData.candidates.length} episodes\n`);

  console.log('💡 Next step: Run consolidation');
  console.log('   npm run consolidate\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
