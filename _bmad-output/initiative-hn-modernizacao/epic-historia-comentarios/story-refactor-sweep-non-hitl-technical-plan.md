---
kind: non-hitl-technical-plan
technical_ref: "3.4"
plan_status: technical-delivery-closed
formal_plan: "/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/story-refactor-sweep-plan.md"
formal_workflow_status: blocked
humanRisk: "not assessed; human review pending"
acceptance: "pending human/formal acceptance"
created: "2026-10-12"
---

# Avaliação técnica NON-HITL — 3.4 Refactor sweep

Este documento é um parecer técnico separado para revisão da coordenação. Não substitui nem altera o plano formal bloqueado, não muda ticket/épico, não declara gates fechados nem aceite humano. O frontmatter usa `kind: non-hitl-technical-plan` e `technical_ref: "3.4"`; não declara `ticket` nem `type`.

## Entrada canônica e HALT formal

- A consulta `tickets.py find 3.4` resolveu a entrada canônica existente `epic-historia-comentarios`, referência `3.4`, ID `4`, título **Refactor sweep**, risco baixo, depois das entradas 1, 2 e 3. A descrição limita o sweep a débitos/achados adiados dentro do detalhe, árvore, travessia e `SafeHtml`, sem alterar listagem/rota, adapter, cache, tema ou contratos compartilhados. Nenhuma entrada nova de ticket/bug foi criada.
- A verificação formal da entrada pede `npm run check`, `npm run e2e` e revisão com diff limitado ao épico. Essas gates não foram executadas nesta tarefa.
- O workflow formal `bmad-build-auto` (`route=full`, `review=quick`) parou em HALT antes de gerar plano pronto para desenvolvimento. A fotografia de VCS anexada no início da sessão mostrava working tree suja e branch `feat/plataforma-1-1-tracer`, incompatível com `epic-historia-comentarios`. Não executei Git nem `git add --refresh -- .`, conforme a restrição. O plano formal foi criado/marcado `blocked`; esse motivo permanece, sem contorno.

## Pergunta e limites da avaliação

Avaliar somente dívida material ainda pendente após 3.1/3.2/3.3 em normalização de comentários, BFS, renderer de detalhe e fronteiras relacionadas a `SafeHtml`/envelopes. A revisão foi de fonte e testes existentes; não executei testes, build, Root, E2E, servidor, Docker, browser, HN live ou comandos Git.

**Fora do escopo:** listagem, `ListingProvider`, parser/roteamento/histórico/scroll, adapter HN, cache, configuração, tema, tokens/dependências, schema/contratos compartilhados e qualquer ownership externo. Não se propõe feature nova nem mudança de plataforma. A BFS/normalização backend permanece sob ownership de `adde`; eventual patch client depende de `a5`. Nenhuma source lease foi concedida ou presumida.

## Resultado do sweep de fonte

**Conclusão proposta: NO-OP de implementação.** Nesta inspeção delimitada não encontrei cenário reproduzível, requisito pendente ou debt material que justifique refatorar a fonte. A recomendação não se apoia apenas no Root/220 nós: ela combina a inspeção do caminho de dados e das fronteiras com os testes já escritos para normalização, BFS, envelopes, renderer e segurança. Como nenhum patch é indicado, não há diff de código proposto.

### Normalização, sanitização e projeções

