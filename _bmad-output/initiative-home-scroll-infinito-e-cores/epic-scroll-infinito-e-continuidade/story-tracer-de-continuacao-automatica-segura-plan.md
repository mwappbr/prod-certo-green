---
title: 'Tracer de continuação automática segura'
type: feature
ticket: '1'
created: 2026-10-13
status: done
baseline_revision: 'fd0613334f7ed0aec95ff3d54362e4da8f847cff'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md
---

<frozen-after-approval reason="intent ratificada pelo plano aprovado nesta sessão">

## Intent
**Problem:** a home depende do botão e o hook pode duplicar IDs ou aplicar trabalho incremental depois da navegação. **Approach:** entregar uma fatia vertical de continuação automática nos seis feeds usando o comando existente, uma política única e escopos de sequência/leitura seguros. FR-1 e NFR-3 são desta história; FR-3 recebe a base de cursor/isolamento. Recuperação detalhada, pausa acessível e anúncios serão concluídos em 1.2, sem deixar pedidos ou efeitos inseguros nesta fatia.

## Boundaries & Constraints
**Always:** preservar páginas/ordem/snapshot/limite; uma carga incremental em voo; manual disponível; Provider dono de scroll/rota, hook dono de sequência/política, observador dono somente de demanda. Só hasMore=false confirma fim. Adotar AD-2/4/5/6 e A1 conforme aprovação real do ExitPlanMode em 2026-10-13. Manter comportamento existente de 410 ativo reiniciando página 1, com aviso; cancelado não recupera.
**Never:** prefetch completo, timers iniciando páginas, cursor por contagem, dependências novas, scroll/foco automático, chamada HN direta, alterações server/shared/temas, commit/push/reset/stash ou restauração das 460 exclusões existentes. Node 24 via PATH=/opt/homebrew/opt/node@24/bin:$PATH. Restauração não terminou ao agendar RAF; confirmar depois do ajuste e combinar confirmação de foco da UI do mesmo ciclo. Cancelar manual e automático antes de sair da home/restaurar; foco após lista cancela só automático e permite manual. Política efetiva persiste no hook, não no observador.

## I/O & Edge-Case Matrix
| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Continuação | novos gestos descendentes após commit perto da sentinela | páginas 2/3/4 uma por episódio, mesma tupla negociada, prefixo intacto | sem antecipação |
| Concorrência | sinais repetidos/manual concorrente e gesto durante busy | no máximo um pedido; descartar sinais busy | não enfileirar |
| Projeção | IDs repetidos e páginas vazias/somente duplicadas | primeira ocorrência vence; cursor/metadados avançam; sem inéditos pausa auto | manual conserva disponibilidade |
| Sequência inválida | snapshot/limite/página incompatível, inclusive número duplicado | reter páginas e informar erro antes de atalho idempotente | manual retry |
| Navegação | detalhe/feed/restauração/foco protegido durante pedido | cancelamento e guardas; nenhum append/410/scroll tardio | libera somente lock proprietário |
| Sem demanda | render/observer novo/layout/programmatic scroll/retorno | nenhum incremento inventado | fallback manual |
</frozen-after-approval>

## Code Map
- `../../../client/src/api/use-stories.ts`: helpers puros, gerações/controllers existentes; corrigir projeção/validação e remover RAF/scrollTo do hook; reutilizar getStories.
- `../../../client/src/features/listing/ListingProvider.tsx`: hook montado durante detalhe, history manual; atual RAF limpa pending antes de executar e não é cancelável. Única autoridade de reposicionamento.
- `../../../client/src/features/listing/StoryListPage.tsx`: tabs, ol/li, foco manual protegido por categoria/href/Tab; preservar contrato, sem focar primeira notícia nova.
- `../../../client/src/features/listing/use-infinite-scroll.ts`: arquivo novo estritamente geometria/entrada/demanda; não possuir páginas/política/retry.
- `../../../client/src/api/use-stories.test.ts`: Vitest node, helpers sem jsdom; fixtures atuais vazias.
- `../../../e2e/listing.spec.ts`: mocks e controlled RAF; stride 100 colide no quarto lote, ampliar stride e decoder juntos. ScrollTo existente é teste NEGATIVO, não gesto positivo.

