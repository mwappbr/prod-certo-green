---
title: "Tela inicial: scroll infinito e mais cor"
status: approved
created: 2026-10-13
updated: 2026-10-13
---

# PRD — Tela inicial: scroll infinito e mais cor

## 1. Propósito, visão e usuário

Registrar duas mudanças para um projeto pessoal: continuar a leitura da tela inicial por scroll infinito e melhorar seu design com mais cor. O objetivo é explorar notícias sem interromper a navegação para pedir mais itens, preservando a legibilidade. Este PRD define resultados e critérios de aceite; não implementa a solução nem decide sua arquitetura.

O produto existente é o **HN Moderno**, leitor de Hacker News. A pessoa percorre notícias, abre seus links ou comentários e continua do ponto em que parou. Por ser um recorte pessoal, dispensam-se personas formais e pesquisa de mercado.

**Base existente:** a home acrescenta itens por “Carregar mais”, com os feeds Top, New, Best, Ask, Show e Jobs. Voltar do detalhe já preserva a leitura na mesma sessão. O visual é neutro com acentos azuis, em temas claro e escuro. A mudança automatiza a continuação e amplia o uso de cor; não substitui notícias a cada lote.

## 2. Vocabulário e escopo

- **Home:** tela inicial que contém a lista de notícias e seus controles existentes.
- **Feed:** seleção de notícias apresentada na home.
- **Lote:** próximo conjunto de notícias acrescentado ao feed.
- **Scroll infinito:** carregamento automático de lotes durante a rolagem, enquanto houver notícias disponíveis. Não significa conteúdo ilimitado.

**Incluído:** continuação automática, estados de carregamento/erro/fim, preservação da leitura, e revisão de cores da home em tamanhos de tela já suportados.

**Fora de escopo:** novas seções, busca, contas, personalização, alteração da classificação de notícias, funcionalidades de comentários, novas fontes de dados e redesenho completo de outras telas. Mudanças visuais nos elementos compartilhados podem refletir fora da home, mas não justificam alterar seus comportamentos.

## 3. Funcionalidade: scroll infinito

[ASSUMPTION A1: aplicar a continuação automática a todas as seleções de feed já disponíveis na home, mantendo seus comportamentos atuais. Não criar seleções novas.]

### FR-1 — Continuar sem pedir outro lote

Ao se aproximar do final das notícias carregadas, a pessoa recebe o próximo lote automaticamente, sem acionar paginação ou “Carregar mais”.

**Aceite:** com mais notícias disponíveis, rolar até o final acrescenta um lote; notícias já exibidas permanecem na mesma ordem e não se repetem; não existe solicitação simultânea duplicada para a mesma continuação. A posição de leitura não salta para o topo.

### FR-2 — Mostrar carregamento e permitir recuperação

A home distingue carregamento inicial de carregamento adicional. Uma falha ao buscar o próximo lote não elimina notícias já exibidas.

**Aceite:** a busca adicional mostra um estado identificável no final da lista; em caso de falha, aparece uma mensagem e “Tentar novamente”; a tentativa recupera a mesma continuação, sem duplicar notícias; a falha pausa o carregamento automático até a ação da pessoa. Preservar estados iniciais e avisos existentes de dados desatualizados.

### FR-3 — Reconhecer fim, lotes vazios e reinício

A continuação respeita a disponibilidade informada pela fonte, a seleção de feed e a validade da sequência atual.

**Aceite:**
- Com fim confirmado, mostrar “Você chegou ao fim” e parar as solicitações. Lote curto ou vazio, sozinho, não indica fim.
- Se um lote vier vazio e ainda houver continuação, pausar o automático e disponibilizar “Carregar mais”; não entrar em um ciclo de buscas sem notícias visíveis. Com continuação desconhecida, manter essa ação até confirmar o fim.
- Trocar de feed não mistura notícias; respostas tardias não acrescentam itens ao feed errado. Preservar o reinício de leitura ao trocar de seleção.
- Se a sequência expirar, manter o reinício já existente com aviso, sem misturar lotes antigos e novos. Esse reinício é uma exceção explícita à preservação de posição de FR-4.

### FR-4 — Preservar o ponto de leitura

Manter o retorno do detalhe já existente: seleção, notícias carregadas e posição de leitura na mesma sessão.

**Aceite:** ao voltar pelo histórico ou por “Voltar” de um detalhe aberto depois de vários lotes, a notícia de origem volta à posição anterior; novos lotes não removem o foco atual nem reposicionam notícias já lidas. Atualização explícita e sequência expirada podem reiniciar a leitura. Não exigir persistência após recarregar a página ou entre dispositivos.

### FR-5 — Permitir navegação acessível

O carregamento automático não pode aprisionar a pessoa no feed nem exigir exclusivamente gestos de rolagem.

