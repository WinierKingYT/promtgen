# Pilot — süreç provası

**Bu klasördeki hiçbir şey çalışma kanıtı DEĞİLDİR.**

Pilotun amacı sonuç üretmek değil, kayıt sürecini kırmak: `submissions.json`
alanlarının gerçekten doldurulabilir olup olmadığını, kör kimliğin nerede
sızdığını ve sürelerin nasıl ölçüleceğini 18 gönderime girişmeden görmek.

## Neden ayrı klasör

Pilot verisi `benchmarks/comparison-v2/submissions.json` içine **yazılmaz**.
Yazılsaydı çalışma, katılımcısı olmayan ve körlüğü bulunmayan kayıtlarla
kirlenirdi; sonuç raporu da onları gerçek gönderim sayardı.

## Pilotun körlük sınırı

Pilotu yürüten kişi hangi çıktının hangi koldan geldiğini **bilir**. Bu yüzden
pilotta kör değerlendirme yapılamaz; yalnız kaydın doldurulabilirliği sınanır.
Gerçek çalışmada değerlendirici katılımcıdan farklı bir kişidir ve eşlemeyi
görmez.

## Model notu

Pilot ve çalışma aynı yerel model üzerinde yürütülürse (üç kol da aynı model)
en büyük karıştırıcı ortadan kalkar: çıkan fark yöntemin katkısıdır, modelin
gücü değil. Ama zayıf bir modelle toplanan veri yalnız şu soruyu cevaplar:
"model zayıfken yöntem fark yaratıyor mu?" Güçlü modellere genellenemez ve
raporda böyle yazılmalıdır.
