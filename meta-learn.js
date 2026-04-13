#!/usr/bin/env node
/**
 * Meta-Learning Script
 * Runs weekly to optimize learning parameters based on performance
 * Self-optimizing system that learns how to learn better
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { loadJSON, saveJSON } from './lib/json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const META_DIR = path.join(__dirname, 'meta');
const HIPPOCAMPUS_DIR = path.join(__dirname, 'hippocampus');
const NEOCORTEX_DIR = path.join(__dirname, 'neocortex');

const LEARNING_PARAMS = path.join(META_DIR, 'learning-params.json');
const KNOWLEDGE_GRAPH = path.join(NEOCORTEX_DIR, 'knowledge-graph.json');
const DAILY_INDEX = path.join(HIPPOCAMPUS_DIR, 'daily-index.json');

// Dampening coefficient for EMA smoothing (v0.3.2 R2.2)
const DAMPENING_ALPHA = 0.2;

/**
 * Apply Exponential Moving Average (EMA) dampening to parameter updates
 * Prevents oscillation and provides stability in meta-learning
 *
 * Formula: newValue = alpha * targetValue + (1 - alpha) * currentValue
 *
 * @param {number} currentValue - Current parameter value
 * @param {number} targetValue - Desired new value
 * @param {number} alpha - Dampening coefficient (0.2 = conservative)
 * @returns {number} - Smoothed value
 */
function applyDampening(currentValue, targetValue, alpha = DAMPENING_ALPHA) {
  return alpha * targetValue + (1 - alpha) * currentValue;
}

/**
 * Calculate memory utilization efficiency
 */
function calculateMemoryUtilization(graph, index) {
  const totalNodes = graph.statistics.totalNodes;
  const totalEvents = index.statistics.totalEvents;

  if (totalEvents === 0) return 0;

  // Compression ratio: how efficiently we store knowledge
  const compressionRatio = totalNodes / totalEvents;

  // Average node weight (quality of knowledge)
  const avgWeight =
    Object.values(graph.nodes).reduce((sum, n) => sum + n.weight, 0) / totalNodes || 0;

  // Network density (connectivity)
  const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;
  const density = maxPossibleEdges > 0 ? graph.statistics.totalEdges / maxPossibleEdges : 0;

  return (compressionRatio * 0.3 + avgWeight * 0.4 + density * 0.3) * 100;
}

/**
 * Analyze consolidation efficiency
 */
async function analyzeConsolidationEfficiency(params) {
  // Check how many candidates are waiting vs consolidated
  const candidates = await loadJSON(path.join(HIPPOCAMPUS_DIR, 'synaptic-candidates.json'));

  if (!candidates) return 0;

  const totalProcessed = candidates.statistics.consolidatedCount + candidates.statistics.rejectedCount;
  if (totalProcessed === 0) return 0;

  const successRate = candidates.statistics.consolidatedCount / totalProcessed;
  const queueBacklog = candidates.candidates.length;

  // Efficiency = success rate - penalty for backlog
  const backlogPenalty = Math.min(queueBacklog / 100, 0.5);
  return Math.max(0, (successRate - backlogPenalty)) * 100;
}

/**
 * Optimize learning parameters based on performance
 */
