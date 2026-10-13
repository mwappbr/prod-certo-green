import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const [root, outputDir, baseURL = 'http://127.0.0.1:3000'] = process.argv.slice(2);
assert(root && outputDir, 'Pass project root and a new evidence directory');
const require = createRequire(path.join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = new URL(baseURL).origin;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const browserRequests = [];
const apiRequests = [];
const failedRequests = [];
const consoleErrors = [];
const pageErrors = [];
const httpErrors = [];
const interactions = [];
let offlineAttempt;
let result;

function storiesRequest(url) {
  const parsed = new URL(url);
  return parsed.origin === origin && parsed.pathname === '/api/stories';
}
function requestTuple(url) {
  const parsed = new URL(url);
  return {
    category: parsed.searchParams.get('category'),
    page: Number(parsed.searchParams.get('page') ?? 1),
    limit: parsed.searchParams.get('limit'),
    snapshot: parsed.searchParams.get('snapshot'),
  };
}
function responseFor(category, number) {
  return page.waitForResponse((response) => storiesRequest(response.url())
    && requestTuple(response.url()).category === category
    && requestTuple(response.url()).page === number, { timeout: 60_000 });
}
async function readPage(response, category, number, previous) {
  assert.equal(response.status(), 200);
  const data = await response.json();
  assert.equal(data.page, number);
  assert.equal(typeof data.hasMore, 'boolean', 'Current BFF must emit hasMore');
  assert(data.items.length <= data.limit);
  assert(data.items.every((item) => item.type === 'story' || item.type === 'job'));
  assert(Number.isFinite(Date.parse(data.snapshot)));
  assert(Number.isFinite(Date.parse(data.cachedAt)));
  const tuple = requestTuple(response.url());
  assert.equal(tuple.category, category);
  if (previous) {
    assert.equal(tuple.snapshot, previous.snapshot);
    assert.equal(Number(tuple.limit), previous.limit);
    assert.equal(data.snapshot, previous.snapshot);
    assert.equal(data.limit, previous.limit);
  }
  return data;
}
async function renderedTitles(expected) {
  await expect(page.locator('.story-row')).toHaveCount(expected.length, { timeout: 15_000 });
  assert.deepEqual(await page.locator('.story-row h2').allTextContents(), expected.map((item) => item.title));
}
async function scrollPosition() {
  return page.evaluate(() => window.scrollY);
}
async function expectPosition(expected) {
  await expect.poll(async () => Math.abs((await scrollPosition()) - expected)).toBeLessThanOrEqual(2);
}

page.on('request', (request) => {
  browserRequests.push(request.url());
  if (storiesRequest(request.url())) apiRequests.push(request.url());
});
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});

