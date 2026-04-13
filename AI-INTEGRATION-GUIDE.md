# AI Integration Guide

**How to integrate OpenClaw NMS with your AI system**

---

## Overview

OpenClaw NMS can be integrated with:
- Chatbots (Discord, Telegram, Slack)
- AI assistants (Claude Code, ChatGPT plugins)
- RAG systems (Retrieval-Augmented Generation)
- Custom AI applications

## Quick Integration

### Step 1: Install

```bash
npm install
```

### Step 2: Import

```javascript
import memoryManager from './memory-manager.js';
```

### Step 3: Store Conversations

```javascript
// After each user interaction
await memoryManager.store({
  type: 'conversation',
  content: `User: ${userMessage}\nAssistant: ${aiResponse}`,
  tags: extractTags(userMessage),
  importance: calculateImportance(userMessage)
});
```

### Step 4: Query Before Response

```javascript
// Before generating response
const context = await memoryManager.query(userMessage, {
  limit: 5,
  minRelevance: 0.6
});

// Use context in AI prompt
const prompt = `
Context from memory:
${context.map(m => m.content).join('\n')}

User: ${userMessage}
Assistant:`;
```

## Example: Discord Bot

```javascript
import { Client } from 'discord.js';
import memoryManager from './memory-manager.js';

const client = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Query memory for context
  const memories = await memoryManager.query(message.content, {
    limit: 3,
    minRelevance: 0.5
  });

  // Generate response with context
  const response = await generateResponse(message.content, memories);

  // Store conversation
  await memoryManager.store({
    type: 'conversation',
    content: `${message.author.tag}: ${message.content}\nBot: ${response}`,
    tags: ['discord', message.channel.name],
    metadata: {
      userId: message.author.id,
      channelId: message.channel.id
    }
  });

  await message.reply(response);
});
```

## Example: RAG System

```javascript
async function ragQuery(userQuery) {
  // 1. Retrieve relevant memories
  const memories = await memoryManager.query(userQuery, {
    limit: 10,
    minRelevance: 0.6
  });

  // 2. Format context
  const context = memories
    .map(m => `- ${m.content}`)
    .join('\n');

  // 3. Augment prompt
  const prompt = `
You are an assistant with access to a knowledge base.

Relevant information:
${context}

User question: ${userQuery}

Answer based on the information above:`;

  // 4. Generate response
  const response = await callLLM(prompt);

  // 5. Store this interaction
  await memoryManager.store({
    type: 'qa',
    content: `Q: ${userQuery}\nA: ${response}`,
    tags: ['rag', 'qa'],
    importance: 0.7
  });

  return response;
}
```

## Best Practices

### 1. Calculate Importance

```javascript
function calculateImportance(message) {
  let score = 0.5; // Base importance

  // User explicitly saved
  if (message.includes('remember') || message.includes('save')) {
    score += 0.3;
  }

  // Contains questions
  if (message.includes('?')) {
    score += 0.1;
  }

  // Long message (more content)
  if (message.length > 200) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}
```

### 2. Tag Extraction

```javascript
function extractTags(message) {
  const tags = [];

  // Extract mentioned topics
  const topics = ['code', 'design', 'api', 'database', 'ui'];
  topics.forEach(topic => {
    if (message.toLowerCase().includes(topic)) {
      tags.push(topic);
    }
  });

  // Extract programming languages
  const languages = ['python', 'javascript', 'rust', 'go'];
  languages.forEach(lang => {
    if (message.toLowerCase().includes(lang)) {
      tags.push(lang);
    }
  });

  return tags;
}
```

### 3. Consolidation Schedule

```javascript
// Run consolidation after each session
async function endSession(sessionId) {
  await memoryManager.endSession(sessionId);
  
  // This triggers mini-consolidation
  // Full consolidation runs nightly via cron
}
```

### 4. Error Handling

```javascript
async function safeStore(episode) {
  try {
    await memoryManager.store(episode);
  } catch (error) {
    console.error('Failed to store memory:', error);
    // Don't fail the main application
    // Memory system is optional
  }
}
```

## API Reference

### store(episode)

```javascript
await memoryManager.store({
  type: 'conversation' | 'action' | 'observation' | 'qa',
  content: string,           // Required
  tags: string[],           // Optional
  importance: number,       // 0-1, default: 0.5
  metadata: object          // Optional custom data
});
```

### query(text, options)

```javascript
const results = await memoryManager.query('search text', {
  limit: 5,                 // Max results
  minRelevance: 0.6,       // Minimum similarity (0-1)
  tags: ['tag1', 'tag2'],  // Filter by tags
  types: ['conversation']   // Filter by type
});
```

### recall(options)

```javascript
const memories = await memoryManager.recall({
  sessionId: 'session-123',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  limit: 100
});
```

## Environment Variables

```bash
# .env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-1.5-flash  # or gemini-1.5-pro
MEMORY_ROOT=/path/to/memory
```

## Performance Tips

1. **Batch Store:** Store multiple episodes at once
2. **Async Operations:** Don't block on memory operations
3. **HNSW Search:** Auto-activates for >1000 nodes
4. **Consolidation:** Run during low-traffic periods

## Troubleshooting

### Memory Not Persisting

Check that consolidation is running:
```bash
npm run consolidate
```

### Search Returns No Results

Ensure embeddings are generated:
```bash
npm run import:file -- data.json --embeddings
```

### Slow Performance

Enable HNSW for large graphs:
```bash
npm run search:enable-hnsw
```

---

For more examples, see [examples/](examples/) directory.
