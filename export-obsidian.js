#!/usr/bin/env node
/**
 * Obsidian Export - v0.3.3
 *
 * Exports knowledge graph to Obsidian-compatible Markdown vault.
 * Creates bidirectional wikilinks, YAML frontmatter, and organized structure.
 *
 * Features:
 * - Markdown files with [[wikilinks]]
 * - YAML frontmatter with metadata
 * - Bidirectional links (concepts ↔ related concepts)
 * - Organized by type (concepts/, events/, procedures/)
 * - Index file with statistics
 *
 * Usage:
 *   node export-obsidian.js [output-dir]
 *   npm run export:obsidian
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadJSON } from './lib/json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_GRAPH = path.join(__dirname, 'neocortex', 'knowledge-graph.json');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'exports', 'obsidian-vault');

/**
 * Format date for human readability
 */
function formatDate(timestamp) {
  return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Sanitize filename (remove invalid characters)
 */
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Get related nodes for a given node
 */
function getRelatedNodes(nodeId, graph) {
  const related = [];

  // Find outgoing edges
  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (edge.source === nodeId) {
      const targetNode = graph.nodes[edge.target];
      if (targetNode) {
        related.push({
          node: targetNode,
          type: edge.type,
          direction: 'outgoing',
          weight: edge.weight,
          sentiment: edge.sentiment
        });
      }
    }

    // Find incoming edges
    if (edge.target === nodeId) {
      const sourceNode = graph.nodes[edge.source];
      if (sourceNode) {
        related.push({
          node: sourceNode,
          type: edge.type,
          direction: 'incoming',
          weight: edge.weight,
          sentiment: edge.sentiment
        });
      }
    }
  }

  return related;
}

/**
 * Generate Markdown content for a node
 */
function generateNodeMarkdown(node, graph) {
  const related = getRelatedNodes(node.id, graph);

  // YAML frontmatter
  const frontmatter = `---
type: ${node.type}
canonical: ${node.canonicalForm || node.id}
weight: ${node.weight.toFixed(3)}
confidence: ${node.confidence?.toFixed(3) || 'N/A'}
extraction: ${node.extractionType || 'UNKNOWN'}
activations: ${node.activations}
created: ${formatDate(node.created)}
lastActivation: ${formatDate(node.lastActivation)}
tags: [${node.type}, ${node.extractionType?.toLowerCase() || 'unknown'}]
---

`;

  // Title
  let markdown = frontmatter;
  markdown += `# ${node.name}\n\n`;

  // Metadata section
  markdown += `## Metadata\n\n`;
  markdown += `- **ID:** \`${node.id}\`\n`;
  markdown += `- **Type:** ${node.type}\n`;
  markdown += `- **Weight:** ${node.weight.toFixed(3)} (${Math.round(node.weight * 100)}%)\n`;
  markdown += `- **Confidence:** ${node.confidence?.toFixed(3) || 'N/A'}\n`;
  markdown += `- **Extraction:** ${node.extractionType || 'UNKNOWN'}\n`;
  markdown += `- **Activations:** ${node.activations}\n`;

  if (node.aliases && node.aliases.length > 0) {
    markdown += `- **Aliases:** ${node.aliases.join(', ')}\n`;
  }

  markdown += `\n`;

  // Rationale
  if (node.rationale) {
    markdown += `## Rationale\n\n`;
    markdown += `${node.rationale}\n\n`;
  }

  // Flags (warnings)
  if (node.flags && node.flags.length > 0) {
    markdown += `## ⚠️ Flags\n\n`;
    node.flags.forEach(flag => {
      markdown += `- \`${flag}\`\n`;
    });
    markdown += `\n`;
  }

  // Experience source
  if (node.experienceSource) {
    const exp = node.experienceSource;
    markdown += `## Experience\n\n`;
    markdown += `- **Sentiment:** ${exp.sentiment || 'neutral'}\n`;
    markdown += `- **Successful Uses:** ${exp.successfulUseCases || 0}\n`;
    markdown += `- **Errors:** ${exp.errors?.length || 0}\n`;

    if (exp.coMentionedWith && exp.coMentionedWith.length > 0) {
      markdown += `- **Co-mentioned with:** ${exp.coMentionedWith.map(id => `[[${id}]]`).join(', ')}\n`;
    }

    markdown += `\n`;
  }

  // Related concepts
  if (related.length > 0) {
    markdown += `## Related Concepts\n\n`;

    // Group by direction
    const outgoing = related.filter(r => r.direction === 'outgoing');
    const incoming = related.filter(r => r.direction === 'incoming');

    if (outgoing.length > 0) {
      markdown += `### → Outgoing\n\n`;
      outgoing.forEach(rel => {
        const emoji = rel.sentiment === 'positive' ? '✅' : rel.sentiment === 'negative' ? '❌' : '•';
        markdown += `${emoji} [[${rel.node.id}|${rel.node.name}]] - *${rel.type}* (${rel.weight.toFixed(2)})\n`;
      });
      markdown += `\n`;
    }

    if (incoming.length > 0) {
      markdown += `### ← Incoming\n\n`;
      incoming.forEach(rel => {
        const emoji = rel.sentiment === 'positive' ? '✅' : rel.sentiment === 'negative' ? '❌' : '•';
        markdown += `${emoji} [[${rel.node.id}|${rel.node.name}]] - *${rel.type}* (${rel.weight.toFixed(2)})\n`;
      });
      markdown += `\n`;
    }
  }

  // Evidence events
  if (node.evidenceEvents && node.evidenceEvents.length > 0) {
    markdown += `## Evidence\n\n`;
    markdown += `${node.evidenceEvents.length} episode(s) support this concept.\n\n`;
    markdown += `\`\`\`\n${node.evidenceEvents.join('\n')}\n\`\`\`\n\n`;
  }

  // Footer
  markdown += `---\n\n`;
  markdown += `*Generated by OpenClaw Memory System v0.3.3*\n`;
  markdown += `*Created: ${formatDate(node.created)}*\n`;
  markdown += `*Last activated: ${formatDate(node.lastActivation)}*\n`;

  return markdown;
}

