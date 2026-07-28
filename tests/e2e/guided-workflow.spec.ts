import { test, expect } from '@playwright/test';

test.describe('PromtGen guided production workflow', () => {
  test.beforeEach(async ({ page }) => {
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

  test('short idea remains in the expansion phase and survives reload', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill('S&box içinde at sistemi yapmak istiyorum');
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();

    await expect(page.getByText('AŞAMA 1: FİKİR BÜYÜTÜCÜ')).toBeVisible();
    await expect(page.getByText('Canonical Plan', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Projelerin \(1\)/ })).toBeVisible();
  });

  test('AI settings button opens the real provider dialog', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /AI:/ });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('rich idea opens the discussion engine and persists the selected angle', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Web oyununda oyuncular için sadece yerel çalışan bir binek sistemi yapmak istiyorum; hedef gecikme sorununu çözmek ve güvenli bir API mimarisi kurmak.'
    );
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();

    await expect(page.getByText('FİKİR TARTIŞMA MOTORU')).toBeVisible();
    const compareMode = page.getByRole('radio', { name: /Karşılaştır/ });
    await compareMode.click();
    await expect(compareMode).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.toast').getByText('Tartışma modu Karşılaştır olarak değiştirildi.')).toBeVisible();

    await page.locator('#discovery-direction').fill('Sunucu otoritesi ve sürüş hissi alternatiflerini karşılaştır.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();
    const questionRecord = page.locator('.idea-record').filter({ hasText: 'Açık soru' }).first();
    await expect(questionRecord).toBeVisible();
    await questionRecord.getByRole('button', { name: 'Düzenle / cevapla' }).click();
    await questionRecord.getByLabel('Sorunun cevabı').fill('İlk sürüm sunucu otoriteli ve savaş dışı olacak.');
    await questionRecord.getByRole('button', { name: 'Kaydet' }).click();
    await expect(questionRecord.getByText(/Cevap: İlk sürüm sunucu otoriteli/)).toBeVisible();
    await questionRecord.getByRole('button', { name: 'Kabul' }).click();
    await expect(questionRecord).toHaveClass(/status-accepted/);
  });

  test('a focused discovery answer requires field-by-field approval before changing the interpretation', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin dağınık görevlerini yerel bir web uygulamasında düzenlemek ve ilk sürümde yalnız günlük önceliklerini göstermek istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();

    const question = page.locator('.open-question-list button').filter({ hasText: /kullanıcı|kim/i }).first();
    await expect(question).toBeVisible();
    await question.click();
    await page.locator('#discovery-direction').fill('Her gün AI kodlama araçları kullanan bireysel geliştirici');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();

    const review = page.locator('.discovery-answer-review');
    await expect(review.getByText('Yanıtından çıkarılan değişiklikleri incele')).toBeVisible();
    await expect(review.getByText('Yerel alan eşleyici')).toBeVisible();
    await expect(review.getByRole('button', { name: /alanı sistem yorumuna uygula/ })).toBeDisabled();

    await review.locator('.answer-patch').first().getByRole('button', { name: 'Kabul' }).click();
    await review.locator('.answer-patch').last().getByRole('button', { name: 'Kabul' }).click();
    await review.getByRole('button', { name: '2 alanı sistem yorumuna uygula' }).click();

    await expect(review).toBeHidden();
    await expect(page.locator('.concept-agreement .agreement-primary textarea').nth(1)).toHaveValue('Her gün AI kodlama araçları kullanan bireysel geliştirici');
    await expect(page.locator('.toast')).toContainText(/yanıt alanı sistem yorumuna uygulandı/i);
  });

  test('system interpretation stays draft until MVP scope is completed and explicitly approved', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin dağınık fikirlerini yerel olarak MVP kapsamına ve uygulanabilir görevlere dönüştüren bir web uygulaması yapmak istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();

    const gate = page.locator('.concept-summary-card');
    await expect(gate.getByText('Sistem Yorumu ve MVP Kapsam Kapısı')).toBeVisible();
    await expect(gate.getByText(/doğruluk garantisi değildir/i)).toBeVisible();
    await expect(gate.getByRole('button', { name: /yorum\/kapsam maddesi tamamlanmalı/i })).toBeDisabled();

    await gate.getByLabel('Açık kritik sorular').fill('');
    await gate.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await expect(gate.getByRole('button', { name: 'Yorumu Onayla ve Canonical Planı Başlat' })).toBeEnabled();

    await gate.getByRole('button', { name: 'Yorumu Onayla ve Canonical Planı Başlat' }).click();
    await expect(page.locator('.toast')).toContainText('Canonical plan oluşturuldu');
    await expect(page.getByText('SHAPING AŞAMASI', { exact: true })).toBeVisible();
    await expect(page.getByText('r2', { exact: true }).first()).toBeVisible();

    const requirementGate = page.locator('.requirement-quality');
    await expect(requirementGate.getByText('Gereksinim Kalite Kapısı')).toBeVisible();
    await requirementGate.getByRole('button', { name: 'MVP’den taslak üret' }).click();
    await expect(requirementGate.locator('.requirement-card')).toHaveCount(2);
    await expect(page.getByText('r2', { exact: true }).first()).toBeVisible();

    await requirementGate.locator('.requirement-card').first().getByRole('button', { name: 'Gereksinimi kabul et' }).click();
    await expect(requirementGate.getByText('Görev üretimine hazır')).toBeVisible();
    await expect(page.getByText('r3', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: /Görevler ve Yol Haritası/ }).click();
    await page.getByRole('button', { name: 'Gereksinimlerden görev taslağı üret' }).click();
    await expect(page.getByRole('region', { name: 'Görev planı önizlemesi' })).toContainText('1 görev');
    await page.getByRole('button', { name: 'Taslağı onayla' }).click();
    await expect(requirementGate.getByText(/Must gereksinimlerin görev ve test bağlantıları tamamlandı/)).toBeVisible();

    const readiness = page.locator('.readiness-breakdown');
    await expect(readiness.getByText('READINESS 2.0')).toBeVisible();
    await readiness.locator('summary').click();
    await expect(readiness.getByLabel(/Tamlık \d+\/100/)).toBeVisible();
    await expect(readiness.getByText(/Skor kayıt sayısına değil/)).toBeVisible();

    await page.getByRole('button', { name: 'Finalleştir' }).click();
    const completionGate = page.getByRole('dialog');
    await expect(completionGate.getByText('Plan henüz finalleştirilemez')).toBeVisible();
    await expect(completionGate.getByText(/kritik koşul tamamlanmadı/)).toBeVisible();
    await expect(completionGate.getByRole('button', { name: 'Uyarılarla finalleştir' })).toHaveCount(0);
  });

  test('canonical plan change requires impact preview and explicit approval', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Yerel çalışan bir oyun planlama sistemi geliştirip görev ve kabul testlerini birlikte yönetmek istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();
    await expect(page.getByText('FİKİR TARTIŞMA MOTORU')).toBeVisible();

    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('promtgen-v4', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const projects = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const project = projects[0];
      project.lifecycle.activePhase = 'SHAPING';
      project.decisions.push({
        id: 'e2e-decision',
        title: 'PDF dışa aktarma',
        decision: 'PDF dışa aktarma ilk sürümde kapsam dışı bırakılmıştır.',
        rationale: 'İlk sürüm süresini korumak',
        alternatives: [],
        consequences: [],
        status: 'accepted',
        sourceSuggestionId: '',
        affectedSectionIds: ['scope']
      });
      project.requirements.push({
        id: 'e2e-requirement',
        title: 'Markdown dışa aktarma',
        statement: 'Plan Markdown olarak dışa aktarılmalı.',
        kind: 'functional',
        priority: 'must',
        acceptanceCriteria: ['Markdown dosyası oluşturulur.'],
        sourceObjectiveIds: [],
        sourceSuggestionIds: [],
        status: 'accepted'
      });
      const tx = db.transaction(['projects', 'checkpoints'], 'readwrite');
      tx.objectStore('projects').put(project);
      tx.objectStore('checkpoints').clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.reload();
    await page.getByRole('button', { name: /Yerel çalışan bir oyun planlama.*standard.*r1.*canlı/ }).click();

    await page.getByRole('button', { name: /Plan değişikliğini analiz et/ }).click();
    await expect(page.getByText(/onayın olmadan plana uygulanmaz/)).toBeVisible();
    await page.locator('#discovery-direction').fill('PDF dışa aktarma desteğini artık ilk sürüme ekle.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();

    const preview = page.locator('.change-impact-card');
    await expect(preview.getByText('CANONICAL DEĞİŞİKLİK ÖNİZLEMESİ')).toBeVisible();
    await expect(preview.getByText(/Henüz plana uygulanmadı/)).toBeVisible();
    await expect(preview.getByRole('button', { name: /çelişki çözülmeli/ })).toBeDisabled();

    const supersede = preview.getByLabel('Eski kararı geçersiz kıl ve yenisiyle değiştir');
    await supersede.click();
    await expect(supersede).toBeChecked();
    await preview.getByRole('button', { name: /Onayla ve r2 oluştur/ }).click();
    await expect(preview).toBeHidden();
    await expect(page.locator('.toast')).toContainText('r2 oluşturuldu');
  });

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`start screen has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('#main-content')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('language selection updates the visible onboarding copy', async ({ page }) => {
    await page.getByLabel('Çıktı dili').selectOption('en');
    await expect(page.getByRole('heading', { name: /Share your idea/ })).toBeVisible();
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
