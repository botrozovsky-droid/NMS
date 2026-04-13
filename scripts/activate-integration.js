#!/usr/bin/env node
/**
 * Activate OpenClaw Memory integration with Claude Code
 * This script configures Claude Code to automatically record to Memory
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function main() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════╗', 'blue');
  log('║   🔗 Activate OpenClaw Memory Integration               ║', 'blue');
  log('╚══════════════════════════════════════════════════════════╝', 'blue');

  const memoryPath = path.join(__dirname, '..');
  const claudeConfigPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'settings.json');

  log('\n📋 Integration plan:', 'blue');
  log(`   Memory path: ${memoryPath}`);
  log(`   Claude config: ${claudeConfigPath}\n`);

  try {
    // Check if Claude Code settings exist
    let settings = {};
    try {
      const data = await fs.readFile(claudeConfigPath, 'utf-8');
      settings = JSON.parse(data);
      log('   ✅ Found Claude Code settings', 'green');
    } catch {
      log('   ℹ️  Claude Code settings not found (will create)', 'yellow');
    }

    // Add memory integration
    settings.memory = {
      enabled: true,
      path: memoryPath,
      autoRecord: true,
      autoConsolidate: true,
      consolidateOnSessionEnd: true,
    };

    // Add hooks
    settings.hooks = {
      ...settings.hooks,
      onToolCall: `${memoryPath}/integration.js:onToolCall`,
      onUserMessage: `${memoryPath}/integration.js:onUserMessage`,
      onAssistantResponse: `${memoryPath}/integration.js:onAssistantResponse`,
      onError: `${memoryPath}/integration.js:onError`,
      onSessionEnd: `${memoryPath}/integration.js:onSessionEnd`,
    };

    // Save settings
    await fs.mkdir(path.dirname(claudeConfigPath), { recursive: true });
    await fs.writeFile(claudeConfigPath, JSON.stringify(settings, null, 2));

    log('\n✅ Integration activated!', 'green');
    log('\n📝 Configuration:', 'blue');
    log(JSON.stringify(settings, null, 2), 'reset');

    log('\n🎯 Next steps:', 'blue');
    log('   1. Restart Claude Code (if running)');
    log('   2. Start a new conversation');
    log('   3. Check memory is recording:');
    log('      cd ' + memoryPath);
    log('      npm run stats\n');

    log('✅ All future Claude Code conversations will be automatically saved to Memory!', 'green');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
