# CLAUDE.md

## What This Is

DayaCID Bot — a Telegram anti-spam bot built for Indian trading communities. Detects and removes crypto scams, forex signal spam, financial fraud, and group promotion spam. Deployed as a Vercel serverless function using the Telegram Bot API via webhooks. Zero npm dependencies; uses only Node.js 24 built-ins (`fetch`, `Map`, `Set`, `RegExp`).

## Development & Deployment

```bash
vercel dev          # Local dev server (requires Vercel CLI)
npm run deploy      # Deploy to production (runs: vercel --prod)
```

- No build step, no linter, no test suite
- ES modules (`"type": "module"` in package.json)
- Health check: `GET /api/health` — returns bot status, webhook config, and permission checks
- Setup: `GET /api/setup` — one-time webhook configuration with correct `allowed_updates`
- Vercel function timeout: 10s (`vercel.json`)
- Required env var: `TELEGRAM_BOT_TOKEN`
- Optional env vars: `UPSTASH_REDIS_REST_URL`/`KV_REST_API_URL`, `UPSTASH_REDIS_REST_TOKEN`/`KV_REST_API_TOKEN` (Upstash Redis for persistence), `ADMIN_CHANNEL_ID` (action logging)
- `lib/config.js` line 5 has a `'DEV_TOKEN_NOT_SET'` fallback — real token must be in env vars

## Codebase Structure

```
api/
  webhook.js          — Thin router (~350 lines): routes update types to handlers
  health.js           — Health check importing from lib/telegram.js
  setup.js            — One-time webhook configuration endpoint
  dashboard/          — Dashboard API endpoints (auth, stats, config)
lib/
  config.js           — All constants, thresholds, and timeouts
  telegram.js         — Telegram API helpers (sendMessage, banUser, restrictUser, etc.)
  spam.js             — Spam detection engine (patterns, keywords, scoring)
  normalize.js        — Unicode normalization + message entity parsing
  captcha.js          — New member verification (math challenge + inline buttons)
  cas.js              — CAS (Combot Anti-Spam) blacklist integration
  commands.js         — Command handlers (/help, /ban, /unban, /trust, /stats, etc.)
  state.js            — Hybrid state: in-memory + optional Upstash KV persistence
```

## Request Processing Pipeline

The `handler()` in `api/webhook.js` routes Telegram updates:

1. **Lazy cleanup** — expire pending captcha verifications on every request
2. **`chat_member` update** — routes to `handleChatMember()` in captcha.js (new member join flow)
3. **`callback_query` update** — routes to `handleCallbackQuery()` in captcha.js (captcha button presses)
4. **`message` update** — routes to `handleMessage()`:
   a. **Register active chat** — tracks chat for dashboard
   b. **New member service message** — `new_chat_members` triggers captcha flow (fallback path)
   c. **User report check** — if message mentions `@dayacidbot` (case-insensitive) and is a reply, analyze reported message
   d. **Command handling** — routes to `lib/commands.js`; unknown commands fall through to spam check
   e. **Skip bots/channels/admins**
   f. **Forwarded message check** — both channel and user forwards use graduated enforcement (mute/warn → ban)
   g. **Spam scoring** — `isSpam()` with Unicode normalization, entity-based URL detection, and `hasUsername` flag
   h. **Media caption check** — separate spam check for captions when message also has text

All responses return HTTP 200 (even errors) to prevent Telegram webhook retries.

## Spam Scoring System

`isSpam(text, userId, chatId, username, message, hasUsername)` in `lib/spam.js` returns `{ isSpam: bool, score: number, reasons: string[] }`.

Score is additive:

| Layer | Points | Trigger |
|-------|--------|---------|
| Unicode obfuscation | +2 | Zero-width characters detected in original text |
| Flooding | +6 | >4 messages in 60s |
| Burst | +4 | ≥2 messages in 3s |
| Pattern match | +3 each | Any of ~98 regex patterns in `SPAM_PATTERNS` |
| Multi-pattern bonus | +4/+3 | 3+ / 4+ patterns matched |
| Keyword density | +2/+3 | 3+ / 5+ keywords from `SUSPICIOUS_KEYWORDS` |
| Hidden URLs (text_link) | +2 / +4 | Any hidden link / suspicious domain |
| Price levels | +4 | 3+ numbers with 3-5 digits |
| Trading emoji + price | +3 | Chart/check emojis adjacent to numbers |
| Excessive caps | +2 | >70% uppercase (messages >10 chars) |
| Emojis | +1/+2 | >5 / >10 emojis |
| Multiple URLs | +2 | >2 URLs (via entities) |
| Short msg + URL | +2 | <50 chars with any URL |
| Long message | +2/+3 | >1000 chars / with finance keywords |
| Blockquote | +1 | Contains blockquote entity |
| Username spam | +5/+3 | Same @mention repeated / 5+ mentions |
| Only mentions | +3 | Message body is just @mentions |
| No username + URL | +3 | User has no @username and posts a URL |
| User report bonus | +3 | Added when another user reports via @DayaCIDbot |

