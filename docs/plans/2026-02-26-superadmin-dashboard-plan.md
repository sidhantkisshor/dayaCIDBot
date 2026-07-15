# Superadmin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-featured superadmin dashboard with live monitoring, historical stats, activity feed, and management controls for the DayaCID Telegram anti-spam bot.

**Architecture:** Single vanilla HTML page (`public/dashboard.html`) + 4 new API routes (`api/dashboard/*.js`), secured with a `DASHBOARD_SECRET` env var. Data sourced from Upstash KV (stats, activity log) and live Telegram API (health). Zero npm dependencies maintained.

**Tech Stack:** Vanilla HTML/CSS/JS, Chart.js via CDN, Upstash KV REST API, Vercel serverless functions.

**Note:** This project has no test suite, linter, or build step. Testing is manual via `vercel dev`. Each task ends with a commit.

---

### Task 1: Dashboard Auth Middleware

**Files:**
- Create: `lib/dashboardAuth.js`

**Step 1: Create the auth middleware**

```js
// lib/dashboardAuth.js
// Dashboard authentication — validates DASHBOARD_SECRET Bearer token

export function validateDashboardAuth(req) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return { ok: false, error: 'DASHBOARD_SECRET not configured', status: 503 };

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing authorization header', status: 401 };
  }

  const token = auth.slice(7);
  if (token !== secret) {
    return { ok: false, error: 'Invalid token', status: 403 };
  }

  return { ok: true };
}

// Helper: wrap handler with auth check, returns JSON error if invalid
export function withAuth(handlerFn) {
  return async (req, res) => {
    // CORS for dashboard
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const auth = validateDashboardAuth(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    return handlerFn(req, res);
  };
}
```

**Step 2: Commit**

```bash
git add lib/dashboardAuth.js
git commit -m "feat: add dashboard auth middleware with Bearer token validation"
```

---

### Task 2: Activity Log & Daily Stats in State Module

**Files:**
- Modify: `lib/state.js` (add `appendActivity`, `getActivity`, `incrementDailyStat`, `getDailyStats`, `registerActiveChat`, `getActiveChats`, `getConfigOverrides`, `setConfigOverride`)

**Step 1: Add new KV helpers to `lib/state.js`**

Append the following exports to the bottom of `lib/state.js`:

```js
// ── Activity log (KV ring buffer — last 200 entries, 7-day TTL) ──

export async function appendActivity(entry) {
  if (!kvEnabled()) return;
  try {
    // entry: { action, chatId, userId, username, details, timestamp }
    entry.timestamp = entry.timestamp || Date.now();
    const raw = await kvGet('activity:log');
    const log = raw ? JSON.parse(raw) : [];
    log.unshift(entry); // newest first
    if (log.length > 200) log.length = 200;
    await kvSet('activity:log', JSON.stringify(log), 604800); // 7 days
  } catch {
    // Fail silently
  }
}

export async function getActivity(limit = 50) {
  if (!kvEnabled()) return [];
  try {
    const raw = await kvGet('activity:log');
    const log = raw ? JSON.parse(raw) : [];
    return log.slice(0, limit);
  } catch {
    return [];
  }
}

// ── Daily stats (KV counters with 30-day TTL) ──

export async function incrementDailyStat(chatId, stat) {
  if (!kvEnabled()) return;
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `stat:${chatId}:daily:${date}:${stat}`;
  try {
    await fetch(`${KV_REST_API_URL}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    // Set TTL on first increment (30 days)
    await fetch(`${KV_REST_API_URL}/expire/${encodeURIComponent(key)}/2592000`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
  } catch {
    // Fail silently
  }
}

export async function getDailyStats(chatId, days = 7) {
  if (!kvEnabled()) return [];
  const results = [];
  const stats = ['deleted', 'banned', 'muted', 'captchaPassed', 'captchaFailed'];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dayStat = { date };
    for (const stat of stats) {
      const val = await kvGet(`stat:${chatId}:daily:${date}:${stat}`);
      dayStat[stat] = val ? parseInt(val, 10) : 0;
    }
    results.push(dayStat);
  }
  return results.reverse(); // oldest first for charts
}

// ── Active chats registry (KV set, no TTL) ──

export async function registerActiveChat(chatId, chatTitle) {
  if (!kvEnabled()) return;
  try {
    const raw = await kvGet('chats:active');
    const chats = raw ? JSON.parse(raw) : {};
    if (!chats[chatId]) {
      chats[chatId] = { title: chatTitle || `Chat ${chatId}`, firstSeen: Date.now() };
      await kvSet('chats:active', JSON.stringify(chats));
    }
  } catch {
    // Fail silently
  }
}

