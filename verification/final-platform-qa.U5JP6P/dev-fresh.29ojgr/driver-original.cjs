'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const [root, evidence] = process.argv.slice(2);
const { chromium, expect } = createRequire(path.join(root, 'package.json'))('@playwright/test');
const report = { startedAt: new Date().toISOString(), node: process.version, status: 'running', errors: [], cleanup: {} };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let dev, closed, exit, browser, log;
async function free(port) {
  const s = net.createServer();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(port, '127.0.0.1', resolve); });
  await new Promise((resolve, reject) => s.close(e => e ? reject(e) : resolve()));
}
async function main() {
  assert.equal(process.versions.node.split('.')[0], '24');
  assert.equal(fs.readdirSync(evidence).length, 0);
  for (const folder of ['', 'client/']) for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) assert(!fs.existsSync(path.join(root, folder + name)), 'Refuse dotenv ambiguity; contents not opened');
  await free(3000); await free(5173);
  log = fs.openSync(path.join(evidence, 'npm-dev.log'), 'wx');
  try {
    dev = spawn('npm', ['run', 'dev'], { cwd: root, detached: true, env: { ...process.env, PORT: '3000', NODE_ENV: 'development' }, stdio: ['ignore', log, log] });
    report.pid = dev.pid;
    closed = new Promise((resolve, reject) => { dev.once('error', reject); dev.once('close', (code, signal) => { exit = { code, signal }; resolve(exit); }); });
    closed.catch(() => {});
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline && !exit) {
      try {
        const a = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(1000) });
        const b = await fetch('http://127.0.0.1:5173/', { signal: AbortSignal.timeout(1000) });
        if (a.ok && b.ok && (await b.text()).includes('/@vite/client')) { ready = true; break; }
      } catch {}
      await delay(250);
    }
    assert(ready, 'Dev API and Vite ready within 30s');
    const proxied = await fetch('http://127.0.0.1:5173/api/health', { signal: AbortSignal.timeout(5000) });
    assert.equal(proxied.status, 200); assert.equal((await proxied.json()).status, 'ok');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 844 }, colorScheme: 'light' });
    page.on('pageerror', e => report.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('.story-row')).toHaveCount(30, { timeout: 30000 });
    report.topRows = await page.locator('.story-row').count();
    await page.screenshot({ path: path.join(evidence, 'dev-top-light.png') });
    await page.getByRole('tab', { name: 'Jobs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(page.locator('.story-row')).toHaveCount(30, { timeout: 30000 });
    report.jobRows = await page.locator('.story-row').count();
    await page.getByRole('button', { name: 'Alternar tema claro e escuro', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: path.join(evidence, 'dev-jobs-dark.png') });
    assert.deepEqual(report.errors, []);
    report.proxyHealth = 'ok'; report.status = 'passed';
  } catch (e) { report.status = 'failed'; report.failure = e.stack || String(e); }
  finally {
    if (browser) await browser.close();
    if (dev?.pid && !exit) {
      try { process.kill(-dev.pid, 'SIGTERM'); report.cleanup.signal = 'SIGTERM'; } catch {}
      let done = await Promise.race([closed.then(() => true, () => true), delay(10000).then(() => false)]);
      if (!done) { try { process.kill(-dev.pid, 'SIGKILL'); report.cleanup.forced = true; } catch {} done = await Promise.race([closed.then(() => true, () => true), delay(2000).then(() => false)]); }
      report.cleanup.closed = done; if (!done) report.status = 'failed';
    }
    report.cleanup.exit = exit;
    if (log !== undefined) fs.closeSync(log);
    for (const port of [3000, 5173]) try { await free(port); report.cleanup['port' + port + 'Free'] = true; } catch (e) { report.status = 'failed'; report.cleanup['port' + port + 'Free'] = false; }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(evidence, 'dev-result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report));
    if (report.status !== 'passed') process.exitCode = 1;
  }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
