---
kind: non-hitl-technical-plan
technical_ref: "4.2"
plan_status: technical-delivery-closed
formal_plan: "/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/story-layout-responsivo-texto-ampliado-e-alvos-de-toque-plan.md"
formal_workflow_status: blocked
created: "2026-10-12"
---

# Plano técnico NON-HITL — 4.2 Layout responsivo, texto ampliado e alvos de toque

**Estado: `technical-delivery-closed` por confirmação técnica da main; isso não equivale a aprovação humana nem altera o estado formal.** A revisão independente identificou **um finding P2 de produto**: os source links não tinham largura mínima de 44 px e o fixture `tiny.test` passava por pouco. O follow-up reproduziu o defeito com `x.io` antes do patch, corrigiu a largura mínima e adicionou uma guarda de visibilidade com regressão negativa; essa guarda reforça o teste e não é um segundo defeito runtime. O código permanece congelado após GREEN e QA consolidada da main. O plano formal 4.2 segue `blocked` após HALT VCS, com HITL pendente. A compatibilidade do proxy Firefox foi encerrada `FAILED` na pré-condição (executável Firefox Playwright ausente), não como RED do app. Nenhum texto-only nativo, escala de sistema ou AT foi provado.

## Objetivo e aceite

Corrigir somente falhas medidas nas telas de lista e detalhe para RNF-09. Em viewport CSS inalterado de 320 e 375 px, o documento não tem overflow horizontal, os controles não ficam cortados, e todos os alvos visíveis avaliados medem ao menos 44 × 44 CSS px. A interação existente permanece intacta.

A escala automatizada será uma **simulação explícita test-only**: capturar os `font-size` e `line-height` computados de todos os elementos HTML com texto visível antes de qualquer estilo, depois definir cada `font-size` individualmente a 2× o valor capturado e cada `line-height` numérico a 2× o valor original. Snapshot imutável evita cascata 4×; `normal` acompanha o font-size ampliado. A simulação deve alterar bounds de glyph/range single-line em pelo menos 1,8× e manter `innerWidth` exatamente 320/375. Não alterar `:root`/`html` font-size, `zoom`, transform, DPR ou viewport para simular aumento.

**Limite:** isto é stress de reflow tipográfico via style injection no teste, não prova Firefox nativo, escala OS, dispositivo nem AT. A validação real continua reservada à 4.5.

## Whitelist exata

1. `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/listing/listing.css` — CSS mínimo apenas para alvo(s) medidos abaixo de 44 × 44.
2. `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/detail/detail.css` — CSS mínimo apenas para alvo(s) medidos abaixo de 44 × 44; preservar wrap e `pre` scroll local.
3. `/Users/maurowidman/Projects/AI/prod-certo-green/e2e/responsive-text.spec.ts` — teste novo, rotas/fixture API próprias; sem alterar config ou fixture existente.
4. Este próprio documento NON-HITL — status, decisão técnica, gate e evidências/handoff.

Não alterar theme-toggle.css, markup/JSX, providers, state/router, tokens, sanitizer/server, manifests/lock, config, fixtures existentes, formal plan/TOML/ledger, settings ou Git. Se clipping exigir CSS de tema, parar para main ampliar a whitelist.

## Matriz e medições do E2E

Usar Chromium/configuração Playwright já existente e fixture interceptada pelo próprio spec, sem HN externo. Cobrir lista e detalhe em 320/375 CSS px, normal e simulado 2×; ambos os temas se couberem sem ampliar escopo. Registrar por cenário: `innerWidth`, `documentElement.scrollWidth/clientWidth`, valores computados pre/post, bounds de glyph representativo, e bounds width **e** height dos alvos visíveis.

Medir todas as seis tabs (rolando na faixa interna), botões/tema, link navegável da história, story source, detail source, anchors do corpo do comentário e toggle da árvore. Usar título/domínio/comentários longos para wrap. Verificar overflow horizontal, clipping/truncamento real e conteúdo/branch recolhível preservados. A ação da árvore deve alternar `aria-expanded`, preservar conteúdo e produzir zero requests API.

## Evidência do handoff anterior

A matriz foi executada no Chromium do Playwright `1.64.0` (`156.0.8078.4`), com Node `v24.19.0` e npm `11.17.0`, usando somente o novo spec e a configuração existente. A primeira tentativa não é evidência RED: o próprio spec abortou por locator ambíguo; após restringir o locator, foi corrigida também a associação dos campos `clientWidth`/`scrollWidth` no registro. O baseline válido foi executado contra o `client/dist` já existente, antes de qualquer CSS desta entrega, cobrindo lista/detalhe × 320/375 px × normal/simulado 200% × claro/escuro (16 cenários).

