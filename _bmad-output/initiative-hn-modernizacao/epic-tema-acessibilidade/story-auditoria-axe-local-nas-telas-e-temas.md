---
id: 4
type: story
title: "Auditoria axe local nas telas e temas"
parent: epic-tema-acessibilidade
covers: [RNF-04, RNF-09]
after: [3]
hitl: false
risk: high
---

# Auditoria axe local nas telas e temas

## Description

Acrescenta a auditoria axe ao fluxo local e corrige violações críticas ou sérias nas telas principais em tema claro e escuro, sem depender de CI.

## Acceptance Criteria

Verify: `npm run e2e` local audita lista e detalhe nos dois temas e termina sem violações axe críticas ou sérias.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-tema-acessibilidade/epic-tema-acessibilidade.md

## Notes

- Decision (2026-10-12): a aceitação 4.5 passou a ser técnica; axe é uma das evidências automatizadas e não demonstra por si só teste humano com AT, ambiente limpo ou conformidade WCAG completa.

## Entrega e verificação

- **Entrega:** wrapper `@axe-core/playwright` 4.13.0 e `axe-core` 4.13.0 transitivo foram adicionados; `e2e/accessibility.spec.ts` audita a página inteira por regras padrão nas telas de lista/detalhe e temas claro/escuro, sem filtros de regras.
- **Paths:** `package.json`, `package-lock.json`, `e2e/accessibility.spec.ts`.
- **Evidências:** instalação e validação incremental em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-dependency.GQX8SN/`; Root check 121/20, build 3 workspaces e E2E 56/56 em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-4-4-postreview.zvlN6U/`; auditoria compilada, JSON e quatro PNGs abertos pela MAIN em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/`.
- **Resultado/limites:** quatro auditorias padrão retornaram 0 violações; duas ocorrências `incomplete` de contraste na tab Jobs foram preservadas, não convertidas em violações nem descartadas. Após revelar Jobs, contraste computado foi 7,24:1 claro e 7,34:1 escuro. Axe não prova AT nem WCAG completa.
- **Estado no plano:** permanece conforme a entrada correspondente; a auditoria técnica registra os resultados e itens `incomplete`, sem alterar status nesta folha.
