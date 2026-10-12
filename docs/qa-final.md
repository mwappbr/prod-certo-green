# QA final — fechamento técnico e validação local

**Data:** 2026-10-12

**Decisão:** a MAIN confirmou o fechamento técnico da entrega 4.4. Este documento consolida os resultados registrados em `_bmad-output/initiative-hn-modernizacao/execution-progress.md`, linhas 238–240, e as evidências locais citadas abaixo. Inclui também a prova fresh local com dados públicos do HN e o benchmark HTTP local, documentados em `verification/final-platform-qa.U5JP6P/`. Esta reconciliação documental não reexecutou os testes.

## Resultado consolidado

| Verificação | Resultado registrado | Evidência principal |
|---|---|---|
| Root pós-review | PASS: 121 testes em 20 arquivos, 49,37 s; build dos três workspaces aprovado; E2E 56/56 aprovado em 8,1 s com 6 workers. | `verification/window-4-4-postreview.zvlN6U/` (`check.log`, `build.log`, `e2e-readable.log`, `consolidated.status`) |
| Estabilidade da execução | Sete hashes de fontes/manifests iguais antes e depois; checagens de presença de oito caminhos de ambiente sem expor conteúdo; verificação de `lsof` da porta 4173 com status 1 antes/depois. | `verification/window-4-4-postreview.zvlN6U/source-pre-sha256.json`, `source-post-sha256.json`, `env-presence.json`, `port-pre.txt`, `port-post.txt` |
| Axe 4.4 compilado | PASS funcional em quatro contextos novos, Axe 4.13.0, quatro PNGs abertos/inspecionados. Zero violações nas quatro auditorias; duas incompletudes conservadas na listagem. | `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json`, `main-compact-summary.json`, `actual/actual-result.json`, `actual/screenshots/` |
| Navegação por teclado / foco | Evidência focal compilada 4.3 aprovada; oito PNGs abertos/inspecionados. Não é teste de teclado nativo do sistema operacional nem avaliação humana com AT. | `verification/live-compiled-keyboard-4-3.Whvc85/passed-focus-margin/main-independent-summary.json`, `actual/screenshots/` |
| Comentários nas auditorias 4.4 | 220 comentários visíveis de 221, profundidade padrão 8, sem parâmetro de profundidade na URL. | `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json` |
| HN público fresh — processo local | Passou em execução compilada via `npm start`/Node 24.21. Seis categorias com 30 itens, Top página 2 mantendo snapshot; história 50047422 com contagem pública 938 no momento. 500 comentários retornados e renderizados; profundidade observada 3, truncamento explícito. 16 capturas abertas pela MAIN; erros de console/página e requisições fora da origem local: zero; 320/375 px sem overflow horizontal. | `verification/final-platform-qa.U5JP6P/main-local-validation.json` |
| Compose final fresh + HN público | PASS local após correção de Dockerfile; build no-cache, `npm ci` e build dos três workspaces concluídos; app saudável em loopback (`/api/health` 200), sem volumes. Mesma referência de bundles do Root (`index-CYd16-z1.js`, `index-Dm_gFIxO.css`). Prova pública: seis categorias/30 itens, Top página 2 com snapshot igual, história 50047422 com contagem pública 941 no momento; 500 comentários no BFF/DOM sem query de profundidade (default máximo esperado 8), profundidade observada 3 e truncamento. | `verification/final-platform-qa.U5JP6P/main-compose-validation.json` |

## Detalhe da auditoria 4.4

