import type { Page } from '@playwright/test';

/**
 * Görünümü belirleyen ve platformdan bağımsız olan özellikler.
 *
 * **`margin` bilerek listede yok.** Bu yorum bir zamanlar listenin tamamının
 * platformdan bağımsız olduğunu iddia ediyordu; CI bunu yalanladı. Windows'ta
 * üretilen referans ubuntu koşusunda 78 fark veriyordu ve **78'inin de tek
 * kaynağı `margin`'di** — diğer 14 özellikte sıfır fark vardı. Farklar
 * `auto` ile ortalanmış elemanlardan geliyor: `getComputedStyle` `auto`'yu
 * çözülmüş piksele çevirir (`0px 309.484px 0px 309.469px` → `0px 300.047px`),
 * ve o piksel kapsayıcı genişliğinin, dolayısıyla font metriğinin yan
 * ürünüdür. Yazılmış bir stil değil, yerleşimin sonucudur.
 *
 * Bu yüzden `margin` sözleşmenin ölçemeyeceği bir şeydi: değişmesi bir
 * regresyona değil, farklı bir yazı tipi kurulumuna işaret ediyordu. Sinyal
 * kaybı ölçülü — bilerek yapılan bir margin değişikliği artık yakalanmaz,
 * ama zaten yakalanan her margin farkı yanlış alarmdı.
 *
 * Bu hata 2026-08-07'den (1390be0) beri vardı; unit testi daha önce düştüğü
 * için Playwright işi hiç koşamıyor ve hata görünmüyordu.
 */
export const TRACKED_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'border-width',
  'border-color',
  'border-radius',
  'padding',
  'gap',
  'box-shadow',
  'opacity'
] as const;

export interface ElementStyle {
  tag: string;
  className: string;
  styles: Record<string, string>;
}

/**
 * `<html>`'i tek bir üst-eleman olarak yakalar, sonra `document.body`
 * altındaki tüm elemanları eskisi gibi belge sırasında gezer. El seçimi
 * seçici listesi kullanılmaz: hiçbir body elemanı gözden kaçmaz. Markup bu
 * alt projede değişmediği için sıra kararlıdır.
 *
 * Daha önce yalnız `document.body`'den başlıyordu; bu, `<html>`'i hiç
 * yakalamıyordu. `:root` özgüllüğü (0,1,0) `html,body,#root` kuralındaki
 * `html` tip seçicisinden (0,0,1) yüksek olduğu için `:root`'taki bildirimler
 * `<html>` üzerinde kazanır — bu kör nokta styles.css'teki eski `:root`'un
 * `color`/`background` bildirimlerinin `<html>`'i (body'yi değil) etkilediğini
 * gözden kaçırmasına yol açmıştı.
 *
 * `<html>`'i `document.documentElement`'ten başlayarak *gezmek* (walk) yerine
 * ayrı yakalanır: `document.documentElement`'in çocukları `<head>` ve
 * `<body>`'dir, bu yüzden oradan gezinmek `<meta>`/`<title>`/`<script>`/
 * `<link>` gibi görünüm sözleşmesiyle ilgisiz onlarca `<head>` elemanını da
 * listeye katardı (denendi: ekran başına 90 → 107 gibi +17 eleman). Onun
 * yerine yalnız `<html>` düğümünün kendisi eklenir, `<head>`'e hiç inilmez.
 */
export async function captureComputedStyles(page: Page): Promise<ElementStyle[]> {
  return page.evaluate((properties: string[]) => {
    const result: ElementStyle[] = [];
    const capture = (node: Element) => {
      const computed = window.getComputedStyle(node);
      const styles: Record<string, string> = {};
      for (const property of properties) styles[property] = computed.getPropertyValue(property);
      result.push({
        tag: node.tagName.toLowerCase(),
        className: typeof node.className === 'string' ? node.className : '',
        styles
      });
    };
    const walk = (node: Element) => {
      capture(node);
      for (const child of Array.from(node.children)) walk(child);
    };
    capture(document.documentElement);
    walk(document.body);
    return result;
  }, [...TRACKED_PROPERTIES]);
}

/** Farkı özelliği adıyla bildirir; "bir şey değişti" demekle yetinmez. */
export function diffScreen(screen: string, expected: ElementStyle[], actual: ElementStyle[]): string[] {
  if (expected.length !== actual.length) {
    // Sıra kaydıysa özellik farkları yanıltıcı olur; tek satırla dur.
    return [`${screen}: eleman sayısı değişti — beklenen ${expected.length}, gelen ${actual.length}`];
  }
  const problems: string[] = [];
  expected.forEach((item, index) => {
    const other = actual[index];
    const label = `${screen}: Eleman #${index} ${item.tag}${item.className ? `.${item.className}` : ''}`;
    if (item.tag !== other.tag || item.className !== other.className) {
      problems.push(`${label}\n  kimlik değişti — gelen ${other.tag}${other.className ? `.${other.className}` : ''}`);
      return;
    }
    for (const [property, value] of Object.entries(item.styles)) {
      if (other.styles[property] !== value) {
        problems.push(`${label}\n  ${property}  beklenen ${value}  gelen ${other.styles[property]}`);
      }
    }
  });
  return problems;
}
