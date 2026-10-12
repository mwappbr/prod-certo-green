---
tracker_id: ""
key: ""
type: epic
status: done
title: "Listagem por categoria"
parent: initiative-hn-modernizacao
covers: [RF-01, RF-02, RF-03, RF-08, RF-10, RF-11, RF-12, RF-13, RNF-01, RNF-02]
after: ["1.1", "1.2", "1.4", "1.5"]
assignee: ""
risk: high
---

# Listagem por categoria

## Description

Um leitor abre o HN modernizado, escolhe uma categoria (top, new, best, ask, show, job), vê as histórias com seus metadados, carrega mais sem perder a posição de rolagem e vê de quando são os dados. O servidor busca no Firebase do HN, normaliza o formato e mantém um cache em memória com TTL; a primeira demonstração do MVP é esta listagem.

## Outcome

Leitores chegam à primeira página de qualquer categoria em menos de 1 s (p95, com cache quente) e sabem o quão atualizados estão os dados que veem.

## Requirements

- RF-01: listagem por categoria (top, new, best, ask, show, job) — PRD seção 5.1
- RF-02: paginação com N padrão de 30 — PRD seção 5.1
- RF-03: metadados (pontuação, autor, tempo relativo, comentários, domínio opcional) — PRD seção 5.1
- RF-08: estados de carregamento, erro com nova tentativa e vazio — PRD seção 5.3
- RF-10: dados normalizados no back-end, sem o formato bruto do HN — PRD seção 7
- RF-11: "atualizado em" e aviso de dados desatualizados — PRD seção 5.3
- RF-12: posição de rolagem e paginação preservadas — PRD seção 5.1
- RF-13: estado de categoria vazia — PRD seção 5.1
- RNF-01: primeira página em menos de 1 s (p95), com cache quente — PRD seção 6.1
- RNF-02: cache em memória com TTL — PRD seção 6.1

## Done when

1. Todas as seis categorias listam itens com os metadados de RF-03, sem formato bruto do HN exposto.
2. "Carregar mais" acrescenta itens e mantém a posição de rolagem, sem carregamento automático (ver conflito em Notes).
3. Estados de carregamento, erro com nova tentativa e vazio aparecem na listagem.
4. A primeira página fica abaixo de 1 s (p95) em teste de carga leve, com cache quente.
5. Os dados da listagem mostram o horário de atualização e a perda de frescor, e o cache tem um único escritor (AD-4).

## Boundaries

O adapter do HN, o cache, o endpoint `/api/stories` e a tela de listagem. Não inclui a página de história nem a árvore de comentários (épico historia-comentarios). É o único dono do cache de itens e de listas (AD-4).

## References

- prd — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md, seções 5.1, 5.3, 6.1, 7, 8 e 9
- addendum — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/addendum.md, seções B e C (limites, falhas e riscos da API)
- architecture — _bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md, AD-2, AD-3, AD-4, AD-5, AD-8, AD-9, AD-10 e AD-11
- experience — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md, navegação, listagem e estados
- platform — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md, tokens antes das telas; `tickets.toml`, entradas 1.1, 1.2, 1.4 e 1.5
- design — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md, cores, tipografia, linhas de história e padrões de listagem
- api — https://github.com/HackerNews/API, endpoints públicos e listas de ids
- brief — _bmad-output/initiative-hn-modernizacao/brief-hn-modernizacao/brief-hn-modernizacao.md, US-01 e US-02 (origem; conflitos resolvidos pelas decisões abaixo)

## Notes

