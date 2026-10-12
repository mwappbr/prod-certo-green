---
id: 6
type: story
title: "Dockerfile e Compose com um serviço"
parent: epic-plataforma-base
covers: [RNF-08]
after: [1, 2]
hitl: false
risk: medium
---

# Dockerfile e Compose com um serviço

## Description

Dockerfile e docker-compose.yml com um serviço que serve a API e o SPA compilado, copiando shared, server e client; a porta 3000 e o caminho do build ficam documentados no próprio arquivo.

## Acceptance Criteria

Verify: docker compose up sobe a aplicação em ambiente limpo e /api/health responde.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** Dockerfile e Compose de um serviço servem API e SPA compilada; o contexto exclui `.env` aninhados e mantém o `.env.example` da raiz. A MAIN corrigiu a cópia ausente do bridge (`*.mjs` e `*.d.mts`), revisão incluída no commit local `9ef867b23e0515cba8dd936f1740e55f446c50d9` (um arquivo/linha).
- **Paths:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`.
- **Evidências:** verificação Compose final em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`: build sem cache dos três workspaces, aplicação healthy, um serviço, loopback, sem volumes, seis categorias, página 2/snapshot estável, árvore de 500 comentários com profundidade padrão 8 e truncamento, 16 PNGs abertos pela MAIN e limpeza independente limitada aos recursos de propriedade da execução. A execução local pública está em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json`.
- **Limites:** QA técnica automatizada; não houve teste humano em ambiente limpo, AT, reflow nativo ou avaliação WCAG completa, que não são requisitos após a decisão registrada.
- **Estado no plano:** permanece conforme a entrada correspondente; o caminho Compose final já tem evidência técnica, e esta folha não altera status.
