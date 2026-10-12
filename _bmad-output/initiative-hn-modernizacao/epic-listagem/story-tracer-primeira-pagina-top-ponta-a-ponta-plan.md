---
title: 'Tracer: primeira página top ponta a ponta'
type: 'feature'
ticket: 1
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'Passed after triage; all findings remediated'
review_source: 'Thorough high-risk read-only review and supplemental triage'
lenses_ran: ['correctness', 'reliability', 'testability']
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md'
  - '/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The application is currently a blank SPA with only health infrastructure, so readers cannot see the first normalized Hacker News listing or verify its client/server contract.

**Approach:** Deliver the first top-stories vertical slice: shared response contracts, an HN adapter and domain normalization, app-owned memory caching, `/api/stories`, and a token-based React top listing. Add local HN fixtures and a Playwright runner that exercise the slice offline.

## Boundaries & Constraints

**Always:** Follow AD-1 layering; raw HN schema/parsing stays in `server/src/adapters/hn`; domain normalization decodes text entities, validates only HTTP(S) URLs, and sanitizes HTML before app caching. `app/` alone reads/writes cache and defines `item:<id>` / `list:<category>` keys. `fetchItem` must support normalized story/comment/job items for future reuse; no adapter cache and no raw or unsanitized HTML cache. Keep shared response types single-sourced in `shared/contract`; the browser accesses only `/api` through typed API hooks and a `ListingProvider`. Consume existing server config defaults and `client/src/theme.css` tokens. All visible copy is PT-BR. Use Node 24, preserve existing dirty changes, and do not commit or push.

**Never:** Implement the other five tickets, category navigation beyond the top tracer, story/detail/comment routes or UI, automatic pagination, auth, votes, persistence, search, new design tokens, or CI. Do not hardcode client page-size defaults, expose HN wire fields, or introduce another cache writer.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First top page | `GET /api/stories` with fixture IDs/items | Return `StoriesPage` with normalized top items and effective page/limit/snapshot/cachedAt/stale fields | No upstream fields leak |
| Optional/invalid HN item | Missing optional fields or one malformed ID/type | Missing values normalize safely; malformed item is isolated and skipped | Do not fail the whole page |
| Repeat item lookup | Same item ID within item TTL | Return normalized cached item; one HN fetch total | Cache miss follows adapter error mapping |
| Upstream failure | Fixture timeout or unavailable response, no usable cache | Keep UI usable and show PT-BR retry error | Return shared `UPSTREAM_TIMEOUT` or `UPSTREAM_UNAVAILABLE` envelope |

</intent-contract>

## Code Map

- `server/src/main.ts` -- current composition root exports `createServer`; wire the cache, HN adapter, story use case and route here, preserving explicit imports and its health/static boot.
- `server/src/ports/cache.ts` and `server/src/adapters/cache/memory-cache.ts` -- minimal `size()` placeholder; extend as generic TTL/stale-retention store, but only app code may use its read/write methods.
- `server/src/http/errors.ts`, `server/src/http/routes/health.ts`, `server/test/http-app.integration.test.ts` -- preserve central error envelope and `createServer` injection style when registering `/api/stories` and integration tests.
- `server/src/config/index.ts` and `.env.example` -- validated page/cache/timeout/concurrency defaults already exist; consume rather than redeclare client defaults.
- `shared/contract/health.ts` and `shared/package.json` -- current shared error codes already include upstream/snapshot codes; add listing/item/comment response types through the shared contract export pattern.
- `client/src/main.tsx`, `client/src/App.tsx`, `client/src/theme.css` -- root imports existing tokens, App is blank; keep the token file/checker intact and build the first top view against those variables.
- `package.json`, `server/package.json`, `vitest.config.ts`, `server/test/` -- platform check/build and Vitest harness already exist; add only the runner/dependencies and tests needed for ticket 2.1.
- `client/src/api/`, `client/src/features/`, `e2e/` -- not present; introduce typed API/hooks/provider, top listing, and local fixture-backed Playwright coverage here.

## Tasks & Acceptance

**Execution:**
- [x] `shared/contract/` -- define `Story`, `CommentNode`, `StoriesPage`, `ItemResponse`, and `CommentsResponse` once, with normalized union item types and typed shared API errors.
- [x] `server/src/domain/`, `server/src/ports/`, `server/src/adapters/hn/` -- normalize parsed HN records, support all six list endpoint names in the port seam, bound concurrency, timeout and retry requests, and single-flight identical fetches; support item union story/comment/job.
- [x] `server/src/ports/cache.ts`, `server/src/adapters/cache/memory-cache.ts`, `server/src/app/` -- implement generic TTL plus stale retention and centralized item/list keys; make app use cases the only cache reader/writer and cache normalized sanitized values.
- [x] `server/src/http/`, `server/src/main.ts`, `server/test/` -- add first-page top endpoint, central typed error mapping, and unit/integration/performance checks without disturbing health behavior.
- [x] `client/src/api/`, `client/src/features/`, `client/src/App.tsx`, `client/src/` styles -- add API-only hooks and error translation, a root ListingProvider, and accessible top rows with metadata, freshness, loading, empty, error/retry states using existing tokens.
- [x] `e2e/`, `playwright.config.ts`, root `package.json` and lockfile -- add reusable local HN fixture server, Playwright command `npm run e2e`, and offline top-page scenario; include deterministic warm-cache p95 measurement.

