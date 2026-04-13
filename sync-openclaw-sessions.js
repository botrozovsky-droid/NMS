#!/usr/bin/env node
/**
 * Sync OpenClaw Sessions to NMS
 *
 * Копирует сессии из OpenClaw в NMS hippocampus для консолидации
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Пути
const OPENCLAW_SESSIONS = path.join(dirname(__dirname), 'agents', 'main', 'sessions');
const NMS_SESSIONS = path.join(__dirname, 'hippocampus', 'sessions');
const NMS_CANDIDATES = path.join(__dirname, 'hippocampus', 'synaptic-candidates.json');
const SYNC_STATE_FILE = path.join(__dirname, 'meta', 'openclaw-sync-state.json');

/**
 * Загрузить состояние синхронизации
 */
async function loadSyncState() {
  try {
    const data = await fs.readFile(SYNC_STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { lastSync: 0, syncedSessions: [] };
  }
}

/**
 * Сохранить состояние синхронизации
 */
async function saveSyncState(state) {
  await fs.mkdir(path.dirname(SYNC_STATE_FILE), { recursive: true });
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Конвертировать OpenClaw JSONL в NMS формат
 */
async function convertOpenClawSession(sessionFile, sessionKey) {
  const lines = (await fs.readFile(sessionFile, 'utf-8')).trim().split('\n');
  const episodes = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Обработать сообщения
      if (entry.type === 'message' && entry.message) {
        const msg = entry.message;
        const role = msg.role;

        if (role === 'user' || role === 'assistant') {
          const content = Array.isArray(msg.content)
            ? msg.content.find(c => c.type === 'text')?.text || JSON.stringify(msg.content)
            : msg.content || '';

          episodes.push({
            episodeId: `openclaw-${entry.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: entry.timestamp || new Date().toISOString(),
            content,
            role,
            metadata: {
              source: 'openclaw',
              sessionKey,
              messageId: msg.id || entry.id,
              type: 'conversation'
            },
            type: 'conversation',
            confidence: 0.9
          });
        }
      }

      // Обработать tool calls
      if (entry.type === 'tool_call' && entry.tool_call) {
        episodes.push({
          episodeId: `openclaw-tool-${entry.id || Date.now()}`,
          timestamp: entry.timestamp || new Date().toISOString(),
          content: `Tool: ${entry.tool_call.name}\nInput: ${JSON.stringify(entry.tool_call.input || {})}`,
          role: 'tool',
          metadata: {
            source: 'openclaw',
            sessionKey,
            toolName: entry.tool_call.name,
            type: 'tool_call'
          },
          type: 'tool_call',
          confidence: 0.9
        });
      }

    } catch (error) {
      console.warn(`⚠️  Пропущена строка из-за ошибки: ${error.message}`);
    }
  }

  return episodes;
}

/**
 * Добавить в очередь консолидации
 */
async function queueForConsolidation(episodes, sessionId) {
  let candidates = {
    version: '1.0.0',
    candidates: [],
    consolidationQueue: [],
    statistics: {
      totalCandidates: 0,
      consolidatedCount: 0,
      rejectedCount: 0
    }
  };

  try {
    const data = await fs.readFile(NMS_CANDIDATES, 'utf-8');
    candidates = JSON.parse(data);
  } catch {
    // Файл не существует
  }

  for (const episode of episodes) {
    candidates.candidates.push({
      episodeId: episode.episodeId,
      sessionId,
      timestamp: new Date(episode.timestamp).getTime(),
      importance: 6, // Средняя важность для OpenClaw сессий
      addedToQueue: Date.now()
    });
  }

  candidates.statistics.totalCandidates += episodes.length;
  candidates.lastConsolidation = new Date().toISOString();

  await fs.writeFile(NMS_CANDIDATES, JSON.stringify(candidates, null, 2));
}

/**
 * Главная функция синхронизации
 */
async function sync() {
  console.log('🔄 Синхронизация OpenClaw → NMS\n');

  const state = await loadSyncState();
  const now = Date.now();

  // Найти все JSONL файлы в OpenClaw sessions
  let files;
  try {
    files = await fs.readdir(OPENCLAW_SESSIONS);
  } catch (error) {
    console.error(`❌ Не найдена директория OpenClaw sessions: ${OPENCLAW_SESSIONS}`);
    console.log('   Убедитесь что OpenClaw установлен и работал');
    process.exit(1);
  }

  const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.reset.'));
  console.log(`📁 Найдено ${jsonlFiles.length} сессий в OpenClaw`);

  let syncedCount = 0;
  let skippedCount = 0;
  let totalEpisodes = 0;

  for (const file of jsonlFiles) {
    const sessionKey = file.replace('.jsonl', '');

    // Пропустить уже синхронизированные
    if (state.syncedSessions.includes(sessionKey)) {
      skippedCount++;
      continue;
    }

    const sessionPath = path.join(OPENCLAW_SESSIONS, file);
    const stats = await fs.stat(sessionPath);

    // Пропустить пустые файлы
    if (stats.size === 0) {
      console.log(`   ⏭️  ${file}: пустой файл`);
      continue;
    }

    console.log(`   📥 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);

    // Конвертировать сессию
    const episodes = await convertOpenClawSession(sessionPath, sessionKey);

    if (episodes.length === 0) {
      console.log(`      ⚠️  Нет эпизодов для импорта`);
      continue;
    }

    // Создать NMS сессию
    const nmsSessionId = `openclaw-${sessionKey}-${now}`;
    const nmsSession = {
      sessionId: nmsSessionId,
      startTime: new Date(stats.birthtime).toISOString(),
      endTime: new Date(stats.mtime).toISOString(),
      type: 'openclaw',
      source: 'openclaw-sync',
      originalSessionKey: sessionKey,
      episodes
    };

    // Сохранить в NMS hippocampus
    await fs.mkdir(NMS_SESSIONS, { recursive: true });
    const nmsPath = path.join(NMS_SESSIONS, `${nmsSessionId}.json`);
    await fs.writeFile(nmsPath, JSON.stringify(nmsSession, null, 2));

    // Добавить в очередь консолидации
    await queueForConsolidation(episodes, nmsSessionId);

    console.log(`      ✅ ${episodes.length} эпизодов → NMS`);

    // Обновить состояние
    state.syncedSessions.push(sessionKey);
    totalEpisodes += episodes.length;
    syncedCount++;
  }

  state.lastSync = now;
  await saveSyncState(state);

  console.log(`\n✅ Синхронизация завершена:`);
  console.log(`   📊 Синхронизировано: ${syncedCount} сессий`);
  console.log(`   📝 Всего эпизодов: ${totalEpisodes}`);
  console.log(`   ⏭️  Пропущено: ${skippedCount} (уже были)`);

  if (totalEpisodes > 0) {
    console.log(`\n💡 Запустите консолидацию:`);
    console.log(`   cd C:\\Users\\Vlad\\.openclaw\\memory`);
    console.log(`   npm run consolidate`);
  }
}

sync().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});
