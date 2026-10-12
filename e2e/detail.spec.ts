import { expect, test, type Page } from '@playwright/test';
import { createCommentsTreeFixture } from './fixtures/comments-tree-200.mjs';

const story = {
  id: 101,
  type: 'story',
  title: 'Roteiro & dados',
  url: 'https://www.example.com/historia',
  domain: 'example.com',
  author: 'maia',
  score: 42,
  commentCount: 1,
  createdAt: '2026-10-12T09:00:00.000Z',
  cachedAt: '2026-10-12T10:00:00.000Z',
};

const initialComment = {
  id: 201,
  author: 'ren',
  text: '<p>Comentário inicial com <strong>formatação</strong>.</p>',
  createdAt: '2026-10-12T09:45:00.000Z',
  status: 'ok',
  children: null,
};

function itemEnvelope(item: { cachedAt: string } = story, cachedAt = item.cachedAt, stale = false) {
  return { item, cachedAt, stale };
}

function commentsEnvelope(
  nodes = [initialComment],
  cachedAt = '2026-10-12T09:30:00.000Z',
  stale = false,
) {
  return { nodes, truncated: false, cachedAt, stale };
}

async function mockItemApi(
  page: Page,
  id: number,
  itemResponse: unknown,
  commentsResponse: unknown,
) {
  await page.route(`**/api/items/${id}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(path.endsWith('/comments') ? commentsResponse : itemResponse),
    });
  });
}

function localClock(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
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

const emptyCommentsStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Sem comentários ainda.' });

const loadingCommentsStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Carregando comentários…' });

test('renders story metadata and the first comment from the shared envelopes', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/items/')) requests.push(`${url.pathname}${url.search}`);
  });
  await mockItemApi(page, 101, itemEnvelope(), commentsEnvelope());

  await page.goto('/item/101');

  await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
  await expect(page.getByText('42 pontos', { exact: true })).toBeVisible();
  await expect(page.getByText('maia', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir example.com em nova aba' })).toHaveAttribute(
    'href',
    'https://www.example.com/historia',
  );
  await expect(page.getByRole('article', { name: 'Comentário de ren' })).toBeVisible();
  await expect(page.getByText('Comentário inicial com formatação.')).toBeVisible();
  await expect(page.locator('.detail__freshness')).toHaveText(`Atualizado em ${localClock('2026-10-12T09:30:00.000Z')}`);
  expect(requests.sort()).toEqual([
    '/api/items/101',
    '/api/items/101/comments',
  ]);
});

test('renders the 3.3 HN fixture tree, collapse state, and warm item cache through the local BFF', async ({ page }) => {
  test.setTimeout(30_000);
  const fixture = createCommentsTreeFixture();
  const cachedAt = '2026-10-12T10:00:00.000Z';
  const story = {
    id: fixture.storyId,
    type: 'story',
    title: fixture.story.title,
    url: null,
    domain: null,
    author: 'fixture-story-author',
    score: 33,
    commentCount: fixture.story.descendants,
    createdAt: new Date(fixture.story.time * 1000).toISOString(),
    cachedAt,
  };
  const listedStories = Array.from({ length: 20 }, (_, index) => ({
    ...story,
    id: 98_320_000 + index,
    title: `Fixture list item ${index + 1}`,
    author: `fixture-list-author-${index + 1}`,
    commentCount: 0,
  }));
  listedStories[14] = story;
  const browserDetailRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/items/')) browserDetailRequests.push(`${url.pathname}${url.search}`);
  });
  await page.route('**/api/stories**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: listedStories,
        page: 1,
        limit: 30,
        snapshot: 'snapshot-3.3-comment-tree',
        cachedAt,
        stale: false,
        hasMore: false,
      }),
    });
  });
  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00.000Z'));
  await page.setViewportSize({ width: 320, height: 812 });

  const fixtureIds = [fixture.storyId, ...fixture.allCommentIds];
  const readHnCounters = async () => {
    const response = await page.request.get(`/__test/hn-counters?ids=${fixtureIds.join(',')}`, { timeout: 5_000 });
    expect(response.ok()).toBeTruthy();
    return await response.json() as Record<string, number>;
  };
  const beforeLoad = await readHnCounters();
  expect(Object.values(beforeLoad).every((count) => count === 0)).toBe(true);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  const storyLink = page.getByRole('link', { name: /3\.3 fixture comment tree/ });
  await storyLink.scrollIntoViewIfNeeded();
  const savedScroll = await page.evaluate(() => window.scrollY);
  expect(savedScroll).toBeGreaterThan(0);
  await storyLink.click();
  await expect(page).toHaveURL(new RegExp(`/item/${fixture.storyId}$`));
  await expect(page.getByRole('heading', { name: fixture.story.title, level: 1 })).toBeVisible();

  const commentArticles = page.getByRole('article', { name: /^Comentário de fixture-author-/ });
  await expect(commentArticles).toHaveCount(220, { timeout: 15_000 });
  const renderedComments = await commentArticles.evaluateAll((elements) => elements.map((element) => {
    const article = element as HTMLElement;
    const id = Number(article.dataset.commentId);
    const header = article.querySelector('.detail-comment__header');
    const time = header?.querySelector('time');
    return {
      id,
      author: header?.querySelector('span')?.textContent,
      body: article.querySelector('.detail-comment__body')?.textContent?.trim(),
      datetime: time?.getAttribute('datetime'),
      relativeTime: time?.textContent?.trim(),
      level: article.querySelector('.detail-comment__visually-hidden')?.textContent?.trim(),
    };
  }));
  expect(new Set(renderedComments.map((comment) => comment.id)).size).toBe(220);
  expect(new Set(renderedComments.map((comment) => comment.id))).toEqual(new Set(fixture.visibleCommentIds));
  for (const rendered of renderedComments) {
    const raw = fixture.items[String(rendered.id)];
    expect(rendered.author).toBe(`fixture-author-${rendered.id}`);
    expect(rendered.body).toBe(`fixture-comment-${rendered.id}-body`);
    expect(rendered.datetime).toBe(new Date(raw.time * 1000).toISOString());
    expect(rendered.relativeTime).not.toBe('');
    expect(rendered.level).toMatch(/^nível [1-8]$/);
  }
  const loadedCommentIds = new Set(fixture.visibleCommentIds);
  expect(await page.locator('.detail-comment-list > li > article[data-comment-id]').evaluateAll(
    (elements) => elements.map((element) => Number((element as HTMLElement).dataset.commentId)),
  )).toEqual(fixture.story.kids.filter((id) => loadedCommentIds.has(id)));
  const renderedDirectChildren = await page.locator('article[data-comment-id]').evaluateAll((elements) => elements.map((element) => {
    const article = element as HTMLElement;
    const row = article.closest('li');
    const childList = Array.from(row?.children ?? []).find((child) => child.matches('ol.detail-comment-tree'));
    const childArticles = childList
      ? Array.from(childList.children)
        .map((child) => Array.from(child.children).find((candidate) => candidate.matches('article[data-comment-id]')))
        .filter((child): child is Element => child !== undefined)
      : [];
    return {
      parentId: Number(article.dataset.commentId),
      childIds: childArticles.map((child) => Number((child as HTMLElement).dataset.commentId)),
    };
  }));
  for (const { parentId, childIds } of renderedDirectChildren) {
    const rawParent = fixture.items[String(parentId)];
    expect(childIds).toEqual(rawParent.kids.filter((id) => loadedCommentIds.has(id)));
  }

  for (const [index, id] of fixture.chainIds.slice(0, 8).entries()) {
    const article = page.locator(`article[data-comment-id="${id}"]`);
    const row = article.locator('xpath=ancestor::li[1]');
    const expectedOffset = Math.min(index, 3) * 16;
    await expect(row).toHaveAttribute('data-comment-level', String(index + 1));
    await expect(article).toHaveAttribute('data-comment-offset', String(expectedOffset));
    expect(await article.evaluate((element) => getComputedStyle(element).marginInlineStart)).toBe(`${expectedOffset}px`);
  }
  const cutNode = page.locator(`article[data-comment-id="${fixture.chainIds[7]}"]`);
  await expect(cutNode.locator('.detail-comment__continuation')).toHaveText('Continuação não carregada.');
  await expect(cutNode.getByRole('button')).toHaveCount(0);
  await expect(page.locator(`article[data-comment-id="${fixture.depthNineId}"]`)).toHaveCount(0);

  const mainRootId = fixture.mainIds[0];
  const mainRoot = page.locator(`article[data-comment-id="${mainRootId}"]`);
  const mainRootRow = mainRoot.locator('xpath=ancestor::li[1]');
  const loadedDescendants = mainRootRow.locator('.detail-comment-tree article[data-comment-id]');
  const loadedCount = await loadedDescendants.count();
  expect(loadedCount).toBeGreaterThan(1);
  const nestedId = Number(await loadedDescendants.first().getAttribute('data-comment-id'));
  const nested = page.locator(`article[data-comment-id="${nestedId}"]`);
  const nestedDescendantCount = await nested.locator('xpath=ancestor::li[1]')
    .locator('.detail-comment-tree article[data-comment-id]')
    .count();
  expect(nestedDescendantCount).toBeGreaterThan(0);
  await nested.getByRole('button', { name: /^Recolher,/ }).click();
  await expect(nested.getByRole('button', { name: /^Expandir,/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(nested.locator('.detail-comment__collapsed-count')).toBeVisible();

  const plural = loadedCount === 1 ? 'resposta carregada' : 'respostas carregadas';
  const hiddenCopy = loadedCount === 1
    ? '1 resposta carregada oculta'
    : `${loadedCount} respostas carregadas ocultas`;
  await mainRoot.getByRole('button', { name: `Recolher, ${loadedCount} ${plural}` }).click();
  await expect(mainRoot.getByRole('button', { name: `Expandir, ${loadedCount} ${plural}` })).toHaveAttribute('aria-expanded', 'false');
  await expect(mainRoot.locator('.detail-comment__header')).toBeVisible();
  await expect(mainRoot.locator('.detail-comment__collapsed-count')).toHaveText(hiddenCopy);
  await expect(mainRoot.locator('.detail-comment__body')).toHaveCount(0);
  await expect(mainRootRow.locator('.detail-comment-tree article[data-comment-id]')).toHaveCount(0);
  await mainRoot.getByRole('button', { name: `Expandir, ${loadedCount} ${plural}` }).press('Enter');
  await expect(mainRoot.getByRole('button', { name: `Recolher, ${loadedCount} ${plural}` })).toHaveAttribute('aria-expanded', 'true');
  const nestedAfterParentExpand = page.locator(`article[data-comment-id="${nestedId}"]`);
  await expect(nestedAfterParentExpand.getByRole('button', { name: /^Expandir,/ })).toHaveAttribute('aria-expanded', 'false');
  await nestedAfterParentExpand.getByRole('button', { name: /^Expandir,/ }).press('Space');
  await expect(nestedAfterParentExpand.getByRole('button', { name: /^Recolher,/ })).toHaveAttribute('aria-expanded', 'true');
  await nestedAfterParentExpand.getByRole('button', { name: /^Recolher,/ }).press('Space');
  await expect(nestedAfterParentExpand.getByRole('button', { name: /^Expandir,/ })).toHaveAttribute('aria-expanded', 'false');
  await mainRoot.getByRole('button', { name: `Recolher, ${loadedCount} ${plural}` }).click();

  const afterFirstLoad = await readHnCounters();
  const loadedIds = [fixture.storyId, ...fixture.visibleCommentIds];
  for (const id of loadedIds) expect(afterFirstLoad[String(id)] - beforeLoad[String(id)]).toBe(1);
  expect(afterFirstLoad[String(fixture.depthNineId)] - beforeLoad[String(fixture.depthNineId)]).toBe(0);
  expect(browserDetailRequests.sort()).toEqual([
    `/api/items/${fixture.storyId}`,
    `/api/items/${fixture.storyId}/comments`,
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(20);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 }).toBe(savedScroll);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/item/${fixture.storyId}$`));
  const revisitedRoot = page.locator(`article[data-comment-id="${mainRootId}"]`);
  await expect(revisitedRoot.getByRole('button', { name: `Expandir, ${loadedCount} ${plural}` })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => browserDetailRequests.length, { timeout: 5_000 }).toBe(4);
  expect(await readHnCounters()).toEqual(afterFirstLoad);

  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 }).toBe(savedScroll);
  await page.getByRole('link', { name: /3\.3 fixture comment tree/ }).click();
  const secondRevisitRoot = page.locator(`article[data-comment-id="${mainRootId}"]`);
  await expect(secondRevisitRoot.getByRole('button', { name: `Expandir, ${loadedCount} ${plural}` })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => browserDetailRequests.length, { timeout: 5_000 }).toBe(6);
  expect(await readHnCounters()).toEqual(afterFirstLoad);

  await page.reload();
  await expect(page.getByRole('heading', { name: fixture.story.title, level: 1 })).toBeVisible();
  await expect(commentArticles).toHaveCount(220, { timeout: 15_000 });
  const reloadedRoot = page.locator(`article[data-comment-id="${mainRootId}"]`);
  await expect(reloadedRoot.getByRole('button', { name: `Recolher, ${loadedCount} ${plural}` })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`article[data-comment-id="${nestedId}"]`).getByRole('button', { name: /^Recolher,/ })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => browserDetailRequests.length, { timeout: 5_000 }).toBe(8);
  expect(await readHnCounters()).toEqual(afterFirstLoad);
  expect(browserDetailRequests.filter((request) => request === `/api/items/${fixture.storyId}/comments`)).toHaveLength(4);
});