/**
 * Generate index file with statistics
 */
function generateIndexMarkdown(graph) {
  let markdown = `---
title: Knowledge Graph Index
generated: ${new Date().toISOString()}
---

# 🧠 OpenClaw Knowledge Graph

## Statistics

- **Total Nodes:** ${graph.statistics.totalNodes}
- **Total Edges:** ${graph.statistics.totalEdges}
- **Average Degree:** ${graph.statistics.averageDegree?.toFixed(2) || 'N/A'}
- **Last Updated:** ${graph.lastUpdated}

## Nodes by Type

`;

  // Count by type
  const typeCount = {};
  for (const node of Object.values(graph.nodes)) {
    typeCount[node.type] = (typeCount[node.type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    markdown += `- **${type}:** ${count}\n`;
  }

  markdown += `\n## Top Concepts (by weight)\n\n`;

  // Top 20 by weight
  const topNodes = Object.values(graph.nodes)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  topNodes.forEach((node, i) => {
    markdown += `${i + 1}. [[${node.id}|${node.name}]] - ${node.weight.toFixed(3)} (${node.activations} activations)\n`;
  });

  markdown += `\n## Extraction Quality\n\n`;

  // Count by extraction type
  const extractionCount = { EXTRACTED: 0, INFERRED: 0, UNKNOWN: 0 };
  for (const node of Object.values(graph.nodes)) {
    const type = node.extractionType || 'UNKNOWN';
    extractionCount[type]++;
  }

  markdown += `- **Extracted:** ${extractionCount.EXTRACTED} (${((extractionCount.EXTRACTED / graph.statistics.totalNodes) * 100).toFixed(1)}%)\n`;
  markdown += `- **Inferred:** ${extractionCount.INFERRED} (${((extractionCount.INFERRED / graph.statistics.totalNodes) * 100).toFixed(1)}%)\n`;
  markdown += `- **Unknown:** ${extractionCount.UNKNOWN} (${((extractionCount.UNKNOWN / graph.statistics.totalNodes) * 100).toFixed(1)}%)\n`;

  markdown += `\n## Low Confidence Nodes\n\n`;

  // Low confidence (<0.6)
  const lowConfidence = Object.values(graph.nodes)
    .filter(n => n.confidence && n.confidence < 0.6)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 10);

  if (lowConfidence.length > 0) {
    lowConfidence.forEach(node => {
      markdown += `- [[${node.id}|${node.name}]] - ${node.confidence.toFixed(3)} ⚠️\n`;
    });
  } else {
    markdown += `*No low confidence nodes found.*\n`;
  }

  markdown += `\n---\n\n`;
  markdown += `*Generated: ${new Date().toISOString()}*\n`;

  return markdown;
}

/**
 * Export knowledge graph to Obsidian vault
 */
async function exportToObsidian(outputDir = DEFAULT_OUTPUT_DIR) {
  console.log('\n📓 Exporting to Obsidian vault...');
  const startTime = Date.now();

  // Load knowledge graph
  const graph = await loadJSON(KNOWLEDGE_GRAPH);

  if (!graph || !graph.nodes) {
    console.error('❌ Failed to load knowledge graph');
    return;
  }

  console.log(`   Loaded graph: ${graph.statistics.totalNodes} nodes, ${graph.statistics.totalEdges} edges`);

  // Create output directory structure
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, 'concepts'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'events'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'procedures'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'other'), { recursive: true });

  console.log(`   Created vault at: ${outputDir}`);

  // Export each node
  let exported = 0;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    try {
      const markdown = generateNodeMarkdown(node, graph);

      // Determine subdirectory based on type
      let subdir = 'other';
      if (node.type.includes('concept') || node.type.includes('library') || node.type.includes('technology')) {
        subdir = 'concepts';
      } else if (node.type.includes('event') || node.type.includes('error')) {
        subdir = 'events';
      } else if (node.type.includes('procedure') || node.type.includes('pattern')) {
        subdir = 'procedures';
      }

      const filename = `${sanitizeFilename(nodeId)}.md`;
      const filepath = path.join(outputDir, subdir, filename);

      await fs.writeFile(filepath, markdown);
      exported++;

    } catch (error) {
      console.error(`⚠️  Failed to export node ${nodeId}:`, error.message);
    }
  }

  // Generate index
  const indexMarkdown = generateIndexMarkdown(graph);
  await fs.writeFile(path.join(outputDir, 'INDEX.md'), indexMarkdown);

  // Create .obsidian config (basic)
  const obsidianConfig = {
    name: 'OpenClaw Memory',
    enabledPlugins: [],
    theme: 'moonstone'
  };

  await fs.mkdir(path.join(outputDir, '.obsidian'), { recursive: true });
  await fs.writeFile(
    path.join(outputDir, '.obsidian', 'config.json'),
    JSON.stringify(obsidianConfig, null, 2)
  );

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Export complete!`);
  console.log(`   📊 Exported: ${exported} nodes`);
  console.log(`   📁 Location: ${outputDir}`);
  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log(`\n💡 Open this folder in Obsidian to explore your knowledge graph!`);
}

// CLI execution
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const outputDir = process.argv[2] || DEFAULT_OUTPUT_DIR;

  exportToObsidian(outputDir).catch(error => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });
}

export { exportToObsidian };
