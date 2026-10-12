---
id: 3
type: story
title: "Teclado, foco e semântica acessível"
parent: epic-tema-acessibilidade
covers: [RNF-04]
after: [2]
hitl: false
risk: high
---

# Teclado, foco e semântica acessível

## Description

Completa navegação por teclado e semântica acessível nas categorias, paginação, tema e árvore, com foco visível, rótulos, estados anunciados e movimento reduzido respeitado.

## Acceptance Criteria

Verify: `npm run e2e` local percorre as seis abas com setas e Tab, paginação, controles de tema e expandir/recolher comentários só com teclado; confirma foco visível, ativação, rótulos, `aria-expanded` e ausência de transições quando movimento reduzido é preferido.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/epic-tema-acessibilidade.md

## Notes

- Decision (2026-10-12): o aceite 4.5 foi redefinido como técnico automatizado. Os asserts de DOM/eventos desta história não provam anúncios de leitor de tela/AT, teste humano em ambiente limpo ou conformidade WCAG completa; nenhum desses resultados é alegado.

## Entrega e verificação

- **Entrega:** travessia por teclado, tablist/categorias, tema, paginação, árvore recolhível, foco visível e movimento reduzido foram cobertos; o ajuste de foco após append centraliza o controle no viewport sem afrouxar a guarda geométrica.
- **Paths:** `client/src/features/listing/StoryListPage.tsx`, `e2e/keyboard-focus-semantics.spec.ts`.
- **Evidências:** QA compilada pós-center com 28 verificações sem requests extras, 220 comentários, margem do foco dentro do viewport e 8 PNGs abertos: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-keyboard-4-3.Whvc85/passed-focus-margin/`; Root pós-patch check 121/20, build 3 workspaces, E2E 52/52: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-3-focus-margin-postreview.ORA8s6/`.
- **Limites:** Chromium/Playwright automatizado; sem leitor de tela/AT nativo, prova WCAG completa ou teste humano. Esses itens não são requisitos após a decisão técnica de 2026-10-12.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
