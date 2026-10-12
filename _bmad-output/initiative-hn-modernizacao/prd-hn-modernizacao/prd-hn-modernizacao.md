---
title: "PRD: Modernização da interface do Hacker News (MVP)"
status: final
created: 2026-10-09
updated: 2026-10-12
---

# PRD: Modernização da interface do Hacker News (MVP)

> Escrito para: time de engenharia e produto que vai desenhar, planejar e construir o MVP.
> Marcações: `[ASSUNÇÃO]` = inferido, a validar. Decisões de tecnologia estão em `addendum.md` (com glossário de siglas).
> Origem: `brief-hn-modernizacao.md`.
> **Pendências não bloqueantes:** tamanho máximo da lista de IDs e existência de limite de taxa na API do HN, ambos a verificar antes do plano técnico.

## 1. Visão e problema

O Hacker News (news.ycombinator.com) é um agregador de notícias técnicas com interface de layout em tabela, pouca hierarquia visual e pouca adaptação a telas pequenas. O conteúdo e a comunidade são valiosos; a apresentação é o gargalo.

O produto é uma interface moderna para o HN, construída sobre a API oficial e pública. Tem duas finalidades:

1. **Leitura melhor:** listas e comentários legíveis, mobile first, com tema claro e escuro e árvore de comentários navegável.
2. **Caso didático:** demonstrar como conduzir um projeto novo, do início ao MVP, com IA em cada etapa do ciclo de desenvolvimento de software (SDLC).

## 2. Objetivos e critérios de sucesso

| ID | Objetivo | Métrica | Meta MVP |
|---|---|---|---|
| O-01 | Listagem rápida | p95 da primeira página de `/api/stories` | < 1 s em condições normais, com cache quente |
| O-02 | Comentários sem requisições repetidas | Chamadas à API do HN por visualização, com cache quente | Zero chamadas repetidas para itens em cache dentro do TTL |
| O-03 | Acessibilidade | Verificações automatizadas e avaliação manual de acessibilidade nas telas principais | Sem violações críticas ou sérias conhecidas; avaliação manual/AT acompanhada separadamente. Automação não comprova conformidade WCAG completa. |
| O-04 | Qualidade | Testes locais das regras de negócio e do back-end | Testes unitários das regras de negócio e ao menos 1 teste de integração executados localmente; não pressupõe gate de CI |
| O-05 | Caso didático | Artefatos de cada fase do SDLC produzidos, revisados e publicados com o processo documentado | Todas as fases com artefato versionado no repositório, e processo descrito no README |

**Acompanhamento** (sem telemetria de usuário no MVP): taxa de acerto do cache por endpoint, chamadas à API oficial por minuto, latência p50 e p95 dos dois endpoints principais e taxa de erro da API oficial.

**Contramétrica:** frescor dos dados. Um cache mais agressivo melhora O-01 e O-02, mas reduz o frescor de pontuação e de número de comentários. Essa perda deve ser exibida na interface (RF-11).

**Prioridade em conflito:** desempenho vence frescor dos dados. Quando os dois conflitarem, a interface mostra o que está em cache, com a indicação "atualizado em" (RF-11).

## 3. Usuários

- **Leitor frequente** `[ASSUNÇÃO]`: lê o HN diariamente, usa principalmente o celular, quer escanear títulos e abrir comentários sem perder a posição na lista.
- **Leitor ocasional de Ask e Show** `[ASSUNÇÃO]`: chega por perguntas e projetos, quer ler comentários em profundidade.
- **Estudante de engenharia** `[ASSUNÇÃO]` (público didático): quer entender a arquitetura e o processo de uso de IA no ciclo de desenvolvimento. Não usa a interface para ler notícias, mas consome os artefatos.

As três personas são suposições do brief, ainda não validadas com leitores reais. Se o projeto for usado por mais pessoas além do autor, convém validá-las com pelo menos duas entrevistas.

### Cenário principal

Ana, leitora frequente, abre a interface no celular no caminho para o trabalho. Vê a categoria *top*, escaneia os títulos, troca para *new* sem perder o contexto, abre uma história com 200 comentários, recolhe as respostas de um tópico que não interessa e volta à lista na mesma posição.

## 4. Escopo

**Incluído no MVP**

- Listagem por categoria: top, new, best, ask, show, job.
- Paginação ou carregamento incremental, com número de itens por página configurável.
- Detalhe da história com comentários em árvore, com recolher e expandir.
- Metadados: pontuação, autor, tempo relativo, número de comentários e domínio do link.
- Tema claro e escuro, e layout responsivo mobile first.
- Estados de carregamento, erro e vazio.
- Back-end com agregação sobre a API oficial e cache em memória com TTL.
- Configuração por variáveis de ambiente e README de execução local.

**Nice to have**

- RF-09: busca local simples sobre os itens já carregados, opcional e parked; não integra o corte atual nem bloqueia o MVP.

**Fora do MVP**

