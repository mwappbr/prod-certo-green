---
title: "Artefatos do SDLC versionados e processo documentado — plano técnico NON-HITL"
kind: non-hitl-technical-plan
technical_ref: "1.9"
plan_status: documentation-prepared-versioning-pending
formal_workflow_status: blocked
created: "2026-10-12"
formal_plan: "_bmad-output/initiative-hn-modernizacao/epic-plataforma-base/story-artefatos-do-sdlc-versionados-e-processo-documentado-plan.md"
---

# Preparação documental separada — SDLC

## Autorização e fronteira de status

Em 2026-10-12, a coordenação aprovou uma lease documental NON-HITL separada para uma seção curta no README, um inventário conciso e validação local mínima. Essa autorização permite preparar documentação sem resolver a dependência formal. O plano formal/ticket 1.9 permanece `blocked`; 1.7 continua aguardando aceite humano; versionamento e reconciliação final de O-05 permanecem pendentes.

Este é um plano técnico de coordenação (`kind: non-hitl-technical-plan`), não um ticket. Não possui chave `ticket` ou `type: story`. `plan_status` registra apenas o estado da preparação técnica; `formal_workflow_status` registra separadamente o estado formal bloqueado. Resultado pretendido desta lease: `documentation-prepared-versioning-pending`, nunca “todos os ACs aceitos”, “versionado” ou “O-05 satisfeito”.

## Evidência de base

- Revisão Git read-only: branch `feat/plataforma-1-1-tracer`, HEAD `bfc7e81a60e9f343d4b039c5905b8a123f752082`, working tree sujo. `README.md` já estava modificado na entrada e foi preservado fora da inserção documental curta.
- `git ls-files -- README.md _bmad-output` retorna somente `README.md`. Os planos e demais artefatos locais de `_bmad-output` não são versionados no HEAD. Arquivo rastreado porém modificado também não significa que o conteúdo local atual esteja versionado.
- Paths de fonte, testes, E2E e evidências foram listados sem ler conteúdo de código/testes/logs em andamento. Não foram lidos arquivos reais `.env` nem segredos. `execution-progress.md` não foi lido ou alterado.
- A coordenação reportou a janela intermediária `window-3-2-postreview.B1ebk1` como `97/16/24.21`; esse dado não foi revalidado a partir dos logs e não representa aceite final. UI 3.3/E2E permanecem em andamento e fora de qualquer aceite desta lease.

## Alterações concluídas sob a lease

1. **`README.md`:** inserida somente uma seção concisa “Processo SDLC” com link relativo para `docs/sdlc-artifacts.md` e nota de que presença local não equivale a versionamento/aceite. As instruções de execução local e Compose da história 1.7 não foram reformuladas.
2. **`docs/sdlc-artifacts.md`:** criado inventário conciso com caminhos locais verificados, estados Git observados, artefatos de iniciativa/brief/PRD/adendo/UX/arquitetura/épicos/TOMLs/planos 1.1–1.7, registros de implementação/testes/configuração/Docker/E2E e evidências de review/aceite. Diferencia conteúdo rastreado e limpo, rastreado e modificado, local não rastreado, pendente e intermediário; não converte estado de plano ou log em aceite.
3. **Este plano NON-HITL:** atualizado para registrar a lease, o escopo executado e o status técnico separado do formal.
4. **Log local de validação:** `_bmad-output/initiative-hn-modernizacao/epic-plataforma-base/story-artefatos-do-sdlc-versionados-e-processo-documentado-validation.log` guarda timestamp UTC, HEAD, saída das consultas read-only por caminho, checagens locais de arquivo/link e hashes SHA-256 das páginas/plano. Não é remoto nem commitado.

## Validação e limites

- Validação autorizada: Git `status`, `ls-files`, `rev-parse HEAD` read-only; checagem local one-off com Python `-I` para existência dos caminhos documentais e link relativo; hashes para fixar o snapshot. Sem rede e sem executar código do repositório.
- Nenhuma execução npm/Node, `check`, build, emit, E2E, servidor, Docker ou instalação foi feita. Nenhuma suíte ou ambiente de produção foi testado.
- Nenhum staging, `git add --refresh`, commit, push, branch, reset, clean ou stash foi executado. Nenhum arquivo formal de ticket/TOML/ledger, código, teste, harness, configuração, manifesto/dependência ou arquivo de consumidor foi editado. A revisão documental externa a651 encontrou um MEDIUM confirmado na associação dos IDs aos planos da plataforma; a associação foi corrigida e será revalidada localmente abaixo. Nenhum revisor foi lançado por esta lease; a revisão independente da plataforma/código continua aguardando estado concorrente estável.

## Estado final e pendências

`plan_status: documentation-prepared-versioning-pending`. `README.md` continua rastreado porém modificado, e `docs/sdlc-artifacts.md`, este plano e o log permanecem locais não rastreados. Nenhuma alteração foi versionada.

`formal_workflow_status: blocked` permanece inalterado. A aceitação HITL de 1.7 em ambiente limpo ainda depende de uma pessoa; esta lease não a afirma nem condiciona a preparação documental à sua resolução. O-05 não é declarado satisfeito e a reconciliação final continua no ticket 4.6. Nenhum aceite final de plataforma ou consumidor é inferido dos registros intermediários. O `Auto Run Result` do plano formal é um snapshot do HALT anterior à lease NON-HITL separada; não descreve o estado documental posterior e não foi editado.

## Correção pós-review documental

A revisão documental externa a651 confirmou um finding MEDIUM no inventário: os IDs 1.2, 1.3, 1.5 e 1.6 estavam associados às histórias erradas. A linha de planos foi corrigida para refletir os IDs de `tickets.toml` e dos planos locais:

- 1.1 — tracer (`story-tracer-servico-com-api-health-e-spa-vazia-plan.md`)
- 1.2 — configuração (`story-configuracao-por-variavel-de-ambiente-validada-plan.md`)
- 1.3 — lint (`story-regra-de-dependencia-verificada-pelo-lint-plan.md`)
- 1.4 — tokens de tema (`story-tokens-de-tema-claro-e-escuro-plan.md`)
- 1.5 — testes (`story-testes-unitarios-e-de-integracao-pelo-script-de-verificacao-plan.md`)
- 1.6 — Docker (`story-dockerfile-e-compose-com-um-servico-plan.md`)
- 1.7 — README (`story-readme-com-execucao-local-e-via-compose-plan.md`)

A revalidação local read-only, timestamp UTC e novos hashes estão anexados ao log já existente `story-artefatos-do-sdlc-versionados-e-processo-documentado-validation.log`; o registro histórico de 09:16:16Z e seus hashes foi preservado sem substituição. O finding corrigido não altera `plan_status: documentation-prepared-versioning-pending`, `formal_workflow_status: blocked`, o gate HITL de 1.7 nem o estado de versionamento/O-05.
