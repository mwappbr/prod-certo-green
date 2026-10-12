import { expect, test, type Page } from '@playwright/test';

test('shows a normalized top page from the local HN fixture', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 2 })).toBeVisible();
  await expect(page.getByText('42 pontos')).toBeVisible();
  await expect(page.getByText('maia')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir example.com em nova aba' })).toHaveAttribute(
    'href',
    'https://www.example.com/historia',
  );
  await expect(page.getByRole('heading', { name: 'História sem domínio', level: 2 })).toBeVisible();
  await expect(page.getByText('Autor desconhecido')).toBeVisible();

  const response = await page.request.get('/api/stories?category=top');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toMatchObject({ page: 1, limit: 30, stale: false });
  expect(body.items).toHaveLength(2);
  const publicJson = JSON.stringify(body);
  expect(publicJson).not.toMatch(/"(by|descendants|kids|time)"\s*:/);
  expect(publicJson).not.toContain('Registro malformado');
});

test('renders the backend-normalized Job item in the Jobs category', async ({ page }) => {
  await page.goto('/?category=job');

  await expect(page.getByRole('tab', { name: 'Jobs' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  const job = page.getByRole('article', { name: 'Vaga com HTTPS', exact: true });
  await expect(job).toBeVisible();
  await expect(job.getByText('Pontuação indisponível')).toBeVisible();
  await expect(job.getByText('Autor desconhecido')).toBeVisible();
  await expect(job.locator('time')).toHaveText('data desconhecida');
  await expect(job.getByText('0 comentários')).toBeVisible();
  await expect(job.getByRole('link', { name: 'Abrir jobs.example.net em nova aba' })).toHaveAttribute(
    'href',
    'https://jobs.example.net/vaga',
  );
  await expect(page.getByText('Nenhuma história em job agora.', { exact: true })).toHaveCount(0);

  const response = await page.request.get('/api/stories?category=job');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.items).toContainEqual(expect.objectContaining({ id: 106, type: 'job', title: 'Vaga com HTTPS' }));
});

test('offers a retry action when the API is unavailable', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/stories**', async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UPSTREAM_UNAVAILABLE', message: 'HN indisponível. Tente novamente.' },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('HN indisponível. Tente novamente.');
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 2 })).toBeVisible();
  expect(calls).toBe(2);
});

const categories = [
  { value: 'top', label: 'Top' },
  { value: 'new', label: 'New' },
  { value: 'best', label: 'Best' },
  { value: 'ask', label: 'Ask' },
  { value: 'show', label: 'Show' },
  { value: 'job', label: 'Jobs' },
] as const;

type Category = (typeof categories)[number]['value'];

type ControlledRaf = {
  enable: () => void;
  pendingCount: () => number;
  flushNext: () => void;
};

type WindowWithControlledRaf = Window & { __controlledRaf?: ControlledRaf };

async function installControlledRaf(page: Page) {
  await page.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextId = 1_000_000;
    let controlled = false;
    const controller: ControlledRaf = {
      enable: () => { controlled = true; },
      pendingCount: () => callbacks.size,
      flushNext: () => {
        const next = callbacks.entries().next();
        if (next.done) return;
        const [id, callback] = next.value;
        callbacks.delete(id);
        callback(performance.now());
      },
    };

    (window as WindowWithControlledRaf).__controlledRaf = controller;
    window.requestAnimationFrame = (callback) => {
      if (!controlled) return nativeRequest(callback);
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      if (callbacks.delete(id)) return;
      nativeCancel(id);
    };
  });
}

function mockListingItem(category: Category, index: number) {
  const categoryIndex = categories.findIndex((entry) => entry.value === category);
  const cachedAt = '2026-10-11T12:00:00.000Z';
  if (category === 'job') {
    return {
      id: 80_000 + categoryIndex * 100 + index,
      type: 'job',
      title: `Vaga ${category} ${index + 1}`,
      url: null,
      domain: null,
      author: null,
      score: null,
      commentCount: 0,
      createdAt: null,
      cachedAt,
    };
  }

  const noDomain = category === 'ask';
  return {
    id: 80_000 + categoryIndex * 100 + index,
    type: 'story',
    title: `História ${category} ${index + 1}`,
    url: noDomain ? null : `https://example.com/${category}/${index}`,
    domain: noDomain ? null : 'example.com',
    author: `autor-${category}`,
    score: 42,
    commentCount: 5,
    createdAt: '2026-10-11T12:00:00.000Z',
    cachedAt,
  };
}

