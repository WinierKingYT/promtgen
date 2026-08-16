import { test, expect, type Page } from '@playwright/test';
import { stubReadyProvider } from './support/provider.js';
import { buildPlanFixture, seedProject } from './support/project-fixture.js';
import {
  advanceToDecisionTurn,
  completeConceptAgreement,
  resolveDecisionTurn,
  runCoachTurn
} from './support/idea-flow.js';

const IDEA = 'Bireysel geliştiricilerin dağınık proje fikirlerini yerel olarak netleştiren sade bir web uygulaması yapmak istiyorum.';

async function startIdea(page: Page, idea = IDEA) {
  await page.getByLabel('Ne yapmak istiyorsun?').fill(idea);
  await page.getByRole('button', { name: 'Fikri geliştir' }).click();
  await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
}

async function openGuide(page: Page) {
  await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ortak anlayışımızı kontrol et' })).toBeVisible();
}

test.describe('PromtGen idea studio production workflow', () => {
  test.beforeEach(async ({ page }) => {
    await stubReadyProvider(page);
    await page.goto('/');
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('promtgen-v4');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  test('plan asamasi kilitliyken nedenini soyler ve kopya panel icermez', async ({ page }) => {
    await startIdea(page);
    const planButton = page.getByRole('button', { name: 'Plan', exact: true });

    // Kilit bir kontrol durumu değil, içerik: düğme ETKİN kalır. `disabled`
    // olsa klavyeyle odaklanamaz ve nedeni duyurulmazdı; `aria-disabled` olsa
    // ekran okuyucuya "devre dışı" derdi — oysa tıklamak çalışıyor ve nedeni
    // öğrenmenin yolu tam da o. Kilit; soluk sınıf, title ve kapı metniyle
    // anlatılıyor.
    await expect(planButton).toBeEnabled();
    await expect(planButton).toHaveClass(/is-locked/);
    await expect(planButton).toHaveAttribute(
      'title',
      'Fikrin sınırlarını Ortak Anlayış aşamasında onayladığında açılır.'
    );

    await planButton.click();
    const gate = page.locator('.pg-plan-gate');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('Onayı Ortak Anlayış aşamasında verirsin.');
    // Kapı artık IdeaGuidePanel'i kopyalamıyor: onay paneli tek yerde durur.
    await expect(gate.locator('.idea-guide')).toHaveCount(0);
    // Kapıdan çıkış yolu var ve doğru aşamaya gidiyor.
    await gate.getByRole('button', { name: /Ortak Anlayış'a git/ }).click();
    await expect(page.getByRole('heading', { name: 'Ortak anlayışımızı kontrol et' })).toBeVisible();
  });

  test('ikinci sekme seviyesi kalkti: Ozet Ortak Anlayis`ta, Kesif Fikir`de', async ({ page }) => {
    await startIdea(page);
    // Fikir aşamasında: Keşif tam panel, sekme yok, Özet yok.
    await expect(page.getByRole('tab', { name: 'Keşif' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Özet' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toBeVisible();
    await expect(page.locator('.pg-map-fields')).toHaveCount(0);

    // Ortak Anlayış aşamasında: özet burada, Keşif panosu yok.
    await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
    await expect(page.locator('.pg-map-fields')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toHaveCount(0);
  });

  test('opens a conversation-first studio and preserves it across reload', async ({ page }) => {
    await startIdea(page, 'S&box içinde oyuncuyla bağ kuran bir at sistemi yapmak istiyorum.');
    await expect(page.getByRole('navigation', { name: 'Proje aşamaları' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fikir', exact: true })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('complementary', { name: 'Keşif' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Fikir geliştirme sohbeti' })).toBeVisible();

    await page.reload();
    await page.locator('.portfolio-project-open').first().click();
    await expect(page.getByRole('heading', { name: 'Fikrini birlikte şekillendirelim' })).toBeVisible();
    await expect(page.locator('.pg-original-idea').getByText('S&box içinde oyuncuyla bağ kuran bir at sistemi yapmak istiyorum.')).toBeVisible();
  });

  test('the single contextual action runs a real discovery turn and keeps one active question', async ({ page }) => {
    await startIdea(page, 'Bir uygulama yapmak istiyorum.');
    await expect(page.locator('.pg-coach-focus')).toBeVisible();
    await expect(page.locator('.pg-coach-actions button')).toHaveCount(2);
    const previousMessages = await page.locator('.pg-message').count();
    await page.locator('.pg-coach-actions button').first().click();
    await expect(page.getByRole('status').filter({ hasText: /analiz ediyor/i })).toBeVisible();
    await expect.poll(() => page.locator('.pg-message').count()).toBeGreaterThan(previousMessages);
    await expect(page.locator('.pg-coach-focus')).toHaveCount(1);
    await expect(page.locator('.pg-coach-actions button')).toHaveCount(2);
    await expect(page.locator('.pg-focused-question b')).toHaveText(/MVP.nin çözeceği tek kritik sorun/i);
  });

  test('one explicit choice can be committed while lower-priority proposals are deferred', async ({ page }) => {
    await startIdea(page);
    // Karar kartları ancak problem, kullanıcı ve değer netleştikten sonra çıkar.
    await advanceToDecisionTurn(page);
    const card = page.locator('.pg-decision-card');
    await card.getByRole('button', { name: 'Bu yönden ilerle', exact: true }).click();
    const apply = page.getByRole('button', { name: /Seçtiğim yönü fikre işle/ });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(page.locator('.toast')).toContainText('fikir kararları kaydedildi');
    await expect(page.getByText('Bir yön seçelim')).toHaveCount(0);
  });

  test('a focused answer is reviewed inline while the next question stays visible in the same turn', async ({ page }) => {
    await startIdea(page, 'Bir uygulama yapmak istiyorum.');
    await expect(page.locator('.pg-coach-focus')).toBeVisible();
    await expect(page.getByText('Şu an yanıtladığın soru')).toBeVisible();
    await page.getByLabel('Fikir sohbeti mesajı').fill('Problem: Bireysel geliştiriciler projeye başlamadan önce kapsamı ve kararları netleştiremiyor.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();

    const review = page.locator('.discovery-answer-review');
    await expect(review.getByText('Yanıtından çıkarılan değişiklikleri incele')).toBeVisible();
    // Alan incelemesiyle birlikte sıradaki soru/aksiyonlar da aynı anda görünür — ayrı bir moda geçilmez.
    // Bu yanıt sonrasında beklemede kritik kararlar oluştuğu için "sıradaki" panel karar kartı
    // destesi (.pg-decision-deck) olarak görünür; bekleyen kritik karar yokken .pg-coach-focus
    // görünür. Her iki durumda da incelemeyle birlikte, onu gizlemeden, kardeş olarak render edilir.
    const nextStepPanel = page.locator('.pg-coach-focus, .pg-decision-deck');
    await expect(nextStepPanel).toBeVisible();

    const patches = review.locator('.answer-patch');
    const patchCount = await patches.count();
    expect(patchCount).toBeGreaterThan(0);
    for (let index = 0; index < patchCount; index += 1) {
      await patches.nth(index).getByRole('button', { name: 'Kabul', exact: true }).click();
    }
    await review.getByRole('button', { name: /alanı sistem yorumuna uygula/ }).click();
    await expect(review).toBeHidden();
    await expect(nextStepPanel).toBeVisible();
    await expect(page.locator('.toast')).toContainText(/alan fikir özetine işlendi/);
  });

  test('guide and plan are separate, approval-gated destinations', async ({ page }) => {
    await startIdea(page);
    await advanceToDecisionTurn(page);
    await resolveDecisionTurn(page);
    await openGuide(page);
    await expect(page.getByText('FİKİR ÖZETİ · ONAY BEKLİYOR', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fikir özetini indir' })).toBeVisible();

    // Alanlar boşken plana geçiş kilitlidir; sistem onları doldurmaz.
    await expect(page.getByRole('button', { name: 'Dönüşümü önizle' })).toBeDisabled();
    await completeConceptAgreement(page);
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    const preview = page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' });
    await expect(preview).toContainText('Gereksinim taslağı');
    await preview.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();

    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Plan bölümleri' })).toBeVisible();
  });

  test('bolum yeniden uretimi editorde, senaryolar baglam sutununda', async ({ page }) => {
    await startIdea(page);
    await advanceToDecisionTurn(page);
    await resolveDecisionTurn(page);
    await openGuide(page);
    await completeConceptAgreement(page);
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    const preview = page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' });
    await expect(preview).toContainText('Gereksinim taslağı');
    await preview.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();

    // Yeni yerlerinde — açılır açılmadan görünürler.
    await expect(page.locator('.pg-plan-editor .section-regeneration')).toBeVisible();
    await expect(page.locator('.pg-plan-context .scenario-panel')).toBeVisible();

    // Her panel taşımadığı sütunda da yok — "iki yerde durmaz" iddiası canlı
    // koordinatlara bağlı kalsın diye, silinen details.pg-advanced-tools'a
    // değil karşı sütuna bakar.
    await expect(page.locator('.pg-plan-context .section-regeneration')).toHaveCount(0);
    await expect(page.locator('.pg-plan-editor .scenario-panel')).toHaveCount(0);

    // Eski yerinde yok — açılır (details.pg-advanced-tools) Task 7 ile
    // tamamen silindi, son sakini StorageHealthPanel de ayarlar diyaloğuna
    // taşındı.
    await expect(page.locator('details.pg-advanced-tools')).toHaveCount(0);
  });

  test('izlenebilirlik ve kod hizalamasi bos durumda gorunmez', async ({ page }) => {
    await startIdea(page);
    await advanceToDecisionTurn(page);
    await resolveDecisionTurn(page);
    await openGuide(page);
    await completeConceptAgreement(page);
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    const preview = page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' });
    await expect(preview).toContainText('Gereksinim taslağı');
    await preview.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();

    // Fikstür projesi yalnız fikir sohbeti -> onay -> dönüşüm akışından geçer;
    // bu akış ne trace link/requirementId bağlantısı (tasks ve testCases boş
    // kalır) ne de taranmış bir proje envanteri üretir. İkisi de bağlam
    // sütununda görünmez.
    await expect(page.locator('.pg-plan-context .trace-map')).toHaveCount(0);
    await expect(page.locator('.pg-plan-context .plan-code-alignment')).toHaveCount(0);

    // Eski yerinde de yoklar — details.pg-advanced-tools Task 7 ile tamamen
    // silindi (son sakini StorageHealthPanel ayarlar diyaloğuna taşındı).
    await expect(page.locator('details.pg-advanced-tools')).toHaveCount(0);
  });

  // Yukarıdaki test yalnız olumsuz yarıyı kanıtlıyordu: koşul sağlanmayınca
  // panel yok. Ama asıl risk bunun tersiydi — koşul yanlış yazılsaydı panel
  // hata vermez, sessizce hiç görünmezdi ve hiçbir test bunu yakalamazdı.
  // Akış trace link ya da envanter üretmediği için o durum ancak fikstür
  // tohumlayarak kurulabiliyor (bkz. support/project-fixture.ts).
  test('izlenebilirlik ve kod hizalamasi verisi olunca gorunur', async ({ page }) => {
    await stubReadyProvider(page);
    await seedProject(page, buildPlanFixture({ withTraceLink: true, withInventory: true }));
    await page.goto('/');

    await page.locator('.portfolio-project-open').first().click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();

    await expect(page.locator('.pg-plan-context .trace-map')).toBeVisible();
    await expect(page.locator('.pg-plan-context .plan-code-alignment')).toBeVisible();
  });

  // Aynı fikstür, tek fark koşulların kapalı olması. Bu çift, panellerin
  // gerçekten koşula bağlı olduğunu kanıtlar: yukarıdaki testte görünüp
  // burada görünmüyorlarsa bağlantı doğru kurulmuş demektir.
  test('ayni fikstur veri olmadan panelleri gostermez', async ({ page }) => {
    await stubReadyProvider(page);
    await seedProject(page, buildPlanFixture());
    await page.goto('/');

    await page.locator('.portfolio-project-open').first().click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();

    await expect(page.locator('.pg-plan-context .trace-map')).toHaveCount(0);
    await expect(page.locator('.pg-plan-context .plan-code-alignment')).toHaveCount(0);
    // Bağlam sütunu yine de render ediliyor — paneller kayboldu, sütun değil.
    await expect(page.locator('.pg-plan-context .scenario-panel')).toBeVisible();
  });

  test('depolama sagligi ayarlar diyalogunda, planda degil', async ({ page }) => {
    await startIdea(page);
    await advanceToDecisionTurn(page);
    await resolveDecisionTurn(page);
    await openGuide(page);
    await completeConceptAgreement(page);
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    const preview = page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' });
    await expect(preview).toContainText('Gereksinim taslağı');
    await preview.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.getByRole('heading', { name: 'Yaşayan plan' })).toBeVisible();

    // Depolama sağlığı artık plan bağlamının parçası değil — ne bağlam
    // sütununda ne de eski açılırda (details.pg-advanced-tools Task 7 ile
    // tamamen silindi).
    await expect(page.locator('.pg-plan-context .storage-health-panel')).toHaveCount(0);
    await expect(page.locator('details.pg-advanced-tools')).toHaveCount(0);

    // Ayarlar diyaloğu iki yerden açılabiliyor: proje yokken StartScreen'den
    // (App.tsx — depolama sağlığı orada anlamsız, proje yok) ve stüdyodan
    // ('Ayarlar' düğmesi, IdeaStudioPrimitives.tsx:74 — Workspace.tsx'in
    // diyaloğu, proje burada var). "Planda değil" iddiası ancak plan
    // görünümü zaten açıkken, projeli diyalogtan doğrulanınca anlamlı olur;
    // bu yüzden StartScreen'in 'AI ayarları' düğmesi değil, buradaki
    // 'Ayarlar' düğmesi kullanılıyor.
    await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
    await expect(page.getByRole('dialog').locator('.storage-health-panel')).toBeVisible();
  });

  test('idea document revisions remain comparable and restore as a new revision', async ({ page }) => {
    await startIdea(page);
    await runCoachTurn(page);
    await openGuide(page);
    // Kaydet düğmesi ancak tüm yorum alanları doluyken açılır.
    await completeConceptAgreement(page);

    const history = page.locator('.idea-history');
    const versionCount = async () =>
      Number((await history.locator('summary small').textContent())?.match(/\d+/)?.[0] ?? 0);
    const beforeEdit = await versionCount();
    expect(beforeEdit).toBeGreaterThan(0);

    const summary = page.getByLabel('Sistem yorumu');
    const original = await summary.inputValue();
    await summary.fill('Düzenlenmiş fikir belgesi özeti.');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await expect.poll(versionCount).toBe(beforeEdit + 1);

    await history.locator('summary').click();
    // Doldurulmuş içeriği taşıyan sürüm; r1 alanlar dolmadan önceki hâldir.
    // Etiket "r2Fikir belgesi düzenlendi…" biçiminde bitişik yazılır.
    await history.locator('.idea-history-list button')
      .filter({ hasText: new RegExp(`^r${beforeEdit}(?!\\d)`) })
      .first()
      .click();
    await history.getByRole('button', { name: 'Bu sürümü geri yükle' }).click();
    await history.getByRole('button', { name: 'Geri yükle', exact: true }).click();
    // Geri yükleme üzerine yazmaz: eski içerik döner, geçmiş bir sürüm daha uzar.
    await expect(summary).toHaveValue(original);
    await expect.poll(versionCount).toBe(beforeEdit + 2);
  });

  test('project lifecycle controls remain available from the focused start page', async ({ page }) => {
    await startIdea(page);
    await page.getByRole('button', { name: 'Başlangıca dön' }).click();
    await page.locator('.portfolio-project-open').first().hover();
    const archive = page.getByRole('button', { name: /projesini arşivle$/ });
    await expect(archive).toBeVisible();
    await archive.click();
    await page.getByRole('button', { name: /projesini arşivden çıkar$/ }).click();
    await page.getByRole('button', { name: /projesini kalıcı sil$/ }).click();
    const dialog = page.getByRole('dialog', { name: /kalıcı olarak silinsin mi/i });
    await expect(dialog).toContainText('checkpoint');
    await dialog.getByRole('button', { name: 'Kalıcı sil', exact: true }).click();
    await expect(page.getByText('İlk fikrin burada saklanacak.')).toBeVisible();
  });

  test('settings open from the real studio sidebar and restore focus', async ({ page }) => {
    await startIdea(page);
    const trigger = page.getByRole('button', { name: 'Ayarlar', exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`start screen has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('#main-content')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('the idea studio remains usable without horizontal overflow across layouts', async ({ page }) => {
    await startIdea(page);
    for (const width of [375, 768, 1180, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px workspace overflow`).toBeLessThanOrEqual(1);
      await expect(page.getByLabel('Fikir sohbeti mesajı')).toBeVisible();
    }
  });

  test('language selection updates the visible onboarding copy', async ({ page }) => {
    await page.getByRole('button', { name: 'TR' }).click();
    await expect(page.getByRole('heading', { name: 'Start with the idea, not the form.' })).toBeVisible();
    await expect(page.getByLabel('What do you want to build?')).toBeVisible();
  });

  test('skip link and keyboard focus expose the primary task', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: 'Ana içeriğe geç' });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#idea-input')).toBeFocused();
  });
});

