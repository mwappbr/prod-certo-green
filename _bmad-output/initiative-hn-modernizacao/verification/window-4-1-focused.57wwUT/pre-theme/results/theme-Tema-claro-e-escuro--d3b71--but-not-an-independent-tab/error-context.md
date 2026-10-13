# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: theme.spec.ts >> Tema claro e escuro >> manual preference survives SPA navigation and reload but not an independent tab
- Location: e2e/theme.spec.ts:70:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Alternar tema claro e escuro' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Alternar tema claro e escuro' }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Alternar tema claro e escuro' })

```

```yaml
- main "Roteiro & dados":
  - button "Voltar"
  - paragraph: HN Moderno
  - region "Detalhe da história":
    - paragraph: História
    - heading "Roteiro & dados" [level=1]
    - link "Abrir example.com em nova aba":
      - /url: https://www.example.com/historia
      - text: example.com
    - paragraph:
      - text: 42 pontos maia
      - time: anteontem
      - text: 7 comentários
  - paragraph: Atualizado em 09:46
  - region "Comentários iniciais":
    - heading "Comentários iniciais" [level=2]
    - status: Sem comentários ainda.
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | 
  3   | const storageKey = 'hn-modernizacao.theme.preference.v1';
  4   | const darkBackground = 'rgb(11, 17, 32)';
  5   | const lightBackground = 'rgb(248, 250, 252)';
  6   | const toggleName = 'Alternar tema claro e escuro';
  7   | 
  8   | async function bodyBackground(page: import('@playwright/test').Page): Promise<string> {
  9   |   return page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);
  10  | }
  11  | 
  12  | async function themeValue(page: import('@playwright/test').Page): Promise<string> {
  13  |   return page.locator('html').evaluate((root) => root.getAttribute('data-theme') ?? '');
  14  | }
  15  | 
  16  | test.describe('Tema claro e escuro', () => {
  17  |   test('PRE_THEME: sistema escuro aplica tokens na lista e detalhe antes do bundle', async ({ page }) => {
  18  |     await page.emulateMedia({ colorScheme: 'dark' });
  19  |     await page.route('**/*.js', (route) => route.abort());
  20  | 
  21  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  22  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  23  |     await expect.poll(() => themeValue(page)).toBe('');
  24  |     expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);
  25  | 
  26  |     await page.goto('/item/101', { waitUntil: 'domcontentloaded' });
  27  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  28  |     await expect.poll(() => themeValue(page)).toBe('');
  29  |     expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);
  30  |   });
  31  | 
  32  |   test('bootstrap manual aplica a escolha antes do bundle e dos componentes React', async ({ page }) => {
  33  |     await page.addInitScript((key) => window.sessionStorage.setItem(key, 'dark'), storageKey);
  34  |     await page.emulateMedia({ colorScheme: 'light' });
  35  |     await page.route('**/*.js', (route) => route.abort());
  36  | 
  37  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  38  |     await expect.poll(() => themeValue(page)).toBe('dark');
  39  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  40  |     expect(await page.locator('#root').evaluate((root) => root.childElementCount)).toBe(0);
  41  |   });
  42  | 
  43  |   test('toggle semântico funciona nas duas telas e acompanha mudança do sistema antes da escolha manual', async ({ page }) => {
  44  |     await page.emulateMedia({ colorScheme: 'light' });
  45  |     await page.goto('/');
  46  | 
  47  |     const toggle = page.getByRole('button', { name: toggleName });
  48  |     await expect(toggle).toBeVisible();
  49  |     await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  50  |     await expect(toggle).toHaveCSS('min-height', '44px');
  51  |     await expect(toggle).toHaveCSS('min-width', '44px');
  52  |     await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  53  | 
  54  |     await page.emulateMedia({ colorScheme: 'dark' });
  55  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  56  |     await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  57  | 
  58  |     await toggle.click();
  59  |     await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  60  |     await expect.poll(() => themeValue(page)).toBe('light');
  61  |     await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  62  | 
  63  |     await page.goto('/item/101');
  64  |     const detailToggle = page.getByRole('button', { name: toggleName });
  65  |     await expect(detailToggle).toBeVisible();
  66  |     await expect(detailToggle).toHaveAttribute('aria-pressed', 'false');
  67  |     await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  68  |   });
  69  | 
  70  |   test('manual preference survives SPA navigation and reload but not an independent tab', async ({ page, context }) => {
  71  |     await page.emulateMedia({ colorScheme: 'light' });
  72  |     await page.goto('/item/101');
  73  | 
  74  |     const detailToggle = page.getByRole('button', { name: toggleName });
> 75  |     await expect(detailToggle).toBeVisible();
      |                                ^ Error: expect(locator).toBeVisible() failed
  76  |     await detailToggle.click();
  77  |     await expect(detailToggle).toHaveAttribute('aria-pressed', 'true');
  78  |     await expect.poll(() => themeValue(page)).toBe('dark');
  79  | 
  80  |     await page.getByRole('button', { name: 'Voltar' }).click();
  81  |     await expect(page).toHaveURL(/\/$/);
  82  |     const listingToggle = page.getByRole('button', { name: toggleName });
  83  |     await expect(listingToggle).toHaveAttribute('aria-pressed', 'true');
  84  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  85  | 
  86  |     await page.reload();
  87  |     await expect(page.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'true');
  88  |     await expect.poll(() => themeValue(page)).toBe('dark');
  89  |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  90  | 
  91  |     const independentPage = await context.newPage();
  92  |     await independentPage.emulateMedia({ colorScheme: 'light' });
  93  |     await independentPage.goto('/');
  94  |     await expect(independentPage.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'false');
  95  |     await expect.poll(() => themeValue(independentPage)).toBe('');
  96  |     await expect.poll(() => bodyBackground(independentPage)).toBe(lightBackground);
  97  |     await independentPage.close();
  98  |   });
  99  | 
  100 |   test('invalid preference follows the system and can then be replaced manually', async ({ page }) => {
  101 |     await page.addInitScript((key) => window.sessionStorage.setItem(key, 'system'), storageKey);
  102 |     await page.emulateMedia({ colorScheme: 'dark' });
  103 |     await page.goto('/');
  104 | 
  105 |     const toggle = page.getByRole('button', { name: toggleName });
  106 |     await expect(toggle).toBeVisible();
  107 |     await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  108 |     await expect.poll(() => themeValue(page)).toBe('');
  109 |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  110 | 
  111 |     await toggle.click();
  112 |     await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  113 |     await expect.poll(() => themeValue(page)).toBe('light');
  114 |     await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  115 |   });
  116 | 
  117 |   test('blocked sessionStorage reads and writes do not break in-tab theme changes', async ({ page }) => {
  118 |     await page.addInitScript(() => {
  119 |       Object.defineProperty(window, 'sessionStorage', {
  120 |         configurable: true,
  121 |         get() {
  122 |           throw new DOMException('Storage blocked by test', 'SecurityError');
  123 |         },
  124 |       });
  125 |     });
  126 |     await page.emulateMedia({ colorScheme: 'dark' });
  127 |     await page.goto('/');
  128 | 
  129 |     const toggle = page.getByRole('button', { name: toggleName });
  130 |     await expect(toggle).toBeVisible();
  131 |     await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  132 |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  133 | 
  134 |     await toggle.click();
  135 |     await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  136 |     await expect.poll(() => themeValue(page)).toBe('light');
  137 |     await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  138 | 
  139 |     await page.reload();
  140 |     await expect(page.getByRole('button', { name: toggleName })).toHaveAttribute('aria-pressed', 'true');
  141 |     await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
  142 |   });
  143 | });
  144 | 
```