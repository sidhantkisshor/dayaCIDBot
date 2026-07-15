# DayaCID Bot — Architecture

> Accurate as of the audit-fixes branch. For the full, authoritative reference
> (spam scoring table, enforcement flows, commands, state model) see
> [`CLAUDE.md`](../CLAUDE.md) in the repo root — this file is a short overview.

## What it is
A Telegram anti-spam bot for Indian trading communities. Deployed as **Vercel
serverless functions** using the Telegram Bot API via webhooks. **Node.js 18+,
ES modules, zero npm dependencies** (built-in `fetch`/`Map`/`Set`/`RegExp` only).
There is no Python, no ML framework, and no SQL database — spam detection is
regex/keyword scoring, and persistence is optional Upstash Redis over its REST API.

## Layout
```
api/
  webhook.js        Thin router: routes Telegram updates to handlers
  health.js         Public health check
  setup.js          One-time webhook configuration
  dashboard/        Auth'd dashboard API (health, stats, activity, action)
lib/
  config.js         Constants, thresholds, dashboard overrides (getThreshold)
  telegram.js       Telegram Bot API helpers (timeouts, 429 retry, HTML escaping)
  spam.js           Additive spam-scoring engine (patterns + keywords + behavior)
  normalize.js      Unicode normalization + message-entity parsing
  captcha.js        New-member math captcha (mute -> challenge -> unmute/ban)
  cas.js            CAS (Combot Anti-Spam) blacklist check (fail-open, cached)
  commands.js       /help /ban /trust /stats etc.
  state.js          Hybrid state: in-memory cache + optional Upstash KV
  dashboardAuth.js  Bearer-token auth for the dashboard API
public/
  dashboard.html    Single-file superadmin dashboard (Chart.js via CDN)
```

## Request flow
Telegram -> `POST /api/webhook` -> lazy cleanup (expired captchas, auto-deletes) ->
route by update type (`chat_member` / `callback_query` / `message`). Messages run
through report handling, commands, forward enforcement, then additive spam scoring
with graduated enforcement (mute -> longer mute -> ban). All responses return HTTP
200 so Telegram does not retry.

## State model
In-memory Maps/Sets are a per-instance cache and reset on cold start. When Upstash
KV is configured, warnings/trust/stats/activity persist there (warnings via atomic
`INCR`). Some ephemeral state (captcha pending, new-member grace, auto-delete queue)
is in-memory only — see the remediation backlog for KV-persistence follow-ups.

## Constraints
- Vercel function budget is 10s; external fetches carry timeouts so one hung call
  can't exhaust it and cause a Telegram redelivery.
- The bot needs Delete / Restrict / Ban admin permissions (`/check` to verify).
- Real `TELEGRAM_BOT_TOKEN` must be set in env; `lib/config.js` has a non-functional
  placeholder fallback only.
