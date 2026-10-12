---
id: 7
type: story
title: "Refactor sweep"
parent: epic-tema-acessibilidade
after: [1, 2, 3, 4, 5, 6]
hitl: false
risk: low
---

# Refactor sweep

## Description

Limpa apenas débitos e achados adiados de tema, acessibilidade e layout, reconciliando as entradas 1 a 6 sem alterar código de listagem/história fora do escopo nem ampliar o trabalho.

## Acceptance Criteria

Verify: `npm run check`, `npm run build` e `npm run e2e` locais passam, e a revisão confirma tema, acessibilidade, responsividade e evidências sem alterar os resultados aceitos anteriormente.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/epic-tema-acessibilidade.md

## Entrega e verificação

- **Entrega:** revisão original reportada pela MAIN concluiu **NO-OP**, sem defeito concreto que justificasse refactor; nenhum trabalho novo foi criado. A revisão independente de fechamento pelo agente `a287` ainda está em andamento.
- **Paths:** definição no plano `epic-tema-acessibilidade/tickets.toml`, entrada 7; esta folha materializa a história.
- **Evidências:** revisão original NO-OP e resultados técnicos prévios 4.1–4.6; a QA final pública/Compose está em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`, mas não substitui revisão do sweep.
- **Limites:** NO-OP significa ausência de defeito concreto no escopo revisado, não garantia geral de ausência de bugs. Não se afirma fechamento independente enquanto o agente `a287` trabalha.
- **Pendente:** aguardar o fechamento independente; estado formal permanece conforme a entrada correspondente no plano.
