/**
 * Shared Setup Utilities
 * Common functions used across all setup modes
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Colors for terminal output
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check Node.js version
 */
export async function checkNodeVersion() {
  log('\n📋 Checking prerequisites...', 'blue');

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  log(`   Node.js version: ${nodeVersion}`);

  if (majorVersion < 18) {
    log(`   ❌ Node.js 18 or higher required`, 'red');
    log(`   Please update Node.js from https://nodejs.org/`, 'yellow');
    return false;
  }

  log(`   ✅ Node.js version OK`, 'green');
  return true;
}

/**
 * Check npm version
 */
export async function checkNpmVersion() {
  try {
    const { stdout } = await execAsync('npm --version');
    const npmVersion = stdout.trim();
    const majorVersion = parseInt(npmVersion.split('.')[0]);

    log(`   npm version: ${npmVersion}`);

    if (majorVersion < 9) {
      log(`   ⚠️  npm 9+ recommended (current: ${npmVersion})`, 'yellow');
      log(`   Run: npm install -g npm@latest`, 'yellow');
    } else {
      log(`   ✅ npm version OK`, 'green');
    }

    return true;
  } catch (error) {
    log(`   ❌ npm not found`, 'red');
    return false;
  }
}

/**
 * Setup .env file
 */
export async function setupEnvFile(rl, installPath) {
  log('\n🔑 API Key Configuration', 'blue');

  const envPath = path.join(installPath, '.env');
  let envExists = false;

  try {
    await fs.access(envPath);
    envExists = true;
  } catch {
    // Doesn't exist
  }

  if (envExists) {
    log('   .env file already exists', 'yellow');
    const overwrite = await question(rl, '   Overwrite existing .env? (y/N): ');

    if (overwrite.toLowerCase() !== 'y') {
      log('   Keeping existing .env file', 'green');
      return true;
    }
  }

  log('\n   To use NMS, you need a Google Gemini API key.');
  log('   Get your free API key from: https://makersuite.google.com/app/apikey\n', 'bright');

  const hasKey = await question(rl, '   Do you have a Gemini API key? (y/N): ');

  if (hasKey.toLowerCase() !== 'y') {
    log('\n   📖 Please follow these steps:', 'yellow');
    log('   1. Visit https://makersuite.google.com/app/apikey');
    log('   2. Sign in with your Google account');
    log('   3. Click "Get API Key" → "Create API key in new project"');
    log('   4. Copy the API key (starts with AIza...)');
    log('   5. Run this setup script again\n');
    return false;
  }

  const apiKey = await question(rl, '   Enter your Gemini API key: ');

  if (!apiKey || apiKey.trim().length < 10) {
    log('   ❌ Invalid API key', 'red');
    return false;
  }

  // Select model
  log('\n   Select Gemini model:');
  log('   1. gemini-1.5-flash (default, fastest, free tier)');
  log('   2. gemini-1.5-pro (more capable, requires billing)');

  const modelChoice = await question(rl, '   Your choice (1-2, default: 1): ');
  const model = modelChoice === '2' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

  // Create .env file
  const envContent = `# NMS Configuration
# Created: ${new Date().toISOString().split('T')[0]}

# Gemini API Key (for consolidation)
GEMINI_API_KEY=${apiKey.trim()}

# Model selection
# Options: gemini-1.5-flash, gemini-1.5-pro
GEMINI_MODEL=${model}

# Gemini API endpoint
GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models

# Dashboard port (Optional)
DASHBOARD_PORT=3000

# Log level (Optional)
# Options: debug, info, warn, error
LOG_LEVEL=info
`;

  await fs.writeFile(envPath, envContent);

  log('   ✅ .env file created successfully', 'green');
  return true;
}

/**
 * Initialize directory structure
 */
export async function initializeDirectories(installPath) {
  log('\n📁 Initializing directory structure...', 'blue');

  const directories = [
    'hippocampus',
    'hippocampus/sessions',
    'hippocampus/backups',
    'neocortex',
    'neocortex/.tx-backups',
    'meta',
    'procedural',
    'data',
    'exports',
    'exports/obsidian',
  ];

  for (const dir of directories) {
    const dirPath = path.join(installPath, dir);
    try {
      await fs.mkdir(dirPath, { recursive: true });
      log(`   ✅ Created: ${dir}`, 'green');
    } catch (error) {
      if (error.code !== 'EEXIST') {
        log(`   ⚠️  Failed to create: ${dir}`, 'yellow');
      }
    }
  }

  log('   ✅ Directory structure initialized', 'green');
}

/**
 * Create initial configuration files
 */
export async function createConfigFiles(installPath) {
  log('\n⚙️  Creating configuration files...', 'blue');

  // learning-params.json
  const learningParamsPath = path.join(installPath, 'neocortex', 'learning-params.json');
  const learningParamsExists = await fs.access(learningParamsPath).then(() => true).catch(() => false);

  if (!learningParamsExists) {
    const learningParams = {
      version: '0.6.0',
      lastUpdated: new Date().toISOString(),
      parameters: {
        hebbian: {
          learningRate: 0.1,
          decayRate: 0.05,
          reinforcementThreshold: 0.3,
          decayHalfLife: 7,
          pruneThreshold: 0.1,
        },
        consolidation: {
          importanceThreshold: 0.6,
          confidenceThreshold: 0.7,
          minEpisodes: 3,
          batchSize: 50,
          maxBatches: 20,
        },
        semantic: {
          similarityThreshold: 0.75,
          maxResults: 10,
          embeddingModel: 'text-embedding-004',
        },
      },
      quality: {
        autoFlagLowConfidence: true,
        lowConfidenceThreshold: 0.5,
        contradictionThreshold: 0.3,
      },
    };

    await fs.writeFile(learningParamsPath, JSON.stringify(learningParams, null, 2));
    log('   ✅ Created: learning-params.json', 'green');
  } else {
    log('   ⏭️  Skipped: learning-params.json (already exists)', 'yellow');
  }

  // semantic-config.json
  const semanticConfigPath = path.join(installPath, 'neocortex', 'semantic-config.json');
  const semanticConfigExists = await fs.access(semanticConfigPath).then(() => true).catch(() => false);

  if (!semanticConfigExists) {
    const semanticConfig = {
      mode: 'linear',
      hnsw: {
        M: 16,
        efConstruction: 200,
        efSearch: 100,
      },
      cache: {
        enabled: true,
        maxSize: 10000,
      },
    };

    await fs.writeFile(semanticConfigPath, JSON.stringify(semanticConfig, null, 2));
    log('   ✅ Created: semantic-config.json', 'green');
  } else {
    log('   ⏭️  Skipped: semantic-config.json (already exists)', 'yellow');
  }

  // knowledge-graph.json (empty)
  const knowledgeGraphPath = path.join(installPath, 'neocortex', 'knowledge-graph.json');
  const knowledgeGraphExists = await fs.access(knowledgeGraphPath).then(() => true).catch(() => false);

  if (!knowledgeGraphExists) {
    const knowledgeGraph = {
      version: '0.6.0',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      nodes: {},
      edges: {}
    };

    await fs.writeFile(knowledgeGraphPath, JSON.stringify(knowledgeGraph, null, 2));
    log('   ✅ Created: knowledge-graph.json', 'green');
  } else {
    log('   ⏭️  Skipped: knowledge-graph.json (already exists)', 'yellow');
  }

  log('   ✅ Configuration files ready', 'green');
}

/**
 * Helper function for readline questions
 */
export async function question(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}
