import type { CommentsResponse, ItemResponse } from '@hn/shared/contract/stories';

export interface DetailRequestState<T> {
  loading: boolean;
  data: T | null;
  error: Error | null;
}

export interface ItemDetailState {
  id: number;
  generation: number;
  item: DetailRequestState<ItemResponse>;
  comments: DetailRequestState<CommentsResponse>;
}

export type ItemDetailAction =
  | { type: 'begin'; id: number; generation: number }
  | { type: 'item-loading'; id: number; generation: number }
  | { type: 'item-success'; id: number; generation: number; data: ItemResponse }
  | { type: 'item-error'; id: number; generation: number; error: Error }
  | { type: 'comments-loading'; id: number; generation: number }
  | { type: 'comments-success'; id: number; generation: number; data: CommentsResponse }
  | { type: 'comments-error'; id: number; generation: number; error: Error };

function emptyRequest<T>(loading: boolean): DetailRequestState<T> {
  return { loading, data: null, error: null };
}

export function initialItemDetailState(id: number, generation = 0): ItemDetailState {
  return {
    id,
    generation,
    item: emptyRequest(true),
    comments: emptyRequest(true),
  };
}

export function itemDetailReducer(state: ItemDetailState, action: ItemDetailAction): ItemDetailState {
  if (action.type === 'begin') {
    if (action.generation < state.generation) return state;
    return initialItemDetailState(action.id, action.generation);
  }

  if (action.id !== state.id || action.generation !== state.generation) return state;

  switch (action.type) {
    case 'item-loading':
      return { ...state, item: { ...state.item, loading: true, error: null } };
    case 'item-success':
      return { ...state, item: { loading: false, data: action.data, error: null } };
    case 'item-error':
      return { ...state, item: { ...state.item, loading: false, error: action.error } };
    case 'comments-loading':
      return { ...state, comments: { ...state.comments, loading: true, error: null } };
    case 'comments-success':
      return { ...state, comments: { loading: false, data: action.data, error: null } };
    case 'comments-error':
      return { ...state, comments: { ...state.comments, loading: false, error: action.error } };
  }
}

export interface ItemDetailFreshness {
  cachedAt: string | null;
  stale: boolean;
  staleAt: string | null;
}

function isValidTimestamp(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function oldestTimestamp(values: Array<string | null | undefined>): string | null {
  const valid = values.filter(isValidTimestamp);
  if (valid.length === 0) return null;
  return valid.reduce((oldest, value) => Date.parse(value) < Date.parse(oldest) ? value : oldest);
}

export function combineItemFreshness(
  item: Pick<ItemResponse, 'cachedAt' | 'stale'> | null,
  comments: Pick<CommentsResponse, 'cachedAt' | 'stale'> | null,
): ItemDetailFreshness {
  const envelopes = [item, comments].filter((value): value is NonNullable<typeof value> => value !== null);
  const staleEnvelopes = envelopes.filter((value) => value.stale);
  return {
    cachedAt: oldestTimestamp(envelopes.map((value) => value.cachedAt)),
    stale: staleEnvelopes.length > 0,
    staleAt: oldestTimestamp(staleEnvelopes.map((value) => value.cachedAt)),
  };
}

export function formatClock(value: string | null): string | null {
  if (!isValidTimestamp(value)) return null;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
