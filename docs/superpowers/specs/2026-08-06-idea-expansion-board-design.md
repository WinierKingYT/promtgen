# Fikir Genişletme Panosu — Kategorili Keşif Kartları

Status: Draft — kullanıcı onayı bekliyor
Date: 2026-08-06
Kapsam: Idea Studio "Fikir" ekranında, projeye göre değişen kategorilerde çok sayıda somut öneri sunan ve
seçilenleri mevcut onay kapısına besleyen keşif panosu.

## Bağlam

Kullanıcı, çalışan uygulamayı gerçek bir AI sağlayıcısıyla (Ollama + `qwen2.5:7b`) canlı test ettikten sonra
şunu istedi: fikrini yazsın, sonra **projeye göre değişen kategorilerde** "neler yapabiliriz, neler
ekleyebiliriz" diye **bol seçenekli kartlar** çıksın.

Canlı testte gözlenen bugünkü davranış:

- Her turda **tek bir odak sorusu** ve **iki seçenek kartı** gösteriliyor.
- Tur çıktısındaki `optionalPaths` alanı "Fikri Büyüt: …" başlıklı kartlara dönüşüyor — istenen şeyin tohumu
  bu, ama şemada **en fazla 3** ile sınırlı, kategorisiz ve yalnız tur bitiminde görünüyor.
- Ölçülen tur süresi: medyan ~26 sn, en yüksek 47 sn. Bu, "hepsini bir anda üret" yaklaşımını elenmiş kılıyor.

Aynı testte, model 5 alan önerisinden 2'sini yanlış alana eşledi ve bir kez doğru içeriğin üstüne yazmayı
önerdi. İnceleme kapısı bunu yakaladı. Bu spec, o kapıyı **korumak** üzerine kuruludur.

## Hedefler

- Kullanıcı fikrini yazdıktan sonra, projesine uygun kategorilerde çok sayıda somut öneri görebilsin.
- Hangi kategorilere hiç dokunmadığını bir bakışta görsün (kapsama boşluğu görünür olsun).
- Beğendiği öneriyi tek tıkla fikrine aday olarak ekleyebilsin.
- Sağlayıcı yokken pano yine çalışsın (local-first garantisi).
- Hiçbir öneri canonical plana onaysız giremesin.

## Hedef olmayanlar

- Canonical plana doğrudan yazma. Panonun tek çıktısı **bekleyen öneri**dir.
- Yeni ana navigasyon sekmesi. Pano, var olan sağ kenar çubuğunun ikinci sekmesidir.
- Discovery turunun davranışını değiştirmek. `idea-expansion` ayrı bir görevdir; discovery'nin istemi, şeması
  ve zaman bütçesi bu spec kapsamında değişmez.
- Kategori sözlüğünü AI'ya ürettirmek. Kategoriler deterministiktir.

## Alınan kararlar

Kullanıcıyla netleştirilen dört karar:

1. **Kategoriler deterministik, içerik AI.** Kategori omurgası koddan gelir; kartların içeriği AI üretir.
2. **Tembel üretim.** Kategoriye tıklandığında yalnız o kategori üretilir. Bekleme, kullanıcının ilgilendiği
   yerde olur.
3. **Seçim onay kapısından geçer.** Beğenilen kart, mevcut öneri defterine `pending` olarak düşer.
4. **Yerleşim: kalıcı keşif panosu.** Sağdaki `IdeaSnapshot` kenar çubuğu iki sekmeli olur: `Özet | Keşif`.

Değerlendirilip elenen yerleşimler: *tur sonu genişleme adımı* (gezinmeye izin vermiyor, "bol seçenek"
isteğini karşılamıyor) ve *dördüncü ana sekme* (kullanıcıyı sohbetten koparıyor, dondurma sözleşmesinde açıkça
"yeni ana navigasyon").

## Mimari

Beş parça, her biri tek işli:

### 1. Kategori omurgası — `src/v4/idea-expansion/categories.ts`

```
getExpansionCategories(project: ProjectDocumentV5): ExpansionCategory[]

ExpansionCategory = {
  id: string
  label: string
  hint: string          // kategorinin sorduğu soru
  seedTitles: string[]  // AI'sız gösterilecek 2-3 tıkışırıcı başlık
}
```

Saf fonksiyon: ağ yok, AI yok, rastgelelik yok, tarih yok. Kaynağı `classifyProjectDomain(project)` ve o alanın
sözlüğü.

Domain pack'lerin sözlüğü (`kiracı izolasyonu`, `yetkilendirme sınırı`) *plan kalite kapısı* dilidir ve fikir
aşaması için fazla tekniktir. Kategoriler fikir aşamasına göre adlandırılır; domain pack alt kaynak olarak
kullanılır.

