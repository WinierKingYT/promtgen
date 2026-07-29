# PromtGen Modül Statüsü ve Üretim Sahipliği

Son inceleme: 2026-07-29

Statüler:

- `active`: Güncel üretim davranışının sahibi.
- `compatibility`: Eski veri veya test uyumluluğu için tutulur; yeni özellik eklenmez.
- `deprecated`: Yeni import yasaktır; kaldırma planı bekler.
- `experimental`: Ana Planner akışının dışında, sınırlı iddia taşır.
- `archive`: Production build ve test sahipliğinin dışındadır.

## Üretim envanteri

| Modül | Statü | Kaynak gerçek | Sahiplik / gelecek |
|---|---|---:|---|
| `src/v4/contracts.ts` ve `src/v4/project-document.js` | active | Evet | Canonical `ProjectDocumentV5`, normalizasyon ve şema doğrulama sahibi. |
| `src/v4/application` | active | Evet | Command transaction, fikir→plan, readiness, evidence ve change-impact use-case’lerinin sahibi. |
| `src/v4/domain` | active | Evet | Typed invariant, kimlik ve durum geçişi sınırı; application compatibility adapter’ı üzerinden kullanılır. |
| `src/v4/canonical-graph.js`, `src/v4/traceability` | active | Evet | Canonical projection, graph store, coverage, orphan, impact ve rapor davranışlarının tek üretim sahibi. |
| `src/v4/review-engine.js` | active | Evet | Skor yerine deterministic kalite bulguları ve review önerileri üretir. |
| `src/v4/ai` | active | Evet | AI task registry, ortak runtime, provider adapter’ları, typed prompt/schema, context ve provenance sahibi. |
| `src/v4/domain-packs` | active | Evet | Web/SaaS ve Backend/API runtime kuralları; ortak `DomainPackRegistry` üzerinden üretime bağlanır. |
| `src/v4/storage.js` ve `src/v4/tauri-storage.js` | active | Evet | Web ve desktop repository adaptörleri. |
| `src/react` | active | UI | Kullanıcı girişi ve projection gösterimi; application/domain davranışları aşamalı olarak feature hook’larına taşınacak. |
| `src/core`, `src/discovery`, `src/state` | compatibility | Hayır | V1–V3 test ve migration davranışları için tutulur; yeni v4 kodu doğrudan import etmemeli. |
| `src/ai` | compatibility | Hayır | Eski provider/chat sözleşmeleri; v4 AI registry ile parity sağlandıktan sonra deprecated yapılacak. |
| `src/v4/project-state-v4.js` | compatibility | Hayır | V4 fixture ve migration girişi; yeni proje üretmemeli. |
| `src/v4/ai-context.js` | compatibility | Hayır | Eski test/importlar için export-only adaptör; provider veya context implementasyonu içermez. |
| `src/v4/ai-schemas.js` | compatibility | Hayır | Eski test/importlar için export-only adaptör; şemaların sahibi `src/v4/ai/schemas/schemas.ts` dosyasıdır. |
| `src/v4/ai-discovery.js` | compatibility | Hayır | Eski test/tüketici importları için export-only facade; production React ve benchmark import grafiğinde kullanılmaz. |
| `src/v4/desktop-execution.js`, `src/v4/execution-orchestrator.js` | experimental | Hayır | Labs ve açık kullanıcı talebiyle sınırlı; Planner’ın ana çıktısı değildir. |
| `experiments/legacy-web-prototype` | archive | Hayır | Production build’i ve güncel onboarding’i temsil etmez. |
| `graphify-out` | experimental tooling | Hayır | Mimari inceleme yardımcısıdır; canonical ürün grafiği değildir. 0-edge çıktı sağlıklı kabul edilmez. |

## Tek sahiplik kararları

| Davranış | Üretim sahibi | Legacy sınırı |
|---|---|---|
| Canonical proje şeması | `src/v4/contracts.ts`, `src/v4/project-document.js` | V4/V3 yalnız migration girdisi |
| Readiness | `src/v4/application/readiness-service.ts` | Eski reviewer skoru readiness değildir |
| Review bulguları | `src/v4/review-engine.js` | Readiness skoru üretmez |
| Traceability | `src/v4/canonical-graph.js`, `src/v4/traceability` | `src/core/traceability/*` yalnız v4 re-export compatibility adapter’ıdır |
| AI görevleri | `src/v4/ai/registry.ts`, `src/v4/ai/runtime.ts`, `src/v4/ai/orchestrator.ts` | `src/ai` yeni görev alamaz; `ai-context.js` yalnız re-export yapar |
| Discovery/Idea Lab üretim koordinasyonu | `src/v4/application/discovery-generation-service.ts`, `src/v4/application/idea-lab-generation-service.ts` | `ai-discovery.js` provider çağrısı yapamaz |
| Deterministik fikir planlama | `src/v4/application/deterministic-idea-planning.ts` | UI ve compatibility facade ayrı fallback kuralı tanımlayamaz |
| Domain kuralları | `src/v4/domain-packs/registry.ts` | UI veya task compiler paket adına dallanamaz |
| Canonical mutasyon | `src/v4/application/command-transaction.ts` ve application servisleri | React doğrudan revision hesaplamamalı |

## Kaldırmadan önce gereken kanıtlar

1. Legacy import kullanan production entrypoint listesi.
2. Her eski davranış için v4 parity eşlemesi.
3. Fixture tabanlı migration ve export round-trip.
4. Eski testin eşdeğer v4 testine yönlendirilmesi.
5. Bir release boyunca compatibility kullanımının sıfırlandığını gösteren import-graph kontrolü.

## Bilinen doğrudan compatibility bağımlılıkları

- V4 production AI import grafiğinde doğrudan compatibility bağımlılığı kalmadı.
- `ai-context.js` ve `ai-schemas.js` yalnız eski test/tüketici importları için export-only yüzeylerdir.

Traceability parity kararı ve kaldırma kapısı [TRACEABILITY_PARITY.md](TRACEABILITY_PARITY.md) belgesinde kayıtlıdır. Kalan liste “temiz mimari tamamlandı” iddiasını engeller ve Aşama 1 parity çalışmasının devam envanteridir.
