---
name: HN Moderno
status: final
sources:
  - ../prd-hn-modernizacao/prd-hn-modernizacao.md
  - ../prd-hn-modernizacao/addendum.md
updated: 2026-10-12
---

# HN Moderno — Experience Spine

> Rascunho em modo rápido. Premissas marcadas com `[ASSUNÇÃO]` para validação. A identidade visual está em `DESIGN.md`, e os tokens são citados aqui por nome, no formato `{path.to.token}`. Em caso de conflito, este documento vence.

## Foundation

Interface web responsiva, mobile first, em React com TypeScript em modo estrito (addendum, seção A). Funciona de 320 px até desktop.

[ASSUNÇÃO] Nenhum sistema de UI nomeado. Os componentes são construídos sobre os tokens de `DESIGN.md`. A escolha de biblioteca de componentes fica para o plano técnico, e a decisão muda a seção Component Patterns só se a biblioteca impuser comportamento diferente.

Único idioma: português (PT-BR), conforme o PRD (seção 4).

## Information Architecture

| Superfície | Caminho | Chega por | Propósito |
|---|---|---|---|
| Lista | `/` e `/?category=new` | Abertura do app | Histórias de uma categoria, com "carregar mais" |
| Detalhe | `/item/{id}` | Toque em uma história | Dados da história e árvore de comentários |
| Erro de rota | qualquer outro caminho | Link inválido | Mensagem e link de volta à lista |

[ASSUNÇÃO] Os caminhos são propostos. A categoria fica na URL, para que o link compartilhado abra a mesma aba.

Navegação: faixa de categorias no topo da lista; no detalhe, um botão "Voltar" que restaura a posição de rolagem da lista (RF-12, Ana). Sem menu lateral: o produto tem duas telas.

Busca local (RF-09, opcional e parked): um campo de filtro no topo da lista poderia filtrar só os itens carregados. Está fora do corte atual e não bloqueia o MVP.

→ Referência de composição: [mockups/key-lista.html](mockups/key-lista.html) (lista, com estados normal, erro e vazio) e [mockups/key-detalhe.html](mockups/key-detalhe.html) (detalhe, com árvore e cache vencido). Este spine vence em caso de conflito.

## Voice and Tone

Microcopy em PT-BR, direto e sem exclamação. Marca e voz gráfica estão em `DESIGN.md`.

| Faça | Não faça |
|---|---|
| "Atualizado em 14:32" | "Dados recém-carregados!" |
| "Nenhuma história em new agora." | "Ops, nada por aqui." |
| "Não foi possível carregar. Tentar de novo" | "Erro 500" |
| "Comentário removido" | "[deleted]" (sem tradução) |
| "12 respostas ocultas" | "Ver mais" (sem contagem) |

## Component Patterns

Comportamentos. Valores visuais estão em `DESIGN.md.Components`.

| Componente | Uso | Regras de comportamento |
|---|---|---|
| Faixa de categorias | Lista | Toque troca a categoria e volta ao topo, com transição de até 200 ms. A categoria ativa é anunciada. Setas do teclado movem o foco entre abas. |
| Story row | Lista | Toque na linha abre o detalhe. O link externo é um controle próprio, com rótulo "abrir [domínio] em nova aba". Sem domínio (Ask e Job), a linha não mostra o campo. |
| Carregar mais | Fim da lista | Anexa os itens novos ao fim, sem mover a posição de rolagem (RF-12). Mostra skeleton durante a busca. Em erro, mantém os itens e exibe o erro abaixo deles. |
| Nó de comentário | Detalhe | Cabeçalho com autor e tempo relativo, texto sanitizado e botão de recolher. Recolhido: mostra só o cabeçalho com "N respostas ocultas". |
| Botão recolher/expandir | Cada nó com respostas | Alterna o estado. O rótulo muda ("Recolher" ↔ "Expandir, N respostas"). O estado é anunciado com `aria-expanded`. |
| Indicador de atualização | Topo da lista e do detalhe | Texto "atualizado em HH:MM". Não é botão e não tem ação. |

**Recolher (RF-05).** Colapsar um nó oculta todas as respostas e não faz nova chamada à API. O estado vive na sessão da aba (RF-07): recarregar a página restaura a árvore aberta. [ASSUNÇÃO]

**Profundidade visual.** [ASSUNÇÃO] Cada nível recua 16 px, com a linha-guia de `DESIGN.md.Components.comment-guide`. A partir do nível 4, o recuo para de crescer, para não estourar 320 px (RNF-09). A profundidade continua visível pela linha-guia e pelo texto "nível N" no leitor de tela.

## State Patterns

| Estado | Superfície | Tratamento |
|---|---|---|
| Carregando lista | Lista | Skeleton com 6 linhas do tamanho de story row. `aria-busy="true"` no contêiner. |
| Carregando detalhe | Detalhe | Cabeçalho da história com skeleton; comentários aparecem por nível conforme chegam. |
| Erro na primeira carga | Lista ou detalhe | Mensagem no lugar do conteúdo, com "Tentar de novo". |
| Erro na página seguinte | Lista | Itens já carregados permanecem. Erro abaixo deles, com "Tentar de novo". (RF-08) |
| Cache vencido com API fora | Lista ou detalhe | Mostra o conteúdo em cache com aviso "Não foi possível atualizar. Exibindo dados de HH:MM." |
| Categoria vazia | Lista | "Nenhuma história em {categoria} agora." (RF-13) |
| História sem comentários | Detalhe | "Sem comentários ainda." |
| Comentário removido | Detalhe | Texto "Comentário removido" sem apagar a hierarquia; preservar autor conhecido e não atribuir a remoção a ele (RF-06). |
| Comentário morto | Detalhe | Marcador neutro "[morto]" em `ink-secondary`, preservando autor conhecido sem atribuir a ele o estado; não apagar a hierarquia (RF-06). |

