# Arayüz Temeli (Alt Proje A) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/react/styles.css` içindeki üç CSS kuşağını tek token katmanına toplamak, ölü CSS'i ve Tailwind'i kaldırmak — ekranın görünümünü hiç değiştirmeden ve bunu otomatik kanıtlayarak.

**Architecture:** Önce hiçbir CSS'e dokunmadan bir "görsel sözleşme" testi ve referansı üretilir: sekiz ekranda DOM'daki tüm elemanların 15 hesaplanmış CSS özelliği belge sırasında JSON'a kaydedilir. Sonraki her görev bu testi yeşil bırakmak zorundadır. Üç palet tek `:root` içinde toplanır ama **tek değere indirgenmez** — miras değişkenler bugünkü değerleriyle korunur, çünkü `--mint` (#5eead4) ile `--pg-success` (#16765f) aynı renk değildir ve bağlamak görünümü değiştirir.

**Tech Stack:** Vite 7, React 19, TypeScript, Playwright (chromium), düz CSS değişkenleri. Tailwind v4 bu planla projeden çıkarılır.

## Global Constraints

- **Ekran görünümü değişmeyecek.** Her görevden sonra `tests/e2e/visual-contract.spec.ts` sıfır farkla geçmeli.
- **Sınıf adlarına dokunulmayacak.** E2E'deki 43 CSS-sınıfı seçicisi olduğu gibi kalacak.
- **Markup'a dokunulmayacak.** Tek istisna: `LiveAnnouncer.tsx`'in `className` değeri (Görev 5).
- **Miras değişkenler `--pg-*` karşılıklarına bağlanmayacak.** Değerleri birebir korunacak; çözümleme alt proje B'nin işi.
- Yorumlar ve kullanıcıya görünen metin **Türkçe**.
- Commit mesajları Türkçe, conventional-commit biçiminde, ASCII gövdeli (depo deseni).
- **Ortam:** bu makinede npm script'lerinin ve `npx`'in başlattığı cmd alt kabuğu `node`'u bulamıyor
  (`'vite' is not recognized`). Bütün araçlar doğrudan çağrılır:

  | Kapı | Komut |
  | --- | --- |
  | Derleme | `node node_modules/vite/bin/vite.js build` |
  | Tip denetimi | `node node_modules/typescript/bin/tsc --noEmit` |
  | Lint | `node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx` |
  | Birim testleri | `node scripts/run-v4-tests.mjs` |
  | E2E | `node node_modules/@playwright/test/cli.js test` |
  | Önizleme | `node node_modules/vite/bin/vite.js preview --port 4173` |

- Önizleme sunucusu 4173'te **kontrolcü tarafından açık tutulur**; başlatma. Her CSS değişikliğinden
  sonra yalnız derlemeyi tekrarla, sunucu diskten okuduğu için yeniden başlatmaya gerek yok.
- Her görev sonunda yeşil olması gerekenler: tip denetimi çıktısız, lint **0 hata** (95 uyarı mevcut
  ve beklenen), derleme başarılı, E2E tamamı geçer.
- `npm run verify` bu makinede tam koşmaz (cargo kurulu değil); kapılar tek tek koşulur.

---

## Dosya Yapısı

**Oluşturulacak:**

| Dosya | Sorumluluk |
| --- | --- |
| `tests/e2e/support/visual-contract.ts` | DOM'u gezip hesaplanmış stilleri toplayan yardımcı ve fark üretici. Sadece veri; Playwright iddiası içermez. |
| `tests/e2e/visual-contract.spec.ts` | Sekiz ekranı sürer, yardımcıyı çağırır, referansla karşılaştırır. |
| `tests/e2e/visual-contract.baseline.json` | Referans. Görev 1'de üretilir, sonraki görevlerde **değiştirilmez**. |

**Değiştirilecek:**

| Dosya | Ne değişir |
| --- | --- |
| `src/react/styles.css` | Üç `:root` → bir; global eleman kuralları tekilleşir; 60 ölü sınıf silinir; `@import "tailwindcss"` kalkar; `.pg-sr-only` eklenir |
| `index.html` | `theme-color` bayat koyu renkten `--pg-bg` değerine |
| `vite.config.ts` | `tailwindcss()` eklentisi kalkar; PWA manifest renkleri düzelir |
| `package.json` | `tailwindcss` ve `@tailwindcss/vite` bağımlılıktan çıkar |
| `src/react/components/LiveAnnouncer.tsx` | 7 Tailwind utility → tek `pg-sr-only` sınıfı |

