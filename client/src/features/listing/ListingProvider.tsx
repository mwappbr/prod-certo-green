import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { useStories } from '../../api/use-stories';

export type ListingRoute = { type: 'list' } | { type: 'item'; id: number } | { type: 'not-found' };

type ListingContextValue = {
  category: StoryCategory;
  setCategory: (category: StoryCategory) => void;
  route: ListingRoute;
  openItem: (id: number) => void;
  backToListing: () => void;
  scrollPosition: number;
  saveScrollPosition: (position: number) => void;
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
  const [pendingScrollRestore, setPendingScrollRestore] = useState<number | null>(null);
  const stories = useStories(category);

  const setCategory = useCallback((nextCategory: StoryCategory) => {
    const nextPath = pathForCategory(nextCategory);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextCategory === category && nextPath === currentPath) return;

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
    setPendingScrollRestore(0);
    window.scrollTo(0, 0);
  }, [category]);

  const openItem = useCallback((id: number) => {
    if (!Number.isSafeInteger(id) || id < 0) return;
    const position = window.scrollY;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const previousState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {};
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
  }, [category]);

  const backToListing = useCallback(() => {
    const state: unknown = window.history.state;
    if (
      route.type === 'item' &&
      state &&
      typeof state === 'object' &&
      'fromListing' in state &&
      state.fromListing === true
    ) {
      window.history.back();
      return;
    }

    const path = pathForCategory(category);
    window.history.replaceState({ route: 'list', category, scrollPosition: 0 }, '', path);
    setRoute({ type: 'list' });
    saveScrollPosition(0);
    setPendingScrollRestore(0);
    window.scrollTo(0, 0);
  }, [category, route]);

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
      setCategoryState(nextCategory);
      setRoute(nextRoute);
      if (nextRoute.type === 'list') {
        const position = savedPosition(window.history.state);
        saveScrollPosition(position);
        setPendingScrollRestore(position);
      } else {
        setPendingScrollRestore(null);
      }
    };
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  useLayoutEffect(() => {
    if (route.type !== 'list' || pendingScrollRestore === null || (stories.loading && !stories.data)) return;
    const position = pendingScrollRestore;
    setPendingScrollRestore(null);
    window.requestAnimationFrame(() => window.scrollTo(0, position));
  }, [route, pendingScrollRestore, stories.loading, stories.data?.page, stories.data?.items.length]);

  const value = useMemo(
    () => ({ category, setCategory, route, openItem, backToListing, scrollPosition, saveScrollPosition, stories }),
    [category, setCategory, route, openItem, backToListing, scrollPosition, stories],
  );
  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}

export function useListing(): ListingContextValue {
  const value = useContext(ListingContext);
  if (!value) throw new Error('ListingProvider não está montado.');
  return value;
}
