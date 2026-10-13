import { createServer as createHttpServer } from 'node:http';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [rootArg, evidenceArg, ...extra] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extra.length) {
  console.error('Usage: node start-keyboard-fixture-app.mjs <ROOT> <evidenceDir>');
  process.exitCode = 64;
} else {
  const root = path.resolve(rootArg);
  const evidence = path.resolve(evidenceArg);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDir = path.dirname(scriptDir);
  const inside = (candidate, parent) => {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  const safeEvidence = [path.resolve('/tmp'), path.resolve('/private/tmp')].some((tempRoot) => inside(evidence, tempRoot)) &&
    !inside(evidence, root) && !inside(evidence, workspaceDir);
  const readyPath = path.join(evidence, 'fixture-ready.json');
  const failurePath = path.join(evidence, 'fixture-failure.json');
  const stoppedPath = path.join(evidence, 'fixture-stopped.json');
  const categories = ['top', 'new', 'best', 'ask', 'show', 'job'];
  const listCounts = new Map(categories.map((category) => [category, 0]));
  const itemCounts = new Map();
  const unexpectedPaths = [];
  const gate = { enabled: true, released: false, releaseReason: null, hits: [], pending: new Set(), timer: null, releaseWaiters: new Set() };
  let page2Ids = new Set();
  let app; let upstream; let readyWritten = false; let stopSignal = null; let failure = null; let resolveStop;
  const stop = new Promise((resolve) => { resolveStop = resolve; });
  const onSignal = (name) => { stopSignal ??= name; releasePage2Gate(`starter-${name.toLowerCase()}`); resolveStop(name); };
  const onSigint = () => onSignal('SIGINT'); const onSigterm = () => onSignal('SIGTERM');
  process.once('SIGINT', onSigint); process.once('SIGTERM', onSigterm);

  const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  const json = (response, status, value) => {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  function listen(server) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(server.address()); });
    });
  }
  function releasePage2Gate(reason) {
    if (gate.released) return;
    gate.released = true; gate.releaseReason = reason;
    if (gate.timer) { clearTimeout(gate.timer); gate.timer = null; }
    for (const release of gate.releaseWaiters) release();
    gate.releaseWaiters.clear(); gate.pending.clear();
  }
  async function waitAtPage2Gate(id) {
    if (!gate.enabled || !page2Ids.has(id) || gate.released) return;
    gate.hits.push({ id, at: new Date().toISOString() }); gate.pending.add(id);
    if (!gate.timer) {
      gate.timer = setTimeout(() => releasePage2Gate('bounded-auto-release'), 2_800);
      gate.timer.unref?.();
    }
    await new Promise((resolve) => gate.releaseWaiters.add(resolve));
  }
  function gateSnapshot() {
    return { enabled: gate.enabled, released: gate.released, releaseReason: gate.releaseReason, targetItemIds: [...page2Ids], hits: [...gate.hits], pendingCount: gate.pending.size, autoReleaseMs: 2_800, hnClientTimeoutMs: 4_000 };
  }
  async function closeOwned() {
    const pending = [];
    if (app) pending.push(Promise.resolve().then(() => app.close()));
    if (upstream?.listening) pending.push(new Promise((resolve, reject) => {
      try { upstream.close((error) => error ? reject(error) : resolve()); upstream.closeIdleConnections?.(); }
      catch (error) { reject(error); }
    }));
    const all = Promise.allSettled(pending);
    let timer;
    const first = await Promise.race([all.then((results) => ({ results })), new Promise((resolve) => { timer = setTimeout(() => resolve(null), 5_000); })]);
    if (timer) clearTimeout(timer);
    const succeeded = (results) => results.every((result) => result.status === 'fulfilled');
    const listening = () => Boolean(app?.server.listening || upstream?.listening);
    if (first && succeeded(first.results) && !listening()) return { completed: true, errors: [] };

    app?.server.closeAllConnections?.(); upstream?.closeAllConnections?.();
    app?.server.closeIdleConnections?.(); upstream?.closeIdleConnections?.();
    const fallback = [];
    for (const server of [app?.server, upstream]) {
      if (!server?.listening) continue;
      fallback.push(new Promise((resolve, reject) => {
        try { server.close((error) => error ? reject(error) : resolve()); }
        catch (error) { reject(error); }
      }));
    }
    let drainTimer;
    const drained = await Promise.race([
      Promise.all([all, Promise.allSettled(fallback)]).then(([results, fallbackResults]) => ({ results, fallbackResults })),
      new Promise((resolve) => { drainTimer = setTimeout(() => resolve(null), 1_000); }),
    ]);
    if (drainTimer) clearTimeout(drainTimer);
    const errors = [
      ...(drained?.results ?? []), ...(drained?.fallbackResults ?? []),
    ].filter((entry) => entry.status === 'rejected').map((entry) => String(entry.reason));
    return { completed: Boolean(drained && succeeded(drained.results) && succeeded(drained.fallbackResults) && !listening()), errors };
  }

  async function run() {
    try {
      if (!safeEvidence) throw new Error('evidenceDir must be inside /tmp, outside ROOT, and outside the helper workspace.');
      await mkdir(evidence, { recursive: true });
      await Promise.all([
        'server/dist/main.js', 'server/dist/adapters/hn/client.js', 'server/dist/config/index.js',
        'client/dist/index.html', 'e2e/fixtures/comments-tree-200.mjs',
      ].map((file) => access(path.join(root, file))));
      const pathUrl = (file) => pathToFileURL(path.join(root, file)).href;
      const [{ createCommentsTreeFixture }, { createServer }, { HnApiClient }, { config }] = await Promise.all([
        import(pathUrl('e2e/fixtures/comments-tree-200.mjs')),
        import(pathUrl('server/dist/main.js')),
        import(pathUrl('server/dist/adapters/hn/client.js')),
        import(pathUrl('server/dist/config/index.js')),
      ]);
      if (config.defaultPageSize !== 30) throw new Error(`Expected compiled defaultPageSize=30; got ${config.defaultPageSize}.`);
      const fixture = createCommentsTreeFixture();
      const { storyId: originalStoryId, items, chainIds, mainIds, allCommentIds, visibleCommentIds, depthNineId } = fixture;
      const fixtureItems = new Map(Object.entries(items).map(([id, item]) => [Number(id), { ...item, ...(Array.isArray(item.kids) ? { kids: [...item.kids] } : {}) }]));
      const maxFixtureId = Math.max(originalStoryId, ...allCommentIds);
      const idStart = maxFixtureId + 100_000;
      const topIds = Array.from({ length: 61 }, (_, index) => idStart + index);
      const otherStoryIds = Object.fromEntries(['new', 'best', 'ask', 'show'].map((category, index) => [category, idStart + 61 + index]));
      const jobId = idStart + 65;
      const primaryStoryId = topIds[0];
      const rootChildIds = [...(fixtureItems.get(originalStoryId)?.kids ?? [])];
      if (!fixtureItems.get(originalStoryId) || rootChildIds.length !== 4) throw new Error('Original comment-tree story roots are incomplete.');
      fixtureItems.delete(originalStoryId);
      for (const id of [chainIds[0], ...mainIds.slice(0, 3)]) {
        const comment = fixtureItems.get(id);
        if (!comment || comment.type !== 'comment') throw new Error(`Original root comment ${id} is missing.`);
        fixtureItems.set(id, { ...comment, parent: primaryStoryId });
      }
      const deadId = mainIds[0]; const deletedId = mainIds[1];
      for (const [id, state] of [[deadId, 'dead'], [deletedId, 'deleted']]) {
        const comment = fixtureItems.get(id);
        if (!comment || !Array.isArray(comment.kids) || comment.kids.length === 0) throw new Error(`Original marker ${id} lost its replies.`);
        fixtureItems.set(id, { ...comment, [state]: true });
      }
      const baseTime = fixture.story.time;
      const storyIds = [...topIds, ...Object.values(otherStoryIds)];
      const storyRecords = new Map();
      for (const [index, id] of topIds.entries()) {
        const primary = index === 0;
        const url = `https://keyboard-fixture-${index + 1}.example.invalid/story/${id}`;
        const rawStory = {
          id, type: 'story', by: primary ? 'keyboard-fixture-primary-author' : `keyboard-fixture-author-${index + 1}`,
          title: primary ? `Keyboard fixture primary story — ${'focus-wrap-token-'.repeat(5)}end` : `Keyboard fixture story ${index + 1}`,
          url, score: 200 - index, descendants: primary ? allCommentIds.length : 0,
          time: baseTime - index * 60, kids: primary ? rootChildIds : [],
        };
        fixtureItems.set(id, rawStory); storyRecords.set(id, rawStory);
      }
      for (const [category, id] of Object.entries(otherStoryIds)) {
        const rawStory = {
          id, type: 'story', by: `keyboard-fixture-${category}-author`, title: `Keyboard fixture ${category} story`,
          url: `https://keyboard-${category}.example.invalid/story/${id}`, score: 51, descendants: 0,
          time: baseTime - id % 10_000, kids: [],
        };
        fixtureItems.set(id, rawStory); storyRecords.set(id, rawStory);
      }
      const rawJob = { id: jobId, type: 'job', title: 'Keyboard fixture local job', url: `https://keyboard-job.example.invalid/${jobId}`, by: 'keyboard-fixture-job-author', time: baseTime, kids: [] };
      fixtureItems.set(jobId, rawJob);
      const lists = {
        top: [...topIds], new: [otherStoryIds.new], best: [otherStoryIds.best], ask: [otherStoryIds.ask],
        show: [otherStoryIds.show], job: [jobId],
      };
      page2Ids = new Set(topIds.slice(30, 60));
      const categoriesStoryIds = [...storyIds, jobId];
      const markerAuthors = { dead: fixtureItems.get(deadId).by, deleted: fixtureItems.get(deletedId).by };
      const hItemIds = [...storyIds, jobId, ...allCommentIds];

      upstream = createHttpServer(async (request, response) => {
        try {
          const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
          if (request.method !== 'GET') return json(response, 405, { error: 'GET only' });
          const list = pathname.match(/^\/v0\/(top|new|best|ask|show|job)stories\.json$/);
          if (list?.[1]) { const category = list[1]; listCounts.set(category, listCounts.get(category) + 1); return json(response, 200, lists[category]); }
          const item = pathname.match(/^\/v0\/item\/(\d+)\.json$/);
          if (item?.[1]) {
            const id = Number(item[1]); itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
            await waitAtPage2Gate(id);
            return json(response, 200, fixtureItems.get(id) ?? null);
          }
          unexpectedPaths.push(pathname); return json(response, 404, { error: 'unknown private keyboard fixture path' });
        } catch (error) {
          if (!response.destroyed) json(response, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      const upstreamAddress = await listen(upstream);
      if (!upstreamAddress || typeof upstreamAddress === 'string') throw new Error('Private raw HN fixture failed to bind.');
      const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v0/`;
      const hnClientTimeoutMs = 4_000;
      const hnClient = new HnApiClient({ baseUrl: upstreamBaseUrl, timeoutMs: hnClientTimeoutMs, retries: 0, concurrency: 4 });
      app = await createServer({ logger: false, staticRoot: path.join(root, 'client/dist'), hnClient });
      app.get('/__test/hn-counters', async (request, reply) => {
        const url = new URL(request.raw.url ?? '/', 'http://127.0.0.1');
        const ids = (url.searchParams.get('ids') ?? '').split(',').filter((id) => /^\d+$/.test(id)).map(Number);
        return reply.header('cache-control', 'no-store').send({
          itemRequests: Object.fromEntries(ids.map((id) => [String(id), itemCounts.get(id) ?? 0])),
          listRequests: Object.fromEntries(categories.map((category) => [category, listCounts.get(category) ?? 0])),
          unexpectedUpstreamPaths: [...unexpectedPaths],
        });
      });
      app.get('/__test/gate/status', async (_request, reply) => reply.header('cache-control', 'no-store').send(gateSnapshot()));
      app.post('/__test/gate/release', async (_request, reply) => {
        releasePage2Gate('node-driver-release');
        return reply.header('cache-control', 'no-store').send({ released: gate.released, releaseReason: gate.releaseReason, pendingCount: gate.pending.size });
      });
      await app.listen({ host: '127.0.0.1', port: 0 });
      const appAddress = app.server.address();
      if (!appAddress || typeof appAddress === 'string') throw new Error('Compiled BFF and SPA failed to bind.');
      const baseUrl = `http://127.0.0.1:${appAddress.port}`;
      const ready = {
        protocolVersion: 1, status: 'ready', readyAt: new Date().toISOString(), helperPid: process.pid,
        fixtureAppPid: process.pid, rawUpstreamPid: process.pid, arguments: { rootPath: root, evidenceDir: evidence },
        baseUrl, countersUrl: `${baseUrl}/__test/hn-counters`, gateStatusUrl: `${baseUrl}/__test/gate/status`, gateReleaseUrl: `${baseUrl}/__test/gate/release`,
        upstreamBaseUrl, storyId: primaryStoryId, jobId, topIds, page2Ids: [...page2Ids], otherStoryIds, listStoryIds: categoriesStoryIds,
        expectedIds: {
          allCommentIds: [...allCommentIds], visibleCommentIds: [...visibleCommentIds], allCommentCount: allCommentIds.length,
          visibleCommentCount: visibleCommentIds.length, depthNineId,
        },
        markerIds: { deadId, deletedId }, markerAuthors,
        rawMeta: {
          primaryStoryId, primaryStoryTitle: storyRecords.get(primaryStoryId).title, primaryStoryAuthor: storyRecords.get(primaryStoryId).by,
          primaryStoryUrl: storyRecords.get(primaryStoryId).url, primaryStoryDomain: new URL(storyRecords.get(primaryStoryId).url).hostname,
          firstPageCount: 30, secondPageCount: 30, topTotalCount: topIds.length, expectedAfterSecondPageCount: 60,
          rootChildIds, chainIds: [...chainIds], mainIds: [...mainIds], markerAuthors,
          markerItems: Object.fromEntries([[deadId, 'dead'], [deletedId, 'deleted']].map(([id, state]) => [state, { id, author: fixtureItems.get(id).by, kids: [...fixtureItems.get(id).kids] }])),
          commentsVisible: visibleCommentIds.length, commentsTotal: allCommentIds.length, defaultPageSize: config.defaultPageSize,
          hnClientTimeoutMs, gateAutoReleaseMs: 2_800, gateTargetCount: page2Ids.size, job: { id: jobId, title: rawJob.title },
        },
      };
      await writeJson(readyPath, ready); readyWritten = true;
      console.log(JSON.stringify({ status: 'ready', pid: process.pid, baseUrl, upstreamBaseUrl, primaryStoryId, topStories: topIds.length, jobId, readyPath }));
      await stop;
    } catch (error) {
      failure = error;
      const record = { status: 'failed', failedAt: new Date().toISOString(), helperPid: process.pid, message: error instanceof Error ? error.message : String(error) };
      if (safeEvidence) {
        try { await mkdir(evidence, { recursive: true }); await writeJson(failurePath, record); }
        catch (writeError) { console.error(`Could not write failure record: ${writeError instanceof Error ? writeError.message : String(writeError)}`); }
      }
      console.error(record.message);
    } finally {
      releasePage2Gate('starter-finally');
      const cleanup = await closeOwned().catch((error) => ({ completed: false, errors: [String(error)] }));
      if (!cleanup.completed) { failure ??= new Error('Owned fixture servers did not close within 5s+1s.'); process.exitCode = 1; }
      if (readyWritten) {
        try { await writeJson(stoppedPath, { status: 'stopped', stoppedAt: new Date().toISOString(), helperPid: process.pid, signal: stopSignal, closeCompleted: cleanup.completed, closeErrors: cleanup.errors, gate: gateSnapshot() }); }
        catch (error) { failure ??= error; process.exitCode = 1; }
      }
      process.removeListener('SIGINT', onSigint); process.removeListener('SIGTERM', onSigterm);
    }
    if (failure) process.exitCode = 1;
  }
  await run();
}