---

## Task 1: Görsel sözleşme testi ve referansı

Bu görev **hiçbir CSS değişikliği içermez**. Referans, değişmiş bir durumu yakalarsa planın tamamının sözleşmesi çürür; bu yüzden ayrı bir görev ve ayrı bir commit.

**Files:**
- Create: `tests/e2e/support/visual-contract.ts`
- Create: `tests/e2e/visual-contract.spec.ts`
- Create: `tests/e2e/visual-contract.baseline.json` (test tarafından üretilir)

**Interfaces:**
- Consumes: `tests/e2e/support/provider.ts`'ten `stubReadyProvider(page)`, `stubExpansionProvider(page, cards)`, `StubbedExpansionCard`
- Produces: `captureComputedStyles(page): Promise<ElementStyle[]>`, `diffScreen(screen, expected, actual): string[]`, `TRACKED_PROPERTIES: readonly string[]`, `interface ElementStyle { tag: string; className: string; styles: Record<string,string> }`

- [ ] **Step 1: Yardımcıyı yaz**

`tests/e2e/support/visual-contract.ts`:

```ts
import type { Page } from '@playwright/test';

/**
 * Görünümü belirleyen ve platformdan bağımsız olan özellikler. Font çizimine
 * (anti-aliasing) bağlı hiçbir şey yok: bu yüzden Windows'ta üretilen referans
 * ubuntu CI'da da geçerlidir.
 */
export const TRACKED_PROPERTIES = [
  'color',
  'background-color',
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
```

- [ ] **Step 2: Testi yaz**

`tests/e2e/visual-contract.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureComputedStyles,
  diffScreen,
  type ElementStyle
} from './support/visual-contract.js';
import { stubReadyProvider, stubExpansionProvider, type StubbedExpansionCard } from './support/provider.js';

const BASELINE_PATH = resolve('tests/e2e/visual-contract.baseline.json');
/** Referansı bilerek yeniden üretmek için: UPDATE_VISUAL_BASELINE=1 */
const UPDATE = process.env.UPDATE_VISUAL_BASELINE === '1';

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
  await page.getByRole('tab', { name: 'Keşif' }).click();
  const board = page.getByRole('region', { name: 'Keşif panosu' });
  await board.getByRole('button', { name: 'Güven ve gizlilik' }).click();
  await expect(board.locator('.pg-expansion-card', { hasText: CARDS[0].title })).toBeVisible();
}

/**
 * Ekranlar tek bir test içinde sırayla gezilir: referans dosyası tek yazıcıya
 * sahip olur ve `fullyParallel` ayarıyla yarışmaz. Tek testte toplanan fark
 * listesi göç sırasında da daha yararlıdır — bütün kaymaları bir arada gösterir.
 */
test('görsel sözleşme: hesaplanmış stiller referansla birebir aynı', async ({ page }) => {
  await stubExpansionProvider(page, CARDS);
  const captured: Record<string, ElementStyle[]> = {};

  await page.goto('/');
  await expect(page.getByLabel('Ne yapmak istiyorsun?')).toBeVisible();
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
  await page.getByRole('region', { name: 'Keşif panosu' })
    .locator('.pg-expansion-card', { hasText: CARDS[0].title })
    .getByRole('button', { name: 'Fikre ekle' }).click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);
  captured['toast-ve-duyurucu'] = await captureComputedStyles(page);
  await expect(page.locator('.toast')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Özet' }).click();
  await expect(page.getByRole('list', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
  captured['stüdyo-özet'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'Fikir Özeti', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ortak anlayışımızı kontrol et' })).toBeVisible();
  captured['fikir-özeti'] = await captureComputedStyles(page);

  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  captured['plan'] = await captureComputedStyles(page);

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
```

- [ ] **Step 3: Referansı üret ve testin gerçekten çalıştığını gör**

Önizleme sunucusu kontrolcü tarafından 4173'te açık tutuluyor; başlatma. Derle, sonra referansı **açık bayrakla** üret:

```bash
node node_modules/vite/bin/vite.js build
UPDATE_VISUAL_BASELINE=1 node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS, `tests/e2e/visual-contract.baseline.json` oluşmuş olmalı.

Ardından bayraksız koş — artık gerçekten karşılaştırıyor olmalı:

```bash
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

