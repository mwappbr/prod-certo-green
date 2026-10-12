import { expect, test } from 'vitest';
import type { CommentsResponse, ItemResponse, Story } from '@hn/shared/contract/stories';
import {
  combineItemFreshness,
  formatClock,
  initialItemDetailState,
  itemDetailReducer,
} from './item-detail-state';

const itemFresh: ItemResponse = {
  item: {
    id: 101,
    type: 'story',
    title: 'História' as Story['title'],
    url: null,
    domain: null,
    author: null,
    score: 12,
    commentCount: 0,
    createdAt: null,
    cachedAt: '2026-10-12T10:00:00.000Z',
  },
  cachedAt: '2026-10-12T10:00:00.000Z',
  stale: false,
};

const commentsStale: CommentsResponse = {
  nodes: [],
  truncated: false,
  cachedAt: '2026-10-12T09:58:00.000Z',
  stale: true,
};

test('starts both independent requests in loading state', () => {
  expect(initialItemDetailState(101, 4)).toEqual({
    id: 101,
    generation: 4,
    item: { loading: true, data: null, error: null },
    comments: { loading: true, data: null, error: null },
  });
});

test('keeps item success while comments independently fail and retry', () => {
  const initial = initialItemDetailState(101, 4);
  const itemLoaded = itemDetailReducer(initial, {
    type: 'item-success', id: 101, generation: 4, data: itemFresh,
  });
  const commentsFailed = itemDetailReducer(itemLoaded, {
    type: 'comments-error', id: 101, generation: 4, error: new Error('offline'),
  });
  const retryingComments = itemDetailReducer(commentsFailed, {
    type: 'comments-loading', id: 101, generation: 4,
  });

  expect(commentsFailed.item).toEqual({ loading: false, data: itemFresh, error: null });
  expect(commentsFailed.comments).toMatchObject({ loading: false, data: null, error: expect.any(Error) });
  expect(retryingComments.item).toEqual(commentsFailed.item);
  expect(retryingComments.comments).toEqual({ loading: true, data: null, error: null });
});

test('keeps successful comments while the item independently fails and retries', () => {
  const initial = initialItemDetailState(101, 4);
  const commentsLoaded = itemDetailReducer(initial, {
    type: 'comments-success', id: 101, generation: 4, data: commentsStale,
  });
  const itemFailed = itemDetailReducer(commentsLoaded, {
    type: 'item-error', id: 101, generation: 4, error: new Error('offline'),
  });
  const retryingItem = itemDetailReducer(itemFailed, {
    type: 'item-loading', id: 101, generation: 4,
  });

  expect(itemFailed.comments).toEqual({ loading: false, data: commentsStale, error: null });
  expect(itemFailed.item).toMatchObject({ loading: false, data: null, error: expect.any(Error) });
  expect(retryingItem.comments).toEqual(itemFailed.comments);
  expect(retryingItem.item).toEqual({ loading: true, data: null, error: null });
});

test('ignores a late result from a previous id generation', () => {
  const initial = initialItemDetailState(101, 1);
  const current = itemDetailReducer(initial, { type: 'begin', id: 202, generation: 2 });
  const late = itemDetailReducer(current, {
    type: 'item-success', id: 101, generation: 1, data: itemFresh,
  });

  expect(late).toEqual(current);
  expect(late.id).toBe(202);
  expect(late.item.data).toBeNull();
});

test('combines visible freshness conservatively without changing either wire clock', () => {
  const freshness = combineItemFreshness(itemFresh, commentsStale);

  expect(freshness).toEqual({
    cachedAt: '2026-10-12T09:58:00.000Z',
    stale: true,
    staleAt: '2026-10-12T09:58:00.000Z',
  });
  expect(itemFresh.cachedAt).toBe('2026-10-12T10:00:00.000Z');
  expect(commentsStale.cachedAt).toBe('2026-10-12T09:58:00.000Z');
});

test('ignores invalid cache timestamps and formats valid timestamps in local time', () => {
  expect(combineItemFreshness(
    { ...itemFresh, cachedAt: 'not-a-date' },
    { ...commentsStale, cachedAt: '2026-10-12T09:58:00.000Z', stale: false },
  )).toEqual({ cachedAt: '2026-10-12T09:58:00.000Z', stale: false, staleAt: null });

  const expected = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .format(new Date('2026-10-12T09:58:00.000Z'));
  expect(formatClock('2026-10-12T09:58:00.000Z')).toBe(expected);
  expect(formatClock('invalid')).toBeNull();
});
