export interface CacheEntry<T> {
  value: T;
  cachedAt: string;
  expired: boolean;
}

export interface Cache {
  size(): number;
  get<T>(key: string): CacheEntry<T> | undefined;
  getWithStaleness<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, value: T, ttlMs: number): CacheEntry<T>;
}