**Acceptance Criteria:**
- Given the local HN fixture returns top IDs and item JSON, when the user opens the SPA, then the top list shows normalized title, score, author, relative time, comments and optional domain without exposing HN wire fields.
- Given repeated `fetchItem` calls for the same ID within TTL, when the local adapter call count is inspected, then exactly one HN request occurred and the app cache contains only normalized/sanitized values.
- Given malformed or optional HN fields, when the top list is fetched, then malformed entries are skipped individually and absent values do not fail the page.
- Given an upstream timeout or failure without cached data, when the user loads or retries the top page, then the UI remains usable and shows a PT-BR retry state backed by the shared error envelope.
- Given the Playwright fixture runner and warmed top-page cache, when `npm run e2e` runs offline, then the first-page path is exercised and reproducible warm-cache p95 remains below 1 second.
- Given the platform health route and static SPA behavior, when the server test suite runs, then `/api/health`, centralized errors, and SPA fallback still pass.

## Implementation Notes

- Shared types in `shared/contract/stories.ts` cover Story, Comment, Job, CommentNode, and the StoriesPage/ItemResponse/CommentsResponse envelopes; relative-time formatting is exported from the shared package.
- `adapters/hn` owns wire schemas and all six HN list endpoint mappings. `normalize-item.ts` decodes text, limits links to HTTP(S), sanitizes comment HTML, and produces the normalized story/comment/job union. Requests use validated bounded timeout/retry/concurrency and in-flight deduplication.
- `MemoryCache` provides TTL plus stale retention. App use cases own the canonical `list:<category>` and `item:<id>` cache keys and cache only normalized records. The public route intentionally exposes only top page 1; later pagination/categories remain out of scope.
- The client uses typed `/api` access, abortable loading/error/retry states, and the existing theme tokens. Local reusable HN JSON fixtures drive both Vitest integration checks and the Playwright server.
- Verification coverage includes optional/malformed items, sanitizer and URL safety, cache expiry/stale fallback, HN category mapping/timeout/retry/concurrency/single-flight, public error mapping, cache call counts, warmed-cache p95 < 1 second, and UI retry behavior.
- Independent compiled-app browser verification passed on 2026-10-11: 29 stories rendered from the current official 500-ID top list, page 1/limit 30, snapshot=cachedAt, stale=false, health ok with 31 cache entries, no console/page/HTTP errors, localhost-only browser requests, and successful scroll-to-bottom/back-to-top. Evidence: `_bmad-output/initiative-hn-modernizacao/verification/2-1-live/result.json`, `listing-top.png`, and `listing-bottom.png`.

## Plan Change Log

- 2026-10-11: Implemented the authorized 2.1 top-listing vertical slice; kept later epic2 tickets and detail/comments UI deferred.

## Review Triage Log

- Thorough high-risk review completed. All six initial findings were fixed: stale fallback now applies only to HN request failures; HTTP 408/504 are retryable timeouts and 429 is retried within bounds; page freshness uses the oldest displayed data timestamp; `npm test` builds shared first; the warmed p95 fixture uses only valid IDs and asserts upstream calls remain cached; Playwright never reuses an unrelated local server.
- Supplemental triage confirmed malformed list IDs and titleless story/job records must be isolated; both now skip individually. Also hardened non-blocking risks by pruning expired cache entries during writes and returning the API not-found envelope for bare `/api` paths.
- Added regression tests for the findings. No ticket 2.2 work was started; its pagination handoff warning remains unchanged.

## Design Notes

Keep item retrieval generic at the application boundary: `HnClient` exposes `fetchList(category)` and `fetchItem(id)`; `fetchItem` yields a normalized `Story | Comment | Job`-capable union. The HN adapter parses raw JSON and delegates pure normalization; the app assigns canonical cache keys and owns all cache operations. Public response envelopes remain distinct from adapter wire records. Detail/comments routes remain for epic3.

**Epic2.5 handoff:** A request for 30 source IDs can render only 29 stories after unavailable, malformed, or non-story items are skipped. Do not infer end-of-list from `items.length < limit`; pagination/recovery must use the source-ID snapshot/cursor and continue past filtered records.

## Verification

**Commands:**
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run check` -- passed after review fixes: typecheck, lint, 42 Vitest tests, and light/dark token contrast checks. Bare `npm test` also passed and builds `@hn/shared` first.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run build` -- passed: shared, server, and client production builds.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" npm run e2e` -- passed: 2 Playwright scenarios using the local fixture server; no public HN dependency. Warm-cache integration test uses valid fixture IDs, asserts no repeated upstream calls, and measures p95 < 1 second.
- `PATH="/Users/maurowidman/.vite-plus/js_runtime/node/24.21.0/bin:$PATH" node --input-type=module -e '…'` -- passed bounded live HN smoke: 500 top IDs and first item normalized as a story.
- Coordinator's independent compiled-app browser check passed against `http://127.0.0.1:3000`; evidence is in `_bmad-output/initiative-hn-modernizacao/verification/2-1-live/`. It observed 29 rendered stories out of 30 requested slots from 500 source IDs, with `stale=false`, 31 cache entries, and no browser/network errors; the browser used only the localhost BFF and assets.
- High-risk review and triage are complete; all reported findings were either fixed or, for the cache-pruning and bare `/api` concerns, remediated as additional hardening. Ticket 2.1 is complete; no 2.2 implementation was started.

**Manual checks:**
- Coordinator navigated to the final rendered story and returned to the first story; screenshots were inspected and are saved in the evidence directory above.
