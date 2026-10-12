import { createServer, type Server } from 'node:http';
import type { StoryCategory } from '@hn/shared/contract/stories';
import { hnFixtures } from './hn-fixtures.js';

const listCategories = new Map<string, StoryCategory>([
  ['/v0/topstories.json', 'top'],
  ['/v0/newstories.json', 'new'],
  ['/v0/beststories.json', 'best'],
  ['/v0/askstories.json', 'ask'],
  ['/v0/showstories.json', 'show'],
  ['/v0/jobstories.json', 'job'],
] as const);

type HnStubOptions = { delayMs?: number; topStoryIds?: number[] };

export async function startHnStub(options: HnStubOptions = {}) {
  const calls = new Map<string, number>();
  let totalRequests = 0;
  let failureStatus: number | null = null;
  let active = 0;
  let maxConcurrent = 0;
  const server: Server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    calls.set(pathname, (calls.get(pathname) ?? 0) + 1);
    totalRequests += 1;
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    response.setHeader('content-type', 'application/json; charset=utf-8');

    const send = () => {
      if (response.destroyed) return;
      if (failureStatus !== null) {
        response.statusCode = failureStatus;
        response.end(JSON.stringify({ error: 'fixture upstream failure' }));
        return;
      }
      const category = listCategories.get(pathname);
      if (category) {
        const ids = category === 'top' && options.topStoryIds
          ? options.topStoryIds
          : hnFixtures.categories[category];
        response.end(JSON.stringify(ids));
      } else {
        const match = pathname.match(/^\/v0\/item\/(\d+)\.json$/);
        const itemId = match?.[1];
        if (itemId !== undefined) {
          response.end(JSON.stringify(hnFixtures.items[itemId] ?? null));
        } else {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: 'fixture not found' }));
        }
      }
    };

    response.once('close', () => { active -= 1; });
    if (options.delayMs) setTimeout(send, options.delayMs);
    else send();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HN stub did not bind a TCP port.');

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v0/`,
    calls: (path: string) => calls.get(path) ?? 0,
    get totalRequests() { return totalRequests; },
    setFailure: (status: number | null) => { failureStatus = status; },
    get maxConcurrent() { return maxConcurrent; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
