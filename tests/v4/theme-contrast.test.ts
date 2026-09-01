import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Temanın iki sözü mekanik olarak korunur:
 *
 *  1. Hiçbir metin/zemin çifti kendi eşiğinin altına düşmez. Paleti "biraz
 *     daha sıcak" yapmak isteyen bir sonraki değişiklik, oranı bozarsa burada
 *     durur — göz kararıyla değil, ölçüyle.
 *  2. Uygulama dışarıdan font YÜKLEMEZ. PromtGen hesapsız, çevrimdışı
 *     çalışan bir PWA; bir `@font-face`/`@import`/`fonts.googleapis` bağlantısı
 *     bu sözü ilk açılışta sessizce bozar (font gelmezse metrik kayar, gelirse
 *     ağ isteği çıkar).
 */

const STYLESHEET = resolve(process.cwd(), 'src', 'react', 'styles.css');
const css = readFileSync(STYLESHEET, 'utf8');
/**
 * Yasak sözcükler KURALLARDA aranır, yorumlarda değil: `@font-face`
 * yazan bir açıklama satırı (ki bu dosyanın kendi gerekçesi öyle yazıyor)
 * testi düşürmemeli.
 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** `:root` bloğundaki `--pg-*` token'larını okur. */
function readTokens(source: string): Record<string, string> {
  const root = source.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(root, ':root bloğu bulunamadı');
  const tokens: Record<string, string> = {};
  for (const line of root[1].split('\n')) {
    const match = line.match(/^\s*(--pg-[a-z-]+)\s*:\s*([^;]+);/);
    if (match) tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function channels(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  assert.equal(full.length, 6, `hex bekleniyordu: ${hex}`);
  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  const linear = (raw: number) => {
    const channel = raw / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x kontrast oranı; iki yüzde biri aşağı yuvarlanır ki eşik testi cömert olmasın. */
function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.floor(ratio * 100) / 100;
}

const tokens = readTokens(css);
const token = (name: string) => {
  const value = tokens[`--pg-${name}`];
  assert.ok(value, `--pg-${name} tanımlı değil`);
  return value;
};

/**
 * Eşikler:
 *  - `text` 4.5 — WCAG AA, normal boy metin.
 *  - `passive` 3.0 — paletin pasif katmanı (--pg-faint) ve büyük metin.
 *  - `ui` 3.0 — WCAG 1.4.11: denetim kenarı, işaret, odak halkası.
 */
const THRESHOLD = { text: 4.5, passive: 3, ui: 3 } as const;

interface Pair {
  readonly what: string;
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
}

const surfaces = ['bg', 'surface', 'surface-soft'] as const;

const pairs: Pair[] = [
  // Ana metin katmanları her üç yüzeyde de okunur olmalı.
  ...surfaces.map(surface => ({ what: `text/${surface}`, fg: 'text', bg: surface, min: THRESHOLD.text })),
  ...surfaces.map(surface => ({ what: `muted/${surface}`, fg: 'muted', bg: surface, min: THRESHOLD.text })),
  ...surfaces.map(surface => ({ what: `faint/${surface}`, fg: 'faint', bg: surface, min: THRESHOLD.passive })),

  // Bakır METİN kendi token'ıdır; --pg-accent metin olarak kullanılmaz.
  { what: 'accent-text/surface', fg: 'accent-text', bg: 'surface', min: THRESHOLD.text },
  { what: 'accent-text/surface-soft', fg: 'accent-text', bg: 'surface-soft', min: THRESHOLD.text },
  { what: 'accent-text/bg', fg: 'accent-text', bg: 'bg', min: THRESHOLD.text },
  { what: 'accent-text/accent-soft', fg: 'accent-text', bg: 'accent-soft', min: THRESHOLD.text },

  // Bakır ZEMİNDE yazı koyudur: krem/bakır 3.03 ile okunmaz.
  { what: 'on-accent/accent', fg: 'on-accent', bg: 'accent', min: THRESHOLD.text },
  { what: 'on-accent/accent-hover', fg: 'on-accent', bg: 'accent-hover', min: THRESHOLD.text },

  // Anlamsal renkler hem yüzeyde hem kendi yumuşak zemininde metin taşır.
  { what: 'success/surface', fg: 'success', bg: 'surface', min: THRESHOLD.text },
  { what: 'success/success-soft', fg: 'success', bg: 'success-soft', min: THRESHOLD.text },
  { what: 'warning/surface', fg: 'warning', bg: 'surface', min: THRESHOLD.text },
  { what: 'warning/warning-soft', fg: 'warning', bg: 'warning-soft', min: THRESHOLD.text },
  { what: 'danger/surface', fg: 'danger', bg: 'surface', min: THRESHOLD.text },
  { what: 'danger/danger-soft', fg: 'danger', bg: 'danger-soft', min: THRESHOLD.text },
  { what: 'text/success-soft', fg: 'text', bg: 'success-soft', min: THRESHOLD.text },
  { what: 'text/warning-soft', fg: 'text', bg: 'warning-soft', min: THRESHOLD.text },
  { what: 'text/danger-soft', fg: 'text', bg: 'danger-soft', min: THRESHOLD.text },
  { what: 'text/accent-soft', fg: 'text', bg: 'accent-soft', min: THRESHOLD.text },

  // İkincil metin, ANLAMSAL zeminlerin üstünde de taşınıyor: envanter
  // penceresinin toplam kutuları (--pg-success-soft / --pg-danger-soft) ve
  // önerilen kartın bakır zemini (--pg-accent-soft) bunun örnekleri.
  { what: 'muted/success-soft', fg: 'muted', bg: 'success-soft', min: THRESHOLD.text },
  { what: 'muted/warning-soft', fg: 'muted', bg: 'warning-soft', min: THRESHOLD.text },
  { what: 'muted/danger-soft', fg: 'muted', bg: 'danger-soft', min: THRESHOLD.text },
  { what: 'muted/accent-soft', fg: 'muted', bg: 'accent-soft', min: THRESHOLD.text },

  // Anlamsal renkler ikincil YÜZEYDE de metin taşıyor: izlenebilirlik
  // haritasının tür filtreleri ve düğüm konturları --pg-surface-soft üstünde.
  { what: 'success/surface-soft', fg: 'success', bg: 'surface-soft', min: THRESHOLD.text },
  { what: 'warning/surface-soft', fg: 'warning', bg: 'surface-soft', min: THRESHOLD.text },
  { what: 'danger/surface-soft', fg: 'danger', bg: 'surface-soft', min: THRESHOLD.text },

  // Sayfa zemini (--pg-bg) artık yalnız arka plan değil: kart içine oyulmuş
  // kutular (.suggestion-rationale, .inventory-sample) doğrudan onun üstünde
  // metin taşıyor.
  { what: 'success/bg', fg: 'success', bg: 'bg', min: THRESHOLD.text },
  { what: 'warning/bg', fg: 'warning', bg: 'bg', min: THRESHOLD.text },
  { what: 'danger/bg', fg: 'danger', bg: 'bg', min: THRESHOLD.text },
  // Metin değil ama görülmesi gereken şeyler (WCAG 1.4.11).
  { what: 'border-strong/surface', fg: 'border-strong', bg: 'surface', min: THRESHOLD.ui },
  { what: 'border-strong/surface-soft', fg: 'border-strong', bg: 'surface-soft', min: THRESHOLD.ui },
  { what: 'accent/surface', fg: 'accent', bg: 'surface', min: THRESHOLD.ui },
  { what: 'accent/surface-soft', fg: 'accent', bg: 'surface-soft', min: THRESHOLD.ui },
  { what: 'accent-hover/surface', fg: 'accent-hover', bg: 'surface', min: THRESHOLD.ui },
  { what: 'accent-deep/surface', fg: 'accent-deep', bg: 'surface', min: THRESHOLD.ui }
];

describe('tema kontrastı', () => {
  for (const pair of pairs) {
    it(`${pair.what} en az ${pair.min}:1`, () => {
      const ratio = contrastRatio(token(pair.fg), token(pair.bg));
      assert.ok(
        ratio >= pair.min,
        `${pair.what} = ${ratio}:1 (--pg-${pair.fg} ${token(pair.fg)} / --pg-${pair.bg} ${token(pair.bg)}); en az ${pair.min}:1 gerekiyor`
      );
    });
  }

  it('krem yazı bakır zeminde KULLANILMAZ — ölçü bunu yasaklıyor', () => {
    // Bu iddia paletin bilerek saptığı tek noktayı kilitler: tasarım notu
    // bakır butonda krem yazı istiyordu, ölçüm 3.03 dedi. --pg-on-accent'in
    // neden koyu olduğu bu satırda yazılı kalsın.
    assert.ok(contrastRatio(token('text'), token('accent')) < THRESHOLD.text);
  });

  it('--pg-border yalnız ayırıcıdır: denetim kenarı olacak kadar görünür değil', () => {
    // Bu da bir sapma değil, bir sınır: paneli ayıran çizgi (1.57) koyu bir
    // input'un kenarı olamaz. Kenar --pg-border-strong'a bağlıdır; oran
    // buranın üstündeki listede ölçülüyor.
    assert.ok(contrastRatio(token('border'), token('surface')) < THRESHOLD.ui);
    assert.match(rules, /border-color:var\(--pg-border-strong\);/);
  });
});

describe('tema sözleşmesi', () => {
  it('koyu tema ilan edilir', () => {
    assert.match(rules, /color-scheme:\s*dark;/);
  });

  it('dışarıdan font yüklenmez', () => {
    assert.doesNotMatch(rules, /@font-face/i);
    assert.doesNotMatch(rules, /@import/i);
    assert.doesNotMatch(rules, /fonts\.googleapis|fonts\.gstatic/i);
    assert.doesNotMatch(rules, /url\(\s*['"]?https?:/i);
  });

  it('üç yazı rolü de sistem yığınıdır', () => {
    for (const role of ['sans', 'serif', 'mono']) {
      const value = token(`font-${role}`);
      assert.doesNotMatch(value, /url\(/, `--pg-font-${role} dış kaynak taşıyor`);
      assert.match(value, /(ui-|system-ui|Georgia|Consolas|Menlo|sans-serif|serif|monospace)/);
    }
  });

  it('index.html de font bağlantısı taşımaz', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|@font-face/i);
  });

  it('pill yuvarlaklığı ve glassmorphism temada yok', () => {
    assert.doesNotMatch(rules, /border-radius:\s*9{2,}px/);
    assert.doesNotMatch(rules, /backdrop-filter/);
  });
});
