import { test, expect, type Page } from '@playwright/test';
import { stubReadyProvider } from './support/provider.js';

const IDEA = 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama yapmak istiyorum.';

async function startIdea(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

test.describe('Keşif panosu', () => {
  test('sağlayıcı yokken açılır ve kategorileri gösterir', async ({ page }) => {
    await page.route('**/api/tags', route => route.abort());
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board.getByRole('button', { name: 'Güven ve gizlilik' })).toBeVisible();
    await expect(board.getByRole('button', { name: 'Kapsamı daralt' })).toBeVisible();
  });

  test('kategori açılınca kart gelir ve fikre eklenebilir', async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();

    const firstCard = board.locator('.pg-expansion-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');
  });

  test('Özet sekmesi bozulmaz', async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    await page.getByRole('tab', { name: 'Özet' }).click();
    await expect(page.getByRole('heading', { name: 'Fikir özeti' })).toBeVisible();
  });
});
