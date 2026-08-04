import { expect, type Page } from '@playwright/test';

/**
 * Fikir stüdyosunun gerçek akışı için ortak adımlar.
 *
 * Sistem hiçbir konsept alanını kendiliğinden doldurmaz: alanlar kullanıcının
 * cevaplarından çıkarılıp onaylanarak dolar. Bu yüzden plana kadar giden her
 * senaryo aynı sırayı izler:
 *
 *   cevap turları -> alanlar dolar -> aşama ilerler -> karar destesi çıkar
 *   -> deste çözülür -> konsept özeti tamamlanır -> plana dönüşüm açılır
 */

/** Bir soruyu cevaplar, çıkarılan alanları kabul edip uygular. */
export async function answerCoachQuestion(page: Page, answer: string) {
  await page.getByLabel('Fikir sohbeti mesajı').fill(answer);
  await page.getByRole('button', { name: 'Gönder', exact: true }).click();
  const review = page.locator('.discovery-answer-review');
  await expect(review).toBeVisible();
  const patches = review.locator('.answer-patch');
  const count = await patches.count();
  for (let index = 0; index < count; index += 1) {
    await patches.nth(index).getByRole('button', { name: 'Kabul', exact: true }).click();
  }
  await review.getByRole('button', { name: /alanı sistem yorumuna uygula/ }).click();
  await expect(review).toBeHidden();
}

/**
 * Karar kartları problem/kullanıcı/değer aşamalarında bilinçli olarak gizlidir:
 * fikir netleşmeden çözüm kararına geçilmez. Üç cevap turu bu üç alanı doldurur
 * ve deste ancak ondan sonra görünür.
 */
export async function advanceToDecisionTurn(page: Page) {
  await answerCoachQuestion(page, 'Problem: Bireysel geliştiriciler projeye başlamadan önce kapsamı ve kararları netleştiremiyor.');
  await answerCoachQuestion(page, 'Hedef kullanıcı: AI kodlama araçlarıyla tek başına çalışan bireysel geliştirici.');
  await answerCoachQuestion(page, 'Bugünkü çözüm: Dağınık notlar ve sohbet geçmişi. Beklenen sonuç: Kodlamaya başlamadan önce onaylanmış bir MVP kapsamı.');
  await expect(page.locator('.pg-decision-card')).toHaveCount(1);
}

/** Bir yön seçip turu kapatır; kalan öneriler ertelenir ve fikir defteri de kapanır. */
export async function resolveDecisionTurn(page: Page) {
  await page.locator('.pg-decision-card').getByRole('button', { name: 'Bu yönden ilerle', exact: true }).click();
  await page.getByRole('button', { name: /Seçtiğim yönü fikre işle/ }).click();
  await expect(page.locator('.pg-decision-card')).toHaveCount(0);
}

/** Alanları kullanıcı gibi doldurur: sistem bunları uydurmaz, onay kullanıcıya aittir. */
export async function completeConceptAgreement(page: Page) {
  await page.getByLabel('Sistem yorumu').fill('Bireysel geliştiriciler için yerel fikir netleştirme aracı.');
  await page.getByLabel('Birincil kullanıcı').fill('AI kodlama araçlarıyla çalışan bireysel geliştirici');
  await page.getByLabel('Ana problem').fill('Fikirler kapsamı netleşmeden doğrudan koda dönüşüyor.');
  await page.getByLabel('Bugünkü çözüm').fill('Dağınık notlar ve sohbet geçmişi.');
  await page.getByLabel('Beklenen ana sonuç').fill('Kodlamadan önce onaylanmış bir MVP kapsamı.');
  await page.getByLabel('MVP hedefi').fill('Bir fikri onaylı MVP kapsamına dönüştürmek.');
  await page.getByLabel('MVP içinde').fill('Fikir sohbeti\nMVP kapsam onayı');
  await page.getByLabel('MVP dışında').fill('Bulut senkronizasyonu');
  await page.getByLabel('Açık kritik sorular').fill('');
  await page.getByRole('button', { name: 'Yorumu ve MVP sınırlarını kaydet' }).click();
}

/**
 * Konsept özeti ilk sohbet turunda oluşturulur; analyzeIdea hiçbir alanı
 * kendiliğinden doldurmaz. Fikir Özeti düzenleyicisi ancak bu turdan sonra
 * görünür, dolayısıyla özeti kullanan her senaryo önce bir tur çalıştırmalıdır.
 */
export async function runCoachTurn(page: Page) {
  const before = await page.locator('.pg-message').count();
  await page.locator('.pg-coach-actions button').first().click();
  await expect.poll(() => page.locator('.pg-message').count()).toBeGreaterThan(before);
}
