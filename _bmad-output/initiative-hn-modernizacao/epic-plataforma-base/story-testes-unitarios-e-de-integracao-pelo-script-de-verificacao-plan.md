---
title: 'Testes unitários e de integração pelo script de verificação'
type: 'feature'
ticket: '5'
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md'
  - '_bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Ticket 1.5 requires automated, repeatable unit and backend integration coverage as part of the local verification command. The repository has typecheck and lint scripts but no test runner or combined `npm run check`.

**Approach:** Add a root Vitest harness and deterministic tests for the existing pure configuration/health behavior, plus an in-memory Fastify integration test using `inject` for `/api/health` and the shared HTTP error/fallback behavior. Make server composition importable without listening, and compose `check` from typecheck, lint, and tests.

## Boundaries & Constraints

**Always:** Use the existing npm workspaces and Node 24.21 runtime available in this environment; keep tests offline and isolated from external HN services; use Fastify `inject` rather than binding a port; clean up temporary SPA fixtures; keep HTTP dependencies within the existing AD-1 boundaries and `main.ts` as the adapter-wiring composition root; retain a Node-only Vitest environment while discovering future shared/server/client test files. Preserve the dirty working tree and all pre-existing changes; no stash, reset, clean, commit, push, or harness-setting changes.

**Never:** Add Playwright/e2e or axe coverage (epic 2.1 owns browser e2e); introduce product features, remote-service dependencies, or CI; alter ticket definitions; touch the parallel 1.4 CSS/token files or its standalone script; discard pre-existing package manifest/lockfile changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid configuration | Empty or valid environment object passed to `loadConfig` | Defaults and explicit values are mapped to typed config | No error |
| Invalid configuration | Blank, out-of-range, or cross-field-invalid value | Throws a clear validation error naming the setting | Test the error without mutating process environment |
| Health request | Fastify app created in memory; `GET /api/health` through `inject` | HTTP 200 with `{ status: 'ok', cache: { entries: 0 } }` | No network listener |
| Unknown API route / thrown handler | Inject `/api/missing` or a test-only failing route | 404/500 with `{ error: { code, message } }`; internal detail is not exposed | Assert status and stable envelope |
| SPA route fallback | Temporary fixture contains `index.html`; inject an unknown non-API GET | HTTP 200 returns fixture HTML | Remove temporary fixture after test |

</intent-contract>

## Code Map

- `package.json` -- root npm scripts currently expose `typecheck`, `lint`, `build`, and `start`; add deterministic `test` and `check` scripts and the Vitest dev dependency.
- `package-lock.json` -- already has user changes from 1.2/1.3; update it through npm while preserving unrelated lockfile entries/deletions.
- `server/src/main.ts` -- currently creates Fastify, registers static serving, health and error handlers, then listens at module top level; extract an import-safe app factory while keeping adapter wiring and direct-start behavior here.
- `server/src/http/errors.ts` -- central AD-7 error mapper and API 404 / non-API SPA fallback; exercise its registered behavior through the factory, without changing its response contract.
- `server/src/http/routes/health.ts`, `server/src/app/getHealth.ts`, `server/src/adapters/cache/memory-cache.ts` -- existing health route/use case/cache scaffold; retain the `http -> app -> ports` direction.
- `server/src/config/index.ts` -- `loadConfig(environment)` is an injectable validation/mapping seam; cover defaults, explicit values, and representative invalid/cross-field input without process-environment mutation.
- `vitest.config.ts` -- new root configuration discovers future tests under `shared/`, `server/`, and `client/`; Node environment only, no browser DOM setup.
- `server/test/config.test.ts`, `server/test/get-health.test.ts`, `server/test/http-app.integration.test.ts` -- new pure/unit and Fastify inject coverage; integration fixture is temporary and network-free.

## Tasks & Acceptance

**Execution:**
- [x] `vitest.config.ts` -- configure a single offline Node-only runner that discovers workspace test files -- future server/shared/client unit tests use the same command without Playwright or DOM setup.
- [x] `package.json`, `package-lock.json` -- add Vitest and `test`/`check` scripts (`typecheck`, `lint`, then tests) -- `npm run check` fails on any constituent command failure.
- [x] `server/src/main.ts` -- expose an import-safe Fastify application factory with configurable static root/logger and only listen when run directly -- integration tests can inject requests without opening a socket.
- [x] `server/test/config.test.ts`, `server/test/get-health.test.ts` -- cover pure configuration mapping/validation and the health use case -- unit coverage is deterministic and uses no external services.
- [x] `server/test/http-app.integration.test.ts` -- exercise health, error envelope/not-found, internal-error redaction, and SPA fallback via `inject` -- proves the app's HTTP surface and cleans up fixtures.

