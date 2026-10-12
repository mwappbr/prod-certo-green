---
title: "Carregar mais com snapshot e posição preservada"
ticket: 5
status: done
---

## Auto Run Result

- **Resultado formal:** `blocked` no workflow `bmad-build-auto` para o ticket 2.5, invocado uma vez com `route=full` e `review=quick`.
- **Bloqueio:** a árvore de trabalho estava suja e a branch `feat/plataforma-1-1-tracer` não corresponde ao épico `epic-listagem`.
- O gate de VCS exige árvore limpa e branch compatível. Não executei `git add --refresh -- .`, pois a instrução vigente proíbe stage; não limpei nem troquei a branch.
- O workflow formal parou no passo 1, antes de gerar um plano formal ou implementar. Este `status: blocked` registra o HALT real; não significa `ready-for-dev`, `built`, `done` ou aceite humano.
- Nenhum código 2.5, build ou teste foi executado nesta etapa. O restante deste arquivo é planejamento técnico NON-HITL sob a coordenação explícita, não muda o resultado formal nem libera implementação.

## Plano técnico NON-HITL — preparação, não aprovação formal

### Escopo

Entregar paginação explícita por snapshot na listagem, preservando os itens e a posição ao anexar páginas, com recuperação previsível para falha e `SNAPSHOT_EXPIRED`. Incluir somente a rota `/item/{id}` como placeholder navegável para validar retorno à lista; metadados e comentários reais do detalhe permanecem fora do escopo e pertencem ao ticket 3.1.

Preservar categorias, tratamento de `ListingItem = Story | Job`, estados de carregamento/erro/vazio/cache vencido e acessibilidade existentes. Não adicionar `kind`, casts, paginação automática por rolagem, dependências de roteamento ou mudanças de manifests.

### Decisões de contrato e comportamento

1. **Contrato aditivo:** `StoriesPage` mantém os seis campos obrigatórios existentes (`items`, `page`, `limit`, `snapshot`, `cachedAt`, `stale`) e recebe `hasMore?: boolean`. O BFF deve sempre emitir `hasMore` como boolean em respostas novas, calculado dos slots da página na lista original de IDs antes de normalizar/filtrar itens:
   `hasMore = offset + pageIds.length < ids.length`.
   Não inferir fim com `items.length`, não adicionar `total`, categoria obrigatória, chave de cache ou TTL.
2. **Ausência conservadora:** no cliente, `hasMore === false` é o único fim conhecido. `true` permite continuação; `undefined` significa desconhecido e não deve esconder o botão nem ser convertido em fim. A continuação continua sendo somente por clique explícito, nunca por scroll.
3. **Pedido seguinte:** para a categoria ativa, enviar `page = página atual + 1`, `limit = response.limit` da primeira página e `snapshot = response.snapshot` da primeira página. Nunca usar `cachedAt` como substituto de `snapshot`; os testes devem usar valores diferentes para os dois campos.
4. **Agregação da listagem:** guardar respostas de página e projetar os itens em ordem, acrescentando cada página somente após sucesso. O estado local deve distinguir `loadingMore/errorMore` dos estados da primeira carga; falha em página seguinte não apaga nem substitui itens já visíveis. Desabilitar requisição duplicada enquanto a mesma página está em voo.
5. **Erro e expiração:** erro recuperável em página seguinte mantém itens, categoria, página e snapshot e oferece retry da mesma requisição. `SNAPSHOT_EXPIRED` invalida toda a sequência, inicia novamente a página 1 da mesma categoria e exibe aviso de atualização; não misturar itens de snapshots diferentes. No reinício, voltar ao topo é aceitável porque a sequência anterior foi descartada.
6. **Posição e navegação:** manter estado de paginação e rolagem em `ListingProvider` acima da troca entre lista e detalhe, conforme AD-8. Antes de anexar, capturar a posição; após renderizar os itens, restaurar a posição sem salto para o topo. Ao abrir `/item/{id}`, preservar páginas, categoria e posição; `Voltar`/Back restaura URL, aba, título, itens e posição. A rota de detalhe não chama API de item/comentários nesta entrega.
7. **Frescor:** ao combinar páginas, preservar o aviso de dado vencido se alguma página estiver `stale`; o horário exibido deve representar a data mais antiga entre as páginas atualmente visíveis, sem confundir esse valor com o snapshot de paginação.

