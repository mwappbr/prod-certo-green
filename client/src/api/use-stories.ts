import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoriesPage, StoryCategory } from '@hn/shared/contract/stories';
import { mapApiError, ClientApiError } from './errors';
import { getStories } from './stories';

export type StoriesListData = Omit<StoriesPage, 'items'> & { items: StoriesPage['items'] };
export type StoriesSequenceScope = Readonly<{ generation: number; navigationCycle: number }>;
type AutomaticPause = 'empty' | 'error' | null;
type LoadMoreOrigin = 'manual' | 'automatic';

export type StoriesRequestState = {
  category: StoryCategory;
  pages: StoriesPage[];
  loading: boolean;
  error: ClientApiError | null;
  loadingMore: boolean;
  loadMoreError: ClientApiError | null;
  snapshotExpired: boolean;
  snapshotExpiryRevision: number;
  lastPageHadNewItems: boolean;
  automaticPause: AutomaticPause;
  voluntaryPause: boolean;
  recoveryPending: boolean;
};

type ActiveIncrementalRequest = {
  category: StoryCategory;
  controller: AbortController;
  key: string;
  origin: LoadMoreOrigin;
  scope: StoriesSequenceScope;
  recoveringSnapshot: boolean;
};

function uniqueItems(items: StoriesPage['items']): StoriesPage['items'] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function countNewItems(pages: StoriesPage[], page: StoriesPage): number {
  const seen = new Set(pages.flatMap((loaded) => loaded.items.map((item) => item.id)));
  return page.items.reduce((count, item) => {
    if (seen.has(item.id)) return count;
    seen.add(item.id);
    return count + 1;
  }, 0);
}

export function initialStoriesRequestState(category: StoryCategory): StoriesRequestState {
  return {
    category,
    pages: [],
    loading: true,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: false,
    snapshotExpiryRevision: 0,
    lastPageHadNewItems: false,
    automaticPause: null,
    voluntaryPause: false,
    recoveryPending: false,
  };
}

export function beginStoriesRequest(current: StoriesRequestState, category: StoryCategory): StoriesRequestState {
  const sameCategory = current.category === category;
  return {
    ...initialStoriesRequestState(category),
    pages: sameCategory ? current.pages : [],
    snapshotExpired: sameCategory && current.snapshotExpired,
    snapshotExpiryRevision: current.snapshotExpiryRevision,
    automaticPause: sameCategory ? current.automaticPause : null,
    voluntaryPause: sameCategory && current.voluntaryPause,
  };
}

export function setVoluntaryPause(
  current: StoriesRequestState,
  category: StoryCategory,
  paused: boolean,
): StoriesRequestState {
  if (current.category !== category || current.voluntaryPause === paused) return current;
  return { ...current, voluntaryPause: paused };
}

export function cancelRecoveringStoriesRequest(
  current: StoriesRequestState,
  category: StoryCategory,
): StoriesRequestState {
  if (current.category !== category) return current;
  return {
    ...current,
    pages: [],
    loading: true,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    lastPageHadNewItems: false,
    automaticPause: null,
    recoveryPending: true,
  };
}

export function incrementalRequestParams(
  state: StoriesRequestState,
): { page: number; limit: number; snapshot: string } | null {
  const first = state.pages[0];
  const last = state.pages.at(-1);
  if (!first || !last) return null;
  return { page: last.page + 1, limit: first.limit, snapshot: first.snapshot };
}

export function isAutomaticContinuationAllowed(state: StoriesRequestState): boolean {
  const last = state.pages.at(-1);
  return Boolean(
    state.pages[0] &&
    last &&
    !state.loading &&
    !state.error &&
    !state.loadingMore &&
    !state.loadMoreError &&
    state.automaticPause === null &&
    !state.voluntaryPause &&
    state.lastPageHadNewItems &&
    last.hasMore === true,
  );
}

export function failStoriesRequest(
  current: StoriesRequestState,
  category: StoryCategory,
  error: unknown,
): StoriesRequestState {
  const sameCategory = current.category === category;
  return {
    ...current,
    category,
    pages: sameCategory ? current.pages : [],
    loading: false,
    error: mapApiError(error),
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: sameCategory && current.snapshotExpired,
    lastPageHadNewItems: false,
    automaticPause: 'error',
  };
}

export function acceptFirstStoriesPage(
  current: StoriesRequestState,
  category: StoryCategory,
  page: StoriesPage,
): StoriesRequestState {
  if (current.category !== category) return current;
  if (page.page !== 1) {
    return failStoriesRequest(
      current,
      category,
      new ClientApiError('INTERNAL', 'A primeira página da lista é inválida. Tente novamente.'),
    );
  }

  const uniqueCount = uniqueItems(page.items).length;
  return {
    ...current,
    pages: [page],
    loading: false,
    error: null,
    loadingMore: false,
    loadMoreError: null,
    lastPageHadNewItems: uniqueCount > 0,
    automaticPause: null,
  };
}

