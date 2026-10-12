import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StoriesPage, StoryCategory } from '@hn/shared/contract/stories';
import { mapApiError, ClientApiError } from './errors';
import { getStories } from './stories';

export type StoriesListData = Omit<StoriesPage, 'items'> & { items: StoriesPage['items'] };

export type StoriesRequestState = {
  category: StoryCategory;
  pages: StoriesPage[];
  loading: boolean;
  error: ClientApiError | null;
  loadingMore: boolean;
  loadMoreError: ClientApiError | null;
  snapshotExpired: boolean;
};

export function initialStoriesRequestState(category: StoryCategory): StoriesRequestState {
  return {
    category,
    pages: [],
    loading: true,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: false,
  };
}

export function beginStoriesRequest(current: StoriesRequestState, category: StoryCategory): StoriesRequestState {
  const sameCategory = current.category === category;
  return {
    category,
    pages: sameCategory ? current.pages : [],
    loading: true,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: sameCategory && current.snapshotExpired,
  };
}

export function failStoriesRequest(
  current: StoriesRequestState,
  category: StoryCategory,
  error: unknown,
): StoriesRequestState {
  const sameCategory = current.category === category;
  return {
    category,
    pages: sameCategory ? current.pages : [],
    loading: false,
    error: mapApiError(error),
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: sameCategory && current.snapshotExpired,
  };
}

export function appendStoriesPage(current: StoriesRequestState, page: StoriesPage): StoriesRequestState {
  const first = current.pages[0];
  const last = current.pages.at(-1);
  if (!first || !last) {
    return {
      ...current,
      loadingMore: false,
      loadMoreError: new ClientApiError('INTERNAL', 'A lista precisa ser carregada novamente.'),
    };
  }

  if (current.pages.some((loadedPage) => loadedPage.page === page.page)) {
    return { ...current, loadingMore: false, loadMoreError: null };
  }

  if (page.page !== last.page + 1 || page.snapshot !== first.snapshot) {
    return {
      ...current,
      loadingMore: false,
      loadMoreError: new ClientApiError('INTERNAL', 'A sequência da lista mudou. Tente novamente.'),
    };
  }

  return {
    ...current,
    pages: [...current.pages, page],
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: false,
  };
}

export function failStoriesPageRequest(
  current: StoriesRequestState,
  category: StoryCategory,
  error: unknown,
): StoriesRequestState {
  if (current.category !== category) return current;
  return {
    ...current,
    loadingMore: false,
    loadMoreError: mapApiError(error),
  };
}

export function combineStoriesPages(pages: StoriesPage[]): StoriesListData | null {
  const first = pages[0];
  const last = pages.at(-1);
  if (!first || !last) return null;

  const cachedAt = pages.reduce(
    (oldest, page) => page.cachedAt < oldest ? page.cachedAt : oldest,
    first.cachedAt,
  );

  return {
    ...last,
    items: pages.flatMap((page) => page.items),
    limit: first.limit,
    snapshot: first.snapshot,
    cachedAt,
    stale: pages.some((page) => page.stale),
  };
}

