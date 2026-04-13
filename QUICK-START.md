# 🚀 Quick Start - Memory System

## ✅ Система установлена и работает!

---

## 🧪 Быстрая проверка (30 секунд):

```bash
cd ~/.openclaw/memory
npm test
```

**Ожидается:** ✅ All tests passed! Memory system is working correctly.

---

## 📊 Проверить что сохранено:

```bash
cd ~/.openclaw/memory
node -e "import mm from './memory-manager.js'; await mm.initialize(); console.log(JSON.stringify(await mm.getStatistics(), null, 2));"
```

**Вывод:**
```json
{
  "hippocampus": {
    "totalEvents": 6,           // События из тестов
    "pendingConsolidation": 6   // Ждут консолидации
  },
  "neocortex": {
    "totalNodes": 0,            // Пусто (консолидация не запущена)
    "totalEdges": 0
  },
  "procedural": {
    "totalPatterns": 1,         // 1 паттерн из тестов
    "totalPreferences": 1       // 1 предпочтение (editor=vscode)
  }
}
```

---

## 🌙 Протестировать консолидацию (3-5 минут):

**Требование:** GEMINI_API_KEY настроен в .env

### 1. Проверь что Gemini API доступен:
```bash
cat .env | grep GEMINI_API_KEY
```

### 2. Запусти консолидацию:
```bash
cd ~/.openclaw/memory
node consolidate.js
```

**Ожидается:**
```
🌙 Starting nightly consolidation...
📊 Found 6 candidates for consolidation
🔄 Processing batch 1/1
✅ Batch consolidated: 6 episodes
🧹 Applying temporal decay...
✅ Consolidation complete!
   📊 Consolidated: 6 episodes
   🧠 Graph size: X nodes, Y edges
   ⏱️  Duration: 15.3s
```

### 3. Проверь результат:
```bash
node -e "import mm from './memory-manager.js'; await mm.initialize(); console.log(JSON.stringify(await mm.getStatistics(), null, 2));"
```

**Ожидается:** `neocortex.totalNodes > 0` (концепты извлечены и добавлены в граф)

---

## 🎓 Протестировать мета-обучение (10 сек):

```bash
cd ~/.openclaw/memory
node meta-learn.js
```

**Ожидается:**
```
🧠 Starting meta-learning optimization...
📊 Current Performance:
   Memory Utilization: 45.2%
   Consolidation Efficiency: 100.0%
⚙️  Optimizing parameters...
✅ Parameters are optimal, no changes needed
✅ Meta-learning complete! (0.5s)
```

---

## ⏰ Настроить автоматический запуск (Windows):

### Способ 1: PowerShell (рекомендуется)
```powershell
# Запусти PowerShell как Администратор
cd C:\Users\Vlad\.openclaw\memory
.\schedule-tasks.ps1
```

### Способ 2: Task Scheduler вручную
1. Открой Task Scheduler: `Win+R` → `taskschd.msc`
2. Create Task → "OpenClaw-MemoryConsolidation"
3. Trigger: Daily at 3:00 AM
4. Action: `node C:\Users\Vlad\.openclaw\memory\consolidate.js`

---

## 🔗 Интеграция с OpenClaw (следующий шаг):

После того как протестируешь систему, нужно интегрировать её в OpenClaw.

**Файл для интеграции:** `~/.openclaw/memory/integration.js`

**Пример использования:**
```javascript
import memoryIntegration from '~/.openclaw/memory/integration.js';

// В начале работы OpenClaw
await memoryIntegration.initialize();

// После каждого tool call
await memoryIntegration.onToolCall(sessionId, toolName, args, result, metadata);

// После сообщений пользователя
await memoryIntegration.onUserMessage(sessionId, message);

// При ошибках
await memoryIntegration.onError(sessionId, error);

// Поиск в памяти
const memories = await memoryIntegration.queryMemory('query');
```

---

## 📚 Дальше:

Полная документация: `README.md`

---

**Готово! Система работает! 🎉**
