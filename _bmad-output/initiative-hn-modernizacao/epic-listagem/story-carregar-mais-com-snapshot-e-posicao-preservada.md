---
id: 5
type: story
title: "Carregar mais com snapshot e posição preservada"
parent: epic-listagem
covers: [RF-02, RF-08, RF-12]
after: [1, 3, 4]
hitl: false
risk: medium
---

# Carregar mais com snapshot e posição preservada

## Description

Acrescenta páginas somente após ação explícita em “Carregar mais”, mantém a rolagem e a categoria ao abrir e voltar do detalhe, e reinicia do início com aviso quando o servidor retorna `SNAPSHOT_EXPIRED`.

## Acceptance Criteria

Verify: `npm run e2e` local confirma que rolar não carrega dados e só clicar em “Carregar mais” anexa itens sem pular ao topo, erro da página seguinte mantém itens existentes, retorno do detalhe restaura rota/categoria/posição, e `SNAPSHOT_EXPIRED` limpa a sequência vencida, busca a primeira página e mostra aviso ao leitor.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Entrega e verificação

- **Entrega:** “Carregar mais” é acionado explicitamente, preserva buffer/posição ao navegar, mantém itens em erro e recupera do `SNAPSHOT_EXPIRED`; Jobs também usa `hasMore` até o fim real da sequência.
- **Paths:** `client/src/features/listing/`, `client/src/api/`, `server/src/app/get-stories.ts`, `e2e/listing.spec.ts`.
- **Evidências:** E2E oficial pós-correções 22/22 e smoke com 90 itens Top, erro offline/retry, Back/Forward/Voltar, 31 Jobs e viewport 320 px em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-2-5-postfix.7D3rzc/` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-pagination-2-5-postfix.kvpz1z/`; expiração/recovery em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-expiration-2-5-replaced.rX7GpB/`. QA final local e Compose confirmam seis categorias, 30 itens e página 2 com snapshot estável em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** expirar o TTL mantendo o snapshot retido produz resposta stale; só troca/expiração real do snapshot causa `SNAPSHOT_EXPIRED`. A QA é automatizada, sem teste humano/AT, que não é requisito após a decisão.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
