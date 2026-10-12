import { afterEach, expect, test, vi } from 'vitest';
import type { CommentsResponse, ItemResponse, Story } from '@hn/shared/contract/stories';
import { commentsRequestUrl, getComments, getItem, itemRequestUrl } from './items';

const itemEnvelope: ItemResponse = {
  item: {
    id: 101,
    type: 'story',
    title: 'Roteiro' as Story['title'],
    url: null,
    domain: null,
    author: null,
    score: 1,
    commentCount: 0,
    createdAt: null,
    cachedAt: '2026-10-12T10:00:00.000Z',
  },
  cachedAt: '2026-10-12T10:00:00.000Z',
  stale: false,
};

const commentsEnvelope: CommentsResponse = {
  nodes: [],
  truncated: false,
  cachedAt: '2026-10-12T09:59:00.000Z',
  stale: false,
};

afterEach(() => vi.unstubAllGlobals());

test('builds item and explicit-depth comments URLs by id', () => {
  expect(itemRequestUrl(101)).toBe('/api/items/101');
  expect(commentsRequestUrl(101, 1)).toBe('/api/items/101/comments?depth=1');
});

test('uses the server default depth when the comments depth is omitted', async () => {
  const signal = new AbortController().signal;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => commentsEnvelope,
  });
  vi.stubGlobal('fetch', fetchMock);

  expect(commentsRequestUrl(101)).toBe('/api/items/101/comments');
  await expect(getComments(101, { signal })).resolves.toEqual(commentsEnvelope);
  expect(fetchMock).toHaveBeenCalledWith('/api/items/101/comments', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
});

test('fetches the item envelope with the caller abort signal', async () => {
  const signal = new AbortController().signal;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => itemEnvelope,
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(getItem(101, { signal })).resolves.toEqual(itemEnvelope);
  expect(fetchMock).toHaveBeenCalledWith('/api/items/101', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
});

test('fetches comments with explicit depth and keeps its envelope clock', async () => {
  const signal = new AbortController().signal;
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => commentsEnvelope,
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(getComments(101, { depth: 1, signal })).resolves.toEqual(commentsEnvelope);
  expect(fetchMock).toHaveBeenCalledWith('/api/items/101/comments?depth=1', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  expect(commentsEnvelope.cachedAt).toBe('2026-10-12T09:59:00.000Z');
});
