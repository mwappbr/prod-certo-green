import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STARTER_PATH = '/tmp/qa-4-3-keyboard-fixture-20261012-f62d9b/scripts/start-keyboard-fixture-app.mjs';
const [rootArg, evidenceArg, ...extra] = process.argv.slice(2);

if (!rootArg || !evidenceArg || extra.length > 0) {
  console.error('Usage: node drive-axe-fixture-app.mjs <ROOT> <new-empty-evidenceDir-under-/tmp>');
  process.exitCode = 64;
} else {
  const ROOT = path.resolve(rootArg);
  const evidence = path.resolve(evidenceArg);
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDir = path.dirname(scriptsDir);
  const starterWorkspaceDir = path.dirname(path.dirname(STARTER_PATH));
  const readyPath = path.join(evidence, 'fixture-ready.json');
  const failurePath = path.join(evidence, 'fixture-failure.json');
  const stoppedPath = path.join(evidence, 'fixture-stopped.json');
  const resultPath = path.join(evidence, 'actual-result.json');
  const screenshotDir = path.join(evidence, 'screenshots');
  const themePreferenceKey = 'hn-modernizacao.theme.preference.v1';
  const startedMs = Date.now();
  const within = (candidate, parent) => {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  const safeEvidence = [path.resolve('/tmp'), path.resolve('/private/tmp')].some((tempRoot) => within(evidence, tempRoot)) &&
    !within(evidence, ROOT) && !within(evidence, workspaceDir) && !within(evidence, starterWorkspaceDir);
  const bffCounts = new Map();
  const apiRequests = [];
  const browserOrigins = new Set();
  const activeNodeRequests = new Set();
  const ownedContexts = new Set();
  const errors = { page: [], console: [], http: [], requests: [], unexpectedBff: [], unexpectedOrigins: [] };
  const result = {
    protocolVersion: 1,
    status: 'running',
    kind: 'four-context-default-axe-page-audit',
    startedAt: new Date(startedMs).toISOString(),
    helperPid: process.pid,
    arguments: { rootPath: ROOT, evidenceDir: evidence, starterPath: STARTER_PATH },
    runtime: { node: process.version, browser: null, axeWrapperExpectedVersion: '4.13.0', axeWrapperVersion: null, axeCoreVersion: null },
    limits: {
      readinessMs: 10_000, totalMs: 180_000, auditMs: 30_000, navigationMs: 10_000,
      contentWaitMs: 10_000, nodeRequestMs: 5_000, networkIdleMs: 5_000,
      screenshotMs: 10_000, browserLaunchMs: 10_000, browserCloseMs: 5_000,
      contextCloseMs: 5_000, qaDrainMs: 3_000, starterStopMs: 7_000,
      cleanupReserveMs: 30_000, viewport: { width: 375, height: 820 },
    },
    auditPolicy: {
      contexts: [
        { name: 'list-light', route: '/', colorScheme: 'light' },
        { name: 'list-dark', route: '/', colorScheme: 'dark' },
        { name: 'detail-light', route: '/item/<fixture-story-id>', colorScheme: 'light' },
        { name: 'detail-dark', route: '/item/<fixture-story-id>', colorScheme: 'dark' },
      ],
      axeWrapperExpectedVersion: '4.13.0',
      axeInvocation: 'new AxeBuilder({ page }).analyze() with default whole-page rule selection; no tags, include/exclude selectors, disabled rules, or legacy options.',
      legacyOptionsUsed: false,
      failImpacts: ['critical', 'serious'],
      reportAllViolationsAndIncomplete: true,
    },
    claims: {
      assistiveTechnologyTest: false,
      fullWcagAcceptance: false,
      nativeOsKeyboardTest: false,
      performanceP95: false,
      productionHnAccess: false,
      globalCacheBehavior: false,
    },
    networkHandling: {
      browserApiInterception: false,
      rawHnBrowserAccessAllowed: false,
      auditNetworkSnapshotsArePerContextOnly: true,
      cacheClaim: 'No global or cross-context cache behavior is inferred.',
    },
    fixture: null,
    initialFixtureCounters: null,
    initialBffRequestCounts: null,
    screenshots: [],
    audits: [],
    auditNetworkObservations: [],
    criticalSeriousFindings: [],
    failures: [],
    apiRequests,
    browserOrigins: [],
    errors,
  };

  let ready;
  let baseOrigin;
  let starter;
  let browser;
  let qaTask;
  let spawnError = null;
  let evidencePrepared = false;
  let stopResolve;
  const interrupted = new Promise((resolve) => { stopResolve = resolve; });
  const onSigint = () => { result.interrupted = 'SIGINT'; process.exitCode = 130; stopResolve('SIGINT'); };
  const onSigterm = () => { result.interrupted = 'SIGTERM'; process.exitCode = 143; stopResolve('SIGTERM'); };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function bounded(promise, ms, message) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  function errorText(error) { return error instanceof Error ? error.message : String(error); }
  function recordFailure(label, error) {
    result.failures.push({ label, message: errorText(error), stack: error instanceof Error ? error.stack : undefined });
  }
  function bffSnapshot() { return Object.fromEntries([...bffCounts.entries()].sort(([left], [right]) => left.localeCompare(right))); }
  function allZero(values) { return Object.values(values ?? {}).every((value) => value === 0); }

  async function waitReady() {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (starter && (starter.exitCode !== null || starter.signalCode)) {
        throw new Error(`Owned 4.3 fixture starter exited before readiness: ${starter.exitCode ?? starter.signalCode}; ${result.starterLogs?.stderr ?? ''}`);
      }
      try {
        const failure = JSON.parse(await readFile(failurePath, 'utf8'));
        if (failure.status === 'failed') throw new Error(`4.3 fixture startup failed: ${failure.message ?? 'no detail'}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('4.3 fixture startup failed:')) throw error;
      }
      try {
        const record = JSON.parse(await readFile(readyPath, 'utf8'));
        if (record.status === 'ready' && record.protocolVersion === 1) return record;
      } catch {}
      await sleep(100);
    }
    throw new Error('4.3 fixture readiness exceeded 10 seconds.');
  }

  function validateReady(record) {
    const app = new URL(record.baseUrl);
    const counters = new URL(record.countersUrl);
    const gateStatus = new URL(record.gateStatusUrl);
    const gateRelease = new URL(record.gateReleaseUrl);
    const upstream = new URL(record.upstreamBaseUrl);
    for (const url of [app, upstream]) {
      assert.equal(url.protocol, 'http:');
      assert.equal(url.hostname, '127.0.0.1');
      assert.ok(Number(url.port) > 0);
    }
    for (const url of [counters, gateStatus, gateRelease]) assert.equal(url.origin, app.origin);
    assert.equal(counters.pathname, '/__test/hn-counters');
    assert.equal(gateStatus.pathname, '/__test/gate/status');
    assert.equal(gateRelease.pathname, '/__test/gate/release');
    assert.equal(record.rawMeta.defaultPageSize, 30);
    assert.equal(record.topIds.length, 61);
    assert.equal(record.storyId, record.topIds[0]);
    assert.equal(record.expectedIds.visibleCommentCount, 220);
    assert.equal(record.expectedIds.allCommentCount, 221);
    assert.equal(record.expectedIds.visibleCommentIds.length, 220);
    assert.equal(record.expectedIds.allCommentIds.length, 221);
    assert.equal(record.rawMeta.commentsVisible, 220);
    assert.equal(record.rawMeta.commentsTotal, 221);
    assert.equal(record.rawMeta.primaryStoryId, record.storyId);
    assert.equal(record.helperPid, starter.pid);
    assert.equal(record.fixtureAppPid, starter.pid);
    assert.equal(record.rawUpstreamPid, starter.pid);
    assert.equal(record.arguments.rootPath, ROOT);
    assert.equal(record.arguments.evidenceDir, evidence);
    assert.ok(Number.isInteger(record.helperPid) && record.helperPid > 0);
    return { appPort: Number(app.port), upstreamPort: Number(upstream.port) };
  }

  async function nodeRequest(url, options = {}, timeoutMs = 5_000) {
    const controller = new AbortController();
    activeNodeRequests.add(controller);
    const timer = setTimeout(() => controller.abort(new Error(`Node-only fixture request exceeded ${timeoutMs}ms.`)), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      assert.equal(response.status, 200, `Node-only fixture request ${url}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
      activeNodeRequests.delete(controller);
    }
  }
  async function readCounters() {
    const url = new URL(ready.countersUrl);
    url.searchParams.set('ids', [...ready.listStoryIds, ...ready.expectedIds.allCommentIds].join(','));
    return nodeRequest(url);
  }
  async function readGate() { return nodeRequest(ready.gateStatusUrl); }
  async function releaseGate(reason = 'axe-driver-finally') {
    return nodeRequest(ready.gateReleaseUrl, { method: 'POST', headers: { 'x-test-release-reason': reason } });
  }

  function waitResponse(page, predicate, label, timeoutMs = 10_000) {
    const pending = page.waitForResponse(predicate, { timeout: timeoutMs });
    pending.catch(() => {});
    return bounded(pending, timeoutMs, `${label} response was not observed within ${timeoutMs}ms.`);
  }
  async function responseJson(response, label) {
    assert.equal(response.status(), 200, `${label} response status`);
    return response.json();
  }
  async function waitNetworkIdle(page, label) {
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch((error) => {
      throw new Error(`${label}: browser network did not become idle within 5 seconds: ${errorText(error)}`);
    });
  }
  async function waitForTheme(page, theme, label) {
    await page.waitForFunction(({ expectedTheme, key }) => {
      const root = document.documentElement;
      let preference;
      try { preference = sessionStorage.getItem(key); } catch { return false; }
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return preference === null && !root.hasAttribute('data-theme') &&
        getComputedStyle(root).colorScheme === expectedTheme && systemDark === (expectedTheme === 'dark');
    }, { expectedTheme: theme, key: themePreferenceKey }, { timeout: 10_000 });
    return page.evaluate(() => ({
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      surfaceBase: getComputedStyle(document.documentElement).getPropertyValue('--surface-base').trim(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    }));
  }
  async function waitForViewportContent(page, selector, label) {
    const geometry = await page.evaluate((target) => {
      const element = document.querySelector(target);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        contentRect: { x: rect.x, y: rect.y, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    }, selector);
    assert.ok(geometry, `${label}: expected primary content rectangle ${selector}`);
    assert.equal(geometry.viewport.width, 375, `${label}: audit viewport width must be 375px`);
    assert.equal(geometry.viewport.height, 820, `${label}: audit viewport height must be 820px`);
    assert.ok(geometry.contentRect.width > 0 && geometry.contentRect.left >= 0 && geometry.contentRect.right <= geometry.viewport.width,
      `${label}: primary content rectangle must fit the 375px viewport: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.documentWidth <= geometry.viewport.width,
      `${label}: document has horizontal overflow at the 375px viewport: ${JSON.stringify(geometry)}`);
    return geometry;
  }
  async function captureBeforeAudit(page, spec, selector, themeEvidence) {
    const geometry = await waitForViewportContent(page, selector, spec.name);
    const file = path.join(screenshotDir, `${spec.name}.png`);
    const bytes = await bounded(page.screenshot({ path: file, fullPage: false }), 10_000, `${spec.name} screenshot exceeded 10 seconds.`);
    assert.ok(bytes.byteLength > 0, `${spec.name} screenshot is empty`);
    const entry = {
      name: spec.name,
      path: file,
      bytes: bytes.byteLength,
      viewport: geometry.viewport,
      contentSelector: selector,
      contentRect: geometry.contentRect,
      documentWidth: geometry.documentWidth,
      colorScheme: spec.colorScheme,
      themeEvidence,
      timing: 'captured before axe analyze() in this fresh context',
    };
    result.screenshots.push(entry);
    return entry;
  }

  function observePage(page, allowedPaths, contextName) {
    page.on('request', (request) => {
      let url;
      try { url = new URL(request.url()); } catch { return; }
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        browserOrigins.add(url.origin);
        if (baseOrigin && url.origin !== baseOrigin) {
          errors.unexpectedOrigins.push({ context: contextName, method: request.method(), origin: url.origin, url: request.url() });
        }
      }
      if (baseOrigin && url.origin === baseOrigin && url.pathname.startsWith('/api/')) {
        const entry = { context: contextName, method: request.method(), pathname: url.pathname, search: url.search, url: request.url() };
        apiRequests.push(entry);
        const key = `${entry.method} ${entry.pathname}${entry.search}`;
        bffCounts.set(key, (bffCounts.get(key) ?? 0) + 1);
        if (request.method() !== 'GET' || !allowedPaths.has(url.pathname)) errors.unexpectedBff.push(entry);
      }
    });
    page.on('pageerror', (error) => errors.page.push({ context: contextName, message: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.console.push({ context: contextName, message: message.text() });
    });
    page.on('response', (response) => {
      let url;
      try { url = new URL(response.url()); } catch { return; }
      if ((url.protocol === 'http:' || url.protocol === 'https:') && response.status() >= 400) {
        errors.http.push({ context: contextName, status: response.status(), url: response.url() });
      }
    });
    page.on('requestfailed', (request) => {
      let url;
      try { url = new URL(request.url()); } catch { return; }
      errors.requests.push({ context: contextName, url: request.url(), error: request.failure()?.errorText ?? 'failed' });
    });
  }

  async function packageVersion(requireFromRoot, packageName) {
    const resolved = requireFromRoot.resolve(packageName);
    let directory = path.dirname(resolved);
    while (within(directory, ROOT)) {
      try {
        const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        if (metadata.name === packageName) return metadata.version ?? null;
      } catch {}
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    return null;
  }

  function ruleCounts(rules) {
    const impactCounts = {};
    let nodes = 0;
    for (const rule of rules) {
      const ruleNodes = Array.isArray(rule.nodes) ? rule.nodes : [];
      nodes += ruleNodes.length;
      for (const node of ruleNodes) {
        const impact = node.impact ?? rule.impact ?? 'unknown';
        impactCounts[impact] = (impactCounts[impact] ?? 0) + 1;
      }
    }
    return { rules: rules.length, nodes, nodesByImpact: impactCounts };
  }
  function summarizeRules(rules) {
    return rules.map((rule) => ({
      id: rule.id,
      impact: rule.impact ?? null,
      description: rule.description,
      help: rule.help,
      helpUrl: rule.helpUrl,
      tags: rule.tags,
      nodeCount: Array.isArray(rule.nodes) ? rule.nodes.length : 0,
    }));
  }
  function collectImpactNodes(axeResults) {
    return [
      ...axeResults.violations.map((rule) => ({ outcome: 'violation', rule })),
      ...axeResults.incomplete.map((rule) => ({ outcome: 'incomplete', rule })),
    ].flatMap(({ outcome, rule }) => (rule.nodes ?? []).map((node) => ({
      outcome,
      ruleId: rule.id,
      ruleImpact: rule.impact ?? null,
      impact: node.impact ?? rule.impact ?? null,
      target: node.target ?? [],
      html: node.html ?? '',
      failureSummary: node.failureSummary ?? null,
    })));
  }
  function seriousOrCritical(axeResults) {
    const important = new Set(['critical', 'serious']);
    return axeResults.violations.flatMap((rule) => (rule.nodes ?? [])
      .filter((node) => important.has(node.impact ?? rule.impact))
      .map((node) => ({
        ruleId: rule.id,
        impact: node.impact ?? rule.impact,
        help: rule.help,
        helpUrl: rule.helpUrl,
        target: node.target ?? [],
        html: node.html ?? '',
        failureSummary: node.failureSummary ?? null,
      })));
  }
  function recordAudit(spec, axeResults, network) {
    const counts = {
      violations: ruleCounts(axeResults.violations),
      incomplete: ruleCounts(axeResults.incomplete),
      passes: ruleCounts(axeResults.passes),
      inapplicable: ruleCounts(axeResults.inapplicable),
    };
    const impactNodes = collectImpactNodes(axeResults);
    const criticalSerious = seriousOrCritical(axeResults);
    const audit = {
      context: spec.name,
      route: spec.route,
      colorScheme: spec.colorScheme,
      auditedAt: new Date().toISOString(),
      url: axeResults.url,
      testEngine: axeResults.testEngine,
      axeCoreVersion: axeResults.testEngine?.version ?? null,
      testRunner: axeResults.testRunner,
      testEnvironment: axeResults.testEnvironment,
      counts,
      passes: summarizeRules(axeResults.passes),
      violations: axeResults.violations,
      incomplete: axeResults.incomplete,
      inapplicable: summarizeRules(axeResults.inapplicable),
      impactNodes,
      criticalSeriousFindings: criticalSerious,
      defaultRuleSelection: true,
      networkDuringAnalysis: network,
    };
    result.runtime.axeCoreVersion ??= audit.axeCoreVersion;
    result.audits.push(audit);
    result.criticalSeriousFindings.push(...criticalSerious.map((finding) => ({ context: spec.name, ...finding })));
  }

  async function inspectRevealedJobsContrast(page, spec) {
    const beforeBff = bffSnapshot();
    const beforeHn = await readCounters();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const activeId = await page.evaluate(() => document.activeElement?.id);
      if (activeId === 'category-tab-top') break;
      await page.keyboard.press('Tab');
    }
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'category-tab-top');
    for (let step = 0; step < 5; step += 1) await page.keyboard.press('ArrowRight');
    const measured = await page.evaluate(() => {
      const tab = document.querySelector('#category-tab-job');
      const strip = tab?.closest('.category-tabs');
      if (!(tab instanceof HTMLElement) || !(strip instanceof HTMLElement)) return null;
      const parseColor = (value) => {
        const match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
        if (!match) throw new Error(`Unsupported computed RGB color: ${value}`);
        return { rgb: match.slice(1, 4).map(Number), alpha: match[4] === undefined ? 1 : Number(match[4]) };
      };
      const textColor = getComputedStyle(tab).color;
      const foreground = parseColor(textColor);
      let background = null;
      let backgroundColor = null;
      let backgroundElement = null;
      for (let current = tab; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (Number(style.opacity) !== 1 || style.backgroundImage !== 'none') {
          throw new Error('Contrast probe cannot claim a solid opaque background through opacity or images.');
        }
        const parsed = parseColor(style.backgroundColor);
        if (parsed.alpha === 1) {
          background = parsed;
          backgroundColor = style.backgroundColor;
          backgroundElement = current.tagName.toLowerCase();
          break;
        }
        if (parsed.alpha !== 0) throw new Error('Contrast probe cannot assume an alpha-composited background.');
      }
      if (!background || foreground.alpha !== 1) throw new Error('Opaque foreground/background was not established.');
      const luminance = ({ rgb }) => rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const first = luminance(foreground);
      const second = luminance(background);
      const rect = tab.getBoundingClientRect();
      const stripRect = strip.getBoundingClientRect();
      const visibleLeft = stripRect.left + strip.clientLeft;
      const visibleRight = visibleLeft + strip.clientWidth;
      return {
        id: tab.id,
        active: document.activeElement === tab,
        focusVisible: tab.matches(':focus-visible'),
        selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
        textColor, backgroundColor, backgroundElement,
        contrastRatio: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
        fullyInsideStrip: rect.left >= visibleLeft && rect.right <= visibleRight,
        fullyInsideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      };
    });
    assert.ok(measured);
    assert.equal(measured.active, true);
    assert.equal(measured.focusVisible, true);
    assert.equal(measured.selectedTab, 'category-tab-top');
    assert.equal(measured.fullyInsideStrip, true);
    assert.equal(measured.fullyInsideViewport, true);
    assert.ok(measured.contrastRatio >= 4.5, `${spec.name}: revealed Jobs contrast is below 4.5:1`);
    const afterBff = bffSnapshot();
    const afterHn = await readCounters();
    assert.deepEqual(afterBff, beforeBff);
    assert.deepEqual(afterHn, beforeHn);
    result.supplementalJobsContrastChecks ??= [];
    result.supplementalJobsContrastChecks.push({
      context: spec.name,
      method: 'Native Tab and five ArrowRight keys; computed solid-color contrast after revealing Jobs. Original default whole-page Axe results are unchanged.',
      ...measured,
      bffUnchanged: true,
      rawHnUnchanged: true,
      limitation: 'Technical color calculation for the revealed tab only; not a replacement for full Axe results, human AT, or full WCAG acceptance.',
    });
  }

  async function closeOwnedContext(context, label) {
    if (!ownedContexts.delete(context)) return;
    await bounded(context.close(), 5_000, `${label} owned browser context did not close within 5 seconds.`);
  }

  async function auditCase(browserInstance, AxeBuilder, spec) {
    const context = await browserInstance.newContext({
      viewport: { width: 375, height: 820 },
      deviceScaleFactor: 1,
      colorScheme: spec.colorScheme,
      reducedMotion: 'no-preference',
    });
    ownedContexts.add(context);
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(10_000);
      const allowedPaths = new Set(['/api/stories', `/api/items/${ready.storyId}`, `/api/items/${ready.storyId}/comments`]);
      observePage(page, allowedPaths, spec.name);
      const themeRoute = `${ready.baseUrl}${spec.route}`;
      const selector = spec.pageKind === 'list' ? 'main.listing' : 'main.detail';
      let themeEvidence;

      if (spec.pageKind === 'list') {
        const listResponsePromise = waitResponse(page, (response) => {
          const url = new URL(response.url());
          const pageValue = url.searchParams.get('page');
          return url.origin === baseOrigin && url.pathname === '/api/stories' &&
            url.searchParams.get('category') === 'top' && (pageValue === null || pageValue === '1');
        }, `${spec.name} initial Top list`);
        const navigation = await page.goto(themeRoute, { waitUntil: 'domcontentloaded', timeout: 10_000 });
        assert.equal(navigation?.status(), 200, `${spec.name} compiled SPA document status`);
        themeEvidence = await waitForTheme(page, spec.colorScheme, spec.name);
        const listResponse = await listResponsePromise;
        const data = await responseJson(listResponse, `${spec.name} Top list`);
        assert.equal(data.page, 1);
        assert.equal(data.limit, 30);
        assert.equal(data.items.length, 30);
        assert.equal(data.items[0]?.id, ready.storyId);
        assert.equal(data.hasMore, true);
        assert.equal(typeof data.snapshot, 'string');
        await page.waitForFunction(() =>
          document.querySelectorAll('.story-list > li').length === 30 &&
          document.querySelector('#category-tab-top')?.getAttribute('aria-selected') === 'true' &&
          document.querySelector('main.listing')?.getAttribute('aria-busy') === 'false',
        undefined, { timeout: 10_000 });
        await waitNetworkIdle(page, `${spec.name} list readiness`);
        result.contexts ??= [];
        result.contexts.push({
          name: spec.name, route: spec.route, colorScheme: spec.colorScheme, viewport: { width: 375, height: 820 },
          freshContext: true, storageStateProvided: false, loadedRows: 30, firstStoryId: data.items[0].id,
          page: data.page, limit: data.limit, hasMore: data.hasMore, snapshot: data.snapshot, themeEvidence,
        });
      } else {
        const itemResponsePromise = waitResponse(page, (response) => {
          const url = new URL(response.url());
          return url.origin === baseOrigin && url.pathname === `/api/items/${ready.storyId}` && response.request().method() === 'GET';
        }, `${spec.name} detail item`);
        const commentsResponsePromise = waitResponse(page, (response) => {
          const url = new URL(response.url());
          return url.origin === baseOrigin && url.pathname === `/api/items/${ready.storyId}/comments` && response.request().method() === 'GET';
        }, `${spec.name} default-depth comments`);
        const navigation = await page.goto(themeRoute, { waitUntil: 'domcontentloaded', timeout: 10_000 });
        assert.equal(navigation?.status(), 200, `${spec.name} compiled SPA document status`);
        themeEvidence = await waitForTheme(page, spec.colorScheme, spec.name);
        const [itemResponse, commentsResponse] = await Promise.all([itemResponsePromise, commentsResponsePromise]);
        const itemData = await responseJson(itemResponse, `${spec.name} detail item`);
        const commentsData = await responseJson(commentsResponse, `${spec.name} comments`);
        assert.equal(new URL(commentsResponse.url()).searchParams.has('depth'), false, `${spec.name} must use the BFF default comment depth`);
        assert.equal(itemData.item.id, ready.storyId);
        assert.equal(itemData.item.commentCount, 221);
        assert.equal(commentsData.nodes.length, ready.rawMeta.rootChildIds.length);
        await page.waitForFunction(({ visibleCount, rootId }) =>
          location.pathname === `/item/${rootId}` &&
          document.querySelectorAll('article[data-comment-id]').length === visibleCount &&
          document.querySelector('main.detail')?.getAttribute('aria-busy') === 'false' &&
          document.querySelector('.detail__comments')?.getAttribute('aria-busy') === 'false',
        { visibleCount: 220, rootId: ready.storyId }, { timeout: 10_000 });
        const depthEightId = ready.rawMeta.chainIds[7];
        assert.equal(await page.locator(`article[data-comment-id="${ready.expectedIds.depthNineId}"]`).count(), 0,
          `${spec.name}: depth-nine comment should not be loaded by the default-depth endpoint`);
        assert.equal(await page.locator(`article[data-comment-id="${depthEightId}"] .detail-comment__continuation`).count(), 1,
          `${spec.name}: depth-eight continuation marker should be visible`);
        await waitNetworkIdle(page, `${spec.name} detail readiness`);
        result.contexts ??= [];
        result.contexts.push({
          name: spec.name, route: spec.route, colorScheme: spec.colorScheme, viewport: { width: 375, height: 820 },
          freshContext: true, storageStateProvided: false, visibleComments: 220, totalComments: 221,
          defaultDepth: 8, depthQueryPresent: false, depthNineId: ready.expectedIds.depthNineId,
          depthEightContinuationId: depthEightId, itemTitle: itemData.item.title, themeEvidence,
        });
      }

      const screenshot = await captureBeforeAudit(page, spec, selector, themeEvidence);
      await waitNetworkIdle(page, `${spec.name} immediately before axe audit`);
      const beforeBff = bffSnapshot();
      const beforeHn = await readCounters();
      const auditStartedAt = new Date().toISOString();
      const auditPromise = Promise.resolve().then(() => new AxeBuilder({ page }).analyze());
      const axeResults = await bounded(auditPromise, 30_000, `${spec.name} axe analyze() exceeded 30 seconds.`);
      await waitNetworkIdle(page, `${spec.name} immediately after axe audit`);
      const afterBff = bffSnapshot();
      const afterHn = await readCounters();
      const network = {
        startedAt: auditStartedAt,
        completedAt: new Date().toISOString(),
        bffBefore: beforeBff,
        bffAfter: afterBff,
        bffUnchanged: JSON.stringify(beforeBff) === JSON.stringify(afterBff),
        rawHnBefore: beforeHn,
        rawHnAfter: afterHn,
        rawHnUnchanged: JSON.stringify(beforeHn) === JSON.stringify(afterHn),
      };
      network.bothUnchanged = network.bffUnchanged && network.rawHnUnchanged;
      result.auditNetworkObservations.push({ context: spec.name, ...network });
      recordAudit(spec, axeResults, network);
      if (spec.pageKind === 'list') await inspectRevealedJobsContrast(page, spec);
      result.screenshots.find((entry) => entry.name === spec.name).auditStartedAt = auditStartedAt;
      assert.ok(screenshot.bytes > 0);
    } finally {
      await closeOwnedContext(context, spec.name);
    }
  }

  async function executeAudits(browserInstance, AxeBuilder) {
    const cases = [
      { name: 'list-light', pageKind: 'list', route: '/', colorScheme: 'light' },
      { name: 'list-dark', pageKind: 'list', route: '/', colorScheme: 'dark' },
      { name: 'detail-light', pageKind: 'detail', route: `/item/${ready.storyId}`, colorScheme: 'light' },
      { name: 'detail-dark', pageKind: 'detail', route: `/item/${ready.storyId}`, colorScheme: 'dark' },
    ];
    for (const spec of cases) await auditCase(browserInstance, AxeBuilder, spec);
  }

  function waitForExit(child, timeoutMs) {
    if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve(true);
    return new Promise((resolve) => {
      let timer;
      const done = () => {
        if (timer) clearTimeout(timer);
        child.removeListener('exit', done);
        resolve(true);
      };
      child.once('exit', done);
      timer = setTimeout(() => {
        child.removeListener('exit', done);
        resolve(false);
      }, timeoutMs);
    });
  }

  async function stopOwnedStarter() {
    if (!starter) return;
    if (!starter.pid) {
      result.starterLifecycle ??= {};
      result.starterLifecycle.spawnError = spawnError?.message ?? 'owned fixture starter did not receive a PID';
      throw new Error(result.starterLifecycle.spawnError);
    }
    let forced = false;
    if (starter.exitCode === null && !starter.signalCode) {
      result.starterLifecycle.stopSignal = 'SIGTERM';
      starter.kill('SIGTERM');
      if (!await waitForExit(starter, 6_500)) {
        forced = true;
        result.starterLifecycle.forceSignal = 'SIGKILL';
        starter.kill('SIGKILL');
        await waitForExit(starter, 500);
      }
    }
    result.starterLifecycle.forced = forced;
    result.starterLifecycle.exitCode = starter.exitCode;
    result.starterLifecycle.exitSignal = starter.signalCode;
    if (ready) {
      const stopped = JSON.parse(await readFile(stoppedPath, 'utf8'));
      assert.equal(stopped.helperPid, starter.pid);
      assert.equal(stopped.closeCompleted, true);
      assert.equal(stopped.gate.released, true);
      result.starterLifecycle.stopped = stopped;
    }
    if (forced || (starter.exitCode !== 0 && starter.signalCode !== 'SIGTERM')) {
      throw new Error('Owned 4.3 fixture starter did not stop gracefully.');
    }
  }

  async function run() {
    let cleanupError = null;
    try {
      process.once('SIGINT', onSigint);
      process.once('SIGTERM', onSigterm);
      if (!safeEvidence) throw new Error('evidenceDir must be under /tmp, outside ROOT, and outside this helper workspace.');
      await mkdir(evidence);
      const existing = await readdir(evidence);
      if (existing.length !== 0) throw new Error(`evidenceDir must be new and empty; found ${existing.length} entries.`);
      await mkdir(screenshotDir, { recursive: true });
      evidencePrepared = true;
      if (Number(process.versions.node.split('.')[0]) < 24) throw new Error(`Node.js 24+ is required; found ${process.version}.`);
      await access(path.join(ROOT, 'package.json'));
      await access(STARTER_PATH);

      const requireFromRoot = createRequire(path.join(ROOT, 'package.json'));
      const playwrightModule = requireFromRoot('@playwright/test');
      const axeModule = requireFromRoot('@axe-core/playwright');
      const AxeBuilder = axeModule.default?.default ?? axeModule.default ?? axeModule.AxeBuilder ?? axeModule;
      if (typeof playwrightModule.chromium?.launch !== 'function') throw new Error('@playwright/test did not expose chromium.launch().');
      if (typeof AxeBuilder !== 'function') throw new Error('@axe-core/playwright did not expose an AxeBuilder constructor.');
      result.runtime.axeWrapperVersion = await packageVersion(requireFromRoot, '@axe-core/playwright');
      assert.equal(result.runtime.axeWrapperVersion, '4.13.0', 'Axe wrapper must be the prepared @axe-core/playwright 4.13.0 candidate.');

      result.starterLifecycle = { path: STARTER_PATH, command: [process.execPath, STARTER_PATH, ROOT, evidence], pid: null, stopSignal: null };
      starter = spawn(process.execPath, [STARTER_PATH, ROOT, evidence], { stdio: ['ignore', 'pipe', 'pipe'] });
      result.starterLifecycle.pid = starter.pid;
      result.starterLogs = { stdout: '', stderr: '' };
      const keepLog = (name, chunk) => { result.starterLogs[name] = (result.starterLogs[name] + chunk.toString()).slice(-20_000); };
      starter.stdout.on('data', (chunk) => keepLog('stdout', chunk));
      starter.stderr.on('data', (chunk) => keepLog('stderr', chunk));
      starter.on('error', (error) => { spawnError = error; });
      ready = await Promise.race([
        waitReady(),
        interrupted.then((signal) => { throw new Error(`Interrupted by ${signal} while waiting for fixture readiness.`); }),
      ]);
      const ports = validateReady(ready);
      baseOrigin = new URL(ready.baseUrl).origin;
      result.fixture = {
        helperPid: ready.helperPid,
        fixtureAppPid: ready.fixtureAppPid,
        rawUpstreamPid: ready.rawUpstreamPid,
        baseUrl: ready.baseUrl,
        appPort: ports.appPort,
        upstreamBaseUrl: ready.upstreamBaseUrl,
        upstreamPort: ports.upstreamPort,
        primaryStoryId: ready.storyId,
        pageSize: ready.rawMeta.defaultPageSize,
        topStoryCount: ready.topIds.length,
        commentsVisible: ready.expectedIds.visibleCommentCount,
        commentsTotal: ready.expectedIds.allCommentCount,
        gate: { statusUrl: ready.gateStatusUrl, releaseUrl: ready.gateReleaseUrl, autoReleaseMs: ready.rawMeta.gateAutoReleaseMs },
      };
      const initialGate = await readGate();
      assert.equal(initialGate.hits.length, 0, 'private page-2 gate must be cold before browser startup');
      assert.equal(initialGate.released, false);
      result.initialFixtureCounters = await readCounters();
      result.initialBffRequestCounts = bffSnapshot();
      assert.deepEqual(result.initialBffRequestCounts, {}, 'browser BFF request counts must be cold before browser startup');
      assert.ok(allZero(result.initialFixtureCounters.itemRequests), 'private raw-HN item counters must be cold before browser startup');
      assert.ok(allZero(result.initialFixtureCounters.listRequests), 'private raw-HN list counters must be cold before browser startup');

      browser = await playwrightModule.chromium.launch({ headless: true, timeout: 10_000 });
      result.runtime.browser = browser.version();
      qaTask = executeAudits(browser, AxeBuilder);
      qaTask.catch(() => {});
      const elapsed = Date.now() - startedMs;
      const workBudget = Math.max(1, 180_000 - elapsed - 30_000);
      await Promise.race([
        bounded(qaTask, workBudget, 'Four-context Axe QA exceeded its 180-second total deadline with cleanup reserve.'),
        interrupted.then((signal) => { throw new Error(`Interrupted by ${signal} during Axe QA.`); }),
      ]);

      const significant = result.criticalSeriousFindings.length;
      const unstableAudits = result.auditNetworkObservations.filter((entry) => !entry.bothUnchanged);
      if (significant > 0) recordFailure('axe-critical-serious', new Error(`${significant} critical/serious impact node(s) were found across four default whole-page audits.`));
      if (unstableAudits.length > 0) recordFailure('audit-network-delta', new Error(`${unstableAudits.length} audit(s) had a BFF or raw-HN counter delta; inspect the per-context before/after snapshots.`));
      if (errors.page.length || errors.console.length || errors.http.length || errors.requests.length || errors.unexpectedBff.length || errors.unexpectedOrigins.length) {
        recordFailure('browser-observation-errors', new Error('Browser page, console, HTTP, request, BFF-path, or origin observations were not clean.'));
      }
      assert.ok(browserOrigins.has(baseOrigin), 'browser must load the compiled SPA/BFF from its loopback own origin');
      assert.ok(!browserOrigins.has(new URL(ready.upstreamBaseUrl).origin), 'browser must never access the private raw-HN origin directly');
      assert.deepEqual(errors.unexpectedBff, [], 'browser issued an unexpected BFF API request');
      assert.deepEqual(errors.unexpectedOrigins, [], 'browser contacted an origin other than its own loopback app');
      assert.deepEqual(errors.page, [], 'browser page errors must be empty');
      assert.deepEqual(errors.console, [], 'browser console errors must be empty');
      assert.deepEqual(errors.http, [], 'browser HTTP errors must be empty');
      assert.deepEqual(errors.requests, [], 'browser request failures must be empty');
      assert.equal(result.audits.length, 4, 'all four clean list/detail light/dark contexts must be audited');
      if (result.failures.length > 0) throw new Error(result.failures.map((failure) => `${failure.label}: ${failure.message}`).join(' | '));
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.failure = { message: errorText(error), stack: error instanceof Error ? error.stack : undefined };
      if (!result.interrupted) process.exitCode = 1;
    } finally {
      if (ready) {
        try {
          result.gateCleanup = await bounded(releaseGate('axe-driver-finally'), 5_000, 'Page-2 gate release timed out during cleanup.');
          assert.equal(result.gateCleanup.released, true);
        } catch (error) {
          cleanupError ??= `gate release: ${errorText(error)}`;
        }
      }
      for (const controller of activeNodeRequests) controller.abort();
      for (const context of [...ownedContexts]) {
        try { await closeOwnedContext(context, 'Owned context cleanup'); }
        catch (error) { cleanupError ??= `context close: ${errorText(error)}`; }
      }
      if (browser) {
        try { await bounded(browser.close(), 5_000, 'Owned Chromium close timed out.'); }
        catch (error) { cleanupError ??= `browser close: ${errorText(error)}`; process.exitCode = 1; }
      }
      if (qaTask) {
        try { await bounded(qaTask.catch(() => {}), 3_000, 'Axe QA task did not drain after browser close.'); }
        catch (error) { cleanupError ??= `QA task drain: ${errorText(error)}`; process.exitCode = 1; }
      }
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      if (ready) {
        try {
          [result.finalFixtureCounters, result.finalGate] = await Promise.all([readCounters(), readGate()]);
        } catch (error) {
          cleanupError ??= `final fixture counters/gate snapshot: ${errorText(error)}`;
        }
      }
      try { await stopOwnedStarter(); }
      catch (error) { cleanupError ??= `owned starter shutdown: ${errorText(error)}`; }
      result.finishedAt = new Date().toISOString();
      result.runtime.elapsedMs = Date.now() - startedMs;
      result.bffRequestCounts = bffSnapshot();
      result.browserOrigins = [...browserOrigins].sort();
      result.errors = errors;
      if (cleanupError) {
        result.cleanupError = cleanupError;
        recordFailure('cleanup', new Error(cleanupError));
        result.status = 'failed';
        process.exitCode = 1;
      }
      if (evidencePrepared) {
        try { await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); }
        catch (error) {
          console.error(`Could not write result JSON: ${errorText(error)}`);
          process.exitCode = 1;
        }
      }
    }
    console.log(JSON.stringify({ status: result.status, resultPath: evidencePrepared ? resultPath : null, screenshots: result.screenshots.length, audits: result.audits.length, failure: result.failure?.message ?? null }));
  }

  await run();
}
