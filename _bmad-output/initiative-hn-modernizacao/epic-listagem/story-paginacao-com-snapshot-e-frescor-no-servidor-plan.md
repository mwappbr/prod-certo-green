---
title: 'Paginação com snapshot e frescor no servidor'
type: 'feature'
ticket: 3
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md'
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `GET /api/stories` currently accepts only `top` and page 1, so consumers cannot append pages from a stable category list. The cache already retains expired values and the response already has `snapshot`, `cachedAt`, and `stale`, but the use case does not bind later pages to the first-page list or return `SNAPSHOT_EXPIRED` when that snapshot is no longer available.

**Approach:** Complete backend category pagination using offsets in the original HN ID sequence and the existing `StoriesPage` envelope. Page 1 uses a fresh list or refreshes an expired one with stale fallback; a continuation reads only the requested retained snapshot, marks expired data stale, and fails with the existing `SNAPSHOT_EXPIRED` code when absent or replaced. Verify cache-call counts and the specified six-category latency benchmark without changing shared contracts.

## Boundaries & Constraints

**Always:** `app/` remains the only cache reader/writer and owns cache keys/TTLs; preserve each category's ID order and page offsets before item filtering; retain current `StoriesPage`, `SNAPSHOT_EXPIRED`, and config defaults; return no mandatory `total` or `hasMore` field; a short page such as 29 valid items from 30 IDs is not proof that the sequence ended.

**Never:** Write `client/`, `e2e/`, shared contracts, manifests/lockfiles, or `execution-progress.md`; do not start 2.5 or 2.6, add a total requirement, or move cache access into HTTP/adapter code. Do not stage, commit, push, publish, or alter the active branch. The human risk check in ticket Notes is not performed by this agent; record that fact without blocking automated work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First page | page 1 without snapshot; list missing or fresh | Return first `limit` IDs' valid stories in source order; response snapshot is that list entry's `cachedAt` | HN failure may use retained stale list; otherwise existing upstream error |
| Repeated fresh read | Same category within list TTL | Reuse cached ID list; only one upstream list fetch | No error expected |
| Stable continuation | page > 1 with snapshot matching retained entry | Slice the same ID list at `(page - 1) * limit`, preserving order and snapshot | No HN list refresh |
| Retained expired continuation | Matching entry is past TTL but inside retention | Serve the same sequence with `stale: true` | No HN list refresh |
| Invalid continuation | page > 1 without snapshot, or invalid page/limit | Reject before HN access | `BAD_REQUEST` |
| Missing, replaced, or retention-expired snapshot | Snapshot absent from cache or does not match the current entry | Do not silently switch sequence | `SNAPSHOT_EXPIRED` |
| Short filtered page | One ID in a 30-ID slice resolves to no story | Return 29 stories and keep the next page offset at ID slot 31; add no total/end signal | No error expected |
| Warm performance | Six categories warmed, then 30 sequential injects each | 180 serialized Fastify responses; p95 < 1 s and one upstream list fetch per category | Record actual p95 and call counters |

</intent-contract>

## Code Map

- `server/src/app/get-stories.ts` — `getStories` currently rejects pages other than 1 and slices only from offset zero; centralize snapshot selection, freshness, fallback, and original-ID offsets here.
- `server/src/app/cache-keys.ts`, `server/src/ports/cache.ts`, `server/src/adapters/cache/memory-cache.ts` — existing single list key, `getWithStaleness`, TTL and retention behavior; reuse unchanged unless tests prove a defect.
- `server/src/http/routes/stories.ts` — currently rejects every category except top and parses page/limit; add category and snapshot query handling while leaving cache out of HTTP.
- `server/src/main.ts` and `server/src/config/index.ts` — server wiring and validated defaults (30/50, list 60s, item 120s, retention 15m); inspect for reuse, do not change without evidence.
- `shared/contract/stories.ts` and `shared/contract/health.ts` — AD-3 envelope fields and `SNAPSHOT_EXPIRED`; a narrow coordinator-approved `ListingItem = Story | Job` extension widens only `StoriesPage.items`, leaving `ItemResponse` and comment contracts unchanged.
- `server/test/stories-route.test.ts`, `server/test/app-cache-fallback.test.ts`, `server/test/memory-cache.test.ts` — existing Fastify injection, stale fallback, and retention coverage; extend or reuse.
- `server/test/helpers/hn-stub.ts` — deterministic local HN endpoint fixture/counters from ticket 2.2; use for adapter integration where appropriate.

## Tasks & Acceptance

