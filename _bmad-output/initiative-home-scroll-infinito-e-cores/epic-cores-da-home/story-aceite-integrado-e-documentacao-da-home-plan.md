---
title: 'Aceite integrado e documentação da home'
type: feature
ticket: '2'
created: 2026-10-13
status: built
baseline_revision: 'fd0613334f7ed0aec95ff3d54362e4da8f847cff'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: []
review_loop_iteration: 0
context:
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/decisions-approved.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores/initiative-home-scroll-infinito-e-cores.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/README.md
  - /Users/maurowidman/Projects/AI/prod-certo-green/docs/sdlc-artifacts.md
---

<frozen-after-approval reason="intent ratificada pelo plano aprovado nesta sessão; hitl pelo juízo humano de SM-2">

## Intent
**Problem:** a entrega dos dois epics precisa ser comprovada no bundle de produção, com smoke real, screenshots inspecionados e documentação que separe o histórico de 2026-10-12 do escopo novo. SM-2 (a pessoa responsável considera a home claramente mais colorida) só pode ser aceito por avaliação humana real. **Approach:** integrar, verificar e documentar sem reimplementar 1.2 ou 2.1; o aceite de SM-2 fica como item humano explícito.

## Boundaries & Constraints
**Always:** Node ≥24 via `PATH=/opt/homebrew/opt/node@24/bin:$PATH`; `npm run check`, `npm run build` e `npm run e2e` sequenciais; smoke contra um servidor de produção iniciado de novo em porta livre, com upstream público, distinguindo dados reais de fixtures; screenshots claro/escuro, celular 360 px e desktop, inspecionados e registrados; README e `docs/sdlc-artifacts.md` descrevendo o escopo atual e as limitações; FR-1–FR-7 e NFR-1–NFR-3 rastreados às provas. Preservar exclusões e mudanças locais, sem commit/push.
**Never:** registrar SM-2, conformidade WCAG completa, teste humano de tecnologia assistiva ou aceite visual humano como feitos; tratar a aprovação da paleta como avaliação das capturas; reabrir implementação de 1.2 ou 2.1 sem falha reproduzida; aumentar timeouts para ocultar falhas; restaurar as exclusões antigas; declarar "pronto" sem evidência.

## I/O & Edge-Case Matrix
| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Bundle de produção | `npm run build` e servidor iniciado do dist | SPA e `/api` no mesmo origin | falha de build bloqueia o aceite |
| Smoke público | lista real, continuação, detalhe, retorno e tema | sem erros de página; dados reais identificados como públicos | upstream indisponível é registrado, não mascarado |
| Fixtures | cenários de falha/expiração | sinalizados como fixture nas provas | — |
| Screenshots | 360 px e desktop, claro e escuro | capturas inspecionadas; scrollWidth igual à viewport | — |
| SM-2 | avaliação humana | pendente até a pessoa responsável registrar | não inferido |

## Code Map
- `../../../README.md`: descrição atual da home, continuação, cores, comandos e limitações.
- `../../../docs/sdlc-artifacts.md`: inventário que separa a entrega histórica de 2026-10-12 da nova iniciativa, sem referenciar como presentes os artefatos excluídos.
- `../../../_bmad-output/initiative-home-scroll-infinito-e-cores/`: evidências, decisões e resultados desta iniciativa.
- `../../../e2e/` e `../../../scripts/`: apenas para integrar verificações ou smoke; não reescrever testes aprovados.

## Tasks & Acceptance
**Execution:**
- [ ] rodar `npm run check`, `npm run build` e `npm run e2e` em Node 24 sequencialmente e registrar contagens.
- [ ] iniciar o servidor de produção em porta livre e rodar smoke com upstream público: lista, continuação, detalhe, retorno e tema, sem erros JavaScript; registrar dados reais observados.
- [ ] capturar screenshots 360 px e desktop claro/escuro, inspecionar e registrar caminhos e métricas de overflow; declarar que não é avaliação humana.
- [ ] atualizar README e `docs/sdlc-artifacts.md` com o escopo atual, a separação histórica e as limitações, incluindo SM-2 pendente.
- [ ] criar matriz de rastreio FR/NFR → provas técnicas, sem marcar SM-2 como comprovado.
- [ ] encerrar sem marcar done; o estado final de 2.2 depende da avaliação humana de SM-2 ou de sua aceitação formal como pendência.