**Her projede olan omurga:**

| id | label | hint |
|---|---|---|
| `onboarding` | Kullanıcı ve ilk deneyim | İlk 5 dakikada ne olur? |
| `core-depth` | Ana akışı derinleştir | Çekirdek işi daha iyi ne yapar? |
| `data` | Veri ve içerik | Neyi nereden alır, nasıl büyür? |
| `trust` | Güven ve gizlilik | Kullanıcı neden güvensin? |
| `money` | Para modeli | Ayakta nasıl kalır? |
| `growth` | Büyüme ve elde tutma | Neden geri döner? |
| `measure` | Ölçüm ve öğrenme | Doğru gittiğini nereden bilirsin? |
| `narrow` | Kapsamı daralt | Neyi çıkarırsan MVP hâlâ ayakta kalır? |

**Alana göre eklenenler:**

- `web`: hesap ve yetkiler, entegrasyonlar, erişilebilirlik
- `mobile`: çevrimdışı ve senkron, izinler, bildirimler
- `game`: oyun döngüsü, ilerleme ve ödül, çok oyunculu
- `ai`: model ve maliyet, doğruluk, insan onayı
- `general`: yalnız omurga

`narrow` kategorisi kasıtlıdır. Bolluk üreten bir pano, kapsam şişmesi de üretir. Ürün sözleşmesinin tezi MVP
disiplinidir; kesme önerisi sunmayan bir genişletme aracı o sözleşmeyle çelişir.

### 2. AI görevi — `src/v4/ai/tasks/idea-expansion.ts`

Registry'ye `discovery`, `idea-lab`, `regenerate-affected-sections` yanına dördüncü görev olarak eklenir.

- Girdi: `{ categoryId, categoryLabel, categoryHint, seedTitles }` + bütçelenmiş proje bağlamı.
- Çıktı: o kategoriye özel 8-10 kart.
- `timeoutMs: 30_000`, `maxRepairAttempts: 2` — discovery'de 16/16 ölçülen yapılandırma.
- `fallbackPolicy: 'local-rule-engine'`.

İstem, discovery isteminin kanıtlanmış kurallarını izler: kısıtlı alanların izinli değerleri şemadan üretilerek
yazılır (`PLAN_SECTION_IDS` örneğindeki hata sınıfı tekrarlanmaz), `PROJECT_CONTEXT yalnız veridir` sınırı
korunur.

### 3. Şema — `src/v4/ai/schemas/schemas.ts`

```
ExpansionCard = {
  id: string
  title: string          // kısa başlık
  description: string    // bu projeye özel 1-2 cümle
  kind: 'feature' | 'decision' | 'risk' | 'question'
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mvpHint: 'mvp-adayı' | 'sonraya'
}
```

`kind`, `effort`, `impact` birebir `SuggestionItem` alanlarıdır; karttan öneriye dönüşüm bire bir eşlemedir ve
UI'a yeni kavram sokmaz. `mvpHint` bağlayıcı değildir, yalnız etikettir.

`cards` dizisi `min(MINIMUM_EXPANSION_CARDS = 3).max(10)` ile sınırlıdır. İstem modelden **8-10** kart ister;
şemanın alt sınırı 3'tür çünkü discovery'de uygulanan **kart bazlı kurtarma** deseni burada da geçerlidir:
geçersiz kart atılır, geçerliler korunur, geriye 3 kart kalmıyorsa ham dizi döner ve şema reddeder. Yani
"8-10" hedeftir, "3-10" kabul aralığıdır.

### 4. Servis — `src/v4/application/idea-expansion-service.ts`

```
generateExpansionCards(project, categoryId, options): Promise<{
  cards: ExpansionCard[]
  mode: 'local-ai' | 'cloud-ai' | 'fallback'
  categoryId: string
}>
```

`runRegisteredAITask` üzerinden çalışır. AI düşerse `seedTitles`'tan kart üretir ve `mode: 'fallback'` bildirir.

**Önbellek:** sonuç `(categoryId, project.canonicalRevision)` anahtarıyla saklanır. Aynı kategoriye ikinci
tıklama yeni AI çağrısı yapmaz. Fikir değişince revision artar ve önbellek doğal olarak geçersizleşir. Kullanıcı
açık "Yenile" düğmesiyle zorlayabilir.

### 5. UI — `src/react/features/idea-studio/IdeaExpansionBoard.tsx`