- `server/src/domain/normalize-item.ts:28-40,74-124` mantém allowlist explícita de tags/atributos/esquemas, sanitiza o corpo do comentário antes de ele ser armazenado, converte status `deleted`/`dead` em `text: null` e mantém título/autor como texto simples. O caminho de comentário conserva `kids` para a API de item e raízes do tipo Comment; isso segue o contrato atual, não adiciona campo.
- `server/src/adapters/hn/client.ts:15-31,88-115` valida os IDs do wire HN como inteiros não negativos seguros antes de chamar o normalizador. A BFS também ignora IDs inválidos/repetidos em `server/src/app/comments/get-comments.ts:27-42`; não vi uma falha de produção que justifique normalizar novamente a lista de `kids` neste sweep.
- `server/src/app/fetch-item.ts:21-37` conserva `childIds` internos para Story/Job e os remove da projeção pública; Comment preserva `kids` do contrato. `getComments` constrói `CommentNode` sem propagar `kids`/`childIds`. As provas correspondentes estão em `server/test/normalize-item.test.ts:56-126` e `server/test/items-route.test.ts:68-117,176-247`.
- A configuração de `rel` do sanitizer é tentada em `normalize-item.ts`, mas o atributo não faz parte da allowlist e o output observado não o contém. O comportamento, incluindo links relativos/protocol-relative, está explicitamente documentado e coberto em `story-travessia-limitada-e-sanitizacao-de-comentarios-non-hitl-technical-plan.md` e nos testes de normalização/rota. Como links de comentário não recebem `target=_blank`, não identifiquei risco de opener nem motivo para ampliar a allowlist. Nenhuma alteração de política de sanitizer é proposta.

### BFS, limites e envelope

- `server/src/app/comments/get-comments.ts:27-80,87-177` mantém uma única travessia breadth-first via `fetchItem`, ordem de origem preservada apesar de resposta concorrente, deduplicação por ID, limites de profundidade/tentativas/nós e distinção `children: []`/`null`/`truncated`. Não há uma segunda BFS ou loader paralelo a eliminar.
- `server/test/comments.test.ts:45-300` cobre cutoff versus folha, erro e drain, ordenação/deduplicação/ciclos/concorrência, fixture 224, reuso quente, profundidade default e limites. `server/test/items-route.test.ts:119-174,249-294,296-412` cobre a superfície HTTP, sanitização antes de `cache.set`, status com replies, raízes Job/Comment e frescor/stale. Li essas provas; não as executei.
- A semântica de `rel`/URL e as decisões de profundidade/orçamento já foram revistas nos documentos 3.1/3.2. Não encontrei dívida funcional remanescente dentro da BFS/normalização que exija mudança backend; qualquer achado futuro nessa camada deve voltar a `adde` antes de patch.

### Renderer e fronteira HTML no cliente

- `client/src/features/detail/CommentTree.tsx:16-67` deriva o colapso efetivo de preferência armazenada e respostas carregadas, mostra corpo próprio e aviso de continuação para folha/cutoff sem controle de expansão, usa lista aninhada e só encaminha corpo elegível a `SafeHtml`.
- `client/src/features/detail/CommentTreeProvider.tsx` e `comment-tree-state.ts` mantêm a preferência volátil isolada por root/comment, contagem limitada a descendentes carregados e copy singular/plural. `ItemDetailPage.tsx:56-105,110-164` mantém estados item/comentários separados, preserva marcadores e renderiza estados de frescor, vazio, erro e retry.
- A busca somente-leitura de `dangerouslySetInnerHTML|SafeHtml` em `client/src` encontrou um único sink: `client/src/components/SafeHtml.tsx:8-10`. Os demais usos encaminham `text` tipado a esse componente; nenhum segundo sink foi identificado.
- Os testes client existentes cobrem estado da árvore e estados/frescor do detalhe (`comment-tree-state.test.ts`, `item-detail-state.test.ts`). O teste E2E 3.3 ainda verifica revisão SPA, folha/cutoff, ordem direta por pai e deadline de counters em `e2e/detail.spec.ts`. Não executei esses testes.

## Achados 3.3 e evidência recebida

Os três findings 3.3 permanecem **fechados**, não reabertos: (1) o `collapsed` efetivo exige replies carregadas e os dois casos UI-only revisitam o mesmo root/comment como folha e cutoff; (2) a prova compara filhos DOM diretos por pai com a ordem da fixture filtrada pelos IDs visíveis; (3) a leitura de counters usa timeout explícito de 5.000 ms. Essa conclusão vem da rechecagem focal de fonte/testes desta sessão e do registro de follow-up em `story-arvore-recolhivel-frescor-e-estados-do-detalhe-non-hitl-plan.md`.

