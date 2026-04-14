#!/usr/bin/env node
/**
 * OpenClaw Memory - Setup Script
 * Interactive installation and configuration
 * @version 0.4.2
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function question(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * Check Node.js version
 */
async function checkNodeVersion() {
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
async function checkNpmVersion() {
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
 * Check if .env file exists
 */
async function checkEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  try {
    await fs.access(envPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Setup .env file interactively
 */
async function setupEnvFile(rl) {
  log('\n🔑 API Key Configuration', 'blue');

  const envExists = await checkEnvFile();

  if (envExists) {
    log('   .env file already exists', 'yellow');
    const overwrite = await question(rl, '   Overwrite existing .env? (y/N): ');

    if (overwrite.toLowerCase() !== 'y') {
      log('   Keeping existing .env file', 'green');
      return true;
    }
  }

  log('\n   To use OpenClaw Memory, you need a Google Gemini API key.');
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
  const envContent = `# Memory System Configuration
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

  const envPath = path.join(projectRoot, '.env');
  await fs.writeFile(envPath, envContent);

  log('   ✅ .env file created successfully', 'green');
  return true;
}

/**
 * Initialize directory structure
 */
async function initializeDirectories() {
  log('\n📁 Initializing directory structure...', 'blue');

  const directories = [
    'hippocampus',
    'hippocampus/sessions',
    'hippocampus/backups',
    'neocortex',
    'neocortex/.tx-backups',
    'meta',
    'exports',
    'exports/obsidian',
  ];

  for (const dir of directories) {
    const dirPath = path.join(projectRoot, dir);
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
async function createConfigFiles() {
  log('\n⚙️  Creating configuration files...', 'blue');

  // learning-params.json
  const learningParamsPath = path.join(projectRoot, 'neocortex', 'learning-params.json');
  const learningParamsExists = await fs.access(learningParamsPath).then(() => true).catch(() => false);

  if (!learningParamsExists) {
    const learningParams = {
      version: '0.4.2',
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
  const semanticConfigPath = path.join(projectRoot, 'neocortex', 'semantic-config.json');
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
  const knowledgeGraphPath = path.join(projectRoot, 'neocortex', 'knowledge-graph.json');
  const knowledgeGraphExists = await fs.access(knowledgeGraphPath).then(() => true).catch(() => false);

  if (!knowledgeGraphExists) {
    const knowledgeGraph = {
      version: '0.4.2',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      concepts: [],
      relationships: [],
    };

    await fs.writeFile(knowledgeGraphPath, JSON.stringify(knowledgeGraph, null, 2));
    log('   ✅ Created: knowledge-graph.json', 'green');
  } else {
    log('   ⏭️  Skipped: knowledge-graph.json (already exists)', 'yellow');
  }

  log('   ✅ Configuration files ready', 'green');
}

/**
 * Test API connection
 */
async function testAPIConnection() {
  log('\n🔌 Testing Gemini API connection...', 'blue');

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const testCommand = `cd "${projectRoot}" && node -e "
      import('dotenv').then(dotenv => {
        dotenv.config();
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(apiKey ? 'OK' : 'MISSING');
      });
    "`;

    const { stdout } = await execAsync(testCommand);

    if (stdout.trim() === 'OK') {
      log('   ✅ API key found in .env', 'green');
      return true;
    } else {
      log('   ❌ API key not found', 'red');
      return false;
    }
  } catch (error) {
    log('   ⚠️  Could not test API connection', 'yellow');
    return true; // Don't fail setup
  }
}

/**
 * Create sample data (optional)
 */
async function createSampleData(rl) {
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
        episodeId: 'sample-ep0',
        timestamp: new Date().toISOString(),
        type: 'conversation',
        role: 'user',
        content: 'What is OpenClaw Memory?',
        confidence: 0.95,
      },
      {
        episodeId: 'sample-ep1',
        timestamp: new Date().toISOString(),
        type: 'conversation',
        role: 'assistant',
        content:
          'OpenClaw Memory is a neurobiological memory system inspired by human memory. It includes short-term memory (hippocampus) for recent episodes, long-term memory (neocortex) for consolidated knowledge, Hebbian learning for connection strengthening, and semantic search with HNSW indexing.',
        confidence: 0.95,
      },
    ],
  };

  const sessionPath = path.join(
    projectRoot,
    'hippocampus',
    'sessions',
    `${sampleSession.sessionId}.json`
  );

  await fs.writeFile(sessionPath, JSON.stringify(sampleSession, null, 2));
  log('   ✅ Sample session created', 'green');
}

