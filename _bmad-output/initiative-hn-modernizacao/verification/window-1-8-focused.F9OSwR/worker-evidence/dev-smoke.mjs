import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire('/Users/maurowidman/Projects/AI/prod-certo-green/package.json');
const { chromium } = require('@playwright/test');
const root = '/Users/maurowidman/Projects/AI/prod-certo-green';
const npmCli = '/opt/homebrew/Cellar/node@24/24.21.0_1/lib/node_modules/npm/bin/npm-cli.js';
const mode = process.argv[2];
const port = mode === 'override' ? 33877 : 3000;
if (!['default', 'override'].includes(mode)) throw new Error('Use default or override.');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortFree(candidate) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => resolve({ free: false, code: error.code }));
    server.listen(candidate, '127.0.0.1', () => server.close(() => resolve({ free: true })));
  });
}

async function waitForPortFree(candidate, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await isPortFree(candidate);
    if (result.free) return true;
    await sleep(150);
  }
  return false;
}

const occupied = [];
for (const candidate of [port, 5173]) {
  const result = await isPortFree(candidate);
  if (!result.free) occupied.push({ port: candidate, code: result.code });
}
if (occupied.length) {
  console.log(JSON.stringify({ event: 'preflight-ports-busy', occupied }));
  process.exitCode = 2;
} else {
  const env = { ...process.env, PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ''}` };
  delete env.PORT;
  if (mode === 'override') env.PORT = String(port);
  const npmProcess = spawn(process.execPath, [npmCli, 'run', 'dev'], {
    cwd: root,
    env,
    detached: true,
    shell: false,
    stdio: 'inherit',
  });
  console.log(JSON.stringify({ event: 'dev-start', mode, node: process.version, pid: npmProcess.pid, port, vitePort: 5173 }));
  let exitInfo;
  let processError;
  const exitPromise = new Promise((resolve) => npmProcess.once('exit', (code, signal) => {
    exitInfo = { code, signal };
    resolve(true);
  }));
  npmProcess.once('error', (error) => { processError = error.message; });
  let browser;
  let page;
  let nodeHealth;
  let browserHealth;
  let storyMocks = 0;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const expectedAborts = [];
  const externalRequests = [];
  const httpResponses = [];
  const requestUrls = [];
  let smokeError;

  try {
    let ready = false;
    let lastHealthStatus = null;
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline && !ready && !exitInfo && !processError) {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(1_500) });
        lastHealthStatus = response.status;
        if (response.status === 200) {
          nodeHealth = { status: response.status, contentType: response.headers.get('content-type') };
          ready = true;
          break;
        }
      } catch {}
      await sleep(250);
    }
    if (!ready) throw new Error(`Vite/proxy health readiness failed (last status ${lastHealthStatus}; processError ${processError ?? 'none'}).`);

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? 'unknown';
      const record = { url: request.url(), failure };
      if (failure === 'net::ERR_ABORTED' && new URL(request.url()).pathname === '/api/stories') expectedAborts.push(record);
      else failedRequests.push(record);
    });
    page.on('request', (request) => requestUrls.push(new URL(request.url()).pathname));
    page.on('response', async (response) => {
    const headers = await response.allHeaders().catch(() => ({}));
    const record = { path: new URL(response.url()).pathname, status: response.status(), contentType: headers['content-type'] ?? null, resourceType: response.request().resourceType() };
    httpResponses.push(record);
    if ((headers['content-type'] ?? '').includes('application/json') && response.request().resourceType() === 'script') {
      record.body = (await response.text().catch((error) => `unavailable: ${error.message}`)).slice(0, 2000);
    }
  });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        externalRequests.push(url.origin);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await page.route((url) => url.pathname === '/api/stories', (route) => {
      storyMocks += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          page: 1,
          limit: 30,
          snapshot: 'dev-smoke-local-fixture',
          cachedAt: new Date().toISOString(),
          stale: false,
          hasMore: false,
        }),
      });
    });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.getByText('Nenhuma história em top agora.').waitFor({ state: 'visible', timeout: 8_000 });
    browserHealth = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return { status: response.status, contentType: response.headers.get('content-type') };
    });
    console.log(JSON.stringify({
      event: 'browser-smoke',
      mode,
      spa: 'http://localhost:5173/',
      spaText: 'Nenhuma história em top agora.',
      nodeHealth,
      browserHealth,
      storyMocks,
      expectedAborts,
      externalRequests,
      consoleErrors,
      pageErrors,
      failedRequests,
      responses: httpResponses,
    }));
    if (browserHealth.status !== 200 || storyMocks < 1 || externalRequests.length || consoleErrors.length || pageErrors.length || failedRequests.length) {
      throw new Error('Browser console/network acceptance failed.');
    }
  } catch (error) {
    smokeError = error.message;
    const bodyText = page ? await page.locator('body').innerText().catch(() => null) : null;
    console.log(JSON.stringify({ event: 'smoke-error', mode, message: smokeError, processError, storyMocks, consoleErrors, pageErrors, failedRequests, externalRequests, requestUrls, responses: httpResponses, bodyText }));
  } finally {
    if (browser) await browser.close().catch((error) => { smokeError ??= `browser close: ${error.message}`; });
    try {
      process.kill(-npmProcess.pid, 'SIGINT');
      console.log(JSON.stringify({ event: 'root-group-signal', signal: 'SIGINT', pgid: npmProcess.pid }));
    } catch (error) {
      if (error.code !== 'ESRCH') console.log(JSON.stringify({ event: 'root-group-signal-error', code: error.code, message: error.message }));
    }
    let stopped = await Promise.race([exitPromise, sleep(8_000).then(() => false)]);
    if (!stopped) {
      try { process.kill(-npmProcess.pid, 'SIGTERM'); console.log(JSON.stringify({ event: 'root-group-signal', signal: 'SIGTERM', pgid: npmProcess.pid })); }
      catch (error) { if (error.code !== 'ESRCH') console.log(JSON.stringify({ event: 'root-group-signal-error', code: error.code, message: error.message })); }
      stopped = await Promise.race([exitPromise, sleep(4_000).then(() => false)]);
    }
    if (!stopped) {
      try { process.kill(-npmProcess.pid, 'SIGKILL'); console.log(JSON.stringify({ event: 'root-group-signal', signal: 'SIGKILL', pgid: npmProcess.pid })); }
      catch (error) { if (error.code !== 'ESRCH') console.log(JSON.stringify({ event: 'root-group-signal-error', code: error.code, message: error.message })); }
      stopped = await Promise.race([exitPromise, sleep(4_000).then(() => false)]);
    }
    const serverPortFree = await waitForPortFree(port);
    const vitePortFree = await waitForPortFree(5173);
    console.log(JSON.stringify({ event: 'dev-stopped', mode, stopped, exitInfo: exitInfo ?? null, serverPortFree, vitePortFree }));
    if (!stopped || !serverPortFree || !vitePortFree) smokeError ??= 'Owned dev processes or listen ports did not fully stop.';
  }
  if (smokeError) process.exitCode = 1;
}
