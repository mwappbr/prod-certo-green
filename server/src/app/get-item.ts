import type { ItemResponse } from '@hn/shared/contract/stories';
import { AppError } from './errors.js';
import { fetchItem, type FetchItemDependencies } from './fetch-item.js';

export async function getItem(id: number, dependencies: FetchItemDependencies): Promise<ItemResponse> {
  const result = await fetchItem(id, dependencies);
  if (!result) {
    throw new AppError('NOT_FOUND', 'O item solicitado não foi encontrado.', 404);
  }

  return {
    item: result.item,
    cachedAt: result.cachedAt,
    stale: result.stale,
  };
}
