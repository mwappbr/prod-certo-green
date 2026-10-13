#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const QA_ROOT = '/tmp/hn-final-platform-qa-20261012-f62d9b';
const CATEGORY_LABELS = [
  ['top', 'Top'],
  ['new', 'New'],
  ['best', 'Best'],
  ['ask', 'Ask'],
  ['show', 'Show'],
  ['job', 'Jobs'],
];
const MAX_RUN_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--root', '--base-url', '--evidence-dir'].includes(key)) {
      throw new Error(`Unknown or incomplete argument: ${key ?? '(missing)'}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${key}.`);
    parsed[key.slice(2)] = value;
    index += 1;
  }
  for (const key of ['root', 'base-url', 'evidence-dir']) {
    if (!parsed[key]) throw new Error(`Required argument missing: --${key}`);
  }
  return parsed;
}

function assertRuntime() {
  if (process.versions.node.split('.')[0] !== '24') {
    throw new Error(`Run this driver with Node 24.x; current runtime is ${process.version}.`);
  }
}

function assertLoopbackBaseUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:') throw new Error('Only a local HTTP base URL is allowed.');
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error('The browser driver accepts only loopback hosts; refusing remote application URLs.');
  }
  if (!url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('Pass a loopback base URL with an explicit port and no credentials/query/hash.');
  }
  if (url.port === '3333') throw new Error('Port 3333 is reserved and cannot be used by this QA run.');
  return url.origin;
}

function assertFreshEvidenceDirectory(root, evidenceArg) {
  const requestedRoot = path.resolve(root);
  const realRoot = fs.realpathSync(requestedRoot);
  if (requestedRoot !== realRoot) throw new Error('Repository root must not resolve through a symlink.');
  const evidence = path.resolve(evidenceArg);
  const qaRuns = path.resolve(QA_ROOT, 'runs');
  const relativeEvidence = path.relative(qaRuns, evidence);
  if (!relativeEvidence || relativeEvidence.startsWith(`..${path.sep}`) || relativeEvidence === '..' || path.isAbsolute(relativeEvidence) || relativeEvidence.split(path.sep).length > 2) {
    throw new Error(`Evidence output must be a fresh run directory or its browser child below ${qaRuns}.`);
  }
  if (fs.realpathSync(evidence) !== path.resolve(fs.realpathSync(qaRuns), relativeEvidence)) throw new Error('Run directories below the canonical evidence parent must not resolve through symlinks.');
  const stat = fs.lstatSync(evidence);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Evidence path must be a real directory.');
  if (fs.readdirSync(evidence).length !== 0) throw new Error('Evidence directory must be new and empty; refusing to overwrite.');
  return { root: realRoot, evidence };
}

