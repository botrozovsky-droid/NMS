#!/usr/bin/env node
/**
 * Canonical Forms Module
 * Handles deduplication of nodes through canonical form normalization
 *
 * Features:
 * - Normalize node names to canonical forms
 * - Detect duplicates (e.g., "FastAPI", "fast-api", "fastapi")
 * - Merge duplicate nodes preserving all data
 * - Fuzzy matching for detection
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Normalize string to canonical form
 * Rules:
 * - Lowercase
 * - Remove non-alphanumeric (except underscores)
 * - Trim whitespace
 *
 * Examples:
 * - "FastAPI" → "fastapi"
 * - "config.json" → "configjson"
 * - "Python 3.11" → "python311"
 */
export function canonicalize(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

/**
 * Compute Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if two strings are similar (fuzzy match)
 * Threshold: 0.8 (80% similarity)
 */
function areSimilar(str1, str2, threshold = 0.8) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return true;

  const distance = levenshteinDistance(str1, str2);
  const similarity = 1 - (distance / maxLen);

  return similarity >= threshold;
}

/**
 * Find potential duplicate nodes in graph
 *
 * Returns array of duplicate groups:
 * [
 *   { canonical: "fastapi", duplicates: ["fast-api", "FastAPI"] },
 *   ...
 * ]
 */
export function findDuplicates(graph) {
  const canonicalMap = new Map();
  const duplicateGroups = [];

  // Group by canonical form
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const canon = node.canonicalForm || canonicalize(node.name || nodeId);

    if (!canonicalMap.has(canon)) {
      canonicalMap.set(canon, []);
    }

    canonicalMap.get(canon).push(nodeId);
  }

  // Find groups with duplicates
  for (const [canon, nodeIds] of canonicalMap.entries()) {
    if (nodeIds.length > 1) {
      duplicateGroups.push({
        canonical: canon,
        nodes: nodeIds,
        count: nodeIds.length
      });
    }
  }

  // Also check fuzzy matches across different canonical forms
  const canonicals = Array.from(canonicalMap.keys());
  for (let i = 0; i < canonicals.length; i++) {
    for (let j = i + 1; j < canonicals.length; j++) {
      if (areSimilar(canonicals[i], canonicals[j])) {
        const group1 = canonicalMap.get(canonicals[i]);
        const group2 = canonicalMap.get(canonicals[j]);

        duplicateGroups.push({
          canonical: canonicals[i],
          fuzzyMatch: canonicals[j],
          nodes: [...group1, ...group2],
          count: group1.length + group2.length,
          type: 'fuzzy'
        });
      }
    }
  }

  return duplicateGroups;
}

/**
 * Merge duplicate nodes into canonical form
 *
 * Preserves:
 * - Maximum weight
 * - Sum of activations
 * - All evidence events
 * - All sources
 * - All aliases
 */
