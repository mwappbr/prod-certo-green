import { createServer } from '../server/dist/main.js';
import { HnApiClient } from '../server/dist/adapters/hn/client.js';
import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createCommentsTreeFixture } from './fixtures/comments-tree-200.mjs';

const fixtureUrl = new URL('./fixtures/hn-stories.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const commentTreeFixture = createCommentsTreeFixture();
const rawItems = { ...fixture.items, ...commentTreeFixture.items };
const hnItemRequestCounts = new Map();

const categoryLists = new Map([
  ['/v0/topstories.json', 'top'],
  ['/v0/newstories.json', 'new'],
  ['/v0/beststories.json', 'best'],
  ['/v0/askstories.json', 'ask'],
  ['/v0/showstories.json', 'show'],
  ['/v0/jobstories.json', 'job'],
]);

const hnStub = createHttpServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  const category = categoryLists.get(path);
  if (category) {
    response.end(JSON.stringify(fixture.categories[category]));
    return;
  }
  const itemMatch = path.match(/^\/v0\/item\/(\d+)\.json$/);
  if (itemMatch) {
    const id = Number(itemMatch[1]);
    hnItemRequestCounts.set(id, (hnItemRequestCounts.get(id) ?? 0) + 1);
    response.end(JSON.stringify(rawItems[itemMatch[1]] ?? null));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'fixture not found' }));
});

await new Promise((resolve, reject) => {
  hnStub.once('error', reject);
  hnStub.listen(0, '127.0.0.1', resolve);
});
const hnAddress = hnStub.address();
if (!hnAddress || typeof hnAddress === 'string') throw new Error('HN fixture server did not bind a TCP port.');

const app = await createServer({
  logger: false,
  hnClient: new HnApiClient({
    baseUrl: `http://127.0.0.1:${hnAddress.port}/v0/`,
    timeoutMs: 500,
    retries: 0,
    concurrency: 4,
  }),
});

app.get('/__test/hn-counters', async (request, reply) => {
  const requestedIds = request.query?.ids;
  if (typeof requestedIds !== 'string' || !/^\d+(,\d+)*$/.test(requestedIds)) {
    return reply.code(400).send({ error: 'ids query must be a comma-separated list of integers' });
  }
  reply.header('cache-control', 'no-store');
  const ids = requestedIds.split(',');
  return Object.fromEntries(ids.map((id) => [id, hnItemRequestCounts.get(Number(id)) ?? 0]));
});

try {
  await app.listen({ port: 4173, host: '127.0.0.1' });
} catch (error) {
  hnStub.close();
  throw error;
}

async function shutdown() {
  await app.close();
  await new Promise((resolve) => hnStub.close(resolve));
}

process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
