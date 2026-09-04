import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureComputedStyles,
  diffScreen,
  type ElementStyle
} from './support/visual-contract.js';
import { stubExpansionProviderByCategory, type StubbedExpansionCard } from './support/provider.js';
import { expansionCard, expansionSection, waitForSettledSections } from './support/expansion-board.js';
import { advanceToDecisionTurn, completeConceptAgreement, resolveDecisionTurn } from './support/idea-flow.js';

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
    deliveryHorizon: 'core'
  },
  {
    id: 'vc-2',
    title: 'Kaza noktalarını anonim toplayan bir izin akışı',
    description: 'Konum paylaşımı için ayrı ve geri alınabilir bir izin sorulsun.',
    kind: 'decision',
    effort: 'medium',
    impact: 'medium',
    deliveryHorizon: 'later'
  },
  {
    id: 'vc-3',
    title: 'Veri silme isteğini tek ekrandan tamamla',
    description: 'Kullanıcı tüm sürüş verisini tek adımda silebilsin.',
    kind: 'feature',
    effort: 'medium',
    impact: 'high',
    deliveryHorizon: 'core'
  }
];

/**
 * Arka plan doldurma altı kategoriyi hazırlıyor (pencere tabanı BACKGROUND_PREFETCH_FLOOR,
 * expansion-prefetch.ts) ve bu kategoriler ARTIK kendi bölümleriyle ekrana
 * geliyor. Fikre özel eksen bu fikstürde üretilemiyor (idea-axes çağrısı
 * düşürülüyor), bu yüzden sayı tam olarak altıdır.
 */
const SETTLED_SECTIONS = 6;
/**
 * Sahte sağlayıcı kategori BAŞINA ayrı liste döndürür; bu başlık kendi
 * kartlarını taşır. Bütün başlıklara aynı listeyi vermek artık ölçülemez bir
 * ekran üretirdi: pano bölümler arası tekrarları eliyor (bkz.
 * expansion-section-dedup.ts) ve kartlar yalnız ilk bölümde kalırdı.
 */
/**
 * Kartların yazıldığı bölüm; ekranın ölçülen hâli bu chip'e tıklanmış hâlidir.
 * Sunum sırası (fikre özel → alana özel → genel) devreye girdikten sonra
 * `Güven ve gizlilik` arka plan sınırının DIŞINDA kaldı: ona tıklamak sınırın
 * dışından YEDİNCİ bir bölüm doğuruyor ve bu ekranın eleman sayısını
 * sözleşmeden koparıyordu. Bu yüzden sınırın İÇİNDEKİ bir genel kategori
 * seçilir — sıradaki yeri (4.) ve dolayısıyla ölçülen yapı aynı kalır.
 */
const CARD_SECTION = 'Kullanıcı ve ilk deneyim';

async function openStudio(page: Page) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(IDEA);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
  // Bölümler arka planda BİRER BİRER doluyor: doldukça DOM büyüyor ve
  // yakalama bu büyümenin ortasına denk gelirse referans hiçbir zaman
  // tekrarlanabilir olmaz. Başlığın görünmesi yalnız sayfanın açıldığını
  // kanıtlar, panonun oturduğunu değil -- bu yüzden ayrıca beklenir.
  await waitForSettledSections(page, SETTLED_SECTIONS);
  // `data-ready="ready"` yalnız bölümün İÇERİĞİNİN geldiğini kanıtlar; bölüm
  // başlığındaki "Yenile" düğmesinin `disabled={loading}` durumunun hesaplanmış
  // karşılığı (`:disabled` → `opacity:.45`, styles.css:152) bir kare geriden
  // gelebiliyor. Bu, `openExpansionCards`taki aynı yarışın bu ekrandaki eşi --
  // orada tek bir bölüm için bekleniyordu, burada hiç beklenmiyordu ve
  // "stüdyo-geliştir" ekranı bu yüzden ara sıra soluk bir düğme kaydediyordu
  // (deneyle doğrulandı: "Para modeli" bölümünün "Yenile" düğmesi yaklaşık her
  // 14 koşuda bir .45 opaklıkta yakalanıyordu).
  //
  // Tek bir düğme değil HEPSİ beklenir: hangi bölümün boyaması geriden gelir,
  // arka plan doldurma sırasına bağlı olduğu için koşudan koşuya değişir.
  // Önce sayı doğrulanır -- eşleşme boş kalırsa `every` boş dizide `true`
  // döner ve bekleme sessizce anlamsızlaşırdı.
  const yenileDugmeleri = page.getByRole('region', { name: 'Keşif panosu' })
    .getByRole('button', { name: 'Yenile', exact: true });
  await expect(yenileDugmeleri).toHaveCount(SETTLED_SECTIONS);
  await expect
    .poll(() => yenileDugmeleri.evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === '1')))
    .toBe(true);
}

