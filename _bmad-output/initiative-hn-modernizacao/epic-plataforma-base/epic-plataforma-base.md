---
tracker_id: ""
key: ""
type: epic
status: done
title: "Base da plataforma"
parent: initiative-hn-modernizacao
covers: [RNF-05, RNF-06, RNF-07, RNF-08]
after: []
assignee: ""
risk: medium
---

# Base da plataforma

## Description

Um repositório com um serviço Fastify que serve `/api` e o SPA compilado, executável localmente e via Docker Compose, com as regras de dependência e os testes prontos para os épicos seguintes. Este épico não entrega funcionalidade para o leitor; entrega o chão em que as demais funcionalidades são construídas.

## Outcome

O time consegue rodar a aplicação em ambiente limpo, com um endpoint de saúde e uma página vazia, e cada épico seguinte sabe onde colocar código e como testá-lo.

## Requirements

Este épico não cobre requisitos do PRD diretamente; cumpre os requisitos de plataforma citados nas referências abaixo.

- RNF-05: TypeScript estrito no cliente e no servidor (PRD seção 6.3)
- RNF-06: testes unitários e ao menos um de integração (PRD seção 6.3)
- RNF-07: configuração por variável de ambiente (PRD seção 6.4)
- RNF-08: README e Docker Compose (PRD seção 6.4)

## Done when

1. `docker compose up` sobe a aplicação em execução técnica isolada e `/api/health` responde. Conforme a decisão humana de 2026-10-12 na iniciativa, o aceite obrigatório é técnico automatizado; não afirmar teste humano em ambiente limpo.
2. O SPA compilado é servido pelo mesmo processo que a API, sem segundo serviço.
3. A regra de dependência do AD-1 é verificada pelo script de verificação e falha quando violada.
4. Configuração vem só de variáveis de ambiente, lidas apenas em `server/src/config` (AD-9).
5. O script de verificação (`npm run check`) roda os testes unitários, o teste de integração, o lint e o typecheck, e passa.

## Boundaries

A estrutura do repositório, o servidor, o build, o empacotamento e o CI. Não inclui nenhuma tela de história ou listagem. Este épico é dono de `server/src/config`, do build e do Compose.

## References

- prd — prd-hn-modernizacao/prd-hn-modernizacao.md, seções 6.3 e 6.4
- architecture — architecture-hn-modernizacao/architecture-hn-modernizacao.md, seções Pilha, Seed estrutural, AD-1, AD-9, AD-10
- constraint — PRD seção 8, restrições e premissas

## Notes

- Decision: sem CI no MVP; a verificação roda por script local. Onde a arquitetura diz "rodado em CI" (AD-1), vale o script (user's decision, 2026-10-09).
- Decision: gerenciador de pacotes é npm com workspaces (user's decision, 2026-10-09).
- Decision: Zod é dono da entrada de configuração (user's decision, 2026-10-09); a listagem reutiliza.
- Decision: os artefatos do SDLC (O-05) são entregues por uma entrada final, depois da documentação (user's decision, 2026-10-09).
- Decision: o build e os testes rodam no Node 26.10.0 local, e não no Node 24 LTS que a arquitetura fixa (user's decision, 2026-10-09).
- Decision: a raiz de composição (`server/src/main.ts`) é isenta da regra de AD-1 e pode importar o adaptador de cache; o lint da entrada 1.3 precisa permitir isso (user's decision, 2026-10-09).
- Decision: a verificação de `npm run dev` na porta 5173 fica pendente e foi aceita pelo usuário; o proxy foi verificado na 5174 (user's decision, 2026-10-09).
- Tracer: entrada 1 (serviço com `/api/health` e SPA vazia no mesmo processo).
- Decision: entrega do MVP é local e por Docker Compose; hospedagem em produção fica para depois do MVP (user's decision, 2026-10-09; architecture, seção Adiado).
- Decision: tokens de tema (cores, contraste) são definidos neste épico, antes das telas, para que listagem e história já os usem (user's decision, 2026-10-09).
- Decision: Node 24 LTS é a linha da pilha; a reavaliação para o Node 26 em 28/10/2026 é decisão de pilha, sem efeito nas ADs (architecture, seção Adiado).
- Decision: 2026-10-12 — a incerteza histórica sobre Zod, sanitizador e ESLint foi resolvida na implementação: Zod 4.6.6 valida entradas/configuração; sanitize-html 2.18.0 sanitiza antes do cache; ESLint 9.39.5 impõe AD-1. `npm run check` final em Node 24.21.0/TypeScript 7.0.2 passou com 121 testes/20 arquivos, typechecks e lint oficial do servidor (`verification/window-4-4-postreview.zvlN6U/`). Verifica a configuração executada, sem alegar compatibilidade irrestrita futura.
- Decision: React fica na linha 19.2; a troca para a 19.3 fica para depois do MVP (architecture, seção Adiado).
- Execução técnica posterior, 2026-10-12: runtime efetivo Node 24.21.0/npm 11.19.0 nas janelas Root e uso real; não afirmar execução deste aceite em Node 26. O smoke final `npm run dev` passou na URL documentada `localhost:5173`, com proxy health200, Top/Jobs30 e tema (`verification/final-platform-qa.U5JP6P/main-dev-validation.json`), superando a pendência histórica da porta5173. Compilado `npm start` e Compose isolado também passaram; o teste humano em ambiente limpo NÃO ocorreu e deixou de ser gate obrigatório por decisão humana de2026-10-12.

## Fechamento técnico — 2026-10-12

- A MAIN/orquestradora conclui este container pelo atendimento dos cinco critérios de Done when, não apenas pela contagem de filhos. As nove histórias têm estado formal `done` nos planos oficiais, atualizado via `tickets.py mark` conforme a autorização de execução e fechamento.
- Done when 1–2: Compose isolado com um serviço `app`, sem volumes, build local, health200 e SPA/API no mesmo processo; seis categorias e detalhe foram usados no browser real. `npm start` compilado e `npm run dev` na URL documentada também passaram. Evidências compactas em `verification/final-platform-qa.U5JP6P/main-compose-validation.json`, `main-local-validation.json` e `main-dev-validation.json` no mesmo diretório.
- Done when 3–5: regras de dependência AD-1/probes negativos e configuração Zod centralizada em `server/src/config` registrados nas histórias 1.2/1.3; Root final `verification/window-4-4-postreview.zvlN6U/` passou com typechecks, lint oficial do servidor, 121 testes/20 arquivos e contraste dos tokens. Build dos três workspaces e 56 E2E também passaram.
- O-05: artefatos/processo versionados em `0598a96`, com reconciliação posterior efetivamente commitada em `d242943`; 1.9 foi formalizada antes de 1.8. Este fechamento complementa esses registros, sem reexecutar nem aprovar retroativamente os workflows/HALTs históricos.
- Limites: execução demonstrada em Node 24.21.0/macOS e container Linux arm64; não comprovados Node 26, Windows nativo nem teste humano em ambiente limpo. Recursos próprios de QA foram encerrados; sem push/publicação externa e sem remover recursos do usuário.
