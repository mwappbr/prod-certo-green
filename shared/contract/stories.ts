// Shared listing and item contracts; the HN wire format never crosses the adapter boundary.

declare const plainTextBrand: unique symbol;
declare const safeHtmlBrand: unique symbol;

export type PlainText = string & { readonly [plainTextBrand]: true };
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

export type StoryCategory = 'top' | 'new' | 'best' | 'ask' | 'show' | 'job';

export interface Story {
  id: number;
  type: 'story';
  title: PlainText;
  url: string | null;
  domain: PlainText | null;
  author: PlainText | null;
  score: number | null;
  commentCount: number;
  createdAt: string | null;
  cachedAt: string;
}

export interface Comment {
  id: number;
  type: 'comment';
  parent: number | null;
  author: PlainText | null;
  text: SafeHtml | null;
  createdAt: string | null;
  kids: number[];
  status: 'ok' | 'deleted' | 'dead';
  cachedAt: string;
}

export interface Job {
  id: number;
  type: 'job';
  title: PlainText;
  url: string | null;
  domain: PlainText | null;
  author: PlainText | null;
  score: number | null;
  commentCount: number;
  createdAt: string | null;
  cachedAt: string;
}

export type HnItem = Story | Comment | Job;

export type ListingItem = Story | Job;

export interface CommentNode {
  id: number;
  author: PlainText | null;
  text: SafeHtml | null;
  createdAt: string | null;
  status: 'ok' | 'deleted' | 'dead';
  children: CommentNode[] | null;
}

export interface StoriesPage {
  items: ListingItem[];
  page: number;
  limit: number;
  snapshot: string;
  cachedAt: string;
  stale: boolean;
  hasMore?: boolean;
}

export interface ItemResponse {
  item: HnItem;
  cachedAt: string;
  stale: boolean;
}

export interface CommentsResponse {
  nodes: CommentNode[];
  truncated: boolean;
  cachedAt: string;
  stale: boolean;
}
