# Mimari Karşılaştırma Şablonu Benchmark

Sonuç: **6/6** senaryo geçti (28 doğrulama).

| Senaryo | Sonuç | Doğrulama |
|---|---:|---:|
| Üç yaklaşım her zaman sunulur | Geçti | 5 |
| Başlıklar alana göre değişir | Geçti | 4 |
| Metrikler hesaplanmaz, varsayımdır | Geçti | 5 |
| Efor sıralaması tutarlı | Geçti | 4 |
| Seçim önceliği | Geçti | 6 |
| Tercih çipleri ve aday kayıtlar | Geçti | 4 |

## Ölçülen davranış

- **Üç yaklaşım her zaman sunulur** — Karşılaştırma matrisi her fikir için sade/modüler/gelişmiş üçlüsünü ve tek bir öneriyi vermeli.
- **Başlıklar alana göre değişir** — Oyun, web, mobil ve AI projeleri farklı mimari adlandırmaları almalı.
- **Metrikler hesaplanmaz, varsayımdır** — Yeteneğin "otomatik hesaplanmaz" beyanı doğru olmalı; metrikler projeden türetilmemeli.
- **Efor sıralaması tutarlı** — Efor etiketi ve skoru sade→gelişmiş yönünde artmalı, riskler buna uygun bildirilmeli.
- **Seçim önceliği** — Kullanıcı seçimi öneriyi geçmeli; seçim yoksa önerilene, o da yoksa ilkine düşmeli.
- **Tercih çipleri ve aday kayıtlar** — Her yaklaşım hızlı seçim çipi taşımalı; aday karar ve risk listeleri üretilmeli.

## Bu benchmarkın kanıtlamadıkları

- Bu bir şablondur, hesaplayıcı değildir. Benchmark önerilen mimarinin **doğru**
  olduğunu göstermez; şablonun tutarlı, alan farkındalı ve dürüst davrandığını gösterir.
- Metrik değerleri gerçek ölçüme değil başlangıç varsayımına dayanır. Bu bir eksiklik
  değil, açıkça beyan edilmiş sınırdır ve `metrics-are-declared-assumptions` senaryosu
  tam olarak bu beyanın doğruluğunu ölçer.
- Maliyet, operasyon yükü ve vendor lock-in puanları proje verisinden türetilmez;
  kullanıcı tarafından düzenlenmek üzere sunulur.
