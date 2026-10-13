import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [rootArg, evidenceArg, ...extra] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extra.length) {
  console.error('Usage: node drive-keyboard-fixture-app.mjs <ROOT> <new-empty-evidenceDir-under-/tmp>');
  process.exitCode = 64;
} else {
  const ROOT = path.resolve(rootArg);
  const evidence = path.resolve(evidenceArg);
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDir = path.dirname(scriptsDir);
  const within = (candidate, parent) => {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  const safeEvidence = [path.resolve('/tmp'), path.resolve('/private/tmp')].some((tempRoot) => within(evidence, tempRoot)) &&
    !within(evidence, ROOT) && !within(evidence, workspaceDir);
  const starterPath = path.join(scriptsDir, 'start-keyboard-fixture-app.mjs');
  const readyPath = path.join(evidence, 'fixture-ready.json');
  const failurePath = path.join(evidence, 'fixture-failure.json');
  const stoppedPath = path.join(evidence, 'fixture-stopped.json');
  const resultPath = path.join(evidence, 'actual-result.json');
  const screenshotDir = path.join(evidence, 'screenshots');
  const themeKey = 'hn-modernizacao.theme.preference.v1';
  const themeButtonName = 'Alternar tema claro e escuro';
  const startedMs = Date.now();
  const bffCounts = new Map(); const apiRequests = []; const browserOrigins = new Set();
  const activeCounterRequests = new Set();
  const errors = { page: [], console: [], http: [], requests: [], unexpectedBff: [] };
  const result = {
    protocolVersion: 1, status: 'running', startedAt: new Date(startedMs).toISOString(), helperPid: process.pid,
    arguments: { rootPath: ROOT, evidenceDir: evidence, starterPath }, runtime: { node: process.version },
    limits: { readinessMs: 10_000, totalMs: 120_000, perActionMs: 8_000, navigationMs: 10_000, tabGoalMs: 5_000, tabMaxSteps: 200, counterMs: 5_000, gateAutoReleaseMs: 2_800, hnClientTimeoutMs: 4_000, starterStopMs: 7_000, helperCloseMs: 5_000, helperDrainMs: 1_000, browserCloseMs: 5_000, maxScreenshots: 8 },
    interactionMethod: { input: 'Playwright page.keyboard.press only for Tab, Shift+Tab, arrows, Enter and Space after page bootstrap.', locatorInputMethodsUsed: [], pageRouteInterceptionUsed: false, DOMFocusOrEventDispatchUsed: false },
    claims: { assistiveTechnologyTest: false, fullWcagAcceptance: false, nativeOSKeyboardTest: false, publicHnAccess: false, performanceClaim: false, reducedMotion: 'Only inspect real compiled CSS animation while the private held page-2 loader is present; skip if no normal-motion pulse is observable.' },
    phases: {}, screenshots: [], focusObservations: [], keyboardEvents: [], tabGoals: [], motionProof: null, networkChecks: [], errors,
  };
  let ready; let ports; let baseOrigin; let browser; let starter; let qaTask; let spawnError = null; let stopResolve; let evidenceOwned = false;
  const interrupted = new Promise((resolve) => { stopResolve = resolve; });
  const onSigint = () => { result.interrupted = 'SIGINT'; process.exitCode = 130; stopResolve('SIGINT'); };
  const onSigterm = () => { result.interrupted = 'SIGTERM'; process.exitCode = 143; stopResolve('SIGTERM'); };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function bounded(promise, ms, message) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  function bffSnapshot() { return Object.fromEntries([...bffCounts.entries()].sort(([a], [b]) => a.localeCompare(b))); }
  function noRequests(beforeBff, beforeHn, afterBff, afterHn, label) {
    assert.deepEqual(afterBff, beforeBff, `${label}: browser BFF request delta must be zero`);
    assert.deepEqual(afterHn, beforeHn, `${label}: private raw-HN request delta must be zero`);
    result.networkChecks.push({ label, beforeBff, afterBff, beforeHn, afterHn, unchanged: true });
  }

  async function waitReady() {
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      if (spawnError) throw spawnError;
      if (starter && (starter.exitCode !== null || starter.signalCode)) throw new Error(`Owned starter exited before readiness: ${starter.exitCode ?? starter.signalCode}; ${result.starterLogs?.stderr ?? ''}`);
      try {
        const failure = JSON.parse(await readFile(failurePath, 'utf8'));
        if (failure.status === 'failed') throw new Error(`Keyboard fixture startup failed: ${failure.message ?? 'no detail'}`);
      } catch (error) { if (error instanceof Error && error.message.startsWith('Keyboard fixture startup failed:')) throw error; }
      try { const record = JSON.parse(await readFile(readyPath, 'utf8')); if (record.status === 'ready' && record.protocolVersion === 1) return record; } catch {}
      await sleep(100);
    }
    throw new Error('Keyboard fixture readiness exceeded 10 seconds.');
  }

  function validateReady(record) {
    const app = new URL(record.baseUrl); const counter = new URL(record.countersUrl); const gateStatus = new URL(record.gateStatusUrl); const gateRelease = new URL(record.gateReleaseUrl); const upstream = new URL(record.upstreamBaseUrl);
    for (const url of [app, upstream]) { assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1'); assert.ok(Number(url.port) > 0); }
    for (const url of [counter, gateStatus, gateRelease]) assert.equal(url.origin, app.origin);
    assert.equal(counter.pathname, '/__test/hn-counters'); assert.equal(gateStatus.pathname, '/__test/gate/status'); assert.equal(gateRelease.pathname, '/__test/gate/release');
    assert.equal(record.expectedIds.visibleCommentCount, 220); assert.equal(record.expectedIds.allCommentCount, 221);
    assert.equal(record.rawMeta.defaultPageSize, 30); assert.equal(record.topIds.length, 61); assert.equal(record.page2Ids.length, 30);
    assert.deepEqual(record.page2Ids, record.topIds.slice(30, 60)); assert.equal(record.topIds.at(-1) - record.topIds[0], 60);
    assert.ok(record.topIds[0] > Math.max(...record.expectedIds.allCommentIds), 'synthetic story IDs must be outside the original comment fixture IDs');
    const fixtureIds = [...record.topIds, ...Object.values(record.otherStoryIds), record.jobId, ...record.expectedIds.allCommentIds];
    assert.equal(new Set(fixtureIds).size, fixtureIds.length, 'all synthetic story, job and comment IDs must be unique');
    assert.deepEqual(record.listStoryIds, [...record.topIds, ...Object.values(record.otherStoryIds), record.jobId]);
    assert.equal(record.rawMeta.gateTargetCount, 30); assert.equal(record.rawMeta.hnClientTimeoutMs, 4_000);
    assert.equal(record.rawMeta.primaryStoryId, record.storyId);
    assert.ok(Number.isInteger(record.helperPid) && record.helperPid > 0 && Number.isInteger(record.jobId));
    assert.equal(record.helperPid, starter.pid); assert.equal(record.fixtureAppPid, starter.pid); assert.equal(record.rawUpstreamPid, starter.pid);
    assert.equal(record.arguments.rootPath, ROOT); assert.equal(record.arguments.evidenceDir, evidence);
    assert.ok(record.rawMeta.markerAuthors.dead && record.rawMeta.markerAuthors.deleted);
    return { appPort: Number(app.port), upstreamPort: Number(upstream.port) };
  }

  async function nodeRequest(url, options = {}, timeoutMs = 5_000) {
    const controller = new AbortController(); activeCounterRequests.add(controller);
    const timer = setTimeout(() => controller.abort(new Error(`Node-only fixture request exceeded ${timeoutMs}ms.`)), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      assert.equal(response.status, 200, `Node-only fixture request ${url}`);
      return await response.json();
    } finally { clearTimeout(timer); activeCounterRequests.delete(controller); }
  }
  async function readCounters() {
    const url = new URL(ready.countersUrl);
    url.searchParams.set('ids', [...ready.listStoryIds, ...ready.expectedIds.allCommentIds].join(','));
    return nodeRequest(url);
  }
  async function readGate() { return nodeRequest(ready.gateStatusUrl); }
  async function releaseGate(reason = 'driver') {
    return nodeRequest(ready.gateReleaseUrl, { method: 'POST', headers: { 'x-test-release-reason': reason } });
  }

  function observe(page, allowedPaths) {
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') browserOrigins.add(url.origin);
      if (url.origin === baseOrigin && url.pathname.startsWith('/api/')) {
        const entry = { method: request.method(), pathname: url.pathname, search: url.search, url: request.url() };
        apiRequests.push(entry);
        const key = `${entry.method} ${entry.pathname}${entry.search}`;
        bffCounts.set(key, (bffCounts.get(key) ?? 0) + 1);
        if (!allowedPaths.has(url.pathname)) errors.unexpectedBff.push(key);
      }
    });
    page.on('pageerror', (error) => errors.page.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
    page.on('response', (response) => { const url = new URL(response.url()); if (url.origin === baseOrigin && response.status() >= 400) errors.http.push({ status: response.status(), url: response.url() }); });
    page.on('requestfailed', (request) => { const url = new URL(request.url()); if (url.origin === baseOrigin) errors.requests.push({ url: request.url(), error: request.failure()?.errorText ?? 'failed' }); });
  }
  function waitResponse(page, pathname, query = () => true) {
    const pending = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === baseOrigin && url.pathname === pathname && response.request().method() === 'GET' && query(url);
    }, { timeout: 8_000 });
    pending.catch(() => {});
    return pending;
  }
  function waitRequest(page, pathname, query = () => true) {
    const pending = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.origin === baseOrigin && url.pathname === pathname && request.method() === 'GET' && query(url);
    }, { timeout: 8_000 });
    pending.catch(() => {});
    return pending;
  }
  async function json200(response, label) { assert.equal(response.status(), 200, `${label} response status`); return response.json(); }
  async function idle(page) { await page.waitForLoadState('networkidle', { timeout: 5_000 }); }
  async function waitCategory(page, category) {
    await page.waitForFunction((value) => document.querySelector(`#category-tab-${value}`)?.getAttribute('aria-selected') === 'true', category, { timeout: 8_000 });
  }

  async function focusInfo(page) {
    return page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const labelledBy = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.innerText?.trim() ?? '').filter(Boolean).join(' ');
      const text = (el.getAttribute('aria-label') || labelledBy || el.innerText || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
      const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
      const outlineVisible = style.outlineStyle !== 'none' && outlineWidth > 0 && style.outlineColor !== 'transparent';
      const focusIndicator = outlineVisible || style.boxShadow !== 'none';
      const focusRingOutset = outlineVisible ? Math.max(0, outlineWidth + outlineOffset) : 0;
      const focusRingRect = { left: rect.left - focusRingOutset, top: rect.top - focusRingOutset, right: rect.right + focusRingOutset, bottom: rect.bottom + focusRingOutset };
      const intersectsViewport = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight && style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) !== 0;
      const viewportFullyVisible = rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      const clippedBy = [];
      let fullyVisibleThroughClips = true;
      for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor); const ancestorRect = ancestor.getBoundingClientRect();
        const clipsX = ['hidden', 'clip', 'scroll', 'auto'].includes(ancestorStyle.overflowX);
        const clipsY = ['hidden', 'clip', 'scroll', 'auto'].includes(ancestorStyle.overflowY);
        if (!clipsX && !clipsY) continue;
        const left = ancestorRect.left + ancestor.clientLeft; const top = ancestorRect.top + ancestor.clientTop;
        const right = left + ancestor.clientWidth; const bottom = top + ancestor.clientHeight;
        const fullyInside = (!clipsX || (rect.left >= left && rect.right <= right)) && (!clipsY || (rect.top >= top && rect.bottom <= bottom));
        if (!fullyInside) fullyVisibleThroughClips = false;
        clippedBy.push({ id: ancestor.id || '', className: typeof ancestor.className === 'string' ? ancestor.className : '', overflowX: ancestorStyle.overflowX, overflowY: ancestorStyle.overflowY, clientRect: { left, top, right, bottom }, fullyInside });
      }
      const role = el.getAttribute('role') || (el.tagName === 'BUTTON' ? 'button' : el.tagName === 'A' ? 'link' : el.tagName.toLowerCase());
      const article = el.closest('[data-comment-id]');
      const tablist = el.closest('[role="tablist"]');
      const tabScroller = el.closest('.category-tabs');
      let tabStrip = null;
      if (tabScroller) {
        const stripRect = tabScroller.getBoundingClientRect(); const left = stripRect.left + tabScroller.clientLeft; const top = stripRect.top + tabScroller.clientTop;
        const right = left + tabScroller.clientWidth; const bottom = top + tabScroller.clientHeight;
        tabStrip = { id: tabScroller.id || '', className: typeof tabScroller.className === 'string' ? tabScroller.className : '', rect: { left, top, right, bottom }, fullyVisible: rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom, focusRingFullyVisible: focusRingRect.left >= left && focusRingRect.right <= right && focusRingRect.top >= top && focusRingRect.bottom <= bottom };
      }
      const visible = intersectsViewport && viewportFullyVisible && fullyVisibleThroughClips;
      return {
        tag: el.tagName.toLowerCase(), id: el.id || '', role, className: typeof el.className === 'string' ? el.className : '',
        name: text, href: el.getAttribute('href'), ariaSelected: el.getAttribute('aria-selected'), ariaPressed: el.getAttribute('aria-pressed'),
        ariaExpanded: el.getAttribute('aria-expanded'), ariaBusy: el.getAttribute('aria-busy'), disabled: Boolean(el.disabled), tabIndex: el.tabIndex,
        closestCommentId: article?.getAttribute('data-comment-id') ?? null, inTablist: Boolean(tablist), tabStrip, clippedBy, focusVisible: el.matches(':focus-visible'), focusIndicator,
        outline: { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, offset: style.outlineOffset, boxShadow: style.boxShadow },
        focusRingOutset, focusRingRect,
        visible, intersectsViewport, viewportFullyVisible, fullyVisibleThroughClips, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
        documentPath: location.pathname, scrollY: window.scrollY,
      };
    });
  }
  function assertFocused(state, label) {
    assert.ok(state.name, `${label}: focused element must have an accessible-name source`);
    assert.equal(state.focusVisible, true, `${label}: :focus-visible must match the keyboard-focused element`);
    assert.ok(state.focusIndicator, `${label}: focus indicator is not visible in computed outline/box-shadow`);
    assert.ok(state.intersectsViewport && state.viewportFullyVisible && state.fullyVisibleThroughClips && state.rect.width > 0 && state.rect.height > 0, `${label}: focused target must be fully inside the viewport and all clipping ancestors: ${JSON.stringify(state)}`);
    if (state.role === 'tab') assert.equal(state.tabStrip?.fullyVisible, true, `${label}: focused tab must be fully inside the .category-tabs scroller: ${JSON.stringify(state.tabStrip)}`);
  }
  function sameFocusedControl(before, after, label) {
    assert.equal(after.tag, before.tag, `${label}: focus tag changed`);
    assert.equal(after.id, before.id, `${label}: focus id changed`);
    assert.equal(after.role, before.role, `${label}: focus role changed`);
    assert.equal(after.name, before.name, `${label}: accessible focus name changed`);
    assert.equal(after.className, before.className, `${label}: focus class changed`);
    assert.equal(after.href, before.href, `${label}: focus href changed`);
    assert.equal(after.tabIndex, before.tabIndex, `${label}: focus tab order changed`);
    assert.equal(after.closestCommentId, before.closestCommentId, `${label}: comment focus target changed`);
  }
  async function nativePress(page, key, label) {
    const before = await focusInfo(page);
    await bounded(page.keyboard.press(key), 1_000, `${label}: native ${key} keypress timed out`);
    const after = await focusInfo(page);
    result.keyboardEvents.push({ key, label, before: { tag: before.tag, id: before.id, role: before.role, name: before.name, href: before.href, ariaSelected: before.ariaSelected, ariaExpanded: before.ariaExpanded }, after: { tag: after.tag, id: after.id, role: after.role, name: after.name, href: after.href, ariaSelected: after.ariaSelected, ariaExpanded: after.ariaExpanded, focusVisible: after.focusVisible, visible: after.visible } });
    return { before, after };
  }
  async function tabUntil(page, predicate, label, direction = 'Tab', maximum = 200) {
    const start = Date.now(); const deadline = start + 5_000;
    let focus = await focusInfo(page); let steps = 0;
    while (!predicate(focus) && steps < maximum && Date.now() < deadline) {
      await nativePress(page, direction, `${label} ${direction} ${steps + 1}`);
      focus = await focusInfo(page); steps += 1;
    }
    assert.ok(predicate(focus), `${label}: target not reached within ${steps} ${direction} steps / 5s; last focus=${JSON.stringify(focus)}`);
    assertFocused(focus, label);
    result.tabGoals.push({ label, direction, steps, durationMs: Date.now() - start, focus });
    return focus;
  }
  async function waitActive(page, predicate, label) {
    await page.waitForFunction(() => document.activeElement !== document.body, undefined, { timeout: 8_000 });
    const info = await focusInfo(page); assert.ok(predicate(info), `${label}: unexpected active element ${JSON.stringify(info)}`); assertFocused(info, label); return info;
  }
  async function captureFocused(page, name, metadata = {}) {
    const focus = await focusInfo(page); assertFocused(focus, `screenshot ${name}`);
    assert.equal(focus.viewportFullyVisible, true, `screenshot ${name}: the focused control must be entirely inside the captured viewport`);
    const file = path.join(screenshotDir, `${name}.png`); const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await bounded(page.screenshot({ path: file, fullPage: false }), 8_000, `Screenshot ${name} exceeded 8 seconds.`);
    result.screenshots.push({ name, path: file, viewport, focus: { tag: focus.tag, id: focus.id, role: focus.role, name: focus.name, href: focus.href, closestCommentId: focus.closestCommentId, ariaExpanded: focus.ariaExpanded, ariaBusy: focus.ariaBusy, focusVisible: focus.focusVisible, focusIndicator: focus.focusIndicator, outline: focus.outline, focusRingOutset: focus.focusRingOutset, focusRingRect: focus.focusRingRect, visible: focus.visible, viewportFullyVisible: focus.viewportFullyVisible, tabStrip: focus.tabStrip, clippedBy: focus.clippedBy, rect: focus.rect }, ...metadata });
  }
  async function pressTabTo(page, goal, direction = 'Tab', maximum = 200) {
    return tabUntil(page, goal.predicate, goal.label, direction, maximum);
  }

  async function assertNoNetwork(page, label, action) {
    await idle(page); const beforeBff = bffSnapshot(); const beforeHn = await readCounters();
    await action(); await idle(page);
    const afterBff = bffSnapshot(); const afterHn = await readCounters();
    noRequests(beforeBff, beforeHn, afterBff, afterHn, label);
  }

  async function selectCategoryByEnter(page, category, label) {
    const tabId = `category-tab-${category}`;
    const activeBefore = await focusInfo(page);
    assert.equal(activeBefore.id, tabId, `${label}: expected native keyboard focus on tab before Enter`);
    const response = waitResponse(page, '/api/stories', (url) => url.searchParams.get('category') === category && (url.searchParams.get('page') ?? '1') === '1');
    await nativePress(page, 'Enter', `activate ${label}`);
    const data = await json200(await response, `${label} first page`); await idle(page);
    await waitCategory(page, category);
    const activeAfter = await focusInfo(page); assert.equal(activeAfter.id, tabId, `${label}: Enter should retain tab focus`); assertFocused(activeAfter, `${label} selected tab`);
    const expectedId = category === 'job' ? ready.jobId : category === 'top' ? ready.storyId : ready.otherStoryIds[category];
    const expectedItem = data.items.find((item) => item.id === expectedId);
    assert.ok(expectedItem, `${label}: selected category response lacks its private fixture item`);
    assert.equal(expectedItem.type, category === 'job' ? 'job' : 'story');
    assert.equal(data.page, 1); assert.equal(data.limit, 30);
    if (category !== 'top') { assert.equal(data.items.length, 1); assert.equal(data.hasMore, false); }
    result.phases[`category-${category}`] = { at: new Date().toISOString(), selectedId: expectedId, itemIds: data.items.map((item) => item.id), page: data.page, limit: data.limit, hasMore: data.hasMore, focusRetained: true };
    return data;
  }

  async function focusedThemeState(page) {
    return page.evaluate((key) => {
      let preference; try { preference = sessionStorage.getItem(key); } catch { preference = '[[blocked]]'; }
      const root = document.documentElement;
      return { theme: getComputedStyle(root).colorScheme, manual: root.getAttribute('data-theme'), preference, pressed: document.querySelector('button.theme-toggle')?.getAttribute('aria-pressed') ?? null, url: location.href, scrollY: window.scrollY };
    }, themeKey);
  }
  async function keyboardThemeChange(page, key, expected, label) {
    await idle(page);
    const before = await focusedThemeState(page);
    const beforeBff = bffSnapshot(); const beforeHn = await readCounters();
    const action = await nativePress(page, key, label);
    const preference = expected;
    await page.waitForFunction(({ theme, pref }) => {
      const root = document.documentElement; let stored; try { stored = sessionStorage.getItem('hn-modernizacao.theme.preference.v1'); } catch { stored = '[[blocked]]'; }
      return root.getAttribute('data-theme') === theme && stored === pref && document.querySelector('button.theme-toggle')?.getAttribute('aria-pressed') === String(theme === 'dark');
    }, { theme: expected, pref: preference }, { timeout: 8_000 });
    await idle(page);
    const after = await focusedThemeState(page); const focusAfter = await focusInfo(page);
    sameFocusedControl(action.before, action.after, `${label} immediate focus`); sameFocusedControl(action.before, focusAfter, `${label} retained keyboard focus`);
    assertFocused(focusAfter, `${label} focused theme control`);
    assert.equal(after.manual, expected); assert.equal(after.preference, expected); assert.equal(after.url, before.url); assert.equal(after.scrollY, before.scrollY);
    const afterBff = bffSnapshot(); const afterHn = await readCounters(); noRequests(beforeBff, beforeHn, afterBff, afterHn, label);
    result.phases[label] = { before, after, key, focusRetained: true, urlAndScrollStable: true };
    return after;
  }

  async function waitForPage2Gate(page2RequestPromise) {
    const request = await bounded(page2RequestPromise, 8_000, 'Keyboard page-2 request did not begin within 8 seconds.');
    const url = new URL(request.url());
    assert.equal(url.searchParams.get('category'), 'top'); assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('limit'), '30'); assert.equal(url.searchParams.get('snapshot'), result.phases.topPage.snapshot);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['category', 'limit', 'page', 'snapshot']);
    for (const key of ['category', 'page', 'limit', 'snapshot']) assert.equal(url.searchParams.getAll(key).length, 1, `page-2 query parameter ${key} must occur exactly once`);
    const until = Date.now() + 2_000;
    let state;
    while (Date.now() < until) {
      state = await readGate();
      if (state.hits.length > 0) break;
      await sleep(50);
    }
    assert.ok(state?.hits.length > 0, 'private raw item gate did not hold a page-2 item request');
    assert.equal(state.released, false, 'page-2 gate must still be held for busy-state evidence');
    return { request, url, gate: state };
  }

  async function focusLoadMore(page) {
    return pressTabTo(page, { label: 'Top panel Carregar mais', predicate: (focus) => focus.className.split(/\s+/).includes('listing__load-more') });
  }
  async function busyFocus(page) {
    await page.waitForFunction(() => {
      const button = document.querySelector('button.listing__load-more');
      const disabledSemantics = button?.disabled === true || button?.getAttribute('aria-disabled') === 'true';
      return button?.getAttribute('aria-busy') === 'true' && disabledSemantics && document.querySelector('main.listing')?.getAttribute('aria-busy') === 'true';
    }, undefined, { timeout: 8_000 });
    const button = await page.locator('button.listing__load-more').evaluate((element) => ({
      ariaBusy: element.getAttribute('aria-busy'), disabled: element.disabled, ariaDisabled: element.getAttribute('aria-disabled'),
    }));
    const activeElement = await focusInfo(page);
    assert.equal(button.ariaBusy, 'true');
    assert.ok(button.disabled || button.ariaDisabled === 'true', 'busy load-more control must expose native or ARIA disabled semantics');
    return { button, activeElement };
  }
  async function loadingMotion(page) {
    return page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.listing__loading-more, .listing__loading-more *, .story-skeleton, .story-skeleton *')];
      const unique = [...new Set(nodes)];
      return unique.map((el) => {
        const style = getComputedStyle(el); const names = style.animationName.split(',').map((value) => value.trim());
        const durations = style.animationDuration.split(',').map((value) => value.trim());
        const playStates = style.animationPlayState.split(',').map((value) => value.trim());
        const active = names.some((name, index) => {
          if (name === 'none') return false;
          const value = durations[index % durations.length] ?? '0s';
          const n = Number.parseFloat(value) || 0; const ms = value.endsWith('ms') ? n : value.endsWith('s') ? n * 1_000 : 0;
          return ms > 50 && playStates[index % playStates.length] !== 'paused';
        });
        const rect = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), className: typeof el.className === 'string' ? el.className : '', animationName: style.animationName, animationDuration: style.animationDuration, animationPlayState: style.animationPlayState, active, visible: rect.width > 0 && rect.height > 0 };
      }).filter((entry) => entry.visible);
    });
  }

  async function assertCollapsedTree(page, id, childId, expectExpanded, label) {
    const state = await focusInfo(page);
    assert.equal(state.closestCommentId, String(id), `${label}: focus must stay inside the focused toggle's comment`);
    assert.ok(state.className.split(/\s+/).includes('detail-comment__toggle'), `${label}: focused element is not the comment toggle`);
    assert.equal(state.ariaExpanded, String(expectExpanded)); assertFocused(state, label);
    if (expectExpanded) {
      await page.waitForFunction((value) => {
        const article = document.querySelector(`article[data-comment-id="${value.id}"]`);
        const child = document.querySelector(`article[data-comment-id="${value.childId}"]`);
        const replies = article?.parentElement?.querySelector(':scope > ol.detail-comment-tree');
        return article?.querySelector('button.detail-comment__toggle')?.getAttribute('aria-expanded') === 'true' &&
          child !== null && child.getClientRects().length > 0 && replies !== null && replies !== undefined &&
          article.nextElementSibling === replies && !article.contains(replies) && replies.contains(child);
      }, { id: String(id), childId: String(childId) }, { timeout: 8_000 });
      assert.equal(await page.locator(`article[data-comment-id="${id}"] .detail-comment__body`).count() > 0, true);
    } else {
      await page.waitForFunction((value) => {
        const article = document.querySelector(`article[data-comment-id="${value.id}"]`);
        return article?.querySelector('button.detail-comment__toggle')?.getAttribute('aria-expanded') === 'false' &&
          document.querySelector(`article[data-comment-id="${value.childId}"]`) === null && article?.querySelector('.detail-comment__body') === null &&
          article?.parentElement?.querySelector(':scope > ol.detail-comment-tree') === null;
      }, { id: String(id), childId: String(childId) }, { timeout: 8_000 });
      assert.equal(state.closestCommentId, String(id), `${label}: focus must not remain in a removed/hidden reply subtree`);
    }
    return state;
  }

  async function executeQA(chromium) {
    const allowedPaths = new Set(['/api/stories', `/api/items/${ready.storyId}`, `/api/items/${ready.storyId}/comments`]);
    const context = await chromium.newContext({ viewport: { width: 320, height: 820 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.setDefaultTimeout(8_000); page.setDefaultNavigationTimeout(10_000);
    observe(page, allowedPaths);

    const initialTopResponse = waitResponse(page, '/api/stories', (url) => url.searchParams.get('category') === 'top' && (url.searchParams.get('page') ?? '1') === '1');
    const navigation = await page.goto(ready.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.equal(navigation?.status(), 200, 'compiled SPA document must return HTTP 200');
    const topData = await json200(await initialTopResponse, 'initial Top page');
    await idle(page); await waitCategory(page, 'top');
    assert.equal(topData.page, 1); assert.equal(topData.limit, 30); assert.equal(topData.items.length, 30);
    assert.equal(topData.items[0]?.id, ready.storyId); assert.equal(topData.hasMore, true); assert.ok(typeof topData.snapshot === 'string' && topData.snapshot.length > 0);
    assert.deepEqual(topData.items.map((item) => item.id), ready.topIds.slice(0, 30));
    result.phases.topPage = { page: topData.page, limit: topData.limit, snapshot: topData.snapshot, hasMore: topData.hasMore, itemIds: topData.items.map((item) => item.id), primaryStoryId: ready.storyId };
    const initialTab = await tabUntil(page, (focus) => focus.id === 'category-tab-top' && focus.role === 'tab', 'Top category tab');
    assert.equal(initialTab.ariaSelected, 'true');
    result.focusObservations.push({ phase: 'initial-top-tab', focus: initialTab });
    await captureFocused(page, 'top-tab-focused', { category: 'top', theme: 'light' });

    async function arrowTo(category, selectedCategory, direction = 'ArrowRight') {
      const beforeBff = bffSnapshot(); const beforeHn = await readCounters();
      const action = await nativePress(page, direction, `${direction} to ${category} tab`);
      result.focusObservations.push({ phase: `tab-arrow-${category}`, focus: action.after });
      assert.equal(action.after.id, `category-tab-${category}`, `${direction} should rove focus to ${category}`);
      assert.equal(action.after.role, 'tab'); assert.equal(action.after.ariaSelected, String(category === selectedCategory));
      assert.equal(await page.locator(`#category-tab-${selectedCategory}`).getAttribute('aria-selected'), 'true');
      assertFocused(action.after, `${category} roving tab focus`);
      const afterBff = bffSnapshot(); const afterHn = await readCounters(); noRequests(beforeBff, beforeHn, afterBff, afterHn, `${direction} to ${category} tab`);
      return action.after;
    }

    for (const category of ['new', 'best', 'ask', 'show', 'job', 'top']) await arrowTo(category, 'top');
    const jobsFocus = await arrowTo('job', 'top', 'ArrowLeft');
    assert.equal(jobsFocus.name, 'Jobs');
    await page.setViewportSize({ width: 375, height: 820 });
    const jobsAfterResize375 = await focusInfo(page);
    const showAt375 = await arrowTo('show', 'top', 'ArrowLeft');
    const jobsAt375 = await arrowTo('job', 'top', 'ArrowRight');
    assert.equal(jobsAt375.name, 'Jobs');
    await page.setViewportSize({ width: 320, height: 820 });
    const jobsAfterResize320 = await focusInfo(page);
    const showAt320 = await arrowTo('show', 'top', 'ArrowLeft');
    const jobsAt320 = await arrowTo('job', 'top', 'ArrowRight');
    assert.equal(jobsAt320.name, 'Jobs');
    result.tabStripGeometry = {
      showAt320: showAt320.tabStrip, jobsAt320: jobsAt320.tabStrip, showAt375: showAt375.tabStrip, jobsAt375: jobsAt375.tabStrip,
      immediatelyAfterResize375: jobsAfterResize375, immediatelyAfterResize320: jobsAfterResize320,
    };
    await captureFocused(page, 'jobs-tab-focused', { category: 'top', focusedTab: 'Jobs', theme: 'light', tabStripGeometry: result.tabStripGeometry });

    await selectCategoryByEnter(page, 'job', 'select Jobs with Enter');
    const panelFocus = await tabUntil(page, (focus) => focus.id === 'listing-panel' && focus.role === 'tabpanel', 'Jobs tab to tabpanel');
    assert.equal(panelFocus.documentPath, '/');
    result.focusObservations.push({ phase: 'jobs-panel-tab-stop', focus: panelFocus });
    const jobsTabFocus = await tabUntil(page, (focus) => focus.id === 'category-tab-job' && focus.role === 'tab', 'tabpanel Shift+Tab to Jobs', 'Shift+Tab');
    assert.equal(jobsTabFocus.ariaSelected, 'true');
    await arrowTo('top', 'job');
    await selectCategoryByEnter(page, 'top', 'select Top with Enter after Jobs');

    let selectedCategory = 'top';
    for (const category of ['new', 'best', 'ask', 'show', 'job']) {
      await arrowTo(category, selectedCategory);
      await selectCategoryByEnter(page, category, `select ${category === 'job' ? 'Jobs' : category} with Enter`);
      selectedCategory = category;
    }
    await arrowTo('top', 'job');
    const selectedTop = await selectCategoryByEnter(page, 'top', 'return to Top with Enter');
    assert.equal(selectedTop.items.length, 30); assert.equal(selectedTop.hasMore, true); assert.equal(selectedTop.snapshot, topData.snapshot);
    assert.equal(await page.locator('.story-list > li').count(), 30);

    const themeFocus = await tabUntil(page, (focus) => focus.className.split(/\s+/).includes('theme-toggle') && focus.name === themeButtonName, 'Theme toggle from Top tab');
    assert.equal(themeFocus.role, 'button');
    result.focusObservations.push({ phase: 'theme-toggle-focus', focus: themeFocus });
    const darkTheme = await keyboardThemeChange(page, 'Enter', 'dark', 'listing theme Enter to dark');
    await captureFocused(page, 'theme-dark-focused', { theme: darkTheme.manual, key: 'Enter' });
    await keyboardThemeChange(page, 'Space', 'light', 'listing theme Space to light');

    const loadMoreFocus = await focusLoadMore(page);
    assert.equal(loadMoreFocus.name, 'Carregar mais');
    assert.equal(loadMoreFocus.ariaBusy, 'false'); assert.equal(loadMoreFocus.disabled, false);
    assert.equal(await page.locator('.story-list > li').count(), 30);
    await captureFocused(page, 'load-more-before-activation-focused', { category: 'top', theme: 'light', rows: 30, hasMore: true });
    const beforeLoad = { url: page.url(), scrollY: await page.evaluate(() => window.scrollY), snapshot: topData.snapshot };
    const page2ResponsePromise = waitResponse(page, '/api/stories', (url) => url.searchParams.get('category') === 'top' && url.searchParams.get('page') === '2');
    const page2RequestPromise = waitRequest(page, '/api/stories', (url) => url.searchParams.get('category') === 'top' && url.searchParams.get('page') === '2');
    await nativePress(page, 'Enter', 'keyboard activate Top load-more');
    const held = await waitForPage2Gate(page2RequestPromise);
    const busy = await busyFocus(page);
    result.focusObservations.push({ phase: 'load-more-busy-active-element', focus: busy.activeElement });
    result.phases.loadMoreBusy = { button: busy.button, activeElement: busy.activeElement };
    assert.equal(held.gate.pendingCount > 0, true);
    const page2Requests = apiRequests.filter((entry) => entry.pathname === '/api/stories' && new URL(entry.url).searchParams.get('category') === 'top' && new URL(entry.url).searchParams.get('page') === '2');
    assert.equal(page2Requests.length, 1, `page-2 BFF request must be issued once; got ${page2Requests.length}`);
    const heldCounters = await readCounters();
    assert.ok(ready.page2Ids.some((id) => heldCounters.itemRequests[String(id)] > 0), 'raw HN page-2 item counter must show a held request');
    const normalMotion = await loadingMotion(page);
    const normalPulse = normalMotion.filter((entry) => entry.active);
    result.motionProof = { scope: 'computed DOM CSS animation only; not assistive-technology or full WCAG proof', normalMotion: { preference: 'no-preference', observed: normalMotion, activeCount: normalPulse.length } };
    if (normalPulse.length > 0) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedMotion = await loadingMotion(page);
      const reducedPulse = reducedMotion.filter((entry) => entry.active);
      assert.equal(reducedPulse.length, 0, `real loading animation remains active under reduced motion: ${JSON.stringify(reducedPulse)}`);
      const reducedBusy = await busyFocus(page);
      result.motionProof.reducedMotion = { preference: 'reduce', observed: reducedMotion, activeCount: reducedPulse.length, busyButton: reducedBusy.button, activeElement: reducedBusy.activeElement };
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    } else {
      result.motionProof.reducedMotion = { status: 'skipped-no-observable-normal-motion-pulse' };
    }
    const gateBeforeRelease = await readGate();
    assert.equal(gateBeforeRelease.released, false, 'page-2 raw HN gate must remain held through busy-state evidence');
    assert.ok(gateBeforeRelease.hits.length > 0);
    const gateReleaseResult = await releaseGate('keyboard-busy-evidence-complete');
    assert.equal(gateReleaseResult.released, true); assert.equal(gateReleaseResult.releaseReason, 'node-driver-release');
    const gateAfterRelease = await readGate(); assert.equal(gateAfterRelease.released, true);
    const page2Data = await json200(await page2ResponsePromise, 'Top page 2 after explicit Node gate release');
    await idle(page);
    assert.equal(page2Data.page, 2); assert.equal(page2Data.limit, 30); assert.equal(page2Data.items.length, 30);
    assert.deepEqual(page2Data.items.map((item) => item.id), ready.page2Ids); assert.equal(page2Data.hasMore, true); assert.equal(page2Data.snapshot, topData.snapshot);
    await page.waitForFunction(() => document.querySelectorAll('.story-list > li').length === 60 && document.querySelector('button.listing__load-more')?.getAttribute('aria-busy') === 'false', undefined, { timeout: 8_000 });
    await page.waitForFunction(() => document.activeElement === document.querySelector('button.listing__load-more'), undefined, { timeout: 8_000 });
    const afterLoadFocus = await focusInfo(page);
    result.focusObservations.push({ phase: 'load-more-focus-after-60-rows', focus: afterLoadFocus });
    sameFocusedControl(loadMoreFocus, afterLoadFocus, 'load-more after appending 60 rows');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('button.listing__load-more')), true, 'activeElement must be the exact load-more button after append');
    assertFocused(afterLoadFocus, 'load-more keyboard focus restored after appending 60 rows');
    assert.equal(afterLoadFocus.viewportFullyVisible, true, 'restored pagination focus must remain entirely within the viewport without script-driven scrolling');
    assert.equal(afterLoadFocus.ariaBusy, 'false'); assert.equal(afterLoadFocus.disabled, false);
    const afterLoad = { url: page.url(), scrollY: await page.evaluate(() => window.scrollY), focus: afterLoadFocus };
    await captureFocused(page, 'load-more-after-append-focused', { category: 'top', theme: 'light', rows: 60, hasMore: true });
    const page2AfterCounters = await readCounters();
    assert.ok(ready.page2Ids.every((id) => page2AfterCounters.itemRequests[String(id)] === 1), 'each Top page-2 item must be fetched once from the private upstream');
    assert.equal(afterLoad.url, beforeLoad.url); assert.equal(page2Data.hasMore, true);
    result.phases.loadMore = { before: beforeLoad, heldGate: held.gate, heldCounters, release: gateReleaseResult, after: { url: afterLoad.url, scrollY: afterLoad.scrollY, focusRetained: true, focusedControlVisible: afterLoadFocus.visible, ariaBusy: afterLoadFocus.ariaBusy, disabled: afterLoadFocus.disabled }, page2: { page: page2Data.page, limit: page2Data.limit, itemIds: page2Data.items.map((item) => item.id), hasMore: page2Data.hasMore, snapshot: page2Data.snapshot }, counters: page2AfterCounters };

    const primaryStoryLink = await tabUntil(page, (focus) => focus.tag === 'a' && focus.className.split(/\s+/).includes('story-row__detail') && focus.href === `/item/${ready.storyId}`, 'Shift+Tab to primary Top story detail link', 'Shift+Tab');
    assert.ok(primaryStoryLink.name.includes(ready.rawMeta.primaryStoryTitle), `primary story detail link name should include its long fixture title: ${primaryStoryLink.name}`);
    result.focusObservations.push({ phase: 'primary-story-detail-link', focus: primaryStoryLink });
    const itemResponsePromise = waitResponse(page, `/api/items/${ready.storyId}`);
    const commentsResponsePromise = waitResponse(page, `/api/items/${ready.storyId}/comments`);
    await nativePress(page, 'Enter', 'keyboard open primary story detail');
    const [itemResponse, commentsResponse] = await Promise.all([itemResponsePromise, commentsResponsePromise]);
    const itemData = await json200(itemResponse, 'primary story detail item');
    const commentsData = await json200(commentsResponse, 'primary story comments');
    assert.equal(new URL(commentsResponse.url()).searchParams.has('depth'), false, 'comment tree must use the BFF default depth');
    await page.waitForFunction((id) => location.pathname === `/item/${id}` && document.querySelector('main.detail') !== null && document.querySelector('article[data-comment-id]') !== null, ready.storyId, { timeout: 8_000 });
    await idle(page);
    assert.equal(itemData.item.id, ready.storyId); assert.equal(itemData.item.title, ready.rawMeta.primaryStoryTitle); assert.equal(itemData.item.author, ready.rawMeta.primaryStoryAuthor); assert.equal(itemData.item.commentCount, 221);
    assert.ok(Array.isArray(commentsData.nodes) && commentsData.nodes.length === ready.rawMeta.rootChildIds.length);
    assert.equal(await page.locator('#detail-comments-title').innerText(), 'Comentários iniciais');
    assert.equal(await page.locator('.detail-comment-list').getAttribute('role'), null, 'comment replies use a native nested list, not a custom ARIA tree');
    assert.equal(await page.locator('.detail-comment-list [role="tree"], .detail-comment-list [role="treeitem"]').count(), 0);
    assert.equal(await page.locator('.detail-comment-list .detail-comment__toggle').first().evaluate((element) => element.tagName), 'BUTTON');
    await page.waitForFunction((value) => document.querySelectorAll('article[data-comment-id]').length === value.visibleCount, { visibleCount: 220 }, { timeout: 8_000 });
    const renderedRootIds = await page.locator('.detail-comment-list > li > article[data-comment-id]').evaluateAll((elements) => elements.map((element) => Number(element.getAttribute('data-comment-id'))));
    assert.deepEqual(renderedRootIds, ready.rawMeta.rootChildIds);
    assert.equal(await page.locator(`article[data-comment-id="${ready.markerIds.deadId}"] .detail-comment__marker`).innerText(), '[morto]');
    assert.equal(await page.locator(`article[data-comment-id="${ready.markerIds.deadId}"] .detail-comment__header > span:first-child`).innerText(), ready.markerAuthors.dead);
    assert.equal(await page.locator(`article[data-comment-id="${ready.markerIds.deletedId}"] .detail-comment__marker`).innerText(), '[removido]');
    assert.equal(await page.locator(`article[data-comment-id="${ready.markerIds.deletedId}"] .detail-comment__header > span:first-child`).innerText(), ready.markerAuthors.deleted);
    assert.equal(await page.locator(`article[data-comment-id="${ready.expectedIds.depthNineId}"]`).count(), 0);
    const depthEightId = ready.rawMeta.chainIds[7];
    assert.equal(await page.locator(`article[data-comment-id="${depthEightId}"] .detail-comment__continuation`).count(), 1);
    const selectedRootId = ready.rawMeta.rootChildIds[0]; const directChildId = ready.rawMeta.chainIds[1];
    const grandchildId = ready.rawMeta.chainIds[2];
    const rootArticle = page.locator(`article[data-comment-id="${selectedRootId}"]`);
    const rootToggle = rootArticle.locator('button.detail-comment__toggle');
    assert.equal(await rootToggle.getAttribute('aria-expanded'), 'true');
    const detailToggleFocus = await tabUntil(page, (focus) => focus.closestCommentId === String(selectedRootId) && focus.className.split(/\s+/).includes('detail-comment__toggle'), 'Tab to first primary comment collapse button');
    assert.equal(detailToggleFocus.ariaExpanded, 'true');
    result.focusObservations.push({ phase: 'comment-toggle-before-collapse', focus: detailToggleFocus });
    const branchCommentIds = await rootArticle.evaluate((article) => {
      const replies = article.parentElement?.querySelector(':scope > ol.detail-comment-tree');
      return [...(replies?.querySelectorAll('article[data-comment-id]') ?? [])].map((element) => element.getAttribute('data-comment-id'));
    });
    assert.ok(branchCommentIds.includes(String(directChildId)), 'primary root must contain the expected loaded child branch');
    const treeBeforeCollapseBff = bffSnapshot(); const treeBeforeCollapseHn = await readCounters();
    await nativePress(page, 'Enter', 'comment collapse with Enter');
    const collapsedLight = await assertCollapsedTree(page, selectedRootId, directChildId, false, 'Enter-collapsed primary comment');
    await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`article[data-comment-id="${id}"]`) === null), branchCommentIds, { timeout: 8_000 });
    await idle(page);
    const treeAfterCollapseBff = bffSnapshot(); const treeAfterCollapseHn = await readCounters();
    noRequests(treeBeforeCollapseBff, treeBeforeCollapseHn, treeAfterCollapseBff, treeAfterCollapseHn, 'comment collapse with Enter');
    await captureFocused(page, 'comment-collapsed-light-focused', { theme: 'light', key: 'Enter', commentId: selectedRootId, ariaExpanded: 'false', replySubtreePresent: false });
    result.phases.commentCollapseEnter = { focus: collapsedLight, replyArticlePresent: false, focusRetained: true, removedBranchCommentIds: branchCommentIds };

    const beforeCollapsedTabBff = bffSnapshot(); const beforeCollapsedTabHn = await readCounters();
    const collapsedTab = await nativePress(page, 'Tab', 'Tab after collapsing primary comment');
    await idle(page);
    assert.notEqual(collapsedTab.after.tag, 'body', 'native Tab should leave the collapsed comment toggle for a live focusable control');
    assert.ok(!branchCommentIds.includes(collapsedTab.after.closestCommentId), `Tab entered the removed comment branch: ${JSON.stringify(collapsedTab.after)}`);
    assertFocused(collapsedTab.after, 'native Tab after comment collapse');
    const afterCollapsedTabBff = bffSnapshot(); const afterCollapsedTabHn = await readCounters();
    noRequests(beforeCollapsedTabBff, beforeCollapsedTabHn, afterCollapsedTabBff, afterCollapsedTabHn, 'Tab after collapsing comment branch');
    result.focusObservations.push({ phase: 'comment-collapse-tab-exit', focus: collapsedTab.after, removedBranchCommentIds: branchCommentIds });
    const rootFocusRestored = await nativePress(page, 'Shift+Tab', 'Shift+Tab back to collapsed primary comment toggle');
    assert.equal(rootFocusRestored.after.closestCommentId, String(selectedRootId));
    assert.ok(rootFocusRestored.after.className.split(/\s+/).includes('detail-comment__toggle'));
    assertFocused(rootFocusRestored.after, 'primary comment toggle after reverse Tab');

    const treeBeforeExpandBff = bffSnapshot(); const treeBeforeExpandHn = await readCounters();
    await nativePress(page, 'Space', 'comment expand with Space');
    const expandedLight = await assertCollapsedTree(page, selectedRootId, directChildId, true, 'Space-expanded primary comment');
    await idle(page);
    const treeAfterExpandBff = bffSnapshot(); const treeAfterExpandHn = await readCounters();
    noRequests(treeBeforeExpandBff, treeBeforeExpandHn, treeAfterExpandBff, treeAfterExpandHn, 'comment expand with Space');
    await captureFocused(page, 'comment-expanded-light-focused', { theme: 'light', key: 'Space', commentId: selectedRootId, ariaExpanded: 'true', replySubtreePresent: true });
    result.phases.commentExpandSpace = { focus: expandedLight, replyArticlePresent: true, focusRetained: true };

    const childToggleFocus = await tabUntil(page, (focus) => focus.closestCommentId === String(directChildId) && focus.className.split(/\s+/).includes('detail-comment__toggle'), 'Tab into loaded child comment');
    assert.equal(childToggleFocus.ariaExpanded, 'true');
    result.focusObservations.push({ phase: 'loaded-child-comment-toggle', focus: childToggleFocus });
    const childBeforeCollapseBff = bffSnapshot(); const childBeforeCollapseHn = await readCounters();
    await nativePress(page, 'Space', 'loaded child comment collapse with Space');
    const childCollapsed = await assertCollapsedTree(page, directChildId, grandchildId, false, 'Space-collapsed loaded child comment');
    await idle(page);
    const childAfterCollapseBff = bffSnapshot(); const childAfterCollapseHn = await readCounters();
    noRequests(childBeforeCollapseBff, childBeforeCollapseHn, childAfterCollapseBff, childAfterCollapseHn, 'loaded child comment collapse with Space');
    result.phases.childCommentCollapseSpace = { focus: childCollapsed, removedChildId: grandchildId, focusRetained: true };

    const childBeforeExpandBff = bffSnapshot(); const childBeforeExpandHn = await readCounters();
    await nativePress(page, 'Enter', 'loaded child comment expand with Enter');
    const childExpanded = await assertCollapsedTree(page, directChildId, grandchildId, true, 'Enter-expanded loaded child comment');
    await idle(page);
    const childAfterExpandBff = bffSnapshot(); const childAfterExpandHn = await readCounters();
    noRequests(childBeforeExpandBff, childBeforeExpandHn, childAfterExpandBff, childAfterExpandHn, 'loaded child comment expand with Enter');
    result.phases.childCommentExpandEnter = { focus: childExpanded, childId: grandchildId, focusRetained: true };
    await tabUntil(page, (focus) => focus.closestCommentId === String(selectedRootId) && focus.className.split(/\s+/).includes('detail-comment__toggle'), 'Shift+Tab back to primary comment toggle', 'Shift+Tab');
    await tabUntil(page, (focus) => focus.className.split(/\s+/).includes('theme-toggle') && focus.name === themeButtonName, 'Shift+Tab from primary comment toggle to detail theme control', 'Shift+Tab');
    const darkDetail = await keyboardThemeChange(page, 'Space', 'dark', 'detail theme Space to dark');
    const detailRootFocus = await tabUntil(page, (focus) => focus.closestCommentId === String(selectedRootId) && focus.className.split(/\s+/).includes('detail-comment__toggle'), 'Tab back to primary comment toggle in dark theme');
    assert.equal(detailRootFocus.ariaExpanded, 'true');
    const darkBeforeCollapseBff = bffSnapshot(); const darkBeforeCollapseHn = await readCounters();
    await nativePress(page, 'Enter', 'dark comment collapse with Enter');
    const collapsedDark = await assertCollapsedTree(page, selectedRootId, directChildId, false, 'dark Enter-collapsed primary comment');
    await idle(page);
    const darkAfterCollapseBff = bffSnapshot(); const darkAfterCollapseHn = await readCounters();
    noRequests(darkBeforeCollapseBff, darkBeforeCollapseHn, darkAfterCollapseBff, darkAfterCollapseHn, 'dark comment collapse with Enter');
    result.phases.commentCollapseDarkEnter = { focus: collapsedDark, theme: darkDetail.manual, replyArticlePresent: false, focusRetained: true };
    const darkBeforeExpandBff = bffSnapshot(); const darkBeforeExpandHn = await readCounters();
    await nativePress(page, 'Space', 'dark comment expand with Space');
    const expandedDark = await assertCollapsedTree(page, selectedRootId, directChildId, true, 'dark Space-expanded primary comment');
    await idle(page);
    const darkAfterExpandBff = bffSnapshot(); const darkAfterExpandHn = await readCounters();
    noRequests(darkBeforeExpandBff, darkBeforeExpandHn, darkAfterExpandBff, darkAfterExpandHn, 'dark comment expand with Space');
    await captureFocused(page, 'comment-expanded-dark-focused', { theme: 'dark', key: 'Space', commentId: selectedRootId, ariaExpanded: 'true', replySubtreePresent: true });
    result.phases.commentExpandDarkSpace = { focus: expandedDark, theme: darkDetail.manual, replyArticlePresent: true, focusRetained: true };

    assert.equal(result.screenshots.length >= 6 && result.screenshots.length <= 8, true, `expected 6-8 meaningful focused screenshots, got ${result.screenshots.length}`);
    assert.deepEqual(errors.page, [], 'browser page errors must be empty');
    assert.deepEqual(errors.http, [], 'browser HTTP errors must be empty');
    assert.deepEqual(errors.requests, [], 'browser failed requests must be empty');
    assert.deepEqual(errors.unexpectedBff, [], 'browser must only issue expected real BFF requests');
    assert.deepEqual(errors.console, [], 'browser console errors must be empty');
    const finalCounters = await readCounters();
    assert.deepEqual(finalCounters.unexpectedUpstreamPaths, [], 'private HN fixture saw unexpected paths');
    assert.ok(browserOrigins.has(baseOrigin)); assert.equal(browserOrigins.has(new URL(ready.upstreamBaseUrl).origin), false, 'browser must not call the private raw HN origin directly');
    assert.equal(result.interactionMethod.pageRouteInterceptionUsed, false); assert.equal(result.interactionMethod.DOMFocusOrEventDispatchUsed, false);
    result.apiRequests = apiRequests;
    result.browserOrigins = [...browserOrigins].sort();
    result.phases.detail = { url: page.url(), storyId: ready.storyId, visibleCommentCount: 220, totalCommentCount: 221, defaultDepth: 8, depthNineContinuation: ready.expectedIds.depthNineId, markers: ready.markerIds, commentsPayloadRootCount: commentsData.nodes.length, itemTitle: itemData.item.title, theme: darkDetail.manual };
    result.phases.completedAt = new Date().toISOString();
    await context.close();
  }

  function waitForExit(child, ms) {
    if (child.exitCode !== null || child.signalCode) return Promise.resolve(true);
    return new Promise((resolve) => {
      let timer;
      const done = () => { if (timer) clearTimeout(timer); resolve(true); };
      child.once('exit', done);
      timer = setTimeout(() => resolve(false), ms);
    });
  }

  async function stopOwnedStarter() {
    if (!starter) return;
    if (!starter.pid) { result.starterLifecycle.spawnError = spawnError?.message ?? 'starter process did not receive a PID'; return; }
    let forced = false;
    if (starter.exitCode === null && !starter.signalCode) {
      result.starterLifecycle.stopSignal = 'SIGTERM'; starter.kill('SIGTERM');
      if (!await waitForExit(starter, 6_500)) { forced = true; result.starterLifecycle.forceSignal = 'SIGKILL'; starter.kill('SIGKILL'); await waitForExit(starter, 500); }
    }
    result.starterLifecycle.forced = forced; result.starterLifecycle.exitCode = starter.exitCode; result.starterLifecycle.exitSignal = starter.signalCode;
    try {
      result.starterLifecycle.stopped = JSON.parse(await readFile(stoppedPath, 'utf8'));
      assert.equal(result.starterLifecycle.stopped.helperPid, starter.pid); assert.equal(result.starterLifecycle.stopped.closeCompleted, true);
      assert.equal(result.starterLifecycle.stopped.gate.released, true);
    } catch (error) { result.starterLifecycle.stopError = error instanceof Error ? error.message : String(error); if (!forced) throw error; }
    if (forced || (starter.exitCode !== 0 && starter.signalCode !== 'SIGTERM')) throw new Error('Owned keyboard fixture starter did not stop gracefully.');
  }

  async function run() {
    let cleanupError;
    try {
      process.once('SIGINT', onSigint); process.once('SIGTERM', onSigterm);
      if (!safeEvidence) throw new Error('evidenceDir must be a new directory under /tmp and outside ROOT/helper workspace.');
      await mkdir(evidence, { recursive: true });
      const existing = await readdir(evidence);
      if (existing.length !== 0) throw new Error(`evidenceDir must be empty before use; found ${existing.length} entries.`);
      await mkdir(screenshotDir, { recursive: true }); evidenceOwned = true;
      if (Number(process.versions.node.split('.')[0]) < 24) throw new Error(`Node.js 24+ is required; found ${process.version}.`);
      const { chromium } = createRequire(path.join(ROOT, 'package.json'))('@playwright/test');
      result.starterLifecycle = { path: starterPath, command: [process.execPath, starterPath, ROOT, evidence], pid: null, stopSignal: null };
      starter = spawn(process.execPath, [starterPath, ROOT, evidence], { stdio: ['ignore', 'pipe', 'pipe'] });
      result.starterLifecycle.pid = starter.pid; result.starterLogs = { stdout: '', stderr: '' };
      const keepLog = (name, chunk) => { result.starterLogs[name] = (result.starterLogs[name] + chunk.toString()).slice(-20_000); };
      starter.stdout.on('data', (chunk) => keepLog('stdout', chunk)); starter.stderr.on('data', (chunk) => keepLog('stderr', chunk)); starter.on('error', (error) => { spawnError = error; });
      ready = await Promise.race([waitReady(), interrupted.then((signal) => { throw new Error(`Interrupted by ${signal}.`); })]);
      ports = validateReady(ready); baseOrigin = new URL(ready.baseUrl).origin;
      result.fixture = { helperPid: ready.helperPid, fixtureAppPid: ready.fixtureAppPid, rawUpstreamPid: ready.rawUpstreamPid, baseUrl: ready.baseUrl, appPort: ports.appPort, upstreamBaseUrl: ready.upstreamBaseUrl, upstreamPort: ports.upstreamPort, topStoryCount: ready.topIds.length, pageSize: ready.rawMeta.defaultPageSize, page2ItemCount: ready.page2Ids.length, commentsVisible: 220, commentsTotal: 221, primaryStoryId: ready.storyId, jobId: ready.jobId, markerAuthors: ready.markerAuthors, gate: { statusUrl: ready.gateStatusUrl, releaseUrl: ready.gateReleaseUrl, timeoutMs: ready.rawMeta.hnClientTimeoutMs, autoReleaseMs: ready.rawMeta.gateAutoReleaseMs } };
      const initialGate = await readGate(); assert.equal(initialGate.hits.length, 0); assert.equal(initialGate.released, false);
      result.initialFixtureCounters = await readCounters(); result.initialBffRequestCounts = bffSnapshot();
      assert.deepEqual(result.initialBffRequestCounts, {}, 'browser BFF counters must be cold before browser startup');
      assert.ok(Object.values(result.initialFixtureCounters.itemRequests).every((count) => count === 0), 'raw HN item counters must be cold before browser startup');
      assert.ok(Object.values(result.initialFixtureCounters.listRequests).every((count) => count === 0), 'raw HN list counters must be cold before browser startup');
      browser = await chromium.launch({ headless: true, timeout: 10_000 }); result.runtime.browser = browser.version();
      qaTask = executeQA(browser); qaTask.catch(() => {});
      const remaining = Math.max(1, 120_000 - (Date.now() - startedMs));
      await Promise.race([bounded(qaTask, remaining, 'Keyboard QA exceeded the 120-second total deadline.'), interrupted.then((signal) => { throw new Error(`Interrupted by ${signal}.`); })]);
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed'; result.failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
      if (!result.interrupted) process.exitCode = 1;
    } finally {
      if (ready) try { result.gateCleanup = await bounded(releaseGate('driver-finally'), 5_000, 'Page-2 gate cleanup request timed out.'); }
      catch (error) { cleanupError = error instanceof Error ? error.message : String(error); }
      for (const controller of activeCounterRequests) controller.abort();
      if (browser) try { await bounded(browser.close(), 5_000, 'Owned Chromium close timed out.'); }
      catch (error) { cleanupError ??= error instanceof Error ? error.message : String(error); process.exitCode = 1; }
      if (qaTask) try { await bounded(qaTask.catch(() => {}), 3_000, 'Keyboard QA task did not drain after Chromium close.'); }
      catch (error) { cleanupError ??= error instanceof Error ? error.message : String(error); process.exitCode = 1; }
      process.removeListener('SIGINT', onSigint); process.removeListener('SIGTERM', onSigterm);
      if (ready && ports) {
        try { result.finalFixtureCounters = await readCounters(); result.finalGate = await readGate(); result.portObservation = { appPort: ports.appPort, upstreamPort: ports.upstreamPort, appReachableAfterBrowserClose: true }; }
        catch (error) { result.portObservation = { appPort: ports.appPort, upstreamPort: ports.upstreamPort, appReachableAfterBrowserClose: false }; cleanupError ??= error instanceof Error ? error.message : String(error); }
      }
      try { await stopOwnedStarter(); } catch (error) { cleanupError ??= error instanceof Error ? error.message : String(error); }
      result.finishedAt = new Date().toISOString(); result.runtime.elapsedMs = Date.now() - startedMs;
      result.bffRequestCounts = bffSnapshot(); result.browserOrigins = [...browserOrigins].sort(); result.errors = errors;
      if (cleanupError) { result.cleanupError = cleanupError; result.status = 'failed'; process.exitCode = 1; }
      if (evidenceOwned) try { await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); }
      catch (error) { console.error(`Could not write result JSON: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    }
    console.log(JSON.stringify({ status: result.status, resultPath: evidenceOwned ? resultPath : null, screenshots: result.screenshots.length, failure: result.failure?.message ?? null }));
  }

  await run();
}
