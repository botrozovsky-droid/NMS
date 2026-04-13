# OpenClaw Memory System v0.3.1 - Руководство по модулям

## Архитектура

OpenClaw Memory - это нейробиологическая система памяти, использующая принципы работы человеческого мозга: Hebbian learning, temporal decay, consolidation.

---

## 📦 Библиотека (lib/)

### lib/json-store.js
**Назначение:** Централизованный модуль для работы с JSON файлами
**Размер:** 55 строк
**Зависимости:** fs/promises

**Экспортируемые функции:**
- `loadJSON(filePath)` - Загрузка и парсинг JSON с обработкой ошибок
- `saveJSON(filePath, data)` - Сохранение с форматированием (2 пробела)
- `existsJSON(filePath)` - Проверка существования файла

**Использование:**
```javascript
import { loadJSON, saveJSON } from './lib/json-store.js';

const graph = await loadJSON('./neocortex/knowledge-graph.json');
await saveJSON('./neocortex/knowledge-graph.json', graph);
```

**История:**
- v0.3.1: Создан для устранения дублирования в 4 файлах (72 строки)

---

### lib/consolidation-core.js
**Назначение:** Общая логика консолидации памяти
**Размер:** 385 строк
**Зависимости:** axios

**Экспортируемые функции:**
- `analyzeWithGemini(episodes, options)` - Анализ эпизодов через Gemini API
- `createNode(concept, episodeIds, now, metadata)` - Создание узла графа с метаданными v0.2
- `updateNode(node, concept, hebbianParams, now)` - Hebbian укрепление узла
- `createEdge(relationship, episodeIds, now, metadata)` - Создание связи
- `updateEdge(edge, relationship, hebbianParams, now)` - Укрепление связи
- `applyDecay(graph, hebbianParams, now)` - Временное затухание (Ebbinghaus)
- `pruneWeakConnections(graph, hebbianParams)` - Удаление слабых связей
- `autoFlagNode(node, episodes)` - Автоматическое флагирование низкой достоверности
- `autoFlagEdge(edge, episodes)` - Флагирование слабых выводов

**Ключевые алгоритмы:**
1. **Gemini API анализ** - детальный промпт с метаданными (extraction_type, confidence, rationale)
2. **Hebbian learning** - `weight = min(1.0, weight + learningRate)`
3. **Temporal decay** - `weight *= exp(-ln(2) * timeSince / halfLife)`
4. **Bayesian confidence update** - `confidence = (old + new) / 2`

**Использование:**
```javascript
import * as core from './lib/consolidation-core.js';

// Анализ эпизодов
const analysis = await core.analyzeWithGemini(episodes, {
  temperature: 0.3,
  maxOutputTokens: 4096
});

// Создание узла
const node = core.createNode(concept, episodeIds, Date.now());
```

**История:**
- v0.3.1: Извлечено из consolidate.js и mini-consolidate.js (200+ строк общего кода)

---

### lib/consolidation-strategies.js
**Назначение:** Strategy Pattern для разных типов консолидации
**Размер:** 304 строки
**Зависимости:** consolidation-core.js, json-store.js

**Экспортируемые стратегии:**

#### NightlyStrategy
**Назначение:** Полная ночная консолидация с decay и pruning

**Методы:**
- `selectCandidates(candidatesData, params)` - Фильтр по importance + recency
- `processBatch(episodes, graph, params, paths)` - Детальный анализ (temp=0.3, tokens=4096)
- `postProcess(graph, params)` - Применяет decay + pruning
- `getBatchSize(params)` - Размер batch из конфигурации

**Характеристики:**
- Обрабатывает 50+ событий в батчах
- Полный Gemini анализ (60s timeout)
- Применяет temporal decay ко всем узлам
- Удаляет слабые связи (pruning)

#### SessionEndStrategy
**Назначение:** Быстрая консолидация в конце сессии

**Методы:**
- `selectCandidates(session, params)` - Топ-20 по важности
- `processBatch(episodes, graph, params, paths)` - Быстрый анализ (temp=0.2, tokens=2048)
- `postProcess(graph, params)` - Skip (сохранить открытия)
- `getBatchSize(params)` - Infinity (без батчей)