- Contextos: listagem clara/escura e detalhe claro/escuro, todos em viewport 375 × 820, com contextos novos e sem estado de armazenamento fornecido.
- As quatro auditorias Axe usaram seleção padrão de página inteira. Listagens: 37 regras aprovadas e 1 regra incompleta em cada tema; detalhes: 34 aprovadas e nenhuma incompleta. **Não houve violações Axe confirmadas.**
- A incompletude é `color-contrast`, impacto `serious`, no alvo `#category-tab-job` da listagem clara e escura. O relatório informa que o fundo não pôde ser determinado porque o elemento estava parcialmente encoberto pelo scroller horizontal. Esse resultado permanece incompleto; não deve ser descrito como “zero issues” nem convertido em falha confirmada.
- Como complemento, após Tab e cinco teclas ArrowRight para revelar Jobs, foi calculado contraste de 7,2425:1 no claro e 7,3437:1 no escuro. A aba estava visível e com foco visível. É uma medição técnica pontual; não substitui o resultado Axe original, uma auditoria humana ou a avaliação WCAG completa.
- Em cada um dos quatro contextos, os contadores BFF e upstream HN ficaram iguais antes/depois da auditoria. Na verificação fria, havia zero requisições de item antes da listagem; depois, 250 IDs positivos haviam sido requisitados uma vez cada e a lista Top uma vez. O navegador permaneceu na origem local.
- O processo auxiliar 58146 foi encerrado por SIGTERM, código de saída 0, sem encerramento forçado; `closeCompleted=true`, sem erros. `lsof` retornou status 1 para as portas 52705, 52704 e 4173.

## Compose final — validação local aprovada

A execução final Compose foi reportada pela MAIN como PASS e os resumos locais registram `status: passed`, Node 24.21, builder local e health HTTP 200 em `127.0.0.1:55072`. O build fresh sem cache completou `npm ci` e o build dos três workspaces; o container serviu os mesmos bundles compilados do Root (`index-CYd16-z1.js` e `index-Dm_gFIxO.css`), com um serviço `app` e sem volumes. Os sentinelas `.env` foram gerados apenas em contexto sintético; o `.env.example` passou, os sentinelas de env ignorados falharam conforme esperado e nenhum arquivo real de ambiente foi aberto.

A validação pública no Compose passou nas seis categorias (30 itens cada), Top página 2 com snapshot igual e detalhe público `50047422`; sem query de profundidade (default máximo esperado 8), o BFF e o DOM renderizaram 500 comentários, profundidade observada 3, truncamento explícito e contagem pública 941 no momento da execução. Foram abertas pela MAIN as 16 capturas; viewport 320/375 sem overflow, temas, recolhimento, retorno ao scroll Y=2634 e deeplink; erros de console/página e chamadas fora da origem: zero. Cleanup do projeto/probes passou; a verificação independente encontrou zero containers, networks e imagens do app do projeto, portas 55072 e 3000 livres.

O histórico de falhas permanece preservado: `failed-helper-relative-dockerfile/` foi bloqueado porque o helper usou `--file Dockerfile.example` relativo ao diretório do repositório, embora o arquivo sintético estivesse em `/tmp`; `failed-build-missing-bridge/` revelou no build Compose ausência de `scripts/dev-platform-config.mjs` no contexto (TS2307 em `client/vite.config.ts`). A MAIN reportou a correção de Dockerfile no commit local `9ef867b` (1 arquivo/1 linha; sem push), seguida desta execução aprovada. As falhas anteriores não são apagadas nem tratadas como resultados positivos.

Limites desta aprovação: é uma validação técnica local em Docker/Rancher Desktop, não aceite humano de ambiente limpo, não avaliação com AT, não rerun Axe e não benchmark p95 dentro do Compose. A MAIN reportou a revisão original NO-OP 4.7 (`aaf`) aceita, sem novo sweep ou testes; não confundir com o registro NO-OP 2.6. O resultado HTTP cache-warm do processo local (`npm start`) é independente e está descrito a seguir.

## Benchmark HTTP local com cache aquecido

Na validação com HN público executada via `npm start`/Node 24.21, foram coletadas 180 amostras HTTP sequenciais por socket de loopback, aguardando corpo completo e JSON; 30 por cada uma das seis categorias. A cache estava aquecida, e cada resposta era não vazia, fresh e com snapshot estável. p95 agregado: **1,269708 ms**; por categoria: Top 1,319208 ms, New 1,269708 ms, Best 1,201958 ms, Ask 1,250166 ms, Show 1,317125 ms e Jobs 1,281875 ms. Fonte: `verification/final-platform-qa.U5JP6P/main-local-validation.json`.

Esta medição local cache-warm não é p95 do upstream HN, interação de navegador, benchmark cold-HN, medição do Compose ou SLA de produção. Permanece distinta do benchmark injetado de RNF-01 descrito abaixo.

## Benchmark RNF existente