- **RED válido:** exit 1 por 34 medições de alvos abaixo de 44 × 44, repetidas entre os cenários; nenhum overflow horizontal do documento e nenhum clipping/truncamento real detectado. Exemplos normais: source da lista `44,77 × 16,8`; toggle de comentário `68,2 × 32`; source do detalhe `47,81 × 18,19`; link curto do comentário `23,47 × 18` CSS px. O baseline completo está em `/tmp/hn-4-2/run.c79f19/red-clean.log`, `/tmp/hn-4-2/run.c79f19/red-clean-measures.json` e `/tmp/hn-4-2/run.c79f19/red-clean-run.json`.
- **Patch mínimo:** em `listing.css`, source da história recebeu `min-height: 44px`; em `detail.css`, source e toggle da árvore receberam mínimo de 44 px e anchors do corpo do comentário viraram alvos inline-block com mínimo 44 × 44 px, limite de largura e quebra preservados. Nenhuma outra superfície/tema foi alterada.
- **Verificações pós-patch:** `npm run typecheck --workspace @hn/client` e `npm run build --workspace @hn/client`, ambos exit 0; em seguida apenas `e2e/responsive-text.spec.ts`, exit 0. GREEN: 16/16 cenários, todos alvos medidos ≥44 × 44 (menor bounds 44 × 44), `documentClientWidth` e `documentScrollWidth` iguais à viewport CSS em todos os casos, zero clipping e lista sem overflow horizontal. As tabs continuam alcançáveis por scroll interno. Toggle confirmou `aria-expanded` nos dois estados, conteúdo e resposta restaurados, sem request API adicional. Registros: `/tmp/hn-4-2/run.c79f19/client-typecheck-run.json`, `/tmp/hn-4-2/run.c79f19/client-build-run.json`, `/tmp/hn-4-2/run.c79f19/green.log`, `/tmp/hn-4-2/run.c79f19/green-measures.json` e `/tmp/hn-4-2/run.c79f19/green-run.json`.
- **Evidência da simulação:** em todos os oito cenários 200%, `innerWidth` e `html` font-size não mudaram (320/375 e 16 px); os `font-size` capturados ficaram em 2× e line-heights numéricos em 2×. Bounds do range de glyph single-line: largura 1,96× na lista e 1,97× no detalhe; altura 2×. Isto continua sendo stress tipográfico test-only, não escala nativa.

O E2E encerrou seu webServer próprio e a porta 4173 foi confirmada livre. Não foram feitos shared/server build, E2E completo, instalação/download, acesso a servidor alheio, leitura de segredo ou operação Git. Esse freeze anterior foi reaberto para o follow-up abaixo; o código foi congelado novamente após o novo GREEN, e agora só este registro NON-HITL foi atualizado.

## Follow-up após revisão independente

O fixture da história primária agora usa o domínio curto válido `x.io`; a história secundária mantém o domínio longo. `runScenario` aguarda a linha primária visível, os grupos fixos conferem a contagem esperada de alvos e `measureTargets` exige visibilidade de cada elemento em vez de ignorar alvos ocultos. Uma regressão negativa separada oculta por CSS test-only o source primário e confirma que a medição rejeita o alvo invisível em 100 ms. Esta é uma guarda de robustez do teste, não um defeito runtime separado.