**Action threshold: score >= 6** (configurable in `lib/config.js`).

Key improvement: `normalizeText()` strips zero-width characters and maps Cyrillic confusables to Latin before pattern matching, defeating obfuscation.

## Enforcement Flow

### Graduated enforcement (spam detection):
```
1st offense (score 6-9):   delete -> mute 1 hour
2nd offense (score 6-9):   delete -> mute 24 hours
3rd offense OR score >= 10: delete -> permanent ban (revoke_messages: true)
```

### User reports (via @DayaCIDbot reply):
```
3 unique reporters:         delete -> auto-restrict 24h (or ban if restrict fails)
Score < 5 with bonus:       "Report noted. Monitoring X (N/3 reports)"
Score 5-7 with bonus:       delete -> mute 1 hour (or ban on 2nd offense)
Score >= 8 with bonus:      delete -> immediate ban
```

### Other:
```
Forwarded from channel/group: delete -> mute 24h (1st) -> ban (Nth, MAX_WARNINGS_BEFORE_BAN)
Forwarded from user:          delete -> warn (1st) -> ban (Nth, MAX_WARNINGS_BEFORE_BAN)
New member:                   CAS check -> mute -> captcha challenge -> unmute on success
Captcha timeout (2 min):      ban + delete challenge message
Trusted users:                bypass all checks
```

Bot responses auto-delete after 60 seconds.

## New Member Captcha Flow

1. User joins -> `chat_member` update (or `new_chat_members` fallback)
2. CAS blacklist check -> instant ban if known spammer
3. Mute immediately via `restrictChatMember`
4. Send math challenge (e.g., "What is 7 + 3?") with 4 inline buttons
5. Correct answer -> unmute, delete challenge
6. Wrong answer -> ban immediately
7. No answer in 2 minutes -> ban (lazy cleanup on next webhook call)

## Commands

| Command | Access | Notes |
|---------|--------|-------|
| `/start`, `/help` | Anyone | Bot description and command list |
| `/test` | Anyone | "Bot is working and protecting your chat!" |
| `/check` | Admin | Show bot's current permissions in this chat |
| `/ban` | Admin | Must reply to a message |
| `/unban` | Admin | Must reply — clears warnings and reports |
| `/trust` | Admin | Must reply — user bypasses all spam checks, clears warnings/reports |
| `/untrust` | Admin | Must reply — remove trusted status |
| `/stats` | Anyone | Show protection statistics (persistent if KV configured) |

## State Management (`lib/state.js`)

### In-memory (fast cache):
- `userWarnings` — Map of warning counts
- `userMessageTimes` — Map of message timestamps (flood detection)
- `trustedUsers` — Set of trusted user keys
- `pendingVerifications` — Map of captcha challenges
- `newMembers` — Map of recent join timestamps (30 min window)
- `userReports` — Map tracking unique reporters per user

### Persistent (Upstash KV, optional):
- Warnings (7-day TTL)
- Trusted users (no TTL)
- Stats counters (deleted, banned, muted, captchaPassed, captchaFailed)
- Daily stats per chat (30-day TTL)
- Activity log (ring buffer, max 200 entries, 7-day TTL)
- Active chats registry
- Dashboard config overrides

If `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` is not set, falls back to in-memory only. State accessed via hybrid read (memory first, KV fallback).

## Telegram API Helpers (`lib/telegram.js`)

- `sendMessage(chatId, text, autoDelete, threadId)` — HTML-formatted, forum topic support
- `sendMessageWithKeyboard(chatId, text, keyboard, threadId)` — inline buttons
- `deleteMessage(chatId, messageId)` / `deleteMessages(chatId, messageIds)` — single/bulk
- `banUser(chatId, userId)` — `banChatMember` with `revoke_messages: true`
- `unbanUser(chatId, userId)` — `unbanChatMember` with `only_if_banned: true`
- `restrictUser(chatId, userId, permissions, untilDate)` — granular permission control
- `unrestrictUser(chatId, userId)` — restore all permissions
- `isAdmin(chatId, userId)` — checks admin/creator status
- `getMe()` / `getWebhookInfo()` — bot info and webhook status
- `answerCallbackQuery(id, text)` — dismiss button loading
- `logToAdmin(action, chatId, userId, username, details)` — fire-and-forget admin channel + KV activity logging

## Working on This Codebase

- **Primary tuning surfaces**: `SPAM_PATTERNS` and `SUSPICIOUS_KEYWORDS` in `lib/spam.js`. Thresholds in `lib/config.js`.
- **Main tension**: false positives vs. missed spam. Graduated enforcement (mute before ban) reduces false positive damage.
- **Bot permissions required**: Delete messages, Restrict members, Ban users. Use `/check` to verify.
- **After deploying**: Hit `GET /api/setup` once to configure webhook with correct `allowed_updates`.
- **Testing captcha**: Add bot to a test group, have a user join, verify the challenge flow.
- **Syntax check**: `node --check api/webhook.js && node --check api/health.js && node --check lib/*.js`
