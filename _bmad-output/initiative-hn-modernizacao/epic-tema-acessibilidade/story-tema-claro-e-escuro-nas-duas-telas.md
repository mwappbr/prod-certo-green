---
id: 1
type: story
title: "Tema claro e escuro nas duas telas"
parent: epic-tema-acessibilidade
covers: [RF-07]
after: [1.4, 2.5, 2.6, 3.3, 3.4]
hitl: false
risk: medium
---

# Tema claro e escuro nas duas telas

## Description

Aplica os tokens de tema existentes à listagem e ao detalhe, segue a preferência do sistema na primeira visita e mantém a escolha manual apenas durante a sessão da aba.

## Acceptance Criteria

Verify: `npm run e2e` local confirma tema inicial conforme a preferência do sistema, alternância manual nas telas de lista e detalhe e persistência em `sessionStorage` após navegar e recarregar na mesma aba, sem persistir entre abas ou sessões.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/epic-tema-acessibilidade.md

## Notes

- Assumption: a escolha manual sobrevive à navegação e à recarga enquanto a aba está aberta; sessionStorage é usado apenas para o tema RF-07, nunca para o estado de recolhimento dos comentários.

## Entrega e verificação

- **Entrega:** preferência inicial do sistema e alternância manual nas telas de lista/detalhe; escolha é mantida na aba, com fallback e troca de preferência observados em contexto isolado.
- **Paths:** `client/src/theme.css`, `client/src/features/theme/`, `client/src/main.tsx`, `e2e/theme.spec.ts`.
- **Evidências:** ROOT de 4.1 (121 testes/20 arquivos, build 3 workspaces, E2E 44/44) em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-1-8-4-1-postreview.K59S0l/`; QA compilada com 21 estados, 7 screenshots e zero chamadas BFF/HN extras no toggle em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-theme-4-1.vvWY4h/passed/`. QA final de aplicação pública e Compose com 16 PNGs revisados pela MAIN em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** duração de 4,789 ms é uma execução, não p95; não houve medição de first paint, auditoria axe/AT nem declaração WCAG completa. Não se alega revisão humana ou conformidade WCAG completa.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
