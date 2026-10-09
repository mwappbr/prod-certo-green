import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiErrorBody, ApiErrorCode } from '@hn/shared/contract/health';

// Único mapeador de erros (AD-7): toda falha sai no formato { error: { code, message } }.
function body(code: ApiErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function registerErrorHandlers(app: FastifyInstance, staticRoot: string): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      app.log.error(error);
      return reply.status(500).send(body('INTERNAL', 'Erro interno do servidor.'));
    }
    if (status === 404) {
      return reply.status(404).send(body('NOT_FOUND', 'Recurso não encontrado.'));
    }
    return reply.status(status).send(body('BAD_REQUEST', 'Requisição inválida.'));
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send(body('ROUTE_NOT_FOUND', 'Rota não encontrada.'));
    }
    // Demais rotas GET caem no index.html da SPA.
    if (request.method === 'GET') {
      return reply.sendFile('index.html', staticRoot);
    }
    return reply.status(404).send(body('ROUTE_NOT_FOUND', 'Rota não encontrada.'));
  });
}
