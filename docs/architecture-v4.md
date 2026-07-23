# PromtGen V4 mimari sınırları

## Tek doğruluk kaynağı

`ProjectStateV4` canonical proje durumudur. Sohbet, öneriler ve editör görünümü bu durumu besler; belgeler ve ajan promptları yalnız seçilen canonical revision’dan türetilir. Export edilmiş dosyalar tekrar içeri alınarak planı değiştirmez.

## Katmanlar

1. `src/v4/project-state-v4.js` yaşam döngüsü, aşama kayıt defteri ve bölüm şablonlarını kurar.
2. `src/v4/canonical-entities.js` tipli varlıkları normalize eder ve eski V4 belgelerini geriye uyumlu hale getirir.
3. `src/v4/planning-engine.js` ölçek değerlendirmesi, onaylı patch uygulama, readiness ve revision davranışını yürütür.
4. `src/v4/ai-*` filtrelenmiş bağlamı sağlayıcıya taşır; yapılandırılmış yanıtı öneri paketine çevirir.
5. `src/v4/storage.js` ve `tauri-storage.js` aynı repository davranışını IndexedDB ve SQLite üzerinde uygular.
6. `src/v4/exporter.js` seçilen revision’ı çözer; derinliğe bağlı belge seti ile `AGENTS.md`, `CLAUDE.md`, Cursor rule ve yürütme manifesti içeren IDE çalışma paketini üretir.
7. `src/react` bu servislerin kullanıcı onaylı orkestrasyonunu sunar.
8. `src/v4/execution-orchestrator.js` canonical rol sırasını; `src-tauri/src/execution.rs` token, native onay, worktree ve sabit Codex CLI sınırını uygular.
9. Tauri SQLite katmanı WAL, `quick_check`, transaction tabanlı son-20 yedek retention’ı ve bozuk JSON karantinası uygular; `StorageHealthPanel` yalnız özet/metadata gösterir.
10. `planning-memory.js` geçmiş projelerden isim/fikir taşımayan toplulaştırılmış tercih sinyalleri üretir; bu bağlam yalnız kullanıcı ayarı etkinse AI keşif çağrısına eklenir.
11. `module-registry.js` yazılım, araştırma, içerik, iş/operasyon ve etkinlik alanlarını deklaratif katkılarla etkinleştirir; aktif paketin reviewer kuralları ve alan belgesi canonical exporttan türetilir.

## Değişmezler

- AI yanıtı, kullanıcı onayı olmadan canonical bölümleri değiştiremez.
- Reddedilen öneri fingerprint’i yeniden önerilmez.
- Plan derinliği değişikliği mevcut içeriği silmez.
- Restore eski revision’ı ezmez; güncel plan üzerinde yeni revision oluşturur.
- Export, kaynak revision ve SHA-256 canonical hash kaydını taşır.
- IDE çalışma paketi canonical revision’ı değiştiremez; ajan çıktısı kullanıcı incelemesi olmadan plana geri yazılamaz.
- Import doğrulaması başarısızsa proje repository’ye yazılmaz.
- Frontend native execution için dosya yolu veya executable gönderemez; yalnız native seçimden alınan kısa ömürlü token ve sabit rol kimliği kullanır.
- Yerel yedek restore işlemi proje kimliğini doğrular, native kullanıcı onayı ister ve mevcut revision/geçmiş/export denetim izini korur.
- Proje hafızası varsayılan kapalıdır; ham proje adı, fikir veya belge içeriği hafıza çıktısına dahil edilmez.

## Geçiş yaklaşımı

React/V4 parity tamamlandığı için eski UI/state/export yolu production import graph’ından çıkarılmıştır ve `runtime-boundary.test.js` bu sınırı fail-closed doğrular. Legacy V2/V3 domain ve test paketi yalnız migration/veri uyumluluğu ile regresyon kanıtı olarak tutulur; production entry tarafından yüklenmez.
