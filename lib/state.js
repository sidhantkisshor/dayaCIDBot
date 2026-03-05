// DayaCID Bot — Hybrid State Management (in-memory + optional Upstash KV)

import { KV_REST_API_URL, KV_REST_API_TOKEN, KV_WARNING_TTL, AUTO_DELETE_DELAY_MS } from './config.js';

// ── In-memory state (fast cache, resets on cold start) ──
export const userWarnings = new Map();
export const userMessageTimes = new Map();
export const trustedUsers = new Set();
export const pendingVerifications = new Map();
export const newMembers = new Map();   // Map<userKey, joinTimestamp>
const autoDeleteQueue = [];            // Array<{ chatId, messageId, deleteAfter }>

// ── Upstash KV helpers (zero-dependency, raw fetch) ──

const kvEnabled = () => Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

async function kvGet(key) {
  if (!kvEnabled()) return null;
  try {
    const resp = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const data = await resp.json();
    return data.result;
  } catch {
    return null;
  }
}

async function kvSet(key, value, exSeconds = 0) {
  if (!kvEnabled()) return;
  try {
    const url = exSeconds
      ? `${KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${exSeconds}`
      : `${KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    await fetch(url, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
  } catch {
    // Fail silently — in-memory still works
  }
}

async function kvDel(key) {
  if (!kvEnabled()) return;
  try {
    await fetch(`${KV_REST_API_URL}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
  } catch {
    // Fail silently
  }
}

// ── Warnings (hybrid: in-memory + KV with 7-day TTL) ──

export async function getWarnings(chatId, userId) {
  const key = `${chatId}_${userId}`;
  if (userWarnings.has(key)) return userWarnings.get(key);
  const count = await kvGet(`warn:${key}`);
  const parsed = count ? parseInt(count, 10) : 0;
  userWarnings.set(key, parsed);
  return parsed;
}

export async function setWarnings(chatId, userId, count) {
  const key = `${chatId}_${userId}`;
  userWarnings.set(key, count);
  await kvSet(`warn:${key}`, count, KV_WARNING_TTL);
}

export async function deleteWarnings(chatId, userId) {
  const key = `${chatId}_${userId}`;
  userWarnings.delete(key);
  await kvDel(`warn:${key}`);
}

// ── Trusted users (hybrid: in-memory + KV, no TTL) ──

export async function isTrusted(chatId, userId) {
  const key = `${chatId}_${userId}`;
  if (trustedUsers.has(key)) return true;
  const val = await kvGet(`trust:${key}`);
  if (val === '1') {
    trustedUsers.add(key); // Cache locally
    return true;
  }
  return false;
}

export async function setTrusted(chatId, userId, trusted) {
  const key = `${chatId}_${userId}`;
  if (trusted) {
    trustedUsers.add(key);
    await kvSet(`trust:${key}`, '1');
  } else {
    trustedUsers.delete(key);
    await kvDel(`trust:${key}`);
  }
}

// ── Stats counters (KV only — in-memory not useful for stats) ──

export async function incrementStat(chatId, stat) {
  if (!kvEnabled()) return;
  try {
    await fetch(`${KV_REST_API_URL}/incr/${encodeURIComponent(`stat:${chatId}:${stat}`)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
  } catch {
    // Fail silently
  }
  // Also increment daily counter (fire-and-forget)
  incrementDailyStat(chatId, stat).catch(() => {});
}

export async function getStats(chatId) {
  const keys = ['deleted', 'banned', 'warned', 'muted', 'captchaPassed', 'captchaFailed'];
  if (!kvEnabled()) {
    return Object.fromEntries(keys.map(k => [k, 0]));
  }
  const commands = keys.map(k => ['GET', `stat:${chatId}:${k}`]);
  const pipeResult = await kvPipeline(commands);
  const results = {};
  for (let i = 0; i < keys.length; i++) {
    const val = pipeResult?.[i]?.result;
    results[keys[i]] = val ? parseInt(val, 10) : 0;
  }
  return results;
}

// ── User reports (in-memory only — tracks who reported whom) ──

const userReports = new Map(); // Map<`${chatId}_${userId}`, Set<reporterUserId>>

export function addReport(chatId, userId, reporterUserId) {
  const key = `${chatId}_${userId}`;
  if (!userReports.has(key)) {
    userReports.set(key, new Set());
  }
  userReports.get(key).add(reporterUserId);
  return userReports.get(key).size;
}

export function getReportCount(chatId, userId) {
  const key = `${chatId}_${userId}`;
  return userReports.has(key) ? userReports.get(key).size : 0;
}

export function clearReports(chatId, userId) {
  const key = `${chatId}_${userId}`;
  userReports.delete(key);
}

// ── Message times (in-memory only — not worth persisting) ──

export function recordMessageTime(chatId, userId) {
  const key = `${chatId}_${userId}`;
  if (!userMessageTimes.has(key)) {
    userMessageTimes.set(key, []);
  }
  userMessageTimes.get(key).push(Date.now());
}

export function getMessageTimes(chatId, userId) {
  const key = `${chatId}_${userId}`;
  return userMessageTimes.get(key) || [];
}

export function pruneMessageTimes(chatId, userId, windowMs) {
  const key = `${chatId}_${userId}`;
  const now = Date.now();
  const times = (userMessageTimes.get(key) || []).filter(t => now - t < windowMs);
  userMessageTimes.set(key, times);
  return times;
}

// ── New member tracking (in-memory — 30 min window) ──

export function isNewMember(chatId, userId) {
  const key = `${chatId}_${userId}`;
  const joinTime = newMembers.get(key);
  if (!joinTime) return false;
  if (Date.now() - joinTime < 30 * 60 * 1000) return true;
  newMembers.delete(key);
  return false;
}

export function addNewMember(chatId, userId) {
  newMembers.set(`${chatId}_${userId}`, Date.now());
}

export function removeNewMember(chatId, userId) {
  newMembers.delete(`${chatId}_${userId}`);
}

// ── Activity Log (KV — ring buffer using Redis list, max 200 entries, 7-day TTL) ──

async function kvPipeline(commands) {
  if (!kvEnabled()) return null;
  try {
    const resp = await fetch(`${KV_REST_API_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    });
    return await resp.json();
  } catch {
    return null;
  }
}