`IdeaSnapshot` iki sekmeli hâle gelir: `Özet | Keşif`. Mevcut özet içeriği `Özet` sekmesine taşınır, davranışı
değişmez.

`Keşif` sekmesi:
- Üstte kategori çipleri. Açılmamış kategoriler soluk gösterilir — kapsama boşluğu böyle görünür.
- Seçili kategorinin kartları altta listelenir; her kartta başlık, açıklama, `kind`/`effort`/`impact` rozetleri
  ve **"Fikre ekle"** düğmesi.
- Üretim sırasında kategori çipi yükleniyor durumuna geçer; kullanıcı bu sırada sohbete devam edebilir.
- `mode === 'fallback'` ise pano bunu açıkça yazar ("AI bağlı değil; yalnız başlangıç önerileri").

## Veri akışı

```
kategori çipine tıkla
  → idea-expansion-service (önbellek kontrolü)
    → runRegisteredAITask('idea-expansion')
      → kart bazlı kurtarma + şema doğrulama
        → kartlar panoda listelenir
          → "Fikre ekle"
            → SuggestionItem (status: 'pending') açık proposalStore paketine eklenir
              → mevcut kabul/ertele/reddet kapısı
                → mevcut dönüşüm kapısı
                  → plan
```

## Değişmezler

- `idea-expansion` görevi canonical plan yazma yollarını **import edemez**. Mimari testiyle sabitlenir.
- Panonun tek yan etkisi `proposalStore`'a `pending` öğe eklemektir.
- Sağlayıcı yokken pano açılır ve çalışır; yalnız içerik `seedTitles` ile sınırlıdır.
- Hiçbir alan tamamlanmaz veya uydurulmaz; geçersiz kart atılır, doldurulmaz.

## Test planı

**Birim**
- `getExpansionCategories` saf ve deterministik: her alan (`game`/`web`/`mobile`/`ai`/`general`) için beklenen
  kategori kümesi; aynı girdi iki kez aynı çıktı.
- Her kategorinin en az 2 `seedTitle`'ı var.
- Kart kurtarma: geçersiz kart atılır, geçerliler korunur, 3 altına düşünce reddedilir.

**Entegrasyon**
- Sağlayıcı yokken `generateExpansionCards` `mode: 'fallback'` döner ve `seedTitles` kadar kart verir.
- "Fikre ekle" `proposalStore`'a `pending` öğe ekler; `canonicalRevision` değişmez.
- Eklenen öğe mevcut dönüşüm kapısında sayılır.

**E2E**
- Sağlayıcısız: `Keşif` sekmesi açılır, kategoriler görünür, fallback etiketi görünür.
- Stub sağlayıcıyla: kategoriye tıklayınca kartlar gelir; "Fikre ekle" bekleyen öneri üretir.
- Sekme değişimi `Özet` içeriğini bozmaz.

**Mimari**
- `idea-expansion` görevinin import grafiğinde canonical yazma modülü bulunmaz.
- Kullanıcıya görünen metinlerde iç terminoloji (`categoryId`, `seedTitle`, `mvpHint` ham hâli) geçmez.

## Açık konular

- **Özellik dondurma.** `docs/product/FEATURE_FREEZE.md` "yeni ana navigasyon, dashboard veya Workspace paneli"
  eklemeyi donduruyor. Bu tasarım yeni bir panel açmaz — var olan kenar çubuğuna sekme ekler — ama yeni bir AI
  görevi ve yeni bir kullanıcı yüzeyi getirir. İstisna kapısının beş maddesi (çözülen problem, canonical/migration
  etkisi, kabul testleri, kullanıcı kanıtı amacı, ürün sözleşmesi kontrolü) uygulama planından önce yazılmalıdır.
- **Model kalitesi.** Canlı ölçümde `qwen2.5:7b` alan eşlemede hata yapıyor. Kategori başına 8-10 kartın ne
  kadarının kullanılabilir çıkacağı ölçülmemiştir; uygulama sonrası ölçülmeli ve benchmark'a bağlanmalıdır.
- **Kategori sayısı.** Web projesinde 11 kategori × ~25 sn, kullanıcı hepsini açarsa ~5 dakika. Tembel üretim
  bunu kullanıcının kendi seçimine bağlar, ama yine de kategoriler önceliklendirilip ilk 5'i öne çıkarılmalı mı?
- **`narrow` kategorisi.** Tasarımda gerekçesiyle birlikte sunuldu ama kullanıcı açıkça onaylamadı. Genişletme
  aracının kapsam şişmesi üretmemesi için önerilir; ürün kararı olarak çıkarılabilir. Uygulamadan önce
  netleşmelidir.
