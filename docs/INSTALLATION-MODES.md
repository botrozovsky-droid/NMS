# Installation Modes - NMS v0.6.0

**Complete guide to NMS installation modes**

---

## 📋 Overview

NMS v0.6.0 introduces a flexible installation system with three modes:

1. **🏠 Standalone** - Independent memory system
2. **🔗 OpenClaw Addon** - Integrated with OpenClaw (Recommended)
3. **🎛️ Custom** - Install to any location

The setup wizard automatically detects your environment and recommends the best mode.

---

## 🎯 Mode Comparison

| Feature | Standalone | OpenClaw Addon | Custom |
|---------|-----------|----------------|---------|
| **Location** | `~/.nms/` | `~/.openclaw/memory/` | User-specified |
| **Auto-capture** | ❌ | ✅ | ❌ |
| **Hook integration** | ❌ | ✅ | ❌ |
| **CLI access** | ✅ | ✅ | ✅ |
| **Web dashboard** | ✅ | ✅ | ✅ |
| **Manual import** | ✅ | ✅ | ✅ |
| **Session sync** | ❌ | ✅ | ❌ |
| **Best for** | Personal notes | OpenClaw users | Custom setups |

---

## 1️⃣ Standalone Mode

**Independent memory system for personal use**

### Use Cases:
- Personal knowledge management
- Research notes organization
- ChatGPT conversation archiving
- Document/code documentation

### Installation:
```bash
cd NMS
npm install
npm run setup
# Select option 1: Standalone
```

### Directory Structure:
```
~/.nms/
├── hippocampus/      # Short-term memory (episodes)
├── neocortex/        # Long-term memory (knowledge graph)
├── meta/             # Configuration and metadata
├── dashboard/        # Web interface
└── ...
```

