# DayaCID Bot

Telegram anti-spam bot built for Indian trading communities. Catches crypto scams, forex signal spam, financial fraud, and group promotion spam.

**Zero npm dependencies.** Runs on Vercel serverless with Node.js 18+ built-ins only.

## Features

- **Pattern-based spam detection** — 98+ regex patterns covering crypto, forex, adult, phishing, and promotion spam
- **Unicode obfuscation defeat** — strips zero-width characters and maps Cyrillic confusables to Latin
- **Graduated enforcement** — mute 1h, mute 24h, then ban (reduces false positive damage)
- **New member captcha** — math challenge with inline buttons, 2-minute timeout
- **CAS blacklist** — instant ban for known spammers via [Combot Anti-Spam](https://cas.chat/)
- **Community reporting** — reply to any message and tag `@DayaCIDbot` to report; 3 unique reporters = auto-restrict
- **Flood/burst detection** — rate limiting per user (>4 msgs/min or 2 msgs/3s)
- **Admin commands** — `/ban`, `/unban`, `/trust`, `/untrust`, `/stats`, `/check`
- **Optional persistence** — Upstash Redis for warnings, stats, trusted users, activity log
- **Dashboard API** — authenticated endpoints for stats, activity, and remote actions

## Quick Start

### 1. Create the bot

Talk to [@BotFather](https://t.me/BotFather) on Telegram and create a new bot. Save the token.

### 2. Deploy to Vercel

```bash
npm i -g vercel        # Install Vercel CLI
vercel                 # Link project
vercel env add TELEGRAM_BOT_TOKEN   # Add your bot token
vercel --prod          # Deploy
```

### 3. Configure webhook

Visit `https://your-domain.vercel.app/api/setup?secret=YOUR_BOT_TOKEN` once to register the webhook.

### 4. Add bot to your group

Add the bot to your Telegram group and make it an admin with these permissions:
- Delete messages
- Restrict members
- Ban users

Use `/check` in the group to verify permissions.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL (persistence) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `ADMIN_CHANNEL_ID` | No | Telegram chat ID for action logs |
| `DASHBOARD_SECRET` | No | Secret for dashboard API auth |
| `SETUP_SECRET` | No | Secret for `/api/setup` (falls back to bot token) |

Aliases `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work for the Redis vars.

## Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/help` | Anyone | Show bot info and command list |
| `/test` | Anyone | Confirm bot is running |
| `/stats` | Anyone | Show protection statistics |
| `/check` | Admin | Check bot permissions in this chat |
| `/ban` | Admin | Ban user (reply to their message) |
| `/unban` | Admin | Unban user (reply to their message) |
| `/trust` | Admin | Trust user — bypasses all spam checks |
| `/untrust` | Admin | Remove trusted status |

## Reporting Spam

Any group member can report a message by **replying** to it and mentioning `@DayaCIDbot`. The bot will:

1. Analyze the reported message for spam signals
2. Add a +3 score bonus for the report
3. Take action based on the combined score (mute, ban, or monitor)
4. If 3 different members report the same user, auto-restrict for 24 hours

## How Spam Scoring Works

Each message gets a score from multiple signals:

| Signal | Points |
|--------|--------|
| Spam pattern match | +3 each |
| Multiple patterns (3+/4+) | +4/+3 bonus |
| Suspicious keywords (3+/5+) | +2/+3 |
| Flooding (>4 msgs/min) | +6 |
| Burst (2+ msgs/3s) | +4 |
| Hidden URLs / suspicious domains | +2/+4 |
| No username + URL | +3 |
| Unicode obfuscation | +2 |
| Excessive caps (>70%) | +2 |
| Multiple price levels | +4 |
| ... and more | |

**Threshold: score >= 6** triggers enforcement. Configurable in `lib/config.js`.

## Enforcement Ladder

```
Spam score 6-9, 1st offense:  delete + mute 1 hour
Spam score 6-9, 2nd offense:  delete + mute 24 hours
Spam score 6-9, 3rd offense:  delete + permanent ban
Spam score >= 10:             delete + permanent ban (instant)
Channel forward:              delete + instant ban
User forward, 1st:            delete + warning
User forward, 2nd:            delete + ban
```

## Project Structure

```
api/
  webhook.js            Thin router — routes Telegram updates to handlers
  health.js             Health check endpoint
  setup.js              One-time webhook configuration
  dashboard/            Authenticated dashboard API
    health.js           Bot + KV + webhook status
    stats.js            Aggregated stats across all chats
    activity.js         Action log (last 200 entries)
    action.js           Remote ban/unban/trust/config
lib/
  config.js             Constants, thresholds, env vars
  telegram.js           Telegram Bot API helpers
  spam.js               Spam detection engine
  normalize.js          Unicode normalization + entity parsing
  captcha.js            New member verification
  cas.js                CAS blacklist integration
  commands.js           Chat command handlers
  state.js              Hybrid state (in-memory + optional Upstash KV)
```

## Development

```bash
vercel dev              # Local dev server
npm run deploy          # Deploy to production (vercel --prod)
```

No build step, no linter, no test suite. ES modules throughout.

## License

Private project.
