# HN Modernização — Produzindo Certo

Leitor somente leitura do Hacker News, com uma SPA React servida pelo Vite em desenvolvimento e pelo servidor Fastify em produção, junto à API em `/api`.

- Seis categorias: Top, New, Best, Ask, Show e Jobs.
- Paginação explícita por snapshot, com preservação da categoria, das páginas e da rolagem ao voltar de uma história.
- Detalhes e árvore de comentários recolhível; HTML sanitizado no servidor e marcadores neutros para comentários removidos ou mortos.
- Temas claro/escuro, preferência inicial do sistema e escolha manual por sessão da aba.
- Navegação por teclado, foco visível, layout responsivo e verificações locais de acessibilidade.

Não inclui login, votos, publicação de comentários ou busca indexada. O filtro local de títulos é opcional e não foi implementado.

## Pré-requisitos

- Node.js 24 ou superior e npm (incluído na instalação do Node.js).
- Docker Engine com o plugin Docker Compose para executar a opção Compose.
- `curl` é opcional e usado nos exemplos de verificação HTTP.

Confira as versões antes de instalar as dependências:

```sh
node --version
npm --version
```

Execute os comandos npm na raiz do repositório. O projeto usa os workspaces `shared/` (contratos e utilitários compartilhados), `server/` (API Fastify) e `client/` (SPA React/Vite). `npm ci` instala as dependências conforme o `package-lock.json`.

## Configuração do ambiente

As variáveis do servidor e seus valores padrão estão em `.env.example`. Para criar uma cópia local sem sobrescrever um `.env` existente:

```sh
[ -f .env ] || cp .env.example .env
```

Node.js e os scripts npm **não carregam `.env` automaticamente**. Antes de executar a aplicação localmente, exporte as variáveis no shell atual:

```sh
set -a
. ./.env
set +a
```

Edite `.env` para ajustar os valores. O arquivo local não deve conter segredos versionados.

## Verificação

Instale as dependências e rode as verificações de tipos, regras de negócio e arquitetura:

```sh
npm ci
npm run check
```

`npm run check` executa o typecheck, o lint, os testes unitários e de integração com Vitest e a verificação de contraste dos temas. Para gerar os builds dos workspaces:

```sh
npm run build
```

### E2E e acessibilidade

Instale o Chromium gerenciado pelo Playwright na primeira execução e rode a suíte completa:

```sh
npx playwright install chromium
npm run e2e
```

`npm run e2e` recompila os três workspaces e sobe seu próprio servidor de teste em `127.0.0.1:4173`; deixe essa porta livre. A suíte percorre listagem, paginação, detalhes, comentários, temas, teclado/foco e responsividade. As quatro auditorias axe cobrem página inteira em listagem/detalhe e claro/escuro, com as regras padrão; violações críticas ou sérias fazem o teste falhar. Os resultados completos, incluindo verificações inconclusivas (`incomplete`), ficam nos anexos locais do Playwright.

Os testes de integração e as auditorias axe usam o BFF real com um upstream HN de fixtures locais, não a API pública. Há também testes UI específicos com respostas controladas no browser; eles não são apresentados como prova de integração pública. A aplicação normal usa a API pública HN pelo servidor.

Por decisão do usuário em 2026-10-12, o aceite obrigatório é **técnico automatizado**. Não foram realizados os aceites humanos em ambiente limpo ou com tecnologia assistiva; não se declara conformidade WCAG completa. O reflow de 200% é uma simulação tipográfica de teste, não zoom nativo do navegador. Resultados axe inconclusivos são reportados, não convertidos em aprovação irrestrita.

## Desenvolvimento local

Depois de instalar as dependências e, se necessário, carregar `.env` no shell conforme a seção de configuração:

```sh
npm run dev
```

O comando prepara `shared/` e inicia o servidor e o Vite. Abra <http://localhost:5173>; o Vite encaminha as chamadas `/api` ao servidor em `http://localhost:3000`. Para conferir a saúde diretamente:

```sh
curl -fsS http://127.0.0.1:3000/api/health
```

Encerre os processos de desenvolvimento com `Ctrl+C` no terminal em que `npm run dev` está rodando.

## Produção local

Com as dependências instaladas e as variáveis locais exportadas no shell, compile os workspaces e inicie o servidor:

```sh
npm run build
export NODE_ENV=production
npm start
```

O Fastify serve a SPA compilada e a API no mesmo processo, por padrão na porta `3000`. A variável `PORT` pode alterar essa porta nesta execução local. Abra <http://localhost:3000> e, em outro terminal, valide a API:

```sh
curl -fsS http://127.0.0.1:3000/api/health
```

Se `PORT` tiver outro valor, use essa porta no endereço. Para encerrar, use `Ctrl+C` no terminal do servidor.

## Docker Compose

O Compose constrói e executa um único serviço (`app`), que serve a SPA e a API juntos. Para compilar a imagem, iniciar o serviço e aguardar o healthcheck:

```sh
docker compose up --build --detach --wait
docker compose ps
```

A porta interna do contêiner é sempre `3000`; por padrão ela é publicada na porta `3000` do host. Verifique a API e a página SPA:

```sh
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/ >/dev/null && printf 'SPA OK\n'
```

Para usar outra porta no host, defina `HOST_PORT` (a porta do contêiner continua `3000`):

```sh
HOST_PORT=3333 docker compose up --build --detach --wait
curl -fsS http://127.0.0.1:3333/api/health
```

Para parar e remover o serviço e a rede do projeto Compose:

```sh
docker compose down
```

O Compose lê `.env` para interpolar variáveis do arquivo YAML, como `HOST_PORT`; isso **não** injeta automaticamente todas as variáveis de `.env` no contêiner. Atualmente, o serviço define `NODE_ENV=production` e `PORT=3000`; as demais configurações do servidor ficam com os valores padrão. A aplicação local, por sua vez, recebe apenas variáveis que foram exportadas para o shell.

## Processo SDLC

O inventário conciso das fontes de produto, design, arquitetura, histórias, implementação, verificações e aceite está em [Artefatos do SDLC](docs/sdlc-artifacts.md). Ele distingue arquivos rastreados de alterações locais, arquivos não rastreados e itens futuros; presença local não significa versionamento nem aceite. Para instalação, verificação e execução local ou via Compose, siga as instruções acima.

## Ferramentas do projeto

- **Grill me:** `claude plugin install mattpocock-skills@claude-plugins-official`
- **BMAD:** `npx skills add bmad-code-org/BMAD-METHOD`
