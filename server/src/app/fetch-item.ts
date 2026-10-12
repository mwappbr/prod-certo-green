import type { HnItem, StoryCategory } from '@hn/shared/contract/stories';
import type { NormalizedHnItem } from '../domain/normalize-item.js';
import { fromHnFailure } from './errors.js';
import { itemCacheKey } from './cache-keys.js';
import type { Cache } from '../ports/cache.js';
import { HnRequestError, type HnClient } from '../ports/hn.js';

export interface FetchItemDependencies {
  cache: Cache;
  hn: HnClient<StoryCategory, NormalizedHnItem>;
  itemCacheTtlMs: number;
}

export interface CachedHnItem {
  item: HnItem;
  childIds: number[];
  cachedAt: string;
  stale: boolean;
}

function cachedItem(value: NormalizedHnItem, cachedAt: string, stale: boolean): CachedHnItem {
  if (value.type === 'comment') {
    return {
      item: { ...value, cachedAt },
      childIds: [...value.kids],
      cachedAt,
      stale,
    };
  }

  const { childIds, ...publicItem } = value;
  return {
    item: { ...publicItem, cachedAt } as HnItem,
    childIds: [...childIds],
    cachedAt,
    stale,
  };
}

export async function fetchItem(
  id: number,
  dependencies: FetchItemDependencies,
): Promise<CachedHnItem | null> {
  if (!Number.isInteger(id) || id < 0) return null;
  const key = itemCacheKey(id);
  const fresh = dependencies.cache.get<NormalizedHnItem>(key);
  if (fresh) return cachedItem(fresh.value, fresh.cachedAt, false);

  const stale = dependencies.cache.getWithStaleness<NormalizedHnItem>(key);
  try {
    const value = await dependencies.hn.fetchItem(id);
    if (!value) return null;
    const stored = dependencies.cache.set(key, value, dependencies.itemCacheTtlMs);
    return cachedItem(stored.value, stored.cachedAt, false);
  } catch (error) {
    if (!(error instanceof HnRequestError)) throw error;
    if (stale) return cachedItem(stale.value, stale.cachedAt, true);
    throw fromHnFailure(error.failure);
  }
}
