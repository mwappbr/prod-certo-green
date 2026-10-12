---
title: 'Dockerfile e Compose com um serviço'
type: 'feature'
ticket: '6'
created: '2026-10-11'
status: done
baseline_revision: 'bfc7e81a60e9f343d4b039c5905b8a123f752082'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** O projeto ainda não pode ser empacotado e iniciado de forma reproduzível como uma aplicação única; API e SPA precisam ser construídas e servidas juntas em um ambiente limpo.

**Approach:** Adicionar uma imagem multi-stage baseada em Node 24 que constrói `shared`, `server` e `client`, mantendo no runtime as dependências de produção e os três diretórios compilados. Um único serviço Compose expõe a aplicação na porta interna 3000, verifica `/api/health` e permite escolher somente a porta do host; o `.dockerignore` exclui dependências, artefatos e arquivos locais sensíveis do contexto.

</intent-contract>

## Implementation Notes

Oneshot: a mudança é localizada em três arquivos de empacotamento e fica abaixo de 100 linhas de código; o risco permanece `medium`, conforme o ticket. O build usa o contexto local do repositório; preservar as alterações preexistentes e não tocar manifests, lockfiles ou harness. Manter `PORT=3000`, `EXPOSE 3000`, healthcheck em `127.0.0.1:3000` e o destino interno do mapeamento de portas coerentes. A árvore permanece sem commit, push, stash, reset ou clean.

Implementação (2026-10-11): adicionados `Dockerfile`, `docker-compose.yml` e `.dockerignore`. O Dockerfile usa Node 24 Debian slim em duas etapas, compila os três workspaces, instala dependências de produção no runtime e mantém juntos `server/dist` e `client/dist` para o caminho estático esperado pelo Fastify. O Compose executa um único serviço, fixa `PORT=3000` e permite alterar apenas a porta do host via `HOST_PORT`; healthcheck, `EXPOSE` e destino interno permanecem em 3000. O `.dockerignore` exclui artefatos gerados, diretórios de desenvolvimento e arquivos `.env` locais.

Verificação (2026-10-11): `docker compose config --quiet` passou. O Buildx ativo era o builder local Rancher Desktop (`linux/arm64`), sem contexto ou builder remoto. Após um timeout inicial transitório ao buscar metadados do Docker Hub, um `docker pull node:24-bookworm-slim` local passou; `docker compose -p prod-certo-green-1-6 up --build --detach` compilou os três workspaces e iniciou o único serviço. `docker exec ... node --version` retornou `v24.21.0`; o container ficou `healthy`; `/api/health` respondeu HTTP 200 com `{"status":"ok","cache":{"entries":0}}`; `/` retornou HTTP 200 e o HTML da SPA `HN Modernização`; os assets JS (190283 bytes) e CSS (621 bytes) retornaram HTTP 200. A configuração com `HOST_PORT=3333` confirmou publicação 3333→3000, mantendo `PORT`, `EXPOSE` e healthcheck em 3000. O projeto de verificação foi removido com `docker compose down --remove-orphans`, e o Rancher Desktop que havia sido iniciado para o teste foi desligado. `npm ci` reportou zero vulnerabilidades; a instalação de desenvolvimento emitiu aviso de script não aprovado para `unrs-resolver@1.12.2`, sem impedir o build; nenhuma configuração foi alterada.

## Verification

**Commands:**
- `docker compose config` -- esperado: um serviço, contexto de build do repositório, porta interna 3000 e healthcheck `/api/health`.
- `docker compose -p prod-certo-green-1-6 up --build --detach` -- esperado: build local com Node 24 e serviço iniciado.
- `docker compose -p prod-certo-green-1-6 ps` -- esperado: serviço healthy.
- `curl -fsS http://127.0.0.1:3000/api/health` -- esperado: HTTP 200 e JSON de saúde.
- `curl -fsS http://127.0.0.1:3000/` -- esperado: HTML da SPA real.
- `docker compose -p prod-certo-green-1-6 down --remove-orphans` -- esperado: serviço de verificação removido sem alterar volumes ou outros projetos.

## Review Triage Log

### 2026-10-11 — Review pass
- verdicts: 2 findings — high 0, medium 1, low 0, false 1, maybe-false 0
- findings:
  - `[false]` `reject` O diff de baseline inclui alterações de tickets anteriores — O snapshot inicial do working tree já listava os manifests, arquivos do servidor e diretórios do harness antes do ticket 1.6; esta implementação adicionou somente `Dockerfile`, `docker-compose.yml`, `.dockerignore` e este plano. O índice permaneceu inalterado e nenhum commit foi feito, conforme a instrução de preservar o estado existente, portanto essas alterações preexistentes não foram incluídas nem enviadas por este ticket.
  - `[medium]` `patch` Arquivos de ambiente aninhados eram incluídos no build da SPA — As regras originais `.env` e `.env.*` não filtravam `client/.env.production.local`; `Dockerfile` copia `client/` e executa Vite, que pode embutir variáveis `VITE_*` no bundle. Adicionadas as regras recursivas `**/.env` e `**/.env.*`; o teste em contexto temporário confirmou exclusão de sentinelas falsos em caminhos raiz e `client/` e preservou o `.env.example` da raiz.

## Auto Run Result

- Summary: adicionada imagem multi-stage Node 24 e um serviço Compose para construir e servir a API e a SPA em conjunto, com healthcheck, porta consistente e exclusão recursiva de arquivos locais `.env*`.
- Files changed: `Dockerfile` — build dos três workspaces e runtime Node 24 com dependências de produção; `docker-compose.yml` — serviço único, healthcheck e mapeamento 3000; `.dockerignore` — exclusões recursivas de arquivos de ambiente; este plano — decisões e evidências.
- Review findings: patches applied 1 medium; deferred 0; rejected 1 finding (`false`), pois o diff de baseline incorporava arquivos já alterados antes do ticket, mas nenhum deles foi editado, staged ou committed por este trabalho.
- Follow-up review recommendation: false. Patched counts: high 0, medium 1, low 0.
- Verification: antes do patch de ignore, o build local pelo builder Rancher Desktop (`linux/arm64`) passou com Node `v24.21.0`; `npm run build` compilou `shared`, `server` e `client`; o container único ficou healthy; `/api/health`, `/`, JS e CSS responderam HTTP 200; `HOST_PORT=3333` foi validado como 3333→3000. Após o patch, um build BuildKit isolado com sentinelas falsos confirmou que `.env.local` da raiz e `.env`, `.env.production.local` e `.env.example` de `client/` ficam fora do contexto, enquanto o `.env.example` da raiz continua incluído; `docker compose config --quiet` e `git diff --check` passaram. O container e o runtime iniciados para a verificação foram encerrados. O primeiro acesso aos metadados do Docker Hub expirou, mas uma tentativa local limitada de `docker pull node:24-bookworm-slim` passou e o build seguinte foi bem-sucedido.
- Residual risks: repetir o build Compose do MVP completo após a integração dos tickets 2, 3 e 4, conforme coordenação; não foi executado full build durante a edição parcial do consumidor 2.1. O `npm ci` do estágio de build avisou que o script de instalação de `unrs-resolver@1.12.2` não estava aprovado; o build passou sem alterar configurações.
