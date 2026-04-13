# Import Guide - OpenClaw Memory v0.4.2

**Как импортировать внешние данные в систему памяти**

---

## 📖 Содержание

1. [Зачем нужен импорт](#зачем-нужен-импорт)
2. [Поддерживаемые форматы](#поддерживаемые-форматы)
3. [CLI Import](#cli-import)
4. [Dashboard Import](#dashboard-import)
5. [Форматы данных](#форматы-данных)
6. [Примеры](#примеры)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Зачем нужен импорт

OpenClaw Memory работает с данными от Claude Code (tool calls, messages).
Но часто нужно загрузить **внешние данные**:

- 💬 **Прошлые чаты** из ChatGPT, Claude.ai, Gemini
- 📚 **Документацию** проектов (README, guides)
- 📝 **Заметки** и статьи
- 💻 **Code** с комментариями/docstrings
- 📊 **Structured data** (CSV таблицы)

**Import система** позволяет загрузить эти данные в систему памяти.

---

## Поддерживаемые форматы

| Формат | Расширения | Что извлекается |
|--------|------------|-----------------|
| **JSON** | `.json` | Chat exports (ChatGPT, Claude, Gemini, custom) |
| **Text** | `.txt`, `.md` | Documents, notes, articles |
| **CSV** | `.csv` | Structured data (concepts, facts) |
| **Code** | `.js`, `.py`, `.ts`, `.java`, `.cpp`, `.go`, `.rs` | Docstrings, comments, function signatures |

---

## CLI Import

### Команды:

```bash
# Import одного файла
npm run import:file -- path/to/file.json

# Import нескольких файлов (batch)
npm run import:batch -- file1.txt file2.md file3.csv

# Import директории (рекурсивно)
npm run import:dir -- path/to/docs/

# Показать историю импортов
npm run import:history
```

### Опции:

```bash
# С автоматической консолидацией
npm run import:file -- file.json --consolidate

# С генерацией embeddings
npm run import:file -- file.json --embeddings

# Оба варианта
npm run import:file -- file.json --consolidate --embeddings
```

### Примеры:

```bash
# Import чата из ChatGPT
npm run import:file -- ~/Downloads/chatgpt-export.json

# Import всей документации проекта
npm run import:dir -- ./docs/

# Import и сразу консолидация
npm run import:file -- notes.txt --consolidate
```

---

## Dashboard Import

### Открой Dashboard:
```bash
npm run dashboard
# → http://localhost:3000
```

### В правой панели найди секцию "📥 Import Data"

---

### Метод 1: File Upload

1. Click **"📁 Choose File"**
2. Выбери файл (JSON, TXT, MD, CSV, JS, PY, TS)
3. (Optional) Check ☑️ **Auto-consolidate**
4. Click **"Import"**

**Результат:**
```
✅ Imported 15 episodes from chatgpt-export.json
```

---

### Метод 2: Text Paste

1. Вставь текст в **text area**
   - Чат истории
   - Документацию
   - Заметки
   - Любой текст

2. (Optional) Check ☑️ **Auto-consolidate**

3. Click **"Import"**

**Результат:**
```
✅ Imported 3 episodes from text
```

---

### Import History

В нижней части секции:
- **Recent Imports** - последние 20 импортов
- Показывает: имя файла, формат, количество episodes, время
- ✅ Success (зелёная полоска)
- ❌ Failed (красная полоска)

Click **"Clear"** чтобы очистить историю.

---

## Форматы данных

### 1. JSON (Chat Exports)

#### ChatGPT Format:
```json
{
  "conversations": [
    {
      "mapping": {
        "node-id": {
          "message": {
            "author": { "role": "user" },
            "content": { "parts": ["Hello!"] },
            "create_time": 1704067200
          }
        }
      }
    }
  ]
}
```

#### Claude Format:
```json
{
  "uuid": "conv-123",
  "chat_messages": [
    {
      "sender": "user",
      "text": "Hello!",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Generic Format (universal):
```json
{
  "source": "My AI Assistant",
  "messages": [
    {
      "role": "user",
      "content": "Hello!",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help?",
      "timestamp": "2024-01-01T00:00:05Z"
    }
  ]
}
```

**Auto-detection:** Система автоматически определяет формат.

---

### 2. Text (Documents)

#### Markdown:
```markdown
# Project Documentation

## Django REST Framework

Django REST Framework is a powerful toolkit for building Web APIs.

### Features
- Serialization
- Authentication
- Viewsets
```

**Processing:**
- Splits by headers (##, ###)
- Each section → episode
- Preserves code blocks
- Links related sections

#### Plain Text:
```
This is a document about Python programming.
Python is easy to learn and powerful.

Django is a web framework written in Python.
It follows the MVC pattern.
```

**Processing:**
- Smart chunking (~1000 chars)
- Breaks at sentence boundaries
- Overlapping chunks for context

---

### 3. CSV (Structured Data)

```csv
concept,type,importance,description
Django,framework,0.9,Python web framework with batteries included
Flask,framework,0.8,Lightweight Python web framework
FastAPI,framework,0.85,Modern async Python API framework
```

**Column mapping:**
- Auto-detects: concept, type, importance, description, timestamp
- Creates episode for each row
- Imports as structured knowledge

---

### 4. Code (Documentation)

#### Python Docstrings:
```python
def calculate_importance(data):
    """
    Calculate importance score based on recency and frequency.

    Args:
        data: Input data with timestamps

    Returns:
        float: Importance score (0-1)
    """
    ...
```

#### JavaScript JSDoc:
```javascript
/**
 * Build HNSW index from vectors
 * @param {Array} vectors - Array of embeddings
 * @returns {Promise<number>} Build time in seconds
 */
async function buildIndex(vectors) {
    ...
}
```

**Extraction:**
- Docstrings (Python """, JS /** */)
- Multi-line comments
- TODO/FIXME/NOTE comments
- Function signatures

**Supported languages:**
- JavaScript (.js, .mjs)
- TypeScript (.ts, .tsx)
- Python (.py)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- Go (.go)
- Rust (.rs)

---

## Примеры

### Example 1: Import ChatGPT Export

**Шаг 1:** Export чат из ChatGPT
- Settings → Data controls → Export data
- Download ZIP → extract `conversations.json`

**Шаг 2:** Import
```bash
npm run import:file -- ~/Downloads/conversations.json --consolidate
```

**Результат:**
```
📥 Importing file: conversations.json
   Format: JSON
   Size: 245.67 KB
   Parsed: 127 episodes
   💾 Stored 127 episodes in session import-123456789
✅ Import completed in 0.15s
```

---

### Example 2: Import Project Documentation

**Структура:**
```
docs/
├── README.md
├── API.md
├── ARCHITECTURE.md
└── guides/
    ├── quickstart.md
    └── advanced.md
```

**Import:**
```bash
npm run import:dir -- ./docs/
```

**Результат:**
```
📂 Importing directory: ./docs/
   Found 5 files
   Supported: 5 files

📦 Batch import: 5 files
✅ Import completed
   Success: 5
   Failed: 0
   Total episodes: 42
```

---

### Example 3: Import Code Documentation

**File:** `utils.py`
```python
def parse_json(content):
    """Parse JSON with error handling."""
    try:
        return json.loads(content)
    except JSONDecodeError as e:
        # TODO: Add better error messages
        logger.error(f"JSON parse failed: {e}")
        return None
```

**Import:**
```bash
npm run import:file -- utils.py
```

**Extracted:**
- Docstring: "Parse JSON with error handling"
- Comment: "TODO: Add better error messages"

---

### Example 4: Import via Dashboard UI

**Scenario:** Paste chat history

**Text:**
```
User: What is Django?
Assistant: Django is a Python web framework...

User: How to install it?
Assistant: Use pip install django...
```

**Steps:**
1. Open Dashboard (http://localhost:3000)
2. Scroll to "📥 Import Data"
3. Paste text in textarea
4. Click "Import"

**Result:**
```
✅ Imported 2 episodes from text
```

---

## Troubleshooting

### Issue 1: "Unknown JSON format"

**Problem:** JSON не распознан

**Solution:**
- Используй generic format:
  ```json
  {
    "messages": [
      { "role": "user", "content": "...", "timestamp": "..." }
    ]
  }
  ```

---

### Issue 2: "File too large"

**Problem:** Файл >50MB

**Solution:**
- Split на части
- Или увеличь limit в `dashboard/server.js`:
  ```javascript
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
  ```

---

### Issue 3: "Import failed - heap out of memory"

**Problem:** JavaScript memory limit

**Solution:**
- Import smaller batches
- Restart dashboard: `Ctrl+C`, `npm run dashboard`
- **Fix в v0.4.3**

---

### Issue 4: Text chunking too aggressive

**Problem:** Документ разбит на слишком много кусков

**Solution:**
- Используй Markdown с headers (будет split по headers)
- Или установи больший chunk size (в коде):
  ```javascript
  parseText(content, filePath, { chunkSize: 2000 })
  ```

---

### Issue 5: Code docstrings not extracted

**Problem:** Docstrings не найдены

**Solution:**
- Check формат docstrings:
  - Python: `"""..."""`
  - JS: `/** ... */`
- Multi-line comments должны начинаться с `/**` (не `/*`)

---

## FAQ

### Q1: Какой формат лучше для чатов?

**A:** Generic JSON format - универсальный и простой:
```json
{
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." }
  ]
}
```

---

### Q2: Можно ли импортировать PDF?

**A:** Пока нет. Используй:
- Конвертер PDF → Text
- Или копируй текст из PDF и вставляй в Dashboard

**Planned:** v0.5.0 - PDF support

---

### Q3: Импорт добавляет дубликаты?

**A:** Да, система не проверяет дубликаты при импорте.

**Solution:**
- Run `npm run deduplicate` после импорта
- Или check "Auto-consolidate" (система объединит похожие concepts)

---

### Q4: Что делает "Auto-consolidate"?

**A:** После импорта сразу запускает consolidation:
- Episodes → Concepts
- Обновляет knowledge graph
- Генерирует embeddings

**Без auto-consolidate:**
- Episodes сохраняются в hippocampus
- Консолидация произойдёт ночью (или вручную)

---

### Q5: Можно ли импортировать из Google Docs?

**A:** Экспортируй как:
- Plain text (.txt)
- Markdown (.md)
- Затем импортируй через CLI или Dashboard

---

### Q6: Import влияет на существующие данные?

**A:** Нет, импорт только **добавляет** новые episodes.
Существующий knowledge graph не изменяется напрямую.

---

### Q7: Сколько времени занимает импорт?

**A:**
- Small files (<1MB): <1s
- Medium (1-10MB): 1-5s
- Large (10-50MB): 5-20s
- **With consolidation:** +30-60s

---

### Q8: Можно ли импортировать во время работы Claude Code?

**A:** Да, безопасно! Import использует transactions.

---

### Q9: Как проверить что импорт прошёл?

**A:**
```bash
# Check import history
npm run import:history

# Check sessions
ls hippocampus/sessions/import-*.json

# Check stats
npm run stats
```

---

### Q10: Можно ли откатить импорт?

**A:** Да:
1. Find session ID в import history
2. Delete session file:
   ```bash
   rm hippocampus/sessions/import-XXXXXXXXX.json
   ```
3. Remove from daily-index.json

**Planned:** v0.4.3 - undo import command

---

## 🎓 Best Practices

### 1. Organize imports
```bash
# Create import folder
mkdir imports/

# Organize by source
imports/
├── chatgpt/
├── claude/
├── docs/
└── code/
```

### 2. Use auto-consolidate for small imports
- <100 episodes: ✅ Auto-consolidate
- >100 episodes: ❌ Manual consolidation (ночью)

### 3. Import code selectively
- Import files with **good documentation**
- Skip auto-generated code
- Focus on core modules

### 4. Batch imports during off-hours
- Large imports → запускай ночью
- Меньше нагрузка на систему

### 5. Check import history regularly
```bash
npm run import:history
```

### 6. Consolidate after large imports
```bash
npm run import:dir -- ./docs/
npm run consolidate  # Manual consolidation
```

---

## 🔗 См. также

- [USER-GUIDE.md](USER-GUIDE.md) - Основное руководство
- [API-REFERENCE.md](API-REFERENCE.md) - API документация
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Решение проблем

---

**OpenClaw Memory v0.4.2**
*Import Guide*
*Last updated: 12 апреля 2026*
