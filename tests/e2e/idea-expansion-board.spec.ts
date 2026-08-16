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
  test('saglayici oturum icinde duserse yerel karta duser ve bunu soyler', async ({ page }) => {
    // Kapı (FEATURE_FREEZE "Kayıtlı istisna 1") sağlayıcısız başlamayı engelliyor,
    // bu yüzden önce doğrulanmış sağlayıcıyla girilir. Test edilen durum artık
    // "hiç sağlayıcı yok" değil — oturum içinde sağlayıcının düşmesi. Kapı ürün
    // vaadini, buradaki fallback ise dayanıklılığı koruyor; ikisi farklı şeyler.
    await stubReadyProvider(page);
    await page.goto('/');
    await startIdea(page);

    // Fikir alanına girildikten sonra sağlayıcı kaybolur.
    await page.route('**/api/tags', route => route.abort());
    await page.route('**/api/chat', route => route.abort());

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

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();
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

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();

    const firstCard = board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title });
    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');
    await expect(page.locator('.toast')).toHaveCount(0);

    await firstCard.getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('zaten');
    await expect(page.locator('.toast')).not.toContainText('fikre eklendi');
  });

  test('eklenen kartlar kendi karar listesine düşer; hepsi karara bağlanmadan uygulanamaz', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
    await board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title })
      .getByRole('button', { name: 'Fikre ekle' }).click();
    await board.locator('.pg-expansion-card', { hasText: AI_CARDS[1].title })
      .getByRole('button', { name: 'Fikre ekle' }).click();

    const decisions = page.getByRole('region', { name: 'Eklediğin kartlar' });
    await expect(decisions.locator('li')).toHaveCount(2);
    const apply = decisions.getByRole('button', { name: 'Kararları uygula' });

    // Bekleyen kart varsa applyApprovedChanges sessizce hiçbir şey yapmaz;
    // düğme bu kapıyı gizlemek yerine görünür kılmalı.
    await expect(decisions).toContainText('2 kart hâlâ karar bekliyor');
    await expect(apply).toBeDisabled();

    await decisions.locator('li', { hasText: AI_CARDS[0].title })
      .getByRole('button', { name: 'Kabul et' }).click();
    await expect(decisions.locator('li', { hasText: AI_CARDS[0].title })).toContainText('Kabul edildi');
    await expect(decisions).toContainText('1 kart hâlâ karar bekliyor');
    await expect(apply).toBeDisabled();

    await decisions.locator('li', { hasText: AI_CARDS[1].title })
      .getByRole('button', { name: 'Reddet' }).click();
    await expect(apply).toBeEnabled();

    await apply.click();
    await expect(page.locator('.toast')).toContainText('1 kart plana taşındı');
    // Paket karara bağlandı: yeni kartlar için taze bir paket açılır, bu liste boşalır.
    await expect(page.getByRole('region', { name: 'Eklediğin kartlar' })).toHaveCount(0);
  });

  test('eklenen kart konuşma turunun kritik karar sayısına karışmaz', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    // Kart 'decision' türünde ve affectedSections=['scope'] taşır; turun paketine
    // düşseydi bu rozet kullanıcıya hiç sorulmamış bir kartı kritik karar sayardı.
    // Rozet artık yalnız Ortak Anlayış aşamasında render edilir.
    await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
    const criticalBadge = page.locator('.pg-scope-snapshot div', { hasText: 'Kritik karar' }).locator('b');
    const before = await criticalBadge.innerText();

    await page.getByRole('button', { name: 'Fikir', exact: true }).click();
    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
    await board.locator('.pg-expansion-card', { hasText: AI_CARDS[1].title })
      .getByRole('button', { name: 'Fikre ekle' }).click();

    // Kart gerçekten eklendi: sayının değişmemesi başarısız bir eklemeden gelmiyor.
    await expect(page.getByRole('region', { name: 'Eklediğin kartlar' }))
      .toContainText(AI_CARDS[1].title);

    await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
    await expect(criticalBadge).toHaveText(before);
  });

  test('karara bağlanan kart panoya geri dönmez', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
    await board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title })
      .getByRole('button', { name: 'Fikre ekle' }).click();

    const decisions = page.getByRole('region', { name: 'Eklediğin kartlar' });
    await decisions.locator('li', { hasText: AI_CARDS[0].title })
      .getByRole('button', { name: 'Reddet' }).click();
    await expect(decisions.locator('li', { hasText: AI_CARDS[0].title })).toContainText('Reddedildi');

    // Aynı kategoriyi yenile: model kartı yine üretse bile pano onu göstermemeli.
    await board.getByRole('button', { name: 'Yenile' }).click();
    await expect(board.locator('.pg-expansion-card', { hasText: AI_CARDS[1].title })).toBeVisible();
    await expect(board.locator('.pg-expansion-card', { hasText: AI_CARDS[0].title })).toHaveCount(0);
    await expect(board).toContainText('daha önce karara bağladığın için gizledim');
  });

  test('Özet ve Keşif ayrı aşamalarda durur, birbirini bozmaz', async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');
    await startIdea(page);

    // Fikir aşamasında yalnız Keşif panosu var; özet listesi burada değil.
    await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toBeVisible();

    // Ortak Anlayış aşamasında özet var, Keşif panosu yok.
    await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
    await expect(page.locator('.pg-map-note')).toContainText('Taslak alanlar henüz kesinleşmedi');
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toHaveCount(0);
  });
});
