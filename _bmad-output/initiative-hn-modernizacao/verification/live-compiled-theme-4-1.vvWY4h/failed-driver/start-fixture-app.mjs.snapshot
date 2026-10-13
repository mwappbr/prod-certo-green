import { createServer as createHttpServer } from 'node:http';
import { mkdir, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [rootArg, evidenceArg, ...extraArgs] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extraArgs.length > 0) {
  console.error('Usage: node start-fixture-app.mjs <rootPath> <evidenceDir>');
  process.exitCode = 64;
} else {
  const rootPath = path.resolve(rootArg);
  const evidenceDir = path.resolve(evidenceArg);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const readyPath = path.join(evidenceDir, 'fixture-ready.json');
  const failurePath = path.join(evidenceDir, 'fixture-failure.json');
  const stoppedPath = path.join(evidenceDir, 'fixture-stopped.json');
  const categories = ['top', 'new', 'best', 'ask', 'show', 'job'];
  const listCounts = new Map(categories.map((category) => [category, 0]));
  const itemCounts = new Map();
  const unexpectedUpstreamPaths = [];
  let app;
  let upstream;
  let signalName = null;
  let signalHandled = false;
  let resolveStop;
  const stopRequested = new Promise((resolve) => { resolveStop = resolve; });

  function isSameOrInside(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  }

  const evidenceIsSafe = !isSameOrInside(evidenceDir, scriptDir) && !isSameOrInside(evidenceDir, rootPath);

  function jsonResponse(response, status, body) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  }

  function listen(server) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve(server.address());
      });
    });
  }

  async function writeJson(filePath, value) {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  }

  async function closeOwnedServers() {
    const closers = [];
    if (app) closers.push(app.close());
    if (upstream?.listening) {
      closers.push(new Promise((resolve) => {
        upstream.close(() => resolve());
        upstream.closeIdleConnections?.();
      }));
    }
    if (closers.length === 0) return true;

    let timer;
    const settled = Promise.allSettled(closers).then(() => true);
    const didSettle = await Promise.race([
      settled,
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), 4_000); }),
    ]);
    if (timer) clearTimeout(timer);
    if (didSettle) return true;

    app?.server.closeAllConnections?.();
    upstream?.closeAllConnections?.();
    let drainTimer;
    const drained = await Promise.race([
      settled,
      new Promise((resolve) => { drainTimer = setTimeout(() => resolve(false), 750); }),
    ]);
    if (drainTimer) clearTimeout(drainTimer);
    return drained;
  }

  function requestStop(signal) {
    if (signalHandled) return;
    signalHandled = true;
    signalName = signal;
    resolveStop(signal);
  }

  const onSigint = () => requestStop('SIGINT');
  const onSigterm = () => requestStop('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  async function run() {
    let failure = null;
    let readyWritten = false;
    try {
      if (!evidenceIsSafe) {
        throw new Error('evidenceDir must be separate from the helper script directory and outside the source root.');
      }
      await mkdir(evidenceDir, { recursive: true });
      const requiredFiles = [
        path.join(rootPath, 'server/dist/main.js'),
        path.join(rootPath, 'server/dist/adapters/hn/client.js'),
        path.join(rootPath, 'server/dist/config/index.js'),
        path.join(rootPath, 'client/dist/index.html'),
        path.join(rootPath, 'e2e/fixtures/comments-tree-200.mjs'),
      ];
      await Promise.all(requiredFiles.map((filePath) => access(filePath)));

      const fixtureUrl = pathToFileURL(path.join(rootPath, 'e2e/fixtures/comments-tree-200.mjs')).href;
      const mainUrl = pathToFileURL(path.join(rootPath, 'server/dist/main.js')).href;
      const clientUrl = pathToFileURL(path.join(rootPath, 'server/dist/adapters/hn/client.js')).href;
      const configUrl = pathToFileURL(path.join(rootPath, 'server/dist/config/index.js')).href;
      const [{ createCommentsTreeFixture }, { createServer }, { HnApiClient }, { config }] = await Promise.all([
        import(fixtureUrl), import(mainUrl), import(clientUrl), import(configUrl),
      ]);
      const fixture = createCommentsTreeFixture();
      const {
        storyId, items, chainIds, mainIds, allCommentIds, visibleCommentIds, depthNineId,
      } = fixture;
      const deadId = mainIds[0];
      const deletedId = mainIds[1];
      if (deadId === undefined || deletedId === undefined) throw new Error('Fixture marker IDs are missing.');

      // Clone the frozen fixture in memory; never mutate the imported fixture module.
      const rawItems = new Map(Object.entries(items).map(([id, item]) => [Number(id), {
        ...item,
        ...(Array.isArray(item.kids) ? { kids: [...item.kids] } : {}),
      }]));
      const rawStory = rawItems.get(storyId);
      if (!rawStory || rawStory.type !== 'story') throw new Error('Fixture root story is missing.');
      rawItems.set(storyId, { ...rawStory, title: 'Local verification fixture — 3.3 comment tree' });

      for (const [id, marker] of [[deadId, 'dead'], [deletedId, 'deleted']]) {
        const rawComment = rawItems.get(id);
        if (!rawComment || rawComment.type !== 'comment' || !Array.isArray(rawComment.kids) || rawComment.kids.length === 0) {
          throw new Error(`Fixture marker comment ${id} must retain reply IDs.`);
        }
        rawItems.set(id, {
          ...rawComment,
          ...(marker === 'dead' ? { dead: true } : { deleted: true }),
        });
      }

      const jobId = Math.max(storyId, ...allCommentIds) + 1_000;
      const rawJob = {
        id: jobId,
        type: 'job',
        title: 'Local verification fixture — synthetic job',
        url: 'https://example.invalid/verification-only',
        by: 'fixture-job-author',
        time: rawStory.time,
        kids: [],
      };
      rawItems.set(jobId, rawJob);
      const rootChildIds = [...(rawItems.get(storyId)?.kids ?? [])];
      const expectedChildrenById = Object.fromEntries(
        [...rawItems.entries()]
          .filter(([, item]) => item.type === 'comment')
          .map(([id, item]) => [String(id), [...(item.kids ?? [])]]),
      );

      const listIdsByCategory = {
        top: [storyId],
        new: [storyId],
        best: [storyId],
        ask: [storyId],
        show: [storyId],
        job: [jobId],
      };
      upstream = createHttpServer((request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        if (request.method !== 'GET') {
          jsonResponse(response, 405, { error: 'GET only' });
          return;
        }
        const listMatch = pathname.match(/^\/v0\/(top|new|best|ask|show|job)stories\.json$/);
        if (listMatch?.[1]) {
          const category = listMatch[1];
          listCounts.set(category, (listCounts.get(category) ?? 0) + 1);
          jsonResponse(response, 200, listIdsByCategory[category]);
          return;
        }
        const itemMatch = pathname.match(/^\/v0\/item\/(\d+)\.json$/);
        if (itemMatch?.[1]) {
          const id = Number(itemMatch[1]);
          itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
          jsonResponse(response, 200, rawItems.get(id) ?? null);
          return;
        }
        unexpectedUpstreamPaths.push(pathname);
        jsonResponse(response, 404, { error: 'unrecognized local HN fixture path' });
      });
      const upstreamAddress = await listen(upstream);
      if (!upstreamAddress || typeof upstreamAddress === 'string') throw new Error('Local upstream did not bind an ephemeral port.');
      const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v0/`;
      const hnClient = new HnApiClient({
        baseUrl: upstreamBaseUrl,
        timeoutMs: 500,
        retries: 0,
        concurrency: 4,
      });
      app = await createServer({
        logger: false,
        staticRoot: path.join(rootPath, 'client/dist'),
        hnClient,
      });
      app.get('/__test/hn-counters', async (request, reply) => {
        const queryUrl = new URL(request.raw.url ?? '/', 'http://127.0.0.1');
        const idsParam = queryUrl.searchParams.get('ids') ?? '';
        const ids = idsParam.split(',').filter((value) => /^\d+$/.test(value)).map(Number);
        return reply.header('cache-control', 'no-store').send({
          itemRequests: Object.fromEntries(ids.map((id) => [String(id), itemCounts.get(id) ?? 0])),
          listRequests: Object.fromEntries(categories.map((category) => [category, listCounts.get(category) ?? 0])),
          unexpectedUpstreamPaths: [...unexpectedUpstreamPaths],
        });
      });
      await app.listen({ host: '127.0.0.1', port: 0 });
      const appAddress = app.server.address();
      if (!appAddress || typeof appAddress === 'string') throw new Error('Fixture app did not bind an ephemeral port.');
      const baseUrl = `http://127.0.0.1:${appAddress.port}`;
      const markerRaw = (id) => rawItems.get(id);
      const ready = {
        protocolVersion: 1,
        status: 'ready',
        readyAt: new Date().toISOString(),
        helperPid: process.pid,
        fixtureAppPid: process.pid,
        rawUpstreamPid: process.pid,
        baseUrl,
        countersUrl: `${baseUrl}/__test/hn-counters`,
        upstreamBaseUrl,
        storyId,
        jobId,
        setupIds: {
          storyId,
          jobId,
          rootChildIds,
          depthNineId,
        },
        markerIds: { deadId, deletedId },
        expectedIds: {
          visibleCommentIds: [...visibleCommentIds],
          allCommentIds: [...allCommentIds],
          visibleCommentCount: visibleCommentIds.length,
          allCommentCount: allCommentIds.length,
          depthNineId,
        },
        expectedChildrenById,
        rawMeta: {
          storyTitle: rawItems.get(storyId).title,
          storyScore: rawItems.get(storyId).score,
          storyDescendants: rawItems.get(storyId).descendants,
          storyChildIds: rootChildIds,
          markerItems: {
            dead: {
              id: deadId,
              author: markerRaw(deadId).by,
              rawText: markerRaw(deadId).text,
              kids: [...markerRaw(deadId).kids],
            },
            deleted: {
              id: deletedId,
              author: markerRaw(deletedId).by,
              rawText: markerRaw(deletedId).text,
              kids: [...markerRaw(deletedId).kids],
            },
          },
          job: {
            id: jobId,
            title: rawJob.title,
            url: rawJob.url,
            scoreFieldPresent: Object.hasOwn(rawJob, 'score'),
            externalLinkMustNotBeOpened: true,
          },
          chainIds,
          mainIds,
          cacheTtlsMs: {
            item: config.itemCacheTtlMs,
            list: config.listCacheTtlMs,
          },
        },
      };
      await writeJson(readyPath, ready);
      readyWritten = true;
      console.log(JSON.stringify({ status: 'ready', pid: process.pid, baseUrl, storyId, jobId, readyPath }));
      await stopRequested;
    } catch (error) {
      failure = error;
      const failureRecord = {
        status: 'failed',
        failedAt: new Date().toISOString(),
        helperPid: process.pid,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      if (evidenceIsSafe) {
        try {
          await mkdir(evidenceDir, { recursive: true });
          await writeJson(failurePath, failureRecord);
        } catch (writeError) {
          console.error(`Could not write fixture failure record: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
        }
      }
      console.error(failureRecord.message);
    } finally {
      const closed = await closeOwnedServers().catch(() => false);
      if (!closed) {
        failure ??= new Error('Timed out while closing this helper’s own fixture servers.');
        process.exitCode = 1;
      }
      if (readyWritten) {
        try {
          await writeJson(stoppedPath, {
            status: 'stopped',
            stoppedAt: new Date().toISOString(),
            helperPid: process.pid,
            signal: signalName,
            closeCompleted: closed,
          });
        } catch (error) {
          failure ??= error;
          process.exitCode = 1;
        }
      }
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
    }
    if (failure) process.exitCode = 1;
  }

  await run();
}
