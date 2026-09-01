import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Keşif panosu artık TEK bir aktif kategori göstermiyor: hazır olan her
 * kategori kendi bölümüyle aynı anda duruyor. Bu yüzden `.pg-expansion-card`
 * gibi seçiciler pano genelinde ARTIK BENZERSİZ DEĞİL — aynı sahte kart
 * listesi altı bölümde birden görünebiliyor.
 *
 * Testler bu yüzden önce bölümü seçer, sonra kartı: iddia "panoda bir yerde
 * şu kart var" değil, "ŞU BAŞLIK ALTINDA şu kart var" olarak kalır. Eski
 * iddianın gücü korunur, kapsamı netleşir.
 */
export function expansionBoard(page: Page): Locator {
  return page.getByRole('region', { name: 'Keşif panosu' });
}

/** Başlığı (görünen `<h3>` metni) verilen keşif bölümü. */
export function expansionSection(page: Page, categoryLabel: string): Locator {
  return expansionBoard(page)
    .locator('.pg-expansion-section')
    .filter({ has: page.getByRole('heading', { name: categoryLabel, exact: true }) });
}

/**
 * Bir bölümün içindeki tek bir kart. Başlık eşleşmesi bölümle sınırlandığı
 * için aynı başlıklı kartların başka bölümlerdeki kopyaları karışmaz.
 */
export function expansionCard(page: Page, categoryLabel: string, cardTitle: string): Locator {
  return expansionSection(page, categoryLabel).locator('.pg-expansion-card', { hasText: cardTitle });
}

/**
 * Arka plan doldurma bitene kadar bekler: her görünür bölüm ya kart göstermiş
 * ya da bir sonuca bağlanmış olur. Yakalama/ölçüm yapan testler bu çapayı
 * kullanır — aksi hâlde bölümler koşu sırasında birer birer doldukça DOM
 * altlarından kayar.
 */
export async function waitForSettledSections(page: Page, expectedCount: number): Promise<void> {
  const board = expansionBoard(page);
  await expect(board.locator('.pg-expansion-section')).toHaveCount(expectedCount);
  await expect(board.locator('.pg-expansion-section[data-ready="ready"]')).toHaveCount(expectedCount);
}
