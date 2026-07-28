# PromtGen Karşılaştırmalı Çalışma

Bu klasör standart AI sohbeti, uzun master prompt ve PromtGen planlama akışını aynı kurallarla karşılaştırmak için kullanılır.

1. Her yöntem aynı proje fikirleriyle çalıştırılır.
2. Çıktılar yöntem adı içermeyen `submissions.json` kayıtlarına dönüştürülür.
3. Yöntemler yalnız `blind-map.json` içinde kör kimliğe bağlanır.
4. İnsan değerlendirmeleri yöntem açılmadan `human-evaluations.json` içine yazılır.
5. Açık rıza veren anonim kullanıcı oturumları yalnız izin verilen metriklerle `user-sessions.json` içinde tutulur.
6. `npm run comparison:benchmark` raporu üretir.
7. `npm run comparison:publish-gate` yeterli kanıt yoksa başarısız olur.

Boş dosyalar kanıt değildir. Gerçek kullanıcı adı, e-posta, serbest metin veya proje içeriği bu klasöre yazılmamalıdır.
