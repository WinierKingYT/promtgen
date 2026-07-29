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
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

    await expect(page.getByRole('navigation', { name: 'Fikrinle ne yapmak istiyorsun?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Fikri geliştir/ })).toHaveAttribute('aria-current', 'step');

    await page.reload();
    await expect(page.getByRole('heading', { name: /Projelerin \(1\)/ })).toBeVisible();
  });

  test('lets the user keep developing, create a guide, or open the detailed plan', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin günlük işlerini yerel olarak düzenleyen sade bir web uygulaması yapmak istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

    await expect(page.getByRole('heading', { name: 'Fikri konuşarak geliştir' })).toBeVisible();
    await expect(page.getByText(/ÖNERİLEN SONRAKİ ADIM/)).toBeVisible();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    await expect(page.getByRole('heading', { name: /Bireysel geliştiricilerin/ })).toBeVisible();
    await expect(page.getByText(/YAŞAYAN FİKİR BELGESİ/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rehberi indir' })).toBeVisible();

    await page.getByRole('button', { name: /Detaylı planla/ }).click();
    await expect(page.getByLabel('Yaşayan plan')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Dönüşümü önizle' })).toBeDisabled();
    await page.getByLabel('Açık kritik sorular').fill('');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    await expect(page.getByRole('region', { name: 'Plan dönüşümü önizlemesi' })).toContainText('Gereksinim taslağı');
    await page.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.getByText('ÖNERİLEN PLAN DERİNLİĞİ')).toBeVisible();
    await expect(page.getByLabel('Yaşayan plan')).toBeVisible();
    await expect(page.locator('.requirement-card')).toHaveCount(2);
    await expect(page.getByLabel(/Mevcut aşama/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finalleştir' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Markdown' })).toBeHidden();
    await page.getByLabel('Çalışma alanı araçları').click();
    await expect(page.getByRole('button', { name: 'Markdown' })).toBeVisible();
    await page.getByLabel('Çalışma alanı araçları').click();

    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    await page.locator('.concept-agreement .agreement-primary textarea').nth(1).fill('Bağımsız teknik kurucular');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    const alignment = page.locator('.plan-alignment-notice');
    await expect(alignment).toContainText(/PLAN GÜNCEL DEĞİL/);
    await alignment.getByRole('button', { name: 'Etkiyi incele' }).click();
    await expect(page.locator('.change-impact-card')).toContainText(/Fikir belgesi r\d+ değişiklikleri/);
    await page.locator('.change-impact-card').getByRole('button', { name: /Onayla ve r\d+ oluştur/ }).click();
    await expect(alignment).toBeHidden();
  });

  test('AI settings button opens the real provider dialog', async ({ page }) => {
    await page.getByText('Dosya, dil ve AI seçenekleri').click();
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
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

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
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

    const question = page.locator('.open-question-list button').filter({ hasText: /kullanıcı|kim/i }).first();
    await expect(question).toBeVisible();
    await question.click();
    await page.locator('#discovery-direction').fill('Her gün AI kodlama araçları kullanan bireysel geliştirici');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();

    const review = page.locator('.discovery-answer-review');
    await expect(review.getByText('Yanıtından çıkarılan değişiklikleri incele')).toBeVisible();
    await expect(review.getByText('Yerel kural tabanlı alan çıkarımı')).toBeVisible();
    await expect(review.getByRole('button', { name: /alanı sistem yorumuna uygula/ })).toBeDisabled();

    await review.locator('.answer-patch').first().getByRole('button', { name: 'Kabul' }).click();
    await review.locator('.answer-patch').last().getByRole('button', { name: 'Kabul' }).click();
    await review.getByRole('button', { name: '2 alanı sistem yorumuna uygula' }).click();

    await expect(review).toBeHidden();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    await expect(page.locator('.concept-agreement .agreement-primary textarea').nth(1)).toHaveValue('Her gün AI kodlama araçları kullanan bireysel geliştirici');
    await expect(page.locator('.toast')).toContainText(/yanıt alanı sistem yorumuna uygulandı/i);
  });

  test('an ambiguous discovery answer stays outside the plan and keeps the question open', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin görevlerini yerel bir web uygulamasında düzenlemek istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

    const question = page.locator('.open-question-list button').first();
    const questionText = await question.innerText();
    await question.click();
    await page.locator('#discovery-direction').fill('Bilmiyorum, henüz emin değilim.');
    await page.getByRole('button', { name: 'Gönder', exact: true }).click();

    const review = page.locator('.discovery-answer-review');
    await expect(review.getByText('Belirsiz yanıt')).toBeVisible();
    await expect(review.getByText(/Soru açık kaldı/i)).toBeVisible();
    await expect(review.locator('.answer-patch')).toHaveCount(0);
    await expect(review.getByRole('button', { name: /alanı sistem yorumuna uygula/ })).toBeDisabled();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    expect(await page.locator('.concept-agreement .agreement-grid textarea').last().inputValue())
      .toContain(questionText.replace(/^\d+\.\s*/, ''));
  });

  test('system interpretation stays draft until MVP scope is completed and explicitly approved', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin dağınık fikirlerini yerel olarak MVP kapsamına ve uygulanabilir görevlere dönüştüren bir web uygulaması yapmak istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();

    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    const gate = page.locator('.idea-guide');
    await expect(gate.getByText('Projeyi doğru anladık mı?')).toBeVisible();
    await expect(gate.getByText(/doğruluk garantisi değildir/i)).toBeVisible();
    await expect(gate.getByRole('button', { name: 'Dönüşümü önizle' })).toBeDisabled();

    await gate.getByLabel('Açık kritik sorular').fill('');
    await gate.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await gate.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    await gate.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();
    await expect(page.locator('.toast')).toContainText('canonical plana dönüştürüldü');

    const requirementGate = page.locator('.requirement-quality');
    await expect(requirementGate.getByText('Gereksinim Kalite Kapısı')).toBeVisible();
    await expect(requirementGate.locator('.requirement-card')).toHaveCount(2);

    await requirementGate.locator('.requirement-card').first().getByRole('button', { name: 'Gereksinimi kabul et' }).click();
    await expect(requirementGate.getByText('Görev üretimine hazır')).toBeVisible();

    await page.getByRole('button', { name: /Detaylı planla/ }).click();
    const quality = page.locator('.plan-quality');
    await expect(quality).toContainText('Plan kalitesi');
    await quality.locator('summary').first().click();
    const domainPack = quality.locator('.domain-pack-card');
    await expect(domainPack.getByText('Web/SaaS Planlama Paketi')).toBeVisible();
    await expect(domainPack.getByText('KARARLI ADAYI · KURAL PAKETİ')).toBeVisible();
    await domainPack.getByRole('button', { name: 'Paket katkılarını incele' }).click();
    const domainPreview = domainPack.getByRole('region', { name: 'Web SaaS paket aktivasyon önizlemesi' });
    await expect(domainPreview).toContainText('alan sorusu');
    await expect(domainPreview).toContainText('framework veya sağlayıcıyı otomatik seçmez');
    await domainPreview.getByRole('button', { name: 'Paketi onayla' }).click();
    await expect(domainPack).toContainText('readiness, plan incelemesi, görev sözleşmeleri');
    await expect(domainPack.getByRole('button', { name: /Ana web kullanıcı akışı doğrulanmış/ })).toBeVisible();

    await page.getByRole('button', { name: /Görevler ve Yol Haritası/ }).click();
    await page.getByRole('button', { name: 'Gereksinimlerden görev taslağı üret' }).click();
    const taskPreview = page.getByRole('region', { name: 'Görev planı önizlemesi' });
    await expect(taskPreview).toContainText('1 görev');
    await expect(taskPreview).toContainText('TaskContract V2');
    await expect(taskPreview).toContainText('dosya envanteri gerekli');
    await page.getByRole('button', { name: 'Taslağı onayla; dosya kapsamını sonra belirle' }).click();
    const approvedContracts = page.getByRole('region', { name: 'Onaylı görev sözleşmeleri' });
    await expect(approvedContracts).toContainText('1 onaylı TaskContract V2');
    await approvedContracts.locator('summary').first().click();
    await expect(approvedContracts).toContainText('Geri alma');
    await expect(requirementGate.getByText(/Must gereksinimlerin görev ve test bağlantıları tamamlandı/)).toBeVisible();
    await page.getByLabel('Çalışma alanı araçları').click();
    await page.getByRole('button', { name: 'Labs araçları' }).click();
    const alignmentPanel = page.locator('.plan-code-alignment');
    await expect(alignmentPanel).toContainText('Plan–kod uyumluluk kontrolü');
    await expect(alignmentPanel).toContainText('V2 · tavsiye sistemi');
    await alignmentPanel.locator('summary').first().click();
    await expect(alignmentPanel).toContainText(/PromtGen burada kod yazmaz veya dosya değiştirmez/);
    await expect(alignmentPanel).toContainText('Mevcut proje envanteri bulunamadı');
    await alignmentPanel.locator('.alignment-task summary').first().click();
    await expect(alignmentPanel.getByRole('button', { name: /Plan değişikliği öner/ })).toBeVisible();
    await alignmentPanel.getByRole('button', { name: /Plan değişikliği öner/ }).click();
    await expect(page.locator('.toast')).toContainText(/canonical plan değiştirilmedi/);

    const readiness = page.locator('.readiness-breakdown');
    await expect(readiness.getByText('READINESS 3.0')).toBeVisible();
    await readiness.locator('summary').click();
    await expect(readiness.getByLabel(/Tamlık \d+\/100/)).toBeVisible();
    await expect(readiness.getByText(/Skor kayıt sayısına değil/)).toBeVisible();
    await expect(readiness.getByRole('list', { name: 'Önerilen sonraki hazırlık eylemleri' })).toBeVisible();
    await expect(readiness.getByRole('button', { name: /ilgili plan bölümünü aç/ }).first()).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    const workspaceWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(workspaceWidth.scroll).toBeLessThanOrEqual(workspaceWidth.client);

    await page.getByRole('button', { name: 'Finalleştir' }).click();
    const completionGate = page.getByRole('dialog');
    await expect(completionGate.getByText('Plan henüz finalleştirilemez')).toBeVisible();
    await expect(completionGate.getByText(/kritik koşul tamamlanmadı/)).toBeVisible();
    await expect(completionGate.getByRole('button', { name: 'Uyarılarla finalleştir' })).toHaveCount(0);
  });

  test('Backend/API domain pack previews bounded contributions and activates only after approval', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Harici istemcilerin token ile sipariş yazdığı, veritabanı ve webhook kullanan bir REST backend API planlamak istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();
    await page.getByLabel('Açık kritik sorular').fill('');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await page.getByRole('button', { name: /Detaylı planla/ }).click();
    await page.getByRole('button', { name: 'Dönüşümü önizle' }).click();
    await page.getByRole('button', { name: 'Onayla ve plana dönüştür' }).click();

    const quality = page.locator('.plan-quality');
    await quality.locator('summary').first().click();
    const backendPack = quality.locator('.domain-pack-card').filter({ hasText: 'Backend/API Planlama Paketi' });
    await expect(backendPack.getByText('BETA · KURAL PAKETİ')).toBeVisible();
    await expect(backendPack).toContainText('teknoloji seçmez');
    await backendPack.getByRole('button', { name: 'Paket katkılarını incele' }).click();
    const preview = backendPack.getByRole('region', { name: 'Backend API paket aktivasyon önizlemesi' });
    await expect(preview).toContainText('API tüketicileri kim');
    await expect(preview).toContainText(/framework, veritabanı veya bulut sağlayıcısı seçmez/i);
    await preview.getByRole('button', { name: 'Paketi onayla' }).click();
    await expect(page.locator('.toast')).toContainText('Backend/API planlama paketi');
    await expect(backendPack).toContainText('readiness, plan incelemesi, görev sözleşmeleri');
  });

  test('idea document keeps comparable revisions and restores an old version without touching the plan', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Bireysel geliştiricilerin dağınık fikirlerini yerel bir fikir belgesinde netleştiren web uygulaması yapmak istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
    await page.getByRole('button', { name: /Rehber oluştur/ }).click();

    const summary = page.getByLabel('Sistem yorumu');
    const originalSummary = await summary.inputValue();
    await page.getByLabel('Açık kritik sorular').fill('');
    await summary.fill('Düzenlenen birinci fikir belgesi özeti.');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
    await expect(page.locator('.idea-history>summary small')).toHaveText('2 sürüm');
    await summary.fill('Düzenlenen ikinci fikir belgesi özeti.');
    await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();

    const history = page.locator('.idea-history');
    await expect(history.locator('summary small')).toHaveText('3 sürüm');
    await history.locator('summary').click();
    await expect(history.getByText('3 sürüm')).toBeVisible();
    await history.locator('.idea-history-list button').filter({ hasText: 'r1' }).click();
    await expect(history.locator('.idea-history-diff')).toContainText('Sistem yorumu');
    await history.getByRole('button', { name: 'Bu sürümü geri yükle' }).click();
    await expect(history.getByText(/canonical planın üzerine yazılmayacak/i)).toBeVisible();
    await history.getByRole('button', { name: 'Geri yükle', exact: true }).click();

    await expect(summary).toHaveValue(originalSummary);
    await expect(history.getByText('4 sürüm')).toBeVisible();
  });

  test('canonical plan change requires impact preview and explicit approval', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill(
      'Yerel çalışan bir oyun planlama sistemi geliştirip görev ve kabul testlerini birlikte yönetmek istiyorum.'
    );
    await page.getByRole('button', { name: 'Fikri geliştir' }).click();
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
    await page.getByText('Dosya, dil ve AI seçenekleri').click();
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
