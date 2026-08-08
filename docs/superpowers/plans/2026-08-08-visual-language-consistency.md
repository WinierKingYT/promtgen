# Görsel Dil Tutarlılığı (Alt Proje B) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/react/styles.css`'teki altı koyu yüzeyi ve 96 miras `var()` çağrısını `pg-*` diline çevirmek; ekranda koyu kuşak yüzeyi bırakmamak.

**Architecture:** Renk renk karar verilmez. Gözlenen 162 renk bildirimi sekiz aileye iniyor; her aile tek bir `pg` tokenine eşleniyor (aşağıdaki **Renk ailesi tablosu**). Her görev tek bir yüzeyi çevirir, görsel sözleşme farkını üç kovaya ayırır, referansı aynı commit'te günceller.

**Tech Stack:** Düz CSS değişkenleri, Vite 7, React 19, Playwright (chromium).

## Global Constraints

- **Yalnız `src/react/styles.css` değişir.** Uygulama mantığına, markup'a, sınıf adlarına dokunulmaz. Tek istisna yok.
- **`--pg-*` token değerleri değişmez.** B onları kullanır, yeniden tanımlamaz.
- **Yeni token eklenmez.** Karşılığı olmayan yerlerde `color-mix()` kullanılır (kod tabanında zaten var: `.pg-onboarding-shell button:focus-visible`).
- **`!important` korunur.** Bir bildirimde varsa, hedefinde de kalır.
- **Yerleşim bildirimlerine dokunulmaz** — `padding`, `border-radius`, `width`, `position`, `display`, `gap`, `font-size` aynen kalır. Yalnız renk taşıyan bildirimler değişir: `background`, `background-color`, `border-color`, `border`in renk kısmı, `color`, `box-shadow`, `accent-color`.
- **Görsel sözleşme her görevde bilerek düşer.** Farklar üç kovaya ayrılır: (1) dokunulan yüzeyde ve hedef aileye uygun → kabul; (2) dokunulan yüzeyde beklenmedik yönde → incele; (3) **dokunulmayan yüzeyde → sızıntı, commit'ten önce çözülür.**
- Yorumlar ve kullanıcıya görünen metin **Türkçe**. Commit mesajları Türkçe, conventional-commit biçiminde, ASCII gövdeli (depo deseni).
- Her görev sonunda şu kapılar yeşil olmalı: `node node_modules/typescript/bin/tsc --noEmit`, `node scripts/run-v4-tests.mjs` (348 test), `node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx` (0 hata), `node node_modules/tsx/dist/cli.mjs scripts/product-docs.ts --check`, `node node_modules/vite/bin/vite.js build`, `node node_modules/@playwright/test/cli.js test` (32 test).
- `npm run verify` bu makinede tam koşmaz (cargo kurulu değil); kapılar tek tek koşulur.
- E2E önce `node node_modules/vite/bin/vite.js build` ister — Playwright `dist/`i sunar, kaynağı değil. Build atlanırsa test eski CSS'i ölçer ve yanıltır.

### Renk ailesi tablosu

Bu tablo bütün görevler için geçerlidir. Gözlenen her koyu renk bu sekiz aileden birine düşer.

| Aile | Gözlenen değerler | Hedef |
| --- | --- | --- |
| **Panel yüzeyi** | `#0e1422` `#0d1422` `#101827` `#111827` `#161d2d` `#171f30` `#101225` `#0b1220` `#0c1320` `#121a2a` | `var(--pg-surface)` |
| **Gömülü yüzey** (girdi, tuval, iç kart) | `#0a1020` `#191d31` `#171d2d` `#111a2a` | `var(--pg-surface-soft)` |
| **Kenarlık** | `#3c4761` `#4b5670` `#4a5570` `#334155` `#273149` | `var(--pg-border)` |
| **Gövde metni** | `#e8ecf7` `#eef1fb` `#e5e9f2` `#eef1f8` `#d9e0ed` | `var(--pg-text)` |
| **İkincil metin** | `#7f8a9f` `#828da2` `#aab3c5` `#cbd2df` `#cbd3e2` `#8d99af` `#8f9ab0` `#758197` `#c7cfdd` `#858fa4` `#aab4c7` `#aeb8cc` `#b4bdcc` | `var(--pg-muted)` |
| **Olumlu** | zemin `#112623` `#18342f` `#174139` `#133029` `#17342e` · kenarlık `#2c5f59` `#4d8178` `#397468` `#3d776f` · metin `#c5fff5` `#83d7c9` `#80aaa4` `#8ce6d6` `#b9f8ee` | zemin `var(--pg-success-soft)` · kenarlık `var(--pg-success)` · metin `var(--pg-success)` |
| **Hata** | zemin `#3a2029` `#672c3a` `#321b24` `#351b24` `#321a22` · kenarlık `#8f4353` `#814657` `#684553` · metin `#f6a9b7` `#fff1f4` `#d995a2` `#f5c0c9` `#fda4af` `#ffc1cc` `#937b83` | zemin `var(--pg-danger-soft)` · kenarlık `var(--pg-danger)` · metin `var(--pg-danger)` |
| **Vurgu** | zemin `#2d2853` `#1b1c37` `#17162d` `#1b2137` `#23213f` · kenarlık `#685eb0` `#554e8d` `#7166c5` `#7369c7` `#514c84` · metin `#dedaff` | zemin `var(--pg-accent-soft)` · kenarlık `var(--pg-accent)` · metin `var(--pg-accent)` |
| **Uyarı** | zemin `#211c10` · kenarlık `#765f31` · metin `#e7c66f` | zemin `var(--pg-warning-soft)` · kenarlık `var(--pg-warning)` · metin `var(--pg-warning)` |

