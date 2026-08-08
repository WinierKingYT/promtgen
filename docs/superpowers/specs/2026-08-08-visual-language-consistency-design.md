# Arayüz Yenileme — Alt Proje B: Görsel Dil Tutarlılığı

**Tarih:** 2026-08-08
**Durum:** Onaylandı, uygulanmayı bekliyor
**Öncülü:** [Alt Proje A — CSS Temeli](2026-08-06-ui-foundation-design.md)

## Bağlam

Alt proje A `styles.css`'i tek token katmanına topladı, ölü CSS'i ve Tailwind'i
kaldırdı — ekranın görünümünü hiç değiştirmeden. A'nın bıraktığı yerde uygulama
**iki görsel dil taşıyor**: `pg-*` kabuğu açık temalı (`--pg-bg:#f7f7f5`, beyaz
yüzeyler, mor vurgu, yeşil olumlu), eski blok ise koyu tema için yazılmış
renkleri aynı açık zemine basıyor.

### Ölçüm

Görsel sözleşme referansı (12 ekran, 2.624 eleman) üzerinden ölçüldü:

**Ekranda görünen koyu kuşak renkleri — 12 ekranın 8'inde:**

| Renk | Rol | Göründüğü ekran |
| --- | --- | --- |
| `--line` `#273149` | koyu lacivert kenarlık | ayarlar-diyaloğu, fikir-özeti, plan, fikir-özeti-düzenleyici, plan-gelişmiş-araçlar, revizyon-geçmişi |
| `--mint` `#5eead4` | parlak turkuaz | ayarlar-diyaloğu, fikir-özeti-düzenleyici, plan-gelişmiş-araçlar, revizyon-geçmişi |
| `--muted` `#8d98ae` | soğuk gri metin | 8 ekran |
| `--violet` / `--violet-2` | mor vurgu | ayarlar-diyaloğu, revizyon-geçmişi |
| `--danger` `#fb7185` | koyu tema pembesi | plan-gelişmiş-araçlar, revizyon-geçmişi |

**Sorunun ağırlığı değişkenlerde değil, sabit renklerde:**

- Miras `var()` çağrısı: **96** (A'nın spec'i 301 ölçmüştü; ölü kod ve CSS
  temizliği bunu düşürdü). 4 miras değişken artık hiç kullanılmıyor:
  `--bg`, `--studio-canvas`, `--studio-accent-strong`, `--studio-danger`.
- Eski bloktaki sabit renk kullanımı: **504**, benzersiz değer: **376**.
- Ekranda gerçekten render edilen: **34 farklı koyu arka plan**, **10 farklı
  koyu kenarlık**, **29 sınıf** üzerinden. Bu 29 sınıfın tamamı aşağıdaki altı
  yüzey grubunda yer alıyor; gruplanmayan artık yok.

Miras `var()` çağrılarının tamamı eski blokta; yeni `pg-*` bloğu hiçbir miras
değişken kullanmıyor. Ayrım temiz.

> **A'nın spec'inde düzeltilecek bir kayıt:** `:root` yorumundaki miras
> değişken sayımı kaynak olarak `src/main.js`'i gösteriyor. O dosya ölü kod
> taramasında silindi; sayım artık yalnız `styles.css` üzerinden geçerli.

### Tipografi ayrı bir problem

Ölçüldü ve renkten farklı çıktı: **ikinci bir yazı tipi dili yok**. 2.624
elemanın 2.454'ü aynı Inter stack'ini kullanıyor. Yalnız iki kopya var
(`BlinkMacSystemFont` içeren ikinci bir sans stack'i, ve iki farklı monospace
stack'i). Buna karşılık ölçek 21 basamaklı ve en küçükleri 7px, hatta 6.4px.

Bu bir tutarsızlık temizliği değil, "ölçek ne olmalı" sorusu — yaratıcı bir
karar. Bu yüzden B renge daraltıldı; tipografi ölçeği kapsam dışı.

## Hedefler

- Ekranda hiçbir koyu kuşak yüzeyi kalmaz.
- Miras `var()` çağrısı 96'dan 0'a iner, miras `:root` bloğu silinir.
- Her görünüm değişikliği görsel sözleşme farkı olarak **tek tek
  gerekçelendirilir**; gerekçesiz hiçbir fark referansa girmez.
- Sınıf adlarına ve markup'a dokunulmaz (D'nin işi).

## Kapsam dışı

- Tipografi ölçeği ve ikon dili — ayrı karar.
- Yerleşim, sekme ve panel yapısı — **C**.
- Sınıf adlandırma, bileşen başına CSS, E2E seçicilerinin `data-testid`'e
  taşınması — **D**.
- Görsel sözleşme kapsamını %45'in üstüne çıkarmak — ayrı iş.

## Sözleşmenin rolü B'de tersine döner

