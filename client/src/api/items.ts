import type { CommentsResponse, ItemResponse } from '@hn/shared/contract/stories';
import { getApiJson } from './http';

export type ItemRequestOptions = {
  signal?: AbortSignal;
};

export type CommentsRequestOptions = ItemRequestOptions & {
  depth?: number;
};

export function itemRequestUrl(id: number): string {
  return `/api/items/${encodeURIComponent(String(id))}`;
}

export function commentsRequestUrl(id: number, depth?: number): string {
  const path = `/api/items/${encodeURIComponent(String(id))}/comments`;
  if (depth === undefined) return path;

  const params = new URLSearchParams({ depth: String(depth) });
  return `${path}?${params.toString()}`;
}

export function getItem(id: number, options: ItemRequestOptions = {}): Promise<ItemResponse> {
  return getApiJson<ItemResponse>(itemRequestUrl(id), options.signal);
}

export function getComments(id: number, options: CommentsRequestOptions = {}): Promise<CommentsResponse> {
  return getApiJson<CommentsResponse>(commentsRequestUrl(id, options.depth), options.signal);
}
