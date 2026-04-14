#!/usr/bin/env node
/**
 * Ganglia CLI - Interactive management of semantic anchors
 */

import { GangliaManager } from '../lib/ganglia-manager.js';
import { join } from 'path';
import readline from 'readline';

const DB_PATH = join(process.cwd(), 'neocortex', 'nms.db');
const manager = new GangliaManager(DB_PATH);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function createGanglia() {
  console.log('\n🧠 CREATE GANGLIA - Interactive Mode\n');

  const name = await ask('Name: ');
  if (!name) {
    console.log('❌ Name required');
    return;
  }

  const type = await ask('Type (project/concept/person/skill/domain): ') || 'concept';
  const description = await ask('Brief description: ');

  console.log('\n📋 Generating enrichment questions...\n');

  const questions = await manager.generateEnrichmentQuestions(name, description);
  const answers = {};

  for (const q of questions) {
    const answer = await ask(`${q.q}\n> `);
    answers[q.type] = answer;
  }

  try {
    const ganglia = await manager.createGanglia(name, type, description, answers);
    console.log(`\n✅ Ganglia created: ${ganglia.id}`);
    console.log(`   Name: ${ganglia.name}`);
    console.log(`   Type: ${ganglia.type}`);
    console.log(`   Weight: ${ganglia.weight}`);
  } catch (error) {
    console.error(`\n❌ Failed: ${error.message}`);
  }
}

function listGanglia() {
  console.log('\n🧠 GANGLIA LIST\n');

  const ganglia = manager.listGanglia();

  if (ganglia.length === 0) {
    console.log('No ganglia created yet. Use "create" command.\n');
    return;
  }

  console.log(`Total: ${ganglia.length}\n`);

  ganglia.forEach(g => {
    console.log(`📍 ${g.name} (${g.type})`);
    console.log(`   ID: ${g.id}`);
    console.log(`   Weight: ${g.weight.toFixed(2)} | Connections: ${g.connections} (${g.auto_linked} auto)`);
    console.log(`   Context: ${g.context} | Horizon: ${g.horizon}`);
    console.log(`   Created: ${new Date(g.created).toLocaleString()}`);
    console.log('');
  });
}

async function showGanglia(gangliaId) {
  const ganglia = manager.getGanglia(gangliaId);

  if (!ganglia) {
    console.log('❌ Ganglia not found');
    return;
  }

  console.log(`\n🧠 ${ganglia.name} (${ganglia.type})\n`);
  console.log(`ID: ${ganglia.id}`);
  console.log(`Weight: ${ganglia.weight.toFixed(2)}`);
  console.log(`Confidence: ${ganglia.confidence}`);
  console.log(`Activations: ${ganglia.activations}`);
  console.log(`Created: ${new Date(ganglia.created).toLocaleString()}\n`);

  console.log('📋 Metadata:');
  console.log(`   Description: ${ganglia.metadata.description || 'N/A'}`);
  console.log(`   Context: ${ganglia.metadata.context}`);
  console.log(`   Expertise: ${ganglia.metadata.expertise_level}`);
  console.log(`   Subtopics: ${ganglia.metadata.subtopics?.join(', ') || 'none'}`);
  console.log(`   Related projects: ${ganglia.metadata.related_projects?.join(', ') || 'none'}`);
  console.log(`   Horizon: ${ganglia.metadata.horizon}\n`);

  console.log(`🔗 Connections: ${ganglia.edges.length}`);
  ganglia.edges.slice(0, 10).forEach(e => {
    const direction = e.source === ganglia.id ? '→' : '←';
    const otherNode = e.source === ganglia.id ? e.target : e.source;
    console.log(`   ${direction} ${otherNode} (${e.type}, weight: ${e.weight.toFixed(2)})`);
  });

  if (ganglia.edges.length > 10) {
    console.log(`   ... and ${ganglia.edges.length - 10} more`);
  }

  console.log(`\n💊 Health: ${ganglia.health.status.toUpperCase()}`);
  console.log(`   ${ganglia.health.message}`);
  if (ganglia.health.auto_ratio !== undefined) {
    console.log(`   Auto-link ratio: ${(ganglia.health.auto_ratio * 100).toFixed(1)}%`);
  }

  console.log('');
}

async function deleteGanglia(gangliaId) {
  const ganglia = manager.getGanglia(gangliaId);

  if (!ganglia) {
    console.log('❌ Ganglia not found');
    return;
  }

  console.log(`\n⚠️  DELETE: ${ganglia.name} (${ganglia.type})`);
  console.log(`   This will remove the ganglia and ${ganglia.edges.length} connections.\n`);

  const confirm = await ask('Type "yes" to confirm: ');

  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    return;
  }

  try {
    manager.deleteGanglia(gangliaId);
    console.log('✅ Ganglia deleted');
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
  }
}

function showStats() {
  const ganglia = manager.listGanglia();

  console.log('\n📊 GANGLIA STATISTICS\n');
  console.log(`Total ganglia: ${ganglia.length}`);

  if (ganglia.length === 0) return;

  const totalConnections = ganglia.reduce((sum, g) => sum + g.connections, 0);
  const totalAutoLinked = ganglia.reduce((sum, g) => sum + g.auto_linked, 0);
  const avgWeight = ganglia.reduce((sum, g) => sum + g.weight, 0) / ganglia.length;

  console.log(`Total connections: ${totalConnections} (${totalAutoLinked} auto-linked)`);
  console.log(`Average weight: ${avgWeight.toFixed(2)}`);

  const byType = {};
  ganglia.forEach(g => {
    byType[g.type] = (byType[g.type] || 0) + 1;
  });

  console.log('\nBy type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  console.log('');
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  GANGLIA MANAGER - Semantic Anchors');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    switch (command) {
      case 'create':
        await createGanglia();
        break;

      case 'list':
        listGanglia();
        break;

      case 'show':
        if (!arg) {
          console.log('❌ Usage: npm run ganglia:show <ganglia-id>');
          break;
        }
        await showGanglia(arg);
        break;

      case 'delete':
        if (!arg) {
          console.log('❌ Usage: npm run ganglia:delete <ganglia-id>');
          break;
        }
        await deleteGanglia(arg);
        break;

      case 'stats':
        showStats();
        break;

      default:
        console.log('\nCommands:');
        console.log('  create  - Create new ganglia (interactive)');
        console.log('  list    - List all ganglia');
        console.log('  show    - Show ganglia details');
        console.log('  delete  - Delete ganglia');
        console.log('  stats   - Show statistics');
        console.log('\nExamples:');
        console.log('  npm run ganglia:create');
        console.log('  npm run ganglia:list');
        console.log('  npm run ganglia:show <id>');
        console.log('  npm run ganglia:delete <id>');
        console.log('  npm run ganglia:stats');
        console.log('');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    manager.close();
    rl.close();
  }
}

main();
