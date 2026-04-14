/**
 * OpenClaw Hook Installer
 * Installs NMS integration hook into OpenClaw
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Install OpenClaw hook
 */
export async function installOpenClawHook(openclawPath, nmsPath, options = {}) {
  const { log = console.log } = options;

  const projectRoot = path.join(__dirname, '..', '..');
  const hookSource = path.join(projectRoot, 'openclaw-hook');
  const hookDest = path.join(openclawPath, 'agents', 'main', 'hooks', 'nms-integration');

  try {
    // 1. Create hook directory
    await fs.mkdir(hookDest, { recursive: true });
    log('   📁 Created hook directory');

    // 2. Copy handler.js
    const handlerSource = path.join(hookSource, 'handler.js');
    const handlerDest = path.join(hookDest, 'handler.js');
    await fs.copyFile(handlerSource, handlerDest);
    log('   ✅ Installed handler.js');

    // 3. Copy HOOK.md
    const docSource = path.join(hookSource, 'HOOK.md');
    const docDest = path.join(hookDest, 'HOOK.md');
    await fs.copyFile(docSource, docDest);
    log('   ✅ Installed HOOK.md');

    // 4. Create hook config
    const hookConfig = {
      version: '1.0.0',
      nmsPath,
      autoSync: true,
      events: ['message', 'response', 'tool_call', 'session_end'],
      installedAt: new Date().toISOString()
    };

    const configPath = path.join(hookDest, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(hookConfig, null, 2));
    log('   ✅ Created hook config');

    return {
      success: true,
      hookPath: hookDest,
      version: '1.0.0'
    };

  } catch (error) {
    log(`   ❌ Failed to install hook: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify hook installation
 */
export async function verifyHookInstallation(openclawPath) {
  const hookPath = path.join(openclawPath, 'agents', 'main', 'hooks', 'nms-integration');

  try {
    // Check handler.js exists
    await fs.access(path.join(hookPath, 'handler.js'));

    // Check config.json exists
    const configPath = path.join(hookPath, 'config.json');
    await fs.access(configPath);

    // Read config
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    return {
      installed: true,
      version: config.version,
      nmsPath: config.nmsPath
    };

  } catch {
    return {
      installed: false
    };
  }
}

/**
 * Uninstall OpenClaw hook
 */
export async function uninstallOpenClawHook(openclawPath, options = {}) {
  const { log = console.log } = options;
  const hookPath = path.join(openclawPath, 'agents', 'main', 'hooks', 'nms-integration');

  try {
    await fs.rm(hookPath, { recursive: true, force: true });
    log('   ✅ Removed OpenClaw hook');
    return { success: true };
  } catch (error) {
    log(`   ❌ Failed to remove hook: ${error.message}`);
    return { success: false, error: error.message };
  }
}
