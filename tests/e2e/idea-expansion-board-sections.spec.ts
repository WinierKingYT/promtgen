import { test, expect, type Page } from '@playwright/test';
import {
  stubExpansionProvider,
  stubExpansionProviderByCategory,
  type StubbedExpansionCard
} from './support/provider.js';
import {
  expansionBoard,
  expansionCard,
  expansionSection,
  waitForSettledSections
} from './support/expansion-board.js';

const IDEA = 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama yapmak istiyorum.';

/**
 * Arka plan doldurma sırayla ilk ALTI kategoriyi hazırlıyor
 * (pencere tabanı BACKGROUND_PREFETCH_FLOOR, expansion-prefetch.ts). Fikre özel eksen
 * üretilemediği (idea-axes çağrısı düşürüldüğü) senaryolarda bu altı, SUNUM
 * SIRASININ ilk altısıdır: alana özel eksenler önce, genel kategoriler sonra
 * (bkz. orderExpansionCategoriesForPresentation, categories.ts). Bu fikir bir
 * MOBİL uygulama olduğu için alana özel üçlü — çevrimdışı, izinler,
 * bildirimler — sıranın başında durur.
 */
const PREFETCHED_SECTIONS = 6;
const FIRST_SECTION = 'Çevrimdışı ve senkron';
const SECOND_SECTION = 'İzinler';
const SIXTH_SECTION = 'Veri ve içerik';
/** Genel kategorilerin sonuncusu: arka plan sınırının DIŞINDA kalır. */
const BEYOND_LIMIT_SECTION = 'Kapsamı daralt';

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

/**
 * Kategori BAŞINA ayrı kart listesi. Gerçek modelin yaptığı budur ve
 * "her başlığın KENDİ önerileri var" iddiası ancak böyle ölçülebilir:
 * `stubExpansionProvider` her başlığa aynı listeyi verdiği için pano onları
 * bölümler arası elemeyle (bkz. expansion-section-dedup.ts) tek bölüme
 * indiriyor -- doğru davranış, ama çokluğu ölçemez.
 *
 * Kartlar birbirinden gerçekten farklı yazıldı; hiçbiri elemeye takılmamalı.
 */
const CARDS_BY_SECTION: Record<string, StubbedExpansionCard[]> = {
  [FIRST_SECTION]: AI_CARDS,
  [SECOND_SECTION]: [
    {
      id: 'akis-1',
      title: 'Yokuş eğimine göre alternatif güzergah',
      description: 'Dik yamaçlardan kaçınan daha uzun bir yol seçeneği sunulsun.',
      kind: 'feature',
      effort: 'high',
      impact: 'high',
      mvpHint: 'sonraya'
    },
    {
      id: 'akis-2',
      title: 'Bisiklet park yerlerini haritada işaretle',
      description: 'Varış noktasına yakın kilitli park alanları görünsün.',
      kind: 'feature',
      effort: 'medium',
      impact: 'high',
      mvpHint: 'mvp-adayı'
    },
    {
      id: 'akis-3',
      title: 'Sesli yönlendirme kulaklıkla çalışsın',
      description: 'Sürücü ekrana bakmadan dönüşleri duyabilsin.',
      kind: 'feature',
      effort: 'medium',
      impact: 'medium',
      mvpHint: 'sonraya'
    }
  ],
  [SIXTH_SECTION]: [
    {
      id: 'buyume-1',
      title: 'Haftalık pedal özeti',
      description: 'Her pazartesi kısa bir mesafe ve süre raporu hazırlansın.',
      kind: 'feature',
      effort: 'low',
      impact: 'medium',
      mvpHint: 'sonraya'
    },
    {
      id: 'buyume-2',
      title: 'Davet eden kişiye küçük nişan',
      description: 'Yeni katılan birini getiren kullanıcı rozet kazansın.',
      kind: 'feature',
      effort: 'low',
      impact: 'low',
      mvpHint: 'sonraya'
    },
    {
      id: 'buyume-3',
      title: 'Kış aylarında bildirim sıklığı düşsün',
      description: 'Soğuk dönemde hatırlatmalar kendiliğinden seyrelsin.',
      kind: 'decision',
      effort: 'medium',
      impact: 'low',
      mvpHint: 'sonraya'
    }
  ],
  [BEYOND_LIMIT_SECTION]: [
    {
      id: 'kapsam-1',
      title: 'İlk sürümde yalnız tek şehir',
      description: 'Başlangıçta sadece bir şehrin haritası desteklensin.',
      kind: 'decision',
      effort: 'low',
      impact: 'high',
      mvpHint: 'mvp-adayı'
    },
    {
      id: 'kapsam-2',
      title: 'Grup sürüşü sonraya kalsın',
      description: 'Birlikte pedal çevirme özelliği ikinci sürüme bırakılsın.',
      kind: 'decision',
      effort: 'high',
      impact: 'medium',
      mvpHint: 'sonraya'
    },
    {
      id: 'kapsam-3',
      title: 'Yarış modu kapsam dışı',
      description: 'Zamana karşı yarışma bu üründe hiç bulunmasın.',
      kind: 'decision',
      effort: 'low',
      impact: 'medium',
      mvpHint: 'sonraya'
    }
  ]
};