export function appendStoriesPage(
  current: StoriesRequestState,
  page: StoriesPage,
  origin: LoadMoreOrigin = 'manual',
): StoriesRequestState {
  const first = current.pages[0];
  const last = current.pages.at(-1);
  if (!first || !last) {
    return {
      ...current,
      loadingMore: false,
      loadMoreError: new ClientApiError('INTERNAL', 'A lista precisa ser carregada novamente.'),
      automaticPause: 'error',
    };
  }

  if (page.page !== last.page + 1 || page.snapshot !== first.snapshot || page.limit !== first.limit) {
    return {
      ...current,
      loadingMore: false,
      loadMoreError: new ClientApiError('INTERNAL', 'A sequência da lista mudou. Tente novamente.'),
      automaticPause: 'error',
    };
  }

  const newItemCount = countNewItems(current.pages, page);
  const automaticPause: AutomaticPause = newItemCount === 0
    ? 'empty'
    : origin === 'manual'
      ? null
      : current.automaticPause;

  return {
    ...current,
    pages: [...current.pages, page],
    loadingMore: false,
    loadMoreError: null,
    snapshotExpired: false,
    lastPageHadNewItems: newItemCount > 0,
    automaticPause,
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
    automaticPause: 'error',
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
    items: uniqueItems(pages.flatMap((page) => page.items)),
    limit: first.limit,
    snapshot: first.snapshot,
    cachedAt,
    stale: pages.some((page) => page.stale),
  };
}

function sameScope(left: StoriesSequenceScope, right: StoriesSequenceScope): boolean {
  return left.generation === right.generation && left.navigationCycle === right.navigationCycle;
}

