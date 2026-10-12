import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { HnApiClient, type HnFetch } from '../src/adapters/hn/client.js';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { config } from '../src/config/index.js';
import { createServer } from '../src/main.js';
import type { StoryCategory } from '@hn/shared/contract/stories';
import type { Cache } from '../src/ports/cache.js';
import { startHnStub } from './helpers/hn-stub.js';

const staticRoot = fileURLToPath(new URL('../../', import.meta.url));
const apiPath = '/api/stories?category=top';

async function withApp<T>(
  hnClient: HnApiClient,
  action: (app: Awaited<ReturnType<typeof createServer>>) => Promise<T>,
  cache?: Cache,
) {
  const app = await createServer({ staticRoot, logger: false, hnClient, ...(cache ? { cache } : {}) });
  try {
    return await action(app);
  } finally {
    await app.close();
  }
}

describe('GET /api/stories', () => {
  it('returns the public shared envelope with normalized stories and caches repeated requests', async () => {
    const stub = await startHnStub();
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 4,
      });
      await withApp(hnClient, async (app) => {
        const first = await app.inject({ method: 'GET', url: apiPath });
        expect(first.statusCode).toBe(200);
        const body = first.json();
        expect(body).toMatchObject({ page: 1, limit: 30, stale: false, hasMore: false });
        expect(body.items).toHaveLength(2);
        expect(body.items[0]).toMatchObject({
          id: 101,
          title: 'Roteiro & dados',
          url: 'https://www.example.com/historia',
          domain: 'example.com',
          score: 42,
          author: 'maia',
        });
        expect(JSON.stringify(body)).not.toMatch(/"(by|descendants|kids|time)"\s*:/);

        const second = await app.inject({ method: 'GET', url: apiPath });
        expect(second.statusCode).toBe(200);
        expect(stub.calls('/v0/topstories.json')).toBe(1);
        expect(stub.calls('/v0/item/101.json')).toBe(1);
        expect(stub.calls('/v0/item/102.json')).toBe(1);
        // Invalid wire records are skipped but not cached as if they were normalized.
        expect(stub.calls('/v0/item/103.json')).toBe(2);
      });
    } finally {
      await stub.close();
    }
  });

  it('keeps warmed top-page requests below the one-second p95 target without upstream fetches', async () => {
    const stub = await startHnStub({ topStoryIds: [101, 102] });
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 4,
      });
      await withApp(hnClient, async (app) => {
        await app.inject({ method: 'GET', url: apiPath });
        const durations: number[] = [];
        for (let index = 0; index < 40; index += 1) {
          const start = performance.now();
          const response = await app.inject({ method: 'GET', url: apiPath });
          durations.push(performance.now() - start);
          expect(response.statusCode).toBe(200);
        }
        durations.sort((left, right) => left - right);
        const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
        expect(p95).toBeLessThan(1_000);
        expect(stub.calls('/v0/topstories.json')).toBe(1);
        expect(stub.calls('/v0/item/101.json')).toBe(1);
        expect(stub.calls('/v0/item/102.json')).toBe(1);
      });
    } finally {
      await stub.close();
    }
  });

  it('serves normalized stale items when HN is unavailable after the cache expires', async () => {
    const stub = await startHnStub({ topStoryIds: [101, 102] });
    let now = Date.parse('2026-10-11T12:00:00.000Z');
    const cache = new MemoryCache({ staleRetentionMs: config.staleRetentionMs, now: () => now });
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 2,
      });
      await withApp(hnClient, async (app) => {
        const first = await app.inject({ method: 'GET', url: apiPath });
        expect(first.statusCode).toBe(200);
        now += config.itemCacheTtlMs + 1;
        stub.setFailure(503);

        const stale = await app.inject({ method: 'GET', url: apiPath });
        expect(stale.statusCode).toBe(200);
        expect(stale.json()).toMatchObject({ stale: true, items: [{ id: 101 }, { id: 102 }] });
      }, cache);
    } finally {
      await stub.close();
    }
  });

  it('maps an unavailable HN list to the public error envelope', async () => {
    const hnClient = new HnApiClient({
      baseUrl: 'https://hn.invalid/v0/',
      timeoutMs: 1_000,
      retries: 0,
      concurrency: 2,
      fetch: async () => new Response('', { status: 503 }),
    });
    await withApp(hnClient, async (app) => {
      const response = await app.inject({ method: 'GET', url: apiPath });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        error: { code: 'UPSTREAM_UNAVAILABLE', message: expect.any(String) },
      });
    });
  });

  it('rejects invalid pagination and limits before contacting HN', async () => {
    const stub = await startHnStub();
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 2,
      });
      await withApp(hnClient, async (app) => {
        const page = await app.inject({ method: 'GET', url: `${apiPath}&page=2` });
        const limit = await app.inject({ method: 'GET', url: `${apiPath}&limit=10000` });
        expect(page.statusCode).toBe(400);
        expect(limit.statusCode).toBe(400);
        expect(stub.calls('/v0/topstories.json')).toBe(0);
      });
    } finally {
      await stub.close();
    }
  });

  it('rejects unsupported categories before contacting HN', async () => {
    const stub = await startHnStub();
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 2,
      });
      await withApp(hnClient, async (app) => {
        const response = await app.inject({ method: 'GET', url: '/api/stories?category=unknown' });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: { code: 'BAD_REQUEST', message: expect.any(String) } });
        expect(stub.totalRequests).toBe(0);
      });
    } finally {
      await stub.close();
    }
  });

  it('maps item upstream failures after a successful list fetch to the public error envelope', async () => {
    let listCalls = 0;
    let itemCalls = 0;
    const hnClient = new HnApiClient({
      baseUrl: 'https://hn.invalid/v0/',
      timeoutMs: 1_000,
      retries: 0,
      concurrency: 2,
      fetch: async (input) => {
        const path = new URL(input).pathname;
        if (path.endsWith('/topstories.json')) {
          listCalls += 1;
          return new Response(JSON.stringify([101, 102]), { status: 200 });
        }
        if (/\/item\/(101|102)\.json$/.test(path)) {
          itemCalls += 1;
          return new Response('', { status: 503 });
        }
        return new Response('', { status: 404 });
      },
    });

    await withApp(hnClient, async (app) => {
      const response = await app.inject({ method: 'GET', url: apiPath });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        error: { code: 'UPSTREAM_UNAVAILABLE', message: expect.any(String) },
      });
      expect(listCalls).toBe(1);
      expect(itemCalls).toBe(2);
    });
  });

  it('reuses one cold list publication for concurrent first-page snapshots', async () => {
    const stub = await startHnStub({ topStoryIds: [101, 102] });
    const baseNow = Date.parse('2026-10-11T12:00:00.000Z');
    let now = baseNow;
    let listWrites = 0;
    const backingCache = new MemoryCache({ staleRetentionMs: config.staleRetentionMs, now: () => now });
    const cache: Cache = {
      size: () => backingCache.size(),
      get: <T>(key: string) => backingCache.get<T>(key),
      getWithStaleness: <T>(key: string) => backingCache.getWithStaleness<T>(key),
      set: <T>(key: string, value: T, ttlMs: number) => {
        if (key === 'list:top') {
          now = baseNow + listWrites * 1_000;
          listWrites += 1;
        }
        return backingCache.set(key, value, ttlMs);
      },
    };
    let releaseListResponse!: () => void;
    const listResponseGate = new Promise<void>((resolve) => {
      releaseListResponse = resolve;
    });
    let signalListFetchStarted!: () => void;
    const listFetchStarted = new Promise<void>((resolve) => {
      signalListFetchStarted = resolve;
    });
    let signalBothListCallers!: () => void;
    const bothListCallersStarted = new Promise<void>((resolve) => {
      signalBothListCallers = resolve;
    });
    let listCallerCount = 0;
    const gatedFetch: HnFetch = async (input, init) => {
      if (new URL(input).pathname.endsWith('/topstories.json')) {
        signalListFetchStarted();
        await listResponseGate;
      }
      return globalThis.fetch(input, init);
    };
    class ObservedHnApiClient extends HnApiClient {
      override fetchList(category: StoryCategory): Promise<number[]> {
        listCallerCount += 1;
        if (listCallerCount === 2) signalBothListCallers();
        return super.fetchList(category);
      }
    }
    try {
      const hnClient = new ObservedHnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 4,
        fetch: gatedFetch,
      });
      await withApp(hnClient, async (app) => {
        const firstRequest = app.inject({ method: 'GET', url: `${apiPath}&limit=1` });
        const secondRequest = app.inject({ method: 'GET', url: `${apiPath}&limit=1` });
        const requestResults = Promise.allSettled([firstRequest, secondRequest]);
        let barrierTimeout: ReturnType<typeof setTimeout> | undefined;
        const barrierDeadline = new Promise<never>((_, reject) => {
          barrierTimeout = setTimeout(
            () => reject(new Error('Timed out waiting for both cold-list callers.')),
            4_000,
          );
        });
        try {
          // The deadline only prevents a broken barrier from hanging the suite; overlap is promise-gated.
          await Promise.race([
            Promise.all([bothListCallersStarted, listFetchStarted]),
            barrierDeadline,
          ]);
          releaseListResponse();
          const [firstResult, secondResult] = await requestResults;
          if (firstResult.status === 'rejected') throw firstResult.reason;
          if (secondResult.status === 'rejected') throw secondResult.reason;
          const first = firstResult.value;
          const second = secondResult.value;
          const firstBody = first.json();
          const secondBody = second.json();

          expect(first.statusCode).toBe(200);
          expect(second.statusCode).toBe(200);
          expect(firstBody.snapshot).toBe(secondBody.snapshot);
          expect(listCallerCount).toBe(2);
          expect(listWrites).toBe(1);

          const continuation = await app.inject({
            method: 'GET',
            url: `${apiPath}&limit=1&page=2&snapshot=${encodeURIComponent(firstBody.snapshot)}`,
          });
          expect(continuation.statusCode).toBe(200);
          expect(continuation.json()).toMatchObject({
            page: 2,
            snapshot: firstBody.snapshot,
            items: [{ id: 102 }],
          });
          expect(stub.calls('/v0/topstories.json')).toBe(1);
        } finally {
          if (barrierTimeout !== undefined) clearTimeout(barrierTimeout);
          releaseListResponse();
          await requestResults;
        }
      }, cache);
    } finally {
      await stub.close();
    }
  }, 8_000);

  it('serves all six categories through their matching HN list endpoints', async () => {
    const stub = await startHnStub();
    const listPaths = {
      top: '/v0/topstories.json',
      new: '/v0/newstories.json',
      best: '/v0/beststories.json',
      ask: '/v0/askstories.json',
      show: '/v0/showstories.json',
      job: '/v0/jobstories.json',
    } as const;
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 4,
      });
      await withApp(hnClient, async (app) => {
        for (const [category, listPath] of Object.entries(listPaths)) {
          const response = await app.inject({ method: 'GET', url: `/api/stories?category=${category}&limit=1` });
          expect(response.statusCode).toBe(200);
          if (category === 'job') {
            expect(response.json()).toMatchObject({
              items: [{
                id: 106,
                type: 'job',
                title: 'Vaga com HTTPS',
                url: 'https://jobs.example.net/vaga',
                domain: 'jobs.example.net',
                author: null,
                score: null,
                commentCount: 0,
                createdAt: null,
              }],
            });
          }
          expect(stub.calls(listPath)).toBe(1);
        }
      });
    } finally {
      await stub.close();
    }
  });

  it('continues from the original list snapshot without another HN list fetch', async () => {
    const stub = await startHnStub();
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 4,
      });
      await withApp(hnClient, async (app) => {
        const first = await app.inject({ method: 'GET', url: `${apiPath}&limit=1` });
        const firstBody = first.json();
        const second = await app.inject({
          method: 'GET',
          url: `${apiPath}&limit=1&page=2&snapshot=${encodeURIComponent(firstBody.snapshot)}`,
        });

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(firstBody.items.map((item: { id: number }) => item.id)).toEqual([101]);
        expect(second.json()).toMatchObject({
          page: 2,
          limit: 1,
          snapshot: firstBody.snapshot,
          items: [{ id: 102 }],
        });
        expect(stub.calls('/v0/topstories.json')).toBe(1);
      });
    } finally {
      await stub.close();
    }
  });

  it('rejects missing and unavailable continuation snapshots without contacting HN', async () => {
    const stub = await startHnStub();
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 2,
      });
      await withApp(hnClient, async (app) => {
        const missing = await app.inject({ method: 'GET', url: '/api/stories?category=top&page=2' });
        const expired = await app.inject({
          method: 'GET',
          url: '/api/stories?category=top&page=2&snapshot=not-retained',
        });

        expect(missing.statusCode).toBe(400);
        expect(missing.json()).toMatchObject({ error: { code: 'BAD_REQUEST' } });
        expect(expired.statusCode).toBe(410);
        expect(expired.json()).toMatchObject({ error: { code: 'SNAPSHOT_EXPIRED' } });
        expect(stub.calls('/v0/topstories.json')).toBe(0);
      });
    } finally {
      await stub.close();
    }
  });
});
