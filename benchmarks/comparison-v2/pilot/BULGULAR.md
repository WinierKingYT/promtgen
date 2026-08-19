# Pilot bulguları — s1-fatura, qwen2.5:7b

**Pilot verisi çalışma kanıtı değildir.** Amaç süreç provasıydı; bulduğu şey
sürecin kendisinden büyük çıktı.

## Yürüyen

| Kol | Süre | Çıktı |
| --- | ---: | --- |
| A `baseline-chat` | 14 sn | 3.174 karakter serbest metin plan |
| B `master-prompt` | 19 + 16 sn (iki tur) | 4.805 + 3.877 karakter |
| C `promtgen` | 65 sn | 5 fikir konusu → 5 karar → fikir onayı → 3 teknik konu + 1 aday |

C kolunun teknik konuları bu turda gerçekten teknikti (*Veri ve Güvenlik
Politikası*, *Kullanıcı Erişimi ve Kimlik Doğrulaması*) — istem düzeltmesi
tutuyor.

## Çalışmayı durduran bulgu

**C kolu plan üretemiyor: 0 gereksinim, 0 görev, 0 test.**

Dönüşüm iki ayrı kapıya birden takılıyor:

```
V3 kapısı      : "Teknik çözüm tasarımı onaylanmadan plan üretilemez."
ESKI kapı      : summary / targetUser / problemStatement / currentAlternative /
                 desiredOutcome / mvpTarget / confirmedFeatures / outOfScope
                 + "4 kritik karar veya açık soru çözülmeli"
```

İkincisi `conceptSummary` alanlarını istiyor. V3 akışı bu alanları **hiç
doldurmuyor** — o `ideaDesign` (konular, kararlar, çerçeveleme) yazıyor.
Gereksinimler ise `createRequirementDraftsFromConcept` ile üretiliyor ve o
fonksiyon `conceptSummary` okuyor.

Yani V3 yolunu sonuna kadar yürüyen kullanıcı, plan kapısında **eski modelin
tamamen farklı bir belge setini** doldurmasını isteyen bir duvara çarpıyor.

### Kökeni

Conversion V2 adımında kapıyı ekledim ama **kaynak izdüşümünü eklemedim**:
`stageConversionBlockers` eski engellere *ek* olarak çalışıyor. Böylece V3
kullanıcısı hem yeni iki kapıyı hem eski kavram özeti kapısını geçmek zorunda.

### Çalışmaya etkisi

Bu hâliyle 18 gönderim toplansaydı C kolu `requirements`, `tasks`, `tests`
alanlarını **boş** verirdi ve yedi ölçütün dördünde (taskTestLinkage,
acceptanceCriteria, agentReadiness, applicability) dibe vururdu. Sonuç
"PromtGen kötü plan üretiyor" diye okunurdu; oysa gerçek "PromtGen plan
üretemiyor" — bambaşka bir cümle. Pilot tam olarak bunu yakalamak için vardı.

## Çözüldü — A yolu uygulandı

`014675f` aşama verisini `conceptSummary`'ye yansıtan izdüşümü ekledi ve kavram
kapısını aşama farkında yaptı. C kolu artık plan üretiyor:

| | önce | sonra |
| --- | ---: | ---: |
| Gereksinim | 0 | 5 |
| Görev | 0 | 5 |
| Test | 0 | 5 |
| Gereksinime bağsız görev | — | 0 |
| Testsiz görev | — | 0 |

Çıktı `c-plan-ciktisi.json`'da. AI turları 2026-08-19 kayıtlı koşusundan alındı;
yeniden çalıştırılan tek şey dönüşüm ve görev derlemesi — canlı tur bu makinede
şu an 30 sn'lik görev zaman aşımını aşıyor (ölçülen ham hız: 200 kelime / 22 sn,
makine yükü altında).

### Yol boyunca çıkan iki ürün hatası

