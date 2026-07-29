# Canonical Traceability Parity ve Sahiplik Kararı

Tarih: 2026-07-29
Karar: `src/v4/traceability` tek üretim implementasyonudur.

## Taşınan davranışlar

| Davranış | Üretim sahibi | Parity kanıtı |
|---|---|---|
| Node ve edge saklama, indeksleme, snapshot/diff | `src/v4/traceability/graph-store.js` | `tests/core/traceability.test.js`, `tests/v4/architecture/traceability-ownership.test.ts` |
| Gereksinim, hedef, karar ve görev kapsamı | `src/v4/traceability/coverage-calculator.js` | Eski core testleri compatibility adapter üzerinden aynı sınıfı çalıştırır |
| Orphan ve eksik bağlantı bulguları | `src/v4/traceability/orphan-detector.js` | Core parity testleri |
| Değişiklik etkisi ve propagation | `src/v4/traceability/impact-engine.js` | Core parity ve canonical impact testleri |
| Rapor, health, cycle ve state projection | `src/v4/traceability/traceability-engine.js` | Core parity ve `tests/v4/canonical-graph.test.js` |
| Node/edge türleri ve varsayılan kurallar | `src/v4/traceability/traceability-types.js` | Compatibility identity testi |

## Compatibility sınırı

`src/core/traceability/*` artık davranış içermez. Her dosya yalnız karşılık gelen v4 modülünü re-export eder. Böylece:

- Eski test ve tüketiciler kırılmaz.
- Yeni v4 kodu legacy katmana import yapmaz.
- İki ayrı traceability implementasyonu oluşmaz.
- Compatibility kullanım noktaları import aramasıyla ölçülebilir.

## Kaldırma kapısı

Compatibility adapter’ları şu koşullardan sonra kaldırılabilir:

1. `tests/core/traceability.test.js` v4 test yapısına taşınır.
2. `tests/core/reviewer.test.js` doğrudan v4 traceability import eder.
3. En az bir release boyunca production kaynaklarında `src/core/traceability` importu bulunmaz.
4. Migration veya eski eklenti girişlerinin bu import yoluna ihtiyacı olmadığı doğrulanır.

## Rollback

Davranış değişikliği yapılmadı; dosyalar aynı kodla v4 sahipliğine taşındı. Regresyonda canonical importlar geçici olarak compatibility yoluna döndürülebilir, ancak iki implementasyon paralel tutulmamalıdır.
