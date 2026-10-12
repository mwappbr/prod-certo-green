---
tracker_id: ""
key: ""
type: initiative
status: done
title: "Modernização da interface do Hacker News"
parent: none
covers: [RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RNF-01, RNF-02, RNF-03, RNF-04, RNF-05, RNF-06, RNF-07, RNF-08, RNF-09, RNF-10]
after: []
assignee: ""
risk: medium
---

# Modernização da interface do Hacker News

## Description

Um leitor do Hacker News navega pelas categorias, lê histórias e acompanha comentários em uma interface mais rápida, legível e acessível, em tema claro ou escuro e em qualquer tamanho de tela. O PRD (`prd-hn-modernizacao/prd-hn-modernizacao.md`) define as funcionalidades e os requisitos; esta iniciativa os entrega em quatro épicos, em ordem de construção.

## Outcome

Leitores do HN chegam à primeira página de uma categoria em menos de 1 s (p95, com cache quente) e leem histórias e comentários sem precisar da interface original, com a perda de frescor dos dados exibida (RF-11).

## Requirements

Os ids são do PRD, seção 5 (RF) e seção 6 (RNF). Os épicos citam esses ids nos próprios `covers`.

## Done when

1. Os critérios técnicos de aceite do MVP em PRD seção 9 passam na execução local e no Docker Compose isolado, com comandos automatizados e evidências registradas. O teste HUMANO em ambiente limpo deixou de ser obrigatório por decisão explícita do usuário em 2026-10-12; não declarar que esse teste humano ocorreu.
2. O p95 da primeira página de `/api/stories` fica abaixo de 1 s com cache quente (O-01).
3. Comentários de uma história com pelo menos 200 comentários abrem, recolhem e expandem sem chamadas repetidas à API do HN dentro do TTL (O-02).
4. Auditoria axe local de página inteira sem violações críticas ou sérias nas telas principais, em claro/escuro, e checklist técnico automatizado de contraste, teclado/foco, alvos de toque e reflow (O-03). Reportar resultados inconclusivos e limitações. O aceite obrigatório passa a técnico automatizado por decisão do usuário em 2026-10-12; testes humanos com tecnologia assistiva e conformidade WCAG 2.1 AA completa NÃO são comprovados.
5. Testes unitários das regras de negócio, ao menos um teste de integração e os testes E2E locais passam; os artefatos de cada fase do SDLC estão versionados e o processo está descrito no README (O-04, O-05).

## Boundaries

Uma aplicação, um deploy: um serviço Fastify que serve `/api` e o SPA compilado, em um serviço do Docker Compose. Os épicos seguem capacidades, não módulos, porque o dono é um só. Não inclui autenticação, escrita no HN, nem outras categorias além das seis listadas no PRD. A busca local (RF-09) é nice to have e fica no último épico.

Tracer path: a categoria `top` atravessa o adapter do HN, o cache e a página de listagem, e uma história abre com seus comentários.

- Touch point: API pública do Hacker News (`/v0`) — consumida pelo adapter em `server/`, que é dono de epic-listagem; epic-historia-comentarios consome `fetchItem` por esse adapter para a travessia de comentários; owner: epic-listagem
- Touch point: Docker Compose e README — o empacotamento e a documentação de execução; owner: epic-plataforma-base

## References

- prd — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md, seções 2, 4, 5, 6, 7, 8 e 9
- addendum — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/addendum.md, seções A–D
- architecture — _bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md, Paradigma de Projeto, Invariantes e Regras, Convenções de Consistência, Pilha, Mapa de capacidades e AD-1 a AD-11
- experience — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md
- design — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md
- brief — _bmad-output/initiative-hn-modernizacao/brief-hn-modernizacao/brief-hn-modernizacao.md, seção 3 (personas e casos de uso, US-01 a US-07; decisões posteriores nesta iniciativa prevalecem)

## Notes