for (const revisitState of [
  { name: 'leaf', children: [] as const },
  { name: 'cutoff', children: null },
] as const) {
  test(`restores a collapsed comment body when replies become ${revisitState.name} after SPA revisit (UI-only)`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-12T10:00:00.000Z'));
    const rootId = 601;
    const childId = 602;
    const rootAuthor = 'root-revisit-colapsavel';
    const childAuthor = 'filho-revisit-oculto';
    const ownBody = 'corpo-proprio-reaparece';
    const root = {
      ...initialComment,
      id: rootId,
      author: rootAuthor,
      text: `<p>${ownBody}</p>`,
      children: [{
        ...initialComment,
        id: childId,
        author: childAuthor,
        text: '<p>corpo-descendente-oculto</p>',
        children: [],
      }],
    };
    let commentsRequests = 0;

    await page.route('**/api/stories**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: [story],
          page: 1,
          limit: 30,
          snapshot: 'snapshot-3.3-collapse-revisit-ui',
          cachedAt: story.cachedAt,
          stale: false,
          hasMore: false,
        }),
      });
    });
    await page.route('**/api/items/101**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/comments')) {
        commentsRequests += 1;
        const node = commentsRequests === 1 ? root : { ...root, children: revisitState.children };
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ nodes: [node], truncated: false, cachedAt: story.cachedAt, stale: false }),
        });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(itemEnvelope()) });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /Roteiro & dados/ }).click();
    await expect(page).toHaveURL(/\/item\/101$/);

    const comment = page.getByRole('article', { name: `Comentário de ${rootAuthor}` });
    await expect(comment.getByRole('button', { name: 'Recolher, 1 resposta carregada' })).toBeVisible();
    await comment.getByRole('button', { name: 'Recolher, 1 resposta carregada' }).click();
    await expect(comment.locator('.detail-comment__body')).toHaveCount(0);
    await expect(page.getByRole('article', { name: `Comentário de ${childAuthor}` })).toHaveCount(0);

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /Roteiro & dados/ }).click();
    await expect(page).toHaveURL(/\/item\/101$/);
    await expect.poll(() => commentsRequests).toBe(2);

    await expect(comment.locator('.detail-comment__body')).toHaveText(ownBody);
    await expect(comment.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('article', { name: `Comentário de ${childAuthor}` })).toHaveCount(0);
    if (revisitState.children === null) {
      await expect(comment.locator('.detail-comment__continuation')).toHaveText('Continuação não carregada.');
    } else {
      await expect(comment.locator('.detail-comment__continuation')).toHaveCount(0);
    }
  });
}

