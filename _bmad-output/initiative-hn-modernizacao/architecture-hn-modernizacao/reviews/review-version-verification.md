# Review: verificação de versões e starter (Pilha do spine)

Spine revisada: `architecture-hn-modernizacao.md` (seção "Pilha" e "Seed estrutural"). Não foi editada.
Data da verificação: 2026-10-09.

Método: consulta ao registro npm (`registry.npmjs.org/<pkg>/latest`) e ao índice jsDelivr (`data.jsdelivr.com/v1/packages/npm/<pkg>`, lista de versões), mais páginas oficiais (vite.dev, README do create-vite, endoflife.date/nodejs). Buscas na web usadas como apoio; onde as buscas divergiam, prevaleceu a leitura direta do registro.

## Veredito

A Pilha está parcialmente desatualizada: Vite, Fastify, TypeScript, Docker Compose e a linha do React estão atrás da versão corrente, e a seção afirma que as versões foram "verificadas na web" sem que isso valha para as linhas marcadas como não verificadas.

## Itens

| Item | Spine diz | Verificado | Status | Fonte |
| --- | --- | --- | --- | --- |
| Node.js | 24 LTS | Node 24 é LTS; Active LTS termina em 20/10/2026; EOL 30/04/2028. Node 26 é "Upcoming LTS", previsto para ~27/28/10/2026. | CONFIRMED (com prazo curto) | https://endoflife.date/nodejs ; https://nodejs.org/de/about/releases/ (busca) |
| React | 19.2.x (patch a fixar) | Maior 19.2.x é 19.2.8. Tag `latest` do npm é 19.3.0. | CONFIRMED para o patch 19.2.8; OUTDATED para a linha (19.3.0 é o latest) | https://registry.npmjs.org/react/latest ; https://data.jsdelivr.com/v1/packages/npm/react |
| Vite | 8.1.x | Maior 8.x é 8.3.4 (tag latest). Maior 8.1.x é 8.1.6. | OUTDATED (a linha 8.1 não é a corrente) | https://registry.npmjs.org/vite/latest ; https://data.jsdelivr.com/v1/packages/npm/vite |
| TypeScript | 5.x [ASSUNÇÃO] | Tag latest do npm é 7.0.2. | OUTDATED (major) | https://registry.npmjs.org/typescript/latest |
| Fastify | 5.8.x [ASSUNÇÃO] | Maior 5.x é 5.12.5 (tag latest). 5.8.5 existe, mas não é o último. | OUTDATED | https://registry.npmjs.org/fastify/latest ; https://data.jsdelivr.com/v1/packages/npm/fastify |
| Vitest | não verificado | Tag latest do npm é 5.0.3. | UNCONFIRMED na spine; valor atual encontrado (5.0.3) | https://registry.npmjs.org/vitest/latest |
| axe-core | não verificado | Tag latest do npm é 4.14.0. | CONFIRMED que existe; versão não fixada na spine | https://registry.npmjs.org/axe-core/latest |
| Docker Compose | v2 [ASSUNÇÃO] | Linha corrente é v5 (v5.5.1 reportado em set/2026, fonte secundária). | OUTDATED (fonte secundária; confirmar em github.com/docker/compose/releases) | https://www.ssdnodes.com/learn/is-docker-compose-deprecated ; busca de releases do docker/compose |
| create-vite, template `react-ts` | starter do front [ASSUNÇÃO: confirmar versão gerada] | Template `react-ts` existe no guia oficial e no README. O README chama os templates de "basic" (não "official"). Versão do pacote create-vite: 9.2.1 (tag latest). | CONFIRMED que o template existe; versão gerada UNCONFIRMED | https://vite.dev/guide/ ; https://github.com/vitejs/vite/tree/main/packages/create-vite ; https://registry.npmjs.org/create-vite/latest |

## Achados

1. **Vite 8.1.x está desatualizado (OUTDATED).** A seção diz "verificadas na web", mas a linha 8.1.x não é a corrente: o latest é 8.3.4. Trocar a linha por "8.3.x" ou pedir decisão explícita de ficar em 8.1.
2. **Fastify 5.8.x está desatualizado (OUTDATED).** Há 5.12.5 como latest. A marcação `[ASSUNÇÃO]` ainda vale e o memlog (entrada "version") menciona 5.11.x só como relato não confirmado; agora está confirmado que existe.
3. **React: o patch está desatualizado para a linha.** 19.2.8 é o maior 19.2.x (confirmado), mas o `latest` é 19.3.0. A spine deveria nomear 19.2.8 e registrar que a linha 19.2 foi escolhida de propósito, em vez de deixar "patch a fixar".
4. **TypeScript "5.x" está desatualizado (OUTDATED).** O latest é 7.0.2. Se 5.x for mantido, precisa estar escrito como decisão; senão atualizar a linha.
5. **Docker Compose "v2" está desatualizado (OUTDATED).** A linha corrente é v5. A evidência é uma fonte secundária; confirmar no repositório antes de travar.

Itens sem problema de versão: Node 24 LTS (confirmado, mas o Active LTS termina em 20/10/2026, ou seja, daqui a 11 dias; reavaliar com o memlog já previsto). create-vite `react-ts` continua existindo, mas não é "oficial" no sentido do README; a spine usa "starter", o que está correto.

## Recomendações

- Atualizar a tabela Pilha com versões exatas: Vite 8.3.4 (ou justificar 8.1.6), React 19.2.8 (ou justificar 19.3.0), Fastify 5.12.5 (ou justificar 5.8.5), TypeScript 7.0.2 ou 5.x com justificativa, Vitest 5.0.3, axe-core 4.14.0, Compose v5.
- Remover a frase "verificadas na web em 09/10/2026" das linhas que não foram verificadas, ou marcá-las com `[ASSUNÇÃO]`.
- Registrar no memlog a decisão sobre Node 24 vs 26 antes de 28/10/2026.
- Confirmar os números que vieram de fonte secundária (Compose v5.5.1) no repositório oficial.

## Limitações

- O registro npm foi lido via `WebFetch` (leitura de resposta de terceiros, não consulta direta por CLI). Os valores são consistentes entre o registro e o índice jsDelivr para Vite, React e Fastify.
- Não houve acesso ao GitHub Releases do Docker Compose nem à página de releases do Node.js; esses itens estão marcados como fonte secundária.
