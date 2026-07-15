# Modular Webhook Rewrite + Bug Fixes

**Date:** 2026-02-26
**Status:** Approved

## Goal

Replace the monolithic `api/webhook.js` (~960 lines) with a thin routing handler that imports from the existing `lib/` modules. Fix all 7 known bugs. Keep Upstash KV persistence optional.

## Architecture

`api/webhook.js` becomes ~250 lines of routing/enforcement. All logic lives in `lib/`:

| File | Purpose | Status |
|------|---------|--------|
| `lib/config.js` | Constants, thresholds, env vars | Done |
| `lib/normalize.js` | Unicode normalization, entity parsing | Done |
| `lib/spam.js` | Spam detection engine (patterns, keywords, scoring) | Done |
| `lib/state.js` | Hybrid in-memory + optional Upstash KV state | Done |
| `lib/telegram.js` | Telegram API helpers (send, delete, ban, restrict) | Done |

No new files. Just wiring existing code.

## Bug Fixes

| # | Bug | Fix |
|---|-----|-----|
| 1 | Dead "no username + URL" | Check `message.from.username` specifically, not the fallback variable |
| 2 | Double media caption scoring | Only score captions in the media path; skip main scoring when text came from caption |
| 3 | Unrecognized commands bypass spam | Add `default:` case that falls through to spam detection |
| 4 | Double `analyzeUserBehavior` | Already fixed in `lib/spam.js` — behavior analysis is only inside `isSpam()` |
| 5 | Warning survives `/trust` | Clear warnings when `/trust` is issued |
| 6 | Bot mention casing | Use case-insensitive check: `text.toLowerCase().includes('@dayacidbot')` |
| 7 | Media spam never bans | Media caption path uses same enforcement ladder (increment warnings, ban on 2nd) |

## Handler Pipeline

```
POST /api/webhook
  1. Reject non-POST → 200 OK
  2. Extract: chatId, userId, text, hasUsername, isForwarded, message object
  3. New member join → 30-min probation (text-only restriction)
  4. Bot mention + reply → user report flow (case-insensitive) [fix #6]
  5. Commands:
     - /start, /help, /test, /ban, /unban
     - /trust (also clears warnings) [fix #5]
     - /untrust
     - /stats (enhanced with KV stats if available)
     - default: fall through to spam check [fix #3]
  6. Skip bots, channel posts, admins
  7. Probation enforcement (new members within 30 min)
  8. Forwarded message enforcement (no separate behavior analysis) [fix #4]
  9. Text spam check — skip if text === caption AND media present [fix #2]
     - Pass `message` object for entity-based detection
     - Check `message.from.username` for "no username" score [fix #1]
  10. Media caption spam check — uses full enforcement ladder [fix #7]
  11. Return 200
```

## Key Behavioral Changes

- Spam detection uses **normalized text** (Cyrillic lookalikes, zero-width chars stripped)
- **Entity-based URL detection** catches hidden `text_link` URLs
- **`banUser` revokes messages** (deletes spammer's last 48h of messages)
- **Admin action logging** if `ADMIN_CHANNEL_ID` env var is set
- **Optional persistence** via Upstash KV (warnings + trust survive cold starts)
- **Enhanced `/stats`** shows per-chat counters when KV is enabled

## Scope Exclusions

- No captcha on join (future work)
- No CAS (Combot Anti-Spam) integration (future work)
- No new npm dependencies
