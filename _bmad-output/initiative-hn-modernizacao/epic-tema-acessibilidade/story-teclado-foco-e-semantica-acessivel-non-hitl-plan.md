---
kind: non-hitl-technical-plan
technical_ref: "4.3"
plan_status: technical-closure-confirmed
formal_ticket: "/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/tickets.toml#entry-3"
formal_workflow_status: planned
created: "2026-10-12"
---

# Plano técnico NON-HITL — 4.3 Teclado, foco e semântica acessível

**Escopo NON-HITL focal decidido pela coordenação AI sob autorização humana PREEXISTENTE de preservar/prosseguir a iniciativa; não houve aprovação humana desta whitelist específica nem novo consentimento.** O lease de trabalho ficou limitado a `client/src/features/listing/StoryListPage.tsx`, `e2e/keyboard-focus-semantics.spec.ts` e este documento NON-HITL; sem CSS, outros arquivos, Git, build server/shared ou E2E oficial completo. `plan_status` é auxiliar e agora registra fechamento técnico confirmado pela MAIN. O campo `formal_workflow_status: planned` abaixo é o valor histórico capturado no registro anterior; este adendo não o edita nem afirma o estado formal atual. A entrada formal id 3 tinha sido registrada como `after = [2]`, `hitl = false`, `risk = "high"`, `gated_by` sem alteração; atualizações de registros formais ficam com MAIN e doca587. O workflow formal 4.3 não foi invocado nem recebeu HALT por este worker, e nenhum plano/ticket formal foi escrito por este adendo. O workflow auxiliar `bmad-build` parou no gate VCS de `/_bmad/render/bmad-build/prod-certo-green-ec55b3ac02f9/cfb9ec85d4014425a410/step-01-clarify-and-route.md` (linha 68) e não foi retomado; não houve operação Git, alteração de settings/permissions ou bypass de uma negação de ferramenta. A autorização humana preexistente de preservar/prosseguir cobre a árvore suja sem limpar/prejudicar mudanças anteriores; não aprova esta whitelist específica. O aceite técnico automatizado não implica teste nativo, validação por AT/leitor de tela ou conformidade WCAG completa; nenhum gate formal/HITL é declarado satisfeito aqui.

## Objetivo

Validar por eventos de teclado reais do Playwright a navegação e ativação nas seis categorias, paginação, controle de tema e recolhimento da árvore de comentários. Confirmar foco visível e ordem lógica, nomes/roles/estados acessíveis no DOM e redução de movimento nos estados reais de carregamento. Preservar providers, router, cache, contratos, tokens de tema, conteúdo sanitizado, URLs e comportamento de requests.

A travessia e a ativação devem usar `page.keyboard.press('Tab' | 'ArrowRight' | 'ArrowLeft' | 'Enter' | 'Space')`. Locators podem ser usados para esperar e verificar o foco/estado, mas `locator.focus()`, `locator.press()` e `locator.click()` não contam como travessia ou ativação por teclado nesta evidência.

## Leitura estática do estado atual

- `StoryListPage.tsx` já implementa um `tablist` horizontal com seis `tab`s, seleção roving por `tabIndex`, `aria-selected`, `aria-controls`, painel com `aria-labelledby`, e setas esquerda/direita com wrap. As setas movem o foco; Enter/Space devem ativar os botões nativos e selecionar a categoria.
- Paginação e tema são botões nativos. O load-more expõe texto de ação, `aria-busy`/disabled durante carregamento e status; `ThemeToggle` tem nome acessível e `aria-pressed`.
- `CommentTree.tsx` usa botões nativos com nome de ação/contagem e `aria-expanded`. Recolher/expandir é estado de UI local; o teste deve confirmar que não surge request adicional.
- As telas já declaram `:focus-visible` nos alvos interativos. `listing.css` e `detail.css` removem a animação de pulse dos skeletons reais em `prefers-reduced-motion: reduce`. A busca estática encontrou animações somente nesses loaders e nenhuma regra `transition` no CSS atual. Por isso a verificação de movimento deve cobrir os loaders existentes e não inventar uma transição ou uma regra global.
- Os testes atuais cobrem estados e interações, mas parte da cobertura usa clique, `.focus()` ou `locator.press()`; isso não comprova a sequência integral de Tab nem travessia de foco real.

