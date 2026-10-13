# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive-text.spec.ts >> measures responsive layout, text reflow simulation and 44px targets on list and detail
- Location: e2e/responsive-text.spec.ts:397:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.detail-comment__body')
Expected substring: "Corpo próprio preservado após recolher e expandir."
Error: strict mode violation: locator('.detail-comment__body') resolved to 2 elements:
    1) <div class="detail-comment__body">…</div> aka getByRole('article', { name: 'Comentário de autora-' }).locator('div')
    2) <div class="detail-comment__body">…</div> aka getByRole('article', { name: 'Comentário de resposta-com-' }).locator('div')

Call log:
  - Expect "toContainText" locator('.detail-comment__body') with timeout 5000ms
  - waiting for locator('.detail-comment__body')

```

# Page snapshot

```yaml
- main [ref=f4e3]:
  - button "Voltar" [ref=f4e4] [cursor=pointer]
  - generic [ref=f4e5]:
    - generic [ref=f4e6]:
      - paragraph [ref=f4e7]: HN Moderno
      - button "Alternar tema claro e escuro" [ref=f4e8] [cursor=pointer]
    - region "Detalhe da história" [ref=f4e9]:
      - paragraph [ref=f4e10]: História
      - 'heading "Título de história longo para validar quebra de texto sem corte: interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável interface adaptável" [level=1] [ref=f4e11]'
      - link "Abrir tiny.test em nova aba" [ref=f4e12] [cursor=pointer]:
        - /url: https://tiny.test/story
        - text: tiny.test
      - paragraph [ref=f4e13]:
        - generic [ref=f4e14]: 42 pontos
        - generic [aria-hidden] [ref=f4e15]: ·
        - generic [ref=f4e16]: autor-com-nome-longo-para-envolver-sem-truncar
        - generic [aria-hidden] [ref=f4e17]: ·
        - time [ref=f4e18]: há 5 horas
        - generic [aria-hidden] [ref=f4e19]: ·
        - generic [ref=f4e20]: 2 comentários
    - paragraph [ref=f4e21]: Atualizado em 09:00
  - region [ref=f4e22]:
    - heading "Comentários iniciais" [level=2] [ref=f4e23]
    - list "Comentários carregados" [ref=f4e24]:
      - listitem [ref=f4e25]:
        - article "Comentário de autora-comentario" [ref=f4e26]:
          - generic [ref=f4e27]:
            - generic [ref=f4e28]: autora-comentario
            - generic [ref=f4e29]: nível 1
            - time [ref=f4e30]: há 4 horas
            - button "Recolher, 1 resposta carregada" [expanded] [ref=f4e31] [cursor=pointer]: Recolher
          - generic [ref=f4e32]:
            - paragraph [ref=f4e33]: "Comentário longo que deve refluir sem cortar conteúdo: texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas texto acessível em telas estreitas"
            - paragraph [ref=f4e34]: Corpo próprio preservado após recolher e expandir.
            - paragraph [ref=f4e35]:
              - link "link" [ref=f4e36] [cursor=pointer]:
                - /url: https://tiny.test/comment
              - link "comentario-comentario-comentario-comentario-comentario-comentario-comentario-comentario-example.test" [ref=f4e37] [cursor=pointer]:
                - /url: https://comentario-comentario-comentario-comentario-comentario-comentario-comentario-comentario-example.test/destino
        - list "Respostas de autora-comentario" [ref=f4e38]:
          - listitem [ref=f4e39]:
            - article "Comentário de resposta-com-nome-longo" [ref=f4e40]:
              - generic [ref=f4e41]:
                - generic [ref=f4e42]: resposta-com-nome-longo
                - generic [ref=f4e43]: nível 2
                - time [ref=f4e44]: há 4 horas
              - paragraph [ref=f4e46]: Resposta longa preservada na árvore. Resposta longa preservada na árvore. Resposta longa preservada na árvore. Resposta longa preservada na árvore.
