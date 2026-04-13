/**
 * Session Manager - v0.3.0
 *
 * Tracks user sessions and triggers mini-consolidation at session end.
 * Detects session boundaries based on inactivity threshold.
 *
 * Features:
 * - Session detection (30min inactivity threshold)
 * - Activity tracking
 * - Automatic session-end consolidation
 * - Session history and statistics
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default configuration
const DEFAULT_CONFIG = {
  inactivityThreshold: 30 * 60 * 1000, // 30 minutes
  checkInterval: 5 * 60 * 1000, // Check every 5 minutes
  minEventsForConsolidation: 3, // Minimum events to trigger consolidation
  autoConsolidate: true // Auto-trigger mini-consolidation
};

/**
 * Session Manager class
 */
export class SessionManager {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };

    this.dataDir = options.dataDir || path.join(__dirname, 'hippocampus');
    this.sessionHistoryFile = path.join(this.dataDir, 'session-history.json');

    this.currentSession = null;
    this.lastActivity = null;
    this.checkIntervalId = null;

    this.stats = {
      totalSessions: 0,
      averageSessionDuration: 0,
      totalEventsProcessed: 0,
      miniConsolidations: 0
    };
  }

  /**
   * Initialize session manager
   */
  async initialize() {
    // Load session history
    try {
      const data = await fs.readFile(this.sessionHistoryFile, 'utf-8');
      const history = JSON.parse(data);
      this.stats = history.stats || this.stats;
    } catch (error) {
      // No history file yet
      await this.saveHistory();
    }

    // Start background checker
    if (this.config.autoConsolidate) {
      this.startBackgroundChecker();
    }

    console.log('🔄 Session manager initialized');
  }

  /**
   * Save session history
   */
  async saveHistory() {
    const history = {
      lastUpdated: new Date().toISOString(),
      stats: this.stats,
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        startTime: this.currentSession.startTime,
        eventCount: this.currentSession.eventCount
      } : null
    };

    try {
      await fs.writeFile(this.sessionHistoryFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save session history:', error.message);
    }
  }

  /**
   * Start a new session
   */
  async startSession() {
    const sessionId = crypto.randomUUID();

    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      eventCount: 0,
      importantEvents: [],
      status: 'active'
    };

    this.lastActivity = Date.now();
    this.stats.totalSessions++;

    await this.saveHistory();

    console.log(`🎬 Session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * Record activity in current session
   */
  recordActivity(eventData = {}) {
    this.lastActivity = Date.now();

    if (!this.currentSession) {
      // Auto-start session if none exists
      this.startSession();
    }

    if (this.currentSession) {
      this.currentSession.eventCount++;

      // Track important events
      if (eventData.importance && eventData.importance >= 0.5) {
        this.currentSession.importantEvents.push({
          timestamp: Date.now(),
          importance: eventData.importance,
          type: eventData.type,
          id: eventData.id
        });
      }

      this.stats.totalEventsProcessed++;
    }
  }

  /**
   * Check if session has ended (inactivity threshold exceeded)
   */
  isSessionEnded() {
    if (!this.currentSession || !this.lastActivity) {
      return false;
    }

    const inactive = Date.now() - this.lastActivity;
    return inactive > this.config.inactivityThreshold;
  }

  /**
   * End current session and trigger consolidation
   */
  async endSession(reason = 'inactivity') {
    if (!this.currentSession) {
      return null;
    }

    console.log(`🛑 Ending session ${this.currentSession.id} (${reason})`);

    const session = this.currentSession;
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.status = 'ended';
    session.endReason = reason;

    // Update statistics
    const avgDuration = this.stats.averageSessionDuration;
    const totalSessions = this.stats.totalSessions;
    this.stats.averageSessionDuration =
      (avgDuration * (totalSessions - 1) + session.duration) / totalSessions;

    // Trigger mini-consolidation if enough important events
    let consolidationResult = null;
    if (session.importantEvents.length >= this.config.minEventsForConsolidation) {
      console.log(`📦 Triggering mini-consolidation for ${session.importantEvents.length} events`);

      try {
        // Import mini-consolidate dynamically to avoid circular dependencies
        const { miniConsolidate } = await import('./mini-consolidate.js');
        consolidationResult = await miniConsolidate(session);

        this.stats.miniConsolidations++;
      } catch (error) {
        console.error('❌ Mini-consolidation failed:', error.message);
      }
    } else {
      console.log(`⏭️ Skipping mini-consolidation (only ${session.importantEvents.length} important events)`);
    }

    // Clear current session
    this.currentSession = null;
    this.lastActivity = null;

    await this.saveHistory();

    console.log(`✅ Session ended: ${session.id} (${(session.duration / 1000).toFixed(0)}s, ${session.eventCount} events)`);

    return {
      session,
      consolidationResult
    };
  }

  /**
   * Start background session checker
   */
  startBackgroundChecker() {
    if (this.checkIntervalId) {
      return; // Already running
    }

    this.checkIntervalId = setInterval(async () => {
      if (this.isSessionEnded()) {
        await this.endSession('auto-detect');
      }
    }, this.config.checkInterval);

    console.log(`⏰ Background session checker started (interval: ${this.config.checkInterval / 1000}s)`);
  }

  /**
   * Stop background session checker
   */
  stopBackgroundChecker() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('🛑 Background session checker stopped');
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        duration: Date.now() - this.currentSession.startTime,
        eventCount: this.currentSession.eventCount,
        importantEvents: this.currentSession.importantEvents.length,
        inactive: this.lastActivity ? Date.now() - this.lastActivity : null
      } : null,
      config: {
        inactivityThreshold: this.config.inactivityThreshold,
        minEventsForConsolidation: this.config.minEventsForConsolidation
      }
    };
  }

  /**
   * Force session end (for testing or manual trigger)
   */
  async forceEndSession() {
    return await this.endSession('manual');
  }
}

/**
 * Singleton instance
 */
let sessionManagerInstance = null;

export function getSessionManager(options = {}) {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(options);
  }
  return sessionManagerInstance;
}

// CLI interface
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const command = process.argv[2];

  const sessionManager = getSessionManager();
  await sessionManager.initialize();

  if (command === 'stats') {
    const stats = sessionManager.getStats();
    console.log('📊 Session Statistics:');
    console.log(JSON.stringify(stats, null, 2));

  } else if (command === 'start') {
    await sessionManager.startSession();

  } else if (command === 'end') {
    await sessionManager.forceEndSession();

  } else if (command === 'test') {
    console.log('🧪 Testing session manager...\n');

    // Start session
    await sessionManager.startSession();
    console.log('Session started\n');

    // Record some activities
    for (let i = 0; i < 5; i++) {
      sessionManager.recordActivity({
        importance: 0.6 + Math.random() * 0.4,
        type: 'test-event',
        id: `test-${i}`
      });
      console.log(`Event ${i + 1} recorded`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\nSession stats:');
    console.log(JSON.stringify(sessionManager.getStats(), null, 2));

    // End session
    console.log('\nEnding session...');
    await sessionManager.forceEndSession();

    sessionManager.stopBackgroundChecker();

  } else {
    console.log(`
Session Manager - v0.3.0

Usage:
  node session-manager.js test    - Run self-test
  node session-manager.js stats   - Show statistics
  node session-manager.js start   - Start new session
  node session-manager.js end     - Force end current session
    `);
  }

  process.exit(0);
}
