#!/usr/bin/env node
/**
 * Hallucination Detector Module
 * Automatically detects potential hallucinations and suspicious patterns
 *
 * Detection rules:
 * 1. INFERRED + no evidence + low confidence → potential_hallucination
 * 2. Code exists but never used → unused_import
 * 3. High confidence but no evidence → suspicious_confidence
 * 4. INFERRED relationship with weak rationale → weak_inference
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Detect hallucinations in nodes
 */
export function detectNodeHallucinations(graph) {
  const flagged = [];

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const issues = [];

    // Rule 1: INFERRED + no evidence + low confidence
    if (node.extractionType === 'INFERRED' &&
        (!node.evidenceEvents || node.evidenceEvents.length === 0) &&
        node.confidence < 0.5) {
      issues.push({
        type: 'potential_hallucination',
        severity: 'high',
        reason: `INFERRED type with no evidence and low confidence (${node.confidence.toFixed(2)})`
      });
    }

    // Rule 2: Code source exists but never used in practice
    if (node.codeSource?.exists &&
        node.experienceSource?.activations === 0) {
      issues.push({
        type: 'unused_import',
        severity: 'medium',
        reason: `Found in code (${node.codeSource.foundIn?.length || 0} files) but never used in practice`
      });
    }

    // Rule 3: High confidence but no evidence
    if (node.confidence > 0.8 &&
        (!node.evidenceEvents || node.evidenceEvents.length === 0) &&
        node.extractionType !== 'EXTRACTED') {
      issues.push({
        type: 'suspicious_confidence',
        severity: 'medium',
        reason: `High confidence (${node.confidence.toFixed(2)}) but no supporting evidence`
      });
    }

    // Rule 4: Very low activations for high weight
    if (node.weight > 0.7 && node.activations < 3) {
      issues.push({
        type: 'suspicious_weight',
        severity: 'low',
        reason: `High weight (${node.weight.toFixed(2)}) but few activations (${node.activations})`
      });
    }

    // Rule 5: Rationale too short or generic
    if (node.rationale && node.rationale.length < 20) {
      issues.push({
        type: 'weak_rationale',
        severity: 'low',
        reason: `Rationale too short (${node.rationale.length} chars): "${node.rationale}"`
      });
    }

    if (issues.length > 0) {
      flagged.push({
        nodeId,
        node: node.name,
        issues,
        currentFlags: node.flags || []
      });

      // Auto-add flags
      node.flags = node.flags || [];
      for (const issue of issues) {
        if (!node.flags.includes(issue.type)) {
          node.flags.push(issue.type);
        }
      }
    }
  }

  return flagged;
}

/**
 * Detect hallucinations in edges
 */
export function detectEdgeHallucinations(graph) {
  const flagged = [];

  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    const issues = [];

    // Rule 1: INFERRED + no evidence + weak rationale
    if (edge.extractionType === 'INFERRED' &&
        (!edge.evidenceEvents || edge.evidenceEvents.length === 0) &&
        (!edge.rationale || edge.rationale.length < 20)) {
      issues.push({
        type: 'weak_inference',
        severity: 'high',
        reason: 'INFERRED relationship with no evidence and weak rationale'
      });
    }

    // Rule 2: Low confidence
    if (edge.confidence < 0.4) {
      issues.push({
        type: 'low_confidence',
        severity: 'medium',
        reason: `Very low confidence (${edge.confidence.toFixed(2)})`
      });
    }

    // Rule 3: Source or target node doesn't exist
    if (!graph.nodes[edge.source]) {
      issues.push({
        type: 'broken_reference',
        severity: 'high',
        reason: `Source node "${edge.source}" doesn't exist`
      });
    }
    if (!graph.nodes[edge.target]) {
      issues.push({
        type: 'broken_reference',
        severity: 'high',
        reason: `Target node "${edge.target}" doesn't exist`
      });
    }

    // Rule 4: Few co-activations for high weight
    if (edge.weight > 0.7 && edge.coActivations < 3) {
      issues.push({
        type: 'suspicious_weight',
        severity: 'low',
        reason: `High weight (${edge.weight.toFixed(2)}) but few co-activations (${edge.coActivations})`
      });
    }

    if (issues.length > 0) {
      flagged.push({
        edgeId,
        edge: `${edge.source} → ${edge.target}`,
        issues,
        currentFlags: edge.flags || []
      });

      // Auto-add flags
      edge.flags = edge.flags || [];
      for (const issue of issues) {
        if (!edge.flags.includes(issue.type)) {
          edge.flags.push(issue.type);
        }
      }
    }
  }

  return flagged;
}

