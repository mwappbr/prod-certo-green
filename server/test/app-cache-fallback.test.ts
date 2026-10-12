import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { normalizeHnItem, type NormalizedHnItem } from '../src/domain/normalize-item.js';
import { fetchItem } from '../src/app/fetch-item.js';
import { getStories, type GetStoriesDependencies } from '../src/app/get-stories.js';
import { itemCacheKey, listCacheKey } from '../src/app/cache-keys.js';
import type { Cache, CacheEntry } from '../src/ports/cache.js';
import { HnRequestError, type HnClient } from '../src/ports/hn.js';
import type { StoryCategory } from '@hn/shared/contract/stories';

const story = (id: number, title: string): NormalizedHnItem => normalizeHnItem({ id, kind: 'story', title });

function dependencies(cache: Cache, hn: HnClient<StoryCategory, NormalizedHnItem>): GetStoriesDependencies {
  return {
    cache,
    hn,
    defaultPageSize: 1,
    maxPageSize: 50,
    listCacheTtlMs: 100,
    itemCacheTtlMs: 100,
  };
}

function failingWriteCache(cache: MemoryCache): Cache {
  return {
    size: () => cache.size(),
    get: <T>(key: string) => cache.get<T>(key),
    getWithStaleness: <T>(key: string) => cache.getWithStaleness<T>(key),
    set: <T>(_key: string, _value: T, _ttlMs: number): CacheEntry<T> => {
      throw new Error('cache write failed');
    },
  };
}

