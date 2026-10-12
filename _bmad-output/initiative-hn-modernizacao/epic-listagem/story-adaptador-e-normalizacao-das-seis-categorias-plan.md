---
title: 'Adaptador e normalização das seis categorias'
type: 'feature'
ticket: 2
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md'
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The HN adapter already names the six list endpoints, but the reusable fixture currently exercises only one shared ID list, so category-to-endpoint behavior is not proven with distinct data. Normalization safety for optional fields and HTTP(S)-only URLs also needs explicit fixture-backed coverage across this ticket's adapter surface.

**Approach:** Give each category a small distinct list fixture and exercise all six mappings through the local stub. Expand focused normalization tests for absent optional fields and safe/unsafe URL schemes, retaining per-item isolation for invalid IDs and item records. Do not add category UI or public category routes; do not impose a universal list-size cap.

</intent-contract>

## Implementation Notes

One-shot is appropriate because the implementation already contains the six endpoint mappings and normalization boundary; the remaining work is a localized fixture/test expansion under 100 lines of code, with no application or UI design changes.

Operational workflow note: the clean-tree/staging gate was not run because the coordinator explicitly directed preserving the existing dirty tree and prohibited staging. The recorded baseline is current `HEAD`; retain branch `feat/plataforma-1-1-tracer` and do not switch branches, stage, commit, or push.

TDD confirmed the missing coverage: the first category-specific adapter run failed because the stub served the top list for every endpoint. The fixtures and stub now use distinct category lists, while the offline browser runner continues to use only the top fixture. Adapter fixture assertions cover an HTTP story, an FTP URL normalized to null, and a Job; domain tests exercise absent optionals plus accepted HTTP/HTTPS and rejected unsafe schemes. Existing 2.1 tests continue to cover malformed IDs and item isolation, so no adapter/domain production change was needed.

Files changed: `e2e/fixtures/hn-stories.json`, `e2e/start-server.mjs`, `server/test/helpers/hn-fixtures.ts`, `server/test/helpers/hn-stub.ts`, `server/test/hn-client.test.ts`, and `server/test/normalize-item.test.ts`. The full typecheck initially caught a fixture-map key type mismatch; the stub now declares its `Map<string, StoryCategory>` explicitly.

## Verification

**Commands:**
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run check` -- passed: typecheck, lint, 42 Vitest tests, and light/dark theme contrast checks.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run e2e` -- passed: both offline Playwright scenarios using the updated top fixture.

## Review Triage Log

### 2026-10-11 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none

## Auto Run Result

- **Summary:** Expanded reusable HN fixtures and adapter/domain coverage for distinct `top`, `new`, `best`, `ask`, `show`, and `job` lists; preserved isolated malformed-record handling and HTTP(S)-only URL normalization. No production adapter/domain changes, category UI, or public category routes were needed.
- **Files changed:**
  - `e2e/fixtures/hn-stories.json` — adds distinct IDs per category and representative optional, invalid, HTTP, FTP, and Job records.
  - `e2e/start-server.mjs` — keeps the offline browser runner on the top-category fixture.
  - `server/test/helpers/hn-fixtures.ts` — types the shared fixture by all six categories.
  - `server/test/helpers/hn-stub.ts` — routes category endpoint paths to their corresponding fixture lists.
  - `server/test/hn-client.test.ts` — asserts all category mappings and fixture-backed adapter normalization/isolation.
  - `server/test/normalize-item.test.ts` — covers absent optionals and accepted/rejected URL schemes.
- **Review:** Quick pinned review returned no findings. Patched: 0; deferred: 0; rejected: 0. Follow-up recommendation: `false` (patched counts: high 0, medium 0, low 0).
- **Verification:** Node 24 `npm run check` passed (typecheck, lint, 42 tests, theme checks); Node 24 `npm run e2e` passed (2 Playwright tests). Focused adapter/domain tests also passed (16 tests).
- **Residual risks:** Verification used local fixtures and did not call the live Hacker News API. No universal category limit was added; category-specific documented limits remain outside this fixture/test expansion.
- **Operational note:** Per coordinator instruction, no staging, commit, push, or branch change was performed; the existing dirty worktree is intentionally preserved.
