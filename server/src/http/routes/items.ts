import type { FastifyInstance } from 'fastify';
import type { ItemResponse } from '@hn/shared/contract/stories';
import { AppError } from '../../app/errors.js';
import { getComments, type GetCommentsDependencies } from '../../app/comments/get-comments.js';
import { getItem } from '../../app/get-item.js';

export async function registerItemsRoute(
  app: FastifyInstance,
  dependencies: GetCommentsDependencies,
): Promise<void> {
  app.get<{ Params: { id: string } }>('/api/items/:id', async (request) => {
    const id = parseItemId(request.params.id);
    const result = await getItem(id, dependencies);
    const response: ItemResponse = {
      item: result.item,
      cachedAt: result.cachedAt,
      stale: result.stale,
    };
    return response;
  });

  app.get<{ Params: { id: string }; Querystring: { depth?: string } }>(
    '/api/items/:id/comments',
    async (request) => {
      const id = parseItemId(request.params.id);
      const depth = parsePositiveInteger(request.query.depth, dependencies.commentsDefaultDepth);
      if (depth > dependencies.commentsMaxDepth) {
        throw new AppError(
          'BAD_REQUEST',
          `A profundidade deve estar entre 1 e ${dependencies.commentsMaxDepth}.`,
          400,
        );
      }
      return getComments(id, depth, dependencies);
    },
  );
}

export function parseItemId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new AppError('BAD_REQUEST', 'O ID do item é inválido.', 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError('BAD_REQUEST', 'O ID do item é inválido.', 400);
  }
  return parsed;
}

export function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new AppError('BAD_REQUEST', 'O parâmetro depth é inválido.', 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError('BAD_REQUEST', 'O parâmetro depth é inválido.', 400);
  }
  return parsed;
}
