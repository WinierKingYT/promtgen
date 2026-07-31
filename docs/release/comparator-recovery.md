# Mimari Karşılaştırma Şablonu — Kurtarma ve Geri Alma

Bu belge `architecture-comparator-template` yeteneğinin terfi kapısındaki
kurtarma koşulunu karşılar. Genel sürüm geri alma akışı için
[rollback.md](rollback.md) belgesine bakın.

## Yeteneğin gerçekte ne olduğu

Bu bir **statik şablondur**, hesaplayıcı değildir. Üç mimari yaklaşım (sade,
modüler, gelişmiş) ve dört tradeoff metriği sunar. Metrik değerleri projeden
**türetilmez**; düzenlenmek üzere sunulan başlangıç varsayımlarıdır. Bu sınır
[architecture-comparator-benchmark.ts](../../scripts/architecture-comparator-benchmark.ts)
içindeki `metrics-are-declared-assumptions` senaryosuyla her `verify`
çalışmasında doğrulanır — yani "hesaplanmıyor" beyanının kendisi test edilir.

## Kapsanan başarısızlıklar

| # | Senaryo | Belirti |
|---|---|---|
| 1 | Yanlış yaklaşım seçildi | Konsept özeti istenmeyen mimariye göre yazıldı |
| 2 | Metrikler gerçek sanıldı | Kullanıcı puanları ölçüm zannedip karar verdi |
| 3 | Alan yanlış sınıflandı | Web projesine oyun mimarisi başlıkları geldi |
| 4 | Şablon canonical plana taşındı | Onaylanan konsept plana yanlış mimari yazdı |

## Neden çoğu durum kolay geri alınır

Şablonun çıktısı **canonical planı kendiliğinden değiştirmez**. Seçim
`ideaLabSession` altında tutulur, `conceptSummary.userConfirmed` açık onaya
kadar `false` kalır ve canonical revision ilerlemez. Bu davranış
[architecture-comparator.test.ts](../../tests/v4/architecture-comparator.test.ts)
içinde doğrulanır.

## Kurtarma adımları

### Senaryo 1 — Yanlış yaklaşım seçildi

Konsept onaylanmadıysa: Fikir Laboratuvarı'na dönüp başka bir yaklaşım seçin ve
konsept özetini yeniden üretin. Hiçbir kalıcı iz kalmaz.

Konsept onaylandıysa ve plana taşındıysa: bu artık normal bir canonical
değişikliktir. Etkilenen revizyondan önceki son sağlam checkpoint'i seçip yeni
revision olarak restore edin (rollback.md adım 4). Eski revizyon silinmez.

### Senaryo 2 — Metrikler gerçek sanıldı

Bu bir veri sorunu değil, sunum sorunudur. Puanlar başlangıç varsayımıdır ve
kullanıcı tarafından düzenlenmelidir. Kararı bu puanlara dayandırdıysanız:

- Puanları kendi projenize göre yeniden girin.
- Kararı yeniden değerlendirin; şablon puanlarına dayanan bir karar, ölçüme
  dayanan bir karar değildir.
- Arayüzde "otomatik hesaplanmaz" uyarısı görünmüyorsa bu bir **hatadır**;
  `metrics-are-declared-assumptions` senaryosu geçtiği hâlde uyarı görünmüyorsa
  sorun sunum katmanındadır ve ayrı bir E2E kontrolü gerekir.

### Senaryo 3 — Alan yanlış sınıflandı

Alan tespiti fikir metnindeki sinyallere dayanır. Yanlış sınıflandıysa fikri
daha açık yazıp yeniden üretin; örneğin "web uygulaması", "mobil uygulama" gibi
alan sözcüklerini metne ekleyin. Politika değişikliği gerekmez.

Tekrarlayan bir yanlış sınıflandırma varsa
[deterministic-idea-planning.ts](../../src/v4/application/deterministic-idea-planning.ts)
içindeki `APPROACH_PROFILES` ve `classifyProjectDomain` gözden geçirilmeli ve
`domain-aware-titles` senaryosuna yeni bir alan örneği eklenmelidir.

### Senaryo 4 — Şablon canonical plana taşındı

Onay verilmişse plan değişikliği gerçektir. Checkpoint üzerinden geri yükleyin;
geri yükleme geçmişi silmez, yeni bir revision üretir
(`restore-creates-new-revision`, `restore-preserves-forward-history`).

## Doğrulama

```bash
npm run benchmark:architecture-comparator
```

Ek olarak: yeni bir fikirle Fikir Laboratuvarı'nı açıp üç yaklaşımın geldiğini,
önerilenin işaretli olduğunu ve konsept onayının açık kullanıcı hareketi
gerektirdiğini gözle doğrulayın.

## Bilinen sınır

Maliyet, operasyon yükü ve vendor lock-in puanları proje verisinden
hesaplanmaz. Bu bir eksiklik değil, açıkça beyan edilmiş kapsam kararıdır.
Hesaplanan maliyet analizi istenirse bu, yeteneğin kapsamını genişletir ve
[FEATURE_FREEZE.md](../product/FEATURE_FREEZE.md) istisna kapısından geçmelidir.
