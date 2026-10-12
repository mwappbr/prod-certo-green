---
title: 'Tracer: serviço com /api/health e SPA vazia'
type: 'feature'
ticket: '1'
created: '2026-10-09'
status: done
baseline_revision: '5b69ef873024aef48ce76e676744e40379d807eb'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['_bmad-output/initiative-hn-modernizacao/architecture-hn-modernizacao/architecture-hn-modernizacao.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório só tem README. Nenhuma camada existe, e os épicos seguintes não têm onde encaixar código nem um caminho ponta a ponta para validar.

**Approach:** Um único processo Fastify serve `/api/health` e o SPA compilado; o cliente é uma página vazia. Em desenvolvimento, o Vite na 5173 encaminha `/api` para a 3000. É a fatia mais fina que atravessa todas as camadas.

## Boundaries & Constraints

**Always:** TypeScript estrito em `shared/`, `server/` e `client/` (RNF-05). Layout-semente de `architecture-hn-modernizacao.md` (seção Seed estrutural), com `domain/`, `ports/`, `adapters/`, `app/`, `http/` e `config/` criados mesmo que alguns tenham um único arquivo. `Health` segue o contrato de AD-3: `{ status, cache: { entries } }`. A porta é 3000 e vem de uma constante em `server/src/config`, única fonte de configuração; a validação por variável de ambiente é a entrada 1.2. Gerenciador: npm com workspaces.

**Decisions (usuário, 2026-10-09):** trabalho na branch `feat/plataforma-1-1-tracer`, criada a partir de `main`. Build e testes rodam no Node 26.10.0 local, e não no Node 24 LTS que a arquitetura fixa; a diferença é registrada como `Decision:` no épico.

**Never:** Sem regra de lint (entrada 1.3), sem testes automatizados (entrada 1.5), sem Dockerfile (1.6), sem tokens de tema (1.4). Sem leitura de variável de ambiente. Nenhum HN, nenhum cache real além do contador de entradas, nenhum placeholder com "por enquanto".

</frozen-after-approval>

## Code Map

- `(raiz)` -- greenfield: só `README.md` existe. Criar `package.json` com workspaces `shared`, `server`, `client`; `tsconfig.base.json` estrito.
- `shared/contract/health.ts` -- tipo `Health` e envelope de erro; única fonte de tipos (AD-3). Criar.
- `server/src/http/routes/health.ts` -- rota `/api/health`, chama `getHealth`. Criar.
- `server/src/app/getHealth.ts` -- caso de uso; lê o cache pela porta. Criar.
- `server/src/ports/cache.ts` -- interface `Cache` com `size()`. Criar.
- `server/src/adapters/cache/memory-cache.ts` -- implementação em memória com `size()` retornando 0. Criar.
- `server/src/http/errors.ts` -- handler de 404 para `/api/*`, AD-7. Criar.
- `server/src/main.ts` -- Fastify, `@fastify/static` sobre `client/dist`, porta da config. Criar.
- `client/vite.config.ts` -- proxy de `/api` para 3000. Criar.
- `client/src/App.tsx`, `client/index.html` -- página vazia. Criar.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `tsconfig.base.json` -- workspaces e scripts `dev`, `build`, `start`, `typecheck` -- nomes fixados aqui para a entrada 1.5 e o README
- [ ] `shared/contract/health.ts` -- tipo `Health` -- contrato único
- [ ] `server/src/ports/cache.ts`, `server/src/adapters/cache/memory-cache.ts` -- porta e adaptador mínimo -- AD-4 com um escritor
- [ ] `server/src/app/getHealth.ts`, `server/src/http/routes/health.ts`, `server/src/http/errors.ts` -- caso de uso, rota e 404 -- AD-1, AD-7
- [ ] `server/src/main.ts`, `server/src/config/index.ts` -- servidor, SPA estática, porta constante -- AD-9
- [ ] `client/vite.config.ts`, `client/index.html`, `client/src/App.tsx` -- proxy e página vazia

**Acceptance Criteria:**
- Given o repositório recém-clonado, when `npm install` e `npm run build` rodam, then `client/dist/index.html` existe e não há erro de tipo.
- Given `npm run dev`, when a página é aberta em `localhost:5173`, then ela renderiza sem erro e `localhost:5173/api/health` responde 200.
- Given `npm run build` e `npm start`, when GET `localhost:3000/api/health`, then 200 com `{ status: "ok", cache: { entries: 0 } }`.
- Given `npm start`, when GET `localhost:3000/`, then o SPA compilado é servido.

## Implementation Notes

Matriz de I/O removida do bloco congelado por decisão do usuário (2026-10-09): a entrada 1.1 não tem testes automatizados; a verificação é por comando e critérios de aceite.

**Implementado (2026-10-09, branch `feat/plataforma-1-1-tracer`, sem commit):**
- Raiz: `package.json` (workspaces `shared`, `server`, `client`; scripts `dev`, `typecheck`, `build`, `start`), `tsconfig.base.json` (strict), `.gitignore` (node_modules, dist, tsbuildinfo; arquivo novo, não estava no plano).
- `shared/`: `package.json` com `exports` `./contract/*` apontando para `dist/`, `tsconfig.json`, `contract/health.ts` com `Health`, `ApiErrorCode` e `ApiErrorBody`. O envelope de erro ficou no mesmo arquivo, como o Code Map indica.
- `server/`: `config/index.ts` (PORT = 3000), `ports/cache.ts`, `adapters/cache/memory-cache.ts`, `app/getHealth.ts`, `http/routes/health.ts`, `http/errors.ts`, `main.ts`.
- `client/`: `vite.config.ts` (porta 5173, proxy `/api` para `http://localhost:3000`), `index.html`, `src/App.tsx`, `src/main.tsx` (entrada necessária ao React; não estava no plano).
- Decisões de implementação: a rota recebe `() => Health`, não a porta de cache, para `http/` não importar `ports/` (AD-1). A montagem do cache fica em `main.ts`. Em `errors.ts`, GET fora de `/api/` cai no `index.html` (fallback de SPA). Pacotes compartilhados são consumidos a partir de `shared/dist`, por isso `typecheck`, `build` e `dev` compilam `shared` antes.
- Versões: TypeScript 7.0.2, Vite 8.3.4, React `~19.2.8` (linha fixada pela arquitetura), Fastify 5.12.5, `@fastify/static` 10.1.5, `@types/node` 26.6.4. Node local 26.10.0 e npm 12.2.0, conforme a decisão do usuário.
- Não incluído, conforme "Never": lint (1.3), testes (1.5), Dockerfile (1.6), tokens de tema (1.4), leitura de variável de ambiente.

**Verificação (2026-10-09):**
- `npm install`: concluiu sem erro e sem vulnerabilidades.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, `client/dist/index.html` e `client/dist/assets/*.js` gerados.
- `npm start`: `GET localhost:3000/api/health` retornou 200 com `{"status":"ok","cache":{"entries":0}}`. `GET localhost:3000/` retornou 200 com o HTML da SPA. `GET /api/nope` retornou 404 com `ROUTE_NOT_FOUND`.
- `npm run dev`: a porta 5173 já estava ocupada por um Vite de outro projeto (pid 4387, fora deste repositório, não encerrado). O Vite deste repositório subiu em 5174. Pelo 5174, `GET /api/health` retornou 200 com o corpo esperado, o que comprova o proxy para a 3000.

**Pendências e riscos:**
- A verificação em 5173 ficou pendente: a porta está ocupada por outro processo. Para repetir, encerrar o Vite de outro projeto e rodar `npm run dev`.
- O check manual de console sem erro em `localhost:5173` não foi feito (sem navegador nesta sessão). A página é `null` e o HTML carrega sem erro no servidor.
- O script `dev` da raiz usa `&` em shell POSIX; não funciona no Windows sem ajuste.
- O servidor sobe em `0.0.0.0` com `logger: true` (saída padrão).

## Review Triage Log

Passagem 1 (quick). 10 achados: 5 `medium`/`low` corrigidos, 4 diferidos ou para decisão, 1 recusado.

| Achado | Veredicto | Rota | Evidência / ação |
|---|---|---|---|
| Código de erro 4xx sempre `BAD_REQUEST`; 404 devia ser `NOT_FOUND` | medium | patch | `errors.ts`: 404 agora `NOT_FOUND`; demais 4xx com mensagem fixa em PT-BR |
| Mensagem de erro 4xx vinha do Fastify em inglês | low | patch | mesma correção |
| DOM na lib do servidor (AD-6 pede domínio sem DOM) | low | patch | `server/tsconfig.json` com `lib: ["ES2023"]`; typecheck passa |
| Comentário "Placeholder" no adaptador de cache | low | patch | reescrito como cache mínimo |
| Título sem acento ("Modernizacao") | low | patch | corrigido em `client/index.html` |
| AC2 não confirmado na 5173 (porta ocupada) e console não verificado | high | defer (aceito pelo usuário) | pendente: liberar 5173 e rodar `npm run dev` quando possível |
| Alias `@shared/*` do AD-3 não implementado (imports via workspace) | medium | defer | entra com o primeiro consumo de `shared/` no cliente |
| `main.ts` importa o adaptador de cache (AD-1 literal) | medium | decidido | raiz de composição isenta da regra de AD-1 (decisão do usuário); o lint da entrada 1.3 precisa permiti-la |
| Porta 3000 duplicada em `client/vite.config.ts` | low | defer | entrada 1.2 (configuração) |
| Porta de cache reduzida a `size()` (AD-4 pede `get`/`set`) | low | defer | escopo do plano; registrar `Decision:` quando a porta crescer |
| `GET /` sem `client/dist` retorna 404 com `BAD_REQUEST` | low | rejeitado | não reproduzido; exigiria guarda extra; só ocorre sem build |

Patches aplicados diretamente pelo agente principal, não pelo subagente de implementação, por serem mecânicos e pequenos.

## Verification

**Commands:**
- `npm install` -- expected: sucesso, sem dependências fora das listadas
- `npm run typecheck` -- expected: sucesso
- `npm run build` -- expected: `client/dist/index.html` gerado
- `npm start` e `curl localhost:3000/api/health` -- expected: 200 com o corpo do AC 3

**Manual checks (if no CLI):**
- Abrir `localhost:5173` em `npm run dev` e confirmar página vazia sem erro no console
