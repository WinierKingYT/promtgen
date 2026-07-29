# AI Sağlayıcı Entegrasyonu Benchmark

Sonuç: **7/7** senaryo geçti (45 doğrulama).

| Senaryo | Sonuç | Doğrulama |
|---|---:|---:|
| Bulut endpoint sabitleme | Geçti | 4 |
| Ollama yalnız loopback | Geçti | 8 |
| Kimlik bilgisi izolasyonu | Geçti | 5 |
| Şema dışı yanıtta fallback | Geçti | 5 |
| Taşıma hatasında fallback | Geçti | 10 |
| Bağlantı tanılama kodları | Geçti | 8 |
| Offline local-first garantisi | Geçti | 5 |

## Ölçülen davranış

- **Bulut endpoint sabitleme** — Kullanıcıdan gelen baseUrl bulut sağlayıcıları için yok sayılmalı; istek yalnız resmi adrese gitmeli.
- **Ollama yalnız loopback** — Yerel sağlayıcı adresi SSRF yüzeyine dönüşmemeli; metadata IP, file:// ve loopback dışı host reddedilmeli.
- **Kimlik bilgisi izolasyonu** — API anahtarı yalnız başlıkta taşınmalı; URL, gövde veya proje bağlamı üzerinden sızmamalı.
- **Şema dışı yanıtta fallback** — Sağlayıcı geçersiz yapı döndürdüğünde yerel kural motoru devralmalı ve etiket kalıcı olmalı.
- **Taşıma hatasında fallback** — Ağ hatası ve HTTP 500 aynı fallback sözleşmesini üretmeli.
- **Bağlantı tanılama kodları** — Her başarısızlık sınıfı kullanıcının düzeltebileceği ayrı bir errorCode üretmeli.
- **Offline local-first garantisi** — Offline modda ve AI kapalıyken hiçbir ağ isteği yapılmamalı.

## Bu benchmarkın kanıtlamadıkları

- Gerçek sağlayıcıya ağ çağrısı yapılmaz; `fetch` stub üzerinden sözleşme ölçülür.
  Bu, sağlayıcının yanıt kalitesini değil PromtGen tarafındaki sınırları doğrular.
- Üretilen plan önerisinin isabetli olduğunu göstermez; yalnız fallback ve etiketleme
  sözleşmesinin bozulmadığını gösterir.
- Sağlayıcının kendi veri saklama politikası kapsam dışıdır.
- Ollama performansı kullanıcı donanımına bağlıdır ve ölçülmez.
