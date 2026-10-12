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
