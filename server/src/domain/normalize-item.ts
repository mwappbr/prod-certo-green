import { decodeHTML } from 'entities';
import sanitizeHtml from 'sanitize-html';
import type { Comment, Job, PlainText, SafeHtml, Story } from '@hn/shared/contract/stories';

/** Canonical adapter-to-domain values; field names do not mirror the HN wire format. */
export interface HnItemInput {
  id: number;
  kind: 'story' | 'comment' | 'job' | 'poll';
  title?: string | null;
  href?: string | null;
  author?: string | null;
  score?: number | null;
  commentCount?: number | null;
  createdAtSeconds?: number | null;
  childIds?: number[] | null;
  parentId?: number | null;
  bodyHtml?: string | null;
  deleted?: boolean;
  dead?: boolean;
}

type WithoutCachedAt<T> = T extends { cachedAt: string } ? Omit<T, 'cachedAt'> : never;
type NormalizedStory = WithoutCachedAt<Story> & { childIds: number[] };
type NormalizedComment = WithoutCachedAt<Comment>;
type NormalizedJob = WithoutCachedAt<Job> & { childIds: number[] };
export type NormalizedHnItem = NormalizedStory | NormalizedComment | NormalizedJob;

const commentTags = [
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'ul',
];

const sanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: commentTags,
  allowedAttributes: { a: ['href', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

function plainText(value: string): PlainText {
  return decodeHTML(value) as PlainText;
}

function safeUrl(value: string | null | undefined): { url: string; domain: PlainText } | null {
  if (!value?.trim()) return null;
  const candidate = value.trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    return { url: candidate, domain: host as PlainText };
  } catch {
    return null;
  }
}

function createdAt(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function count(value: number | null | undefined, fallback = 0): number {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fallback;
}

function normalizedChildIds(value: number[] | null | undefined): number[] {
  return value?.filter((id) => Number.isSafeInteger(id) && id >= 0) ?? [];
}

function sanitizedHtml(value: string | null | undefined): SafeHtml | null {
  if (value === null || value === undefined) return null;
  return sanitizeHtml(value, sanitizerOptions) as SafeHtml;
}

export function normalizeHnItem(input: HnItemInput): NormalizedHnItem {
  const link = safeUrl(input.href);
  const author = input.author ? plainText(input.author) : null;
  const timestamp = createdAt(input.createdAtSeconds);

  if (input.kind === 'comment') {
    const status = input.deleted ? 'deleted' : input.dead ? 'dead' : 'ok';
    return {
      id: input.id,
      type: 'comment',
      parent: input.parentId ?? null,
      author,
      text: status === 'ok' ? sanitizedHtml(input.bodyHtml) : null,
      createdAt: timestamp,
      kids: input.childIds ?? [],
      status,
    } satisfies Omit<Comment, 'cachedAt'>;
  }

  if (input.kind === 'job') {
    return {
      id: input.id,
      type: 'job',
      title: plainText(input.title ?? ''),
      url: link?.url ?? null,
      domain: link?.domain ?? null,
      author,
      score: input.score ?? null,
      commentCount: count(input.commentCount, input.childIds?.length ?? 0),
      createdAt: timestamp,
      childIds: normalizedChildIds(input.childIds),
    } satisfies NormalizedJob;
  }

  return {
    id: input.id,
    type: 'story',
    title: plainText(input.title ?? ''),
    url: link?.url ?? null,
    domain: link?.domain ?? null,
    author,
    score: input.score ?? null,
    commentCount: count(input.commentCount, input.childIds?.length ?? 0),
    createdAt: timestamp,
    childIds: normalizedChildIds(input.childIds),
  } satisfies NormalizedStory;
}
