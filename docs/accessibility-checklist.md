# Checklist de acessibilidade — evidências 4.3/4.4 e QA local

**Data da consolidação:** 2026-10-12

**Escopo:** registrar o que foi verificado tecnicamente nas evidências compiladas 4.3/4.4 e na validação local final com HN público. Este checklist não é uma avaliação humana nem um certificado WCAG.

## Evidências registradas

| Área | Estado | Evidência e ressalvas |
|---|---|---|
| Axe em listagem e detalhe, claro/escuro | **Verificado com limite** | Axe 4.13.0, seleção padrão de página inteira, quatro contextos locais novos. Zero violações nas quatro auditorias; detalhes sem incompletudes. A listagem mantém uma incompletude `color-contrast` de impacto `serious` para `#category-tab-job` em cada tema, por o fundo estar parcialmente encoberto pelo scroller horizontal. |
| Contraste da aba Jobs revelada | **Medição suplementar** | Após Tab e cinco ArrowRight, foco visível e contraste calculado 7,2425:1 no claro e 7,3437:1 no escuro. O cálculo pontual não apaga a incompletude Axe nem substitui avaliação completa. |
| Navegação e foco por teclado | **Demonstrado por automação de navegador** | A execução focal 4.3 percorreu categorias, tema, paginação e árvore de comentários com entradas Playwright de teclado; foco e limites do indicador foram registrados. Oito capturas dessa execução foram abertas/inspecionadas pela MAIN. Não equivale a teclado físico/nativo do sistema operacional. |
| Árvore de comentários | **Demonstrado no contexto de teste** | Detalhe compilado 4.4 exibiu 220 comentários de 221, com profundidade padrão 8 e sem query de profundidade. Evidência 4.3 também registrou expansão/recolhimento e navegação nos comentários. Não é validação de toda árvore possível em produção. |
| Movimento reduzido | **Verificado tecnicamente** | Na evidência compilada 4.3, quatro animações observadas em movimento normal passaram a zero com preferência `reduce`. É uma verificação CSS/DOM automatizada, não avaliação de conforto por usuário. |
| Layout responsivo | **Evidência parcial** | A execução compilada 4.2 registrou viewports 320/375 px e ampliação simulada a 200%, com medições e capturas. Isso não comprova zoom nativo nem conformidade integral com reflow. Referência: `verification/live-compiled-responsive-4-2.ZR2HJz/passed/`. |
| Interface com dados públicos HN | **Verificado localmente; não é aceite de acessibilidade** | A MAIN validou a aplicação compilada com HN público tanto via `npm start` quanto em Compose. Na rodada Compose foram abertas as 16 capturas; listagem/detalhe em 320 e 375 px não tiveram overflow horizontal, e os cenários cobriram temas claro/escuro, recolhimento, retorno à listagem/scroll em Y=2634 e deeplink. O browser registrou zero erros e nenhuma requisição fora da origem local. Isso atesta apenas os cenários registrados, não WCAG, teste humano ou tecnologia assistiva. Evidências compactas: `verification/final-platform-qa.U5JP6P/main-compose-validation.json` e `verification/final-platform-qa.U5JP6P/main-local-validation.json`. Capturas e logs detalhados permanecem evidência local.

## Registro de Axe 4.4

- Evidência: `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json` e diretório `actual/screenshots/`.
- Os quatro contextos (`list-light`, `list-dark`, `detail-light`, `detail-dark`) tiveram zero violações Axe.
- A incompletude de contraste para a aba Jobs foi preservada nos dois resultados de listagem. A auditoria de detalhe não teve incompletudes.
- Quatro PNGs — listagem e detalhe em claro e escuro — foram abertos/inspecionados pela MAIN.
- O suplemento com foco de teclado mediu 7,2425:1 no claro e 7,3437:1 no escuro. São cálculos da cor computada após revelar a aba, não uma nova auditoria Axe nem um aceite de WCAG.

## Ainda não verificado / não declarar como concluído

Os itens abaixo permanecem **NÃO REALIZADOS**; isso não significa conformidade WCAG. Segundo reporte MAIN de 2026-10-12, a avaliação humana/AT e o ambiente limpo foram retirados do gate humano e não bloqueiam o fechamento técnico.

- Teste humano com leitor de tela ou qualquer tecnologia assistiva.
- Teste de teclado nativo do sistema operacional e avaliação humana ponta a ponta.
- Aceite completo de WCAG ou declaração de conformidade por critério.
- Reflow/zoom nativo; a evidência de 200% é simulada e não substitui essa validação.
- Validação independente humana em ambiente limpo: **NÃO REALIZADA**. O PASS local Compose não a substitui; conforme MAIN, esse item não integra o gate humano de fechamento de 2026-10-12.
- Gate automatizado de acessibilidade em CI.

**Conclusão:** as evidências dão suporte ao fechamento técnico da execução 4.4, mas não autorizam afirmar conformidade WCAG completa. A incompletude da aba Jobs deve continuar visível nos registros até revisão/aceite apropriado; os resultados automatizados permanecem distintos de avaliação humana.

## Versionamento dos registros

Conforme reporte da MAIN, este checklist e os resumos compactos de QA foram incluídos no commit local `0598a96b2a3fd1d339f61454925805d30a427be9` (86 caminhos/5.845 linhas). Os resumos relevantes incluem `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/main-validation-summary.json`, `verification/final-platform-qa.U5JP6P/main-local-validation.json`, `verification/final-platform-qa.U5JP6P/main-compose-validation.json` e `verification/final-platform-qa.U5JP6P/main-dev-validation.json`. Logs brutos e capturas permanecem locais; o versionamento não altera o estado das verificações de acessibilidade nem constitui avaliação humana, teste de AT ou declaração de conformidade WCAG.

## Referências relacionadas

- `docs/qa-final.md` — consolidação da decisão técnica e limites do QA 4.4.
- `verification/live-compiled-axe-4-4.txFi2Y/passed-postreview/`.
- `verification/live-compiled-keyboard-4-3.Whvc85/passed-focus-margin/`.
- `verification/live-compiled-responsive-4-2.ZR2HJz/passed/`.
- `verification/final-platform-qa.U5JP6P/main-compose-validation.json` e `verification/final-platform-qa.U5JP6P/main-local-validation.json` — resumos compactos da integração compilada Compose/HN público; apenas evidência funcional/responsiva. Capturas e logs brutos permanecem locais.
- `verification/final-platform-qa.U5JP6P/main-dev-validation.json` — resumo compacto do smoke `npm run dev`/proxy; evidência operacional, não validação de acessibilidade ou AT.
- `_bmad-output/initiative-hn-modernizacao/execution-progress.md`, linhas 209, 233–240.