- Decision: entrega do MVP é local e por Docker Compose; hospedagem em produção fica para depois do MVP (user's decision, 2026-10-09; architecture, seção Adiado).
- Decision: `shared/contract/` e o roteamento do front-end são de listagem; história consome. A entrada 2.1 entrega `StoriesPage`, `ItemResponse`, `CommentsResponse`, `Story`, `CommentNode`, `fetchItem` e cache inicial de item; a entrada 2.5 é dona do link/lista para `/item/{id}` e do retorno com categoria e rolagem (user's decision, 2026-10-09).
- Decision: a primeira demonstração do MVP é a listagem (user's decision, 2026-10-09).
- Decision: paginação é explícita por “Carregar mais”; não há carregamento infinito automático, conforme EXPERIENCE (user direction, 2026-10-11; resolve Source conflict em US-02).
- Decision: `GET /api/stories` segue o envelope `StoriesPage` de AD-3 (`items`, `page`, `limit`, `snapshot`, `cachedAt`, `stale`); `category` é entrada de consulta e `total` não é parte obrigatória da resposta (user direction, 2026-10-11; resolve Source conflict do brief seção 7.2).
- Documented: a API oficial lista até 500 ids em top/new e até 200 em ask/show/job; best não declara máximo. A documentação diz que não há limite de taxa atualmente. Não presumir limite 500 para todas as categorias e manter concorrência limitada por segurança (API, consultada em 2026-10-11).
- Assumption: tamanho de página padrão 30 e máximo 50, TTL de lista 60 s, TTL de item 120 s, retenção de vencidos 15 min, concorrência 8, timeout 5 s e uma retentativa limitada; confirmar por verificação local sem contradizer a configuração validada da plataforma.
- Tracer: entrada 1 percorre API do HN, normalização, cache, contrato, endpoint e tela top consumindo os tokens existentes da entrada 1.4; não define novos tokens.
- Handoff: a entrada 1 também cria o runner Playwright local `npm run e2e` e fixtures reutilizáveis; a entrada 2.5 é dona de navegação da lista/detalhe, link de história e restauração de rota/categoria/rolagem.
- Handoff: RF-11 divide-se por superfície: este épico exibe `cachedAt`/`stale` na lista; o épico de história usa os mesmos envelopes AD-3 para exibir frescor e fallback no detalhe.
- Sequencing: entradas 3 (servidor) e 4 (cliente) podem avançar em paralelo após a entrada 2; a entrada 4 usa fixture `stale=true` e não espera pelo fallback de produção da 3; entrada 5 integra paginação e interface; Refactor sweep (6) fecha o épico.
- Sweep bounds: a entrada 6 fica restrita a adapter, cache e listagem; não altera história/comentários, tema ou contratos compartilhados consumidos pelos outros épicos.
- Parked: a busca local RF-09 pertence ao epic-tema-acessibilidade e permanece opcional.

## Fechamento técnico — 2026-10-12

- A MAIN/orquestradora conclui este container pelo atendimento dos cinco critérios de Done when. As seis histórias têm estado formal `done` nos planos oficiais; o sweep 2.6 foi NO-OP técnico revisado, sem refactor artificial.
- Done when 1–2: seis categorias com 30 itens na primeira página e metadados normalizados; Top P2 preservou `page=2`, `limit=30` e o snapshot. Buffer/categoria/rolagem são preservados ao carregar mais e retornar do detalhe. Uso real compilado e Compose está em `verification/final-platform-qa.U5JP6P/main-local-validation.json` e `main-compose-validation.json` no mesmo diretório; browser consome somente BFF/assets da própria origem.
- Done when 3 e 5: testes/fixtures e smokes prévios de paginação comprovam carregamento, erro com nova tentativa, vazio, frescor/stale, retenção e recuperação de snapshot substituído. Retentativa incremental mantém a tupla e o buffer; só `hasMore === false` confirma fim. Chaves/TTL e escrita de cache pertencem à camada de aplicação, preservando AD-4.
- Done when 4/O-01: 180 amostras HTTP sequenciais locais com cache quente, 30 por categoria, corpo/JSON completos, todas fresh e não vazias; p95 agregado **1,269708 ms**, abaixo de 1 s, e p95 de cada categoria também abaixo do limite. Medição registrada no resumo local final; não mede upstream frio, interatividade do browser, carga concorrente nem SLA de produção.
- Verificação consolidada: Root final 121 testes/20 arquivos, build dos três workspaces e 56 E2E, com produção/testes inalterados na reconciliação documental. Artefatos versionados em `0598a96`/`d242943`; RF-09 não implementado permanece fora do aceite obrigatório deste épico.
