---
id: 1
type: story
title: "Tracer: primeira página top ponta a ponta"
parent: epic-listagem
covers: [RF-01, RF-03, RF-10, RNF-02]
after: [1.1, 1.2, 1.4, 1.5]
hitl: false
risk: high
---

# Tracer: primeira página top ponta a ponta

## Description

Entrega a primeira página top da API oficial até a lista SPA usando os tokens 1.4 existentes; define em `shared/contract` os envelopes `StoriesPage`, `ItemResponse` e `CommentsResponse` e os tipos `Story`/`CommentNode`, implementa `fetchItem` com cache inicial de item, e fornece o runner E2E local `npm run e2e` com fixtures compartilhadas para os épicos 2 e 3.

## Acceptance Criteria

Verify: `npm run check` e `npm run e2e` locais confirmam que a página top usa os tokens existentes e o contrato normalizado sem expor o formato bruto do HN, que a repetição de `fetchItem` para o mesmo id dentro do TTL faz apenas uma chamada HN, e que a fixture do tracer executa pelo runner criado nesta entrada.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Notes

- Assumption: Playwright é o runner E2E local, sem CI; criar o comando npm run e2e e fixtures reutilizáveis aqui, pois o harness Vitest de 1.5 cobre check/unit/integration.
- Risk check: depois da fixture, confirmar localmente que timeout e falha da API oficial não derrubam a listagem nem expõem o formato bruto.

## Entrega e verificação

- **Entrega:** primeira listagem Top integrada ao contrato normalizado, com `fetchItem`/cache inicial e runner Playwright local reutilizável para as histórias seguintes.
- **Paths:** `shared/contract/stories.ts`, `server/src/app/fetch-item.ts`, `client/src/features/listing/`, `e2e/`, `playwright.config.ts`.
- **Evidências:** smoke inicial compilado, `/api/health` e 29 histórias Top em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/2-1-live/result.json`; QA pública integrada final em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e execução Compose em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json` cobrem as seis categorias e página 2 sob snapshot estável.
- **Limites:** o smoke desta história focava Top e runner; a QA integrada amplia cobertura técnica, mas não declara teste humano, AT ou conformidade WCAG completa.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
