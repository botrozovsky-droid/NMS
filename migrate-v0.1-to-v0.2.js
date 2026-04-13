#!/usr/bin/env node
/**
 * Migration Script: v0.1 → v0.2
 *
 * Converts v0.1 knowledge graph to v0.2 format with:
 * - Enhanced metadata (extractionType, confidence, rationale)
 * - Canonical forms for deduplication
 * - Dual-source architecture (code + experience)
 * - Flags for quality control
 *
 * SAFE: Validates before saving, creates backup
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths
const NEOCORTEX_DIR = path.join(__dirname, 'neocortex');
const KNOWLEDGE_GRAPH = path.join(NEOCORTEX_DIR, 'knowledge-graph.json');
const BACKUP_FILE = path.join(NEOCORTEX_DIR, 'knowledge-graph-v0.1-backup.json');

/**
 * Normalize string to canonical form
 */
function canonicalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Migrate a single node to v0.2 format
 */
function migrateNode(nodeId, node) {
  // Preserve all v0.1 fields
  const migratedNode = { ...node };

  // Add metadata (Graphify-inspired)
  migratedNode.extractionType = 'INFERRED';  // All v0.1 data is LLM-inferred
  migratedNode.confidence = node.weight || 0.7;  // Use weight as confidence proxy
  migratedNode.rationale = `Migrated from v0.1 - extracted by Gemini consolidation from ${node.sources?.length || 0} episodes`;
  migratedNode.evidenceEvents = node.sources || [];

  // Add canonical form
  migratedNode.canonicalForm = canonicalize(node.name || nodeId);
  migratedNode.aliases = [];

  // Add dual-source (experience only for v0.1)
  migratedNode.codeSource = null;  // Not available in v0.1

  migratedNode.experienceSource = {
    activations: node.activations || 0,
    lastActivation: node.lastActivation || Date.now(),
    coMentionedWith: [],  // Can be populated from edges
    sentiment: 'neutral',  // Unknown in v0.1
    errors: [],
    successfulUseCases: 0,
    extractionType: 'INFERRED',
    confidence: node.weight || 0.7
  };

  // Add flags
  migratedNode.flags = [];

  // Auto-flag low confidence nodes
  if (migratedNode.confidence < 0.3) {
    migratedNode.flags.push('low_confidence');
  }

  // Auto-flag nodes with no evidence
  if (!migratedNode.evidenceEvents || migratedNode.evidenceEvents.length === 0) {
    migratedNode.flags.push('no_evidence');
  }

  return migratedNode;
}

/**
 * Migrate a single edge to v0.2 format
 */
function migrateEdge(edgeId, edge) {
  // Preserve all v0.1 fields
  const migratedEdge = { ...edge };

  // Add metadata
  migratedEdge.extractionType = 'INFERRED';
  migratedEdge.confidence = edge.weight || 0.7;
  migratedEdge.rationale = `Migrated from v0.1 - inferred relationship with ${edge.coActivations || 0} co-activations`;
  migratedEdge.evidenceEvents = [];  // v0.1 edges don't track evidence

  // Add sentiment (guess from edge type)
  if (edge.type?.includes('error') || edge.type?.includes('problem')) {
    migratedEdge.sentiment = 'negative';
  } else if (edge.type?.includes('success') || edge.type?.includes('prefers')) {
    migratedEdge.sentiment = 'positive';
  } else {
    migratedEdge.sentiment = 'neutral';
  }

  // Add code evidence (not available in v0.1)
  migratedEdge.codeEvidence = null;

  // Add flags
  migratedEdge.flags = [];

  // Auto-flag low confidence edges
  if (migratedEdge.confidence < 0.3) {
    migratedEdge.flags.push('low_confidence');
  }

  // Auto-flag edges with no evidence
  migratedEdge.flags.push('no_direct_evidence');

  return migratedEdge;
}

/**
 * Validate v0.2 structure
 */
function validateV02(graph) {
  const errors = [];

  // Check required top-level fields
  if (!graph.version) errors.push('Missing version field');
  if (!graph.nodes) errors.push('Missing nodes field');
  if (!graph.edges) errors.push('Missing edges field');

  // Validate nodes
  for (const [nodeId, node] of Object.entries(graph.nodes || {})) {
    if (!node.extractionType) {
      errors.push(`Node ${nodeId}: missing extractionType`);
    }
    if (node.confidence === undefined) {
      errors.push(`Node ${nodeId}: missing confidence`);
    }
    if (node.confidence < 0 || node.confidence > 1) {
      errors.push(`Node ${nodeId}: invalid confidence ${node.confidence}`);
    }
    if (!node.rationale) {
      errors.push(`Node ${nodeId}: missing rationale`);
    }
    if (!node.canonicalForm) {
      errors.push(`Node ${nodeId}: missing canonicalForm`);
    }
  }

  // Validate edges
  for (const [edgeId, edge] of Object.entries(graph.edges || {})) {
    if (!edge.extractionType) {
      errors.push(`Edge ${edgeId}: missing extractionType`);
    }
    if (edge.confidence === undefined) {
      errors.push(`Edge ${edgeId}: missing confidence`);
    }
    if (!edge.sentiment) {
      errors.push(`Edge ${edgeId}: missing sentiment`);
    }
  }

  return errors;
}

