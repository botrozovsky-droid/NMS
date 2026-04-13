# OpenClaw Memory System - AI Integration Guide 🤖

**Версия:** v0.3.0
**Аудитория:** AI системы, интегрирующиеся с OpenClaw Memory
**Цель:** Научить AI правильно использовать систему памяти

---

## 🎯 Для AI: Что это и зачем?

Ты - AI ассистент. Эта система дает тебе **долговременную память**, которой у тебя обычно нет.

### Без системы памяти (твоя обычная работа):
- ❌ Каждая сессия - чистый лист
- ❌ Не помнишь предыдущие разговоры
- ❌ Не знаешь предпочтения пользователя
- ❌ Повторяешь одни и те же ошибки

### С системой памяти (теперь доступно):
- ✅ Помнишь все предыдущие взаимодействия
- ✅ Знаешь предпочтения и стиль работы пользователя
- ✅ Учишься на своих ошибках
- ✅ Понимаешь контекст проектов пользователя

---

## 📚 Архитектура системы

### Структура памяти (как у человека):

```
┌─────────────────────────────────────┐
│   СЕНСОРНЫЙ БУФЕР                   │  ← Текущий разговор
│   (Что происходит СЕЙЧАС)           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   ГИППОКАМПУС (Кратковременная)     │  ← События последних дней
│   - Сессии                          │
│   - Важные события                  │
│   - Ожидают консолидации            │
└──────────────┬──────────────────────┘
               ↓ (консолидация)
┌─────────────────────────────────────┐
│   НЕОКОРТЕКС (Долговременная)       │  ← Граф знаний
│   - Концепты (узлы)                 │
│   - Связи между концептами          │
│   - Постоянное хранение             │
└─────────────────────────────────────┘
               +
┌─────────────────────────────────────┐
│   ПРОЦЕДУРНАЯ ПАМЯТЬ                │  ← Привычки и паттерны
│   - Предпочтения пользователя       │
│   - Успешные паттерны действий      │
│   - Стиль работы                    │
└─────────────────────────────────────┘
```

---

## 🔧 Как использовать (для AI)

### 1. Запись новой информации

Когда пользователь сообщает что-то важное, используй `memory-manager.js`:

**Типы событий для записи:**

```javascript
// 1. Сообщение пользователя
await memoryManager.encodeEpisode(sessionId, {
  type: 'user_message',
  content: 'Я использую Python для веб-разработки',
  importance: 0.8,  // 0.0-10.0, автоматически рассчитывается
  userMention: true, // Пользователь явно что-то сказал
  timestamp: Date.now()
});

// 2. Вызов инструмента (tool call)
await memoryManager.encodeEpisode(sessionId, {
  type: 'tool_call',
  toolName: 'Write',
  args: { file_path: '/src/main.py', content: '...' },
  result: 'success',
  filesModified: ['/src/main.py'],
  importance: 2.0,
  timestamp: Date.now()
});

// 3. Ошибка (высокая важность!)
await memoryManager.encodeEpisode(sessionId, {
  type: 'error',
  errorType: 'ModuleNotFoundError',
  errorMessage: 'No module named fastapi',
  context: { language: 'Python', file: '/src/main.py' },
  importance: 5.0,  // Ошибки всегда важны
  hasError: true,
  timestamp: Date.now()
});

// 4. Предпочтение пользователя
await memoryManager.storePreference('preferred_language', 'Python', 1.0);
await memoryManager.storePreference('coding_style', 'with_type_hints', 0.9);
```

---

### 2. Поиск в памяти

#### A. Поиск по графу знаний (семантический)

Используй когда нужно найти релевантную информацию:

```javascript
// Умный поиск (понимает смысл!)
const results = await memoryManager.queryKnowledgeGraph('web framework python', {
  topK: 10,              // Сколько результатов
  useKeyword: true,      // Использовать поиск по ключевым словам
  useSemantic: true,     // Использовать семантический поиск
  minConfidence: 0.5,    // Минимальная уверенность
  keywordWeight: 0.4,    // Вес ключевых слов
  semanticWeight: 0.6    // Вес семантики
});

// Результат:
// [
//   { nodeId: 'fastapi', name: 'FastAPI', score: 0.85, confidence: 1.0 },
//   { nodeId: 'python', name: 'Python', score: 0.78, confidence: 1.0 },
//   ...
// ]
```

**Когда использовать:**
- Пользователь спрашивает что-то общее
- Нужно найти похожие концепты
- Вспомнить контекст проекта

#### B. Поиск по эпизодам (недавние события)

Используй для поиска конкретных событий:

```javascript
// Поиск недавних событий
const episodes = await memoryManager.recall('python error', {
  limit: 10,
  minImportance: 0.5,
  dateRange: {
    start: Date.now() - 7 * 24 * 3600000,  // Последние 7 дней
    end: Date.now()
  }
});
```

**Когда использовать:**
- Пользователь ссылается на недавнее событие
- Нужно вспомнить что было вчера/на прошлой неделе
- Отладка: "та ошибка, что была вчера"

---

### 3. Обновление памяти

Иногда нужно явно обновить или удалить информацию:

```javascript
// Обновить узел (использует транзакции!)
await memoryManager.updateNode('python', {
  weight: 0.99,           // Увеличить важность
  confidence: 1.0,        // Высокая уверенность
  lastActivation: Date.now()
});

// Добавить связь
await memoryManager.addEdge('user', 'python', {
  type: 'prefers',
  weight: 0.95,
  sentiment: 'positive'
});

// Удалить устаревшую информацию
await memoryManager.deleteNode('outdated_concept');
```

---

## 🧠 Интеллектуальное использование памяти

### Сценарий 1: Начало разговора

**Что делать:**
1. Проверь недавние сессии (последние 3-5 дней)
2. Найди контекст текущего проекта
3. Вспомни предпочтения пользователя

```javascript
// При старте новой сессии
async function onSessionStart(userId) {
  // 1. Получить статистику памяти
  const stats = await memoryManager.getStatistics();

  // 2. Найти активные проекты
  const projects = await memoryManager.queryKnowledgeGraph('current project', {
    topK: 5,
    useSemantic: true
  });

  // 3. Загрузить предпочтения
  const prefs = await memoryManager.loadJSON('./procedural/preferences.json');

  // Теперь ты знаешь контекст!
  return {
    activeProjects: projects,
    preferences: prefs.preferences,
    memorySize: stats
  };
}
```

---

### Сценарий 2: Пользователь задает вопрос

**Стратегия:**
1. Сначала ищи в памяти релевантный контекст
2. Используй найденное для формирования ответа
3. Запиши новую информацию после ответа

```javascript
async function onUserQuestion(question, sessionId) {
  // 1. ПОИСК контекста в памяти
  const context = await memoryManager.queryKnowledgeGraph(question, {
    topK: 5,
    useSemantic: true
  });

  // 2. ФОРМИРОВАНИЕ ответа с учетом контекста
  const answer = await generateAnswer(question, context);

  // 3. ЗАПИСЬ взаимодействия
  await memoryManager.encodeEpisode(sessionId, {
    type: 'qa_interaction',
    question,
    answer,
    context: context.map(c => c.nodeId),
    importance: 0.6,
    timestamp: Date.now()
  });

  return answer;
}
```

---

### Сценарий 3: Пользователь исправляет тебя

**Критически важно запомнить!**