**Execution:**
- [x] `server/src/app/get-stories.ts` — implement snapshot-aware page selection and ID-offset slicing while keeping cache I/O and writes in `app/`; coordinator-approved projection includes normalized Job items and excludes comments.
- [x] `server/src/http/routes/stories.ts` — accept all six categories and optional snapshot, preserving query validation and the shared error envelope.
- [x] `server/test/stories-route.test.ts` and `server/test/app-cache-fallback.test.ts` — cover stable pages, replaced/expired snapshots, stale continuation/fallback, category paths, Job projection, malformed item behavior, and upstream-call counts.
- [x] `server/test/stories-performance.test.ts` with backend-only test helpers if needed — warm each category's first page, run 30 sequential `inject` requests per category, time through serialized response using real `performance.now()`, assert all warm and 180 measured responses are 200/fresh/non-empty, and verify latency/counters.
- [x] Record actual benchmark numbers and operational caveats in this plan; preserve the user-owned risk check as not performed.
- [x] Review follow-up (exclusive writer: `adde1`): finish the controlled barrier/deferred-gate regression by bounding the barrier wait and releasing the deferred fetch in a `finally` inside the `withApp` action, before app close. The gate proves both requests entered the cold-path `fetchList` before release, with equal snapshots, one publication, and valid continuation. A controlled pre-fix in-memory probe now reproduces the differing-snapshot RED; the original race reviewer verified the gate, cleanup, and probe evidence. Preserve existing TTL/stale-fallback semantics; production code remains unchanged.
- [x] Review test follow-ups (exclusive writer: `adde1`): assert unsupported category returns 400 `BAD_REQUEST` with zero total HN requests, and item-fetch upstream failure without stale data returns 502 `UPSTREAM_UNAVAILABLE`. The total-request assertion now counts every HN-stub path; targeted route tests/typecheck passed, with route-review recheck and post-follow-up root check pending.

**Acceptance Criteria:**
- Given a first page with `snapshot`, when a later page uses it while the same list entry is retained, then the response uses the original ID sequence and identical snapshot without another HN list call.
- Given concurrent first-page requests that all miss the cold list cache but share one fetched ID list, then all responses use the same published snapshot and a continuation with that snapshot succeeds.
- Given a continuation whose snapshot is missing, replaced, or beyond retention, when requested, then the server returns `SNAPSHOT_EXPIRED` without substituting a newer list.
- Given a list past TTL but within retention, when a matching continuation is requested, then it uses that snapshot and sets `stale: true`; when page 1 refresh fails, the existing stale fallback remains available.
- Given a 30-ID page with one invalid item, when serialized, then 29 stories are returned and a subsequent page begins at the next 30-ID offset; no `total` is required or inferred from response length.
- Given the benchmark protocol, when run against the local deterministic HN client, then all six categories are warmed, exactly 180 sequential measurements are recorded, each category issues one list fetch within TTL, and observed p95 is below 1 second.
- Given the architecture, when cache operations occur, then only `app/` reads/writes the cache and centralizes cache keys/TTLs; AD-3 envelope fields remain stable, with the coordinator-approved additive `ListingItem` response union as the sole shared-contract scope change and frontend-owned files untouched in this ticket.

## Implementation Notes

- Implemented category-wide list pagination from the original ID sequence, with snapshot matching against the retained `list:CATEGORIA` entry. Matching expired snapshots continue as stale; missing/replaced/retention-expired snapshots return `SNAPSHOT_EXPIRED`; page 1 still refreshes expired lists with the existing stale fallback.
- Coordinator-approved RF-01 representation extension (2026-10-11): `shared/contract/stories.ts` exports `ListingItem = Story | Job`; `StoriesPage.items` uses `ListingItem[]` while AD-3 envelope fields and `ItemResponse`/`CommentsResponse` remain unchanged. `getStories` includes normalized stories and jobs, while excluding comments. `Job.type` remains `job`; `score` is actual source data or `null` when absent (never synthesized as `0`). Fixture Job 106 is returned with its normalized HTTPS URL/domain and truthful nullable metadata.
- Corrected local-stub benchmark: all six warmups and all 180 measured sequential `app.inject` responses were HTTP 200, `stale: false`, and non-empty. The benchmark uses real `performance.now()` and excludes malformed ID 103 by overriding top IDs to `[101, 102]`. Summed measured request duration: 4.35 ms; full sequential window: 5.96 ms; nearest-rank aggregate p95: 0.04 ms. Diagnostic per-category p95 (ms): top 0.10, new 0.03, best 0.03, ask 0.03, show 0.03, job 0.03.
- Upstream counters remained unchanged after warmup: one list fetch per category (top/new/best/ask/show/job); one item fetch each for IDs 101, 102, 104, 105, and 106. ID 103 remains covered separately by the route regression, where malformed data is refetched rather than negatively cached; cache semantics were not changed.
- Operational caveat: these measurements cover Fastify `inject` and the deterministic local stub only, not network latency or production contention. These initial shared build, server typecheck, and targeted backend-test results (3 files, 19 tests), plus the initial coordinated root pass, predate the concurrent cold-list correction; see Verification for post-fix evidence and remaining gates.
- User-owned risk check: not performed by this agent, per the plan boundary.

