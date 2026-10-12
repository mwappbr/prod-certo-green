import { expect, test, type Locator, type Page } from '@playwright/test';

const storyId = 4201;
const cachedAt = '2026-10-12T12:00:00.000Z';
const longDomain = `${'domain-'.repeat(11)}example.test`;
const longTitle = `Título de história longo para validar quebra de texto sem corte: ${'interface adaptável '.repeat(7)}`;
const longComment = `Comentário longo que deve refluir sem cortar conteúdo: ${'texto acessível em telas estreitas '.repeat(5)}`;
const longCommentDomain = `${'comentario-'.repeat(8)}example.test`;
const ownCommentText = 'Corpo próprio preservado após recolher e expandir.';

type Surface = 'listing' | 'detail';
type Theme = 'light' | 'dark';
type TextScale = 'normal' | 'simulated-200';

type TargetMeasurement = {
  name: string;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  overflows: boolean;
};

type TextSnapshot = {
  element: string;
  fontSizeBefore: number;
  fontSizeAfter: number;
  lineHeightBefore: string;
  lineHeightAfter: string;
  lineHeightRatio: number | null;
};

type GlyphMeasurement = {
  fontSize: number;
  lineHeight: string;
  rangeWidth: number;
  rangeHeight: number;
  rangeRects: number;
};

type ScaleEvidence = {
  viewportBefore: number;
  viewportAfter: number;
  htmlFontSizeBefore: number;
  htmlFontSizeAfter: number;
  glyphBefore: GlyphMeasurement;
  glyphAfter: GlyphMeasurement;
  textSnapshot: TextSnapshot[];
};

type ScenarioMeasurement = {
  surface: Surface;
  theme: Theme;
  viewport: number;
  scale: TextScale;
  innerWidth: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  targets: TargetMeasurement[];
  textClipping: Array<{ element: string; clipped: boolean; scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }>;
  categoryStrip?: { clientWidth: number; scrollWidth: number; scrollLeft: number; jobsVisible: boolean };
  scaleEvidence?: ScaleEvidence;
};

const primaryStory = {
  id: storyId,
  type: 'story',
  title: longTitle,
  url: 'https://x.io/story',
  domain: 'x.io',
  author: 'autor-com-nome-longo-para-envolver-sem-truncar',
  score: 42,
  commentCount: 2,
  createdAt: '2026-10-12T09:00:00.000Z',
  cachedAt,
};

const secondaryStory = {
  id: storyId + 1,
  type: 'story',
  title: 'História secundária com domínio longo de origem',
  url: `https://${longDomain}/story`,
  domain: longDomain,
  author: 'autora-secundaria',
  score: 7,
  commentCount: 0,
  createdAt: '2026-10-12T08:00:00.000Z',
  cachedAt,
};

const commentNode = {
  id: 5301,
  author: 'autora-comentario',
  text: `<p>${longComment}</p><p>${ownCommentText}</p><p><a href="https://tiny.test/comment">link</a> <a href="https://${longCommentDomain}/destino">${longCommentDomain}</a></p>`,
  createdAt: '2026-10-12T10:00:00.000Z',
  status: 'ok',
  children: [
    {
      id: 5302,
      author: 'resposta-com-nome-longo',
      text: `<p>${'Resposta longa preservada na árvore. '.repeat(4)}</p>`,
      createdAt: '2026-10-12T10:30:00.000Z',
      status: 'ok',
      children: [],
    },
  ],
};

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

