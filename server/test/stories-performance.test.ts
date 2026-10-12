import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HnApiClient } from '../src/adapters/hn/client.js';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { config } from '../src/config/index.js';
import { createServer } from '../src/main.js';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { startHnStub } from './helpers/hn-stub.js';

const staticRoot = fileURLToPath(new URL('../../', import.meta.url));
const categories: readonly StoryCategory[] = ['top', 'new', 'best', 'ask', 'show', 'job'];
const listPaths: Record<StoryCategory, string> = {
  top: '/v0/topstories.json',
  new: '/v0/newstories.json',
  best: '/v0/beststories.json',
  ask: '/v0/askstories.json',
  show: '/v0/showstories.json',
  job: '/v0/jobstories.json',
};
const itemIds = [101, 102, 104, 105, 106];

describe('GET /api/stories warm pagination performance', () => {
  it('measures 180 sequential warm responses and records upstream counters', async () => {
    const stub = await startHnStub({ topStoryIds: [101, 102] });
    try {
      const hnClient = new HnApiClient({
        baseUrl: stub.baseUrl,
        timeoutMs: 1_000,
        retries: 0,
        concurrency: 8,
      });
      const cache = new MemoryCache({ staleRetentionMs: config.staleRetentionMs });
      const app = await createServer({ staticRoot, logger: false, hnClient, cache });
      try {
        for (const category of categories) {
          const response = await app.inject({ method: 'GET', url: `/api/stories?category=${category}` });
          expect(response.statusCode).toBe(200);
          const body = response.json();
          expect(body.stale).toBe(false);
          expect(body.items.length).toBeGreaterThan(0);
        }
        const warmedListCounts = Object.fromEntries(
          categories.map((category) => [category, stub.calls(listPaths[category])]),
        ) as Record<StoryCategory, number>;
        const warmedItemCounts = Object.fromEntries(
          itemIds.map((id) => [id, stub.calls(`/v0/item/${id}.json`)]),
        );

        const durations: number[] = [];
        const durationsByCategory = new Map<StoryCategory, number[]>();
        const benchmarkStartedAt = performance.now();
        for (const category of categories) {
          const categoryDurations: number[] = [];
          for (let requestIndex = 0; requestIndex < 30; requestIndex += 1) {
            const startedAt = performance.now();
            const response = await app.inject({
              method: 'GET',
              url: `/api/stories?category=${category}`,
            });
            const elapsed = performance.now() - startedAt;
            durations.push(elapsed);
            categoryDurations.push(elapsed);
            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.stale).toBe(false);
            expect(body.items.length).toBeGreaterThan(0);
          }
          durationsByCategory.set(category, categoryDurations);
        }
        const benchmarkElapsedMs = performance.now() - benchmarkStartedAt;

        const sortedDurations = [...durations].sort((left, right) => left - right);
        const p95Ms = sortedDurations[Math.ceil(0.95 * sortedDurations.length) - 1] ?? Number.NaN;
        const listCounts = Object.fromEntries(
          categories.map((category) => [category, stub.calls(listPaths[category])]),
        ) as Record<StoryCategory, number>;
        const itemCounts = Object.fromEntries(
          itemIds.map((id) => [id, stub.calls(`/v0/item/${id}.json`)]),
        );
        const categoryP95Ms = Object.fromEntries(
          categories.map((category) => {
            const samples = [...(durationsByCategory.get(category) ?? [])].sort((left, right) => left - right);
            return [category, samples[Math.ceil(0.95 * samples.length) - 1] ?? Number.NaN];
          }),
        );

        console.info('stories performance benchmark', JSON.stringify({
          requests: durations.length,
          summedRequestDurationMs: Number(durations.reduce((sum, value) => sum + value, 0).toFixed(2)),
          benchmarkElapsedMs: Number(benchmarkElapsedMs.toFixed(2)),
          p95Ms: Number(p95Ms.toFixed(2)),
          categoryP95Ms: Object.fromEntries(
            Object.entries(categoryP95Ms).map(([category, value]) => [category, Number(value.toFixed(2))]),
          ),
          listCounts,
          itemCounts,
        }));

        expect(durations).toHaveLength(180);
        expect(p95Ms).toBeLessThan(1_000);
        expect(listCounts).toEqual(warmedListCounts);
        expect(itemCounts).toEqual(warmedItemCounts);
        expect(listCounts).toEqual({ top: 1, new: 1, best: 1, ask: 1, show: 1, job: 1 });
        expect(itemCounts).toEqual({ 101: 1, 102: 1, 104: 1, 105: 1, 106: 1 });
      } finally {
        await app.close();
      }
    } finally {
      await stub.close();
    }
  });
});
