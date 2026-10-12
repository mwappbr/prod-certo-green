---
id: 7
type: story
title: "README com execução local e via Compose"
parent: epic-plataforma-base
covers: [RNF-08]
after: [3, 5, 6]
hitl: false
risk: low
---

# README com execução local e via Compose

## Description

README com execução local, execução via Compose e o comando `npm run check`, com validação técnica automatizada dos comandos disponíveis e limites explícitos.

## Acceptance Criteria

Verify (decisão de 2026-10-12): validar tecnicamente os comandos locais e o caminho Compose documentados, incluindo `npm run check`, build/E2E e smoke de `/api/health` quando executados, registrando saídas rastreáveis. Teste humano em ambiente limpo não é requisito nem é alegado; qualquer caminho ou resultado sem evidência continua pendente.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Notes

- Decision (2026-10-12): o aceite humano em ambiente limpo foi substituído por validação técnica automatizada. Não houve teste humano em ambiente limpo; a decisão também não exige AT ou declaração WCAG completa. A MAIN informa commit local `842bc98e78bc39adb20ee4fe4a041c7558ff20db` (98 paths de código/testes/configuração/README), sem push; `docs/` e `_bmad-output/` continuam não versionados.

## Entrega e verificação

- **Entrega:** README documenta execução local, Compose e `npm run check`; a MAIN verificou documentalmente e validou tecnicamente os dois caminhos finais, sem exigir teste humano em ambiente limpo.
- **Evidências:** `README.md`, `Dockerfile`, `docker-compose.yml`, `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` (npm start público: seis categorias, página 2/snapshot estável, comentários via BFF e 16 PNGs abertos) e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json` (build sem cache, três workspaces, aplicação healthy, um serviço, loopback e sem volumes).
- **Limites:** evidência técnica local/Compose, não teste humano em ambiente limpo. A MAIN reporta commit local `842bc98e78bc39adb20ee4fe4a041c7558ff20db` com 98 paths, incluindo README, sem push; `docs/` e `_bmad-output/` ainda aguardam versionamento/commit real.
- **Estado no plano:** permanece conforme a entrada correspondente; entrega técnica 1.7 verificada, sem alteração de status nesta folha.