export async function getActiveChats() {
  if (!kvEnabled()) return {};
  try {
    const raw = await kvGet('chats:active');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ── Runtime config overrides (KV, no TTL) ──

export async function getConfigOverrides() {
  if (!kvEnabled()) return {};
  try {
    const raw = await kvGet('dashboard:config');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setConfigOverride(key, value) {
  if (!kvEnabled()) return;
  try {
    const raw = await kvGet('dashboard:config');
    const config = raw ? JSON.parse(raw) : {};
    config[key] = value;
    await kvSet('dashboard:config', JSON.stringify(config));
  } catch {
    // Fail silently
  }
}
```

**Step 2: Commit**

```bash
git add lib/state.js
git commit -m "feat: add activity log, daily stats, active chats, and config overrides to state"
```

---

### Task 3: Wire Activity Logging Into Existing Code

**Files:**
- Modify: `lib/telegram.js` (line 196-206, `logToAdmin` function)
- Modify: `api/webhook.js` (add `registerActiveChat` call, add `incrementDailyStat` calls)
- Modify: `lib/state.js` (`incrementStat` — also increment daily)

**Step 1: Update `logToAdmin()` in `lib/telegram.js` to also write to KV activity log**

Add import at top of `lib/telegram.js`:
```js
import { appendActivity } from './state.js';
```

Replace the `logToAdmin` function (lines 196-206):
```js
export function logToAdmin(action, chatId, userId, username, details) {
  const { ADMIN_CHANNEL_ID } = process.env;
  // Write to KV activity log (fire-and-forget)
  appendActivity({ action, chatId, userId, username, details }).catch(() => {});

  if (!ADMIN_CHANNEL_ID) return;
  const text =
    `<b>[${action}]</b>\n` +
    `User: ${username} (<code>${userId}</code>)\n` +
    `Chat: <code>${chatId}</code>\n` +
    `${details}`;
  sendMessage(ADMIN_CHANNEL_ID, text, false).catch(() => {});
}
```

**Step 2: Update `incrementStat()` in `lib/state.js` to also increment daily**

Replace the `incrementStat` function (lines 103-112):
```js
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
```

**Step 3: Add `registerActiveChat` call in `api/webhook.js`**

Add `registerActiveChat` to the imports from `../lib/state.js` (line 9). Then add this at the start of the `handleMessage` function (after line 61, after `const isForwarded` declaration):

```js
  // Register this chat for dashboard tracking
  registerActiveChat(chatId, message.chat.title).catch(() => {});
```

**Step 4: Commit**

```bash
git add lib/telegram.js lib/state.js api/webhook.js
git commit -m "feat: wire activity logging and daily stats into existing bot flow"
```

---

### Task 4: Dashboard Health API Route

**Files:**
- Create: `api/dashboard/health.js`

**Step 1: Create the health endpoint**

```js
// api/dashboard/health.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { TOKEN, KV_REST_API_URL } from '../../lib/config.js';
import { getActiveChats } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  let botInfo = null;
  let webhookInfo = null;
  let kvStatus = 'unknown';

  try {
    const [botResp, webhookResp] = await Promise.all([
      fetch(`https://api.telegram.org/bot${TOKEN}/getMe`),
      fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
    ]);
    botInfo = await botResp.json();
    webhookInfo = await webhookResp.json();
  } catch {
    // Handled below
  }

  // Test KV connectivity
  if (KV_REST_API_URL) {
    try {
      const resp = await fetch(`${KV_REST_API_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN}` }
      });
      const data = await resp.json();
      kvStatus = data.result === 'PONG' ? 'connected' : 'error';
    } catch {
      kvStatus = 'error';
    }
  } else {
    kvStatus = 'not_configured';
  }

  const webhook = webhookInfo?.result;
  const activeChats = await getActiveChats();

  return res.status(200).json({
    bot: {
      status: botInfo?.ok ? 'online' : 'offline',
      info: botInfo?.result || null,
    },
    webhook: {
      url: webhook?.url || null,
      pendingUpdates: webhook?.pending_update_count || 0,
      lastError: webhook?.last_error_message || null,
      lastErrorDate: webhook?.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : null,
    },
    kv: { status: kvStatus },
    activeChats: Object.keys(activeChats).length,
    activeChatList: activeChats,
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasKV: !!KV_REST_API_URL,
      hasAdminChannel: !!process.env.ADMIN_CHANNEL_ID,
      hasDashboardSecret: !!process.env.DASHBOARD_SECRET,
    },
    timestamp: new Date().toISOString(),
  });
});
```

**Step 2: Commit**

```bash
git add api/dashboard/health.js
git commit -m "feat: add dashboard health API route"
```

---

### Task 5: Dashboard Stats API Route

**Files:**
- Create: `api/dashboard/stats.js`

**Step 1: Create the stats endpoint**

```js
// api/dashboard/stats.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { getStats, getDailyStats, getActiveChats } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  const activeChats = await getActiveChats();
  const chatIds = Object.keys(activeChats);

  // Aggregate stats across all chats
  const totals = { deleted: 0, banned: 0, muted: 0, warned: 0, captchaPassed: 0, captchaFailed: 0 };
  const perChat = {};

  for (const chatId of chatIds) {
    const stats = await getStats(chatId);
    perChat[chatId] = {
      title: activeChats[chatId]?.title || `Chat ${chatId}`,
      ...stats,
    };
    for (const key of Object.keys(totals)) {
      totals[key] += stats[key] || 0;
    }
  }

  // Daily trends (aggregate across all chats, last 7 days)
  const dailyTotals = [];
  if (chatIds.length > 0) {
    // Get daily stats for each chat and merge
    const allDaily = await Promise.all(chatIds.map(id => getDailyStats(id, 7)));
    // Merge by date
    const dateMap = {};
    for (const chatDaily of allDaily) {
      for (const day of chatDaily) {
        if (!dateMap[day.date]) {
          dateMap[day.date] = { date: day.date, deleted: 0, banned: 0, muted: 0, captchaPassed: 0, captchaFailed: 0 };
        }
        for (const k of ['deleted', 'banned', 'muted', 'captchaPassed', 'captchaFailed']) {
          dateMap[day.date][k] += day[k] || 0;
        }
      }
    }
    dailyTotals.push(...Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)));
  }

  return res.status(200).json({
    totals,
    perChat,
    daily: dailyTotals,
    captchaPassRate: totals.captchaPassed + totals.captchaFailed > 0
      ? Math.round((totals.captchaPassed / (totals.captchaPassed + totals.captchaFailed)) * 100)
      : null,
    timestamp: new Date().toISOString(),
  });
});
```

**Step 2: Commit**

```bash
git add api/dashboard/stats.js
git commit -m "feat: add dashboard stats API route with aggregation and daily trends"
```

---

### Task 6: Dashboard Activity API Route

**Files:**
- Create: `api/dashboard/activity.js`

**Step 1: Create the activity endpoint**

```js
// api/dashboard/activity.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { getActivity } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  const limit = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  const activity = await getActivity(limit);

  return res.status(200).json({
    activity,
    count: activity.length,
    timestamp: new Date().toISOString(),
  });
});
```

**Step 2: Commit**

```bash
git add api/dashboard/activity.js
git commit -m "feat: add dashboard activity feed API route"
```

---

### Task 7: Dashboard Action API Route

**Files:**
- Create: `api/dashboard/action.js`

**Step 1: Create the action endpoint**

This endpoint handles management actions from the dashboard: ban, unban, trust, untrust, and config updates.

```js
// api/dashboard/action.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { banUser, unbanUser } from '../../lib/telegram.js';
import { setTrusted, deleteWarnings, clearReports, setConfigOverride, getConfigOverrides } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { action, chatId, userId, key, value } = req.body || {};

  switch (action) {
    case 'ban': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      const result = await banUser(chatId, userId);
      return res.status(200).json({ ok: result?.ok || false, action: 'ban' });
    }

    case 'unban': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      const result = await unbanUser(chatId, userId);
      await deleteWarnings(chatId, userId);
      clearReports(chatId, userId);
      return res.status(200).json({ ok: result?.ok || false, action: 'unban' });
    }

    case 'trust': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      await setTrusted(chatId, userId, true);
      await deleteWarnings(chatId, userId);
      clearReports(chatId, userId);
      return res.status(200).json({ ok: true, action: 'trust' });
    }

    case 'untrust': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      await setTrusted(chatId, userId, false);
      return res.status(200).json({ ok: true, action: 'untrust' });
    }

    case 'setConfig': {
      if (!key) return res.status(400).json({ error: 'key required' });
      await setConfigOverride(key, value);
      return res.status(200).json({ ok: true, action: 'setConfig', key, value });
    }

    case 'getConfig': {
      const config = await getConfigOverrides();
      return res.status(200).json({ ok: true, config });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});