- Substituir o HN, criar uma comunidade paralela ou alterar o conteúdo original.
- Autenticação e contas de usuário.
- Votação, comentários e submissão de histórias.
- Banco de dados de produção (o cache é apenas em memória).
- SSR avançado.
- Internacionalização. A interface é em português (PT-BR).
- Versão em inglês da interface.

**Após o MVP**

- Persistência em banco para histórico e métricas.
- Busca no servidor com índice próprio.
- Atualização em tempo real via `/v0/updates.json` ou polling configurável.
- SSR ou pré-renderização para SEO.

## 5. Funcionalidades

### 5.1 Navegação e listagem

- **RF-01** O sistema lista itens por categoria (top, new, best, ask, show, job) a partir dos endpoints de lista da API oficial. O contrato de listagem é `ListingItem = Story | Job`, discriminado por `type`; um job permanece `Job`, não é convertido em história.
- **RF-02** O sistema pagina a listagem, retornando até N itens por página. N é configurável, com padrão 30 `[ASSUNÇÃO]`.
- **RF-03** Cada item de listagem exibe os metadados disponíveis: título, pontuação, autor, tempo relativo, número de comentários e domínio do link. `url`, `domain`, `author`, `score` e `createdAt` podem ser `null` quando ausentes ou não aplicáveis; o domínio deriva de `url`.
- **RF-12** A paginação ou o carregamento incremental não faz a posição de rolagem voltar ao topo. Ao carregar mais, os itens novos são anexados ao fim.
- **RF-13** Uma categoria sem itens mostra estado vazio com mensagem clara.

*Histórias de usuário relacionadas:* US-01 (navegação e estado vazio), US-02 (carregar mais e recuperação de erro).

### 5.2 Detalhe e comentários

- **RF-04** Ao abrir uma história, o sistema monta a árvore de comentários a partir dos `kids` do item. Cada comentário mostra autor e tempo relativo.
- **RF-05** Cada nó da árvore pode ser recolhido e expandido. Recolher um nó oculta as suas respostas.
- **RF-06** Comentários `deleted` aparecem como "[removido]" e `dead` como "[morto]", sem interromper a hierarquia. O autor conhecido é preservado; os marcadores são neutros e não atribuem ao autor a ação de remover nem o estado `dead`.

*Histórias de usuário relacionadas:* US-03.

### 5.3 Experiência

- **RF-07** O sistema alterna entre tema claro e escuro. Ao abrir pela primeira vez, segue a preferência do sistema operacional. A escolha manual é mantida enquanto a aba do navegador estiver aberta `[ASSUNÇÃO: "sessão do navegador" lido como a aba]`.
- **RF-08** Listagem e detalhe exibem estados de carregamento, erro (com opção de tentar de novo) e vazio. Erro na página seguinte mantém os itens já exibidos visíveis.
- **RF-11** A interface informa quando os dados foram obtidos ("atualizado em"), para deixar explícito que podem estar levemente desatualizados.
- Carregamento é anunciado a leitores de tela (`aria-busy` e texto acessível).

*Histórias de usuário relacionadas:* US-04, US-05, US-06.

### 5.4 Busca local (opcional, parked)

- **RF-09** (opcional, parked; fora do corte atual) O usuário poderá filtrar, por título, os itens já carregados. O filtro não fará nova chamada à API. Este requisito não bloqueia o MVP.

## 6. Requisitos não funcionais

### 6.1 Desempenho e cache

- **RNF-01** A primeira página de listagem responde em menos de 1 s (p95), com cache quente, em condições normais `[ASSUNÇÃO: condições normais = rede doméstica e API do HN respondendo sem erro]`.
- **RNF-02** Itens já consultados são servidos do cache em memória dentro do TTL configurado, sem nova chamada à API oficial.
- **RNF-03** A montagem da árvore de comentários não faz uma requisição por comentário sem controle. As buscas são feitas em lote, com concorrência limitada e configurável, e reaproveitam o cache.

### 6.2 Acessibilidade

- **RNF-04** Meta de acessibilidade alinhada à WCAG 2.1 AA: contraste mínimo de 4.5:1 para texto normal nos dois temas, navegação completa por teclado, rótulos acessíveis em controles e foco visível. A verificação automatizada é evidência técnica parcial; não demonstra, isoladamente, conformidade WCAG.
- **RNF-09** Layout responsivo sem rolagem horizontal a partir de 320 px. Alvos de toque com pelo menos 44 px.

### 6.3 Qualidade e segurança

- **RNF-05** Código tipado em modo estrito nos dois lados.
- **RNF-06** Testes unitários nas regras de negócio (normalização, montagem da árvore, tempo relativo, extração de domínio) e pelo menos um teste de integração do back-end, contra a API do HN ou contra um simulador dela.
- **RNF-10** O HTML dos comentários é sanitizado no back-end com uma lista de tags permitidas, antes de chegar ao navegador.