A coordenação reportou Root source-full `2vxpHr` (`102/17`, 43,98 s, build 3 e full E2E 38 em 5,8 s), além de observação standalone do BFF/SPA com 220 comentários DOM distintos, 221 IDs raw-HN a frio uma vez cada, depth 9 sem fetch, cache quente após toggles/revisitas/reload e screenshots inspecionadas. Os caminhos informados são `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/verification/window-3-3-postreview.2vxpHr/` e `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/verification/live-compiled-tree-3-3.rHj5Ut/`. A coordenação reporta ter lido os logs reais do Root e a evidência da execução compilada, incluindo as sete PNGs e cleanup. Não executei nem auditei independentemente esses logs/imagens nesta tarefa; reutilizo-os somente como evidência lida/confirmada pela coordenação. Não faço alegações de HN live 3.3, p95, axe/AT, nem aceite humano.

## Itens explicitamente não tratados como dívida

- O texto atual de `CommentItemContent` informa que navegação própria de comentários não está disponível nesta etapa. A limitação foi declarada no plano 3.1; não é dívida de refatoração autorizada nem justificativa para nova feature neste sweep.
- Preferência de colapso mantida durante a SPA e resetada em reload é o comportamento decidido em 3.3. Não proponho evicção/limite de raízes sem requisito ou cenário de uso que mostre custo material.
- Não proponho reorganização cosmética, abstração nova, mudança de contrato, semântica para item fora dos ACs nem trabalho baseado apenas na ausência/presença de TODO/FIXME.

## Fechamento técnico NON-HITL aprovado

- A coordenação leu integralmente este parecer e aprovou a conclusão **NO-OP técnico**: a inspeção delimitada de source/testes não encontrou dívida material nova nem motivo para alterar código. O `plan_status` deste documento passa a `technical-delivery-closed`.
- A decisão considera os caminhos de normalização/sanitização, BFS, projeções, renderer e sink `SafeHtml`, as provas existentes lidas nesta revisão e o fechamento técnico já registrado para 3.3. Os três findings 3.3 continuam fechados. Os resultados Root e da verificação compilada local são reutilizados com a proveniência e limites descritos acima; não foram reexecutados nem auditados independentemente por este agente.
- Não houve source diff 3.4, edição de testes, execução de testes/build/E2E/servidor/browser/HN, Docker ou Git nesta atualização documental. Nenhuma source lease foi concedida.
- O plano formal `story-refactor-sweep-plan.md` continua `blocked`; este fechamento técnico NON-HITL não o altera, não declara workflow/gates formais concluídos e não concede aprovação humana. `humanRisk` e `acceptance` continuam pendentes.
- A avaliação técnica 3.4 encerra aqui como NO-OP. A próxima revisão 4.1 será delegada após a fonte estar estável; até nova autorização, sem alterações ou execuções adicionais.

## Fontes examinadas

- `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md` — boundaries, sequencing e decisão de sweep, em especial linhas 43-72.
- `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/story-tracer-conteudo-do-detalhe-e-comentarios-iniciais-non-hitl-review.md` — decisões/pendências e evidências de 3.1.
- `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/story-travessia-limitada-e-sanitizacao-de-comentarios-non-hitl-technical-plan.md` — cobertura e fechamento técnico 3.2.
- `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/story-arvore-recolhivel-frescor-e-estados-do-detalhe-non-hitl-plan.md` — 3.3 e follow-up dos três findings.
- `/Users/maurowidman/Projects/AI/prod-certo-green/server/src/domain/normalize-item.ts`, `/Users/maurowidman/Projects/AI/prod-certo-green/server/src/adapters/hn/client.ts`, `/Users/maurowidman/Projects/AI/prod-certo-green/server/src/app/fetch-item.ts`, `/Users/maurowidman/Projects/AI/prod-certo-green/server/src/app/comments/get-comments.ts` e os testes mencionados acima.
- `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/detail/CommentTree.tsx`, `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/detail/CommentTreeProvider.tsx`, `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/detail/comment-tree-state.ts`, `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/features/detail/ItemDetailPage.tsx` e `/Users/maurowidman/Projects/AI/prod-certo-green/client/src/components/SafeHtml.tsx`.
