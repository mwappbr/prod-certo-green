# Gate — resolução dos achados

2026-10-13. Registro de triagem do coordenador após os relatórios independentes; não é uma segunda rodada independente nem execução do produto.

| Origem | Achado | Resolução na espinha |
| --- | --- | --- |
| Reconciliação PRD | Informação de notícias não explicitamente preservada | AD-7 preserva título, origem e demais informações. |
| Rubrica | Sinal de nova rolagem/rearmamento ambíguo | AD-2 define saída/reentrada ou deslocamento positivo causado por entrada posterior ao commit; exclui layout/restore e fila de sinais busy. |
| Adversarial P1 | Pedido manual em voo ao entrar no detalhe | AD-5 cancela toda continuação incremental, manual/auto, preservando páginas/cursor. |
| Adversarial P1 | Restore/foco/gate sem transição compartilhada | AD-2/5/6 fixam dono, origens, escopo por sequência/ciclo e ordem de leitura pronta após restauração efetiva e foco confirmado. |
| Adversarial P2 | Nomes de tokens escolhidos independentemente | AD-7 fixa nomes existentes e exige tabela única de novos tokens antes de separar consumidores. |
| Versões/reality check | Sem achados concretos | Seed do lockfile e compatibilidade confirmados; nenhuma atualização de dependência. |

Todos os achados receberam correção explícita. Os relatórios individuais registram a versão anterior a essas correções. O lint final é executado sobre a espinha corrigida.

**Condições mantidas, não aprovações:** A1 antes de fatiar; A2/paleta antes de código visual; nomes novos antes de separar tokens/consumidores; AD-2/4/5/6 propostos antes do build, ao adotar a spec. Nenhum bloqueador aberto para produzir a spec. Node local abaixo do requisito; app/testes, contraste e conformidade WCAG não foram verificados nesta entrega.
