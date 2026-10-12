import type { ListingItem, StoriesPage, StoryCategory } from '@hn/shared/contract/stories';
import type { NormalizedHnItem } from '../domain/normalize-item.js';
import type { Cache } from '../ports/cache.js';
import { HnRequestError, type HnClient } from '../ports/hn.js';
import { listCacheKey } from './cache-keys.js';
import { AppError, fromHnFailure } from './errors.js';
import { fetchItem } from './fetch-item.js';

export type GetStoriesDependencies = {
  cache: Cache;
  hn: HnClient<StoryCategory, NormalizedHnItem>;
  defaultPageSize: number;
  maxPageSize: number;
  listCacheTtlMs: number;
  itemCacheTtlMs: number;
};

type GetStoriesInput = {
  category?: StoryCategory;
  page?: number;
  limit?: number;
  snapshot?: string;
};

export async function getStories(
  input: GetStoriesInput,
  dependencies: GetStoriesDependencies,
): Promise<StoriesPage> {
  const category = input.category ?? 'top';
  const page = input.page ?? 1;
  const limit = input.limit ?? dependencies.defaultPageSize;
  const maxPageSize = dependencies.maxPageSize;
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new AppError('BAD_REQUEST', 'O parâmetro página é inválido.', 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxPageSize) {
    throw new AppError('BAD_REQUEST', `O limite deve estar entre 1 e ${maxPageSize}.`, 400);
  }
  if (page > 1 && input.snapshot === undefined) {
    throw new AppError('BAD_REQUEST', 'Informe o snapshot para continuar a paginação.', 400);
  }

  const key = listCacheKey(category);
  let ids: number[];
  let listCachedAt: string;
  let stale = false;

  if (input.snapshot !== undefined) {
    const snapshotList = dependencies.cache.getWithStaleness<number[]>(key);
    if (!snapshotList || snapshotList.cachedAt !== input.snapshot) {
      throw new AppError(
        'SNAPSHOT_EXPIRED',
        'A lista solicitada não está mais disponível. Atualize as histórias.',
        410,
      );
    }
    ids = snapshotList.value;
    listCachedAt = snapshotList.cachedAt;
    stale = snapshotList.expired;
  } else {
    const freshList = dependencies.cache.get<number[]>(key);
    if (freshList) {
      ids = freshList.value;
      listCachedAt = freshList.cachedAt;
    } else {
      const staleList = dependencies.cache.getWithStaleness<number[]>(key);
      try {
        const fetchedIds = await dependencies.hn.fetchList(category);
        const concurrentlyCachedList = dependencies.cache.get<number[]>(key);
        if (concurrentlyCachedList) {
          ids = concurrentlyCachedList.value;
          listCachedAt = concurrentlyCachedList.cachedAt;
        } else {
          const stored = dependencies.cache.set(
            key,
            fetchedIds,
            dependencies.listCacheTtlMs,
          );
          ids = stored.value;
          listCachedAt = stored.cachedAt;
        }
      } catch (error) {
        if (!(error instanceof HnRequestError)) throw error;
        if (!staleList) throw fromHnFailure(error.failure);
        ids = staleList.value;
        listCachedAt = staleList.cachedAt;
        stale = true;
      }
    }
  }

  const offset = (page - 1) * limit;
  const pageIds = offset >= ids.length ? [] : ids.slice(offset, offset + limit);
  const hasMore = offset + pageIds.length < ids.length;
  const itemDependencies = {
    cache: dependencies.cache,
    hn: dependencies.hn,
    itemCacheTtlMs: dependencies.itemCacheTtlMs,
  };
  const cachedItems = await Promise.all(pageIds.map((id) => fetchItem(id, itemDependencies)));
  const items: ListingItem[] = [];
  let cachedAt = listCachedAt;
  for (const result of cachedItems) {
    if (!result) continue;
    if (result.stale) stale = true;
    if (result.item.type === 'comment') continue;
    items.push(result.item);
    if (Date.parse(result.cachedAt) < Date.parse(cachedAt)) cachedAt = result.cachedAt;
  }

  return {
    items,
    page,
    limit,
    snapshot: listCachedAt,
    cachedAt,
    stale,
    hasMore,
  };
}