**Não há, nesta leitura estática, finding de produto confirmado que justifique editar JSX/CSS.** O primeiro passo do lease técnico definido pela coordenação é transformar eventuais divergências de teste em evidência RED reproduzível; não presumir defeito nem ampliar a whitelist.

## Whitelist exata do lease NON-HITL definido pela coordenação

1. `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/listing/StoryListPage.tsx` — correção mínima para rolagem instantânea da tab focada e ownership/restauração segura do foco na paginação; manter ARIA, requisições, busy/disabled, snapshot, append e scroll-return.
2. `/Users/maurowidman/Projects/AI/prod-certo-green/e2e/keyboard-focus-semantics.spec.ts` — spec focal e fixtures locais próprias; incluir movimento do foco durante request retida e append real de páginas de 30 itens.
3. Este documento NON-HITL — registrar evidências, decisões e handoff.

`listing.css` não está autorizado. A solução planejada é somente TypeScript/DOM em `StoryListPage.tsx`; se a implementação exigir CSS, outro arquivo ou mudança estrutural, parar e enviar proposta exata à main antes de editar. Não tocar em JSX fora desse arquivo, providers, router, cache, contratos, tokens, sanitizer, configuração Playwright, manifests/lock, tickets ou planos formais.

## Plano de verificação focal

### 1. Seis tabs e foco em viewport estreito

- Usar fixture de lista própria do spec e executar a travessia em 320 e 375 CSS px.
- Partindo do foco inicial do documento, Tab deve chegar à tab Top; verificar role `tablist`/nome “Categorias”, role e nomes das seis tabs, seleção única, `aria-controls` existente e painel nomeado pela tab selecionada.
- Percorrer New, Best, Ask, Show e Jobs com ArrowRight e ativar cada uma com Enter; Arrow deve revelar integralmente a tab focada na faixa interna, sem ativar categoria nem usar rolagem suave. Conferir foco visível, `aria-selected`, título/painel, URL e requests. Conferir wrap dos dois sentidos (Jobs → Top e Top → Jobs), Tab para sair do grupo e visibilidade interna de Jobs a 320 e 375 px. Depois de voltar à tab Top por teclado, percorrer o painel até o link interno da história e ativá-lo com Enter, confirmando a rota de detalhe.
- Verificar que Tab sai do grupo roving na ordem DOM esperada, sem pular nem prender o foco. Só usar teclado para foco e ativação; os asserts de role/estado não devem deslocar o foco.

### 2. Tema e paginação na lista

- Com fixture local de páginas reais de 30 histórias, usar apenas Tab sucessivos desde o tablist até tema, links e botão de carregar mais; verificar a decisão de foco após um append 30→60, quando o botão pode sair da viewport.
- Ativar o tema por teclado com Enter e Space; confirmar após cada tecla que o mesmo botão conserva foco visível, nome e `aria-pressed` coerentes, tema visual atualizado, URL/scroll/conteúdo sem mudança e zero requests API adicionais.
- Ativar “Carregar mais” por Enter com resposta retida; conferir um request por página e a tupla (`category`, `page`, `limit`, `snapshot`), `disabled`/`aria-busy` e status acessível. Sem mudança do usuário, restaurar o foco no botão ainda conectado e visível após append (rolagem nativa instantânea até ele, não `preventScroll`). Em cenário separado na mesma sequência, mover o foco por Shift+Tab enquanto o gate está retido e confirmar que a conclusão não rouba o foco; a política também deve descartar restauração após categoria/rota mudar ou botão sair do DOM. Preservar busy/disabled nativo e prevenir requests duplicados. Usar gates limitados, deadlines, liberação em `finally` e drenar handlers antes de fechar a página.

### 3. Tema e árvore no detalhe

