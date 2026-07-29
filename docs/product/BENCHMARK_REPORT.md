# Planner Çekirdek Benchmark Raporu

Bu rapor `benchmarks/planner/scenarios.json` senaryolarının gerçek canonical model, task compiler, readiness ve exporter üretim zincirinde çalıştırılmasıyla üretilir.

- Suite: `planner-core-v1`
- Son çalışma: 2026-07-29T17:11:27.927Z
- Sonuç: 10/10
- Başarı oranı: %100
- Kapsam: deterministic ürün sözleşmesi benchmark'ı; gerçek kullanıcı sonucu değildir.

| Senaryo | Alan | Sonuç | Readiness | Must→Görev | Must→Test | Export dosyası |
|---|---|---|---:|---:|---:|---:|
| Ürün Landing Page | web-app | Geçti | 98 | 100% | 100% | 11 |
| Yönetim Paneli | admin-panel | Geçti | 98 | 100% | 100% | 11 |
| REST API | backend-api | Geçti | 98 | 100% | 100% | 11 |
| Küçük SaaS | small-saas | Geçti | 98 | 100% | 100% | 11 |
| E-ticaret MVP | web-app | Geçti | 98 | 100% | 100% | 11 |
| Dosya İşleme Aracı | internal-tool | Geçti | 98 | 100% | 100% | 11 |
| Mevcut Uygulamaya Özellik | web-app | Geçti | 98 | 100% | 100% | 11 |
| Rol Tabanlı Uygulama | backend-api | Geçti | 98 | 100% | 100% | 11 |
| Local-first Not Uygulaması | web-app | Geçti | 98 | 100% | 100% | 11 |
| AI Doküman Aracı | internal-tool | Geçti | 98 | 100% | 100% | 11 |

## Capability kanıtı

- **canonical-planning:** 10/10
- **canonical-export:** 10/10
- **readiness-quality-gate:** 10/10

Bu rapor kullanıcı kanıtı yerine geçmez. Capability ancak ayrı kullanıcı araştırması eşiği de karşılandığında Stable olabilir.
