'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const [root, evidence] = process.argv.slice(2);
const base = 'http://127.0.0.1:3000';
const categories = ['top', 'new', 'best', 'ask', 'show', 'job'];
const report = { startedAt: new Date().toISOString(), node: process.version, base, status: 'running', samples: [], cleanup: {} };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let app;
let appClose;
let appExit;
let log;
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(3000, '127.0.0.1', resolve); });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}
async function response(url, timeout = 20000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'error' });
  assert.equal(r.status, 200, url);
  return r;
}
function p95(xs) { const sorted = [...xs].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * 0.95) - 1]; }
async function main() {
  assert.equal(process.versions.node.split('.')[0], '24');
  assert(root && evidence);
  assert.equal(fs.readdirSync(evidence).length, 0);
  report.envPresenceOnly = ['.env', '.env.local', '.env.production', '.env.production.local', 'client/.env', 'client/.env.local', 'client/.env.production', 'client/.env.production.local'].map(relative => ({ relative, present: fs.existsSync(path.join(root, relative)) }));
  assert(report.envPresenceOnly.every(x => !x.present), 'Refuse dotenv ambiguity; no file was opened');
  await freePort();
  log = fs.openSync(path.join(evidence, 'npm-start.log'), 'wx');
  try {
    app = spawn('npm', ['start'], { cwd: root, env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }, detached: true, stdio: ['ignore', log, log] });
    report.pid = app.pid;
    appClose = new Promise((resolve, reject) => { app.once('error', reject); app.once('close', (code, signal) => { appExit = { code, signal }; resolve(appExit); }); });
    appClose.catch(() => {});
    const until = Date.now() + 20000;
    let ready = false;
    while (Date.now() < until) {
      if (appExit) throw new Error('npm start exited before readiness: ' + JSON.stringify(appExit));
      try { report.health = await (await response(base + '/api/health', 1000)).json(); ready = true; break; } catch {}
      await delay(250);
    }
    assert(ready, 'Local health readiness within 20s');
    const html = await (await response(base + '/')).text();
    const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(x => x[1]);
    assert(assets.some(x => x.endsWith('.js')) && assets.some(x => x.endsWith('.css')));
    report.assets = [];
    for (const asset of assets) { const r = await response(base + asset); const body = await r.arrayBuffer(); assert(body.byteLength > 0); report.assets.push({ asset, status: r.status, bytes: body.byteLength }); }
    const snapshots = {};
    report.warmup = [];
    for (const category of categories) {
      const body = await (await response(base + '/api/stories?category=' + category)).json();
      assert.equal(body.stale, false); assert(body.items.length > 0); assert.equal(body.page, 1); assert.equal(body.limit, 30); assert.equal(typeof body.snapshot, 'string');
      if (category === 'job') assert(body.items.every(x => x.type === 'job'));
      snapshots[category] = body.snapshot;
      report.warmup.push({ category, count: body.items.length, snapshot: body.snapshot });
    }
    report.measurementStartedAt = new Date().toISOString();
    for (let i = 0; i < 30; i += 1) for (const category of categories) {
      const start = performance.now();
      const body = await (await response(base + '/api/stories?category=' + category)).json();
      const elapsedMs = performance.now() - start;
      assert.equal(body.stale, false); assert(body.items.length > 0); assert.equal(body.snapshot, snapshots[category]); assert.equal(body.page, 1);
      report.samples.push({ category, elapsedMs, count: body.items.length, fresh: true, snapshotUnchanged: true });
    }
    report.performance = { sampleCount: report.samples.length, samplesPerCategory: 30, p95Ms: p95(report.samples.map(x => x.elapsedMs)), categoryP95Ms: Object.fromEntries(categories.map(category => [category, p95(report.samples.filter(x => x.category === category).map(x => x.elapsedMs))])), method: 'Sequential loopback HTTP socket fetch through complete body and JSON; six categories, warmed cache, fresh/nonempty and stable snapshots on every response; not browser interaction or public upstream latency.' };
    assert(report.performance.p95Ms < 1000);
    const browserEvidence = path.join(evidence, 'browser'); fs.mkdirSync(browserEvidence, { mode: 0o700 });
    const driverLog = fs.openSync(path.join(evidence, 'browser-driver.log'), 'wx');
    const driver = spawn(process.execPath, ['/tmp/hn-final-platform-qa-20261012-f62d9b/scripts/browser-public-smoke.cjs', '--root', root, '--base-url', base, '--evidence-dir', browserEvidence], { cwd: root, detached: true, stdio: ['ignore', driverLog, driverLog] });
    let driverClosed = false;
    const driverClose = new Promise((resolve, reject) => { driver.once('error', reject); driver.once('close', (code, signal) => { driverClosed = true; resolve({ code, signal }); }); });
    const timer = setTimeout(() => { if (!driverClosed) { try { process.kill(-driver.pid, 'SIGTERM'); } catch {} } }, 320000);
    let exit;
    try { exit = await driverClose; } finally { clearTimeout(timer); fs.closeSync(driverLog); }
    report.browserProcess = exit;
    assert.equal(exit.code, 0, 'Public browser driver exit');
    const browserReport = JSON.parse(fs.readFileSync(path.join(browserEvidence, 'browser-summary.json'), 'utf8'));
    assert.equal(browserReport.status, 'pass');
    report.browser = { status: browserReport.status, screenshots: browserReport.screenshots, categories: browserReport.categories, detailTarget: browserReport.detailTarget, comments: browserReport.comments, limitations: browserReport.limitations };
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); }
  finally {
    if (app?.pid && !appExit) {
      try { process.kill(-app.pid, 'SIGTERM'); report.cleanup.signal = 'SIGTERM'; } catch (error) { report.cleanup.signalError = String(error); }
      let closed = await Promise.race([appClose.then(() => true, () => true), delay(5000).then(() => false)]);
      if (!closed) { try { process.kill(-app.pid, 'SIGKILL'); report.cleanup.forced = true; } catch {} closed = await Promise.race([appClose.then(() => true, () => true), delay(2000).then(() => false)]); }
      report.cleanup.closed = closed;
      if (!closed) report.status = 'failed';
    }
    report.cleanup.appExit = appExit;
    if (log !== undefined) fs.closeSync(log);
    try { await freePort(); report.cleanup.port3000Free = true; } catch (error) { report.cleanup.port3000Free = false; report.cleanup.error = String(error); report.status = 'failed'; }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(evidence, 'local-result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: report.status, evidence, p95Ms: report.performance?.p95Ms, screenshots: report.browser?.screenshots.length, failure: report.failure }));
    if (report.status !== 'passed') process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
