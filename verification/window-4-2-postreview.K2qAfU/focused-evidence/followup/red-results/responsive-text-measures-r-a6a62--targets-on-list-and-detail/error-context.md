# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive-text.spec.ts >> measures responsive layout, text reflow simulation and 44px targets on list and detail
- Location: e2e/responsive-text.spec.ts:406:1

# Error details

```
Error: Responsive text measurements found failures:
light/listing/320/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44
light/listing/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44
light/listing/375/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44
light/listing/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44
light/detail/320/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44
light/detail/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44
light/detail/375/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44
light/detail/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44
dark/listing/320/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44
dark/listing/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44
dark/listing/375/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44
dark/listing/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44
dark/detail/320/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44
dark/detail/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44
dark/detail/375/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44
dark/detail/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 18

- Array []
+ Array [
+   "light/listing/320/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44",
+   "light/listing/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44",
+   "light/listing/375/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44",
+   "light/listing/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44",
+   "light/detail/320/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44",
+   "light/detail/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44",
+   "light/detail/375/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44",
+   "light/detail/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44",
+   "dark/listing/320/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44",
+   "dark/listing/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44",
+   "dark/listing/375/normal: target below 44x44: Abrir x.io em nova aba [.story-row__source]=19.92x44",
+   "dark/listing/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.story-row__source]=35.41x44",
+   "dark/detail/320/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44",
+   "dark/detail/320/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44",
+   "dark/detail/375/normal: target below 44x44: Abrir x.io em nova aba [.detail__source]=21.27x44",
+   "dark/detail/375/simulated-200: target below 44x44: Abrir x.io em nova aba [.detail__source]=38.34x44",
+ ]
```

# Page snapshot

```yaml
- main [ref=f16e3]:
  - button "Voltar" [ref=f16e4] [cursor=pointer]
  - generic [ref=f16e5]:
    - generic [ref=f16e6]:
      - paragraph [ref=f16e7]: HN Moderno
      - button "Alternar tema claro e escuro" [pressed] [ref=f16e8] [cursor=pointer]
    - region "Detalhe da história" [ref=f16e9]:
      - paragraph [ref=f16e10]: História
      - 'heading "Título de história longo para validar quebra de texto sem corte: interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável" [level=1] [ref=f16e11]'
      - link "Abrir x.io em nova aba" [ref=f16e12] [cursor=pointer]:
        - /url: https://x.io/story
        - text: x.io
      - paragraph [ref=f16e13]:
        - generic [ref=f16e14]: 42 pontos
        - generic [aria-hidden] [ref=f16e15]: ·
        - generic [ref=f16e16]: autor-com-nome-longo-para-envolver-sem-truncar
        - generic [aria-hidden] [ref=f16e17]: ·
        - time [ref=f16e18]: há 6 horas
        - generic [aria-hidden] [ref=f16e19]: ·
        - generic [ref=f16e20]: 2 comentários
    - paragraph [ref=f16e21]: Atualizado em 09:00
  - region [ref=f16e22]:
    - heading "Comentários iniciais" [level=2] [ref=f16e23]
    - list "Comentários carregados" [ref=f16e24]:
      - listitem [ref=f16e25]:
        - article "Comentário de autora-comentario" [ref=f16e26]:
          - generic [ref=f16e27]:
            - generic [ref=f16e28]: autora-comentario
            - generic [ref=f16e29]: nível 1
            - time [ref=f16e30]: há 5 horas
            - button "Recolher, 1 resposta carregada" [expanded] [ref=f16e31] [cursor=pointer]: Recolher
          - generic [ref=f16e32]:
            - paragraph [ref=f16e33]: "Comentário longo que deve refluir sem cortar conteúdo: texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas"
            - paragraph [ref=f16e34]: Corpo próprio preservado após recolher e expandir.
            - paragraph [ref=f16e35]:
              - link "link" [ref=f16e36] [cursor=pointer]:
                - /url: https://tiny.test/comment
              - link "comentario-comentario-comentario-comentario-comentario-comentario-comentario-comentario-example.test" [ref=f16e37] [cursor=pointer]:
                - /url: https://comentario-comentario-comentario-comentario-comentario-comentario-comentario-comentario-example.test/destino
        - list "Respostas de autora-comentario" [ref=f16e38]:
          - listitem [ref=f16e39]:
            - article "Comentário de resposta-com-nome-longo" [ref=f16e40]:
              - generic [ref=f16e41]:
                - generic [ref=f16e42]: resposta-com-nome-longo
                - generic [ref=f16e43]: nível 2
                - time [ref=f16e44]: há 4 horas
              - paragraph [ref=f16e46]: Resposta longa preservada na árvore. Resposta longa preservada na árvore. Resposta longa preservada na árvore. Resposta longa preservada na árvore.
```

