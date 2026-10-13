# Revisão adversarial da spine — hn-modernizacao

Alvo: `architecture-hn-modernizacao.md` (AD-1 a AD-10). Insumos: PRD, addendum, `.memlog.md`.
Método: para cada par de unidades de um nível abaixo (módulos de `server/` e `client/`), procurar duas implementações que obedecem a cada AD ao pé da letra e ainda assim constroem de forma incompatível.

Veredito: a spine não está pronta para o gate. Há dez furos; cinco são de alta severidade (H1 a H5). Todos se fecham com ADs novos ou apertados, sem mudar a pilha.

---

## H1 (alta) — AD-1 se contradiz sobre quem importa Fastify

- **Texto de AD-1:** "Só `adapters/` importam o cliente HN, o cache ou o Fastify."
- **Mesmo AD-1 e seção Seed:** `http/` é "rotas Fastify" e o diagrama mostra `http --> app`, `http --> shared`, sem `http --> ports`.
- **Unidade A (`http/health`):** importa o adaptador de cache para ler estado (`/api/health` informa "o estado do cache"). Obedece ao texto "só adapters importam o cache"? Não. Obedece ao diagrama? Não, o diagrama não tem `http --> adapters`. Mas o próprio `http/` já importa Fastify, o que o texto proíbe.
- **Unidade B (`http/stories`):** importa `fastify` e segue o diagrama. Viola "só adapters importam Fastify".
- **Divergência:** uma rota de saúde lê o cache direto; outra fica limpa. Ou o time registra as rotas em `adapters/http-fastify/`, e então `http/` vira só mapeador de erro, o que a árvore de código não descreve.
- **Correção sugerida:** reescrever a regra de AD-1 como "`http/` é a única camada que importa Fastify; `adapters/` importa o cliente HN e o cache". Declarar que `http/` não importa `ports/` nem `adapters/`. O `/api/health` recebe o estado por um caso de uso em `app/` (ex.: `getHealth`).

## H2 (alta) — stale-on-error e dono da leitura de cache (AD-4, AD-5, AD-3, RF-11)

- **AD-4:** "toda leitura de dados do HN passa pela camada `app/`, que consulta a porta de cache antes do cliente HN."
- **AD-5:** "Quando o HN falha e há item em cache vencido, a resposta devolve o dado com `stale: true`." O sujeito é "a resposta", e o cliente em `adapters/hn/` é quem recebe a falha.
- **Unidade A (`adapters/hn`):** no erro, consulta o cache para achar o item vencido e devolve com `stale: true`. Cumpre AD-5. Viola AD-4, porque `adapters/hn` virou leitor de cache.
- **Unidade B (`app/`):** no erro do cliente, chama `cache.getExpired(key)` e devolve com `stale`. Cumpre AD-4 e AD-5.
- **Divergência:** a porta de cache não tem método de leitura de vencido. AD-4 só diz "TTL" e um cache com TTL normalmente descarta a entrada vencida no `get`. Então a unidade B não consegue implementar o que AD-5 pede sem mudar a porta, e a unidade A não cabe em AD-4.
- **Mesma falha, versão de contrato:** AD-3 lista só `Story`, `CommentNode`, `Category`, `ApiError` como tipos de resposta. Não há envelope para listas (`{ items, page, ... }`), para o detalhe, nem para o comentário. Onde ficam `stale` e `cachedAt` em `GET /api/stories`? Em cada item, no envelope ou não existe? Como o cache de lista guarda só IDs (`list:CATEGORIA`) e `cachedAt` está em `Story`, a listagem não tem fonte para o "atualizado em" de RF-11. Uma rota põe `stale` no envelope, outra no item.
- **Correção sugerida:** em AD-4, nomear a porta de cache com `get`, `getWithStaleness` (ou `peekExpired`) e `set`, e dizer que só `app/` a chama. Em AD-5, trocar "a resposta devolve" por "o caso de uso em `app/` devolve, quando o cliente falha e a porta retorna entrada vencida". Em AD-3, incluir os envelopes de resposta de lista, detalhe, comentários e saúde, com os campos `stale`, `cachedAt` e `truncated`.

## H3 (alta) — dois donos da travessia de comentários e dois escritores de `item:ID` (AD-4, AD-5, AD-2)

