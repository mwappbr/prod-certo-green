---
id: 4
type: story
title: "Categorias, metadados e estados da listagem"
parent: epic-listagem
covers: [RF-01, RF-03, RF-08, RF-11, RF-13]
after: [1, 2]
hitl: false
risk: medium
---

# Categorias, metadados e estados da listagem

## Description

Permite abrir cada categoria pela rota `/?category=...`, voltar ao topo ao trocar categoria e apresenta título, pontuação, autor, tempo relativo, comentários, domínio quando disponível, atualização e estados de carregamento, erro e vazio.

## Acceptance Criteria

Verify: `npm run e2e` local percorre as seis categorias e confirma rota/aba ativa, retorno ao topo, metadados, aviso stale usando fixture API com `stale=true` sem depender do fallback do servidor da entrada 3, nova tentativa, estado vazio e ausência de domínio quando a história não tem URL.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Entrega e verificação

- **Entrega:** a UI permite percorrer as seis categorias, expõe título/metadados e frescor stale, e cobre carregamento, erro/retry e vazio; navegação e reset de topo foram ajustados sem expor dados da categoria anterior durante troca atrasada.
- **Paths:** `client/src/features/listing/StoryListPage.tsx`, `client/src/features/listing/useStories.ts`, `e2e/listing.spec.ts`.
- **Evidências:** Root pós-patch/E2E em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-2-3-2-4-postfix.pKi1IC/` e smoke inicial de categorias/metadados/Jobs em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-categories-2-3-2-4-postfix.4MjGru/`; validação pública final das seis categorias está em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json`, com execução Compose correspondente em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json` e 16 PNGs abertos pela MAIN.
- **Limites:** evidência cobre os dados/estados observados, não todos os contextos futuros do HN; não constitui teste humano, AT ou declaração WCAG completa.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
