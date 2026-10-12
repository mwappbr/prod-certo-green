---
id: 4
type: story
title: "Tokens de tema claro e escuro"
parent: epic-plataforma-base
after: [1]
hitl: false
risk: low
---

# Tokens de tema claro e escuro

## Description

Define em um lugar só as cores e o contraste dos temas claro e escuro, com contraste de 4,5:1 para texto normal (AD-8, PRD seção 9).

## Acceptance Criteria

Verify: Um teste automatizado confirma 4,5:1 para o texto normal nos dois temas.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** tokens claros/escuros centralizados em CSS e verificador standalone de contraste; o conjunto configurado atende 4,5:1 para texto normal nos dois temas.
- **Paths:** `client/src/theme.css`, `scripts/check-theme.mjs`.
- **Evidências:** a MAIN executou `node scripts/check-theme.mjs` em Node 24.21.0 e registrou o resultado de contraste; a verificação Root mais recente também rodou o verificador, em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-postreview.zvlN6U/`.
- **Limites:** o verificador cobre combinações declaradas de tokens, não auditoria completa das telas, axe, leitor de tela/AT ou conformidade WCAG completa.
- **Estado no plano:** permanece conforme a entrada correspondente; nenhuma alteração de status foi feita nesta folha.