async function installLocalApiFixture(page: Page, apiRequests: string[]) {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(`${url.pathname}${url.search}`);
  });

  await page.route('**/api/stories**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [primaryStory, secondaryStory],
        page: 1,
        limit: 30,
        snapshot: 'snapshot-responsive-text-4-2',
        cachedAt,
        stale: false,
        hasMore: true,
      }),
    });
  });

  await page.route(`**/api/items/${storyId}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = path.endsWith('/comments')
      ? { nodes: [commentNode], truncated: false, cachedAt, stale: false }
      : { item: primaryStory, cachedAt, stale: false };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });
}

async function applyTextResizeSimulation(page: Page, glyphSelector: string): Promise<ScaleEvidence> {
  return page.evaluate((selectedGlyph) => {
    const root = document.querySelector('#root');
    if (!root) throw new Error('App root not found for test-only text resize simulation.');

    const visibleTextElements = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
      if (!element.textContent?.trim() || element.getClientRects().length === 0) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    });

    // Snapshot every applicable computed value before mutating any element, preventing nested 4x cascades.
    const original = visibleTextElements.map((element) => {
      const style = getComputedStyle(element);
      const fontSizeBefore = Number.parseFloat(style.fontSize);
      const lineHeightBefore = style.lineHeight;
      const lineHeightBeforePx = lineHeightBefore === 'normal' ? null : Number.parseFloat(lineHeightBefore);
      const classes = typeof element.className === 'string'
        ? element.className.trim().split(/\s+/).filter(Boolean).join('.')
        : '';
      const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes ? `.${classes}` : ''}`;
      return { element, selector, fontSizeBefore, lineHeightBefore, lineHeightBeforePx };
    });

    const readGlyph = (): GlyphMeasurement => {
      const element = document.querySelector<HTMLElement>(selectedGlyph);
      if (!element) throw new Error(`Text measurement target not found: ${selectedGlyph}`);
      const text = Array.from(element.childNodes).find(
        (node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      );
      if (!text || text.length === 0) throw new Error(`No direct text node for glyph range: ${selectedGlyph}`);
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 1);
      const rect = range.getBoundingClientRect();
      return {
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        lineHeight: getComputedStyle(element).lineHeight,
        rangeWidth: Math.round(rect.width * 100) / 100,
        rangeHeight: Math.round(rect.height * 100) / 100,
        rangeRects: range.getClientRects().length,
      };
    };

    const viewportBefore = window.innerWidth;
    const htmlFontSizeBefore = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const glyphBefore = readGlyph();

    for (const value of original) {
      value.element.style.setProperty('font-size', `${value.fontSizeBefore * 2}px`, 'important');
      if (value.lineHeightBeforePx !== null && Number.isFinite(value.lineHeightBeforePx)) {
        value.element.style.setProperty('line-height', `${value.lineHeightBeforePx * 2}px`, 'important');
      }
    }

    const glyphAfter = readGlyph();
    const textSnapshot = original.map((value): TextSnapshot => {
      const style = getComputedStyle(value.element);
      const fontSizeAfter = Number.parseFloat(style.fontSize);
      const lineHeightAfter = style.lineHeight;
      const lineHeightAfterPx = lineHeightAfter === 'normal' ? null : Number.parseFloat(lineHeightAfter);
      return {
        element: value.selector,
        fontSizeBefore: Math.round(value.fontSizeBefore * 100) / 100,
        fontSizeAfter: Math.round(fontSizeAfter * 100) / 100,
        lineHeightBefore: value.lineHeightBefore,
        lineHeightAfter,
        lineHeightRatio: value.lineHeightBeforePx !== null
          && Number.isFinite(value.lineHeightBeforePx)
          && lineHeightAfterPx !== null
          && Number.isFinite(lineHeightAfterPx)
          ? Math.round((lineHeightAfterPx / value.lineHeightBeforePx) * 1000) / 1000
          : null,
      };
    });

    return {
      viewportBefore,
      viewportAfter: window.innerWidth,
      htmlFontSizeBefore,
      htmlFontSizeAfter: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      glyphBefore,
      glyphAfter,
      textSnapshot,
    };
  }, glyphSelector);
}

