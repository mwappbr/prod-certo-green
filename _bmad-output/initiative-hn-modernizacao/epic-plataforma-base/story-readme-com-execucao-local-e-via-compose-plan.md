---
title: 'README com execução local e via Compose'
type: 'chore'
ticket: '7'
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
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `README.md` currently contains only generic project/tool notes and does not let someone install, check, or start the application locally and with Compose, as required by RNF-08.

**Approach:** Expand the README in Portuguese with prerequisites, the npm workspace layout and exact root commands, local development and built-server steps, explicit environment loading, and a one-service Compose/health/shutdown walkthrough. Preserve the existing tool notes and describe the current port and environment behavior rather than implying unsupported loading or configuration.

</intent-contract>

## Implementation Notes

Oneshot is appropriate for a localized documentation change. Edit only `README.md` and this ticket plan; preserve the dirty tree and existing changes, and do not stage, commit, push, stash, reset, clean, or change harness settings. A parallel worker owns manifests, application code, Compose-adjacent implementation dependencies, and e2e; do not edit those files or run root build/check commands against its intermediate state.

Investigation facts for the README: root workspaces are `shared/`, `server/`, and `client/`; root scripts include `dev`, `typecheck`, `lint`, `test`, `check`, `build`, and `start`. `npm run check` runs typecheck, lint, Vitest, and `scripts/check-theme.mjs`; `npm run build` builds shared, server, then client; `npm start` starts the built server. `npm run dev` builds shared and starts server plus Vite. Vite serves port 5173 and proxies `/api` to server port 3000. Node must be >=24; install dependencies with root `npm ci`.

Node does not automatically load `.env`; show exporting the copied `.env.example` values into the shell (for example, `set -a; . ./.env; set +a`) before local npm commands. Compose loads `.env` for interpolation, but only `HOST_PORT` is interpolated; its service explicitly sets `NODE_ENV=production` and fixed container `PORT=3000`. Document host mapping default 3000 and `HOST_PORT` override, health at `/api/health`, SPA at `/`, and `docker compose down`. Do not imply other `.env` settings are passed into the container.

Ticket 1.7 is HITL: final verification requires a person in a clean environment to follow both README paths. Do not simulate or claim that acceptance. If no human performs it, retain a pending-human/blocked outcome even if documentation preparation and safe checks pass.

Implementation (2026-10-11): expanded only `README.md`, retaining the existing project heading and tool-install notes. Added Node/npm and Docker prerequisites, workspace/script map, `npm ci`/`npm run check`/build commands, local development and built-server steps, explicit shell export of `.env`, Compose single-service health/smoke/shutdown steps, and the distinction between host `HOST_PORT` and container `PORT=3000`. Clarified that Compose interpolates `.env` but currently only passes `NODE_ENV` and `PORT` into the app. No application, manifest, Compose, or worker-owned files were changed. Human clean-environment acceptance remains pending.

## Verification

**Commands:**
- `git diff --check -- README.md` -- expected: no whitespace errors in the edited README.
- Do not run `npm run check`, root builds, or a new Compose runtime/build during the parallel worker's intermediate state; use the recorded 1.5/1.6 baseline only as historical evidence, not as this ticket's acceptance.

**Manual checks (if no CLI):**
- Pending: a person follows the README on a clean environment, starts the app by local development and Compose, and confirms `/api/health` and the SPA both respond. This is the ticket's full acceptance criterion and cannot be asserted by the agent.

## Auto Run Result

- Summary: Prepared the local, production-local, check, and Compose README instructions; ticket 1.7 remains blocked and is not marked complete.
- Files changed: `README.md` — setup, scripts, environment handling, local/Compose run, smoke, and shutdown instructions; this plan — investigation, constraints, and result.
- Late review report (received after the workflow halted): the quick reviewer said the README guidance matched the project configuration it checked; it also noted the whole-tree diff contains application/tooling changes outside 1.7 and confirmed clean-environment acceptance remains pending. The extra diff files were already present in the starting dirty tree or owned by parallel work; this ticket changed only `README.md` and this plan. Because the available Agent tool launched asynchronously while the workflow required a synchronous/blocking review, this late result is recorded but does not constitute a completed review/triage pass; no formal findings disposition or Review Triage Log is claimed.
- Follow-up review recommendation: false (formal review/triage remains incomplete; ticket is blocked on human acceptance and synchronous review constraints).
- Verification: `git diff --check -- README.md` passed. Root `npm run check`, root builds, and a new Compose run were not run because worker 2.1 owns the intermediate source state. A person still must follow both README paths in a clean environment and verify the SPA and `/api/health`; that required human check has not been performed. Earlier 1.5/1.6 checks are historical evidence only.
- Residual risks: clean-environment human acceptance, root executable checks, and a review that can be completed synchronously remain outstanding. No files were staged or committed.
