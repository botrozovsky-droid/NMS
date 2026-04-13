/**
 * JSON Format Parser
 * Handles chat exports from ChatGPT, Claude, Gemini, and custom formats
 */

/**
 * Parse JSON content
 * @param {string} content - JSON string
 * @param {Object} options - Parse options
 * @returns {Object} Parsed data with episodes
 */
export function parseJSON(content, options = {}) {
  try {
    const data = JSON.parse(content);

    // Detect JSON type
    const jsonType = detectJSONType(data);

    switch (jsonType) {
      case 'chatgpt':
        return parseChatGPT(data, options);
      case 'claude':
        return parseClaude(data, options);
      case 'gemini':
        return parseGemini(data, options);
      case 'generic-chat':
        return parseGenericChat(data, options);
      case 'custom':
        return parseCustom(data, options);
      default:
        throw new Error('Unknown JSON format');
    }
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }
}

/**
 * Detect JSON type
 * @param {Object} data - Parsed JSON
 * @returns {string} Type (chatgpt, claude, gemini, generic-chat, custom)
 */
function detectJSONType(data) {
  // ChatGPT export format
  if (data.conversations || (Array.isArray(data) && data[0]?.mapping)) {
    return 'chatgpt';
  }

  // Claude export format
  if (data.chat_messages || data.uuid) {
    return 'claude';
  }

  // Gemini export format
  if (data.conversations && data.conversations[0]?.model?.includes('gemini')) {
    return 'gemini';
  }

  // Generic chat format (messages array)
  if (Array.isArray(data.messages) || Array.isArray(data)) {
    return 'generic-chat';
  }

  // Custom format (concepts, nodes, episodes)
  if (data.concepts || data.nodes || data.episodes) {
    return 'custom';
  }

  return 'unknown';
}

/**
 * Parse ChatGPT export
 * Format: { conversations: [ { mapping: {...}, ... } ] }
 */
function parseChatGPT(data, options) {
  const episodes = [];
  const conversations = data.conversations || data;

  for (const conv of conversations) {
    const mapping = conv.mapping || {};
    const messages = extractChatGPTMessages(mapping);

    // Convert messages to episodes
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      episodes.push({
        content: msg.content,
        role: msg.role,
        timestamp: msg.timestamp || new Date().toISOString(),
        metadata: {
          conversationId: conv.id || conv.conversation_id,
          messageIndex: i,
          model: msg.model || 'chatgpt',
          source: 'ChatGPT'
        }
      });
    }
  }

  return {
    format: 'chatgpt',
    episodes,
    metadata: {
      totalConversations: conversations.length,
      totalMessages: episodes.length
    }
  };
}

/**
 * Extract messages from ChatGPT mapping structure
 */
function extractChatGPTMessages(mapping) {
  const messages = [];
  const nodes = Object.values(mapping);

  for (const node of nodes) {
    if (node.message && node.message.content) {
      const content = node.message.content;

      if (content.parts && content.parts.length > 0) {
        messages.push({
          content: content.parts.join('\n'),
          role: node.message.author?.role || 'unknown',
          timestamp: node.message.create_time
            ? new Date(node.message.create_time * 1000).toISOString()
            : new Date().toISOString(),
          model: node.message.metadata?.model_slug
        });
      }
    }
  }

  // Sort by timestamp
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return messages;
}

/**
 * Parse Claude export
 * Format: { chat_messages: [...], ... }
 */
function parseClaude(data, options) {
  const episodes = [];
  const messages = data.chat_messages || data.messages || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    episodes.push({
      content: msg.text || msg.content,
      role: msg.sender || msg.role,
      timestamp: msg.created_at || msg.timestamp || new Date().toISOString(),
      metadata: {
        conversationId: data.uuid || data.id,
        messageIndex: i,
        model: 'claude',
        source: 'Claude'
      }
    });
  }

  return {
    format: 'claude',
    episodes,
    metadata: {
      conversationId: data.uuid || data.id,
      totalMessages: episodes.length
    }
  };
}

/**
 * Parse Gemini export
 */
function parseGemini(data, options) {
  const episodes = [];
  const conversations = data.conversations || [data];

  for (const conv of conversations) {
    const messages = conv.messages || conv.history || [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      episodes.push({
        content: msg.parts?.[0]?.text || msg.text || msg.content,
        role: msg.role,
        timestamp: msg.timestamp || new Date().toISOString(),
        metadata: {
          conversationId: conv.id,
          messageIndex: i,
          model: conv.model || 'gemini',
          source: 'Gemini'
        }
      });
    }
  }

  return {
    format: 'gemini',
    episodes,
    metadata: {
      totalConversations: conversations.length,
      totalMessages: episodes.length
    }
  };
}

/**
 * Parse generic chat format
 * Format: { messages: [ { role, content, timestamp }, ... ] }
 * or: [ { role, content, timestamp }, ... ]
 */
function parseGenericChat(data, options) {
  const episodes = [];
  const messages = Array.isArray(data) ? data : data.messages;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    episodes.push({
      content: msg.content || msg.text || msg.message,
      role: msg.role || msg.sender || 'user',
      timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
      metadata: {
        messageIndex: i,
        source: data.source || 'Generic',
        ...msg.metadata
      }
    });
  }

  return {
    format: 'generic-chat',
    episodes,
    metadata: {
      totalMessages: episodes.length
    }
  };
}

/**
 * Parse custom format (OpenClaw format)
 * Format: { episodes: [...] } or { concepts: [...] }
 */
function parseCustom(data, options) {
  const episodes = [];

  // If episodes array exists, use directly
  if (data.episodes) {
    return {
      format: 'custom',
      episodes: data.episodes,
      metadata: {
        totalEpisodes: data.episodes.length
      }
    };
  }

  // If concepts array, convert to episodes
  if (data.concepts) {
    for (const concept of data.concepts) {
      episodes.push({
        content: concept.description || concept.text || concept.concept,
        role: 'system',
        timestamp: concept.timestamp || new Date().toISOString(),
        metadata: {
          type: 'concept',
          concept: concept.concept || concept.name,
          importance: concept.importance,
          ...concept.metadata
        }
      });
    }
  }

  // If nodes array (knowledge graph), convert to episodes
  if (data.nodes) {
    for (const [nodeId, node] of Object.entries(data.nodes)) {
      episodes.push({
        content: `Concept: ${node.concept}. Type: ${node.type || 'unknown'}`,
        role: 'system',
        timestamp: node.createdAt || new Date().toISOString(),
        metadata: {
          type: 'node',
          nodeId,
          concept: node.concept,
          importance: node.importance,
          confidence: node.confidence
        }
      });
    }
  }

  return {
    format: 'custom',
    episodes,
    metadata: {
      totalEpisodes: episodes.length
    }
  };
}

export default parseJSON;