try {
  const receivedTop = responseFor('top', 1);
  const navigation = await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  assert.equal(navigation?.status(), 200);
  const first = await readPage(await receivedTop, 'top', 1);
  assert(first.items.length > 0 && first.hasMore);
  await renderedTitles(first.items);
  const more = page.getByRole('button', { name: 'Carregar mais', exact: true });
  await more.scrollIntoViewIfNeeded();
  const callsBeforeScroll = apiRequests.length;
  // A short observation window establishes that scrolling alone did not trigger a request.
  await page.waitForTimeout(500);
  assert.equal(apiRequests.length, callsBeforeScroll, 'No automatic infinite-scroll request');
  interactions.push('scroll to the load-more control without an automatic request');

  const beforeAppend = await scrollPosition();
  const receivedSecond = responseFor('top', 2);
  await more.click();
  const second = await readPage(await receivedSecond, 'top', 2, first);
  assert(second.items.length > 0 && second.hasMore);
  const firstTwo = [...first.items, ...second.items];
  assert.equal(new Set(firstTwo.map((item) => item.id)).size, firstTwo.length);
  await renderedTitles(firstTwo);
  await expectPosition(beforeAppend);
  interactions.push('explicit page 2 append with the same snapshot/limit and preserved scroll');

  await more.scrollIntoViewIfNeeded();
  await context.setOffline(true);
  const failed = page.waitForEvent('requestfailed', {
    predicate: (request) => storiesRequest(request.url()) && requestTuple(request.url()).page === 3,
    timeout: 15_000,
  });
  await more.click();
  offlineAttempt = (await failed).url();
  await renderedTitles(firstTwo);
  const retry = page.getByRole('button', { name: 'Tentar de novo', exact: true });
  await expect(retry).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, 'top-pagination-offline-error.png') });
  interactions.push('actual browser offline failure retains previously rendered stories and offers retry');

  await context.setOffline(false);
  const retryPosition = await scrollPosition();
  const receivedThird = responseFor('top', 3);
  await retry.click();
  const thirdResponse = await receivedThird;
  assert.deepEqual(requestTuple(thirdResponse.url()), requestTuple(offlineAttempt), 'Retry must reuse the same request parameters');
  const third = await readPage(thirdResponse, 'top', 3, first);
  assert(third.items.length > 0);
  const allTop = [...firstTwo, ...third.items];
  assert.equal(new Set(allTop.map((item) => item.id)).size, allTop.length);
  await renderedTitles(allTop);
  await expectPosition(retryPosition);
  await page.screenshot({ path: path.join(outputDir, 'top-paginated-bottom.png') });
  interactions.push('online retry of the same page/category/limit/snapshot appends only after success');

  const detailLink = page.locator('.story-row__detail').last();
  const detailPath = new URL(await detailLink.getAttribute('href'), baseURL).pathname;
  assert.match(detailPath, /^\/item\/[1-9]\d*$/);
  await detailLink.scrollIntoViewIfNeeded();
  const beforeDetail = await scrollPosition();
  const callsBeforeDetail = browserRequests.length;
  const storiesBeforeDetail = apiRequests.length;
  await detailLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(detailPath);
  await expect(page.getByRole('button', { name: /^Voltar/ })).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, 'item-placeholder.png') });
  assert(!browserRequests.slice(callsBeforeDetail).some((url) => /^\/api\/(?:item|items|comments)(?:\/|$)/.test(new URL(url).pathname)), 'Placeholder must not claim or fetch real detail/comments');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await renderedTitles(allTop);
  await expectPosition(beforeDetail);
  assert.equal(apiRequests.length, storiesBeforeDetail, 'Detail/back must preserve loaded pages without refetch');
  await page.goForward();
  await expect.poll(() => new URL(page.url()).pathname).toBe(detailPath);
  await page.getByRole('button', { name: /^Voltar/ }).click();
  await renderedTitles(allTop);
  await expectPosition(beforeDetail);
  assert.equal(apiRequests.length, storiesBeforeDetail);
  await page.screenshot({ path: path.join(outputDir, 'top-return-scroll.png') });
  interactions.push('placeholder, native Back/Forward, and Voltar retain the list buffer and scroll');

  const receivedJobs = responseFor('job', 1);
  await page.getByRole('tab', { name: 'Jobs', exact: true }).evaluate((element) => element.click());
  const jobsFirst = await readPage(await receivedJobs, 'job', 1);
  await renderedTitles(jobsFirst.items);
  const jobPages = [jobsFirst];
  let jobs = [...jobsFirst.items];
  // Official Jobs is small; this bound is a verifier guard, not an application ID cap.
  while (jobPages.at(-1).hasMore) {
    assert(jobPages.length < 10, 'Verifier expected a bounded small Jobs listing');
    const nextNumber = jobPages.at(-1).page + 1;
    const nextReceived = responseFor('job', nextNumber);
    await page.getByRole('button', { name: 'Carregar mais', exact: true }).click();
    const next = await readPage(await nextReceived, 'job', nextNumber, jobsFirst);
    jobPages.push(next);
    jobs.push(...next.items);
    await renderedTitles(jobs);
  }
  assert(jobs.every((item) => item.type === 'job'));
  const finalMore = page.getByRole('button', { name: 'Carregar mais', exact: true });
  assert((await finalMore.count()) === 0 || !(await finalMore.isEnabled()), 'Known end must not offer continuation');
  const jobDetailLink = page.locator('.story-row__detail').last();
  await jobDetailLink.scrollIntoViewIfNeeded();
  const jobsPosition = await scrollPosition();
  const jobsRequestCount = apiRequests.length;
  const jobDetailPath = new URL(await jobDetailLink.getAttribute('href'), baseURL).pathname;
  await jobDetailLink.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(jobDetailPath);
  await page.goBack();
  await renderedTitles(jobs);
  await expectPosition(jobsPosition);
  await page.goForward();
  await expect.poll(() => new URL(page.url()).pathname).toBe(jobDetailPath);
  await page.getByRole('button', { name: /^Voltar/ }).click();
  await expect(page.getByRole('tab', { name: 'Jobs', exact: true })).toHaveAttribute('aria-selected', 'true');
  assert.equal(new URL(page.url()).searchParams.get('category'), 'job');
  await renderedTitles(jobs);
  await expectPosition(jobsPosition);
  assert.equal(apiRequests.length, jobsRequestCount, 'Non-Top Forward/Voltar must retain category and loaded pages without refetch');
  await page.screenshot({ path: path.join(outputDir, 'jobs-forward-return-scroll.png') });
  interactions.push('non-Top Jobs Back/Forward/Voltar preserves category, pages, and scroll without refetch');

  await page.setViewportSize({ width: 320, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('tab', { name: 'Jobs', exact: true }).scrollIntoViewIfNeeded();
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(width.viewport, 320);
  assert(width.document <= width.viewport);
  await page.screenshot({ path: path.join(outputDir, 'jobs-paginated-mobile-320.png') });
  interactions.push('real Jobs pages reach BFF hasMore:false and remain within a 320px document');

  const routeErrorScreens = [];
  for (const invalidPath of ['/not-a-page', '/item/not-an-id', '/item/9007199254740992']) {
    const invalidNavigation = await page.goto(`${baseURL}${invalidPath}`, { waitUntil: 'domcontentloaded' });
    assert.equal(invalidNavigation?.status(), 200, 'The SPA must receive the unknown path');
    await expect(page.getByRole('heading', { name: 'Página não encontrada', exact: true })).toBeVisible();
    await expect(page.locator('.route-error__panel[role="alert"]')).toBeVisible();
    const routeWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    assert(routeWidth.document <= routeWidth.viewport);
    const screenshot = `route-error-${routeErrorScreens.length + 1}-320.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot) });
    routeErrorScreens.push({ path: invalidPath, screenshot, width: routeWidth });
    await page.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(page.getByRole('heading', { name: 'Top', exact: true, level: 1 })).toBeVisible();
    await expect(page.locator('.story-row').first()).toBeVisible({ timeout: 60_000 });
  }
  assert(!browserRequests.some((url) => /^\/api\/(?:item|items|comments)(?:\/|$)/.test(new URL(url).pathname)), 'Route errors and placeholders must not fetch real detail/comments');
  interactions.push('unknown path, malformed item ID and unsafe integer show accessible route errors and return to the actual Top listing');

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(httpErrors, []);
  assert.equal(failedRequests.length, 1, 'Only the deliberately offline continuation may fail');
  assert.equal(failedRequests[0].url, offlineAttempt);
  const unexpectedConsole = consoleErrors.filter((entry) => !(entry.location.url === offlineAttempt && /ERR_INTERNET_DISCONNECTED/.test(entry.text)));
  assert.deepEqual(unexpectedConsole, []);
  assert(browserRequests.every((url) => new URL(url).origin === origin), 'Browser requests must stay in the app/BFF origin');
  result = {
    status: 'passed', checkedAt: new Date().toISOString(), node: process.version, baseURL,
    topPages: [first, second, third].map((entry) => ({ page: entry.page, rows: entry.items.length, snapshot: entry.snapshot, cachedAt: entry.cachedAt, hasMore: entry.hasMore })),
    topRenderedRows: allTop.length, jobsPages: jobPages.map((entry) => ({ page: entry.page, rows: entry.items.length, hasMore: entry.hasMore })),
    jobsRenderedRows: jobs.length, width, beforeAppend, retryPosition, beforeDetail,
    interactions, apiRequests, failedRequests, consoleErrors, pageErrors, httpErrors,
    scope: 'Compiled application and live HN through the BFF; deliberately offline browser continuation/retry; pagination and detail placeholder only. Expiration recovery is a separate controlled-TTL run; real detail/comments/theme/accessibility/human acceptance are not claimed.',
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await context.setOffline(false).catch(() => {});
  await page.screenshot({ path: path.join(outputDir, 'failure.png') }).catch(() => {});
  result = { status: 'failed', checkedAt: new Date().toISOString(), node: process.version, message: error.message, interactions, apiRequests, failedRequests, consoleErrors, pageErrors, httpErrors };
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
process.exitCode = result?.status === 'passed' ? 0 : 1;