**Dört özel durum — tablo dışı, tek tek yazılmış:**

| Desen | Gözlenen | Hedef | Gerekçe |
| --- | --- | --- | --- |
| Gölge | `0 40px 120px #000c` · `0 20px 50px #0008` · `20px 0 70px #000b` | `var(--pg-shadow)` | Opak siyah açık zeminde kir gibi durur |
| Diyalog perdesi | `#050711c9` · `#050711d9` | `rgba(24,32,27,.45)` | `--pg-shadow`'un rgb'siyle aynı aile; `backdrop-filter: blur(5px)` korunur |
| Yapışkan başlık/eylem şeridi | `#0e1422f2` | `rgba(255,255,255,.95)` | Yarı saydamlık ve `backdrop-filter: blur(12px)` kasıtlı; yalnız rengi döner |
| Vurgulu üzerine-gelme | `#7a3445` (hata), `#111a2a` (nötr) | `color-mix(in srgb, var(--pg-danger) 14%, #fff)` · `var(--pg-surface-soft)` | `pg` dilinde hata-hover tokeni yok; yeni token eklenmez |

**Neon parıltılar kaldırılır.** `box-shadow:0 0 10px var(--mint)` ve `box-shadow:0 0 8px #5eead4aa` gibi bildirimler tamamen silinir — açık zeminde parıltı okunmaz. Vurgu gerekiyorsa `background: var(--pg-accent-soft)` kullanılır.

---

## Dosya Yapısı

**Değiştirilecek:** yalnız `src/react/styles.css` ve `tests/e2e/visual-contract.baseline.json`.

| Dosya | Ne değişir |
| --- | --- |
| `src/react/styles.css` | Görev 1–2: miras `var()` çağrıları. Görev 3–8: altı yüzeyin renk bildirimleri. Görev 9: miras `:root` bloğu silinir, font stack'i tekilleşir |
| `tests/e2e/visual-contract.baseline.json` | Her görevde `UPDATE_VISUAL_BASELINE=1` ile yeniden üretilir |

**Yeni dosya oluşturulmaz.** Test altyapısı A'da kuruldu ve yeterli.

---

## Task 1: Miras değişkenleri `pg` karşılıklarına bağla

Bu görev **hiçbir yargı içermez**. Her değişkenin rolü ölçüldü ve tek anlamlı: her biri tek bir CSS özelliğinde kullanılıyor.

**Files:**
- Modify: `src/react/styles.css`

**Interfaces:**
- Consumes: A'nın kurduğu tek `:root` token katmanı
- Produces: `--line`, `--muted`, `--violet`, `--violet-2`, `--danger`, `--panel` ve `--studio-*` çağrısı kalmamış bir stil dosyası; `--mint` bilerek Görev 2'ye bırakılır

- [ ] **Step 1: Kullanılmayan dört değişkeni sil**