A'nın kuralı "ekran değişmeyecek"ti. B'de görsel sözleşme testi her görevde
**bilerek düşer** ve referans o görevde güncellenir. Testin işi değişimi
engellemek değil, **her değişikliği görünür kılmak**.

Farklar üç kovaya ayrılır:

| Kova | Karar |
| --- | --- |
| Dokunulan yüzeyde, hedef kalıba uygun | Kabul — referansa girer |
| Dokunulan yüzeyde, beklenmedik yönde | İncele, açıkla ya da düzelt |
| Dokunulmayan yüzeyde | **Sızıntı** — commit'ten önce çözülür |

Üçüncü kova "yüzlerce fark var, hepsi normaldir" demenin önünü kesiyor.

## Tasarım

### Dönüşüm kuralı

Her koyu yüzey, `pg-*` dilinin zaten kullandığı dört kalıptan birine oturur.
Renk renk karar verilmez; **role göre kalıp seçilir**:

| Bugünkü rol | Hedef kalıp |
| --- | --- |
| Panel / kart / diyalog gövdesi | `background: var(--pg-surface)` + `border: 1px solid var(--pg-border)` |
| İkincil / gömülü yüzey (arama kutusu, tuval) | `background: var(--pg-surface-soft)` |
| Anlamsal durum yüzeyi | `background: var(--pg-<rol>-soft)` + `color: var(--pg-<rol>)` |
| Birincil eylem | `background: var(--pg-accent)` + `color: #fff` |

Metin renkleri buna bağlı düşer: gövde `--pg-text`, ikincil `--pg-muted`,
silik `--pg-faint`.

**İki koyu tema idiomu bilerek atılır:**

- Neon parıltılar (`box-shadow: 0 0 10px var(--mint)`, `0 0 8px #5eead4aa`)
  açık zeminde kir gibi görünür. Kaldırılır; vurgu gerekiyorsa `pg` dilinin
  kendi yolu kullanılır (`--pg-accent-soft` dolgu).
- Opak siyah gölgeler (`#000c` gibi) `var(--pg-shadow)` olur.

### Değişken eşlemesi

Tek anlamlı olanlar — rolleri ölçüldü, hepsi tek bir CSS özelliğinde
kullanılıyor:

| Miras | Kullanım | Rolü | Hedef |
| --- | --- | --- | --- |
| `--line` | 34 | her zaman `border` | `--pg-border` |
| `--muted` | 12 | her zaman `color` | `--pg-muted` |
| `--violet` | 5 | `background`, `accent-color` | `--pg-accent` |
| `--violet-2` | 5 | `color`, `border-color` | `--pg-accent` |
| `--danger` | 2 | `color` | `--pg-danger` |
| `--panel` | 1 | `background` | `--pg-surface` |
| `--studio-*` | 24 | zaten açık tema | doğrudan `--pg-*` karşılıkları |

`--violet-2` (`#b0a5ff`) koyu zeminde okunsun diye açık tondu; açık zeminde
doğru karşılık koyu mor `--pg-accent`'tir, açık tonu değil.

### `--mint` role göre ayrılır

Tek muğlak değişken. Adı "başarı" ima ediyor ama 15 kullanımı ikiye ayrılıyor:

| Kullanım yeri | Gerçek rol | Hedef |
| --- | --- | --- |
| `.loading svg` | yükleme göstergesi | `--pg-accent` |
| `.project-list .active .project-dot` | etkin proje işareti | `--pg-accent` |
| `.effort-low` | düşük efor (olumlu ölçek değeri) | `--pg-success` |
| `.privacy-pill span` | olumlu durum noktası | `--pg-success` |
| `.idea-history-list em` | küçük olumlu vurgu | `--pg-success` |

Kalan kullanımlar uygulama sırasında aynı ölçütle tek tek karara bağlanır ve
her biri commit mesajında yazılır. Ölçüt: **vurgu mu, olumlu durum mu?**

### Koyu yüzey grupları

29 sınıf **altı** tanınabilir yüzeyde kümeleniyor. Altısı da görsel
sözleşmenin kapsamında — yani her dönüşüm farkı görülerek yapılabilir.

| Yüzey | Sınıflar | Ekran |
| --- | --- | --- |
| Bildirim (toast) | `toast` | 5 |
| Sağlayıcı ayarları diyaloğu | `provider-dialog`, `dialog-head`, `dialog-icon`, `dialog-actions`, `memory-toggle`, `privacy-callout`, `primary`\* | 1 |
| Fikir → plan dönüşümü | `idea-conversion`, `idea-conversion-blockers` | 3 |
| Fikir özeti düzenleyici | `concept-agreement`, `interpretation-confidence`, `confidence-explanation`, `agreement-ledger`, `agreement-save`, `idea-history`, `idea-history-diff`, `active`\* | 1 |
| Revizyon geçmişi diyaloğu | `revision-dialog`, `revision-actions` | 1 |
| Gelişmiş plan araçları | `storage-health-panel`, `trace-map`, `trace-search`, `trace-canvas`, `scenario-panel`, `section-regeneration`, `line-diff`, `added`, `removed` | 2 |

