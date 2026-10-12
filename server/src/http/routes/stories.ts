import type { FastifyInstance } from 'fastify';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { AppError } from '../../app/errors.js';
import { getStories, type GetStoriesDependencies } from '../../app/get-stories.js';

export async function registerStoriesRoute(
  app: FastifyInstance,
  dependencies: GetStoriesDependencies,
): Promise<void> {
  app.get<{ Querystring: { category?: string; page?: string; limit?: string; snapshot?: string } }>(
    '/api/stories',
    async (request) => {
      const category = parseCategory(request.query.category ?? 'top');
      const page = parsePositiveInteger(request.query.page, 1, 'página');
      const limit = request.query.limit === undefined
        ? dependencies.defaultPageSize
        : parsePositiveInteger(request.query.limit, dependencies.defaultPageSize, 'limite');
      const snapshot = request.query.snapshot;
      if (snapshot !== undefined && typeof snapshot !== 'string') {
        throw new AppError('BAD_REQUEST', 'O parâmetro snapshot é inválido.', 400);
      }

      return getStories({ category, page, limit, ...(snapshot === undefined ? {} : { snapshot }) }, dependencies);
    },
  );
}

const storyCategories: readonly string[] = ['top', 'new', 'best', 'ask', 'show', 'job'];

function parseCategory(value: string): StoryCategory {
  if (!storyCategories.includes(value)) {
    throw new AppError('BAD_REQUEST', 'A categoria solicitada é inválida.', 400);
  }
  return value as StoryCategory;
}

function parsePositiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError('BAD_REQUEST', `O parâmetro ${label} é inválido.`, 400);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError('BAD_REQUEST', `O parâmetro ${label} é inválido.`, 400);
  }
  return parsed;
}