async function openExpansionCards(page: Page) {
  const board = page.getByRole('region', { name: 'Keşif panosu' });
  await expect(board).toBeVisible();
  await board.getByRole('button', { name: CARD_SECTION }).click();
  // Aynı sahte kart listesi altı bölümde birden duruyor; kart iddiası bu
  // yüzden bölümle sınırlandırıldı (strict mod ihlali olmasın diye değil --
  // ölçülen ekranın hangi bölümü gösterdiği belirsiz kalmasın diye).
  await expect(expansionCard(page, CARD_SECTION, CARDS[0].title)).toBeVisible();
  // Panel başlığındaki "Yenile" düğmesi `disabled={loading}` taşır
  // (IdeaExpansionBoard.tsx:119); `loading` kartlarla aynı render'da false'a
  // döner ama `:disabled`in `opacity:.45` kuralı (styles.css:152) bunun
  // hesaplanmış karşılığıdır — DOM özelliği doğru olsa da tarayıcının bu
  // boyama değerini yeniden hesaplaması, ana iş parçacığı bu testteki gibi
  // art arda büyük DOM taramalarıyla meşgulken bir adım geriden gelebilir
  // (tam sözleşme koşusunda deneyle doğrulandı: kart görünür olsa da düğme
  // hâlâ soluk yakalanabiliyordu). Kartın görünürlüğü yalnız içeriğin
  // geldiğini kanıtlar, düğmenin oturmuş opaklığını değil; bu yüzden ikisi
  // ayrı ayrı beklenir.
  await expect(expansionSection(page, CARD_SECTION).getByRole('button', { name: 'Yenile', exact: true }))
    .toHaveCSS('opacity', '1');
  // Tıklanan chip'in `is-active` boyaması da AYRI beklenir; bir üstteki
  // "Yenile" bekleyişiyle aynı sınıftan bir yarış, ama farklı bir eleman.
  //
  // Chip'ler `transition: all` taşıyor (styles.css) ve prefers-reduced-motion
  // altında süre .01ms'ye iniyor. `getComputedStyle` bir geçişin BAŞLADIĞI
  // karede hâlâ BAŞLANGIÇ değerini döndürür: yani sınıf DOM'da olsa bile
  // ölçüm "pasif chip" değerlerini (beyaz zemin, sönük yazı) yakalayabilir.
  //
  // Bu, arka plan doldurma (expansion-prefetch.ts) devreye girince görünür
  // oldu: doldurma sayesinde tıklanan kategori çoğu zaman ÖNBELLEKTEN
  // dönüyor, kartlar ve "Yenile" aynı karede oturuyor ve yakalama tam o
  // kareye denk geliyor. Yavaş yolda geçiş çoktan bitmiş olduğu için aynı
  // yarış hiç görünmüyordu. Referans (baseline) doğru; ölçüm anı erkendi.
  await expect(board.getByRole('button', { name: CARD_SECTION }))
    .toHaveCSS('background-color', 'rgb(189, 107, 69)');
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
  await stubExpansionProviderByCategory(page, { [CARD_SECTION]: CARDS });
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
  await expect(page.locator('.pg-runtime-pill i')).toHaveCSS('background-color', 'rgb(143, 174, 132)');
  // Fikir metin alanı `autoFocus` taşır (StartScreen.tsx:171); tarayıcı bunu
  // sayfa bağlandıktan sonra ayrı bir görev olarak uygular, senkron değildir.
  // `.pg-start-composer`in :focus-within geçişi (styles.css:660) bu yüzden
  // yakalama anıyla yarışır: bazen odak henüz oturmamış (döşeli kenarlık),
  // bazen oturmuş (bakır kenarlık) olur. `toBeFocused()` yalnız DOM'un odak
  // sahibini kontrol eder; computed style'ın aynı anda oturduğunun garantisi
  // değildir (deneyle doğrulandı: odak gelmiş olsa da yakalama, henüz eski
  // kenarlığı okuyabiliyordu). Doğrudan hesaplanan `border-color`'ı bekleyerek
  // referans, kullanıcının gerçekte göreceği odaklanmış durumu kaydeder.
  await expect(page.getByLabel('Ne yapmak istiyorsun?')).toBeFocused();
  await expect(page.locator('.pg-start-composer')).toHaveCSS('border-color', 'rgb(189, 107, 69)');
  captured['başlangıç'] = await captureComputedStyles(page);

  const ayarlarDugmesi = page.getByRole('button', { name: 'AI ayarları' });
  await ayarlarDugmesi.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Bu düğme, dosyadaki diğer hover örneklerinin TERSİ: tıklama anında
  // `.pg-onboarding-settings:hover` (styles.css, hover zemini `var(--pg-surface)`) uygulanır ama
  // açılan diyaloğun örtüsü imleci düğmeden koparır, hover GERİ ALINIR ve
  // oturmuş durum yeniden saydamdır. Bekleme yokken yakalama bu iki an
  // arasında yarışıyordu — deneyle doğrulandı: aynı kod tabanında bir koşu
  // `rgb(230,233,229)`, öbürü `rgba(0,0,0,0)` kaydetti; referans bu yüzden
  // tekrarlanabilir değildi. Diyaloğun görünürlüğü yalnız içerik tarafının
  // geldiğini kanıtlar, arkadaki düğmenin hover'ının çözüldüğünü değil.
  await expect(ayarlarDugmesi).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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
  const fikreEkleDugmesi = expansionCard(page, CARD_SECTION, CARDS[0].title)
    .getByRole('button', { name: 'Fikre ekle' });
  await fikreEkleDugmesi.click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
  // Kart eklemek artık ÜRETİMİ TETİKLEMİYOR: önbellek anahtarı fikrin
  // kendisine dayanıyor (idea-expansion-service.ts `expansionGenerationKey`),
  // kart kabulü onu kaydırmıyor ve arka plan sırası yerinde kalıyor. Eklenen
  // kart yine her bölümden düşüyor, ama üretimle değil render'da
  // (`dropCardsAlreadyInIdea`). Bekleme yine de korunur: bu noktada sıra
  // hâlâ dolmakta olabilir ve yakalama oturmuş bir ekranda yapılmalı.
  await page.mouse.move(4, 4);
  await waitForSettledSections(page, SETTLED_SECTIONS);
  // GEÇİŞ ARTEFAKTI (çözüldü): tıklanan kart DOM'dan düşünce ALTINDAKİ kart
  // imlecin konumuna kayıyor ve bir an `:hover` alıyor; imleç (4,4)'e
  // çekildiğinde hover'dan çıkıyor ama `transition:all` geri dönüşü kendi
  // başına BİTEMİYOR, çünkü `page.clock.pauseAt` sayfanın saatini dondurdu.
  // Eskiden bu eleman ara renkte yakalanıyor ve referansa geçici hover değeri
  // (`#CC744B`) yazılıyordu; geçişin ne kadarının tamamlandığı koşudan koşuya
  // değiştiği için referans yaklaşık dört koşuda bir tutmuyordu. Artık
  // yakalamadan hemen önce bekleyen geçişler açıkça bitiriliyor (aşağıya
  // bakın), böylece geri dönüş tamamlanıyor ve referans dinlenme rengini
  // (`#7D7268`) kaydediyor. Bu bir tema kayması DEĞİL -- styles.css'e
  // dokunulmadı; düzeltilen şey ölçüm ANI, temanın kendisi değil.
  // Tıklama, imleci gerçekten bu düğmenin üstünde bırakıyor, bu yüzden
  // `:hover` kuralı (styles.css:549, `.pg-expansion-card footer button:hover`)
  // eninde sonunda uygulanıyor — fare orada kaldığı sürece bu, geçici değil
  // kalıcı/oturmuş durumdur. Ama tarayıcının bu hover'ı hesaplanmış boyamaya
  // yansıtması, `.pg-view-tabs`teki sınıf/boyama gecikmesiyle aynı ailede:
  // durum (burada native `:hover` sözde-sınıfı, orada React'in yazdığı sınıf)
  // doğru olsa da yeniden boyama bir adım geride kalabiliyor — özellikle ana
  // iş parçacığı bu testteki gibi art arda büyük hesaplanmış-stil taramalarıyla
  // meşgulken (gerçek sözleşme koşusunda deneyle doğrulandı: referans hover
  // rengini beklerken bazı koşular düğmeyi hâlâ hover-öncesi renginde
  // yakalıyordu). Toast/duyurucu görünürlüğü yalnız bildirim tarafının
  // geldiğini kanıtlar, düğmenin hover boyamasının oturduğunu değil.
  // Eski çapa TIKLANAN düğmenin hover rengini bekliyordu. O düğme artık
  // yakalama anında DOM'da değil: eklenen kart her bölümden düşüyor
  // (yukarıdaki yorum). Yerine geçen çapa aynı işi daha
  // sağlam yapıyor -- imleç bilinen ve etkisiz bir noktaya (4,4) çekildiği
  // için hiçbir eleman hover'da değil ve düğmelerin OTURMUŞ, hover'sız
  // rengi bekleniyor. Sinyal kaybı yok: hover kuralının kendisi zaten
  // "stüdyo-keşif" ekranında ölçülmüyordu, ölçülen şey boyamanın oturduğuydu.
  await expect(expansionCard(page, CARD_SECTION, CARDS[1].title).getByRole('button', { name: 'Fikre ekle' }))
    .toHaveCSS('background-color', 'rgb(189, 107, 69)');
  // Yukarıdaki hover geri dönüşünün BİTMESİ burada zorlanır.
  //
  // `page.clock` yalnız JS tarafını (Date, setTimeout, rAF) sahteler;
  // `document.timeline`i İLERLETMEZ. Saat `pauseAt` ile durunca hover'dan
  // çıkışın başlattığı CSS geçişi `currentTime:0`da "running" olarak asılı
  // kalıyor ve `getComputedStyle` geçişin BAŞLANGIÇ değerini -- yani terk
  // edilen hover rengini (`--pg-accent-text`, #CC744B) -- döndürmeye devam
  // ediyor. Deneyle doğrulandı: yakalama anında `:hover` zincirinde hiçbir
  // `summary` yok (imleç (4,4)'te, kenar çubuğunun üstünde) ama
  // `document.getAnimations()` iki adet `CSSTransition`/`color` gösteriyor,
  // ikisi de `currentTime:0`. Bu yüzden `page.clock.runFor(...)` bu geçişi
  // BİTİREMEZ -- sahte saati ne kadar ileri sararsanız sarın geçiş kıpırdamaz.
  //
  // Geçişleri doğrudan bitirmek, referansa hangi anın yazılacağını
  // deterministik kılar: her geçiş kendi SON değerine oturur, yani ekranın
  // dinlenme hâli (`--pg-faint`, #7D7268) kaydedilir. Sonsuz süreli
  // animasyonlarda `finish()` istisna atar, o yüzden tek tek korunur.
  await page.evaluate(() => {
    for (const animasyon of document.getAnimations()) {
      try { animasyon.finish(); } catch { /* sonsuz animasyon bitirilemez, atlanır */ }
    }
  });
  captured['toast-ve-duyurucu'] = await captureComputedStyles(page);
  await page.clock.fastForward(3300);
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.clock.resume();

  // Özet artık kendi aşamasında (Ortak Anlayış) durur; içeriğe gitmek bir
  // sekme değil, tam bir aşama geçişidir — aynı dış gezinme düğmesiyle
  // (`.pg-view-tabs`, IdeaStudioHeader) yapılır.
  const ortakAnlayisDugmesi = page.getByRole('button', { name: 'Ortak Anlayış', exact: true });
  await ortakAnlayisDugmesi.click();
  await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
  // `.pg-view-tabs button.is-active` (styles.css:545): tıklamanın React
  // state güncellemesiyle `aria-current` özniteliği DOM'a anında yazılıyor,
  // ama tarayıcının buna karşılık gelen hesaplanmış boyamayı (aktif sekmenin
  // ALTINDAKİ bakır çizgi — sekme kabı Alt Proje D2'de kaldırıldı, işaret
  // artık zemin değil border-bottom-color) yeniden hesaplaması aynı anda
  // bitmiyor (deneyle doğrulandı: tam
  // sözleşme koşusunda dört ardışık denemenin dördünde de bu düğme ters
  // yakalandı). Aşağıdaki liste beklemesi yalnız içerik tarafının (özet
  // panelinin) yerleştiğini kanıtlar, düğmenin stilini değil.
  await expect(ortakAnlayisDugmesi).toHaveCSS('border-bottom-color', 'rgb(189, 107, 69)');
  captured['fikir-özeti'] = await captureComputedStyles(page);

  // `stüdyo-özet` ekranı Alt Proje C'de silindi: Özet içeriği Ortak Anlayış
  // aşamasına taşınınca bu yakalama `fikir-özeti` ile bayt bayt aynı ekranı
  // ölçmeye başladı (ikisi de 89.593 karakter). İkinci tıklama zaten etkin
  // düğmeye gidiyordu, React no-op'a düşüyordu, bekleme hiçbir şeyi
  // korumuyordu. Liste 12 → 11 benzersiz ekrana indi.

  const planSekmesi = page.getByRole('button', { name: 'Plan', exact: true });
  await planSekmesi.click();
  // Bu ekranda tıklamadan sonra hiçbir bekleme yoktu — en kötü durum: aynı
  // `.pg-view-tabs` yarışı burada hiçbir şeyle kapatılmıyordu. Deneyle
  // doğrulandı: tam sözleşme koşusunda dört ardışık denemenin dördünde de
  // sekme, tıklamadan hemen sonra hâlâ önceki (Ortak Anlayış'ın) boyamasını
  // taşıyordu. Bu ekranın kendi içerik tarafı için ayrı bir bekleme yok
  // (Plan görünümü "kapı" ekranı, aşağıdaki yorum bunu açıklıyor) — o yüzden
  // sekmenin hesaplanmış alt çizgi rengi burada TEK bekleme.
  await expect(planSekmesi).toHaveCSS('border-bottom-color', 'rgb(189, 107, 69)');
  captured['plan'] = await captureComputedStyles(page);

  // Yukarıdaki `plan` ekranı planın kendisi değil, "önce fikrin sınırlarını
  // onayla" kapısıdır: canonicalPlanningOpen bir gereksinim/karar/görev ya da
  // sourceIdeaRevisionId ister (Workspace.tsx:131). Yaşayan plan ve arkasındaki
  // araç panelleri bu yüzden bugüne dek hiç ölçülmedi. Kapı, ürünün kendi
  // onay akışıyla açılır — durum doğrudan enjekte edilmez, çünkü sözleşmenin
  // değeri gerçekten render edilen ekranı kaydetmesinden gelir.
  // Kapıyı açmak için önce fikrin kendi akışı yürütülür. Bu üç cevap turu
  // yalnız bir araç değil, başlı başına kapsam: DiscoveryAnswerReview ve
  // karar destesi de ancak burada render ediliyor. Akış eski yakalamalar
  // bittikten sonra koşulur ki onların durumu değişmesin.
  await page.getByRole('button', { name: 'Fikir', exact: true }).click();
  await advanceToDecisionTurn(page);
  // Üç cevap turunun her biri documentRevision'ı artırdı, yani keşif panosu
  // bu ekranda da yeniden doluyor. Aynı gerekçe: yakalama sıranın ortasına
  // denk gelmesin.
  await waitForSettledSections(page, SETTLED_SECTIONS);
  captured['karar-destesi'] = await captureComputedStyles(page);
  await resolveDecisionTurn(page);

  const ortakAnlayisDugmesiIkinci = page.getByRole('button', { name: 'Ortak Anlayış', exact: true });
  await ortakAnlayisDugmesiIkinci.click();
  // `.pg-view-tabs` sekmesinin `is-active` sınıfı, tıklamanın React state
  // güncellemesiyle DOM'a anında yazılıyor — deneyle doğrulandı: tıklamadan
  // hemen sonra `className` zaten doğru (yeni sekmede `is-active`, eskisinde
  // yok) olsa da, tarayıcının o sınıfa karşılık gelen hesaplanmış stili
  // (renk ve alt çizgi) yeniden hesaplaması aynı anda bitmiyor; en az bir
  // `requestAnimationFrame`e kadar sekmeler önceki (bazen ters) görünümü
  // koruyabiliyor. Aşağıdaki "Sistem yorumu" beklemesi bu gecikmeyi kapatmaz,
  // çünkü o yalnız içerik tarafının (guide görünümünün) yerleştiğini
  // kanıtlar, sekme çubuğunun stilini değil — ikisi aynı `view` state'inden
  // türese de tarayıcı tarafında ayrı ayrı yerleşiyorlar. Sekmenin kendi
  // hesaplanmış `background-color`'ını doğrudan bekleyerek yakalama, sekme
  // çubuğunun da gerçekten oturmuş halini kaydeder.
  await expect(ortakAnlayisDugmesiIkinci).toHaveCSS('border-bottom-color', 'rgb(189, 107, 69)');
  await expect(page.getByLabel('Sistem yorumu')).toBeVisible();
  captured['fikir-özeti-düzenleyici'] = await captureComputedStyles(page);
  await completeConceptAgreement(page);
  await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
  const preview = page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' });
  await expect(preview).toContainText('Gereksinim taslağı');
  await preview.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
  await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();
  // Dönüşümün hemen ardından ayrı bir `plan-yaşayan` ekranı yakalanmıyor.
  // Denendi ve bilerek çıkarıldı: o anda bölüm listesi hâlâ yerleşiyor ve
  // etkinlik koşudan koşuya farklı düğmeye düşüyor — beş koşunun üçü, etkin
  // bölümün ikonlarını vurgulu yerine soluk yakaladı. Etkin düğmenin
  // hesaplanmış rengini beklemek de yetmedi; yakalamaya kadar geçen sürede
  // yeniden yerleşiyor.
  //
  // Kayıp yok: aşağıdaki `plan-gelişmiş-araçlar` aynı plan iskeletinin üstüne
  // beş paneli ekleyen bir üst kümedir ve o noktada yerleşme bitmiş oluyor.
  // Bölüm açıkça seçilir ki o ekran da belirli bir bölümle yakalansın.
  const sectionNav = page.getByRole('navigation', { name: 'Plan bölümleri' });
  await sectionNav.getByRole('button').first().click();
  await expect(sectionNav.locator('button.is-active')).toHaveCount(1);

  // Alt Proje C Task 6 ile TraceabilityMap ve PlanCodeAlignmentPanel
  // `<details className="pg-advanced-tools">`ten çıkıp bağlam sütununa
  // taşındı (Workspace.tsx) ve orada yalnız kendi görünürlük koşulları
  // (hasTraceabilityLinks/hasProjectInventory) doğruyken render ediliyor. Bu
  // fikstür projesi ikisini de üretmediği için (bkz. guided-workflow.spec.ts:
  // 'izlenebilirlik ve kod hizalamasi bos durumda gorunmez') o `<details>`te
  // yalnız StorageHealthPanel kalmıştı. Task 7 ile o da açılırdan çıkıp
  // ayarlar diyaloğuna taşındı (ProviderSettingsDialog.tsx) ve `<details
  // className="pg-advanced-tools">` tamamen silindi — artık açılan, tıklanan
  // bir şey yok.
  //
  // Ekran adı (`plan-gelişmiş-araçlar`) bilerek korunuyor: yeniden adlandırma
  // sözleşme referansının tamamını yeniden anlamlandırır ve C'nin
  // ekran-listesi sabitini (11 anahtar) bozar; ad D'de düzeltilir. İçerik
  // artık `pg-plan-context` sütununun tamamı — senaryo laboratuvarı ve (bu
  // fikstürde render edilmeyen) koşullu paneller.
  //
  // Eski bekleme StorageHealthPanel'in KENDİ asenkron `refresh()`ine
  // (StorageHealthPanel.tsx:63-98) ve lucide ikonunun (Check/CircleAlert,
  // farklı alt-şekil sayısı) hangi durumda oturduğuna bağlıydı — panel
  // gittiği için o risk de gitti. Geriye kalan tek her-zaman-render-edilen
  // panel PlanningScenarioPanel (`.scenario-panel`, Workspace.tsx) ve o,
  // StorageHealthPanel'in aksine mount olduktan sonra kendi başına asenkron
  // veri çekmiyor (bkz. PlanningScenarioPanel.tsx — tüm state senkron, proje
  // prop'undan türetiliyor). Riski taşıyan tek şey LazyFeatureBoundary'nin
  // Suspense'i: modül inene kadar yedek (fallback) DOM'da durur, gerçek
  // `.scenario-panel` değil. Aşağıdaki bekleme doğrudan o gerçek içeriği
  // hedefliyor — yedek görünürken geçmez, yalnız modül gerçekten inip
  // içerik yerleşince geçer; bu yüzden sütunu gerçekten "settle" eden çapa
  // budur.
  await expect(page.locator('.pg-plan-context .scenario-panel')).toBeVisible();
  captured['plan-gelişmiş-araçlar'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'Geçmiş' }).click();
  await expect(page.getByRole('heading', { name: "Plan revision'larını karşılaştır" })).toBeVisible();
  captured['revizyon-geçmişi'] = await captureComputedStyles(page);

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