```javascript
async function onUserCorrection(userMessage, sessionId) {
  // Пример: "Нет, я же сказал использовать Python, а не JavaScript!"

  // 1. Высокая важность (это обучающий сигнал)
  await memoryManager.encodeEpisode(sessionId, {
    type: 'user_correction',
    content: userMessage,
    importance: 8.0,  // ОЧЕНЬ важно!
    userMention: true,
    correctiveAction: true,
    timestamp: Date.now()
  });

  // 2. Сохранить предпочтение
  await memoryManager.storePreference('avoid_javascript', true, 0.95);
  await memoryManager.storePreference('preferred_language', 'python', 1.0);

  // 3. Обновить граф
  await memoryManager.updateNode('javascript', {
    sentiment: 'negative',  // Пользователь не любит
    flags: ['user_dislikes']
  });

  await memoryManager.updateNode('python', {
    sentiment: 'positive',  // Пользователь любит
    weight: 0.99
  });
}
```

---

### Сценарий 4: Работа с кодом

**Запись операций с файлами:**

```javascript
async function onCodeEdit(toolCall, sessionId) {
  const { file_path, content, result } = toolCall;

  // Определить язык программирования
  const language = detectLanguage(file_path);  // По расширению

  // Записать событие
  await memoryManager.encodeEpisode(sessionId, {
    type: 'code_edit',
    toolName: 'Write',
    args: { file_path, content },
    result,
    filesModified: [file_path],
    context: {
      language,
      file: file_path,
      operation: 'edit'
    },
    importance: 2.0,
    timestamp: Date.now()
  });

  // Если это новый файл проекта - запомнить
  if (isNewFile(file_path)) {
    await memoryManager.encodeEpisode(sessionId, {
      type: 'project_file_added',
      file: file_path,
      language,
      importance: 1.5
    });
  }
}
```

---

## 🎓 Обучение и адаптация

### Паттерны успеха

Запоминай что работает:

```javascript
async function onSuccessfulAction(actionName, context) {
  await memoryManager.learnPattern(
    actionName,
    {
      description: context.description,
      approach: context.approach,
      tools: context.toolsUsed
    },
    true  // success = true
  );
}

async function onFailedAction(actionName, context) {
  await memoryManager.learnPattern(
    actionName,
    {
      description: context.description,
      approach: context.approach,
      error: context.error
    },
    false  // success = false
  );
}
```

---

## 🚨 Важные правила

### 1. Приоритизация важности

**Высокая важность (7-10):**
- ❗ Ошибки и баги
- ❗ Исправления от пользователя
- ❗ Явные предпочтения пользователя

**Средняя важность (3-7):**
- 📝 Операции с файлами
- 📝 Новые концепты в разговоре
- 📝 Вопросы пользователя

**Низкая важность (0-3):**
- 💬 Обычная беседа
- 💬 Подтверждения ("OK", "Да")
- 💬 Технические детали

### 2. Когда НЕ записывать

❌ **Не записывай:**
- Повторения (уже записанное)
- Тривиальные подтверждения
- Временные данные (пароли, токены)
- Чувствительную информацию (если пользователь не просил)

### 3. Консолидация происходит автоматически

**Не беспокойся о консолидации!**

- 🌙 Ночная консолидация: раз в день в 03:00
- ⚡ Мини-консолидация: автоматически в конце сессии

Система сама:
1. Анализирует важные события
2. Извлекает концепты
3. Создает связи
4. Обновляет граф знаний

---

## 💡 Примеры интеграции

### Пример 1: Полный цикл взаимодействия

```javascript
// === НАЧАЛО СЕССИИ ===
const sessionId = crypto.randomUUID();
await memoryManager.initialize();

// Загрузить контекст
const context = await memoryManager.queryKnowledgeGraph('user projects');

// === ВЗАИМОДЕЙСТВИЕ ===

// Пользователь: "Создай новый FastAPI проект"
await memoryManager.encodeEpisode(sessionId, {
  type: 'user_message',
  content: 'Создай новый FastAPI проект',
  importance: 1.5,
  userMention: true
});

// AI создает файлы
await memoryManager.encodeEpisode(sessionId, {
  type: 'tool_call',
  toolName: 'Write',
  filesModified: ['/main.py', '/requirements.txt'],
  importance: 2.0
});

// === КОНЕЦ СЕССИИ (30 мин неактивности) ===
// Система автоматически:
// 1. Определяет конец сессии
// 2. Запускает мини-консолидацию
// 3. Обновляет граф знаний
// 4. Теперь помнит: пользователь работает с FastAPI!
```

