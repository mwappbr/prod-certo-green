import { useCallback, useLayoutEffect, useRef } from 'react';
import type { StoriesSequenceScope } from '../../api/use-stories';

type InfiniteScrollOptions = {
  enabled: boolean;
  loading: boolean;
  commitKey: string;
  scope: StoriesSequenceScope;
  onDemand: (scope: StoriesSequenceScope) => void;
};

// Silêncio após o último movimento de rolagem que encerra um episódio de demanda.
const SCROLL_SETTLE_MS = 250;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(
    'button, input, select, textarea, [contenteditable="true"], [role="tab"]',
  ));
}

export function useInfiniteScroll<T extends HTMLElement>(options: InfiniteScrollOptions) {
  const elementRef = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sentinelRef = useCallback((element: T | null) => {
    elementRef.current = element;
  }, []);

  const { enabled, loading, commitKey, scope } = options;
  const generation = scope.generation;
  const navigationCycle = scope.navigationCycle;

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!enabled || loading || !element || typeof IntersectionObserver === 'undefined') return;

    const baselineScrollY = window.scrollY;
    let intersecting = false;
    let pendingUserScroll = false;
    let validDemand = false;
    let demandUsed = false;
    let touchY: number | null = null;
    let pendingUserScrollTimer: number | null = null;
    let pendingUserExpiresAt = 0;
    let lastScrollY = baselineScrollY;
    let settleTimer: number | null = null;
    let alive = true;

    const markPendingUserScroll = () => {
      pendingUserScroll = true;
      pendingUserExpiresAt = performance.now() + 200;
      if (pendingUserScrollTimer !== null) window.clearTimeout(pendingUserScrollTimer);
      pendingUserScrollTimer = window.setTimeout(() => {
        pendingUserScroll = false;
        pendingUserExpiresAt = 0;
        pendingUserScrollTimer = null;
      }, 200);
    };

    const clearPendingUserScroll = () => {
      pendingUserScroll = false;
      pendingUserExpiresAt = 0;
      if (pendingUserScrollTimer !== null) window.clearTimeout(pendingUserScrollTimer);
      pendingUserScrollTimer = null;
    };

    const offerDemand = () => {
      const current = optionsRef.current;
      if (
        !alive ||
        !current.enabled ||
        demandUsed ||
        !validDemand ||
        !intersecting ||
        window.scrollY <= baselineScrollY ||
        current.scope.generation !== generation ||
        current.scope.navigationCycle !== navigationCycle
      ) return;
      demandUsed = true;
      current.onDemand(current.scope);
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === element);
      if (!entry) return;
      intersecting = entry.isIntersecting;
      // Leaving the sentinel ends the episode; re-entry needs a new input-caused scroll.
      if (!intersecting) validDemand = false;
      offerDemand();
    });
    observer.observe(element);

    const onScroll = () => {
      // One input can scroll smoothly over many events: keep the episode while downward movement continues,
      // and let it settle, so a later scroll without input (scrollbar, Cmd+F) cannot reuse it.
      const fresh = pendingUserScroll && performance.now() <= pendingUserExpiresAt;
      const movedDown = window.scrollY > lastScrollY;
      lastScrollY = window.scrollY;
      clearPendingUserScroll();
      validDemand = (fresh || validDemand) && movedDown && window.scrollY > baselineScrollY;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = null;
      if (!validDemand) return;
      settleTimer = window.setTimeout(() => {
        validDemand = false;
        settleTimer = null;
      }, SCROLL_SETTLE_MS);
      offerDemand();
    };
    const onWheel = (event: WheelEvent) => {
      if (!optionsRef.current.enabled || optionsRef.current.loading || event.deltaY <= 0) return;
      markPendingUserScroll();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY;
      if (nextY === undefined || touchY === null) return;
      if (touchY - nextY > 0 && optionsRef.current.enabled && !optionsRef.current.loading) {
        markPendingUserScroll();
      }
      touchY = nextY;
    };
    const onTouchEnd = () => { touchY = null; };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !optionsRef.current.enabled ||
        optionsRef.current.loading ||
        isInteractiveTarget(event.target) ||
        (event.key !== 'ArrowDown' && event.key !== 'PageDown' && event.key !== 'End' && event.key !== ' ')
      ) return;
      markPendingUserScroll();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      alive = false;
      clearPendingUserScroll();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [commitKey, enabled, generation, loading, navigationCycle]);

  return sentinelRef;
}
