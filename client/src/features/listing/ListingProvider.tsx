import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { useStories } from '../../api/use-stories';

export type ListingRoute = { type: 'list' } | { type: 'item'; id: number } | { type: 'not-found' };

type PendingScrollRestore = { position: number; navigationCycle: number };

type ListingContextValue = {
  category: StoryCategory;
  setCategory: (category: StoryCategory) => void;
  route: ListingRoute;
  openItem: (id: number) => void;
  backToListing: () => void;
  scrollPosition: number;
  saveScrollPosition: (position: number) => void;
  readingCycle: number | null;
  stories: ReturnType<typeof useStories>;
};

const categories: readonly StoryCategory[] = ['top', 'new', 'best', 'ask', 'show', 'job'];
const ListingContext = createContext<ListingContextValue | null>(null);

function isStoryCategory(value: unknown): value is StoryCategory {
  return typeof value === 'string' && categories.some((category) => category === value);
}

function categoryFromUrl(): StoryCategory {
  const value = new URLSearchParams(window.location.search).get('category');
  return isStoryCategory(value) ? value : 'top';
}

function categoryFromHistoryState(state: unknown): StoryCategory | null {
  if (!state || typeof state !== 'object' || !('category' in state)) return null;
  return isStoryCategory(state.category) ? state.category : null;
}

function routeFromUrl(): ListingRoute {
  const pathname = window.location.pathname;
  if (pathname === '/') return { type: 'list' };

  const match = pathname.match(/^\/item\/([^/]+)\/?$/);
  if (!match?.[1] || !/^\d+$/.test(match[1])) return { type: 'not-found' };
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? { type: 'item', id } : { type: 'not-found' };
}

function initialCategory(): StoryCategory {
  const route = routeFromUrl();
  return route.type === 'item'
    ? categoryFromHistoryState(window.history.state) ?? categoryFromUrl()
    : categoryFromUrl();
}

function pathForCategory(category: StoryCategory): string {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.hash = '';
  if (category === 'top') url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  return `${url.pathname}${url.search}`;
}

function savedPosition(state: unknown): number {
  if (!state || typeof state !== 'object' || !('scrollPosition' in state)) return 0;
  const position = (state as { scrollPosition?: unknown }).scrollPosition;
  return typeof position === 'number' && Number.isFinite(position) ? Math.max(0, position) : 0;
}