- **RED antes do novo `min-width`:** na matriz (16 cenários dentro de um teste), foram capturadas 144 medições de alvo; 16 alvos falharam por largura, correspondendo ao source `x.io` na lista e no detalhe em claro/escuro, 320/375 px e normal/simulado 200%. Bounds da lista: `19,92 × 44` normal e `35,41 × 44` simulado; detalhe: `21,27 × 44` e `38,34 × 44`. Nenhum overflow horizontal ou clipping foi detectado. O teste negativo da guarda passou; o RED do teste matriz foi exclusivamente o finding de largura confirmado. Evidência preservada em `/tmp/hn-4-2/run.c79f19/followup/red.log`, `/tmp/hn-4-2/run.c79f19/followup/red-measures.json` e `/tmp/hn-4-2/run.c79f19/followup/red-run.json`.
- **Patch follow-up:** adicionou-se `min-width: 44px` apenas a `.story-row__source` em `listing.css` e `.detail__source` em `detail.css`, mantendo os mínimos de altura previamente testados e a quebra dos domínios longos.
- **GREEN:** no mesmo runtime Node `v24.19.0`/npm `11.17.0`, typecheck (`noEmit`) e build do client terminaram com exit 0; o spec focal terminou com exit 0: **2 testes Playwright passed**, sendo **1 teste matriz com 16 cenários e 144 medições de alvo**, mais **1 regressão negativa**. Todos os alvos esperados estavam presentes/visíveis e mediram ≥44 × 44; source `x.io` ficou `44 × 44` em cada cenário da lista e do detalhe. Sem overflow/clipping, sem alteração de conteúdo/estado da árvore e sem request API adicional ao alternar o toggle. Artefatos: `/tmp/hn-4-2/run.c79f19/followup/client-typecheck-run.json`, `/tmp/hn-4-2/run.c79f19/followup/client-build-run.json`, `/tmp/hn-4-2/run.c79f19/followup/green.log`, `/tmp/hn-4-2/run.c79f19/followup/green-measures.json` e `/tmp/hn-4-2/run.c79f19/followup/green-run.json`.
- **Proxy de texto:** os `font-size` capturados ficaram 2×, line-heights numéricos 2× e bounds do glyph single-line: largura 1,96× na lista / 1,97× no detalhe, altura 2×; `innerWidth` permaneceu 320/375 e `html` font-size 16 px. Continua sendo injeção test-only, não Firefox nativo, zoom real, escala OS/dispositivo ou AT.

## Fechamento técnico confirmado pela main (sem gate formal)

A coordenação confirmou a conclusão técnica de 4.2 após QA em runtime próprio, sem alteração de fonte do app nesta etapa. Os registros do arquivo de verificação da main são `verification/window-4-2-postreview.K2qAfU` (workspace) e `verification/live-compiled-responsive-4-2.ZR2HJz/{passed,failed-driver,helpers}` (compiled-real). Resultados reportados pela main — não executados por este worker:

- Workspace: Node `v24.21.0`, npm `11.19`; check `121/20`, build `3`; E2E oficial completo com **46 PASS em 7,9 s**; porta `4173` livre ao final.
- Compiled-real: Chromium `156`, execução concluída em `3,595 s` (um run, não p95), usando BFF compilado + `HnApiClient` real contra fixture HTTP raw privada, sem interceptação de `/api` no browser e **sem acesso ao HN público**. Cobriu lista e detalhe em 320/375 CSS px, normal e 200%, ambos os temas; 8 PNGs foram inspecionados. O primeiro driver terminou antes de Top renderizar (contagem zero); helper temporário passou a aguardar Top visível por até 8 s, sem alteração do app. As portas/browser próprios foram encerrados graciosamente.
- Conteúdo da fixture HTTP privada reportado: seis categorias e 220 comentários até profundidade 8. Foram feitas 360 medições por elemento/caso; os 700 registros agregados têm sobreposição e **não** representam 700 controles únicos. O menor bounds reportado foi `51,89 × 44` no fixture longo; o source `x.io` manteve `44 × 44`.
- A análise tipográfica registrou 3.970 linhas com `font-size` e `line-height` computados em 2×; `html` permaneceu em 16 px e DPR em 1. Bounds de glyph single-line ficaram em 2,111× na lista e 2× no detalhe. A comparação de requests foi `deepEqual`: zero chamadas adicionais ao BFF/HN. O estado da árvore recolhida em 200%, nas duas larguras, preservou botão de 24 px, corpo/respostas e `aria-expanded`, sem request adicional.

Esta QA confirma o fechamento técnico 4.2 nos limites declarados; não converte a injeção/simulação em prova de zoom nativo, texto-only de browser, escala de sistema/dispositivo, AT, first paint ou desempenho. Um tempo único também não sustenta p95. Os resultados acima são da coordenação, separados dos RED/GREEN locais registrados nas seções anteriores.

## Preservações e handoff

Foram preservados rotas/categorias, paginação/scroll, tema, conteúdo sanitizado, estado/semântica da árvore, contratos e requests existentes. O plano formal 4.2 e os artefatos formais continuam intactos e `blocked`; HITL permanece pendente. O fechamento técnico pela main está confirmado apenas no plano NON-HITL. O gate de Firefox permanece `FAILED` apenas por ausência do executável Playwright. Não declarar validação de teclado/foco (4.3), axe (4.4), Firefox nativo, escala real de sistema/dispositivo ou AT (4.5).