async function measureTargets(
  page: Page,
  surface: Surface,
  visibilityTimeoutMs = 5_000,
): Promise<TargetMeasurement[]> {
  const targets: TargetMeasurement[] = [];
  const add = async (label: string, locator: Locator, expectedCount: number) => {
    const count = await locator.count();
    expect(count, `${surface} target count for ${label}`).toBe(expectedCount);
    for (let index = 0; index < count; index += 1) {
      const element = locator.nth(index);
      await expect(element, `${surface} target ${label}[${index}] must be visible`)
        .toBeVisible({ timeout: visibilityTimeoutMs });
      await element.scrollIntoViewIfNeeded();
      const measurement = await element.evaluate((target, groupLabel) => {
        const rect = target.getBoundingClientRect();
        const box = target as HTMLElement;
        const text = target.getAttribute('aria-label') || target.textContent || '';
        return {
          name: `${text.replace(/\s+/g, ' ').trim().slice(0, 72)} [${indexLabel(target)}]`,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          clientWidth: box.clientWidth,
          clientHeight: box.clientHeight,
          scrollWidth: box.scrollWidth,
          scrollHeight: box.scrollHeight,
          overflows: box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1,
        };

        function indexLabel(element: Element) {
          const role = element.getAttribute('role');
          const id = element.id ? `#${element.id}` : '';
          const classes = typeof (element as HTMLElement).className === 'string'
            ? (element as HTMLElement).className.trim().split(/\s+/).filter(Boolean).join('.')
            : '';
          return `${role ? `[role=${role}]` : ''}${id}${classes ? `.${classes}` : ''}` || groupLabel;
        }
      }, label);
      targets.push(measurement);
    }
  };

  if (surface === 'listing') {
    await add('category tab', page.locator('.category-tabs__tab'), 6);
    await add('button', page.locator('button:not([role="tab"])'), 2);
    await add('story navigation link', page.locator('.story-row__detail'), 2);
    await add('story source link', page.locator('.story-row__source'), 2);
  } else {
    await add('detail button', page.locator('.detail button'), 3);
    await add('detail source link', page.locator('.detail__source'), 1);
    await add('comment-body anchor', page.locator('.detail-comment__body a'), 2);
  }

  return targets;
}

async function measureTextClipping(page: Page, surface: Surface) {
  const selectors = surface === 'listing'
    ? ['.listing__header h1', '.story-row__title', '.story-row__meta', '.story-row__source', '.listing__button', '.theme-toggle']
    : ['.detail__title', '.detail__source', '.detail-comment__body', '.detail-comment__body a', '.detail-comment__toggle', '.theme-toggle'];

  return page.evaluate((requestedSelectors) => requestedSelectors.flatMap((selector) => {
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const style = getComputedStyle(element);
        const clippedX = ['hidden', 'clip'].includes(style.overflowX)
          && element.scrollWidth > element.clientWidth + 1;
        const clippedY = ['hidden', 'clip'].includes(style.overflowY)
          && element.scrollHeight > element.clientHeight + 1;
        const ellipsized = style.textOverflow === 'ellipsis'
          && element.scrollWidth > element.clientWidth + 1;
        return {
          element: `${selector}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`,
          clipped: clippedX || clippedY || ellipsized,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      });
  }), selectors);
}