/**
 * Detect all hallucinations in graph
 */
export function detectAllHallucinations(graph) {
  const nodes = detectNodeHallucinations(graph);
  const edges = detectEdgeHallucinations(graph);

  return {
    nodes,
    edges,
    total: nodes.length + edges.length,
    summary: {
      highSeverity: [...nodes, ...edges].filter(item =>
        item.issues.some(i => i.severity === 'high')
      ).length,
      mediumSeverity: [...nodes, ...edges].filter(item =>
        item.issues.some(i => i.severity === 'medium')
      ).length,
      lowSeverity: [...nodes, ...edges].filter(item =>
        item.issues.some(i => i.severity === 'low')
      ).length
    }
  };
}

/**
 * Generate human-readable report
 */
export function generateReport(detections) {
  const lines = [];

  lines.push('╔═══════════════════════════════════════════╗');
  lines.push('║  🔍 Hallucination Detection Report      ║');
  lines.push('╚═══════════════════════════════════════════╝');
  lines.push('');

  lines.push('📊 Summary:');
  lines.push(`  Total issues: ${detections.total}`);
  lines.push(`  High severity: ${detections.summary.highSeverity}`);
  lines.push(`  Medium severity: ${detections.summary.mediumSeverity}`);
  lines.push(`  Low severity: ${detections.summary.lowSeverity}`);
  lines.push('');

  if (detections.nodes.length > 0) {
    lines.push('🔴 Node Issues:');
    lines.push('');

    for (const item of detections.nodes) {
      lines.push(`  📌 ${item.node} (${item.nodeId})`);
      for (const issue of item.issues) {
        const emoji = issue.severity === 'high' ? '⛔' :
                     issue.severity === 'medium' ? '⚠️' : 'ℹ️';
        lines.push(`     ${emoji} [${issue.type}] ${issue.reason}`);
      }
      if (item.currentFlags.length > 0) {
        lines.push(`     🏴 Current flags: ${item.currentFlags.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (detections.edges.length > 0) {
    lines.push('🔴 Edge Issues:');
    lines.push('');

    for (const item of detections.edges) {
      lines.push(`  📌 ${item.edge}`);
      for (const issue of item.issues) {
        const emoji = issue.severity === 'high' ? '⛔' :
                     issue.severity === 'medium' ? '⚠️' : 'ℹ️';
        lines.push(`     ${emoji} [${issue.type}] ${issue.reason}`);
      }
      if (item.currentFlags.length > 0) {
        lines.push(`     🏴 Current flags: ${item.currentFlags.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (detections.total === 0) {
    lines.push('✅ No issues detected!');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Auto-fix some issues
 */
export function autoFix(graph, detections) {
  let fixed = 0;

  // Fix broken references by removing edges
  for (const item of detections.edges) {
    if (item.issues.some(i => i.type === 'broken_reference')) {
      delete graph.edges[item.edgeId];
      graph.statistics.totalEdges--;
      fixed++;
    }
  }

  // Lower confidence for suspicious items
  for (const item of detections.nodes) {
    if (item.issues.some(i => i.type === 'suspicious_confidence')) {
      const node = graph.nodes[item.nodeId];
      if (node) {
        node.confidence *= 0.7;  // Reduce by 30%
        fixed++;
      }
    }
  }

  return { fixed, remaining: detections.total - fixed };
}

// CLI Usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const KNOWLEDGE_GRAPH = path.join(__dirname, 'neocortex', 'knowledge-graph.json');

  async function main() {
    const data = await fs.readFile(KNOWLEDGE_GRAPH, 'utf-8');
    const graph = JSON.parse(data);

    const detections = detectAllHallucinations(graph);
    const report = generateReport(detections);

    console.log(report);

    if (detections.total > 0) {
      const autofix = process.argv.includes('--fix');

      if (autofix) {
        console.log('🔧 Auto-fixing issues...');
        const result = autoFix(graph, detections);
        console.log(`✅ Fixed ${result.fixed} issues`);
        console.log(`⚠️  ${result.remaining} issues remain (manual review required)`);

        await fs.writeFile(KNOWLEDGE_GRAPH, JSON.stringify(graph, null, 2));
        console.log(`📝 Updated: ${KNOWLEDGE_GRAPH}`);
      } else {
        console.log('💡 Run with --fix to auto-fix some issues');
      }
    }
  }

  main().catch(console.error);
}
