---
title: "Auditoria axe local nas telas e temas — proposta técnica NON-HITL"
kind: non-hitl-technical-plan
technical_ref: "4.4"
plan_status: auxiliary-proposal-pending-main-approval
created: "2026-10-12"
---

# Proposta curta — auditoria axe local

## Natureza e limite

Este documento é apenas um auxiliar de planejamento; a lease de execução ainda não foi aprovada e depende de aprovação explícita da main. Não inicia fluxo formal, não é ticket/história, não atribui status formal e não declara aceite. Nesta preparação não houve alteração de fonte, teste, spec, manifest, lockfile, documento canônico, README, TOML, ledger ou Git; nenhum pacote foi instalado/baixado e nenhum build ou teste foi executado.

## Requisito e estado de sequência

A entrada 4 de `epic-tema-acessibilidade/tickets.toml` pede que `npm run e2e` audite localmente listagem e detalhe nos temas claro e escuro, sem violações axe de impacto crítico ou sério e sem depender de CI. É uma verificação automatizada, posterior à entrada 3. A entrada 5 mantém a validação manual com tecnologia assistiva e checklist WCAG como HITL.

A coordenação reporta a entrada 3 GREEN focal 6/6. Revisão independente e QA real continuam pendentes; a execução Root 4.3 está em andamento, com resultado ainda desconhecido. A futura execução de 4.4 deve aguardar confirmação técnica da main, com revisão independente, Root e QA real concluídos. Esse gate técnico é separado do fluxo formal/HITL: não presume fechamento formal nem autoriza inventá-lo; o estado formal informado para 4.3 continua planned. Até aprovação da main e confirmação técnica da dependência, 4.4 não está autorizado a iniciar código.

## Leitura de referência e estado local observado

- A entrada 4 cobre `RNF-04` e `RNF-09`; exige auditoria nas telas principais. O épico mantém a aprovação axe separada do checklist manual e afirma que `RF-09` é opcional.
- O PRD define WCAG 2.1 AA, contraste, teclado, rótulos e foco visível em `RNF-04`; `RNF-09` cobre responsividade e alvos de toque. Axe não comprova sozinho todos esses requisitos nem a experiência com leitor de tela.
- A arquitetura `AD-10` menciona auditoria axe em CI. A entrada 4 é mais específica para esta entrega: verificação local por `npm run e2e`. Esta proposta não altera configuração de CI nem tenta reconciliar os documentos canônicos.
- `package.json` já tem `@playwright/test` e script `e2e` que executa `npm run build && playwright test`. `check` não chama E2E. Não há dependências axe no manifest atual; a busca direcionada no lockfile não encontrou entradas `node_modules/@axe-core/playwright` ou `node_modules/axe-core`.
- `playwright.config.ts` descobre `e2e/**/*.spec.ts`, usa Chromium Desktop e sobe `e2e/start-server.mjs` em `127.0.0.1:4173`. Esse servidor usa o Fastify local e um stub HN com fixtures, incluindo a história 101; não depende do HN público.
- A documentação atual do README apresenta `npm run check` e `npm run build`, mas não documenta `npm run e2e`. Nenhuma alteração de README está incluída nesta proposta de lease exata; eventual nota documental exigiria aprovação separada.
- A coordenação informou, com base em metadados oficiais npm, `@axe-core/playwright` 4.13.0 como candidato a dependência direta e `axe-core` ~4.13.0 como dependência transitiva declarada pelo wrapper. Nenhum deles foi instalado ou baixado nesta preparação; não há necessidade prevista de importar `axe-core` diretamente.

## Lease futura proposta — somente após aprovação

Arquivos que a implementação autorizada poderá tocar:

1. **`package.json` (raiz):** acrescentar somente `@axe-core/playwright: 4.13.0` em `devDependencies`, preservando as demais alterações locais e sem mudar versões existentes ou scripts. Não adicionar `axe-core` diretamente: o wrapper declara essa dependência transitiva e o spec usará os tipos expostos pelo wrapper sem importar `axe-core`.
2. **`package-lock.json` (raiz):** registrar somente a resolução necessária do wrapper e de suas dependências transitivas, preservando o estado local e evitando churn não relacionado. Não usar `npm audit fix`, `--force`, nem upgrades indiretos voluntários.
3. **`e2e/accessibility.spec.ts` (novo):** um spec próprio de axe, automaticamente descoberto pela configuração existente.

Não se propõe alterar `playwright.config.ts`, fixtures, CI, `npm run check`, documentos canônicos ou README nessa lease. O comando/gate local existente é `npm run e2e`; não é necessário criar outro script para descobrir o spec.

### Matriz e critérios do novo spec

Executar quatro auditorias de página inteira, uma combinação por caso, em contextos limpos:

| Superfície | Tema inicial determinístico | Rota/fixture prevista |
|---|---|---|
| Listagem | claro | `/?category=top` |
| Listagem | escuro | `/?category=top` |
| Detalhe | claro | `/item/101` |
| Detalhe | escuro | `/item/101` |

Antes de navegar, configurar a preferência de cor do browser com Playwright para `light` ou `dark`, de modo que cada caso exercite a preferência inicial sem estado de tema manual persistido de outro caso. Aguardar conteúdo principal e tema efetivamente aplicados. Usar a aplicação compilada, o BFF local e o stub HN existente; não interceptar `/api` nem acessar HN público. Usar `AxeBuilder` apenas do wrapper `@axe-core/playwright`, inferindo tipos pelo wrapper sem importar `axe-core`. Rodar `analyze()` com as regras padrão sobre a página inteira: não usar `withTags`, `include`, `exclude` ou `disableRules` para reduzir cobertura. Para cada caso, arquivar `violations` e `incomplete` em anexo JSON local com IDs de regra, impacto, nós e alvos. O gate falha se houver qualquer violação `critical` ou `serious`; `moderate`/`minor` e resultados `incomplete` permanecem registrados e separados para reporte/revisão manual, não são descartados nem apresentados como prova de página sem ressalvas.

O gate permanece o comando local já existente `npm run e2e` (build + todos os specs Playwright). A aprovação do spec demonstra somente o resultado automatizado nos quatro casos e fixtures definidos; não prova WCAG 2.1 AA completa, contraste em todo contexto, tecnologia assistiva nativa, aceitação da entrada 5, nem fechamento do épico.

## Aprovações e evidência ainda necessárias

- Aprovação da main para iniciar uma lease de implementação delimitada aos três paths acima.
- Confirmação técnica da entrada 3 pela main, após revisão independente, Root e QA real. Este gate técnico não presume nem exige inventar fechamento formal: os estados formal/HITL seguem separados.
- Execução futura de `npm run e2e` após a implementação, com resultado local registrado e violações críticas/sérias tratadas; este plano não apresenta resultado de execução.
- A entrada 5 continua exigindo pessoa, tecnologia assistiva e checklist WCAG. Axe não pode marcar esse aceite.
