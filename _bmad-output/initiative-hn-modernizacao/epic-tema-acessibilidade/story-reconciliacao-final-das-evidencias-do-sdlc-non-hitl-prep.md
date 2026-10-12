---
title: "Reconciliação final das evidências do SDLC — preparação NON-HITL"
kind: non-hitl-readonly-prep
technical_ref: "4.6"
prep_status: provisional-human-acceptance-pending
created: "2026-10-12"
---

# Preparação provisória para a reconciliação final

## Escopo e limites

Este é um auxiliar local de preparação somente leitura. Não inicia o fluxo formal 4.6, não é uma história/ticket, não altera critérios de aceite e não declara conclusão. Nenhum documento canônico, TOML, ledger, README, fonte, teste, harness ou estado Git foi alterado nesta preparação. Não houve execução de build, testes, servidor, E2E, Docker ou dependências, nem publicação remota.

| Campo | Estado nesta preparação |
|---|---|
| Fluxo formal 4.6 | Não iniciado por este documento |
| Reconciliação técnica 4.6 | Provisória; pendente |
| Estado técnico 4.2 reportado | `technical closed-with-proxy-limits`; limites descritos abaixo |
| Status formal 4.2 | `blocked`; gates inalterados |
| 4.3 | Planejamento NON-HITL pendente; sem código |
| Aceite humano | Todos os aceites permanecem pendentes; responsável/data: ____________________ |
| Versionamento/referência Git | Proibido nesta preparação; campo em branco: ____________________ |
| O-05 | Não declarado satisfeito; reconciliação final continua reservada a 4.6 |

A preparação não substitui o aceite HITL de 1.7. O plano formal 1.9 continua `blocked`; sua preparação documental NON-HITL está `documentation-prepared-versioning-pending`. O inventário existente registra os artefatos de documentação como locais/não rastreados e a árvore de trabalho como suja; este prep não atualiza esse snapshot.

## Pontos focais de reconciliação

As referências abaixo são fontes para uma futura revisão autorizada. As divergências são perguntas abertas, não conclusões sobre implementação ou aceite.

| Tema | Referências e observação atual | Reconciliação necessária; evidência ainda a obter |
|---|---|---|
| Contrato de listagem — `Story[]` ou `Story \| Job` | Arquitetura, AD-3, descreve `StoriesPage.items` como `Story[]`; `shared/contract/stories.ts` define `ListingItem = Story \| Job` e usa `ListingItem[]` em `StoriesPage.items`. | Alinhar o contrato publicado e a regra arquitetural, inclusive o tratamento da categoria `job`. Confirmar com contrato, normalização e testes da listagem; não assumir que a diferença é apenas nominal. |
| `hasMore` e fim da listagem | O contrato compartilhado declara `hasMore?: boolean`; a arquitetura não define o significado da ausência desse campo. | Definir como `true`, `false` e ausência/valor desconhecido afetam “ainda há itens” versus “fim”. Confirmar a regra de paginação e o comportamento do cliente sem converter ausência em fim por suposição. |
| `snapshot`, `cachedAt` e validade/stale | AD-3 diz que `snapshot` é o `cachedAt` da lista; AD-4 descreve leitura fresca, retenção de entradas vencidas e `cachedAt`; AD-11 descreve expiração do snapshot. | Distinguir identidade/validade do snapshot, horário de cache e indicação `stale`; esclarecer o que acontece quando há dado vencido retido ou indisponibilidade do HN. Comparar contrato, caminho de cache e critérios antes de declarar consistência. |
| Comentários `deleted`/`dead` e autor conhecido | PRD RF-06 exige a apresentação dos estados removido/morto sem interromper a hierarquia. A arquitetura AD-2 deriva status; o contrato permite `author: PlainText | null` em `Comment` e `CommentNode`. | Confirmar que a normalização preserva um autor conhecido para comentário morto/removido e que a apresentação do placeholder/status não apaga esse dado nem quebra a árvore. Contrato permissivo, isoladamente, não prova esse comportamento. |
| Profundidade padrão 8 | PRD, seção 7, exige `depth` com padrão e máximo configuráveis; AD-9 diz que a profundidade padrão é configuração, sem fixar valor no trecho. | Reconciliar o padrão 8 informado pela coordenação com configuração efetiva, parâmetro omitido, máximo e testes de limites. Não inferir comprovação de runtime ou de teste a partir deste prep. |
| Opcionalidade de RF-09 | PRD, seção 4, classifica busca local como “Nice to have”; seção 5.4 descreve RF-09. AD-8 e o mapa de capacidades da arquitetura citam a busca. | Preservar explicitamente o caráter opcional no escopo e na matriz final de aceite; esclarecer se a implementação é evidência informativa ou condição do MVP. Não elevar RF-09 a bloqueador sem decisão autorizada. |

