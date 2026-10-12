---
title: 'Categorias, metadados e estados da listagem'
type: 'feature'
ticket: 4
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md'
  - '{project-root}/_bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md'
  - '{project-root}/_bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The listing currently defaults to `top` in local React state and offers no category navigation or query-backed deep links. Although rows and loading/error/empty/stale presentation already exist, the six-category route behavior and its user-visible states are not verified together.

**Approach:** Add accessible, keyboard-operable category tabs synchronized with `/` and `/?category=...`, presented as a horizontal strip on mobile and resetting scroll on category changes. Reuse the existing typed stories hook and row display for title, score, author, relative time, comment count, optional domain, freshness, and loading/error/retry/empty/stale states. Extend offline Playwright coverage with mocked `/api/stories` responses for all six categories and these user-visible states; do not change server or shared contracts.

</intent-contract>

## Implementation Notes

One-shot is appropriate because the missing production behavior is localized to the existing listing provider, page, and stylesheet; metadata and all listing-state render paths already exist and can be reused. A concise extension to the existing Playwright spec can exercise category navigation and the state variants using API mocks, without new dependencies or changes to the concurrently owned backend.

## Verification

**Targeted checks (this agent; Node 24.19.0 / npm 11.17.0):**
- `vitest --root <project-root> run client/src/api/use-stories.test.ts` — passed, 1 file / 2 tests.
- `npm run build -w @hn/client` — passed.
- Focused Playwright `e2e/listing.spec.ts` — passed, 9/9, including the new 320px, Back/Forward, Jobs-strip, singular-label, and long-error assertions.

**Post-fix coordinated root verification (coordinator-reported; Node 24.21.0 / npm 11.19.0):**
- Typechecks, server lint, theme checks, 11 Vitest files / 55 tests, three workspace builds, and root E2E 9/9 passed. Logs: `_bmad-output/initiative-hn-modernizacao/verification/window-2-3-2-4-postfix.pKi1IC/`.
- The separate focused backend follow-up for the adjacent 2.5 test-only change passed 3 files / 22 tests plus server typecheck; this is cross-ticket evidence, not a server/shared implementation change in 2.4.

**Technical delivery boundary:** `status: built` maps to ticket state `review`; this records technical delivery only, not `done` or human acceptance. The NON-HITL bridge used asynchronous independent technical review (zero material findings), triage/recheck, and the consolidated root pass. Formal BMad manual/synchronous checkpoints, manual confirmation, and the human risk check were not performed. HITL gates 1.7, 4.5, and 4.6 remain unchanged.
