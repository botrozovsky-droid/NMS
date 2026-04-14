/**
 * Standalone Setup Mode
 * Installs NMS as independent memory system
 */

import path from 'path';
import {
  log,
  checkNodeVersion,
  checkNpmVersion,
  setupEnvFile,
  initializeDirectories,
  createConfigFiles,
  question
} from './shared.js';
import { createInstallationConfig } from '../setup-utils/create-installation-config.js';

/**
 * Run standalone setup
 */
export async function standaloneSetup(rl, env, options = {}) {
  const { installPath = path.join(env.home, '.nms') } = options;

  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║       🏠 Standalone Mode - Independent NMS            ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝', 'bright');

  log('\n📍 Installation Details:', 'blue');
  log(`   Location: ${installPath}`, 'cyan');
  log('   Mode: Standalone');
  log('   Features: CLI + Web Dashboard + Manual Import\n');

  const confirm = await question(rl, '   Proceed with installation? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    log('\n⏭️  Installation cancelled', 'yellow');
    return { success: false, cancelled: true };
  }

  try {
    // 1. Setup .env
    const envOK = await setupEnvFile(rl, installPath);
    if (!envOK) {
      log('\n⚠️  Setup incomplete. Please configure API key and run again.', 'yellow');
      return { success: false };
    }

    // 2. Initialize directories
    await initializeDirectories(installPath);

    // 3. Create config files
    await createConfigFiles(installPath);

    // 4. Create installation config
    await createInstallationConfig(installPath, 'standalone', { log });

    // 5. Sample data (optional)
    await createSampleData(rl, installPath);

    // 6. Print next steps
    printStandaloneNextSteps(installPath);

    return {
      success: true,
      mode: 'standalone',
      installPath
    };

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Create sample data (optional)
 */
async function createSampleData(rl, installPath) {
  const fs = await import('fs/promises');

  log('\n📦 Sample Data', 'blue');

  const createSample = await question(rl, '   Create sample data for testing? (Y/n): ');

  if (createSample.toLowerCase() === 'n') {
    log('   ⏭️  Skipped sample data creation', 'yellow');
    return;
  }

  const sampleSession = {
    sessionId: `setup-sample-${Date.now()}`,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    type: 'conversation',
    episodes: [
      {
        episodeId: 'sample-ep-1',
        timestamp: new Date().toISOString(),
        type: 'conversation',
        role: 'user',
        content: 'What is NMS?',
        confidence: 0.95,
      },
      {
        episodeId: 'sample-ep-2',
        timestamp: new Date().toISOString(),
        type: 'conversation',
        role: 'assistant',
        content:
          'NMS (Neurobiological Memory System) is a long-term memory system inspired by human brain architecture. It features hippocampal-neocortical consolidation, Hebbian learning, semantic search with HNSW indexing, and a modern web dashboard.',
        confidence: 0.95,
      },
    ],
  };

  const sessionPath = path.join(
    installPath,
    'hippocampus',
    'sessions',
    `${sampleSession.sessionId}.json`
  );

  await fs.writeFile(sessionPath, JSON.stringify(sampleSession, null, 2));
  log('   ✅ Sample session created', 'green');
}

/**
 * Print next steps for standalone mode
 */
function printStandaloneNextSteps(installPath) {
  log('\n🎉 Standalone Setup Complete!', 'green');
  log('\n📚 Next Steps:', 'blue');
  log('   1. Import some data:');
  log('      cd ' + installPath, 'bright');
  log('      npm run import:file -- your-data.json', 'bright');
  log('   2. Run consolidation:');
  log('      npm run consolidate', 'bright');
  log('   3. Query your memory:');
  log('      npm run query "your search"', 'bright');
  log('   4. Start web dashboard:');
  log('      npm run dashboard', 'bright');
  log('      Then visit: http://localhost:3000\n', 'bright');

  log('📖 Documentation:', 'blue');
  log('   Getting Started: docs/GETTING-STARTED.md');
  log('   Import Guide:    docs/IMPORT-GUIDE.md');
  log('   API Reference:   docs/API-REFERENCE.md\n');
}
