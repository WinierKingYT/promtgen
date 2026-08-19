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

## Karar bekleyen

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
