import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/main.js';

describe('HTTP application integration', () => {
  let app: FastifyInstance | undefined;
  let staticRoot: string | undefined;

  beforeEach(async () => {
    staticRoot = await mkdtemp(path.join(tmpdir(), 'hn-modernizacao-test-'));
    await writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>SPA fixture</title>');

    const server = await createServer({ staticRoot, logger: false });
    server.get('/api/test-error', async () => {
      throw new Error('internal detail that must stay private');
    });
    app = server;
  });

  afterEach(async () => {
    try {
      if (app) await app.close();
    } finally {
      app = undefined;
      if (staticRoot) {
        await rm(staticRoot, { recursive: true, force: true });
        staticRoot = undefined;
      }
    }
  });

  it('serves the health contract through Fastify inject', async () => {
    const response = await appOrThrow().inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', cache: { entries: 0 } });
  });

  it.each(['/api/missing', '/api', '/api?unknown=1'])('returns the shared error envelope for unknown API route %s', async (url) => {
    const response = await appOrThrow().inject({ method: 'GET', url });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });

  it('maps internal failures without exposing implementation details', async () => {
    const response = await appOrThrow().inject({ method: 'GET', url: '/api/test-error' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL', message: 'Erro interno do servidor.' },
    });
    expect(response.body).not.toContain('internal detail that must stay private');
  });

  it('serves the SPA fixture for an unknown non-API GET route', async () => {
    const response = await appOrThrow().inject({ method: 'GET', url: '/stories/123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<title>SPA fixture</title>');
  });

  function appOrThrow(): FastifyInstance {
    if (!app) throw new Error('Fastify test app was not initialized');
    return app;
  }
});