`:root` bloğundan şu dört satır silinir — hiçbir yerde `var()` ile çağrılmıyorlar (Step 5'te kanıtlanır):

```
  --bg:#090d18;
  --studio-canvas:#f5f6f2;
  --studio-accent-strong:#0e5748;
  --studio-danger:#b43d42;
```

- [ ] **Step 2: Tek anlamlı değişken çağrılarını değiştir**

Aşağıdaki değişimler dosyanın tamamında yapılır. Her biri düz metin değişimi; hiçbiri bağlam gerektirmez.

| Ara | Değiştir | Kullanım |
| --- | --- | --- |
| `var(--line)` | `var(--pg-border)` | 34 |
| `var(--muted)` | `var(--pg-muted)` | 12 |
| `var(--violet-2)` | `var(--pg-accent)` | 5 |
| `var(--violet)` | `var(--pg-accent)` | 5 |
| `var(--danger)` | `var(--pg-danger)` | 2 |
| `var(--panel)` | `var(--pg-surface)` | 1 |
| `var(--studio-text)` | `var(--pg-text)` | 6 |
| `var(--studio-line)` | `var(--pg-border)` | 6 |
| `var(--studio-accent)` | `var(--pg-accent)` | 5 |
| `var(--studio-muted)` | `var(--pg-muted)` | 2 |
| `var(--studio-shadow)` | `var(--pg-shadow)` | 1 |
| `var(--studio-muted-surface)` | `var(--pg-surface-soft)` | 1 |
| `var(--studio-accent-soft)` | `var(--pg-accent-soft)` | 1 |

`--violet-2` (`#b0a5ff`) koyu zeminde okunsun diye **açık** tondu. Açık zeminde doğru karşılık koyu mor `--pg-accent`'tir, `--pg-accent`'in açık tonu değil — bu yüzden `--violet` ile aynı hedefe gider.

`--studio-*` ailesi zaten açık tema; bunlar renk değişimi değil, tek kaynağa toplama.

- [ ] **Step 3: Miras değişken tanımlarını sil**

Yukarıdaki 13 değişkenin `:root` içindeki tanımları da silinir. `--mint` tanımı **kalır** — Görev 2 onu kullanacak.

- [ ] **Step 4: Derle ve sözleşmeyi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: **FAIL**, çok sayıda farkla. Bu doğru davranış — sözleşme B'de değişimi bildirir, engellemez.

Farkları üç kovaya ayır. Bu görevde beklenen fark yönleri:

- `border-color` `rgb(39, 49, 73)` → `rgb(226, 229, 225)` (`--line` → `--pg-border`)
- `color` `rgb(141, 152, 174)` → `rgb(102, 112, 106)` (`--muted` → `--pg-muted`)
- `color`/`border-color` `rgb(176, 165, 255)` ve `rgb(139, 124, 246)` → `rgb(91, 66, 214)` (violetler → `--pg-accent`)
- `color` `rgb(251, 113, 133)` → `rgb(184, 50, 69)` (`--danger` → `--pg-danger`)

Bu dört yönün dışında bir fark varsa dur ve incele.

- [ ] **Step 5: Miras çağrısının gerçekten bittiğini kanıtla**

```bash
grep -c "var(--line)\|var(--muted)\|var(--violet)\|var(--violet-2)\|var(--danger)\|var(--panel)\|var(--studio-" src/react/styles.css
```

Beklenen: `0`.

```bash
grep -c "\-\-bg:\|--studio-canvas:\|--studio-accent-strong:\|--studio-danger:" src/react/styles.css
```

Beklenen: `0`.

- [ ] **Step 6: Referansı güncelle**

```bash
UPDATE_VISUAL_BASELINE=1 node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

İkinci koşu PASS olmalı.

- [ ] **Step 7: Bütün kapıları koştur**

```bash
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-v4-tests.mjs
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/tsx/dist/cli.mjs scripts/product-docs.ts --check
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

Beklenen: tsc çıktısız, 348 birim testi, lint 0 hata, ürün belgeleri eşleşir, build başarılı, 32 E2E testi geçer.

- [ ] **Step 8: Commit**

```bash
git add src/react/styles.css tests/e2e/visual-contract.baseline.json
git commit -m "refactor(css): tek anlamli miras degiskenleri pg karsiliklarina bagla

Kullanilmayan dort miras degisken silindi (--bg, --studio-canvas,
--studio-accent-strong, --studio-danger). Kalan 13'unun rolu olculdu ve
tek anlamli cikti: her biri tek bir CSS ozelliginde kullaniliyordu.

--violet-2 (#b0a5ff) koyu zeminde okunsun diye acik tondu; acik zeminde
dogru karsilik koyu mor --pg-accent, onun acik tonu degil.

--mint bilerek disarida birakildi: 15 kullanimi vurgu ve olumlu durum
arasinda bolunuyor, bu bir yargi karari ve kendi commit'ini hak ediyor.

Gorsel sozlesme bilerek dustu ve referans guncellendi. Farklar dort
beklenen yonde: --line -> --pg-border, --muted -> --pg-muted, violetler
-> --pg-accent, --danger -> --pg-danger. Dokunulmayan yuzeyde fark yok.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `--mint`'i kullanım rolüne göre ayır

Bu görev **tamamen yargıdır**. Görev 1 ile karışsaydı, mekanik bir eşlemenin yol açtığı gerileme ile bilinçli bir renk kararı aynı commit'te ayırt edilemezdi.

**Files:**
- Modify: `src/react/styles.css`

**Interfaces:**
- Consumes: Görev 1'in temizlediği değişken katmanı
- Produces: `var(--mint)` çağrısı ve `--mint` tanımı kalmamış stil dosyası

- [ ] **Step 1: Bütün kullanım yerlerini listele**

```bash
grep -n "var(--mint)\|#5eead4" src/react/styles.css
```

Beklenen: 15 `var(--mint)` çağrısı, artı `#5eead4aa` içeren bir parıltı.

- [ ] **Step 2: Her kullanımı ölçüte göre karara bağla**

Ölçüt tek: **vurgu mu, olumlu durum mu?**

| Kullanım | Rol | Hedef |
| --- | --- | --- |
| `.loading svg` | yükleme göstergesi — durum bildirmiyor | `var(--pg-accent)` |
| `.project-list .active .project-dot` | etkin proje işareti | `var(--pg-accent)` |
| `.effort-low` | düşük efor — olumlu ölçek değeri | `var(--pg-success)` |
| `.privacy-pill span` | gizlilik olumlu durumu | `var(--pg-success)` |
| `.idea-history-list em` | olumlu vurgu | `var(--pg-success)` |
| `.privacy-callout` | gizlilik güvencesi | `var(--pg-success)` |
| `.resolved-label` | çözüldü işareti | `var(--pg-success)` |
| `.preview-icon`, `.preview-count b` | önizleme sayacı vurgusu | `var(--pg-accent)` |

Listede olmayan kullanımlar aynı ölçütle karara bağlanır ve **her biri commit mesajında adıyla yazılır**. Ölçüt uygulanamıyorsa dur ve sor — tahmin etme.

- [ ] **Step 3: Parıltıları sil**

Şu iki bildirim tamamen silinir (yalnız `box-shadow` kısmı; kuralın geri kalanı kalır):

```
box-shadow:0 0 10px var(--mint)      → .project-list .active .project-dot
box-shadow:0 0 8px #5eead4aa         → .privacy-pill span
```

Koyu tema idiomu; açık zeminde parıltı okunmaz, kirli bir hâle bırakır.

- [ ] **Step 4: `--mint` tanımını sil**

`:root`'tan `--mint:#5eead4;` satırı silinir.

- [ ] **Step 5: Derle, sözleşmeyi koştur, farkları ayır**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen fark yönleri: `color` `rgb(94, 234, 212)` → ya `rgb(91, 66, 214)` (vurgu) ya `rgb(22, 118, 95)` (olumlu); ve iki elemanda `box-shadow` → `none`.

Üçüncü kova (dokunulmayan yüzey) boş olmalı.

- [ ] **Step 6: Kalıntı kontrolü**

```bash
grep -c "mint\|5eead4" src/react/styles.css
```

Beklenen: `0`.

- [ ] **Step 7: Referansı güncelle ve bütün kapıları koştur**

```bash
UPDATE_VISUAL_BASELINE=1 node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-v4-tests.mjs
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/tsx/dist/cli.mjs scripts/product-docs.ts --check
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

- [ ] **Step 8: Commit**

Commit mesajında **her kullanımın hangi hedefe neden gittiği** tek tek yazılır. "Role göre ayrıldı" demek yetmez; karar burada kayda geçer.

---

## Task 3: Toast

En küçük gerçek yüzey ama beş ekranda görünür — yöntemi en geniş kanıtla erken sınar.

**Files:**
- Modify: `src/react/styles.css` — `.toast` ve `.toast.error`

**Interfaces:**
- Consumes: Görev 1–2'nin temizlediği değişken katmanı
- Produces: `pg` dilinde bir bildirim yüzeyi

- [ ] **Step 1: Bugünkü hâli oku**

```bash
grep -n "\.toast" src/react/styles.css
```

Bugünkü iki renk bildirimi kümesi:

```css
.toast { … border:1px solid #3d776f; background:#132724; color:#b9f8ee; box-shadow:0 20px 50px #0008; … }
.toast.error { border-color:#814657; background:#321a22; color:#ffc1cc; }
```

- [ ] **Step 2: Renk bildirimlerini değiştir**

Yerleşim bildirimlerine (`position`, `right`, `bottom`, `z-index`, `display`, `align-items`, `gap`, `padding`, `border-radius`, `font-size`) dokunulmaz.

```css
.toast { … border:1px solid var(--pg-success); background:var(--pg-success-soft); color:var(--pg-success); box-shadow:var(--pg-shadow); … }
.toast.error { border-color:var(--pg-danger); background:var(--pg-danger-soft); color:var(--pg-danger); }
```

Varsayılan toast olumlu ailesine gider: uygulamada başarı bildirimi olarak kullanılıyor, hata varyantı ayrı sınıfla işaretleniyor.

- [ ] **Step 3: Derle ve sözleşmeyi koştur**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Beklenen: `toast-ve-duyurucu` ekranında `.toast` elemanında `background-color`, `border-color`, `color`, `box-shadow` farkları. Başka ekranda `.toast` görünmüyorsa fark da yok.

- [ ] **Step 4: Ölçülmeyen durumu elle doğrula**

`.toast.error` sözleşmenin **hiçbir ekranında** render edilmiyor. Bu yüzden testin sessizliği kanıt değil. Kuralı gözle oku ve iki şeyi doğrula: `border-color`, `background` ve `color`'ın üçü de değişti; `.toast`'tan miras alınan `box-shadow` artık `var(--pg-shadow)`.

- [ ] **Step 5: Referansı güncelle ve bütün kapıları koştur**

```bash
UPDATE_VISUAL_BASELINE=1 node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-v4-tests.mjs
node node_modules/eslint/bin/eslint.js src/v4 src/react tests/v4 --ext .js,.ts,.tsx
node node_modules/tsx/dist/cli.mjs scripts/product-docs.ts --check
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test
```

- [ ] **Step 6: Commit**

```bash
git add src/react/styles.css tests/e2e/visual-contract.baseline.json
git commit -m "refactor(css): bildirim yuzeyini pg diline cevir

Varsayilan toast olumlu ailesine gitti (--pg-success-soft zemin,
--pg-success kenarlik ve metin); hata varyanti hata ailesine. Opak siyah
golge (0 20px 50px #0008) --pg-shadow oldu.

.toast.error sozlesmenin hicbir ekraninda render edilmiyor; kurali gozle
dogrulandi, testin sessizligi kanit sayilmadi.

Gorsel sozlesme bilerek dustu ve referans guncellendi. Dokunulmayan
yuzeyde fark yok.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Sağlayıcı ayarları diyaloğu

32 renk bildirimi, 44 kural. Kendi içinde kapalı bir yüzey.

**Files:**
- Modify: `src/react/styles.css` — `.provider-dialog`, `.dialog-head`, `.dialog-icon`, `.dialog-actions`, `.memory-toggle`, `.privacy-callout`, `.provider-options`, `.provider-fields`, `.confirm-dialog`, `.recovery-dialog`

- [ ] **Step 1: Yüzeyin renk envanterini çıkar**

```bash
grep -oE "\.(provider-dialog|dialog-head|dialog-icon|dialog-actions|memory-toggle|privacy-callout|provider-options|provider-fields|confirm-dialog|recovery-dialog)[^{]*\{[^}]*\}" src/react/styles.css
```

- [ ] **Step 2: Renk ailesi tablosunu uygula**

Her bildirim Global Constraints'teki tabloya göre çevrilir. Bu yüzeydeki eşlemeler:

| Bugünkü | Hedef | Nerede |
| --- | --- | --- |
| `background:#0e1422` | `background:var(--pg-surface)` | `.provider-dialog`, `.confirm-dialog` |
| `background:#0d1422` | `background:var(--pg-surface)` | `.recovery-dialog` |
| `background:#0e1422f2` | `background:rgba(255,255,255,.95)` | `.dialog-head`, `.dialog-actions` |
| `background:#050711c9` / `#050711d9` | `background:rgba(24,32,27,.45)` | `::backdrop` |
| `background:#0a1020` | `background:var(--pg-surface-soft)` | `.provider-fields input` |
| `background:#101827` | `background:var(--pg-surface)` | `.memory-toggle` |
| `background:#111827` | `background:var(--pg-surface)` | `.provider-options label` |
| `background:#161d2d` | `background:var(--pg-surface)` | `.dialog-actions button` |
| `background:#112623` + `border:1px solid #2c5f59` | `background:var(--pg-success-soft)` + `border:1px solid var(--pg-success)` | `.privacy-callout` |
| `background:#18342f` | `background:var(--pg-success-soft)` | `.provider-options em` |
| `background:#174139` + `border-color:#4d8178` + `color:#c5fff5` | `var(--pg-success-soft)` + `var(--pg-success)` + `var(--pg-success)` | `.recovery-dialog .dialog-actions .primary` |
| `background:#1b1c37` + `border-color:#685eb0` | `background:var(--pg-accent-soft)` + `border-color:var(--pg-accent)` | `.provider-options label.active` |
| `background:#2d2853` | `background:var(--pg-accent-soft)` | `.dialog-icon` |
| `background:#3a2029` + `color:#f6a9b7` | `background:var(--pg-danger-soft)` + `color:var(--pg-danger)` | `.dialog-icon.warning` |
| `background:#672c3a` + `border-color:#8f4353` + `color:#fff1f4` | `var(--pg-danger-soft)` + `var(--pg-danger)` + `var(--pg-danger)` | `.dialog-actions .danger` |
| `background:#7a3445` | `background:color-mix(in srgb, var(--pg-danger) 14%, #fff)` | `.dialog-actions .danger:hover` |
| `border:1px solid #3c4761` | `border:1px solid var(--pg-border)` | `.provider-dialog` |
| `border:2px solid #56617a` + `box-shadow:inset 0 0 0 3px #111827` | `border:2px solid var(--pg-border-strong)` + `box-shadow:inset 0 0 0 3px var(--pg-surface)` | `.provider-radio` |
| `box-shadow:0 40px 120px #000c` | `box-shadow:var(--pg-shadow)` | diyaloglar |
| `color:#e8ecf7` / `#eef1fb` | `color:var(--pg-text)` | diyalog gövdeleri |
| `color:#7f8a9f` / `#828da2` / `#aab3c5` / `#cbd2df` / `#cbd3e2` / `#80aaa4` / `#b4bdcc` | `color:var(--pg-muted)` | ikincil metinler |

- [ ] **Step 3: Derle, sözleşmeyi koştur, farkları ayır**

```bash
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/visual-contract.spec.ts
```

Farkların **tamamı** `ayarlar-diyaloğu` ekranında olmalı. Başka ekranda fark çıkarsa sızıntıdır: büyük olasılıkla `.dialog-head`, `.dialog-actions` ya da `.primary` gibi bir sınıf başka yüzeyde de kullanılıyordur. Dur, hangi yüzey olduğunu bul, o bildirimi kapsamla ya da o yüzeyi de bu göreve kat.

- [ ] **Step 4: Ölçülmeyen durumları elle doğrula**

`.confirm-dialog`, `.recovery-dialog` ve `.dialog-icon.warning` sözleşmede render edilmiyor. Kurallarını gözle oku; koyu değer kalmadığını doğrula.

- [ ] **Step 5: Referansı güncelle ve bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı.

- [ ] **Step 6: Commit**

Commit mesajında hangi ailelerin kullanıldığı ve ölçülmeyen üç durumun gözle doğrulandığı yazılır.

---

## Task 5: Fikir → plan dönüşümü

13 renk bildirimi, 27 kural, 3 ekranda görünür.

**Files:**
- Modify: `src/react/styles.css` — `.idea-conversion`, `.idea-conversion-blockers`, `.idea-conversion-preview`

- [ ] **Step 1: Renk bildirimlerini değiştir**

| Bugünkü | Hedef | Nerede |
| --- | --- | --- |
| `background:#17162d!important` + `border-color:#554e8d!important` | `background:var(--pg-accent-soft)!important` + `border-color:var(--pg-accent)!important` | `.idea-conversion` |
| `background:#211c10` + `border:1px solid #765f31` + `color:#e7c66f` | `background:var(--pg-warning-soft)` + `border:1px solid var(--pg-warning)` + `color:var(--pg-warning)` | `.idea-conversion-blockers` |
| `background:#101225` + `border:1px solid #7166c5` | `background:var(--pg-surface)` + `border:1px solid var(--pg-accent)` | `.idea-conversion-preview` |
| `background:#171d2d` + `color:#aab4c7` | `background:var(--pg-surface-soft)` + `color:var(--pg-muted)` | `.idea-conversion-preview header button` |
| `background:#191d31` | `background:var(--pg-surface-soft)` | `.idea-conversion-preview dl div` |
| `color:#858fa4` | `color:var(--pg-muted)` | `dt`, `footer span` |
| `color:#aeb8cc` | `color:var(--pg-muted)` | `>ul` |
| `color:#eef1f8` | `color:var(--pg-text)` | `dd` |

`!important` iki bildirimde korunur — kaldırmak kapsam dışı bir davranış değişikliği olurdu.

`.idea-conversion-blockers` uyarı ailesine gider: dönüşümü engelleyen konuları sayıyor, hata değil eksik bildiriyor.

- [ ] **Step 2: Derle, sözleşmeyi koştur, farkları ayır**

Farklar `fikir-özeti`, `fikir-özeti-düzenleyici` ve `plan` ekranlarında beklenir.

- [ ] **Step 3: Referansı güncelle ve bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı.

- [ ] **Step 4: Commit**

---

## Task 6: Fikir özeti düzenleyici

33 renk bildirimi, 44 kural.

**Files:**
- Modify: `src/react/styles.css` — `.concept-agreement`, `.interpretation-confidence`, `.confidence-explanation`, `.agreement-ledger`, `.agreement-save`, `.idea-history`, `.idea-history-diff`, `.idea-history-list`

- [ ] **Step 1: Yüzeyin renk envanterini çıkar**

```bash
grep -oE "\.(concept-agreement|interpretation-confidence|confidence-explanation|agreement-ledger|agreement-save|idea-history)[^{]*\{[^}]*\}" src/react/styles.css
```

- [ ] **Step 2: Renk bildirimlerini değiştir**

Bu yüzeyin 33 bildirimi dört aileye düşüyor. Koyu yeşil tonlarının çokluğu yanıltmasın: hepsi olumlu ailesinin koyu tema karşılıkları.

| Bugünkü | Hedef | Aile |
| --- | --- | --- |
| `background:#0d1422` `#171f30` | `background:var(--pg-surface)` | panel |
| `background:#111a2a` | `background:var(--pg-surface-soft)` | gömülü |
| `background:#091315` `#0a1516` `#0e1b1d` `#10241f` `#17342e` | `background:var(--pg-success-soft)` | olumlu |
| `border:1px solid #284743` `#34514f` `#345e56` `#3d776f` · `border-top:1px solid #203735` | `border…:1px solid var(--pg-success)` | olumlu |
| `color:#627c78` `#6ea99f` `#9de5d8` `#9fe5d9` `#a8b9b6` `#aebfbc` | `color:var(--pg-success)` | olumlu |
| `background:#211c10` `#241f11` · `border:1px solid #5d512e` `#725d31` · `color:#a99867` `#e5cc7e` | `var(--pg-warning-soft)` / `var(--pg-warning)` | uyarı |
| `background:#29151c` · `border-color:#9c4f5c` · `color:#e9a6b0` | `var(--pg-danger-soft)` / `var(--pg-danger)` | hata |
| `background:#1b1c38` · `border-color:#7369c7` | `var(--pg-accent-soft)` / `var(--pg-accent)` | vurgu (`.idea-history-list button.active`) |
| `border-top:1px solid #202a3e` | `border-top:1px solid var(--pg-border)` | kenarlık |
| `color:#e4efed` | `color:var(--pg-text)` | gövde |
| `color:#bac3d5` | `color:var(--pg-muted)` | ikincil |

**Fark satırları** (`.idea-history-diff` içindeki eklenen/çıkarılan) anlamsaldır: eklenen → `var(--pg-success-soft)` zemin + `var(--pg-success)` metin; çıkarılan → `var(--pg-danger-soft)` zemin + `var(--pg-danger)` metin.

- [ ] **Step 3: Derle, sözleşmeyi koştur, farkları ayır**

Farkların tamamı `fikir-özeti-düzenleyici` ekranında olmalı.

- [ ] **Step 4: Referansı güncelle ve bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı.

- [ ] **Step 5: Commit**

---

## Task 7: Revizyon geçmişi diyaloğu

22 renk bildirimi, 32 kural.

**Files:**
- Modify: `src/react/styles.css` — `.revision-dialog`, `.revision-body`, `.revision-selectors`, `.revision-summary`, `.revision-actions`, `.restore-confirm`

- [ ] **Step 1: Renk bildirimlerini değiştir**

| Bugünkü | Hedef |
| --- | --- |
| `background:#0d1422` | `background:var(--pg-surface)` |
| `background:#171f30` | `background:var(--pg-surface)` |
| `background:#050711d9` (`::backdrop`) | `background:rgba(24,32,27,.45)` |
| `background:#133029` + `color:#83d7c9` | `background:var(--pg-success-soft)` + `color:var(--pg-success)` |
| `background:#321b24` / `#351b24` | `background:var(--pg-danger-soft)` |
| `border-color:#8f4353` | `border-color:var(--pg-danger)` |
| `border:1px solid #3c4761` / `#4b5670` | `border:1px solid var(--pg-border)` |
| `box-shadow:0 40px 120px #000c` | `box-shadow:var(--pg-shadow)` |
| `color:#e8ecf7` / `#e5e9f2` | `color:var(--pg-text)` |
| `color:#758197` / `#8d99af` / `#8f9ab0` / `#c7cfdd` | `color:var(--pg-muted)` |
| `color:#d995a2` / `#f5c0c9` / `#fda4af` / `#ffc1cc` / `#937b83` | `color:var(--pg-danger)` |

- [ ] **Step 2: Derle, sözleşmeyi koştur, farkları ayır**

Farkların tamamı `revizyon-geçmişi` ekranında olmalı.

- [ ] **Step 3: Referansı güncelle ve bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı.

- [ ] **Step 4: Commit**

---

## Task 8: Gelişmiş plan araçları

55 renk bildirimi, 99 kural — en büyük yüzey. Yöntem beş kez kanıtlandıktan sonra.

**Files:**
- Modify: `src/react/styles.css` — `.storage-health-panel`, `.trace-map`, `.trace-search`, `.trace-canvas`, `.trace-node`, `.trace-detail`, `.scenario-panel`, `.scenario-card`, `.section-regeneration`, `.section-patch`, `.line-diff`, `.plan-code-alignment`

- [ ] **Step 1: Yüzeyin renk envanterini çıkar**

```bash
grep -oE "\.(storage-health-panel|trace-map|trace-search|trace-canvas|trace-node|trace-detail|scenario-panel|scenario-card|section-regeneration|section-patch|line-diff|plan-code-alignment)[^{]*\{[^}]*\}" src/react/styles.css
```

- [ ] **Step 2: Renk ailesi tablosunu uygula**

Panel zeminleri (`#0b1220`, `#0c1320` gibi) `var(--pg-surface)`; gömülü yüzeyler (`.trace-search`, `.trace-canvas`, `#111a2a` üzerine-gelme) `var(--pg-surface-soft)`; kenarlıklar `var(--pg-border)`; gövde `var(--pg-text)`; ikincil `var(--pg-muted)`.

**Fark satırları anlamsal:** `.line-diff .added` → `var(--pg-success-soft)` zemin + `var(--pg-success)` metin; `.line-diff .removed` → `var(--pg-danger-soft)` zemin + `var(--pg-danger)` metin.

**Önem noktası:** `.severity-dot.critical` bugün `background:#f87171` + `box-shadow:0 0 0 3px #f8717121` taşıyor. Hedef: `background:var(--pg-danger)` + `box-shadow:0 0 0 3px var(--pg-danger-soft)`. Bu bir odak halkası değil, önem göstergesi — parıltı kuralına girmez, korunur.

**Senaryo durumları** (`.scenario-card` üzerindeki `${scenario.status}` sınıfları) dinamik üretiliyor. Hangi durum değerlerinin gerçekten üretildiğini ölç:

```bash
grep -rn "status" src/v4/application/planning-scenario-service.ts | head -20
```

Ölçülen her durum için tablo uygulanır; ölçülmeyen bir durum sınıfı varsa dokunulmaz ve commit mesajında adıyla belirtilir.

- [ ] **Step 3: Derle, sözleşmeyi koştur, farkları ayır**

Farkların tamamı `plan-gelişmiş-araçlar` ekranında olmalı. Bu ekran 12 ekranın en kalabalığı; fark sayısı yüksek olacak. **Sayının yüksekliği gerekçe değildir** — her fark bir aileye ait olmalı.

- [ ] **Step 4: Ölçülmeyen durumları elle doğrula**

`.trace-node` durum varyantları ve `.section-patch` durumları sözleşmede tam render edilmiyor olabilir. Kuralları gözle oku.

- [ ] **Step 5: Referansı güncelle ve bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı.

- [ ] **Step 6: Commit**

---

## Task 9: Süpürme

**Files:**
- Modify: `src/react/styles.css`

- [ ] **Step 1: Miras `:root` bloğunu sil**

Görev 1 ve 2'den sonra miras bloğunda tanım kalmamış olmalı. Kalan yorum bloğu da silinir — artık yanlış bir şeyi anlatıyor.

```bash
grep -n "MİRAS\|--studio-\|--violet\|--mint\|--line:" src/react/styles.css
```

Beklenen: `0` eşleşme.

- [ ] **Step 2: Kopya font stack'lerini tekilleştir**

Ölçüldü: iki sans stack'i (biri `BlinkMacSystemFont` içeriyor) ve iki monospace stack'i var. `:root`'taki sans stack'i tek kaynak yapılır; diğer tanım silinir. Monospace için `@layer base` içindeki tanım tek kaynak olur.

Bu mekanik; tipografi **ölçeği** kapsam dışı (spec'te gerekçesiyle yazılı).

- [ ] **Step 3: Ekranda koyu yüzey kalmadığını ölçüyle kanıtla**

Spec'teki ölçümün aynısı. `scripts/` altına yazma — geçici bir dosyada koştur:

```js
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('tests/e2e/visual-contract.baseline.json', 'utf8'));
const lum = (r, g, bb) => 0.2126 * r + 0.7152 * g + 0.0722 * bb;
const parse = v => { const m = String(v).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
const dark = [];
for (const [screen, items] of Object.entries(b)) for (const it of items) {
  for (const prop of ['background-color', 'border-color']) {
    const c = parse(it.styles[prop]); if (!c || c.a === 0) continue;
    if (lum(c.r, c.g, c.b) < 70) dark.push(`${screen} ${it.tag}.${it.className} ${prop}=${it.styles[prop]}`);
  }
}
console.log(dark.length ? dark.join('\n') : 'SIFIR: ekranda koyu yuzey kalmadi');
```

Beklenen: `SIFIR`.

**Bir uyarı:** koyu *metin* rengi (`--pg-text` `#171a18`) doğrudur ve bu ölçüm yalnız `background-color` ile `border-color`'a bakar. Ölçümü `color`'a genişletme — açık zeminde koyu metin zaten olması gereken şeydir.

- [ ] **Step 4: Sabit renk kalıntısını ölç**

```bash
grep -oE '#[0-9a-fA-F]{3,8}\b' src/react/styles.css | sort | uniq -c | sort -rn | head -20
```

Kalan sabit renkler beklenen kısa listeye inmiş olmalı: `#fff` (birincil eylem metni), `rgba(255,255,255,.95)` (yapışkan şerit), `rgba(24,32,27,.45)` (perde) ve `pg` bloğunun kendi birkaç değeri. Uzun bir koyu renk listesi kalmışsa bir yüzey atlanmış demektir — hangisi olduğunu bul ve o görevi tamamla.

- [ ] **Step 5: Bütün kapıları koştur**

Görev 3 Step 5'teki komut dizisinin aynısı. Referans bu görevde değişmemeli: hiçbir görünüm değişikliği yapılmadı, yalnız ölü tanım silindi. Sözleşme **PASS** vermeli.

Sözleşme bu görevde düşerse, silinen bir tanım hâlâ kullanılıyordu demektir. Dur ve bul.

- [ ] **Step 6: Commit**

```bash
git add src/react/styles.css
git commit -m "refactor(css): miras token blogunu sil ve font stack'ini tekillestir

Gorev 1 ve 2 butun miras var() cagrilarini kaldirmisti; geriye kalan
tanimlar ve onlari anlatan yorum blogu silindi.

Iki kopya font stack'i tekillestirildi. Tipografi olcegi kapsam disi
(spec'te gerekcesiyle yazili): ikinci bir yazi tipi dili yok, sorun
olcegin 21 basamakli olmasi ve bu ayri bir tasarim karari.

Ekranda koyu yuzey kalmadigi olculdu: referanstaki butun elemanlarin
background-color ve border-color degerleri tarandi, sonuc sifir.

Gorsel sozlesme bu commit'te DEGISMEDI ve PASS veriyor - yalniz olu tanim
silindi, gorunum degismedi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
