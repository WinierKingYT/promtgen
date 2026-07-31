# Local-First Depolama ve Yedekleme Benchmark

Sonuç: **6/6** senaryo geçti (31 doğrulama).

| Senaryo | Sonuç | Doğrulama |
|---|---:|---:|
| Checkpoint bütünlüğü | Geçti | 6 |
| Geri yükleme yeni revision üretir | Geçti | 8 |
| Geri yükleme geçmişi silmez | Geçti | 4 |
| Yabancı checkpoint reddi | Geçti | 3 |
| Karantina ham veriyi korur | Geçti | 4 |
| Depo yazmadan önce doğrular | Geçti | 6 |

## Ölçülen davranış

- **Checkpoint bütünlüğü** — Checkpoint sağlama toplamı taşımalı ve diskte bozulan veriyi yakalamalı.
- **Geri yükleme yeni revision üretir** — Checkpoint geri yükleme üzerine yazmamalı; ileri doğru yeni bir revision olmalı.
- **Geri yükleme geçmişi silmez** — Eski hâle dönmek revision geçmişini ve komut günlüğünü kaybettirmemeli.
- **Yabancı checkpoint reddi** — Başka bir projeye ait checkpoint geri yüklenememeli.
- **Karantina ham veriyi korur** — Bozuk kayıt sessizce atılmamalı; nedeniyle birlikte incelenebilir kalmalı.
- **Depo yazmadan önce doğrular** — Geçersiz belge diske yazılmamalı ve başarısız yazma mevcut kaydı bozmamalı.

## Bu benchmarkın kanıtlamadıkları

- Gerçek disk arızası, dolu disk veya işletim sistemi seviyesi bozulma taklit edilmez.
- IndexedDB ve SQLite sürücülerinin kendi dayanıklılığı ölçülmez; ölçülen, PromtGen
  tarafındaki bütünlük, karantina ve geri yükleme sözleşmesidir.
- Masaüstü SQLite WAL davranışı ve yedek saklama sınırı ayrıca `src-tauri` testlerinde
  doğrulanır (`sqlite_backup_retention_and_quarantine_are_bounded`).
- Cihaz dışına otomatik eşitleme yoktur ve bu bilinçli bir sınırdır.
