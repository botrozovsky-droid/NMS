/**
 * Ganglia Manager - Semantic Anchors with Interactive Enrichment
 * Creates manually curated high-value nodes that attract related knowledge
 */

import { getDatabase } from './db-adapter.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

const DEFAULT_WEIGHT = 10.0;
const MIN_WEIGHT_AFTER_DECAY = 5.0;
const MAX_ACTIVE_GANGLIA = 50;

class GangliaManager {
  constructor(dbPath) {
    this.db = getDatabase(dbPath);
    this.db.initialize();
  }

  /**
   * Interactive enrichment: Ask user questions to build context
   */
  async generateEnrichmentQuestions(name, description = '') {
    const prompt = `User wants to create a knowledge anchor (ganglia) about: "${name}"
${description ? `Description: ${description}` : ''}

Generate 3-5 focused questions to understand:
1. Context (commercial/research/hobby/learning)
2. Current knowledge level
3. Key subtopics of interest
4. Related projects/topics
5. Time horizon (one-time/ongoing)

Return JSON array of questions:
[
  {"q": "question text", "type": "context|expertise|subtopics|relations|horizon"},
  ...
]

Keep questions concise and practical.`;

    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        }
      );

      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback questions
      return this.getDefaultQuestions();
    } catch (error) {
      console.error('Failed to generate questions:', error.message);
      return this.getDefaultQuestions();
    }
  }

  /**
   * Default questions if API fails
   */
  getDefaultQuestions() {
    return [
      { q: "What is the main context? (commercial/research/hobby/learning)", type: "context" },
      { q: "Current expertise level? (beginner/intermediate/expert)", type: "expertise" },
      { q: "Key subtopics to track? (comma-separated)", type: "subtopics" },
      { q: "Related to other projects? (yes/no, specify if yes)", type: "relations" },
      { q: "Time horizon? (one-time/short-term/long-term)", type: "horizon" }
    ];
  }

  /**
   * Create ganglia with enrichment data
   */
  async createGanglia(name, type, description, enrichmentAnswers) {
    // Check limit
    const existing = this.db.queryNodes({ is_manual: 1 });
    if (existing.length >= MAX_ACTIVE_GANGLIA) {
      throw new Error(`Maximum ${MAX_ACTIVE_GANGLIA} ganglia allowed. Delete unused ones first.`);
    }

    // Check duplicate
    const duplicate = this.db.queryNodes({ name, type, is_manual: 1 });
    if (duplicate.length > 0) {
      throw new Error(`Ganglia "${name}" (${type}) already exists.`);
    }

    const gangliaId = `ganglia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse enrichment data
    const subtopics = this.parseSubtopics(enrichmentAnswers.subtopics || '');
    const relatedProjects = this.parseRelations(enrichmentAnswers.relations || '');

    const metadata = {
      description,
      context: enrichmentAnswers.context || 'unknown',
      expertise_level: enrichmentAnswers.expertise || 'beginner',
      subtopics,
      related_projects: relatedProjects,
      horizon: enrichmentAnswers.horizon || 'unknown',
      creation_date: Date.now(),
      enrichment_data: enrichmentAnswers,
      health_status: 'new',
      auto_link_count: 0
    };

    const node = {
      id: gangliaId,
      name,
      type,
      weight: DEFAULT_WEIGHT,
      confidence: 1.0,
      activations: 0,
      last_activation: Date.now(),
      created: Date.now(),
      is_manual: true,
      metadata: JSON.stringify(metadata)
    };

    this.db.addNode(node);

    return { id: gangliaId, ...node };
  }

  /**
   * List all ganglia with stats
   */
  listGanglia() {
    const ganglia = this.db.queryNodes({ is_manual: 1 });

    return ganglia.map(g => {
      const edges = this.db.getNodeEdges(g.id);
      const metadata = typeof g.metadata === 'string' ? JSON.parse(g.metadata) : g.metadata;

      return {
        id: g.id,
        name: g.name,
        type: g.type,
        weight: g.weight,
        connections: edges.length,
        auto_linked: metadata.auto_link_count || 0,
        created: g.created,
        context: metadata.context,
        horizon: metadata.horizon
      };
    });
  }

  /**
   * Get ganglia details
   */
  getGanglia(gangliaId) {
    const node = this.db.getNode(gangliaId);
    if (!node || !node.is_manual) {
      return null;
    }

    const edges = this.db.getNodeEdges(gangliaId);
    const metadata = typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata;

    return {
      ...node,
      metadata,
      edges,
      health: this.checkHealth(gangliaId, edges)
    };
  }

  /**
   * Update ganglia
   */
  updateGanglia(gangliaId, updates) {
    const existing = this.db.getNode(gangliaId);
    if (!existing || !existing.is_manual) {
      throw new Error('Ganglia not found');
    }

    return this.db.updateNode(gangliaId, updates);
  }

  /**
   * Delete ganglia
   */
  deleteGanglia(gangliaId) {
    const node = this.db.getNode(gangliaId);
    if (!node || !node.is_manual) {
      throw new Error('Ganglia not found');
    }

    return this.db.deleteNode(gangliaId);
  }

  /**
   * Check ganglia health (detect bloat)
   */
  checkHealth(gangliaId, edges = null) {
    if (!edges) {
      edges = this.db.getNodeEdges(gangliaId);
    }

    if (edges.length === 0) {
      return { status: 'new', message: 'No connections yet' };
    }

    const autoLinked = edges.filter(e => {
      const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
      return meta?.auto_linked === true;
    });

    const autoRatio = autoLinked.length / edges.length;

    if (autoRatio > 0.8 && edges.length > 10) {
      const avgConfidence = autoLinked.reduce((sum, e) => sum + (e.weight || 0), 0) / autoLinked.length;

      if (avgConfidence < 0.5) {
        return {
          status: 'bloated',
          message: `${autoLinked.length} low-confidence auto-links. Review connections.`,
          auto_ratio: autoRatio,
          avg_confidence: avgConfidence
        };
      }
    }

    return {
      status: 'healthy',
      message: `${edges.length} connections, ${autoLinked.length} auto-linked`,
      auto_ratio: autoRatio
    };
  }

  /**
   * Link node to ganglia if semantically similar
   */
  async linkToGanglia(nodeId, gangliaId, similarity, metadata = {}) {
    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const edge = {
      id: edgeId,
      source_id: nodeId,
      target_id: gangliaId,
      type: 'related_to',
      weight: similarity,
      created: Date.now(),
      metadata: JSON.stringify({
        auto_linked: true,
        confidence: similarity,
        ...metadata
      })
    };

    this.db.addEdge(edge);

    // Update ganglia auto_link_count
    const ganglia = this.db.getNode(gangliaId);
    const meta = typeof ganglia.metadata === 'string' ? JSON.parse(ganglia.metadata) : ganglia.metadata;
    meta.auto_link_count = (meta.auto_link_count || 0) + 1;

    this.db.updateNode(gangliaId, { metadata: JSON.stringify(meta) });

    return edgeId;
  }

  /**
   * Apply decay protection to ganglia
   */
  applyDecayProtection(gangliaId, decayFactor) {
    const node = this.db.getNode(gangliaId);
    if (!node || !node.is_manual) return;

    const newWeight = Math.max(node.weight * decayFactor, MIN_WEIGHT_AFTER_DECAY);
    this.db.updateNode(gangliaId, { weight: newWeight });
  }

  /**
   * Parse subtopics from user input
   */
  parseSubtopics(input) {
    if (!input) return [];
    return input.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Parse related projects from user input
   */
  parseRelations(input) {
    if (!input || input.toLowerCase().includes('no')) return [];
    return input.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  close() {
    this.db.close();
  }
}

export { GangliaManager, DEFAULT_WEIGHT, MIN_WEIGHT_AFTER_DECAY, MAX_ACTIVE_GANGLIA };