**1. Boş onay atılabiliyordu.** Canlı koşuda sağlayıcı turu düştü, belge **sıfır
konuyla** ilerledi ve her iki onay kapısını da geçti. Yapısal denetimler yalnız
var olan konuları inceliyor; boş belgede hepsi sessizce geçiyor ve kapı
"0 engel" diyerek açılıyordu. `2b5afb4` ile kapatıldı.

**2. Belgeye `undefined` yazılıyordu.** Aşama modelinde `mvpTarget`,
`targetUser` gibi alanlar yok; satırlar koşulsuz yazıldığı için plana
"MVP hedefi: undefined", vizyona "Hedef kullanıcı: undefined" düşüyordu.

## Kapanmayan kalite bulgusu — karar bekliyor

C kolunun beş gereksiniminin **dördü olumsuz bir yan cümle taşıyor**:

```
Hatırlatma e-posta ile; SMS yok.
Ödeme tahsilatı kapsam dışı.
Sadece fatura kaydı ve hatırlatma; muhasebe entegrasyonu yok.
Tek kullanıcı, ekip özelliği yok.
```

İzdüşüm `karar cevabı → confirmedFeatures → gereksinim` eşlemesi yapıyor. Ama
kullanıcının bir konuya verdiği cevap çoğu zaman hem yapılacağı hem
yapılmayacağı söyler. Yapılmayacak olan `must` gereksinime dönüşünce plan,
"SMS yok"u **inşa edilecek bir iş** gibi gösteriyor.

**Anahtar kelime ile ayıklamayacağım.** "yok / değil / kapsam dışı" arayan bir
süzgeç, olumsuz cümleyi yakalarken olumlu yarısını da beraberinde silerdi ve
hangi kararı hangi listeye koyduğunu kullanıcıya açıklayamazdı. Bu yapısal
değil dilsel bir ayrım; çözümü ya karar kaydının cevabı iki alanda
(`yapılacak` / `yapılmayacak`) toplaması ya da AI'nin bunu ayırması.

Ölçüye etkisi: `applicability` ve `acceptanceCriteria` ölçütlerinde C kolu
kendi hak ettiğinden düşük puan alır. Çalışma başlamadan karara bağlanmalı.

## Gönderim kaydı doldurulabilir mi — EVET

Üç kol da geçerli taslak üretti (`gonderim-taslaklari.json`,
`npm run check:submission-draft` ile doğrulandı):

| Kör kimlik | Gereksinim | Görev | Test |
| --- | ---: | ---: | ---: |
| `p-1` | 0 | 6 | 0 |
| `p-2` | 3 | 3 | 3 |
| `p-3` | 5 | 5 | 5 |

`p-1`'in sıfır gereksinimi **kaydın eksikliği değil, kolun çıktısı**: serbest
metin plan numaralı adımlar veriyor ama gereksinim kimliği, kabul kriteri ve
test üretmiyor. Olmayanı "var" diye kaydetmek o kolun lehine hile olurdu.

## Özgün karar (tarihsel kayıt)

İki yol var ve seçim ürün kararıdır:

**A — İzdüşüm.** V3 aşama verisi `conceptSummary`'ye yansıtılır (çerçeveleme →
targetUser/problemStatement, kararlar → confirmedFeatures, kapsam dışı →
outOfScope). Eski kapı V3 verisiyle karşılanır, gereksinim üretimi olduğu gibi
kalır.

**B — Değiştirme.** `usesStageModel` doğruyken eski kavram özeti kapısı devre
dışı kalır ve gereksinimler doğrudan aşama kararlarından üretilir. Daha temiz
ama `createRequirementDraftsFromConcept` yeniden yazılır.

A daha küçük ve mevcut gereksinim kalite kapılarını korur; B modeli
sadeleştirir ama daha çok şeye dokunur.

## Süreç notu

Pilotu yürüten kişi hangi çıktının hangi koldan geldiğini biliyor; bu yüzden
pilotta kör puanlama yapılmadı ve yapılamaz.