describe('stale cache fallback boundaries', () => {
  it('does not hide non-HN errors behind a stale list', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    cache.set(listCacheKey('top'), [1], 1);
    now += 2;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { throw new Error('unexpected adapter failure'); },
      fetchItem: async () => story(1, 'stale'),
    };

    await expect(getStories({ category: 'top', limit: 1 }, dependencies(cache, hn)))
      .rejects.toThrow('unexpected adapter failure');
  });

  it('does not return stale data when writing the refreshed list fails', async () => {
    let now = 1_700_000_000_000;
    const backing = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    backing.set(listCacheKey('top'), [1], 1);
    backing.set(itemCacheKey(1), story(1, 'stale'), 1);
    now += 2;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => [2],
      fetchItem: async () => { throw new HnRequestError('unavailable', 'fixture failure'); },
    };

    await expect(getStories({ category: 'top', limit: 1 }, dependencies(failingWriteCache(backing), hn)))
      .rejects.toThrow('cache write failed');
  });

  it('does not hide non-HN item errors behind a stale item', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    cache.set(itemCacheKey(1), story(1, 'stale'), 1);
    now += 2;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => [],
      fetchItem: async () => { throw new Error('unexpected normalization failure'); },
    };

    await expect(fetchItem(1, { cache, hn, itemCacheTtlMs: 100 }))
      .rejects.toThrow('unexpected normalization failure');
  });

  it('does not hide item cache write failures behind a stale item', async () => {
    let now = 1_700_000_000_000;
    const backing = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    backing.set(itemCacheKey(1), story(1, 'stale'), 1);
    now += 2;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => [],
      fetchItem: async () => story(1, 'fresh'),
    };

    await expect(fetchItem(1, { cache: failingWriteCache(backing), hn, itemCacheTtlMs: 100 }))
      .rejects.toThrow('cache write failed');
  });

  it('marks filtered stale non-story items as stale without changing displayed-data age', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    cache.set(itemCacheKey(1), normalizeHnItem({ id: 1, kind: 'comment', bodyHtml: '<p>reply</p>' }), 1);
    now += 2;
    const listTime = cache.set(listCacheKey('top'), [1], 100).cachedAt;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { throw new Error('fresh list should be used'); },
      fetchItem: async () => { throw new HnRequestError('unavailable', 'fixture failure'); },
    };

    const page = await getStories({ category: 'top', limit: 1 }, dependencies(cache, hn));
    expect(page).toMatchObject({ items: [], stale: true, snapshot: listTime, cachedAt: listTime });
  });

  it('reports the oldest cached data timestamp when an item is stale', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    const itemTime = cache.set(itemCacheKey(1), story(1, 'stale'), 1).cachedAt;
    now += 2;
    const listTime = cache.set(listCacheKey('top'), [1], 100).cachedAt;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { throw new Error('fresh list should be used'); },
      fetchItem: async () => { throw new HnRequestError('unavailable', 'fixture failure'); },
    };

    const page = await getStories({ category: 'top', limit: 1 }, dependencies(cache, hn));
    expect(page).toMatchObject({ stale: true, snapshot: listTime, cachedAt: itemTime });
  });

  it('uses the same original ID sequence for later pages without refreshing the list', async () => {
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    let listCalls = 0;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { listCalls += 1; return [1, 2, 3]; },
      fetchItem: async (id) => story(id, `story-${id}`),
    };
    const deps = dependencies(cache, hn);

    const first = await getStories({ category: 'top', limit: 1 }, deps);
    const second = await getStories({ category: 'top', page: 2, limit: 1, snapshot: first.snapshot }, deps);

    expect(first.items.map((item) => item.id)).toEqual([1]);
    expect(second.items.map((item) => item.id)).toEqual([2]);
    expect(second.snapshot).toBe(first.snapshot);
    expect(listCalls).toBe(1);
  });

  it('serves a retained expired snapshot as stale without refreshing its list', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    const listTime = cache.set(listCacheKey('top'), [1, 2], 100).cachedAt;
    now += 101;
    let listCalls = 0;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { listCalls += 1; return [2, 1]; },
      fetchItem: async (id) => story(id, `story-${id}`),
    };

    const page = await getStories(
      { category: 'top', page: 2, limit: 1, snapshot: listTime },
      dependencies(cache, hn),
    );

    expect(page).toMatchObject({ items: [{ id: 2 }], snapshot: listTime, stale: true });
    expect(listCalls).toBe(0);
  });

  it('rejects snapshots that were replaced or removed after retention', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10, now: () => now });
    const replacedSnapshot = cache.set(listCacheKey('top'), [1, 2], 100).cachedAt;
    now += 1;
    const retainedSnapshot = cache.set(listCacheKey('top'), [3, 4], 100).cachedAt;
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => { throw new Error('continuation must not fetch a list'); },
      fetchItem: async (id) => story(id, `story-${id}`),
    };
    const deps = dependencies(cache, hn);

    await expect(getStories(
      { category: 'top', page: 2, limit: 1, snapshot: replacedSnapshot },
      deps,
    )).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });

    now += 111;
    await expect(getStories(
      { category: 'top', page: 2, limit: 1, snapshot: retainedSnapshot },
      deps,
    )).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
  });

  it('slices ID offsets before filtering unavailable items and reports raw-list continuation', async () => {
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    const ids = Array.from({ length: 60 }, (_value, index) => index + 1);
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => ids,
      fetchItem: async (id) => id === 15 ? null : story(id, `story-${id}`),
    };
    const deps = dependencies(cache, hn);

    const first = await getStories({ category: 'top', limit: 30 }, deps);
    const second = await getStories({ category: 'top', page: 2, limit: 30, snapshot: first.snapshot }, deps);
    const beyond = await getStories({ category: 'top', page: 3, limit: 30, snapshot: first.snapshot }, deps);

    expect(first.items).toHaveLength(29);
    expect(first.items.map((item) => item.id)).not.toContain(31);
    expect(first).toMatchObject({ page: 1, hasMore: true });
    expect(second.items.map((item) => item.id)).toEqual(ids.slice(30));
    expect(second).toMatchObject({ page: 2, hasMore: false });
    expect(beyond).toMatchObject({ page: 3, items: [], hasMore: false });
    expect(first).not.toHaveProperty('total');
  });

  it('reports more raw IDs when an intermediate page normalizes to no items', async () => {
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    const ids = Array.from({ length: 61 }, (_value, index) => index + 1);
    const hn: HnClient<StoryCategory, NormalizedHnItem> = {
      fetchList: async () => ids,
      fetchItem: async (id) => id >= 31 && id <= 60 ? null : story(id, `story-${id}`),
    };
    const deps = dependencies(cache, hn);

    const first = await getStories({ category: 'top', limit: 30 }, deps);
    const middle = await getStories({ category: 'top', page: 2, limit: 30, snapshot: first.snapshot }, deps);
    const last = await getStories({ category: 'top', page: 3, limit: 30, snapshot: first.snapshot }, deps);

    expect(first).toMatchObject({ page: 1, items: expect.any(Array), hasMore: true });
    expect(middle).toMatchObject({ page: 2, items: [], hasMore: true });
    expect(last).toMatchObject({ page: 3, items: [{ id: 61 }], hasMore: false });
  });
});
