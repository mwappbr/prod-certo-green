# Addendum: prd-hn-modernizacao

Conteúdo que não pertence à narrativa principal do PRD: decisões de tecnologia, notas técnicas, riscos, fases do processo e glossário. Serve de insumo para `bmad-architecture` e para o plano técnico.

## A. Pilha técnica sugerida (a confirmar no plano técnico)

- **Front-end:** React com Vite, TypeScript em modo estrito.
- **Back-end:** Node.js com TypeScript, Fastify ou Express (a escolher no plano técnico).
- **Cache:** em memória, com TTL. TTL curto para listagens e TTL maior para itens antigos.
- **Execução:** Docker Compose para o conjunto completo.
- **Testes:** execução local de unitários nas regras de negócio e de um teste de integração do back-end; auditoria axe também local e E2E opcional com Playwright. Não se pressupõe gate de CI. Resultados automatizados são evidência técnica parcial, não comprovação de conformidade WCAG completa nem substituto de avaliação manual com tecnologia assistiva.

## B. Notas técnicas que não estão nos riscos

- **Derivação do status (RF-06, RF-10):** o status (`ok`, `deleted`, `dead`) é derivado dos campos do item. A regra é de negócio e tem testes unitários.
- **Sanitização (RNF-10):** lista de tags permitidas no back-end. Nunca renderizar HTML sem sanitização na interface.
- **Limites de busca (RNF-03):** limitar a profundidade e o número de nós por requisição de comentários. A profundidade padrão reconciliada é 8; `children: null` indica ramo não buscado por corte de profundidade/orçamento, `[]` indica folha, e `truncated` indica corte pelo orçamento de nós. O valor padrão de concorrência fica para o plano técnico.
- **Contrato da listagem:** `ListingItem = Story | Job`, discriminado por `type`; metadados não aplicáveis podem ser `null`. `snapshot` identifica a lista de IDs e não equivale ao `cachedAt` agregado da página; `hasMore` é opcional e seu término é determinado pelos IDs antes de filtrar resultados ausentes/não exibíveis. Não inferir fim pela quantidade de `items`. Um snapshot retido, mesmo vencido, pode continuar a paginação; se expirado, reiniciar na página 1 sem token antigo.
- **Status de comentário:** autor conhecido em `deleted`/`dead` permanece no contrato; os marcadores `[removido]`/`[morto]` são neutros e não atribuem ação/estado ao autor.

**Registro parcial de O-03 (4.4, 2026-10-12):** a execução focal funcional passou 4/4 e Axe 4.13 reportou zero violações e duas verificações de contraste incompletas associadas à aba Jobs parcialmente encoberta pelo scroller horizontal permitido. Isso não equivale a “zero issues”, não comprova conformidade WCAG e não foi identificado como falha de fonte. Outra execução compilada de quatro casos passou funcionalmente, mas terminou com falha de status shell/read-only após o driver; Root/Actual/PNGs novos ainda estavam pendentes no último reporte. Portanto, 4.4 permanece pendente de consolidação/revisão e este registro não declara O-03 concluído.

### Adendo de fechamento técnico de 4.4 — 2026-10-12

Posteriormente, a MAIN confirmou o **fechamento da entrega técnica 4.4**, preservando acima o registro parcial como histórico do estado anterior. A decisão está registrada em `_bmad-output/initiative-hn-modernizacao/execution-progress.md` (linhas 238–240) e apoiada pelas evidências locais em `verification/window-4-4-postreview.zvlN6U/` e `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/`.

- Root pós-review: 121 testes em 20 arquivos (49,37 s), build dos três workspaces aprovado e E2E 56/56 aprovado (8,1 s). As verificações de estabilidade registraram hashes de sete fontes/manifests iguais antes/depois.
- Auditoria Axe 4.13 em quatro contextos compilados novos (listagem e detalhe, claro e escuro): zero violações nas quatro auditorias. Permanecem **duas verificações incompletas** de `color-contrast`, ambas na aba Jobs (`#category-tab-job`) parcialmente encoberta no scroller horizontal da listagem; não são violações confirmadas e não foram descartadas.
- Após navegação por teclado que revelou Jobs, o cálculo suplementar de contraste foi 7,2425:1 no tema claro e 7,3437:1 no escuro. Esse cálculo pontual não altera o resultado Axe incompleto nem substitui avaliação humana.
- Nos quatro contextos, contadores de rede antes/depois permaneceram invariantes. A verificação fria registrou zero requisições de item antes da listagem e 250 IDs positivos, cada um requisitado uma vez; a lista Top foi requisitada uma vez. Os quatro PNGs da auditoria foram abertos e inspecionados pela MAIN.
- Encerramento local verificado: processo 58146 recebeu SIGTERM e saiu com código 0, sem encerramento forçado, com `closeCompleted=true` e sem erros; `lsof` retornou status 1 para 52705, 52704 e 4173.

**Estado histórico no fechamento técnico de 4.4:** este aceite não declarava WCAG completa, avaliação humana/AT, teclado/zoom/reflow nativos, ambiente limpo humano, Compose final, HN público fresh, CI, conclusão formal de ticket ou satisfação de O-03/O-05. Naquele ponto Compose/HN público/versionamento ainda estavam pendentes; os resultados posteriores abaixo e os documentos QA distinguem as fases sem converter falhas ou HALTs antigos em aprovações.

