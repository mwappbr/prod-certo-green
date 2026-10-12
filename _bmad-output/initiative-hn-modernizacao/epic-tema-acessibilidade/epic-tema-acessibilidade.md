---
tracker_id: ""
key: ""
type: epic
title: "Tema, acessibilidade e busca local"
parent: initiative-hn-modernizacao
covers: [RF-07, RF-09, RNF-04, RNF-09]
after: ["1.4", "2.5", "3.3"]
assignee: ""
risk: medium
---

# Tema, acessibilidade e busca local

## Description

Por último, o leitor escolhe tema claro ou escuro (seguindo o SO na primeira visita), e a interface passa por uma auditoria técnica de acessibilidade e de layout em telas estreitas. RF-09, filtro local por título, permanece opcional, parked e não implementado. Este épico não cria telas novas; fecha as existentes.

## Outcome

Leitores usam o HN modernizado em tema de sua preferência, com contraste suficiente, sem rolagem horizontal em celular, e com acessibilidade auditada nas telas principais.

## Requirements

- RF-07: tema claro e escuro, seguindo o SO na primeira visita — PRD seção 5.3
- RF-09: filtro local por título (nice to have) — PRD seção 5.4
- RNF-04: WCAG 2.1 AA — PRD seção 6.2
- RNF-09: sem rolagem horizontal a partir de 320 px — PRD seção 6.2

## Done when

1. Tema claro e escuro funcionam, com contraste de 4,5:1 para texto normal, e a primeira visita segue o SO.
2. Auditoria axe local de página inteira sem violações críticas/sérias e checklist técnico automatizado de contraste, teclado/foco, alvos e reflow nas telas principais (O-03). Conforme decisão humana de 2026-10-12, AT/checklist humano deixaram de ser gates obrigatórios; não foram executados e não há comprovação WCAG completa. Preservar resultados inconclusivos.
3. Sem rolagem horizontal em 320 px e 375 px e controles utilizáveis no stress tipográfico automatizado a 200%, nas telas de listagem e história. A simulação técnica não comprova ampliação da fonte do SO nem zoom/reflow nativo.
4. RF-09 permanece opcional; se for implementado, filtra apenas os itens carregados, e sua ausência não bloqueia a conclusão do MVP.
5. A reconciliação final de O-05 confirma os artefatos versionados de todas as fases do SDLC após as entregas de listagem/história, os sweeps 2.6/3.4 e os artefatos de plataforma 1.8/1.9, com verificação técnica automatizada dos comandos locais e do README. A decisão humana de 2026-10-12 substituiu a verificação humana obrigatória; o versionamento continua exigindo commit real.

## Boundaries

Estilos de tema, acessibilidade, layout responsivo e o filtro local. Não cria novas telas nem novos dados; altera as telas dos épicos listagem e historia-comentarios. Ponto de atenção: é o único épico que mexe em código de todos os outros.

## References

- prd — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md, seções 5.3, 5.4, 6.2, 8 e 9
- addendum — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/addendum.md, seção C (risco de acessibilidade)
- experience — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md, temas, teclado, toque e responsividade
- design — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md, tokens de cor, contraste, tipografia e espaçamento
- architecture — _bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md, AD-8 e AD-10
- platform — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md, Notes sobre propriedade dos tokens; `tickets.toml`, entrada 4
- listing — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md, contrato das telas e paginação
- history — _bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md, árvore e estados do detalhe

## Notes

- Decision: tema e acessibilidade são um épico próprio, o último (user's decision, 2026-10-09).
- Parked: RF-09 (busca local) é nice to have e pode ser cortado sem afetar o MVP; sua ausência não bloqueia o Done when.
- Decision: os tokens de tema são definidos em epic-plataforma-base, entrada 1.4; este épico só os aplica e audita (user's decision, 2026-10-09).
- Reference: DESIGN final define a paleta azul e as cores claro/escuro; usar esses valores sem escolher novos tokens.
- Assumption: primeira visita segue o sistema; a escolha manual persiste apenas durante a sessão da aba, conforme RF-07 e EXPERIENCE.
- Tracer: entrada 1 aplica o tema nas telas existentes depois dos providers 1.4/2.5/3.3 e dos sweeps 2.6/3.4; não espera pelo sweep 1.8 para começar código de tema.
- Assumption/boundary: o sweep 1.8 foi limitado pelo proprietário da plataforma a config/health/ferramentas/empacotamento/documentação, sem tocar features, contratos, tokens, chaves de cache ou interfaces consumidas; se aparecer trabalho fora desses limites, volta ao owner, não é corrigido em paralelo. 1.8/1.9 são gates apenas para O-05 na entrada 6.
- Sequencing histórico: entrada 1 começa após os providers e sweeps de listagem/história; entradas 2–4 percorrem responsividade, semântica e axe; entrada 5 previa HITL manual com leitor de tela/checklist; entrada 6 reconcilia O-05 após 1.8/1.9; sweep 7 é final. A decisão humana de 2026-10-12 substitui os gates obrigatórios humanos de 4.5/4.6 por aceite técnico automatizado, com hitl:false nas folhas e entradas.
- Limite preservado: axe/testes automatizados não comprovam leitor de tela, checklist WCAG humano ou conformidade completa. Esses testes humanos não ocorreram, mas não são gates obrigatórios do escopo de aceite técnico autorizado. Evidência versionada do SDLC continua obrigatória; workflows manuais históricos/HALTs não são retroativamente aprovados.
