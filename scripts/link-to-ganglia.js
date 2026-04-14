#!/usr/bin/env node
/**
 * Link existing nodes to ganglia based on semantic similarity
 * Run after consolidation to connect new knowledge to semantic anchors
 */

import { GangliaManager } from '../lib/ganglia-manager.js';
import { getDatabase } from '../lib/db-adapter.js';
import { join } from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = join(process.cwd(), 'neocortex', 'nms.db');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const SIMILARITY_THRESHOLD = 0.7;

/**
 * Calculate semantic similarity between node and ganglia
 */
async function calculateSimilarity(node, ganglia) {
  const prompt = `Compare semantic similarity between these concepts:

Node: "${node.name}" (${node.type})
Ganglia: "${ganglia.name}" (${ganglia.type})
Context: ${ganglia.metadata.description || 'N/A'}
Subtopics: ${ganglia.metadata.subtopics?.join(', ') || 'N/A'}

Rate similarity from 0.0 to 1.0 based on:
- Topic relevance
- Conceptual overlap
- Contextual fit

Return only a number between 0.0 and 1.0.`;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      { timeout: 10000 }
    );

    const text = response.data.candidates[0].content.parts[0].text.trim();
    const score = parseFloat(text);

    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
  } catch (error) {
    console.error(`  ⚠️  Similarity check failed: ${error.message}`);
    return 0;
  }
}

/**
 * Link nodes to ganglia
 */
async function linkNodesToGanglia(options = {}) {
  const { dryRun = false, minSimilarity = SIMILARITY_THRESHOLD } = options;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LINK TO GANGLIA - Semantic Auto-linking');
  console.log('═══════════════════════════════════════════════════════════\n');

  const manager = new GangliaManager(DB_PATH);
  const db = getDatabase(DB_PATH);
  db.initialize();

  try {
    // Get all ganglia
    const ganglia = manager.listGanglia();

    if (ganglia.length === 0) {
      console.log('❌ No ganglia found. Create some first with: npm run ganglia:create\n');
      return;
    }

    console.log(`📍 Found ${ganglia.length} ganglia\n`);

    // Get all non-manual nodes (exclude ganglia)
    const nodes = db.queryNodes({ is_manual: 0 });

    if (nodes.length === 0) {
      console.log('❌ No nodes found to link\n');
      return;
    }

    console.log(`🔗 Processing ${nodes.length} nodes...\n`);

    let linksCreated = 0;
    let nodesProcessed = 0;

    for (const node of nodes) {
      nodesProcessed++;
      console.log(`[${nodesProcessed}/${nodes.length}] ${node.name} (${node.type})`);

      // Check if already linked to any ganglia
      const existingEdges = db.getNodeEdges(node.id);
      const linkedGangliaIds = new Set();

      existingEdges.forEach(edge => {
        const targetId = edge.source === node.id ? edge.target : edge.source;
        const target = db.getNode(targetId);
        if (target?.is_manual) {
          linkedGangliaIds.add(targetId);
        }
      });

      // Test similarity with each ganglia
      for (const g of ganglia) {
        // Skip if already linked
        if (linkedGangliaIds.has(g.id)) {
          continue;
        }

        const gangliaDetails = manager.getGanglia(g.id);
        const similarity = await calculateSimilarity(node, gangliaDetails);

        if (similarity >= minSimilarity) {
          console.log(`  ✅ Match: ${g.name} (similarity: ${similarity.toFixed(2)})`);

          if (!dryRun) {
            await manager.linkToGanglia(node.id, g.id, similarity, {
              linked_at: Date.now(),
              method: 'auto-semantic'
            });
            linksCreated++;
          }
        }
      }

      // Rate limit to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  ${dryRun ? 'DRY RUN ' : ''}COMPLETE`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Nodes processed: ${nodesProcessed}`);
    console.log(`Links created: ${linksCreated}`);
    console.log('');

  } finally {
    manager.close();
    db.close();
  }
}

// CLI
const dryRun = process.argv.includes('--dry-run');
const minSimilarity = parseFloat(process.argv.find(arg => arg.startsWith('--threshold='))?.split('=')[1]) || SIMILARITY_THRESHOLD;

linkNodesToGanglia({ dryRun, minSimilarity }).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
