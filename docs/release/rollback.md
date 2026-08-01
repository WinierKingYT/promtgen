# Rollback

1. Hatalı sürümün dağıtımını durdur ve bir önceki imzalı artefactı yeniden yayınla.
2. Proje verisini geriye doğru dönüştürme. Canonical belge yeni sürümde kalır; eski istemci açamıyorsa `.promtgen` yedeğini koru.
3. Uygulama açılış, proje listeleme, kaydetme, yeniden açma ve canonical export smoke akışını çalıştır.
4. Migration başarısız kayıtlarını karantinadan silme; son sağlam checkpoint üzerinden yeni revision olarak restore et.
5. Olay kaydına sürüm, commit SHA, etkilenen şema ve geri dönüş artefact checksum bilgisini ekle.

## Taşınabilir paketle kurtarma sözleşmesi

- SHA-256 doğrulaması paket girdilerinin manifestteki değerlerle eşleştiğini kanıtlar; paketin yayıncısını, sahibini veya kaynağın güvenilirliğini kanıtlamaz.
- Paket mevcut bir projeye uygulanırsa paketin canonical içeriği yerel zaman çizelgesine **yeni revision** olarak eklenir. Yerel revision, export, execution ve command log geçmişi korunur; paketin geçmişi yerel geçmişin yerine geçmez.
- UI hem paketin kaynak canonical revision'ını hem oluşacak yerel revision'ı gösterir. Bu numaraların aynı olması beklenmez.
- Kriptografik bütünlük kaydı olmayan eski paketler mevcut projeyi kurtarmadan önce ikinci ve açık kullanıcı onayı ister.
