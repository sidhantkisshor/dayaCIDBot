# DayaCID Bot — Fix Plan

Branch: `audit-fixes` (baseline commit `19c2259`). One coherent change per unit; one commit per unit; minimal diffs, existing style, no new dependencies. Verification gate per unit: `node --check` on every touched `.js` (no build), plus the new `node:test` suite (Unit T) for pure-function fixes.

**Autonomy:** Units marked **AUTO** proceed without asking (reversible, no auth/API-contract/data-loss risk). Units marked **HUMAN-GATE** are paused for the operator — they change auth behavior, ingress contracts, or require env/ops changes that can break the live deployment.

Ordering rationale: severity → dependency (unblockers first) → blast radius (smallest first within a tier). Client-only and pure-logic fixes lead because they can't affect the serverless request path.

---

## Tier 0 — Test harness (unblocks verification of all logic fixes)

### Unit T — Zero-dependency `node:test` suite — **AUTO**
- **Files:** new `tests/*.test.js`, `package.json` (`"test": "node --test"`), touches nothing in `lib/`.
- **Covers findings:** all TEST-* (F-grade gap).
- **Acceptance:** `node --test` runs green; covers `normalizeText`/`hasObfuscation`/`extractEntityInfo`/`extractHiddenUrls` (normalize.js), `isSpam` scoring boundaries + a spam/ham corpus, `generateOptions` (4 unique, correct present, no negatives), and the flood/burst boundary. Serves as the regression net for Units S1–S3.
- **Rollback:** delete `tests/`.

---

## Tier 1 — Quick wins (client-only + pure logic, smallest blast radius)

### Unit A — Dashboard stored XSS + client robustness — **AUTO**
- **Files:** `public/dashboard.html` only (server request path untouched).
- **Findings:** C2 (XSS), M1 (dashFetch error handling + saveConfig false success), M12 (chart destroy), FE dead-catch.
- **Acceptance:** activity rows built via `createElement`/`textContent` + `addEventListener` (no interpolated `onclick`); `dashFetch` rejects on any non-2xx; `saveConfig`/`doAction` surface `d.error`; `initChart` destroys prior chart; a payload first_name renders inert. Manual: open page structure, confirm no `onclick="...${` remains.
- **Rollback:** revert file.

### Unit B — HTML-escape all user text in Telegram messages — **AUTO**
- **Files:** `lib/telegram.js` (add `escapeHtml`, apply in `logToAdmin`), `api/webhook.js`, `lib/captcha.js`, `lib/commands.js`.
- **Findings:** H1.
- **Acceptance:** every interpolation of `username`/`first_name`/titles/`details` into HTML-mode text is wrapped in `escapeHtml`; `node --check` clean. Add a unit test for `escapeHtml`.
- **Rollback:** revert.

### Unit C — Enforcement correctness cluster (webhook logic) — **AUTO**
- **Files:** `api/webhook.js`.
- **Findings:** H4 (gate `deleteWarnings`/`clearReports` on ban success), H5 (use `getThreshold('MAX_WARNINGS_BEFORE_BAN')` in all 4 paths), M9 (`forward_origin?.sender_chat` fallback), M16 (move `is_bot` check above report/command blocks).
- **Acceptance:** `deleteWarnings` only inside `if (banResult?.ok)`; all ban ladders read the dynamic threshold; `sender_chat` forwards routed to channel branch; bot messages skipped before report/command handling; `node --check` clean.
- **Rollback:** revert.

### Unit D — Spam-engine correctness — **AUTO**
- **Files:** `lib/spam.js`, `lib/normalize.js`.
- **Findings:** H6 (run `analyzeUserBehavior` before empty-text return), CORR-11 (share zero-width char class between `normalizeText` and `hasObfuscation`).
- **Acceptance:** captionless-media flood is detected (unit test: N rapid empty-text calls flag flooding); obfuscation-char sets match; `node --test` green.
- **Rollback:** revert.

### Unit E — Dashboard API input validation — **AUTO**
- **Files:** `api/dashboard/action.js`, `api/dashboard/activity.js`, `lib/dashboardAuth.js`.
- **Findings:** M10 (per-key config bounds + `INSTANT_BAN >= SPAM` invariant), M11 (clamp `limit >= 1`), M22 (`withAuth` try/catch → JSON 500), M23-partial (method checks on read endpoints), ERR-9 (gate unban/trust state-clear on `result.ok`).
- **Acceptance:** out-of-range/invalid inputs return 400/405 with JSON; handler exceptions return JSON 500; `node --check` clean.
- **Rollback:** revert.

### Unit F — Cleanups (LOW) — **AUTO**
- **Files:** `api/webhook.js`, `lib/spam.js`, `lib/config.js`, `lib/captcha.js`, `.claude/architecture.md`, `.cursor/architecture.md`, `CLAUDE.md`.
- **Findings:** unused imports, magic numbers → config (`CAPS_RATIO_THRESHOLD`, `NEW_MEMBER_GRACE_MS`), `chatId` Number() in captcha cleanup, rewrite the fictional architecture docs to match the real Node stack, fix CLAUDE.md forward-policy drift.
- **Acceptance:** `node --check` clean; no behavior change; docs accurate.
- **Rollback:** revert.