### 6.4 Operação

- **RNF-07** Configuração por variáveis de ambiente, sem valores sensíveis no repositório.
- **RNF-08** README com execução local e via Docker Compose, testada em ambiente limpo.

## 7. Interface de dados do back-end

Base `/api`, respostas em JSON, erros no formato `{ "error": { "code", "message" } }`.

| Método | Caminho | Descrição |
|---|---|---|
| GET | `/api/stories` | Lista `Story | Job` por categoria. Parâmetros: `category` (padrão top), `page` (padrão 1), `limit` (1–50, padrão 30), `snapshot` (obrigatório após a primeira página) |
| GET | `/api/items/{id}` | Detalhe de um item (história, comentário ou job) |
| GET | `/api/items/{id}/comments` | Árvore de comentários. `depth` (padrão 8; máximo configurável) |
| GET | `/api/health` | Status do serviço e do cache |

Em `StoriesPage`, `items` contém `ListingItem = Story | Job`; `hasMore` é opcional e sua ausência significa desconhecido, não fim. O servidor determina se há próxima página usando os IDs da categoria antes de filtrar itens ausentes ou não exibíveis; o cliente não infere o fim por `items.length`. `snapshot` identifica a versão/timestamp da lista de IDs mantida no cache e é distinto de `cachedAt`, que agrega o horário dos itens da página e pode ser anterior. A lista vencida pode continuar paginável enquanto esse snapshot estiver retido. Snapshot indisponível/expirado retorna `410 SNAPSHOT_EXPIRED`; a recuperação reinicia na página 1, sem reutilizar o token antigo.

- **RF-10** O back-end expõe dados normalizados e não repassa o formato bruto da API. Campos ausentes (`url`, `score`, `kids`) são tratados como ausência, não como erro.

Cada item de listagem (`Story` ou `Job`) inclui `id`, `type`, `title`, `url`, `domain`, `author`, `score`, `commentCount`, `createdAt` e `cachedAt`; metadados ausentes ou não aplicáveis são `null` conforme o contrato compartilhado. Cada nó de comentário inclui `id`, `author`, `text` (HTML sanitizado), `createdAt`, `status` (`ok`, `deleted` ou `dead`) e `children`. `children: null` significa que há ramo não buscado por corte de profundidade/orçamento, e `[]` significa folha; `truncated` indica corte pelo orçamento de nós, não apenas o limite de profundidade. A profundidade padrão é 8. Comentários `deleted`/`dead` preservam autor conhecido, sem atribuir-lhe a remoção ou o estado.

## 8. Restrições e premissas

**Restrições da API do HN**

- Pública, sem autenticação, somente leitura.
- Sem SLA publicado. Timeouts, retentativas limitadas e degradação para cache vencido com aviso são obrigatórios.
- Listas retornam apenas IDs. Cada item exige uma requisição própria. O tamanho máximo das listas é `[ASSUNÇÃO: cerca de 500; verificar]`.
- Não há limite de taxa documentado `[ASSUNÇÃO: tratar como risco; confirmar antes de implementar]`.
- Os dados mudam continuamente. Aceitar dados levemente desatualizados é parte do contrato (RF-11).

**Premissas**

- A API oficial segue disponível, com o formato atual, durante o desenvolvimento.
- Uso pessoal e didático, sem tráfego de produção significativo. Por isso, cache em memória de instância única basta.
- Não há exigência legal ou de marca para exibir o conteúdo com layout diferente, desde que a origem e os links para o HN sejam mantidos.

## 9. Critérios de aceite do MVP

- [ ] Todas as categorias listam itens com os metadados de RF-03.
- [ ] Carregar mais não perde a posição de rolagem.
- [ ] A árvore de comentários abre, recolhe e expande em uma história com pelo menos 200 comentários.
- [ ] Estados de carregamento, erro (com nova tentativa) e vazio aparecem nas telas principais.
- [ ] Tema claro e escuro com meta de contraste de 4.5:1 para texto normal; verificações incompletas devem ser revistas e resultados registrados.
- [ ] Avaliação manual de acessibilidade, incluindo teclado e tecnologia assistiva/leitor de tela; resultados automatizados não equivalem à comprovação de conformidade WCAG completa.
- [ ] Sem rolagem horizontal em 320 px e 375 px.
- [ ] Primeira página em menos de 1 s (p95), em teste de carga leve, com cache quente.
- [ ] Testes unitários das regras de negócio e ao menos um teste de integração executados e passando localmente; não implica gate de CI.
- [ ] README com execução local e via Docker Compose testada em ambiente limpo.
- [ ] Artefatos de todas as fases do SDLC versionados no repositório, e o processo documentado no README.

## 10. Decisões tomadas

- **Idioma:** português (PT-BR), seção 4.
- **Caso didático:** o MVP só está pronto com o processo documentado (O-05).
- **Prioridade:** desempenho vence frescor dos dados (seção 2, RF-11).