### Propriedade e caminhos previstos

**Frontend e E2E — este escopo, após handshake:**

- `client/src/api/stories.ts`: aceitar parâmetros opcionais de página/limite/snapshot e serializá-los na query da rota existente; o pedido inicial continua usando o limite padrão do servidor.
- `client/src/api/use-stories.ts` e `client/src/api/use-stories.test.ts`: ampliar estado e testes para página seguinte, append, aborto/ignorar resposta tardia ao trocar categoria, erro preservando conteúdo e retry com os mesmos parâmetros.
- `client/src/features/listing/ListingProvider.tsx`: manter o buffer de páginas, categoria, estado da rota e posição; estado vive acima das rotas, conforme AD-8, e não é perdido ao renderizar o placeholder.
- `client/src/App.tsx`: selecionar lista ou placeholder por rota usando a History API já existente, sem nova biblioteca.
- `client/src/features/listing/StoryListPage.tsx`: botão “Carregar mais”, skeleton no fim da lista durante a busca incremental, e mensagem/retry de falha abaixo dos itens já visíveis; estado de fim baseado apenas em `hasMore === false`, e vazio verdadeiro somente quando não há itens nem páginas futuras conhecidas.
- `client/src/features/listing/StoryRow.tsx`: tornar navegável para o detalhe a área interna da linha (título/metadados), deixando o controle do link externo separado, com rótulo “Abrir {domínio} em nova aba”; preservar `ListingItem` sem cast ou `kind`.
- Novo `client/src/features/listing/ItemPlaceholderPage.tsx`: placeholder acessível em `/item/{id}` e controle “Voltar”; sem dados reais de detalhe.
- `client/src/features/listing/listing.css`: estados do botão/skeleton/aviso sem overflow horizontal ou alteração de posição.
- `e2e/listing.spec.ts`: testes observáveis pela interface com respostas controladas via Playwright; sem depender da ordem do HN ao vivo.

**Backend/Shared — proprietário separado:**

- `shared/contract/stories.ts`: tipo aditivo `hasMore?: boolean`.
- `server/src/app/get-stories.ts`: sempre emitir `hasMore` calculado dos IDs brutos do snapshot antes da normalização.
- Testes focados em `server/test/`: provar páginas com item inválido (29 itens normalizados ainda com mais IDs), página intermediária sem itens normalizados mas com `hasMore: true`, e fim real com `hasMore: false`.

`adde1` é o writer de backend/shared após aprovação/handshake separado. Não editar esses arquivos nem os manifests neste trabalho de frontend; evitar writers concorrentes.

### Sequência de implementação depois da autorização

1. Fechar o handshake de propriedade do wire `hasMore` com `adde1`; confirmar que o contrato e o BFF usam os slots brutos de IDs e que as mudanças de backend/shared não conflitam com o client.
2. Estender a API client e os testes unitários de requisição/hook, garantindo `snapshot` distinto de `cachedAt`, abortamento e retry idempotente da mesma página.
3. Mover/manter o estado paginado no `ListingProvider`; integrar append, scroll, retry e reinício por expiração na tela da lista.
4. Adicionar rota placeholder e navegação de retorno, preservando provider, URL/categoria, buffer e posição.
5. Acrescentar E2E de ponta a ponta para as sequências abaixo; revisar regressões de categorias/Jobs, estados existentes e responsividade.
6. Validar em uma janela coordenada Node 24. Não iniciar builds/testes de raiz, servidor ou E2E completos fora da janela do coordenador; não stage/commit/push/reset/stash/clean.

### Critérios de aceite técnicos para a futura revisão

