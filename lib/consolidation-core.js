/**
 * Consolidation Core - v0.3.1
 *
 * Shared consolidation logic extracted from consolidate.js and mini-consolidate.js.
 * Pure functions for testability and reusability.
 *
 * Eliminates ~200 lines of duplication between nightly and session-end consolidation.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Analyze episodes with Gemini API
 * @param {Array} episodes - Episode data
 * @param {object} options - Analysis options
 * @returns {Promise<object|null>} - Analysis result with concepts and relationships
 */
export async function analyzeWithGemini(episodes, options = {}) {
  const {
    prompt = buildDefaultPrompt(episodes),
    temperature = 0.3,
    maxOutputTokens = 4096,
    timeout = 60000
  } = options;

  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json"
        }
      },
      {
        timeout,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    return parseGeminiResponse(content);

  } catch (error) {
    console.error('❌ Gemini analysis failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Build default detailed analysis prompt
 */
function buildDefaultPrompt(episodes) {
  const content = episodes.map(e => e.content).join('\n\n');
  return `Extract 3-5 MOST IMPORTANT concepts and their relationships. Be concise.

Content:
${content}

Return ONLY this JSON (no markdown, no explanations):
{"concepts": [{"name": "X", "type": "Y", "importance": 0.9, "canonical_form": "x"}], "relationships": [{"source": "X", "target": "Y", "type": "uses", "strength": 0.9}]}`;
}

/**
 * Parse Gemini JSON response with cleanup
 */
function parseGeminiResponse(content) {
  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.warn('⚠️  Initial JSON parse failed, trying cleanup...');

    // Try to extract JSON if wrapped in markdown
    let cleaned = content;

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Try again
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Try to extract first complete JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e3) {
          console.error('⚠️  Could not parse JSON even after cleanup');
          console.error('Response preview:', content.substring(0, 500));
          return null;
        }
      }
    }

    console.warn('⚠️  Gemini response not valid JSON, skipping');
    return null;
  }
}

/**
 * Create new node from concept
 * @param {object} concept - Concept from Gemini analysis
 * @param {Array} episodeIds - Source episode IDs
 * @param {number} now - Current timestamp
 * @param {object} metadata - Additional metadata (e.g., consolidationType)
 * @returns {object} - Node object with full v0.2 metadata
 */
export function createNode(concept, episodeIds, now, metadata = {}) {
  const nodeId = concept.canonical_form || concept.name.toLowerCase().replace(/\s+/g, '_');

  return {
    id: nodeId,
    name: concept.name,
    type: concept.type || 'concept',
    weight: concept.importance || 0.5,
    activations: 1,
    lastActivation: now,
    created: now,
    sources: [...episodeIds],

    // v0.2: Enhanced metadata
    extractionType: concept.extraction_type || 'INFERRED',
    confidence: concept.confidence || 0.7,
    rationale: concept.rationale || 'Extracted during consolidation',
    evidenceEvents: [...episodeIds],

    // v0.2: Canonical forms
    canonicalForm: concept.canonical_form || nodeId,
    aliases: concept.aliases || [],

    // v0.2: Dual-source
    codeSource: null,
    experienceSource: {
      activations: 1,
      lastActivation: now,
      coMentionedWith: [],
      sentiment: 'neutral',
      errors: [],
      successfulUseCases: 0,
      extractionType: concept.extraction_type || 'INFERRED',
      confidence: concept.confidence || 0.7
    },

    // Additional metadata (e.g., consolidationType: 'mini')
    ...metadata,

    flags: []
  };
}

/**
 * Update existing node with Hebbian strengthening
 * @param {object} node - Existing node
 * @param {object} concept - New concept data
 * @param {object} hebbianParams - Learning parameters
 * @param {number} now - Current timestamp
 */
export function updateNode(node, concept, hebbianParams, now) {
  node.activations++;
  node.weight = Math.min(1.0, node.weight + hebbianParams.learningRate);
  node.lastActivation = now;

  if (node.experienceSource) {
    node.experienceSource.activations++;
    node.experienceSource.lastActivation = now;
  }

  // Bayesian confidence update
  if (concept.confidence !== undefined) {
    node.confidence = (node.confidence + concept.confidence) / 2;
  }
}

/**
 * Create new edge from relationship
 * @param {object} relationship - Relationship from Gemini analysis
 * @param {Array} episodeIds - Source episode IDs
 * @param {number} now - Current timestamp
 * @param {object} metadata - Additional metadata
 * @returns {object} - Edge object with full v0.2 metadata
 */
