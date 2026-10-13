# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive-text.spec.ts >> measures responsive layout, text reflow simulation and 44px targets on list and detail
- Location: e2e/responsive-text.spec.ts:397:1

# Error details

```
Error: Responsive text measurements found failures:
light/listing/320/normal: clientWidth=undefined
light/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
light/listing/320/simulated-200: clientWidth=undefined
light/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
light/listing/375/normal: clientWidth=undefined
light/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
light/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59
light/listing/375/simulated-200: clientWidth=undefined
light/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
light/detail/320/normal: clientWidth=undefined
light/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
light/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
light/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18
light/detail/320/simulated-200: clientWidth=undefined
light/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
light/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
light/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
light/detail/375/normal: clientWidth=undefined
light/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
light/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
light/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18
light/detail/375/simulated-200: clientWidth=undefined
light/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
light/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
light/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
dark/listing/320/normal: clientWidth=undefined
dark/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
dark/listing/320/simulated-200: clientWidth=undefined
dark/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
dark/listing/375/normal: clientWidth=undefined
dark/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8
dark/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59
dark/listing/375/simulated-200: clientWidth=undefined
dark/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59
dark/detail/320/normal: clientWidth=undefined
dark/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
dark/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
dark/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18
dark/detail/320/simulated-200: clientWidth=undefined
dark/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
dark/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
dark/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35
dark/detail/375/normal: clientWidth=undefined
dark/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32
dark/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19
dark/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18
dark/detail/375/simulated-200: clientWidth=undefined
dark/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59
dark/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41
dark/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 52

- Array []
+ Array [
+   "light/listing/320/normal: clientWidth=undefined",
+   "light/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "light/listing/320/simulated-200: clientWidth=undefined",
+   "light/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "light/listing/375/normal: clientWidth=undefined",
+   "light/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "light/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59",
+   "light/listing/375/simulated-200: clientWidth=undefined",
+   "light/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "light/detail/320/normal: clientWidth=undefined",
+   "light/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "light/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "light/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "light/detail/320/simulated-200: clientWidth=undefined",
+   "light/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "light/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "light/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "light/detail/375/normal: clientWidth=undefined",
+   "light/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "light/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "light/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "light/detail/375/simulated-200: clientWidth=undefined",
+   "light/detail/375/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "light/detail/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "light/detail/375/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "dark/listing/320/normal: clientWidth=undefined",
+   "dark/listing/320/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "dark/listing/320/simulated-200: clientWidth=undefined",
+   "dark/listing/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "dark/listing/375/normal: clientWidth=undefined",
+   "dark/listing/375/normal: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=44.77x16.8",
+   "dark/listing/375/normal: target below 44x44: Abrir domain-domain-domain-domain-domain-domain-domain-domain-domain-dom [.story-row__source]=343x33.59",
+   "dark/listing/375/simulated-200: clientWidth=undefined",
+   "dark/listing/375/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.story-row__source]=79.44x33.59",
+   "dark/detail/320/normal: clientWidth=undefined",
+   "dark/detail/320/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "dark/detail/320/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "dark/detail/320/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "dark/detail/320/simulated-200: clientWidth=undefined",
+   "dark/detail/320/simulated-200: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=112.88x41.59",
+   "dark/detail/320/simulated-200: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=86.05x36.41",
+   "dark/detail/320/simulated-200: target below 44x44: link [comment-body anchor]=44.27x35",
+   "dark/detail/375/normal: clientWidth=undefined",
+   "dark/detail/375/normal: target below 44x44: Recolher, 1 resposta carregada [.listing__button.detail-comment__toggle]=68.2x32",
+   "dark/detail/375/normal: target below 44x44: Abrir tiny.test em nova aba [.detail__source]=47.81x18.19",
+   "dark/detail/375/normal: target below 44x44: link [comment-body anchor]=23.47x18",
+   "dark/detail/375/simulated-200: clientWidth=undefined",
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
  380 |   if (surface === 'detail' && theme === 'light' && width === 320 && scale === 'simulated-200') {
  381 |     const toggle = page.locator('.detail-comment__toggle');
  382 |     const requestsBeforeToggle = apiRequests.length;
  383 |     await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  384 |     await toggle.click();
  385 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__collapsed-count')).toBeVisible();
  386 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toHaveCount(0);
  387 |     await expect(page.locator('[data-comment-id="5302"]')).toHaveCount(0);
  388 |     expect(await toggle.getAttribute('aria-expanded')).toBe('false');
  389 |     await toggle.click();
  390 |     await expect(page.locator('[data-comment-id="5301"] .detail-comment__body')).toContainText(ownCommentText);
  391 |     await expect(page.locator('[data-comment-id="5302"]')).toBeVisible();
  392 |     expect(await toggle.getAttribute('aria-expanded')).toBe('true');
  393 |     expect(apiRequests.length).toBe(requestsBeforeToggle);
  394 |   }
  395 | }
  396 | 
  397 | test('measures responsive layout, text reflow simulation and 44px targets on list and detail', async ({ page, browser }) => {
  398 |   test.setTimeout(60_000);
  399 |   const apiRequests: string[] = [];
  400 |   const results: ScenarioMeasurement[] = [];
  401 |   await installLocalApiFixture(page, apiRequests);
  402 |   await page.emulateMedia({ colorScheme: 'light' });
  403 | 
  404 |   const issueList: string[] = [];
  405 |   try {
  406 |     const themes: Theme[] = ['light', 'dark'];
  407 |     for (const theme of themes) {
  408 |       if (theme === 'dark') {
  409 |         await page.setViewportSize({ width: 320, height: 812 });
  410 |         await page.goto('/');
  411 |         await expect(page.locator('.theme-toggle')).toBeVisible();
  412 |         if (await page.locator('html').getAttribute('data-theme') !== 'dark') {
  413 |           await page.locator('.theme-toggle').click();
  414 |         }
  415 |         await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  416 |       }
  417 | 
  418 |       for (const surface of ['listing', 'detail'] as const) {
  419 |         for (const width of [320, 375] as const) {
  420 |           for (const scale of ['normal', 'simulated-200'] as const) {
  421 |             await runScenario(page, surface, theme, width, scale, apiRequests, results);
  422 |           }
  423 |         }
  424 |       }
  425 |     }
  426 | 
  427 |     for (const result of results) {
  428 |       const prefix = `${result.theme}/${result.surface}/${result.viewport}/${result.scale}`;
  429 |       if (result.innerWidth !== result.viewport) issueList.push(`${prefix}: innerWidth=${result.innerWidth}`);
  430 |       if (result.documentClientWidth !== result.viewport) {
  431 |         issueList.push(`${prefix}: clientWidth=${result.documentClientWidth}`);
  432 |       }
  433 |       if (result.documentScrollWidth > result.viewport) {
  434 |         issueList.push(`${prefix}: document scrollWidth=${result.documentScrollWidth}`);
  435 |       }
  436 |       for (const target of result.targets) {
  437 |         if (target.width < 44 || target.height < 44) {
  438 |           issueList.push(`${prefix}: target below 44x44: ${target.name}=${target.width}x${target.height}`);
  439 |         }
  440 |       }
  441 |       for (const clipped of result.textClipping) {
  442 |         if (clipped.clipped) issueList.push(`${prefix}: clipped text ${clipped.element}`);
  443 |       }
  444 |       if (result.surface === 'listing' && (!result.categoryStrip?.jobsVisible
  445 |         || (result.categoryStrip.scrollWidth > result.categoryStrip.clientWidth && result.categoryStrip.scrollLeft <= 0))) {
  446 |         issueList.push(`${prefix}: Jobs tab not reachable by internal category scrolling`);
  447 |       }
  448 |       if (result.scale === 'simulated-200') {
  449 |         const evidence = result.scaleEvidence;
  450 |         if (!evidence) {
  451 |           issueList.push(`${prefix}: missing simulated scale evidence`);
  452 |           continue;
  453 |         }
  454 |         if (evidence.viewportBefore !== result.viewport || evidence.viewportAfter !== result.viewport) {
  455 |           issueList.push(`${prefix}: simulation changed CSS viewport ${evidence.viewportBefore}→${evidence.viewportAfter}`);
  456 |         }
  457 |         if (evidence.htmlFontSizeBefore !== evidence.htmlFontSizeAfter) {
  458 |           issueList.push(`${prefix}: html font-size changed ${evidence.htmlFontSizeBefore}→${evidence.htmlFontSizeAfter}`);
  459 |         }
  460 |         if (evidence.glyphBefore.rangeRects !== 1 || evidence.glyphAfter.rangeRects !== 1) {
  461 |           issueList.push(`${prefix}: representative glyph range was not single-line`);
  462 |         }
  463 |         const glyphRatio = evidence.glyphAfter.rangeHeight / evidence.glyphBefore.rangeHeight;
  464 |         if (glyphRatio < 1.8) issueList.push(`${prefix}: rendered glyph height ratio=${rounded(glyphRatio)}`);
  465 |         const fontRatio = evidence.glyphAfter.fontSize / evidence.glyphBefore.fontSize;
  466 |         if (Math.abs(fontRatio - 2) > 0.02) issueList.push(`${prefix}: glyph computed font ratio=${rounded(fontRatio)}`);
  467 |         for (const text of evidence.textSnapshot) {
  468 |           const ratio = text.fontSizeAfter / text.fontSizeBefore;
  469 |           if (Math.abs(ratio - 2) > 0.02) {
  470 |             issueList.push(`${prefix}: ${text.element} computed font ratio=${rounded(ratio)}`);
  471 |           }
  472 |           if (text.lineHeightRatio !== null && Math.abs(text.lineHeightRatio - 2) > 0.03) {
  473 |             issueList.push(`${prefix}: ${text.element} numeric line-height ratio=${text.lineHeightRatio}`);
  474 |           }
  475 |         }
  476 |       }
  477 |     }
  478 | 
  479 |     expect(results).toHaveLength(16);
> 480 |     expect(issueList, `Responsive text measurements found failures:\n${issueList.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: Responsive text measurements found failures:
  481 |   } finally {
  482 |     console.log(`RESPONSIVE_TEXT_MEASURE_JSON ${JSON.stringify({
  483 |       capturedAt: new Date().toISOString(),
  484 |       nodeVersion: process.version,
  485 |       browserName: browser.browserType().name(),
  486 |       browserVersion: browser.version(),
  487 |       simulation: 'test-only per-element computed font-size 2x and original numeric computed line-height 2x; no html/root/viewport/DPR/zoom mutation',
  488 |       apiRequests,
  489 |       results,
  490 |       issues: issueList,
  491 |     })}`);
  492 |   }
  493 | });
  494 | 
```