Dosyanın sekiz anahtar taşıdığını doğrula:

```bash
node -e "const b=require('./tests/e2e/visual-contract.baseline.json');console.log(Object.keys(b));console.log(Object.entries(b).map(([k,v])=>k+': '+v.length+' eleman').join('\n'))"
```

Beklenen: sekiz ekran, her biri onlarca eleman. Herhangi biri 0 veya 1 eleman içeriyorsa o ekran gerçekten açılmamıştır — düzelt, referansı sil (`rm tests/e2e/visual-contract.baseline.json`) ve adımı tekrarla.

- [ ] **Step 4: Testin gerçekten düşebildiğini kanıtla**

Referans doğruysa test her zaman geçer; bu, testin hiçbir şeyi kontrol etmediği anlamına da gelebilir. Geçici bir mutasyonla kanıtla — `src/react/styles.css`'in **en sonuna** ekle:

```css
.pg-expansion-card { border-radius: 3px; }
```

Sonra:

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: FAIL, mesajda şuna benzer bir satır:

```
stüdyo-keşif: Eleman #NN article.pg-expansion-card
  border-radius  beklenen 11px  gelen 3px
```

Mutasyonu geri al, yeniden derle, testin tekrar geçtiğini gör:

```bash
git checkout src/react/styles.css
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

- [ ] **Step 5: Diğer kapıların bozulmadığını doğrula**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, lint 0 hata, tüm E2E testleri geçer (mevcut 31 + yeni 1 = 32).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/support/visual-contract.ts tests/e2e/visual-contract.spec.ts tests/e2e/visual-contract.baseline.json
git commit -m "test(e2e): gorsel sozlesme testi ve referansi ekle

CSS temeli calismasi ekranin gorunumunu degistirmemeli. Bu test sekiz
ekranda DOM'daki tum elemanlarin 15 hesaplanmis CSS ozelligini belge
sirasinda kaydeder ve referansla karsilastirir.

El secimi secici listesi yok: hicbir eleman gozden kacmaz. Izlenen
ozellikler font cizimine bagli degil, bu yuzden Windows'ta uretilen
referans ubuntu CI'da da gecerli.

Bu commit bilerek hicbir CSS degisikligi icermez: referans degismis bir
durumu yakalarsa sonraki gorevlerin tamaminin sozlesmesi curur.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pk1PMuxgQDqfANjHHQBgLe"
```

---

## Task 2: Üç `:root` bloğunu tek token katmanına topla

**Files:**
- Modify: `src/react/styles.css:3` (koyu kuşak `:root`), `:555` (`--studio-*` `:root`), `:605-626` (`--pg-*` `:root`)
- Modify: `index.html:6` (`theme-color`)
- Modify: `vite.config.ts` (PWA manifest `theme_color` / `background_color`)

**Interfaces:**
- Consumes: Görev 1'in `tests/e2e/visual-contract.baseline.json` dosyası
- Produces: `styles.css`'in başında tek `:root`; sonraki görevler bu bloğu varsayar

- [ ] **Step 1: Bugünkü değerleri oku**

Üç bloğu da ekrana al, hiçbir değeri ezberden yazma:

```bash
sed -n '3p;555p;605,626p' src/react/styles.css
```

- [ ] **Step 2: Tek `:root` yaz**

`styles.css`'in **başına** (satır 3'ün yerine) aşağıdaki bloğu koy; satır 555 ve 605–626'daki `:root` bloklarını sil.

Step 1'in çıktısını bu blokla karşılaştır: değerler birebir aynı olmalı. Farklıysa dosya bu plan yazıldıktan sonra değişmiş demektir — **dosyadaki değeri** kullan.

