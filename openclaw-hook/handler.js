/**
 * NMS Integration Hook Handler for OpenClaw
 *
 * Captures conversation events and stores them in the Neurobiological Memory System
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to NMS memory manager
const NMS_PATH = join(__dirname, '..');
const HIPPOCAMPUS_PATH = join(NMS_PATH, 'hippocampus', 'sessions');

// Session tracking
let currentSession = null;
let sessionEpisodes = [];

/**
 * Generate episode ID
 */
function generateEpisodeId() {
  return `openclaw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start new session
 */
async function startSession(context) {
  const sessionId = `openclaw-session-${Date.now()}`;
  currentSession = {
    sessionId,
    startTime: new Date().toISOString(),
    type: 'openclaw',
    channel: context.channel || 'unknown',
    user: context.user || 'unknown',
    episodes: []
  };
  sessionEpisodes = [];

  console.log(`🧠 NMS: Started session ${sessionId}`);
  return sessionId;
}

/**
 * Add episode to current session
 */
function addEpisode(episode) {
  if (!currentSession) {
    console.warn('🧠 NMS: No active session, creating one');
    startSession({});
  }

  sessionEpisodes.push(episode);
  currentSession.episodes = sessionEpisodes;
}

/**
 * Save session to hippocampus
 */
async function saveSession() {
  if (!currentSession || sessionEpisodes.length === 0) {
    console.log('🧠 NMS: No episodes to save');
    return;
  }

  currentSession.endTime = new Date().toISOString();
  currentSession.episodes = sessionEpisodes;

  const sessionFile = join(HIPPOCAMPUS_PATH, `${currentSession.sessionId}.json`);

  try {
    await fs.mkdir(HIPPOCAMPUS_PATH, { recursive: true });
    await fs.writeFile(sessionFile, JSON.stringify(currentSession, null, 2));
    console.log(`🧠 NMS: Saved ${sessionEpisodes.length} episodes to ${currentSession.sessionId}`);

    // Add to synaptic candidates for consolidation
    await queueForConsolidation();

    // Reset session
    currentSession = null;
    sessionEpisodes = [];
  } catch (error) {
    console.error('🧠 NMS: Error saving session:', error.message);
  }
}

/**
 * Queue episodes for consolidation
 */
async function queueForConsolidation() {
  const candidatesPath = join(NMS_PATH, 'hippocampus', 'synaptic-candidates.json');

  try {
    let candidates = { version: '1.0.0', candidates: [], statistics: { totalCandidates: 0, consolidatedCount: 0, rejectedCount: 0 } };

    try {
      const data = await fs.readFile(candidatesPath, 'utf-8');
      candidates = JSON.parse(data);
    } catch (e) {
      // File doesn't exist yet
    }

    // Add episodes with importance scores
    for (const episode of sessionEpisodes) {
      candidates.candidates.push({
        episodeId: episode.episodeId,
        sessionId: currentSession.sessionId,
        timestamp: new Date(episode.timestamp).getTime(),
        importance: episode.metadata?.importance || 5,
        addedToQueue: Date.now()
      });
    }

    candidates.statistics.totalCandidates += sessionEpisodes.length;
    candidates.lastConsolidation = new Date().toISOString();

    await fs.writeFile(candidatesPath, JSON.stringify(candidates, null, 2));
    console.log(`🧠 NMS: Queued ${sessionEpisodes.length} episodes for consolidation`);
  } catch (error) {
    console.error('🧠 NMS: Error queueing for consolidation:', error.message);
  }
}

/**
 * Hook handler - called by OpenClaw for each event
 */
export default async function handler(event) {
  try {
    // Log ALL events to understand what OpenClaw sends
    console.log('🧠 NMS Hook received event:', JSON.stringify({
      type: event.type,
      action: event.action,
      sessionKey: event.sessionKey,
      keys: Object.keys(event)
    }, null, 2));

    // Handle command events (new/reset)
    if (event.type === 'command' && (event.action === 'new' || event.action === 'reset')) {
      console.log('🧠 NMS: Session reset/new - saving session');
      await saveSession();
      return { success: true };
    }

    // For now, just log all other events to study them
    console.log('🧠 NMS: Event type not yet handled:', event.type);

    return { success: true };
  } catch (error) {
    console.error('🧠 NMS Hook error:', error);
    return { success: false, error: error.message };
  }
}

// Auto-save periodically (every 5 minutes)
setInterval(async () => {
  if (sessionEpisodes.length > 0) {
    console.log('🧠 NMS: Auto-saving session...');
    await saveSession();
    await startSession({});
  }
}, 5 * 60 * 1000);
