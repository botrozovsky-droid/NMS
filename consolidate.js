#!/usr/bin/env node
/**
 * Memory Consolidation Script - v0.3.1
 * Runs nightly to transfer important memories from hippocampus to neocortex
 *
 * REFACTORED: Uses Consolidator with NightlyStrategy
 * Eliminates ~435 lines of internal logic, now in lib/
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Consolidator } from './lib/consolidator.js';
import { NightlyStrategy } from './lib/consolidation-strategies.js';
import { loadJSON } from './lib/json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Paths
const HIPPOCAMPUS_DIR = path.join(__dirname, 'hippocampus');
const NEOCORTEX_DIR = path.join(__dirname, 'neocortex');
const META_DIR = path.join(__dirname, 'meta');
const SYNAPTIC_CANDIDATES = path.join(HIPPOCAMPUS_DIR, 'synaptic-candidates.json');

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

/**
 * Main consolidation function
 */
async function consolidate() {
  try {
    // Load synaptic candidates
    const candidates = await loadJSON(SYNAPTIC_CANDIDATES);

    if (!candidates) {
      throw new Error('Failed to load synaptic candidates');
    }

    // Create consolidator with nightly strategy
    const consolidator = new Consolidator(NightlyStrategy, {
      hippocampusDir: HIPPOCAMPUS_DIR,
      neocortexDir: NEOCORTEX_DIR,
      metaDir: META_DIR
    });

    // Execute consolidation
    const result = await consolidator.consolidate(candidates);

    return result;

  } catch (error) {
    console.error('❌ Consolidation failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  consolidate().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

// Export for testing
export { consolidate };
