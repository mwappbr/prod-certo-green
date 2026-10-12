import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';

describe('MemoryCache', () => {
  it('serves fresh entries, retains expired entries for stale fallback, then prunes them', () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 100, now: () => now });
    const value = { id: 1, type: 'story' as const, title: 'normalized' };

    expect(cache.set('item:1', value, 50)).toMatchObject({ cachedAt: '2023-11-14T22:13:20.000Z', expired: false });
    expect(cache.get<typeof value>('item:1')?.value).toEqual(value);
    expect(cache.size()).toBe(1);

    now += 50;
    expect(cache.get('item:1')).toBeUndefined();
    expect(cache.getWithStaleness('item:1')).toMatchObject({ value, expired: true });
    expect(cache.size()).toBe(1);

    now += 100;
    expect(cache.getWithStaleness('item:1')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('prunes entries past stale retention while new values are cached', () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10, now: () => now });
    cache.set('item:old', { id: 1 }, 1);
    now += 12;

    cache.set('item:new', { id: 2 }, 100);
    expect(cache.getWithStaleness('item:old')).toBeUndefined();
    expect(cache.size()).toBe(1);
  });

  it('rejects invalid TTL values', () => {
    const cache = new MemoryCache({ staleRetentionMs: 100 });
    expect(() => cache.set('item:1', {}, 0)).toThrow(RangeError);
    expect(() => cache.set('item:1', {}, Number.NaN)).toThrow(RangeError);
  });
});
