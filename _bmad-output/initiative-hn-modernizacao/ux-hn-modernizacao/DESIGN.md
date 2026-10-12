---
name: HN Moderno
description: Interface moderna e dinâmica para o Hacker News. Compacta, azul, legível no celular. Rascunho com premissas marcadas para validação.
status: final
created: 2026-10-09
updated: 2026-10-09
colors:
  surface-base: '#F8FAFC'
  surface-raised: '#FFFFFF'
  ink-primary: '#0F172A'
  ink-secondary: '#475569'
  primary: '#1D4ED8'
  primary-foreground: '#FFFFFF'
  primary-hover: '#1E40AF'
  border-hairline: '#E2E8F0'
  surface-base-dark: '#0B1120'
  surface-raised-dark: '#131C2E'
  ink-primary-dark: '#E2E8F0'
  ink-secondary-dark: '#94A3B8'
  primary-dark: '#60A5FA'
  primary-foreground-dark: '#0B1120'
  primary-hover-dark: '#93C5FD'
  border-hairline-dark: '#1E2A40'
typography:
  body:
    fontFamily: 'Inter'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  title:
    fontFamily: 'Inter'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.35'
  meta:
    fontFamily: 'Inter'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  label:
    fontFamily: 'Inter'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.3'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '6': 24px
  gutter-mobile: 16px
components:
  story-row:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    title: '{colors.ink-primary}'
    meta: '{colors.ink-secondary}'
    padding: '{spacing.2}'
  comment-guide:
    line: '{colors.border-hairline}'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  tab-category-active:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  freshness-label:
    foreground: '{colors.ink-secondary}'
    typography: '{typography.label}'
---

## Brand & Style

[ASSUNÇÃO] O produto é uma leitura rápida e moderna do HN. O usuário pediu "moderno e dinâmico", e o rascunho lê isso assim: superfícies limpas, hierarquia clara por tipografia e espaço, e movimento discreto que confirma ações (troca de categoria, recolher comentário) sem atrasar a leitura.

O HN original é denso e utilitário. Esta interface mantém a densidade (o usuário pediu "compacto"), mas troca a tabela por listas com hierarquia. A marca é a origem: o HN e os links de origem sempre aparecem, sem esconder quem produz o conteúdo.

## Colors

[ASSUNÇÃO] O azul é a única cor de marca. Hoje não existe identidade visual a respeitar, então o tom exato é uma escolha a validar.

- **Azul primário (`#1D4ED8` claro / `#60A5FA` escuro)** marca a categoria ativa, o link de ação principal e o foco. Não decora fundos.
- **Tinta primária e secundária** separam título (`ink-primary`) de metadados (`ink-secondary`). Metadados nunca abaixo de 4.5:1.
- **Superfícies**: fundo neutro frio (`surface-base`) e cartão (`surface-raised`) apenas por tom, sem sombra.
- **Hairline** separa itens da lista no menor contraste ainda visível.

Contrastes calculados (WCAG): texto principal 17:1 no claro e 15:1 no escuro; azul sobre branco 6.7:1; metadados 7.2:1 no claro e 7.3:1 no escuro. `ink-secondary` do escuro (`#94A3B8`) foi escolhido porque `#64748B` cai para 4:1 sobre o fundo escuro.

Evitar: vermelho para estado de erro (usar texto e ícone neutro com borda), gradientes, mais de uma cor de marca.

## Typography

[ASSUNÇÃO] Inter para tudo, em quatro papéis: `title` para o título da história, `body` para comentários, `meta` para pontuação, autor e tempo, `label` para categorias e rótulos. Sem tamanhos de display. Os tamanhos são pequenos porque a densidade é um objetivo do produto; o piso de 13px vale para metadados e nada abaixo disso.

Dynamic type: a interface deve continuar legível com a fonte do sistema aumentada, sem truncar controles.

## Layout & Spacing

Escala de 4 px. Lista compacta: padding vertical de 8 px por item, 12 px entre partes de um mesmo item. Margens laterais de 16 px no celular.

Mobile first. Sem rolagem horizontal a partir de 320 px (RNF-09). Largura máxima de leitura de 720 px para comentários no desktop. Abaixo de 768 px, a categoria vira uma faixa rolável horizontal dentro do próprio componente, não da página.

## Elevation & Depth

Sem elevação decorativa. Hierarquia vem de tipografia, espaço e tom. Sombra só em menus flutuantes, quando um elemento sobrepõe a lista.

## Shapes

`rounded/sm` (4 px) para tags de domínio e botões pequenos. `rounded/md` (8 px) para abas de categoria e botões. `rounded/lg` (12 px) para painéis. Nenhuma forma totalmente arredondada, exceto indicadores circulares de carregamento.

## Components

- **Story row.** Título em `title`, com o domínio do link ao lado em `label`. Abaixo, uma linha de `meta`: pontuação, autor, tempo relativo, comentários. Toque na linha inteira abre o detalhe; o link externo é um controle separado.
- **Comment guide.** Linha vertical de 1 px em `border-hairline` à esquerda de cada nível de resposta. Não há cartão por comentário.
- **Category tabs.** Seis abas (top, new, best, ask, show, job). A ativa usa `primary`. Inativa usa `ink-secondary`.
- **Freshness label.** "atualizado em HH:MM" em `label`, com `ink-secondary`, no topo da lista (RF-11).
- **Primary button.** Usado para "Tentar de novo" e "Carregar mais". Sem outras variantes no MVP.
- **Skeleton.** Linhas cinza do tom `border-hairline` com pulso suave, do mesmo tamanho dos itens reais, para não deslocar o conteúdo ao carregar.

## Do's and Don'ts

| Faça | Não faça |
|---|---|
| Use o azul só para estado ativo e ação principal | Pintar fundos de seção com azul |
| Mostre o domínio e o link de origem em cada história | Esconder a origem do conteúdo |
| Mantenha a densidade: itens compactos, sem cartão por comentário | Expandir o espaço para parecer "mais moderno" |
| Use movimento curto (até 200 ms) e respeite `prefers-reduced-motion` | Animar a rolagem ou a entrada de cada item |
| Mostre "atualizado em" quando houver cache | Esconder que os dados podem estar antigos |
