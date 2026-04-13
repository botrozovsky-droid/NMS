/**
 * JSON Store - v0.3.1
 *
 * Centralized JSON file operations for OpenClaw Memory System.
 * Eliminates 72 lines of duplicated code across the codebase.
 *
 * Used by: consolidate.js, mini-consolidate.js, meta-learn.js, memory-manager.js
 */

import fs from 'fs/promises';

/**
 * Load JSON file with error handling
 * @param {string} filePath - Absolute path to JSON file
 * @returns {Promise<object|null>} - Parsed JSON or null on error
 */
export async function loadJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Save JSON file with pretty formatting
 * @param {string} filePath - Absolute path to JSON file
 * @param {object} data - Data to serialize
 * @returns {Promise<boolean>} - Success status
 */
export async function saveJSON(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Check if JSON file exists
 * @param {string} filePath - Absolute path to JSON file
 * @returns {Promise<boolean>} - True if exists
 */
export async function existsJSON(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
