import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const cachedAt = '2026-10-12T12:00:00.000Z';
const categoryLabels = {
  top: 'Top',
  new: 'New',
  best: 'Best',
  ask: 'Ask',
  show: 'Show',
  job: 'Jobs',
} as const;
type Category = keyof typeof categoryLabels;

const categories = Object.keys(categoryLabels) as Category[];
const storyId = 731_001;
const detailId = 731_002;
const detailStory = {
  id: detailId,
  type: 'story',
  title: 'Detalhe acessível por teclado',
  url: null,
  domain: null,
  author: 'fixture-author',
  score: 42,
  commentCount: 3,
  createdAt: '2026-10-12T09:00:00.000Z',
  cachedAt,
};
const detailItemEnvelope = { item: detailStory, cachedAt, stale: false };
const detailComments = [
  {
    id: 731_101,
    author: 'root-autor',
    text: '<p>Corpo do comentário raiz.</p>',
    createdAt: '2026-10-12T09:10:00.000Z',
    status: 'ok',
    children: [
      {
        id: 731_102,
        author: 'child-autor',
        text: '<p>Corpo do comentário filho.</p>',
        createdAt: '2026-10-12T09:11:00.000Z',
        status: 'ok',
        children: [
          {
            id: 731_103,
            author: 'grandchild-autor',
            text: '<p>Corpo do neto.</p>',
            createdAt: '2026-10-12T09:12:00.000Z',
            status: 'ok',
            children: [],
          },
        ],
      },
    ],
  },
];

function categoryStory(category: Category) {
  const isJob = category === 'job';
  return {
    id: storyId,
    type: isJob ? 'job' : 'story',
    title: `História ${categoryLabels[category]} da fixture`,
    url: isJob ? null : 'https://source.example/story',
    domain: isJob ? null : 'source.example',
    author: isJob ? null : 'fixture-author',
    score: isJob ? null : 42,
    commentCount: isJob ? 0 : 1,
    createdAt: isJob ? null : '2026-10-12T09:00:00.000Z',
    cachedAt,
  };
}

function storyEnvelope(category: Category, items = [categoryStory(category)], page = 1, hasMore = false) {
  return {
    items,
    page,
    limit: 30,
    snapshot: `snapshot-keyboard-${category}-v1`,
    cachedAt,
    stale: false,
    hasMore,
  };
}

function commentsEnvelope(nodes = detailComments) {
  return { nodes, truncated: false, cachedAt, stale: false };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function withDeadline<T>(promise: Promise<T>, event: string, timeoutMs = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

async function mockDetailApi(page: Page, id: number, itemEnvelope: unknown = detailItemEnvelope) {
  await page.route(`**/api/items/${id}**`, async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname.endsWith('/comments') ? commentsEnvelope() : itemEnvelope;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

async function installCategoryApi(page: Page, requests?: URL[]) {
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    requests?.push(url);
    const category = (url.searchParams.get('category') ?? 'top') as Category;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(storyEnvelope(category)),
    });
  });
}

async function focusEvidence(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      id: element.id,
      name: element.getAttribute('aria-label') ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      role: element.getAttribute('role'),
      active: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      rectVisible: rect.width > 0
        && rect.height > 0
        && rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight,
    };
  });
}

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const evidence = await focusEvidence(locator);
  expect(evidence.active).toBe(true);
  expect(evidence.focusVisible).toBe(true);
  expect(evidence.outlineStyle).not.toBe('none');
  expect(evidence.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(
    evidence.rectVisible,
    `focus rectangle outside viewport: ${JSON.stringify({ id: evidence.id, name: evidence.name, role: evidence.role, rect: evidence.rect, viewport: evidence.viewport })}`,
  ).toBe(true);
}

async function expectTabInsideStrip(tab: Locator, requireScroll: boolean) {
  const evidence = await tab.evaluate((element) => {
    const strip = element.closest('.category-tabs');
    if (!strip) return null;
    const tabRect = element.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const container = strip as HTMLElement;
    return {
      contained: tabRect.left >= stripRect.left - 1 && tabRect.right <= stripRect.right + 1,
      scrollable: container.scrollWidth > container.clientWidth,
      scrollLeft: container.scrollLeft,
    };
  });
  expect(evidence).not.toBeNull();
  expect(evidence!.contained).toBe(true);
  if (requireScroll && await tab.getAttribute('id') === 'category-tab-job') {
    expect(evidence!.scrollable).toBe(true);
    expect(evidence!.scrollLeft).toBeGreaterThan(0);
  }
}

