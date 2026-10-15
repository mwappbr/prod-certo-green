import { expect, test } from 'vitest';
import type { StoriesPage } from '@hn/shared/contract/stories';
import { ClientApiError } from './errors';
import {
  acceptFirstStoriesPage,
  appendStoriesPage,
  beginStoriesRequest,
  cancelRecoveringStoriesRequest,
  combineStoriesPages,
  failStoriesPageRequest,
  failStoriesRequest,
  incrementalRequestParams,
  initialStoriesRequestState,
  isAutomaticContinuationAllowed,
  setVoluntaryPause,
  type StoriesRequestState,
} from './use-stories';
import { storiesRequestUrl } from './stories';

function item(id: number, title = `Story ${id}`): StoriesPage['items'][number] {
  return {
    id,
    type: 'story',
    title: title as StoriesPage['items'][number]['title'],
    url: null,
    domain: null,
    author: null,
    score: null,
    commentCount: 0,
    createdAt: null,
    cachedAt: '2026-10-11T12:05:00.000Z',
  };
}

const pageOne: StoriesPage = {
  items: [item(1), item(2)],
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

test('accepts only page one as the beginning of a sequence', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: true,
  };

  const accepted = acceptFirstStoriesPage(current, 'top', pageOne);
  expect(accepted.pages).toEqual([pageOne]);
  expect(accepted.loading).toBe(false);
  expect(accepted.error).toBeNull();

  const invalid = acceptFirstStoriesPage(current, 'top', { ...pageOne, page: 2 });
  expect(invalid.pages).toEqual([pageOne]);
  expect(invalid.loading).toBe(false);
  expect(invalid.error?.code).toBe('INTERNAL');
  expect(invalid.automaticPause).toBe('error');
});

test('preserves the snapshot-expiry revision across category changes', () => {
  const current = { ...initialStoriesRequestState('top'), snapshotExpiryRevision: 2 };
  expect(beginStoriesRequest(current, 'new').snapshotExpiryRevision).toBe(2);
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

test('rejects a repeated page number and aggregates freshness conservatively', () => {
  const pageTwo: StoriesPage = {
    ...pageOne,
    items: [item(2, 'Duplicate title'), item(3)],
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
  expect(duplicate.loadMoreError?.code).toBe('INTERNAL');

  const combined = combineStoriesPages(current.pages);
  expect(combined).toMatchObject({
    page: 2,
    limit: 30,
    snapshot: pageOne.snapshot,
    cachedAt: '2026-10-11T12:03:00.000Z',
    stale: true,
    hasMore: false,
    items: [item(1), item(2), item(3)],
  });
  expect(combined?.items[1]?.title).toBe('Story 2');
});

test('validates snapshot, negotiated limit, and next page before accepting a response', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    loadingMore: true,
  };

  for (const invalidPage of [
    { ...pageOne, page: 2, snapshot: 'other-snapshot' },
    { ...pageOne, page: 2, limit: pageOne.limit + 1 },
    { ...pageOne, page: 4 },
  ]) {
    const result = appendStoriesPage(current, invalidPage);
    expect(result.pages).toEqual([pageOne]);
    expect(result.loadingMore).toBe(false);
    expect(result.loadMoreError?.code).toBe('INTERNAL');
  }
});

test('deduplicates the visible projection in stable first-seen order', () => {
  const pageTwo: StoriesPage = {
    ...pageOne,
    items: [item(2, 'Later duplicate'), item(3)],
    page: 2,
  };
  const pageThree: StoriesPage = {
    ...pageOne,
    items: [item(3, 'Third-page duplicate'), item(4)],
    page: 3,
  };
  const combined = combineStoriesPages([pageOne, pageTwo, pageThree]);

  expect(combined?.items.map(({ id }) => id)).toEqual([1, 2, 3, 4]);
  expect(combined?.items[1]?.title).toBe('Story 2');
  expect(combined?.items[2]?.title).toBe('Story 3');
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

test('keeps a voluntary pause through manual append, page failure, and a same-category restart', () => {
  const paused = setVoluntaryPause({ ...initialStoriesRequestState('top'), pages: [pageOne], loading: false }, 'top', true);
  expect(paused.voluntaryPause).toBe(true);

  const manualPage: StoriesPage = { ...pageOne, items: [item(3)], page: 2, hasMore: true };
  const appended = appendStoriesPage({ ...paused, loadingMore: true }, manualPage, 'manual');
  expect(appended.voluntaryPause).toBe(true);
  expect(appended.automaticPause).toBeNull();

  const failed = failStoriesPageRequest({ ...paused, loadingMore: true }, 'top', networkError);
  expect(failed.voluntaryPause).toBe(true);

  expect(beginStoriesRequest(paused, 'top').voluntaryPause).toBe(true);
});

test('clears a voluntary pause when another category starts its own sequence', () => {
  const paused = setVoluntaryPause({ ...initialStoriesRequestState('top'), pages: [pageOne], loading: false }, 'top', true);
  expect(beginStoriesRequest(paused, 'new').voluntaryPause).toBe(false);
  expect(setVoluntaryPause(paused, 'new', false)).toBe(paused);
});

test('blocks automatic continuation while voluntarily paused but keeps manual parameters available', () => {
  const ready: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    lastPageHadNewItems: true,
  };
  expect(isAutomaticContinuationAllowed(ready)).toBe(true);

  const paused = setVoluntaryPause(ready, 'top', true);
  expect(isAutomaticContinuationAllowed(paused)).toBe(false);
  expect(incrementalRequestParams(paused)).toEqual({ page: 2, limit: 30, snapshot: pageOne.snapshot });

  const resumed = setVoluntaryPause(paused, 'top', false);
  expect(isAutomaticContinuationAllowed(resumed)).toBe(true);
});

test('never infers continuation from an unknown or final page', () => {
  const unknown: StoriesPage = { ...pageOne, hasMore: undefined } as unknown as StoriesPage;
  const unknownState: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [unknown],
    loading: false,
    lastPageHadNewItems: true,
  };
  expect(isAutomaticContinuationAllowed(unknownState)).toBe(false);
  expect(isAutomaticContinuationAllowed({
    ...unknownState,
    pages: [{ ...pageOne, hasMore: false }],
  })).toBe(false);
});

test('turns a cancelled 410 recovery into a retryable loading state without an error', () => {
  const recovering: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    loadingMore: true,
    snapshotExpired: true,
    snapshotExpiryRevision: 1,
  };

  const cancelled = cancelRecoveringStoriesRequest(recovering, 'top');
  expect(cancelled).toMatchObject({
    pages: [],
    loading: true,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    recoveryPending: true,
    snapshotExpiryRevision: 1,
  });
  expect(cancelRecoveringStoriesRequest(recovering, 'new')).toBe(recovering);
  expect(beginStoriesRequest(cancelled, 'top').recoveryPending).toBe(false);
});

test('retries an incremental page error with the identical snapshot, limit, and page', () => {
  const current: StoriesRequestState = {
    ...initialStoriesRequestState('top'),
    pages: [pageOne],
    loading: false,
    loadingMore: true,
  };
  const before = incrementalRequestParams(current);
  const failed = failStoriesPageRequest(current, 'top', networkError);
  expect(incrementalRequestParams(failed)).toEqual(before);
  expect(before).toEqual({ page: 2, limit: 30, snapshot: 'snapshot-top-001' });
});
