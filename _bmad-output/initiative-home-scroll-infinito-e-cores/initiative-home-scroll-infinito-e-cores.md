---
type: initiative
title: "Home contínua e colorida"
parent: none
covers: [FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, NFR-1, NFR-2, NFR-3]
after: []
assignee: ""
risk: high
---

# Home contínua e colorida

## Description

Entregar a continuação automática e a revisão de cores da home do HN Moderno, preservando a leitura, o teclado, os temas e o envelope operacional da aplicação existente. O PRD e a arquitetura de 2026-10-13 permanecem nos caminhos da iniciativa anterior como fontes; esta árvore nova contém somente o trabalho aprovado nesta sessão, sem restaurar artefatos excluídos.

## Outcome

A pessoa percorre pelo menos três incrementos automáticos, abre uma notícia e retorna ao ponto de leitura, em uma home perceptivelmente mais colorida e legível; os sinais são SM-1, SM-2 e a contramétrica SM-C1 do PRD, com o juízo humano de SM-2 distinguido da verificação técnica.

## Requirements

Fonte numerada: `_bmad-output/initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md`, §§3–5. Os mesmos IDs são usados em toda a árvore.

- FR-1: continuar próximo do fim sem ação manual, repetição de notícias, concorrência duplicada ou salto ao topo.
- FR-2: distinguir carga inicial/incremental, preservar notícias após falha e repetir a mesma continuação por “Tentar novamente”.
- FR-3: reconhecer somente fim confirmado, preservar fallback em lote vazio/desconhecido, isolar feeds e reiniciar sequência expirada com aviso.
- FR-4: manter categoria, páginas e posição ao voltar do detalhe, sem append automático alterar foco ou scroll.
- FR-5: oferecer continuação e pausa por teclado, foco visível, anúncios incrementais e acesso aos controles após a lista.
- FR-6: mudança perceptível no cabeçalho, categoria ativa e interações da home em celular e desktop.
- FR-7: preservar conteúdo e legibilidade; seleção, erro e foco não dependem apenas de cor.
- NFR-1: contraste dos pares realmente usados conforme os mínimos do PRD, em ambos os temas existentes.
- NFR-2: home a 360 px e desktop sem overflow horizontal da página, faixa de categorias navegável, alvos de 44 px e reduced motion.
- NFR-3: lotes sob demanda no limite existente, sem antecipar todo o feed; parar em erro/fim e percorrer pelo menos três incrementos consecutivos.

## Done when

1. FR-1–FR-5 e NFR-3 funcionam nos seis feeds, com três incrementos automáticos além da página inicial, retorno ao detalhe, recuperação e fim demonstrados; testes controlados cobrem as corridas e o fallback.
2. FR-6–FR-7 e NFR-1/NFR-2 são demonstrados em claro/escuro, celular de 360 px e desktop, com screenshots inspecionados, contraste dos usos reais, teclado, axe e regressão do detalhe; SM-2 tem um resultado humano explicitamente registrado, nunca inferido da aprovação da paleta.
3. `npm run check`, `npm run build` e `npm run e2e` passam sequencialmente em Node ≥24, com evidências da nova entrega e sem mascarar falhas por aumento indiscriminado de timeout.
4. O bundle de produção local serve SPA e API same-origin; smoke com upstream público percorre lista, continuação, detalhe, retorno e tema, distinguindo dados reais de fixtures.
5. README e inventário SDLC descrevem a entrega atual sem transformar o encerramento histórico de 2026-10-12 em aceite do novo escopo; requisitos, verificações e limitações têm rastreabilidade.

## Boundaries

Duas capacidades da home: continuação/continuidade e hierarquia visual/legibilidade. Não redesenhar o detalhe, alterar classificação, comentários, contrato HTTP, limites, dependências, fontes, autenticação, infraestrutura, persistência, analytics ou topologia. Virtualização está fora do escopo. Nenhuma publicação externa, commit ou push é autorizada por esta árvore.

- Touch point: `client/src/api/stories.ts`, `shared/contract` e API/cache/upstream do server — consumir os contratos e limites existentes sem modificá-los; owner: epic-scroll-infinito-e-continuidade.
- Touch point: `ThemeProvider` e bootstrap de tema — preservar preferência por aba e seleção por sistema; owner: epic-cores-da-home.
- Touch point: Vitest/Playwright/axe e scripts existentes — ampliar as verificações sem novos frameworks; owner: epic-scroll-infinito-e-continuidade para fixtures de paginação e epic-cores-da-home para contraste/fechamento integrado.
- Touch point: `README.md` e `docs/sdlc-artifacts.md` — atualizar documentação e separar histórico da nova entrega; owner: epic-cores-da-home, entrada 2.2.

Tracer path: 1.1 prova rolagem → comando único → API existente → projeção estável → append; 1.2 completa recuperação/retorno/acessibilidade; 2.1 aplica tokens e consumidores sobre os controles estáveis; 2.2 verifica os dois resultados no bundle de produção.

## References

Todos os caminhos abaixo são relativos à raiz do projeto.

- prd — `_bmad-output/initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md`, FR-1–FR-7, NFR-1–NFR-3 e SM-1/SM-2/SM-C1.
- source history — `_bmad-output/initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/reconcile-pedido.md`, suposições originais A1/A2.
- architecture — `_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md`, AD-1–AD-8 e Verification Boundary.
- architecture review — `_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/reviews/gate-resolution.md`, guardas e condições originais.
- decisions — `_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md`, aprovação de escopo, política e interface de tokens desta árvore.
- constraint — `package.json`, Node ≥24 e scripts existentes; a arquitetura AD-8 preserva runtime/deploy/limites.

## Notes

- Decision: 2026-10-13 — o resultado real de `ExitPlanMode` registrou “User has approved your plan”; escopo, dois epics, cadeia de quatro histórias, A1/A2 e AD-2/4/5/6 foram ratificados conforme `decisions-approved.md`.
- Decision: 2026-10-13 — criar árvore nova e preservar fontes, exclusões e mudanças locais da branch `brownfield`; a ativação na configuração fica com o coordenador, sem restauração da iniciativa anterior.
- Decision: 2026-10-13 — não criar epic de plataforma: scaffold, ambientes, ferramentas e bundle de produção existentes já atendem a fatia; a baseline conhecida não comprova os novos requisitos.
- Decision: 2026-10-13 — execução autônoma pelo fluxo `bmad-agent-dev`/`bmad-build`, sem checkpoints adicionais por história, com teste-first, review e evidência; não usar `bmad-build-auto` para contornar sua exigência de árvore limpa.
- Decision: 2026-10-13 — NFR-2 tem contribuição comportamental do epic de scroll e visual do epic de cores; NFR-3 é implementado pelo epic de scroll e verificado transversalmente em 2.2, sem transferir responsabilidade.
- Unknown: o juízo humano de SM-2 sobre screenshots ainda não ocorreu; a entrada 2.2 contém essa parte hitl e não pode inventar aprovação visual nem conformidade WCAG completa.
- Source history: o PRD/reconciliação e a arquitetura registram A1/A2/AD-2/4/5/6 como propostas no momento de sua autoria; a aprovação posterior está nesta árvore, sem reescrever seus registros históricos.