function withDeadline(promise, label, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fetchResponse(url, stage, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${stage} timed out.`)), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'error' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, stage) {
  const response = await fetchResponse(url, stage);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Keep only a short response preview in an error, never dump arbitrary payloads.
  }
  if (!response.ok) {
    throw new Error(`${stage} returned HTTP ${response.status}: ${String(text).slice(0, 240)}`);
  }
  if (json === null || typeof json !== 'object') throw new Error(`${stage} returned non-JSON data.`);
  return { response, json };
}

function summarizeError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function flattenComments(nodes) {
  const entries = [];
  let maxDepth = 0;
  const visit = (nodeList, depth) => {
    for (const node of nodeList) {
      entries.push({ id: node.id, depth });
      maxDepth = Math.max(maxDepth, depth);
      if (Array.isArray(node.children)) visit(node.children, depth + 1);
    }
  };
  visit(Array.isArray(nodes) ? nodes : [], 1);
  return { entries, maxDepth };
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
}

async function runSmoke({ root, baseUrl, evidence }) {
  const origin = assertLoopbackBaseUrl(baseUrl);
  const repoRequire = createRequire(path.join(root, 'package.json'));
  const { chromium } = repoRequire('playwright');
  const { expect } = repoRequire('@playwright/test');
  const summary = {
    startedAt: new Date().toISOString(),
    node: process.version,
    root,
    baseUrl: origin,
    appMode: 'compiled-server-required; no page.route or API interception',
    browserNetwork: { api: [], failures: [], nonLocalRequests: [] },
    consoleErrors: [],
    pageErrors: [],
    screenshots: [],
    categories: [],
    limitations: [],
    status: 'running',
  };
  let browser;
  let page;
  let currentStep = 'runtime-preflight';
  const browserResponseBodyTasks = [];
  const observedItemResponses = [];
  const runStart = Date.now();
  const watchdog = setTimeout(() => {
    summary.limitations.push('Overall browser QA deadline elapsed; results may be partial.');
    if (browser) void browser.close().catch(() => {});
  }, MAX_RUN_MS);
  watchdog.unref();

  try {
    assertRuntime();
    const rootHtmlResponse = await fetchResponse(`${origin}/`, 'compiled SPA root');
    if (!rootHtmlResponse.ok) throw new Error(`SPA root returned HTTP ${rootHtmlResponse.status}.`);
    const rootHtml = await rootHtmlResponse.text();
    if (!/<script[^>]+src=["']\/assets\/[^"']+\.js["']/i.test(rootHtml)) {
      throw new Error('Root response does not reference a compiled /assets/*.js bundle.');
    }
    if (/@vite\/client|\/src\/main\.tsx/.test(rootHtml)) {
      throw new Error('Root response looks like Vite development output, not the compiled application.');
    }
    summary.compiledRoot = { status: rootHtmlResponse.status, bundleReference: true };

    currentStep = 'health';
    const healthResponse = await fetchResponse(`${origin}/api/health`, 'BFF health', 10_000);
    summary.health = { status: healthResponse.status };
    if (!healthResponse.ok) throw new Error(`/api/health returned HTTP ${healthResponse.status}.`);

    currentStep = 'top-list-preflight';
    const topUrl = new URL('/api/stories?category=top', origin);
    const topResult = await fetchJson(topUrl, 'Top listing preflight');
    const topPage = topResult.json;
    if (!Array.isArray(topPage.items) || topPage.page !== 1 || !Number.isSafeInteger(topPage.limit)) {
      throw new Error('Top listing BFF envelope is missing items/page/limit.');
    }
    if (typeof topPage.snapshot !== 'string' || topPage.snapshot.length === 0) {
      throw new Error('Top listing BFF envelope did not include a snapshot token.');
    }
    summary.topPreflight = {
      status: topResult.response.status,
      page: topPage.page,
      limit: topPage.limit,
      hasMore: topPage.hasMore ?? null,
      snapshotPresent: true,
      items: topPage.items.map((item) => ({
        id: item.id,
        type: item.type,
        listingCommentCount: item.commentCount,
      })),
    };

    currentStep = 'browser-launch';
    browser = await chromium.launch({ headless: true, timeout: 20_000 });
    const context = await browser.newContext({
      viewport: { width: 375, height: 844 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(20_000);

    page.on('request', (request) => {
      let url;
      try {
        url = new URL(request.url());
      } catch {
        return;
      }
      if (url.protocol === 'data:' || url.protocol === 'blob:') return;
      if (url.origin !== origin) {
        summary.browserNetwork.nonLocalRequests.push({ method: request.method(), origin: url.origin, pathname: url.pathname });
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        summary.browserNetwork.api.push({
          method: request.method(),
          pathname: url.pathname,
          queryKeys: [...url.searchParams.keys()].sort(),
        });
      }
    });
    page.on('response', (response) => {
      let url;
      try {
        url = new URL(response.url());
      } catch {
        return;
      }
      if (url.origin !== origin || !url.pathname.startsWith('/api/')) return;
      const entry = {
        method: response.request().method(),
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        status: response.status(),
      };
      if (url.pathname.startsWith('/api/items/')) observedItemResponses.push(entry);
      if (url.pathname.endsWith('/comments')) {
        browserResponseBodyTasks.push(response.json().then((body) => {
          entry.bodySummary = flattenComments(body?.nodes);
          entry.bodyTruncated = body?.truncated ?? null;
        }).catch((error) => {
          entry.bodyParseError = summarizeError(error);
        }));
      }
      summary.browserNetwork.api.push({ ...entry, event: 'response' });
    });
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      const failure = request.failure()?.errorText ?? 'unknown request failure';
      const expectedAbort = /ERR_ABORTED|NS_BINDING_ABORTED|aborted/i.test(failure);
      summary.browserNetwork.failures.push({
        method: request.method(),
        pathname: url.pathname,
        failure,
        expectedAbort,
      });
    });
    page.on('console', (message) => {
      if (message.type() === 'error') summary.consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => summary.pageErrors.push(summarizeError(error)));

    currentStep = 'native-six-category-navigation';
    const initialResponse = await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    if (!initialResponse?.ok()) throw new Error(`Browser SPA navigation returned HTTP ${initialResponse?.status() ?? 'no response'}.`);
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
    for (const [category, label] of CATEGORY_LABELS) {
      const tab = page.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: label, level: 1 })).toBeVisible();
      await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
      const listingScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      summary.responsive ??= [];
      summary.responsive.push({ surface: 'listing', viewportWidth: 375, documentScrollWidth: listingScrollWidth });
      if (listingScrollWidth > 375) throw new Error(`${label} listing overflows at 375px (document scrollWidth ${listingScrollWidth}).`);
      const alertCount = await page.getByRole('alert').count();
      const rowCount = await page.locator('.story-row').count();
      if (alertCount > 0) {
        const text = (await page.getByRole('alert').first().innerText()).slice(0, 300);
        throw new Error(`${label} category surfaced an API alert: ${text}`);
      }
      const emptyState = rowCount === 0 ? await page.getByRole('status').allTextContents() : [];
      summary.categories.push({ category, label, rowCount, emptyState });
      await page.screenshot({ path: path.join(evidence, `category-${category}-375.png`), animations: 'disabled' });
      summary.screenshots.push(`category-${category}-375.png`);
    }

    const browserTopResponse = summary.browserNetwork.api.some((entry) =>
      entry.event === 'response' && entry.pathname === '/api/stories' && entry.query?.category === 'top' && entry.status >= 200 && entry.status < 300,
    );
    if (!browserTopResponse) throw new Error('The browser did not receive a successful Top BFF response.');

    currentStep = 'theme-native-toggle';
    await page.getByRole('tab', { name: 'Top', exact: true }).click();
    await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    const themeToggle = page.getByRole('button', { name: 'Alternar tema claro e escuro' });
    await expect(themeToggle).toBeVisible();
    await page.setViewportSize({ width: 320, height: 812 });
    const listingScrollWidth320 = await page.evaluate(() => document.documentElement.scrollWidth);
    summary.responsive.push({ surface: 'listing', viewportWidth: 320, documentScrollWidth: listingScrollWidth320 });
    if (listingScrollWidth320 > 320) throw new Error(`Listing overflows at 320px (document scrollWidth ${listingScrollWidth320}).`);
    await themeToggle.click();
    await expect(themeToggle).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.join(evidence, 'theme-dark-list-320.png'), animations: 'disabled' });
    summary.screenshots.push('theme-dark-list-320.png');
    await themeToggle.click();
    await expect(themeToggle).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: path.join(evidence, 'theme-light-list-320.png'), animations: 'disabled' });
    summary.screenshots.push('theme-light-list-320.png');

    currentStep = 'top-page-two-snapshot';
    const loadMore = page.getByRole('button', { name: 'Carregar mais', exact: true });
    const loadMoreVisible = await loadMore.isVisible().catch(() => false);
    let pageTwo = null;
    if (loadMoreVisible) {
      await loadMore.scrollIntoViewIfNeeded();
      const pageTwoResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === origin
          && url.pathname === '/api/stories'
          && url.searchParams.get('category') === 'top'
          && url.searchParams.get('page') === '2';
      }, { timeout: 30_000 });
      await loadMore.click();
      const pageTwoResponse = await pageTwoResponsePromise;
      const pageTwoUrl = new URL(pageTwoResponse.url());
      if (!pageTwoUrl.searchParams.has('snapshot')) throw new Error('Top page 2 request omitted the snapshot token.');
      if (pageTwoUrl.searchParams.get('limit') !== String(topPage.limit)) {
        throw new Error('Top page 2 request changed the page size instead of continuing the snapshot.');
      }
      if (!pageTwoResponse.ok()) throw new Error(`Top page 2 returned HTTP ${pageTwoResponse.status()}.`);
      pageTwo = await pageTwoResponse.json();
      if (pageTwo.page !== 2 || pageTwo.snapshot !== pageTwoUrl.searchParams.get('snapshot')) {
        throw new Error('Top page 2 response did not preserve its requested snapshot.');
      }
      await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
      if (await page.getByRole('alert').count()) throw new Error('Top page 2 rendered an API alert.');
      summary.topPageTwo = {
        requestQueryKeys: [...pageTwoUrl.searchParams.keys()].sort(),
        page: pageTwo.page,
        limit: pageTwo.limit,
        snapshotMatched: true,
        itemCount: Array.isArray(pageTwo.items) ? pageTwo.items.length : 0,
      };
    } else {
      summary.topPageTwo = { status: 'unavailable', reason: 'The live Top response did not offer a Carregar mais control.' };
      summary.limitations.push('Could not verify Top page 2 because the public BFF did not expose a next-page action.');
    }
    await page.screenshot({ path: path.join(evidence, 'top-page-two-320.png'), animations: 'disabled' });
    summary.screenshots.push('top-page-two-320.png');

    currentStep = 'select-live-detail-target';
    const candidates = [
      ...(Array.isArray(pageTwo?.items) ? pageTwo.items : []),
      ...topPage.items,
    ].filter((item) => item?.type === 'story' && Number.isSafeInteger(item.id) && item.id > 0);
    if (candidates.length === 0) throw new Error('No live Top story was available for the direct-detail smoke.');
    const largeCandidate = candidates
      .filter((item) => Number.isSafeInteger(item.commentCount) && item.commentCount >= 200)
      .sort((left, right) => right.commentCount - left.commentCount)[0];
    const detailTarget = largeCandidate ?? candidates
      .slice()
      .sort((left, right) => (right.commentCount ?? 0) - (left.commentCount ?? 0))[0];
    if (!detailTarget) throw new Error('Could not choose a live Top detail target.');
    summary.detailTarget = {
      id: detailTarget.id,
      type: detailTarget.type,
      title: detailTarget.title,
      listingCommentCount: detailTarget.commentCount,
      met200Threshold: Boolean(largeCandidate),
      sourcePage: pageTwo?.items?.some((item) => item.id === detailTarget.id) ? 2 : 1,
    };
    if (!largeCandidate) {
      summary.limitations.push('No Top story with a reported comment count of at least 200 was present in the live first/second-page responses; the highest-count available story was selected without substituting or inventing a public count.');
    }

    currentStep = 'native-detail-collapse-scroll-return';
    const storyLink = page.locator(`a.story-row__detail[href="/item/${detailTarget.id}"]`);
    await storyLink.waitFor({ state: 'visible', timeout: 15_000 });
    await storyLink.scrollIntoViewIfNeeded();
    const savedScrollY = await page.evaluate(() => window.scrollY);
    summary.savedListingScrollY = savedScrollY;
    const commentsResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === origin && url.pathname === `/api/items/${detailTarget.id}/comments`;
    }, { timeout: 45_000 });
    await storyLink.click();
    await expect(page).toHaveURL(new RegExp(`/item/${detailTarget.id}$`));
    await expect(page.getByRole('heading', { name: detailTarget.title, level: 1 })).toBeVisible({ timeout: 45_000 });
    const commentsResponse = await commentsResponsePromise;
    if (!commentsResponse.ok()) throw new Error(`Live comments endpoint returned HTTP ${commentsResponse.status()}.`);
    const commentsQuery = new URL(commentsResponse.url()).searchParams;
    if (commentsQuery.has('depth')) throw new Error('Comments request explicitly overrode default depth instead of using server config.');
    const commentsBody = await commentsResponse.json();
    if (!Array.isArray(commentsBody?.nodes)) throw new Error('Live comments response did not contain a nodes array.');
    const commentTree = flattenComments(commentsBody.nodes);
    await expect(page.locator('.detail__comments')).toHaveAttribute('aria-busy', 'false', { timeout: 45_000 });
    if (await page.getByRole('alert').count()) {
      const alert = (await page.getByRole('alert').first().innerText()).slice(0, 300);
      throw new Error(`Live detail rendered an API alert: ${alert}`);
    }
    if (commentTree.maxDepth > 8) throw new Error(`BFF returned comments deeper than default depth 8 (observed ${commentTree.maxDepth}).`);
    const renderedCommentCount = await page.locator('article[data-comment-id]').count();
    await expect(page.locator('article[data-comment-id]')).toHaveCount(commentTree.entries.length);
    summary.comments = {
      requestPath: new URL(commentsResponse.url()).pathname,
      depthQueryOmitted: true,
      defaultDepthMaxExpected: 8,
      observedMaxDepth: commentTree.maxDepth,
      returnedNodeCount: commentTree.entries.length,
      renderedNodeCount: renderedCommentCount,
      truncated: commentsBody.truncated ?? null,
      listedPublicCommentCount: detailTarget.commentCount,
      publicCountLabel: 'live BFF ListingItem.commentCount; not a fabricated fixture count',
    };
    await page.screenshot({ path: path.join(evidence, 'detail-default-depth8-320.png'), animations: 'disabled' });
    summary.screenshots.push('detail-default-depth8-320.png');

    const detailThemeToggle = page.getByRole('button', { name: 'Alternar tema claro e escuro' });
    await detailThemeToggle.click();
    await expect(detailThemeToggle).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: path.join(evidence, 'detail-dark-320.png'), animations: 'disabled' });
    summary.screenshots.push('detail-dark-320.png');
    await detailThemeToggle.click();
    await expect(detailThemeToggle).toHaveAttribute('aria-pressed', 'false');

    const collapseButton = page.getByRole('button', { name: /^Recolher,/ }).first();
    if (await collapseButton.count()) {
      await collapseButton.click();
      const collapsedButton = page.getByRole('button', { name: /^Expandir,/ }).first();
      await expect(collapsedButton).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.detail-comment__collapsed-count').first()).toBeVisible();
      await page.screenshot({ path: path.join(evidence, 'detail-collapsed-320.png'), animations: 'disabled' });
      summary.screenshots.push('detail-collapsed-320.png');
      await collapsedButton.click();
      await expect(page.getByRole('button', { name: /^Recolher,/ }).first()).toHaveAttribute('aria-expanded', 'true');
    } else {
      summary.limitations.push('The live depth-8 comments response had no expandable comment; collapse interaction could not be exercised against this public item.');
    }

    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 812 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      summary.responsive ??= [];
      summary.responsive.push({ surface: 'detail', viewportWidth: width, documentScrollWidth: scrollWidth });
      if (scrollWidth > width) throw new Error(`Detail overflows at ${width}px (document scrollWidth ${scrollWidth}).`);
      await page.screenshot({ path: path.join(evidence, `detail-responsive-${width}.png`), animations: 'disabled' });
      summary.screenshots.push(`detail-responsive-${width}.png`);
    }

    await page.setViewportSize({ width: 320, height: 812 });
    const returnButton = page.getByRole('button', { name: 'Voltar', exact: true });
    await returnButton.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('tab', { name: 'Top', exact: true })).toHaveAttribute('aria-selected', 'true');
    await storyLink.waitFor({ state: 'visible', timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(savedScrollY);
    await page.screenshot({ path: path.join(evidence, 'listing-return-scroll-320.png'), animations: 'disabled' });
    summary.screenshots.push('listing-return-scroll-320.png');

    currentStep = 'direct-deep-link';
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/item/${detailTarget.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: detailTarget.title, level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.detail__comments')).toHaveAttribute('aria-busy', 'false', { timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Alternar tema claro e escuro' })).toHaveAttribute('aria-pressed', 'false');
    const directScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (directScrollWidth > 375) throw new Error(`Direct detail overflows at 375px (document scrollWidth ${directScrollWidth}).`);
    await page.screenshot({ path: path.join(evidence, 'direct-detail-375.png'), animations: 'disabled' });
    summary.screenshots.push('direct-detail-375.png');
    await Promise.all(browserResponseBodyTasks);
    summary.observedDetailApi = observedItemResponses;

    if (summary.browserNetwork.nonLocalRequests.length > 0) {
      throw new Error(`Browser attempted ${summary.browserNetwork.nonLocalRequests.length} non-local network request(s).`);
    }
    const unexpectedFailures = summary.browserNetwork.failures.filter((failure) => !failure.expectedAbort);
    if (unexpectedFailures.length > 0) {
      throw new Error(`Browser recorded ${unexpectedFailures.length} unexpected network failure(s).`);
    }
    if (summary.consoleErrors.length > 0) throw new Error(`Browser recorded console errors: ${summary.consoleErrors.slice(0, 3).join(' | ')}`);
    if (summary.pageErrors.length > 0) throw new Error(`Browser recorded page errors: ${summary.pageErrors.slice(0, 3).join(' | ')}`);
    summary.status = 'pass';
  } catch (error) {
    summary.status = 'failed';
    summary.failedAt = currentStep;
    summary.failure = summarizeError(error);
    if (page) {
      try {
        await withDeadline(page.screenshot({ path: path.join(evidence, 'failure-state.png'), animations: 'disabled' }), 'failure screenshot', 5_000);
        summary.screenshots.push('failure-state.png');
      } catch (screenshotError) {
        summary.limitations.push(`Could not capture failure screenshot: ${summarizeError(screenshotError)}`);
      }
    }
  } finally {
    clearTimeout(watchdog);
    if (browser) {
      try {
        await withDeadline(browser.close(), 'owned Playwright browser cleanup', 10_000);
        summary.browserCleanup = 'closed';
      } catch (error) {
        summary.browserCleanup = `failed: ${summarizeError(error)}`;
        summary.status = 'failed';
        summary.failure ??= 'Owned browser cleanup exceeded its bounded deadline.';
      }
    }
    summary.finishedAt = new Date().toISOString();
    summary.elapsedMs = Date.now() - runStart;
    try {
      saveJson(path.join(evidence, 'browser-summary.json'), summary);
    } catch (error) {
      summary.status = 'failed';
      summary.failure = `Could not persist browser summary: ${summarizeError(error)}`;
    }
  }
  process.stdout.write(`${JSON.stringify({ status: summary.status, failedAt: summary.failedAt ?? null, summary: path.join(evidence, 'browser-summary.json'), screenshots: summary.screenshots.length })}\n`);
  if (summary.status !== 'pass') process.exitCode = 1;
}

async function main() {
  assertRuntime();
  const args = parseArgs(process.argv);
  const { root, evidence } = assertFreshEvidenceDirectory(args.root, args['evidence-dir']);
  await runSmoke({ root, baseUrl: args['base-url'], evidence });
}

main().catch((error) => {
  process.stderr.write(`${summarizeError(error)}\n`);
  process.exitCode = 2;
});