# Test source

```ts
  389 |   if (surface === 'detail' && theme === 'light' && width === 320 && scale === 'simulated-200') {
  390 |     const toggle = page.locator('.detail-comment__toggle');
  391 |     const requestsBeforeToggle = apiRequests.length;
  392 |     await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  393 |     await toggle.click();
  394 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__collapsed-count')).toBeVisible();
  395 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toHaveCount(0);
  396 |     await expect(page.locator('[data-comment-id="5302"]')).toHaveCount(0);
  397 |     expect(await toggle.getAttribute('aria-expanded')).toBe('false');
  398 |     await toggle.click();
  399 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toContainText(ownCommentText);
  400 |     await expect(page.locator('[data-comment-id="5302"]')).toBeVisible();
  401 |     expect(await toggle.getAttribute('aria-expanded')).toBe('true');
  402 |     expect(apiRequests.length).toBe(requestsBeforeToggle);
  403 |   }
  404 | }
  405 | 
  406 | test('measures responsive layout, text reflow simulation and 44px targets on list and detail', async ({ page, browser }) => {
  407 |   test.setTimeout(60_000);
  408 |   const apiRequests: string[] = [];
  409 |   const results: ScenarioMeasurement[] = [];
  410 |   await installLocalApiFixture(page, apiRequests);
  411 |   await page.emulateMedia({ colorScheme: 'light' });
  412 | 
  413 |   const issueList: string[] = [];
  414 |   try {
  415 |     const themes: Theme[] = ['light', 'dark'];
  416 |     for (const theme of themes) {
  417 |       if (theme === 'dark') {
  418 |         await page.setViewportSize({ width: 320, height: 812 });
  419 |         await page.goto('/');
  420 |         await expect(page.locator('.theme-toggle')).toBeVisible();
  421 |         if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
  422 |           await page.locator('.theme-toggle').click();
  423 |         }
  424 |         await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  425 |       }
  426 | 
  427 |       for (const surface of ['listing', 'detail'] as const) {
  428 |         for (const width of [320, 375] as const) {
  429 |           for (const scale of ['normal', 'simulated-200'] as const) {
  430 |             await runScenario(page, surface, theme, width, scale, apiRequests, results);
  431 |           }
  432 |         }
  433 |       }
  434 |     }
  435 | 
  436 |     for (const result of results) {
  437 |       const prefix = `${result.theme}/${result.surface}/${result.viewport}/${result.scale}`;
  438 |       if (result.innerWidth !== result.viewport) issueList.push(`${prefix}: innerWidth=${result.innerWidth}`);
  439 |       if (result.documentClientWidth !== result.viewport) {
  440 |         issueList.push(`${prefix}: clientWidth=${result.documentClientWidth}`);
  441 |       }
  442 |       if (result.documentScrollWidth > result.viewport) {
  443 |         issueList.push(`${prefix}: document scrollWidth=${result.documentScrollWidth}`);
  444 |       }
  445 |       for (const target of result.targets) {
  446 |         if (target.width < 44 || target.height < 44) {
  447 |           issueList.push(`${prefix}: target below 44x44: ${target.name}=${target.width}x${target.height}`);
  448 |         }
  449 |       }
  450 |       for (const clipped of result.textClipping) {
  451 |         if (clipped.clipped) issueList.push(`${prefix}: clipped text ${clipped.element}`);
  452 |       }
  453 |       if (result.surface === 'listing' && (!result.categoryStrip?.jobsVisible
  454 |         || (result.categoryStrip.scrollWidth > result.categoryStrip.clientWidth && result.categoryStrip.scrollLeft <= 0))) {
  455 |         issueList.push(`${prefix}: Jobs tab not reachable by internal category scrolling`);
  456 |       }
  457 |       if (result.scale === 'simulated-200') {
  458 |         const evidence = result.scaleEvidence;
  459 |         if (!evidence) {
  460 |           issueList.push(`${prefix}: missing simulated scale evidence`);
  461 |           continue;
  462 |         }
  463 |         if (evidence.viewportBefore !== result.viewport || evidence.viewportAfter !== result.viewport) {
  464 |           issueList.push(`${prefix}: simulation changed CSS viewport ${evidence.viewportBefore}→${evidence.viewportAfter}`);
  465 |         }
  466 |         if (evidence.htmlFontSizeBefore !== evidence.htmlFontSizeAfter) {
  467 |           issueList.push(`${prefix}: html font-size changed ${evidence.htmlFontSizeBefore}→${evidence.htmlFontSizeAfter}`);
  468 |         }
  469 |         if (evidence.glyphBefore.rangeRects !== 1 || evidence.glyphAfter.rangeRects !== 1) {
  470 |           issueList.push(`${prefix}: representative glyph range was not single-line`);
  471 |         }
  472 |         const glyphRatio = evidence.glyphAfter.rangeHeight / evidence.glyphBefore.rangeHeight;
  473 |         if (glyphRatio < 1.8) issueList.push(`${prefix}: rendered glyph height ratio=${rounded(glyphRatio)}`);
  474 |         const fontRatio = evidence.glyphAfter.fontSize / evidence.glyphBefore.fontSize;
  475 |         if (Math.abs(fontRatio - 2) > 0.02) issueList.push(`${prefix}: glyph computed font ratio=${rounded(fontRatio)}`);
  476 |         for (const text of evidence.textSnapshot) {
  477 |           const ratio = text.fontSizeAfter / text.fontSizeBefore;
  478 |           if (Math.abs(ratio - 2) > 0.02) {
  479 |             issueList.push(`${prefix}: ${text.element} computed font ratio=${rounded(ratio)}`);
  480 |           }
  481 |           if (text.lineHeightRatio !== null && Math.abs(text.lineHeightRatio - 2) > 0.03) {
  482 |             issueList.push(`${prefix}: ${text.element} numeric line-height ratio=${text.lineHeightRatio}`);
  483 |           }
  484 |         }
  485 |       }
  486 |     }
  487 | 
  488 |     expect(results).toHaveLength(16);
> 489 |     expect(issueList, `Responsive text measurements found failures:\n${issueList.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: Responsive text measurements found failures:
  490 |   } finally {
  491 |     console.log(`RESPONSIVE_TEXT_MEASURE_JSON ${JSON.stringify({
  492 |       capturedAt: new Date().toISOString(),
  493 |       nodeVersion: process.version,
  494 |       browserName: browser.browserType().name(),
  495 |       browserVersion: browser.version(),
  496 |       simulation: 'test-only per-element computed font-size 2x and original numeric computed line-height 2x; no html/root/viewport/DPR/zoom mutation',
  497 |       apiRequests,
  498 |       results,
  499 |       issues: issueList,
  500 |     })}`);
  501 |   }
  502 | });
  503 | 
  504 | test('rejects a fixture story source hidden from target measurement', async ({ page }) => {
  505 |   test.setTimeout(10_000);
  506 |   await installLocalApiFixture(page, []);
  507 |   await page.setViewportSize({ width: 320, height: 812 });
  508 |   await page.goto('/');
  509 | 
  510 |   const primaryStoryLink = page.locator(`.story-row__detail[href="/item/${storyId}"]`);
  511 |   await expect(primaryStoryLink).toBeVisible();
  512 |   const primarySource = page.locator('.story-row__source').first();
  513 |   await expect(primarySource).toBeVisible();
  514 |   await primarySource.evaluate((element) => {
  515 |     (element as HTMLElement).style.display = 'none';
  516 |   });
  517 | 
  518 |   await expect(measureTargets(page, 'listing', 100)).rejects.toThrow(/toBeVisible/);
  519 | });
  520 | 
```