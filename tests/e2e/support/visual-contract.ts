import type { Page } from '@playwright/test';

/**
 * Görünümü belirleyen ve platformdan bağımsız olan özellikler. Font çizimine
 * (anti-aliasing) bağlı hiçbir şey yok: bu yüzden Windows'ta üretilen referans
 * ubuntu CI'da da geçerlidir.
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
  'margin',
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
 * `document.body` altındaki tüm elemanları belge sırasında gezer. El seçimi
 * seçici listesi kullanılmaz: hiçbir eleman gözden kaçmaz. Markup bu alt
 * projede değişmediği için sıra kararlıdır.
 */
export async function captureComputedStyles(page: Page): Promise<ElementStyle[]> {
  return page.evaluate((properties: string[]) => {
    const result: ElementStyle[] = [];
    const walk = (node: Element) => {
      const computed = window.getComputedStyle(node);
      const styles: Record<string, string> = {};
      for (const property of properties) styles[property] = computed.getPropertyValue(property);
      result.push({
        tag: node.tagName.toLowerCase(),
        className: typeof node.className === 'string' ? node.className : '',
        styles
      });
      for (const child of Array.from(node.children)) walk(child);
    };
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
