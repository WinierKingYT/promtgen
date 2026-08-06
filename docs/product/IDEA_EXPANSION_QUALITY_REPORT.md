# Fikir Genişletme Kalite Raporu

Sağlayıcı: `ollama` · Model: `qwen2.5:7b`

Bu rapor `npm run benchmark:idea-expansion` ile canlı sağlayıcıya karşı üretilir.
CI'da çalışmaz; sağlayıcı olmadan ölçülemeyen tek kalite sorusunu yanıtlar:
kategori başına üretilen kartların kaçı gerçekten kullanılabilir?

## Özet

| Ölçüt | Değer | Eşik | Sonuç |
| --- | --- | --- | --- |
| AI modunda tamamlanan tur oranı | 100.0% | 75% | GEÇTİ |
| Tur başına ortalama kullanılabilir kart | 8.44 | 5 | GEÇTİ |

Şema kurtarmasının attığı toplam kart: **0**.
Tur başına ortalama süre: **11711 ms**.

## Turlar

| Fikir | Kategori | Mod | Kullanılabilir | Ham | Atılan | Deneme | Süre (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ekip içi karar defteri | Ana akışı derinleştir | local-ai | 8 | 8 | 0 | 1 | 11318 |
| Ekip içi karar defteri | Kapsamı daralt | local-ai | 10 | 10 | 0 | 1 | 15357 |
| Ekip içi karar defteri | Erişilebilirlik | local-ai | 8 | 8 | 0 | 1 | 10882 |
| Yürüyüş günlüğü | Ana akışı derinleştir | local-ai | 8 | 8 | 0 | 1 | 12461 |
| Yürüyüş günlüğü | Kapsamı daralt | local-ai | 8 | 8 | 0 | 1 | 9560 |
| Yürüyüş günlüğü | Bildirimler | local-ai | 8 | 8 | 0 | 1 | 9730 |
| Belge özetleyici | Ana akışı derinleştir | local-ai | 8 | 8 | 0 | 1 | 12044 |
| Belge özetleyici | Kapsamı daralt | local-ai | 8 | 8 | 0 | 1 | 10688 |
| Belge özetleyici | İnsan onayı | local-ai | 10 | 10 | 0 | 1 | 13363 |

Eşik tutmazsa istem gözden geçirilir; şema veya kurtarma gevşetilmez.
