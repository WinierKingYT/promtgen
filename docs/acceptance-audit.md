# PromtGen V4 kabul denetimi

Bu belge production React/Tauri yolunun orijinal ürün kabul ölçütlerini hangi otomatik kanıtlarla karşıladığını gösterir.

| Kabul ölçütü | Uygulama sınırı | Otomatik kanıt |
|---|---|---|
| Kısa fikirle proje başlatma ve ölçek önerisi | `planning-engine.js` | `planning-engine.test.js`, `acceptance-flow.test.js` |
| Her öneride kabul/düzenle/ertele/reddet ve açık onay | `planning-engine.js`, React öneri kartı | `planning-engine.test.js`, `acceptance-flow.test.js` |
| Canonical yaşayan plan, readiness ve downstream invalidation | `project-state-v4.js`, `planning-engine.js`, `canonical-graph.js` | V4 planning/graph/review testleri |
| Finalize, yeniden açma, revision karşılaştırma/restore | `planning-engine.js` | `planning-engine.test.js`, `acceptance-flow.test.js` |
| PWA IndexedDB ve Tauri SQLite/keyring | `storage.js`, `tauri-storage.js`, Rust `lib.rs` | storage testleri ve 7 Rust testi |
| Otomatik yedek, karantina ve sağlık tanısı | Rust SQLite katmanı, `StorageHealthPanel` | `desktop-storage.test.js`, Rust retention/karantina testi |
| `.promtgen` güvenli transfer ve canonical export tutarlılığı | `exporter.js` | `migration-export.test.js`, `acceptance-flow.test.js` |
| Ollama ve kontrollü bulut sağlayıcıları | `provider-url-policy.js`, `ai-context.js` | provider ve CSP güvenlik testleri |
| Mevcut proje güvenli envanteri | `project-analyzer.js`, native klasör seçici | analyzer ve Rust inventory testleri |
| Codex/Cursor/Claude/Generic ajan paketleri | `exporter.js`, IDE export dialogu | migration/export ve acceptance testleri |
| İzole Planner→Implementer→Reviewer→Verifier yürütme | execution orchestrator + Rust worktree | execution JS/Rust testleri |
| Erişilebilir ve otomasyona dayanıklı finalizasyon onayı | React uygulama içi dialog | `rc1-ui-contract.test.js`, tarayıcı RC1 smoke akışı |
| Local-first sistem doktoru ve güvenli runtime görünürlüğü | `runtime-health.js`, Runtime Health dialogu | `runtime-health.test.js`, provider güvenlik testleri |
| Kullanıcı kontrollü, native-doğrulamalı Codex CLI seçimi | Rust execution settings + Sistem Doktoru | Rust filename testi, `desktop-execution-settings.test.js` |
| Codex process → izole worktree → patch native zinciri | Rust `execute_codex_program` sınırı | Sahte executable derleyen `native_codex_worktree_and_patch_flow_runs_end_to_end` |
| Yazılım dışı alanlar | deklaratif module registry | module registry/reviewer testleri |
| Legacy UI/state/export production graph’ında yok | React entry import sınırı | `runtime-boundary.test.js` |

Legacy V1–V3 domain dosyaları yalnız migration ve regresyon uyumluluğu için repository’de tutulur. `index.html` yalnız `src/react/main.tsx` entry’sini yükler; eski `src/main.js`, state, UI ve exporter yolları production import graph’ında değildir.
