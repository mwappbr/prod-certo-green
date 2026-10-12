import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const viewport = { width: 375, height: 812 };
const expectedBackground = {
  light: 'rgb(248, 250, 252)',
  dark: 'rgb(11, 17, 32)',
} as const;
const themeToggleName = 'Alternar tema claro e escuro';
const axeWrapperVersion = '4.13.0';

const auditCases = [
  { name: 'list-light', surface: 'list', colorScheme: 'light' },
  { name: 'list-dark', surface: 'list', colorScheme: 'dark' },
  { name: 'detail-light', surface: 'detail', colorScheme: 'light' },
  { name: 'detail-dark', surface: 'detail', colorScheme: 'dark' },
] as const;

test.describe('Axe accessibility audit', () => {
  for (const auditCase of auditCases) {
    test(`${auditCase.name} at 375px`, async ({ browser }, testInfo) => {
      test.setTimeout(90_000);
      const baseURL = testInfo.project.use.baseURL;
      if (typeof baseURL !== 'string') throw new Error('Playwright baseURL must be configured for the fixture server.');

      const context = await browser.newContext({
        viewport,
        colorScheme: auditCase.colorScheme,
      });
      try {
        const page = await context.newPage();
        // Apply the system preference before the first document navigation.
        await page.emulateMedia({ colorScheme: auditCase.colorScheme });
        const pathname = auditCase.surface === 'list' ? '/?category=top' : '/item/98310000';
        await page.goto(new URL(pathname, baseURL).toString(), { waitUntil: 'domcontentloaded' });

        if (auditCase.surface === 'list') {
          await expect(page.getByRole('heading', { name: 'Top', level: 1 })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Roteiro & dados', level: 2 })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'História sem domínio', level: 2 })).toBeVisible();
          // The raw top fixture has three IDs; the malformed record is intentionally normalized out.
          await expect(page.locator('.story-row')).toHaveCount(2);
        } else {
          await expect(page.getByRole('heading', { name: '3.3 fixture comment tree', level: 1 })).toBeVisible();
          await expect(page.getByRole('article', { name: /^Comentário de fixture-author-/ })).toHaveCount(220, {
            timeout: 30_000,
          });
        }

        const toggle = page.getByRole('button', { name: themeToggleName });
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-pressed', auditCase.colorScheme === 'dark' ? 'true' : 'false');
        await expect.poll(() => page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor))
          .toBe(expectedBackground[auditCase.colorScheme]);

        // No options are supplied so Axe analyzes the entire page with its default rules.
        const results = await new AxeBuilder({ page }).analyze();
        const runtime = {
          nodeVersion: process.version,
          browserName: browser.browserType().name(),
          browserVersion: browser.version(),
          viewport,
          colorScheme: auditCase.colorScheme,
          route: pathname,
        };
        const attachment = {
          scenario: auditCase.name,
          axeWrapperVersion,
          runtime,
          testEngine: results.testEngine,
          testRunner: results.testRunner,
          testEnvironment: results.testEnvironment,
          timestamp: results.timestamp,
          url: results.url,
          toolOptions: results.toolOptions,
          counts: {
            violations: results.violations.length,
            incomplete: results.incomplete.length,
            passes: results.passes.length,
            inapplicable: results.inapplicable.length,
          },
          // Preserve the complete Axe result, including every node and impact detail.
          results,
        };
        await testInfo.attach('axe-audit-results.json', {
          body: Buffer.from(JSON.stringify(attachment, null, 2)),
          contentType: 'application/json',
        });

        const summarize = (items: typeof results.violations) => items.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.map((node) => ({
            target: node.target,
            ...(node.failureSummary ? { failureSummary: node.failureSummary } : {}),
          })),
        }));
        const criticalOrSerious = results.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious',
        );
        console.log(JSON.stringify({
          scenario: auditCase.name,
          runtime,
          testEngine: results.testEngine,
          counts: attachment.counts,
          violations: summarize(results.violations),
          incomplete: summarize(results.incomplete),
          criticalOrSerious: summarize(criticalOrSerious),
        }));

        expect(criticalOrSerious, 'Axe critical/serious violations').toHaveLength(0);
      } finally {
        await context.close();
      }
    });
  }
});
