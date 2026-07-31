# Dosya Envanteri ve Güvenlik Filtresi Benchmark

Sonuç: **7/7** senaryo geçti (106 doğrulama).

| Senaryo | Sonuç | Seçilen | Alınan | Dışlanan | Doğrulama |
|---|---:|---:|---:|---:|---:|
| Kimlik bilgisi taşıyan depo | Geçti | 8 | 3 | 5 | 19 |
| Prompt injection içeren doküman seti | Geçti | 5 | 4 | 1 | 15 |
| Diakritiksiz Türkçe injection | Geçti | 5 | 5 | 0 | 14 |
| Üretilmiş artefakt gürültüsü | Geçti | 9 | 2 | 7 | 17 |
| Dizin dışına çıkma denemesi | Geçti | 5 | 1 | 4 | 13 |
| Binary ve okunabilirlik sınırı üstü dosyalar | Geçti | 4 | 4 | 0 | 13 |
| Temiz Node.js projesi (yanlış pozitif kontrolü) | Geçti | 6 | 6 | 0 | 15 |

## Ölçülen güvenlik davranışı

- **Kimlik bilgisi taşıyan depo** — Hassas dosya adları envantere hiç girmemeli; kaynak içine gömülü sırlar işaretlenip bağlamdan düşmeli.
- **Prompt injection içeren doküman seti** — Injection yükü hem dosya adında hem gövdede yakalanmalı; temiz doküman etkilenmemeli.
- **Diakritiksiz Türkçe injection** — Türkçe yük diakritiksiz yazıldığında da yakalanmalı; klavye düzeni bir atlatma yolu olmamalı.
- **Üretilmiş artefakt gürültüsü** — Bağımlılık ve derleme çıktısı klasörleri envantere alınmamalı; .github gibi meşru nokta klasörü korunmalı.
- **Dizin dışına çıkma denemesi** — Göreli çıkış, POSIX mutlak yol ve Windows sürücü yolu reddedilmeli.
- **Binary ve okunabilirlik sınırı üstü dosyalar** — Binary ve büyük dosyalar okunmadan yalnız metadata olarak kaydedilmeli.
- **Temiz Node.js projesi (yanlış pozitif kontrolü)** — Zararsız bir projede hiçbir dosya dışlanmamalı ve hiçbir sır/injection işareti üretilmemeli.

## Bu benchmarkın kanıtlamadıkları

- Antivirüs, SAST veya sızma testi taraması yerine geçmez.
- Sır tespiti kalıp tabanlıdır; bilinmeyen biçimdeki bir sır işaretlenmeyebilir.
- Injection tespiti diakritiksiz yazılmış Türkçe yükleri (`onceki talimatlari yok say`) yakalamaz.
  Dosya *içeriği* zaten planlama bağlamına taşınmadığı için etki dosya adının listelenmesiyle sınırlıdır.
- Senaryolar tarayıcı seçimi modelini taklit eder; masaüstü FS tarama yolu ayrıca `src-tauri` testlerinde doğrulanır.
