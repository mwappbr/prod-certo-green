import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const [root, outputDir, baseURL = 'http://127.0.0.1:3000', ttlArgument = '2000'] = process.argv.slice(2);
const ttl = Number(ttlArgument);
assert(root && outputDir && Number.isSafeInteger(ttl) && ttl > 0, 'Pass root, new evidence directory, base URL, and the actual server LIST_CACHE_TTL_MS');
const require = createRequire(path.join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = new URL(baseURL).origin;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const requests = [];
const pageErrors = [];
const consoleErrors = [];
const httpErrors = [];
const failedRequests = [];
let first;
let second;
let replacement;
let expiredResponse;
let retainedContinuation;
let publishedSnapshot;
let result;

function isStories(url, number) {
  const parsed = new URL(url);
  return parsed.origin === origin && parsed.pathname === '/api/stories'
    && parsed.searchParams.get('category') === 'top'
    && Number(parsed.searchParams.get('page') ?? 1) === number;
}
function responseFor(number) {
  const pending = page.waitForResponse((response) => isStories(response.url(), number), { timeout: 60_000 });
  // Observe rejection immediately, including when another assertion closes the browser.
  pending.catch(() => {});
  return pending;
}
page.on('request', (request) => requests.push(request.url()));
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
});
page.on('response', (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

try {
  // Warm normalized first-page items so the browser can establish a fresh short-lived
  // ID snapshot without spending its whole TTL on initial upstream item fetching.
  const warmup = await fetch(`${baseURL}/api/stories?category=top`, { signal: AbortSignal.timeout(60_000) });
  assert.equal(warmup.status, 200);
  const warmed = await warmup.json();
  assert(warmed.items.length > 0);

  const receivedFirst = responseFor(1);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const firstResponse = await receivedFirst;
  assert.equal(firstResponse.status(), 200);
  first = await firstResponse.json();
  assert.equal(first.hasMore, true);
  await expect(page.locator('.story-row')).toHaveCount(first.items.length);
  const receivedSecond = responseFor(2);
  await page.getByRole('button', { name: 'Carregar mais', exact: true }).click();
  const secondResponse = await receivedSecond;
  assert.equal(secondResponse.status(), 200);
  second = await secondResponse.json();
  assert.equal(second.snapshot, first.snapshot);
  assert.equal(second.hasMore, true);
  assert(second.items.length > 0);
  const oldRows = first.items.length + second.items.length;
  await expect(page.locator('.story-row')).toHaveCount(oldRows);
  await page.screenshot({ path: path.join(outputDir, 'before-expiration-two-pages.png') });

  await expect.poll(() => Date.now() - Date.parse(first.snapshot), { timeout: ttl + 10_000 })
    .toBeGreaterThan(ttl + 200);

  // TTL expiry alone preserves the old sequence during stale retention. Observe
  // that behavior, then let a separate real BFF client renew page 1 and replace
  // the category's snapshot while the browser still holds its two-page buffer.
  const retainedUrl = new URL('/api/stories', baseURL);
  retainedUrl.search = new URLSearchParams({ category: 'top', page: '3', limit: String(first.limit), snapshot: first.snapshot });
  const retainedResponse = await fetch(retainedUrl, { signal: AbortSignal.timeout(60_000) });
  assert.equal(retainedResponse.status, 200);
  const retained = await retainedResponse.json();
  assert.equal(retained.snapshot, first.snapshot);
  assert.equal(retained.stale, true);
  retainedContinuation = { url: retainedUrl.href, status: retainedResponse.status, snapshot: retained.snapshot, stale: retained.stale, rows: retained.items.length };

  const renewalUrl = `${baseURL}/api/stories?category=top`;
  const renewalResponse = await fetch(renewalUrl, { signal: AbortSignal.timeout(60_000) });
  assert.equal(renewalResponse.status, 200);
  const renewed = await renewalResponse.json();
  assert.equal(renewed.stale, false, 'Snapshot renewal assumes healthy live upstream');
  assert.notEqual(renewed.snapshot, first.snapshot);
  publishedSnapshot = { url: renewalUrl, snapshot: renewed.snapshot, stale: renewed.stale, rows: renewed.items.length };
  await expect(page.locator('.story-row')).toHaveCount(oldRows);

  const receivedExpired = responseFor(3);
  const receivedReplacement = responseFor(1);
  await page.getByRole('button', { name: 'Carregar mais', exact: true }).click();
  expiredResponse = await receivedExpired;
  assert(expiredResponse.status() >= 400);
  const errorEnvelope = await expiredResponse.json();
  assert.equal(errorEnvelope.error.code, 'SNAPSHOT_EXPIRED');
  const expiredQuery = new URL(expiredResponse.url()).searchParams;
  assert.equal(expiredQuery.get('snapshot'), first.snapshot);
  assert.equal(Number(expiredQuery.get('limit')), first.limit);

  const replacementResponse = await receivedReplacement;
  assert.equal(replacementResponse.status(), 200);
  replacement = await replacementResponse.json();
  assert.equal(replacement.page, 1);
  assert.equal(replacementResponse.request().url().includes('snapshot='), false);
  assert.notEqual(replacement.snapshot, first.snapshot);
  assert.equal(replacement.stale, false, 'This real recovery probe assumes healthy live upstream');
  assert(replacement.items.length > 0 && replacement.items.length < oldRows);
  await expect(page.locator('.story-row')).toHaveCount(replacement.items.length, { timeout: 15_000 });
  assert.deepEqual(await page.locator('.story-row h2').allTextContents(), replacement.items.map((item) => item.title));
  await expect(page.getByRole('tab', { name: 'Top', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Top', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /lista.*atualiz|atualiz.*lista/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: path.join(outputDir, 'after-expiration-first-page.png') });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.equal(httpErrors.length, 1);
  assert.equal(httpErrors[0].url, expiredResponse.url());
  assert.equal(httpErrors[0].status, expiredResponse.status());
  const unexpectedConsole = consoleErrors.filter((entry) => !(entry.location.url === expiredResponse.url()
    && entry.text.includes(String(expiredResponse.status())) && /Failed to load resource/.test(entry.text)));
  assert.deepEqual(unexpectedConsole, []);
  assert(requests.every((url) => new URL(url).origin === origin));
  result = {
    status: 'passed', checkedAt: new Date().toISOString(), node: process.version, baseURL, listCacheTtlMs: ttl,
    originalSnapshot: first.snapshot, replacementSnapshot: replacement.snapshot,
    retainedContinuation, publishedSnapshot,
    beforeRows: oldRows, afterRows: replacement.items.length,
    expiration: { status: expiredResponse.status(), error: errorEnvelope.error },
    firstCachedAt: first.cachedAt, replacementCachedAt: replacement.cachedAt,
    requests, pageErrors, failedRequests, consoleErrors, httpErrors,
    scope: 'Actual compiled browser/BFF/live HN with a short list TTL and unchanged default stale retention. A Node BFF continuation proves TTL-expired retained data remain valid/stale; another real P1 client publishes a newer snapshot. The browser then receives SNAPSHOT_EXPIRED for its old token and automatically recovers P1 without that token, discarding its old buffer and announcing the reset at the top. No real detail/comments/theme/AT/human acceptance claim.',
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'failure.png') }).catch(() => {});
  result = {
    status: 'failed', checkedAt: new Date().toISOString(), node: process.version, message: error.message,
    listCacheTtlMs: ttl, firstSnapshot: first?.snapshot, secondSnapshot: second?.snapshot,
    replacementSnapshot: replacement?.snapshot, replacementStale: replacement?.stale,
    retainedContinuation, publishedSnapshot,
    requests, pageErrors, failedRequests, consoleErrors, httpErrors,
  };
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
process.exitCode = result?.status === 'passed' ? 0 : 1;