test('keeps collapsed markers and generic continuation/truncation states in a UI-only envelope', async ({ page }) => {
  const nodes = [
    {
      id: 501,
      author: 'autor-deletado-arvore',
      text: '<p>corpo-deletado-arvore</p>',
      createdAt: '2026-10-12T09:10:00.000Z',
      status: 'deleted',
      children: [{ ...initialComment, id: 511, author: 'filho-deletado-arvore' }],
    },
    {
      id: 502,
      author: 'autor-morto-arvore',
      text: '<p>corpo-morto-arvore</p>',
      createdAt: '2026-10-12T09:05:00.000Z',
      status: 'dead',
      children: [{ ...initialComment, id: 512, author: 'filho-morto-arvore' }],
    },
    { ...initialComment, id: 503, author: 'continua', text: '<p>continua-body</p>', children: null },
    { ...initialComment, id: 504, author: 'folha', text: '<p>folha-body</p>', children: [] },
  ];
  const response = { ...commentsEnvelope(nodes), truncated: true };
  await mockItemApi(page, 101, itemEnvelope(), response);
  await page.goto('/item/101');

  const deleted = page.getByRole('article', { name: 'Comentário de autor-deletado-arvore' });
  const dead = page.getByRole('article', { name: 'Comentário de autor-morto-arvore' });
  await expect(deleted.locator('.detail-comment__marker')).toHaveText('[removido]');
  await expect(dead.locator('.detail-comment__marker')).toHaveText('[morto]');
  await deleted.getByRole('button', { name: 'Recolher, 1 resposta carregada' }).click();
  await dead.getByRole('button', { name: 'Recolher, 1 resposta carregada' }).click();
  await expect(deleted.locator('.detail-comment__header')).toContainText('autor-deletado-arvore');
  await expect(deleted.locator('.detail-comment__marker')).toHaveText('[removido]');
  await expect(dead.locator('.detail-comment__header')).toContainText('autor-morto-arvore');
  await expect(dead.locator('.detail-comment__marker')).toHaveText('[morto]');
  await expect(page.getByRole('article', { name: 'Comentário de filho-deletado-arvore' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Comentário de filho-morto-arvore' })).toHaveCount(0);

  const continuation = page.getByRole('article', { name: 'Comentário de continua' });
  const leaf = page.getByRole('article', { name: 'Comentário de folha' });
  await expect(continuation.locator('.detail-comment__continuation')).toHaveText('Continuação não carregada.');
  await expect(continuation.getByRole('button')).toHaveCount(0);
  await expect(leaf.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Parte da árvore de respostas pode não estar carregada.' })).toBeVisible();
  await expect(page.getByText(/depth|budget|limite de respostas/i)).toHaveCount(0);
});

test('renders two comments in envelope order with author and relative-time metadata', async ({ page }) => {
  const firstAt = '2026-10-12T09:58:00.000Z';
  const secondAt = '2026-10-12T09:57:00.000Z';
  const comments = [
    { ...initialComment, id: 211, author: 'ren', text: '<p>Primeiro comentário.</p>', createdAt: firstAt },
    { ...initialComment, id: 212, author: 'kai', text: '<p>Segundo comentário.</p>', createdAt: secondAt },
  ];
  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00.000Z'));
  await mockItemApi(page, 101, itemEnvelope(), commentsEnvelope(comments));

  await page.goto('/item/101');

  const articles = page.locator('.detail-comment-list__item article');
  await expect(articles).toHaveCount(2);
  expect(await articles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))).toEqual([
    'Comentário de ren',
    'Comentário de kai',
  ]);
  await expect(articles.nth(0).locator('time')).toHaveAttribute('datetime', firstAt);
  await expect(articles.nth(0).locator('time')).toHaveText('há 2 minutos');
  await expect(articles.nth(1).locator('time')).toHaveAttribute('datetime', secondAt);
  await expect(articles.nth(1).locator('time')).toHaveText('há 3 minutos');
});

test('preserves valid authors for deleted and dead markers without rendering their bodies', async ({ page }) => {
  const deletedBody = 'corpo-deletado-nao-exibido';
  const deadBody = 'corpo-morto-nao-exibido';
  const nodes = [
    {
      id: 301,
      author: 'autor-deletado',
      text: `<p>${deletedBody}</p>`,
      createdAt: '2026-10-12T09:10:00.000Z',
      status: 'deleted',
      children: [],
    },
    {
      id: 302,
      author: 'autor-morto',
      text: `<p>${deadBody}</p>`,
      createdAt: '2026-10-12T09:05:00.000Z',
      status: 'dead',
      children: [],
    },
  ];
  await mockItemApi(page, 101, itemEnvelope(), commentsEnvelope(nodes));

  await page.goto('/item/101');

  const deleted = page.getByRole('article', { name: 'Comentário de autor-deletado' });
  await expect(deleted).toBeVisible();
  await expect(deleted.locator('.detail-comment__header')).toContainText('autor-deletado');
  await expect(deleted.locator('.detail-comment__marker')).toHaveText('[removido]');
  await expect(deleted.getByText(deletedBody, { exact: true })).toHaveCount(0);

  const dead = page.getByRole('article', { name: 'Comentário de autor-morto' });
  await expect(dead).toBeVisible();
  await expect(dead.locator('.detail-comment__header')).toContainText('autor-morto');
  await expect(dead.locator('.detail-comment__marker')).toHaveText('[morto]');
  await expect(dead.getByText(deadBody, { exact: true })).toHaveCount(0);
});

for (const staleSource of ['item', 'comments'] as const) {
  test(`shows stale data when only the ${staleSource} envelope is stale`, async ({ page }) => {
    const staleAt = '2026-10-12T08:12:00.000Z';
    const itemStale = staleSource === 'item';
    const commentsStale = staleSource === 'comments';
    await mockItemApi(
      page,
      101,
      itemEnvelope(story, itemStale ? staleAt : '2026-10-12T10:00:00.000Z', itemStale),
      commentsEnvelope([initialComment], commentsStale ? staleAt : '2026-10-12T09:30:00.000Z', commentsStale),
    );

    await page.goto('/item/101');

    await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
    await expect(page.locator('.detail__stale')).toHaveText(
      `Não foi possível atualizar. Exibindo dados de ${localClock(staleAt)}.`,
    );
    await expect(page.getByRole('article', { name: 'Comentário de ren' })).toBeVisible();
  });
}

test('announces an empty successful comments envelope only after loading', async ({ page }) => {
  const commentsGate = deferred();
  const commentsStarted = deferred();
  const routeDrains: Promise<void>[] = [];
  await page.route('**/api/items/101**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const path = new URL(route.request().url()).pathname;
    try {
      if (path.endsWith('/comments')) {
        commentsStarted.resolve();
        await commentsGate.promise;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([])) });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(itemEnvelope()) });
    } catch {
      // The page may abort a request while the test is cleaning up.
    } finally {
      done.resolve();
    }
  });

  try {
    await page.goto('/item/101');
    await withDeadline(commentsStarted.promise, 'comments request to start');
    await expect(loadingCommentsStatus(page)).toBeVisible();
    await expect(emptyCommentsStatus(page)).toHaveCount(0);
    commentsGate.resolve();
    await expect(emptyCommentsStatus(page)).toBeVisible();
  } finally {
    commentsGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'empty-state route handlers to drain');
  }
});