export function useStories(category: StoryCategory) {
  const [state, setState] = useState<StoriesRequestState>(() => initialStoriesRequestState(category));
  const [attempt, setAttempt] = useState(0);
  const generationRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const loadMoreKeyRef = useRef<string | null>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const scrollRestoreFrameRef = useRef<number | null>(null);
  const scrollRestoreScopeRef = useRef({ category, attempt });
  const observedLoadingMoreRef = useRef(false);
  const cancelPendingScrollRestore = useCallback(() => {
    const frame = scrollRestoreFrameRef.current;
    if (frame === null) return;
    window.cancelAnimationFrame(frame);
    scrollRestoreFrameRef.current = null;
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    loadMoreKeyRef.current = null;
    pendingScrollRestoreRef.current = null;
    setState((current) => beginStoriesRequest(current, category));

    getStories(category, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setState((current) => current.category === category
          ? {
              ...current,
              pages: [data],
              loading: false,
              error: null,
              loadingMore: false,
              loadMoreError: null,
            }
          : current);
      },
      (error: unknown) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setState((current) => failStoriesRequest(current, category, error));
      },
    );

    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current += 1;
      loadMoreControllerRef.current?.abort();
      loadMoreControllerRef.current = null;
      loadMoreKeyRef.current = null;
      cancelPendingScrollRestore();
      pendingScrollRestoreRef.current = null;
    };
  }, [category, attempt, cancelPendingScrollRestore]);

  const visibleState = state.category === category ? state : beginStoriesRequest(state, category);
  const data = combineStoriesPages(visibleState.pages);

  useLayoutEffect(() => {
    const previousScope = scrollRestoreScopeRef.current;
    if (previousScope.category !== category || previousScope.attempt !== attempt) {
      scrollRestoreScopeRef.current = { category, attempt };
      cancelPendingScrollRestore();
      pendingScrollRestoreRef.current = null;
      observedLoadingMoreRef.current = false;
    }
  }, [attempt, cancelPendingScrollRestore, category]);

  useLayoutEffect(() => {
    if (observedLoadingMoreRef.current && !visibleState.loadingMore && pendingScrollRestoreRef.current !== null) {
      const position = pendingScrollRestoreRef.current;
      const scope = scrollRestoreScopeRef.current;
      const generation = generationRef.current;
      pendingScrollRestoreRef.current = null;
      cancelPendingScrollRestore();
      const frame = window.requestAnimationFrame(() => {
        if (scrollRestoreFrameRef.current !== frame) return;
        scrollRestoreFrameRef.current = null;
        const currentScope = scrollRestoreScopeRef.current;
        if (
          currentScope.category !== scope.category ||
          currentScope.attempt !== scope.attempt ||
          generationRef.current !== generation
        ) return;
        window.scrollTo(0, position);
      });
      scrollRestoreFrameRef.current = frame;
    }
    observedLoadingMoreRef.current = visibleState.loadingMore;
  }, [cancelPendingScrollRestore, visibleState.loadingMore, visibleState.loadMoreError, visibleState.pages.length]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const loadMore = useCallback(() => {
    const current = state.category === category ? state : null;
    const first = current?.pages[0];
    const last = current?.pages.at(-1);
    if (!current || !first || !last || current.loading || current.loadingMore || last.hasMore === false) return;

    const page = last.page + 1;
    const key = `${category}:${first.snapshot}:${page}`;
    if (loadMoreKeyRef.current === key) return;

    const generation = generationRef.current;
    const controller = new AbortController();
    const scrollPosition = window.scrollY;
    loadMoreKeyRef.current = key;
    loadMoreControllerRef.current = controller;
    pendingScrollRestoreRef.current = scrollPosition;
    setState((previous) => previous.category === category
      ? { ...previous, loadingMore: true, loadMoreError: null }
      : previous);

    getStories(category, {
      page,
      limit: first.limit,
      snapshot: first.snapshot,
      signal: controller.signal,
    }).then(
      (nextPage) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setState((previous) => appendStoriesPage(previous, nextPage));
      },
      (error: unknown) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        const apiError = mapApiError(error);
        if (apiError.code !== 'SNAPSHOT_EXPIRED') {
          setState((previous) => failStoriesPageRequest(previous, category, apiError));
          return;
        }

        pendingScrollRestoreRef.current = null;
        window.scrollTo(0, 0);
        setState((previous) => previous.category === category
          ? {
              ...previous,
              pages: [],
              loading: true,
              error: null,
              loadingMore: false,
              loadMoreError: null,
              snapshotExpired: true,
            }
          : previous);

        return getStories(category, { signal: controller.signal }).then(
          (firstPage) => {
            if (controller.signal.aborted || generationRef.current !== generation) return;
            setState((previous) => previous.category === category
              ? {
                  ...previous,
                  pages: [firstPage],
                  loading: false,
                  error: null,
                  loadingMore: false,
                  loadMoreError: null,
                  snapshotExpired: true,
                }
              : previous);
          },
          (refreshError: unknown) => {
            if (controller.signal.aborted || generationRef.current !== generation) return;
            setState((previous) => previous.category === category
              ? {
                  ...previous,
                  loading: false,
                  error: mapApiError(refreshError),
                  loadingMore: false,
                  loadMoreError: null,
                  snapshotExpired: true,
                }
              : previous);
          },
        );
      },
    ).finally(() => {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        if (loadMoreKeyRef.current === key) loadMoreKeyRef.current = null;
      }
    });
  }, [category, state]);

  return {
    ...visibleState,
    data,
    retry,
    loadMore,
  };
}
