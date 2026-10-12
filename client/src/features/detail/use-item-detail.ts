import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getComments, getItem } from '../../api/items';
import {
  initialItemDetailState,
  itemDetailReducer,
  type ItemDetailAction,
  type ItemDetailState,
} from './item-detail-state';

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Não foi possível carregar os dados. Tente novamente.');
}

export interface ItemDetailController {
  state: ItemDetailState;
  retryItem: () => void;
  retryComments: () => void;
}

export function useItemDetail(id: number): ItemDetailController {
  const [state, dispatch] = useReducer(itemDetailReducer, initialItemDetailState(id));
  const generationRef = useRef(0);
  const itemControllerRef = useRef<AbortController | null>(null);
  const commentsControllerRef = useRef<AbortController | null>(null);

  const requestItem = useCallback((requestId: number, generation: number) => {
    itemControllerRef.current?.abort();
    const controller = new AbortController();
    itemControllerRef.current = controller;
    dispatch({ type: 'item-loading', id: requestId, generation });

    void getItem(requestId, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      dispatch({ type: 'item-success', id: requestId, generation, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      dispatch({ type: 'item-error', id: requestId, generation, error: asError(error) });
    });
  }, []);

  const requestComments = useCallback((requestId: number, generation: number) => {
    commentsControllerRef.current?.abort();
    const controller = new AbortController();
    commentsControllerRef.current = controller;
    dispatch({ type: 'comments-loading', id: requestId, generation });

    void getComments(requestId, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      dispatch({ type: 'comments-success', id: requestId, generation, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      dispatch({ type: 'comments-error', id: requestId, generation, error: asError(error) });
    });
  }, []);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    dispatch({ type: 'begin', id, generation });

    // Start both independently; neither response is required to choose the other's route.
    requestItem(id, generation);
    requestComments(id, generation);

    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
      itemControllerRef.current?.abort();
      commentsControllerRef.current?.abort();
    };
  }, [id, requestComments, requestItem]);

  const retryItem = useCallback(() => requestItem(id, generationRef.current), [id, requestItem]);
  const retryComments = useCallback(() => requestComments(id, generationRef.current), [id, requestComments]);
  const visibleState = state.id === id ? state : initialItemDetailState(id, state.generation);

  return { state: visibleState, retryItem, retryComments };
}