- **Capacidades (seção Mapa):** "RF-04 a RF-06 Árvore de comentários: `domain/` (árvore e status), `app/`, `client/`". **AD-5:** o cliente em `adapters/hn/` faz a "busca de comentários por nível, com limite de profundidade e de nós".
- **Unidade A (`adapters/hn/comment-walker`):** percorre a árvore nível a nível, conta profundidade a partir da história, e grava `item:ID` no cache porque ela já tem a porta. Cumpre AD-1, AD-4 (escreve pela porta, não pelo cliente) e AD-5.
- **Unidade B (`app/get-comments`):** chama `hn.fetchItem(id)` por nó, conta profundidade a partir do comentário raiz, e grava `item:ID` no caso de uso. Cumpre AD-1, AD-4 e AD-5.
- **Divergência:** as duas contam profundidade e nós de forma diferente, e gravam `item:ID` em lugares diferentes. Com `depth` de AD-9 e a história como nível zero, a árvore muda de tamanho conforme quem a monta. O TTL pode ficar desalinhado porque um escritor usa o TTL de item e o outro o de lista.
- **Truncamento não tem sinal:** quando o limite de nós ou de profundidade corta a árvore, a contrato (AD-3) não tem `truncated` nem `hasMore`. Um nó além da profundidade vira `children: []`, que é indistinguível de folha. O usuário não vê "mais respostas" (RF-05).
- **Correção sugerida:** em AD-5, dizer que a travessia é uma única função em `app/` que chama `fetchItem` (uma por nó, com unificação em voo) e que `adapters/hn` só expõe `fetchItem`. Em AD-4, nomear o único escritor de `item:ID` e `list:CATEGORIA` (o caso de uso em `app/`). Em AD-3, incluir `truncated` no envelope de comentários e definir que `children` além do limite é `null` e não `[]`.

## H4 (alta) — três formas de erro e nenhuma regra de cliente (AD-7, AD-8, AD-3)

- **AD-7:** "toda falha chega ao cliente como `{ error: { code, message } }`, produzida por um único mapeador em `http/`."
- **Unidade A (`http/errors`):** registra `setErrorHandler` no Fastify. Cumpre AD-7 para as rotas.
- **Unidade B (rotas inexistentes, JSON inválido, `415`, `429` de plugin):** o handler padrão do Fastify responde `{ statusCode, error, message }`. Não passa pelo mapeador. Cumpre AD-7 porque "toda falha" não é definido para erros anteriores à rota.
- **Cliente:** AD-8 expõe "erro" em cada hook, mas não diz o tipo. Falha de rede e timeout do navegador não têm `code` em `shared/contract` (AD-3 diz que os códigos são constantes, mas não lista quais nem quem adiciona). Um hook mostra `error.message` do corpo. Outro mostra texto por status HTTP. Os dois obedecem a AD-8.
- **Correção sugerida:** em AD-7, dizer que o mapeador é o `setErrorHandler` raiz e também o `setNotFoundHandler`, e que nenhum erro sai do Fastify sem passar por ele. Em AD-3, enumerar os códigos (incluindo `NETWORK_ERROR`, `TIMEOUT`, `NOT_FOUND`, `UPSTREAM_UNAVAILABLE`) e dizer que a lista só cresce por alteração de `shared/contract`. Em AD-8, definir que o hook devolve `ApiError` tipado, com um único tradutor de falha de rede para `ApiError`.

## H5 (alta) — estado de tela de RF-12 e cache do cliente sem dono (AD-8, AD-9, AD-4)

- **AD-8:** "Estado de tela, como tema e filtro, fica local ao componente ou em contexto próprio."
- **Unidade A (`features/listagem`):** guarda páginas carregadas em `useState` do componente. Cumpre AD-8. Ao abrir um item e voltar, o componente desmonta, a paginação volta ao início e a rolagem se perde. Viola RF-12, que está ligado a AD-8 na spine.
- **Unidade B (`features/listagem` com contexto):** guarda as páginas num contexto. Cumpre AD-8 e RF-12.
- **Cache do cliente:** a seção Adiado deixa "biblioteca de dados no front (cache de consultas)" para o plano técnico, "dentro da regra de AD-8". AD-4 só governa o cache do servidor. Uma biblioteca de consultas tem cache próprio com `staleTime` próprio, que é um segundo escritor, fora de AD-4 e sem TTL de configuração (AD-9).
- **Constantes do cliente:** AD-9 proíbe ler env fora de `server/src/config/`. O tamanho de página (RF-02, padrão 30) e o `depth` padrão de comentários (PRD seção 7) são usados no cliente. Um `features/` hardcoda 30 e outro lê `/api/config`. Ninguém disse qual.
- **Correção sugerida:** em AD-8, exigir que o estado de paginação e de rolagem da listagem viva em contexto ou em store acima das rotas. Proibir cache de consultas no cliente fora de `client/src/api/`, ou exigir que ele use o TTL de configuração entregue por `/api/config` ou por `/api/health`. Em AD-9, dizer como o cliente obtém tamanho de página e profundidade padrão.

---

## Furos de média severidade