**Acceptance Criteria:**
- Given dependencies are installed from the lockfile and no external service is available, when `npm run check` runs, then typecheck, lint, and all unit/integration tests complete successfully.
- Given any discovered test fails, when `npm run check` runs, then the command exits non-zero and reports the failing test.
- Given the in-memory server factory, when `GET /api/health` is sent through Fastify `inject`, then the response is HTTP 200 with the unchanged health contract.
- Given an unknown API route or internal handler failure, when injected, then the response uses the shared `{ error: { code, message } }` envelope and does not reveal internal details; a non-API GET serves the SPA fixture.

## Implementation Notes

Decision (user-authorized, 2026-10-11): preserve the existing dirty working tree and all pre-existing changes; the BMAD clean-tree/commit gates are explicitly waived. No commit, push, stash, reset, clean, or harness-setting change was performed.

Implementation: added Vitest 5.0.3 at the workspace root, a Node-only shared/server/client discovery config, root `test`/`check` scripts, and strict typechecking for server tests. `createServer` now returns an injectable Fastify app and only listens when invoked as the entry script. Unit tests cover config defaults/coercion/validation and `getHealth`; four Fastify `inject` cases cover health, 404/500 envelopes, error redaction, and SPA fallback. Once ticket 1.4's standalone checker was ready, `node scripts/check-theme.mjs` was added as the final `npm run check` step.

`npm install` completed with zero reported vulnerabilities and warned that install scripts for `fsevents` and `unrs-resolver` are not approved; no approval was changed.

## Plan Change Log

- 2026-10-11: After ticket 1.4 was ready, the coordinator authorized adding its standalone checker as an extra final step of root `npm run check`; its CSS/token files and checker source were not edited by this ticket.

## Review Triage Log

- Quick review (2026-10-11): completed with no findings after the reviewer retracted the preliminary scope finding upon clarification that the 1.4 files were pre-existing parallel work; the root check invocation was authorized. No corrective action or follow-up review is required.

## Design Notes

The server composition root is the existing exception to AD-1: keeping the factory there avoids moving Fastify or `@fastify/static` imports into a non-root layer. Tests import the factory, pass a temporary static directory, and explicitly close the returned Fastify instance.

## Verification

**Commands (Node 24.21.0, npm 11.19.0):**
- `npm run check` -- passed: shared/server/client typecheck (including `server/test`), server lint, 3 Vitest files / 9 tests, and `node scripts/check-theme.mjs`.
- Deliberately added a temporary failing assertion and ran `npm run check` -- failed non-zero with 1 failed test and 9 passing; removed only the probe and reran the full check successfully.
- `npm run build` -- passed: shared, server, and client production build; Vite transformed 16 modules.
- `git diff --check` -- passed.

No test contacts the external HN API or binds a listening port. Temporary SPA fixture directories are removed after each integration case.

## Auto Run Result

- **Outcome:** Built. The quick review completed with no findings after the reviewer retracted the preliminary scope concern; no implementation change was needed after review.
- **Scope/files:** Added the root Vitest config, root test/check scripts and dependency, strict server test typechecking, an import-safe Fastify factory, and three server test files. Updated this plan. Ticket 1.5 did not edit ticket 1.4's CSS/token files or checker source.
- **Review:** No findings. Follow-up review is not recommended.
- **Verification (Node 24.21.0, npm 11.19.0):** `npm run check` passed with 3 test files / 9 tests and the authorized ticket 1.4 checker. A temporary failing test probe made `npm run check` exit non-zero; it was removed and the full check passed again. `npm run build` passed (Vite transformed 16 modules). `git diff --check` passed after the implementation changes.
- **Residuals:** No tests call the external HN API or open a listening port. `npm install` warned that install scripts for `fsevents` and `unrs-resolver` were not approved; no approval was changed. The root check intentionally invokes ticket 1.4's checker under the coordinator's approval, so the final combined tree must include ticket 1.4's files.
