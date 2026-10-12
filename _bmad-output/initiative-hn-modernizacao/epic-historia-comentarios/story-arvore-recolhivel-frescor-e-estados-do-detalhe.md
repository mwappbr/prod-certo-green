---
id: 3
type: story
title: "Árvore recolhível, frescor e estados do detalhe"
parent: epic-historia-comentarios
covers: [RF-04, RF-05, RF-06, RF-08, RF-11]
after: [2]
hitl: false
risk: medium
---

# Árvore recolhível, frescor e estados do detalhe

## Description

Renderiza todos os nós com autor e tempo relativo, permite recolher e expandir cada ramo sem nova chamada ao HN, mostra `cachedAt`/`stale` dos envelopes AD-3 e seus avisos de frescor, além de carregamento, erro com nova tentativa e estado vazio.

## Acceptance Criteria

Verify: `npm run e2e` local com fixture de pelo menos 200 comentários confirma autor/tempo relativo por nó, recolher/expandir com `aria-expanded` e sem chamada repetida, estado recolhido mantido durante navegação SPA mas árvore aberta após reload completo, indicador 'atualizado em HH:MM' e aviso quando o detalhe recebe `stale=true`, estados de carregamento/erro-retry/sem comentários, e revisão estática confirma que somente `SafeHtml` é o sink de HTML sanitizado.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md

## Entrega e verificação

- **Entrega:** árvore permite recolher/expandir mantendo corpo próprio e descendentes ocultos, estado por raiz durante navegação SPA e abertura após reload; status/counts descrevem respostas carregadas e profundidade cortada sem inventar contagem total.
- **Paths:** `client/src/features/detail/CommentTree.tsx`, `client/src/features/detail/`, `e2e/detail.spec.ts`, `e2e/start-server.mjs`.
- **Evidências:** Root check 102/102, build de três workspaces e E2E oficial 38/38 em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-3-3-postreview.2vxpHr/`; QA de fixture com 220 nós e 221 IDs em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-tree-3-3.rHj5Ut/passed/`. A QA final pública/Compose verificou comentários via BFF, DOM até 500 nós, profundidade padrão 8 e truncamento; 16 PNGs foram abertos pela MAIN: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** execução técnica automatizada, sem teste humano/AT ou WCAG completa. A verificação de fixture de 220 nós e a QA pública de até 500 DOM são evidências distintas; Dark da fixture foi aplicado por atributo, não pelo fluxo de tema 4.1.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