export function ListingProvider({ children }: { children: ReactNode }) {
  const [category, setCategoryState] = useState<StoryCategory>(initialCategory);
  const [route, setRoute] = useState<ListingRoute>(routeFromUrl);
  const [scrollPosition, saveScrollPosition] = useState(0);
  const stories = useStories(category);
  const [pendingScrollRestore, setPendingScrollRestore] = useState<PendingScrollRestore | null>({ position: 0, navigationCycle: 0 });
  const [readingCycle, setReadingCycle] = useState<number | null>(null);
  const pendingScrollRestoreRef = useRef<PendingScrollRestore | null>(pendingScrollRestore);
  const restoreFrameRef = useRef<number | null>(null);
  const routeRef = useRef(route);
  const handledSnapshotExpiryRevisionRef = useRef(0);
  pendingScrollRestoreRef.current = pendingScrollRestore;
  routeRef.current = route;

  const beginTransition = useCallback((position: number | null) => {
    const navigationCycle = stories.beginNavigationCycle();
    const pending = position === null ? null : { position, navigationCycle };
    pendingScrollRestoreRef.current = pending;
    setPendingScrollRestore(pending);
    setReadingCycle(null);
    return navigationCycle;
  }, [stories.beginNavigationCycle]);

  const setCategory = useCallback((nextCategory: StoryCategory) => {
    const nextPath = pathForCategory(nextCategory);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextCategory === category && nextPath === currentPath) return;

    beginTransition(0);
    const previousState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {};
    window.history.replaceState(
      { ...previousState, route: 'list', fromItem: false, category, scrollPosition: window.scrollY },
      '',
      currentPath,
    );
    window.history.pushState({ route: 'list', category: nextCategory, scrollPosition: 0 }, '', nextPath);
    setCategoryState(nextCategory);
    setRoute({ type: 'list' });
    saveScrollPosition(0);
    window.scrollTo(0, 0);
  }, [beginTransition, category]);

  const openItem = useCallback((id: number) => {
    if (!Number.isSafeInteger(id) || id < 0) return;
    const position = window.scrollY;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {};
    beginTransition(null);
    window.history.replaceState(
      { ...previousState, route: 'list', fromItem: true, category, scrollPosition: position },
      '',
      currentPath,
    );
    window.history.pushState(
      { route: 'item', fromListing: true, category, returnTo: currentPath, scrollPosition: position },
      '',
      `/item/${id}`,
    );
    saveScrollPosition(position);
    setRoute({ type: 'item', id });
  }, [beginTransition, category]);

  const backToListing = useCallback(() => {
    const state: unknown = window.history.state;
    if (
      route.type === 'item' &&
      state &&
      typeof state === 'object' &&
      'fromListing' in state &&
      state.fromListing === true
    ) {
      beginTransition(null);
      window.history.back();
      return;
    }

    const path = pathForCategory(category);
    beginTransition(0);
    window.history.replaceState({ route: 'list', category, scrollPosition: 0 }, '', path);
    setRoute({ type: 'list' });
    saveScrollPosition(0);
    window.scrollTo(0, 0);
  }, [beginTransition, category, route]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const syncLocation = () => {
      const nextRoute = routeFromUrl();
      const state: unknown = window.history.state;
      const nextCategory = nextRoute.type === 'item'
        ? categoryFromHistoryState(state) ?? categoryFromUrl()
        : categoryFromUrl();
      const navigationCycle = stories.beginNavigationCycle();
      setReadingCycle(null);
      setCategoryState(nextCategory);
      setRoute(nextRoute);
      if (nextRoute.type === 'list') {
        const position = savedPosition(window.history.state);
        const pending = { position, navigationCycle };
        pendingScrollRestoreRef.current = pending;
        setPendingScrollRestore(pending);
        saveScrollPosition(position);
      } else {
        pendingScrollRestoreRef.current = null;
        setPendingScrollRestore(null);
      }
    };
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, [stories.beginNavigationCycle]);

  const recoveryPending = stories.recoveryPending;
  const retryStories = stories.retry;
  useEffect(() => {
    // A 410 recovery cancelled by navigation leaves a retryable loading state; it restarts only when the list is shown.
    if (route.type === 'list' && recoveryPending) retryStories();
  }, [recoveryPending, retryStories, route.type]);

  useLayoutEffect(() => {
    const revision = stories.snapshotExpiryRevision;
    if (revision <= handledSnapshotExpiryRevisionRef.current) return;
    handledSnapshotExpiryRevisionRef.current = revision;
    if (route.type === 'list') {
      const navigationCycle = stories.suspendReadingForSnapshot();
      const pending = { position: 0, navigationCycle };
      pendingScrollRestoreRef.current = pending;
      setPendingScrollRestore(pending);
      setReadingCycle(null);
    }
  }, [route.type, stories.snapshotExpiryRevision, stories.suspendReadingForSnapshot]);

  useLayoutEffect(() => {
    const pending = pendingScrollRestore;
    if (route.type !== 'list' || pending === null || (stories.loading && !stories.data)) return;

    const frame = window.requestAnimationFrame(() => {
      if (restoreFrameRef.current !== frame || pendingScrollRestoreRef.current !== pending || routeRef.current.type !== 'list') return;
      restoreFrameRef.current = null;
      window.scrollTo(0, pending.position);
      pendingScrollRestoreRef.current = null;
      setPendingScrollRestore(null);
      setReadingCycle(pending.navigationCycle);
    });
    restoreFrameRef.current = frame;

    return () => {
      if (restoreFrameRef.current !== frame) return;
      window.cancelAnimationFrame(frame);
      restoreFrameRef.current = null;
    };
  }, [pendingScrollRestore, route, stories.data?.items.length, stories.data?.page, stories.loading]);

  const value = useMemo(
    () => ({ category, setCategory, route, openItem, backToListing, scrollPosition, saveScrollPosition, readingCycle, stories }),
    [category, setCategory, route, openItem, backToListing, scrollPosition, readingCycle, stories],
  );
  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}

export function useListing(): ListingContextValue {
  const value = useContext(ListingContext);
  if (!value) throw new Error('ListingProvider não está montado.');
  return value;
}
