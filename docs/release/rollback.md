# Rollback

1. Hatalı sürümün dağıtımını durdur ve bir önceki imzalı artefactı yeniden yayınla.
2. Proje verisini geriye doğru dönüştürme. Canonical belge yeni sürümde kalır; eski istemci açamıyorsa `.promtgen` yedeğini koru.
3. Uygulama açılış, proje listeleme, kaydetme, yeniden açma ve canonical export smoke akışını çalıştır.
4. Migration başarısız kayıtlarını karantinadan silme; son sağlam checkpoint üzerinden yeni revision olarak restore et.
5. Olay kaydına sürüm, commit SHA, etkilenen şema ve geri dönüş artefact checksum bilgisini ekle.