/**
 * Main migration function
 */
async function migrateGraph() {
  console.log('🔄 Starting migration: v0.1 → v0.2');
  console.log('');

  // Step 1: Load v0.1 graph
  console.log('[1/6] Loading v0.1 graph...');
  let v01Graph;
  try {
    const data = await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8');
    v01Graph = JSON.parse(data);
    console.log(`✅ Loaded ${Object.keys(v01Graph.nodes || {}).length} nodes, ${Object.keys(v01Graph.edges || {}).length} edges`);
  } catch (error) {
    console.error('❌ Failed to load graph:', error.message);
    process.exit(1);
  }

  // Step 2: Create backup
  console.log('');
  console.log('[2/6] Creating backup...');
  try {
    await fs.writeFile(BACKUP_FILE, JSON.stringify(v01Graph, null, 2));
    console.log(`✅ Backup saved: ${BACKUP_FILE}`);
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    process.exit(1);
  }

  // Step 3: Migrate nodes
  console.log('');
  console.log('[3/6] Migrating nodes...');
  const v02Nodes = {};
  let nodeCount = 0;
  for (const [nodeId, node] of Object.entries(v01Graph.nodes || {})) {
    v02Nodes[nodeId] = migrateNode(nodeId, node);
    nodeCount++;
  }
  console.log(`✅ Migrated ${nodeCount} nodes`);

  // Step 4: Migrate edges
  console.log('');
  console.log('[4/6] Migrating edges...');
  const v02Edges = {};
  let edgeCount = 0;
  for (const [edgeId, edge] of Object.entries(v01Graph.edges || {})) {
    v02Edges[edgeId] = migrateEdge(edgeId, edge);
    edgeCount++;
  }
  console.log(`✅ Migrated ${edgeCount} edges`);

  // Step 5: Build v0.2 graph
  const v02Graph = {
    version: '2.0.0',
    migrated: true,
    migratedFrom: v01Graph.version || '1.0.0',
    migrationDate: new Date().toISOString(),
    created: v01Graph.created,
    lastUpdated: new Date().toISOString(),

    nodes: v02Nodes,
    edges: v02Edges,
    clusters: v01Graph.clusters || {},

    statistics: {
      ...v01Graph.statistics,
      migratedNodes: nodeCount,
      migratedEdges: edgeCount
    },

    metadata: {
      ...v01Graph.metadata,
      schemaVersion: '2.0.0',
      migrationNotes: 'Migrated from v0.1 with default metadata values'
    },

    description: v01Graph.description || 'Neocortical knowledge graph - consolidated semantic knowledge'
  };

  // Step 6: Validate v0.2 structure
  console.log('');
  console.log('[5/6] Validating v0.2 structure...');
  const errors = validateV02(v02Graph);
  if (errors.length > 0) {
    console.error('❌ Validation failed:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
  console.log('✅ Validation passed');

  // Step 7: Save v0.2 graph
  console.log('');
  console.log('[6/6] Saving v0.2 graph...');
  try {
    await fs.writeFile(KNOWLEDGE_GRAPH, JSON.stringify(v02Graph, null, 2));
    console.log(`✅ Saved: ${KNOWLEDGE_GRAPH}`);
  } catch (error) {
    console.error('❌ Failed to save graph:', error.message);
    console.error('🔄 Restoring from backup...');
    try {
      await fs.writeFile(KNOWLEDGE_GRAPH, JSON.stringify(v01Graph, null, 2));
      console.log('✅ Restored from backup');
    } catch (restoreError) {
      console.error('❌ Failed to restore! Manual intervention required.');
      console.error(`Backup location: ${BACKUP_FILE}`);
    }
    process.exit(1);
  }

  // Done!
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  ✅ Migration completed successfully  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('Summary:');
  console.log(`  - Migrated ${nodeCount} nodes`);
  console.log(`  - Migrated ${edgeCount} edges`);
  console.log(`  - Schema version: 2.0.0`);
  console.log(`  - Backup saved: ${BACKUP_FILE}`);
  console.log('');
  console.log('New features added:');
  console.log('  ✅ extractionType (EXTRACTED/INFERRED)');
  console.log('  ✅ confidence scores (0.0-1.0)');
  console.log('  ✅ rationale (evidence explanation)');
  console.log('  ✅ canonical forms (deduplication)');
  console.log('  ✅ dual-source architecture');
  console.log('  ✅ sentiment tags');
  console.log('  ✅ quality flags');
  console.log('');
}

/**
 * Rollback to v0.1
 */
async function rollback() {
  console.log('🔄 Rolling back to v0.1...');

  try {
    const backup = await fs.readFile(BACKUP_FILE, 'utf-8');
    await fs.writeFile(KNOWLEDGE_GRAPH, backup);
    console.log('✅ Rollback completed');
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

// CLI
const command = process.argv[2];

if (command === 'rollback') {
  rollback();
} else {
  migrateGraph();
}
