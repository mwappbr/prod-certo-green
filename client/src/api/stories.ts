import type { StoriesPage, StoryCategory } from '@hn/shared/contract/stories';
import { getApiJson } from './http';

export type StoriesRequestOptions = {
  page?: number;
  limit?: number;
  snapshot?: string;
  signal?: AbortSignal;
};

export function storiesRequestUrl(category: StoryCategory, options: StoriesRequestOptions = {}): string {
  const params = new URLSearchParams({ category });
  if (options.page !== undefined) params.set('page', String(options.page));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.snapshot !== undefined) params.set('snapshot', options.snapshot);
  return `/api/stories?${params.toString()}`;
}

export function getStories(category: StoryCategory, options: StoriesRequestOptions = {}): Promise<StoriesPage> {
  return getApiJson<StoriesPage>(storiesRequestUrl(category, options), options.signal);
}