test('starts item and comments before release and retries only failed comments', async ({ page }) => {
  const itemGate = deferred();
  const commentsGate = deferred();
  const itemStarted = deferred();
  const commentsStarted = deferred();
  const routeDrains: Promise<void>[] = [];
  let itemAttempts = 0;
  let commentsAttempts = 0;

  await page.route('**/api/items/101**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const path = new URL(route.request().url()).pathname;
    try {
      if (path.endsWith('/comments')) {
        commentsAttempts += 1;
        if (commentsAttempts === 1) {
          commentsStarted.resolve();
          await commentsGate.promise;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Falha ao carregar comentários.' } }),
          });
          return;
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([])) });
        return;
      }

      itemAttempts += 1;
      itemStarted.resolve();
      await itemGate.promise;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(itemEnvelope()) });
    } catch {
      // A route may already be aborted during cleanup; the finally block still drains it.
    } finally {
      done.resolve();
    }
  });

  try {
    await page.goto('/item/101');
    await withDeadline(Promise.all([itemStarted.promise, commentsStarted.promise]), 'both first requests to start');
    expect(itemAttempts).toBe(1);
    expect(commentsAttempts).toBe(1);

    itemGate.resolve();
    await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
    await expect(loadingCommentsStatus(page)).toBeVisible();
    await expect(emptyCommentsStatus(page)).toHaveCount(0);

    commentsGate.resolve();
    const commentsSection = page.locator('.detail__comments');
    await expect(commentsSection.getByRole('alert')).toContainText('Falha ao carregar comentários.');
    await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
    await commentsSection.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(emptyCommentsStatus(page)).toBeVisible();
    expect(itemAttempts).toBe(1);
    expect(commentsAttempts).toBe(2);
  } finally {
    itemGate.resolve();
    commentsGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'controlled item/comments route handlers to drain');
  }
});

