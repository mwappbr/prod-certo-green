import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { HnApiClient } from '../src/adapters/hn/client.js';
import { MemoryCache } from '../src/adapters/cache/memory-cache.js';
import { itemCacheKey } from '../src/app/cache-keys.js';
import { config } from '../src/config/index.js';
import { normalizeHnItem, type NormalizedHnItem } from '../src/domain/normalize-item.js';
import { parseItemId, parsePositiveInteger } from '../src/http/routes/items.js';
import { createServer } from '../src/main.js';
import { HnRequestError, type HnClient } from '../src/ports/hn.js';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { createLargeCommentFixture, drainedWithin, walkBreadth } from './helpers/large-comment-fixture.js';

const staticRoot = fileURLToPath(new URL('../../', import.meta.url));

type FakeHn = {
  client: HnClient<StoryCategory, NormalizedHnItem>;
  calls: Map<number, number>;
  fail(id: number, failure: 'timeout' | 'unavailable'): void;
};

function fakeHn(
  items: Map<number, NormalizedHnItem>,
  listIds: number[] = [],
  beforeFetch?: (id: number) => Promise<void>,
): FakeHn {
  const calls = new Map<number, number>();
  const failures = new Map<number, 'timeout' | 'unavailable'>();
  return {
    calls,
    fail: (id, failure) => failures.set(id, failure),
    client: {
      fetchList: async () => listIds,
      fetchItem: async (id) => {
        calls.set(id, (calls.get(id) ?? 0) + 1);
        await beforeFetch?.(id);
        const failure = failures.get(id);
        if (failure) throw new HnRequestError(failure, 'fixture failure');
        return items.get(id) ?? null;
      },
    },
  };
}

async function withApp<T>(
  hnClient: HnClient<StoryCategory, NormalizedHnItem>,
  action: (app: Awaited<ReturnType<typeof createServer>>) => Promise<T>,
  cache = new MemoryCache({ staleRetentionMs: config.staleRetentionMs }),
) {
  const app = await createServer({ staticRoot, logger: false, hnClient, cache });
  try {
    return await action(app);
  } finally {
    await app.close();
  }
}