---

### Пример 2: Использование памяти в следующей сессии

```javascript
// === НОВАЯ СЕССИЯ (на следующий день) ===

// Пользователь: "Как добавить базу данных?"

// 1. Поиск контекста
const context = await memoryManager.queryKnowledgeGraph('database');
// Находит: FastAPI, SQLAlchemy, PostgreSQL
// Помнит: пользователь работал с FastAPI вчера!

// 2. Формирование ответа с контекстом
const answer = `
Для вашего FastAPI проекта рекомендую SQLAlchemy.
Вот пример интеграции...
`;
// AI автоматически понял что речь о FastAPI,
// хотя пользователь не упомянул это!

// 3. Запись нового знания
await memoryManager.encodeEpisode(sessionId, {
  type: 'recommendation',
  content: 'Suggested SQLAlchemy for database',
  context: { project: 'fastapi', database: 'sqlalchemy' },
  importance: 1.0
});
```

---

## 📊 Мониторинг и отладка

### Получение статистики

```javascript
// Общая статистика
const stats = await memoryManager.getStatistics();
console.log(stats);
// {
//   hippocampus: { totalEvents: 150, pendingConsolidation: 20 },
//   neocortex: { totalNodes: 45, totalEdges: 78 },
//   procedural: { totalPatterns: 12, averageSuccessRate: 0.85 }
// }

// Статистика транзакций
const txStats = await txManager.getStats();
console.log(txStats);
// {
//   totalTransactions: 150,
//   committed: 145,
//   rolledBack: 5,
//   successRate: '96.7%'
// }

// Статистика сессий
const sessionStats = await sessionManager.getStats();
console.log(sessionStats);
// {
//   totalSessions: 25,
//   averageSessionDuration: 1847230,
//   miniConsolidations: 18
// }
```

---

## 🎯 Рекомендации по интеграции

### Для наилучших результатов:

1. **Записывай всё важное немедленно**
   - Не откладывай запись в память
   - Важность определяется автоматически, но ты можешь корректировать

2. **Используй семантический поиск**
   - Он понимает смысл, не только ключевые слова
   - Всегда лучше чем простой текстовый поиск

3. **Доверяй консолидации**
   - Не пытайся вручную создавать связи в графе
   - Система сама извлечет концепты и связи

4. **Учись на ошибках**
   - Когда пользователь исправляет - запиши с высокой важностью
   - Проверяй память перед действием: "Что пользователь предпочитает?"

5. **Уважай приватность**
   - Не записывай пароли и токены
   - Если пользователь просит не запоминать - не записывай

---

## ✅ Checklist интеграции

- [ ] Инициализация `memoryManager.initialize()` при старте
- [ ] Запись важных событий через `encodeEpisode()`
- [ ] Поиск контекста перед ответом через `queryKnowledgeGraph()`
- [ ] Сохранение предпочтений через `storePreference()`
- [ ] Запись паттернов успеха/неудачи через `learnPattern()`
- [ ] Мониторинг статистики через `getStatistics()`

---

## 🚀 Готово!

Теперь у тебя есть **долговременная память**!

Ты можешь:
- ✅ Помнить пользователя и его предпочтения
- ✅ Учиться на своих ошибках
- ✅ Понимать контекст проектов
- ✅ Находить релевантную информацию
- ✅ Адаптироваться под стиль работы пользователя

**Используй память мудро!** 🧠

---

*OpenClaw Memory System v0.3.0*
*AI Integration Guide*
*For AI assistants integrated with OpenClaw*