O ledger registra um benchmark injetado de 180 requisições para o trabalho de listagem/RNF-01 (`execution-progress.md`, linhas 62–70). Após a correção do cenário com `Job`, o resultado registrado é de uma requisição por ID válido aquecido e uma chamada por categoria; a rodada pós-ajuste anota média de 4,26 ms, janela total de 5,79 ms e p95 de 0,04 ms. Trata-se do benchmark técnico já registrado no ledger, não de uma nova execução desta reconciliação nem de uma medição de SLA/produção. O ledger também identifica como obsoleto o resultado anterior de 0,26 ms/31 segundos, que não deve ser usado como conclusão RNF final.

## Limites e pendências

Este aceite técnico **não** declara:

- conformidade WCAG completa, teste humano com leitor de tela/tecnologia assistiva ou avaliação de usuário;
- teclado nativo do sistema operacional, zoom/reflow nativo ou aprovação de todos os critérios de acessibilidade;
- avaliação humana com tecnologia assistiva e validação independente em ambiente limpo: **NÃO REALIZADAS**. A MAIN informa que foram retiradas do gate humano de 2026-10-12 e não bloqueiam o fechamento técnico; continuam limites e não autorizam afirmar WCAG completa;
- gate de CI, atualização formal de status de ticket ou aceite final do produto. A MAIN reporta o fechamento técnico de O-03 como verificado; isso não formaliza o status do ticket. A inclusão de artefatos relacionados a O-05 no commit confirma seu versionamento, não decide por si só qualquer status formal ou aceite.

**Versionamento pós-commit:** conforme reporte da MAIN, o commit local `0598a96b2a3fd1d339f61454925805d30a427be9` versiona 86 caminhos (5.845 linhas), incluindo os artefatos relacionados a O-05, o mapeamento das sete fases do SDLC, esta documentação e quatro resumos JSON compactos: `verification/final-platform-qa.U5JP6P/main-local-validation.json`, `verification/final-platform-qa.U5JP6P/main-compose-validation.json`, `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json` e `verification/final-platform-qa.U5JP6P/main-dev-validation.json`. O versionamento documental/evidencial não está pendente. O inventário preliminar de 82 caminhos é histórico e foi substituído pela cardinalidade reportada de 86. Logs brutos, PNGs e arquivos temporários permanecem locais, fora desse conjunto versionado. A referência ao commit é reportada pela MAIN; esta atualização documental não executou Git nem altera status formal de tickets/parents ou aceite de produto, e não infere conclusão formal a partir do commit.

O smoke fresh `npm run dev` + Vite proxy `bwl8v2r6j` passou; resumo compacto `verification/final-platform-qa.U5JP6P/main-dev-validation.json` e evidência local detalhada `verification/final-platform-qa.U5JP6P/dev-localhost.g5hQGm/dev-result.json` (19:59:36–19:59:40Z, Node 24.21, PID 6125): `localhost:5173`, proxy `/api/health` OK, Top 30, Jobs 30, tema escuro, `errors: []`, duas capturas abertas pela MAIN; grupo próprio encerrado por SIGTERM sem força, com portas 3000/5173 livres. A tentativa original `bh12nxo1y` permanece preservada sem browser: o helper em `127.0.0.1:5173` não confirmou Vite; segundo reporte MAIN, apenas trocar URLs temporárias por `localhost` bastou na rodada que passou. Não se atribui causa IPv6 nem mudança de produto.

## Referências

- `_bmad-output/initiative-hn-modernizacao/execution-progress.md`, linhas 238–240 (Root, QA Axe, fechamento técnico e pendências).
- `_bmad-output/initiative-hn-modernizacao/execution-progress.md`, linhas 62–70 (benchmark 180 requisições e ressalvas).
- `verification/final-platform-qa.U5JP6P/main-local-validation.json` e `main-compose-validation.json` (validações locais HN/Compose).
- `verification/final-platform-qa.U5JP6P/failed-helper-relative-dockerfile/` e `failed-build-missing-bridge/` (falhas históricas preservadas).
- `verification/window-4-4-postreview.zvlN6U/`.
- `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/`.
- `verification/live-compiled-keyboard-4-3.Whvc85/passed-focus-margin/`.