```

# Test source

```ts
  229 |     };
  230 |   }, glyphSelector);
  231 | }
  232 | 
  233 | async function measureTargets(page: Page, surface: Surface): Promise<TargetMeasurement[]> {
  234 |   const targets: TargetMeasurement[] = [];
  235 |   const add = async (label: string, locator: Locator) => {
  236 |     const count = await locator.count();
  237 |     expect(count, `${surface} target ${label} should exist`).toBeGreaterThan(0);
  238 |     for (let index = 0; index < count; index += 1) {
  239 |       const element = locator.nth(index);
  240 |       if (!(await element.isVisible())) continue;
  241 |       await element.scrollIntoViewIfNeeded();
  242 |       const measurement = await element.evaluate((target, groupLabel) => {
  243 |         const rect = target.getBoundingClientRect();
  244 |         const box = target as HTMLElement;
  245 |         const text = target.getAttribute('aria-label') || target.textContent || '';
  246 |         return {
  247 |           name: `${text.replace(/\s+/g, ' ').trim().slice(0, 72)} [${indexLabel(target)}]`,
  248 |           width: Math.round(rect.width * 100) / 100,
  249 |           height: Math.round(rect.height * 100) / 100,
  250 |           clientWidth: box.clientWidth,
  251 |           clientHeight: box.clientHeight,
  252 |           scrollWidth: box.scrollWidth,
  253 |           scrollHeight: box.scrollHeight,
  254 |           overflows: box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1,
  255 |         };
  256 | 
  257 |         function indexLabel(element: Element) {
  258 |           const role = element.getAttribute('role');
  259 |           const id = element.id ? `#${element.id}` : '';
  260 |           const classes = typeof (element as HTMLElement).className === 'string'
  261 |             ? (element as HTMLElement).className.trim().split(/\s+/).filter(Boolean).join('.')
  262 |             : '';
  263 |           return `${role ? `[role=${role}]` : ''}${id}${classes ? `.${classes}` : ''}` || groupLabel;
  264 |         }
  265 |       }, label);
  266 |       targets.push(measurement);
  267 |     }
  268 |   };
  269 | 
  270 |   if (surface === 'listing') {
  271 |     await add('category tab', page.locator('.category-tabs__tab'));
  272 |     await add('button', page.locator('button:not([role="tab"])'));
  273 |     await add('story navigation link', page.locator('.story-row__detail'));
  274 |     await add('story source link', page.locator('.story-row__source'));
  275 |   } else {
  276 |     await add('detail button', page.locator('.detail button'));
  277 |     await add('detail source link', page.locator('.detail__source'));
  278 |     await add('comment-body anchor', page.locator('.detail-comment__body a'));
  279 |   }
  280 | 
  281 |   return targets;
  282 | }
  283 | 
  284 | async function measureTextClipping(page: Page, surface: Surface) {
  285 |   const selectors = surface === 'listing'
  286 |     ? ['.listing__header h1', '.story-row__title', '.story-row__meta', '.story-row__source', '.listing__button', '.theme-toggle']
  287 |     : ['.detail__title', '.detail__source', '.detail-comment__body', '.detail-comment__body a', '.detail-comment__toggle', '.theme-toggle'];
  288 | 
  289 |   return page.evaluate((requestedSelectors) => requestedSelectors.flatMap((selector) => {
  290 |     return Array.from(document.querySelectorAll<HTMLElement>(selector))
  291 |       .filter((element) => element.getClientRects().length > 0)
  292 |       .map((element) => {
  293 |         const style = getComputedStyle(element);
  294 |         const clippedX = ['hidden', 'clip'].includes(style.overflowX)
  295 |           && element.scrollWidth > element.clientWidth + 1;
  296 |         const clippedY = ['hidden', 'clip'].includes(style.overflowY)
  297 |           && element.scrollHeight > element.clientHeight + 1;
  298 |         const ellipsized = style.textOverflow === 'ellipsis'
  299 |           && element.scrollWidth > element.clientWidth + 1;
  300 |         return {
  301 |           element: `${selector}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`,
  302 |           clipped: clippedX || clippedY || ellipsized,
  303 |           scrollWidth: element.scrollWidth,
  304 |           clientWidth: element.clientWidth,
  305 |           scrollHeight: element.scrollHeight,
  306 |           clientHeight: element.clientHeight,
  307 |         };
  308 |       });
  309 |   }), selectors);
  310 | }
  311 | 
  312 | async function runScenario(
  313 |   page: Page,
  314 |   surface: Surface,
  315 |   theme: Theme,
  316 |   width: 320 | 375,
  317 |   scale: TextScale,
  318 |   apiRequests: string[],
  319 |   results: ScenarioMeasurement[],
  320 | ) {
  321 |   await page.setViewportSize({ width, height: 812 });
  322 |   await page.goto('/');
  323 |   await expect(page.locator('.listing')).toBeVisible();
  324 | 
  325 |   if (surface === 'detail') {
  326 |     await page.locator(`.story-row__detail[href="/item/${storyId}"]`).click();
  327 |     await expect(page).toHaveURL(new RegExp(`/item/${storyId}$`));
  328 |     await expect(page.locator('.detail')).toBeVisible();
> 329 |     await expect(page.locator('.detail-comment__body')).toContainText(ownCommentText);
      |                                                         ^ Error: expect(locator).toContainText(expected) failed
  330 |   }
  331 | 
  332 |   const themeAttribute = await page.locator('html').getAttribute('data-theme');
  333 |   if (theme === 'dark') expect(themeAttribute).toBe('dark');
  334 |   else expect(themeAttribute).not.toBe('dark');
  335 | 
  336 |   const glyphSelector = surface === 'listing' ? '.listing__header h1' : '.detail__title';
  337 |   let scaleEvidence: ScaleEvidence | undefined;
  338 |   if (scale === 'simulated-200') scaleEvidence = await applyTextResizeSimulation(page, glyphSelector);
  339 | 
  340 |   const targets = await measureTargets(page, surface);
  341 |   const clipping = await measureTextClipping(page, surface);
  342 |   const documentMetrics = await page.evaluate(() => ({
  343 |     innerWidth: window.innerWidth,
  344 |     clientWidth: document.documentElement.clientWidth,
  345 |     scrollWidth: document.documentElement.scrollWidth,
  346 |   }));
  347 | 
  348 |   let categoryStrip: ScenarioMeasurement['categoryStrip'];
  349 |   if (surface === 'listing') {
  350 |     const strip = page.locator('.category-tabs');
  351 |     const jobsTab = page.locator('#category-tab-job');
  352 |     await jobsTab.scrollIntoViewIfNeeded();
  353 |     categoryStrip = await strip.evaluate((element) => {
  354 |       const rect = element.getBoundingClientRect();
  355 |       const tab = element.querySelector<HTMLElement>('#category-tab-job');
  356 |       if (!tab) throw new Error('Jobs tab missing from category strip.');
  357 |       const tabRect = tab.getBoundingClientRect();
  358 |       return {
  359 |         clientWidth: element.clientWidth,
  360 |         scrollWidth: element.scrollWidth,
  361 |         scrollLeft: Math.round(element.scrollLeft * 100) / 100,
  362 |         jobsVisible: tabRect.left >= rect.left - 1 && tabRect.right <= rect.right + 1,
  363 |       };
  364 |     });
  365 |   }
  366 | 
  367 |   const scenario: ScenarioMeasurement = {
  368 |     surface,
  369 |     theme,
  370 |     viewport: width,
  371 |     scale,
  372 |     ...documentMetrics,
  373 |     targets,
  374 |     textClipping: clipping,
  375 |     ...(categoryStrip ? { categoryStrip } : {}),
  376 |     ...(scaleEvidence ? { scaleEvidence } : {}),
  377 |   };
  378 |   results.push(scenario);
  379 | 
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
```