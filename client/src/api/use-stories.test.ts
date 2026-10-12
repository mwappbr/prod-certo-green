import { expect, test } from 'vitest';
import type { StoriesPage } from '@hn/shared/contract/stories';
import { ClientApiError } from './errors';
import {
  appendStoriesPage,
  beginStoriesRequest,
  combineStoriesPages,
  failStoriesPageRequest,
  failStoriesRequest,
  initialStoriesRequestState,
  type StoriesRequestState,
} from './use-stories';
import { storiesRequestUrl } from './stories';

const pageOne: StoriesPage = {
  items: [],
  page: 1,
  limit: 30,
  snapshot: 'snapshot-top-001',
  cachedAt: '2026-10-11T12:05:00.000Z',
  stale: true,
  hasMore: true,
};

const networkError = new ClientApiError('NETWORK_ERROR', 'Não foi possível conectar ao servidor.');

test('keeps same-category pages while an initial retry loads and fails', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
  };

  const loading = beginStoriesRequest(current, 'top');
  expect(loading).toMatchObject({ category: 'top', pages: [pageOne], loading: true, error: null });

  const failed = failStoriesRequest(loading, 'top', networkError);
  expect(failed.pages).toEqual([pageOne]);
  expect(failed.loading).toBe(false);
  expect(failed.error).toBe(networkError);
});

test('does not carry another category pages through loading or failure', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
  };

  const loading = beginStoriesRequest(current, 'new');
  expect(loading).toMatchObject({ category: 'new', pages: [], loading: true });

  const failed = failStoriesRequest(loading, 'new', networkError);
  expect(failed.pages).toEqual([]);
  expect(failed.error).toBe(networkError);
});

test('builds continuation query from page snapshot, not cachedAt', () => {
  const url = new URL(storiesRequestUrl('top', {
    page: 2,
    limit: pageOne.limit,
    snapshot: pageOne.snapshot,
  }), 'https://hn.example');

  expect(url.searchParams.get('category')).toBe('top');
  expect(url.searchParams.get('page')).toBe('2');
  expect(url.searchParams.get('limit')).toBe('30');
  expect(url.searchParams.get('snapshot')).toBe('snapshot-top-001');
  expect(url.searchParams.get('snapshot')).not.toBe(pageOne.cachedAt);
  expect(url.searchParams.has('cachedAt')).toBe(false);
});

test('appends empty snapshot pages and advances by page number', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    loadingMore: true,
  };
  const emptySecondPage: StoriesPage = {
    ...pageOne,
    items: [],
    page: 2,
    hasMore: true,
  };

  const afterSecondPage = appendStoriesPage(current, emptySecondPage);
  expect(afterSecondPage.pages.map((page) => page.page)).toEqual([1, 2]);
  expect(afterSecondPage.loadingMore).toBe(false);
  expect(afterSecondPage.loadMoreError).toBeNull();

  const thirdPage: StoriesPage = {
    ...pageOne,
    items: [],
    page: 3,
    hasMore: false,
  };
  const afterThirdPage = appendStoriesPage({ ...afterSecondPage, loadingMore: true }, thirdPage);
  expect(afterThirdPage.pages.map((page) => page.page)).toEqual([1, 2, 3]);
  expect(afterThirdPage.pages.at(-1)?.hasMore).toBe(false);
});

test('does not append the same page twice and aggregates freshness conservatively', () => {
  const pageTwo: StoriesPage = {
    ...pageOne,
    page: 2,
    cachedAt: '2026-10-11T12:03:00.000Z',
    stale: false,
    hasMore: false,
  };
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne, pageTwo],
    loading: false,
    loadingMore: true,
  };

  const duplicate = appendStoriesPage(current, pageTwo);
  expect(duplicate.pages).toHaveLength(2);
  expect(duplicate.loadingMore).toBe(false);

  const combined = combineStoriesPages(current.pages);
  expect(combined).toMatchObject({
    page: 2,
    limit: 30,
    snapshot: pageOne.snapshot,
    cachedAt: '2026-10-11T12:03:00.000Z',
    stale: true,
    hasMore: false,
    items: [],
  });
});

test('retains rows and continuation parameters on page error', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    loadingMore: true,
  };

  const failed = failStoriesPageRequest(current, 'top', networkError);
  expect(failed.pages).toEqual([pageOne]);
  expect(failed.loadingMore).toBe(false);
  expect(failed.loadMoreError).toBe(networkError);
  expect(failed.pages[0]?.snapshot).toBe(pageOne.snapshot);
  expect(failed.pages[0]?.limit).toBe(pageOne.limit);
});