- Abrir diretamente a rota de detalhe com uma história cujo `domain`/`url` sejam nulos e árvore própria do spec; não omitir silenciosamente um source link focável. A fixture terá root → child → grandchild para que root e child tenham respostas carregadas não vazias e, portanto, botões de toggle.
- Percorrer por Tab os controles em ordem DOM (Voltar, tema, toggles da árvore). Alternar tema com Enter e Space e recolher/expandir root e child com ambas as teclas; verificar foco preservado, `:focus-visible` e outline computado, além do retângulo visível na viewport.
- Verificar no DOM o nome/role dos toggles, `aria-expanded` em ambos os estados, presença/ausência do corpo e respostas conforme o estado e zero requests adicionais causados por recolher/expandir. Tab após reexpandir deve alcançar o toggle do filho; nenhum nó oculto pode continuar no percurso de foco.

### 4. Movimento reduzido em loaders reais

- Emular `prefers-reduced-motion` no contexto Playwright, confirmar o valor real de `matchMedia` e retê-lo enquanto a lista está em carregamento; verificar `animation-name` ativo em `no-preference` e `none` em `reduce` no `.story-skeleton` visível.
- Repetir para `.detail__skeleton` visível com a requisição de item retida. Cada gate tem deadline, liberação em `finally` e drain dos handlers antes de fechar a página; qualquer abort intencional é registrado separadamente e não contado como request de produto adicional.
- Não afirmar que uma transição inexistente foi testada: a fonte atual não declara `transition`. Se a execução descobrir outro efeito de movimento real no escopo, registrar o RED e solicitar whitelist específica, sem introduzir CSS global nem desabilitar animações fora dos estados reais cobertos.

## Critérios de saída e evidência

- Travessia inteira ocorre por teclado, sem chamada programática de foco/clique/press; cada controle esperado é alcançado, ativado e tem foco visual verificável por `:focus-visible`, outline computado e retângulo na viewport; tab Jobs também deve estar dentro da faixa horizontal.
- Os seis tabs mantêm associação e estados ARIA coerentes; tema expõe nome e `aria-pressed`; paginação mantém nome, busy/status e ativação; árvore anuncia expansão/recolhimento e preserva conteúdo/requests conforme descrito.
- `prefers-reduced-motion` suprime as animações dos dois loaders em estado de carregamento, sem alegar validação de todos os efeitos do sistema.
- Preservar resposta/URL e contagens de requests previstas; fixture não acessa HN real e não depende de alteração de cache/provider/router.
- Guardar stdout/status do spec focal, contagens distintas de testes e cenários, runtime e estado da porta `4173` antes/depois. A aceitação formal do ticket pede `npm run e2e`, mas este lease autoriza somente o spec focal; worker não executa Root build nem E2E oficial. Após handoff congelado, a main decide e executa sua QA serial separada. O resultado de full Root/E2E permanece desconhecido por este worker.

## Limites e gates

A evidência é de DOM e eventos de teclado em Playwright/Chromium; não comprova anúncios efetivos de leitor de tela, ordem de leitura com AT, navegador/sistema operacional/dispositivo ou conformidade WCAG completa. Não executar axe (entrada 4), nem marcar a entrada HITL 5 como aceita. Se o teste focal falhar por comportamento de produto, manter o achado aberto e enviar à main o RED, arquivo/linha e evidência atual antes de qualquer patch. O status formal permanece `planned`, sem invocação do workflow formal 4.3 nesta preparação e sem HALT. O lease de coordenação não é aprovação humana; nenhum gate formal/HITL foi satisfeito.

## Execução focal NON-HITL (2026-10-12)

A execução focal inicial desta seção ficou restrita a `e2e/keyboard-focus-semantics.spec.ts`; não houve build, full Root/E2E, alteração de fonte de produto, instalação ou acesso ao HN público. Foi corrigida a fixture de teste para responder `/api/stories` no cenário de detalhe e a asserção de nome acessível durante `loadingMore`; a asserção de conjunto de requests usa ordenação explícita. O resultado histórico dessa execução foi RED parcial, não aceite formal.