## Plan Change Log

- 2026-10-11 — Coordinator approved a narrow additive RF-01 extension: `ListingItem = Story | Job` and `StoriesPage.items: ListingItem[]`. This preserves AD-3 envelope fields, `ItemResponse`, and comment contracts; no other shared-contract changes are in scope.
- 2026-10-12 — Technical delivery gates completed under the coordinator’s NON-HITL bridge: cold-list race fix and test-only follow-ups reviewed; controlled RED/GREEN/missing-signal probes documented under `verification/cold-list-race-prefx-20261011/`; final coordinated root check passed 11 files / 55 tests. Set `status: built` for technical handoff only. Formal BMad review metadata remain blank, human risk check/HITL gates remain not performed, and the story is not marked `done` or accepted.

## Review Triage Log

- 2026-10-12 — Formal BMad high-risk workflow remains incomplete. The rendered workflow has no supported headless/subworkflow path; Step 1 requires a human-turn HALT checkpoint and Step 2 requires synchronous/blocking lenses. No new human response was received for that checkpoint; the coordination-authored “Pode preparar/lançar revisão independente” message was not treated as human confirmation. Independent asynchronous technical reviews did run, but are not a formal BMad sign-off. The accepted fixes, focused rechecks, and final coordinated root check are now complete; `status: built` is used solely for the authorized technical handoff, not formal review, human acceptance, `done`, or accepted. The human risk check remains not performed; formal review metadata and HITL gates remain unfilled.
- Coordination's NON-HITL operational assumption: after the accepted fix, real asynchronous independent technical reviews, triage/recheck, and a new consolidated root pass, technical delivery may be handed off as `built`/review without claiming the formal manual/synchronous BMad workflow or human acceptance is complete. This does not create a human response, fill any formal metadata requiring the human checkpoint, or alter HITL gates 1.7/4.5/4.6 or the human risk check. This is an orchestration assumption from coordination, not human confirmation.
- Technical lens findings, triaged read-only:
  - **Accepted medium — concurrent cold-list snapshot overwrite (`server/src/app/get-stories.ts:61-75`):** multiple requests can miss before `await fetchList()` and then each write the shared list. The production HN client single-flights the upstream call, but not the post-await cache writes. If those writes cross a millisecond boundary, an earlier first-page response's `snapshot` is overwritten and its continuation fails with `SNAPSHOT_EXPIRED`. Coordination accepted this finding and assigned `adde1` as the exclusive writer for `getStories` and backend tests. Required sequence: add a deterministic RED regression first; prove two concurrent first-page responses share the same snapshot and a continuation using it succeeds; then, after the await, reuse a fresh entry already published instead of writing it again. Preserve current TTL and stale-fallback behavior.
  - **Accepted low — category validation test gap:** add route coverage that an unsupported category returns 400 `BAD_REQUEST` without an HN list request.
  - **Accepted low — item-fetch failure test gap:** add route coverage that an HN item-fetch failure with no stale item returns HTTP 502 and the public `UPSTREAM_UNAVAILABLE` envelope.