---

## Tier 2 — Resilience & state (touches request path — higher blast radius)

### Unit G — Fetch timeouts everywhere — **AUTO**
- **Files:** `lib/telegram.js`, `lib/state.js`, `lib/config.js`.
- **Findings:** C5.
- **Acceptance:** every `fetch` has `signal: AbortSignal.timeout(...)` (Telegram ~4s, Upstash ~2s); timeouts caught and degrade gracefully; `node --check` clean.
- **Rollback:** revert.

### Unit H — Telegram 429 retry + mutation-result checks + KV error logging — **AUTO**
- **Files:** `lib/telegram.js`, `lib/captcha.js`, `lib/state.js`.
- **Findings:** H9 (429/`retry_after` single retry in `callTelegram`), M14/M15 (check CAS-ban and mute results, log on failure), M4 (log KV write failures).
- **Acceptance:** `callTelegram` retries once on `error_code:429`; captcha CAS-ban/mute failures log distinctly; KV catches `console.error`; `node --check` clean.
- **Rollback:** revert.

### Unit I — Captcha hardening (self-actor guard + KV persistence + dedup) — **AUTO**
- **Files:** `lib/captcha.js`, `lib/state.js`, `lib/telegram.js` (cache bot id via `getMe`).
- **Findings:** C3 (skip when actor is bot / only `left`+`kicked` trigger), C4 (persist `pendingVerifications` to KV with TTL; unmute in `!pending` recovery), H2 (dedup via `pendingVerifications.has(key)`; single `startVerification` helper).
- **Acceptance:** unit tests for `generateOptions` still green; logic review confirms no re-trigger on bot unmute, one captcha per join, recovery unmutes; `node --check` clean. **This is the highest-value functional fix — reviewer scrutiny required.**
- **Rollback:** revert.

### Unit J — Atomic warnings + trust revalidation + admin/state persistence — **AUTO**
- **Files:** `lib/state.js`, `api/webhook.js`.
- **Findings:** H10 (`INCR`+`EXPIRE` warnings), H3 (trust-cache TTL revalidation), H11 (admin cache), M5/M6/M7 (persist `autoDeleteQueue`/`newMembers`/`userReports` to KV), M13 (TTL sweep), M2 (registerActiveChat in-memory known-set), M3 (parallelize stats loop).
- **Acceptance:** warnings use atomic increment; trust re-checks KV after TTL; unit-level review of key construction; `node --check` clean. *(Large unit — may split during execution if files diverge.)*
- **Rollback:** revert.

---

## Tier 3 — HUMAN-GATE (paused for operator decision)

These are **not executed autonomously.** Each can break the live deployment or change a public contract.

### Unit K — Webhook `secret_token` verification (C1) — **HUMAN-GATE**
- Code ships backward-compatible (enforce only if `WEBHOOK_SECRET` set), but **activation requires** the operator to set `WEBHOOK_SECRET` and re-run `GET /api/setup`. Until then the endpoint stays open. Decision needed: ship the gated code now + operator activates, or hold.

### Unit L — Setup endpoint fail-closed (H7) + fixed webhook URL (H12) — **HUMAN-GATE**
- Requiring `SETUP_SECRET` and dropping the `TOKEN`/`DEV_TOKEN_NOT_SET` fallback can lock out an operator who currently relies on the token. Fixed webhook URL needs a `PUBLIC_URL` env value only the operator knows.

### Unit M — `chat_join_request` handling (H8) — **HUMAN-GATE**
- Product decision: implement approve-and-captcha flow, or unsubscribe from the update. Different UX either way.

### Unit N — Rate limiting + SRI + security headers (M8, M17, M18) — **HUMAN-GATE (light)**
- Low-risk but touches deploy config (`vercel.json` headers) and adds an SRI hash that must be regenerated if Chart.js is bumped. Bundled for operator review.

---

## Execution order
T → A → B → C → D → E → F → G → H → I → J → [regression sweep] → pause at K/L/M/N.

## Status tracker
| Unit | Status | Commit | Test evidence |
|---|---|---|---|
| T | ✅ done | `23110c5` | 46 tests green |
| A | ✅ done | `345fb6a` | fresh reviewer APPROVE; onclick grep clean |
| B | ✅ done | `05360fe` | node --check + 46 tests |
| C | ✅ done | `dc3c619` | 46 tests; no hardcoded threshold remains |
| D | ✅ done | `bcda2cd` | +media-flood regression test; 47 green |
| E | ✅ done | `32857a8` | node --check all 5 files |
| F | ✅ done | `c5ac1aa` | 47 green |
| G | ✅ done | `c51fdb5` | 10 timeout guards; 47 green |
| H | ✅ done | `9f51348` | 47 green |
| I | ✅ done | `e9a023c` | fresh reviewer APPROVE; 47 green |
| J | ✅ done | `3fbc697` | 47 green |
| (regression) | ✅ done | `20b9386` | 3 sweep findings fixed; 47 green |
| K–N | ⏸ HUMAN-GATE | — | awaiting operator (see REMEDIATION_SUMMARY.md) |
