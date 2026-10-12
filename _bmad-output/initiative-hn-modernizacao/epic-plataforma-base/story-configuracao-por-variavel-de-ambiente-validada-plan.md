---
title: 'Configuração por variável de ambiente validada'
type: 'feature'
ticket: '2'
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md']
warnings: []
deferred: []
---

## Implementation Notes

Chosen oneshot because this is a localized config boundary and example-env change, under 100 lines of application code. Decision (user-authorized, 2026-10-11): preserve the existing dirty working tree and the pre-existing `package-lock.json` deletions; do not commit, push, stash, reset, clean, or change harness settings. Node 26.10 is unavailable; verification used the installed Node 24.21.0 runtime, not Node 26.10.

Implementation (2026-10-11): added Zod 4.6.6 and `loadConfig` for validated environment values, with testable defaults for the next stories; retained the `PORT` export for the tracer. Added `.env.example`. `npm install` reported zero vulnerabilities and warned that the `fsevents` install script is not yet approved; no approval was changed.

Verification (Node 24.21.0): `npm run typecheck` and `npm run build` passed; invalid `PORT` and blank `HN_RETRIES` both fail startup with the variable named; `.env.example` parses to the documented defaults; valid `PORT=33877` serves `/api/health` with HTTP 200 and the unchanged health response. Quick review found that blank `HN_RETRIES` would otherwise coerce to `0`; patched the shared integer parser to reject blank/whitespace values while allowing an explicit numeric `0` for retries.

## Verification

**Commands:**
- `npm run typecheck` and `npm run build` -- expected: both pass with strict TypeScript.
- Start with an invalid environment value -- expected: process exits non-zero and names the invalid variable in a clear validation error.
- Start with valid configuration and request `/api/health` -- expected: HTTP 200 and the health contract remains unchanged.

## Review Triage Log

### 2026-10-11 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `patch` Blank `HN_RETRIES` silently disabled the default retry — verified that Zod coercion converts an empty string to `0`, which passes the non-negative constraint; patched the shared integer parser to reject empty/whitespace strings while preserving an explicitly configured `0`.

## Auto Run Result

- Summary: Added Zod-validated, environment-backed server configuration and documented defaults for page bounds, cache TTLs/retention, Hacker News concurrency/timeout/retries, and comment depth/node limits.
- Files changed: `server/src/config/index.ts` — validation, defaults and typed config; `server/package.json` and `package-lock.json` — Zod runtime dependency (pre-existing optional-peer metadata deletions preserved); `.env.example` — default values; this plan — implementation/review evidence.
- Review findings: patched 1 low finding; deferred 0; rejected 0. Patched counts: high 0, medium 0, low 1. Follow-up review recommendation: false.
- Verification: Node 24.21.0 (`/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin/node`); `npm run typecheck` passed; `npm run build` passed; invalid `PORT` and blank `HN_RETRIES` startup attempts exited non-zero with clear variable names; `.env.example` produced all expected defaults and range/cross-field checks rejected invalid values; valid `PORT=33877` served `/api/health` with HTTP 200 and `{"status":"ok","cache":{"entries":0}}`.
- Residual risks: Node 26.10.0 was unavailable, so no verification is claimed on that runtime. `npm install` noted an unapproved optional `fsevents` install script; no harness setting was changed. Per the user's explicit decision, the reviewed changes remain uncommitted; no commit, push, stash, reset, or clean was performed.
