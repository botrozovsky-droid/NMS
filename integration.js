#!/usr/bin/env node
/**
 * OpenClaw Memory Integration
 * Hooks into OpenClaw conversation system to automatically capture memories
 */

import memoryManager from './memory-manager.js';

/**
 * Hook: After every tool call
 * Captures tool usage as episodic memory
 */
export async function onToolCall(sessionId, toolName, args, result, metadata = {}) {
  const event = {
    type: 'tool_call',
    toolName,
    args,
    result: result?.success ? 'success' : 'error',
    hasError: !result?.success,
    filesModified: metadata.filesModified || [],
    timestamp: Date.now()
  };

  await memoryManager.encodeEpisode(sessionId, event);
}

/**
 * Hook: After user messages
 * Captures important user instructions
 */
export async function onUserMessage(sessionId, message, metadata = {}) {
  // Detect if this is an explicit instruction (command, request, etc.)
  const isExplicitInstruction =
    message.includes('создай') ||
    message.includes('измени') ||
    message.includes('добавь') ||
    message.includes('удали') ||
    message.includes('запомни') ||
    message.startsWith('/');

  const event = {
    type: 'user_message',
    message: message.substring(0, 500), // Truncate long messages
    explicitInstruction: isExplicitInstruction,
    userMention: metadata.mentionsUser || false,
    timestamp: Date.now()
  };

  await memoryManager.encodeEpisode(sessionId, event);
}

/**
 * Hook: After assistant responses
 * Captures significant assistant actions
 */
export async function onAssistantResponse(sessionId, response, metadata = {}) {
  const event = {
    type: 'assistant_response',
    toolCalls: metadata.toolCalls || [],
    filesModified: metadata.filesModified || [],
    codeGenerated: metadata.codeGenerated || false,
    timestamp: Date.now()
  };

  await memoryManager.encodeEpisode(sessionId, event);
}

/**
 * Hook: On errors
 * High importance - always remember errors
 */
export async function onError(sessionId, error, context = {}) {
  const event = {
    type: 'error',
    errorMessage: error.message,
    errorType: error.name,
    context,
    hasError: true,
    timestamp: Date.now()
  };

  await memoryManager.encodeEpisode(sessionId, event);
}

/**
 * Hook: Session end
 * Summarize session
 */
export async function onSessionEnd(sessionId, summary) {
  const event = {
    type: 'session_end',
    summary,
    timestamp: Date.now()
  };

  await memoryManager.encodeEpisode(sessionId, event);
}

/**
 * Query memory during conversation
 * Returns relevant past memories for context
 */
export async function queryMemory(query, options = {}) {
  return await memoryManager.recall(query, options);
}

/**
 * Store learned pattern
 */
export async function learnPattern(patternName, action, success) {
  await memoryManager.learnPattern(patternName, action, success);
}

/**
 * Store user preference
 */
export async function storePreference(key, value, confidence = 1.0) {
  await memoryManager.storePreference(key, value, confidence);
}

/**
 * Get memory statistics
 */
export async function getStats() {
  return await memoryManager.getStatistics();
}

/**
 * Initialize integration
 */
export async function initialize() {
  await memoryManager.initialize();
  console.log('🧠 Memory system integrated with OpenClaw');
}

// Export all hooks
export default {
  initialize,
  onToolCall,
  onUserMessage,
  onAssistantResponse,
  onError,
  onSessionEnd,
  queryMemory,
  learnPattern,
  storePreference,
  getStats
};