**Acceptance Criteria:**
- AC-1: Given o bundle de produção, when check, build e e2e rodam em Node 24, then todos passam sem aumento indiscriminado de timeouts.
- AC-2: Given o servidor de produção e o upstream público, when o smoke percorre lista, continuação, detalhe, retorno e tema, then não há erro JavaScript e os dados são identificados como reais.
- AC-3: Given screenshots em 360 px e desktop, claro e escuro, when inspecionadas, then os usos aprovados aparecem e não há overflow da página.
- AC-4: Given README e SDLC, when lidos, then o escopo atual está descrito, o histórico é distinto e SM-2 aparece como pendência humana.

## Design Notes
Esta história integra, não reimplementa. Se uma verificação falhar, a correção volta ao ticket dono (1.2 ou 2.1) com teste vermelho antes do ajuste.

## Implementation Notes
Status `built` significa verificação e revisão concluídas. O ticket não recebe `done` enquanto SM-2, o juízo humano sobre as capturas, estiver pendente.

Execução de 2026-10-13 (Node 24.21.0), sem alteração de código de 1.2 ou 2.1:
- `npm run check`: passa; Vitest 20 arquivos / 131 testes; check-theme passa.
- `npm run build`: passa; cliente Vite 40 módulos.
- `npm run e2e`: 86 aprovados, 0 falhas (17,9 s); upstream de fixtures.
- Smoke em `node server/dist/main.js` (PORT 3917, produção, upstream público HN, sem fixtures): lista Top 30 reais; três incrementos automáticos para 60/90/120 com 120 IDs únicos e páginas 2–4 com snapshot; detalhe 50060694 com 285 corpos e 28 marcadores; retorno com posição 6039 px mantida; tema alterna claro/escuro; sem erro de página nem de console. Servidor encerrado pela porta.
- Capturas 360 px e 1280 px, claro e escuro, em `scratchpad` local: overflow de página 0 px nas quatro; inspeção técnica, não avaliação humana.
- Documentação: README (escopo atual, limites) e `docs/sdlc-artifacts.md` (entrega atual separada da histórica de 2026-10-12, verificações, rastreio FR/NFR, SM-2 pendente).
- SM-2 continua pendente; ticket permanece `in-progress`.

## Plan Change Log

## Review Triage Log
- medium — `docs/sdlc-artifacts.md` (revisão de overclaim): a tabela histórica chamava de "Artefatos reais" arquivos excluídos da árvore de trabalho; o texto dizia que permaneciam apenas nos commits. Verdict: real; route: patch. Correção: rótulo "Artefatos citados (excluídos da árvore de trabalho; ver histórico Git)", texto corrigido para dizer que os arquivos estão versionados no histórico (HEAD fd06133).
- medium — `docs/sdlc-artifacts.md` (revisão de overclaim): "a API pública devolveu os mesmos IDs" não tinha registro; "285 corpos, 28 marcadores e profundidade 8" não tinha log salvo. Verdict: real; route: patch. Correção: removido o primeiro; o segundo mantém somente `commentsRendered` 313 e 56 de primeiro nível, com a limitação declarada.
- low — `docs/sdlc-artifacts.md` (revisão de overclaim): "alvos ≥44 px" foi generalizado; a métrica registra apenas as abas; "sem requisição antecipada" não tem horário registrado. Verdict: real; route: patch. Correção: limitado às abas e à ausência de horário.
- rejected — nomes de testes e números de verificação citados: verificados como existentes e coerentes com os logs. Verdict: false.

## Verification
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run check` -- passa.
- `PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run build && npm run e2e` -- passa.
- Smoke em servidor de produção iniciado em porta livre, com registro das respostas reais e de fixtures separadas.
- Screenshots 360 px e desktop claro/escuro, inspecionadas, com caminhos registrados.
- Revisão quick independente das alterações de documentação e verificação, triada antes de `built`.
