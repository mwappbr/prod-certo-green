import { describe, expect, it } from 'vitest';
import { HnApiClient } from '../src/adapters/hn/client.js';
import { HnRequestError } from '../src/ports/hn.js';
import { startHnStub } from './helpers/hn-stub.js';

const clientOptions = (baseUrl: string, overrides: Partial<ConstructorParameters<typeof HnApiClient>[0]> = {}) => ({
  baseUrl,
  timeoutMs: 1_000,
  retries: 0,
  concurrency: 4,
  ...overrides,
});

describe('HnApiClient', () => {
  it('maps each public category endpoint to its own fixture list', async () => {
    const stub = await startHnStub();
    try {
      const client = new HnApiClient(clientOptions(stub.baseUrl));
      const categoryLists = [
        ['top', [101, 102, 103]],
        ['new', [104, 102]],
        ['best', [105, 101]],
        ['ask', [102, 104]],
        ['show', [101, 105]],
        ['job', [106]],
      ] as const;
      for (const [category, expectedIds] of categoryLists) {
        expect(await client.fetchList(category)).toEqual(expectedIds);
      }
      expect(stub.calls('/v0/topstories.json')).toBe(1);
      expect(stub.calls('/v0/newstories.json')).toBe(1);
      expect(stub.calls('/v0/beststories.json')).toBe(1);
      expect(stub.calls('/v0/askstories.json')).toBe(1);
      expect(stub.calls('/v0/showstories.json')).toBe(1);
      expect(stub.calls('/v0/jobstories.json')).toBe(1);
    } finally {
      await stub.close();
    }
  });

  it('skips malformed IDs individually while retaining valid list entries', async () => {
    const client = new HnApiClient(clientOptions('https://hn.invalid/v0/', {
      fetch: async () => new Response('[101,"bad",-1,102,1.5]', {
        headers: { 'content-type': 'application/json' },
      }),
    }));

    expect(await client.fetchList('top')).toEqual([101, 102]);
  });

  it.each([
    { type: 'story', title: undefined },
    { type: 'story', title: '&nbsp;' },
    { type: 'job', title: '' },
  ])('skips $type records with no visible title', async ({ type, title }) => {
    const client = new HnApiClient(clientOptions('https://hn.invalid/v0/', {
      fetch: async () => new Response(JSON.stringify({ id: 101, type, title })),
    }));

    expect(await client.fetchItem(101)).toBeNull();
  });

  it('normalizes fixture payloads and ignores malformed IDs', async () => {
    const stub = await startHnStub();
    try {
      const client = new HnApiClient(clientOptions(stub.baseUrl));
      expect(await client.fetchItem(101)).toMatchObject({
        id: 101,
        type: 'story',
        title: 'Roteiro & dados',
        domain: 'example.com',
      });
      expect(await client.fetchItem(102)).toMatchObject({
        id: 102,
        type: 'story',
        author: null,
        score: 0,
        url: null,
      });
      expect(await client.fetchItem(104)).toMatchObject({
        id: 104,
        type: 'story',
        url: 'http://www.example.net/historia',
        domain: 'example.net',
      });
      expect(await client.fetchItem(105)).toMatchObject({
        id: 105,
        type: 'story',
        url: null,
        domain: null,
      });
      expect(await client.fetchItem(106)).toMatchObject({
        id: 106,
        type: 'job',
        title: 'Vaga com HTTPS',
        url: 'https://jobs.example.net/vaga',
        score: null,
      });
      expect(await client.fetchItem(103)).toBeNull();
      expect(await client.fetchItem(999)).toBeNull();
    } finally {
      await stub.close();
    }
  });

  it('deduplicates concurrent in-flight item fetches', async () => {
    const stub = await startHnStub({ delayMs: 15 });
    try {
      const client = new HnApiClient(clientOptions(stub.baseUrl));
      const results = await Promise.all(Array.from({ length: 8 }, () => client.fetchItem(101)));
      expect(results.every((item) => item?.id === 101)).toBe(true);
      expect(stub.calls('/v0/item/101.json')).toBe(1);
    } finally {
      await stub.close();
    }
  });

  it('keeps distinct upstream requests within the concurrency limit', async () => {
    const stub = await startHnStub({ delayMs: 20 });
    try {
      const client = new HnApiClient(clientOptions(stub.baseUrl, { concurrency: 2 }));
      await Promise.all([101, 102, 103, 104, 105, 106].map((id) => client.fetchItem(id)));
      expect(stub.maxConcurrent).toBeLessThanOrEqual(2);
    } finally {
      await stub.close();
    }
  });

  it('classifies an aborted request as a timeout', async () => {
    const client = new HnApiClient(clientOptions('http://127.0.0.1:1/v0/', {
      timeoutMs: 10,
      fetch: (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    }));
    await expect(client.fetchList('top')).rejects.toMatchObject({
      name: 'HnRequestError',
      failure: 'timeout',
    } satisfies Partial<HnRequestError>);
  });

  it.each([
    { status: 408, failure: 'timeout' },
    { status: 429, failure: 'unavailable' },
  ] as const)('retries transient HTTP $status and classifies it as $failure', async ({ status, failure }) => {
    let attempts = 0;
    const client = new HnApiClient(clientOptions('https://hn.invalid/v0/', {
      retries: 1,
      wait: async () => undefined,
      fetch: async () => {
        attempts += 1;
        return new Response('', { status });
      },
    }));

    await expect(client.fetchList('top')).rejects.toMatchObject({ failure });
    expect(attempts).toBe(2);
  });

  it('retries transient upstream failures only within the configured bound', async () => {
    let attempts = 0;
    const client = new HnApiClient(clientOptions('https://hn.invalid/v0/', {
      retries: 3,
      wait: async () => undefined,
      fetch: async () => {
        attempts += 1;
        if (attempts < 4) return new Response('', { status: 503 });
        return new Response('[1,2]', { status: 200, headers: { 'content-type': 'application/json' } });
      },
    }));

    expect(await client.fetchList('top')).toEqual([1, 2]);
    expect(attempts).toBe(4);
  });
});