```css
:root {
  /*
   * Tek token katmanı. Daha önce üç ayrı :root vardı (koyu kuşak, --studio-*,
   * --pg-*) ve üçü de body'yi yeniden tanımlıyordu; kazanan dosya sırasındaki
   * sonuncusuydu. Hangi kuralın geçerli olduğu artık konuma değil niyete bağlı.
   */
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  /* Ürün tokenleri — alt proje B bu değerleri değiştirecek. */
  --pg-bg:#f7f7f5;
  --pg-surface:#ffffff;
  --pg-surface-soft:#f1f2ef;
  --pg-text:#171a18;
  --pg-muted:#66706a;
  --pg-faint:#939c96;
  --pg-border:#e2e5e1;
  --pg-border-strong:#cfd5d0;
  --pg-accent:#5b42d6;
  --pg-accent-hover:#4932c2;
  --pg-accent-soft:#efecff;
  --pg-success:#16765f;
  --pg-success-soft:#e7f5f0;
  --pg-warning:#9a5d0d;
  --pg-warning-soft:#fff4df;
  --pg-danger:#b83245;
  --pg-danger-soft:#fff0f2;
  --pg-shadow:0 22px 65px rgba(24,32,27,.1);
  --pg-sidebar:236px;

  /*
   * MİRAS — 246 yerde kullanılıyor, alt proje B'de çözülecek.
   * Değerler bilerek aynen korunuyor: bunları --pg-* karşılıklarına bağlamak
   * rengi değiştirir (--mint #5eead4 ≠ --pg-success #16765f) ve bu alt
   * projenin "ekran değişmesin" sözleşmesini bozar.
   */
  --bg:#090d18;
  --panel:#101625;
  --line:#273149;
  --muted:#8d98ae;
  --violet:#8b7cf6;
  --violet-2:#b0a5ff;
  --mint:#5eead4;
  --danger:#fb7185;
  --studio-canvas:#f5f6f2;
  --studio-muted-surface:#eef1ec;
  --studio-text:#18221e;
  --studio-muted:#66736d;
  --studio-line:#dfe5df;
  --studio-accent:#146b59;
  --studio-accent-strong:#0e5748;
  --studio-accent-soft:#e5f2ed;
  --studio-danger:#b43d42;
  --studio-shadow:0 18px 60px rgba(22,44,35,.08);
}
```

Silinecek değişkenler (sıfır referans): `--panel-2`, `--studio-surface`.

Silinecek bildirimler: eski `:root`'taki `color:#e8ecf7` ve `background:#090d18`. Bunlar zaten dosyanın ilerisindeki `html,body,#root` kuralıyla eziliyor — testin işi bunu doğrulamak. `font-family` **silinmez**: kabukların dışında render edilen `.toast` ve `.loading` onu `:root`'tan miras alıyor.

- [ ] **Step 3: Testi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

FAIL alırsan mesaj hangi özelliğin kaydığını söyler. Referansı **güncelleme** — kaymayı düzelt. Örneğin `color` kaydıysa `:root`'tan sildiğin bir bildirim aslında ezilmiyormuş demektir; geri koy.

- [ ] **Step 4: Tema renklerini düzelt**

`index.html` satır 6:

```html
<meta name="theme-color" content="#f7f7f5" />
```

`vite.config.ts` PWA manifest'inde `theme_color: '#0b1020', background_color: '#0b1020'` → ikisi de `'#f7f7f5'`.

Not: `#0b1020` kaldırılan koyu temadan kalma; uygulama açık temada çalışıyor. Bu değerler hesaplanmış stil değil, tarayıcı krom rengi — görsel sözleşme testi bunları görmez, bu yüzden gözle doğrulanır.

- [ ] **Step 5: Bütün kapıları koştur**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, lint 0 hata, build başarılı, 32 E2E testi geçer.

- [ ] **Step 6: Commit**

```bash
git add src/react/styles.css index.html vite.config.ts
git commit -m "refactor(css): uc :root blogunu tek token katmanina topla

styles.css uc kusak tasiyordu (koyu, --studio-*, --pg-*) ve ucu de body'yi
yeniden tanimliyordu; hangi kuralin gecerli oldugu dosya sirasina bagliydi.
Uc blok tek :root'a indi.

Miras degiskenler bilerek --pg-* karsiliklarina baglanmadi: --mint (#5eead4)
ile --pg-success (#16765f) ayni renk degil, baglamak gorunumu degistirirdi.
Degerleri aynen korunuyor ve MIRAS baslikli blokta etiketli; cozumleme alt
proje B'nin isi.

Kullanilmayan --panel-2 ve --studio-surface silindi. Bayat theme-color
(#0b1020) hem index.html'de hem PWA manifest'inde --pg-bg degerine cekildi.

Gorsel sozlesme testi sifir farkla geciyor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pk1PMuxgQDqfANjHHQBgLe"
```

---

## Task 3: Global eleman kurallarını tekilleştir

