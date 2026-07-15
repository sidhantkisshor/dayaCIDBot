# Superadmin Dashboard Design

**Date**: 2026-02-26
**Status**: Approved
**Audience**: Solo admin (bot owner)

## Overview

A full-featured superadmin dashboard for the DayaCID Telegram anti-spam bot. Provides live monitoring, historical stats, activity feed, and management controls — all in a single vanilla HTML page with API routes, deployed in the same Vercel project. Zero new npm dependencies.

## Architecture

### Hosting & Deployment
- Same Vercel project, same repo
- Dashboard served as static HTML at `/dashboard`
- API routes at `/api/dashboard/*` (Vercel serverless functions)
- Deploys alongside the bot with `vercel --prod`

### Authentication
- New env var: `DASHBOARD_SECRET`
- Dashboard page prompts for password on load, stores in `sessionStorage`
- All API calls include `Authorization: Bearer <DASHBOARD_SECRET>`
- Shared `validateDashboardAuth(req)` middleware rejects unauthorized requests

### New API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/dashboard/stats` | GET | Aggregated stats across all chats |
| `/api/dashboard/health` | GET | Extended bot health + KV status |
| `/api/dashboard/activity` | GET | Recent actions log (ring buffer from KV) |
| `/api/dashboard/action` | POST | Execute admin actions (ban, unban, trust, config) |

## UI Design

Single HTML page (`public/dashboard.html`) with 4 panels:

### Panel 1: Health Status Bar (top)
- Bot online/offline indicator (green/red dot)
- Webhook status: pending updates, last error
- KV connection status
- Last successful health check timestamp

### Panel 2: Stats Cards (row below health)
- Messages Deleted (total + today)
- Users Banned (total + today)
- Users Muted (total + today)
- Captcha Pass Rate (percentage)
- Aggregate across all chats; click to see per-chat breakdown

### Panel 3: Activity Feed (left 60%)
- Scrollable list of recent actions from KV ring buffer
- Each entry: timestamp, action type (color-coded), chat name, user, details
- Action types: SPAM BAN, SPAM MUTE, FORWARD BAN, CAPTCHA FAIL, CAS BAN, ADMIN BAN, etc.
- Auto-refreshes every 30 seconds

### Panel 4: Management Controls (right 40%)
- Quick Actions: Ban/unban user by ID, manage trusted users
- Threshold Tuning: Adjust SPAM_THRESHOLD, BAN_THRESHOLD (writes to KV)
- Pattern Management: View pattern count, add/disable patterns
- Chat List: All active chats with per-chat stats

### Visual Style
- Dark theme, data-dense layout
- Monospace for data, sans-serif for labels
- CDN-loaded Chart.js for 7-day spam trend chart
- No decorative elements

## Data Storage Changes

### New KV Keys

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `activity:log` | JSON array | 7 days | Ring buffer of last 200 actions |
| `stat:{chatId}:daily:{YYYY-MM-DD}` | Counter | 30 days | Daily counters for trend charts |
| `dashboard:config` | JSON hash | None | Runtime-tunable thresholds |
| `chats:active` | JSON array | None | List of chat IDs bot has seen |

### Changes to Existing Code

1. **`logToAdmin()`** in `lib/telegram.js` — also appends to `activity:log` ring buffer in KV
2. **`incrementStat()`** in `lib/state.js` — also increments daily counter for current date
3. **`handleMessage()`** in `api/webhook.js` — registers chatId in `chats:active` on first seen
4. **`lib/config.js`** — on cold start, reads `dashboard:config` from KV and merges with hardcoded defaults

### Auth Middleware
New file `lib/dashboardAuth.js` — shared `validateDashboardAuth(req)` function used by all dashboard API routes.

## File Plan

### New Files
- `public/dashboard.html` — full dashboard UI (HTML + inline CSS + inline JS)
- `api/dashboard/stats.js` — stats aggregation endpoint
- `api/dashboard/health.js` — extended health endpoint
- `api/dashboard/activity.js` — activity log endpoint
- `api/dashboard/action.js` — admin action endpoint
- `lib/dashboardAuth.js` — auth middleware

### Modified Files
- `lib/telegram.js` — add KV logging to `logToAdmin()`
- `lib/state.js` — add daily stats, active chats tracking, activity ring buffer helpers
- `lib/config.js` — add runtime config loading from KV
- `api/webhook.js` — register active chats
- `vercel.json` — add dashboard function configs + static file routing
- `package.json` — no changes (zero deps maintained)
