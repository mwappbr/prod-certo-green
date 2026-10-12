import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { config, PORT } from './config/index.js';
import { HnApiClient } from './adapters/hn/client.js';
import { MemoryCache } from './adapters/cache/memory-cache.js';
import { getHealth } from './app/getHealth.js';
import { registerHealthRoute } from './http/routes/health.js';
import { registerStoriesRoute } from './http/routes/stories.js';
import { registerItemsRoute } from './http/routes/items.js';
import { registerErrorHandlers } from './http/errors.js';
import type { Cache } from './ports/cache.js';
import type { StoryCategory } from '@hn/shared/contract/stories';
import type { HnClient } from './ports/hn.js';
import type { NormalizedHnItem } from './domain/normalize-item.js';

// Executado a partir de server/dist/, então o build da SPA fica em ../../client/dist.
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

type CreateServerOptions = {
  staticRoot?: string;
  logger?: boolean;
  cache?: Cache;
  hnClient?: HnClient<StoryCategory, NormalizedHnItem>;
};

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const staticRoot = options.staticRoot ?? clientDist;
  const app = Fastify({ logger: options.logger ?? true });
  const cache = options.cache ?? new MemoryCache({ staleRetentionMs: config.staleRetentionMs });
  const hnClient = options.hnClient ?? new HnApiClient({
    timeoutMs: config.hnTimeoutMs,
    retries: config.hnRetries,
    concurrency: config.hnConcurrency,
  });

  await app.register(fastifyStatic, { root: staticRoot, wildcard: false });
  await registerHealthRoute(app, () => getHealth(cache));
  await registerStoriesRoute(app, {
    cache,
    hn: hnClient,
    defaultPageSize: config.defaultPageSize,
    maxPageSize: config.maxPageSize,
    listCacheTtlMs: config.listCacheTtlMs,
    itemCacheTtlMs: config.itemCacheTtlMs,
  });
  await registerItemsRoute(app, {
    cache,
    hn: hnClient,
    itemCacheTtlMs: config.itemCacheTtlMs,
    commentsDefaultDepth: config.commentsDefaultDepth,
    commentsMaxDepth: config.commentsMaxDepth,
    commentsMaxNodes: config.commentsMaxNodes,
    hnConcurrency: config.hnConcurrency,
  });
  registerErrorHandlers(app, staticRoot);

  return app;
}

async function startServer(): Promise<void> {
  const app = await createServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
}

const invokedScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (invokedScript === import.meta.url) {
  await startServer();
}
