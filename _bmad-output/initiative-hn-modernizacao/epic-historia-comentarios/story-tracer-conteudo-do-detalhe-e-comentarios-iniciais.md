---
id: 1
type: story
title: "Tracer: conteúdo do detalhe e comentários iniciais"
parent: epic-historia-comentarios
covers: [RF-04, RF-11]
after: [2.1, 2.5]
hitl: false
risk: high
---

# Tracer: conteúdo do detalhe e comentários iniciais

## Description

Preenche a tela de `/item/{id}` já registrada e ligada pela listagem (2.5), usando `fetchItem`, cache e envelopes AD-3 de 2.1; mostra dados da história, frescor e o primeiro nível de comentários com autor e tempo relativo, sem alterar a rota, o link ou a restauração da lista.

## Acceptance Criteria

Verify: Com fixture local de história e comentários, `npm run e2e` confirma que a rota entregue por 2.5 exibe dados do item e cada comentário inicial com autor/tempo relativo, usa `cachedAt` para 'atualizado em HH:MM' e mostra aviso de stale quando `ItemResponse` ou `CommentsResponse` traz `stale=true`.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md

## Notes

- Handoff: epic-listagem é dono do roteamento SPA, do link da lista para `/item/{id}` e do retorno/posição; esta entrada implementa somente o conteúdo da tela de detalhe e consome essa superfície.
- Risk check: comparar localmente a história e a ordem dos comentários com a resposta da fixture do HN, além da verificação automatizada.

## Entrega e verificação

- **Entrega:** tela de detalhe consome o item normalizado e apresenta história, frescor e primeiro nível de comentários; a rota/retorno da lista seguem sob ownership de 2.5. Job apresenta envelope de comentários vazio sem falhar.
- **Paths:** `client/src/features/detail/`, `server/src/app/get-item.ts`, `server/src/app/comments/`, `server/src/http/routes/items.ts`, `e2e/detail.spec.ts`.
- **Evidências:** smoke inicial da história e Job na aplicação compilada, com sete comentários iniciais e estado Job vazio, em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-detail-3-1.RcVjnr/`; Root/Playwright em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-3-1-postreview.vbqGDs/`. A QA final do `npm start` público e do Compose confirma o fluxo de comentários via BFF público e captura 16 PNGs: `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** as verificações são técnicas e automatizadas; não representam teste humano, AT ou WCAG completa. Os detalhes de limite de 500 nós/profundidade 8 são registrados em 3.2/3.3.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
