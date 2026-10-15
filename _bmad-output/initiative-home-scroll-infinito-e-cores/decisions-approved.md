# Decisões aprovadas para a home

Data: 2026-10-13. Fonte da aprovação: chamada real a `ExitPlanMode`, cujo resultado foi “User has approved your plan. You can now start coding.” O plano aprovado é `/Users/maurowidman/.claude/plans/mighty-seeking-meadow.md`, “Home contínua e colorida — tickets, implementação e aceite”. Este registro conserva as decisões para os builds; não substitui testes, implementação ou aceite de screenshots.

## Escopo e execução

- Decision: trabalhar na branch `brownfield` com seu estado local existente, preservando as exclusões e fontes atuais; não fazer restore/reset/stash/limpeza, commit, push ou publicação externa.
- Decision: criar `initiative-home-scroll-infinito-e-cores` e dois epics com quatro histórias na cadeia 1.1 → 1.2 → 2.1 → 2.2; referências PRD/arquitetura ficam em seus caminhos anteriores, sem mover arquivos.
- Decision: A1 ratificada — continuação automática nos seis feeds técnicos `top`, `new`, `best`, `ask`, `show`, `job`, com Jobs como rótulo da UI; nenhum feed novo.
- Decision: AD-2/4/5/6 ratificadas — comando único/lock, projeção first-ID-wins, restauração exclusivamente pelo Provider e continuação acessível/interrompível; AD-1/3/7/8 permanecem vinculantes.
- Decision: usar `bmad-agent-dev`/`bmad-build` com disciplina red/green/refactor, review e evidência por história; continuidade autônoma autorizada, sem checkpoints adicionais por história e sem contornar a exigência de árvore limpa do `bmad-build-auto`.
- Decision: não criar epic de plataforma porque baseline, scaffold, ferramentas e build já existem e foram verificados; não adicionar infraestrutura nem dependências.
- Decision: 2.2 hospeda verificação integrada/documentação, sem retirar dos demais tickets seus testes e suas responsabilidades de implementação.

## A2 e interface visual única

A2 ratificada: identidade azul com acento violeta, áreas de leitura neutras e tratamento colorido restrito à home, sem paleta por feed nem redesenho do detalhe. Preservar os nomes e valores dos oito tokens existentes; acrescentar os cinco papéis abaixo em claro, escuro explícito e escuro por sistema. 2.1 registra esta aprovação e os usos em `ux-cores-home/DESIGN.md` e `EXPERIENCE.md` antes de implementar o visual; esses documentos são entregas da história, não fontes atualmente existentes.

| Token | Papel | Claro | Escuro |
| --- | --- | --- | --- |
| `--surface-brand` | Área azul do cabeçalho da home | `#DBEAFE` | `#172554` |
| `--ink-on-brand` | Identidade e título no cabeçalho | `#1E3A8A` | `#DBEAFE` |
| `--surface-accent` | Superfície violeta da categoria ativa | `#EDE9FE` | `#2E1065` |
| `--accent` | Texto/indicador ativo e acentos de links | `#6D28D9` | `#C4B5FD` |
| `--border-control` | Contornos essenciais, não divisórias decorativas | `#64748B` | `#94A3B8` |

Os cálculos preliminares de candidatos no plano não são verificação do CSS aplicado. 2.1 e 2.2 verificam os pares reais, hover/foco/seleção/metadados e regressão do detalhe, com os mínimos NFR-1 e ambas as vias de escuro.

## Handoffs vinculantes

1. **1.1 → 1.2:** cursor por página aceita, snapshot/limite negociados, IDs únicos estáveis, comando manual/auto com trava síncrona e escopo geração/ciclo, cancelamento na navegação e detector de demanda; 1.2 completa estados, restauração/foco e interrupção sobre essa base.
2. **1.2 → 2.1:** estrutura e semântica estáveis dos controles de continuação, retry, pausa/retomada, status e fim; 2.1 aplica uma única interface de tokens e seus consumidores sem recriar política.
3. **1.2 + 2.1 → 2.2:** implementação/testes próprios e registros UX verificáveis; 2.2 executa integração no bundle de produção, captura/inspeciona screenshots e atualiza documentação.

Todos os sinais de continuação/restauração/foco são do mesmo escopo vigente; nenhum observador, timer ou resposta tardia é autorização para reabrir gates. Só `hasMore === false` confirma fim. 410 ativo reinicia automaticamente na página 1 sem snapshot, sob autoridade de leitura do Provider; 410 cancelado/obsoleto não muda detalhe, conteúdo ou posição. Automatic append nunca move foco nem scroll.

## Limites da aprovação

A aprovação ratifica a paleta proposta antes do código visual, mas **não** é o juízo humano de SM-2 sobre screenshots que ainda não existem. 2.2 conserva essa parte como hitl; não marcar SM-2 como comprovado sem avaliação real da pessoa responsável. Não declarar conformidade WCAG completa, testes humanos de tecnologia assistiva ou carregamento real de comentários a partir da baseline limitada. O histórico de aprovação de outros artefatos não é aceite desta feature.

As fontes anteriores mantêm suas suposições originais como registro histórico; este documento é a decisão posterior que as ratifica para esta árvore. Não há novos requisitos ou decisões de produto inferidos silenciosamente neste registro.