**Aceite:** todas as ações permanecem acessíveis por teclado, com foco visível; quem navega por teclado dispõe de uma ação de continuação acessível caso o carregamento automático não seja acionado; carregamento, falha e fim são comunicados a tecnologias assistivas sem repetir a lista inteira; controles existentes fora da lista continuam alcançáveis. O fallback de continuação não substitui o scroll automático como experiência principal.

## 4. Funcionalidade: home com mais cor

[ASSUMPTION A2: partir da identidade azul existente, ampliar áreas de cor e incluir acentos complementares, mantendo as áreas de leitura predominantemente neutras. A paleta exata será escolhida e aprovada na etapa de UX, antes da implementação visual.]

### FR-6 — Tornar a mudança visual perceptível

A home usa cor para criar hierarquia e reconhecer estados, sem mudar as informações disponíveis nas notícias.

**Aceite:** a revisão modifica de forma visível pelo menos o cabeçalho, a seleção ativa do feed e os estados interativos dos links/controles; a proposta apresenta esses usos em desktop e celular. Não basta mudar uma única cor incidental para considerar a melhoria entregue.

### FR-7 — Preservar leitura e significado

As cores não competem com os títulos nem passam a ser o único sinal de seleção, erro ou interação.

**Aceite:** títulos, metadados e controles continuam legíveis; seleção ativa também tem indicação não cromática; erros têm texto; foco e estados interativos são distinguíveis. Não remover título, origem ou informações existentes para acomodar decoração.

## 5. Qualidade transversal

- **NFR-1 — Contraste:** texto comum com contraste mínimo de 4,5:1; texto grande de 3:1; detalhes necessários para identificar controles e estados de 3:1. Verificar em cada tema já suportado. Não criar temas novos como parte deste escopo.
- **NFR-2 — Responsividade:** validar a home a 360 px e em desktop: nenhuma rolagem horizontal da página; manter a faixa de categorias navegável, os alvos de interação de 44 px e o respeito à preferência de movimento reduzido. Títulos, estados e controles não ficam cortados.
- **NFR-3 — Continuidade e limites:** não carregar todo o feed antecipadamente nem ampliar o limite existente por lote. Carregar conforme necessário e parar após fim confirmado ou erro sem ação da pessoa. O teste percorre pelo menos três lotes consecutivos sem duplicação ou perda de leitura.

## 6. Sucesso e contramétricas

**SM-1 — Navegação contínua (FR-1–FR-5):** a pessoa percorre pelo menos três lotes sem clicar para obter mais notícias, abre um detalhe e volta ao ponto anterior. Também consegue recuperar uma falha e reconhecer o fim do feed.

**SM-2 — Visual aprovado (FR-6–FR-7):** a pessoa responsável pelo projeto considera a home claramente mais colorida, verificando desktop e celular, com NFR-1 e NFR-2 atendidos.

**SM-C1 — Não otimizar permanência ou volume:** rolar mais ou ficar mais tempo não é objetivo por si só. Reprovar regressões de legibilidade, teclado, retorno ao feed ou carga desnecessária, mesmo que aumentem o número de notícias vistas. A validação é manual e por testes; este recorte não exige instalar analytics.

## 7. Suposições e pendências

A1 e A2 são propostas do caminho rápido, não decisões explicitamente aprovadas pela pessoa. Responsável: pessoa responsável pelo projeto.

- **A1 (§3):** automático nos seis feeds existentes. Revisitar antes de fatiar a implementação se a intenção for restringir a mudança ao feed padrão.
- **A2 (§4):** azul como ponto de partida, com acentos complementares. Escolher e validar a paleta na etapa de UX, antes de implementar cores; a escolha não impede planejar o scroll.

**Impacto conhecido:** o teste atual que proíbe carregar ao rolar (`e2e/listing.spec.ts:338`) deve mudar para o novo comportamento. Preservar as verificações de retorno, erros, acessibilidade e temas. Nenhum teste foi executado ou código alterado neste passo.

## 8. Fontes

- Pedido desta conversa: duas mudanças, projeto pessoal, caminho rápido.
- Produto e home: `README.md:1`, `client/src/features/listing/StoryListPage.tsx:158` e `StoryRow.tsx:7` no mesmo diretório.
- Retorno e continuação: `client/src/features/listing/ListingProvider.tsx:74`, `client/src/api/use-stories.ts:220` e `server/src/app/get-stories.ts:92`.
- Visual e contraste: `client/src/theme.css:1`, `client/src/features/listing/listing.css:176` e `scripts/check-theme.mjs:9`.
- [WAI — exemplo do padrão Feed](https://www.w3.org/WAI/ARIA/apg/patterns/feed/examples/feed/): referência para foco e anúncio de carregamento, não implementação pronta.
- [WCAG 2.2 — referência rápida](https://www.w3.org/WAI/WCAG22/quickref/): contraste e significado não dependente apenas de cor.
- [Nielsen Norman Group — Infinite Scrolling Tips](https://www.nngroup.com/articles/infinite-scrolling-tips/): retorno ao ponto de leitura, estados e acesso fora do feed. Não estabelece que scroll infinito seja melhor para toda tarefa.
