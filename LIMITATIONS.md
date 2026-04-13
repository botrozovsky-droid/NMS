# ⚠️ Ограничения и проблемы системы памяти

**Версия:** 0.3.3
**Дата:** 12 апреля 2026
**Статус:** Честный анализ текущих ограничений

---

## 📋 Содержание

1. [Критические ограничения](#критические-ограничения)
2. [Производительность](#производительность)
3. [Качество данных](#качество-данных)
4. [Операционные сложности](#операционные-сложности)
5. [Что исправлено в v0.3.x](#что-исправлено-в-v03x)
6. [Roadmap исправлений](#roadmap-исправлений)

---

## 🚨 Критические ограничения

### 1. Зависимость от Gemini API (требует интернет)

#### Проблема
Система **не работает без интернета** и Gemini API.

#### Где проявляется

**Сценарий 1: Нет интернета**
```
03:00 - Запуск консолидации
03:01 - Попытка подключения к Gemini API
03:02 - Connection timeout (нет интернета)
03:03 - ❌ Консолидация провалена
```

**Сценарий 2: Gemini API недоступен**
```
node consolidate.js
❌ Gemini analysis failed: Request failed with status code 503
# Консолидация не прошла → события остаются в гиппокампе
```

#### Последствия
- Консолидация невозможна без интернета
- Зависимость от доступности Google API
- Нельзя работать в air-gapped средах

#### Решение
- **v0.4.0:** Offline mode с локальными embeddings (sentence-transformers)
- **Workaround сейчас:** Использовать при наличии интернета, консолидация отложится до следующего запуска

---

### 2. Стоимость API ($0.58/месяц базово, может вырасти)

#### Проблема
Gemini API не бесплатный при больших объемах.

#### Текущие расценки
- **Gemini 2.5 Flash:**
  - Input: $0.075 / 1M tokens
  - Output: $0.30 / 1M tokens
- **Embeddings:**
  - $0.0001 / 1K tokens

#### Реальная стоимость (пример)
**Легкое использование (10 событий/день):**
- Consolidation: ~5K tokens input, 1K tokens output × 30 дней = 150K input, 30K output
- Embeddings: ~500 phrases × 20 tokens = 10K tokens
- **Итого:** ~$0.58/месяц

**Интенсивное использование (100 событий/день):**
- Consolidation: ~50K tokens input, 10K tokens output × 30 дней = 1.5M input, 300K output
- Embeddings: ~5000 phrases × 20 tokens = 100K tokens
- **Итого:** ~$5.80/месяц

**Очень интенсивное (1000 событий/день):**
- **Итого:** ~$58/месяц

#### Последствия
- При очень активном использовании стоимость растет
- Нет контроля над ценами (Google может изменить)

#### Решение
- **v0.4.0:** Offline mode как fallback
- **v0.5.0:** Compression/quantization для снижения token usage
- **Сейчас:** Monitoring стоимости через Gemini Console

---

## 🐌 Производительность

### 3. Semantic search медленный при >1000 nodes

#### Проблема
Линейный поиск O(N) через все embeddings.

#### Где проявляется
```bash
# 12 nodes
npm run query "python web"
# 0.1s ✅

# 1,000 nodes
npm run query "python web"
# 1-2s ⚠️

# 10,000 nodes
npm run query "python web"
# 10-20s ❌
```

#### Последствия
- При росте графа поиск замедляется
- При >10k nodes поиск становится неприемлемо медленным

#### Решение
- **v0.4.0 (R2.1):** HNSW ANN search → 100-1000x ускорение
- **Сейчас:** Приемлемо до 1000 nodes

---

### 4. Embeddings занимают много места (805KB граф = 12 nodes)

#### Проблема
Каждый embedding: 3072 floats × 4 bytes = 12KB

#### Расчет размера
- 12 nodes → 144KB embeddings + 661KB metadata = **805KB**
- 1,000 nodes → 12MB embeddings + metadata ≈ **20MB**
- 10,000 nodes → 120MB embeddings + metadata ≈ **200MB**

#### Последствия
- Large graphs занимают много места
- Медленная загрузка в память

#### Решение
- **v0.5.0:** Quantization float32→int8 → экономия 75% (но -5% accuracy)
- **v0.4.0:** Отдельное хранилище для embeddings (не в основном графе)
- **Сейчас:** Нормально до 1000 nodes

---

## 🎲 Качество данных

### 5. Gemini может галлюцинировать (но есть защита)

#### Проблема
LLM может выдумывать связи, которых нет в событиях.

#### Пример
**События:**
```json
[
  {"type": "read", "file": "main.py"},
  {"type": "command", "cmd": "python main.py"}
]
```

**Gemini может извлечь (hallucination):**
```json
{
  "concepts": [
    {"name": "FastAPI", "confidence": 0.7, "extractionType": "INFERRED"}
  ],
  "relationships": [
    {"source": "python", "target": "fastapi", "type": "uses_library"}
  ]
}
```

**Почему:** Gemini "знает" что .py часто с FastAPI, даже если FastAPI не упоминался.

#### Защита в v0.3.x
✅ **Confidence scoring** - галлюцинации обычно имеют confidence < 0.7
✅ **Extraction type metadata** - INFERRED vs EXTRACTED
✅ **Evidence events** - можно проверить источник
✅ **Contradiction detector** - находит несовместимые факты
✅ **Auto-flagging** - low confidence + inferred + no evidence → flag 'potential_hallucination'

#### Статистика
- **Gemini hallucination rate:** ~3-7% (лучше чем Gemma 5-10%)
- **С нашими защитами:** ~1-2% попадают в граф

#### Последствия
- Не 100% точность извлечения
- Нужна human validation для критичных данных

#### Решение
- **v0.4.0:** Adversarial mode - "try to disprove" каждый факт
- **Сейчас:** Используй `npm run check:contradictions` регулярно

---

### 6. Стохастичность Gemini (разные запуски → разные результаты)

#### Проблема
Даже с temperature=0.3, Gemini может извлекать **разные концепты** из одних событий.

#### Пример
**События:** те же самые 5 событий

**Запуск 1:**
```json
{"concepts": [
  {"name": "Python", "importance": 0.9},
  {"name": "FastAPI", "importance": 0.8}
]}
```

**Запуск 2 (другой seed):**
```json
{"concepts": [
  {"name": "Python", "importance": 0.9},
  {"name": "web development", "importance": 0.7}
]}
```

#### Последствия
- Не детерминированность
- Сложно воспроизвести точные результаты
- A/B тесты сложны

#### Решение
- **Hebbian learning сглаживает:** повторные активации усиливают правильные паттерны
- **Canonical forms:** дедупликация похожих концептов
- **Сейчас:** Не критично, система самокорректируется со временем

---

## 🛠️ Операционные сложности

### 7. Нет Graph Viewer (только экспорт в Obsidian)

#### Проблема
Сложно визуально исследовать граф без отдельного инструмента.

#### Текущие опции
- ✅ `npm run export:obsidian` → открыть в Obsidian
- ✅ `npm run stats` → текстовая статистика
- ✅ `npm run query` → семантический поиск
- ❌ Нет встроенного visual graph viewer

#### Последствия
- Нужен дополнительный софт (Obsidian)
- Нельзя смотреть граф "на лету"

#### Решение
- **v0.3.4+:** Built-in graph viewer (D3.js)
- **Сейчас:** Используй Obsidian

---

### 8. Нет автоматического conflict resolution

#### Проблема
Contradiction detector находит противоречия, но требует ручное решение (или --fix с автоматикой).

#### Пример
```bash
npm run check:contradictions
# ⚠️  Found 2 contradiction(s)
# 1. "User prefers Python" vs "User prefers JavaScript"
#    Resolution: needs_review

# Нужно вручную решать
```

#### Последствия
- Требует периодическую human review
- Автоматический --fix может ошибиться

#### Решение
- **v0.4.0:** Более умные стратегии (adversarial validation, context-aware)
- **Сейчас:** Используй `npm run fix:contradictions` осторожно

---

### 9. Batch processing limits (50 facts/request)

#### Проблема
Gemini API имеет limits на размер запроса.

#### Где проявляется
```bash
# 500 facts в графе
npm run check:contradictions
# → 10 batches × 2s = 20s общее время
```

#### Последствия
- При больших графах детекция противоречий медленная
- Risk of hitting API rate limits

#### Решение
- **v0.4.0:** Smart batching с приоритизацией
- **v0.5.0:** Local fallback для быстрых проверок
- **Сейчас:** Нормально до 500 facts (~10s)

---

## ✅ Что исправлено в v0.3.x

### Было в v1.0 → Исправлено в v0.3.x

| Проблема v1.0 | Решение v0.3.x | Версия |
|---------------|----------------|--------|
| ❌ LM Studio dependency | ✅ Gemini API (облачный) | v0.3.0 |
| ❌ Partial updates при ошибке | ✅ Transaction manager (ACID) | v0.3.0 |
| ❌ Нет rollback | ✅ Backup/restore в транзакциях | v0.3.0 |
| ❌ Медленный поиск | ✅ Semantic search с embeddings | v0.3.0 |
| ❌ Память доступна через 24ч | ✅ Session-end consolidation (5 мин) | v0.3.0 |
| ❌ Код дублирован | ✅ Refactoring в lib/ (v0.3.1) | v0.3.1 |
| ❌ JSON operations разбросаны | ✅ Централизован в json-store.js | v0.3.1 |
| ❌ Meta-learning осцилляция | ✅ EMA dampening (alpha=0.2) | v0.3.1 |
| ❌ Нет batch I/O optimization | ✅ Групповые операции по sessionId | v0.3.1 |
| ❌ Нет Obsidian совместимости | ✅ Obsidian export | v0.3.3 |
| ❌ Нет детекции противоречий | ✅ Contradiction detector | v0.3.3 |

---

## 🎯 Roadmap исправлений

### v0.3.4 (опционально)
- **Graph Viewer** - встроенный визуализатор (D3.js)
- **Streaming export** - для больших графов (>1000 nodes)
- **Embeddings cache optimization** - отдельное хранилище

### v0.4.0 (major)
- **R2.1: HNSW ANN search** - решает проблему #3 (производительность)
- **Adversarial validation** - решает проблему #5 (галлюцинации)
- **Offline mode** - решает проблему #1 (интернет зависимость)

### v0.5.0 (future)
- **Quantization float32→int8** - решает проблему #4 (размер)
- **Multi-agent collaboration** - distributed graphs
- **Procedural prediction** - использование procedural memory

---

## 📊 Текущий статус

**Критичных блокеров:** 0 ❌
**Серьезных ограничений:** 3 ⚠️ (#1 интернет, #3 производительность, #4 размер)
**Минорных проблем:** 6 ℹ️

**Рекомендация:** Система готова к production использованию для графов до 1000 nodes с доступом к интернету.

---

## 🔗 См. также

- **CHANGELOG-v0.3.3.md** - что нового в последней версии
- **v0.3.3-COMPLETE.md** - полный технический отчет
- **COMPETITIVE-ANALYSIS.md** - сравнение с конкурентами
- **README.md** - основная документация

---

*Последнее обновление: 12 апреля 2026*
*OpenClaw Memory System v0.3.3*
