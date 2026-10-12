---
tracker_id: ""
key: ""
type: epic
title: "História e árvore de comentários"
parent: initiative-hn-modernizacao
covers: [RF-04, RF-05, RF-06, RF-08, RF-11, RNF-03, RNF-10]
after: ["2.1", "2.5"]
assignee: ""
risk: high
---

# História e árvore de comentários

## Description

A partir da listagem, o leitor abre uma história e lê os comentários em árvore, recolhe e expande ramos, e vê comentários removidos ou marcados como mortos sem perder o contexto. O servidor busca os comentários em lotes com concorrência limitada e sanitiza o HTML no domínio, antes de chegar ao cliente.

## Outcome

Leitores leem a árvore carregada de uma história com 200 ou mais comentários, dentro dos limites de profundidade/orçamento e com continuação não carregada indicada, sem chamadas repetidas à API do HN dentro do TTL e sem HTML ativo não confiável na página.

## Requirements

- RF-04: árvore de comentários a partir de `kids` — PRD seção 5.2
- RF-05: recolher e expandir nós — PRD seção 5.2
- RF-06: `[removido]` e `[morto]` para comentários apagados ou mortos — PRD seção 5.2
- RF-08 (parte do detalhe): estados de carregamento, erro com nova tentativa e vazio na página de história — PRD seção 5.3; a parte da listagem fica com epic-listagem
- RF-11 (parte do detalhe): `cachedAt` e aviso stale na história/comentários; o indicador da lista permanece com epic-listagem — PRD seção 5.3
- RNF-03: buscas em lote com concorrência limitada — PRD seção 6.1
- RNF-10: sanitização do HTML no servidor — PRD seção 6.3

## Done when

1. Uma história com pelo menos 200 comentários abre; cada nó mostra autor e tempo relativo, e os ramos recolhem/expandem (PRD seção 9; EXPERIENCE).
2. Comentários removidos e mortos aparecem com `[removido]`/`[morto]`, preservando autor/tempo conhecidos e respostas/hierarquia, sem atribuir remoção ao autor. O corpo original desses comentários é suprimido, conforme o contrato reconciliado.
3. Dentro do TTL, visualizar a mesma história não faz nova chamada à API do HN para os itens em cache (O-02).
4. HTML dos comentários é sanitizado no domínio antes do cache, e só `client/src/components/SafeHtml` renderiza HTML (AD-4/AD-6).
5. A árvore indica continuação não carregada para `children: null` por corte de profundidade/orçamento; `children: []` indica folha confirmada. `truncated: true` indica omissão pelo orçamento de nós, não corte somente por profundidade (AD-3 e contrato reconciliado).
6. O detalhe mostra carregamento, erro com nova tentativa e estado sem comentários (RF-08).
7. O detalhe mostra `cachedAt` e o aviso de conteúdo stale de `ItemResponse`/`CommentsResponse` quando a API está fora, conforme os envelopes AD-3 (RF-11).

## Boundaries

O conteúdo da página de história, a árvore, a travessia, a frescura do detalhe e a sanitização. O epic-listagem é dono do roteamento SPA, link para `/item/{id}` e retorno à lista; este épico consome essa superfície depois de 2.5. Não inclui listagem, adapter, cache ou tema. A travessia vive em `app/comments`, não no adapter (AD-5).

## References

- prd — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/prd-hn-modernizacao.md, seções 5.2, 5.3, 6.1, 6.3, 7, 8 e 9
- addendum — _bmad-output/initiative-hn-modernizacao/prd-hn-modernizacao/addendum.md, seções B e C (limites de busca e risco de XSS)
- architecture — _bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8 e AD-10
- listing — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md, ownership do roteamento/contrato/cache e handoffs 2.1/2.5
- experience — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/EXPERIENCE.md, detalhe, comentários e estados
- design — _bmad-output/initiative-hn-modernizacao/ux-hn-modernizacao/DESIGN.md, tipografia, linha-guia e padrões de detalhe
- api — https://github.com/HackerNews/API, obtenção de itens e campos públicos
- brief — _bmad-output/initiative-hn-modernizacao/brief-hn-modernizacao/brief-hn-modernizacao.md, US-03 e US-04 (origem; decisões posteriores prevalecem)

## Notes

- Decision: entrega do MVP é local e por Docker Compose; hospedagem em produção fica para depois do MVP (user's decision, 2026-10-09; architecture, seção Adiado).
- Decision: usar os marcadores neutros "[removido]" e "[morto]", sem atribuir a remoção ao autor; o texto de EXPERIENCE fica como conflito corrigido pela decisão posterior (user direction, 2026-10-11).
- Source conflict: EXPERIENCE diz "Comentário removido pelo autor", o que pode não ser verdade; o marcador decidido é "[removido]"/"[morto]".
- Source conflict: PRD seção 7 não tem `truncated` e define `children` sempre presente; AD-3 adiciona `truncated` e `children` nulo.
- Decision: prevalece o contrato AD-3: `children` é nulo quando o limite de profundidade corta a busca e `truncated` indica limite de nós (user direction, 2026-10-11).
- Assumption: `sanitize-html` com allowlist e parsing sem DOM; validar compatibilidade no servidor e nunca enviar HTML ativo ao cliente.
- Decision: sanitização ocorre no domínio antes de `cache.set`; só `SafeHtml` renderiza o HTML sanitizado no cliente, conforme AD-4/AD-6.
- Decision: estado de recolhimento vive em memória/contexto da aba, permanece durante navegação dentro da SPA e não é persistido em `sessionStorage`; reload completo restaura a árvore aberta, conforme EXPERIENCE seção 63.
- Handoff: epic-listagem é dono do contrato compartilhado AD-3, `fetchItem` normalizado/cache de item (2.1) e roteamento SPA/link/retorno da história (2.5); o tracer deste épico espera ambas as entradas.
- Assumption: profundidade padrão 8, máxima 20, limite de 500 nós, concorrência 8, timeout 5 s e uma retentativa limitada; confirmar por testes sem sobrepor a configuração validada do epic-listagem.
- Tracer: entrada 1 conecta contrato existente, busca de item, detalhe e comentários iniciais.
- Sequencing: entrada 2 completa a travessia e sanitização no servidor; a entrada 3 consome esse resultado no cliente; Refactor sweep (4) fecha o épico antes de 4.1.
- Sweep bounds: a entrada 4 fica restrita ao detalhe/comentários/travessia/SafeHtml; não altera lista, roteamento, adapter, cache, tema ou contratos compartilhados, evitando colisão com o tema transversal.