test('keeps successful comments while the item fails and retries only the item', async ({ page }) => {
  const itemGate = deferred();
  const commentsGate = deferred();
  const itemStarted = deferred();
  const commentsStarted = deferred();
  const routeDrains: Promise<void>[] = [];
  let itemAttempts = 0;
  let commentsAttempts = 0;

  await page.route('**/api/items/101**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const path = new URL(route.request().url()).pathname;
    try {
      if (path.endsWith('/comments')) {
        commentsAttempts += 1;
        commentsStarted.resolve();
        await commentsGate.promise;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([initialComment])) });
        return;
      }

      itemAttempts += 1;
      itemStarted.resolve();
      await itemGate.promise;
      if (itemAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Falha ao carregar o item.' } }),
        });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(itemEnvelope()) });
    } catch {
      // A route may already be aborted during cleanup; the finally block still drains it.
    } finally {
      done.resolve();
    }
  });

  try {
    await page.goto('/item/101');
    await withDeadline(Promise.all([itemStarted.promise, commentsStarted.promise]), 'both first requests to start');
    expect(itemAttempts).toBe(1);
    expect(commentsAttempts).toBe(1);

    commentsGate.resolve();
    await expect(page.getByRole('article', { name: 'Comentário de ren' })).toBeVisible();
    await expect(page.locator('.detail__skeleton')).toBeVisible();

    itemGate.resolve();
    const itemError = page.locator('.detail__notice');
    await expect(itemError).toContainText('Falha ao carregar o item.');
    await expect(page.getByRole('article', { name: 'Comentário de ren' })).toBeVisible();
    await itemError.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Comentário de ren' })).toBeVisible();
    expect(itemAttempts).toBe(2);
    expect(commentsAttempts).toBe(1);
  } finally {
    itemGate.resolve();
    commentsGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'controlled item/comments route handlers to drain');
  }
});