function mockStoriesPage(
  category: Category,
  count = 1,
  stale = false,
  page = 1,
  hasMore: boolean | null = false,
) {
  const cachedAt = '2026-10-11T12:00:00.000Z';
  const snapshot = `snapshot-${category}-2026-10-11T11:55:00.000Z`;
  return {
    items: Array.from({ length: count }, (_, index) => mockListingItem(category, (page - 1) * 30 + index)),
    page,
    limit: 30,
    snapshot,
    cachedAt,
    stale,
    ...(hasMore === null ? {} : { hasMore }),
  };
}

function mockItemEnvelope(id: number) {
  const categoryIndex = Math.max(0, Math.floor((id - 80_000) / 100));
  const category = categories[categoryIndex]?.value ?? 'top';
  const index = (id - 80_000) % 100;
  const item = mockListingItem(category, index);
  return { item, cachedAt: item.cachedAt, stale: false };
}

function mockCommentsEnvelope() {
  return {
    nodes: [],
    truncated: false,
    cachedAt: '2026-10-11T12:00:00.000Z',
    stale: false,
  };
}

async function installDetailApiMocks(page: Page) {
  await page.route('**/api/items/**', async (route) => {
    const url = new URL(route.request().url());
    const id = Number(url.pathname.split('/')[3]);
    const response = url.pathname.endsWith('/comments')
      ? mockCommentsEnvelope()
      : mockItemEnvelope(id);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });
}

test('uses singular labels for one point and one comment', async ({ page }) => {
  await page.route('**/api/stories**', async (route) => {
    const item = mockListingItem('new', 0);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...mockStoriesPage('new'),
        items: [{ ...item, score: 1, commentCount: 1 }],
      }),
    });
  });

  await page.goto('/?category=new');
  const row = page.getByRole('article', { name: 'História new 1', exact: true });
  await expect(row.getByText('1 ponto', { exact: true })).toBeVisible();
  await expect(row.getByText('1 comentário', { exact: true })).toBeVisible();
  await expect(row.getByText('1 pontos', { exact: true })).toHaveCount(0);
  await expect(row.getByText('1 comentários', { exact: true })).toHaveCount(0);
});

test('wraps long listing content and keeps Jobs reachable at 320px', async ({ page }) => {
  const longTitle = 't'.repeat(180);
  const longDomain = `${'d'.repeat(72)}.example`;
  const longAuthor = 'a'.repeat(160);

  await page.route('**/api/stories**', async (route) => {
    const category = (new URL(route.request().url()).searchParams.get('category') ?? 'top') as Category;
    const response = mockStoriesPage(category);
    const items = category === 'top'
      ? [{
          ...mockListingItem('top', 0),
          title: longTitle,
          url: `https://${longDomain}/story`,
          domain: longDomain,
          author: longAuthor,
        }]
      : response.items;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...response, items }),
    });
  });

  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');

  const longRow = page.getByRole('article', { name: longTitle, exact: true });
  await expect(page.getByRole('heading', { name: longTitle, level: 2, exact: true })).toBeVisible();
  await expect(longRow.getByRole('link', { name: `Abrir ${longDomain} em nova aba` })).toBeVisible();
  await expect(longRow.getByText(longAuthor, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const categoryStrip = page.locator('.category-tabs');
  const stripDimensions = await categoryStrip.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(stripDimensions.scrollWidth).toBeGreaterThan(stripDimensions.clientWidth);

  const jobsTab = page.getByRole('tab', { name: 'Jobs' });
  await jobsTab.scrollIntoViewIfNeeded();
  await expect(jobsTab).toBeInViewport();
  await expect.poll(() => categoryStrip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await jobsTab.click();
  await expect(page).toHaveURL(/\/?category=job(?:&|$)/);
  await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Vaga job 1', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('wraps unbroken listing error messages at 320px', async ({ page }) => {
  const longError = 'falha'.repeat(80);
  await page.route('**/api/stories**', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: longError } }),
    });
  });

  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(longError);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('appends the next page from its snapshot and keeps the control disabled while loading', async ({ page }) => {
  const requests: URL[] = [];
  let releaseSecondPage!: () => void;
  let signalSecondPage!: () => void;
  const secondPageResponse = new Promise<void>((resolve) => { releaseSecondPage = resolve; });
  const secondPageStarted = new Promise<void>((resolve) => { signalSecondPage = resolve; });

  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (requestedPage === 2) {
      signalSecondPage();
      await secondPageResponse;
    }
    const response = requestedPage === 1
      ? mockStoriesPage('top', 29, false, 1, true)
      : mockStoriesPage('top', 30, false, 2, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(29);
  const loadMore = page.locator('.listing__load-more');
  await loadMore.scrollIntoViewIfNeeded();
  const savedPosition = await page.evaluate(() => window.scrollY);
  await loadMore.click();
  await secondPageStarted;
  await expect(loadMore).toBeDisabled();
  expect(requests.filter((url) => url.searchParams.get('page') === '2')).toHaveLength(1);
  releaseSecondPage();

  await expect(page.getByRole('heading', { name: 'História top 31', level: 2, exact: true })).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(59);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedPosition);

  const secondPageUrl = requests.find((url) => url.searchParams.get('page') === '2');
  expect(secondPageUrl?.searchParams.get('category')).toBe('top');
  expect(secondPageUrl?.searchParams.get('limit')).toBe('30');
  expect(secondPageUrl?.searchParams.get('snapshot')).toBe('snapshot-top-2026-10-11T11:55:00.000Z');
  expect(secondPageUrl?.searchParams.get('snapshot')).not.toBe('2026-10-11T12:00:00.000Z');
  expect(secondPageUrl?.searchParams.has('cachedAt')).toBe(false);
  await expect(page.locator('.listing__load-more')).toHaveCount(0);
});

