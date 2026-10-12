---
id: 2
type: story
title: "Configuração por variável de ambiente validada"
parent: epic-plataforma-base
covers: [RNF-07]
after: [1]
hitl: false
risk: low
---

# Configuração por variável de ambiente validada

## Description

Lê e valida variáveis de ambiente só em server/src/config, com Zod e um .env.example, e falha na inicialização com valor inválido (AD-9).

## Acceptance Criteria

Verify: Iniciar com uma variável inválida falha com mensagem clara; com valores válidos, o serviço sobe.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-plataforma-base/epic-plataforma-base.md

## Entrega e verificação

- **Entrega:** configuração centralizada em `server/src/config/index.ts`, com validação Zod e exemplo em `.env.example`; a revisão tratou `PORT` inválida e `HN_RETRIES` vazio sem confundir vazio com zero explícito.
- **Paths:** `server/src/config/index.ts`, `.env.example`.
- **Evidências:** a MAIN relata smoke em Node 24.21.0 com valores válidos/inválidos, defaults e builds/typecheck; ver `/Users/maurowidman/Projects/AI/prod-certo-green/_bmad-output/initiative-hn-modernizacao/execution-progress.md` (entradas de 1.2 e Root posterior).
- **Limites:** não foram lidos valores de segredo nesta atualização; testes de configuração não demonstram leitura de `.env` real nem ambiente limpo.
- **Estado no plano:** permanece conforme a entrada correspondente; esta folha apenas referencia as verificações técnicas e não altera status.
