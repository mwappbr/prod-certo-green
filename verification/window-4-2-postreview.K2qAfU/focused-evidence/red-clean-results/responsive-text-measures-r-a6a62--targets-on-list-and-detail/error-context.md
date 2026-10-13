# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive-text.spec.ts >> measures responsive layout, text reflow simulation and 44px targets on list and detail
- Location: e2e/responsive-text.spec.ts:399:1

# Error details

```
Error: Responsive text measurements found failures:
light/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
light/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
light/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
light/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59
light/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
light/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
light/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
light/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18
light/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
light/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
light/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
light/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
light/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
light/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18
light/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
light/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
light/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
dark/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
dark/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
dark/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
dark/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59
dark/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
dark/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
dark/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
dark/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18
dark/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
dark/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
dark/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
dark/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
dark/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
dark/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18
dark/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
dark/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
dark/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 36

- Array []
+ Array [
+   "light/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "light/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "light/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "light/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59",
+   "light/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "light/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "light/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "light/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "light/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "light/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "light/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "light/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "light/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "light/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "light/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "light/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "light/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "dark/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "dark/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "dark/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "dark/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59",
+   "dark/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "dark/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "dark/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "dark/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "dark/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "dark/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "dark/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "dark/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "dark/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "dark/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "dark/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "dark/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "dark/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
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
      - link "Abrir tiny.test em nova aba" [ref=f16e12] [cursor=pointer]:
        - /url: https://tiny.test/story
        - text: tiny.test
      - paragraph [ref=f16e13]:
        - generic [ref=f16e14]: 42 pontos
        - generic [aria-hidden] [ref=f16e15]: ·
        - generic [ref=f16e16]: autor-com-nome-longo-para-envolver-sem-truncar
        - generic [aria-hidden] [ref=f16e17]: ·
        - time [ref=f16e18]: há 5 horas
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
            - time [ref=f16e30]: há 4 horas
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
  382 |   if (surface === 'detail' && theme === 'light' && width === 320 && scale === 'simulated-200') {
  383 |     const toggle = page.locator('.detail-comment__toggle');
  384 |     const requestsBeforeToggle = apiRequests.length;
  385 |     await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  386 |     await toggle.click();
  387 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__collapsed-count')).toBeVisible();
  388 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toHaveCount(0);
  389 |     await expect(page.locator('[data-comment-id="5302"]')).toHaveCount(0);
  390 |     expect(await toggle.getAttribute('aria-expanded')).toBe('false');
  391 |     await toggle.click();
  392 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toContainText(ownCommentText);
  393 |     await expect(page.locator('[data-comment-id="5302"]')).toBeVisible();
  394 |     expect(await toggle.getAttribute('aria-expanded')).toBe('true');
  395 |     expect(apiRequests.length).toBe(requestsBeforeToggle);
  396 |   }
  397 | }
  398 | 
  399 | test('measures responsive layout, text reflow simulation and 44px targets on list and detail', async ({ page, browser }) => {
  400 |   test.setTimeout(60_000);
  401 |   const apiRequests: string[] = [];
  402 |   const results: ScenarioMeasurement[] = [];
  403 |   await installLocalApiFixture(page, apiRequests);
  404 |   await page.emulateMedia({ colorScheme: 'light' });
  405 | 
  406 |   const issueList: string[] = [];
  407 |   try {
  408 |     const themes: Theme[] = ['light', 'dark'];
  409 |     for (const theme of themes) {
  410 |       if (theme === 'dark') {
  411 |         await page.setViewportSize({ width: 320, height: 812 });
  412 |         await page.goto('/');
  413 |         await expect(page.locator('.theme-toggle')).toBeVisible();
  414 |         if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
  415 |           await page.locator('.theme-toggle').click();
  416 |         }
  417 |         await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  418 |       }
  419 | 
  420 |       for (const surface of ['listing', 'detail'] as const) {
  421 |         for (const width of [320, 375] as const) {
  422 |           for (const scale of ['normal', 'simulated-200'] as const) {
  423 |             await runScenario(page, surface, theme, width, scale, apiRequests, results);
  424 |           }
  425 |         }
  426 |       }
  427 |     }
  428 | 
  429 |     for (const result of results) {
  430 |       const prefix = `${result.theme}/${result.surface}/${result.viewport}/${result.scale}`;
  431 |       if (result.innerWidth !== result.viewport) issueList.push(`${prefix}: innerWidth=${result.innerWidth}`);
  432 |       if (result.documentClientWidth !== result.viewport) {
  433 |         issueList.push(`${prefix}: clientWidth=${result.documentClientWidth}`);
  434 |       }
  435 |       if (result.documentScrollWidth > result.viewport) {
  436 |         issueList.push(`${prefix}: document scrollWidth=${result.documentScrollWidth}`);
  437 |       }
  438 |       for (const target of result.targets) {
  439 |         if (target.width < 44 || target.height < 44) {
  440 |           issueList.push(`${prefix}: target below 44x44: ${target.name}=${target.width}x${target.height}`);
  441 |         }
  442 |       }
  443 |       for (const clipped of result.textClipping) {
  444 |         if (clipped.clipped) issueList.push(`${prefix}: clipped text ${clipped.element}`);
  445 |       }
  446 |       if (result.surface === 'listing' && (!result.categoryStrip?.jobsVisible
  447 |         || (result.categoryStrip.scrollWidth > result.categoryStrip.clientWidth && result.categoryStrip.scrollLeft <= 0))) {
  448 |         issueList.push(`${prefix}: Jobs tab not reachable by internal category scrolling`);
  449 |       }
  450 |       if (result.scale === 'simulated-200') {
  451 |         const evidence = result.scaleEvidence;
  452 |         if (!evidence) {
  453 |           issueList.push(`${prefix}: missing simulated scale evidence`);
  454 |           continue;
  455 |         }
  456 |         if (evidence.viewportBefore !== result.viewport || evidence.viewportAfter !== result.viewport) {
  457 |           issueList.push(`${prefix}: simulation changed CSS viewport ${evidence.viewportBefore}→${evidence.viewportAfter}`);
  458 |         }
  459 |         if (evidence.htmlFontSizeBefore !== evidence.htmlFontSizeAfter) {
  460 |           issueList.push(`${prefix}: html font-size changed ${evidence.htmlFontSizeBefore}→${evidence.htmlFontSizeAfter}`);
  461 |         }
  462 |         if (evidence.glyphBefore.rangeRects !== 1 || evidence.glyphAfter.rangeRects !== 1) {
  463 |           issueList.push(`${prefix}: representative glyph range was not single-line`);
  464 |         }
  465 |         const glyphRatio = evidence.glyphAfter.rangeHeight / evidence.glyphBefore.rangeHeight;
  466 |         if (glyphRatio < 1.8) issueList.push(`${prefix}: rendered glyph height ratio=${rounded(glyphRatio)}`);
  467 |         const fontRatio = evidence.glyphAfter.fontSize / evidence.glyphBefore.fontSize;
  468 |         if (Math.abs(fontRatio - 2) > 0.02) issueList.push(`${prefix}: glyph computed font ratio=${rounded(fontRatio)}`);
  469 |         for (const text of evidence.textSnapshot) {
  470 |           const ratio = text.fontSizeAfter / text.fontSizeBefore;
  471 |           if (Math.abs(ratio - 2) > 0.02) {
  472 |             issueList.push(`${prefix}: ${text.element} computed font ratio=${rounded(ratio)}`);
  473 |           }
  474 |           if (text.lineHeightRatio !== null && Math.abs(text.lineHeightRatio - 2) > 0.03) {
  475 |             issueList.push(`${prefix}: ${text.element} numeric line-height ratio=${text.lineHeightRatio}`);
  476 |           }
  477 |         }
  478 |       }
  479 |     }
  480 | 
  481 |     expect(results).toHaveLength(16);
> 482 |     expect(issueList, `Responsive text measurements found failures:\n${issueList.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: Responsive text measurements found failures:
  483 |   } finally {
  484 |     console.log(`RESPONSIVE_TEXT_MEASURE_JSON ${JSON.stringify({
  485 |       capturedAt: new Date().toISOString(),
  486 |       nodeVersion: process.version,
  487 |       browserName: browser.browserType().name(),
  488 |       browserVersion: browser.version(),
  489 |       simulation: 'test-only per-element computed font-size 2x and original numeric computed line-height 2x; no html/root/viewport/DPR/zoom mutation',
  490 |       apiRequests,
  491 |       results,
  492 |       issues: issueList,
  493 |     })}`);
  494 |   }
  495 | });
  496 | 
```