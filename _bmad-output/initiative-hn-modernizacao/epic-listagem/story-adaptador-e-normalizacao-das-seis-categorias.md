---
id: 2
type: story
title: "Adaptador e normalização das seis categorias"
parent: epic-listagem
covers: [RF-01, RF-03, RF-10]
after: [1]
hitl: false
risk: medium
---

# Adaptador e normalização das seis categorias

## Description

Completa o adaptador para top, new, best, ask, show e job e normaliza campos opcionais, URLs e itens inválidos antes de compor a resposta de listagem.

## Acceptance Criteria

Verify: `npm run check` local com fixtures confirma as seis categorias, ausência de campos opcionais, descarte isolado de itens inválidos e URL somente HTTP ou HTTPS.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Entrega e verificação

- **Entrega:** adaptador e normalização cobrem `top`, `new`, `best`, `ask`, `show` e `job`, com tratamento de campos opcionais, URLs e itens inválidos. A ampliação de fixtures/tests confirmou a lógica existente; não foi necessário patch adicional de produção para esta história.
- **Paths:** `server/src/adapters/hn/`, `server/src/domain/`, `e2e/fixtures/hn-stories.json`, `e2e/start-server.mjs`.
- **Evidências:** fixtures das seis categorias/normalização e Root check/build/E2E em `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/execution-progress.md` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-postreview.zvlN6U/`; QA final pública e Compose também percorreram as seis categorias em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** QA pública verifica respostas observadas, sem cobrir todas as futuras respostas da API do HN; não é aceite humano.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
