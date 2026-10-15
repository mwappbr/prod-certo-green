---
title: 'Cores semânticas e hierarquia da home'
type: feature
ticket: '1'
created: 2026-10-13
status: done
baseline_revision: 'fd0613334f7ed0aec95ff3d54362e4da8f847cff'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
context:
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/ux-cores-home/DESIGN.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/ux-cores-home/EXPERIENCE.md
---

<frozen-after-approval reason="intent ratificada pelo plano aprovado nesta sessão">

## Intent
**Problem:** a home ainda usa a identidade neutra com acento azul; FR-6 pede mudança perceptível no cabeçalho, categoria ativa e interações, e FR-7/NFR-1/NFR-2 exigem legibilidade, contraste real e responsividade. **Approach:** aplicar a interface única de cinco papéis aprovada em `ux-cores-home/DESIGN.md` aos consumidores da home, sem paleta por feed, sem mudança de política e sem redesenhar o detalhe.

## Boundaries & Constraints
**Always:** manter os oito tokens atuais com nomes e valores; acrescentar exatamente `--surface-brand`, `--ink-on-brand`, `--surface-accent`, `--accent` e `--border-control` com os valores da tabela aprovada em claro, escuro explícito e escuro por sistema; `ThemeProvider` e bootstrap permanecem donos da preferência; seleção ativa tem indicação não cromática (`aria-selected` e borda); erro tem texto; títulos, origem, autor, pontuação, tempo e comentários permanecem; alvos de 44 px; reduced motion respeitado; sem overflow horizontal da página a 360 px e desktop.
**Never:** paleta por feed ou categoria; novos temas; mudar comportamento de continuação, foco ou dados; recolorir o detalhe além do que o tratamento compartilhado exigir sem regressão; aceitar contraste apenas pela tabela preliminar sem medir o CSS aplicado; declarar SM-2 (juízo humano de screenshots) como comprovado; commit/push/reset/stash ou mexer nas exclusões existentes.

## I/O & Edge-Case Matrix
| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Claro | sistema ou preferência clara | cabeçalho azul claro, tab violeta ativo, links acentuados; textos ≥4,5:1 e controles/estados essenciais ≥3:1 | falha no check-theme |
| Escuro explícito | `data-theme="dark"` | mesma hierarquia com superfícies escuras | — |
| Escuro por sistema | sem `data-theme`, `prefers-color-scheme: dark` | paridade com escuro explícito | — |
| Seleção | categoria ativa | cor e borda/indicador e `aria-selected` diferenciam | — |
| Erro/fim | erro incremental ou fim | texto e cor distintos; nunca só cor | — |
| 360 px | home com cabeçalho, tabs e controles | sem overflow horizontal da página; faixa interna rolável; nada cortado | — |
| Detalhe | abrir e voltar | detalhe sem mudança de cor inesperada, nenhum regresso de contraste | — |

## Code Map
- `../../../client/src/theme.css`: tokens existentes e os cinco novos; mesmas três vias de tema.
- `../../../client/src/features/listing/listing.css`: consumidores do cabeçalho (`.listing__header`, `.theme-screen-header`), tab ativo, links e estados de continuação/pausa/fim.
- `../../../client/src/features/listing/StoryRow.tsx`: sem mudança de estrutura; só classes se necessário.
- `../../../scripts/check-theme.mjs`: parser para os novos tokens nas três vias e pares reais de texto e de estados essenciais.
- `../../../e2e/theme.spec.ts`, `../../../e2e/accessibility.spec.ts`, `../../../e2e/responsive-text.spec.ts`: estender a verificação de cor, axe e 360 px sem remover os existentes.
- `../../../_bmad-output/initiative-home-scroll-infinito-e-cores/ux-cores-home/DESIGN.md` e `EXPERIENCE.md`: já registrados; atualizar só se a implementação exigir mudança justificada.