describe('item and comments HTTP endpoints', () => {
  it('rejects decoded trailing line terminators in IDs and depths', () => {
    const encodedTerminators = ['%0A', '%0D', '%E2%80%A8', '%E2%80%A9'];
    for (const encoded of encodedTerminators) {
      const terminator = decodeURIComponent(encoded);
      expect(() => parseItemId(`404${terminator}`)).toThrow();
      expect(() => parsePositiveInteger(`1${terminator}`, 8)).toThrow();
    }
  });

  it('returns explicit public envelopes, preserves comments order, and reuses cache without leaking child IDs', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [101, normalizeHnItem({ id: 101, kind: 'story', title: 'Story', childIds: [201, 202] })],
      [201, normalizeHnItem({ id: 201, kind: 'comment', author: 'one', bodyHtml: '<p>safe</p><script>bad()</script>', childIds: [203] })],
      [202, normalizeHnItem({ id: 202, kind: 'comment', author: 'two' })],
      [203, normalizeHnItem({ id: 203, kind: 'comment', author: 'deeper' })],
    ]);
    const hn = fakeHn(items, [101]);
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => 1_700_000_000_000 });
    const cachedAt = '2023-11-14T22:13:20.000Z';

    await withApp(hn.client, async (app) => {
      const list = await app.inject({ method: 'GET', url: '/api/stories?category=top&limit=1' });
      const item = await app.inject({ method: 'GET', url: '/api/items/101' });
      const comments = await app.inject({ method: 'GET', url: '/api/items/101/comments?depth=1' });

      expect(list.statusCode).toBe(200);
      expect(item.statusCode).toBe(200);
      expect(item.json()).toMatchObject({
        item: { id: 101, type: 'story', title: 'Story', cachedAt },
        cachedAt,
        stale: false,
      });
      expect(Object.keys(item.json()).sort()).toEqual(['cachedAt', 'item', 'stale']);
      expect(comments.statusCode).toBe(200);
      expect(comments.json()).toMatchObject({
        nodes: [
          { id: 201, author: 'one', text: '<p>safe</p>', children: null },
          { id: 202, author: 'two', children: [] },
        ],
        truncated: false,
        cachedAt,
        stale: false,
      });
      expect(comments.json().nodes[0]).not.toHaveProperty('kids');
      expect(comments.json().nodes[0]).not.toHaveProperty('childIds');
      expect(JSON.stringify(list.json())).not.toContain('childIds');
      expect(JSON.stringify(item.json())).not.toContain('childIds');
      expect(JSON.stringify(comments.json())).not.toMatch(/"(kids|childIds)"\s*:/);
      expect(hn.calls.get(101)).toBe(1);
      expect(hn.calls.get(201)).toBe(1);
      expect(hn.calls.get(202)).toBe(1);
      expect(hn.calls.has(203)).toBe(false);

      await app.inject({ method: 'GET', url: '/api/items/101/comments?depth=1' });
      expect(hn.calls.get(101)).toBe(1);
      expect(hn.calls.get(201)).toBe(1);
      expect(hn.calls.get(202)).toBe(1);
    }, cache);
  });

  it('returns a 200+ comment tree in source BFS order in the HTTP envelope with bounded cold and warm fetches', async () => {
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
    const hn = fakeHn(items, [], async (id) => {
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
    const url = `/api/items/${rootId}/comments?depth=4`;

    await withApp(hn.client, async (app) => {
      const cold = await drainedWithin(
        app.inject({ method: 'GET', url }),
        'Cold HTTP comment-tree fixture exceeded its deadline.',
      );
      const envelope = cold.json();

      expect(cold.statusCode).toBe(200);
      expect(expectedBreadthOrder).toHaveLength(224);
      expect(walkBreadth(envelope.nodes)).toEqual(expectedBreadthOrder);
      expect(envelope.truncated).toBe(false);
      expect(hn.calls.get(rootId)).toBe(1);
      expect(hn.calls.size - 1).toBe(expectedBreadthOrder.length);
      expect(hn.calls.size - 1).toBeLessThanOrEqual(config.commentsMaxNodes);
      for (const count of hn.calls.values()) expect(count).toBe(1);
      expect(completionOrder.indexOf(secondRootChild)).toBeLessThan(
        completionOrder.indexOf(firstRootChild),
      );
      expect(peakActive).toBeGreaterThan(1);
      expect(peakActive).toBeLessThanOrEqual(config.hnConcurrency);

      const coldCalls = [...hn.calls.entries()];
      const warm = await drainedWithin(
        app.inject({ method: 'GET', url }),
        'Warm HTTP comment-tree fixture exceeded its deadline.',
      );
      expect(warm.statusCode).toBe(200);
      expect(walkBreadth(warm.json().nodes)).toEqual(expectedBreadthOrder);
      expect([...hn.calls.entries()]).toEqual(coldCalls);
    }, new MemoryCache({ staleRetentionMs: config.staleRetentionMs }));
  }, 8_000);

  it('sanitizes a raw adapter comment before cache.set and returns the identical SafeHtml in the HTTP envelope', async () => {
    const rawBody = [
      '<p>Safe <strong>format</strong> &amp; entity</p>',
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(2)">',
      '<a href="javascript:alert(3)" onclick="alert(4)">javascript link</a>',
      '<a href="data:text/html,unsafe">data link</a>',
      '<a href="ftp://unsafe.example/file">ftp link</a>',
      '<a href="mailto:reader@example.org">mail link</a>',
      '<a href="/relative/path">relative link</a>',
      '<a href="//protocol.example/path">protocol-relative link</a>',
      '<svg onload="alert(5)"><a xlink:href="javascript:alert(6)">svg content</a></svg>',
      '<iframe src="https://unsafe.example">iframe content</iframe>',
    ].join('');
    const rawItems: Record<number, unknown> = {
      911: {
        id: 911,
        type: 'story',
        title: '<em>Plain title</em> &amp; decoded',
        by: '<b>Plain author</b> &amp; decoded',
        kids: [912],
      },
      912: {
        id: 912,
        type: 'comment',
        by: '<i>Plain comment author</i> &amp; decoded',
        text: rawBody,
        kids: [],
      },
    };
    const upstreamPaths: string[] = [];
    const hn = new HnApiClient({
      baseUrl: 'https://hn.invalid/v0/',
      timeoutMs: 1_000,
      retries: 0,
      concurrency: 2,
      fetch: async (input) => {
        const pathname = new URL(input).pathname;
        upstreamPaths.push(pathname);
        const match = pathname.match(/^\/v0\/item\/(\d+)\.json$/);
        const id = match?.[1] === undefined ? Number.NaN : Number(match[1]);
        return new Response(JSON.stringify(rawItems[id] ?? null), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const cache = new MemoryCache({ staleRetentionMs: config.staleRetentionMs });
    const observedSet = vi.spyOn(cache, 'set');

    await withApp(hn, async (app) => {
      const comments = await app.inject({ method: 'GET', url: '/api/items/911/comments?depth=1' });
      const item = await app.inject({ method: 'GET', url: '/api/items/911' });
      const commentText = comments.json().nodes[0]?.text as string;
      const commentWrite = observedSet.mock.calls.find(([key]) => key === itemCacheKey(912));
      const cachedComment = commentWrite?.[1] as NormalizedHnItem | undefined;

      expect(comments.statusCode).toBe(200);
      expect(item.statusCode).toBe(200);
      expect(item.json().item.title).toBe('<em>Plain title</em> & decoded');
      expect(item.json().item.author).toBe('<b>Plain author</b> & decoded');
      expect(comments.json().nodes[0].author).toBe('<i>Plain comment author</i> & decoded');
      expect(commentText).toContain('<p>Safe <strong>format</strong> &amp; entity</p>');
      expect(commentText).toContain('<a href="mailto:reader@example.org">mail link</a>');
      expect(commentText).toContain('<a href="/relative/path">relative link</a>');
      expect(commentText).toContain('<a href="//protocol.example/path">protocol-relative link</a>');
      expect(commentText).not.toMatch(/<(script|img|svg|iframe)\b|\bonerror\s*=|\bonclick\s*=|\bonload\s*=|xlink:href|javascript:|data:text\/html|ftp:\/\//i);
      expect(commentWrite).toBeDefined();
      expect(cachedComment).toMatchObject({ type: 'comment', text: commentText });
      expect(upstreamPaths.sort()).toEqual(['/v0/item/911.json', '/v0/item/912.json']);
    }, cache);
  });

  it('preserves deleted and dead comment status and replies in the HTTP tree without the source body', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [901, normalizeHnItem({ id: 901, kind: 'story', title: 'Status root', childIds: [902, 903] })],
      [902, normalizeHnItem({ id: 902, kind: 'comment', author: 'deleted-author', deleted: true, bodyHtml: '<p>private deleted body</p>', childIds: [904] })],
      [903, normalizeHnItem({ id: 903, kind: 'comment', author: 'dead-author', dead: true, bodyHtml: '<p>private dead body</p>', childIds: [905] })],
      [904, normalizeHnItem({ id: 904, kind: 'comment', author: 'reply-one', bodyHtml: '<p>visible reply one</p>' })],
      [905, normalizeHnItem({ id: 905, kind: 'comment', author: 'reply-two', bodyHtml: '<p>visible reply two</p>' })],
    ]);
    const hn = fakeHn(items);

    await withApp(hn.client, async (app) => {
      const response = await app.inject({ method: 'GET', url: '/api/items/901/comments?depth=2' });
      const json = response.json();

      expect(response.statusCode).toBe(200);
      expect(json.nodes).toMatchObject([
        { id: 902, author: 'deleted-author', status: 'deleted', text: null, children: [{ id: 904, status: 'ok', children: [] }] },
        { id: 903, author: 'dead-author', status: 'dead', text: null, children: [{ id: 905, status: 'ok', children: [] }] },
      ]);
      expect(JSON.stringify(json)).not.toContain('private deleted body');
      expect(JSON.stringify(json)).not.toContain('private dead body');
    });
  });

  it('serves jobs with an empty comment envelope and comment roots from their existing kids', async () => {
    const items = new Map<number, NormalizedHnItem>([
      [301, normalizeHnItem({ id: 301, kind: 'job', title: 'Job', childIds: [399] })],
      [302, normalizeHnItem({ id: 302, kind: 'comment', author: 'root', childIds: [303] })],
      [303, normalizeHnItem({ id: 303, kind: 'comment', author: 'reply' })],
      [399, normalizeHnItem({ id: 399, kind: 'comment', author: 'must not be queried' })],
    ]);
    const hn = fakeHn(items);

    await withApp(hn.client, async (app) => {
      const job = await app.inject({ method: 'GET', url: '/api/items/301/comments' });
      const commentItem = await app.inject({ method: 'GET', url: '/api/items/302' });
      const commentReplies = await app.inject({ method: 'GET', url: '/api/items/302/comments?depth=1' });

      expect(job.statusCode).toBe(200);
      expect(job.json()).toMatchObject({ nodes: [], truncated: false, stale: false });
      expect(job.json().cachedAt).toBe((await app.inject({ method: 'GET', url: '/api/items/301' })).json().cachedAt);
      expect(hn.calls.has(399)).toBe(false);
      expect(commentItem.json().item).toMatchObject({ type: 'comment', kids: [303] });
      expect(commentReplies.json()).toMatchObject({ nodes: [{ id: 303, children: [] }], truncated: false });
    });
  });

  it('returns 404 for missing or malformed upstream roots and validates path/depth input', async () => {
    const hn = fakeHn(new Map());
    await withApp(hn.client, async (app) => {
      const missingItem = await app.inject({ method: 'GET', url: '/api/items/404' });
      const missingComments = await app.inject({ method: 'GET', url: '/api/items/404/comments' });
      const badId = await app.inject({ method: 'GET', url: '/api/items/nope' });
      const badTerminatorIds = await Promise.all([
        app.inject({ method: 'GET', url: '/api/items/404%0A' }),
        app.inject({ method: 'GET', url: '/api/items/404%0D' }),
        app.inject({ method: 'GET', url: '/api/items/404%E2%80%A8' }),
      ]);
      const badDepths = await Promise.all([
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=0' }),
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=abc' }),
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=21' }),
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=1%0A' }),
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=1%0D' }),
        app.inject({ method: 'GET', url: '/api/items/404/comments?depth=1%E2%80%A8' }),
      ]);

      expect(missingItem.statusCode).toBe(404);
      expect(missingItem.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
      expect(missingComments.statusCode).toBe(404);
      expect(missingComments.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
      expect(badId.statusCode).toBe(400);
      expect(badTerminatorIds.map((response) => response.statusCode)).toEqual([400, 400, 400]);
      expect(badDepths.map((response) => response.statusCode)).toEqual([400, 400, 400, 400, 400, 400]);
      expect(hn.calls.get(404)).toBe(2);
    });
  });

  it('maps upstream unavailable and timeout failures through the existing public error codes', async () => {
    const items = new Map<number, NormalizedHnItem>([[401, normalizeHnItem({ id: 401, kind: 'story', title: 'Root' })]]);
    const hn = fakeHn(items);
    hn.fail(401, 'unavailable');
    hn.fail(402, 'timeout');

    await withApp(hn.client, async (app) => {
      const unavailable = await app.inject({ method: 'GET', url: '/api/items/401' });
      const timeout = await app.inject({ method: 'GET', url: '/api/items/402/comments' });
      expect(unavailable.statusCode).toBe(502);
      expect(unavailable.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE' } });
      expect(timeout.statusCode).toBe(504);
      expect(timeout.json()).toMatchObject({ error: { code: 'UPSTREAM_TIMEOUT' } });
    });
  });

  it('uses stale cached root IDs to build comments and reports the oldest represented timestamp', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    const root = normalizeHnItem({ id: 501, kind: 'story', title: 'Stale root', childIds: [502] });
    const rootCachedAt = cache.set(itemCacheKey(501), root, 10).cachedAt;
    now += 11;
    const hn = fakeHn(new Map([[502, normalizeHnItem({ id: 502, kind: 'comment', author: 'cached child' })]]));
    hn.fail(501, 'unavailable');

    await withApp(hn.client, async (app) => {
      const response = await app.inject({ method: 'GET', url: '/api/items/501/comments?depth=1' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        nodes: [{ id: 502, author: 'cached child', children: [] }],
        stale: true,
        cachedAt: rootCachedAt,
      });
      expect(hn.calls.get(501)).toBe(1);
      expect(hn.calls.get(502)).toBe(1);
    }, cache);
  });

  it('uses stale child data when an upstream child refresh fails', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    cache.set(itemCacheKey(601), normalizeHnItem({ id: 601, kind: 'story', title: 'Root', childIds: [602] }), 100);
    const childCachedAt = cache.set(itemCacheKey(602), normalizeHnItem({ id: 602, kind: 'comment', author: 'stale child' }), 10).cachedAt;
    now += 11;
    const hn = fakeHn(new Map());
    hn.fail(602, 'unavailable');

    await withApp(hn.client, async (app) => {
      const response = await app.inject({ method: 'GET', url: '/api/items/601/comments?depth=1' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ nodes: [{ id: 602, author: 'stale child', children: [] }], stale: true, cachedAt: childCachedAt });
    }, cache);
  });

  it('uses the oldest descendant timestamp and ORs staleness without changing the item clock', async () => {
    let now = 1_700_000_000_000;
    const cache = new MemoryCache({ staleRetentionMs: 10_000, now: () => now });
    const childCachedAt = cache.set(
      itemCacheKey(702),
      normalizeHnItem({ id: 702, kind: 'comment', author: 'stale child' }),
      10,
    ).cachedAt;
    now += 11;
    const rootCachedAt = cache.set(
      itemCacheKey(701),
      normalizeHnItem({ id: 701, kind: 'story', title: 'Fresh root', childIds: [702] }),
      100,
    ).cachedAt;
    now += 1;
    const hn = fakeHn(new Map());
    hn.fail(702, 'unavailable');

    await withApp(hn.client, async (app) => {
      const item = await app.inject({ method: 'GET', url: '/api/items/701' });
      const comments = await app.inject({ method: 'GET', url: '/api/items/701/comments?depth=1' });

      expect(item.statusCode).toBe(200);
      expect(item.json()).toMatchObject({ cachedAt: rootCachedAt, stale: false, item: { cachedAt: rootCachedAt } });
      expect(comments.statusCode).toBe(200);
      expect(comments.json()).toMatchObject({
        nodes: [{ id: 702, author: 'stale child', children: [] }],
        cachedAt: childCachedAt,
        stale: true,
      });
      expect(Date.parse(comments.json().cachedAt)).toBeLessThan(Date.parse(item.json().cachedAt));
    }, cache);
  });
});
