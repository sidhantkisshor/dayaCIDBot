# Go-Live Runbook — activating the security fixes

The code on the `audit-fixes` branch is safe to deploy as-is, but three of the
fixes only *switch on* once you add two settings in Vercel and re-run setup.
Follow these steps **in order**. Total time: ~10 minutes. If you get stuck at any
step, stop and ask — don't guess.

The two secret values you need were given to you in chat (they are NOT stored in
this file on purpose). Keep them somewhere safe (a password manager).

---

## Step 1 — Add two settings in Vercel  ⚠️ do this BEFORE deploying

1. Go to https://vercel.com → open your **dayaCIDBot** project.
2. Click **Settings** → **Environment Variables**.
3. Add each of these (Name, then Value, then Save). Set the "Environment" to
   **Production** (and Preview if offered):

   | Name | Value |
   |------|-------|
   | `WEBHOOK_SECRET` | *(value A from chat)* |
   | `SETUP_SECRET` | *(value B from chat)* |
   | `PUBLIC_URL` | your bot's stable web address, e.g. `https://dayacid.hitpoint.app` (no trailing slash) — optional but recommended |

   > You should already have `TELEGRAM_BOT_TOKEN` and `DASHBOARD_SECRET` set —
   > leave those alone. If `DASHBOARD_SECRET` is NOT set, your dashboard is
   > already down; add it too (value C from chat) and use it to log in.

## Step 2 — Deploy the new code

Two ways, pick one:

- **Easiest (if Vercel auto-deploys your main branch):** merge `audit-fixes`
  into `main` (ask me to do this, or use GitHub's "Merge pull request"), and
  Vercel will build automatically.
- **Manual:** run `npm run deploy` from the project folder (needs the Vercel CLI
  logged in).

Wait for the deploy to finish (green check in Vercel).

## Step 3 — Turn on the webhook lock

Open this address in your browser, replacing the placeholder with **value B**:

```
https://<your-domain>/api/setup?secret=<value B / SETUP_SECRET>
```

(e.g. `https://dayacid.hitpoint.app/api/setup?secret=8819...`)

You should see a JSON page. Look for these two lines and confirm:

- `"status": "configured"`
- `"webhookSecretActive": true`

If you see `"webhookSecretActive": true`, the webhook lock is now ON. 🎉

## Step 4 — Confirm the bot still works

Send a normal message in one of your groups and make sure the bot still moderates
(post something obviously spammy from a test account, or just confirm normal
messages are untouched). Have a new test account join and confirm the captcha
still appears.

---

## What each setting did

- **WEBHOOK_SECRET** — a password Telegram now includes on every call, so nobody
  can send your bot fake commands. (This was the biggest security hole.)
- **SETUP_SECRET** — locks the `/api/setup` page so only you can reconfigure the bot.
- **PUBLIC_URL** — makes the setup page use your real domain instead of trusting
  the incoming request, closing a webhook-hijack path.

## Rollback

If anything misbehaves, in Vercel go to **Deployments**, find the previous
working deployment, and click **Promote to Production**. Then tell me what broke.

## Still on the backlog (optional, lower priority)

- Login rate-limiting on the dashboard (marginal — your dashboard password is
  already long and random).
- Persisting captcha/report state to Redis for full reliability across serverless
  instances (bot works fine without it; just slightly less reliable at scale).
