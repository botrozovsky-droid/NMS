/**
 * OpenClaw Addon Setup Mode
 * Installs NMS as OpenClaw integration with automatic hook
 */

import path from 'path';
import {
  log,
  setupEnvFile,
  initializeDirectories,
  createConfigFiles,
  question
} from './shared.js';
import { createInstallationConfig } from '../setup-utils/create-installation-config.js';
import { installOpenClawHook, verifyHookInstallation } from '../setup-utils/install-openclaw-hook.js';

/**
 * Run OpenClaw addon setup
 */
export async function openclawAddonSetup(rl, env, options = {}) {
  const openclawPath = env.openclaw.path;
  const installPath = options.installPath || path.join(openclawPath, 'memory');

  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║      🔗 OpenClaw Addon Mode - Auto Integration        ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝', 'bright');

  log('\n📍 Installation Details:', 'blue');
  log(`   OpenClaw: ${openclawPath}`, 'cyan');
  log(`   NMS Location: ${installPath}`, 'cyan');
  log('   Mode: OpenClaw Addon');
  log('   Features: Auto-capture conversations + Hook integration\n');

  log('✨ What will be installed:', 'blue');
  log('   ✅ NMS memory system in ~/.openclaw/memory/');
  log('   ✅ Integration hook in ~/.openclaw/agents/main/hooks/');
  log('   ✅ Automatic conversation capture');
  log('   ✅ Session-end consolidation');
  log('   ✅ Web dashboard access\n');

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

    // 4. Install OpenClaw hook
    log('\n🔌 Installing OpenClaw Integration Hook...', 'blue');
    const hookResult = await installOpenClawHook(openclawPath, installPath, { log });

    if (!hookResult.success) {
      log('\n⚠️  Hook installation failed, but NMS is installed', 'yellow');
      log('   You can install the hook manually later', 'yellow');
    }

    // 5. Create installation config
    await createInstallationConfig(installPath, 'openclaw-addon', {
      openclawPath,
      hookInstalled: hookResult.success,
      hookVersion: hookResult.version,
      log
    });

    // 6. Verify installation
    const verification = await verifyHookInstallation(openclawPath);
    if (verification.installed) {
      log('\n✅ Hook verification successful', 'green');
    }

    // 7. Print next steps
    printOpenClawNextSteps(installPath, openclawPath, hookResult.success);

    return {
      success: true,
      mode: 'openclaw-addon',
      installPath,
      openclawPath,
      hookInstalled: hookResult.success
    };

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

/**
 * Print next steps for OpenClaw addon mode
 */
function printOpenClawNextSteps(installPath, openclawPath, hookInstalled) {
  log('\n🎉 OpenClaw Addon Setup Complete!', 'green');

  if (hookInstalled) {
    log('\n✨ Integration Active:', 'blue');
    log('   ✅ Hook installed and ready');
    log('   ✅ All conversations will be automatically saved');
    log('   ✅ Memory consolidation runs after each session');
  } else {
    log('\n⚠️  Manual Hook Setup Required:', 'yellow');
    log('   Hook installation failed. To install manually:');
    log('   1. Copy openclaw-hook/* to:');
    log(`      ${openclawPath}/agents/main/hooks/nms-integration/`);
    log('   2. Restart OpenClaw');
  }

  log('\n📚 Next Steps:', 'blue');
  log('   1. Start using OpenClaw normally');
  log('      Your conversations will be automatically captured!');
  log('');
  log('   2. View your memory dashboard:');
  log('      cd ' + installPath, 'bright');
  log('      npm run dashboard', 'bright');
  log('      Then visit: http://localhost:3000\n', 'bright');
  log('');
  log('   3. Query accumulated memories:');
  log('      npm run query "search term"', 'bright');
  log('');
  log('   4. Manual consolidation (optional):');
  log('      npm run consolidate', 'bright');

  log('\n🔄 Synchronization:', 'blue');
  log('   Existing OpenClaw sessions can be imported:');
  log('   npm run sync:openclaw', 'bright');

  log('\n📖 Documentation:', 'blue');
  log('   OpenClaw Hook:   openclaw-hook/HOOK.md');
  log('   Getting Started: docs/GETTING-STARTED.md');
  log('   Import Guide:    docs/IMPORT-GUIDE.md\n');
}
