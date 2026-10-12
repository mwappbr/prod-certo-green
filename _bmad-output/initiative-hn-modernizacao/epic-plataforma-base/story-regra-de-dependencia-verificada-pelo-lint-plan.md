---
title: 'Regra de dependência verificada pelo lint'
type: 'feature'
ticket: '3'
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

Chosen oneshot for the localized flat-config, workspace scripts, and behavior probes. Decision (user-authorized, 2026-10-11): preserve the dirty working tree and the existing package-lock edits; do not commit, push, stash, reset, clean, or change harness settings. No CI in the MVP; expose local lint through `npm run lint` for the later `npm run check` script.

Investigation: source is under `server/src/{http,app,domain,ports,adapters}`; `server/src/main.ts` is the composition root and remains free to wire adapters and start the server. ESLint 10 is not supported by `eslint-plugin-import@2.32.0`, and the `@typescript-eslint/parser` peer range excludes TypeScript 7. Kept TypeScript 7 and used an ESLint-9-compatible Babel TypeScript parser plus the TypeScript import resolver.

Implementation (2026-10-11): added the server ESLint flat config and root/workspace `lint` scripts. `import/no-restricted-paths` enforces the AD-1 layer matrix, blocks layer imports of `server/src/main.ts`, and keeps `main.ts` outside layer targets. Core `no-restricted-imports` prevents Fastify and `@fastify/*` dependencies in app/adapters/domain/ports; the domain override also blocks Node I/O modules and common HTTP clients. Fastify remains permitted in `http/` and `main.ts`.

## Verification

**Commands (Node 24.21.0, npm 11.19.0):**
- `npm run lint` -- passed after probes were removed.
- `npm run typecheck` -- passed for shared, server, and client.
- `npm run build` -- passed for shared, server, and client; Vite transformed 15 modules.
- `git diff --check` -- passed.

**Behavior probes:**
- `Fastify` import from `server/src/app` -- lint failed with `no-restricted-imports`.
- `../main.js` import from `server/src/app` -- lint failed with `import/no-restricted-paths`.
- `node:fs/promises` import from `server/src/domain` -- lint failed with `no-restricted-imports`.
- After removing the temporary probes, lint passed with the real `server/src/main.ts` Fastify and `@fastify/static` imports, confirming the composition-root exemption. No probe files remain.
- Per the 1.5 contract, this story adds only standalone lint; it does not add the combined `npm run check` command or test-runner aliases. Epic 2.1 owns its Playwright e2e runner and fixtures.

## Review Triage Log

### 2026-10-11 — Quick review
- findings: 2; both patched; deferred 0; rejected 0.
- Fastify imports were not restricted in application layers -- added `no-restricted-imports` for `fastify` and `@fastify/*` across app/adapters/domain/ports; confirmed a probe fails and `main.ts` remains allowed.
- A layer could import `server/src/main.ts` and trigger composition/startup side effects -- added a `no-restricted-paths` zone covering all five layers; confirmed a probe fails.
- Domain I/O coverage was extended with a separate restriction for Node I/O APIs and common HTTP clients; `node:fs/promises` probe fails.

## Auto Run Result

- Summary: Added ESLint flat configuration to enforce AD-1 boundaries, the composition-root exemption, and restrictions on Fastify and domain I/O dependencies; exposed `npm run lint` at the root and server workspace.
- Files changed: `server/eslint.config.js`, root `package.json`, `server/package.json`, `package-lock.json`, and this plan. Pre-existing dirty changes were preserved.
- Review findings: patched 2; deferred 0; rejected 0. Follow-up review recommendation: false.
- Verification: Node 24.21.0/npm 11.19.0; `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. Probes confirmed prohibited Fastify, main.ts, and domain I/O imports fail lint; real composition-root imports still pass.
- Residual risk: domain I/O packages are explicitly listed in the lint rule; add new I/O clients to that list if introduced. Node 26.10.0 was unavailable, so verification used Node 24.21.0. No commit, push, stash, reset, clean, ticket-definition, or harness-setting changes were made.
