---
id: 6
type: story
title: "Refactor sweep"
parent: epic-listagem
after: [1, 2, 3, 4, 5]
hitl: false
risk: low
---

# Refactor sweep

## Description

Limpa apenas débitos e achados adiados no adapter, cache e listagem, sem alterar comentários/história, tema, contratos compartilhados ou ampliar o escopo.

## Acceptance Criteria

Verify: `npm run check` e `npm run e2e` locais passam, a revisão confirma frescor, cache de escritor único AD-4, contratos, estados e posição da lista, e o diff permanece limitado a adapter/cache/listagem sem alterar comentários ou tema.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Entrega e verificação

- **Entrega:** sweep técnico concluído como **NO-OP**; revisor independente não identificou débito concreto que justificasse refactor após as correções 2.1–2.5. Nenhum código/teste foi alterado para criar trabalho artificial.
- **Paths:** evidência de fechamento e justificativa no plano `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/epic-listagem/story-refactor-sweep-plan.md`.
- **Evidências:** revisão focada e resultados reaproveitados do Root/E2E e smokes 2.5 estão registrados em `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/execution-progress.md` e nos paths citados em 2.5.
- **Limites:** NO-OP significa ausência de débito justificável no escopo revisado, não prova de ausência de todo bug. Resultados foram reutilizados, não reexecutados neste sweep.
- **Estado no plano:** permanece conforme a entrada correspondente; a conclusão técnica NO-OP não altera status nesta folha.