### Features:
- ✅ CLI tools (`query`, `stats`, `import:file`)
- ✅ Web dashboard (http://localhost:3000)
- ✅ Manual import (JSON, Markdown, CSV, code)
- ✅ Consolidation (manual or scheduled)
- ✅ Semantic search with HNSW

### Limitations:
- No automatic conversation capture
- Manual data import required
- No OpenClaw integration

---

## 2️⃣ OpenClaw Addon Mode ⭐ Recommended

**Seamless OpenClaw integration with automatic conversation capture**

### Use Cases:
- OpenClaw users wanting automatic memory
- Multi-channel conversations (Telegram, WhatsApp, etc.)
- Agent workflow tracking
- Continuous learning from interactions

### Prerequisites:
- OpenClaw installed at `~/.openclaw/`
- Active OpenClaw usage

### Installation:
```bash
cd NMS
npm install
npm run setup
# Setup will detect OpenClaw and suggest Addon mode
# Select option 2: OpenClaw Addon
```

### What Gets Installed:

**1. NMS Core:**
```
~/.openclaw/memory/
├── hippocampus/
├── neocortex/
├── meta/
│   └── installation.json  # Tracks mode and integrations
└── ...
```

**2. Integration Hook:**
```
~/.openclaw/agents/main/hooks/nms-integration/
├── handler.js      # Event capture logic
├── HOOK.md         # Documentation
└── config.json     # Hook configuration
```

### How It Works:

**Automatic Capture:**
```
OpenClaw Conversation
      ↓
   NMS Hook (captures events)
      ↓
   Hippocampus (short-term)
      ↓
   Session End → Mini-Consolidation
      ↓
   Neocortex (long-term)
```

**Captured Events:**
- `message` - User messages from any channel
- `response` - Assistant responses
- `tool_call` - Tool/function executions
- `session_end` - Triggers consolidation

### Features:
- ✅ **Automatic capture** - No manual import needed
- ✅ **Real-time memory** - Available immediately after session
- ✅ **Session consolidation** - Runs after each conversation
- ✅ **All Standalone features** - Plus automatic capture
- ✅ **Existing session sync** - `npm run sync:openclaw`

### Hook Management:

**Verify hook installation:**
```bash
ls ~/.openclaw/agents/main/hooks/nms-integration/
# Should show: handler.js, HOOK.md, config.json
```

**Check hook status:**
```bash
cd ~/.openclaw/memory
cat meta/installation.json
# Look for: integrations.openclaw.hookInstalled: true
```

**Manual hook installation (if auto-install failed):**
```bash
cp -r openclaw-hook/* ~/.openclaw/agents/main/hooks/nms-integration/
# Restart OpenClaw
```

### Sync Existing Sessions:

Import past OpenClaw conversations:
```bash
cd ~/.openclaw/memory
npm run sync:openclaw
# Imports all existing sessions
```

---

## 3️⃣ Custom Mode

**Install NMS to any location**

### Use Cases:
- Specific directory requirements
- Multiple NMS instances
- Custom deployment scenarios

### Installation:
```bash
cd NMS
npm install
npm run setup
# Select option 3: Custom
# Enter desired path when prompted
```

### Example Paths:
- `/opt/nms/` - System-wide installation
- `~/projects/my-memory/` - Project-specific
- `/mnt/nas/nms/` - Network storage

### Features:
Same as Standalone mode, but at custom location.

---

## 🔄 Switching Modes

### Upgrade Existing Installation:

**From Standalone to OpenClaw Addon:**
```bash
# Option 1: Fresh setup (preserves data)
cd NMS
npm run setup
# Select OpenClaw Addon
# Data in ~/.nms/ remains intact

# Option 2: Manual migration
cp -r ~/.nms/* ~/.openclaw/memory/
cd ~/.openclaw/memory
npm run setup
```

**From OpenClaw Addon to Standalone:**
```bash
# Copy data
cp -r ~/.openclaw/memory/* ~/.nms/

# Remove hook
rm -rf ~/.openclaw/agents/main/hooks/nms-integration/

# Update installation config
cd ~/.nms
# Edit meta/installation.json: mode = "standalone"
```

---

## 🔍 Environment Detection

Setup wizard automatically detects:

**OpenClaw:**
- Checks `~/.openclaw/` directory
- Verifies `agents/` subdirectory
- Confirms it's valid OpenClaw installation

**Claude Code:**
- Checks `~/.claude/` directory
- Finds `config.json`
- Future: MCP Server integration

**Existing NMS:**
- Checks `~/.nms/` and `~/.openclaw/memory/`
- Reads `meta/installation.json`
- Detects version and mode

---

## 📝 Configuration File

**meta/installation.json** tracks your installation:

```json
{
  "version": "0.6.0",
  "installedAt": "2026-04-14T...",
  "mode": "openclaw-addon",
  "installPath": "/home/user/.openclaw/memory",

  "integrations": {
    "openclaw": {
      "enabled": true,
      "hookInstalled": true,
      "hookVersion": "1.0.0",
      "openclawPath": "/home/user/.openclaw",
      "autoSync": true
    },
    "claudeCode": {
      "enabled": false
    }
  },

  "setup": {
    "completed": true,
    "lastUpdate": "2026-04-14T..."
  }
}
```

---

## 🐛 Troubleshooting

### Setup doesn't detect OpenClaw

**Problem:** Setup suggests Standalone despite having OpenClaw

**Solution:**
```bash
# Verify OpenClaw location
ls ~/.openclaw/agents/
# Should show agents directory

# Run setup again
npm run setup
```

### Hook not capturing conversations

**Problem:** OpenClaw conversations not appearing in NMS

**Solution:**
```bash
# 1. Check hook installation
ls ~/.openclaw/agents/main/hooks/nms-integration/

# 2. Check hook config
cat ~/.openclaw/agents/main/hooks/nms-integration/config.json

# 3. Check installation config
cat ~/.openclaw/memory/meta/installation.json
# Verify: integrations.openclaw.hookInstalled: true

# 4. Restart OpenClaw
```

### Can't find installation.json

**Problem:** Legacy installation (v0.5.2 or earlier)

**Solution:**
```bash
cd ~/.openclaw/memory  # or ~/.nms/

# Create installation config manually
node -e "
import { createInstallationConfig } from './scripts/setup-utils/create-installation-config.js';
await createInstallationConfig(
  process.cwd(),
  'openclaw-addon',  // or 'standalone'
  { log: console.log }
);
"
```

### Multiple NMS installations

**Problem:** Both `~/.nms/` and `~/.openclaw/memory/` exist

**Solution:** Choose one to keep:
- **Keep OpenClaw Addon:** Remove `~/.nms/`
- **Keep Standalone:** Remove `~/.openclaw/memory/`
- **Keep Both:** They're independent (data in different locations)

---

## 💡 Best Practices

### For OpenClaw Users:
1. ✅ Always use **OpenClaw Addon** mode
2. ✅ Run `npm run sync:openclaw` after setup
3. ✅ Monitor dashboard for memory growth
4. ✅ Run consolidation manually if needed

### For Standalone Users:
1. ✅ Regular imports via `npm run import:file`
2. ✅ Schedule nightly consolidation
3. ✅ Export ChatGPT/Claude conversations regularly
4. ✅ Use dashboard for monitoring

### For Both:
1. ✅ Keep Gemini API key in `.env` secure
2. ✅ Backup `neocortex/knowledge-graph.json` regularly
3. ✅ Monitor memory health in dashboard
4. ✅ Run quality checks: `npm run check-quality`

---

## 📚 Related Documentation

- [Getting Started](GETTING-STARTED.md) - Basic usage
- [Import Guide](IMPORT-GUIDE.md) - Data import
- [API Reference](API-REFERENCE.md) - API documentation
- [OpenClaw Hook](../openclaw-hook/HOOK.md) - Hook details
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

## 🆘 Need Help?

- 💬 GitHub Issues: https://github.com/botrozovsky-droid/NMS/issues
- 📖 Full docs: `docs/` directory
- 🔧 Setup wizard: `npm run setup`
