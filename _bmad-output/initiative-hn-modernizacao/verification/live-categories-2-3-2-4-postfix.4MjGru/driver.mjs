import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const [root, outputDir, baseURL = 'http://127.0.0.1:3000'] = process.argv.slice(2);
assert(root && outputDir, 'Pass the project root and evidence directory');
const require = createRequire(path.join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = new URL(baseURL).origin;
const categories = [
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'best', label: 'Best' },
  { value: 'ask', label: 'Ask' },
  { value: 'show', label: 'Show' },
  { value: 'job', label: 'Jobs' },
];
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
const failedRequests = [];
const browserRequests = [];
const httpErrors = [];
const checkedCategories = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('request', (request) => browserRequests.push(request.url()));
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('response', (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});
const snapshots = new Map();
let result;
try {
  const healthBefore = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(healthBefore.status, 200);
  const initialHealth = await healthBefore.json();
  assert.equal(initialHealth.status, 'ok');

  for (const category of categories) {
    const received = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === origin && url.pathname === '/api/stories'
        && url.searchParams.get('category') === category.value;
    }, { timeout: 60_000 });
    const started = performance.now();
    if (category.value === 'top') {
      const navigation = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      assert.equal(navigation?.status(), 200);
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      assert(await page.evaluate(() => window.scrollY > 0), 'The previous populated category must scroll');
      // Dispatch a real DOM click without Playwright scrolling the tab into view first.
      await page.getByRole('tab', { name: category.label, exact: true }).evaluate((element) => element.click());
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    }
    const apiResponse = await received;
    assert.equal(apiResponse.status(), 200, `Live ${category.value} API response`);
    const data = await apiResponse.json();
    const interactionToApiBodyMs = performance.now() - started;
    assert.equal(data.page, 1);
    assert.equal(data.limit, 30);
    assert.equal(data.stale, false);
    // Snapshot versions the category's ID sequence; cachedAt may be older when
    // normalized items are reused from another category's still-fresh cache.
    assert(Number.isFinite(Date.parse(data.snapshot)));
    assert(Number.isFinite(Date.parse(data.cachedAt)));
    assert(data.items.length > 0 && data.items.length <= 30, `${category.value} must not be empty`);
    assert(data.items.every((item) => item.type === 'story' || item.type === 'job'));
    assert.equal(new Set(data.items.map((item) => item.id)).size, data.items.length);
    if (category.value === 'job') assert(data.items.every((item) => item.type === 'job'));
    snapshots.set(category.value, data.snapshot);

    await expect(page.getByRole('heading', { name: category.label, level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: category.label, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('list', { name: `Histórias em ${category.label}`, exact: true })).toBeVisible();
    await expect(page.locator('.story-row')).toHaveCount(data.items.length, { timeout: 15_000 });
    const renderedTitles = await page.locator('.story-row h2').allTextContents();
    assert.deepEqual(renderedTitles, data.items.map((item) => item.title));
    await expect(page.getByText(/^Atualizado em /)).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    if (category.value === 'top') assert.equal(new URL(page.url()).searchParams.get('category'), null);
    else assert.equal(new URL(page.url()).searchParams.get('category'), category.value);
    const renderedAtMs = performance.now() - started;
    await page.screenshot({ path: path.join(outputDir, `${category.value}-desktop.png`) });

    const upstream = await fetch(`https://hacker-news.firebaseio.com/v0/${category.value}stories.json`, {
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(upstream.status, 200);
    const sourceIds = await upstream.json();
    assert(data.items.every((item) => sourceIds.includes(item.id)), `${category.value} IDs must belong to current official HN`);
    let firstRawJob;
    if (category.value === 'job') {
      const rawResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${data.items[0].id}.json`, {
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(rawResponse.status, 200);
      firstRawJob = await rawResponse.json();
      assert.equal(firstRawJob.type, 'job');
      assert.equal(data.items[0].score, typeof firstRawJob.score === 'number' ? firstRawJob.score : null);
    }
    checkedCategories.push({
      category: category.value,
      rows: data.items.length,
      types: [...new Set(data.items.map((item) => item.type))],
      firstIds: data.items.slice(0, 3).map((item) => item.id),
      upstreamIdCount: sourceIds.length,
      snapshot: data.snapshot,
      interactionToApiBodyMs: Number(interactionToApiBodyMs.toFixed(2)),
      renderedAtMs: Number(renderedAtMs.toFixed(2)),
      ...(firstRawJob ? { firstRawJob: { id: firstRawJob.id, type: firstRawJob.type, sourceScore: firstRawJob.score ?? null } } : {}),
    });
  }

  await page.setViewportSize({ width: 320, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('tab', { name: 'Jobs', exact: true }).scrollIntoViewIfNeeded();
  const mobileWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(mobileWidth.viewport, 320);
  assert(mobileWidth.document <= 320, `Unexpected document overflow: ${JSON.stringify(mobileWidth)}`);
  await page.screenshot({ path: path.join(outputDir, 'job-mobile-320.png') });

  // This supplemental measurement includes real local HTTP transfer and JSON decoding.
  // The deterministic inject benchmark separately proves upstream-call counters.
  const timings = [];
  const perCategory = {};
  for (const category of categories) {
    const samples = [];
    for (let index = 0; index < 30; index++) {
      const started = performance.now();
      const response = await fetch(`${baseURL}/api/stories?category=${category.value}`, { signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, 200);
      const data = await response.json();
      samples.push(performance.now() - started);
      assert.equal(data.stale, false);
      assert.equal(data.snapshot, snapshots.get(category.value), 'Previously visited snapshot must remain unchanged');
      assert(data.items.length > 0, 'Every measured live response must be nonempty');
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1];
    assert(p95Ms < 1_000, `Local HTTP ${category.value} p95 is ${p95Ms}ms`);
    perCategory[category.value] = { samples: samples.length, p95Ms: Number(p95Ms.toFixed(2)) };
    timings.push(...samples);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const healthResponse = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');
  assert(health.cache.entries >= Math.max(...checkedCategories.map((category) => category.rows)));
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(httpErrors, []);
  assert.deepEqual(failedRequests, []);
  assert(browserRequests.every((url) => new URL(url).origin === origin), 'Browser data must go through the local BFF only');
  result = {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    node: process.version,
    baseURL,
    initialHealth,
    checkedCategories,
    mobileWidth,
    repeatHttp: {
      samples: timings.length,
      p95Ms: Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2)),
      perCategory,
      measurement: 'Sequential local HTTP to full body/JSON decoding on previously visited page-1 snapshots; real clock, no browser/interactivity p95 claim; live upstream counters not instrumented',
    },
    health,
    consoleErrors,
    httpErrors,
    failedRequests,
    browserRequests,
    interactions: ['initial Top visit', 'scroll each previous category to bottom', 'click each category tab via DOM event without automatic pre-scroll', 'verify URL/heading/tab/rows/freshness', 'inspect Jobs at 320px'],
    scope: 'Current compiled six-category listing against official HN only. Pagination/detail/comments/themes/full accessibility and human acceptance remain separate tickets.',
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png') }).catch(() => {});
  result = { status: 'failed', checkedAt: new Date().toISOString(), message: error.message, checkedCategories, consoleErrors, httpErrors, failedRequests, browserRequests };
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
