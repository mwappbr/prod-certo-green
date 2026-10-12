import type { Cache, CacheEntry } from '../../ports/cache.js';

type StoredEntry = {
  value: unknown;
  cachedAt: string;
  expiresAt: number;
  staleUntil: number;
};

type MemoryCacheOptions = {
  staleRetentionMs: number;
  now?: () => number;
};

/** Process-local TTL cache; only application use cases should call its data methods. */
export class MemoryCache implements Cache {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly staleRetentionMs: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions) {
    if (!Number.isFinite(options.staleRetentionMs) || options.staleRetentionMs < 0) {
      throw new RangeError('Stale retention must be a non-negative finite number.');
    }
    this.staleRetentionMs = options.staleRetentionMs;
    this.now = options.now ?? Date.now;
  }

  size(): number {
    this.prune();
    return this.entries.size;
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = this.now();
    if (now >= entry.staleUntil) {
      this.entries.delete(key);
      return undefined;
    }
    if (now >= entry.expiresAt) return undefined;
    return { value: entry.value as T, cachedAt: entry.cachedAt, expired: false };
  }

  getWithStaleness<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = this.now();
    if (now >= entry.staleUntil) {
      this.entries.delete(key);
      return undefined;
    }
    return {
      value: entry.value as T,
      cachedAt: entry.cachedAt,
      expired: now >= entry.expiresAt,
    };
  }

  set<T>(key: string, value: T, ttlMs: number): CacheEntry<T> {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('Cache TTL must be a positive finite number.');
    }
    this.prune();
    const now = this.now();
    const entry: StoredEntry = {
      value,
      cachedAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs,
      staleUntil: now + ttlMs + this.staleRetentionMs,
    };
    this.entries.set(key, entry);
    return { value, cachedAt: entry.cachedAt, expired: false };
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.staleUntil) this.entries.delete(key);
    }
  }
}