test('keeps advancing after an empty page and never loads automatically on scroll', async ({ page }) => {
  const requestedPages: number[] = [];
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    requestedPages.push(requestedPage);
    const response = requestedPage === 1
      ? mockStoriesPage('top', 20, false, 1, true)
      : requestedPage === 2
        ? mockStoriesPage('top', 0, false, 2, true)
        : mockStoriesPage('top', 1, false, 3, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(20);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  expect(requestedPages).toEqual([1]);

  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect.poll(() => requestedPages.length).toBe(2);
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toBeVisible();
  await expect(page.locator('.listing__load-more')).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  expect(requestedPages).toEqual([1, 2]);

  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(page.getByRole('heading', { name: 'História top 61', level: 2, exact: true })).toBeVisible();
  expect(requestedPages).toEqual([1, 2, 3]);
  await expect(page.locator('.listing__load-more')).toHaveCount(0);
});

test('treats a missing hasMore flag as unknown rather than end of list', async ({ page }) => {
  const requestedPages: number[] = [];
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    requestedPages.push(requestedPage);
    const response = requestedPage === 1
      ? mockStoriesPage('top', 0, false, 1, null)
      : mockStoriesPage('top', 1, false, 2, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Carregar mais' })).toBeVisible();
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(page.getByRole('heading', { name: 'História top 31', level: 2, exact: true })).toBeVisible();
  expect(requestedPages).toEqual([1, 2]);
});

test('keeps existing rows below an incremental error and retries identical parameters', async ({ page }) => {
  const pageTwoUrls: URL[] = [];
  let pageTwoAttempts = 0;
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (requestedPage === 2) {
      pageTwoUrls.push(url);
      pageTwoAttempts += 1;
      if (pageTwoAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Falha na página seguinte.' } }),
        });
        return;
      }
    }
    const response = requestedPage === 1
      ? mockStoriesPage('top', 2, false, 1, true)
      : mockStoriesPage('top', 1, false, 2, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/');
  await expect(page.locator('.story-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  const incrementalError = page.locator('.listing__notice--incremental');
  await expect(incrementalError).toContainText('Falha na página seguinte.');
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toBeVisible();
  const errorIsBelowRows = await page.evaluate(() => {
    const list = document.querySelector('.story-list');
    const error = document.querySelector('.listing__notice--incremental');
    return Boolean(list && error && (list.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(errorIsBelowRows).toBe(true);

  await incrementalError.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { name: 'História top 31', level: 2, exact: true })).toBeVisible();
  expect(pageTwoAttempts).toBe(2);
  expect(pageTwoUrls.map((url) => url.search)).toEqual([pageTwoUrls[0]?.search, pageTwoUrls[0]?.search]);
  expect(pageTwoUrls[0]?.searchParams.get('snapshot')).toBe('snapshot-top-2026-10-11T11:55:00.000Z');
});

test('discards an expired sequence and announces the refreshed first page', async ({ page }) => {
  const requests: URL[] = [];
  let firstPageCalls = 0;
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (requestedPage > 1) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SNAPSHOT_EXPIRED', message: 'A lista expirou.' } }),
      });
      return;
    }

    firstPageCalls += 1;
    const response = mockStoriesPage('new', 20, false, 1, true);
    const items = response.items.map((item, index) => ({
      ...item,
      title: firstPageCalls === 1 ? `História vencida ${index + 1}` : `História atualizada ${index + 1}`,
      cachedAt: firstPageCalls === 1 ? item.cachedAt : '2026-10-12T10:00:00.000Z',
    }));
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...response,
        items,
        snapshot: firstPageCalls === 1 ? response.snapshot : 'snapshot-new-generation',
        cachedAt: firstPageCalls === 1 ? response.cachedAt : '2026-10-12T10:00:00.000Z',
      }),
    });
  });

  await page.goto('/?category=new');
  await expect(page.getByRole('article', { name: 'História vencida 1', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(page.getByRole('status')).toContainText('A lista mudou e foi atualizada.');
  await expect(page.getByRole('article', { name: 'História atualizada 1', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'História vencida 1', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(firstPageCalls).toBe(2);
  expect(requests.at(-1)?.searchParams.get('category')).toBe('new');
  expect(requests.at(-1)?.searchParams.has('snapshot')).toBe(false);
});

test('restores loaded pages, category, and scroll when returning from real item detail', async ({ page }) => {
  const requestedPages: number[] = [];
  const detailApiRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/items/')) detailApiRequests.push(path);
  });
  await installDetailApiMocks(page);
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    requestedPages.push(requestedPage);
    const response = requestedPage === 1
      ? mockStoriesPage('new', 20, false, 1, true)
      : mockStoriesPage('new', 10, false, 2, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/?category=new');
  await expect(page.locator('.story-row')).toHaveCount(20);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  const targetRow = page.locator('.story-row').nth(14);
  await targetRow.scrollIntoViewIfNeeded();
  const savedPosition = await page.evaluate(() => window.scrollY);
  await page.getByRole('link', { name: /História new 15/ }).click();
  await expect(page).toHaveURL(/\/item\/80114$/);
  await expect(page.getByRole('heading', { name: 'História new 15', level: 1 })).toBeVisible();
  await expect(page.getByText('Sem comentários ainda.', { exact: true })).toBeVisible();
  expect(detailApiRequests.sort()).toEqual(['/api/items/80114', '/api/items/80114/comments']);

  await page.goBack();
  await expect(page).toHaveURL(/\/?category=new$/);
  await expect(page.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.story-row')).toHaveCount(30);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedPosition);
  expect(requestedPages).toEqual([1, 2]);

  await page.getByRole('link', { name: /História new 15/ }).click();
  await expect(page.getByRole('heading', { name: 'História new 15', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  expect(requestedPages).toEqual([1, 2]);
  expect(detailApiRequests).toHaveLength(4);
});

for (const category of ['new', 'job'] as const) {
  test(`preserves ${category} pages across Back, Forward, and Voltar`, async ({ page }) => {
    const requests: { category: Category; page: number }[] = [];
    const detailApiRequests: string[] = [];
    const label = categories.find((entry) => entry.value === category)?.label ?? category;
    const targetId = mockListingItem(category, 14).id;
    const targetTitle = category === 'job' ? 'Vaga job 15' : 'História new 15';
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/items/')) detailApiRequests.push(path);
    });
    await installDetailApiMocks(page);
    await page.route('**/api/stories**', async (route) => {
      const url = new URL(route.request().url());
      const requestedCategory = (url.searchParams.get('category') ?? 'top') as Category;
      const requestedPage = Number(url.searchParams.get('page') ?? '1');
      requests.push({ category: requestedCategory, page: requestedPage });
      const response = requestedPage === 1
        ? mockStoriesPage(category, 20, false, 1, true)
        : mockStoriesPage(category, 10, false, 2, false);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });

    await page.goto(`/?category=${category}`);
    await expect(page.locator('.story-row')).toHaveCount(20);
    await page.getByRole('button', { name: 'Carregar mais' }).click();
    await expect(page.locator('.story-row')).toHaveCount(30);
    const titlesBefore = await page.locator('.story-row__title').allTextContents();
    const targetRow = page.locator('.story-row').nth(14);
    await targetRow.scrollIntoViewIfNeeded();
    const savedPosition = await page.evaluate(() => window.scrollY);
    expect(savedPosition).toBeGreaterThan(0);
    await targetRow.locator('.story-row__detail').click();
    await expect(page).toHaveURL(new RegExp(`/item/${targetId}$`));
    await expect(page.getByRole('heading', { name: targetTitle, level: 1 })).toBeVisible();
    await expect(page.getByText('Sem comentários ainda.', { exact: true })).toBeVisible();
    expect(detailApiRequests.sort()).toEqual([`/api/items/${targetId}`, `/api/items/${targetId}/comments`]);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`\\?category=${category}$`));
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.story-row')).toHaveCount(30);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedPosition);
    expect(await page.locator('.story-row__title').allTextContents()).toEqual(titlesBefore);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/item/${targetId}$`));
    await expect(page.getByRole('heading', { name: targetTitle, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page).toHaveURL(new RegExp(`\\?category=${category}$`));
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.story-row')).toHaveCount(30);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedPosition);
    expect(await page.locator('.story-row__title').allTextContents()).toEqual(titlesBefore);
    expect(requests).toEqual([{ category, page: 1 }, { category, page: 2 }]);
    expect(detailApiRequests).toHaveLength(4);
  });
}

test('cancels a queued page scroll restore when changing category', async ({ page }) => {
  let releasePageThree!: () => void;
  let signalPageThree!: () => void;
  let signalPageThreeSettled!: () => void;
  let releaseNewPage!: () => void;
  let signalNewPage!: () => void;
  const pageThreeResponse = new Promise<void>((resolve) => { releasePageThree = resolve; });
  const pageThreeStarted = new Promise<void>((resolve) => { signalPageThree = resolve; });
  const pageThreeSettled = new Promise<void>((resolve) => { signalPageThreeSettled = resolve; });
  const newPageResponse = new Promise<void>((resolve) => { releaseNewPage = resolve; });
  const newPageStarted = new Promise<void>((resolve) => { signalNewPage = resolve; });

  await installControlledRaf(page);
  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const category = (url.searchParams.get('category') ?? 'top') as Category;
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (category === 'top' && requestedPage === 3) {
      signalPageThree();
      await pageThreeResponse;
      try {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStoriesPage('top', 1, false, 3, false)) });
      } catch {
        // The category change may abort this pending request.
      } finally {
        signalPageThreeSettled();
      }
      return;
    }
    if (category === 'new') {
      signalNewPage();
      await newPageResponse;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStoriesPage('new', 1, false, 1, false)) });
      return;
    }
    const response = category === 'top'
      ? requestedPage === 1
        ? mockStoriesPage('top', 20, false, 1, true)
        : mockStoriesPage('top', 10, false, 2, true)
      : mockStoriesPage(category, 1, false, 1, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.setViewportSize({ width: 320, height: 320 });
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toBeVisible();
  const firstLoadMore = page.getByRole('button', { name: 'Carregar mais' });
  await firstLoadMore.scrollIntoViewIfNeeded();
  const savedPosition = await page.evaluate(() => window.scrollY);
  expect(savedPosition).toBeGreaterThan(0);
  await page.evaluate(() => {
    const controller = (window as WindowWithControlledRaf).__controlledRaf;
    if (!controller) throw new Error('RAF test controller was not installed.');
    controller.enable();
  });

  await firstLoadMore.click();
  await expect(page.locator('.story-row')).toHaveCount(30);
  await expect(page.getByRole('button', { name: 'Carregar mais' })).toBeEnabled();
  await expect.poll(() => page.evaluate(
    () => (window as WindowWithControlledRaf).__controlledRaf?.pendingCount() ?? 0,
  )).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await pageThreeStarted;
  await page.getByRole('tab', { name: 'New' }).click();
  await newPageStarted;
  await expect(page.getByRole('heading', { name: 'New', level: 1 })).toBeVisible();
  await page.evaluate(() => (window as WindowWithControlledRaf).__controlledRaf?.flushNext());
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  releasePageThree();
  await pageThreeSettled;
  releaseNewPage();
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'História top 31', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as WindowWithControlledRaf).__controlledRaf?.flushNext());
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

for (const path of ['/not-a-route', '/item/not-a-number', '/item/9007199254740992']) {
  test(`shows an accessible route error for ${path} and returns to the listing`, async ({ page }) => {
    const detailApiRequests: string[] = [];
    page.on('request', (request) => {
      const requestPath = new URL(request.url()).pathname;
      if (requestPath.startsWith('/api/item') || requestPath.startsWith('/api/comments')) detailApiRequests.push(requestPath);
    });
    await page.route('**/api/stories**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStoriesPage('top')) });
    });

    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Página não encontrada', level: 1 })).toBeVisible();
    await expect(page.getByText('O endereço solicitado não corresponde a uma página disponível.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar à lista' })).toBeVisible();
    expect(detailApiRequests).toEqual([]);

    await page.getByRole('button', { name: 'Voltar à lista' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  });
}

test('ignores a late page response after changing category', async ({ page }) => {
  let releaseTopPage!: () => void;
  let signalTopPage!: () => void;
  let signalTopSettled!: () => void;
  const topPageResponse = new Promise<void>((resolve) => { releaseTopPage = resolve; });
  const topPageStarted = new Promise<void>((resolve) => { signalTopPage = resolve; });
  const topPageSettled = new Promise<void>((resolve) => { signalTopSettled = resolve; });

  await page.route('**/api/stories**', async (route) => {
    const url = new URL(route.request().url());
    const category = (url.searchParams.get('category') ?? 'top') as Category;
    const requestedPage = Number(url.searchParams.get('page') ?? '1');
    if (category === 'top' && requestedPage === 2) {
      signalTopPage();
      await topPageResponse;
      try {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStoriesPage('top', 1, false, 2, false)) });
      } catch {
        // The client may abort the request after leaving the category.
      } finally {
        signalTopSettled();
      }
      return;
    }
    const response = category === 'top'
      ? mockStoriesPage('top', 2, false, 1, true)
      : mockStoriesPage(category, 1, false, 1, false);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await topPageStarted;
  await page.getByRole('tab', { name: 'New' }).click();
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toBeVisible();
  releaseTopPage();
  await topPageSettled;
  await expect(page.getByRole('article', { name: 'História top 31', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toBeVisible();
});

test('supports query-backed tabs for all categories and resets scroll', async ({ page }) => {
  const requested = new Set<Category>();
  const requestCounts = new Map<Category, number>();
  await page.route('**/api/stories**', async (route) => {
    const category = new URL(route.request().url()).searchParams.get('category') ?? 'top';
    const requestedCategory = category as Category;
    requested.add(requestedCategory);
    requestCounts.set(requestedCategory, (requestCounts.get(requestedCategory) ?? 0) + 1);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(mockStoriesPage(category as Category, 20)),
    });
  });

  await page.setViewportSize({ width: 375, height: 812 });
  for (const category of categories) {
    await page.goto(`/?category=${category.value}`);
    await expect(page.getByRole('tab', { name: category.label })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: category.label, level: 1 })).toBeVisible();
    const firstTitle = category.value === 'job' ? 'Vaga job 1' : `História ${category.value} 1`;
    await expect(page.getByRole('heading', { name: firstTitle, level: 2, exact: true })).toBeVisible();
    const firstItem = page.getByRole('article', { name: firstTitle, exact: true });
    if (category.value === 'job') {
      await expect(firstItem.getByText('Pontuação indisponível')).toBeVisible();
      await expect(firstItem.getByText('Autor desconhecido')).toBeVisible();
      await expect(firstItem.locator('time')).toHaveText('data desconhecida');
      await expect(firstItem.getByText('0 comentários')).toBeVisible();
    } else {
      await expect(firstItem.getByText('42 pontos')).toBeVisible();
      await expect(firstItem.getByText(`autor-${category.value}`)).toBeVisible();
      await expect(firstItem.locator('time')).toHaveAttribute('datetime', '2026-10-11T12:00:00.000Z');
      await expect(firstItem.getByText('5 comentários')).toBeVisible();
    }
    if (category.value === 'ask' || category.value === 'job') {
      await expect(page.getByRole('link', { name: /Abrir/ })).toHaveCount(0);
    }
  }
  expect([...requested].sort()).toEqual(categories.map((category) => category.value).sort());

  const categoryStrip = page.locator('.category-tabs');
  expect(await categoryStrip.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 320, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/');
  await page.getByRole('tab', { name: 'Top' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'New' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/?category=new(?:&|$)/);
  await expect(page.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(20);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Best' }).click();
  await expect(page).toHaveURL(/\/?category=best(?:&|$)/);
  await expect(page.getByRole('article', { name: 'História best 1', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const newRequestsBeforeBack = requestCounts.get('new') ?? 0;
  await page.goBack();
  await expect(page).toHaveURL(/\/?category=new(?:&|$)/);
  await expect(page.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'New', level: 1 })).toBeVisible();
  await expect.poll(() => requestCounts.get('new') ?? 0).toBeGreaterThan(newRequestsBeforeBack);
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toBeVisible();

  const bestRequestsBeforeForward = requestCounts.get('best') ?? 0;
  await page.goForward();
  await expect(page).toHaveURL(/\/?category=best(?:&|$)/);
  await expect(page.getByRole('tab', { name: 'Best' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Best', level: 1 })).toBeVisible();
  await expect.poll(() => requestCounts.get('best') ?? 0).toBeGreaterThan(bestRequestsBeforeForward);
  await expect(page.getByRole('article', { name: 'História best 1', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Top' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('tab', { name: 'Top' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toBeVisible();
});

test('isolates category loading and ignores late responses from an abandoned category', async ({ page }) => {
  let releaseNew!: () => void;
  let signalNewRequest!: () => void;
  let signalNewSettled!: () => void;
  const newResponse = new Promise<void>((resolve) => {
    releaseNew = resolve;
  });
  const newRequestStarted = new Promise<void>((resolve) => {
    signalNewRequest = resolve;
  });
  const newRequestSettled = new Promise<void>((resolve) => {
    signalNewSettled = resolve;
  });

  await page.route('**/api/stories**', async (route) => {
    const category = (new URL(route.request().url()).searchParams.get('category') ?? 'top') as Category;
    if (category === 'new') {
      signalNewRequest();
      await newResponse;
      try {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockStoriesPage(category)),
        });
      } catch {
        // The browser may cancel the request when its category is left.
      } finally {
        signalNewSettled();
      }
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(mockStoriesPage(category)),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toBeVisible();
  await expect(page.locator('.freshness')).toContainText('Atualizado em');
  await page.getByRole('tab', { name: 'New' }).click();
  await newRequestStarted;

  await expect(page.getByRole('heading', { name: 'New', level: 1 })).toBeVisible();
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByLabel('Carregando histórias')).toBeVisible();
  await expect(page.getByRole('article', { name: 'História top 1', exact: true })).toHaveCount(0);
  await expect(page.locator('.freshness')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Best' }).click();
  await expect(page.getByRole('article', { name: 'História best 1', exact: true })).toBeVisible();
  releaseNew();
  await newRequestSettled;
  await expect(page.getByRole('article', { name: 'História best 1', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'História new 1', exact: true })).toHaveCount(0);
});

test('announces loading, stale content, and an empty category', async ({ page }) => {
  let finishTop!: () => void;
  const topResponse = new Promise<void>((resolve) => {
    finishTop = resolve;
  });
  await page.route('**/api/stories**', async (route) => {
    const category = (new URL(route.request().url()).searchParams.get('category') ?? 'top') as Category;
    if (category === 'top') {
      await topResponse;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(mockStoriesPage(category, 1, true)),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(mockStoriesPage(category, 0)),
    });
  });

  await page.goto('/');
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByLabel('Carregando histórias')).toBeVisible();
  finishTop();
  await expect(page.getByRole('status')).toContainText('Exibindo dados de');
  await expect(page.getByText('Atualizado em')).toBeVisible();

  await page.getByRole('tab', { name: 'Ask' }).click();
  await expect(page.getByText('Nenhuma história em ask agora.', { exact: true })).toBeVisible();
});
