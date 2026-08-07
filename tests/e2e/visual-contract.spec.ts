import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureComputedStyles,
  diffScreen,
  type ElementStyle
} from './support/visual-contract.js';
import { stubExpansionProvider, type StubbedExpansionCard } from './support/provider.js';

const BASELINE_PATH = resolve('tests/e2e/visual-contract.baseline.json');
/** Referansı bilerek yeniden üretmek için: UPDATE_VISUAL_BASELINE=1 */
const UPDATE = process.env.UPDATE_VISUAL_BASELINE === '1';

// Uygulama bir PWA service worker'ı ile derleniyor (vite-plugin-pwa). Service
// worker sayfanın fetch'lerini Playwright'ın page.route() katmanından önce
// yakalayabilir; bu da stubReadyProvider'ın /api/tags sahtesinin bazen devre
// dışı kalmasına ve `.pg-runtime-pill` durumunun koşudan koşuya değişmesine
// yol açar (deneyle doğrulandı). Bu testte yalnız hesaplanmış stiller
// önemli, offline önbellekleme davranışı değil; bu yüzden service worker
// tamamen kapatılır.
test.use({ serviceWorkers: 'block' });

const IDEA = 'Şehir içinde bisiklet kullananlara güvenli rota öneren bir mobil uygulama yapmak istiyorum.';

const CARDS: StubbedExpansionCard[] = [
  {
    id: 'vc-1',
    title: 'Rota geçmişini yalnız cihazda tut',
    description: 'Sürüş geçmişi buluta gitmeden telefonda saklansın.',
    kind: 'feature',
    effort: 'low',
    impact: 'high',
    mvpHint: 'mvp-adayı'
  },
  {
    id: 'vc-2',
    title: 'Kaza noktalarını anonim toplayan bir izin akışı',
    description: 'Konum paylaşımı için ayrı ve geri alınabilir bir izin sorulsun.',
    kind: 'decision',
    effort: 'medium',
    impact: 'medium',
    mvpHint: 'sonraya'
  },
  {
    id: 'vc-3',
    title: 'Veri silme isteğini tek ekrandan tamamla',
    description: 'Kullanıcı tüm sürüş verisini tek adımda silebilsin.',
    kind: 'feature',
    effort: 'medium',
    impact: 'high',
    mvpHint: 'mvp-adayı'
  }
];