**Характеристики:**
- Обрабатывает только топ-20 событий
- Упрощенный промпт (30s timeout)
- Маркирует узлы как `consolidationType: 'mini'`
- Валидирует существование узлов перед созданием связей
- НЕ применяет decay/pruning

**Использование:**
```javascript
import { NightlyStrategy, SessionEndStrategy } from './lib/consolidation-strategies.js';

// Выбор стратегии
const strategy = isNightly ? NightlyStrategy : SessionEndStrategy;
```

**История:**
- v0.3.1: Создано для унификации consolidate.js и mini-consolidate.js

---

### lib/consolidator.js
**Назначение:** Оркестратор консолидации с транзакциями
**Размер:** 230 строк
**Зависимости:** json-store.js, transaction-manager.js, стратегии

**Класс: Consolidator**

**Конструктор:**
```javascript
constructor(strategy, options = {})
```
- `strategy` - NightlyStrategy или SessionEndStrategy
- `options.hippocampusDir` - путь к hippocampus/
- `options.neocortexDir` - путь к neocortex/
- `options.metaDir` - путь к meta/

**Основной метод:**
```javascript
async consolidate(input)
```
- `input` - candidates (для nightly) или session (для session-end)
- Возвращает: `{ success, consolidatedCount, newNodes, updatedNodes, newEdges, duration }`

**Алгоритм:**
1. Загрузить граф и параметры (через json-store)
2. Инициализировать transaction manager
3. Выполнить в транзакции:
   - Выбрать кандидатов (через стратегию)
   - Загрузить эпизоды из hippocampus/sessions/
   - Обработать batch-ами (через стратегию)
   - Пост-обработка (через стратегию)
   - Обновить метаданные графа
   - Сохранить граф (через json-store)
4. Вернуть результат

**Вспомогательные методы:**
- `loadEpisodes(selected, input)` - Загрузка эпизодов из session файлов
- `markEpisodesConsolidated(episodes)` - Маркировка как consolidated=true
- `updateCandidates(input, selected, count)` - Обновление synaptic-candidates.json

**Использование:**
```javascript
import { Consolidator } from './lib/consolidator.js';
import { NightlyStrategy } from './lib/consolidation-strategies.js';

const consolidator = new Consolidator(NightlyStrategy, {
  hippocampusDir: './hippocampus',
  neocortexDir: './neocortex',
  metaDir: './meta'
});

const result = await consolidator.consolidate(candidates);
```

**История:**
- v0.3.1: Создан для унификации оркестрации консолидации

---

## 🎯 Точки входа

### consolidate.js
**Назначение:** CLI для ночной консолидации
**Размер:** 75 строк (было 516)
**Тип:** Исполняемый скрипт

**Функциональность:**
- Загружает synaptic-candidates.json
- Создает Consolidator с NightlyStrategy
- Запускает консолидацию
- Экспортирует функцию `consolidate()` для тестов

**Использование:**
```bash
# CLI
node consolidate.js

# Или через cron
0 3 * * * cd ~/.openclaw/memory && node consolidate.js
```

**История:**
- v0.1: Исходная реализация
- v0.3.0: Добавлены embeddings и транзакции
- v0.3.1: Рефакторинг - удалено 441 строка, используется lib/

---

### mini-consolidate.js
**Назначение:** Экспорт для session-end консолидации
**Размер:** 78 строк (было 360)
**Тип:** Модуль + CLI для тестов

**Экспортируемая функция:**
```javascript
export async function miniConsolidate(session)
```
- `session` - объект сессии с `importantEvents[]`
- Возвращает: результат консолидации

**Использование:**
```javascript
// Из session-manager.js
import { miniConsolidate } from './mini-consolidate.js';

const result = await miniConsolidate(session);
```

```bash
# CLI тестирование
node mini-consolidate.js
```

**История:**
- v0.3.0: Создан для быстрой консолидации
- v0.3.1: Рефакторинг - удалено 282 строки, используется lib/