\* `active` ve `primary` genel sınıflar ama koyu arka planları genel
kuraldan gelmiyor; kapsamlanmış geçersiz kılmalardan geliyor
(`.project-list button.active`, `.idea-history-list button.active`,
`.provider-options label.active`, `.recovery-dialog .dialog-actions .primary`).
Her biri kendi yüzeyinin görevinde ele alınır; çapraz kesen bir değişiklik
gerekmez. Genel `.primary` kuralı zaten `--studio-accent` kullanıyor ve
görev 1'de `--pg-accent`'e bağlanır.

## Görev bölümü

Sıra tesadüfi değil: önce değişkenler çözülür, böylece yüzey görevleri yalnız
sabit renklerle uğraşır ve farkları okunabilir kalır.

| # | Görev | Gerekçe |
| --- | --- | --- |
| 1 | Kullanılmayan 4 miras değişkeni sil; tek anlamlı 7'sini `pg` karşılıklarına bağla | Mekanik, hiçbir yargı içermez |
| 2 | `--mint`'in 15 kullanımını rolüne göre ayır | Tamamen yargı; 1 ile karışmamalı |
| 3 | **Toast** | En küçük gerçek yüzey ama 5 ekranda görünür — yöntemi en geniş kanıtla erken sınar |
| 4 | **Sağlayıcı ayarları diyaloğu** | 7 sınıf, kendi içinde kapalı |
| 5 | **Fikir → plan dönüşümü** | 2 sınıf, 3 ekran |
| 6 | **Fikir özeti düzenleyici** | 8 sınıf, tek ekran |
| 7 | **Revizyon geçmişi diyaloğu** | 2 sınıf, tek ekran |
| 8 | **Gelişmiş plan araçları** | 9 sınıf, en büyük — yöntem beş kez kanıtlandıktan sonra |
| 9 | Süpürme: miras `:root` bloğunu sil, iki kopya font stack'ini tekilleştir, ekranda koyu yüzey kalmadığını ölçüyle kanıtla | Kapanış |

Görev 1 ve 2 bilerek ayrı. Karışsalardı, mekanik bir eşlemenin yol açtığı bir
gerileme ile bilinçli bir renk kararı aynı commit'te ayırt edilemez olurdu.

Görev 7'nin ölçümü, bu spec'teki "ekranda görünen koyu arka plan/kenarlık"
sayımının aynısıdır ve sonucu sıfır olmalıdır.

## Doğrulama

Her görevin çevrimi aynı:

1. Değiştir
2. Görsel sözleşmeyi koştur
3. Farkları üç kovaya ayır, gerekçelendir
4. Referansı güncelle (`UPDATE_VISUAL_BASELINE=1`)
5. Bütün kapılar: `tsc --noEmit`, 348 birim testi, lint (0 hata), ürün
   belgeleri, build, 32 E2E
6. Commit — referans güncellemesi aynı commit'te

`npm run verify` bu makinede tam koşmaz (cargo kurulu değil); kapılar tek tek
koşulur. E2E için: `node node_modules/vite/bin/vite.js build`, ardından
`node node_modules/@playwright/test/cli.js test`.

## Riskler

| Risk | Karşı önlem |
| --- | --- |
| Sözleşme sınıfların yalnız %45'ini ölçüyor. Altı yüzey grubu kapsamda ama *durumları* değil (toast'ın hata varyantı, `.added`/`.removed` fark satırları ölçülmeyen durumlarda olabilir) | Her yüzey görevinde o yüzeyin CSS kuralları tek tek okunur; yalnız teste güvenilmez |
| Dinamik sınıflar: `status-${...}`, `is-${...}`, `effort-${...}` şablonlarından üretilen 28 sınıf renk taşıyor ve aramada görünmüyor | Hangi durum değerlerinin gerçekten üretildiği domain tiplerinden sayılır |
| Bir görevin farkı beklenenden çok büyük çıkabilir | Üçüncü kova kuralı: dokunulmayan yüzeydeki tek bir fark bile commit'i durdurur |

## Geri alma

Her görev tek commit; `git revert` yeterli. Referans güncellemesi aynı
commit'te olduğu için görünüm ve sözleşme birlikte geri döner. Uygulama
mantığına hiç dokunulmaz — yalnız `styles.css`.

## Sonraki adım

B tamamlandığında **C** (yerleşim, sekme ve panel yapısı) açılır. C'nin işi
bu spec'te dokunulmayan yapıyı değiştirmek; B yalnız rengi tutarlı hâle
getirir.
