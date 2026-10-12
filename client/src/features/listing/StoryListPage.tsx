import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { useListing } from './ListingProvider';
import { StoryRow } from './StoryRow';
import { ThemeToggle } from '../theme/ThemeToggle';
import './listing.css';

const categories: { value: StoryCategory; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'best', label: 'Best' },
  { value: 'ask', label: 'Ask' },
  { value: 'show', label: 'Show' },
  { value: 'job', label: 'Jobs' },
];

function categoryLabel(category: StoryCategory): string {
  return categories.find((entry) => entry.value === category)?.label ?? category;
}

function CategoryTabs({ category, onChange }: { category: StoryCategory; onChange: (category: StoryCategory) => void }) {
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + categories.length) % categories.length;
    const nextCategory = categories[nextIndex];
    const nextTab = nextCategory ? document.getElementById(`category-tab-${nextCategory.value}`) : null;
    if (!nextTab) return;
    const strip = nextTab.closest('.category-tabs');
    if (strip instanceof HTMLElement) {
      const tabRect = nextTab.getBoundingClientRect();
      const stripRect = strip.getBoundingClientRect();
      const visibleLeft = stripRect.left + strip.clientLeft;
      const visibleRight = visibleLeft + strip.clientWidth;
      const inset = 1;
      if (tabRect.left < visibleLeft + inset) {
        strip.scrollTo({
          left: strip.scrollLeft + tabRect.left - (visibleLeft + inset),
          behavior: 'instant',
        });
      } else if (tabRect.right > visibleRight - inset) {
        strip.scrollTo({
          left: strip.scrollLeft + tabRect.right - (visibleRight - inset),
          behavior: 'instant',
        });
      }
    }
    nextTab.focus({ preventScroll: true });
  }

  return (
    <nav className="category-tabs">
      <div aria-label="Categorias" className="category-tabs__list" role="tablist">
        {categories.map((entry, index) => (
          <button
            aria-controls="listing-panel"
            aria-selected={category === entry.value}
            className="category-tabs__tab"
            id={`category-tab-${entry.value}`}
            key={entry.value}
            onClick={() => onChange(entry.value)}
            onKeyDown={(event) => moveFocus(event, index)}
            role="tab"
            tabIndex={category === entry.value ? 0 : -1}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function clockTime(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? 'horário indisponível'
    : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

type PendingLoadMoreFocus = {
  button: HTMLButtonElement;
  category: StoryCategory;
  href: string;
};

export function StoryListPage() {
  const { category, setCategory, openItem, saveScrollPosition, stories } = useListing();
  const { data, loading, error, retry, loadingMore, loadMoreError, snapshotExpired, loadMore } = stories;
  const isBusy = loading || loadingMore;
  const loadMoreButtonRef = useRef<HTMLButtonElement>(null);
  const pendingLoadMoreFocusRef = useRef<PendingLoadMoreFocus | null>(null);

  useEffect(() => {
    const clearRestoreAfterTab = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Tab') pendingLoadMoreFocusRef.current = null;
    };
    document.addEventListener('keydown', clearRestoreAfterTab, true);
    return () => document.removeEventListener('keydown', clearRestoreAfterTab, true);
  }, []);

  useEffect(() => {
    if (loadingMore) return;
    const pending = pendingLoadMoreFocusRef.current;
    if (!pending) return;
    if (
      pending.category !== category
      || pending.href !== window.location.href
      || !pending.button.isConnected
      || loadMoreButtonRef.current !== pending.button
    ) {
      pendingLoadMoreFocusRef.current = null;
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement !== document.body && activeElement !== pending.button) {
      pendingLoadMoreFocusRef.current = null;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (pendingLoadMoreFocusRef.current !== pending) return;
      const currentActiveElement = document.activeElement;
      if (
        pending.category !== category
        || pending.href !== window.location.href
        || !pending.button.isConnected
        || loadMoreButtonRef.current !== pending.button
        || (currentActiveElement !== document.body && currentActiveElement !== pending.button)
      ) {
        pendingLoadMoreFocusRef.current = null;
        return;
      }
      pendingLoadMoreFocusRef.current = null;
      pending.button.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      if (currentActiveElement !== pending.button) pending.button.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadingMore, category]);

  function handleCategoryChange(nextCategory: StoryCategory) {
    if (nextCategory !== category) pendingLoadMoreFocusRef.current = null;
    setCategory(nextCategory);
  }

  function handleLoadMore() {
    const button = loadMoreButtonRef.current;
    pendingLoadMoreFocusRef.current = button
      && document.activeElement === button
      && button.matches(':focus-visible')
      ? { button, category, href: window.location.href }
      : null;
    saveScrollPosition(window.scrollY);
    loadMore();
  }

  return (
    <main className="listing" aria-busy={isBusy}>
      <CategoryTabs category={category} onChange={handleCategoryChange} />
      <section
        id="listing-panel"
        aria-labelledby={`category-tab-${category}`}
        className="listing__panel listing__panel--plain"
        role="tabpanel"
        tabIndex={0}
      >
        <header className="listing__header">
          <div className="theme-screen-header">
            <div className="theme-screen-header__copy">
              <p className="listing__eyebrow">HN Moderno</p>
              <h1>{categoryLabel(category)}</h1>
              {data && <p className="freshness">Atualizado em {clockTime(data.cachedAt)}</p>}
            </div>
            <ThemeToggle />
          </div>
        </header>

        {snapshotExpired && (
          <p className="listing__notice" role="status">
            A lista mudou e foi atualizada. A sequência anterior foi reiniciada.
          </p>
        )}

        {data?.stale && (
          <p className="listing__notice" role="status">
            Não foi possível atualizar. Exibindo dados de {clockTime(data.cachedAt)}.
          </p>
        )}

        {loading && !data && <LoadingStories />}

        {error && !data && (
          <section className="listing-state" role="alert">
            <p>{error.message}</p>
            <button className="listing__button" type="button" onClick={retry}>Tentar de novo</button>
          </section>
        )}

        {error && data && (
          <section className="listing__notice" role="status">
            <p>{error.message}</p>
            <button className="listing__button" type="button" onClick={retry}>Tentar de novo</button>
          </section>
        )}

        {data && data.items.length === 0 && !loading && !error && data.hasMore === false && (
          <p className="listing-state" role="status">Nenhuma história em {category} agora.</p>
        )}

        {data && data.items.length === 0 && !loading && !error && data.hasMore !== false && (
          <p className="listing-state" role="status">Esta página não trouxe histórias. Você pode carregar mais.</p>
        )}

        {data && data.items.length > 0 && (
          <ol className="story-list" aria-label={`Histórias em ${categoryLabel(category)}`}>
            {data.items.map((item) => <li key={item.id}><StoryRow item={item} onOpen={openItem} /></li>)}
          </ol>
        )}

        {loading && data && <p className="listing__loading-more" role="status">Atualizando histórias…</p>}

        {loadingMore && <LoadingMoreStories />}

        {loadMoreError && (
          <section className="listing__notice listing__notice--incremental" role="alert">
            <p>{loadMoreError.message}</p>
            <button className="listing__button" type="button" onClick={handleLoadMore}>Tentar de novo</button>
          </section>
        )}

        {data && data.hasMore !== false && !loading && !loadMoreError && (
          <button
            ref={loadMoreButtonRef}
            aria-busy={loadingMore}
            className="listing__button listing__load-more"
            disabled={loadingMore}
            type="button"
            onClick={handleLoadMore}
          >
            {loadingMore ? 'Carregando mais…' : 'Carregar mais'}
          </button>
        )}
      </section>
    </main>
  );
}

function LoadingStories() {
  return (
    <section className="story-list" aria-label="Carregando histórias">
      <p className="visually-hidden">Carregando histórias</p>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="story-skeleton" key={index} aria-hidden="true">
          <span />
          <span />
        </div>
      ))}
    </section>
  );
}

function LoadingMoreStories() {
  return (
    <section className="listing__loading-more" aria-label="Carregando mais histórias" role="status">
      <p>Carregando mais histórias…</p>
      <div className="story-skeleton" aria-hidden="true"><span /><span /></div>
      <div className="story-skeleton" aria-hidden="true"><span /><span /></div>
    </section>
  );
}
