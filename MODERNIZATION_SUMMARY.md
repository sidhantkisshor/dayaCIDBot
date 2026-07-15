# MODERNIZATION_SUMMARY — deps-update branch

Date: 2026-07-15. Method: Context7/primary-docs-grounded multi-agent audit — recon → per-group update intelligence → independent verification → gated execution → deprecation sweep → regression sweep. Every version/API claim was sourced from current docs (Context7, core.telegram.org, vercel.com/docs, endoflife.date, npm registry), never from model memory; every MIGRATION classification and the one fix-now candidate were re-verified by fresh adversarial agents.

## Before / after

| Surface | Before | After | Commit |
|---|---|---|---|
| chart.js (CDN, SRI-pinned) | 4.4.7 | **4.5.1** (latest; no v5 exists) | `c59e920` |
| Node engines pin | `>=18` (18 EOL 2025-04-30; range would silently jump to 26.x) | **`24.x`** (Vercel default, LTS to Apr 2028) | `6fa3660` |
| npm dependencies | none | none (zero-dep by design — unchanged) | — |
| Lockfile / npm audit | N/A | N/A (no deps) | — |

## Migrations performed

- **chart.js 4.4.7 → 4.5.1** — PATCH-SAFE. One-line change in `public/dashboard.html:7`: version bump + regenerated SRI (`sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ`), computed from the live jsDelivr file and independently reproduced byte-for-byte by two separate verifier agents. No API changes touch the dashboard's usage (verified against /chartjs/chart.js docs + 4.4.8–4.5.1 release notes).
- **Node engines `>=18` → `24.x`** — HUMAN-GATED, approved. Declaration-only: Vercel already resolved `>=18` to latest 24.x, so runtime behavior is unchanged; the pin codifies it and blocks an unreviewed jump to Node 26.x (LTS Oct 2026). Zero code changes needed — all built-ins in use (global fetch, `AbortSignal.timeout`, `node:crypto` timingSafeEqual, `node:test`) are stable on 24. Docs wording updated (CLAUDE.md, README.md, both architecture.md copies).

## Skipped / blocked

None. (Google Fonts CSS is unversioned — nothing to pin beyond the existing CSP allowlist.)

## Deprecation sweep result (vs Telegram Bot API 10.2, Chart.js 4.5.1, Node 24, Upstash REST, CAS)

**Zero fix-now items.** Notable: a candidate finding — "captcha-passed users permanently lose message reactions because `ChatPermissions.can_react_to_messages` (Bot API 10.0) is omitted" — was **refuted** by adversarial verification: current docs state the omitted field defaults to `can_send_messages`, which the unmute path sets true. All Telegram methods/fields, permission shapes, webhook `secret_token` auth, Upstash REST endpoint styles, and the CAS endpoint are current.

## Modernization backlog (optional, recorded in UPDATE_PLAN.md)

1. Remove dead legacy `forward_from`/`forward_from_chat`/`forward_date` reads (`api/webhook.js:115,157,198`) — fields gone since Bot API 7.0; `forward_origin` path already handles all cases.
2. Batch the report flow's two `deleteMessage` calls via the existing unused `deleteMessages` helper.
3. Bot API 10.2 ephemeral messages (`receiver_user_id` + `deleteEphemeralMessage`) could replace the lazy 60s auto-delete queue.
4. Bot API 10.1 `answerChatJoinRequestQuery` could move the captcha into the join-request flow.
5. Optional explicit `can_react_to_messages`/`can_edit_tag` in the ChatPermissions object (behavior already correct via documented defaults).
6. `node:timers/promises` sleep instead of Promise-wrapped `setTimeout` (`lib/telegram.js:36`).
7. `safeEqual` byte-length guard (`Buffer.byteLength`) — theoretical only; Telegram tokens are ASCII.

## Vulnerability audit

Before and after: no dependency tree exists → `npm audit` N/A. Supply-chain surface is one CDN file, SRI-pinned and CSP-host-restricted, now at the latest published version.

## HUMAN-GATE items

- Node engines pin → **decided: 24.x** (approved during the run).
- None outstanding.

## Verification evidence

- Syntax: `node --check` clean on every file in `api/`, `api/dashboard/`, `lib/`.
- Tests: `node --test` — 47 pass, 0 fail (run after each unit and again in the regression sweep).
- Greps: zero references to `4.4.7` or the old SRI outside the plan docs.
- Regression sweep on both commits: minimal diffs confirmed, CSP allows the new URL, SRI format + value re-verified, no config drift, no new CRITICAL/HIGH findings.

Branch `deps-update` (2 unit commits + plan docs). **Not merged** — merge is left to the maintainer.