**Files:**
- Modify: `src/react/styles.css` — `body` (3 tanım), `textarea` (2), `select` (2)

**Interfaces:**
- Consumes: Görev 2'nin tek `:root` bloğu
- Produces: eleman başına tek kural; Görev 4 bu kuralların dışındaki sınıfları siler

- [ ] **Step 1: Bugünkü tanımları oku**

```bash
grep -n "^body\|^html,body\|^textarea\|^select\|^textarea,select" src/react/styles.css
```

Beklenen: `body` üç yerde, `textarea` ve `select` ikişer yerde.

- [ ] **Step 2: Üçünü de tek kurala indir**

Kural: **korunacak değer, bugün ekranda görünen değerdir** — dosyadaki ilk tanım değil. Aşağıdaki üç kural bunu uygular; eski tanımları sil ve bunları token bloğunun hemen altına koy.

```css
/*
 * Her global eleman tek kez tanımlanır. Daha önce body üç, textarea ve select
 * ikişer kez tanımlıydı; hesaplanmış sonuç dosyadaki son kuraldan geliyordu.
 * Aşağıdaki değerler o sonucun kendisidir, ilk tanımın değil.
 */
* { box-sizing: border-box; }
html { overflow-x: hidden; }
html, body, #root { min-width: 320px; min-height: 100%; background: var(--pg-bg); color: var(--pg-text); }
body { margin: 0; }
img, svg { max-width: 100%; }
button, textarea, select { font: inherit; }
button { color: inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }

h1 { margin: 14px 0 18px; font-size: clamp(43px, 7vw, 82px); line-height: .96; letter-spacing: -.055em; }
h1 span { color: var(--violet-2); }

textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--studio-line);
  border-radius: 10px;
  padding: 13px;
  background: #fff;
  color: var(--studio-text);
  line-height: 1.55;
}

select {
  border: 1px solid var(--studio-line);
  border-radius: 8px;
  padding: 9px 10px;
  background: #fff;
  color: var(--studio-text);
}
```

`h1`'in `clamp(43px,7vw,82px)` boyutu koyu tema için yazılmıştı ama bugün ekranda o görünüyor; bu alt proje onu **korur**. Doğru olup olmadığı alt proje B'nin kararı.

- [ ] **Step 3: Testi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

FAIL alırsan mesaj hangi elemanın hangi özelliğinin kaydığını söyler. Sık görülen sebep: birleştirilen kurallardan birinde `background` kısayolu, ötekinin `background-color`'ını da sıfırlıyor. Referansı güncelleme; kuralı düzelt.

- [ ] **Step 4: Bütün kapıları koştur**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, lint 0 hata, build başarılı, 32 E2E testi geçer.

- [ ] **Step 5: Commit**

```bash
git add src/react/styles.css
git commit -m "refactor(css): global eleman kurallarini tekillestir

body uc, textarea ve select ikiser kez tanimliydi; hesaplanmis sonuc dosya
sirasindaki son kuraldan geliyordu. Her eleman artik tek kez tanimli ve
tasidigi deger o hesaplanmis sonucun kendisi.

Kapsamlama yapilmadi: .toast, .loading, .skip-link ve diyaloglar App.tsx'te
kabuklarin disinda, StartScreen/Workspace ile kardes render ediliyor;
kabuk sinifina kapsamlamak bu yuzeyleri kirardi.

h1'in clamp(43px,7vw,82px) boyutu koyu tema icin yazilmisti ama bugun
ekranda gorunen o; korundu, yargi alt proje B'nin.

Gorsel sozlesme testi sifir farkla geciyor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pk1PMuxgQDqfANjHHQBgLe"
```

---

## Task 4: Ölü CSS'i sil

**Files:**
- Modify: `src/react/styles.css` — 60 sınıfın kuralları

**Interfaces:**
- Consumes: Görev 3'ün tekilleşmiş global kuralları
- Produces: yalnız JSX'te kullanılan sınıfları içeren stil dosyası

- [ ] **Step 1: Ölü sınıf listesini yeniden üret**

Listeyi ezberden kullanma; kod bu plandan sonra değişmiş olabilir:

```bash
awk 'NR<=600' src/react/styles.css | grep -oE '^\.[a-z][a-z0-9-]*' | sed 's/^\.//' | sort -u \
  | while read c; do grep -qr "\b$c\b" src/react --include=*.tsx || echo "$c"; done
```

