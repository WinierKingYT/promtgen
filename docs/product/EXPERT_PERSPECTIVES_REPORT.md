# Uzman Perspektifleri Benchmark

Sonuç: **6/6** senaryo geçti (32 doğrulama).

| Senaryo | Sonuç | Doğrulama |
|---|---:|---:|
| Komite alana göre kurulur | Geçti | 5 |
| Bağımsız LLM ajanı çalışmaz | Geçti | 5 |
| Her uzman değerlendirme üretir | Geçti | 5 |
| Oylama kanıt ister | Geçti | 6 |
| Güvenlik vetosu | Geçti | 7 |
| Özel uzman ve mutasyon yokluğu | Geçti | 4 |

## Ölçülen davranış

- **Komite alana göre kurulur** — Oyun, web, mobil ve AI projeleri farklı uzman perspektifleri almalı; bilinmeyen alan varsayılana düşmeli.
- **Bağımsız LLM ajanı çalışmaz** — Yetenek yerel kural motorudur; çıktı senkron ve deterministik olmalı.
- **Her uzman değerlendirme üretir** — Komitedeki her perspektif öneri ve karar adayı üretmeli, kimliğini korumalı.
- **Oylama kanıt ister** — Kabul edilmiş karar yokken hiçbir perspektif kesin onay vermemeli.
- **Güvenlik vetosu** — Güvenlik perspektifi, açık bir güvenlik kararı olmadan onay vermemeli.
- **Özel uzman ve mutasyon yokluğu** — Projeye özel uzman eklenebilmeli; perspektifler canonical belgeyi değiştirmemeli.

## Bu benchmarkın kanıtlamadıkları

- Perspektiflerin **isabetli** olduğunu göstermez. Ölçülen; komitenin alana göre
  kurulduğu, çıktının deterministik olduğu ve kanıtsız onay üretilmediğidir.
- Öneri metinleri sabit kural şablonlarından gelir; proje analizinden türetilmez.
- Bağımsız LLM ajanları çalıştırılmaz. `no-llm-agents-run` senaryosu tam olarak
  bu beyanın doğruluğunu ölçer; çıktı asenkron olsaydı senaryo kalırdı.
- Güvenlik vetosu yalnız komitede güvenlik kimliği taşıyan bir uzman varken
  uygulanır. Komite bileşimi alana göre değişir.
