/**
 * Mini-Consolidation - v0.3.1
 *
 * Quick consolidation at session end for immediate memory availability.
 * Processes only top 10-20 most important events from the session.
 *
 * REFACTORED: Uses Consolidator with SessionEndStrategy
 * Eliminates ~300 lines of internal logic, now in lib/
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Consolidator } from './lib/consolidator.js';
import { SessionEndStrategy } from './lib/consolidation-strategies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '.env') });

// Paths
const HIPPOCAMPUS_DIR = path.join(__dirname, 'hippocampus');
const NEOCORTEX_DIR = path.join(__dirname, 'neocortex');
const META_DIR = path.join(__dirname, 'meta');

/**
 * Mini-consolidation main function
 * @param {object} session - Session data with importantEvents
 * @returns {Promise<object>} - Consolidation result
 */
export async function miniConsolidate(session) {
  console.log(`\n🌙 Starting mini-consolidation for session ${session.id}...`);

  try {
    // Create consolidator with session-end strategy
    const consolidator = new Consolidator(SessionEndStrategy, {
      hippocampusDir: HIPPOCAMPUS_DIR,
      neocortexDir: NEOCORTEX_DIR,
      metaDir: META_DIR
    });

    // Execute consolidation
    const result = await consolidator.consolidate(session);

    return result;

  } catch (error) {
    console.error('❌ Mini-consolidation failed:', error);
    return { success: false, error: error.message };
  }
}

// CLI interface (testing)
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('🧪 Testing mini-consolidation...\n');

  // Mock session
  const mockSession = {
    id: 'test-session',
    startTime: Date.now() - 1800000, // 30 min ago
    eventCount: 10,
    importantEvents: [
      {
        timestamp: Date.now(),
        importance: 0.8,
        type: 'test',
        id: 'test-event-1'
      }
    ]
  };

  try {
    const result = await miniConsolidate(mockSession);
    console.log('\n📊 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}
