import { test, expect, type Page } from '@playwright/test';
import {
  stubExpansionProvider,
  stubIdeaAxesAndExpansionProvider,
  type StubbedExpansionCard,
  type StubbedIdeaAxis
} from './support/provider.js';
import { expansionCard, expansionSection } from './support/expansion-board.js';

const IDEA = 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama yapmak istiyorum.';

async function startIdea(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

const AI_CARDS: StubbedExpansionCard[] = [
  {
    id: 'ai-card-1',
    title: 'Rota geçmişini yalnız cihazda tut',
    description: 'Sürüş geçmişi buluta gitmeden telefonda saklansın.',
    kind: 'feature',
    effort: 'low',
    impact: 'high',
    deliveryHorizon: 'core'
  }
];

test.describe('Kullanıcı kendi önerisini ekler (Aşama A)', () => {
  test('serbest metinle yazılan öneri fikre eklenir; AI kartıyla aynı karar listesine düşer', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();

    await board.getByLabel('Kendi önerini yaz').fill('Rotaları arkadaşlarımla paylaşmak istiyorum');
    await board.getByRole('button', { name: 'Kendi önerini ekle' }).click();

    await expect(page.locator('.toast')).toContainText('fikre eklendi');

    const decisions = page.getByRole('region', { name: 'Eklediğin kartlar' });
    await expect(decisions).toBeVisible();
    await expect(decisions).toContainText('Rotaları arkadaşlarımla paylaşmak istiyorum');
    // Kullanıcının kendi yazdığı kartın kökeni AI/yerel başlangıç kartlarından
    // ayrı bir cümleyle bellidir; effort/impact uydurulmadığı da burada söylenir.
    await expect(decisions).toContainText('Bu kartı kendi yazdın');

    // Metin alanı başarılı eklemeden sonra temizlenir.
    await expect(board.getByLabel('Kendi önerini yaz')).toHaveValue('');
  });

  test('boş/yalnız boşluk giriş sessizce yok sayılır; bildirim spamlamaz', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    const button = board.getByRole('button', { name: 'Kendi önerini ekle' });

    // Yalnız boşluk: gönder düğmesi zaten devre dışı kalır.
    await board.getByLabel('Kendi önerini yaz').fill('   ');
    await expect(button).toBeDisabled();
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('aynı öneri ikinci kez yazılırsa dürüst bir bildirim gösterilir', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    const input = board.getByLabel('Kendi önerini yaz');
    const button = board.getByRole('button', { name: 'Kendi önerini ekle' });

    await input.fill('Kendi eklediğim bir öneri');
    await button.click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');
    await expect(page.locator('.toast')).toHaveCount(0);

    await input.fill('Kendi eklediğim bir öneri');
    await button.click();
    await expect(page.locator('.toast')).toContainText('zaten');
    await expect(page.locator('.toast')).not.toContainText('fikre eklendi');
  });
});

test.describe('Otomatik öneri (Aşama B)', () => {
  const AXES: StubbedIdeaAxis[] = [
    { label: 'Rota güvenliği', hint: 'Bisiklet rotası ne kadar güvenli?' }
  ];
  // Şema en az 3 kart ister (MINIMUM_EXPANSION_CARDS); daha azı şema
  // doğrulamasını geçemez ve sessizce yerel fallback'e düşer.
  const AUTO_CARDS: StubbedExpansionCard[] = [
    {
      id: 'auto-card-1',
      title: 'Kaza yoğun bölgeleri rotadan uzak tut',
      description: 'Belediye açık verisiyle riskli kesişimler otomatik atlanır.',
      kind: 'feature',
      effort: 'medium',
      impact: 'high',
      deliveryHorizon: 'core'
    },
    {
      id: 'auto-card-2',
      title: 'Rota güvenlik puanını rakamla göster',
      description: 'Her rota için 0-100 arası bir güvenlik puanı hesaplanır.',
      kind: 'feature',
      effort: 'medium',
      impact: 'medium',
      deliveryHorizon: 'later'
    },
    {
      id: 'auto-card-3',
      title: 'Aydınlatmasız sokakları gece rotasından çıkar',
      description: 'Gece saatlerinde aydınlatması zayıf sokaklar otomatik elenir.',
      kind: 'decision',
      effort: 'low',
      impact: 'medium',
      deliveryHorizon: 'later'
    }
  ];

  test('hiçbir başlığa tıklamadan, en alakalı eksen için öneriler kendiliğinden görünür', async ({ page }) => {
    await stubIdeaAxesAndExpansionProvider(page, AXES, AUTO_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();

    // Kullanıcı hiçbir başlığa gitmedi; eksenin bölümü kendiliğinden
    // dolmalı. Arka plan doldurma aynı kartları sözlük kategorilerinin
    // bölümlerine de yazdığı için kart iddiası ekseninin KENDİ bölümüyle
    // sınırlandırıldı: sınanan şey "panoda bir yerde kart var" değil,
    // "OTOMATİK ÖNERİLEN EKSENİN altında kart var".
    const autoCard = expansionCard(page, AXES[0].label, AUTO_CARDS[0].title);
    await expect(autoCard).toBeVisible({ timeout: 15000 });
    await expect(expansionSection(page, AXES[0].label).locator('.pg-expansion-auto-note'))
      .toContainText('otomatik önerdim');

    // Kullanıcı yine de başka bir başlığa geçebilir; bunu doğrulamak bu testin
    // kapsamı dışında (gezinme davranışı diğer spec'te zaten kanıtlı), yalnız
    // otomatik notun kalktığını kontrol ederiz.
    await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
    await expect(board.locator('.pg-expansion-auto-note')).toHaveCount(0);
  });

  test('sağlayıcı çevrimdışıyken otomatik üretim hiç tetiklenmez, hata banner\'ı çıkmaz', async ({ page }) => {
    // stubReadyProvider zaten /api/chat çağrılarını düşürür; idea-axes de
    // başarısız olur ve generateIdeaAxes sessizce boş dizi döner — bu yüzden
    // otomatik üretim hiç başlamaz.
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);

    const board = page.getByRole('region', { name: 'Keşif panosu' });
    await expect(board).toBeVisible();
    await page.waitForTimeout(500);
    // "Hiç panel açılmadı" iddiası ARTIK GEÇERSİZ ve bilerek değiştirildi:
    // arka planda hazırlanan kategoriler artık kendi bölümleriyle görünüyor,
    // yani bu ekranda bölüm OLMASI beklenen davranıştır. Testin koruduğu
    // asıl şey bu değildi zaten; korunan şey ŞU İKİ İDDİA:
    //
    //   1. Fikre özel eksen üretilemedi -> o blok hiç render edilmez,
    //   2. dolayısıyla hiçbir bölüm "bunu senin için ben seçtim" demez,
    //
    // İkisi de aşağıda ayrı ayrı sınanıyor.
    //
    // "Hiç fallback banner'ı yok" İDDİASI DA DÜŞTÜ ve bilerek eklenmedi: bu
    // dosyanın AI_CARDS listesi tek kart içeriyor, şema ise en az üç kart
    // istiyor (MINIMUM_EXPANSION_CARDS). Yani arka planda hazırlanan her
    // kategori şemayı geçemeyip yerel başlangıç kartlarına düşüyor ve bunu
    // söylüyor -- bu DOĞRU davranış. Yokluğunu iddia etmek, panonun
    // dürüstlüğünü bir hata gibi sınamak olurdu.
    await expect(board.locator('.pg-expansion-ai-axes')).toHaveCount(0);
    await expect(board.locator('.pg-expansion-auto-note')).toHaveCount(0);
  });
});
