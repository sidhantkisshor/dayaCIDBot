# DayaCID Bot — Admin Guide

## Dashboard API

All dashboard endpoints require authentication via Bearer token. Set `DASHBOARD_SECRET` as an environment variable in Vercel, then include it in requests:

```
Authorization: Bearer YOUR_DASHBOARD_SECRET
```

If `DASHBOARD_SECRET` is not set, all dashboard endpoints return `503`.

### Endpoints

#### `GET /api/dashboard/health`

Bot and infrastructure health check.

**Response:**
```json
{
  "bot": { "status": "online", "info": { "id": 123, "username": "DayaCIDbot" } },
  "webhook": { "url": "https://...", "pendingUpdates": 0, "lastError": null },
  "kv": { "status": "connected" },
  "activeChats": 3,
  "activeChatList": { "-100123": { "title": "Trading Group", "firstSeen": 1708900000000 } },
  "env": { "hasToken": true, "hasKV": true, "hasAdminChannel": true, "hasDashboardSecret": true }
}
```

#### `GET /api/dashboard/stats`

Aggregated statistics across all active chats.

**Response:**
```json
{
  "totals": { "deleted": 150, "banned": 42, "muted": 30, "warned": 0, "captchaPassed": 200, "captchaFailed": 15 },
  "perChat": { "-100123": { "title": "Trading Group", "deleted": 150, "banned": 42, ... } },
  "daily": [
    { "date": "2026-02-20", "deleted": 20, "banned": 5, "muted": 3, "captchaPassed": 30, "captchaFailed": 2 },
    ...
  ],
  "captchaPassRate": 93
}
```

#### `GET /api/dashboard/activity?limit=50`

Recent bot actions (ring buffer, max 200 entries in KV).

**Query params:**
- `limit` — number of entries to return (default: 50, max: 200)

**Response:**
```json
{
  "activity": [
    { "action": "SPAM BAN", "chatId": -100123, "userId": 456, "username": "spammer", "details": "Score: 12", "timestamp": 1708900000000 },
    ...
  ],
  "count": 50
}
```

#### `POST /api/dashboard/action`

Remote moderation actions. All actions require `Content-Type: application/json`.

**Ban a user:**
```json
{ "action": "ban", "chatId": -100123, "userId": 456 }
```

**Unban a user** (also clears warnings and reports):
```json
{ "action": "unban", "chatId": -100123, "userId": 456 }
```

**Trust a user** (also clears warnings and reports):
```json
{ "action": "trust", "chatId": -100123, "userId": 456 }
```

**Untrust a user:**
```json
{ "action": "untrust", "chatId": -100123, "userId": 456 }
```

**Update config threshold:**
```json
{ "action": "setConfig", "key": "SPAM_THRESHOLD", "value": 8 }
```

Allowed keys: `SPAM_THRESHOLD`, `INSTANT_BAN_THRESHOLD`, `MAX_WARNINGS_BEFORE_BAN`. Values must be 1-30.

**Get current config overrides:**
```json
{ "action": "getConfig" }
```

---

## Bot Setup

### Environment Variables

Set these in Vercel project settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | From @BotFather |
| `UPSTASH_REDIS_REST_URL` | Recommended | Enables persistence (stats, warnings, activity log) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash auth token |
| `ADMIN_CHANNEL_ID` | No | Telegram chat ID where action logs are sent |
| `DASHBOARD_SECRET` | No | Enables dashboard API authentication |
| `SETUP_SECRET` | No | Protects `/api/setup` endpoint (defaults to bot token) |

### Initial Setup

1. Deploy to Vercel: `vercel --prod`
2. Configure webhook: `GET /api/setup?secret=YOUR_BOT_TOKEN`
3. Add bot to group as admin with: Delete messages, Restrict members, Ban users
4. Verify with `/check` in the group

### Health Check

`GET /api/health` (no auth required) returns:
- Bot connection status
- Webhook configuration
- Missing `allowed_updates` (with fix hint)
- KV and admin channel status

### Required Bot Permissions

The bot needs these admin permissions in every group:
- **Delete messages** — remove spam
- **Restrict members** — mute users (graduated enforcement)
- **Ban users** — permanent ban for repeat offenders

### Captcha Flow

When a new member joins:
1. CAS blacklist check — instant ban if known spammer
2. Mute immediately
3. Send math challenge (e.g., "What is 7 + 3?") with 4 buttons
4. Correct answer = unmute; wrong answer = ban; no answer in 2 min = ban

### Tuning Spam Detection

**Thresholds** in `lib/config.js` (or via dashboard `setConfig`):
- `SPAM_THRESHOLD` (default: 6) — minimum score to trigger enforcement
- `INSTANT_BAN_THRESHOLD` (default: 10) — score for immediate ban (skip mute ladder)
- `MAX_WARNINGS_BEFORE_BAN` (default: 3) — offenses before permanent ban

**Patterns** in `lib/spam.js`:
- `SPAM_PATTERNS` — array of regexes, each match = +3 points
- `SUSPICIOUS_KEYWORDS` — word list, 3+ matches = +2, 5+ = +3

### Activity Log

When `ADMIN_CHANNEL_ID` is set, every enforcement action (ban, mute, captcha fail, report action) is logged to that Telegram channel in real time.

When KV is configured, the last 200 actions are stored in a ring buffer accessible via `GET /api/dashboard/activity`.

### Community Reporting

Group members can report spam by replying to a message and tagging `@DayaCIDbot`. The system:
1. Tracks unique reporters per user
2. At 3 unique reporters: auto-restrict 24h (or ban if restrict fails)
3. Below 3 reporters: analyze message with +3 score bonus and enforce accordingly
