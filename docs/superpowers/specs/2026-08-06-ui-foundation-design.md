# Arayüz Yenileme — Alt Proje A: CSS Temeli

Status: Draft — kullanıcı onayı bekliyor
Date: 2026-08-06
Kapsam: Üç kuşak CSS'in tek token katmanına toplanması, ölü CSS'in kaldırılması, Tailwind'in
projeden çıkarılması ve bunların ekran görüntüsünü değiştirmediğini kanıtlayan hesaplanmış-stil
regresyon testi.

## Bağlam

Kullanıcı arayüzü ve HTML'i baştan yapmak istedi. Ölçüm, bunun tek bir spec'e sığmayacağını
gösterdi: `src/react` altında 57 dosya, 6852 satır, JSX'te 486 `className`, `styles.css` 739 satır
ve E2E testlerinde CSS sınıf adına bağlı 43 seçici.

İş dört alt projeye ayrıldı (kullanıcı onayı):

| # | Alt proje | İçerik |
| --- | --- | --- |
| **A** | **Temel** | Teknoloji kararı, token katmanı, ölü CSS, global kurallar, `index.html` |
| B | Görsel dil | Palet, tipografi ölçeği, boşluk, ikon dili — token *değerleri* |
| C | Yerleşim | Üç bölge, sekmeler, panel/drawer yapısı |
| D | Yüzey göçü | Kalan bileşenlerin göçü, sınıf adlandırmasının tek düzene alınması |

Bu spec yalnız **A**'yı tanımlar. B, `2026-08-03-idea-studio-layout-design.md` içinde "Aşama 2b"
olarak zaten ertelenmişti; A onun önkoşuludur.

### Ölçülen mevcut durum

`styles.css` üç kuşak taşıyor ve üçünün de canlı kuralları var:

| Satır | Palet | Aksan | Tanımladığı global elemanlar |
| --- | --- | --- | --- |
| 3 | `--bg` / `--violet` / `--mint` (koyu) | `#8b7cf6` | `*`, `html`, `body`, `h1`, `button`, `img,svg`, `textarea`, `select` |
| 555 | `--studio-*` (açık, yeşil) | `#146b59` | `body`, `textarea`, `select` |
| 605 | `--pg-*` (açık, mor) | `#5b42d6` | `html`, `body`, `#root` |

Üçü de `body`'yi yeniden tanımlıyor; kazanan dosya sırasındaki sonuncusu. Bugün ekrandaki
`textarea` satır 559'dan (ikinci kuşak), `h1`'in `clamp(43px,7vw,82px)` boyutu satır 21'den
(koyu tema için yazılmış kural) geliyor.

Diğer ölçümler:

- Eski blokta (1–600) tanımlı 227 sınıftan **60'ı** JSX'te hiç kullanılmıyor; **167'si canlı**.
  Eski blok "ölü kod" değil, uygulamanın hâlâ kullandığı stil.
- Miras değişkenlere **246 referans** var: koyu kuşak 153 (`--line` 65, `--muted` 34, `--mint` 27,
  `--violet-2` 10, `--violet` 8, `--danger` 5, `--panel` 3, `--bg` 1), `--studio-*` kuşağı 93.
  Hâlâ kullanılan 18 miras değişken var; `--panel-2` ve `--studio-surface` hiç kullanılmıyor.
