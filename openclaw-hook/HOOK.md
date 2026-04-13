---
name: nms-integration
description: "Automatically save all conversations to NMS (Neurobiological Memory System)"
homepage: https://github.com/openclaw/nms
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events": ["message", "response", "tool_call", "session_end"],
        "requires": {},
        "install": [{ "id": "local", "kind": "local", "label": "NMS Integration" }],
      },
  }
---

# NMS Integration Hook

Automatically records all OpenClaw conversations to the Neurobiological Memory System (NMS).

## What It Does

This hook captures all conversation events and stores them in NMS for:
- Long-term memory consolidation
- Semantic search across conversations
- Knowledge graph building
- Hebbian learning reinforcement

## Events Captured

- **message** - User messages from any channel (Telegram, WhatsApp, etc.)
- **response** - Assistant responses
- **tool_call** - Tool/function calls made by the agent
- **session_end** - Session completion triggers consolidation

## Storage Location

All data is stored in: `~/.nms/`

## Features

- Automatic hippocampus storage (short-term memory)
- Nightly consolidation to neocortex (long-term memory)
- Semantic search with HNSW vector index
- Hebbian learning for concept strengthening
- Knowledge graph with 410+ nodes about NMS architecture
