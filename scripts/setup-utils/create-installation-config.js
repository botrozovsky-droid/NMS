/**
 * Installation Config Creator
 * Creates and manages installation.json
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Create installation configuration
 */
export async function createInstallationConfig(installPath, mode, options = {}) {
  const {
    openclawPath = null,
    hookInstalled = false,
    hookVersion = null,
    log = console.log
  } = options;

  const config = {
    version: '0.6.0',
    installedAt: new Date().toISOString(),
    mode, // standalone | openclaw-addon | custom
    installPath,

    integrations: {},

    setup: {
      completed: true,
      lastUpdate: new Date().toISOString()
    }
  };

  // Add OpenClaw integration config
  if (mode === 'openclaw-addon' && openclawPath) {
    config.integrations.openclaw = {
      enabled: true,
      hookInstalled,
      hookVersion: hookVersion || '1.0.0',
      openclawPath,
      autoSync: true
    };
  }

  // Add Claude Code integration config (for future)
  config.integrations.claudeCode = {
    enabled: false
  };

  // Ensure meta directory exists
  const metaDir = path.join(installPath, 'meta');
  await fs.mkdir(metaDir, { recursive: true });

  // Write config
  const configPath = path.join(metaDir, 'installation.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  log('   ✅ Created installation.json');

  return config;
}

/**
 * Read installation configuration
 */
export async function readInstallationConfig(installPath) {
  try {
    const configPath = path.join(installPath, 'meta', 'installation.json');
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Update installation configuration
 */
export async function updateInstallationConfig(installPath, updates) {
  const configPath = path.join(installPath, 'meta', 'installation.json');

  // Read existing config
  let config = await readInstallationConfig(installPath);

  if (!config) {
    throw new Error('Installation config not found');
  }

  // Merge updates
  config = {
    ...config,
    ...updates,
    setup: {
      ...config.setup,
      lastUpdate: new Date().toISOString()
    }
  };

  // Write updated config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return config;
}

/**
 * Check if NMS is installed
 */
export async function isNMSInstalled(installPath) {
  const config = await readInstallationConfig(installPath);
  return config !== null && config.setup?.completed === true;
}