## Interaction Primitives

**Toque e clique** ativam. Pressionar longo é reservado para seleção de texto do sistema.

**Teclado** (RNF-04): Tab percorre a ordem de leitura. Enter ativa. Espaço alterna o recolher. Setas movem o foco entre categorias. Esc fecha o que estiver aberto (filtro de busca, se existir).

**Movimento** [ASSUNÇÃO] (interface dinâmica): transições de até 200 ms em troca de categoria e no recolher. Skeleton com pulso suave. Com `prefers-reduced-motion`, as transições são instantâneas e o pulso é estático.

**Rolagem:** sem carregamento infinito automático. "Carregar mais" é explícito, para não perder o controle da posição (RF-12).

**Banido:** carrossel, animação de entrada em cada item, contador de notificação, atualização automática em tempo real no MVP (está em "Após o MVP").

## Accessibility Floor

Comportamental. O contraste está em `DESIGN.md`. Este é o piso-alvo, não uma declaração de conformidade: automação axe e verificações de teclado são evidência técnica parcial; avaliação humana com tecnologia assistiva/leitor de tela permanece separada. Não se afirma WCAG completa nem teste nativo concluído.

- WCAG 2.1 AA (RNF-04). Tab e foco visível em todos os controles, com anel de foco de 2 px em `primary`.
- Alvos de toque de pelo menos 44 px (RNF-09), inclusive as abas e o botão de recolher.
- Carregamento anunciado com `aria-busy` e texto acessível (RF-08).
- Recolher anunciado com `aria-expanded`. Mudança de estado anuncia "N respostas ocultas" ou "respostas exibidas".
- Ordem de leitura do DOM igual à ordem visual em todas as telas.
- Links externos com rótulo que diz o destino.
- Tema escuro com os mesmos contrastes do claro. O tema segue o sistema operacional na primeira visita (RF-07).

## Responsive & Platform

| Largura | Comportamento |
|---|---|
| 320–767 px | Coluna única. Abas de categoria em faixa rolável horizontal dentro do próprio componente. Recuo de comentário limitado a 4 níveis. |
| 768 px+ | Abas em linha. Detalhe com largura máxima de leitura de 720 px. |

Sem rolagem horizontal da página em nenhuma largura (RNF-09).

## Inspiration & Anti-patterns

[ASSUNÇÃO] Ponto de partida, não referência obrigatória.

- **Adotado — lista compacta com hierarquia por tipografia (estilo de leitores de feed).** Mantém a densidade do HN sem a tabela.
- **Adotado — linha-guia para árvores de comentário.** Mostra profundidade sem caixas aninhadas, que estouram no celular.
- **Rejeitado — cartão por comentário.** Ocupa espaço demais e quebra a densidade pedida.
- **Rejeitado — contador de "novos desde a última visita".** Exige telemetria de usuário, que o PRD exclui do MVP.
- **Rejeitado — carregamento infinito.** Tira o controle da posição do leitor (contra RF-12).

## Key Flows

### Flow 1 — Leitura diária no celular (Ana)

1. Ana abre o app no caminho para o trabalho. A lista mostra a categoria *top*, com "atualizado em HH:MM".
2. Ela rola e escaneia os títulos e os domínios.
3. Toca em *new*. A faixa de categorias muda, e a lista volta ao topo.
4. Toca em uma história de 200 comentários. O detalhe mostra o cabeçalho e a árvore.
5. Recolhe um tópico que não interessa. As respostas somem, e o rótulo passa a "Expandir, 14 respostas".
6. Toca em "Voltar".
7. **Climax:** a lista reabre exatamente na posição em que Ana saiu, na categoria *new*. Ela continua do ponto onde parou, sem nada para reencontrar.

Falha: a API cai no meio do passo 4. O detalhe mostra o que já está em cache, com "Não foi possível atualizar. Exibindo dados de HH:MM", e a navegação continua.

### Flow 2 — Leitura profunda de um Ask (leitor ocasional)

1. O leitor abre a categoria *ask* na lista.
2. Toca em uma pergunta com discussão longa.
3. Lê os comentários de nível 1 e 2. Nos níveis 3 e 4, recolhe os ramos que já leu.
4. **Climax:** ao chegar ao limite de profundidade buscada, o leitor vê que há respostas ainda não buscadas naquele ramo. Não se inventam nós, níveis ou contagens que o contrato não fornece.

Vazio: a categoria *ask* sem itens mostra "Nenhuma história em ask agora."

## Abertos para validação

- Biblioteca de componentes (escolha do plano técnico).
- Persistência do recolher entre visitas (hoje: só na sessão da aba).
- Tom exato do azul (valor de `DESIGN.md.colors.primary`).
- Caminhos das rotas e nomes das categorias na URL.
