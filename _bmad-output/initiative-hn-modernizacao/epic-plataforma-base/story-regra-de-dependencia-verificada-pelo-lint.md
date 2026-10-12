---
id: 3
type: story
title: "Regra de dependência verificada pelo lint"
parent: epic-plataforma-base
covers: [RNF-06]
after: [1, 2]
hitl: false
risk: low
---

# Regra de dependência verificada pelo lint

## Description

ESLint com eslint-plugin-import (no-restricted-paths) impõe a direção de dependência do AD-1.

## Acceptance Criteria

Verify: Um import proibido de adapters para http falha o lint.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Notes

- Decision: 2026-10-12 — a incerteza histórica de compatibilidade foi resolvida por execução real em Node 24.21.0, ESLint 9.39.5 e TypeScript 7.0.2: lint oficial do servidor, typechecks e probes negativos passaram conforme o ledger; a janela Root final `verification/window-4-4-postreview.zvlN6U/` também executou o lint com sucesso. Isto verifica esta configuração local, sem alegar suporte irrestrito a versões futuras.

## Entrega e verificação

- **Entrega:** ESLint passou a impor a direção de dependências do AD-1, com exceções explícitas para os pontos de composição autorizados; probes de import proibido foram reportados como falhando o lint.
- **Paths:** `server/eslint.config.js`, `server/package.json`.
- **Evidências:** lint/typecheck/build e probes negativos foram registrados pela MAIN no `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/execution-progress.md`; as janelas Root posteriores executaram o lint oficial do servidor, incluindo `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-postreview.zvlN6U/`.
- **Limites:** lint validado é controle estático; não comprova comportamento runtime. A compatibilidade inicialmente desconhecida foi reconciliada na decisão datada acima.
- **Fechamento:** entrega técnica verificada; o estado formal é mantido no plano por `tickets.py mark`, não nesta folha.
