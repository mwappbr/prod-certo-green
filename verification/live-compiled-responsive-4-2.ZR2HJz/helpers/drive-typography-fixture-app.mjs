import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [rootArg, evidenceArg, ...extra] = process.argv.slice(2);
if (!rootArg || !evidenceArg || extra.length) {
  console.error('Usage: node drive-typography-fixture-app.mjs <ROOT> <evidenceDir>');
  process.exitCode = 64;
} else {
  const ROOT = path.resolve(rootArg);
  const evidence = path.resolve(evidenceArg);
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const safeEvidence = [path.resolve('/tmp'), path.resolve('/private/tmp')].some((tempRoot) => within(evidence, tempRoot)) && !within(evidence, ROOT) && !within(evidence, scriptsDir);
  const starterPath = path.join(scriptsDir, 'start-theme-fixture-app.mjs');
  const readyPath = path.join(evidence, 'fixture-ready.json');
  const failedPath = path.join(evidence, 'fixture-failure.json');
  const stoppedPath = path.join(evidence, 'fixture-stopped.json');
  const resultPath = path.join(evidence, 'actual-result.json');
  const screenshotDir = path.join(evidence, 'screenshots');
  const themeKey = 'hn-modernizacao.theme.preference.v1';
  const themeButtonName = 'Alternar tema claro e escuro';
  const tokenNames = ['--surface-base', '--surface-raised', '--ink-primary', '--ink-secondary', '--primary', '--primary-foreground', '--primary-hover', '--border-hairline'];
  const themeTokenBaselines = { light: null, dark: null };
  const startedMs = Date.now();
  const bffCounts = new Map(); const browserOrigins = new Set();
  const errors = { page: [], console: [], http: [], requests: [], unexpectedBff: [] };
  const activeCounterRequests = new Set();
  const result = {
    protocolVersion: 1, status: 'running', startedAt: new Date(startedMs).toISOString(), helperPid: process.pid,
    arguments: { rootPath: ROOT, evidenceDir: evidence }, runtime: { node: process.version },
    limits: { readinessMs: 10_000, totalMs: 90_000, counterFetchMs: 5_000, navigationMs: 10_000, starterStopMs: 7_000, maxScreenshots: 8 },
    proxyLimits: { nativeBrowserZoom: false, systemDisplayScale: false, assistiveTechnology: false, deviceScaleFactor: 1, initialLoadedDomOnly: true, method: 'test-only fixed CSS-pixel font/line-height overrides on every styled DOM element except html; recreated subtrees are not native persistent text zoom' },
    firstPaintProof: { captured: false, note: 'Screenshots are post-render; no pre-style/pre-React timing claim.' },
    publicHnOrPerformanceClaim: false, phases: {}, screenshots: [], themeProof: [], typographySnapshots: [], targetMeasurements: [], layoutSnapshots: [], networkChecks: [], errors,
  };
  let ready; let ports; let baseOrigin; let browser; let starter; let qaTask; let starterError = null; let stopResolve;
  const interrupted = new Promise((resolve) => { stopResolve = resolve; });
  const onSigint = () => { result.interrupted = 'SIGINT'; process.exitCode = 130; stopResolve('SIGINT'); };
  const onSigterm = () => { result.interrupted = 'SIGTERM'; process.exitCode = 143; stopResolve('SIGTERM'); };

  function within(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function bounded(promise, ms, message) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  function snapshotBff() { return Object.fromEntries([...bffCounts.entries()].sort(([a], [b]) => a.localeCompare(b))); }

  async function waitReady() {
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      if (starterError) throw starterError;
      if (starter && (starter.exitCode !== null || starter.signalCode)) throw new Error(`Fixture starter exited early (${starter.exitCode ?? starter.signalCode}). ${result.starterLogs?.stderr ?? ''}`);
      try {
        const failure = JSON.parse(await readFile(failedPath, 'utf8'));
        if (failure.status === 'failed') throw new Error(`Fixture startup failed: ${failure.message ?? 'no detail'}`);
      } catch (error) { if (error instanceof Error && error.message.startsWith('Fixture startup failed:')) throw error; }
      try { const value = JSON.parse(await readFile(readyPath, 'utf8')); if (value.status === 'ready' && value.protocolVersion === 1) return value; } catch {}
      await sleep(100);
    }
    throw new Error('Fixture starter readiness exceeded 10 seconds.');
  }

  function validateReady(record) {
    const app = new URL(record.baseUrl); const counter = new URL(record.countersUrl); const upstream = new URL(record.upstreamBaseUrl);
    assert.equal(app.protocol, 'http:'); assert.equal(app.hostname, '127.0.0.1'); assert.ok(Number(app.port) > 0);
    assert.equal(counter.origin, app.origin); assert.equal(counter.pathname, '/__test/hn-counters');
    assert.equal(upstream.protocol, 'http:'); assert.equal(upstream.hostname, '127.0.0.1'); assert.ok(Number(upstream.port) > 0);
    assert.equal(record.expectedIds.visibleCommentCount, 220); assert.equal(record.expectedIds.allCommentCount, 221);
    assert.ok(record.storyId && record.jobId && Number.isInteger(record.helperPid) && record.helperPid > 0);
    assert.ok(record.rawMeta.storyTitle && record.rawMeta.storyDomain && record.rawMeta.safeHref && record.rawMeta.longAnchorText);
    return { appPort: Number(app.port), upstreamPort: Number(upstream.port) };
  }

  async function readCounters() {
    const controller = new AbortController(); activeCounterRequests.add(controller);
    const timer = setTimeout(() => controller.abort(new Error('Counter request exceeded 5 seconds.')), 5_000);
    try {
      const url = new URL(ready.countersUrl);
      url.searchParams.set('ids', [ready.storyId, ...ready.expectedIds.allCommentIds, ready.jobId].join(','));
      const response = await fetch(url, { signal: controller.signal });
      assert.equal(response.status, 200, 'fixture counter response');
      const value = await response.json();
      assert.ok(value.itemRequests && value.listRequests && Array.isArray(value.unexpectedUpstreamPaths));
      return value;
    } finally { clearTimeout(timer); activeCounterRequests.delete(controller); }
  }

  function observe(page, allowed) {
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') browserOrigins.add(url.origin);
      if (url.origin === baseOrigin && url.pathname.startsWith('/api/')) {
        const key = `${request.method()} ${url.pathname}${url.search}`;
        bffCounts.set(key, (bffCounts.get(key) ?? 0) + 1);
        if (!allowed.has(url.pathname)) errors.unexpectedBff.push(key);
      }
    });
    page.on('pageerror', (error) => errors.page.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
    page.on('response', (response) => { const url = new URL(response.url()); if (url.origin === baseOrigin && response.status() >= 400) errors.http.push({ status: response.status(), url: response.url() }); });
    page.on('requestfailed', (request) => { const url = new URL(request.url()); if (url.origin === baseOrigin) errors.requests.push({ url: request.url(), error: request.failure()?.errorText ?? 'failed' }); });
  }
  function waitResponse(page, pathname, query = () => true) {
    return page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === baseOrigin && url.pathname === pathname && response.request().method() === 'GET' && query(url);
    }, { timeout: 10_000 });
  }
  async function json200(response, label) { assert.equal(response.status(), 200, `${label} HTTP response`); return response.json(); }
  async function idle(page) { await page.waitForLoadState('networkidle', { timeout: 5_000 }); }

  async function themeState(page) {
    return page.evaluate((key) => {
      const root = document.documentElement; const style = getComputedStyle(root);
      let preference; try { preference = sessionStorage.getItem(key); } catch { preference = '[[blocked]]'; }
      return {
        system: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        manual: root.getAttribute('data-theme'), preference, colorScheme: style.colorScheme,
        pressed: document.querySelector('button.theme-toggle')?.getAttribute('aria-pressed') ?? null,
      };
    }, themeKey);
  }
  async function readTheme(page) {
    const state = await themeState(page);
    const actual = await page.evaluate((names) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim().toLowerCase()]));
    }, tokenNames);
    return { ...state, tokens: actual };
  }
  async function waitTheme(page, theme, manual, preference) {
    await page.waitForFunction(({ expected, isManual, key, stored, names }) => {
      const root = document.documentElement; const style = getComputedStyle(root);
      let value; try { value = sessionStorage.getItem(key); } catch { value = '[[blocked]]'; }
      const pressed = document.querySelector('button.theme-toggle')?.getAttribute('aria-pressed') ?? null;
      return root.getAttribute('data-theme') === (isManual ? expected : null) && value === stored &&
        pressed === String(expected === 'dark') && style.colorScheme === expected &&
        names.every((name) => style.getPropertyValue(name).trim() !== '');
    }, { expected: theme, isManual: manual, key: themeKey, stored: preference, names: tokenNames }, { timeout: 8_000 });
    const state = await readTheme(page);
    assert.equal(state.manual, manual ? theme : null); assert.equal(state.preference, preference);
    assert.equal(state.pressed, String(theme === 'dark')); assert.equal(state.colorScheme, theme);
    assert.ok(tokenNames.every((name) => state.tokens[name]), 'computed theme token values must be present');
    const baseline = themeTokenBaselines[theme];
    if (baseline === null) themeTokenBaselines[theme] = state.tokens;
    else assert.deepEqual(state.tokens, baseline, `${theme} computed token values changed unexpectedly`);
    if (themeTokenBaselines.light && themeTokenBaselines.dark) {
      assert.notEqual(themeTokenBaselines.light['--surface-base'], themeTokenBaselines.dark['--surface-base'], 'light/dark surface tokens must differ');
      assert.notEqual(themeTokenBaselines.light['--ink-primary'], themeTokenBaselines.dark['--ink-primary'], 'light/dark primary ink tokens must differ');
    }
    result.themeProof.push({ at: new Date().toISOString(), theme, mode: manual ? 'manual' : 'system', ...state });
    return state;
  }
  async function noNetwork(page, label, action) {
    await idle(page); const bffBefore = snapshotBff(); const hnBefore = await readCounters();
    await action(); await idle(page);
    const bffAfter = snapshotBff(); const hnAfter = await readCounters();
    assert.deepEqual(bffAfter, bffBefore, `${label}: BFF delta must be zero`);
    assert.deepEqual(hnAfter, hnBefore, `${label}: fixture HN delta must be zero`);
    result.networkChecks.push({ label, bffBefore, bffAfter, hnBefore, hnAfter, unchanged: true });
  }
  async function switchTheme(page, theme, label) {
    const before = await readTheme(page);
    if (before.colorScheme !== theme || before.manual !== theme) {
      const button = page.getByRole('button', { name: themeButtonName }); await button.scrollIntoViewIfNeeded();
      await noNetwork(page, label, async () => { await button.click(); await waitTheme(page, theme, true, theme); });
    } else await waitTheme(page, theme, true, theme);
  }
  async function setSystem(page, scheme, manual, expectedTheme, stored, label) {
    await noNetwork(page, label, async () => {
      await page.emulateMedia({ colorScheme: scheme });
      const state = await waitTheme(page, expectedTheme, manual, stored);
      assert.equal(state.system, scheme, 'matchMedia emulation must change the reported system mode');
    });
  }

  async function measureTargets(page, screen, width, scale) {
    const tabTargets = [];
    if (screen === 'list') {
      const tabs = page.getByRole('tab'); assert.equal(await tabs.count(), 6, 'six category tabs');
      const list = page.getByRole('tablist');
      for (let i = 0; i < 6; i += 1) {
        const tab = tabs.nth(i); await tab.scrollIntoViewIfNeeded();
        const box = await tab.boundingBox(); const parent = await list.boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, `tab ${i + 1} target <44×44`);
        assert.ok(parent && box.x >= parent.x - 1 && box.x + box.width <= parent.x + parent.width + 1, `tab ${i + 1} not scrolled into tablist`);
        tabTargets.push({ width: box.width, height: box.height });
      }
    }
    const groups = await page.evaluate((view) => {
      const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
      const map = {
        buttons: 'button', theme: 'button.theme-toggle', storyLink: 'a.story-row__detail', storySource: 'a.story-row__source',
        detailSource: 'a.detail__source', commentAnchor: '.detail-comment__body a', commentToggle: 'button.detail-comment__toggle',
      };
      const out = {};
      for (const [name, selector] of Object.entries(map)) {
        if ((view === 'list' && ['detailSource', 'commentAnchor', 'commentToggle'].includes(name)) ||
            (view === 'detail' && ['storyLink', 'storySource'].includes(name))) continue;
        out[name] = [...document.querySelectorAll(selector)].filter(visible).map((el) => {
          const rect = el.getBoundingClientRect();
          return { tag: el.tagName.toLowerCase(), className: typeof el.className === 'string' ? el.className.slice(0, 100) : '', width: rect.width, height: rect.height };
        });
      }
      return out;
    }, screen);
    for (const [name, entries] of Object.entries(groups)) {
      assert.ok(entries.length > 0, `${screen}: required target group ${name} missing`);
      for (const entry of entries) assert.ok(entry.width >= 44 && entry.height >= 44, `${name} target <44×44: ${JSON.stringify(entry)}`);
    }
    result.targetMeasurements.push({ at: new Date().toISOString(), screen, width, scale, tabs: tabTargets, groups });
    return groups;
  }

  async function layoutProof(page, screen, width, scale, label) {
    const proof = await page.evaluate(() => {
      const root = document.documentElement;
      const selectors = ['button', '[role="tab"]', '.story-row__detail', '.story-row__title', '.story-row__meta', '.story-row__source', '.detail__title', '.detail__meta', '.detail__source', '.detail-comment__body', '.detail-comment__body a'];
      const clipped = [];
      for (const selector of selectors) for (const el of document.querySelectorAll(selector)) {
        if (!el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        const horizontal = el.scrollWidth > el.clientWidth + 1 && style.overflowX !== 'visible';
        const vertical = el.scrollHeight > el.clientHeight + 1 && style.overflowY !== 'visible';
        if (horizontal || vertical) clipped.push({ selector, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowX: style.overflowX, overflowY: style.overflowY, textOverflow: style.textOverflow });
      }
      return { innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, bodyScrollWidth: document.body.scrollWidth, dpr: devicePixelRatio, scale: visualViewport?.scale ?? null, clipped };
    });
    assert.equal(proof.innerWidth, width); assert.equal(proof.dpr, 1); assert.equal(proof.scale, 1);
    assert.ok(proof.scrollWidth <= proof.clientWidth && proof.bodyScrollWidth <= proof.clientWidth, `${label}: horizontal overflow ${JSON.stringify(proof)}`);
    assert.deepEqual(proof.clipped, [], `${label}: clipped content`);
    result.layoutSnapshots.push({ at: new Date().toISOString(), screen, width, scale, ...proof });
    return proof;
  }

  async function representative(page, selector) {
    return page.evaluate((query) => {
      const el = document.querySelector(query); if (!el) throw new Error(`Missing typography representative ${query}`);
      const font = Number.parseFloat(getComputedStyle(el).fontSize);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node; let rect = null;
      while ((node = walker.nextNode())) {
        const offset = (node.textContent ?? '').search(/\S/);
        if (offset >= 0) { const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1); rect = range.getBoundingClientRect(); break; }
      }
      if (!rect || !rect.height) throw new Error(`No visible glyph in ${query}`);
      return { selector: query, fontSizePx: font, glyphHeightPx: rect.height, glyphWidthPx: rect.width };
    }, selector);
  }

  async function applySynthetic200(page, selector) {
    const proof = await page.evaluate((representativeSelector) => {
      const root = document.documentElement;
      const all = [root, ...[...document.querySelectorAll('*')].filter((el) => el !== root && el.style)];
      const originals = []; const snapshot = [];
      for (const [index, el] of all.entries()) {
        const style = getComputedStyle(el); const font = Number.parseFloat(style.fontSize);
        const parsedLine = Number.parseFloat(style.lineHeight); const line = Number.isFinite(parsedLine) ? parsedLine : font * 1.2;
        originals.push({ el, font: el.style.getPropertyValue('font-size'), fontPriority: el.style.getPropertyPriority('font-size'), line: el.style.getPropertyValue('line-height'), linePriority: el.style.getPropertyPriority('line-height') });
        snapshot.push({ index, tag: el.tagName.toLowerCase(), id: el.id || '', className: typeof el.className === 'string' ? el.className.slice(0, 80) : '', fontSizePx: font, lineHeightPx: line, lineHeightSource: Number.isFinite(parsedLine) ? 'computed' : 'normal-derived-1.2em', appliedFontSizePx: el === root ? null : font * 2, appliedLineHeightPx: el === root ? null : line * 2 });
      }
      const glyph = (el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) { const offset = (node.textContent ?? '').search(/\S/); if (offset >= 0) { const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1); return range.getBoundingClientRect().height; } }
        return 0;
      };
      const sample = document.querySelector(representativeSelector); if (!sample) throw new Error(`Missing representative ${representativeSelector}`);
      const originalFont = Number.parseFloat(getComputedStyle(sample).fontSize); const originalGlyph = glyph(sample); const rootFontBefore = Number.parseFloat(getComputedStyle(root).fontSize);
      window.__qa42TypographyOriginals = originals;
      for (const row of snapshot) {
        if (row.index === 0) continue;
        const el = originals[row.index].el;
        el.style.setProperty('font-size', `${row.appliedFontSizePx}px`, 'important');
        el.style.setProperty('line-height', `${row.appliedLineHeightPx}px`, 'important');
      }
      for (const row of snapshot) {
        const style = getComputedStyle(originals[row.index].el);
        const postFont = Number.parseFloat(style.fontSize); const postLine = Number.parseFloat(style.lineHeight);
        row.computedFontSizePx = postFont; row.computedLineHeightPx = Number.isFinite(postLine) ? postLine : postFont * 1.2;
      }
      const appliedFont = Number.parseFloat(getComputedStyle(sample).fontSize); const appliedGlyph = glyph(sample);
      return { method: 'fixed-px per styled DOM element; no html root font-size, zoom, transform, DPR or app stylesheet changes', rootFontBeforePx: rootFontBefore, rootFontAfterPx: Number.parseFloat(getComputedStyle(root).fontSize), representative: representativeSelector, representativeFontBeforePx: originalFont, representativeFontAfterPx: appliedFont, fontRatio: appliedFont / originalFont, glyphHeightBeforePx: originalGlyph, glyphHeightAfterPx: appliedGlyph, glyphHeightRatio: appliedGlyph / originalGlyph, elementCount: snapshot.length, originalsAndApplied: snapshot };
    }, selector);
    assert.equal(proof.rootFontAfterPx, proof.rootFontBeforePx, 'html root font size must remain unchanged');
    assert.ok(proof.fontRatio >= 1.98 && proof.fontRatio <= 2.02, `computed representative font must be 2×: ${proof.fontRatio}`);
    assert.ok(proof.glyphHeightRatio >= 1.8, `rendered glyph range height must grow ≥1.8×: ${proof.glyphHeightRatio}`);
    assert.ok(proof.originalsAndApplied.length > 1 && proof.originalsAndApplied.every((entry) => Number.isFinite(entry.fontSizePx) && Number.isFinite(entry.lineHeightPx) && Number.isFinite(entry.computedFontSizePx) && Number.isFinite(entry.computedLineHeightPx)));
    assert.ok(proof.originalsAndApplied.slice(1).every((entry) => Math.abs(entry.computedFontSizePx - entry.appliedFontSizePx) < 0.02 && Math.abs(entry.computedLineHeightPx - entry.appliedLineHeightPx) < 0.02), 'all non-root HTMLElement font and line-height values must equal the fixed-pixel 2× snapshot');
    assert.ok(Math.abs(proof.originalsAndApplied[0].computedFontSizePx - proof.originalsAndApplied[0].fontSizePx) < 0.02, 'html root font-size must remain unchanged');
    result.typographySnapshots.push({ at: new Date().toISOString(), scale: 2, ...proof });
    return proof;
  }

  async function restoreTypography(page) {
    await page.evaluate(() => {
      const records = window.__qa42TypographyOriginals ?? [];
      for (const row of records) {
        if (row.font) row.el.style.setProperty('font-size', row.font, row.fontPriority); else row.el.style.removeProperty('font-size');
        if (row.line) row.el.style.setProperty('line-height', row.line, row.linePriority); else row.el.style.removeProperty('line-height');
      }
      delete window.__qa42TypographyOriginals;
    });
  }

  async function screenshot(page, screen, theme, width, scale) {
    const name = `${screen}-${width}-${theme}-${scale === 1 ? '100' : '200'}`;
    const file = path.join(screenshotDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
    result.screenshots.push({ name, path: file, screen, theme, width, scale, height: 820 });
  }

  async function renderCase(page, screen, theme, width, scale, representativeSelector) {
    await switchTheme(page, theme, `${screen} ${width}px theme=${theme}`);
    await page.setViewportSize({ width, height: 820 }); await idle(page);
    await waitTheme(page, theme, true, theme);
    if (screen === 'list') await page.evaluate(() => { window.scrollTo(0, 0); const list = document.querySelector('.category-tabs__list'); if (list) list.scrollLeft = 0; });
    else await page.evaluate(() => window.scrollTo(0, 0));
    let syntheticProof = null;
    if (scale === 2) {
      await noNetwork(page, `${screen} ${width}px synthetic 200% font`, async () => {
        syntheticProof = await applySynthetic200(page, representativeSelector);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (screen === 'detail') await page.locator(`article[data-comment-id="${ready.rawMeta.safeCommentId}"]`).scrollIntoViewIfNeeded();
        await waitTheme(page, theme, true, theme);
        await layoutProof(page, screen, width, 2, `${screen} ${width}px 200%`);
        await screenshot(page, screen, theme, width, 2);
        await measureTargets(page, screen, width, 2);
        if (screen === 'detail') result.phases[`collapse-${width}-synthetic-200`] = await checkCollapse(page, `${width}px synthetic 200%`);
        await restoreTypography(page);
      });
    } else {
      await layoutProof(page, screen, width, 1, `${screen} ${width}px 100%`);
      await screenshot(page, screen, theme, width, 1);
      await measureTargets(page, screen, width, 1);
    }
    const normal = await representative(page, representativeSelector);
    result.phases[`${screen}-${width}-${theme}-${scale}`] = { at: new Date().toISOString(), route: new URL(page.url()).pathname, scale, theme, representative: syntheticProof ? { fontRatio: syntheticProof.fontRatio, glyphHeightRatio: syntheticProof.glyphHeightRatio } : normal };
  }

  async function checkCategories(page) {
    const categories = [['new', 'New'], ['best', 'Best'], ['ask', 'Ask'], ['show', 'Show'], ['job', 'Jobs']];
    for (const [category, label] of categories) {
      const response = waitResponse(page, '/api/stories', (url) => url.searchParams.get('category') === category);
      await page.getByRole('tab', { name: label }).click();
      const data = await json200(await response, `${label} category`); await idle(page);
      assert.equal(await page.getByRole('tab', { name: label }).getAttribute('aria-selected'), 'true');
      const expectedId = category === 'job' ? ready.jobId : ready.storyId;
      assert.ok(data.items.some((item) => item.id === expectedId), `${label} list should contain its private fixture item`);
      result.phases[`category-${category}`] = { at: new Date().toISOString(), itemIds: data.items.map((item) => item.id), selected: label };
    }
    await page.getByRole('tab', { name: 'Top' }).click();
    await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Top', undefined, { timeout: 8_000 });
    await idle(page);
  }

  async function checkCollapse(page, label = '100%') {
    const id = ready.rawMeta.chainIds[3]; const child = ready.rawMeta.chainIds[4];
    const article = page.locator(`article[data-comment-id="${id}"]`); const button = article.locator('button.detail-comment__toggle');
    await button.waitFor({ state: 'visible' });
    const buttonFontBeforePx = await button.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    await noNetwork(page, `comment collapse ${label}`, async () => {
      await button.click(); assert.equal(await button.getAttribute('aria-expanded'), 'false');
      assert.equal(await article.locator('.detail-comment__body').count(), 0);
      assert.equal(await page.locator(`article[data-comment-id="${child}"]`).count(), 0);
    });
    await noNetwork(page, `comment expand ${label}`, async () => {
      await button.click(); assert.equal(await button.getAttribute('aria-expanded'), 'true');
      await article.locator('.detail-comment__body').waitFor({ state: 'visible' });
      await page.locator(`article[data-comment-id="${child}"]`).waitFor({ state: 'visible' });
    });
    const buttonFontAfterPx = await button.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    assert.equal(buttonFontAfterPx, buttonFontBeforePx, `${label}: retained toggle font must not change`);
    return { id, child, label, buttonFontBeforePx, buttonFontAfterPx, recreatedSubtreeScaleNotClaimed: true };
  }

  async function executeQA() {
    const allowed = new Set(['/api/stories', `/api/items/${ready.storyId}`, `/api/items/${ready.storyId}/comments`, `/api/items/${ready.jobId}`, `/api/items/${ready.jobId}/comments`]);
    const context = await browser.newContext({ viewport: { width: 320, height: 820 }, colorScheme: 'light', deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(8_000); page.setDefaultNavigationTimeout(10_000); observe(page, allowed);
    const top = waitResponse(page, '/api/stories', (url) => url.searchParams.get('category') === 'top');
    await page.goto(ready.baseUrl, { waitUntil: 'domcontentloaded' });
    const topData = await json200(await top, 'Top list'); await idle(page);
    assert.ok(topData.items.some((item) => item.id === ready.storyId));
    await waitTheme(page, 'light', false, null);
    await setSystem(page, 'dark', false, 'dark', null, 'system light→dark before manual choice');
    await setSystem(page, 'light', false, 'light', null, 'system dark→light before manual choice');
    await switchTheme(page, 'dark', 'manual choice');
    await setSystem(page, 'dark', true, 'dark', 'dark', 'system change after manual choice');
    await setSystem(page, 'light', true, 'dark', 'dark', 'system change after manual choice persists');
    result.afterThemeFixtureCounters = await readCounters();

    await checkCategories(page);
    const storyLink = page.locator(`a.story-row__detail[href="/item/${ready.storyId}"]`);
    await storyLink.waitFor({ state: 'visible', timeout: 8_000 });
    assert.equal(await storyLink.count(), 1);
    assert.equal(await page.locator('.story-row__source').count(), 1);
    assert.equal(await storyLink.getAttribute('href'), `/item/${ready.storyId}`);
    assert.equal(await page.locator('.story-row__source').getAttribute('href'), ready.rawMeta.storyUrl);
    await switchTheme(page, 'light', 'list screenshot light normal');
    await renderCase(page, 'list', 'light', 320, 1, '.story-row__title');
    await switchTheme(page, 'dark', 'list screenshot dark 200');
    await renderCase(page, 'list', 'dark', 320, 2, '.story-row__title');
    await renderCase(page, 'list', 'dark', 375, 1, '.story-row__title');
    await switchTheme(page, 'light', 'list screenshot light 200');
    await renderCase(page, 'list', 'light', 375, 2, '.story-row__title');

    const itemWait = waitResponse(page, `/api/items/${ready.storyId}`);
    const commentsWait = waitResponse(page, `/api/items/${ready.storyId}/comments`);
    await storyLink.click();
    await page.waitForFunction((id) => location.pathname === `/item/${id}`, ready.storyId, { timeout: 8_000 });
    const [itemResponse, commentsResponse] = await Promise.all([itemWait, commentsWait]);
    const item = await json200(itemResponse, 'long-title story'); const comments = await json200(commentsResponse, 'safe-link comments');
    assert.equal(item.item.id, ready.storyId); assert.equal(item.item.title, ready.rawMeta.storyTitle);
    assert.equal(item.item.author, ready.rawMeta.storyAuthor); assert.equal(item.item.domain, ready.rawMeta.storyDomain);
    assert.equal(new URL(commentsResponse.url()).searchParams.has('depth'), false);
    await page.waitForFunction(() => document.querySelectorAll('article[data-comment-id]').length === 220, undefined, { timeout: 12_000 });
    const detailSource = page.locator('a.detail__source');
    assert.equal(await detailSource.getAttribute('href'), ready.rawMeta.storyUrl);
    const safeAnchor = page.locator(`article[data-comment-id="${ready.rawMeta.safeCommentId}"] .detail-comment__body a`);
    assert.equal(await safeAnchor.count(), 1); assert.equal(await safeAnchor.getAttribute('href'), ready.rawMeta.safeHref);
    assert.equal((await safeAnchor.textContent())?.trim(), ready.rawMeta.longAnchorText);
    for (const marker of Object.values(ready.rawMeta.markerItems)) {
      const label = marker.id === ready.markerIds.deadId ? '[morto]' : '[removido]';
      assert.equal(await page.locator(`article[data-comment-id="${marker.id}"] .detail-comment__marker`).textContent(), label);
    }
    const collapsed = await checkCollapse(page);
    result.phases.detailData = { at: new Date().toISOString(), id: item.item.id, title: item.item.title, author: item.item.author, domain: item.item.domain, comments: 220, safeCommentId: ready.rawMeta.safeCommentId, safeHref: ready.rawMeta.safeHref, collapsedId: collapsed.id };

    await switchTheme(page, 'light', 'detail light normal');
    await renderCase(page, 'detail', 'light', 320, 1, '.detail__title');
    await switchTheme(page, 'dark', 'detail dark 200');
    await renderCase(page, 'detail', 'dark', 320, 2, '.detail__title');
    await renderCase(page, 'detail', 'dark', 375, 1, '.detail__title');
    await switchTheme(page, 'light', 'detail light 200');
    await renderCase(page, 'detail', 'light', 375, 2, '.detail__title');

    result.finalFixtureCounters = await readCounters();
    result.bffRequestCounts = snapshotBff(); result.browserOrigins = [...browserOrigins].sort();
    assert.deepEqual(errors.unexpectedBff, [], 'unexpected BFF endpoint');
    assert.deepEqual(errors.http, [], 'same-origin HTTP errors'); assert.deepEqual(errors.requests, [], 'failed same-origin requests');
    assert.deepEqual(errors.page, [], 'uncaught page errors'); assert.deepEqual(errors.console, [], 'browser console errors');
    assert.deepEqual([...browserOrigins], [baseOrigin], 'browser requests must stay on the private fixture origin');
    assert.deepEqual(result.finalFixtureCounters.unexpectedUpstreamPaths, []);
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

  async function waitForStarterStopped() {
    if (!starter) return;
    let forced = false;
    if (starter.exitCode === null && !starter.signalCode) {
      result.starterLifecycle.stopSignal = 'SIGTERM';
      starter.kill('SIGTERM');
      if (!await waitForExit(starter, result.limits.starterStopMs)) {
        forced = true; result.starterLifecycle.forceSignal = 'SIGKILL';
        starter.kill('SIGKILL');
        await waitForExit(starter, 2_000);
      }
    }
    result.starterLifecycle.forced = forced;
    result.starterLifecycle.exitCode = starter.exitCode;
    result.starterLifecycle.exitSignal = starter.signalCode;
    try {
      result.starterLifecycle.stopped = JSON.parse(await readFile(stoppedPath, 'utf8'));
      assert.equal(result.starterLifecycle.stopped.helperPid, starter.pid);
      assert.equal(result.starterLifecycle.stopped.closeCompleted, true);
    } catch (error) {
      result.starterLifecycle.stopError = error instanceof Error ? error.message : String(error);
      if (!forced) throw error;
    }
    if (forced || (starter.exitCode !== 0 && starter.signalCode !== 'SIGTERM')) throw new Error('Owned fixture starter did not stop gracefully.');
  }

  async function run() {
    let cleanupError;
    try {
      process.once('SIGINT', onSigint); process.once('SIGTERM', onSigterm);
      if (!safeEvidence) throw new Error('evidenceDir must be outside ROOT and the scripts directory.');
      if (result.interrupted) throw new Error(`Interrupted by ${result.interrupted}.`);
      const { chromium } = createRequire(path.join(ROOT, 'package.json'))('@playwright/test');
      await mkdir(screenshotDir, { recursive: true });
      result.starterLifecycle = { path: starterPath, command: [process.execPath, starterPath, ROOT, evidence], pid: null, stopSignal: null };
      starter = spawn(process.execPath, [starterPath, ROOT, evidence], { stdio: ['ignore', 'pipe', 'pipe'] });
      result.starterLifecycle.pid = starter.pid;
      result.starterLogs = { stdout: '', stderr: '' };
      const addLog = (key, chunk) => { result.starterLogs[key] = (result.starterLogs[key] + chunk.toString()).slice(-20_000); };
      starter.stdout.on('data', (chunk) => addLog('stdout', chunk)); starter.stderr.on('data', (chunk) => addLog('stderr', chunk));
      starter.on('error', (error) => { starterError = error; });
      ready = await Promise.race([waitReady(), interrupted.then((signal) => { throw new Error(`Interrupted by ${signal}.`); })]);
      ports = validateReady(ready); baseOrigin = new URL(ready.baseUrl).origin;
      result.fixture = { readyAt: ready.readyAt, helperPid: ready.helperPid, fixtureAppPid: ready.fixtureAppPid, rawUpstreamPid: ready.rawUpstreamPid, baseUrl: ready.baseUrl, appPort: ports.appPort, upstreamBaseUrl: ready.upstreamBaseUrl, upstreamPort: ports.upstreamPort, storyId: ready.storyId, jobId: ready.jobId, visibleComments: 220, totalComments: 221, stress: ready.rawMeta };
      result.initialFixtureCounters = await readCounters();
      browser = await chromium.launch({ headless: true, timeout: 10_000 }); result.runtime.browser = browser.version();
      qaTask = executeQA(); qaTask.catch(() => {});
      const remaining = Math.max(1, 90_000 - (Date.now() - startedMs));
      await Promise.race([bounded(qaTask, remaining, 'Typography QA exceeded the 90-second total deadline.'), interrupted.then((signal) => { throw new Error(`Interrupted by ${signal}.`); })]);
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed'; result.failure = { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
      if (!result.interrupted) process.exitCode = 1;
    } finally {
      for (const controller of activeCounterRequests) controller.abort();
      if (browser) try { await bounded(browser.close(), 5_000, 'Owned Chromium close timed out.'); }
      catch (error) { cleanupError = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
      if (qaTask) try { await bounded(qaTask.catch(() => {}), 3_000, 'QA task did not drain after Chromium close.'); }
      catch (error) { cleanupError ??= error instanceof Error ? error.message : String(error); process.exitCode = 1; }
      process.removeListener('SIGINT', onSigint); process.removeListener('SIGTERM', onSigterm);
      if (ready && ports) {
        try { result.portObservation = { appPort: ports.appPort, upstreamPort: ports.upstreamPort, afterBrowserClose: 'reachable' }; const final = await readCounters(); result.finalFixtureCounters ??= final; }
        catch (error) { result.portObservation = { appPort: ports.appPort, upstreamPort: ports.upstreamPort, afterBrowserClose: 'unreachable' }; cleanupError ??= error instanceof Error ? error.message : String(error); }
      }
      try { await waitForStarterStopped(); }
      catch (error) { cleanupError ??= error instanceof Error ? error.message : String(error); }
      result.finishedAt = new Date().toISOString(); result.runtime.elapsedMs = Date.now() - startedMs;
      result.bffRequestCounts = snapshotBff(); result.browserOrigins = [...browserOrigins].sort(); result.errors = errors;
      if (cleanupError) { result.cleanupError = cleanupError; result.status = 'failed'; process.exitCode = 1; }
      if (safeEvidence) try { await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); }
      catch (error) { console.error(`Could not write result JSON: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    }
    console.log(JSON.stringify({ status: result.status, resultPath: safeEvidence ? resultPath : null, screenshots: result.screenshots.length, failure: result.failure?.message ?? null }));
  }

  await run();
}