---

## 🧠 Основные модули

### memory-manager.js
**Назначение:** Центральный менеджер памяти
**Размер:** ~600 строк
**Тип:** Класс + CLI

**Класс: MemoryManager**

**Основные методы:**
- `initialize()` - Инициализация системы + vector index
- `rebuildVectorIndex()` - Построение индекса для семантического поиска
- `encodeEpisode(sessionId, event)` - Кодирование эпизода в hippocampus
- `tagForConsolidation(sessionId, episodeId, importance)` - Пометка для консолидации
- `queryKnowledgeGraph(query, options)` - Семантический + keyword поиск
- `updateNode(nodeId, updates)` - Обновление узла через транзакцию
- `deleteNode(nodeId)` - Удаление узла + связанных edges через транзакцию
- `addEdge(source, target, type, weight)` - Создание связи через транзакцию
- `learnActionPattern(pattern)` - Procedural memory - паттерны действий
- `storePreference(key, value, importance)` - Procedural memory - предпочтения
- `getStatistics()` - Статистика памяти

**Класс: Synapse**
- Hebbian learning реализация
- `strengthen(learningRate)` - Укрепление связи
- `decay(halfLife)` - Временное затухание
- `importance()` - Расчет важности

**CLI команды:**
```bash
node memory-manager.js stats       # Статистика
node memory-manager.js query "..."  # Поиск
```

**Использование:**
```javascript
import memoryManager from './memory-manager.js';

await memoryManager.initialize();
await memoryManager.encodeEpisode(sessionId, {
  type: 'tool_call',
  data: { tool: 'Read', file: 'index.js' }
});
```

**История:**
- v0.1: Исходная реализация
- v0.2: Добавлены метаданные, canonical forms, hallucination detection
- v0.3.0: Семантический поиск, транзакции
- v0.3.1: Использует json-store.js (удалено 22 строки дублирования)

---

### semantic-search.js
**Назначение:** Семантический поиск через embeddings
**Размер:** ~450 строк
**Зависимости:** axios, fs/promises

**Ключевые функции:**
- `generateEmbedding(text)` - Генерация embedding через Gemini API
- `embedNode(node)` - Embedding для узла графа
- `cosineSimilarity(vecA, vecB)` - Расчет схожести векторов
- `buildIndexFromGraph(graph)` - Построение векторного индекса
- `hybridSearch(query, graph, vectorIndex, options)` - Гибридный поиск

**Класс: VectorIndex**
- `add(nodeId, embedding, metadata)` - Добавить вектор
- `search(queryEmbedding, k)` - Поиск top-k похожих
- `size` - Количество векторов

**Технические детали:**
- Модель: `gemini-embedding-001`
- Размерность: 3072
- Алгоритм: Linear scan O(n)
- Кэширование: embedding-cache.json

**Использование:**
```javascript
import { hybridSearch, buildIndexFromGraph } from './semantic-search.js';

const vectorIndex = await buildIndexFromGraph(graph);
const results = await hybridSearch('python web framework', graph, vectorIndex, {
  useKeyword: true,
  useSemantic: true,
  topK: 10
});
```

**История:**
- v0.3.0: Создан для семантического поиска
- v0.3.1: Без изменений

---

### transaction-manager.js
**Назначение:** ACID транзакции для графа
**Размер:** ~350 строк
**Зависимости:** fs/promises, crypto

**Класс: TransactionManager**

**Основные методы:**
- `initialize()` - Создание backup директории
- `begin(operation)` - Начало транзакции (создает backup)
- `commit()` - Фиксация транзакции (удаляет backup)
- `rollback(reason)` - Откат транзакции (восстановление из backup)
- `execute(operation, description)` - Execute pattern (auto commit/rollback)

**Статистика:**
- `totalTransactions` - Всего транзакций
- `committed` - Зафиксировано
- `rolledBack` - Откачено
- `failures` - Ошибки

**Helper функции:**
- `getGraphTransactionManager(dataPath)` - Singleton для графа

