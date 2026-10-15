---
title: 'Recuperação, continuidade e interrupção acessível'
type: feature
ticket: '2'
created: 2026-10-13
status: done
baseline_revision: 'fd0613334f7ed0aec95ff3d54362e4da8f847cff'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
context:
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md
---

<frozen-after-approval reason="intent ratificada pelo plano aprovado nesta sessão">

## Intent
**Problem:** a continuação automática do tracer 1.1 ainda não trata erro, retry, fim, expiração em voo, retorno do detalhe com recuperação em curso, pausa voluntária e foco protegido de forma completa e anunciada. **Approach:** completar FR-2–FR-5 sobre a base de 1.1, mantendo `useStories` dono de sequência/política, `ListingProvider` dono de rota/restauração e `StoryListPage` apenas apresentando e comandando.

## Boundaries & Constraints
**Always:** "Tentar novamente" repete exatamente categoria/snapshot/limite/página; notícias retidas após falha; só `hasMore === false` confirma "Você chegou ao fim"; lote vazio/só duplicados pausa automático e mantém manual; desconhecido mantém manual; 410 ativo reinicia página 1 sem snapshot com aviso; 410 obsoleto/cancelado não aplica conteúdo nem altera detalhe; pausa voluntária persiste na sequência; anúncios de carregamento/erro/fim ficam fora da lista e de `aria-busy`, sem reanunciar a lista; foco em controles após a lista suspende e cancela apenas a carga automática em voo, mantendo o manual; retomar não vence foco protegido nem erro/desconhecido/vazio. Node 24 via `PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
**Never:** novos feeds, endpoints, dependências, persistência após reload, scroll ou foco automáticos, foco na primeira notícia nova, role="feed", reabrir gate por observer/timer/resposta tardia, alterar server/shared/temas/paleta (é 2.1), commit/push/reset/stash ou mexer nas exclusões existentes.

## I/O & Edge-Case Matrix
| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Erro incremental | página 2 falha com 503 | notícias 1 retidas abaixo da lista; mensagem; "Tentar novamente" | retry repete mesma tupla |
| Vazio/duplicado | página aceita sem inéditos e hasMore true | cursor avança; automático pausado; "Carregar mais" disponível | não dispara automático |
| Fim | hasMore false | "Você chegou ao fim"; nenhuma requisição incremental, inclusive manual | — |
| Desconhecido | hasMore ausente | só ação manual; sem fim inferido | — |
| 410 ativo | página incremental responde 410 durante home | página 1 sem snapshot substitui sequência; aviso anunciado; scroll da home só por restauração/reinício | sem mistura |
| 410 obsoleto | 410 após sair da home ou trocar categoria | nenhuma aplicação, nenhum reinício, detalhe intacto | — |
| Pausa voluntária | usuário pausa e recebe novos gestos | nenhuma carga automática até "Retomar automático" | retomar sob foco protegido não dispara |
| Foco no controle após lista | Tab para controle depois da lista durante automático em voo | automático cancelado; páginas/cursor preservados; manual permitido | ao sair deliberadamente e novo gatilho, automático volta |
| Voltar durante recuperação 410 | histórico ou Voltar enquanto recuperação está em voo | não deixa erro sem ação ao retornar; lista refeita ou skeleton com carregamento de primeira página | restauração só após a lista carregada |

## Code Map
- `../../../client/src/api/use-stories.ts`: `cancelIncrementalRequest` e recuperação 410 (linhas ~225–255 e ~380–420); estados de pausa, fim, erro e cancelamento.
- `../../../client/src/features/listing/StoryListPage.tsx`: textos de erro/retry/fim/pausa, região de status fora de `aria-busy`, foco protegido por Tab e listeners de foco.
- `../../../client/src/features/listing/ListingProvider.tsx`: restauração em RAF escopada; cancelamento ao sair da home; reinício 410 anunciado.
- `../../../client/src/features/listing/use-infinite-scroll.ts`: não alterar política; apenas demanda.
- `../../../e2e/listing.spec.ts`, `../../../e2e/keyboard-focus-semantics.spec.ts`: estender cenários sem remover os existentes.
- `../../../client/src/api/use-stories.test.ts`: casos puros de retry/fim/pausa, sem jsdom.

## Tasks & Acceptance
**Execution:**
- [ ] escrever primeiro os testes que falham: texto "Tentar novamente" com tupla idêntica, "Você chegou ao fim", pausa/retomada persistente, anúncio fora da lista, Voltar durante recuperação 410.
- [ ] `use-stories.ts` -- recuperação cancelada por Voltar deixa estado retornável sem erro preso, sem aplicar 410 obsoleto.
- [ ] `StoryListPage.tsx` -- controles de continuação, status e fim conforme UX textual; foco protegido e retomada conforme política.
- [ ] `ListingProvider.tsx` -- somente se necessário para o retorno ao listar após recuperação cancelada.
- [ ] Revisar todos os testes existentes do tracer e manter os que continuam válidos.

**Acceptance Criteria:**
- AC-1: Given página incremental com erro, when a pessoa usa "Tentar novamente", then a mesma categoria/snapshot/limite/página é pedida e as notícias anteriores permanecem.
- AC-2: Given fim confirmado ou lote sem inéditos, when o carregamento termina, then o texto correto aparece e nenhuma carga automática adicional ocorre.
- AC-3: Given recuperação 410 em voo e Voltar, when a pessoa retorna à lista, then não há erro sem ação; a lista ou o carregamento de primeira página aparece.
- AC-4: Given foco em controle após a lista, when há carga automática em voo, then ela é cancelada, o manual continua disponível e o foco não é movido.
- AC-5: Given pausa voluntária, when novos gestos chegam, then nada é carregado até retomar.

## Design Notes
Anúncios: uma região `role="status"` fora de `aria-busy` com o delta textual; nunca reanunciar as notícias. Pausa e retomada são botões com texto explícito. A recuperação 410 é tratada pelo hook; o Provider só reinicia a posição pela autoridade já existente.

## Implementation Notes

Entrega do implementador: testes RED antes do código para retry, fim, pausa, anúncios e Voltar durante recuperação 410; 131 testes unitários/integrados e 75 testes de navegador passaram. Ajustes explícitos de asserções: texto do retry incremental passou a ser "Tentar novamente"; o status de dados desatualizados foi filtrado pelo texto porque o fim agora é outro status; o inventário de alvos 44 px inclui o novo botão de pausa. Risco aceito pelo contrato: retomar o automático com a página no fim não cria demanda até haver movimento para cima e depois para baixo (AD-2: retomar não cria demanda).

## Plan Change Log

## Review Triage Log
- medium — `client/src/features/listing/StoryListPage.tsx` (revisão independente): o aviso de reinício não era reanunciado num segundo 410, porque o nó de status permanecia. Verdict: real; route: patch. Correção: chave pela revisão de expiração (`snapshotExpiryRevision`). Regressão: asserção de nó novo em `restores to the top for every repeated active snapshot expiry`, validada em RED sem a chave e GREEN com ela.
- medium — `client/src/features/listing/StoryListPage.tsx` (revisão independente): `main` ficava `aria-busy` durante a recuperação, abrigando o aviso de reinício. Verdict: real; route: patch. Correção: `aria-busy` de `main` exclui recuperações de sequência (`loading && !snapshotExpired`); carregamentos iniciais e de categoria mantêm o comportamento testado.
- rejected — proteção de foco presa após remover "Tentar novamente" (revisão independente). Verdict: false. A proteção é reconciliada a partir de `document.activeElement` sempre que `data.page` ou `items.length` muda; um retry bem-sucedido muda um dos dois, e o retry sem sucesso mantém o controle focado e protegido. Evidência: effect em `StoryListPage.tsx` com dependências `data?.items.length`, `data?.page`.

## Verification
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run client/src/api/use-stories.test.ts` -- passa.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run check` -- passa.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build && npm run e2e` -- todos os testes passam, sem aumentar timeouts indiscriminadamente.
- Revisão quick independente do diff desta história, com achados triados; marcar `built` só após correções verificadas.