async function pressCategoryArrowAndAssertInstantScroll(page: Page, key: 'ArrowLeft' | 'ArrowRight') {
  await page.evaluate(() => {
    const strip = document.querySelector('.category-tabs');
    if (!(strip instanceof HTMLElement)) throw new Error('Category tab strip not found.');
    const values: number[] = [];
    const onScroll = () => values.push(strip.scrollLeft);
    strip.addEventListener('scroll', onScroll);
    Object.assign(window, {
      __keyboardTabScrollCapture: {
        values,
        stop: () => strip.removeEventListener('scroll', onScroll),
      },
    });
  });
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
  const positions = await page.evaluate(() => {
    const captureWindow = window as Window & {
      __keyboardTabScrollCapture?: { values: number[]; stop: () => void };
    };
    const capture = captureWindow.__keyboardTabScrollCapture;
    capture?.stop();
    delete captureWindow.__keyboardTabScrollCapture;
    return [...new Set(capture?.values ?? [])];
  });
  expect(positions.length, 'keyboard arrow navigation must not animate horizontal scrolling').toBeLessThanOrEqual(1);
}

async function focusedElementIsTab(page: Page, name: string, requireScroll: boolean) {
  const tab = page.getByRole('tab', { name });
  await expectVisibleKeyboardFocus(tab);
  await expectTabInsideStrip(tab, requireScroll);
  return tab;
}

test.beforeEach(async ({ browser }) => {
  console.log(`KEYBOARD_FOCUS_RUNTIME node=${process.version} browser=${browser.browserType().name()} version=${browser.version()}`);
});

for (const width of [320, 375] as const) {
  test(`uses keyboard traversal for all six category tabs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ colorScheme: 'light' });
    const categoryRequests: URL[] = [];
    await installCategoryApi(page, categoryRequests);
    await mockDetailApi(page, storyId, {
      item: { ...categoryStory('top'), id: storyId },
      cachedAt,
      stale: false,
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
    const tablist = page.getByRole('tablist', { name: 'Categorias' });
    const panel = page.getByRole('tabpanel');
    await expect(tablist).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(6);

    await page.keyboard.press('Tab');
    let focusedTab = await focusedElementIsTab(page, 'Top', true);
    await expect(focusedTab).toHaveAttribute('aria-selected', 'true');
    await expect(focusedTab).toHaveAttribute('aria-controls', 'listing-panel');
    await expect(panel).toHaveAccessibleName('Top');

    for (const category of categories.slice(1)) {
      const selectedBeforeArrow = await page.getByRole('tab', { selected: true }).innerText();
      const urlBeforeArrow = page.url();
      const requestsBeforeArrow = categoryRequests.length;
      await pressCategoryArrowAndAssertInstantScroll(page, 'ArrowRight');
      focusedTab = await focusedElementIsTab(page, categoryLabels[category], true);
      await expect(focusedTab).toHaveAttribute('aria-selected', 'false');
      await expect(page.getByRole('tab', { selected: true })).toHaveAccessibleName(selectedBeforeArrow);
      expect(page.url()).toBe(urlBeforeArrow);
      expect(categoryRequests).toHaveLength(requestsBeforeArrow);
      await page.keyboard.press('Enter');
      await expect(focusedTab).toBeFocused();
      await expect(focusedTab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
      await expect(page.getByRole('heading', { name: categoryLabels[category], level: 1 })).toBeVisible();
      await expect.poll(() => categoryRequests.length).toBe(requestsBeforeArrow + 1);
      await expect(panel).toHaveAccessibleName(categoryLabels[category]);
      if (category === 'top') {
        await expect(page).toHaveURL(/\/$/);
      } else {
        await expect(page).toHaveURL(new RegExp(`[?&]category=${category}(?:&|$)`));
      }
      const tabId = await focusedTab.getAttribute('id');
      await expect(focusedTab).toHaveAttribute('aria-controls', 'listing-panel');
      await expect(panel).toHaveAttribute('aria-labelledby', tabId!);
    }

    await page.keyboard.press('ArrowRight');
    focusedTab = await focusedElementIsTab(page, 'Top', true);
    await expect(focusedTab).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(focusedTab).toHaveAttribute('aria-selected', 'true');

    await pressCategoryArrowAndAssertInstantScroll(page, 'ArrowLeft');
    focusedTab = await focusedElementIsTab(page, 'Jobs', true);
    await expect(focusedTab).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(focusedTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    focusedTab = await focusedElementIsTab(page, 'Top', true);
    await page.keyboard.press('Enter');
    await expect(focusedTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: /História Top da fixture/ })).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(panel).toBeFocused();
    await page.keyboard.press('Tab');
    const theme = page.getByRole('button', { name: 'Alternar tema claro e escuro' });
    await expectVisibleKeyboardFocus(theme);
    await page.keyboard.press('Tab');
    const storyLink = page.getByRole('link', { name: /História Top da fixture/ });
    await expectVisibleKeyboardFocus(storyLink);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/item/${storyId}$`));
    await expect(page.getByRole('heading', { name: 'História Top da fixture', level: 1 })).toBeVisible();
  });
}

