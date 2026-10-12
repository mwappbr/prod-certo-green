---
id: 4
type: story
title: "Refactor sweep"
parent: epic-historia-comentarios
after: [1, 2, 3]
hitl: false
risk: low
---

# Refactor sweep

## Description

Limpa apenas débitos e achados adiados dentro do detalhe, árvore, travessia e `SafeHtml`, sem alterar listagem/rota, adapter, cache, tema ou contratos compartilhados e sem ampliar o escopo.

## Acceptance Criteria

Verify: `npm run check` e `npm run e2e` locais passam e a revisão confirma a árvore, sanitização antes do cache, exclusividade de `SafeHtml`, frescor, marcadores e estados das entradas anteriores, com diff restrito aos limites deste épico.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md

## Entrega e verificação

- **Entrega:** sweep 3.4 concluído tecnicamente como **NO-OP** após revisão do código normalizado, BFS, projeções de cache/HTTP e sink `SafeHtml`; nenhum débito concreto justificou mudança adicional.
- **Paths:** avaliação técnica registrada no plano `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/story-refactor-sweep-plan.md`.
- **Evidências:** revisão independente e reuso declarado do Root 102/17, build de três workspaces, E2E 38/38 e QA local 220 nós estão consolidados em `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/execution-progress.md` e nos paths citados em 3.3.
- **Limites:** NO-OP é conclusão do escopo técnico revisado, não garantia de ausência de defeitos gerais; verificações foram reaproveitadas, não repetidas por este sweep.
- **Estado no plano:** permanece conforme a entrada correspondente; a revisão NO-OP documentada não altera status.