Bu plan yazılırken çıkan 60 sınıf (karşılaştırma için):

```
app-shell bundle-actions change-preview composer-mode-switch context-note
conversation-heading depth-panel discovery-chat discovery-composer eyebrow
history-line idea-box idea-footer idea-outcome-primary idea-outcome-primary-action
idea-outcome-primary-copy idea-outcome-secondary idea-outcomes idea-prompt-card
idea-prompt-deck idea-summary idea-trail-chip import-row message-log
open-question-list phase-focus plan-panel plan-quality product-positioning
provider-status quiet-icon-button section-editor section-tabs selected-files
start-actions start-card start-mark start-options start-shell studio-data-tools
studio-intro studio-mode-switch studio-suggestions studio-supporting-tools
text-button title-block top-actions welcome-brand welcome-composer
welcome-context-list welcome-copy welcome-main welcome-more welcome-nav
welcome-project-list welcome-provider-warning welcome-recents welcome-shell
welcome-submit workspace-grid
```

Dinamik sınıf riski incelendi: koddaki tüm şablon-değişmez `className` kullanımları `` `sabit-taban ${değişken}` `` biçiminde, yani taban sınıf her zaman literal olarak yazılı ve yukarıdaki arama onu bulur. Değişkenden üreyen ekler (`status-`, `state-`, `risk-`, `outcome-` önekli olanlar) bu listede yok. Yine de artık kalan risk Step 3'teki test tarafından karşılanır.

- [ ] **Step 2: Kuralları sil**

Listedeki her sınıf için, `styles.css`'te o sınıfı içeren **tüm** seçicileri sil — hem tek başına (`.start-card { … }`) hem birleşik olanları (`.start-card h2 { … }`, `.start-shell .start-card { … }`).

Bir seçici hem ölü hem canlı sınıf içeriyorsa (`.start-card, .pg-map-head { … }`) yalnız ölü kısmı seçici listesinden çıkar, kuralı silme.

- [ ] **Step 3: Testi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

FAIL alırsan bir sınıf yanlışlıkla ölü sanılmıştır — mesajdaki eleman hangi kuralı kaybettiğini gösterir. O sınıfın kuralını geri koy ve neden aramada görünmediğini not et.

- [ ] **Step 4: Kazanımı ölç**

```bash
wc -l src/react/styles.css
```

Referans: iş başlamadan önce 739 satırdı.

- [ ] **Step 5: Bütün kapıları koştur**

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, lint 0 hata, build başarılı, 32 E2E testi geçer.

- [ ] **Step 6: Commit**

```bash
git add src/react/styles.css
git commit -m "refactor(css): JSX'te kullanilmayan 60 sinifi sil

Eski blokta tanimli 227 siniftan 60'i JSX'te hic kullanilmiyordu. Kalan
167'sine dokunulmadi: eski blok "olu kod" degil, uygulamanin hala
kullandigi stil.

Dinamik sinif riski incelendi: koddaki tum sablon className kullanimlari
`sabit-taban ${degisken}` biciminde, yani taban sinif literal yazili ve
aramada gorunuyor. Kalan risk gorsel sozlesme testiyle karsilandi.

Gorsel sozlesme testi sifir farkla geciyor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pk1PMuxgQDqfANjHHQBgLe"
```

---

## Task 5: Tailwind'i projeden çıkar

**Files:**
- Modify: `package.json` — `tailwindcss`, `@tailwindcss/vite` bağımlılıkları
- Modify: `vite.config.ts:3` (import), `:22` (eklenti)
- Modify: `src/react/styles.css:1` (`@import`), `.pg-sr-only` eklenir
- Modify: `src/react/components/LiveAnnouncer.tsx:16`

**Interfaces:**
- Consumes: Görev 4'ün temizlenmiş stil dosyası
- Produces: Tailwind'siz build; `.pg-sr-only` sınıfı

- [ ] **Step 1: `.pg-sr-only`'yi yaz**

`styles.css`'e, global eleman kurallarının hemen altına ekle. Değerler Tailwind'in `sr-only fixed -top-96 -left-96 w-1 h-1 overflow-hidden opacity-0 pointer-events-none` bileşiminin hesaplanmış sonucudur:

