const { test, expect } = require('@playwright/test');

const BASE = process.env.SYNDES_DOCS_URL ||
  'https://delmacy.github.io/syndes-system/assets/experimentos/livros/b/';
const A06 = new URL('02-plataforma/a06/', BASE).toString();
const VOLUME = new URL('02-plataforma/', BASE).toString();
const ANCHORS = [
  'estado','casos-de-uso','historias-de-usuario','requisitos',
  'arquitetura','contratos','apis','eventos','dados','schema',
  'dependencias','configuracao','interface','testes','operacao','wbs',
  'registro-de-alteracoes',
];

test('Biblioteca e volume permitem descobrir A06 sem navegação quebrada', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: /biblioteca/i }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/artifacts/biblioteca.png', fullPage: false });
  await page.goto(VOLUME);
  await expect(page.locator('main')).toContainText('A06');
  const chapter = page.locator('main a[href*="/a06/"]').first();
  await expect(chapter).toBeVisible();
  await chapter.click();
  await expect(page).toHaveURL(/\/02-plataforma\/a06\/?$/);
  await expect(page.locator('main')).toContainText('Account Access API');
});

test('A06 é uma página contínua com conteúdo técnico real no próprio corpo', async ({ page }) => {
  await page.goto(A06);
  const article = page.locator('.sl-markdown-content');
  await expect(article).toBeVisible();
  await expect(article).toContainText('GET /healthz');
  await expect(article).toContainText('createAccountAccessServer');
  await expect(article).toContainText('apply_tenant_account_delegation');
  await expect(article).toContainText('POST /v1/accounts/');
  await expect(article).not.toContainText('Linha 7:');
  await expect(article.locator('h2', { hasText: /APIs e endpoints/ })).toHaveCount(1);
  await expect(article.locator('h2', { hasText: /Schemas e migrations/ })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/artifacts/a06-desktop.png', fullPage: false });
});

test('Índice local chega às 17 âncoras e não abre outras páginas', async ({ page }) => {
  await page.goto(A06);
  const article = page.locator('.sl-markdown-content');
  for (const slug of ANCHORS) {
    await expect(article.locator('#' + slug)).toHaveCount(1);
    await expect(article.locator('a[href="#' + slug + '"]').first()).toHaveCount(1);
  }
  await article.locator('a[href="#apis"]').first().click();
  await expect(page).toHaveURL(/#apis$/);
  const viewportPosition = await page.locator('#apis').evaluate(
    el => el.getBoundingClientRect().top
  );
  expect(viewportPosition, 'Anchor should scroll within the viewport').toBeGreaterThan(-100);
  expect(viewportPosition).toBeLessThan(900);
});

test('Cada seção editável oferece o caminho GitHub e não promete salvamento', async ({ page }) => {
  await page.goto(A06);
  const content = page.locator('.sl-markdown-content');
  await expect(content).toContainText('Espaço para alterações');
  const editLinks = content.locator('a[href*="github.com/delmacy/syndes-system/edit/main/"]');
  expect(await editLinks.count()).toBeGreaterThan(4);
  const hrefs = await editLinks.evaluateAll(els => els.map(el => el.getAttribute('href')));
  for (const href of hrefs) {
    expect(href).toMatch(/^https:\/\/github\.com\/delmacy\/syndes-system\/edit\/main\//);
  }
});

test('Os links de âncora do conteúdo apontam para elementos existentes', async ({ page }) => {
  await page.goto(A06);
  const broken = await page.locator('.sl-markdown-content').evaluate(root => {
    return [...root.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href'))
      .filter(href => href && href !== '#')
      .filter(href => {
        try { return !document.getElementById(decodeURIComponent(href.slice(1))); }
        catch { return true; }
      });
  });
  expect(broken, 'Broken in-page anchor targets').toEqual([]);
});

test('Leitura não tem overflow horizontal no viewport', async ({ page, isMobile }) => {
  await page.goto(A06);
  await expect(page.locator('main')).toBeVisible();
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(metrics.document, 'Horizontal page overflow').toBeLessThanOrEqual(metrics.viewport + 2);
  await page.screenshot({
    path: 'test-results/artifacts/a06-' + (isMobile ? 'mobile' : 'desktop-viewport') + '.png',
    fullPage: false,
  });
});

test('Sem erros JavaScript graves ao navegar pelos volumes e capítulo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(BASE);
  await page.goto(VOLUME);
  await page.goto(A06);
  await page.locator('.sl-markdown-content a[href="#contratos"]').first().click();
  expect(errors, 'JavaScript runtime errors').toEqual([]);
});