**Алгоритм транзакции:**
1. Создать backup текущего файла
2. Выполнить операцию
3. При успехе - удалить backup, обновить статистику
4. При ошибке - восстановить из backup

**Использование:**
```javascript
import { getGraphTransactionManager } from './transaction-manager.js';

const txManager = getGraphTransactionManager(KNOWLEDGE_GRAPH);
await txManager.initialize();

const result = await txManager.execute(async () => {
  // Операции с графом
  graph.nodes[nodeId] = newNode;
  await saveJSON(KNOWLEDGE_GRAPH, graph);
  return { success: true };
}, 'add-node');
```

**История:**
- v0.3.0: Создан для защиты данных
- v0.3.1: Без изменений

---

### session-manager.js
**Назначение:** Управление сессиями и триггер mini-consolidation
**Размер:** ~350 строк
**Зависимости:** fs/promises, crypto

**Класс: SessionManager**

**Конфигурация:**
- `inactivityThreshold`: 30 минут (порог неактивности)
- `checkInterval`: 5 минут (интервал проверки)
- `minEventsForConsolidation`: 3 (минимум событий)
- `autoConsolidate`: true (автоматическая консолидация)

**Основные методы:**
- `initialize()` - Запуск background checker
- `startSession()` - Создание новой сессии
- `recordActivity(eventData)` - Запись активности
- `endSession(reason)` - Завершение сессии + триггер mini-consolidation
- `startBackgroundChecker()` - Фоновая проверка неактивности
- `stopBackgroundChecker()` - Остановка checker

**Алгоритм mini-consolidation:**
1. Детектировать конец сессии (30 мин неактивности или manual)
2. Проверить: ≥3 важных событий?
3. Если да - вызвать `miniConsolidate(session)`
4. Обновить статистику

**Использование:**
```javascript
import { getSessionManager } from './session-manager.js';

const sessionManager = getSessionManager();
await sessionManager.initialize();

// Запись активности
sessionManager.recordActivity({
  importance: 0.8,
  type: 'tool_call'
});
```

**История:**
- v0.3.0: Создан для session-end консолидации
- v0.3.1: Без изменений

---

### meta-learn.js
**Назначение:** Мета-обучение - оптимизация параметров
**Размер:** 200 строк
**Тип:** CLI скрипт

**Функциональность:**
- Анализ эффективности памяти
- Анализ эффективности консолидации
- Корректировка параметров обучения
- Оптимизация thresholds

**Метрики:**
- Memory utilization efficiency
- Consolidation efficiency
- Compression ratio
- Network density

**Параметры оптимизации:**
- `consolidation.minImportance` - порог важности
- `hebbian.learningRate` - скорость обучения
- `hebbian.decayHalfLife` - период полураспада

**Использование:**
```bash
# Еженедельный запуск
node meta-learn.js
```

**История:**
- v0.2: Создан для self-optimization
- v0.3.1: Использует json-store.js (удалено 22 строки дублирования)

---

## 🧪 Тесты

### test-memory.js
**Назначение:** Базовые тесты memory-manager
**Тесты:** 10
**Покрытие:** encode, preferences, patterns, queries, statistics

### test-v0.2.js
**Назначение:** Тесты v0.2 features
**Тесты:** 31
**Покрытие:** metadata, canonical forms, hallucination detection, backward compatibility

### test-semantic-search.js
**Назначение:** Тесты семантического поиска
**Тесты:** 12
**Покрытие:** embeddings, vector index, hybrid search, similarity

### test-transactions.js
**Назначение:** Тесты транзакций
**Тесты:** 12
**Покрытие:** begin/commit/rollback, execute pattern, nested transactions

### test-session-consolidation.js
**Назначение:** Тесты session management
**Тесты:** 12
**Покрытие:** sessions, activity tracking, mini-consolidation trigger

**Всего тестов:** 77
**Успешных:** 77 (100%)

---

## 📂 Структура данных