- Runtime do mesmo run focal: Node `v24.21.0`, npm `11.19.0`, Playwright `1.64.0`, Chromium `156.0.8078.4`. A porta `4173` estava livre antes e depois. Log: `/tmp/hn-4-3-keyboard.0YTBIh/focal.log`; captura de runtime/porta/status: `/tmp/hn-4-3-keyboard.0YTBIh/runtime.txt`; exit `1`.
- **6 testes Playwright:** 3 PASS e 3 FAIL. São dois casos do mesmo finding de rolagem/foco nas tabs: em 320 px, **Ask permanece selecionada** e **Show fica ativa** parcialmente fora da viewport (`x=268,28–334,11`); em 375 px, **Show permanece selecionada** e **Jobs fica ativa** parcialmente fora (`x=342,11–402,84`). O foco está ativo e o outline computado existe, mas ArrowRight não revela integralmente a tab focada dentro da faixa. Essa correção factual identifica a tab ativa em cada viewport; os logs originais não foram alterados. A evidência é `e2e/keyboard-focus-semantics.spec.ts:222`, helper `:161`; logs originais em `/tmp/hn-4-3-keyboard.kjLUTB` e `/tmp/hn-4-3-keyboard.0YTBIh`.
- O teste de paginação confirma Enter, request único de página 2 com `category=top`, `page=2`, `limit=30`, `snapshot=snapshot-keyboard-pagination-v1`, estado `disabled`/`aria-busy` e carregamento da segunda história; falha ao confirmar foco após reabilitar o botão “Carregar mais”, que fica desfocado (`e2e/keyboard-focus-semantics.spec.ts:365`).
- PASS: tema e disclosure da árvore de comentários, incluindo conteúdo/descendentes e nenhuma chamada API extra; redução de movimento nos loaders reais de lista/detalhe; guarda negativa test-only para outline invisível.
- A coordenação AI confirmou os dois REDs e decidiu o escopo técnico NON-HITL estrito em `StoryListPage.tsx` + spec + este documento sob a autorização humana PREEXISTENTE de preservar/prosseguir a iniciativa. Não houve aprovação humana desta whitelist específica nem novo consentimento; nenhuma correção de produto foi feita antes da decisão da coordenação. Naquele ponto, as categorias e a paginação permaneciam abertas; o resultado focal está registrado abaixo, ainda aguardando revisão/consolidação. Full Root/E2E continua desconhecido por este worker.

## Resultado focal RED→GREEN antes da revisão/Root pós-patch (registro histórico 2026-10-12)

As duas divergências de produto ficaram verdes após correções somente em `StoryListPage.tsx`: navegação por seta calcula um ajuste horizontal instantâneo com margem de 1 CSS px para que a tab inteira caiba no scrollport, sem alterar seleção; restauração da paginação aguarda o frame seguinte ao scroll-return existente, revela o botão com rolagem instantânea e revalida categoria, URL, conexão do controle e ownership de foco. Um listener de captura descarta a restauração ao primeiro Tab/Shift+Tab, inclusive no intervalo até o frame. O spec espera a história assíncrona estar visível antes de testar a saída do tablist, evitando uma corrida de carregamento da fixture sem reduzir as asserções de foco/viewport.

- Build focal do cliente passou (`npm run build --workspace=@hn/client`, incluindo `tsc -p tsconfig.json --noEmit` e Vite 8.3.4; 39 módulos): `/tmp/hn-4-3-keyboard-candidate.WuWbs1/client-build.log` (exit 0).
- Spec focal passou: **6/6 testes, 0 falhas**, Chromium `156.0.8078.4`; log/stdout e runtime/status do mesmo run: `/tmp/hn-4-3-keyboard-candidate.WuWbs1/focal.log` e `/tmp/hn-4-3-keyboard-candidate.WuWbs1/runtime.txt` (exit 0). Node `v24.21.0`, npm `11.19.0`, Playwright `1.64.0`; porta `4173` livre antes e depois. Verificação de presença somente: `.env`, `.env.local`, `.env.production` e `.env.production.local` ausentes na raiz e em `client/`; nenhum conteúdo de segredo foi lido.
- Cobertura real contabilizada: 2 instâncias de tablist (320/375 px), cada uma percorre/ativa as seis categorias e verifica wrap, scroll instantâneo, ausência de seleção/request por foco e retorno por teclado ao detalhe; 1 cenário de paginação com respostas retidas, Shift+Tab preservado em 30→60 e restauração visível/scroll após 60→90; 1 cenário de tema e disclosures da árvore; 1 cenário de movimento reduzido nos loaders reais de lista e detalhe; 1 guarda negativa para outline invisível. As 6 instâncias passaram.
- REDs anteriores e traces/contextos foram preservados, incluindo `/tmp/hn-4-3-evidence.oWKzxh/`, `/tmp/hn-4-3-keyboard-red.mdfp8O/`, `/tmp/hn-4-3-keyboard-green.OYrQzu/failed-test-artifacts-preserved/`, `/tmp/hn-4-3-keyboard-final.eid5Bj/failed-test-artifacts-preserved/` e `/tmp/hn-4-3-keyboard-postbuild.ZlSkNc/failed-test-artifacts-preserved/`. Duas execuções intermediárias ocorreram antes de rebuildar `client/dist`, servido pelo harness; o único resultado RED→GREEN considerado é o run pós-build acima, ainda não consolidado como aceite.
- No corte deste registro, a entrega focal estava congelada enquanto aguardava revisão independente READONLY, consolidação e Root/QA da main; o fechamento técnico ainda estava pendente. A revisão independente ficou a cargo de aaf. O estado foi supersedido pela confirmação de fechamento técnico da MAIN documentada na seção seguinte. O ticket/workflow formal e a consolidação correspondente não são atualizados por este documento.