test('keeps the new detail after native-history SPA id change and late fulfill attempts', async ({ page }) => {
  const oldItemGate = deferred();
  const oldCommentsGate = deferred();
  const oldItemStarted = deferred();
  const oldCommentsStarted = deferred();
  const newItemStarted = deferred();
  const newCommentsStarted = deferred();
  const routeDrains: Promise<void>[] = [];
  let oldItemFulfillAttempts = 0;
  let oldCommentsFulfillAttempts = 0;
  const newRequests: string[] = [];

  await page.route('**/api/items/**', async (route) => {
    const done = deferred();
    routeDrains.push(done.promise);
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/');
    const id = Number(parts[3]);
    const isComments = url.pathname.endsWith('/comments');
    try {
      if (id === 101 && isComments) {
        oldCommentsStarted.resolve();
        await oldCommentsGate.promise;
        oldCommentsFulfillAttempts += 1;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([initialComment])) });
        return;
      }
      if (id === 101) {
        oldItemStarted.resolve();
        await oldItemGate.promise;
        oldItemFulfillAttempts += 1;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(itemEnvelope({ ...story, title: 'Resposta atrasada' })),
        });
        return;
      }
      if (id === 202 && isComments) {
        newRequests.push(`${url.pathname}${url.search}`);
        newCommentsStarted.resolve();
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(commentsEnvelope([])) });
        return;
      }
      if (id === 202) {
        newRequests.push(`${url.pathname}${url.search}`);
        newItemStarted.resolve();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(itemEnvelope({ ...story, id: 202, title: 'Destino da geração atual' })),
        });
      }
    } catch {
      // The old fetch can be aborted by the SPA transition before its late fulfill attempt.
    } finally {
      done.resolve();
    }
  });

  try {
    await page.goto('/item/101');
    await withDeadline(Promise.all([oldItemStarted.promise, oldCommentsStarted.promise]), 'old id requests to start');

    // Explicitly simulate native-history SPA navigation; this is not a user click or full-page reload.
    await page.evaluate(() => {
      window.history.pushState({ route: 'item' }, '', '/item/202');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/item\/202$/);
    await withDeadline(Promise.all([newItemStarted.promise, newCommentsStarted.promise]), 'new id requests to start');
    await expect(page.getByRole('heading', { name: 'Destino da geração atual', level: 1 })).toBeVisible();
    await expect(emptyCommentsStatus(page)).toBeVisible();
    expect(newRequests.sort()).toEqual([
      '/api/items/202',
      '/api/items/202/comments',
    ]);
  } finally {
    oldItemGate.resolve();
    oldCommentsGate.resolve();
    await withDeadline(Promise.all(routeDrains), 'old/new item route handlers to drain');
  }

  expect(oldItemFulfillAttempts).toBe(1);
  expect(oldCommentsFulfillAttempts).toBe(1);
  await expect(page).toHaveURL(/\/item\/202$/);
  await expect(page.getByRole('heading', { name: 'Destino da geração atual', level: 1 })).toBeVisible();
  await expect(emptyCommentsStatus(page)).toBeVisible();
});