```css
/*
 * Ekran okuyucuya görünür, göze görünmez. Daha once Tailwind'in sr-only +
 * konumlandırma yardımcılarıyla kuruluyordu; Tailwind'in tüm kod tabanındaki
 * tek kullanıcısı buydu.
 */
.pg-sr-only {
  position: fixed;
  top: -24rem;
  left: -24rem;
  width: .25rem;
  height: .25rem;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: `LiveAnnouncer.tsx`'i değiştir**

Satır 16'daki `className` değerini değiştir:

```tsx
      className="pg-sr-only"
```

Dosyanın geri kalanına dokunma.

- [ ] **Step 3: Tailwind'i kaldır**

`src/react/styles.css` satır 1'deki `@import "tailwindcss";` satırını sil.

`vite.config.ts`:
- satır 3'teki `import tailwindcss from '@tailwindcss/vite';` silinir
- satır 22'deki `react(), tailwindcss(),` → `react(),`

`package.json`: `tailwindcss` ve `@tailwindcss/vite` girdileri silinir, ardından:

```bash
npm install --ignore-scripts
```

`--ignore-scripts` bu ortam için zorunlu: `esbuild`'in postinstall'ı npm'in başlattığı cmd alt
kabuğunda `node`'u bulamıyor ve kurulumu düşürüyor. Paket zaten kurulu olduğu için postinstall'ı
tekrar koşturmaya gerek yok; yalnız `node_modules` ağacından Tailwind çıkarılıyor. Kurulumun
sağlığını bir sonraki adımdaki derleme kanıtlar.

- [ ] **Step 4: Testi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: PASS.

`toast-ve-duyurucu` ekranı `LiveAnnouncer`'ı da yakalıyor (kart eklendiğinde `notice` dolduğu için DOM'a giriyor). `.pg-sr-only` Tailwind bileşiminden farklı hesaplanırsa test tam orada düşer ve hangi özelliğin kaydığını söyler.

- [ ] **Step 5: Tailwind'in gerçekten gittiğini doğrula**

```bash
grep -rn "tailwind" package.json vite.config.ts src/ || echo "temiz"
ls node_modules | grep -c tailwind || echo "0 paket"
```

Beklenen: kaynak dosyalarda hiçbir eşleşme yok.

Üretilen CSS boyutunu da karşılaştır (iş başlamadan önce 163 KB idi):

```bash
ls -la dist/assets/*.css
```

- [ ] **Step 6: Bütün kapıları koştur**

```bash
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-v4-tests.mjs
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/tsx/dist/cli.mjs scripts/product-docs.ts --check
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, 348 birim testi ve 6 güvenlik testi geçer, lint 0 hata, ürün belgeleri eşleşir, build başarılı, 32 E2E testi geçer.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/react/styles.css src/react/components/LiveAnnouncer.tsx
git commit -m "refactor(build): Tailwind'i projeden cikar

Tailwind v4 kurulu ve vite eklentisi etkindi ama tum kod tabaninda tek
kullanicisi vardi: LiveAnnouncer'daki sr-only div. Uretilen CSS 163 KB,
el yazimi styles.css 161 KB — Tailwind'in katkisi ~2 KB idi.

Yardimci siniflar tek bir .pg-sr-only kuralina indi; degerler Tailwind
bilesiminin hesaplanmis sonucu. LiveAnnouncer toast gorunurken DOM'a
girdigi icin gorsel sozlesme testinin kapsaminda.

Gorsel sozlesme testi sifir farkla geciyor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pk1PMuxgQDqfANjHHQBgLe"
```

---

## Bitiş durumu

Alt proje A tamamlandığında:

- `src/react/styles.css` tek `:root` ve eleman başına tek global kural taşır; miras değişkenler etiketli tek blokta durur
- 60 ölü sınıf ve 2 kullanılmayan değişken silinmiştir
- Tailwind bağımlılığı, vite eklentisi ve `@import` yoktur
- `theme-color` her iki yerde de doğrudur
- `tests/e2e/visual-contract.spec.ts` ekranın hiç değişmediğini kanıtlar ve bundan sonraki her CSS çalışmasının kapısıdır
- Sınıf adları ve 43 E2E seçicisi dokunulmamıştır

Sonraki alt proje **B (görsel dil)**: bu planla kurulan token katmanının *değerlerini* değiştirir ve MİRAS bloğunu boşaltır. Yapıya dokunmaz. Görsel sözleşme testi B'de bilerek kırılır — B'nin işi referansı gerekçesiyle birlikte yenilemektir.