export function useStories(category: StoryCategory) {
  const [state, setState] = useState<StoriesRequestState>(() => initialStoriesRequestState(category));
  const [attempt, setAttempt] = useState(0);
  const [, setPolicyRevision] = useState(0);
  const generationRef = useRef(0);
  const navigationCycleRef = useRef(0);
  const readingReadyRef = useRef(false);
  const focusProtectedRef = useRef(false);
  const activeIncrementalRef = useRef<ActiveIncrementalRequest | null>(null);
  const snapshotExpiryRevisionRef = useRef(0);

  const getScope = useCallback((): StoriesSequenceScope => ({
    generation: generationRef.current,
    navigationCycle: navigationCycleRef.current,
  }), []);

  const isCurrentScope = useCallback((scope: StoriesSequenceScope) => sameScope(scope, getScope()), [getScope]);

  const bumpPolicyRevision = useCallback(() => setPolicyRevision((revision) => revision + 1), []);

  const cancelIncrementalRequest = useCallback((automaticOnly = false) => {
    const request = activeIncrementalRef.current;
    if (!request || (automaticOnly && (request.origin !== 'automatic' || request.recoveringSnapshot))) return;

    activeIncrementalRef.current = null;
    request.controller.abort();
    setState((current) => {
      if (current.category !== request.category) return current;
      if (request.recoveringSnapshot) return cancelRecoveringStoriesRequest(current, request.category);
      return current.loadingMore ? { ...current, loadingMore: false } : current;
    });
    bumpPolicyRevision();
  }, [bumpPolicyRevision]);

  const beginNavigationCycle = useCallback(() => {
    navigationCycleRef.current += 1;
    readingReadyRef.current = false;
    focusProtectedRef.current = false;
    cancelIncrementalRequest();
    bumpPolicyRevision();
    return navigationCycleRef.current;
  }, [bumpPolicyRevision, cancelIncrementalRequest]);

  const completeReadingTransition = useCallback((navigationCycle: number) => {
    if (navigationCycle !== navigationCycleRef.current) return false;
    readingReadyRef.current = true;
    bumpPolicyRevision();
    return true;
  }, [bumpPolicyRevision]);

  const setAutomaticPaused = useCallback((paused: boolean) => {
    if (paused) cancelIncrementalRequest(true);
    setState((current) => setVoluntaryPause(current, category, paused));
    bumpPolicyRevision();
  }, [bumpPolicyRevision, cancelIncrementalRequest, category]);

  const suspendReadingForSnapshot = useCallback(() => {
    readingReadyRef.current = false;
    bumpPolicyRevision();
    return navigationCycleRef.current;
  }, [bumpPolicyRevision]);

  const setFocusProtection = useCallback((scope: StoriesSequenceScope, protectedFocus: boolean) => {
    if (!isCurrentScope(scope) || focusProtectedRef.current === protectedFocus) return;
    focusProtectedRef.current = protectedFocus;
    if (protectedFocus) cancelIncrementalRequest(true);
    bumpPolicyRevision();
  }, [bumpPolicyRevision, cancelIncrementalRequest, isCurrentScope]);

  useEffect(() => {
    const generation = ++generationRef.current;
    readingReadyRef.current = false;
    focusProtectedRef.current = false;
    cancelIncrementalRequest();
    bumpPolicyRevision();

    const controller = new AbortController();
    setState((current) => beginStoriesRequest(current, category));

    getStories(category, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setState((current) => acceptFirstStoriesPage(current, category, data));
      },
      (error: unknown) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setState((current) => failStoriesRequest(current, category, error));
      },
    );

    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current += 1;
      cancelIncrementalRequest();
    };
  }, [attempt, bumpPolicyRevision, cancelIncrementalRequest, category]);

  const visibleState = state.category === category ? state : beginStoriesRequest(state, category);
  const data = combineStoriesPages(visibleState.pages);

  const automaticEnabled = readingReadyRef.current &&
    !focusProtectedRef.current &&
    !activeIncrementalRef.current &&
    visibleState.category === category &&
    isAutomaticContinuationAllowed(visibleState);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const loadMore = useCallback((origin: LoadMoreOrigin = 'manual', requestedScope: StoriesSequenceScope = getScope()) => {
    const currentScope = getScope();
    if (!isCurrentScope(requestedScope)) return false;

    const current = state.category === category ? state : null;
    const params = current ? incrementalRequestParams(current) : null;
    if (!current || !params || current.loading || current.loadingMore || current.pages.at(-1)?.hasMore === false) return false;
    if (activeIncrementalRef.current) return false;
    if (origin === 'automatic' && (
      !readingReadyRef.current ||
      focusProtectedRef.current ||
      !isAutomaticContinuationAllowed(current)
    )) return false;

    const { page, limit, snapshot } = params;
    const key = `${category}:${snapshot}:${page}`;
    const request: ActiveIncrementalRequest = {
      category,
      controller: new AbortController(),
      key,
      origin,
      scope: currentScope,
      recoveringSnapshot: false,
    };
    activeIncrementalRef.current = request;
    setState((previous) => previous.category === category
      ? { ...previous, loadingMore: true, loadMoreError: null }
      : previous);

    const stillOwnsRequest = () => activeIncrementalRef.current === request && !request.controller.signal.aborted && isCurrentScope(request.scope);
    const releaseRequest = () => {
      if (activeIncrementalRef.current === request) {
        activeIncrementalRef.current = null;
        bumpPolicyRevision();
      }
    };

    getStories(category, {
      page,
      limit,
      snapshot,
      signal: request.controller.signal,
    }).then(
      (nextPage) => {
        if (!stillOwnsRequest()) return;
        setState((previous) => previous.category === category
          ? appendStoriesPage(previous, nextPage, origin)
          : previous);
      },
      (error: unknown) => {
        if (!stillOwnsRequest()) return;
        const apiError = mapApiError(error);
        if (apiError.code !== 'SNAPSHOT_EXPIRED') {
          setState((previous) => failStoriesPageRequest(previous, category, apiError));
          return;
        }

        request.recoveringSnapshot = true;
        const snapshotExpiryRevision = ++snapshotExpiryRevisionRef.current;
        setState((previous) => previous.category === category
          ? {
              ...previous,
              pages: [],
              loading: true,
              error: null,
              loadingMore: false,
              loadMoreError: null,
              snapshotExpired: true,
              snapshotExpiryRevision,
              lastPageHadNewItems: false,
              automaticPause: null,
            }
          : previous);

        return getStories(category, { signal: request.controller.signal }).then(
          (firstPage) => {
            if (!stillOwnsRequest()) return;
            setState((previous) => acceptFirstStoriesPage(previous, category, firstPage));
          },
          (refreshError: unknown) => {
            if (!stillOwnsRequest()) return;
            setState((previous) => previous.category === category
              ? {
                  ...previous,
                  loading: false,
                  error: mapApiError(refreshError),
                  loadingMore: false,
                  loadMoreError: null,
                  lastPageHadNewItems: false,
                  automaticPause: 'error',
                  snapshotExpired: true,
                }
              : previous);
          },
        );
      },
    ).finally(releaseRequest);

    return true;
  }, [bumpPolicyRevision, category, getScope, isCurrentScope, state]);

  return {
    ...visibleState,
    data,
    retry,
    loadMore,
    setAutomaticPaused,
    getScope,
    beginNavigationCycle,
    completeReadingTransition,
    suspendReadingForSnapshot,
    setFocusProtection,
    automaticEnabled,
    loadingMoreOrigin: activeIncrementalRef.current?.origin ?? null,
  };
}