### hippocampus/ (Кратковременная память)
```
hippocampus/
├── daily-index.json           Индекс событий по дням
├── synaptic-candidates.json   Кандидаты на консолидацию
└── sessions/
    └── {sessionId}.json       Файлы сессий с episodes
```

### neocortex/ (Долговременная память)
```
neocortex/
└── knowledge-graph.json       Граф знаний (nodes + edges)
```

### procedural/ (Процедурная память)
```
procedural/
├── action-patterns.json       Паттерны действий
└── preferences.json           Предпочтения пользователя
```

### meta/ (Мета-данные)
```
meta/
└── learning-params.json       Параметры обучения
```

### data/ (Кэши)
```
data/
└── embedding-cache.json       Кэш эмбеддингов
```

---

## 🔄 Потоки данных

### Encoding Flow
```
User Event → memory-manager.encodeEpisode()
           → hippocampus/sessions/{sessionId}.json
           → session-manager.recordActivity()
           → (if important) synaptic-candidates.json
```

### Nightly Consolidation Flow
```
consolidate.js → Consolidator(NightlyStrategy)
               → load synaptic-candidates.json
               → load episodes from sessions/
               → Gemini analysis
               → update knowledge-graph.json (with transaction)
               → apply decay + pruning
               → mark episodes as consolidated
```

### Session-End Consolidation Flow
```
session-manager.endSession() → miniConsolidate(session)
                             → Consolidator(SessionEndStrategy)
                             → load top-20 important events
                             → quick Gemini analysis
                             → update knowledge-graph.json (with transaction)
                             → skip decay/pruning
```

### Query Flow
```
User Query → memory-manager.queryKnowledgeGraph()
           → generate embedding (if semantic)
           → vectorIndex.search()
           → keyword matching (if keyword)
           → hybrid scoring
           → return top-k results
```

---

## 🎯 Ключевые паттерны

### Strategy Pattern
Используется для разных типов консолидации:
- NightlyStrategy - полная консолидация
- SessionEndStrategy - быстрая консолидация

### Transaction Pattern
Все операции с графом через транзакции:
```javascript
await txManager.execute(async () => {
  // Операции
}, 'description');
```

### Singleton Pattern
- SessionManager - один экземпляр на систему
- TransactionManager - один на файл данных

### Hebbian Learning
"Neurons that fire together, wire together":
```javascript
weight = min(1.0, weight + learningRate)
```

### Temporal Decay
Забывание по Ebbinghaus:
```javascript
weight *= exp(-ln(2) * timeSince / halfLife)
```

---

## 📊 Производительность

### Текущие метрики
- Узлов в графе: 12
- Связей: 6
- Embedding dimension: 3072
- Vector search: O(n) linear scan
- Embedding generation: ~200ms/node

### Масштабирование
- **До 200 узлов**: отлично (текущее состояние)
- **200-1000 узлов**: хорошо (50-100ms search)
- **1000-10000 узлов**: приемлемо (100-500ms search)
- **10000+ узлов**: требуется ANN (Approximate Nearest Neighbors)

---

## 🔧 Конфигурация

### learning-params.json
```json
{
  "parameters": {
    "consolidation": {
      "minImportance": 0.3,
      "minRecency": 3600000,
      "batchSize": 50
    },
    "hebbian": {
      "learningRate": 0.1,
      "decayHalfLife": 2592000000,
      "minWeight": 0.05
    },
    "session": {
      "inactivityThreshold": 1800000,
      "minEventsForConsolidation": 3
    }
  }
}
```

---

## 🚀 Планы развития

### v0.3.2 (Приоритет 2)
- **R2.1**: ANN алгоритм для векторного поиска (100x ускорение)
- **R2.2**: Демпфирование в meta-learning (стабильность параметров)
- **R2.3**: Batch-обновления графа (снижение overhead транзакций)

### v0.4 (Будущее)
- Миграция JSON → SQLite
- N-gram фильтры для canonical forms
- Embedding quantization

---

*OpenClaw Memory System v0.3.1*
*Neurobiological AI Memory - Made with ❤️*
*Developed by Claude Code (Sonnet 4.5)*
