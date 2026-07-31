# İzole Codex Worktree Yürütmesi Benchmark

Sonuç: **9/9** senaryo geçti.

Bu senaryolar `src-tauri/src/execution.rs` içindeki native testlerden okunur;
liste elle yazılmaz, `cargo test` çıktısından ayrıştırılır.

| Senaryo | Sonuç |
|---|---:|
| İmza durumu eşlemesi fail-closed davranır | Geçti |
| Yalnız codex/codex.exe adlı dosya seçilebilir | Geçti |
| Rol sırası atlanamaz | Geçti |
| Her ajan rolünün sandbox ve risk seviyesi sabittir | Geçti |
| İzole worktree ve patch akışı uçtan uca çalışır | Geçti |
| Proje etiketleri yol güvenlidir | Geçti |
| Geçerli imza geçer, bozulan imza engellenir | Geçti |
| İmza uyarısı gerçek riski adlandırır | Geçti |
| İmzasız binary imzalı olarak raporlanmaz | Geçti |

## Bu benchmarkın kanıtlamadıkları

- Codex CLI'ın kendi davranışı ölçülmez; testler sahte bir çalıştırılabilir kullanır.
- İmza doğrulaması yalnız Windows'ta gerçek bir denetim yapar; diğer platformlarda
  durum `unsupported-platform` olarak raporlanır ve bu açıkça gösterilir.
- Ajan çıktısının doğruluğu değil, sandbox/rol/worktree sınırlarının korunduğu ölçülür.
