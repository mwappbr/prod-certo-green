import { expect, test } from '@playwright/test';

const storageKey = 'hn-modernizacao.theme.preference.v1';
const darkBackground = 'rgb(11, 17, 32)';
const lightBackground = 'rgb(248, 250, 252)';
const toggleName = 'Alternar tema claro e escuro';

async function bodyBackground(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
}

async function themeValue(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('html').evaluate((root) => root.getAttribute('data-theme') ?? '');
}

async function expectThemeTarget(page: import('@playwright/test').Page, button: import('@playwright/test').Locator): Promise<void> {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('Tema claro e escuro', () => {
  test('PRE_THEME: sistema escuro aplica tokens na lista e detalhe antes do bundle', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.route('**/*.js', (route) => route.abort());

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
    await expect.poll(() => themeValue(page)).toBe('');
    expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);

    await page.goto('/item/101', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
    await expect.poll(() => themeValue(page)).toBe('');
    expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);
  });

  test('bootstrap manual aplica a escolha antes do bundle e dos componentes React', async ({ page }) => {
    await page.addInitScript((key) => window.sessionStorage.setItem(key, 'dark'), storageKey);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.route('**/*.js', (route) => route.abort());

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => themeValue(page)).toBe('dark');
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
    expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);
  });

  test('toggle semântico funciona nas duas telas e acompanha mudança do sistema antes da escolha manual', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: toggleName });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveCSS('min-height', '44px');
    await expect(toggle).toHaveCSS('min-width', '44px');
    await expectThemeTarget(page, toggle);
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => themeValue(page)).toBe('light');
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);

    await page.goto('/item/101');
    const detailToggle = page.getByRole('button', { name: toggleName });
    await expect(detailToggle).toBeVisible();
    await expect(detailToggle).toHaveAttribute('aria-pressed', 'false');
    await expectThemeTarget(page, detailToggle);
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  });

  test('manual preference survives SPA navigation and reload but not an independent tab', async ({ page, context }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${pathname}`);
    });

    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/item/98310000');

    const detailToggle = page.getByRole('button', { name: toggleName });
    await expect(detailToggle).toBeVisible();
    await detailToggle.click();
    await expect(detailToggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => themeValue(page)).toBe('dark');

    const collapseButton = page.getByRole('button', { name: /^Recolher,/ }).first();
    await expect(collapseButton).toBeVisible();
    const commentId = await collapseButton.locator('xpath=ancestor::article[1]').getAttribute('data-comment-id');
    expect(commentId).not.toBeNull();
    const collapsedComment = page.locator(`article[data-comment-id="${commentId}"] .detail-comment__toggle`);
    await collapseButton.click();
    await expect(collapsedComment).toHaveAttribute('aria-expanded', 'false');
    await page.waitForLoadState('networkidle', { timeout: 5000 });

    await detailToggle.scrollIntoViewIfNeeded();
    const requestsBeforeThemeChange = apiRequests.length;
    const urlBeforeThemeChange = page.url();
    const scrollBeforeThemeChange = await page.evaluate(() => window.scrollY);
    await detailToggle.click();
    await expect(detailToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(collapsedComment).toHaveAttribute('aria-expanded', 'false');
    await expect(page).toHaveURL(urlBeforeThemeChange);
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    expect(apiRequests.slice(requestsBeforeThemeChange)).toEqual([]);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeThemeChange);

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page).toHaveURL(/\/$/);
    const listingToggle = page.getByRole('button', { name: toggleName });
    await expect(listingToggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);

    await page.reload();
    await expect(page.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => themeValue(page)).toBe('light');
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);

    const independentPage = await context.newPage();
    await independentPage.emulateMedia({ colorScheme: 'light' });
    await independentPage.goto('/');
    await expect(independentPage.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => themeValue(independentPage)).toBe('');
    await expect.poll(() => bodyBackground(independentPage)).toBe(lightBackground);
    await independentPage.close();
  });

  test('invalid preference follows the system and can then be replaced manually', async ({ page }) => {
    await page.addInitScript((key) => window.sessionStorage.setItem(key, 'system'), storageKey);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: toggleName });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => themeValue(page)).toBe('');
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => themeValue(page)).toBe('light');
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  });

  test('blocked sessionStorage reads and writes do not break in-tab theme changes', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException('Storage blocked by test', 'SecurityError');
        },
      });
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: toggleName });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => themeValue(page)).toBe('light');
    await expect.poll(() => bodyBackground(page)).toBe(lightBackground);

    await page.reload();
    await expect(page.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  });
});

// Cores semânticas da home: medições no CSS aplicado (computed style), não na tabela preliminar.
type HomeRoute = {
  name: string;
  colorScheme: 'light' | 'dark';
  storage: 'dark' | null;
  theme: 'light' | 'dark';
};

const homeRoutes: HomeRoute[] = [
  { name: 'claro por sistema', colorScheme: 'light', storage: null, theme: 'light' },
  { name: 'escuro explícito', colorScheme: 'light', storage: 'dark', theme: 'dark' },
  { name: 'escuro por sistema', colorScheme: 'dark', storage: null, theme: 'dark' },
];

const approvedRoles = {
  light: {
    surfaceBrand: { hex: '#DBEAFE', rgb: 'rgb(219, 234, 254)' },
    inkOnBrand: { hex: '#1E3A8A', rgb: 'rgb(30, 58, 138)' },
    surfaceAccent: { hex: '#EDE9FE', rgb: 'rgb(237, 233, 254)' },
    accent: { hex: '#6D28D9', rgb: 'rgb(109, 40, 217)' },
    borderControl: { hex: '#64748B', rgb: 'rgb(100, 116, 139)' },
  },
  dark: {
    surfaceBrand: { hex: '#172554', rgb: 'rgb(23, 37, 84)' },
    inkOnBrand: { hex: '#DBEAFE', rgb: 'rgb(219, 234, 254)' },
    surfaceAccent: { hex: '#2E1065', rgb: 'rgb(46, 16, 101)' },
    accent: { hex: '#C4B5FD', rgb: 'rgb(196, 181, 253)' },
    borderControl: { hex: '#94A3B8', rgb: 'rgb(148, 163, 184)' },
  },
} as const;

const roleTokenNames = {
  surfaceBrand: '--surface-brand',
  inkOnBrand: '--ink-on-brand',
  surfaceAccent: '--surface-accent',
  accent: '--accent',
  borderControl: '--border-control',
} as const;

type RenderedMeasure = {
  color: string;
  background: string;
  ratio: number;
  colorAlpha: number;
  backgroundAlpha: number;
};

async function measureRendered(
  page: Page,
  selector: string,
  property: 'color' | 'border-bottom-color' | 'border-top-color',
): Promise<RenderedMeasure> {
  const locator = page.locator(selector).first();
  await expect(locator, `rendered target ${selector}`).toBeVisible();
  const measured = await locator.evaluate((element, cssProperty) => {
    const parse = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) throw new Error(`Unsupported computed color: ${value}`);
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    };
    const luminance = (c: { r: number; g: number; b: number }) => {
      const [red, green, blue] = [c.r, c.g, c.b].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const foregroundValue = getComputedStyle(element).getPropertyValue(cssProperty);
    const foreground = parse(foregroundValue);
    let background: ReturnType<typeof parse> | null = null;
    let backgroundValue = '';
    let node: Element | null = element;
    while (node && !background) {
      backgroundValue = getComputedStyle(node).backgroundColor;
      const parsed = parse(backgroundValue);
      if (parsed.a > 0) background = parsed;
      node = node.parentElement;
    }
    if (!background) {
      backgroundValue = getComputedStyle(document.body).backgroundColor;
      background = parse(backgroundValue);
    }
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return {
      color: foregroundValue,
      background: backgroundValue,
      ratio: Math.round((((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)) * 100) / 100,
      colorAlpha: foreground.a,
      backgroundAlpha: background.a,
    };
  }, property);
  console.log(`RENDERED_CONTRAST ${JSON.stringify({ selector, property, ...measured })}`);
  return measured;
}

// Existing --surface-raised values (unchanged by this story), in computed rgb form.
const surfaceRaisedRgb = {
  light: 'rgb(255, 255, 255)',
  dark: 'rgb(19, 28, 46)',
} as const;

const homeCachedAt = '2026-10-12T12:00:00.000Z';
const homeStories = [1, 2].map((index) => ({
  id: 6100 + index,
  type: 'story',
  title: `História de cor ${index}`,
  url: `https://example.test/${index}`,
  domain: 'example.test',
  author: `autora-${index}`,
  score: 10 + index,
  commentCount: index,
  createdAt: '2026-10-12T09:00:00.000Z',
  cachedAt: homeCachedAt,
}));

