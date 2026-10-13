import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const [root, outputDir, baseURL = 'http://127.0.0.1:3000'] = process.argv.slice(2);
assert(root && outputDir, 'Pass the project root and a new evidence directory');
const require = createRequire(path.join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = new URL(baseURL).origin;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const requests = [];
const failedRequests = [];
const consoleErrors = [];
const pageErrors = [];
const httpErrors = [];
const interactions = [];
const screenshots = [];
let result;

function endpoint(url, pathname) {
  const parsed = new URL(url);
  return parsed.origin === origin && parsed.pathname === pathname;
}
function responseFor(pathname) {
  const pending = page.waitForResponse((response) => endpoint(response.url(), pathname), { timeout: 90_000 });
  pending.catch(() => {});
  return pending;
}
async function jsonResponse(pending) {
  const response = await pending;
  assert.equal(response.status(), 200, `Expected successful ${response.url()}`);
  return { url: response.url(), body: await response.json() };
}
async function screenshot(name) {
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
  screenshots.push(name);
}
async function position() {
  return page.evaluate(() => window.scrollY);
}
function listRequestCount() {
  return requests.filter((url) => endpoint(url, '/api/stories')).length;
}
async function openDetail(link, id) {
  const itemPending = responseFor(`/api/items/${id}`);
  const commentsPending = responseFor(`/api/items/${id}/comments`);
  await link.click();
  const [item, comments] = await Promise.all([jsonResponse(itemPending), jsonResponse(commentsPending)]);
  assert.equal(new URL(comments.url).searchParams.get('depth'), '1');
  assert.equal(item.body.item.id, id);
  assert.equal(Object.hasOwn(item.body, 'childIds'), false);
  assert.equal(Object.hasOwn(item.body.item, 'childIds'), false);
  assert(Number.isFinite(Date.parse(item.body.cachedAt)));
  assert(Number.isFinite(Date.parse(comments.body.cachedAt)));
  assert.equal(typeof item.body.stale, 'boolean');
  assert.equal(typeof comments.body.stale, 'boolean');
  assert.equal(typeof comments.body.truncated, 'boolean');
  assert.equal(Object.hasOwn(comments.body, 'childIds'), false);
  return { item: item.body, comments: comments.body };
}
async function checkDetail(envelopes) {
  const { item: itemResponse, comments: commentsResponse } = envelopes;
  const item = itemResponse.item;
  await expect(page.getByRole('heading', { level: 1, name: item.title, exact: true })).toBeVisible();
  await expect(page.locator('.detail__comments')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.detail-comment')).toHaveCount(commentsResponse.nodes.length);
  await expect(page.locator('.detail__meta')).toContainText(item.author ?? 'Autor desconhecido');
  if (item.createdAt !== null) await expect(page.locator('.detail__meta time')).toHaveAttribute('datetime', item.createdAt);
  else assert.equal(await page.locator('.detail__meta time').getAttribute('datetime'), null);
  const clocks = [itemResponse.cachedAt, commentsResponse.cachedAt];
  const clock = await page.evaluate((values) => {
    const oldest = Math.min(...values.map((value) => Date.parse(value)));
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(oldest));
  }, clocks);
  await expect(page.locator('.detail__freshness')).toHaveText(`Atualizado em ${clock}`);
  assert.equal(await page.locator('.detail__stale').count(), Number(itemResponse.stale || commentsResponse.stale));
  for (const [index, node] of commentsResponse.nodes.entries()) {
    assert.equal(Object.hasOwn(node, 'childIds'), false);
    assert(node.children === null || (Array.isArray(node.children) && node.children.length === 0), 'Depth 1 must not contain descendants');
    const article = page.locator('.detail-comment').nth(index);
    await expect(article).toHaveAttribute('aria-label', `Comentário de ${node.author ?? 'Autor desconhecido'}`);
    await expect(article.locator('.detail-comment__header span')).toHaveText(node.author ?? 'Autor desconhecido');
    if (node.createdAt !== null) await expect(article.locator('time')).toHaveAttribute('datetime', node.createdAt);
    assert((await article.locator('time').innerText()).trim().length > 0);
    if (node.status === 'deleted' || node.status === 'dead') {
      await expect(article.locator('.detail-comment__marker')).toHaveText(node.status === 'deleted' ? '[removido]' : '[morto]');
      assert.equal(await article.locator('.detail-comment__body').count(), 0);
    } else if (node.text !== null) {
      const body = article.locator('.detail-comment__body');
      await expect(body).toHaveCount(1);
      const contents = await body.evaluate((element, html) => {
        const template = document.createElement('template');
        template.innerHTML = html;
        return { actual: element.textContent, expected: template.content.textContent };
      }, node.text);
      assert.equal(contents.actual, contents.expected, 'Rendered comment text must match the sanitized BFF HTML');
    }
  }
  if (commentsResponse.nodes.length === 0) await expect(page.getByText('Sem comentários ainda.', { exact: true })).toBeVisible();
  assert.equal(await page.locator('.detail script, .detail iframe, .detail object, .detail embed, .detail img').count(), 0);
  const activeAttributes = await page.locator('.detail').evaluate((detail) => [...detail.querySelectorAll('*')].flatMap((element) =>
    [...element.attributes].filter((attribute) => /^on/i.test(attribute.name)).map((attribute) => `${element.tagName}.${attribute.name}`)));
  assert.deepEqual(activeAttributes, []);
  const link = page.locator('.detail__source');
  if (item.url && item.domain) {
    await expect(link).toHaveAttribute('href', item.url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
}

page.on('request', (request) => requests.push(request.url()));
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});

try {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  const initialHealth = await health.json();
  const listPending = responseFor('/api/stories');
  await page.goto(`${origin}/?category=top`, { waitUntil: 'domcontentloaded' });
  const top = (await jsonResponse(listPending)).body;
  await expect(page.locator('.story-row')).toHaveCount(top.items.length);
  const indices = top.items.map((item, index) => ({ item, index })).reverse();
  const selected = indices.find(({ item }) => item.type === 'story' && item.commentCount >= 5);
  assert(selected, 'Live Top needs an actual discussion with comments');
  const { item: listingItem, index } = selected;
  const rowLink = page.locator('.story-row').nth(index).locator('.story-row__detail');
  await rowLink.scrollIntoViewIfNeeded();
  const previousScroll = await position();
  const listRequestsBeforeDetail = listRequestCount();
  const envelopes = await openDetail(rowLink, listingItem.id);
  assert.equal(envelopes.item.item.type, 'story');
  assert(envelopes.comments.nodes.length > 0, 'Must render actual comments, not just a title');
  await checkDetail(envelopes);
  await screenshot('story-detail-desktop.png');
  await page.locator('.detail-comment').last().scrollIntoViewIfNeeded();
  await screenshot('story-first-level-bottom.png');
  interactions.push({ action: 'read-real-story-and-first-level', id: listingItem.id, title: envelopes.item.item.title,
    nodes: envelopes.comments.nodes.map((node) => ({ id: node.id, author: node.author, createdAt: node.createdAt, status: node.status, cutoff: node.children === null })),
    cachedAt: { item: envelopes.item.cachedAt, comments: envelopes.comments.cachedAt }, stale: { item: envelopes.item.stale, comments: envelopes.comments.stale },
    truncated: envelopes.comments.truncated });

  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('.story-row')).toHaveCount(top.items.length);
  await expect.poll(async () => Math.abs((await position()) - previousScroll)).toBeLessThanOrEqual(2);
  assert.equal(listRequestCount(), listRequestsBeforeDetail);
  await screenshot('return-real-detail-list-scroll.png');
  interactions.push({ action: 'return-preserves-list', scrollY: await position(), listRequests: listRequestCount() });

  const second = await openDetail(page.locator('.story-row').nth(index).locator('.story-row__detail'), listingItem.id);
  await checkDetail(second);
  assert.equal(second.item.cachedAt, envelopes.item.cachedAt, 'Immediate revisits must preserve the cached item timestamp');
  assert.equal(second.comments.cachedAt, envelopes.comments.cachedAt, 'Immediate revisits must preserve the cached comments timestamp');
  interactions.push({ action: 'immediate-revisit-preserves-response-clocks', id: listingItem.id,
    itemCachedAt: second.item.cachedAt, commentsCachedAt: second.comments.cachedAt,
    scope: 'Checks response clocks, not instrumented upstream call counts' });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const width = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(width.viewport, 320);
  assert(width.document <= width.viewport, 'Detail must not horizontally overflow at 320px');
  await screenshot('story-detail-mobile-320.png');
  interactions.push({ action: 'mobile-detail-320', ...width });

  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  const jobsPending = responseFor('/api/stories');
  await page.getByRole('tab', { name: 'Jobs', exact: true }).click();
  const jobs = (await jsonResponse(jobsPending)).body;
  await expect(page.locator('.story-row')).toHaveCount(jobs.items.length);
  const jobIndex = jobs.items.findIndex((item) => item.type === 'job' && item.commentCount === 0);
  assert(jobIndex >= 0, 'Live Jobs needs a real comment-free job');
  const job = await openDetail(page.locator('.story-row').nth(jobIndex).locator('.story-row__detail'), jobs.items[jobIndex].id);
  assert.equal(job.item.item.type, 'job');
  assert.equal(job.comments.nodes.length, 0);
  await checkDetail(job);
  const jobWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(jobWidth <= 320);
  await screenshot('job-detail-empty-mobile-320.png');
  interactions.push({ action: 'real-job-empty-state', id: job.item.item.id, title: job.item.item.title, comments: 0, width: jobWidth });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(httpErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(requests.filter((url) => new URL(url).origin !== origin), [], 'Browser must use local BFF/assets only');
  result = { status: 'passed', checkedAt: new Date().toISOString(), runtime: process.version, initialHealth,
    scope: 'Actual production app, live BFF/HN-backed Story and Job, depth 1 only; not full tree/collapse/human acceptance',
    interactions, screenshots, requests, pageErrors, consoleErrors, httpErrors, failedRequests };
} catch (error) {
  try { await screenshot('failure.png'); } catch {}
  result = { status: 'failed', checkedAt: new Date().toISOString(), runtime: process.version, error: String(error), stack: error?.stack,
    interactions, screenshots, requests, pageErrors, consoleErrors, httpErrors, failedRequests };
} finally {
  await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}
process.exitCode = result?.status === 'passed' ? 0 : 1;
