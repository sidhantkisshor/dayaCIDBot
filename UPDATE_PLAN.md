# UPDATE_PLAN — Dependency Modernization (deps-update branch)

Generated 2026-07-15 by Context7-grounded modernization audit (Phase 0–2 complete, all classifications independently verified by a fresh verifier agent).

## Repo dependency surface (Phase 0 recon)

- **npm dependencies: none** (zero-dependency by design; no lockfile; `npm audit` not applicable).
- Third-party code = one CDN asset (Chart.js, SRI-pinned) + Google Fonts CSS (unversioned, nothing to bump).
- Runtime = Vercel Node serverless functions, pinned only via `package.json` `engines`.
- External HTTP APIs (Telegram Bot API, CAS, Upstash Redis REST) — not packages; covered by Phase 5 deprecation sweep.
- Build/lint/CI: none. Tests: `node --test` (tests/normalize, spam, captcha).

## Units

### Unit 1 — chore(deps): chart.js 4.4.7 → 4.5.1  [AUTONOMOUS]

| Field | Value |
|---|---|
| Class | PATCH-SAFE (minor bump within v4; no v5 exists) |
| Risk | LOW |
| Context7 refs | `/chartjs/chart.js` (docs/migration/v4-migration.md — no v5 guide exists; UMD dist filename unchanged), `/websites/chartjs` (legend/scales/line-chart option docs — all used keys current) |
| Verification | Fresh verifier: npm latest=4.5.1 confirmed; release notes 4.4.8–4.5.1 contain no breaking changes touching used APIs; SRI recomputed independently, byte-for-byte match |
| Affected code | `public/dashboard.html:7` (CDN tag); usage at :981 (destroy), :984–1018 (new Chart line config), :1023–1027 (data mutation + update) |
| Migration map | none needed — swap URL version + integrity attribute only |
| New URL | `https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js` |
| New SRI | `sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ` (keep `crossorigin="anonymous"`) |
| Status | DONE — commit `c59e920` (reviewer APPROVE, SRI independently reproduced, 47/47 tests green) |

### Unit 2 — chore(deps): node engines >=18 → 24.x  [HUMAN-GATE — runtime version change]

| Field | Value |
|---|---|
| Class | MIGRATION (declaration-only; runtime already resolves to 24.x) |
| Risk | LOW |
| Doc refs | vercel.com/docs/functions/runtimes/node-js/node-js-versions (updated 2026-02-27: supported 24.x default, 22.x, 20.x); vercel.com/changelog/node-js-18-is-being-deprecated (new Node 18 deployments fail since 2025-09-01); endoflife.date/nodejs (18 EOL 2025-04-30, 20 EOL 2026-04-30) |
| Verification | Fresh verifier confirmed every sub-claim against the above sources |
| Affected code | `package.json` engines only. All version-sensitive built-ins in use (global fetch ×16, `AbortSignal.timeout` ×12, `node:crypto` timingSafeEqual ×3, `node:test`) are stable on 22/24 — zero code changes |
| Migration map | `package.json`: `"engines": { "node": ">=18" }` → `"engines": { "node": "24.x" }`; `vercel.json`: no change; docs: CLAUDE.md "Node.js 18+ built-ins" → update wording |
| Rationale | `>=18` already deploys on latest 24.x (Vercel resolves latest satisfying version) — pin codifies actual runtime and prevents a silent unreviewed jump to Node 26.x when Vercel adds it (26 is LTS from Oct 2026) |
| Status | DONE — commit `6fa3660` (human approved 24.x; reviewer APPROVE, 47/47 tests green) |

## Ordering

No build tooling, no framework core, no dependency graph — units are independent. Unit 1 executes first (smallest blast radius, ungated); Unit 2 awaits the human gate.

## Phase 5 — Deprecation & modernization sweep (COMPLETE)

Swept against current docs: Telegram Bot API 10.2 (2026-07-14), Chart.js 4.5.1, Node 24, Upstash Redis REST, CAS API.

**Fix-now items: 0.** One candidate ("captcha-passers permanently lose message reactions — ChatPermissions missing `can_react_to_messages`") was adversarially verified and **REFUTED**: current docs state the omitted field defaults to the value of `can_send_messages`, which `unrestrictUser` sets true. All 13 Telegram methods used, all entity types parsed, `secret_token` webhook auth, granular permissions shape, Upstash REST endpoint styles, and CAS endpoint are current.

**Backlog (works fine — optional modernization, no unit created):**

| Item | Where | Note |
|---|---|---|
| Dead legacy `forward_from`/`forward_from_chat`/`forward_date` reads | `api/webhook.js:115,157,198` | Fields removed from Message since Bot API 7.0; `forward_origin` branch already handles everything — cleanup only |
| Unused `deleteMessages` helper / report flow does 2× `deleteMessage` | `lib/telegram.js:89`, `api/webhook.js:325+428` | Batch into one call or drop helper |
| Bot API 10.2 ephemeral messages could replace lazy auto-delete | `lib/state.js` scheduleAutoDelete | `receiver_user_id` + `deleteEphemeralMessage`; roadmap item |
| Bot API 10.1 `answerChatJoinRequestQuery` could move captcha into join-request flow | `api/webhook.js:85-104` | Roadmap item |
| Explicit `can_react_to_messages` / `can_edit_tag` in ChatPermissions | `lib/telegram.js:122-137` | Behavior already correct via documented defaults; `can_edit_tag` inherits the deliberate `can_pin_messages: false` — consistent with existing design |
| `node:timers/promises` sleep | `lib/telegram.js:36` | Supersedes Promise-wrapped setTimeout; not deprecated |
| `safeEqual` byte-length guard | `api/webhook.js:18`, `api/setup.js:11`, `lib/dashboardAuth.js:8` | Multibyte-input throw is unreachable (Telegram tokens are ASCII) |

## Gates for completion (Phase 7) — ALL PASSED 2026-07-15

- [x] Every non-SKIP unit at target version (chart.js 4.5.1 @ `c59e920`; node engines 24.x @ `6fa3660`); zero incomplete MIGRATION units.
- [x] Zero old-version references: greps for `4.4.7` / old SRI hit only this plan document.
- [x] `node --check` on all api/, api/dashboard/, lib/ files + `node --test`: 47 pass / 0 fail. (No build/lint exists in this repo.)
- [x] Phase 5 deprecation sweep: zero fix-now items (one candidate adversarially refuted; 7 backlog items recorded above).
- [x] Phase 6 regression sweep on changed files: zero new CRITICAL/HIGH; CSP + SRI independently re-verified.
- [x] `npm audit`: N/A — zero dependencies, no lockfile; supply-chain surface is the single SRI-pinned CDN file.