1. **Parâmetros do snapshot:** Dado que a primeira resposta contém `page=1`, `limit=30`, `snapshot=S` e `cachedAt=C` com `S !== C`, quando a pessoa clica “Carregar mais”, então a chamada da página 2 usa a mesma categoria, `page=2`, `limit=30` e `snapshot=S`, e não envia `cachedAt` como snapshot.
2. **Normalização não encerra a lista:** Dada uma página com 29 itens renderizáveis e `hasMore: true`, quando ela é exibida, então “Carregar mais” continua disponível e o próximo clique busca a página seguinte.
3. **Página intermediária vazia:** Dada uma resposta de continuação com `items: []` e `hasMore: true`, então os itens anteriores permanecem, a ação manual continua disponível e nenhuma página adicional é buscada sem novo clique; após esse clique, a próxima requisição avança `page` em 1 mesmo que a página vazia não tenha acrescentado itens.
4. **Sem scroll infinito:** Dada uma lista com `hasMore: true`, quando a pessoa rola até o fim sem ativar o botão, então nenhuma chamada de página seguinte ocorre.
5. **Fim conhecido e flag ausente:** Dada uma resposta com `hasMore: false`, então não há continuação oferecida nem requisitada. Dada uma resposta sem `hasMore`, então a lista trata o fim como desconhecido, mantém a continuação manual e não deduz fim pela quantidade de itens.
6. **Append, posição e dupla ativação:** Dada uma página seguinte bem-sucedida, quando os itens são anexados, então a ordem existente é mantida, os novos itens aparecem ao final e a posição visível não salta ao topo. Se “Carregar mais” for ativado duas vezes enquanto a mesma página está em voo, ocorre somente uma requisição e cada item é anexado uma única vez.
7. **Erro e retry:** Dada uma falha de rede/servidor na continuação, quando a falha é mostrada abaixo dos itens existentes, então esses itens seguem visíveis; ao ativar retry, a mesma categoria, página, limite e snapshot são reutilizados e os itens só são anexados após sucesso.
8. **Snapshot expirado:** Dado `SNAPSHOT_EXPIRED` ao carregar mais, quando a recuperação termina, então a lista antiga foi descartada, a página 1 da mesma categoria foi buscada sem o snapshot expirado, um aviso de atualização foi anunciado e nenhum item da sequência antiga permanece misturado.
9. **Resposta tardia/troca de categoria:** Dado um pedido incremental pendente, quando a pessoa troca de categoria ou a sequência é reiniciada, então uma resposta antiga é abortada ou ignorada e não aparece na nova lista.
10. **Retorno do placeholder:** Dada uma categoria e páginas carregadas, quando a pessoa abre `/item/{id}` e volta por “Voltar” ou Back, então a URL/categoria, o buffer já carregado e a posição anterior são restaurados sem refetch gratuito da página 1; o placeholder não faz chamadas de detalhe/comentários.
11. **Acessibilidade e regressões:** Os controles funcionam por teclado, o carregamento/erro tem anúncio acessível e os cenários atuais de Story/Job, troca de categoria, Back/Forward, metadados e responsividade continuam passando.

### Plano de verificação quando autorizado

- Unitário client: query da API com `snapshot !== cachedAt`; append de respostas, controle de página em voo, retry com parâmetros idênticos, aborto/ignorância de resposta antiga e sem encerramento por `items.length`.
- E2E Playwright em `e2e/listing.spec.ts`: fixtures controladas para sequência 29/30, página vazia intermediária, ausência de auto-load, `hasMore` ausente/falso, falha+retry, `SNAPSHOT_EXPIRED`, retorno do placeholder com categoria/posição e troca de categoria durante pedido pendente.
- Backend/shared, sob `adde1`: testes do cálculo sobre slots de IDs antes da normalização e do boolean sempre presente no wire novo.
- Validação integrada apenas em janela coordenada Node 24 e depois de confirmação dos owners; não executada neste planejamento.

### Resultados técnicos NON-HITL — não alteram o HALT formal

