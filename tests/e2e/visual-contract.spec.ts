import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureComputedStyles,
  diffScreen,
  type ElementStyle
} from './support/visual-contract.js';
import { stubExpansionProvider, type StubbedExpansionCard } from './support/provider.js';
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
  const board = page.getByRole('region', { name: 'Keşif panosu' });
  await expect(board).toBeVisible();
  await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
  await expect(board.locator('.pg-expansion-card', { hasText: CARDS[0].title })).toBeVisible();
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
  await expect(board.getByRole('button', { name: 'Yenile', exact: true })).toHaveCSS('opacity', '1');
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
  const fikreEkleDugmesi = page.getByRole('region', { name: 'Keşif panosu' })
    .locator('.pg-expansion-card', { hasText: CARDS[0].title })
    .getByRole('button', { name: 'Fikre ekle' });
  await fikreEkleDugmesi.click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
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
  await expect(fikreEkleDugmesi).toHaveCSS('background-color', 'rgb(73, 50, 194)');
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
  // ama tarayıcının buna karşılık gelen hesaplanmış boyamayı (arkaplan/renk/
  // gölge) yeniden hesaplaması aynı anda bitmiyor (deneyle doğrulandı: tam
  // sözleşme koşusunda dört ardışık denemenin dördünde de bu düğme ters
  // yakalandı). Aşağıdaki liste beklemesi yalnız içerik tarafının (özet
  // panelinin) yerleştiğini kanıtlar, düğmenin stilini değil.
  await expect(ortakAnlayisDugmesi).toHaveCSS('background-color', 'rgb(255, 255, 255)');
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
  // sekmenin hesaplanmış rengi burada TEK bekleme.
  await expect(planSekmesi).toHaveCSS('background-color', 'rgb(255, 255, 255)');
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
  captured['karar-destesi'] = await captureComputedStyles(page);
  await resolveDecisionTurn(page);

  const ortakAnlayisDugmesiIkinci = page.getByRole('button', { name: 'Ortak Anlayış', exact: true });
  await ortakAnlayisDugmesiIkinci.click();
  // `.pg-view-tabs` sekmesinin `is-active` sınıfı, tıklamanın React state
  // güncellemesiyle DOM'a anında yazılıyor — deneyle doğrulandı: tıklamadan
  // hemen sonra `className` zaten doğru (yeni sekmede `is-active`, eskisinde
  // yok) olsa da, tarayıcının o sınıfa karşılık gelen hesaplanmış stili
  // (renk/arkaplan/gölge) yeniden hesaplaması aynı anda bitmiyor; en az bir
  // `requestAnimationFrame`e kadar sekmeler önceki (bazen ters) görünümü
  // koruyabiliyor. Aşağıdaki "Sistem yorumu" beklemesi bu gecikmeyi kapatmaz,
  // çünkü o yalnız içerik tarafının (guide görünümünün) yerleştiğini
  // kanıtlar, sekme çubuğunun stilini değil — ikisi aynı `view` state'inden
  // türese de tarayıcı tarafında ayrı ayrı yerleşiyorlar. Sekmenin kendi
  // hesaplanmış `background-color`'ını doğrudan bekleyerek yakalama, sekme
  // çubuğunun da gerçekten oturmuş halini kaydeder.
  await expect(ortakAnlayisDugmesiIkinci).toHaveCSS('background-color', 'rgb(255, 255, 255)');
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

  // Beş panel (StorageHealthPanel, TraceabilityMap, PlanningScenarioPanel,
  // PlanCodeAlignmentPanel, SectionRegenerationPanel) tek bir `<details>`
  // arkasında ve `LazyFeatureBoundary` ile geç yükleniyor (Workspace.tsx:388).
  // Açılırı tıklamak beşini birden kapsama alır.
  //
  // Bekleme geç yüklemenin *içeriğine* bağlanır, açılırın kendisine değil:
  // `<summary>` tıklanır tıklanmaz `details` açılır ama panellerin modülü
  // henüz inmemiş olabilir; o aralıkta yakalama Suspense yedeğini kaydeder.
  await page.locator('summary', { hasText: 'Gelişmiş plan araçları' }).click();
  // Çapa TraceabilityMap'in arama alanı: aynı lazy paketin içinde ve koşulsuz
  // render ediliyor, yani modülün gerçekten indiğini kanıtlar. StorageHealthPanel'in
  // başlıkları koşullu olduğu için bekleme çapası olmaya uygun değil.
  await expect(page.getByLabel('İzlenebilirlik kaydı ara')).toBeVisible();
  // TraceabilityMap'in beklemesi yalnız KENDİ lazy modülünün indiğini
  // kanıtlar — StorageHealthPanel aynı pakette ama kendi verisini bağımsız
  // çeker (StorageHealthPanel.tsx:63-98, `useEffect(() => { void refresh() })`,
  // kendi zamanlamasında). `refresh()` bitmeden `health` hâlâ `null`dur ve
  // özet satırı `CircleAlert` ikonunu gösterir; bittiğinde `Check`e döner
  // (StorageHealthPanel.tsx:162). Bu ikonlar lucide'de farklı sayıda
  // alt-şekil taşıyor, yani bu yalnız bir boyama farkı değil — eleman
  // SAYISINI değiştiriyor (deneyle doğrulandı: 15 ardışık koşudan birinde
  // `eleman sayısı değişti — beklenen 315, gelen 317` ile düştü). Bu test
  // ortamında masaüstü (Tauri) yolu hiç erişilmez (`isDesktopStorageAvailable()`
  // gerçek bir Tauri çalışma zamanı ister, bu e2e ortamında yok) ve web dalı
  // `refresh()` başarılı olduğunda `health`i koşulsuz `{ok:true,...}` yapıyor
  // — yani bu ortamda ulaşılabilir tek çözülmüş durum "sağlıklı"dır; bu
  // yüzden belirli bir sonucu değil, herhangi bir sonucu bekleyen genel bir
  // işaretçi yerine doğrudan o duruma bakmak güvenli. Seçici özellikle
  // `svg.health-ok`'u hedefler — `.panel-summary` içinde `Database` ve
  // `ChevronDown` ikonları da var; genel bir `svg` seçici üçünü birden
  // eşleştirip strict-mode ihlaline yol açardı.
  await expect(page.locator('.storage-health-panel .panel-summary svg.health-ok')).toBeVisible();
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
