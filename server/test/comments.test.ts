import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { getComments, type GetCommentsDependencies } from '../src/app/comments/get-comments.js';
import { normalizeHnItem, type NormalizedHnItem } from '../src/domain/normalize-item.js';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { HnRequestError, type HnClient } from '../src/ports/hn.js';
import { createLargeCommentFixture, drainedWithin, walkBreadth, within } from './helpers/large-comment-fixture.js';

function makeHn(
  items: Map<number, NormalizedHnItem>,
  beforeFetch?: (id: number) => Promise<void>,
): { hn: HnClient<StoryCategory, NormalizedHnItem>; calls: Map<number, number> } {
  const calls = new Map<number, number>();
  const hn: HnClient<StoryCategory, NormalizedHnItem> = {
    fetchList: async () => [],
    fetchItem: async (id) => {
      calls.set(id, (calls.get(id) ?? 0) + 1);
      await beforeFetch?.(id);
      return items.get(id) ?? null;
    },
  };
  return { hn, calls };
}

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function dependencies(
  hn: HnClient<StoryCategory, NormalizedHnItem>,
  overrides: Partial<Pick<GetCommentsDependencies, 'commentsDefaultDepth' | 'commentsMaxDepth' | 'commentsMaxNodes' | 'hnConcurrency'>> = {},
): GetCommentsDependencies {
  return {
    cache: new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 }),
    hn,
    itemCacheTtlMs: 100,
    commentsDefaultDepth: 8,
    commentsMaxDepth: 20,
    commentsMaxNodes: 500,
    hnConcurrency: 8,
    ...overrides,
  };
}