- Decision: 2026-10-12, usuário pediu “atualize as historias, marcando como completas e explicando o que foi feito em cada uma”. O fechamento das folhas verificadas é autorizado via `tickets.py mark`; cada história registra implementação, verificações e limitações. Não marcar trabalho técnico ainda pendente como realizado.
- Decision: 2026-10-12, resposta humana “Autorizar commits locais (Recommended)” autoriza staging seletivo e commits locais de código, testes e documentação desta iniciativa, preservando alterações preexistentes, sem segredos/temporários e sem push. Substitui a restrição anterior de não fazer staging/commits; não significa que o versionamento já ocorreu.
- Decision: 2026-10-12, resposta humana “Ajustar para aceite técnico” substitui os aceites obrigatórios HUMANOS em ambiente limpo e com tecnologia assistiva por validação técnica automatizada e evidências rastreáveis. Os testes humanos com AT/ambiente limpo não foram realizados e não há comprovação WCAG completa. Os HITLs correspondentes de 1.7/4.5/4.6 são reconciliados nas histórias e breakdowns; registros históricos de workflow/HALT/Riskchecks não viram aprovações retroativas.
- Decision: entrega do MVP é local e por Docker Compose; hospedagem em produção fica para depois do MVP (user's decision, 2026-10-09; architecture, seção Adiado).
- Decision: um único dono para todos os épicos (user's decision, 2026-10-09).
- Decision: a primeira demonstração é a listagem e a página de história (user's decision, 2026-10-09).
- Decision: tema e acessibilidade são um épico próprio, o último (user's decision, 2026-10-09).
- Assumption: a ordem de construção é plataforma, listagem, história e comentários, tema e acessibilidade; as entradas dependem dos handoffs concretos entre épicos, não da conclusão de todo trabalho sem relação nos épicos anteriores.
- Sequencing: após coordenação, o sweep de plataforma 1.8 está limitado a configuração/health/ferramentas/empacotamento/documentação e não altera features de listagem/história/comentários/tema, contratos, tokens, chaves de cache ou interfaces de handoff; epic4.1 aguarda os sweeps 2.6/3.4, e a reconciliação 4.6 aguarda 1.8/1.9. Achados fora dos limites voltam ao proprietário, sem correção concorrente.
- Parked: RF-09 (busca local) é nice to have; entra no épico tema e acessibilidade e pode ser cortado sem afetar o MVP.
- Source conflict: brief seção 7.2 mostra `category` e `total` na resposta da listagem; PRD seção 7 e AD-3 não os têm.
- Decision: `GET /api/stories` segue o envelope `StoriesPage` de AD-3; `category` é parâmetro de consulta e `total` não é campo obrigatório (user direction, 2026-10-11).
- Source conflict: brief US-02 diz "ou a lista chegue ao fim" (carregamento automático); EXPERIENCE rejeita rolagem infinita e admite só "Carregar mais".
- Decision: carregar mais é ação explícita; não haverá rolagem infinita automática (user direction, 2026-10-11).
- Source conflict: PRD RF-06 e brief US-03 dizem "[removido]"/"[morto]"; EXPERIENCE diz "Comentário removido pelo autor", o que pode não ser verdade, já que `deleted` nem sempre é ação do autor.
- Decision: usar os marcadores neutros `[removido]` e `[morto]`, sem atribuir a remoção ao autor (user direction, 2026-10-11).
- Source conflict: review-adversarial cita texto da arquitetura que não existe mais; as revisões estão desatualizadas.
- Assumption: comentários usam `sanitize-html` com allowlist e parsing sem DOM; verificar compatibilidade na implementação do epic3.
- Documented: a documentação oficial do HN permite até 500 ids em top/new e até 200 em ask/show/job; best não declara máximo e a documentação diz que não há limite de taxa atualmente. Ver epic-listagem References.
- Decision (existing platform decision, 2026-10-09): verificações e testes do MVP rodam localmente; CI não faz parte do MVP (epic-plataforma-base Notes).
- Assumption histórica (execução delegada autônoma /loop, anterior às decisões de 2026-10-12): os checkpoints de planejamento criados nesta decomposição não foram adotados e foram removidos; histórias high-risk seguiram com revisão independente obrigatória. Nesse ponto ainda permaneciam HITLs de leitor de tela/WCAG, reconciliação O-05 e plataforma, sem tickets novos marcados done. As decisões humanas de 2026-10-12 acima substituem os aceites obrigatórios por validação técnica e autorizam fechamento das entregas verificadas; este registro não afirma que os testes humanos ocorreram.

## Fechamento técnico — 2026-10-12

A MAIN/orquestradora encerra a iniciativa no escopo de aceite técnico autorizado, cumprindo o pedido de implementar o projeto e registrar as histórias concluídas. **26/26 histórias e os quatro épicos estão `done`**; as folhas foram formalizadas via `tickets.py mark` nos planos oficiais e os containers foram fechados após conferir requisitos/Done when, não automaticamente pela contagem.

1. **Done when 1:** aplicação real compilada (`npm start`) e Compose isolado passaram com seis categorias de 30 itens, paginação explícita por snapshot, metadados, detalhe, recolhimento/expansão e retorno de rolagem, temas, acesso direto e layout320/375 sem overflow. Desenvolvimento `npm run dev` também passou em `localhost:5173`, com proxy health e Top/Jobs. Resumos versionados em `verification/final-platform-qa.U5JP6P/main-local-validation.json`, `main-compose-validation.json` e `main-dev-validation.json` no mesmo diretório. Capturas efetivamente abertas/inspecionadas e cleanup de recursos próprios registrados; não deixar servidores QA executando implica que a aplicação está disponível pelos comandos documentados, não já iniciada.
2. **Done when 2/O-01:** 180 amostras HTTP locais sequenciais com cache quente, 30 por categoria, corpo/JSON completos e todas fresh/não vazias; p95 agregado **1,269708 ms** e todas as categorias abaixo de1s. Não é medição de HN frio, carga concorrente, interatividade do browser ou SLA de produção.
3. **Done when 3/O-02:** história pública `50047422` abriu com 500 nós recebidos/renderizados no compilado e Compose, superando o mínimo200. Testes instrumentados com HN fixture comprovam reuso de itens dentro do TTL e toggles sem chamadas BFF/HN; a instrumentação é distinta do uso público. Limites de profundidade/orçamento/continuação preservados; HTML sanitizado no servidor antes do cache.
4. **Done when 4/O-03:** axe default de página inteira, quatro contextos novos lista/detalhe × claro/escuro, zero violações; preservados dois `incomplete` color-contrast serious em Jobs e suplemento RGB≈7,24:1/7,34:1. Teclado/foco/alvos e stress tipográfico2× registrados no checklist técnico. Não demonstrados AT/aceite humano, zoom/reflow nativo ou conformidade WCAG completa, conforme escopo autorizado. Resumo axe em `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json`; checklist em `docs/accessibility-checklist.md`.
5. **Done when 5/O-04/O-05:** Root final `verification/window-4-4-postreview.zvlN6U/` passou com 121 testes/20 arquivos, typechecks, lint oficial do servidor, contraste dos tokens, build dos três workspaces e 56 E2E. Sete fases do SDLC inventariadas em `docs/sdlc-artifacts.md` e referenciadas pelo README; artefatos versionados no commit real `0598a96b2a3fd1d339f61454925805d30a427be9` e reconciliação posterior no commit real `d24294364a924a626badc0fbaeb78272e5ced576`. Os estados finais deste fechamento são incluídos no commit seletivo de encerramento; fontes/testes inalterados não exigiram nova execução Root nem novo refactor.

O Closure independente a287 confirmou cobertura dos Done when dos quatro épicos/iniciativa e, no recheck após `d242943`, confirmou satisfeita a condição pendente de versionamento. A revisão original aaf do sweep4.7 foi aceita como NO-OP; não equivale a garantir ausência geral de bugs. Este fechamento é uma ação técnica da orquestração, não um novo aceite humano ou execução retroativa de workflows/HALTs/Riskchecks históricos.

RF-09/filtro local permanece **opcional, parked e não implementado**. Produção hospedada, CI, login/votos/escrita e demais itens fora do MVP não foram entregues nem prometidos. Alterações preexistentes e evidências brutas locais preservadas; somente commits locais pertinentes, sem push ou publicação externa.