## Tasks & Acceptance
**Execution:**
- [x] testes unitários populados e E2E de continuação real falhando antes do código; registrar RED.
- [x] `use-stories.ts` -- dedup estável, validação antes da duplicata, cursor aceito, lock síncrono manual/auto com scope `{generation,navigationCycle}`, política e guardas/cancelamento proprietário.
- [x] `ListingProvider.tsx` -- fechar gate sincronamente antes de publicar navegação; cancelamento RAF e restauração validada no ciclo; reinício ativo comunicado pelo hook e aplicado somente na lista vigente.
- [x] `StoryListPage.tsx` e `use-infinite-scroll.ts` -- sentinela, confirmação pós-ajuste/foco, fallback existente e demanda verdadeira; preservar foco manual e eliminar scroll capturado no início da carga.
- [x] `use-stories.test.ts` e `e2e/listing.spec.ts` -- cobrir matriz, três incrementos, seis feeds, respostas lentas/obsoletas e observer indisponível; preservar verificações antigas corrigindo só expectativas legitimamente mudadas.

**Acceptance Criteria:**
- AC-1: Given home com mais páginas, when três episódios novos de wheel/tecla levam à sentinela, then 120 IDs únicos em ordem são lidos sem clique e exatamente páginas 1–4 no limite original.
- AC-2: Given incremento lento, when a pessoa continua rolando, then conclusão não restaura posição capturada nem altera foco; sinais recebidos durante busy não disparam outro lote.
- AC-3: Given navegação/feed/foco protegido ou restauração em voo, when a resposta velha ou 410 chega, then não altera sequência/tela/gate do ciclo novo; manual continua possível após proteção de foco.
- AC-4: Given sem IntersectionObserver ou sem gesto novo pós-commit, when layout/scrollTo/observer/retorno ocorrem, then nenhum prefetch; botão ainda continua com parâmetros corretos.

## Design Notes
Após commit/layout aceito, registrar baseline e descartar sinais anteriores. Rearmar somente com saída/reentrada de sentinela decorrente de demanda válida ou deslocamento descendente causado por wheel/touchmove/tecla recebido depois desse commit. Reabrir gates não é demanda. Ordem de leitura pronta: cancel/close → páginas renderizadas → ajuste Provider efetivo → confirmação foco UI em commit posterior → hook combina mesmos scopes → observa. Este contrato vem da arquitetura ratificada, não pede decisão humana adicional.

## Implementation Notes
Plano técnico deriva da investigação e do plano amplo aprovado. As fontes históricas não são prova de aceite novo. Árvore formal precisa estar validada antes do handoff. Nenhum código foi alterado ao escrever este plano.
Verificação do orquestrador em Node 24.21.0 (recheck após o agente parar): `npm run check` passou com 20 arquivos e 125 testes; `npm run build` passou; `npm run e2e` passou com 70 testes. Na primeira suíte completa, dois dos seis testes de três incrementos (`ask`, `show`) falharam por ausência da segunda página após o primeiro End. Causa verificada: o detector só fica armado após a transição de leitura pronta (restauração em RAF, `setReadingCycle`, `completeReadingTransition`, novo render). Entrada antes desse ponto é descartada pelo contrato AD-2, então o teste não deve assumir armamento imediato. A correção ficou no teste: repetir o End real até a requisição aparecer, mantendo a asserção de exatamente uma requisição por episódio. Repetição de 12 rodadas com 4 workers, 72 de 72 testes passaram. Uma tentativa intermediária de elevar a janela de sinal para 750 ms foi revertida porque não resolveu a falha e não tinha evidência de causa.
Recheck final do orquestrador (Node 24.21.0, sequencial): `npm run check` passou com 125 testes unitários/integrados; `npm run build` passou; `npm run e2e` passou com 71 testes. Repetição de `listing` e `keyboard-focus-semantics` com 3 rodadas e 4 workers: 129 de 129. Correções da revisão independente: detector de demanda por episódio, com regressão; teste de três incrementos repete o End real até a página 2 aparecer, porque a demanda só arma após a transição de leitura pronta (AD-2 descarta entrada anterior); testes de posição aguardam os frames de restauração pendentes antes de rolar.