```

**Step 2: Commit**

```bash
git add api/dashboard/action.js
git commit -m "feat: add dashboard action API route for ban/unban/trust/config"
```

---

### Task 8: Update `vercel.json` for Dashboard Routes

**Files:**
- Modify: `vercel.json`

**Step 1: Add dashboard function configs**

Replace entire `vercel.json`:

```json
{
  "functions": {
    "api/webhook.js": { "maxDuration": 10 },
    "api/setup.js": { "maxDuration": 10 },
    "api/health.js": { "maxDuration": 10 },
    "api/dashboard/health.js": { "maxDuration": 10 },
    "api/dashboard/stats.js": { "maxDuration": 10 },
    "api/dashboard/activity.js": { "maxDuration": 10 },
    "api/dashboard/action.js": { "maxDuration": 10 }
  }
}
```

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add dashboard API routes to vercel.json"
```

---

### Task 9: Dashboard HTML Page

**Files:**
- Create: `public/dashboard.html`

**Step 1: Create the full dashboard page**

This is the largest task. Create `public/dashboard.html` — a single-file dashboard with inline CSS and JS. The page includes:

1. **Login screen** — password input that stores token in `sessionStorage`
2. **Health bar** — bot status, webhook, KV connection
3. **Stats cards** — 6 metric cards with totals
4. **7-day trend chart** — Chart.js line chart (loaded from CDN)
5. **Activity feed** — scrollable log with color-coded action types
6. **Management panel** — ban/unban forms, config sliders, chat list
7. **Auto-refresh** — polls every 30 seconds

