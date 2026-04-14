/**
 * Environment Detection Utility
 * Detects existing installations of OpenClaw, Claude Code, and NMS
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Detect OpenClaw installation
 */
async function detectOpenClaw() {
  const home = os.homedir();
  const openclawPath = path.join(home, '.openclaw');

  try {
    await fs.access(openclawPath);

    // Check if it's a valid OpenClaw installation
    const agentsPath = path.join(openclawPath, 'agents');
    await fs.access(agentsPath);

    return {
      found: true,
      path: openclawPath,
      agentsPath,
      hooksPath: path.join(agentsPath, 'main', 'hooks')
    };
  } catch {
    return { found: false };
  }
}

/**
 * Detect Claude Code installation
 */
async function detectClaudeCode() {
  const home = os.homedir();
  const claudePath = path.join(home, '.claude');

  try {
    await fs.access(claudePath);

    return {
      found: true,
      path: claudePath,
      configPath: path.join(claudePath, 'config.json')
    };
  } catch {
    return { found: false };
  }
}

/**
 * Detect existing NMS installation
 */
async function detectNMS() {
  const home = os.homedir();
  const nmsPaths = [
    path.join(home, '.nms'),
    path.join(home, '.openclaw', 'memory')
  ];

  for (const nmsPath of nmsPaths) {
    try {
      await fs.access(nmsPath);

      // Check if it's a valid NMS installation
      const neocortexPath = path.join(nmsPath, 'neocortex');
      await fs.access(neocortexPath);

      // Check for installation config
      const installConfigPath = path.join(nmsPath, 'meta', 'installation.json');
      let installConfig = null;
      try {
        const data = await fs.readFile(installConfigPath, 'utf-8');
        installConfig = JSON.parse(data);
      } catch {
        // No installation config (old version)
      }

      return {
        found: true,
        path: nmsPath,
        installConfig,
        version: installConfig?.version || 'legacy'
      };
    } catch {
      continue;
    }
  }

  return { found: false };
}

/**
 * Detect full environment
 */
export async function detectEnvironment() {
  const home = os.homedir();

  const [openclaw, claudeCode, nms] = await Promise.all([
    detectOpenClaw(),
    detectClaudeCode(),
    detectNMS()
  ]);

  return {
    home,
    openclaw,
    claudeCode,
    nms,
    hasOpenClaw: openclaw.found,
    hasClaudeCode: claudeCode.found,
    hasNMS: nms.found
  };
}

/**
 * Get recommended installation mode
 */
export function getRecommendedMode(env) {
  if (env.hasNMS) {
    // Already installed, suggest upgrade
    return env.nms.installConfig?.mode || 'standalone';
  }

  if (env.hasOpenClaw) {
    return 'openclaw-addon';
  }

  return 'standalone';
}

/**
 * Get recommended install path
 */
export function getRecommendedPath(mode, env) {
  if (mode === 'openclaw-addon' && env.hasOpenClaw) {
    return path.join(env.openclaw.path, 'memory');
  }

  return path.join(env.home, '.nms');
}