### Referências lidas para este recorte

- `_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md` — AD-2, AD-3, AD-4, AD-9, AD-11 e mapa de capacidades.
- `_bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md` — RF-06, RF-09, RF-11, interface de dados e critérios do MVP.
- `_bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/addendum.md` — notas de status/sanitização e fases O-05.
- `shared/contract/stories.ts` — contrato compartilhado atual, usado somente como referência de comparação.
- `docs/sdlc-artifacts.md` e `_bmad-output/initiative-hn-modernizacao/epic-plataforma-base/story-artefatos-do-sdlc-versionados-e-processo-documentado-non-hitl-technical-plan.md` — limites do inventário e status separado de 1.9.

## Estado das evidências informado pela coordenação

Os fatos abaixo são transcritos como estado reportado para orientar a reconciliação. Não foram reexecutados nem validados independentemente por este documento; evidência técnica não equivale a aceite humano ou aceite final do épico.

- **1.8:** tecnicamente fechado para teardown POSIX do grupo de processos do próprio PGID com TERM/KILL; verificação focada 15/15. Windows foi somente simulado. Não há alegação de Node 26.
- **4.1:** tecnicamente fechado. Evidência principal fresh-root em `verification/window-1-8-4-1-postreview.K59S0l`, Node 24.21/npm 11.19, 121 testes em 20 arquivos, `check` e `build`, além do resultado reportado `3/full44 PASS/4173 free`. Evidência de tema compilado em `verification/live-compiled-theme-4-1.vvWY4h`: sete PNGs, MAIN aberto, 21 estados de tokens de tema, 10 verificações zero-network e limpeza de todas as portas. A captura é pós-render; não prova primeira pintura.
- **4.2 — `technical closed-with-proxy-limits`:** estado reportado pela coordenação, não reexecutado nem validado independentemente aqui. Evidência principal verificada em root `verification/window-4-2-postreview.K2qAfU`: Node 24.21/npm 11.19; `check` com 121 testes/20 arquivos; `build`; resultado reportado como `3/official full: 46 tests PASS, 7.9s`; 4173 livres. O diagnóstico focado 24.19/npm 11.17 e a reexecução em root 24.21 são distintos; a reexecução não reverte nem substitui retroativamente o diagnóstico. Review independente original P2 de largura do source está CLOSED: short x.io 44×44 nos 16 casos. Evidência compilada privada RAW BFF em `verification/live-compiled-responsive-4-2.ZR2HJz`, sem interceptação de API: 8 PNGs, MAIN aberto; listagem/detalhe em 320, 375, 100 e 200 simulado, temas alternados (não 16 temas visuais); 220 comentários, profundidade padrão 8, seis categorias e 20 verificações zero BFF/HN. Foram reportadas 3970 linhas tipográficas (font + line-height 2), glyph listing 2.111, detail 2, html 16 inalterado e DPR 1. Há 700 registros de limites em grupos sobrepostos: 360 por elemento/caso, não 700 únicos. Portas próprias 56098/56097 e portas da primeira tentativa falha 55888/55887 ficaram livres, com encerramento graceful; nenhum erro reportado. Na primeira tentativa, driver count 0 antes de Top render versus 1 após correção de espera TMP de 8s somente; nenhum RED da aplicação.
- **Limites de 4.2:** estilos simulados foram aplicados somente ao DOM inicialmente carregado; subárvores recriadas não representam zoom nativo persistente. Não há prova de browser/OS/device/AT nativos, primeira pintura, desempenho ou HN público. A medição de 3.595s é uma única execução, não P95.
- **4.3:** planejamento NON-HITL pendente, sem código. **Também pendentes:** 4.4, 4.5, 4.7, Compose final e suíte final completa. 1.7 continua aguardando aceite humano em ambiente limpo. Status formal de 4.2 permanece `blocked`, gates inalterados; todos os aceites humanos continuam pendentes e em branco. Versionamento segue proibido nesta lease e o prep não fecha O-05.
- Não reutilizar evidência antiga de HN público/live de 3.1 como prova completa de tema/acessibilidade atual. Não declarar metas de desempenho ou P95 sem evidência própria adequada.

## Limite para uma futura decisão

Uma reconciliação futura deve manter separados: estado técnico de cada evidência, status de cada critério, aceite humano e estado de versionamento. Deve registrar evidência pendente como pendente e deixar campos de responsável/data/aceite em branco até confirmação humana. Este documento não autoriza alteração dos documentos-fonte, do ticket/TOML 4.6, de `execution-progress.md`, nem qualquer operação Git.