async function startIdea(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

test.describe('Keşif panosu: hazır olan her başlık aynı anda görünür', () => {
  test('arka planda hazırlanan kategorilerin HEPSİ kendi bölümüyle görünür', async ({ page }) => {
    await stubExpansionProviderByCategory(page, CARDS_BY_SECTION);
    await page.goto('/');
    await startIdea(page);

    // Asıl iddia: kullanıcı hiçbir şeye tıklamadan BİRDEN ÇOK başlık altında
    // öneri görüyor. Arka planda altı kategori hazırlanırken kullanıcının
    // yalnız birini görmesi, çokluğun kaybolduğu yerdi.
    await waitForSettledSections(page, PREFETCHED_SECTIONS);
    for (const label of [FIRST_SECTION, SECOND_SECTION, SIXTH_SECTION]) {
      const section = expansionSection(page, label);
      await expect(section).toBeVisible();
      await expect(section.locator('.pg-expansion-card')).toHaveCount(CARDS_BY_SECTION[label].length);
      // Kartlar O BAŞLIĞIN kendi kartları: bölümler arası eleme (bkz.
      // expansion-section-dedup.ts) gerçekten farklı önerileri elemiyor.
      await expect(expansionCard(page, label, CARDS_BY_SECTION[label][0].title)).toBeVisible();
    }
    // Her bölüm kendi başlığını taşır: kartlar hangi başlıktan geldiği
    // belirsiz tek bir yığına dökülmez.
    await expect(expansionBoard(page).getByRole('heading', { name: FIRST_SECTION, exact: true })).toBeVisible();
  });

  test('aynı öneri iki başlıkta birden yazılmaz; ikinci bölüm nedenini söyler', async ({ page }) => {
    // Model her başlığa AYNI kartları verirse -- canlı ölçümde tam olarak bu
    // oldu, 40 kartın yalnız 33'ü benzersizdi -- kullanıcı aynı öneriyi üç
    // ayrı başlık altında okuyordu.
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    // Kart panoda BİR kez var: ilk gösterilen bölümde.
    await expect(expansionBoard(page).locator('.pg-expansion-card', { hasText: AI_CARDS[0].title }))
      .toHaveCount(1);
    await expect(expansionCard(page, FIRST_SECTION, AI_CARDS[0].title)).toBeVisible();

    // Boşalan bölüm sessizce boş kutu göstermez: nedeni tek cümleyle yazılı.
    const second = expansionSection(page, SECOND_SECTION);
    await expect(second).toBeVisible();
    await expect(second.locator('.pg-expansion-card')).toHaveCount(0);
    await expect(second).toContainText('yukarıdaki başlıklarla aynıydı');
  });

  test('henüz hazır olmayan kategori de başlığıyla ve durumuyla görünür', async ({ page }) => {
    // Üretim yavaşlatılır: gerçek hayatta kategori başına ~25 saniye süren
    // "hazırlanıyor / sırada" durumları ancak böyle ölçülebilir.
    await stubExpansionProvider(page, AI_CARDS, { delayMs: 2500 });
    await page.goto('/');
    await startIdea(page);

    // İlk kategori üretimde, ikincisi sırada: ikisi de görünür ve durumu
    // yazılı. Sessizce boş kalan bir bölüm, kullanıcıya panonun az öneri
    // ürettiğini düşündürürdü.
    await expect(expansionSection(page, FIRST_SECTION)).toContainText('hazırlanıyor');
    await expect(expansionSection(page, SECOND_SECTION)).toContainText('sırada');
  });
});

test.describe('Kart yüzü: yalnız başlık, tek cümle ve eylem', () => {
  test('efor/etki/MVP tahmini kart yüzünde görünmez, ayrıntı açılınca erişilebilir olur', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    const card = expansionCard(page, FIRST_SECTION, AI_CARDS[0].title);
    await expect(card).toBeVisible();
    // Kart yüzünde kalanlar.
    await expect(card.getByRole('heading', { name: AI_CARDS[0].title })).toBeVisible();
    await expect(card.getByText(AI_CARDS[0].description)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Fikre ekle' })).toBeVisible();

    // Modelin TAHMİNİ olan üç rozet yüzde değil: kapalı ayrıntının içinde.
    for (const guess of ['Az efor', 'Yüksek etki', 'İlk sürüm adayı']) {
      await expect(card.getByText(guess, { exact: true })).toBeHidden();
    }

    // Silinmediler: ayrıntı açılınca hepsi okunabilir ve tahmin oldukları
    // açıkça yazılı.
    await card.getByText('Modelin tahmini', { exact: true }).click();
    for (const guess of ['Az efor', 'Yüksek etki', 'İlk sürüm adayı']) {
      await expect(card.getByText(guess, { exact: true })).toBeVisible();
    }
    await expect(card).toContainText('ölçülmüş bir sonuç değil');
  });
});

test.describe('Fikre eklenen kart panodan düşer', () => {
  test('eklenen kart yeniden üretimden sonra hiçbir bölümde önerilmez', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    // Aynı sahte kart listesi bütün bölümlerde duruyor; kart bir bölümden
    // eklendiğinde ötekilerde de önerilmeye devam ederse kullanıcı zaten
    // fikrinde olan bir şeyi eklemeye çağrılırdı.
    await expansionCard(page, FIRST_SECTION, AI_CARDS[0].title)
      .getByRole('button', { name: 'Fikre ekle' }).click();
    await expect(page.locator('.toast')).toContainText('fikre eklendi');

    await waitForSettledSections(page, PREFETCHED_SECTIONS);
    await expect(expansionBoard(page).locator('.pg-expansion-card', { hasText: AI_CARDS[0].title }))
      .toHaveCount(0);
    // Kart sessizce kaybolmaz: nedeni ekranda yazılı.
    await expect(expansionSection(page, FIRST_SECTION))
      .toContainText('daha önce karara bağladığın için gizledim');
    // Öteki kartlar yerinde: düşen yalnız karara bağlanan kart.
    await expect(expansionCard(page, FIRST_SECTION, AI_CARDS[1].title)).toBeVisible();
  });
});

