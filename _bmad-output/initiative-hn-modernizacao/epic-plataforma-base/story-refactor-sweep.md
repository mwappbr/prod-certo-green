---
id: 8
type: story
title: "Refactor sweep"
parent: epic-plataforma-base
after: [1, 2, 3, 4, 5, 6, 7, 9]
hitl: false
risk: low
---

# Refactor sweep

## Description

Limpeza diferida somente das entregas de plataforma das entradas 1 a 7 e 9: configuração, health, ferramentas locais, empacotamento e documentação; nada de escopo novo. O sweep não altera features de listagem, história, comentários ou tema, contratos públicos compartilhados, tokens consumidos pelas telas, chaves de cache ou interfaces de handoff já usadas pelos épicos consumidores. Achados fora desses limites são registrados para o proprietário, não corrigidos concorrentemente.

## Acceptance Criteria

Verify: Lint, typecheck e npm run check passam sem alterar o comportamento de /api/health nem da configuração; o diff fica restrito às áreas de plataforma e não modifica contratos, tokens ou features dos consumidores.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** o sweep de plataforma entregou correções delimitadas de tooling/runner e configuração de desenvolvimento; a revisão técnica fechou três achados do runner, sem ampliar escopo para features consumidoras.
- **Paths:** `scripts/dev.mjs`, `scripts/dev-platform-config.mjs`, `server/src/config/index.ts`, `server/test/dev-runner.test.ts`, `client/vite.config.ts`.
- **Evidências:** testes focados 15/15, smoke do processo POSIX com encerramento do grupo filho e Root posterior com check 121/20, build de três workspaces e E2E 44/44: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-1-8-followup.q47cWl/` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-1-8-4-1-postreview.K59S0l/`.
- **Limites:** encerramento nativo no Windows não foi verificado. A verificação Compose integrada final agora está registrada na evidência 1.6; isso não altera a limitação do runner nativo.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
