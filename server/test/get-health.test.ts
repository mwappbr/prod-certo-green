import { describe, expect, it } from 'vitest';
import { getHealth } from '../src/app/getHealth.js';
import type { Cache, CacheEntry } from '../src/ports/cache.js';

describe('getHealth', () => {
  it('reports the current cache size through its port', () => {
    const cache: Cache = {
      size: () => 12,
      get: <T>() => undefined as CacheEntry<T> | undefined,
      getWithStaleness: <T>() => undefined as CacheEntry<T> | undefined,
      set: <T>(_key: string, value: T) => ({ value, cachedAt: '2026-10-11T00:00:00.000Z', expired: false }),
    };

    expect(getHealth(cache)).toEqual({
      status: 'ok',
      cache: { entries: 12 },
    });
  });
});