- Fontes client estáveis para revisão independente: `client/src/api/stories.ts`, `client/src/api/use-stories.ts`, `client/src/api/use-stories.test.ts`, `client/src/features/listing/ListingProvider.tsx`, `client/src/features/listing/StoryListPage.tsx`, `client/src/features/listing/StoryRow.tsx`, `client/src/features/listing/ItemPlaceholderPage.tsx`, `client/src/features/listing/RouteErrorPage.tsx`, `client/src/features/listing/listing.css`, `client/src/App.tsx` e `e2e/listing.spec.ts`.
- Verificações executadas por este writer com runtime efetivo registrado Node `v24.21.0` / npm `11.19.0`:
  - `npm exec -- vitest run client/src/api/use-stories.test.ts` — 1 arquivo, 6 testes passaram.
  - `npm run build -w @hn/client` — `tsc --noEmit` e Vite client build passaram.
  - `git diff --check` retornou sem saída para mudanças rastreadas; como as fontes client/E2E estão em diretórios não rastreados na árvore suja preexistente, esse comando não valida whitespace delas e não é contado como verificação dessas fontes.
- O E2E completo não foi executado por este writer; os cenários focados preparados foram executados depois da revisão independente, conforme evidência abaixo.
- A coordenação reportou suporte focado do produtor em 2 arquivos/22 testes e `src/tests` noEmit, pass em Node `24.19.0` / npm `11.17.0` (20,12 s) e em Node `24.21.0` / npm `11.19.0` (20,79 s). Esses resultados são repassados pela coordenação, não executados por este writer.
- Os tipos `hasMore` foram emitidos e estão disponíveis. A proveniência de runtime do shared-only build não foi confirmada; portanto, este plano não o atribui a Node 22 nem Node 24. A coordenação fará revalidação shared em Node 24 na janela serial final.
- Não foi recompilado `server/dist`, nem executados build/teste de raiz ou E2E completo; os testes focados posteriores usaram o `server/dist` estável informado pela coordenação. Não foram editados backend/shared/manifests pelo writer client. Árvore preservada sem stage/commit/push.

### Revisão técnica independente — correções NON-HITL (2026-10-12)

- A revisão read-only independente `aaf1` encontrou três problemas P2. A coordenação liberou patches pequenos apenas em client/E2E/plano 2.5, mantendo backend/shared congelado e sem aceite/revisão formal.
- Correções aplicadas:
  1. `ListingProvider` valida `category` de `history.state` ao entrar em rota `/item/{id}` via popstate; `/item` preserva a categoria e o buffer nas transições Back/Forward. A validação usa type guard de `StoryCategory`, sem `any` ou cast de categoria.
  2. `useStories` cancela o `requestAnimationFrame` de restauração e invalida sua geração quando categoria/tentativa muda; callback tardio valida categoria, tentativa e geração antes de rolar.
  3. Rota desconhecida e IDs de item inválidos/fora do intervalo seguro exibem página acessível “Página não encontrada” com retorno à listagem. Detalhe válido permanece placeholder, sem endpoints de item/comentários ou dependência de roteamento.
- RED antes das correções, contra o `client/dist` congelado: 6 cenários Playwright focados falharam nas asserções esperadas (New/Jobs perdiam as 2 páginas após Forward→Voltar; RAF antigo deslocava scroll para `341` após troca; unknown/invalid routes não mostravam erro). GREEN após `npm run build -w @hn/client`: os mesmos 6 cenários passaram em 2,1 s. Com Node `v24.21.0` / npm `11.19.0`, também passaram `npm exec -- vitest run client/src/api/use-stories.test.ts` (1 arquivo/6 testes) e o build client (`tsc --noEmit` + Vite).
- Limite de evidência anti-duplicidade: o E2E existente agora se chama “appends the next page from its snapshot and keeps the control disabled while loading”; ele comprova controle desabilitado durante a requisição, não invocação do guard interno por dupla ativação. O antigo `click({ force: true })` foi removido porque não provava que um segundo evento do usuário chegava ao handler; não contar esse cenário como teste do guard em voo.
- A coordenação reportou separadamente baseline ROOT real: Node `24.21.0` / npm `11.19.0`, 11 arquivos/60 testes, 3 builds de workspace e E2E 16/16 em 4,2 s. Não foi executado por este writer. O smoke `.1oqTUw` permanece falho no JSON por seletor do driver (`.story-row h2 a` em vez do markup `.story-row__detail`); a coordenação corrigirá o driver e não o contabiliza como smoke/live PASS.
- E2E completo e nova validação integrada continuam sob a coordenação. Estes patches/evidências não alteram `status: blocked`, não são aceite humano nem `formalreview` e não concluem ticket/épico.