## Tasks & Acceptance
**Execution:**
- [ ] escrever testes/verificações que falham antes: paridade de tokens nas três vias, pares reais em claro/escuro, seleção não cromática, 360 px sem overflow com o novo cabeçalho.
- [ ] `theme.css` -- acrescentar os cinco tokens com valores literais nas três vias; preservar os oito existentes.
- [ ] `listing.css` -- aplicar os papéis aos consumidores da home; manter detalhe inalterado salvo regressão necessária.
- [ ] `check-theme.mjs` -- medir os pares reais exigidos e falhar com mensagem clara.
- [ ] verificar screenshots em claro/escuro, 360 px e desktop; registrar o que foi inspecionado sem declarar aprovação humana.

**Acceptance Criteria:**
- AC-1: Given tema claro ou escuro explícito ou por sistema, when a home carrega, then o cabeçalho, a categoria ativa e os links mostram os usos aprovados, com as três vias de token presentes.
- AC-2: Given categoria ativa, when a pessoa a vê, then ela tem indicação não cromática além da cor.
- AC-3: Given 360 px e desktop, when a home carrega, then não há overflow horizontal da página e os alvos têm 44 px.
- AC-4: Given os pares reais, when o check roda, then texto ≥4,5:1 e controles/estados essenciais ≥3:1 em ambos os temas.
- AC-5: Given o detalhe, when aberto, then não há regressão de contraste nem de informação.

## Design Notes
Os cinco papéis são a única interface nova; a tabela aprovada não muda nesta história. Contraste sobre transparência deve medir o fundo final. A pré-checagem do plano não substitui a medição do CSS aplicado.

## Implementation Notes

Entrega do implementador: tokens e consumidores aplicados nas três vias; 131 testes unitários/integrados, check-theme com 13 tokens, 86 testes de navegador antes da revisão. Contrastes medidos no CSS aplicado (Chromium, computed style): claro — título sobre brand 8,49:1; contato 6,21:1; aba ativa 5,98:1; link 6,41:1; contorno do controle 4,76:1. Escuro — título 12,04:1; aba ativa 8,25:1; contorno 6,64:1. Screenshots desktop 1280 e 360 px, claro e escuro, em `scratchpad/screenshots/`, inspecionadas por técnica de leitura; SM-2 (juízo humano) permanece pendente. Sem avaliação humana.

## Plan Change Log

## Review Triage Log
- medium — `listing.css` (revisão independente): a aba selecionada diferenciava-se só por cor; a barra existia em ambos os estados, com `transparent` no inativo. Verdict: real; route: patch. Correção: sublinhado não cromático na aba ativa. Regressão: `seleção ativa tem indicador não cromático além de aria-selected` verifica `text-decoration-line` do ativo e do inativo.
- medium — `e2e/theme.spec.ts` (revisão independente): a verificação de cabeçalho do detalhe lia `.theme-screen-header`, seletor que a mudança não estiliza; o detalhe real é `.detail__header`. Verdict: real; route: patch. Correção: a asserção passa a medir `.detail__header`.
- medium — `e2e/responsive-text.spec.ts` (revisão independente): o teste de 360 px rotulado como dark não verificava o tema nem a cor renderizada. Verdict: real; route: patch. Correção: afirma `data-theme="dark"` na rota escura, ausência do atributo na clara, e a cor do cabeçalho `rgb(23, 37, 84)` no escuro e `rgb(219, 234, 254)` no claro.
- low — `scripts/check-theme.mjs` (revisão independente): faltavam `primary` sobre `surface-accent` e `surface-raised`, usados pelo foco. Verdict: real; route: patch. Correção: pares adicionados; passam.
- rejected — "extensão do axe planejada ausente" (revisão independente). Verdict: false. `e2e/accessibility.spec.ts` já audita `list-light` e `list-dark` a 375 px, com os novos papéis renderizados; não há tarefa de axe sem cobertura.

## Verification
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH node scripts/check-theme.mjs` -- passa com os pares reais.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run check` -- passa.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build && npm run e2e` -- passa sem aumentar timeouts.
- Screenshots 360 px e desktop em claro/escuro, inspecionadas e registradas com caminhos; SM-2 permanece pendente de avaliação humana.
- Revisão quick independente do diff, triada antes de `built`.
