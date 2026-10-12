---
id: 2
type: story
title: "Travessia limitada e sanitização de comentários"
parent: epic-historia-comentarios
covers: [RF-04, RF-06, RNF-03, RNF-10]
after: [1]
hitl: false
risk: high
---

# Travessia limitada e sanitização de comentários

## Description

Monta a árvore nível a nível com concorrência limitada, corta profundidade e nós explicitamente, reaproveita cache, deriva os estados neutros `[removido]` e `[morto]`, e sanitiza o texto HTML no domínio antes de gravar o modelo normalizado no cache.

## Acceptance Criteria

Verify: Testes locais com fixtures confirmam allowlist sem HTML ativo, marcador correto, sanitização já aplicada ao valor observado em `cache.set`, concorrência máxima, cache reaproveitado e `children` nulo ou `truncated` nos limites configurados.

## References

- parent — _bmad-output/initiative-hn-modernizacao/epic-historia-comentarios/epic-historia-comentarios.md

## Notes

- Assumption: usar `sanitize-html` em modo de parsing puro com allowlist de tags e atributos; verificar compatibilidade no servidor e preservar texto simples como texto.
- Assumption: profundidade padrão 8, máxima 20, limite de 500 nós, concorrência 8, timeout 5 s e uma retentativa limitada; alinhar com a configuração validada e com os valores medidos pelo epic-listagem.
- Risk check: revisão de segurança independente confirma que conteúdo malicioso de fixture não chega ao cache ou navegador como HTML ativo.

## Entrega e verificação

- **Entrega:** travessia BFS é limitada por profundidade e orçamento de nós/IDs visitados, controla concorrência, interrompe e drena workers em falha, preserva truncamento parcial e sanitiza antes de gravar no cache.
- **Paths:** `server/src/app/comments/`, `server/src/domain/`, testes `server/test/`.
- **Evidências:** fixture com 224 comentários exercitada em unidade/HTTP, valor sanitizado verificado no `cache.set`, limites e ciclos/IDs repetidos cobertos; focal 29/29 e Root check 97/97 em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/window-3-2-postreview.B1ebk1/`. QA pública/Compose final registra comentários servidos pelo BFF, limite de 500 nós no DOM, profundidade padrão 8 e truncamento em `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-local-validation.json` e `/Users/maurowidman/Projects/AI/prod-certo-green/verification/final-platform-qa.U5JP6P/main-compose-validation.json`.
- **Limites:** a segurança de sanitização foi validada com fixtures/revisão técnica, não certificação universal. A QA pública/Compose confirma o limite operacional observado, mas não constitui teste humano/AT ou WCAG.
- **Estado no plano:** permanece conforme a entrada correspondente; a profundidade padrão 8 e truncamento estão registrados sem alterar status.