/**
 * Run tests
 */
async function runTests(rl) {
  log('\n🧪 Testing', 'blue');

  const runTests = await question(rl, '   Run tests to verify installation? (Y/n): ');

  if (runTests.toLowerCase() === 'n') {
    log('   ⏭️  Skipped tests', 'yellow');
    return;
  }

  try {
    log('   Running tests... (this may take 30-60 seconds)', 'bright');

    const { stdout, stderr } = await execAsync('npm test', {
      cwd: projectRoot,
      timeout: 120000, // 2 minutes
    });

    // Check if tests passed
    if (stdout.includes('✅') || stdout.includes('passed')) {
      log('   ✅ All tests passed', 'green');
    } else {
      log('   ⚠️  Some tests may have failed', 'yellow');
      log('   Check output above for details', 'yellow');
    }
  } catch (error) {
    log('   ⚠️  Tests failed or were skipped', 'yellow');
    log('   You can run tests later with: npm test', 'yellow');
  }
}

/**
 * Print next steps
 */
function printNextSteps() {
  log('\n🎉 Setup Complete!', 'green');
  log('\n📚 Next Steps:', 'blue');
  log('   1. Verify your .env file has correct API key');
  log('   2. Import some data:');
  log('      npm run import:file -- your-data.json', 'bright');
  log('   3. Run consolidation:');
  log('      npm run consolidate', 'bright');
  log('   4. Query your memory:');
  log('      npm run query "your search"', 'bright');
  log('   5. Start dashboard:');
  log('      npm run dashboard', 'bright');
  log('      Then visit: http://localhost:3000\n', 'bright');

  log('📖 Documentation:', 'blue');
  log('   Getting Started: docs/GETTING-STARTED.md');
  log('   Import Guide:    docs/IMPORT-GUIDE.md');
  log('   API Reference:   docs/API-REFERENCE.md');
  log('   Troubleshooting: docs/TROUBLESHOOTING.md\n');

  log('💡 Quick Commands:', 'blue');
  log('   npm run stats                Show memory statistics');
  log('   npm run query "text"         Search knowledge graph');
  log('   npm run dashboard            Start web dashboard');
  log('   npm run import:file -- file  Import data file');
  log('   npm test                     Run all tests\n');
}

/**
 * Main setup function
 */
async function main() {
  console.clear();

  log('╔══════════════════════════════════════════════════════════╗', 'bright');
  log('║     🧠 OpenClaw Memory - Interactive Setup v0.4.2       ║', 'bright');
  log('╚══════════════════════════════════════════════════════════╝', 'bright');

  const rl = createInterface();

  try {
    // 1. Check prerequisites
    const nodeOK = await checkNodeVersion();
    if (!nodeOK) {
      process.exit(1);
    }

    const npmOK = await checkNpmVersion();
    if (!npmOK) {
      process.exit(1);
    }

    // 2. Setup .env
    const envOK = await setupEnvFile(rl);
    if (!envOK) {
      log('\n⚠️  Setup incomplete. Please configure API key and run again.', 'yellow');
      process.exit(1);
    }

    // 3. Initialize directories
    await initializeDirectories();

    // 4. Create config files
    await createConfigFiles();

    // 5. Test API
    await testAPIConnection();

    // 6. Sample data (optional)
    await createSampleData(rl);

    // 7. Run tests (optional)
    await runTests(rl);

    // 8. Print next steps
    printNextSteps();

    log('✅ Setup completed successfully!', 'green');
    log('🚀 You are ready to use OpenClaw Memory!\n', 'bright');
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    log('Please check the error and try again.\n', 'yellow');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
main();