test('keeps keyboard pagination focus visible unless the user moves it during a retained response', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ colorScheme: 'light' });

  const pageTwoStarted = deferred();
  const pageTwoGate = deferred();
  const pageThreeStarted = deferred();
  const pageThreeGate = deferred();
  const routeDrains: Promise<void>[] = [];
  const routeErrors: string[] = [];
  const storyRequests: URL[] = [];
  await page.route('**/api/stories**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const url = new URL(route.request().url());
    storyRequests.push(url);
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    try {
      if (requestedPage === 2) {
        pageTwoStarted.resolve();
        await pageTwoGate.promise;
      } else if (requestedPage === 3) {
        pageThreeStarted.resolve();
        await pageThreeGate.promise;
      }
      const items = Array.from({ length: 30 }, (_, index) => ({
        ...categoryStory('top'),
        id: storyId + requestedPage * 1_000 + index,
        title: `História da página ${requestedPage}, item ${index + 1}`,
      }));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...storyEnvelope('top', items, requestedPage, true),
          snapshot: 'snapshot-keyboard-pagination-v1',
        }),
      });
    } catch (error) {
      routeErrors.push(String(error));
    } finally {
      done.resolve();
    }
  });

  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /^História da página 1, item 1\b/ })).toBeVisible();

    await page.keyboard.press('Tab');
    await expectVisibleKeyboardFocus(page.getByRole('tab', { name: 'Top' }));
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tabpanel')).toBeFocused();
    await page.keyboard.press('Tab');
    const theme = page.getByRole('button', { name: 'Alternar tema claro e escuro' });
    await expectVisibleKeyboardFocus(theme);
    await expect(theme).toHaveAttribute('aria-pressed', 'false');

    const urlBeforeTheme = page.url();
    const scrollBeforeTheme = await page.evaluate(() => window.scrollY);
    const contentBeforeTheme = await page.locator('.story-list').innerText();
    const requestsBeforeTheme = storyRequests.length;
    await page.keyboard.press('Enter');
    await expect(theme).toHaveAttribute('aria-pressed', 'true');
    await expectVisibleKeyboardFocus(theme);
    await page.keyboard.press('Space');
    await expect(theme).toHaveAttribute('aria-pressed', 'false');
    await expectVisibleKeyboardFocus(theme);
    await expect(page).toHaveURL(urlBeforeTheme);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeTheme);
    expect(await page.locator('.story-list').innerText()).toBe(contentBeforeTheme);
    expect(storyRequests).toHaveLength(requestsBeforeTheme);

    await page.keyboard.press('Tab');
    await expectVisibleKeyboardFocus(page.getByRole('link', { name: /^História da página 1, item 1\b/ }));
    for (let index = 0; index < 59; index += 1) await page.keyboard.press('Tab');
    const lastSourcePageOne = page.locator('.story-row__source').nth(29);
    await expectVisibleKeyboardFocus(lastSourcePageOne);
    await page.keyboard.press('Tab');
    const loadMore = page.getByRole('button', { name: /Carregar mais|Carregando mais/ });
    await expectVisibleKeyboardFocus(loadMore);

    await page.keyboard.press('Enter');
    await withDeadline(pageTwoStarted.promise, 'page 2 request to start');
    await expect(loadMore).toBeDisabled();
    await expect(loadMore).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status', { name: 'Carregando mais histórias' })).toBeVisible();
    expect(storyRequests).toHaveLength(2);
    const pageTwoUrl = storyRequests[1];
    expect([...pageTwoUrl!.searchParams.entries()].sort()).toEqual([
      ['category', 'top'],
      ['limit', '30'],
      ['page', '2'],
      ['snapshot', 'snapshot-keyboard-pagination-v1'],
    ]);

    await page.keyboard.press('Shift+Tab');
    await expectVisibleKeyboardFocus(lastSourcePageOne);
    pageTwoGate.resolve();
    await expect(page.getByRole('heading', { name: /^História da página 2, item 1$/, level: 2 })).toBeVisible();
    const storyList = page.getByRole('list', { name: 'Histórias em Top' });
    await expect(storyList.getByRole('listitem')).toHaveCount(60);
    await expect(loadMore).toBeEnabled();
    await expect(loadMore).toHaveAttribute('aria-busy', 'false');
    await expectVisibleKeyboardFocus(lastSourcePageOne);
    await expect(loadMore).not.toBeFocused();

    for (let index = 0; index < 61; index += 1) await page.keyboard.press('Tab');
    await expectVisibleKeyboardFocus(loadMore);
    const scrollBeforePageThree = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Enter');
    await withDeadline(pageThreeStarted.promise, 'page 3 request to start');
    await expect(loadMore).toBeDisabled();
    await expect(loadMore).toHaveAttribute('aria-busy', 'true');
    expect(storyRequests).toHaveLength(3);
    const pageThreeUrl = storyRequests[2];
    expect([...pageThreeUrl!.searchParams.entries()].sort()).toEqual([
      ['category', 'top'],
      ['limit', '30'],
      ['page', '3'],
      ['snapshot', 'snapshot-keyboard-pagination-v1'],
    ]);

    pageThreeGate.resolve();
    await expect(page.getByRole('heading', { name: /^História da página 3, item 1$/, level: 2 })).toBeVisible();
    await expect(storyList.getByRole('listitem')).toHaveCount(90);
    await expect(loadMore).toBeEnabled();
    await expect(loadMore).toHaveAttribute('aria-busy', 'false');
    await expectVisibleKeyboardFocus(loadMore);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBeforePageThree);
    await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(1);
    expect(storyRequests).toHaveLength(3);
    expect(routeErrors).toEqual([]);
  } finally {
    pageTwoGate.resolve();
    pageThreeGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'list route handlers to drain');
  }
});

