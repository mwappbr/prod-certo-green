---
title: 'Tokens de tema claro e escuro'
type: 'feature'
ticket: '4'
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
context: ['_bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md', '_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md', '_bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** As futuras telas precisam de uma fonte única de cores para os temas claro e escuro, com contraste legível comprovado antes do uso.

**Approach:** Definir tokens CSS semânticos, usando os valores exatos do `DESIGN.md` e seletor de tema escuro, e validar por um script Node independente que calcula contraste WCAG AA para os papéis de texto em ambos os temas.

</intent-contract>

## Implementation Notes

Chosen oneshot because this is a localized CSS/token change and a standalone contrast verifier, estimated under 100 lines of implementation. Decision (user-authorized, 2026-10-11): preserve the existing dirty working tree; do not commit, push, stage, stash, reset, or clean. Keep this story to theme tokens/CSS and `scripts/check-theme.mjs`; no manifest, Vitest, test-runner, harness, or future-feature changes. Run the verifier directly with Node 24.21.0.

Implementation (2026-10-11): `client/src/theme.css` defines the eight canonical color tokens for light and dark themes, and `client/src/main.tsx` loads the stylesheet. `scripts/check-theme.mjs` uses Node built-ins only, parses the two CSS token blocks, and asserts WCAG contrast for ten text/background pairs in each theme. No theme-selection or toggle behavior is included; this story provides the tokens only. No dependency or manifest changes were made.

## Verification

**Commands:**
- `node scripts/check-theme.mjs` -- passed on Node 24.21.0; all 20 theme/pair combinations meet 4.5:1.
- `npm run build` -- passed; Vite transformed 16 modules and emitted the stylesheet.
- `git diff --check` -- passed for the tracked change and isolated story diff; the repository index was not changed.

## Review Triage Log

### 2026-10-11 — Quick review
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: no findings.

## Auto Run Result

- Summary: Added canonical light/dark CSS color tokens and an independent Node contrast verifier.
- Files changed: `client/src/theme.css` — eight light/dark color tokens and base surface/text styles; `client/src/main.tsx` — loads the theme stylesheet; `scripts/check-theme.mjs` — validates required tokens and WCAG contrast; this plan — implementation and review evidence.
- Review findings: patched 0; deferred 0; rejected 0. Follow-up review recommendation: false.
- Verification: Node v24.21.0; `node scripts/check-theme.mjs` passed all 20 text/background pairs at 4.5:1 or higher; `npm run build` passed and emitted the CSS asset; `git diff --check` passed.
- Residual risk: this story defines tokens only; future theme-selection behavior must set `data-theme="dark"` on the document root to activate dark values. Per the user's explicit preservation decision, the work remains uncommitted and the pre-existing dirty tree is untouched; no commit, push, staging, stash, reset, or clean was performed.