async function optimizeParameters(params, metrics) {
  const optimizations = [];

  // Analyze memory utilization (with EMA dampening - v0.3.2 R2.2)
  const currentLearningRate = params.parameters.hebbian.learningRate;
  if (metrics.memoryUtilization < 30) {
    // Too sparse - increase learning rate to form more connections
    const targetValue = currentLearningRate * 1.2;
    params.parameters.hebbian.learningRate = applyDampening(currentLearningRate, targetValue);
    optimizations.push(`Increased learning rate (sparse connections) [dampened ${currentLearningRate.toFixed(3)} → ${params.parameters.hebbian.learningRate.toFixed(3)}]`);
  } else if (metrics.memoryUtilization > 80) {
    // Too dense - decrease learning rate
    const targetValue = currentLearningRate * 0.8;
    params.parameters.hebbian.learningRate = applyDampening(currentLearningRate, targetValue);
    optimizations.push(`Decreased learning rate (dense connections) [dampened ${currentLearningRate.toFixed(3)} → ${params.parameters.hebbian.learningRate.toFixed(3)}]`);
  }

  // Analyze consolidation efficiency (with EMA dampening - v0.3.2 R2.2)
  const currentMinImportance = params.parameters.consolidation.minImportance;
  if (metrics.consolidationEfficiency < 40) {
    // Low efficiency - lower importance threshold to consolidate more
    const targetValue = currentMinImportance * 0.9;
    params.parameters.consolidation.minImportance = applyDampening(currentMinImportance, targetValue);
    optimizations.push(`Lowered consolidation threshold (low efficiency) [dampened ${currentMinImportance.toFixed(3)} → ${params.parameters.consolidation.minImportance.toFixed(3)}]`);
  } else if (metrics.consolidationEfficiency > 90) {
    // Very high efficiency - can be more selective
    const targetValue = currentMinImportance * 1.1;
    params.parameters.consolidation.minImportance = applyDampening(currentMinImportance, targetValue);
    optimizations.push(`Raised consolidation threshold (high efficiency) [dampened ${currentMinImportance.toFixed(3)} → ${params.parameters.consolidation.minImportance.toFixed(3)}]`);
  }

  // Adjust decay based on graph size (with EMA dampening - v0.3.2 R2.2)
  const graph = await loadJSON(KNOWLEDGE_GRAPH);
  const currentDecayHalfLife = params.parameters.hebbian.decayHalfLife;
  if (graph && graph.statistics.totalNodes > 10000) {
    // Large graph - increase decay to prune more
    const targetValue = currentDecayHalfLife * 0.9;
    params.parameters.hebbian.decayHalfLife = applyDampening(currentDecayHalfLife, targetValue);
    optimizations.push(`Increased decay rate (large graph) [dampened]`);
  } else if (graph && graph.statistics.totalNodes < 1000) {
    // Small graph - decrease decay to retain more
    const targetValue = currentDecayHalfLife * 1.1;
    params.parameters.hebbian.decayHalfLife = applyDampening(currentDecayHalfLife, targetValue);
    optimizations.push(`Decreased decay rate (small graph) [dampened]`);
  }

  // Clamp parameters to reasonable ranges
  params.parameters.hebbian.learningRate = Math.min(0.5, Math.max(0.01, params.parameters.hebbian.learningRate));
  params.parameters.hebbian.decayHalfLife = Math.min(90 * 24 * 3600000, Math.max(7 * 24 * 3600000, params.parameters.hebbian.decayHalfLife));
  params.parameters.consolidation.minImportance = Math.min(1.0, Math.max(0.1, params.parameters.consolidation.minImportance));

  return optimizations;
}

/**
 * Main meta-learning process
 */
async function metaLearn() {
  console.log('\n🧠 Starting meta-learning optimization...');
  const startTime = Date.now();

  // Load data
  const params = await loadJSON(LEARNING_PARAMS);
  const graph = await loadJSON(KNOWLEDGE_GRAPH);
  const index = await loadJSON(DAILY_INDEX);

  if (!params || !graph || !index) {
    console.error('❌ Failed to load required files');
    return;
  }

  if (!params.parameters.metaLearning.enabled) {
    console.log('ℹ️  Meta-learning is disabled');
    return;
  }

  // Calculate performance metrics
  const memoryUtilization = calculateMemoryUtilization(graph, index);
  const consolidationEfficiency = await analyzeConsolidationEfficiency(params);

  console.log('\n📊 Current Performance:');
  console.log(`   Memory Utilization: ${memoryUtilization.toFixed(1)}%`);
  console.log(`   Consolidation Efficiency: ${consolidationEfficiency.toFixed(1)}%`);

  // Store metrics history
  params.performance.memoryUtilization.push({
    timestamp: Date.now(),
    value: memoryUtilization
  });
  params.performance.consolidationEfficiency.push({
    timestamp: Date.now(),
    value: consolidationEfficiency
  });

  // Keep only recent history (last 30 measurements)
  const keepLast = params.parameters.metaLearning.performanceWindow;
  params.performance.memoryUtilization = params.performance.memoryUtilization.slice(-keepLast);
  params.performance.consolidationEfficiency = params.performance.consolidationEfficiency.slice(-keepLast);

  // Optimize parameters
  console.log('\n⚙️  Optimizing parameters...');
  const optimizations = await optimizeParameters(params, {
    memoryUtilization,
    consolidationEfficiency
  });

  if (optimizations.length > 0) {
    console.log('\n✅ Applied optimizations:');
    optimizations.forEach(opt => console.log(`   - ${opt}`));
  } else {
    console.log('✅ Parameters are optimal, no changes needed');
  }

  // Record optimization
  params.lastOptimization = new Date().toISOString();
  params.optimizationHistory.push({
    timestamp: Date.now(),
    metrics: { memoryUtilization, consolidationEfficiency },
    optimizations,
    parameters: JSON.parse(JSON.stringify(params.parameters))
  });

  // Keep only last 12 optimization records (3 months of weekly runs)
  params.optimizationHistory = params.optimizationHistory.slice(-12);

  // Save updated parameters
  await saveJSON(LEARNING_PARAMS, params);

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n📊 Current Parameters:`);
  console.log(`   Learning Rate: ${params.parameters.hebbian.learningRate.toFixed(3)}`);
  console.log(`   Decay Half-Life: ${(params.parameters.hebbian.decayHalfLife / (24 * 3600000)).toFixed(1)} days`);
  console.log(`   Consolidation Threshold: ${params.parameters.consolidation.minImportance.toFixed(2)}`);
  console.log(`\n✅ Meta-learning complete! (${duration}s)`);
}

// Run meta-learning
metaLearn().catch(error => {
  console.error('❌ Meta-learning failed:', error);
  process.exit(1);
});
