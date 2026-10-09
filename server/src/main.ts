import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { PORT } from './config/index.js';
import { MemoryCache } from './adapters/cache/memory-cache.js';
import { getHealth } from './app/getHealth.js';
import { registerHealthRoute } from './http/routes/health.js';
import { registerErrorHandlers } from './http/errors.js';

// Executado a partir de server/dist/, então o build da SPA fica em ../../client/dist.
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = Fastify({ logger: true });

const cache = new MemoryCache();

await app.register(fastifyStatic, { root: clientDist, wildcard: false });
await registerHealthRoute(app, () => getHealth(cache));
registerErrorHandlers(app, clientDist);

await app.listen({ port: PORT, host: '0.0.0.0' });
