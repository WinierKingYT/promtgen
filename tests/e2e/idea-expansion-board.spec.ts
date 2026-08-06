import { test, expect, type Page } from '@playwright/test';
import { stubReadyProvider, stubExpansionProvider, type StubbedExpansionCard } from './support/provider.js';

const IDEA = 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama yapmak istiyorum.';

/**
 * Bu başlıklar hiçbir kategorinin seedTitles listesinde yoktur; ekranda
 * görülüyorlarsa kartlar yalnız model yolundan gelmiş olabilir.
 */
const AI_CARDS: StubbedExpansionCard[] = [
  {
    id: 'ai-card-1',
    title: 'Rota geçmişini yalnız cihazda tut',
    description: 'Sürüş geçmişi buluta gitmeden telefonda saklansın.',
    kind: 'feature',
    effort: 'low',
    impact: 'high',
    mvpHint: 'mvp-adayı'
  },
  {
    id: 'ai-card-2',
    title: 'Kaza noktalarını anonim toplayan bir izin akışı',
    description: 'Konum paylaşımı için ayrı ve geri alınabilir bir izin sorulsun.',
    kind: 'decision',
    effort: 'medium',
    impact: 'medium',
    mvpHint: 'sonraya'
  },
  {
    id: 'ai-card-3',
    title: 'Veri silme isteğini tek ekrandan tamamla',
    description: 'Kullanıcı tüm sürüş verisini tek adımda silebilsin.',
    kind: 'feature',
    effort: 'medium',
    impact: 'high',
    mvpHint: 'mvp-adayı'
  }
];

async function startIdea(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

test.describe('Keşif panosu', () => {
  test('sağlayıcı yokken açılır, kategorileri ve başlangıç uyarısını gösterir', async ({ page }) => {
    await page.route('**/api/tags', route => route.abort());
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board.getByRole('button', { name: 'Güven ve gizlilik' })).toBeVisible();
    await expect(board.getByRole('button', { name: 'Kapsamı daralt' })).toBeVisible();

    // Sağlayıcı yokken kartlar yerelden gelir; bu ekranda açıkça söylenmeli.
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
    await expect(board.locator('.pg-expansion-fallback')).toContainText('AI bağlı değil');
    await expect(board.locator('.pg-expansion-card').first())
      .toContainText('efor ve etki değerlendirilmedi');
  });

  test('kategori açılınca AI kartları gelir ve fikre eklenebilir', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();

    // seedTitles fallback'i bu başlığı asla üretemez: kart model yolundan geldi.
    const firstCard = board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title });
    await expect(firstCard).toBeVisible();
    await expect(board.locator('.pg-expansion-fallback')).toHaveCount(0);
    await expect(firstCard).toContainText('Az efor');

    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');
  });

  test('aynı kart ikinci kez eklenince dürüst bir bildirim gösterilir', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    await page.getByRole('tab', { name: 'Keşif' }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();

    const firstCard = board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title });
    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');
    await expect(page.locator('.toast')).toHaveCount(0);

    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('zaten');
    await expect(page.locator('.toast')).not.toContainText('fikre eklendi');
  });

  test('Özet sekmesi bozulmaz', async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');
    await startIdea(page);

    // "Fikir özeti" başlığı iki sekmede de duran .pg-map-head içinde yaşar;
    // buradaki iddia yalnız Özet panelinde bulunan içeriğe bakmalı.
    await page.getByRole('tab', { name: 'Keşif' }).click();
    await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Özet' }).click();
    await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
    await expect(page.locator('.pg-map-note')).toContainText('Taslak alanlar henüz kesinleşmedi');
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toHaveCount(0);
  });
});