### H6 — paginação sem snapshot (AD-4, RF-12)
- Página 1 lê `list:top` no instante t0. A entrada expira. A página 2 lê `list:top` no instante t1, com IDs novos e ordem diferente. A lista anexada (RF-12) duplica ou pula histórias. AD-4 não define que a paginação usa um snapshot de IDs.
- **Correção:** em AD-4, o cursor de paginação carrega o `cachedAt` ou um id de snapshot, e a página seguinte usa o mesmo snapshot enquanto ele não passa do TTL. Ou a listagem reconstrói a partir de um único `list:CATEGORIA` por sessão de navegação.

### H7 — tipagem de campos de texto e de link (AD-3, AD-6)
- AD-6 sanitiza só `CommentNode.text`. `Story.title`, `author`, `domain` e `url` não têm tipo declarado como texto simples ou HTML. O título do HN tem entidades (`&amp;`, `&#x27;`).
- **Unidade A (lista):** renderiza `title` como texto, e aparece `&amp;` na tela.
- **Unidade B (detalhe):** passa `title` pelo componente de AD-6, que decodifica e sanitiza. A mesma história aparece diferente em duas telas.
- **Link:** `Story.url` vira `href`. Nenhuma AD exige esquema `http(s)` na normalização. Um `javascript:` em `url` passaria pela AD-2 e chegaria ao `<a href>` sem bloqueio. AD-6 cobre HTML, não atributo de link.
- **Correção:** em AD-3, marcar cada campo de texto como `plain` ou `html`. Em AD-2, exigir que `url` seja validada para `http:` ou `https:` na normalização e que o campo vire `null` caso contrário. Em AD-6, dizer que `title` é `plain` e nunca passa pelo componente HTML.

### H8 — resolução do módulo `shared/contract` (AD-3, Seed)
- AD-3 diz "`server/` e `client/` importam dali", e a decisão do memlog diz "sem pacote compartilhado publicado". Não há mecanismo.
- **Unidade A (server):** `import ... from "../../shared/contract"`. Funciona no `tsc` local.
- **Unidade B (client):** alias `@shared` no Vite. Funciona no dev.
- **Divergência:** no build Docker de um serviço só (`docker-compose.yml`), o contexto de build pode não incluir `shared/`, ou o `rootDir` do `tsc` quebra. Uma das duas unidades cria uma cópia local do contrato para destravar o build. Viola AD-3 sem que nenhuma regra o proíba.
- **Correção:** em AD-3, nomear o mecanismo (ex.: `paths` do `tsconfig` com `@shared/*` nos dois lados, e o Dockerfile copiando `shared/`), e proibir cópias locais de tipos de resposta.

### H9 — validação de schema sem AD (R-03, AD-2)
- O addendum R-03 cita "validação de schema" como mitigação. AD-2 diz que campos ausentes viram `null` ou lista vazia, nunca erro.
- **Unidade A:** schema estrito (ex.: validador que rejeita campo ausente). Viola AD-2 ao falhar em `kids` ausente.
- **Unidade B:** parse permissivo sem validação. Deixa passar mudança de formato da API sem aviso, o que R-03 queria evitar.
- **Correção:** em AD-2, separar "validação de forma" (campo obrigatório, tipo) de "ausência" (campo opcional, vira `null`). Nomear o validador e o que acontece em erro de forma (log estruturado e `UPSTREAM_UNAVAILABLE`, sem vazar para a resposta).

### H10 — enforcement de AD-1 e a fronteira de domain (AD-1, AD-6)
- AD-1 diz "verificada por restrição de imports no lint". A pilha não cita ESLint nem regra alguma. Dois times passam no lint com configs diferentes.
- AD-6 põe a sanitização em `domain/`. Uma lib de sanitização baseada em DOM (ex.: DOMPurify com jsdom) cai na categoria de "biblioteca de I/O" de AD-1. Uma lib de parsing puro não cai. A escolha da lib decide se o domínio pode importá-la.
- **Correção:** na pilha, nomear o lint e o arquivo de regra. Em AD-6, exigir sanitizador sem DOM (parsing puro) e declarar isso como permitido em `domain/`.

---

## Itens que o gate deve exigir antes de fechar

1. Reescrever AD-1 sem a contradição sobre Fastify (H1).
2. Declarar o único dono de leitura e de escrita de cache e a porta com leitura de vencido (H2, H3, H6).
3. Completar AD-3 com envelopes, `truncated`, `stale`, `cachedAt`, lista de códigos e tipos plain/html (H2, H3, H4, H7).
4. Fechar a regra de erros do Fastify em AD-7 e o tipo de erro do cliente em AD-8 (H4).
5. Definir estado de paginação acima das rotas e fonte de constantes do cliente (H5).
6. Nomear o mecanismo de módulo compartilhado e o validador de schema (H8, H9).

Nenhum destes exige mudança de pilha. Todos são tightenings de AD-1, AD-2, AD-3, AD-4, AD-5, AD-7, AD-8 e AD-9, mais uma linha no lint (AD-1).
