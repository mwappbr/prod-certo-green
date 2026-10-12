import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { fetchItem } from '../src/app/fetch-item.js';
import { itemCacheKey } from '../src/app/cache-keys.js';
import { normalizeHnItem, type NormalizedHnItem } from '../src/domain/normalize-item.js';
import { HnRequestError, type HnClient } from '../src/ports/hn.js';
import type { StoryCategory } from '@hn/shared/contract/stories';

function hnClient(fetch: (id: number) => Promise<NormalizedHnItem | null>): HnClient<StoryCategory, NormalizedHnItem> {
  return { fetchList: async () => [], fetchItem: fetch };
}

describe('fetchItem internal child ID ownership', () => {
  it('returns retained root IDs privately from a fresh cached story and strips them from the public item', async () => {
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    const story = normalizeHnItem({ id: 1, kind: 'story', title: 'Story', childIds: [10, 11] });
    let calls = 0;
    const hn = hnClient(async () => { calls += 1; return story; });
    const dependencies = { cache, hn, itemCacheTtlMs: 100 };

    const first = await fetchItem(1, dependencies);
    const second = await fetchItem(1, dependencies);

    expect(first).toMatchObject({ childIds: [10, 11], stale: false, item: { type: 'story', id: 1 } });
    expect(first?.item).not.toHaveProperty('childIds');
    expect(second?.childIds).toEqual([10, 11]);
    expect(calls).toBe(1);
    expect(cache.size()).toBe(1);
    expect(cache.get<NormalizedHnItem>(itemCacheKey(1))?.value).toMatchObject({ childIds: [10, 11] });
  });

  it('retains child IDs from a stale cached story and keeps the public projection clean', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    const cached = normalizeHnItem({ id: 2, kind: 'story', title: 'Stale story', childIds: [20, 21] });
    const cachedAt = cache.set(itemCacheKey(2), cached, 10).cachedAt;
    now += 11;
    const hn = hnClient(async () => { throw new HnRequestError('unavailable', 'fixture failure'); });

    const result = await fetchItem(2, { cache, hn, itemCacheTtlMs: 100 });

    expect(result).toMatchObject({ childIds: [20, 21], cachedAt, stale: true });
    expect(result?.item).not.toHaveProperty('childIds');
  });

  it('preserves the job union and derives comment traversal IDs from existing public kids', async () => {
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    const job = normalizeHnItem({ id: 3, kind: 'job', title: 'Job', childIds: [30] });
    const comment = normalizeHnItem({ id: 4, kind: 'comment', childIds: [40, 41] });
    const entries = new Map([[3, job], [4, comment]]);
    const hn = hnClient(async (id) => entries.get(id) ?? null);
    const dependencies = { cache, hn, itemCacheTtlMs: 100 };

    const jobResult = await fetchItem(3, dependencies);
    const commentResult = await fetchItem(4, dependencies);

    expect(jobResult?.item).toMatchObject({ type: 'job', title: 'Job' });
    expect(jobResult?.childIds).toEqual([30]);
    expect(jobResult?.item).not.toHaveProperty('childIds');
    expect(commentResult).toMatchObject({ childIds: [40, 41], item: { type: 'comment', kids: [40, 41] } });
    expect(commentResult?.item).not.toHaveProperty('childIds');
  });
});
