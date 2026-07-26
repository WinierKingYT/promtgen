# Windows Signing

Production Windows paketleri Tauri signing anahtarı ve CI secret'larıyla imzalanmalıdır. Release evidence `artifacts.signing` alanında `signed` sonucu göstermeden production etiketi verilemez.

Yerel ve PR buildleri açıkça `unsigned` olarak raporlanır. İmzalı artefact için yayıncı, sürüm ve SHA-256 checksum release kaydında birlikte tutulur; binary değişirse yeniden doğrulama gerekir.