- Rejected as false or non-actionable after checking the cited code and plan: production HN list requests are already single-flighted by `HnApiClient`; snapshot selection is scoped by the requested category's cache key and uses the documented `cachedAt` token; stale/replaced snapshots are explicitly expected to fail continuation with `SNAPSHOT_EXPIRED`; offset calculation uses the requested page limit and the plan does not bind a limit to a snapshot; factoring identical `Story`/`Job` fields has no demonstrated runtime or caller harm. Intent-alignment observations were also rejected: the `ListingItem = Story | Job` change is explicitly coordinator-approved in the change log; the performance protocol measures warmed first pages; and cache efficiency is verified through per-category upstream request counters in the deterministic stub benchmark.
- Handoff contract for 2.5: use the `snapshot` field from the `StoriesPage` response as the continuation token; never substitute `cachedAt`. A temporary live-smoke driver that assumed the values were equal failed, and only the driver was corrected; the two ISO fields are distinct valid values.
- Post-fix review/recheck (2026-10-11): the race-focused review and separate focused code review found no production correctness issues. Coordination accepted a low deterministic-test finding: the race regression used a 20 ms stub delay; the observed pre-fix RED is concrete under that timing, but does not establish a barrier-controlled deterministic baseline. Adde1 has replaced the timed overlap with a deferred fetch gate in the test/helper only; its targeted route suite (11/11) and server typecheck reportedly pass. The original race reviewer confirmed the gate proves both cold-path callers entered before release and identified the cleanup issue. Adde1 added a bounded deadline/test timeout, immediate promise-result capture, and in-action release/drain before app close; targeted route tests and typecheck pass by writer report, and the original race reviewer confirmed the cleanup/determinism correction with no residual finding. The controlled pre-fix probe was actually executed with a temporary Vitest config that verified one exact source match and transformed only the post-await recheck in memory; logs show the expected snapshot mismatch. A suppressed-signal probe also hit the intended timeout and exited cleanly. See the specific outputs in `verification/cold-list-race-prefx-20261011/`; do not claim the production source was edited or that this was a separately performed full-root run. The route-focused review initially found that unsupported-category coverage checked only `/v0/topstories.json`, not total HN calls. The authorized helper/assertion-only correction now increments `totalRequests` before dispatch for every HN-stub path and asserts `totalRequests === 0`; targeted route test (1 file / 11 tests) and server noEmit typecheck passed, and the original route reviewer confirmed the finding closed with no new issue. The post-fix root pass is recorded above but predates these test-only follow-ups, so a fresh coordinated root check is required after they are complete (build/E2E product code is unchanged). This agent's scope remains plan/recheck, not backend code; no code patch or local check/build/E2E was made here. Do not edit shared/client/E2E/manifests or start ticket 2.6.

## Design Notes

A snapshot is the cached list entry's existing `cachedAt`, not a new token or a second cache key. For any supplied snapshot, serve only an entry whose timestamp matches; for page > 1 without a snapshot, reject rather than silently restarting. Stale continuation may use a retained expired entry without refreshing it, so later pages cannot switch sequences mid-scroll. Item filtering happens after list slicing; the server must not emit or require a total/end signal.

Benchmark timing begins immediately before each sequential `app.inject` and stops after Fastify returns the serialized payload. Warm-up calls are excluded from the 180 measured requests. Use nearest-rank p95 (`ceil(0.95 * 180)`) and record measured duration, p95, per-category list counts, and item counts.

## Verification

