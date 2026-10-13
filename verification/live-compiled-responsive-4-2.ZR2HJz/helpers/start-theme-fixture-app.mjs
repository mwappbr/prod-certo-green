import { createServer as createHttpServer } from 'node:http';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [rootArg, evidenceArg, ...extra] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extra.length) {
  console.error('Usage: node start-theme-fixture-app.mjs <ROOT> <evidenceDir>');
  process.exitCode = 64;
} else {
  const root = path.resolve(rootArg);
  const evidence = path.resolve(evidenceArg);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const safeEvidence = [path.resolve('/tmp'), path.resolve('/private/tmp')].some((tempRoot) => inside(evidence, tempRoot)) && !inside(evidence, root) && !inside(evidence, scriptDir);
  const readyPath = path.join(evidence, 'fixture-ready.json');
  const failurePath = path.join(evidence, 'fixture-failure.json');
  const stoppedPath = path.join(evidence, 'fixture-stopped.json');
  const categories = ['top', 'new', 'best', 'ask', 'show', 'job'];
  const listCounts = new Map(categories.map((category) => [category, 0]));
  const itemCounts = new Map();
  const unexpectedPaths = [];
  let app; let upstream; let readyWritten = false; let stopSignal = null; let failure = null; let resolveStop;
  const stop = new Promise((resolve) => { resolveStop = resolve; });
  const onSignal = (name) => { stopSignal ??= name; resolveStop(name); };
  const onSigint = () => onSignal('SIGINT'); const onSigterm = () => onSignal('SIGTERM');
  process.once('SIGINT', onSigint); process.once('SIGTERM', onSigterm);

  function inside(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  }
  const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  function listen(server) {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(server.address()); });
    });
  }
  function json(response, status, value) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
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
    const stillListening = () => Boolean(app?.server.listening || upstream?.listening);
    if (first && succeeded(first.results) && !stillListening()) return true;

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
    return Boolean(drained && succeeded(drained.results) && succeeded(drained.fallbackResults) && !stillListening());
  }

  async function run() {
    try {
      if (!safeEvidence) throw new Error('evidenceDir must be outside ROOT and the helper scripts directory.');
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
      const fixture = createCommentsTreeFixture();
      const { storyId, items, chainIds, mainIds, allCommentIds, visibleCommentIds, depthNineId } = fixture;
      const privateItems = new Map(Object.entries(items).map(([id, item]) => [Number(id), { ...item, ...(Array.isArray(item.kids) ? { kids: [...item.kids] } : {}) }]));
      const rawStory = privateItems.get(storyId);
      if (!rawStory || rawStory.type !== 'story') throw new Error('Fixture story missing.');
      const storyTitle = `Long title for synthetic typography 200% — ${'wrap-me-long-token-'.repeat(12)} end`;
      const storyAuthor = `fixture-author-with-long-name-${'author-segment-'.repeat(6)}`;
      const storyUrl = `https://fixture-long-domain-for-typography-wrap-2026.example.invalid/a/very/long/path/used/only/by/the/local/fixture`;
      const storyDomain = new URL(storyUrl).hostname;
      privateItems.set(storyId, { ...rawStory, title: storyTitle, by: storyAuthor, url: storyUrl });
      const longAnchorText = `SAFE-LONG-ANCHOR-${'word-wrap-check-'.repeat(8)}`;
      const safeHref = `https://example.invalid/typography/${'long-path-segment-'.repeat(8)}?fixture=4.2`;
      const safeCommentId = chainIds[0];
      const rawSafeComment = privateItems.get(safeCommentId);
      if (!rawSafeComment || rawSafeComment.type !== 'comment') throw new Error('Safe-link comment missing.');
      privateItems.set(safeCommentId, {
        ...rawSafeComment,
        text: `<p>Fixture comment with a safe, long URL link for typography wrapping: <a href="${safeHref}">${longAnchorText}</a>. The branch remains expandable.</p>`,
      });
      const deadId = mainIds[0]; const deletedId = mainIds[1];
      for (const [id, state] of [[deadId, 'dead'], [deletedId, 'deleted']]) {
        const item = privateItems.get(id);
        if (!item || !Array.isArray(item.kids) || !item.kids.length) throw new Error(`Marker ${id} has no replies.`);
        privateItems.set(id, { ...item, [state]: true });
      }
      const jobId = Math.max(storyId, ...allCommentIds) + 1_000;
      const rawJob = { id: jobId, type: 'job', title: 'Local synthetic job for typography', url: 'https://example.invalid/verification-only', by: 'fixture-job-author', time: rawStory.time, kids: [] };
      privateItems.set(jobId, rawJob);
      const rootChildIds = [...(privateItems.get(storyId)?.kids ?? [])];
      const expectedChildrenById = Object.fromEntries([...privateItems].filter(([, item]) => item.type === 'comment').map(([id, item]) => [String(id), [...(item.kids ?? [])]]));
      const lists = { top: [storyId], new: [storyId], best: [storyId], ask: [storyId], show: [storyId], job: [jobId] };

      upstream = createHttpServer((request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
        if (request.method !== 'GET') return json(response, 405, { error: 'GET only' });
        const list = pathname.match(/^\/v0\/(top|new|best|ask|show|job)stories\.json$/);
        if (list?.[1]) { const category = list[1]; listCounts.set(category, listCounts.get(category) + 1); return json(response, 200, lists[category]); }
        const item = pathname.match(/^\/v0\/item\/(\d+)\.json$/);
        if (item?.[1]) { const id = Number(item[1]); itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1); return json(response, 200, privateItems.get(id) ?? null); }
        unexpectedPaths.push(pathname); return json(response, 404, { error: 'unknown private fixture path' });
      });
      const upstreamAddress = await listen(upstream);
      if (!upstreamAddress || typeof upstreamAddress === 'string') throw new Error('Private HN stub failed to bind.');
      const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}/v0/`;
      const hnClient = new HnApiClient({ baseUrl: upstreamBaseUrl, timeoutMs: 500, retries: 0, concurrency: 4 });
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
      await app.listen({ host: '127.0.0.1', port: 0 });
      const appAddress = app.server.address();
      if (!appAddress || typeof appAddress === 'string') throw new Error('Fixture app failed to bind.');
      const baseUrl = `http://127.0.0.1:${appAddress.port}`;
      const ready = {
        protocolVersion: 1, status: 'ready', readyAt: new Date().toISOString(), helperPid: process.pid,
        fixtureAppPid: process.pid, rawUpstreamPid: process.pid, arguments: { rootPath: root, evidenceDir: evidence },
        baseUrl, countersUrl: `${baseUrl}/__test/hn-counters`, upstreamBaseUrl, storyId, jobId,
        setupIds: { storyId, jobId, rootChildIds, depthNineId }, markerIds: { deadId, deletedId },
        expectedIds: { visibleCommentIds: [...visibleCommentIds], allCommentIds: [...allCommentIds], visibleCommentCount: visibleCommentIds.length, allCommentCount: allCommentIds.length, depthNineId },
        expectedChildrenById,
        rawMeta: {
          storyTitle, storyAuthor, storyUrl, storyDomain, storyScore: rawStory.score, storyDescendants: rawStory.descendants,
          storyChildIds: rootChildIds, safeCommentId, safeHref, longAnchorText,
          markerItems: Object.fromEntries([[deadId, 'dead'], [deletedId, 'deleted']].map(([id, state]) => [state, { id, author: privateItems.get(id).by, rawText: privateItems.get(id).text, kids: [...privateItems.get(id).kids] }])),
          job: { id: jobId, title: rawJob.title, url: rawJob.url, scoreFieldPresent: Object.hasOwn(rawJob, 'score') },
          chainIds: [...chainIds], mainIds: [...mainIds], cacheTtlsMs: { item: config.itemCacheTtlMs, list: config.listCacheTtlMs },
        },
      };
      await writeJson(readyPath, ready); readyWritten = true;
      console.log(JSON.stringify({ status: 'ready', pid: process.pid, baseUrl, upstreamBaseUrl, storyId, jobId, readyPath }));
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
      const closeCompleted = await closeOwned().catch(() => false);
      if (!closeCompleted) { failure ??= new Error('Owned fixture servers did not close within the bounded cleanup period.'); process.exitCode = 1; }
      if (readyWritten) {
        try { await writeJson(stoppedPath, { status: 'stopped', stoppedAt: new Date().toISOString(), helperPid: process.pid, signal: stopSignal, closeCompleted }); }
        catch (error) { failure ??= error; process.exitCode = 1; }
      }
      process.removeListener('SIGINT', onSigint); process.removeListener('SIGTERM', onSigterm);
    }
    if (failure) process.exitCode = 1;
  }
  await run();
}