## Adendo — fechamento técnico confirmado pela MAIN (2026-10-12)

A MAIN confirmou fechamento TÉCNICO de 4.3 após a revisão original de fonte de aaf ser encerrada e após nova QA compilada e verificação Root pós-patch. O ajuste final de produção foi um patch de uma linha feito pela MAIN em `client/src/features/listing/StoryListPage.tsx:136`, trocando `block: 'nearest'` por `block: 'center'` no `scrollIntoView` de foco owned. O RED residual anterior é preservado literalmente como finding histórico: `/tmp/hn-4-3-actual-compiled-postfix.qu5p5l/` registrou foco correto após 30→60, mas `block: 'nearest'` deixava o botão em `bottom=820.296875` e o anel em `825.296` para viewport 820 px, com `scrollY=8242`. Não se afrouxou a asserção geométrica. A fonte agora está congelada; este worker não fez esse patch nem reexecutou QA.

- **QA focal compilada, executada e validada pela MAIN**: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-keyboard-4-3.Whvc85/passed-focus-margin`. Janela `2026-10-12T18:07:56.711Z`–`2026-10-12T18:07:58.919Z` (**2208 ms, um único run; não é p95**), Node `v24.21.0`, npm `11.19.0`, Chromium `156`. A MAIN abriu todos os 8 PNGs. Resultados reportados: 28 verificações sem requests de rede; 285 IDs HN positivos, contador 1 cada; 6 listas, contador 1 cada; 220 comentários visíveis no depth padrão 8; página 2 com exatamente uma request e 60 rows; `rect.bottom=772.296875`, anel `777.296875 < 820`; motion `4→0`; `errors=[]`; portas próprias `65292` e `65291` livres; `stop=0`, sem force. O build do cliente passou.
- **Verificação Root pós-center executada, lida e validada pela MAIN**: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-3-focus-margin-postreview.ORA8s6`. Runtime Node `v24.21.0`/npm `11.19.0`; 121 testes/checks em 20 arquivos, 50.11 s; 3 builds; E2E `52/52` em 8.0 s; porta `4173` livre antes/depois; 6 hashes compatíveis; 8 verificações de presença de arquivos de ambiente ausentes. Nenhum valor de segredo foi lido. A MAIN leu e validou os logs; este worker não repetiu a execução.
- A verificação automatizada sustenta somente aceite técnico automatizado autorizado. **Não** significa testes nativos, avaliação de leitor de tela/AT, WCAG completa ou aceitação manual/HITL universal. Axe da 4.4 não foi executado nem instalado neste escopo e não há resultado 4.4 a declarar. As lacunas de cobertura declaradas neste plano continuam.
- A autorização humana para commits locais seletivos sem push pertence à MAIN e não foi exercida por este worker; nenhum Git/commit/push foi executado aqui. MAIN e doca587 coordenam eventuais atualizações formais/canônicas/ledger; este adendo altera somente este plano NON-HITL. O campo formal de front matter permanece o snapshot anterior, sem afirmar o estado formal corrente.
