/**
 * Fix Orphaned Links - Clean up knowledge graph
 *
 * Removes edges that reference non-existent nodes
 */

import fs from 'fs/promises';

const GRAPH_PATH = './neocortex/knowledge-graph.json';

async function fixOrphanedLinks() {
  console.log('🔧 Fixing orphaned links in knowledge graph...\n');

  // Load graph
  const data = await fs.readFile(GRAPH_PATH, 'utf-8');
  const graph = JSON.parse(data);

  const nodeIds = new Set(Object.keys(graph.nodes));
  const totalEdges = Object.keys(graph.edges).length;

  console.log(`📊 Graph stats:`);
  console.log(`   - Nodes: ${nodeIds.size}`);
  console.log(`   - Edges: ${totalEdges}\n`);

  // Find orphaned links
  const orphanedLinks = [];
  const validEdges = {};

  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    const sourceExists = nodeIds.has(edge.source);
    const targetExists = nodeIds.has(edge.target);

    if (sourceExists && targetExists) {
      validEdges[edgeId] = edge;
    } else {
      orphanedLinks.push({
        id: edgeId,
        source: edge.source,
        target: edge.target,
        sourceExists,
        targetExists
      });
    }
  }

  console.log(`🔍 Analysis:`);
  console.log(`   - Valid edges: ${Object.keys(validEdges).length}`);
  console.log(`   - Orphaned edges: ${orphanedLinks.length}\n`);

  if (orphanedLinks.length === 0) {
    console.log('✅ No orphaned links found. Graph is clean!');
    return;
  }

  // Show examples
  console.log('📋 Orphaned link examples:');
  orphanedLinks.slice(0, 10).forEach(link => {
    const reason = !link.sourceExists
      ? `source "${link.source}" missing`
      : `target "${link.target}" missing`;
    console.log(`   - ${link.id} (${reason})`);
  });

  if (orphanedLinks.length > 10) {
    console.log(`   ... and ${orphanedLinks.length - 10} more\n`);
  } else {
    console.log('');
  }

  // Backup
  const backupPath = `./neocortex/knowledge-graph.backup-${Date.now()}.json`;
  await fs.writeFile(backupPath, data);
  console.log(`💾 Backup created: ${backupPath}\n`);

  // Update graph
  graph.edges = validEdges;
  graph.lastUpdated = new Date().toISOString();

  // Update statistics
  if (graph.statistics) {
    graph.statistics.totalEdges = Object.keys(validEdges).length;
  }

  // Save
  await fs.writeFile(GRAPH_PATH, JSON.stringify(graph, null, 2));

  console.log('✅ Graph cleaned!');
  console.log(`   - Removed: ${orphanedLinks.length} orphaned edges`);
  console.log(`   - Remaining: ${Object.keys(validEdges).length} valid edges\n`);

  // Return stats
  return {
    totalEdges,
    validEdges: Object.keys(validEdges).length,
    orphanedRemoved: orphanedLinks.length,
    backupPath
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixOrphanedLinks()
    .then(stats => {
      if (stats) {
        console.log('📊 Summary:');
        console.log(`   - Total edges before: ${stats.totalEdges}`);
        console.log(`   - Valid edges after: ${stats.validEdges}`);
        console.log(`   - Cleaned: ${stats.orphanedRemoved} orphaned links`);
        console.log(`   - Reduction: ${(stats.orphanedRemoved / stats.totalEdges * 100).toFixed(1)}%`);
        console.log(`\n💡 Backup saved to: ${stats.backupPath}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

export default fixOrphanedLinks;
