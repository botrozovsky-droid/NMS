# OpenClaw Memory Dashboard

**Version:** 0.4.1
**Date:** 12 апреля 2026

## 📖 Описание

Веб-интерфейс для визуализации и управления OpenClaw Memory System.

## 🚀 Быстрый старт

```bash
cd ~/.openclaw/memory
npm run dashboard
```

Откроется браузер на **http://localhost:3000**

## ✨ Возможности

### 1. Graph Visualization (D3.js)
- **Force-directed graph** - автоматическая компоновка
- **Интерактивность:**
  - Hover → показать концепт
  - Click → детали узла
  - Drag → перемещать узлы
  - Zoom/Pan → навигация
- **Цвет узлов** - по важности (importance)
- **Размер узлов** - по количеству связей
- **Толщина рёбер** - по весу (weight)

### 2. Search Mode Toggle
- **Linear Search** - точный, простой
- **HNSW Search** - быстрый, approximate
- **One-click switching** между режимами
- **Enable/Disable HNSW** - прямо из UI
- **Rebuild index** - обновить HNSW

### 3. Live Search Demo
- **Search bar** - тестировать поиск
- **Real-time results** - с similarity scores
- **Search time** - показывает производительность
- **Highlight on graph** - подсвечивает результаты

### 4. Statistics Panel
- Total nodes & edges
- Average degree
- Current search mode
- HNSW status
- Last search time

### 5. HNSW Settings
- **M** - connections per layer (12-24)
- **efConstruction** - build accuracy (100-400)
- **efSearch** - search accuracy (50-200)
- **Sliders** - для удобной настройки
- **Apply changes** - применить параметры

### 6. Additional Features
- **Reset View** - вернуть zoom/pan
- **Refresh Graph** - обновить данные
- **Run Benchmark** - Linear vs HNSW

## 🎨 UI/UX

- **Dark theme** - удобно для глаз
- **Modern design** - чистый, профессиональный
- **Responsive** - работает на разных экранах
- **Minimal** - без лишнего, фокус на функциональности

## 🔧 Технологии

### Frontend:
- **HTML5** - semantic markup
- **CSS3** - modern styling
- **Vanilla JavaScript** - no framework overhead
- **D3.js v7** - graph visualization

### Backend:
- **Express.js** - minimal web server
- **Node.js** - ES modules
- **REST API** - 9 endpoints

## 📡 API Endpoints

```
GET  /api/graph          - Get knowledge graph
GET  /api/config         - Get search config
GET  /api/stats          - Get statistics
POST /api/search         - Run search query
POST /api/toggle-mode    - Switch Linear/HNSW
POST /api/enable-hnsw    - Enable HNSW mode
POST /api/disable-hnsw   - Disable HNSW mode
POST /api/rebuild        - Rebuild HNSW index
POST /api/benchmark      - Run benchmark
```

## 📁 Файлы

```
dashboard/
├── server.js        # Express server + API (~250 lines)
├── index.html       # Main page layout (~200 lines)
├── dashboard.js     # D3.js + controls (~700 lines)
├── styles.css       # Modern styling (~600 lines)
└── README.md        # This file
```

## 🎯 Использование

### Запуск:
```bash
npm run dashboard
```

### Доступ:
Открой браузер: **http://localhost:3000**

### Остановка:
`Ctrl+C` в терминале

## 🔍 Examples

### Example 1: Просмотр графа
1. Запусти dashboard
2. Граф загрузится автоматически
3. Hover над узлами → см. концепты
4. Click на узел → детали в модальном окне

### Example 2: Переключение режима
1. В правой панели: Search Mode
2. Выбери **HNSW** radio button
3. Если HNSW не активен → click "Enable HNSW"
4. Подожди 30-60s → HNSW активируется

### Example 3: Тестирование поиска
1. В Search bar введи: "python web framework"
2. Click "Search"
3. Результаты появятся ниже
4. Узлы подсветятся на графе

### Example 4: Benchmark
1. Убедись что HNSW активен
2. Click "Run Benchmark"
3. Подожди 30s
4. Результаты в терминале

## ⚙️ Конфигурация

### Порт сервера:
Изменить в `server.js`:
```javascript
const PORT = 3000; // Change to your preferred port
```

### HNSW параметры:
Настраиваются через UI (Settings panel) или напрямую в `meta/search-config.json`

## 🐛 Troubleshooting

### Проблема: Dashboard не запускается
**Решение:**
```bash
# Check if port 3000 is free
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <pid> /F

# Try again
npm run dashboard
```

### Проблема: Graph не отображается
**Решение:**
1. Проверь что `knowledge-graph.json` существует
2. Проверь что есть nodes в графе: `npm run stats`
3. Refresh page (F5)

### Проблема: HNSW не активируется
**Решение:**
1. Проверь размер графа: `npm run search:info`
2. Если <1000 nodes → HNSW не рекомендуется (но можно активировать)
3. Проверь логи в терминале

### Проблема: Search не работает
**Решение:**
1. Проверь GEMINI_API_KEY: `cat .env | grep GEMINI_API_KEY`
2. Проверь интернет соединение
3. Попробуй через CLI: `npm run query "test"`

## 🚀 Performance

### Первая загрузка:
- Graph render: ~1-2s (для 1000 nodes)
- API calls: ~100-300ms

### Взаимодействие:
- Hover/Click: <10ms
- Search: зависит от режима
  - Linear: 2-4s (1000 nodes)
  - HNSW: 0.01s (1000 nodes)
- Zoom/Pan: 60 FPS (smooth)

## 🎓 Tips

1. **Для больших графов (>1000 nodes):**
   - Активируй HNSW для быстрого поиска
   - Используй zoom для навигации
   - Hover только на нужных узлах (показывает label)

2. **Для малых графов (<100 nodes):**
   - Linear search достаточно быстрый
   - Можно видеть все узлы сразу
   - Labels всегда видны

3. **Search optimization:**
   - Используй конкретные запросы ("Django REST API" лучше чем "web")
   - Check search time → если >1s, активируй HNSW
   - Benchmark регулярно

4. **Graph exploration:**
   - Drag узлы для лучшей компоновки
   - Reset View если запутался
   - Click узлы для деталей (timestamp, confidence, episodes)

## 📊 Next Steps (v0.4.2+)

Планируемые улучшения:

### v0.4.2:
- [ ] **Benchmark visualization** - charts (Chart.js)
- [ ] **Graph filtering** - by date, topic, importance
- [ ] **Export graph** - as PNG/SVG
- [ ] **Temporal view** - graph evolution animation

### v0.5.0:
- [ ] **Contradiction highlighting** - red edges
- [ ] **Clustering visualization** - community detection
- [ ] **Multi-graph support** - switch between graphs
- [ ] **Real-time updates** - WebSocket connection

## 🙏 Credits

**Технологии:**
- [D3.js](https://d3js.org/) - Force-directed graph
- [Express.js](https://expressjs.com/) - Web server
- GitHub Dark Theme - Color palette

**Разработчик:**
- Claude Code (Sonnet 4.5)

---

**🧠 OpenClaw Memory Dashboard v0.4.1**
*Released: 12 апреля 2026*
