---
id: 5
type: story
title: "Testes unitários e de integração pelo script de verificação"
parent: epic-plataforma-base
covers: [RNF-06]
after: [1, 2, 3]
hitl: false
risk: medium
---

# Testes unitários e de integração pelo script de verificação

## Description

Vitest com testes unitários e um de integração, que chama /api/health via inject do Fastify, reunidos em npm run check junto com typecheck e lint.

## Acceptance Criteria

Verify: npm run check passa em ambiente limpo e falha quando um teste quebra.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** Vitest e o script `npm run check` reúnem testes, lint e typecheck; há teste de integração de `/api/health` via Fastify `inject`.
- **Paths:** `package.json`, `vitest.config.ts`, `server/test/`.
- **Evidências:** a janela Root de 4.4 registrou `npm run check` com 121 testes em 20 arquivos, typechecks dos workspaces/testes e lint oficial do servidor: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-postreview.zvlN6U/`.
- **Limites:** é uma execução automatizada local reportada pela MAIN; não é validação humana nem execução em ambiente limpo. A contagem é da suíte agregada atual, não somente desta história.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não atualiza o status.