test('requests comments for a Job and shows the API empty state', async ({ page }) => {
  const job = {
    id: 106,
    type: 'job',
    title: 'Vaga com HTTPS',
    url: 'https://jobs.example.net/vaga',
    domain: 'jobs.example.net',
    author: null,
    score: null,
    commentCount: 0,
    createdAt: null,
    cachedAt: '2026-10-12T10:00:00.000Z',
  };
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/items/')) requests.push(`${url.pathname}${url.search}`);
  });
  await mockItemApi(page, 106, itemEnvelope(job), commentsEnvelope([]));

  await page.goto('/item/106');

  await expect(page.getByRole('heading', { name: 'Vaga com HTTPS', level: 1 })).toBeVisible();
  await expect(emptyCommentsStatus(page)).toBeVisible();
  expect(requests.sort()).toEqual([
    '/api/items/106',
    '/api/items/106/comments',
  ]);
});

test('keeps a comment root typed and neutral while its replies endpoint remains usable', async ({ page }) => {
  const rootComment = {
    id: 201,
    type: 'comment',
    parent: 101,
    author: 'ren',
    text: '<p>Comentário raiz</p>',
    createdAt: '2026-10-12T09:45:00.000Z',
    kids: [202],
    status: 'ok',
    cachedAt: '2026-10-12T10:00:00.000Z',
  };
  const reply = { ...initialComment, id: 202, author: 'lee', children: [] };
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/items/')) requests.push(`${url.pathname}${url.search}`);
  });
  await mockItemApi(page, 201, itemEnvelope(rootComment), commentsEnvelope([reply]));

  await page.goto('/item/201');

  await expect(page.getByRole('heading', { name: 'Comentário', level: 1 })).toBeVisible();
  await expect(page.getByText('A navegação própria de comentários não está disponível nesta etapa.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Comentário de lee' })).toBeVisible();
  expect(requests.sort()).toEqual([
    '/api/items/201',
    '/api/items/201/comments',
  ]);
});

test('keeps the detail surface inside a 320px viewport', async ({ page }) => {
  await mockItemApi(page, 101, itemEnvelope(), commentsEnvelope());
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/item/101');

  await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