export async function appendActivity(entry) {
  if (!kvEnabled()) return;
  try {
    const item = JSON.stringify({
      action: entry.action,
      chatId: entry.chatId,
      userId: entry.userId,
      username: entry.username,
      details: entry.details,
      timestamp: entry.timestamp || Date.now()
    });
    // Atomic: LPUSH + LTRIM + EXPIRE in a single pipeline
    await kvPipeline([
      ['LPUSH', 'activity:log', item],
      ['LTRIM', 'activity:log', '0', '199'],
      ['EXPIRE', 'activity:log', '604800']
    ]);
  } catch {
    // Fail silently
  }
}

export async function getActivity(limit = 50) {
  if (!kvEnabled()) return [];
  try {
    // LRANGE returns newest-first (since we LPUSH)
    const resp = await fetch(`${KV_REST_API_URL}/lrange/activity:log/0/${limit - 1}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const data = await resp.json();
    if (!data.result || !Array.isArray(data.result)) return [];
    return data.result.map(item => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Daily Stats (KV — per-chat per-day counters, 30-day TTL) ──

export async function incrementDailyStat(chatId, stat) {
  if (!kvEnabled()) return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `stat:${chatId}:daily:${today}:${stat}`;
  try {
    // Atomic: INCR + EXPIRE in a single pipeline
    await kvPipeline([
      ['INCR', key],
      ['EXPIRE', key, '2592000']
    ]);
  } catch {
    // Fail silently
  }
}

export async function getDailyStats(chatId, days = 7) {
  if (!kvEnabled()) return [];
  const statNames = ['deleted', 'banned', 'muted', 'captchaPassed', 'captchaFailed'];
  const dates = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  // Build MGET commands for all keys at once (days * stats per pipeline)
  const keys = [];
  for (const date of dates) {
    for (const stat of statNames) {
      keys.push(`stat:${chatId}:daily:${date}:${stat}`);
    }
  }
  const commands = keys.map(k => ['GET', k]);
  const pipeResult = await kvPipeline(commands);
  // Parse pipeline results: array of [{result: "value"}, ...]
  const values = (pipeResult || []).map(r => {
    const val = r?.result;
    return val ? parseInt(val, 10) : 0;
  });
  const results = [];
  let idx = 0;
  for (const date of dates) {
    const stats = { date };
    for (const stat of statNames) {
      stats[stat] = values[idx++] || 0;
    }
    results.push(stats);
  }
  return results;
}

// ── Active Chats Registry (KV — tracks all chats the bot is active in) ──

export async function registerActiveChat(chatId, chatTitle) {
  if (!kvEnabled()) return;
  try {
    const raw = await kvGet('chats:active');
    let chats = {};
    if (raw) {
      try { chats = JSON.parse(raw); } catch { chats = {}; }
    }
    // Only write if chatId not already present
    if (chats[chatId]) return;
    chats[chatId] = { title: chatTitle, firstSeen: Date.now() };
    await kvSet('chats:active', JSON.stringify(chats));
  } catch {
    // Fail silently
  }
}

export async function getActiveChats() {
  if (!kvEnabled()) return {};
  try {
    const raw = await kvGet('chats:active');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Auto-Delete Queue (lazy cleanup — replaces setTimeout which doesn't work on Vercel) ──

export function scheduleAutoDelete(chatId, messageId) {
  autoDeleteQueue.push({ chatId, messageId, deleteAfter: Date.now() + AUTO_DELETE_DELAY_MS });
}

export async function processAutoDeletes(deleteMessageFn) {
  const now = Date.now();
  const ready = [];
  // Drain ready items from the front of the queue
  while (autoDeleteQueue.length > 0 && autoDeleteQueue[0].deleteAfter <= now) {
    ready.push(autoDeleteQueue.shift());
  }
  for (const { chatId, messageId } of ready) {
    await deleteMessageFn(chatId, messageId);
  }
}

// ── Dashboard Config Overrides (KV — runtime configuration) ──

export async function getConfigOverrides() {
  if (!kvEnabled()) return {};
  try {
    const raw = await kvGet('dashboard:config');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setConfigOverride(key, value) {
  if (!kvEnabled()) return;
  try {
    const raw = await kvGet('dashboard:config');
    let config = {};
    if (raw) {
      try { config = JSON.parse(raw); } catch { config = {}; }
    }
    config[key] = value;
    await kvSet('dashboard:config', JSON.stringify(config));
  } catch {
    // Fail silently
  }
}