async function runScenario(
  page: Page,
  surface: Surface,
  theme: Theme,
  width: 320 | 375,
  scale: TextScale,
  apiRequests: string[],
  results: ScenarioMeasurement[],
) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto('/');
  await expect(page.locator('.listing')).toBeVisible();
  const primaryStoryLink = page.locator(`.story-row__detail[href="/item/${storyId}"]`);
  await expect(primaryStoryLink).toBeVisible();

  if (surface === 'detail') {
    await primaryStoryLink.click();
    await expect(page).toHaveURL(new RegExp(`/item/${storyId}$`));
    await expect(page.locator('.detail')).toBeVisible();
    await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toContainText(ownCommentText);
  }

  const themeAttribute = await page.locator('html').getAttribute('data-theme');
  if (theme === 'dark') expect(themeAttribute).toBe('dark');
  else expect(themeAttribute).not.toBe('dark');

  const glyphSelector = surface === 'listing' ? '.listing__header h1' : '.detail__title';
  let scaleEvidence: ScaleEvidence | undefined;
  if (scale === 'simulated-200') scaleEvidence = await applyTextResizeSimulation(page, glyphSelector);

  const targets = await measureTargets(page, surface);
  const clipping = await measureTextClipping(page, surface);
  const documentMetrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  let categoryStrip: ScenarioMeasurement['categoryStrip'];
  if (surface === 'listing') {
    const strip = page.locator('.category-tabs');
    const jobsTab = page.locator('#category-tab-job');
    await jobsTab.scrollIntoViewIfNeeded();
    categoryStrip = await strip.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const tab = element.querySelector<HTMLElement>('#category-tab-job');
      if (!tab) throw new Error('Jobs tab missing from category strip.');
      const tabRect = tab.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: Math.round(element.scrollLeft * 100) / 100,
        jobsVisible: tabRect.left >= rect.left - 1 && tabRect.right <= rect.right + 1,
      };
    });
  }

  const scenario: ScenarioMeasurement = {
    surface,
    theme,
    viewport: width,
    scale,
    innerWidth: documentMetrics.innerWidth,
    documentClientWidth: documentMetrics.clientWidth,
    documentScrollWidth: documentMetrics.scrollWidth,
    targets,
    textClipping: clipping,
    ...(categoryStrip ? { categoryStrip } : {}),
    ...(scaleEvidence ? { scaleEvidence } : {}),
  };
  results.push(scenario);

  if (surface === 'detail' && theme === 'light' && width === 320 && scale === 'simulated-200') {
    const toggle = page.locator('.detail-comment__toggle');
    const requestsBeforeToggle = apiRequests.length;
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(page.locator('[data-comment-id="5301"] .detail-comment__collapsed-count')).toBeVisible();
    await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toHaveCount(0);
    await expect(page.locator('[data-comment-id="5302"]')).toHaveCount(0);
    expect(await toggle.getAttribute('aria-expanded')).toBe('false');
    await toggle.click();
    await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toContainText(ownCommentText);
    await expect(page.locator('[data-comment-id="5302"]')).toBeVisible();
    expect(await toggle.getAttribute('aria-expanded')).toBe('true');
    expect(apiRequests.length).toBe(requestsBeforeToggle);
  }
}

