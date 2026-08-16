# PromtGen Karşılaştırmalı Çalışma — v2

`promtgen-comparison-v2`. Standart AI sohbeti, uzun master prompt ve PromtGen'in
**V3 akışını** (Fikir Tasarımı → Teknik Çözüm Tasarımı → Uygulama Planı) aynı
kurallarla karşılaştırır.

## v1'e ne oldu

v1 dondurulmuş ama **hiç veri toplamamıştı** ve artık var olmayan bir ürün
modelini (`Fikir → Plan` doğrudan geçişi) ölçüyordu. Tanımı düzenlenmedi;
`benchmarks/comparison/` içinde kayıt olarak duruyor. Yürüyen bir çalışmanın
tanımı düzenlenmez — meşru değişiklik yeni bir `studyId` açmaktır ve bu odur.

## v1'den farkları

**Master prompt aynı.** Özeti bile aynı değer. Ürün değişti diye rakibi de
değiştirmek karşılaştırmayı anlamsız kılardı: o zaman iki değişkeni birden
oynatmış olurduk.

**Yeni ölçüt: `technicalDecisionQuality`.** V3'ün merkezi iddiası, teknik
kararların gereksinimlerin içine gömülmek yerine kendi aşamasına çıkması.
Bunu ölçmeyen bir çalışma o iddiayı ne doğrulayabilir ne de çürütebilir.
Master prompt zaten *"alternatifi ve neden seçilmediğini de belirt"* diyor,
yani rakip bu ölçütte dezavantajlı değil — ölçüt PromtGen lehine seçilmiş
olmuyor.

**Yeni senaryo: `s6-at-sistemi`.** Destek matrisinde `unsupported` olan bir
alan (3D oyun). Yalnızca desteklenen alanlarda ölçüm yapmak, sonucu kendi
lehimize seçilmiş bir örneklemle üretmek olurdu. Bu senaryo kötü sonuç
verirse, o da bir bulgudur.

## Akış

1. Her yöntem aynı proje fikirleriyle çalıştırılır.
2. Çıktılar yöntem adı içermeyen `submissions.json` kayıtlarına dönüştürülür.
3. Yöntemler yalnız `blind-map.json` içinde kör kimliğe bağlanır.
4. İnsan değerlendirmeleri yöntem açılmadan `human-evaluations.json` içine
   yazılır. **Yedi ölçütün tamamı zorunlu:** eksik ölçüt reddedilir, çalışmada
   tanımsız ölçüt de reddedilir.
5. Açık rıza veren anonim kullanıcı oturumları yalnız izin verilen metriklerle
   `user-sessions.json` içinde tutulur.
6. `npm run comparison:benchmark-v2` raporu üretir.
7. `npm run comparison:publish-gate-v2` yeterli kanıt yoksa başarısız olur.

Boş dosyalar kanıt değildir. **Gerçek kullanıcı adı, e-posta, serbest metin
veya proje içeriği bu klasöre yazılmamalıdır.**

## Ürün kanıtı hangi çalışmadan gelir

`src/v4/product/generated-comparison-evidence.ts` şu an **v1'den** üretiliyor
(ikisi de boş olduğu için pratikte fark yok). v2 gerçek veri topladığında
devir açık bir kararla yapılır:

```bash
npm run comparison:benchmark-v2 -- --publish-evidence
```

İki çalışma da o dosyaya yazsaydı son çalışan sessizce kazanır ve ürün, hangi
çalışmanın kanıtını gösterdiğini bilmezdi.
