import { test, expect } from '@playwright/test';

test.describe('PromtGen V4 Smoke Tests', () => {
  test('loads the application shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PromtGen/);
  });

  test('renders the main app container', async ({ page }) => {
    await page.goto('/');
    const app = page.locator('#root');
    await expect(app).toBeVisible();
  });

  test('shows the focused idea-first product promise', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Önce fikrini geliştir/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fikri geliştir' })).toBeVisible();
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('create, save, reopen and canonical export smoke flow', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Ne yapmak istiyorsun?').fill('Bireysel geliştiricilerin fikirlerini yerel olarak onaylı MVP kapsamına ve uygulanabilir görevlere dönüştüren bir web uygulaması yapmak istiyorum');
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    await page.getByLabel('Açık kritik sorular').fill('');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await page.getByRole('button', { name: /Detaylı planla/ }).click();
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    await page.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await page.getByText('Plan kalitesi', { exact: true }).click();
    await page.locator('.readiness-breakdown summary').click();
    await expect(page.getByRole('region', { name: 'Plan hazırlık kalite kapısı' })).toBeVisible();
    await expect(page.getByText('READINESS 3.0')).toBeVisible();
    await page.getByText(/Labs · İsteğe bağlı analiz/).click();
    await expect(page.getByText('Görev teslim kanıtı')).toBeVisible();
    await page.getByText('Görev teslim kanıtı').click();
    await expect(page.getByText(/PromtGen kod yazmaz/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Görev teslim durumları' })).toBeVisible();
    const editor = page.locator('.section-editor textarea');
    await editor.fill('Kullanıcının kısa fikrini onaylı kararlarla yaşayan plana dönüştür.');
    await page.getByRole('button', { name: 'Bölümü kaydet' }).click();
    await expect(page.locator('.toast')).toContainText('kaydedildi');

    await page.reload();
    await page.locator('.portfolio-projects > button').first().click();
    await page.getByRole('button', { name: /Detaylı planla/ }).click();
    await expect(page.locator('.section-editor textarea')).toHaveValue(/yaşayan plana dönüştür/);

    const download = page.waitForEvent('download');
    await page.getByLabel('Çalışma alanı araçları').click();
    await page.getByRole('button', { name: 'Markdown' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.md$/);
  });
});