export function mergeDuplicates(graph, canonicalId, duplicateIds) {
  const canonical = graph.nodes[canonicalId];

  if (!canonical) {
    throw new Error(`Canonical node ${canonicalId} not found`);
  }

  let totalActivations = canonical.activations || 0;
  let totalWeight = canonical.weight || 0;
  const allEvidence = new Set(canonical.evidenceEvents || []);
  const allSources = new Set(canonical.sources || []);
  const allAliases = new Set(canonical.aliases || []);

  // Merge each duplicate into canonical
  for (const dupId of duplicateIds) {
    if (dupId === canonicalId) continue;

    const duplicate = graph.nodes[dupId];
    if (!duplicate) continue;

    // Merge activations
    totalActivations += duplicate.activations || 0;

    // Weighted average of weights
    totalWeight += (duplicate.weight || 0) * (duplicate.activations || 1);

    // Merge evidence
    if (duplicate.evidenceEvents) {
      duplicate.evidenceEvents.forEach(e => allEvidence.add(e));
    }

    // Merge sources
    if (duplicate.sources) {
      duplicate.sources.forEach(s => allSources.add(s));
    }

    // Merge aliases
    allAliases.add(duplicate.name);
    if (duplicate.aliases) {
      duplicate.aliases.forEach(a => allAliases.add(a));
    }

    // Update edges pointing to duplicate
    for (const [edgeId, edge] of Object.entries(graph.edges)) {
      if (edge.source === dupId) {
        edge.source = canonicalId;
      }
      if (edge.target === dupId) {
        edge.target = canonicalId;
      }

      // Update edge ID if needed
      if (edgeId.includes(dupId)) {
        const newEdgeId = edgeId.replace(dupId, canonicalId);
        if (newEdgeId !== edgeId) {
          graph.edges[newEdgeId] = edge;
          delete graph.edges[edgeId];
        }
      }
    }

    // Delete duplicate node
    delete graph.nodes[dupId];
    graph.statistics.totalNodes--;
  }

  // Update canonical with merged data
  canonical.activations = totalActivations;
  canonical.weight = totalWeight / totalActivations;
  canonical.evidenceEvents = Array.from(allEvidence);
  canonical.sources = Array.from(allSources);
  canonical.aliases = Array.from(allAliases).filter(a => a !== canonical.name);

  // Update confidence based on more evidence
  if (canonical.confidence !== undefined) {
    // More evidence = higher confidence
    const evidenceFactor = Math.min(1.0, Math.log(allEvidence.size + 1) / Math.log(20));
    canonical.confidence = Math.min(1.0, canonical.confidence + (1 - canonical.confidence) * evidenceFactor * 0.2);
  }

  // Remove low_confidence flag if confidence improved
  if (canonical.flags && canonical.confidence > 0.5) {
    canonical.flags = canonical.flags.filter(f => f !== 'low_confidence');
  }

  return {
    canonical: canonicalId,
    merged: duplicateIds.filter(id => id !== canonicalId),
    totalActivations,
    finalWeight: canonical.weight,
    evidenceCount: allEvidence.size
  };
}

/**
 * Auto-deduplicate entire graph
 */
export async function autoDeduplicate(graph, options = {}) {
  const { dryRun = false, verbose = false } = options;

  console.log('🔍 Scanning for duplicates...');
  const duplicates = findDuplicates(graph);

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found');
    return { mergedCount: 0, groups: [] };
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate groups`);

  const mergeResults = [];

  for (const group of duplicates) {
    if (group.type === 'fuzzy') {
      if (verbose) {
        console.log(`⚠️  Fuzzy match detected: ${group.canonical} ≈ ${group.fuzzyMatch}`);
        console.log(`   Nodes: ${group.nodes.join(', ')}`);
        console.log(`   Skipping (requires manual review)`);
      }
      continue;
    }

    // Use first node as canonical
    const canonicalId = group.nodes[0];
    const duplicateIds = group.nodes.slice(1);

    if (verbose) {
      console.log(`🔄 Merging: ${duplicateIds.join(', ')} → ${canonicalId}`);
    }

    if (!dryRun) {
      const result = mergeDuplicates(graph, canonicalId, duplicateIds);
      mergeResults.push(result);
    }
  }

  console.log(`✅ Merged ${mergeResults.length} groups`);

  return {
    mergedCount: mergeResults.length,
    groups: mergeResults
  };
}

// CLI Usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const KNOWLEDGE_GRAPH = path.join(__dirname, 'neocortex', 'knowledge-graph.json');

  async function main() {
    const data = await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8');
    const graph = JSON.parse(data);

    const result = await autoDeduplicate(graph, { verbose: true });

    if (result.mergedCount > 0) {
      await fs.writeFile(KNOWLEDGE_GRAPH, JSON.stringify(graph, null, 2));
      console.log(`📝 Updated: ${KNOWLEDGE_GRAPH}`);
    }
  }

  main().catch(console.error);
}