export function createEdge(relationship, episodeIds, now, metadata = {}) {
  const sourceId = relationship.canonical_source || relationship.source.toLowerCase().replace(/\s+/g, '_');
  const targetId = relationship.canonical_target || relationship.target.toLowerCase().replace(/\s+/g, '_');
  const edgeId = `${sourceId}→${targetId}`;

  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: relationship.type || 'related',
    weight: relationship.strength || 0.5,
    coActivations: 1,
    lastActivation: now,
    created: now,

    // v0.2: Enhanced metadata
    extractionType: relationship.extraction_type || 'INFERRED',
    confidence: relationship.confidence || 0.7,
    rationale: relationship.rationale || 'Extracted relationship',
    evidenceEvents: [...episodeIds],
    sentiment: relationship.sentiment || 'neutral',
    codeEvidence: null,

    // Additional metadata
    ...metadata,

    flags: []
  };
}

/**
 * Update existing edge with Hebbian strengthening
 * @param {object} edge - Existing edge
 * @param {object} relationship - New relationship data
 * @param {object} hebbianParams - Learning parameters
 * @param {number} now - Current timestamp
 */
export function updateEdge(edge, relationship, hebbianParams, now) {
  edge.coActivations++;
  edge.weight = Math.min(1.0, edge.weight + hebbianParams.learningRate);
  edge.lastActivation = now;

  // Bayesian confidence update
  if (relationship.confidence !== undefined) {
    edge.confidence = (edge.confidence + relationship.confidence) / 2;
  }
}

/**
 * Apply temporal decay to all nodes and edges (Ebbinghaus forgetting curve)
 * BATCH optimized - processes all nodes/edges in single pass (v0.3.2)
 *
 * @param {object} graph - Knowledge graph
 * @param {object} hebbianParams - Learning parameters
 * @param {number} now - Current timestamp
 * @returns {object} - Decay statistics
 */
export function applyDecay(graph, hebbianParams, now) {
  let decayedNodes = 0;
  let decayedEdges = 0;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const timeSince = now - node.lastActivation;
    const oldWeight = node.weight;
    node.weight *= Math.exp(-Math.log(2) * timeSince / hebbianParams.decayHalfLife);

    if (node.weight < oldWeight) decayedNodes++;
  }

  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    const timeSince = now - edge.lastActivation;
    const oldWeight = edge.weight;
    edge.weight *= Math.exp(-Math.log(2) * timeSince / hebbianParams.decayHalfLife);

    if (edge.weight < oldWeight) decayedEdges++;
  }

  return { decayedNodes, decayedEdges };
}

/**
 * Prune weak connections from graph
 * BATCH optimized - deletes all weak nodes/edges in single pass (v0.3.2)
 *
 * @param {object} graph - Knowledge graph
 * @param {object} hebbianParams - Learning parameters
 * @returns {object} - Pruning statistics
 */
export function pruneWeakConnections(graph, hebbianParams) {
  let prunedNodes = 0;
  let prunedEdges = 0;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.weight < hebbianParams.minWeight) {
      delete graph.nodes[nodeId];
      prunedNodes++;
      graph.statistics.totalNodes--;
    }
  }

  for (const [edgeId, edge] of Object.entries(graph.edges)) {
    if (edge.weight < hebbianParams.minWeight) {
      delete graph.edges[edgeId];
      prunedEdges++;
      graph.statistics.totalEdges--;
    }
  }

  return { prunedNodes, prunedEdges };
}

/**
 * Auto-flag nodes based on quality metrics
 * @param {object} node - Node to flag
 * @param {Array} episodes - Evidence episodes
 */
export function autoFlagNode(node, episodes) {
  if (node.confidence < 0.5) {
    node.flags.push('low_confidence');
  }

  if (node.extractionType === 'INFERRED' &&
      node.confidence < 0.5 &&
      episodes.length === 0) {
    node.flags.push('potential_hallucination');
  }
}

/**
 * Auto-flag edges based on quality metrics
 * @param {object} edge - Edge to flag
 * @param {Array} episodes - Evidence episodes
 */
export function autoFlagEdge(edge, episodes) {
  if (edge.confidence < 0.5) {
    edge.flags.push('low_confidence');
  }

  if (edge.extractionType === 'INFERRED' &&
      edge.confidence < 0.6 &&
      episodes.length === 0) {
    edge.flags.push('weak_inference');
  }
}
