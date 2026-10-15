# Cores da home

## Decisão e estado
A direção e a interface abaixo foram aprovadas no plano “Home contínua e colorida — tickets, implementação e aceite”, por `ExitPlanMode`, em 2026-10-13. A2 está ratificada antes de qualquer código visual. A aprovação da proposta **não** equivale a uma avaliação humana das screenshots finais (SM-2). Implementação e medições reais pertencem a 2.1; integração e capturas a 2.2.

## Hierarquia
Identidade azul com acento violeta; nenhuma paleta por feed. A home deve mudar perceptivelmente em três áreas: cabeçalho, tab selecionado e links/controles interativos. Notícias continuam em fundos neutros, preservando títulos, origem, autor, pontuação, tempo e comentários. Não redesenhar o detalhe nem mudar ThemeProvider/bootstrap/preferência por aba.

## Interface única
Preservar nomes **e valores** de `--surface-base`, `--surface-raised`, `--ink-primary`, `--ink-secondary`, `--primary`, `--primary-foreground`, `--primary-hover` e `--border-hairline`. Acrescentar exatamente estes papéis em `client/src/theme.css`, com valores literais também na via escura por sistema:

| Token | Papel | Claro | Escuro |
|---|---|---|---|
| `--surface-brand` | área azul do cabeçalho da home | `#DBEAFE` | `#172554` |
| `--ink-on-brand` | identidade e título no cabeçalho | `#1E3A8A` | `#DBEAFE` |
| `--surface-accent` | superfície violeta da categoria ativa | `#EDE9FE` | `#2E1065` |
| `--accent` | texto/indicador ativo e acentos de links | `#6D28D9` | `#C4B5FD` |
| `--border-control` | contornos essenciais, não divisórias decorativas | `#64748B` | `#94A3B8` |

## Consumidores
- Cabeçalho `.listing__header`: bloco azul perceptível, com padding/borda arredondada respeitando coluna/gutters atuais. Identidade e h1 usam `ink-on-brand`; freshness continua `ink-secondary`. O botão de tema mantém superfície neutra e textos existentes.
- `.category-tabs__tab[aria-selected=true]`: superfície violeta, texto/indicador `accent` e sublinhado/borda inferior como sinal não cromático, além de `aria-selected`. Não remover navegação horizontal da faixa nem atalhos de teclado.
- Links de notícias: título neutro em repouso; hover/focus visível com acento e sublinhado. Fonte continua link genuíno, informação de nova aba preservada. Não criar artigo inteiro clicável ou duplicar controles.
- Continuação: ação principal conserva primary/foreground existentes. Pausa/retomada pode usar superfície neutra e contorno `border-control`, com acento e rótulo explícito; não comunicar estados apenas por cor. Erros e fim mantêm texto.
- Foco: outline ≥2px contrastante nas superfícies reais; alvos ≥44px. Preservar fluxo de foco manual definido pelo epic de scroll, sem saltar para notícia nova.
- Detalhe: só tokens compartilhados podem existir sem consumo novo deliberado; escopar mudanças de home para não recolorir cabeçalhos/links do detalhe sem autorização.

## Contraste e qualidade
Verificar texto normal ≥4,5:1; indicadores essenciais/foco/contorno ≥3:1, em claro/escuro explícito e equivalência da via escura por sistema. A tabela preliminar do plano não comprova CSS renderizado. Ampliar `scripts/check-theme.mjs` e testar os pares realmente usados em browser, incluindo hover, foco, seleção e metadados; contrastes sobre transparência/opacidade exigem fundo final, não token isolado.

Validar 360px e desktop, sem overflow horizontal de página, mantendo faixa interna navegável e texto/controles não cortados. Reduced motion continua respeitado; não acrescentar animação decorativa. Axe/contraste/teclado são evidências técnicas limitadas, não conformidade WCAG completa nem teste humano de tecnologia assistiva.

## Referências
- [Decisões aprovadas](../decisions-approved.md)
- [PRD](../../initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md), FR-6/FR-7/NFR-1/NFR-2/SM-2
- [Arquitetura](../../initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md), AD-7/AD-8
