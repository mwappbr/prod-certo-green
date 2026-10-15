# Validação da árvore formal

Data: 2026-10-13. Escopo: Ticket/Set/Dependencies dos dois epics e Tree/Dependencies da iniciativa, conforme `.claude/skills/bmad-ticket/references/validate.md` e `validate-checks.md`.

## Proveniência e limite

O plano amplo recebeu três verificações independentes de rascunho antes da aprovação: epic de scroll, epic de cores e iniciativa, todas PASS, conforme o registro herdado da sessão e a seção “Validação prévia do rascunho” do plano aprovado. A aprovação real veio do resultado de `ExitPlanMode`, não de uma notificação de agente.

Esta conferência da árvore escrita foi executada **diretamente pelo fork responsável pela formalização**. Não é nova rodada independente: forks não podem lançar subagentes. A conferência não mudou o corte/order/scope aprovado; tornou explícitos os handoffs, a responsabilidade compartilhada em NFR-2 e o componente humano já exigido por SM-2. Não substitui review de código, validação de critérios do build, testes ou Closure.

## Ticket / Set — PASS

- Entradas 1.1/1.2/2.1/2.2 têm descrição e verificação executável, IDs estáveis e nenhuma estimativa inventada, placeholder, `status` ou `unknown` de bloqueio no TOML.
- IDs dos filhos pertencem ao `covers` de seus epics; a união dos filhos corresponde à cobertura de cada epic.
- 1.1 é o tracer vertical seguro de scroll/API/projeção; 1.2 consome a sequência/escopo/comando e entrega estados/controles; 2.1 é o tracer visual com tokens e consumidores juntos; 2.2 é fechamento integrado.
- Guardas de navegação/cancelamento são parte de 1.1, não trabalho inseguro adiado; recuperação/retorno/pausa/announcements são completados em 1.2.
- Cada história conserva testes/review próprios. Ambos os epics têm duas entradas, portanto o sweep obrigatório de epic com mais de três entradas não se aplica.
- Margens/flags locais são anotadas como escolhas de implementação livres, não como pergunta pendente. O componente humano de SM-2 é identificado em 2.2 por `hitl = true`; não cria nova pergunta de escopo nem representa aceite já ocorrido.

## Tree — PASS

- Cobertura total: FR-1–FR-7 e NFR-1–NFR-3, sem deferral.
- Epic 1: FR-1–FR-5, NFR-2 comportamental, NFR-3 implementação/limites.
- Epic 2: FR-6–FR-7, NFR-1, NFR-2 visual; sua entrada 2.2 verifica integração também do epic 1 sem transferir propriedade de implementação.
- Envelope de cada container tem Outcome, 3–6 checks Done when, boundaries, refs e decisões; delivery significa bundle de produção local, sem inferir autorização de deploy/publicação externa.
- Contratos/servidor/transporte/tema/test tooling/documentação têm touch points e donos; novas dependências, persistência, infraestrutura, virtualização e redesenho do detalhe estão fora do escopo.
- Não há leaf diretamente sob a iniciativa. Não foi criado epic de plataforma: decisão aprovada de reaproveitar baseline/scaffold/ferramentas existente.
- Políticas compartilhadas têm home na arquitetura ratificada e em `decisions-approved.md`; A1, A2, AD-2/4/5/6 e a tabela exata foram registrados sem reescrever as fontes históricas.

## Dependencies — PASS

| Consumidor | Provider | Necessidade real |
| --- | --- | --- |
| 1.2 | 1.1 | Sequência, comando/lock, escopo, detector e guardas base; mesmos arquivos de estado/UI/Provider. |
| 2.1 | 1.2 | Estados/semântica/estrutura de controles estabilizados; consumidores/CSS/UI compartilhados. |
| 2.2 | 1.2 e 2.1 | Implementações e evidências de continuação/retorno e UX/cores para seu aceite integrado. |

Nenhuma lane concorrente disputa código/config/setup. A iniciativa declara o provider do epic 2 e todas as entradas consumidoras usam `after` pinado em 1.2, sem whole-epic gate desnecessário. Não há prerequisite inventado só para espelhar sequência.

## Comandos e resultados observados

`uv run .claude/skills/bmad-ticket/scripts/tickets.py --project-root /Users/maurowidman/Projects/AI/prod-certo-green status /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores`

- Total 4; 1.1 draft/backlog porque o coordenador já escreveu seu plano; outros três planned.
- Longest remaining chain: 1.1 → 1.2 → 2.1 → 2.2.
- `unpinned_after`, `undeclared_after`, `order_conflict`: arrays vazios; nenhum `problems`, ciclo ou `drift` reportado.
- Cada epic tem `next_id = 3`.

`uv run .claude/skills/bmad-ticket/scripts/tickets.py --project-root /Users/maurowidman/Projects/AI/prod-certo-green next /Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-home-scroll-infinito-e-cores`

- `ready_to_start`: 1.1.
- `ready_to_refine` e `in_progress`: vazios naquele momento.
- 1.2 aguarda 1; 2.1 aguarda 1.2; 2.2 aguarda 1.2 e 1 do seu epic. São os bloqueios de dependência esperados, não erros da árvore.

Também executados `status` com caminho explícito de cada epic e uma checagem Python de TOML: duas entradas por epic, cobertura resolve, nenhum status/unknown no TOML, checkpoints falsos, 27 arquivos de referência existem. Todas as verificações passaram. UX futura é descrita como entrega de 2.1, não referência a arquivo ausente.

## Estado e riscos que não foram fechados

Nenhum código, configuração ativa, plano de build, estado de ticket, fonte histórica ou artefato excluído foi alterado pelo fork; foram criados apenas os oito arquivos de formalização sob a nova iniciativa. O plano draft 1.1 é de autoria do coordenador e foi considerado, não modificado. Não houve commit, push ou publicação em tracker/serviço externo.

Este PASS permite ler/executar a árvore aprovada, **não comprova a implementação**. SM-2 ainda exige avaliação humana real dos screenshots desktop/celular; não há autorização para inventá-la nem alegar conformidade WCAG completa. Testes/smoke finais continuam sendo obrigações dos builds e do fechamento, não resultados desta formalização.
