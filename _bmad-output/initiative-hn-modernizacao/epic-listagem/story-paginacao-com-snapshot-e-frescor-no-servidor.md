---
id: 3
type: story
title: "Paginação com snapshot e frescor no servidor"
parent: epic-listagem
covers: [RF-02, RF-11, RNF-01, RNF-02]
after: [2]
hitl: false
risk: high
---

# Paginação com snapshot e frescor no servidor

## Description

Entrega páginas de até 50 histórias a partir de um snapshot estável, cache de listas com `cachedAt` e `stale`, retenção de vencidos e fallback para cache vencido quando a API falha; só `app/` chama a porta e escreve chaves/TTLs de cache, sem acesso pelo adapter.

## Acceptance Criteria

Verify: `npm run check` local com cliente HN determinístico e contador confirma snapshot idêntico entre páginas da mesma sequência, `SNAPSHOT_EXPIRED` no snapshot vencido, fallback `stale` quando a API falha, uma chamada HN para leituras repetidas da mesma lista dentro do TTL, e a regra AD-4 de que apenas `app/` lê/escreve a porta e centraliza chaves/TTLs; para RNF-01, aquecem-se as seis primeiras páginas da fixture e medem-se 30 requisições sequenciais por categoria ao endpoint Fastify `/api/stories` via `inject`, do início da chamada à resposta serializada, usando relógio monotônico; o p95 das 180 requisições deve ficar abaixo de 1 s.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-listagem/epic-listagem.md

## Notes

- Assumption: page size 30, máximo 50, TTL de lista 60 s, TTL de item 120 s e retenção de vencidos 15 min; validar os valores com a medição local sem contrariar a configuração validada da plataforma.
- Assumption: concorrência do adaptador 8, timeout 5 s e uma retentativa limitada; manter limites mesmo com a documentação atual do HN dizendo que não há limite de taxa.
- Risk check: uma pessoa repete a medição de p95 em processo local limpo após aquecer cada categoria e revisa o contador de chamadas HN, para detectar um resultado mascarado por cache ou fallback.

## Entrega e verificação

- **Entrega:** paginação de servidor mantém snapshot e frescor separados (`snapshot` não é `cachedAt`), retenção/fallback stale e cálculo aditivo de `hasMore` sobre os slots originais de IDs antes da normalização; itens `Job` são preservados no contrato `ListingItem`.
- **Paths:** `shared/contract/stories.ts`, `server/src/app/get-stories.ts`, `server/src/http/routes/stories.ts`, testes em `server/test/`.
- **Evidências:** testes focados, benchmark inicial de 180 respostas `inject`, smoke das seis categorias em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/live-categories-2-3-2-4-postfix.4MjGru/` e Root `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-2-3-2-4-testfollowups.D0z78X/`; QA final em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` confirmou seis categorias, página 2 com snapshot estável e 180 requisições HTTP warm, p95 de 1,269708 ms. Compose integrado também validou página 2/snapshot em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** p95 medido localmente no endpoint não mede interação no browser nem latência upstream do HN; preservar a semântica aditiva de `hasMore` sobre os slots originais de IDs.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha não altera status.
