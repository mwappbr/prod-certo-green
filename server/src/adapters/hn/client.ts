import { z } from 'zod';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { normalizeHnItem, type HnItemInput, type NormalizedHnItem } from '../../domain/normalize-item.js';
import { HnRequestError, type HnClient } from '../../ports/hn.js';

const listEndpoints: Record<StoryCategory, string> = {
  top: 'topstories.json',
  new: 'newstories.json',
  best: 'beststories.json',
  ask: 'askstories.json',
  show: 'showstories.json',
  job: 'jobstories.json',
};

// This is the only schema for the HN wire format; it intentionally stays inside adapters/hn.
const safeNonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const rawItemSchema = z.object({
  id: safeNonnegativeInteger,
  type: z.string().min(1),
  title: z.string().nullish(),
  url: z.string().nullish(),
  by: z.string().nullish(),
  score: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullish(),
  descendants: safeNonnegativeInteger.nullish(),
  time: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullish(),
  kids: z.array(safeNonnegativeInteger).nullish(),
  parent: safeNonnegativeInteger.nullish(),
  text: z.string().nullish(),
  deleted: z.boolean().nullish(),
  dead: z.boolean().nullish(),
});

export type HnFetch = (input: string, init?: RequestInit) => Promise<Response>;

type HnApiClientOptions = {
  baseUrl?: string;
  timeoutMs: number;
  retries: number;
  concurrency: number;
  fetch?: HnFetch;
  wait?: (milliseconds: number) => Promise<void>;
};

const defaultBaseUrl = 'https://hacker-news.firebaseio.com/v0/';
const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class HnApiClient implements HnClient<StoryCategory, NormalizedHnItem> {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly concurrency: number;
  private readonly fetcher: HnFetch;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private activeRequests = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(options: HnApiClientOptions) {
    this.baseUrl = (options.baseUrl ?? defaultBaseUrl).replace(/\/?$/, '/');
    if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 30_000) {
      throw new RangeError('HN timeout must be an integer between 1 and 30000 milliseconds.');
    }
    if (!Number.isSafeInteger(options.retries) || options.retries < 0 || options.retries > 3) {
      throw new RangeError('HN retries must be an integer between 0 and 3.');
    }
    if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) {
      throw new RangeError('HN concurrency must be an integer between 1 and 32.');
    }
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries;
    this.concurrency = options.concurrency;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.wait = options.wait ?? delay;
  }

  fetchList(category: StoryCategory): Promise<number[]> {
    return this.singleFlight(`list:${category}`, async () => {
      const payload = await this.requestJson(listEndpoints[category]);
      const list = z.array(z.unknown()).safeParse(payload);
      if (!list.success) throw new HnRequestError('unavailable', 'Invalid list response from Hacker News.');
      return list.data.flatMap((value) => {
        const id = safeNonnegativeInteger.safeParse(value);
        return id.success ? [id.data] : [];
      });
    });
  }

  fetchItem(id: number): Promise<NormalizedHnItem | null> {
    return this.singleFlight(`item:${id}`, async () => {
      const payload = await this.requestJson(`item/${id}.json`);
      if (payload === null) return null;
      const parsed = rawItemSchema.safeParse(payload);
      if (!parsed.success) return null;

      const raw = parsed.data;
      if (raw.id !== id || !['story', 'comment', 'job', 'poll'].includes(raw.type)) return null;
      const input: HnItemInput = {
        id: raw.id,
        kind: raw.type as HnItemInput['kind'],
        title: raw.title ?? null,
        href: raw.url ?? null,
        author: raw.by ?? null,
        score: raw.score ?? null,
        commentCount: raw.descendants ?? null,
        createdAtSeconds: raw.time ?? null,
        childIds: raw.kids ?? null,
        parentId: raw.parent ?? null,
        bodyHtml: raw.text ?? null,
        deleted: raw.deleted ?? false,
        dead: raw.dead ?? false,
      };
      const item = normalizeHnItem(input);
      if (item.type !== 'comment' && item.title.trim().length === 0) return null;
      return item;
    });
  }

  private singleFlight<T>(key: string, action: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const request = action().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async requestJson(path: string): Promise<unknown> {
    return this.withSlot(() => this.requestWithRetry(path));
  }

  private async requestWithRetry(path: string): Promise<unknown> {
    let lastError: HnRequestError | undefined;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(
          new URL(path, this.baseUrl).toString(),
          { signal: controller.signal },
        );
        if (!response.ok) {
          const timedOut = response.status === 408 || response.status === 504;
          const retryable = timedOut || response.status === 429 || response.status >= 500;
          throw new HnRequestError(
            timedOut ? 'timeout' : 'unavailable',
            `Hacker News returned HTTP ${response.status}.`,
            { retryable },
          );
        }
        return await response.json();
      } catch (error) {
        if (error instanceof HnRequestError) {
          lastError = error;
        } else if (controller.signal.aborted) {
          lastError = new HnRequestError('timeout', 'Hacker News request timed out.', { cause: error });
        } else {
          lastError = new HnRequestError('unavailable', 'Hacker News request failed.', { cause: error });
        }
        const retryable = lastError.failure === 'timeout' || lastError.retryable !== false;
        clearTimeout(timeout);
        if (attempt >= this.retries || !retryable) throw lastError;
        await this.wait(Math.min(100 * (2 ** attempt), 500));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new HnRequestError('unavailable', 'Hacker News request failed.');
  }

  private async withSlot<T>(action: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.activeRequests += 1;
    }
    try {
      return await action();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.activeRequests -= 1;
    }
  }
}
