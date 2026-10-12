import type { StoryCategory } from '@hn/shared/contract/stories';

export const itemCacheKey = (id: number): string => `item:${id}`;
export const listCacheKey = (category: StoryCategory): string => `list:${category}`;