- Tailwind v4 kurulu ve vite eklentisi etkin. Yardımcı sınıflarının tüm kod tabanındaki tek
  kullanıcısı `LiveAnnouncer.tsx:16`'daki `sr-only` div'i. Üretilen CSS 163 KB, el yazımı
  `styles.css` 161 KB.

  **Düzeltme (uygulama sırasında ölçüldü):** Bu ölçüm yalnız yardımcı sınıfları sayıyordu ve
  bu yüzden yanıltıcıydı. `@import "tailwindcss"` aynı zamanda **Preflight**'ı — global bir
  reset'i — getiriyor ve uygulamanın bugünkü görünümü ona dayanıyor. Tailwind çıkarılınca
  görsel sözleşme testi 1285 farkla düştü: 1170 `line-height` (Preflight'ın `1.5` mirası),
  41 `font-weight`, 21 `font-size`, 27 `padding`/`margin`, 14 `font-family` (form denetimleri
  `Arial`'a düştü), 6 `border-color`. Yani Tailwind'in katkısı ~2 KB değil; kaldırılması
  Preflight'ın hesaplanmış sonucunu birebir üreten elle yazılmış bir taban sıfırlama
  gerektiriyor. Bu blok `@layer base` içinde yazıldı, çünkü Tailwind de Preflight'ı orada
  yayınlıyordu ve kaskad düzeninin korunması gerekiyor.
- E2E'de 43 seçici CSS sınıf adına, 145'i rol/metin'e bağlı.
- CI `ubuntu-latest`'te E2E koşuyor; geliştirme Windows'ta yapılıyor.

### Kullanıcının verdiği kararlar

1. Teknoloji: **Tailwind kaldırılacak**, token katmanı CSS değişkenleriyle kurulacak.
2. Görsel sözleşme: A bitince **ekran hiç değişmemeli**. Görsel yenilenme B'nin işi.
3. Doğrulama: **hesaplanmış stil karşılaştırması** (platformdan bağımsız, CI'da çalışır).
4. Sınıf adlandırması: A'da **dokunulmayacak**; 43 E2E seçicisi sağlam kalacak. D'ye bırakıldı.

### Reddedilen yaklaşımlar

- **Miras değişkenleri yeni tokenlere bağlamak.** Piksel sözleşmesi altında imkânsız: `--mint`
  (`#5eead4`) ile `--pg-success` (`#16765f`) aynı renk değil. A üç paleti tek *değer kümesine*
  indiremez, yalnız tek *yere* toplayabilir.
- **`@layer` ile kaskadı yeniden sıralamak.** Gerçek bir iyileştirme ama `@layer` özgüllük
  çözümlemesini değiştirir; yanlış katmanlanan tek kural sessiz piksel kayması yapar. C veya D'de.
- **`styles.css`'i bileşen başına dosyalara bölmek.** D'de bileşenler zaten elden geçerken doğal
  olarak yapılacak; şimdi yapmak aynı kuralları iki kez taşımak olur.
- **Global seçicileri kabuk sınıflarına kapsamlamak.** `.loading`, `.toast`, `.skip-link` ve
  diyaloglar `App.tsx`'te kabukların *dışında*, `<StartScreen>`/`<Workspace>` ile kardeş render
  ediliyor; `.loading` hiçbir kabuk yokken tek başına render ediliyor. Kapsamlama bu yüzeyleri
  kırardı.

## Hedefler

- `styles.css`'te tek `:root` kalır; üç palet tek yerde, biri ürün tokeni biri miras olarak
  etiketlenmiş şekilde toplanır.
- Her global eleman seçicisi (`body`, `textarea`, `select`, `h1` …) **tek kez** tanımlanır ve
  bugün kazanan değeri taşır.
- JSX'te kullanılmayan 60 sınıf ve kullanılmayan 2 değişken silinir.
- Tailwind bağımlılığı, vite eklentisi ve `@import` kalkar.
- `index.html`'deki bayat `theme-color` düzeltilir.
- Bütün bunların ekranı değiştirmediği otomatik olarak kanıtlanır.

## Kapsam dışı

- Renk paleti, tipografi ölçeği, ikon dili — **B**.
- Yerleşim, sekme ve panel yapısı — **C**.
- Sınıf adlandırması, bileşen başına CSS dosyaları, E2E seçicilerinin `data-testid`'e taşınması — **D**.
- `h1`'in `clamp(43px,7vw,82px)` boyutunun doğru olup olmadığı. A onu korur; yargı B'nin.

## Tasarım

### 1. Token katmanı

`styles.css`'in başında tek `:root`, iki bölümlü:

```css
:root {
  color-scheme: light;

  /* Ürün tokenleri — B bu değerleri değiştirecek. */
  --pg-bg:#f7f7f5;
  --pg-surface:#ffffff;
  /* … mevcut 19 --pg-* token, değerleri aynen … */

  /*
   * MİRAS — 246 yerde kullanılıyor, B'de çözülecek.
   * Değerler bilerek aynen korunuyor: bunları --pg-* karşılıklarına bağlamak
   * rengi değiştirir (--mint #5eead4 ≠ --pg-success #16765f) ve A'nın
   * "ekran değişmesin" sözleşmesini bozar.
   */
  --line:#273149;
  --muted:#8d98ae;
  /* … hâlâ kullanılan 18 miras değişken … */
}
```

`color-scheme` tek yerde tanımlanır. Bugün satır 3 `dark` yazıp satır 555 `light` ile eziyor;
sonuç `light`, o korunur.

Silinen değişkenler: `--panel-2`, `--studio-surface` (sıfır referans).

### 2. Global eleman kuralları

Bugün çok kez tanımlanan her eleman tek tanıma iner. Hangi değerin korunacağı ölçümle
belirlenir — *kazanan kural bugün ekranda görünendir*, dosyadaki ilk tanım değil:

| Eleman | Bugünkü tanım sayısı | Korunacak kaynak |
| --- | --- | --- |
| `body` | 3 (satır 6, 556, 627) | Sonuncunun kazandığı bileşik değer |
| `textarea` | 2 (satır 26, 559) | Satır 559 |
| `select` | 2 (satır 45, 559) | Satır 559 |
| `h1` | 1 (satır 21) | Aynen |
| `*`, `html`, `img,svg`, `button` | 1 | Aynen |

Bileşik durumlar (örn. `body`'nin `background`'u bir kuraldan, `color`'u başkasından geliyorsa)
doğrulama harness'ının referansına bakılarak çözülür: hedef, hesaplanmış değerin aynı kalmasıdır,
kuralın hangi satırdan geldiği değil.

Kapsamlama yapılmaz (gerekçe: "Reddedilen yaklaşımlar").

### 3. Ölü CSS

JSX'te hiç kullanılmayan 60 sınıfın kuralları silinir. Liste uygulama sırasında yeniden üretilir
(sınıf adı JSX'te `\b<ad>\b` olarak aranır), çünkü bu spec ile uygulama arasında kod değişebilir.

Dinamik olarak birleştirilen sınıf adları (`` `is-${status}` `` gibi) bu aramada görünmez. Bu risk
doğrulama harness'ı tarafından karşılanır: yanlışlıkla silinen canlı bir sınıf, o elemanın
hesaplanmış stilini değiştirir ve test düşer.

### 4. Tailwind'in kaldırılması

- `package.json`: `tailwindcss` ve `@tailwindcss/vite` bağımlılıktan çıkar.
- `vite.config.ts`: `tailwindcss()` eklentisi ve import'u kalkar.
- `styles.css`: `@import "tailwindcss"` kalkar.
- `LiveAnnouncer.tsx`: `sr-only fixed -top-96 -left-96 w-1 h-1 overflow-hidden opacity-0
  pointer-events-none` → tek sınıf `pg-sr-only`, karşılığı `styles.css`'te yazılır ve aynı
  hesaplanmış sonucu üretir.

### 5. `index.html`

`<meta name="theme-color" content="#0b1020">` → `#f7f7f5` (`--pg-bg` değeri). Bugünkü değer eski
koyu temadan kalma ve uygulama açık temada.

Dosyanın geri kalanı doğru: CSP, viewport, `lang="tr"` (`I18nProvider` çalışma anında
`document.documentElement.lang` değerini zaten güncelliyor).

## Doğrulama

### Harness

`tests/e2e/visual-contract.spec.ts` — her anahtar ekranda DOM'daki **tüm elemanları** belge
sırasında gezer ve her biri için şunları kaydeder:

- `tagName`, `className`
- Hesaplanmış özellikler: `color`, `background-color`, `font-family`, `font-size`, `font-weight`,
  `line-height`, `letter-spacing`, `border-width`, `border-color`, `border-radius`, `padding`,
  `margin`, `gap`, `box-shadow`, `opacity`

El seçimi seçici listesi kullanılmaz; hiçbir eleman gözden kaçmaz. Markup A'da değişmediği için
belge sırası kararlıdır.

Kapsanan ekranlar:

1. Başlangıç ekranı (sağlayıcı yok)
2. Stüdyo — Geliştir görünümü
3. Stüdyo — Keşif sekmesi (kartlar görünürken)
4. Stüdyo — Özet sekmesi
5. Rehber görünümü
6. Plan görünümü
7. Sağlayıcı ayarları diyaloğu
8. `.toast` görünürken

Bu durumlara sürüş için mevcut E2E yardımcıları (`stubReadyProvider`, `stubExpansionProvider`,
`startIdea`) kullanılır.

### Referans

Referans **A'nın hiçbir CSS değişikliğini içermeyen** ilk commit'te üretilir ve
`tests/e2e/visual-contract.baseline.json` olarak commit'lenir. Bu ayrım şart: referans, değişmiş
bir durumu yakalarsa sözleşmenin tamamı çürür.

### Başarısızlık mesajı

Fark, özelliği adıyla bildirir:

```
Ekran: Stüdyo — Keşif sekmesi
Eleman #142  textarea.pg-composer-input
  background-color  beklenen rgb(255,255,255)   gelen rgb(11,17,32)
                    ^ satır 26 (koyu kuşak) yeniden kazandı
```

### Kabul ölçütü

Bütün ekranlarda hesaplanmış stil farkı **sıfır**. Ayrıca mevcut kapılar yeşil kalmalı:
`npx tsc --noEmit`, `npm run test:all`, `npm run lint` (0 hata), `npm run check:product-docs`,
`npm run build`, `npm run test:e2e`.

`npm run verify` bu makinede tam koşmuyor (cargo kurulu değil, Rust kapıları atlanıyor); kapılar
tek tek elle koşulur.

## Riskler ve geri alma

| Risk | Karşılık |
| --- | --- |
| Referans yanlış anı yakalar | Referans commit'i CSS değişikliği içermez |
| Dinamik sınıf adı ölü sanılıp silinir | Harness o elemanın stil farkını yakalar |
| Bileşik global kural yanlış çözülür | Harness yakalar; hedef hesaplanmış değerdir |
| Tailwind kaldırılınca `sr-only` bozulur | `pg-sr-only` harness kapsamında: `LiveAnnouncer` yalnız `notice` doluyken render ediliyor, bu yüzden 8. ekran (`.toast` görünürken) onu da yakalar |

Geri alma: A yalnız `styles.css`, `vite.config.ts`, `package.json`, `index.html` ve
`LiveAnnouncer.tsx` dosyalarına dokunur. Uygulama mantığına dokunmaz; `git revert` yeterlidir.

## Sonraki adım

A tamamlandığında B (görsel dil) brainstorm'u açılır. B'nin işi bu spec'te kurulan token
katmanının *değerlerini* değiştirmek ve miras bloğunu boşaltmaktır; yapıyı değil.