test('uses keyboard for theme and comment-tree disclosure without extra API requests', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'light' });
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/')) apiRequests.push(pathname);
  });
  await mockDetailApi(page, detailId);
  await installCategoryApi(page);

  await page.goto(`/item/${detailId}`);
  await expect(page.getByRole('heading', { name: 'Detalhe acessível por teclado', level: 1 })).toBeVisible();
  const rootComment = page.getByRole('article', { name: 'Comentário de root-autor' });
  const childComment = page.getByRole('article', { name: 'Comentário de child-autor' });
  const grandchildComment = page.getByRole('article', { name: 'Comentário de grandchild-autor' });
  await expect(rootComment).toBeVisible();
  await expect(childComment).toBeVisible();
  await expect(grandchildComment).toBeVisible();
  expect(apiRequests.sort()).toEqual(['/api/stories', `/api/items/${detailId}`, `/api/items/${detailId}/comments`].sort());

  await page.keyboard.press('Tab');
  await expectVisibleKeyboardFocus(page.getByRole('button', { name: 'Voltar' }));
  await page.keyboard.press('Tab');
  const theme = page.getByRole('button', { name: 'Alternar tema claro e escuro' });
  await expectVisibleKeyboardFocus(theme);
  await expect(theme).toHaveAttribute('aria-pressed', 'false');

  const urlBeforeTheme = page.url();
  const scrollBeforeTheme = await page.evaluate(() => window.scrollY);
  const contentBeforeTheme = await page.locator('.detail__comments').innerText();
  const requestsBeforeTheme = apiRequests.length;
  await page.keyboard.press('Enter');
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expectVisibleKeyboardFocus(theme);
  await page.keyboard.press('Space');
  await expect(theme).toHaveAttribute('aria-pressed', 'false');
  await expectVisibleKeyboardFocus(theme);
  await expect(page).toHaveURL(urlBeforeTheme);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeTheme);
  expect(await page.locator('.detail__comments').innerText()).toBe(contentBeforeTheme);
  expect(apiRequests).toHaveLength(requestsBeforeTheme);

  await page.keyboard.press('Tab');
  const rootToggle = rootComment.getByRole('button');
  await expect(rootToggle).toHaveAccessibleName('Recolher, 2 respostas carregadas');
  await expectVisibleKeyboardFocus(rootToggle);
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'true');
  const requestsBeforeTree = apiRequests.length;

  await page.keyboard.press('Space');
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rootComment.locator('.detail-comment__body')).toHaveCount(0);
  await expect(childComment).toHaveCount(0);
  await expectVisibleKeyboardFocus(rootToggle);
  await page.keyboard.press('Enter');
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(rootComment.locator('.detail-comment__body')).toHaveText('Corpo do comentário raiz.');
  await expect(childComment).toBeVisible();
  await expectVisibleKeyboardFocus(rootToggle);

  await page.keyboard.press('Tab');
  const childToggle = childComment.getByRole('button');
  await expect(childToggle).toHaveAccessibleName('Recolher, 1 resposta carregada');
  await expectVisibleKeyboardFocus(childToggle);
  await page.keyboard.press('Space');
  await expect(childToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(childComment.locator('.detail-comment__body')).toHaveCount(0);
  await expect(grandchildComment).toHaveCount(0);
  await expectVisibleKeyboardFocus(childToggle);
  await page.keyboard.press('Enter');
  await expect(childToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(childComment.locator('.detail-comment__body')).toHaveText('Corpo do comentário filho.');
  await expect(grandchildComment).toBeVisible();
  await expectVisibleKeyboardFocus(childToggle);
  expect(apiRequests).toHaveLength(requestsBeforeTree);

  await page.keyboard.press('Shift+Tab');
  await expectVisibleKeyboardFocus(rootToggle);
  await page.keyboard.press('Space');
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(childComment).toHaveCount(0);
  await page.keyboard.press('Tab');
  const focusRemainsOutsideCollapsedSubtree = await page.evaluate(() => {
    const active = document.activeElement;
    return !(active instanceof Element && active.closest('.detail-comment-tree'));
  });
  expect(focusRemainsOutsideCollapsedSubtree).toBe(true);
  await expect(grandchildComment).toHaveCount(0);
});

