import { expect, test } from '@playwright/test';

const publicPages = [
  { path: '/institucional', heading: 'Institucional', canonical: 'https://medario.com.br/institucional' },
  { path: '/privacidade', heading: 'Política de Privacidade', canonical: 'https://medario.com.br/privacidade' },
  { path: '/termos', heading: 'Termos de Uso', canonical: 'https://medario.com.br/termos' },
] as const;

test.describe('public institutional pages', () => {
  for (const pageContract of publicPages) {
    test(`${pageContract.path} preserves content and canonical`, async ({ page }) => {
      await page.goto(pageContract.path);
      await expect(page.getByRole('heading', { level: 1, name: pageContract.heading })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', pageContract.canonical);
      await expect(page.getByRole('link', { name: 'Privacidade' })).toHaveCount(1);
    });
  }

  test('legacy legal aliases permanently redirect to extensionless routes', async ({ page }) => {
    await page.goto('/institucional.html');
    await expect(page).toHaveURL(/\/institucional$/);
    await page.goto('/privacidade.html');
    await expect(page).toHaveURL(/\/privacidade$/);
    await page.goto('/termos.html');
    await expect(page).toHaveURL(/\/termos$/);
  });

  test('keeps the sparse real directory out of search indexing', async ({ page }) => {
    await page.goto('/medicos/joinville');
    await expect(page.getByRole('heading', { level: 1, name: 'Médicos em Joinville/SC' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex,\s*follow/);
    await expect(page.getByRole('heading', { level: 2, name: 'Dra. Mariana Andrade' })).toBeVisible();
    await expect(page.getByText(/três perfis confirmados/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver médicos em Joinville' })).toHaveAttribute('href', 'https://app.medario.com.br/?city=joinville&entry=directory-joinville');
  });

  test('keeps institutional actions touch-sized at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/institucional');
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      undersized: [...document.querySelectorAll<HTMLElement>('a[href],button,input,select')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map((element) => element.textContent?.trim()),
    }));
    expect(metrics.scrollWidth).toBe(320);
    expect(metrics.undersized).toEqual([]);
  });

  test('keeps robots and sitemap available on the Next surface', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Sitemap: https://medario.com.br/sitemap.xml');
    expect(await robots.text()).toContain('Disallow: /conta');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('https://medario.com.br/');
    expect(sitemapText).toContain('https://medario.com.br/medicos/mariana-andrade');
    expect(sitemapText).not.toContain('https://medario.com.br/medicos/joinville');
  });

  test('serves baseline security headers on the Next surface', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
