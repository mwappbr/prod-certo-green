import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [rootArg, evidenceArg, ...extraArgs] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extraArgs.length > 0) {
  console.error('Usage: node drive-fixture-app.mjs <rootPath> <evidenceDir>');
  process.exitCode = 64;
} else {
  const rootPath = path.resolve(rootArg);
  const evidenceDir = path.resolve(evidenceArg);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const resultPath = path.join(evidenceDir, 'actual-result.json');
  const screenshotDir = path.join(evidenceDir, 'screenshots');
  const pageErrors = [];
  const consoleErrors = [];
  const unexpectedHttp = [];
  const failedRequests = [];
  const unexpectedPopups = [];
  const origins = new Set();
  const bffCounts = new Map();
  const result = {
    protocolVersion: 1,
    status: 'running',
    startedAt: new Date().toISOString(),
    helperPid: process.pid,
    runtime: { node: process.version },
    screenshots: [],
    phases: {},
    errors: { page: pageErrors, console: consoleErrors, http: unexpectedHttp, requests: failedRequests, popups: unexpectedPopups },
  };
  let browser;
  let page;
  let operation;
  let ready;
  let baseOrigin = null;
  let expectedBffPaths = new Set();

  function isSameOrInside(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  }

  const evidenceIsSafe = !isSameOrInside(evidenceDir, scriptDir) && !isSameOrInside(evidenceDir, rootPath);

  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function bounded(promise, timeoutMs, message) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function waitForReady() {
    const readyPath = path.join(evidenceDir, 'fixture-ready.json');
    const failurePath = path.join(evidenceDir, 'fixture-failure.json');
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const failure = JSON.parse(await readFile(failurePath, 'utf8'));
        throw new Error(`Fixture helper failed: ${failure.message ?? 'no failure detail'}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Fixture helper failed:')) throw error;
      }
      try {
        const value = JSON.parse(await readFile(readyPath, 'utf8'));
        if (value.status === 'ready') return value;
      } catch {}
      await delay(100);
    }
    throw new Error('Fixture readiness file did not appear within 10 seconds.');
  }

  async function readCounters(ids) {
    const url = new URL(ready.countersUrl);
    url.searchParams.set('ids', ids.join(','));
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, 'counter route must respond successfully');
    return response.json();
  }

  function bffSnapshot() { return Object.fromEntries([...bffCounts.entries()].sort(([a], [b]) => a.localeCompare(b))); }
  function bffCount(pathname) {
    return [...bffCounts.entries()]
      .filter(([key]) => key.split('?')[0] === `GET ${pathname}`)
      .reduce((total, [, count]) => total + count, 0);
  }

  function waitForResponse(pathname, queryTest = () => true) {
    return page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === baseOrigin && url.pathname === pathname && response.request().method() === 'GET' && queryTest(url);
    }, { timeout: 10_000 });
  }

  async function responseJson(response, label) {
    assert.equal(response.status(), 200, `${label} must return HTTP 200`);
    return response.json();
  }

  async function screenshot(name, theme, fullPage = false) {
    const filePath = path.join(screenshotDir, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage, animations: 'disabled' });
    result.screenshots.push({ name, path: filePath, viewport: page.viewportSize(), theme, fullPage });
  }

  function expectedTreeChecks(nodes, expectedIds, visibleIds, ready, level = 1) {
    assert.deepEqual(nodes.map((node) => node.id), expectedIds, `source order at level ${level}`);
    for (const node of nodes) {
      assert.equal(Object.hasOwn(node, 'kids'), false, `comment ${node.id} must not expose kids`);
      assert.equal(Object.hasOwn(node, 'childIds'), false, `comment ${node.id} must not expose childIds`);
      const marker = node.id === ready.markerIds.deadId ? 'dead' : node.id === ready.markerIds.deletedId ? 'deleted' : 'ok';
      assert.equal(node.status, marker, `status for comment ${node.id}`);
      const rawKids = ready.expectedChildrenById[String(node.id)] ?? [];
      const expectedChildren = rawKids.filter((id) => visibleIds.has(id));
      if (level >= 8 && rawKids.length > 0) {
        assert.equal(node.children, null, `depth-capped comment ${node.id} should have null children`);
      } else {
        assert.ok(Array.isArray(node.children), `comment ${node.id} should have a confirmed child array`);
        assert.deepEqual(node.children.map((child) => child.id), expectedChildren, `direct child order for ${node.id}`);
        expectedTreeChecks(node.children, expectedChildren, visibleIds, ready, level + 1);
      }
      if (marker === 'ok') assert.equal(typeof node.text, 'string');
      else assert.equal(node.text, null);
      assert.ok(node.author, `comment ${node.id} should retain its author`);
      assert.ok(node.createdAt && !Number.isNaN(Date.parse(node.createdAt)), `comment ${node.id} should retain a valid date`);
    }
  }

  function flatten(nodes) { return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]); }

  async function domTree() {
    return page.locator('ol.detail-comment-list').evaluate((root) => {
      const visible = (element) => Boolean(element && element.getClientRects().length > 0 &&
        getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
      const parseLi = (li) => {
        const article = li.querySelector(':scope > article.detail-comment');
        const header = article?.querySelector(':scope > header.detail-comment__header');
        const body = article?.querySelector('.detail-comment__body');
        const toggle = header?.querySelector('button.detail-comment__toggle');
        const childList = li.querySelector(':scope > ol.detail-comment-tree');
        return {
          id: Number(article?.getAttribute('data-comment-id')),
          level: Number(li.getAttribute('data-comment-level')),
          offset: Number(article?.getAttribute('data-comment-offset')),
          margin: article?.style.marginInlineStart ?? '',
          articleVisible: visible(article),
          headerVisible: visible(header),
          author: header?.querySelector(':scope > span')?.textContent?.trim() ?? null,
          dateTime: header?.querySelector('time')?.getAttribute('datetime') ?? null,
          dateText: header?.querySelector('time')?.textContent?.trim() ?? '',
          marker: article?.querySelector('.detail-comment__marker')?.textContent?.trim() ?? null,
          bodyText: body?.textContent?.trim() ?? null,
          bodyVisible: visible(body),
          collapsedCount: article?.querySelector('.detail-comment__collapsed-count')?.textContent?.trim() ?? null,
          continuation: article?.querySelector('.detail-comment__continuation')?.textContent?.trim() ?? null,
          expanded: toggle?.getAttribute('aria-expanded') ?? null,
          children: childList ? [...childList.children].filter((node) => node.matches('li[data-comment-level]')).map(parseLi) : [],
        };
      };
      return [...root.querySelectorAll(':scope > li[data-comment-level]')].map(parseLi);
    });
  }

  function verifyDomMatchesWire(domNodes, apiNodes, level = 1) {
    assert.equal(domNodes.length, apiNodes.length, `visible DOM node count at level ${level}`);
    for (let index = 0; index < apiNodes.length; index += 1) {
      const dom = domNodes[index];
      const api = apiNodes[index];
      const offset = Math.min(Math.max(level - 1, 0), 3) * 16;
      assert.equal(dom.id, api.id);
      assert.equal(dom.level, level, `data-comment-level for ${api.id}`);
      assert.equal(dom.offset, offset, `data-comment-offset for ${api.id}`);
      assert.equal(dom.margin, `${offset}px`, `inline margin for ${api.id}`);
      assert.ok(dom.articleVisible && dom.headerVisible, `comment ${api.id} should be visible`);
      assert.equal(dom.author, api.author);
      assert.equal(dom.dateTime, api.createdAt);
      assert.ok(dom.dateText.length > 0, `comment ${api.id} should show relative date text`);
      if (api.status === 'ok') {
        assert.equal(dom.bodyText, `fixture-comment-${api.id}-body`);
        assert.ok(dom.bodyVisible, `comment body ${api.id} should be visible`);
        assert.equal(dom.marker, null);
      } else {
        const marker = api.status === 'dead' ? '[morto]' : '[removido]';
        assert.equal(api.text, null);
        assert.equal(dom.marker, marker);
        assert.equal(dom.bodyText, null, `private source body must not render for ${api.id}`);
        assert.equal(dom.bodyVisible, false);
      }
      if (api.children === null) {
        assert.equal(dom.continuation, 'Continuação não carregada.');
        assert.equal(dom.expanded, null, `depth cutoff ${api.id} must not promise expansion`);
        assert.equal(dom.children.length, 0);
      } else {
        assert.equal(dom.continuation, null);
        verifyDomMatchesWire(dom.children, api.children, level + 1);
      }
    }
  }

  async function exercise(expect) {
    const { chromium } = requireFromRoot('@playwright/test');
    const launchAt = Date.now();
    browser = await chromium.launch({ headless: true, timeout: 10_000 });
    result.runtime.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    page = await context.newPage();
    page.setDefaultTimeout(8_000);
    page.setDefaultNavigationTimeout(10_000);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
      if (url.origin === baseOrigin && url.pathname.startsWith('/api/')) {
        const key = `${request.method()} ${url.pathname}${url.search}`;
        bffCounts.set(key, (bffCounts.get(key) ?? 0) + 1);
        if (!expectedBffPaths.has(url.pathname)) result.errors.unexpectedBff ??= [], result.errors.unexpectedBff.push(key);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === baseOrigin && response.status() >= 400) {
        unexpectedHttp.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (url.origin === baseOrigin) failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'failed' });
    });
    page.on('popup', (popup) => {
      unexpectedPopups.push(popup.url());
      void popup.close().catch(() => {});
    });

    const topListWait = waitForResponse('/api/stories', (url) => url.searchParams.get('category') === 'top');
    await page.goto(ready.baseUrl, { waitUntil: 'domcontentloaded' });
    const topListResponse = await topListWait;
    const topList = await responseJson(topListResponse, 'top stories list');
    assert.deepEqual(topList.items.map((item) => item.id), [ready.storyId]);
    assert.equal(topList.items[0].title, ready.rawMeta.storyTitle);
    await expect(page.locator(`a.story-row__detail[href="/item/${ready.storyId}"]`)).toBeVisible();
    result.phases.initialListing = { responseUrl: topListResponse.url(), itemIds: topList.items.map((item) => item.id), bff: bffSnapshot() };

    const itemWait = waitForResponse(`/api/items/${ready.storyId}`);
    const commentsWait = waitForResponse(`/api/items/${ready.storyId}/comments`);
    await page.locator(`a.story-row__detail[href="/item/${ready.storyId}"]`).click();
    const [itemResponse, commentsResponse] = await Promise.all([itemWait, commentsWait]);
    const itemJson = await responseJson(itemResponse, 'fixture story item');
    const commentsJson = await responseJson(commentsResponse, 'fixture comments tree');
    assert.equal(new URL(commentsResponse.url()).searchParams.has('depth'), false, 'UI should omit depth and use configured default');
    assert.equal(itemJson.item.id, ready.storyId);
    assert.equal(itemJson.item.type, 'story');
    assert.equal(itemJson.item.title, ready.rawMeta.storyTitle);
    assert.equal(itemJson.item.score, 33);
    assert.equal(itemJson.item.commentCount, 221);
    assert.equal(itemJson.stale, false);
    assert.ok(itemJson.cachedAt && !Number.isNaN(Date.parse(itemJson.cachedAt)));
    assert.equal(commentsJson.stale, false);
    assert.equal(commentsJson.truncated, false, 'depth-only cutoff must not claim node-budget truncation');
    assert.ok(commentsJson.cachedAt && !Number.isNaN(Date.parse(commentsJson.cachedAt)));
    for (const key of ['kids', 'childIds', 'text', 'bodyHtml']) assert.equal(Object.hasOwn(itemJson.item, key), false, `public item must omit ${key}`);
    const visibleIds = new Set(ready.expectedIds.visibleCommentIds);
    expectedTreeChecks(commentsJson.nodes, ready.setupIds.rootChildIds, visibleIds, ready);
    const wireNodes = flatten(commentsJson.nodes);
    assert.equal(wireNodes.length, 220);
    assert.equal(new Set(wireNodes.map((node) => node.id)).size, 220);
    assert.deepEqual([...wireNodes.map((node) => node.id)].sort((a, b) => a - b), [...visibleIds].sort((a, b) => a - b));
    assert.equal(wireNodes.some((node) => node.id === ready.expectedIds.depthNineId), false);
    for (const marker of Object.values(ready.rawMeta.markerItems)) {
      const node = wireNodes.find((entry) => entry.id === marker.id);
      assert.ok(node);
      assert.equal(node.text, null);
      assert.equal(JSON.stringify(commentsJson).includes(marker.rawText), false, `raw marker body ${marker.id} must not reach the envelope`);
      assert.deepEqual(node.children.map((child) => child.id), marker.kids);
    }
    const hiddenDepthNode = wireNodes.find((node) => node.id === ready.expectedIds.visibleCommentIds[7]);
    assert.equal(hiddenDepthNode?.children, null);
    result.wire = {
      item: itemJson,
      comments: { cachedAt: commentsJson.cachedAt, stale: commentsJson.stale, truncated: commentsJson.truncated, nodeCount: wireNodes.length, preorderIds: wireNodes.map((node) => node.id), tree: commentsJson.nodes },
    };
    await expect(page.locator('article[data-comment-id]')).toHaveCount(220, { timeout: 12_000 });
    await expect(page.locator('main.detail')).toBeVisible();
    await expect(page.locator('.detail__freshness')).toContainText('Atualizado em');
    await expect(page.locator('.detail__stale')).toHaveCount(0);
    const dom = await domTree();
    assert.equal(flatten(dom).length, 220);
    verifyDomMatchesWire(dom, commentsJson.nodes);
    const depthNineId = ready.expectedIds.depthNineId;
    await expect(page.locator(`article[data-comment-id="${depthNineId}"]`)).toHaveCount(0);
    const deepestVisibleId = ready.expectedIds.visibleCommentIds[7];
    const deepestArticle = page.locator(`article[data-comment-id="${deepestVisibleId}"]`);
    await expect(deepestArticle.locator('.detail-comment__continuation')).toHaveText('Continuação não carregada.');
    await expect(deepestArticle.locator('button')).toHaveCount(0);
    await screenshot('tree-desktop-top', 'light', false);
    await deepestArticle.scrollIntoViewIfNeeded();
    await page.locator('html').evaluate((element) => element.setAttribute('data-theme', 'dark'));
    result.phases.forcedPaletteCapture = {
      theme: 'dark',
      mechanism: 'manual root data-theme attribute for visual inspection',
      doesNotProveThemeToggleOrPersistence: true,
    };
    await screenshot('tree-depth8-dark', 'dark', false);
    await page.locator('html').evaluate((element) => element.removeAttribute('data-theme'));
    await page.evaluate(() => window.scrollTo(0, 0));
    result.phases.coldStoryDetail = {
      itemResponseUrl: itemResponse.url(),
      commentsResponseUrl: commentsResponse.url(),
      browserBff: bffSnapshot(),
      domCount: flatten(dom).length,
      depthQueryOmitted: true,
      freshness: { itemCachedAt: itemJson.cachedAt, commentsCachedAt: commentsJson.cachedAt, itemStale: itemJson.stale, commentsStale: commentsJson.stale },
    };

    const cacheStart = Date.now();
    const idsForCounters = [ready.storyId, ...ready.expectedIds.allCommentIds, ready.jobId];
    const coldStats = await readCounters(idsForCounters);
    function assertColdStats(stats) {
      assert.equal(stats.itemRequests[String(ready.storyId)], 1, 'root item fetch count');
      assert.equal(stats.itemRequests[String(ready.jobId)], 0, 'job must not be fetched before Jobs is opened');
      for (const id of ready.expectedIds.allCommentIds) {
        assert.equal(stats.itemRequests[String(id)], visibleIds.has(id) ? 1 : 0, `HN fetch count for ${id}`);
      }
      assert.equal(stats.listRequests.top, 1);
      for (const category of ['new', 'best', 'ask', 'show', 'job']) assert.equal(stats.listRequests[category], 0);
      assert.deepEqual(stats.unexpectedUpstreamPaths, []);
    }
    assertColdStats(coldStats);
    result.phases.coldHnStats = coldStats;

    const markerDeadId = ready.markerIds.deadId;
    const markerDeletedId = ready.markerIds.deletedId;
    const beforeInteractionsBff = bffSnapshot();
    const beforeInteractionsHn = await readCounters(idsForCounters);
    for (const [id, label, childId] of [
      [markerDeadId, '[morto]', ready.rawMeta.markerItems.dead.kids[0]],
      [markerDeletedId, '[removido]', ready.rawMeta.markerItems.deleted.kids[0]],
    ]) {
      const article = page.locator(`article[data-comment-id="${id}"]`);
      await expect(article.locator('.detail-comment__marker')).toHaveText(label);
      await expect(article.locator('.detail-comment__body')).toHaveCount(0);
      await expect(page.locator(`article[data-comment-id="${childId}"]`)).toBeVisible();
      await article.getByRole('button').click();
      await expect(article.locator('.detail-comment__marker')).toHaveText(label);
      await expect(article.locator('.detail-comment__body')).toHaveCount(0);
      await expect(article.locator('.detail-comment__collapsed-count')).toBeVisible();
      await expect(page.locator(`article[data-comment-id="${childId}"]`)).toHaveCount(0);
      if (id === markerDeadId) await screenshot('collapsed-marker', 'light', false);
      await article.getByRole('button').click();
      await expect(page.locator(`article[data-comment-id="${childId}"]`)).toBeVisible();
    }

    const parentId = ready.rawMeta.chainIds[3];
    const childId = ready.rawMeta.chainIds[4];
    const grandchildId = ready.rawMeta.chainIds[5];
    const parentArticle = page.locator(`article[data-comment-id="${parentId}"]`);
    const childArticle = page.locator(`article[data-comment-id="${childId}"]`);
    const parentToggle = parentArticle.getByRole('button');
    const childToggle = childArticle.getByRole('button');
    await childToggle.click();
    await expect(childToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(childArticle.locator('.detail-comment__header')).toBeVisible();
    await expect(childArticle.locator('.detail-comment__body')).toHaveCount(0);
    await expect(childArticle.locator('.detail-comment__collapsed-count')).toBeVisible();
    await expect(page.locator(`article[data-comment-id="${grandchildId}"]`)).toHaveCount(0);
    await parentToggle.click();
    await expect(parentToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(parentArticle.locator('.detail-comment__body')).toHaveCount(0);
    await expect(parentArticle.locator('.detail-comment__header')).toBeVisible();
    await expect(childArticle).toHaveCount(0);
    await screenshot('nested-collapsed', 'light', false);
    await parentToggle.click();
    await expect(parentToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(childArticle).toBeVisible();
    await expect(childToggle, 'child collapse state should survive parent collapse').toHaveAttribute('aria-expanded', 'false');
    await expect(childArticle.locator('.detail-comment__body')).toHaveCount(0);
    await expect(page.locator(`article[data-comment-id="${grandchildId}"]`)).toHaveCount(0);
    await childToggle.click();
    await expect(childToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(childArticle.locator('.detail-comment__body')).toBeVisible();
    await expect(page.locator(`article[data-comment-id="${grandchildId}"]`)).toBeVisible();
    await parentToggle.press('Enter');
    await expect(parentToggle).toHaveAttribute('aria-expanded', 'false');
    await parentToggle.press('Space');
    await expect(parentToggle).toHaveAttribute('aria-expanded', 'true');
    await parentToggle.press('Enter');
    await expect(parentToggle).toHaveAttribute('aria-expanded', 'false');
    assert.deepEqual(bffSnapshot(), beforeInteractionsBff, 'collapse/keyboard actions must not issue BFF requests');
    assert.deepEqual(await readCounters(idsForCounters), beforeInteractionsHn, 'collapse/keyboard actions must not issue HN fetches');
    result.phases.collapseInteraction = { browserBffBefore: beforeInteractionsBff, browserBffAfter: bffSnapshot(), hnBefore: beforeInteractionsHn, hnAfter: await readCounters(idsForCounters), keyboard: ['Enter', 'Space'] };

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page).toHaveURL(`${ready.baseUrl}/`);
    const storyLink = page.locator(`a.story-row__detail[href="/item/${ready.storyId}"]`);
    await expect(storyLink).toBeVisible();
    assert.equal(bffCount('/api/stories'), 1, 'SPA back should preserve list data without a new listing request');
    await screenshot('spa-return-list', 'light', false);

    const revisitItemWait = waitForResponse(`/api/items/${ready.storyId}`);
    const revisitCommentsWait = waitForResponse(`/api/items/${ready.storyId}/comments`);
    await storyLink.click();
    const [revisitItemResponse, revisitCommentsResponse] = await Promise.all([revisitItemWait, revisitCommentsWait]);
    const revisitItemJson = await responseJson(revisitItemResponse, 'revisited story item');
    const revisitCommentsJson = await responseJson(revisitCommentsResponse, 'revisited comments tree');
    await expect(page.locator(`article[data-comment-id="${parentId}"] button`), 'collapse preference should survive SPA return').toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`article[data-comment-id="${parentId}"] .detail-comment__body`)).toHaveCount(0);
    assert.ok(Date.now() - cacheStart < Math.min(ready.rawMeta.cacheTtlsMs.item, ready.rawMeta.cacheTtlsMs.list), 'revisit should remain inside configured cache TTLs');
    const revisitStats = await readCounters(idsForCounters);
    assert.deepEqual(revisitStats, coldStats, 'revisit BFF requests may repeat but HN item/list counters must stay unchanged within TTL');
    result.phases.spaRevisit = {
      browserBff: bffSnapshot(),
      itemCachedAt: revisitItemJson.cachedAt,
      commentsCachedAt: revisitCommentsJson.cachedAt,
      hnStats: revisitStats,
      collapsedParentId: parentId,
      collapsedStatePreserved: true,
    };

    const beforeReloadBff = bffSnapshot();
    const reloadStoryWait = waitForResponse('/api/stories', (url) => url.searchParams.get('category') === 'top');
    const reloadItemWait = waitForResponse(`/api/items/${ready.storyId}`);
    const reloadCommentsWait = waitForResponse(`/api/items/${ready.storyId}/comments`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const [reloadListResponse, reloadItemResponse, reloadCommentsResponse] = await Promise.all([reloadStoryWait, reloadItemWait, reloadCommentsWait]);
    const reloadItemJson = await responseJson(reloadItemResponse, 'reloaded story item');
    const reloadCommentsJson = await responseJson(reloadCommentsResponse, 'reloaded comments tree');
    await expect(page.locator('article[data-comment-id]')).toHaveCount(220, { timeout: 12_000 });
    await expect(page.locator(`article[data-comment-id="${parentId}"] button`), 'full reload should reset local collapse state').toHaveAttribute('aria-expanded', 'true');
    assert.equal(new URL(reloadCommentsResponse.url()).searchParams.has('depth'), false);
    assert.ok(Date.now() - cacheStart < Math.min(ready.rawMeta.cacheTtlsMs.item, ready.rawMeta.cacheTtlsMs.list), 'reload should remain inside configured cache TTLs');
    const reloadStats = await readCounters(idsForCounters);
    assert.deepEqual(reloadStats, coldStats, 'reload within TTL should not add HN item or list fetches');
    assert.equal(reloadListResponse.status(), 200);
    assert.equal(reloadItemJson.cachedAt, itemJson.cachedAt);
    assert.equal(reloadCommentsJson.cachedAt, commentsJson.cachedAt);
    const reloadedDom = await domTree();
    assert.equal(flatten(reloadedDom).length, 220);
    verifyDomMatchesWire(reloadedDom, reloadCommentsJson.nodes);
    await page.setViewportSize({ width: 320, height: 800 });
    const mobileWidths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.equal(mobileWidths.viewport, 320);
    assert.ok(mobileWidths.document <= 320 && mobileWidths.body <= 320, `horizontal overflow at 320px: ${JSON.stringify(mobileWidths)}`);
    await expect(page.locator('article[data-comment-id]')).toHaveCount(220);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot('tree-mobile320', 'light', false);
    result.phases.reloadAndMobile = {
      browserBffBefore: beforeReloadBff,
      browserBffAfter: bffSnapshot(),
      hnStats: reloadStats,
      domCount: flatten(reloadedDom).length,
      mobileWidths,
      allCommentsOpenAfterReload: true,
      freshness: { itemCachedAt: reloadItemJson.cachedAt, commentsCachedAt: reloadCommentsJson.cachedAt },
    };

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page).toHaveURL(`${ready.baseUrl}/`);
    const jobsWait = waitForResponse('/api/stories', (url) => url.searchParams.get('category') === 'job');
    await page.getByRole('tab', { name: 'Jobs' }).click();
    const jobsResponse = await jobsWait;
    const jobsJson = await responseJson(jobsResponse, 'jobs list');
    assert.deepEqual(jobsJson.items.map((item) => item.id), [ready.jobId]);
    const jobLink = page.locator(`a.story-row__detail[href="/item/${ready.jobId}"]`);
    await expect(jobLink).toBeVisible();
    const jobItemWait = waitForResponse(`/api/items/${ready.jobId}`);
    const jobCommentsWait = waitForResponse(`/api/items/${ready.jobId}/comments`);
    await jobLink.click();
    const [jobItemResponse, jobCommentsResponse] = await Promise.all([jobItemWait, jobCommentsWait]);
    const jobItemJson = await responseJson(jobItemResponse, 'synthetic fixture job');
    const jobCommentsJson = await responseJson(jobCommentsResponse, 'synthetic job comments');
    assert.equal(jobItemJson.item.type, 'job');
    assert.equal(jobItemJson.item.score, null);
    assert.equal(jobItemJson.item.url, ready.rawMeta.job.url);
    assert.equal(jobItemJson.item.title, ready.rawMeta.job.title);
    assert.equal(jobCommentsJson.nodes.length, 0);
    assert.equal(jobCommentsJson.truncated, false);
    await expect(page.locator('.detail__eyebrow')).toHaveText('Vaga');
    await expect(page.getByRole('heading', { name: ready.rawMeta.job.title })).toBeVisible();
    await expect(page.locator('.detail__meta')).toContainText('Pontuação indisponível');
    await expect(page.locator('.detail__empty')).toHaveText('Sem comentários ainda.');
    await expect(page.locator('a.detail__source[href="https://example.invalid/verification-only"]')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    const jobWidths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.ok(jobWidths.viewport === 320 && jobWidths.document <= 320 && jobWidths.body <= 320, `job horizontal overflow at 320px: ${JSON.stringify(jobWidths)}`);
    await screenshot('job-empty320', 'light', false);
    const finalStats = await readCounters(idsForCounters);
    for (const id of [ready.storyId, ...ready.expectedIds.allCommentIds]) {
      assert.equal(finalStats.itemRequests[String(id)], coldStats.itemRequests[String(id)], `story/comment fetch count changed for ${id}`);
    }
    assert.equal(finalStats.itemRequests[String(ready.jobId)], 1);
    assert.equal(finalStats.listRequests.job, 1);
    assert.deepEqual(finalStats.unexpectedUpstreamPaths, []);
    result.wire.job = { item: jobItemJson, comments: jobCommentsJson };
    result.phases.jobDetail = { browserBff: bffSnapshot(), hnStats: finalStats, jobWidths };
    result.runtime.elapsedMs = Date.now() - launchAt;

    assert.deepEqual(pageErrors, [], 'no page errors');
    assert.deepEqual(consoleErrors, [], 'no console errors');
    assert.deepEqual(unexpectedHttp, [], 'no unexpected same-origin HTTP errors');
    assert.deepEqual(failedRequests, [], 'no failed same-origin requests');
    assert.deepEqual(unexpectedPopups, [], 'no popups or external links opened');
    assert.deepEqual(result.errors.unexpectedBff ?? [], [], 'no unexpected BFF routes');
    assert.deepEqual([...origins], [baseOrigin], 'browser should remain on the local fixture origin');
  }

  let requireFromRoot;
  try {
    if (!evidenceIsSafe) {
      throw new Error('evidenceDir must be separate from helper scripts and source root.');
    }
    await mkdir(screenshotDir, { recursive: true });
    ready = await waitForReady();
    if (!ready.baseUrl?.startsWith('http://127.0.0.1:') || ready.status !== 'ready') throw new Error('Invalid loopback fixture readiness record.');
    baseOrigin = new URL(ready.baseUrl).origin;
    expectedBffPaths = new Set(['/api/stories', `/api/items/${ready.storyId}`, `/api/items/${ready.storyId}/comments`, `/api/items/${ready.jobId}`, `/api/items/${ready.jobId}/comments`]);
    result.fixture = {
      baseUrl: ready.baseUrl,
      helperPid: ready.helperPid,
      storyId: ready.storyId,
      jobId: ready.jobId,
      markerIds: ready.markerIds,
      visibleCommentCount: ready.expectedIds.visibleCommentCount,
      totalCommentCount: ready.expectedIds.allCommentCount,
      readyAt: ready.readyAt,
    };
    requireFromRoot = createRequire(path.join(rootPath, 'package.json'));
    const { expect: baseExpect } = requireFromRoot('@playwright/test');
    const expect = baseExpect.configure({ timeout: 10_000 });
    operation = exercise(expect);
    operation.catch(() => {});
    await bounded(operation, 90_000, 'Browser QA exceeded its 90-second deadline.');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
    process.exitCode = 1;
  } finally {
    if (browser) {
      try { await bounded(browser.close(), 5_000, 'Chromium close timed out.'); }
      catch (error) { result.cleanupError = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
    }
    if (operation) {
      try { await bounded(operation.catch(() => {}), 3_000, 'Browser operation did not drain after close.'); }
      catch (error) { result.cleanupError ??= error instanceof Error ? error.message : String(error); process.exitCode = 1; }
    }
    result.finishedAt = new Date().toISOString();
    result.origins = [...origins].sort();
    result.bffRequestCounts = bffSnapshot();
    result.errors = { ...result.errors, page: pageErrors, console: consoleErrors, http: unexpectedHttp, requests: failedRequests, popups: unexpectedPopups };
    if (evidenceIsSafe) {
      try { await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); }
      catch (error) { console.error(`Could not write result JSON: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    } else {
      console.error('Skipped result JSON because evidenceDir is inside a protected path.');
    }
  }
  console.log(JSON.stringify({ status: result.status, resultPath, screenshots: result.screenshots.length, failure: result.failure?.message ?? null }));
}