describe('bounded breadth-first comment traversal', () => {
  it('preserves source order and distinguishes the depth cutoff from a real leaf', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2, 3] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment', author: 'a', bodyHtml: '<p>safe</p><script>bad()</script>', childIds: [4] })],
      [3, normalizeHnItem({ id: 3, kind: 'comment', author: 'b', bodyHtml: '<p>leaf</p>' })],
      [4, normalizeHnItem({ id: 4, kind: 'comment', bodyHtml: '<p>deeper</p>' })],
    ]);
    const { hn } = makeHn(items);

    const result = await getComments(1, 1, dependencies(hn));

    expect(result.nodes.map((node) => node.id)).toEqual([2, 3]);
    expect(result.nodes[0]).toMatchObject({ id: 2, author: 'a', children: null });
    expect(result.nodes[0]?.text).toContain('<p>safe</p>');
    expect(result.nodes[0]?.text).not.toContain('<script');
    expect(result.nodes[1]).toMatchObject({ id: 3, children: [] });
    expect(result).toMatchObject({ truncated: false, stale: false });
    expect(JSON.stringify(result)).not.toMatch(/"(kids|childIds)"\s*:/);
  });

  it('bounds unique child fetch attempts even when IDs are missing or non-comments', async () => {
    const childIds = Array.from({ length: 50 }, (_value, index) => index + 2);
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds })],
      [3, normalizeHnItem({ id: 3, kind: 'job', title: 'Not a comment' })],
    ]);
    const { hn, calls } = makeHn(items);

    const result = await getComments(1, 1, dependencies(hn, { commentsMaxNodes: 3, hnConcurrency: 2 }));

    expect(result.nodes).toEqual([]);
    expect(result.truncated).toBe(true);
    expect(calls.get(1)).toBe(1);
    expect([...calls.keys()].filter((id) => id !== 1)).toHaveLength(3);
    expect(calls.has(5)).toBe(false);
  });

  it('stops dequeuing after the first upstream error and drains already-started requests before rejecting', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2, 3, 4, 5] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment' })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
      [4, normalizeHnItem({ id: 4, kind: 'comment' })],
      [5, normalizeHnItem({ id: 5, kind: 'comment' })],
    ]);
    let releaseFailure!: () => void;
    let releaseSibling!: () => void;
    let signalInitialRequests!: () => void;
    const failureGate = new Promise<void>((resolve) => { releaseFailure = resolve; });
    const siblingGate = new Promise<void>((resolve) => { releaseSibling = resolve; });
    const initialRequests = new Promise<void>((resolve) => { signalInitialRequests = resolve; });
    let started = 0;
    const { hn, calls } = makeHn(items, async (id) => {
      if (id === 1) return;
      if (id === 2 || id === 3) {
        started += 1;
        if (started === 2) signalInitialRequests();
      }
      if (id === 2) {
        await failureGate;
        throw new HnRequestError('unavailable', 'first controlled failure');
      }
      if (id === 3) await siblingGate;
    });
    const request = getComments(1, 1, dependencies(hn, { commentsMaxNodes: 4, hnConcurrency: 2 }));
    const settled = Promise.allSettled([request]);
    let settledBeforeDrain: boolean | undefined;

    try {
      await within(initialRequests, 'Initial bounded requests did not start.');
      releaseFailure();
      await nextTurn();
      settledBeforeDrain = await Promise.race([
        settled.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20)),
      ]);

      releaseSibling();
      await within(settled, 'BFS did not drain in-flight requests after failure.');
    } finally {
      releaseFailure();
      releaseSibling();
      await within(settled, 'Cleanup could not drain the comments request.');
      await nextTurn();
    }

    expect(settledBeforeDrain).toBe(false);
    const [outcome] = await within(settled, 'Could not read the drained request outcome.');
    expect(outcome).toMatchObject({ status: 'rejected', reason: { code: 'UPSTREAM_UNAVAILABLE' } });
    expect(calls.has(4)).toBe(false);
    expect(calls.has(5)).toBe(false);
  }, 8_000);

  it('traverses breadth-first with stable order, cycle deduplication, and bounded concurrency', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2, 3, 4] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment', childIds: [5, 6] })],
      [3, normalizeHnItem({ id: 3, kind: 'comment', childIds: [5] })],
      [4, normalizeHnItem({ id: 4, kind: 'comment', childIds: [1] })],
      [5, normalizeHnItem({ id: 5, kind: 'comment' })],
      [6, normalizeHnItem({ id: 6, kind: 'comment' })],
    ]);
    let active = 0;
    let maxActive = 0;
    const { hn, calls } = makeHn(items, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    const result = await getComments(1, 2, dependencies(hn, { hnConcurrency: 2 }));

    expect(result.nodes.map((node) => node.id)).toEqual([2, 3, 4]);
    expect(result.nodes[0]?.children?.map((node) => node.id)).toEqual([5, 6]);
    expect(result.nodes[1]?.children).toEqual([]);
    expect(result.nodes[2]?.children).toEqual([]);
    expect(calls.get(1)).toBe(1);
    expect(calls.get(5)).toBe(1);
    expect(calls.get(6)).toBe(1);
    expect(maxActive).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('walks a 200+ node tree in source BFS order despite reverse completion and reuses every cached item', async () => {
    const {
      rootId,
      items,
      expectedBreadthOrder,
      firstRootChild,
      secondRootChild,
    } = createLargeCommentFixture();
    let active = 0;
    let peakActive = 0;
    const completionOrder: number[] = [];
    const { hn, calls } = makeHn(items, async (id) => {
      if (id === rootId) return;
      active += 1;
      peakActive = Math.max(peakActive, active);
      try {
        const delayMs = id === firstRootChild ? 20 : 0;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        completionOrder.push(id);
      } finally {
        active -= 1;
      }
    });
    const deps = dependencies(hn, { commentsMaxNodes: 250, hnConcurrency: 8 });

    const result = await drainedWithin(getComments(rootId, 4, deps), 'Large BFS fixture exceeded its deadline.');

    expect(expectedBreadthOrder).toHaveLength(224);
    expect(walkBreadth(result.nodes)).toEqual(expectedBreadthOrder);
    expect(result.truncated).toBe(false);
    expect(completionOrder.indexOf(secondRootChild)).toBeLessThan(
      completionOrder.indexOf(firstRootChild),
    );
    expect(peakActive).toBeGreaterThan(1);
    expect(peakActive).toBeLessThanOrEqual(8);
    expect(calls.size).toBe(expectedBreadthOrder.length + 1);
    for (const count of calls.values()) expect(count).toBe(1);

    const coldCalls = [...calls.entries()];
    const warm = await drainedWithin(getComments(rootId, 4, deps), 'Warm-cache BFS fixture exceeded its deadline.');
    expect(walkBreadth(warm.nodes)).toEqual(expectedBreadthOrder);
    expect([...calls.entries()]).toEqual(coldCalls);
  }, 8_000);

  it('uses the configured default depth when no depth is requested', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment', childIds: [3] })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
    ]);
    const { hn } = makeHn(items);

    const result = await getComments(1, undefined, dependencies(hn, { commentsDefaultDepth: 2 }));

    expect(result.nodes[0]?.children?.map((node) => node.id)).toEqual([3]);
    expect(result.nodes[0]?.children?.[0]?.children).toEqual([]);
  });

  it('does not mark truncation when the exact unique-ID budget covers every known child', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2, 2, 3] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment' })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
    ]);
    const { hn, calls } = makeHn(items);

    const result = await getComments(1, 1, dependencies(hn, { commentsMaxNodes: 2 }));

    expect(result.nodes.map((node) => node.id)).toEqual([2, 3]);
    expect(result.nodes.every((node) => node.children?.length === 0)).toBe(true);
    expect(result.truncated).toBe(false);
    expect([...calls.entries()]).toEqual([[1, 1], [2, 1], [3, 1]]);
  });

  it('stops at the configured node budget and marks only node-budget truncation', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2, 3, 4] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment' })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
      [4, normalizeHnItem({ id: 4, kind: 'comment' })],
    ]);
    const { hn, calls } = makeHn(items);

    const result = await getComments(1, 1, dependencies(hn, { commentsMaxNodes: 2 }));

    expect(result.nodes.map((node) => node.id)).toEqual([2, 3]);
    expect(result.truncated).toBe(true);
    expect(calls.has(4)).toBe(false);
  });

  it('marks budget truncation when a deeper level cannot start after the root-level budget is used', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment', childIds: [3] })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
    ]);
    const { hn, calls } = makeHn(items);

    const result = await getComments(1, 2, dependencies(hn, { commentsMaxNodes: 1 }));

    expect(result.nodes.map((node) => node.id)).toEqual([2]);
    expect(result.nodes[0]?.children).toBeNull();
    expect(result.truncated).toBe(true);
    expect(calls.has(3)).toBe(false);
  });

  it('preserves a partial sibling branch when the node budget cuts off remaining replies', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [1, normalizeHnItem({ id: 1, kind: 'story', title: 'Root', childIds: [2] })],
      [2, normalizeHnItem({ id: 2, kind: 'comment', childIds: [3, 4] })],
      [3, normalizeHnItem({ id: 3, kind: 'comment' })],
      [4, normalizeHnItem({ id: 4, kind: 'comment' })],
    ]);
    const { hn, calls } = makeHn(items);

    const result = await getComments(1, 2, dependencies(hn, { commentsMaxNodes: 2, hnConcurrency: 2 }));

    expect(result.nodes[0]?.children?.map((node) => node.id)).toEqual([3]);
    expect(result.truncated).toBe(true);
    expect(calls.has(4)).toBe(false);
  });

  it('returns NOT_FOUND for a missing root and rejects depths outside configured bounds', async () => {
    const { hn } = makeHn(new Map());
    const deps = dependencies(hn, { commentsDefaultDepth: 2, commentsMaxDepth: 3 });

    await expect(getComments(1, undefined, deps)).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    await expect(getComments(1, 0, deps)).rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 });
    await expect(getComments(1, 4, deps)).rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 });
  });
});