async function installHomeFixture(page: Page) {
  const cachedAt = homeCachedAt;
  const stories = homeStories;
  await page.route('**/api/stories**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: stories,
        page: 1,
        limit: 30,
        snapshot: 'snapshot-cores-home',
        cachedAt,
        stale: false,
        hasMore: true,
      }),
    });
  });
}

async function openHomeRoute(page: Page, route: HomeRoute) {
  if (route.storage) {
    await page.addInitScript((args) => window.sessionStorage.setItem(args.key, args.value), {
      key: storageKey,
      value: route.storage,
    });
  }
  await page.emulateMedia({ colorScheme: route.colorScheme });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?category=top');
  await expect(page.locator('.listing__header h1')).toBeVisible();
  await expect(page.locator('.story-row')).toHaveCount(2);
  await expect(page.locator('.listing__continuation-toggle')).toBeVisible();
  await expect.poll(() => themeValue(page)).toBe(route.storage ?? '');
}

test.describe('Cores semânticas da home', () => {
  for (const route of homeRoutes) {
    test(`tokens de papel chegam ao CSS aplicado na via ${route.name}`, async ({ page }) => {
      await installHomeFixture(page);
      await openHomeRoute(page, route);
      const expected = approvedRoles[route.theme];
      const rendered = await page.evaluate((names) => {
        const style = getComputedStyle(document.documentElement);
        return Object.fromEntries(Object.entries(names).map(([key, name]) => [key, style.getPropertyValue(name).trim().toUpperCase()]));
      }, roleTokenNames);
      for (const [key, token] of Object.entries(expected)) {
        expect(rendered[key as keyof typeof rendered], `${route.name}: ${roleTokenNames[key as keyof typeof roleTokenNames]}`).toBe(token.hex);
      }
    });

    test(`cabeçalho, categoria ativa, links e controles têm contraste medido na via ${route.name}`, async ({ page }) => {
      await installHomeFixture(page);
      await openHomeRoute(page, route);
      const roles = approvedRoles[route.theme];

      const header = await measureRendered(page, '.listing__header', 'color');
      expect(header.background, 'cabeçalho azul').toBe(roles.surfaceBrand.rgb);

      const title = await measureRendered(page, '.listing__header h1', 'color');
      expect(title.color).toBe(roles.inkOnBrand.rgb);
      expect(title.background).toBe(roles.surfaceBrand.rgb);
      expect(title.ratio, 'h1 no cabeçalho azul').toBeGreaterThanOrEqual(4.5);
      expect(title.colorAlpha).toBe(1);

      const eyebrow = await measureRendered(page, '.listing__eyebrow', 'color');
      expect(eyebrow.color).toBe(roles.inkOnBrand.rgb);
      expect(eyebrow.ratio, 'identidade no cabeçalho').toBeGreaterThanOrEqual(4.5);

      const freshness = await measureRendered(page, '.listing__header .freshness', 'color');
      expect(freshness.ratio, 'metadado de frescor no cabeçalho').toBeGreaterThanOrEqual(4.5);

      const activeTab = await measureRendered(page, '#category-tab-top', 'color');
      expect(activeTab.background).toBe(roles.surfaceAccent.rgb);
      expect(activeTab.color).toBe(roles.accent.rgb);
      expect(activeTab.ratio, 'categoria ativa').toBeGreaterThanOrEqual(4.5);
      const activeIndicator = await measureRendered(page, '#category-tab-top', 'border-bottom-color');
      expect(activeIndicator.color).toBe(roles.accent.rgb);
      expect(activeIndicator.ratio, 'indicador da categoria ativa').toBeGreaterThanOrEqual(3);

      const inactiveTab = await measureRendered(page, '#category-tab-new', 'color');
      expect(inactiveTab.ratio, 'categoria inativa').toBeGreaterThanOrEqual(4.5);

      const sourceLink = await measureRendered(page, '.story-row__source', 'color');
      expect(sourceLink.ratio, 'origem da notícia').toBeGreaterThanOrEqual(4.5);

      await page.locator('.story-row__detail').first().hover();
      const hoverTitle = await measureRendered(page, '.story-row__detail:hover .story-row__title', 'color');
      expect(hoverTitle.color, 'título em hover usa acento').toBe(roles.accent.rgb);
      expect(hoverTitle.ratio, 'título em hover').toBeGreaterThanOrEqual(4.5);

      const pauseToggle = await measureRendered(page, '.listing__continuation-toggle', 'color');
      expect(pauseToggle.background, 'controle de pausa em superfície neutra').toBe(surfaceRaisedRgb[route.theme]);
      expect(pauseToggle.ratio, 'texto do controle de pausa').toBeGreaterThanOrEqual(4.5);
      const pauseBorder = await measureRendered(page, '.listing__continuation-toggle', 'border-top-color');
      expect(pauseBorder.color, 'contorno do controle de pausa').toBe(roles.borderControl.rgb);
      expect(pauseBorder.ratio, 'contorno essencial do controle de pausa').toBeGreaterThanOrEqual(3);

      const loadMore = await measureRendered(page, '.listing__load-more', 'color');
      expect(loadMore.ratio, 'ação principal Carregar mais').toBeGreaterThanOrEqual(4.5);
    });
  }

  test('seleção ativa tem indicador não cromático além de aria-selected', async ({ page }) => {
    await installHomeFixture(page);
    await openHomeRoute(page, homeRoutes[0] as HomeRoute);

    const selected = page.locator('#category-tab-top');
    const other = page.locator('#category-tab-new');
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(other).toHaveAttribute('aria-selected', 'false');

    const selectedBorder = await selected.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.borderBottomWidth, style: style.borderBottomStyle, color: style.borderBottomColor };
    });
    expect(selectedBorder.width).toBe('2px');
    expect(selectedBorder.style).toBe('solid');
    expect(selectedBorder.color).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

    const otherBorder = await other.evaluate((element) => getComputedStyle(element).borderBottomColor);
    expect(otherBorder).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

    // A non-colour cue: the selected tab is underlined; the unselected tab is not.
    const selectedLine = await selected.evaluate((element) => getComputedStyle(element).textDecorationLine);
    const otherLine = await other.evaluate((element) => getComputedStyle(element).textDecorationLine);
    expect(selectedLine).toContain('underline');
    expect(otherLine).not.toContain('underline');

    await other.click();
    await expect(other).toHaveAttribute('aria-selected', 'true');
    await expect(selected).toHaveAttribute('aria-selected', 'false');
    const movedBorder = await other.evaluate((element) => getComputedStyle(element).borderBottomColor);
    expect(movedBorder).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
  });

  for (const route of homeRoutes) {
    test(`detalhe não herda o cabeçalho azul nem perde contraste na via ${route.name}`, async ({ page }) => {
      if (route.storage) {
        await page.addInitScript((args) => window.sessionStorage.setItem(args.key, args.value), {
          key: storageKey,
          value: route.storage,
        });
      }
      await page.emulateMedia({ colorScheme: route.colorScheme });
      await page.setViewportSize({ width: 375, height: 812 });
      await installHomeFixture(page);
      const detailStory = homeStories[0] as (typeof homeStories)[number];
      await page.route('**/api/items/6101**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const response = path.endsWith('/comments')
          ? { nodes: [], truncated: false, cachedAt: homeCachedAt, stale: false }
          : { item: detailStory, cachedAt: homeCachedAt, stale: false };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
      });
      await page.goto('/?category=top');
      await expect(page.locator('.story-row')).toHaveCount(2);
      await page.locator('.story-row__detail').first().click();
      await expect(page.locator('.detail__title')).toBeVisible();
      await expect(page.locator('.detail__source')).toBeVisible();

      const header = await page.locator('.detail__header').first().evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(header, 'detalhe sem cabeçalho azul').toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

      const title = await measureRendered(page, '.detail__title', 'color');
      expect(title.ratio, 'título do detalhe').toBeGreaterThanOrEqual(4.5);
      const source = await measureRendered(page, '.detail__source', 'color');
      expect(source.ratio, 'origem do detalhe').toBeGreaterThanOrEqual(4.5);
    });
  }
});
