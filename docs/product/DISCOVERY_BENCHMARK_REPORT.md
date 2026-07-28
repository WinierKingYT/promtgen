# Guided Discovery Benchmark Raporu

Bu rapor yalnız ham fikir girdisiyle başlayan üretim discovery zincirini ölçer. Senaryolar hedef kullanıcı, problem, kapsam veya gereksinimleri başlangıç projesine doğrudan eklemez.

Akış:

`ham fikir → discovery sinyalleri → sistem yorumu ve kritik sorular → simüle kullanıcı düzeltmesi → açık onay → canonical vizyon ve kapsam`

- Suite: `guided-discovery-v1`
- Son çalışma: 2026-07-28T20:32:32.598Z
- Sonuç: 8/8
- Başarı oranı: %100
- Kritik sinyal yakalama: %96
- İlk hedef kullanıcı terim kapsamı: %31
- Ortalama kritik soru: 2.1
- Ortalama kullanıcı düzeltme alanı: 8.0/8
- Otomatik kullanıcı onayı: 0
- Erken teknik kesinleştirme: 0

| Senaryo | Tür | Sonuç | Sinyal yakalama | Soru | Düzeltilen alan | İlk güven |
|---|---|---|---:|---:|---:|---:|
| Belirsiz restoran AI sistemi | ambiguous | Geçti | 100% | 1 | 8 | 51% |
| Bireysel ve ekip kapsamı çatışması | adversarial | Geçti | 67% | 2 | 8 | 59% |
| Mutlak güvenilirlik beklentisi | adversarial | Geçti | 100% | 3 | 8 | 40% |
| Erken teknoloji kilidi | adversarial | Geçti | 100% | 3 | 8 | 44% |
| Hassas sağlık verisi | adversarial | Geçti | 100% | 1 | 8 | 60% |
| Aynı anda üç platform | adversarial | Geçti | 100% | 3 | 8 | 40% |
| MVP ve gelecek kapsamı karışımı | adversarial | Geçti | 100% | 3 | 8 | 49% |
| Local-first AI doküman aracı | ambiguous | Geçti | 100% | 1 | 8 | 60% |

## Yorumlama sınırı

Bu benchmark gerçek kullanıcı araştırması veya AI sağlayıcı üstünlüğü değildir. Kullanıcı cevapları sürümlenmiş bir simülatörle canonical düzenleme alanlarına uygulanır. Bu nedenle sonuç:

- ham fikirde kritik belirsizliklerin görünür olduğunu,
- sistemin yorumu kendiliğinden onaylamadığını,
- kullanıcı düzeltmesinin canonical kapsamı kayıpsız oluşturduğunu

kanıtlar. Serbest biçimli kullanıcı cevabından doğru structured plan çıkarma kalitesi ve PromtGen'in standart sohbet araçlarına üstünlüğü ayrı kör karşılaştırma verisi gerektirir.
