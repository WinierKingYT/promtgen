# Aşama Tasarımı Benchmark Raporu

Bu suite Idea Design ve Solution Design aşamalarının **çekirdek davranışını** ölçer.

- Suite: `stage-design-v1`
- Son çalışma: 2026-08-16T19:31:57.056Z
- Sonuç: 4/4
- Başarı oranı: %100
- Kritik konu yakalama: %100
- İlk soru isabeti: %100

| Senaryo | Alan | Sonuç | Konu yakalama | İlk soru | Kapı reddi | Kapı açılışı | Aday süzgeci | ADR bağı |
|---|---|---|---:|:-:|:-:|:-:|:-:|:-:|
| Unity at sistemi | game | Geçti | 100% | ✓ | ✓ | ✓ | ✓ | ✓ |
| Saha envanter uygulaması | web | Geçti | 100% | ✓ | ✓ | ✓ | ✓ | ✓ |
| Webhook geçidi | backend | Geçti | 100% | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bilinmeyen alan — arı kovanı izleme | other | Geçti | 100% | ✓ | ✓ | ✓ | ✓ | ✓ |

## Ne ölçer, ne ölçmez

AI çıktısı **sabittir**; bu suite model kalitesini ölçmez. Ölçtüğü şey, V3'ün
söz verdiği davranışların gerçekten kodda olması:

1. Kritik konular keşfediliyor mu — bilinmeyen alanda da,
2. İlk soru en yüksek bilgi kazançlısı mı (isim etiketi rengi değil, sahiplik modeli),
3. Kapı bloklayan konu varken onayı reddediyor, çözülünce açıyor mu,
4. Gerekçesiz geri dönülemez teknoloji önerisi eleniyor mu,
5. ADR'ye bağlanmamış teknik karar kapıya takılıyor mu.

Ayrım kasıtlı: **sağlayıcı değişince bu benchmark'ın sonucu değişmemeli.**
Değişirse ölçtüğü şey davranış değil, modelin o günkü hâli olurdu. Gerçek
model kalitesi ve kullanıcı faydası ayrı kör karşılaştırma verisi gerektirir
(bkz. `COMPARISON_STUDY_PROTOCOL.md`).

Bilinmeyen alan senaryosu (arı kovanı izleme) suite'te **zorunludur**: alan
paketi olmayan bir projede PromtGen'in çalışmaması kabul edilebilir bir sonuç
değil ve bunu ölçmeyen bir suite bunu kanıtlamaz.