Key implementation details:
- All API calls go through a `dashFetch(path, opts)` helper that adds the Bearer token
- Dark theme with CSS custom properties
- Responsive grid layout (2 columns on wide screens, 1 on narrow)
- Chart.js loaded from `https://cdn.jsdelivr.net/npm/chart.js` CDN
- Action type colors: red for bans, orange for mutes, blue for captcha, green for passes
- Login state persists in `sessionStorage` (cleared on tab close)
- Error states shown inline (not alerts)

The HTML file should be ~600-800 lines covering all panels. Full code will be written during implementation.

**Step 2: Commit**

```bash
git add public/dashboard.html
git commit -m "feat: add superadmin dashboard HTML page"
```

---

### Task 10: Manual Testing & Polish

**Step 1: Set DASHBOARD_SECRET locally**

Add `DASHBOARD_SECRET=test123` to `.env` or Vercel env vars.

**Step 2: Run `vercel dev` and test**

Test checklist:
- [ ] Navigate to `http://localhost:3000/dashboard` — login screen appears
- [ ] Enter wrong password — error shown
- [ ] Enter correct password — dashboard loads
- [ ] Health panel shows bot status (green/red dot)
- [ ] Stats cards show numbers (may be 0 if fresh)
- [ ] Activity feed loads (may be empty)
- [ ] Chart renders with 7-day data
- [ ] Management panel: test ban/unban with a test user ID
- [ ] Auto-refresh works (check network tab every 30s)
- [ ] Responsive layout on narrow viewport
- [ ] Logout button clears session and returns to login

**Step 3: Fix any issues found during testing**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: dashboard polish from manual testing"
```

---

### Task 11: Deploy and Configure

**Step 1: Add `DASHBOARD_SECRET` to Vercel env vars**

```bash
vercel env add DASHBOARD_SECRET
```

**Step 2: Deploy**

```bash
npm run deploy
```

**Step 3: Verify dashboard loads at production URL**

Navigate to `https://<your-domain>/dashboard` and log in.

---

## Summary

| Task | Description | Files | Depends On |
|------|-------------|-------|------------|
| 1 | Auth middleware | `lib/dashboardAuth.js` | — |
| 2 | State module additions | `lib/state.js` | — |
| 3 | Wire logging into existing code | `telegram.js`, `state.js`, `webhook.js` | 2 |
| 4 | Health API route | `api/dashboard/health.js` | 1 |
| 5 | Stats API route | `api/dashboard/stats.js` | 1, 2 |
| 6 | Activity API route | `api/dashboard/activity.js` | 1, 2 |
| 7 | Action API route | `api/dashboard/action.js` | 1, 2 |
| 8 | vercel.json update | `vercel.json` | 4-7 |
| 9 | Dashboard HTML page | `public/dashboard.html` | 4-7 |
| 10 | Manual testing & polish | various | 9 |
| 11 | Deploy | — | 10 |
