#!/usr/bin/env node
/**
 * NMS Interactive Setup v0.6.0
 * Multi-mode installation: Standalone, OpenClaw Addon, Custom
 */

import readline from 'readline';
import { detectEnvironment, getRecommendedMode, getRecommendedPath } from './setup-utils/detect-environment.js';
import { standaloneSetup } from './setup-modes/standalone.js';
import { openclawAddonSetup } from './setup-modes/openclaw-addon.js';
import { log, colors, checkNodeVersion, checkNpmVersion, question } from './setup-modes/shared.js';

/**
 * Create readline interface
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Display welcome screen
 */
function displayWelcome() {
  console.clear();

  log('╔════════════════════════════════════════════════════════════╗', 'bright');
  log('║        🧠 NMS Interactive Setup v0.6.0                    ║', 'bright');
  log('║        Neurobiological Memory System                       ║', 'bright');
  log('╚════════════════════════════════════════════════════════════╝', 'bright');
  log('');
}

/**
 * Display environment detection results
 */
function displayEnvironment(env) {
  log('🔍 Environment Detection:', 'blue');

  if (env.hasOpenClaw) {
    log(`   ✅ OpenClaw found at: ${env.openclaw.path}`, 'green');
  } else {
    log('   ℹ️  OpenClaw not detected', 'cyan');
  }

  if (env.hasClaudeCode) {
    log(`   ✅ Claude Code found at: ${env.claudeCode.path}`, 'green');
  } else {
    log('   ℹ️  Claude Code not detected', 'cyan');
  }

  if (env.hasNMS) {
    log(`   ⚠️  Existing NMS installation found at: ${env.nms.path}`, 'yellow');
    log(`   Version: ${env.nms.version}`, 'yellow');
  }

  log('');
}

/**
 * Ask user to select installation mode
 */
async function selectInstallationMode(rl, env) {
  const recommended = getRecommendedMode(env);

  log('🎯 Installation Mode Selection\n', 'blue');

  if (env.hasNMS) {
    log('   ⚠️  NMS is already installed!', 'yellow');
    log(`   Current mode: ${env.nms.installConfig?.mode || 'unknown'}\n`, 'yellow');

    const upgrade = await question(rl, '   Upgrade/reconfigure existing installation? (y/N): ');

    if (upgrade.toLowerCase() !== 'y') {
      log('\n   Installation cancelled. Your existing NMS is unchanged.', 'cyan');
      return null;
    }

    log('');
  }

  log('Choose installation mode:\n');
  log('  1. 🏠 Standalone      - Independent memory system (CLI + Dashboard)');
  log('  2. 🔗 OpenClaw Addon  - Auto-capture OpenClaw conversations' +
      (recommended === 'openclaw-addon' ? ' (Recommended)' : ''));

  if (env.hasOpenClaw) {
    log('                         Detected at: ' + env.openclaw.path, 'cyan');
  }

  log('  3. 🎛️  Custom          - Choose custom install location\n');

  const defaultChoice = recommended === 'openclaw-addon' && env.hasOpenClaw ? '2' : '1';
  const choice = await question(rl, `   Your choice (1-3, default: ${defaultChoice}): `);

  const modes = {
    '1': 'standalone',
    '2': 'openclaw-addon',
    '3': 'custom',
    '': recommended === 'openclaw-addon' && env.hasOpenClaw ? 'openclaw-addon' : 'standalone'
  };

  const selectedMode = modes[choice] || modes[''];

  // Validate OpenClaw addon mode
  if (selectedMode === 'openclaw-addon' && !env.hasOpenClaw) {
    log('\n   ❌ OpenClaw addon mode requires OpenClaw to be installed', 'red');
    log('   Please install OpenClaw first or choose Standalone mode\n', 'yellow');
    return await selectInstallationMode(rl, env);
  }

  return selectedMode;
}

/**
 * Get custom install path
 */
async function getCustomInstallPath(rl, env) {
  const defaultPath = getRecommendedPath('standalone', env);

  log('\n📁 Custom Installation Path\n', 'blue');
  log(`   Default: ${defaultPath}\n`, 'cyan');

  const customPath = await question(rl, '   Enter custom path (or press Enter for default): ');

  return customPath.trim() || defaultPath;
}

/**
 * Main setup orchestrator
 */
async function main() {
  displayWelcome();

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

    log('');

    // 2. Detect environment
    log('🔍 Detecting environment...', 'blue');
    const env = await detectEnvironment();
    log('   ✅ Detection complete\n', 'green');

    displayEnvironment(env);

    // 3. Select installation mode
    const mode = await selectInstallationMode(rl, env);

    if (!mode) {
      // User cancelled
      rl.close();
      return;
    }

    // 4. Get install path for custom mode
    let installPath = getRecommendedPath(mode, env);

    if (mode === 'custom') {
      installPath = await getCustomInstallPath(rl, env);
    }

    // 5. Run appropriate setup mode
    let result;

    switch (mode) {
      case 'standalone':
        result = await standaloneSetup(rl, env, { installPath });
        break;

      case 'openclaw-addon':
        result = await openclawAddonSetup(rl, env, { installPath });
        break;

      case 'custom':
        result = await standaloneSetup(rl, env, { installPath });
        break;

      default:
        log(`\n❌ Unknown mode: ${mode}`, 'red');
        process.exit(1);
    }

    // 6. Handle result
    if (result.success) {
      log('\n✅ Setup completed successfully!', 'green');
      log('🚀 You are ready to use NMS!\n', 'bright');
    } else if (result.cancelled) {
      log('\n⏭️  Setup was cancelled', 'yellow');
    } else {
      log('\n❌ Setup failed', 'red');
      if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      }
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
main();
