---
type: epic
title: "Home mais colorida e legível"
parent: initiative-home-scroll-infinito-e-cores
covers: [FR-6, FR-7, NFR-1, NFR-2]
after: []
assignee: ""
risk: medium
---

# Home mais colorida e legível

## Description

Aplicar a direção azul/violeta e a interface de tokens aprovada à home, com mudança perceptível no cabeçalho, feed ativo e interações sem competir com as notícias. Sobre os estados/controles estabilizados por 1.2, registrar UX e entregar tokens/consumidores juntos, nos temas existentes e em celular/desktop. A história final verifica integração, screenshots, smoke real e documentação dos dois epics sem transferir a responsabilidade de implementar scroll para este epic.

## Outcome

A home distingue identidade, seleção e interação com mais cor, enquanto títulos/metadados/foco permanecem legíveis e a navegação contínua continua íntegra; SM-2 é avaliado pela pessoa responsável a partir dos screenshots reais, com NFR-1/NFR-2 e SM-C1 tecnicamente verificados.

## Requirements

IDs do PRD, com a mesma identificação da iniciativa:

- FR-6: aplicar cor de forma visível ao cabeçalho da home, categoria ativa e estados de links/controles em desktop e celular, usando exclusivamente a tabela aprovada.
- FR-7: conservar título, origem e informações existentes das notícias; seleção também por indicação não cromática, erros com texto e foco distinguível; áreas de leitura predominantemente neutras.
- NFR-1: verificar pares realmente usados em claro, escuro explícito e escuro por sistema; texto normal ≥4,5:1, grande ≥3:1 e sinais essenciais de controle/estado ≥3:1.
- NFR-2, contribuição visual: home a 360 px e desktop sem overflow horizontal da página/cortes, faixa de categorias navegável, alvos ≥44 px e reduced motion; preservar semântica/teclado dos controles de 1.2.

2.2 verifica transversalmente FR-1–FR-5/NFR-3 já implementados no epic de scroll e FR-6–FR-7/NFR-1–NFR-2 deste epic. Sua cobertura nesta árvore permanece nos IDs de responsabilidade deste epic; não é uma transferência de propriedade de implementação.

## Done when

1. No bundle de produção local a home apresenta cabeçalho azul, categoria ativa violeta com indicação não cromática e interações coloridas/visíveis nos dois temas e dois tamanhos; screenshots reais permitem comparar o resultado com a baseline.
2. Pares de texto/controles realmente usados passam no script ampliado e no browser; escuro por sistema tem os mesmos tokens do explícito, informações das notícias/tema por aba são preservadas e detalhe não sofre redesenho nem regressão de comportamento.
3. Home de 360 px e desktop mantém leitura/controles sem corte ou overflow horizontal da página, faixa de categorias acessível, alvos de 44 px, foco/teclado, reduced motion e verificações axe sem alegação de conformidade WCAG completa.
4. Verificação integrada sequencial em Node ≥24 e smoke público no bundle novo demonstram continuação, detalhe/retorno e tema sem regressões, com fixtures e testes reais distinguidos; README/SDLC registram somente o resultado atual.
5. A pessoa responsável avalia SM-2 sobre desktop/celular reais; enquanto esse juízo não ocorrer, registrar a pendência e não substituí-lo pela aprovação anterior da paleta.

## Boundaries

`theme.css` possui tokens; `listing.css` possui usos da home. Manter oito tokens existentes e acrescentar exatamente os cinco papéis/valores aprovados, sem aliases locais ou paleta por feed. Preservar `ThemeProvider`/bootstrap e escuro explícito/por sistema. Ajustes compartilhados exigem regressão do detalhe, não redesenho. Não criar analytics, temas, fontes ou dependências.

A entrada 2.1 depende de 1.2 porque consome e modifica a apresentação dos mesmos controles/estados e arquivos estabilizados ali. Entrega UX, tokens e consumidores de forma conjunta; a tabela ratificada é seu contrato, não uma paleta a decidir durante CSS. A entrada 2.2 depende de 1.2 e 2.1 porque seu resultado é o aceite integrado de ambos, e não só uma sequência de execução.

## References

Caminhos relativos à raiz do projeto:

- parent — `_bmad-output/initiative-home-scroll-infinito-e-cores/initiative-home-scroll-infinito-e-cores.md`, Requirements, Done when e Boundaries.
- prd — `_bmad-output/initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md`, FR-6–FR-7, NFR-1/NFR-2, SM-2/SM-C1; FR-1–FR-5/NFR-3 para conferência integrada.
- architecture — `_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md`, AD-6/AD-7/AD-8 e Verification Boundary.
- decisions — `_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md`, A2, interface visual única e handoffs.
- provider — `_bmad-output/initiative-home-scroll-infinito-e-cores/epic-scroll-infinito-e-continuidade/epic-scroll-infinito-e-continuidade.md`, estados/controles e evidências implementados por 1.2.
- code — `client/src/theme.css`, `client/src/features/listing/listing.css`, `client/src/features/listing/StoryRow.tsx`, `client/src/features/theme/theme-toggle.css`, `scripts/check-theme.mjs`.
- verification — `e2e/theme.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/responsive-text.spec.ts`, `e2e/keyboard-focus-semantics.spec.ts`, `e2e/listing.spec.ts`.
- documentation — `README.md`, `docs/sdlc-artifacts.md`, histórico a distinguir da entrega corrente.
- constraint — `package.json`, Node ≥24 e scripts existentes; AD-7/AD-8, interface/temas e envelope operacional preservados.

## Notes

- Decision: 2026-10-13 — tracer 2.1 é a home executável com UX registrada e tabela aprovada aplicada simultaneamente a tokens e consumidores; não separar fundação de tokens de uma integração posterior.
- Decision: 2026-10-13 — 2.1 espera 1.2 por contrato de controles e colisão real em apresentação/CSS; 2.2 espera 1.2/2.1 porque verifica ambos os resultados e documentação.
- Decision: 2026-10-13 — criar `ux-cores-home/DESIGN.md` e `EXPERIENCE.md` em 2.1, antes do código visual, com a aprovação já ocorrida e sem novo checkpoint de paleta; os arquivos são entregas futuras, não links de referência inexistentes.
- Decision: 2026-10-13 — 2.2 é fechamento integrado oferecido e aprovado, mas testes/review da implementação continuam em 1.1/1.2/2.1, não são adiados para esta história.
- Decision: 2026-10-13 — duas entradas; sweep de epic com mais de três histórias não se aplica, mantendo refactor/review dentro de cada build.
- Unknown: SM-2 exige avaliação humana de screenshots ainda não existentes; 2.2 é hitl somente nessa parte, sem adicionar plan/done checkpoints por história ou inventar aceite de screenshots.