test.describe('Başlık düğmeleri: seçici değil, gezinme', () => {
  test('başlığa tıklayınca o bölüme gidilir', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    const target = expansionSection(page, SIXTH_SECTION);
    // Altı bölüm alt alta durduğu için sonuncusu ilk ekranda değil.
    await expect(target).not.toBeInViewport();
    await expansionBoard(page).getByRole('button', { name: SIXTH_SECTION, exact: true }).click();
    await expect(target).toBeInViewport();
  });

  test('arka plan sınırının dışındaki başlık tıklanınca üretilir ve kendi bölümünü açar', async ({ page }) => {
    // Kategori BAŞINA ayrı kart: iddia "üretim gerçekten koştu" olduğu için
    // bölüm kendi kartlarını göstermeli, bölümler arası elemeye takılmamalı.
    await stubExpansionProviderByCategory(page, CARDS_BY_SECTION);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    // Sınırın dışında kalan kategori KAYBOLMADI: düğmesi duruyor ve tıklama
    // üretimi başlatıyor.
    await expect(expansionSection(page, BEYOND_LIMIT_SECTION)).toHaveCount(0);
    await expansionBoard(page).getByRole('button', { name: BEYOND_LIMIT_SECTION, exact: true }).click();

    const opened = expansionSection(page, BEYOND_LIMIT_SECTION);
    await expect(opened).toBeVisible();
    await expect(opened.locator('.pg-expansion-card'))
      .toHaveCount(CARDS_BY_SECTION[BEYOND_LIMIT_SECTION].length);
    await expect(opened).toBeInViewport();
  });
});

test.describe('Çoklu bölüm yerleşimi', () => {
  test('1440, 1024 ve 375 genişliklerinde yatay taşma olmaz', async ({ page }) => {
    await stubExpansionProvider(page, AI_CARDS);
    await page.goto('/');
    await startIdea(page);
    await waitForSettledSections(page, PREFETCHED_SECTIONS);

    for (const width of [1440, 1024, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px yatay taşma`).toBeLessThanOrEqual(1);
      // Kart ızgarası dar ekranda tek sütuna iner ama kartın kendisi hâlâ
      // kullanılabilir: eylem düğmesi görünür kalır.
      await expect(
        expansionCard(page, FIRST_SECTION, AI_CARDS[0].title).getByRole('button', { name: 'Fikre ekle' })
      ).toBeVisible();
    }
  });
});
