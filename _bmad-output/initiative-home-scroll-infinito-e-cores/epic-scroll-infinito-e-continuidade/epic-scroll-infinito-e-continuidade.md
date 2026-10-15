---
type: epic
title: "Scroll infinito e continuidade da leitura"
parent: initiative-home-scroll-infinito-e-cores
covers: [FR-1, FR-2, FR-3, FR-4, FR-5, NFR-2, NFR-3]
after: []
assignee: ""
risk: high
---

# Scroll infinito e continuidade da leitura

## Description

Automatizar a continuação da home nos seis feeds existentes, usando a API paginada e o mesmo comando manual, sem mudar a ordem, duplicar notícias, drenar o feed ou perder leitura. A fatia preserva sequência/posição ao retornar do detalhe e torna erro, fallback, pausa e fim acessíveis. A implementação segue FR-1–FR-5 e a política única de AD-2–AD-6 ratificada em `decisions-approved.md`.

## Outcome

A pessoa percorre três incrementos consecutivos sem pedir mais notícias, abre e retorna de um detalhe no mesmo ponto, recupera falhas e alcança controles fora da lista; SM-1 funciona sem violar SM-C1.

## Requirements

IDs do PRD, com a mesma identificação da iniciativa:

- FR-1: continuação próxima ao fim em `top/new/best/ask/show/job`, preservando prefixo/ordem/posição, IDs first-occurrence-wins e uma única requisição incremental por geração.
- FR-2: carregamento incremental distinto, notícias retidas após erro e retry manual da mesma categoria/snapshot/limite/página, sem retry automático invisível.
- FR-3: apenas `hasMore === false` termina; página vazia/só duplicados aceita avança cursor e pausa automático, disponibilidade desconhecida mantém manual, feeds/gerações/ciclos isolam respostas; 410 ativo substitui por página 1 e anuncia, não mistura sequências.
- FR-4: Provider controla a restauração efetiva, com RAF cancelável/escopado e leitura pronta confirmada depois do ajuste e do foco vigente; toda continuação é cancelada ao sair da home, append automático nunca altera scroll/foco.
- FR-5: conservar `ol/li` e tabs, manual sempre disponível quando não terminal, pausa voluntária persistente, proteção de foco após a lista que cancela apenas automático, e status incremental fora da lista/região busy.
- NFR-2, contribuição comportamental: controles novos e existentes por teclado com foco visível e alvo de 44 px, sem corte/overflow em 360 px, respeitando reduced motion; o epic de cores implementa o tratamento visual definitivo.
- NFR-3: demanda legítima, limite negociado da página inicial, no máximo um lote por episódio, nenhum prefetched feed, sinais busy descartados, suspensão em erro/fim e pelo menos três incrementos além da página inicial.

## Done when

1. A lista construída de produção local continua nos seis feeds; três incrementos automáticos além do inicial usam categoria/snapshot/limite/página corretos e preservam IDs e leitura.
2. Testes mostram ausência de drain por observer/layout/programmatic scroll/reabertura de gate e ausência de fila de demanda recebida enquanto busy; resposta lenta não puxa o viewport para trás.
3. Erro/retry, vazio/só duplicados/desconhecido/fim, 410 ativo/obsoleto, troca de categoria e saída para detalhe obedecem às guardas sem aceitar páginas ou efeitos de outra geração/ciclo.
4. Histórico e “Voltar” restauram páginas/categoria/posição; foco protegido, pausa persistente, retomada e ausência de observer mantêm teclado/manual disponíveis, sem append automático mover foco.
5. Testes unitários/E2E da entrega passam em Node ≥24 e o resultado é demonstrado no bundle de produção; evidências e riscos residuais ficam nos planos, não são adiados para a história integrada.

## Boundaries

`useStories` possui páginas, request locks e política efetiva; `ListingProvider` possui rota/categoria/leitura; `StoryListPage` apresenta/comanda; o novo detector `use-infinite-scroll` só sinaliza geometria/demanda. UI não possui cursor/retry/política paralelos. Reutilizar transporte/contrato/server/cache inalterados, sem novas dependências.

1.1 contém guardas de navegação/cancelamento seguras já no tracer, e entrega a base escopada a 1.2. 1.2 completa recuperação/restauração/foco/pausa/announcements. Não implementar a paleta neste epic. O epic de cores consome os controles e estados estabilizados por 1.2, aplicando seus tokens/CSS, e não altera a política.

## References

Caminhos relativos à raiz do projeto:

- parent — `_bmad-output/initiative-home-scroll-infinito-e-cores/initiative-home-scroll-infinito-e-cores.md`, Requirements, Done when e Boundaries.
- prd — `_bmad-output/initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md`, FR-1–FR-5, NFR-2/NFR-3, SM-1/SM-C1.
- architecture — `_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md`, AD-1–AD-6/AD-8 e Verification Boundary.
- architecture review — `_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/reviews/gate-resolution.md`.
- decisions — `_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md`, escopo e handoffs.
- code — `client/src/api/use-stories.ts`, `client/src/api/use-stories.test.ts`, `client/src/features/listing/ListingProvider.tsx`, `client/src/features/listing/StoryListPage.tsx`, `client/src/api/stories.ts`.
- verification — `e2e/listing.spec.ts`, `e2e/keyboard-focus-semantics.spec.ts`, `playwright.config.ts`, `vitest.config.ts`.
- constraint — `package.json`, runtime Node ≥24 e comandos existentes; AD-8, contratos/API/limites existentes.

## Notes

- Decision: 2026-10-13 — tracer 1.1 é o caminho vertical executável da rolagem à projeção via API existente; guardas/cancelamento não ficam para depois, e a demonstração percorre três incrementos reais do app com fixtures controladas.
- Decision: 2026-10-13 — 1.2 depende da interface de sequência/comando/escopo de 1.1 e toca os mesmos arquivos; nenhuma das duas histórias pode executar em paralelo.
- Decision: 2026-10-13 — ausência de IntersectionObserver conserva o manual; resultado vazio ou só duplicado aceita cursor mas não autoriza outro automático; teste de `window.scrollTo` continua negativo de demanda, com novos positivos por wheel/teclas reais.
- Decision: 2026-10-13 — ampliar stride de IDs de fixtures e decoder juntos já em 1.1 para impedir colisões ao percorrer quatro páginas de 30; Vitest continua em ambiente node, lifecycle real é exercido por Playwright existente.
- Decision: 2026-10-13 — NFR-2 aqui cobre semântica/teclado/geometria funcional dos controles; cores/contraste e responsividade visual final pertencem a 2.1; NFR-3 permanece responsabilidade deste epic, com conferência integrada em 2.2.
- Decision: 2026-10-13 — apenas duas entradas, portanto não há sweep obrigatório para epic de mais de três entradas; refactor e reviews fazem parte de cada build.
- Implementation: margens locais da sentinela e detalhes de flags são escolhas de implementação livres sob AD-2/AD-5, não perguntas ou bloqueios pendentes; os testes devem comprovar ausência de drain e corridas, não pressupor jsdom ou novas dependências.