test('disables actual list and detail loader motion when reduced motion is preferred', async ({ page }) => {
  test.setTimeout(30_000);
  const listGate = deferred();
  const listStarted = deferred();
  const detailGate = deferred();
  const detailStarted = deferred();
  const routeDrains: Promise<void>[] = [];
  const routeErrors: string[] = [];

  await page.route('**/api/stories**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    try {
      listStarted.resolve();
      await listGate.promise;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(storyEnvelope('top')),
      });
    } catch (error) {
      routeErrors.push(`stories: ${String(error)}`);
    } finally {
      done.resolve();
    }
  });
  await page.route(`**/api/items/${detailId}**`, async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const pathname = new URL(route.request().url()).pathname;
    try {
      if (pathname.endsWith('/comments')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([])) });
      } else {
        detailStarted.resolve();
        await detailGate.promise;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(detailItemEnvelope) });
      }
    } catch (error) {
      routeErrors.push(`${pathname}: ${String(error)}`);
    } finally {
      done.resolve();
    }
  });

  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await withDeadline(listStarted.promise, 'list loader request');
    const listSkeleton = page.locator('.story-skeleton span').first();
    await expect(listSkeleton).toBeVisible();
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
    await expect.poll(() => listSkeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('skeleton-pulse');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect.poll(() => listSkeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    listGate.resolve();
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`/item/${detailId}`);
    await withDeadline(detailStarted.promise, 'detail loader request');
    const detailSkeleton = page.locator('.detail__skeleton span').first();
    await expect(detailSkeleton).toBeVisible();
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false);
    await expect.poll(() => detailSkeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('detail-pulse');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect.poll(() => detailSkeleton.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    detailGate.resolve();
    await expect(page.getByRole('heading', { name: 'Detalhe acessível por teclado', level: 1 })).toBeVisible();
    expect(routeErrors).toEqual([]);
  } finally {
    listGate.resolve();
    detailGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'loader route handlers to drain');
  }
});

test('rejects a test-only invisible keyboard focus outline', async ({ page }) => {
  await installCategoryApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  const topTab = page.getByRole('tab', { name: 'Top' });
  await expectVisibleKeyboardFocus(topTab);

  await topTab.evaluate((element) => {
    (element as HTMLElement).style.setProperty('outline', 'none', 'important');
  });
  const evidence = await focusEvidence(topTab);
  expect(evidence.active).toBe(true);
  expect(evidence.focusVisible).toBe(true);
  expect(evidence.outlineStyle).toBe('none');
  expect(evidence.rectVisible).toBe(true);
  const focusContractPasses = evidence.active
    && evidence.focusVisible
    && evidence.outlineStyle !== 'none'
    && evidence.outlineWidth >= 2
    && evidence.rectVisible;
  expect(focusContractPasses).toBe(false);
});
