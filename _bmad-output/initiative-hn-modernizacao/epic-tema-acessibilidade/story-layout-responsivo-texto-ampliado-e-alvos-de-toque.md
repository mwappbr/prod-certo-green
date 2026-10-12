---
id: 2
type: story
title: "Layout responsivo, texto ampliado e alvos de toque"
parent: epic-tema-acessibilidade
covers: [RNF-09]
after: [1]
hitl: false
risk: medium
---

# Layout responsivo, texto ampliado e alvos de toque

## Description

Ajusta lista, detalhe, abas e árvore para 320 px e 375 px sem rolagem horizontal da página, permanece legível com a fonte do sistema aumentada sem truncar controles e mantém alvos de toque com pelo menos 44 px.

## Acceptance Criteria

Verify: `npm run e2e` local mede as telas de lista e detalhe em 320 px e 375 px com escala de texto do sistema/browser aumentada; confirma ausência de rolagem horizontal e truncamento de controles, operação preservada e dimensões mínimas de 44 px para os alvos de toque.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/epic-tema-acessibilidade.md

## Notes

- Decision (2026-10-12): a história 4.5 substitui o aceite humano obrigatório por validação técnica automatizada. A injeção de estilos test-only abaixo continua sem provar zoom nativo, escala de sistema/dispositivo ou AT; não se alega conformidade WCAG completa.

## Entrega e verificação

- **Entrega:** reflow responsivo e alvos medidos foram corrigidos; source links curtos receberam largura mínima de 44 px. A simulação de texto amplia font-size/line-height capturados sem alterar viewport, zoom, DPR ou font-size raiz.
- **Paths:** `client/src/features/listing/listing.css`, `client/src/features/detail/detail.css`, `e2e/responsive-text.spec.ts`.
- **Evidências:** Root posterior com 121 testes/20 arquivos, build 3 workspaces e E2E 46/46: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-2-postreview.K2qAfU/`; QA compilada com 8 PNGs abertos e medidas nos dois viewports/temas: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-responsive-4-2.ZR2HJz/`.
- **Limites:** 200% é stress tipográfico via injeção de estilos test-only (glyph ≥1,8×), não zoom nativo, Firefox/text-only, escala OS/dispositivo, first paint ou p95. A QA reporta uma execução única de 3,595 s. Reflow nativo/escala de sistema, teste humano e AT não ocorreram e não são requisitos após a decisão técnica de 2026-10-12.
- **Estado no plano:** permanece conforme a entrada correspondente; a limitação já está documentada e esta folha não altera status.
