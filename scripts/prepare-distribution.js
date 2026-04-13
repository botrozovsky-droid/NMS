#!/usr/bin/env node
/**
 * OpenClaw Memory - Prepare Distribution Package
 * Creates a clean copy ready for distribution/testing
 * @version 0.4.2
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Files/directories to exclude from distribution
 */
const EXCLUDE = [
  // User data (contains personal information)
  'hippocampus/sessions/*.json',
  'hippocampus/backups/*.json',
  'hippocampus/daily-index.json',
  'hippocampus/session-history.json',
  'hippocampus/synaptic-candidates.json',
  'neocortex/knowledge-graph.json',
  'neocortex/embeddings-cache.json',
  'neocortex/transaction-log.json',
  'neocortex/.tx-backups/**',
  'meta/import-history.json',

  // Environment (contains API keys)
  '.env',

  // Node modules (will be installed by user)
  'node_modules/**',

  // Exports
  'exports/**',

  // Test files
  'test-exports/**',

  // Logs
  '*.log',
  'consolidation.log',

  // Large database
  'main.sqlite',

  // Temporary
  'gemini-response-error.json',
  'test-import.json',

  // Git
  '.git/**',
];

/**
 * Files to include (source, docs, scripts)
 */
const INCLUDE = [
  // Core files
  '*.js',
  'package.json',
  '.gitignore',
  '.env.example',

  // Documentation
  '*.md',
  'docs/**/*.md',

  // Source code
  'src/**/*.js',
  'lib/**/*.js',
  'dashboard/**/*',
  'scripts/**/*.js',

  // Windows scripts
  '*.ps1',
  '*.bat',

  // Directory structure (empty dirs with .gitkeep)
  'hippocampus/.gitkeep',
  'hippocampus/sessions/.gitkeep',
  'hippocampus/backups/.gitkeep',
  'neocortex/.gitkeep',
  'meta/.gitkeep',
  'exports/.gitkeep',
  'procedural/.gitkeep',
];

async function copyDirectory(src, dest, relativePath = '') {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = path.join(relativePath, entry.name).replace(/\\/g, '/');

    // Check if should be excluded
    const shouldExclude = EXCLUDE.some(pattern => {
      if (pattern.includes('**')) {
        const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
        return regex.test(relPath);
      }
      return relPath === pattern || relPath.startsWith(pattern.replace('**', ''));
    });

    if (shouldExclude) {
      log(`   ⏭️  Skipped: ${relPath}`, 'yellow');
      continue;
    }

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      await fs.mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath, relPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      log(`   ✅ Copied: ${relPath}`, 'green');
    }
  }
}

async function createGitkeepFiles(distPath) {
  const emptyDirs = [
    'hippocampus',
    'hippocampus/sessions',
    'hippocampus/backups',
    'neocortex',
    'neocortex/.tx-backups',
    'meta',
    'exports',
    'exports/obsidian',
    'procedural',
  ];

  for (const dir of emptyDirs) {
    const dirPath = path.join(distPath, dir);
    const gitkeepPath = path.join(dirPath, '.gitkeep');

    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(gitkeepPath, '');
      log(`   ✅ Created: ${dir}/.gitkeep`, 'green');
    } catch (error) {
      log(`   ⚠️  Failed to create ${dir}/.gitkeep`, 'yellow');
    }
  }
}

async function createReadme(distPath) {
  const readmePath = path.join(distPath, 'INSTALL.md');
  const content = `# OpenClaw Memory v0.4.2 - Installation

## Quick Install

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Run interactive setup
npm run setup
\`\`\`

The setup wizard will:
- Check prerequisites (Node.js >=18, npm >=9)
- Configure .env with your Gemini API key
- Initialize directory structure
- Create configuration files
- Test API connection
- Create sample data (optional)
- Run tests (optional)

## Manual Install

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Test installation
npm run stats
\`\`\`

## Get Gemini API Key

1. Visit https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Get API Key" → "Create API key in new project"
4. Copy your API key (starts with AIza...)

## Documentation

- **Getting Started:** docs/GETTING-STARTED.md
- **Import Guide:** docs/IMPORT-GUIDE.md
- **API Reference:** docs/API-REFERENCE.md
- **Troubleshooting:** docs/TROUBLESHOOTING.md
- **Security:** SECURITY.md

## Quick Commands

\`\`\`bash
npm run dashboard              # Start web UI (http://localhost:3000)
npm run query "search text"    # Search knowledge graph
npm run import:file -- file    # Import external data
npm run consolidate            # Consolidate memories
npm test                       # Run all tests
\`\`\`

---

**OpenClaw Memory v0.4.2**
*Production Ready*
`;

  await fs.writeFile(readmePath, content);
  log(`   ✅ Created: INSTALL.md`, 'green');
}

async function main() {
  console.clear();

  log('╔══════════════════════════════════════════════════════════╗', 'blue');
  log('║   📦 OpenClaw Memory - Prepare Distribution v0.4.2      ║', 'blue');
  log('╚══════════════════════════════════════════════════════════╝', 'blue');

  const distName = `openclaw-memory-v0.4.2-dist`;
  const distPath = path.join(dirname(projectRoot), distName);

  log(`\n📂 Creating distribution package...`, 'blue');
  log(`   Source: ${projectRoot}`);
  log(`   Destination: ${distPath}\n`);

  try {
    // Remove old dist if exists
    try {
      await fs.rm(distPath, { recursive: true, force: true });
      log(`   🗑️  Removed old distribution\n`, 'yellow');
    } catch {}

    // Create dist directory
    await fs.mkdir(distPath, { recursive: true });
    log(`   ✅ Created distribution directory\n`, 'green');

    // Copy files
    log(`   📋 Copying files...`, 'blue');
    await copyDirectory(projectRoot, distPath);

    // Create .gitkeep files
    log(`\n   📁 Creating directory structure...`, 'blue');
    await createGitkeepFiles(distPath);

    // Create INSTALL.md
    log(`\n   📝 Creating INSTALL.md...`, 'blue');
    await createReadme(distPath);

    // Success
    log(`\n✅ Distribution package created successfully!`, 'green');
    log(`\n📦 Package location:`, 'blue');
    log(`   ${distPath}\n`, 'green');

    log(`📊 Next steps:`, 'blue');
    log(`   1. Test installation:`);
    log(`      cd "${distPath}"`);
    log(`      npm install`);
    log(`      npm run setup\n`);

    log(`   2. Create archive (optional):`);
    log(`      tar -czf openclaw-memory-v0.4.2.tar.gz -C "${dirname(projectRoot)}" "${distName}"`);
    log(`      # Or use 7-Zip/WinRAR on Windows\n`);

    log(`   3. Verify contents:`);
    log(`      - Check no .env file (only .env.example)`);
    log(`      - Check no user data in hippocampus/neocortex`);
    log(`      - Check no node_modules (will be installed by user)\n`);

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