### Fechamento técnico reportado pela coordenação — 2026-10-12

- A coordenação declarou a entrega técnica de 2.5 fechada; isso não altera `status: blocked` do workflow formal nem representa aceite humano.
- Recheck original `aaf1`: encerrado com os três achados P2 e o LOW tratados; backend/shared `hasMore` permaneceu congelado, sem achados.
- Root postfix coordenado: `verification/window-2-5-postfix.7D3rzc` — Node `24.21.0` / npm `11.19.0`, check com 60 testes/11 arquivos em 23,25 s, 3 builds de workspace e E2E completo 22/22 em 5,3 s. Evidência da coordenação; não executada por este writer.
- Smoke de paginação ao vivo: `live-pagination-2-5-postfix.kvpz1z`, verificado `04:51:49.162Z`: 90 Top/31 Jobs, Back/Forward/Voltar com posição e sem refetch em Top e Jobs, erro offline/retry com tuple, fim de Jobs, viewport 320 px e 3 rotas unknown/invalid; 9 PNGs abertos pela coordenação. Servidores próprios foram encerrados.
- Expiração ao vivo: o primeiro driver `live-expiration-2-5.ZSvWGr` falhou porque TTL isolado só produziu stale; não contar como prova do fluxo. Probe substituto `live-expiration-2-5-replaced.rX7GpB` passou com JSON `passed`/exit 0, verificado `04:57:01.980Z`: TTL 2.000 ms com retenção padrão 900.000 ms e cache inicial 91 (não zero); continuação Node serviu snapshot antigo com `stale: true`, um P1 Node separado publicou o novo, e P3 browser recebeu 410/`SNAPSHOT_EXPIRED`, recarregou P1 sem token, mostrou 30 linhas e anúncio/top. Dois PNGs abertos pela coordenação. Snapshot substituto `04:57:01.884Z` distinto de `cachedAt` `04:56:59.399Z`.
- O resultado anterior `.1oqTUw` permanece falho por seletor incorreto do driver (`.story-row h2 a`; markup real `.story-row__detail`); não contabilizar como UI/live PASS. O driver de expiração original também permanece falho apesar do probe substituto passar.
- Estas evidências fecham apenas a entrega técnica coordenada; não liberam `ready-for-dev`, `done`, aceite humano ou encerramento formal do BMad. Nenhum status/ledger de ticket foi alterado.

### Handshake e gates

- A coordenação reportou 2.3 como `built/review`. A validação serial de 55 testes/11 arquivos está registrada em `verification/window-2-3-2-4-testfollowups.D0z78X`; os três builds e E2E 9/9 estão registrados separadamente em `verification/window-2-3-2-4-postfix.pKi1IC`. Essas evidências permitem preparar tecnicamente 2.5, mas não representam aceite humano.
- **Handshake técnico reportado:** `adde1` confirmou o wire e a propriedade backend/shared; `typesReady` foi sinalizado. A coordenação autorizou o lease NON-HITL client/E2E/plano 2.5, agora congelado após os patches para revisão/validação serial. Backend/shared segue congelado sob seu owner.
- O plano formal permanece `blocked`; não declarar `ready-for-dev`, `done` ou fechar épicos. A fila `board.next` e as dependências de plataforma/HITL (1.7, 4.5 e 4.6) permanecem inalteradas.