### Atualização técnica final de plataforma e dados públicos — 2026-10-12

`npm start` e Compose isolado passaram com Hacker News público: seis categorias, paginação por snapshot e 500 comentários retornados/renderizados, profundidade padrão8 sem query, corte pelo orçamento explicitamente informado. As 16 capturas de cada execução foram abertas pela MAIN; 320/375px sem overflow. O benchmark HTTP local cache-warm de180amostras/30porcategoria teve p95agregado1,269708ms; não mede upstream frio ou SLA de produção. Compose passou após a correção mínima do bridge de configuração no Dockerfile (`9ef867b`), com um serviço saudável/buildsemcache/semvolumes e cleanup apenas dos recursos próprios. O comando documentado `npm run dev` também passou em `localhost:5173`, proxy health200/Top30/Jobs30/tema, duas capturas abertas e cleanup confirmado; a tentativa inicial do helper em127.0.0.1 está preservada como falha de prontidão, sem causaIPv6 comprovada ou alteração de produto.

Resumos compactos: `verification/final-platform-qa.U5JP6P/main-local-validation.json`, `main-compose-validation.json` e `main-dev-validation.json`. O-03 está tecnicamente verificado no escopo automatizado autorizado pelo usuário em2026-10-12; AT/ambiente limpo humano/zoomnativo não ocorreram e não há declaração WCAG completa. O registro pré-commit foi superado pelo commit documental real `0598a96b2a3fd1d339f61454925805d30a427be9` (86 caminhos seletivos), verificado pela MAIN via `git show`/`git ls-files`: os artefatos das sete fases estão rastreados/commitados. A formalização dos tickets é operação separada no plano via `tickets.py mark`; logs/capturas brutos continuam locais. Inventário de sete fases e limites em `docs/sdlc-artifacts.md`, `docs/qa-final.md` e `docs/accessibility-checklist.md`.

## C. Riscos técnicos

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | Lentidão na primeira página (IDs + N requisições) | Alta | Alto | Buscar só a página pedida; cache por item; concorrência limitada; cache de IDs com TTL curto |
| R-02 | Requisições por comentário sem controle em histórias grandes | Alta | Alto | Buscas em lotes por nível de profundidade, com limite de profundidade e de nós; reuso do cache |
| R-03 | Indisponibilidade ou mudança de formato da API (sem SLA) | Média | Alto | Timeouts, retentativas limitadas, cache vencido com aviso, validação de schema |
| R-04 | Limite de taxa não documentado | Média | Médio | Controle de concorrência; monitorar erros; teste com carga moderada antes do MVP |
| R-05 | XSS pelo HTML dos comentários | Média | Alto | Sanitização com lista de tags permitidas no back-end (RNF-10); sem renderização de HTML não sanitizado |
| R-06 | Dados desatualizados no cache | Alta | Baixo | TTL curto em listagens; "atualizado em" na interface |
| R-07 | Falha de acessibilidade no tema escuro e na árvore | Média | Médio | Teste de contraste nos dois temas; axe em execução local; avaliação manual com teclado e tecnologia assistiva/leitor de tela, acompanhada separadamente |
| R-08 | Crescimento do escopo (votação, login) | Média | Médio | Exclusões explícitas (seção 4 do PRD); revisão a cada fase |

## D. Fases do processo (caso didático, O-05)

| Fase | Artefato principal | Saída |
|---|---|---|
| 1. Especificação | SDD curto | Requisitos detalhados, regras de negócio, casos-limite da API |
| 2. Plano técnico | Plano técnico e ADRs | Framework de back-end, cache, bundler, estrutura de pastas |
| 3. Decomposição | Lista de tarefas com critérios de aceite | Tarefas pequenas, ordenadas, com dependências |
| 4. Implementação | Código, configuração e README | Back-end, front-end, Docker Compose |
| 5. Testes | Testes e relatório de cobertura | Regras de negócio cobertas por testes unitários |
| 6. Revisão | Revisão de código e checklist de acessibilidade | Achados resolvidos |
| 7. Documentação | README, guia de execução, registro de decisões | Documentação publicada |

## E. Glossário

- **ADR:** registro de decisão de arquitetura (Architecture Decision Record).
- **Allowlist:** lista de valores permitidos; tudo o que não está nela é bloqueado.
- **Axe:** ferramenta automatizada de auditoria de acessibilidade.
- **Docker Compose:** ferramenta para subir vários serviços com um único comando.
- **Greenfield:** projeto novo, sem código ou sistema anterior a respeitar.
- **N+1:** padrão em que uma consulta inicial gera uma requisição extra por item, sem controle.
- **p95:** valor abaixo do qual cai 95% das medições. Mede a lentidão típica, descartando os 5% piores casos.
- **SDD:** documento de design de software (Software Design Document).
- **SDLC:** ciclo de vida de desenvolvimento de software.
- **SLA:** acordo de nível de serviço, com garantias publicadas de disponibilidade.
- **SSR:** renderização no servidor (Server-Side Rendering).
- **Stub:** simulador simples de um serviço externo, usado em testes.
- **TTL:** tempo de vida de um item no cache, depois do qual ele é descartado.
- **WCAG:** diretrizes de acessibilidade para conteúdo web.
- **XSS:** injeção de script malicioso em uma página.
