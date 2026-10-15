# Experiência da home contínua

## Escopo aprovado
Home do HN Moderno nos seis feeds técnicos `top/new/best/ask/show/job` (Jobs na UI). Azul/violeta aprovados antes do código visual em 2026-10-13; [DESIGN.md](DESIGN.md) é a única interface de cores. Esta descrição não é evidência de implementação ou de aprovação humana das capturas finais.

## Jornada
1. A pessoa reconhece o feed pelo cabeçalho azul e pelo tab violeta com indicador não cromático. A faixa continua acessível no celular; metadados, fontes e títulos permanecem legíveis em área neutra.
2. A rolagem descendente real se aproxima da sentinela. O próximo lote usa o comando existente e o limite negociado. Um episódio solicita no máximo um lote; nenhuma cascata por layout, observer recriado ou retorno.
3. Notícias anteriores mantêm ordem/IDs/posição. O automático não move foco/scroll. Estado adicional é identificado ao final; o status anuncia delta, não a lista inteira nem região busy.
4. “Carregar mais” continua disponível sem exigir gestos. Foco nos controles após a lista protege seu acesso e cancela carga automática em voo; carga manual é permitida. Foco em controles anteriores à lista não bloqueia por si só.
5. “Pausar automático” mantém a pausa junto à sequência. “Retomar automático” altera a vontade da pessoa, não ignora erro, disponibilidade desconhecida, vazio ou foco protegido. Depois de sair deliberadamente do foco protegido é necessário um novo gatilho real.
6. Falha incremental conserva notícias e apresenta texto/“Tentar novamente” para repetir a mesma continuação. Página vazia/só duplicados avança cursor, mas não dispara outro automático; desconhecido mantém fallback. Apenas fim confirmado apresenta “Você chegou ao fim” e encerra pedidos.
7. Abrir detalhe cancela todas as continuações e conserva páginas/política na mesma sessão. Voltar por histórico ou botão restaura categoria/posição sob Provider antes de reabrir observação. Uma expiração ativa reinicia página 1 e anuncia; resposta expirada cancelada não altera o detalhe.

## Teclado e foco
Preservar tabs, `ol/li`, links genuínos e navegação existente. A ação manual de teclado pode revelar/restaurar o botão se ele ainda detiver foco, incluindo retry. Tab/rota/perda de foco invalida esse efeito. Nunca transferir foco à primeira notícia nova. Alvos mínimos de 44px, foco visível e nomes textuais; cores não são o único sinal.

## Mobile, desktop e temas
Coluna de leitura existente, gutter 16px no celular e faixa interna rolável sem overflow da página. Capturar a home a 360px e desktop em claro/escuro. Preferência por aba e sistema continuam existentes. Reduced motion desliga animação de skeleton e nenhum movimento novo é necessário.

## Avaliação
- Técnica por história: pedidos/tupla/ID/demanda/cancelamento, retorno, foco, erro/retry/fim, contraste/axe/targets/overflow e regressão do detalhe.
- Integração: bundle produzido em Node ≥24 e smoke com API HN pública, distinguindo fixtures de dados reais.
- Humana: SM-2 (“claramente mais colorida” em celular/desktop) fica pendente até a pessoa avaliar screenshots reais; não inferir da paleta previamente aprovada. Não prometer conformidade completa ou teste humano assistivo.

## Referências
[Decisões aprovadas](../decisions-approved.md), [PRD](../../initiative-hn-modernizacao/prd-home-scroll-infinito-e-cores/prd-home-scroll-infinito-e-cores.md) e [arquitetura](../../initiative-hn-modernizacao/architecture-home-scroll-infinito-e-cores/architecture-home-scroll-infinito-e-cores.md).