Implementação e auditoria final da matriz concluídas. RED pré-código nos testes unitários: três falhas esperadas demonstraram aceitação de página duplicada/metadados incompatíveis e projeção sem deduplicação. A primeira execução E2E de continuação rodou contra bundle desatualizado e falhou; após rebuild da implementação, a cobertura passou. A revisão quick encontrou quatro achados de correção média, todos triados para patch, corrigidos e verificados em testes direcionados e na suíte integral.

## Plan Change Log

## Review Triage Log
- medium — `client/src/features/listing/use-infinite-scroll.ts` (revisão independente, achado 1): o sinal de demanda ficava válido indefinidamente após um wheel; uma rolagem sem entrada (barra, Cmd+F) podia pedir a próxima página. Verificado no código: `validDemand` era setado em `onScroll` e nunca limpo. Verdict: real; route: patch. Correção: um episódio vale enquanto o movimento descendente causado pela entrada continua, expira após 250 ms de silêncio e termina na saída da sentinela. Regressão: `does not reuse a window wheel signal when a later scroll without input reveals the sentinel`.
- low — `client/src/api/use-stories.ts` (revisão independente, achado 2): cancelar a recuperação 410 com Voltar deixa estado de erro com "Tentar de novo" ao retornar, sem lista nem skeleton. Verdict: real, degradação visual sem pedido incorreto; route: defer para 1.2, que trata recuperação, retorno e restauração. Registrado como risco residual.
- medium — `client/src/api/use-stories.ts`: first-page responses were accepted without confirming `page === 1`; `getStories` returns generic JSON and does not validate the page number, so an anomalous page 2 could become the sequence origin and cause the next request to skip page 2. Verdict: real; route: patch; resolved by shared first-page acceptance validation and unit coverage.
- medium — `client/src/features/listing/ListingProvider.tsx`: the boolean one-shot handler only re-arms after `snapshotExpired` becomes false; recovery keeps it true, so a second active 410 before a successful append would not schedule the provider-owned reset to the top. Verdict: real; route: patch; resolved with a monotonic expiry revision and repeated-410 E2E coverage.
- medium — `client/src/features/listing/use-infinite-scroll.ts`: `isInteractiveTarget` drops PageDown/End/ArrowDown/Space from story links even though these keys can scroll the document; keyboard users on a link cannot trigger automatic continuation. Verdict: real; route: patch; resolved by permitting scroll keys on links and adding keyboard-link E2E coverage.
- medium — `client/src/features/listing/use-infinite-scroll.ts`: a downward wheel with no document movement leaves `pendingUserScroll` set indefinitely; a later unrelated/programmatic scroll can be treated as user demand. Verdict: real; route: patch; resolved by expiring pending input signals and adding stale-wheel E2E coverage.

## Verification
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npx vitest run client/src/api/use-stories.test.ts` -- 10 testes passaram; RED pré-código documentado em Implementation Notes.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run typecheck` -- exit 0.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build` -- exit 0.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npx playwright test e2e/listing.spec.ts e2e/keyboard-focus-semantics.spec.ts` -- 42 testes passaram (Node 24.21.0, Chromium 156.0.8078.4).
- `git diff --check fd0613334f7ed0aec95ff3d54362e4da8f847cff --` -- exit 0.
- Revisão independente quick: quatro achados médios triados para patch, todos corrigidos; verificações direcionadas e suíte integral passaram.