test('measures responsive layout, text reflow simulation and 44px targets on list and detail', async ({ page, browser }) => {
  test.setTimeout(60_000);
  const apiRequests: string[] = [];
  const results: ScenarioMeasurement[] = [];
  await installLocalApiFixture(page, apiRequests);
  await page.emulateMedia({ colorScheme: 'light' });

  const issueList: string[] = [];
  try {
    const themes: Theme[] = ['light', 'dark'];
    for (const theme of themes) {
      if (theme === 'dark') {
        await page.setViewportSize({ width: 320, height: 812 });
        await page.goto('/');
        await expect(page.locator('.theme-toggle')).toBeVisible();
        if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
          await page.locator('.theme-toggle').click();
        }
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      }

      for (const surface of ['listing', 'detail'] as const) {
        for (const width of [320, 375] as const) {
          for (const scale of ['normal', 'simulated-200'] as const) {
            await runScenario(page, surface, theme, width, scale, apiRequests, results);
          }
        }
      }
    }

    for (const result of results) {
      const prefix = `${result.theme}/${result.surface}/${result.viewport}/${result.scale}`;
      if (result.innerWidth !== result.viewport) issueList.push(`${prefix}: innerWidth=${result.innerWidth}`);
      if (result.documentClientWidth !== result.viewport) {
        issueList.push(`${prefix}: clientWidth=${result.documentClientWidth}`);
      }
      if (result.documentScrollWidth > result.viewport) {
        issueList.push(`${prefix}: document scrollWidth=${result.documentScrollWidth}`);
      }
      for (const target of result.targets) {
        if (target.width < 44 || target.height < 44) {
          issueList.push(`${prefix}: target below 44x44: ${target.name}=${target.width}x${target.height}`);
        }
      }
      for (const clipped of result.textClipping) {
        if (clipped.clipped) issueList.push(`${prefix}: clipped text ${clipped.element}`);
      }
      if (result.surface === 'listing' && (!result.categoryStrip?.jobsVisible
        || (result.categoryStrip.scrollWidth > result.categoryStrip.clientWidth && result.categoryStrip.scrollLeft <= 0))) {
        issueList.push(`${prefix}: Jobs tab not reachable by internal category scrolling`);
      }
      if (result.scale === 'simulated-200') {
        const evidence = result.scaleEvidence;
        if (!evidence) {
          issueList.push(`${prefix}: missing simulated scale evidence`);
          continue;
        }
        if (evidence.viewportBefore !== result.viewport || evidence.viewportAfter !== result.viewport) {
          issueList.push(`${prefix}: simulation changed CSS viewport ${evidence.viewportBefore}→${evidence.viewportAfter}`);
        }
        if (evidence.htmlFontSizeBefore !== evidence.htmlFontSizeAfter) {
          issueList.push(`${prefix}: html font-size changed ${evidence.htmlFontSizeBefore}→${evidence.htmlFontSizeAfter}`);
        }
        if (evidence.glyphBefore.rangeRects !== 1 || evidence.glyphAfter.rangeRects !== 1) {
          issueList.push(`${prefix}: representative glyph range was not single-line`);
        }
        const glyphRatio = evidence.glyphAfter.rangeHeight / evidence.glyphBefore.rangeHeight;
        if (glyphRatio < 1.8) issueList.push(`${prefix}: rendered glyph height ratio=${rounded(glyphRatio)}`);
        const fontRatio = evidence.glyphAfter.fontSize / evidence.glyphBefore.fontSize;
        if (Math.abs(fontRatio - 2) > 0.02) issueList.push(`${prefix}: glyph computed font ratio=${rounded(fontRatio)}`);
        for (const text of evidence.textSnapshot) {
          const ratio = text.fontSizeAfter / text.fontSizeBefore;
          if (Math.abs(ratio - 2) > 0.02) {
            issueList.push(`${prefix}: ${text.element} computed font ratio=${rounded(ratio)}`);
          }
          if (text.lineHeightRatio !== null && Math.abs(text.lineHeightRatio - 2) > 0.03) {
            issueList.push(`${prefix}: ${text.element} numeric line-height ratio=${text.lineHeightRatio}`);
          }
        }
      }
    }

    expect(results).toHaveLength(16);
    expect(issueList, `Responsive text measurements found failures:\n${issueList.join('\n')}`).toEqual([]);
  } finally {
    console.log(`RESPONSIVE_TEXT_MEASURE_JSON ${JSON.stringify({
      capturedAt: new Date().toISOString(),
      nodeVersion: process.version,
      browserName: browser.browserType().name(),
      browserVersion: browser.version(),
      simulation: 'test-only per-element computed font-size 2x and original numeric computed line-height 2x; no html/root/viewport/DPR/zoom mutation',
      apiRequests,
      results,
      issues: issueList,
    })}`);
  }
});

test('rejects a fixture story source hidden from target measurement', async ({ page }) => {
  test.setTimeout(10_000);
  await installLocalApiFixture(page, []);
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');

  const primaryStoryLink = page.locator(`.story-row__detail[href="/item/${storyId}"]`);
  await expect(primaryStoryLink).toBeVisible();
  const primarySource = page.locator('.story-row__source').first();
  await expect(primarySource).toBeVisible();
  await primarySource.evaluate((element) => {
    (element as HTMLElement).style.display = 'none';
  });

  await expect(measureTargets(page, 'listing', 100)).rejects.toThrow(/toBeVisible/);
});