**Executed with Node v24.21.0 after the Job projection:**
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run build -w @hn/shared` — passed.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run typecheck -w @hn/server` — passed.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npx vitest run server/test/stories-route.test.ts server/test/app-cache-fallback.test.ts server/test/stories-performance.test.ts --reporter=verbose --silent=false` — passed, 3 files / 19 tests. Corrected benchmark: 180 fresh, non-empty responses; 4.35 ms summed request duration, 5.96 ms sequential window, aggregate p95 0.04 ms; one list fetch per category and one fetch each for valid item IDs 101, 102, 104, 105, 106.

**Pre-fix coordinated root verification (2026-10-11; baseline HEAD before the concurrent-write fix):** Node v24.21.0 / npm 11.19.0; `npm run check` passed (shared/server/client typecheck, server lint, 11 Vitest files / 52 tests, theme contrast); root `npm run build` passed; root `npm run e2e` passed (6/6). Runtime, check, build, and E2E logs are in `_bmad-output/initiative-hn-modernizacao/verification/window-2-3-2-4.t3LFCh/`. This is coordination-run automated verification for the pre-fix source only, not human acceptance or a human risk check.

**Post-fix coordinated root verification (2026-10-11; after concurrent cold-list fix, before test-helper assertion follow-up):** Node v24.21.0 / npm 11.19.0; `npm run check` passed all shared/server/client types, server lint, theme checks, and 11 Vitest files / 55 tests; root `npm run build` passed for 3 packages; root `npm run e2e` passed 9/9. Logs are in `_bmad-output/initiative-hn-modernizacao/verification/window-2-3-2-4-postfix.pKi1IC/`. This verified the production race fix before the test-only assertion/barrier follow-ups; final post-follow-up verification appears next.

**Final coordinated root check after test-only follow-ups (2026-10-12T03:13:07Z):** Node v24.21.0 / npm 11.19.0; 11 Vitest files / 55 tests, shared/server/client types (including noEmit test config), official server lint, and theme contrast all passed. Logs are in `verification/window-2-3-2-4-testfollowups.D0z78X/`. Build/E2E were not rerun in this check because production code was unchanged; the latest production build and E2E 9/9 pass are in `_bmad-output/initiative-hn-modernizacao/verification/window-2-3-2-4-postfix.pKi1IC/`, and the post-production-fix live-app smoke is documented above.

**Pre-fix coordinated live-HN smoke (2026-10-11; compiled six-category listing before the concurrent-write fix):** result at `_bmad-output/initiative-hn-modernizacao/verification/live-categories-2-3-2-4.YuIvIh/result.json`; official HN data returned 30 rows in each of six categories, including 30 Jobs items (`type: job`), with first raw Job ID 50042330 (`type: job`, source score 1). Category URL/tab/heading/metadata and scroll-reset checks passed; mobile width was 320px with a 320px document; console errors, HTTP errors, and failed requests were empty; seven screenshots were inspected. A separate 180-sample sequential local-HTTP warm check reported all responses fresh/non-empty and stable snapshots, aggregate p95 0.77 ms (top 1.48, new 1.08, best 0.45, ask 0.61, show 0.77, job 0.65 ms). This is HTTP/body-decode timing on previously visited page-1 snapshots, not a browser-interaction p95; live upstream request counters were not instrumented. The first temporary driver failed because its author incorrectly assumed `snapshot == cachedAt`; only the driver was corrected, and the two ISO timestamps are distinct valid fields. Do not treat this as human clean-process acceptance or a human risk check.

**Post-fix live-app smoke (2026-10-11):** coordinator ran the built app on Node v24.21.0 via local port 3000 with an initially empty cache. All six categories returned 30 rows, including raw Job 50042330 (`type: job`, source score 1); category URLs/tabs, scroll behavior, freshness, and 320px Jobs layout/document width were checked. Seven PNG screenshots were opened and inspected; expected single visual instances were confirmed. A separate 180-sample sequential real-HTTP/JSON-body measurement reported fresh, non-empty responses and stable snapshots, aggregate p95 0.49 ms (top 1.48, new 0.45, best 0.35, ask 0.30, show 0.82, job 0.30 ms). Console/page/HTTP/request errors were zero; the browser used only the BFF. Evidence: `_bmad-output/initiative-hn-modernizacao/verification/live-categories-2-3-2-4-postfix.4MjGru/`. This is not an interaction p95, did not instrument live HN upstream counters, and is not a human risk-check repeat. The coordinator deliberately stopped the server after inspection.

**Post-fix focused verification and review:** the concurrent snapshot test was run RED before the production edit and failed with snapshots `2026-10-11T12:00:00.000Z` versus `2026-10-11T12:00:01.000Z`; after the fix, the targeted route/fallback/performance suite passed 3 files / 22 tests, and server typecheck passed. Updated deterministic-stub benchmark: 180 fresh/non-empty responses; 4.26 ms summed duration; 5.79 ms full window; aggregate p95 0.04 ms (top 0.10, new 0.03, best 0.03, ask 0.03, show 0.02, job 0.03); one list call per category and one item call each for 101, 102, 104, 105, 106. The post-fix root pass appears above. The helper now counts total HN requests across all paths, and unsupported-category coverage asserts `totalRequests === 0`; the targeted route test passed 1 file / 11 tests, server noEmit typecheck passed, and the original route reviewer confirmed the finding closed with no new issue. Race-focused review and a separate code-review pass found no production correctness issues. The coordinator accepted a low deterministic-test finding: the earlier race regression used a 20 ms delay, so the recorded pre-fix RED was concrete under that timing but does not establish a barrier-controlled deterministic baseline. Adde1 has now replaced the timed overlap with a deferred fetch gate; it reports the route suite passed (11/11) and server typecheck passed. The original race reviewer confirmed that the gate proves both cold-path callers entered before release. The cleanup correction is now present: a 4-second barrier deadline, 8-second test timeout, immediate `Promise.allSettled` handlers for both injects, and gate release/drain inside the `withApp` action before app close. Adde1 reports the final route suite passed (11/11) and server typecheck passed. The original race reviewer confirmed cleanup/determinism is fixed, with no residual finding. The isolated controlled probe evidence is in `verification/cold-list-race-prefx-20261011/`: a pre-fix in-memory transform matched the post-await fresh-entry block exactly once and produced the expected differing snapshot RED (1 failed / 10 skipped, 2.13s); normal config passed the test (1 / 10 skipped, 2.14s); a suppressed-signal probe hit the intended bounded timeout and exited cleanly (1 failed / 10 skipped, 2.12s). No production source was edited by these probes. The final 55-test post-follow-up root check is recorded below and passed. Technical handoff may be recorded as `built`/review under the coordinator's NON-HITL bridge, without asserting formal BMad review, human acceptance, a human risk check, or marking the story `done`/accepted.

The independent technical lens results and the formal workflow limitation are recorded in Review Triage Log below.
