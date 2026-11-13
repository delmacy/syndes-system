const { test, expect } = require('@playwright/test');

const A06 = '02-plataforma/a06/';

test('Leitura começa com um único título, sem índice ou links em tabela', async ({ page }, testInfo) => {
  await page.goto(A06);
  const main = page.locator('main');
  await expect(main).toBeVisible();
  await expect(main.locator('h1')).toHaveCount(1);
  const article = page.locator('.sl-markdown-content');
  await expect(article.locator('.syndes-chapter-lead')).toBeVisible();
  await expect(article.locator('.syndes-chapter-index')).toHaveCount(1);
  await expect(article.locator('.syndes-chapter-index')).not.toHaveAttribute('open', '');
  await expect(article.locator('.syndes-meta')).toBeVisible();
  await expect(article).toContainText('GET /healthz');
  await expect(article).toContainText('createAccountAccessServer');
  await expect(article.locator('.syndes-source-meta').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('article-top.png'), fullPage: false });
});

test('Índice abre, navega por âncoras e mantém o artigo na mesma URL', async ({ page }) => {
  await page.goto(A06);
  const index = page.locator('.syndes-chapter-index');
  await index.locator('summary').click();
  await expect(index).toHaveAttribute('open', '');
  const links = index.locator('nav a[href^="#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(16);
  await index.locator('a[href="#apis"]').click();
  await expect(page).toHaveURL(/\/a06\/#apis$/);
  await expect(page.locator('#apis')).toHaveCount(1);
  const top = await page.locator('#apis').evaluate(e => e.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(-120);
  expect(top).toBeLessThan(1000);
});

test('Links editoriais discretos, ajuste recolhido, sem manchetes duplicadas', async ({ page }) => {
  await page.goto(A06);
  const article = page.locator('.sl-markdown-content');
  await expect(article.locator('.syndes-edit-note').first()).not.toHaveAttribute('open', '');
  await expect(article.locator('h2', { hasText: 'APIs e endpoints' })).toHaveCount(1);
  const reference = article.locator('.syndes-source-meta a[href*="github.com/delmacy/syndes-system/"]').first();
  await expect(reference).toHaveAttribute('href', /github\.com/);
  const headings = await page.locator('main h1').allTextContents();
  expect(headings).toHaveLength(1);
});

test('Leitura responsiva sem overflow global e contraste de links visíveis', async ({ page }, testInfo) => {
  await page.goto(A06);
  await expect(page.locator('.sl-markdown-content')).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    doc: document.documentElement.scrollWidth,
    fontSize: parseFloat(getComputedStyle(document.querySelector('.sl-markdown-content')).fontSize),
    lineHeight: parseFloat(getComputedStyle(document.querySelector('.sl-markdown-content')).lineHeight),
  }));
  expect(metrics.doc).toBeLessThanOrEqual(metrics.viewport + 2);
  expect(metrics.fontSize).toBeGreaterThanOrEqual(15);
  expect(metrics.lineHeight / metrics.fontSize).toBeGreaterThan(1.55);
  await page.screenshot({ path: testInfo.outputPath('article-viewport.png'), fullPage: false });
});

test('Não gera erro fatal de script e permite acesso por teclado ao índice', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(A06);
  const details = page.locator('.syndes-chapter-index');
  await details.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});
