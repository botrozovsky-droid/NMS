#!/usr/bin/env node
/**
 * Test Gemini consolidation with a small batch
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeWithGemini } from '../lib/consolidation-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testGemini() {
  console.log('🧪 Testing Gemini API with NMS architecture episodes...\n');

  // Load the NMS architecture import session
  const sessionPath = path.join(__dirname, '..', 'hippocampus', 'sessions', 'import-1776074252853.json');
  const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

  // Take only first 3 episodes (small test)
  const testEpisodes = sessionData.episodes.slice(0, 3).map(ep => ({
    id: ep.episodeId,
    content: ep.content,
    timestamp: ep.timestamp,
    metadata: ep.metadata
  }));

  console.log(`📝 Testing with ${testEpisodes.length} episodes:`);
  testEpisodes.forEach((ep, i) => {
    const preview = ep.content.substring(0, 80).replace(/\n/g, ' ');
    console.log(`   ${i + 1}. ${preview}...`);
  });
  console.log();

  console.log('🔄 Calling Gemini API...\n');

  const result = await analyzeWithGemini(testEpisodes, {
    temperature: 0.2,
    maxOutputTokens: 8192,  // Increased from 2048
    timeout: 60000
  });

  if (result) {
    console.log('✅ Success! Gemini returned:');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('❌ Gemini API failed to return valid analysis');
  }
}

testGemini().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
