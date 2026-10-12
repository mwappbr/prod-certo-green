---
id: 1
type: story
title: "Tracer: serviço com /api/health e SPA vazia"
parent: epic-plataforma-base
covers: [RNF-05]
after: []
hitl: false
risk: low
---

# Tracer: serviço com /api/health e SPA vazia

## Description

Fastify serve /api/health (estado do serviço e do cache) e uma SPA vazia no mesmo processo, em TypeScript estrito, com o layout-semente de AD-1 e os scripts do package.json; Vite na porta 5173 encaminha /api para a 3000 em desenvolvimento.

## Acceptance Criteria

Verify: Em desenvolvimento e no build, a página abre e /api/health responde 200 com os campos de estado do serviço e do cache.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** servidor Fastify atende `/api/health` e serve a SPA no mesmo processo; a base React/Vite inclui proxy de `/api` em desenvolvimento. A MAIN agora reporta a entrega integrada verificada no `npm start` local e no Compose.
- **Paths:** `server/src/main.ts`, `client/src/App.tsx`, `client/src/main.tsx`, `client/vite.config.ts`.
- **Evidências:** smoke inicial compilado e página em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/2-1-live/result.json`; QA final pública em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e Compose em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json` (aplicação healthy).
- **Limites:** evidência técnica automatizada; não ocorreu teste humano em ambiente limpo, teste AT ou avaliação WCAG completa, e esses itens não são requisitos após a decisão registrada.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