async function openStudio(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

async function openExpansionCards(page: Page) {
  await page.getByRole('tab', { name: 'Keşif' }).click();
  const board = page.getByRole('region', { name: 'Keşif panosu' });
  await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
  await expect(board.locator('.pg-expansion-card', { hasText: CARDS[0].title })).toBeVisible();
}

/**
 * Ekranlar tek bir test içinde sırayla gezilir: referans dosyası tek yazıcıya
 * sahip olur ve `fullyParallel` ayarıyla yarışmaz. Tek testte toplanan fark
 * listesi göç sırasında da daha yararlıdır — bütün kaymaları bir arada gösterir.
 */
test('görsel sözleşme: hesaplanmış stiller referansla birebir aynı', async ({ page }) => {
  // Uygulamanın kendi prefers-reduced-motion kuralı (styles.css:551) tüm
  // geçiş sürelerini .01ms'ye indiriyor. Bu olmadan, `.pg-start-composer`
  // üzerindeki autoFocus tetiklemeli border-color/box-shadow geçişi (:660)
  // yakalama anıyla yarışır: her koşuda geçişin farklı bir noktası
  // dondurulur ve referans hiçbir zaman tekrarlanabilir olmaz. Bu satır
  // sayesinde referans, geçişin ortası değil, oturmuş son durumu kaydeder.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Sahte saat sayfa yüklenmeden önce kurulur ki erken zamanlayıcılar
  // (yükleme, sağlayıcı kontrolü) normal akışında çalışsın — `install()`
  // tek başına saati dondurmaz, yalnız `pauseAt`/`fastForward`/`runFor`
  // çağrıldığında zaman durur. Toast penceresinden hemen önce dondurulacak.
  await page.clock.install();
  await stubExpansionProvider(page, CARDS);
  const captured: Record<string, ElementStyle[]> = {};

  await page.goto('/');
  await expect(page.getByLabel('Ne yapmak istiyorsun?')).toBeVisible();
  // `.pg-runtime-pill`in sınıfı (`is-local` → `is-ai`) sağlayıcı hazırlık
  // kontrolü (readiness) çözülünce değişir; bu asenkron bir kontroldür ve
  // sayfa yüklenir yüklenmez henüz sonuçlanmamış olabilir. Bu bekleme
  // olmadan yakalama anı kontrolün tamamlanma anıyla yarışır: nokta bazen
  // henüz "yerel" (turuncu), bazen "AI hazır" (yeşil) durumda yakalanır.
  // stubExpansionProvider, stubReadyProvider'ı içeriden çağırarak (provider.ts:61)
  // kontrolü zaten her zaman başarıyla sonuçlandırıyor; burada ayrıca
  // çağrılmaz. Bu yüzden beklenen nihai durum her zaman `is-ai`dir. `toHaveCSS`
  // kullanılır (yalnız sınıf adı değil): sınıf DOM'a class-adı olarak
  // yazılsa bile computed style'ın aynı anda oturduğunun garantisi
  // yalnız hesaplanan stili doğrudan beklemekle sağlanır.
  await expect(page.locator('.pg-runtime-pill i')).toHaveCSS('background-color', 'rgb(22, 118, 95)');
  // Fikir metin alanı `autoFocus` taşır (StartScreen.tsx:171); tarayıcı bunu
  // sayfa bağlandıktan sonra ayrı bir görev olarak uygular, senkron değildir.
  // `.pg-start-composer`in :focus-within geçişi (styles.css:660) bu yüzden
  // yakalama anıyla yarışır: bazen odak henüz oturmamış (döşeli kenarlık),
  // bazen oturmuş (mor kenarlık) olur. `toBeFocused()` yalnız DOM'un odak
  // sahibini kontrol eder; computed style'ın aynı anda oturduğunun garantisi
  // değildir (deneyle doğrulandı: odak gelmiş olsa da yakalama, henüz eski
  // kenarlığı okuyabiliyordu). Doğrudan hesaplanan `border-color`'ı bekleyerek
  // referans, kullanıcının gerçekte göreceği odaklanmış durumu kaydeder.
  await expect(page.getByLabel('Ne yapmak istiyorsun?')).toBeFocused();
  await expect(page.locator('.pg-start-composer')).toHaveCSS('border-color', 'rgb(154, 141, 235)');
  captured['başlangıç'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'AI ayarları' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  captured['ayarlar-diyaloğu'] = await captureComputedStyles(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await openStudio(page);
  captured['stüdyo-geliştir'] = await captureComputedStyles(page);

  await openExpansionCards(page);
  captured['stüdyo-keşif'] = await captureComputedStyles(page);

  // Kart ekleyince hem .toast hem LiveAnnouncer DOM'a girer; ikisi de
  // ancak bu durumda ölçülebilir.
  //
  // Bildirim window.setTimeout(..., 3200) ile kapanıyor (Workspace.tsx:140).
  // 233 elemanlık bir hesaplanmış-stil taraması yüklü bir CI işçisinde bu
  // 3.2 saniyelik pencereyi aşabilir; taramanın ortasında bildirim kaybolursa
  // test, gerçek bir gerilemeyle ayırt edilemeyen sahte bir eleman-sayısı
  // farkıyla düşer. Saat burada dondurulur ki zamanlayıcı gerçek geçen
  // süreden tamamen bağımsız olsun; tarama bittikten sonra saat kasıtlı
  // olarak 3300ms ileri alınarak bildirim deterministik biçimde kapatılır.
  // pauseAt verilen ana ileri sarar; geriye saramaz. Node'un `new Date()`
  // degeri burada yaris yaratiyordu: damga Node'da uretilip CDP uzerinden
  // tarayiciya varana dek tarayicinin saati o ani gecebiliyor ve cagri
  // "Cannot fast-forward to the past" ile dusuyordu. Damgayi sayfanin kendi
  // saatinden okuyup bir saniye pay birakmak yarisi kapatir; ileri sarilan bu
  // pencerede daha hicbir bildirim zamanlayicisi kurulmus degil.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole('region', { name: 'Keşif panosu' })
    .locator('.pg-expansion-card', { hasText: CARDS[0].title })
    .getByRole('button', { name: 'Fikre ekle' }).click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
  captured['toast-ve-duyurucu'] = await captureComputedStyles(page);
  await page.clock.fastForward(3300);
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.clock.resume();

  await page.getByRole('tab', { name: 'Özet' }).click();
  await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
  captured['stüdyo-özet'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'Fikir Özeti', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ortak anlayışımızı kontrol et' })).toBeVisible();
  captured['fikir-özeti'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  captured['plan'] = await captureComputedStyles(page);

  // Referans yazımı yalnız açık bayrakla olur. Aksi hâlde "referans yoksa üret
  // ve geç" yolu, hiçbir şey iddia etmeyen bir testtir: referans silindiğinde
  // sessizce yeşile döner ve sözleşmeyi denetlemeyi bırakır.
  if (UPDATE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
    test.info().annotations.push({ type: 'baseline', description: 'referans yazıldı' });
    return;
  }
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(
      `Görsel sözleşme referansı yok: ${BASELINE_PATH}\n`
      + 'Önce şu komutla üret:\n'
      + '  UPDATE_VISUAL_BASELINE=1 node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts'
    );
  }

  const baseline: Record<string, ElementStyle[]> = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  // Kesik ya da bozuk bir referans (örn. `{}`, ya da yarım kalmış bir yazma)
  // yalnızca `Object.entries(baseline)` üzerinden gezilirse sessizce sıfır
  // fark üretip yeşile döner — :161-163'teki yorumun engellemeye çalıştığı
  // çürümenin bir adım ötesi. Anahtar kümeleri birebir eşleşmezse (eksik ya
  // da fazladan ekran) sözleşme adıyla bozuk sayılır ve gürültülü düşer.
  const baselineScreens = Object.keys(baseline).sort();
  const capturedScreens = Object.keys(captured).sort();
  if (baselineScreens.join('|') !== capturedScreens.join('|')) {
    throw new Error(
      'Görsel sözleşme referansı eksik ya da bozuk — ekran kümeleri eşleşmiyor.\n'
      + `Referanstaki ekranlar (${baselineScreens.length}): ${baselineScreens.join(', ') || '(hiçbiri)'}\n`
      + `Yakalanan ekranlar (${capturedScreens.length}): ${capturedScreens.join(', ')}`
    );
  }
  const problems: string[] = [];
  for (const [screen, expectedStyles] of Object.entries(baseline)) {
    const actual = captured[screen];
    if (!actual) {
      problems.push(`${screen}: bu ekran hiç yakalanmadı`);
      continue;
    }
    problems.push(...diffScreen(screen, expectedStyles, actual));
  }
  expect(problems.join('\n'), 'görünüm değişmemeliydi').toBe('');
});
