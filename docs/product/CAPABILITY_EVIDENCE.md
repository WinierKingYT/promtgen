# Yetenek Kanıtları

Bu belge doğrudan `src/v4/capability-registry.ts` kaynağından üretilir. Elle “stable” ilanı yapılamaz; her yetenek makinece denetlenen terfi kapısını geçmelidir. Statik belge geçmiş kanıt commit'ini gösterir; güncel commit eşleşmesi yalnız CI tarafından üretilen `release-evidence.json` ile doğrulanır.

Terfi kapısı iki boyuttan oluşur. **Yetenek kanıtı** boyutu (test, senaryo, kullanıcı, kurtarma) bu belgede raporlanır. **Sürüm bağlamı** boyutu (kanıt commit'inin güncel build ile eşleşmesi) burada raporlanamaz, çünkü statik belge üretiminin commit bağlamı yoktur. Bu nedenle aşağıdaki tabloda “Kanıt tam” yazması **Stable ilanı değildir**: hiçbir yetenek CI dışında Stable'a terfi edemez.

## Stable terfi kapısı

- En az bir üretim entegrasyon, browser E2E veya native E2E kanıtı.
- Desteklenen her platform için otomatik kanıt.
- En az 5 benchmark senaryosu ve en az %90 başarı oranı.
- Sıfır açık kritik kusur.
- Belgelenmiş kurtarma veya geri alma yolu.
- En az 5 gerçek kullanıcı katılımcısı.
- Doğrulanan commit ile güncel build/CI commit'inin eşleşmesi. _(yalnız CI; bu belgede doğrulanmaz)_

## Kanıt tablosu

Son sütun yalnız yetenek kanıtı boyutunu gösterir; sürüm bağlamı boyutu dahil değildir.

| Yetenek | İlan | Otomatik kanıt | Senaryo | Kullanıcı | Kurtarma | Son commit | Yetenek kanıt kapısı |
|---|---|---|---|---:|---|---|---|
| Açıklanabilir Plan Kalite Kapısı | candidate-stable | integration-test: tests/v4/readiness-service.test.ts<br>browser-e2e: tests/e2e/smoke.spec.ts | 10/10 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Web/SaaS Planlama Paketi | candidate-stable | integration-test: tests/v4/web-saas-domain-pack.test.ts<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 5/5 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Backend/API Planlama Paketi | beta | integration-test: tests/v4/backend-api-domain-pack.test.ts<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 5/5 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Canonical Yaşayan Plan ve Revizyon Yönetimi | candidate-stable | integration-test: tests/v4/acceptance-flow.test.js<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 10/10 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Görev Teslim Kanıtı | beta | integration-test: tests/v4/implementation-evidence.test.ts<br>browser-e2e: tests/e2e/smoke.spec.ts | 5/5 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Plan–Kod Hizalama | beta | integration-test: tests/v4/plan-code-alignment.test.ts<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 5/5 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Local-First Depolama ve Yedekleme | candidate-stable | integration-test: tests/v4/storage-durability.test.ts<br>native-e2e: tests/v4/desktop-storage.test.js | 6/6 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Uzman Perspektifleri | experimental | unit-test: tests/v4/review-engine.test.js<br>integration-test: tests/v4/expert-perspectives.test.ts | 6/6 (100%) | 0 | docs/release/perspectives-recovery.md | 2acd7ba | Bloklu |
| Mimari Karşılaştırma Şablonu | beta | unit-test: tests/v4/idea-lab.test.js<br>integration-test: tests/v4/architecture-comparator.test.ts | 6/6 (100%) | 0 | docs/release/comparator-recovery.md | 2acd7ba | Bloklu |
| AI Sağlayıcı Entegrasyonu | beta | unit-test: tests/v4/provider-orchestrator.test.ts<br>integration-test: tests/v4/provider-integration.test.js | 8/8 (100%) | 0 | docs/release/provider-recovery.md | 2acd7ba | Bloklu |
| İzole Codex Worktree Yürütmesi | beta | native-e2e: src-tauri/src/execution.rs | 9/9 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Dosya Envanteri ve Güvenlik Filtresi | candidate-stable | integration-test: tests/v4/project-analyzer.test.js<br>native-e2e: src-tauri/src/lib.rs | 7/7 (100%) | 0 | docs/release/inventory-recovery.md | 2acd7ba | Bloklu |
| Gelişmiş Dışa Aktarım | candidate-stable | integration-test: tests/v4/migration-export.test.js | 10/10 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |

## Açık terfi engelleri

Bunlar kanıt üretilerek kapatılabilen engellerdir. Hepsi kapansa bile Stable ilanı için CI'ın sürüm bağlamı doğrulaması gerekir.

### Açıklanabilir Plan Kalite Kapısı

- En az 5 kullanıcıdan kanıt gerekli.

### Web/SaaS Planlama Paketi

- En az 5 kullanıcıdan kanıt gerekli.

### Backend/API Planlama Paketi

- En az 5 kullanıcıdan kanıt gerekli.

### Canonical Yaşayan Plan ve Revizyon Yönetimi

- En az 5 kullanıcıdan kanıt gerekli.

### Görev Teslim Kanıtı

- En az 5 kullanıcıdan kanıt gerekli.

### Plan–Kod Hizalama

- En az 5 kullanıcıdan kanıt gerekli.

### Local-First Depolama ve Yedekleme

- En az 5 kullanıcıdan kanıt gerekli.

### Uzman Perspektifleri

- En az 5 kullanıcıdan kanıt gerekli.

### Mimari Karşılaştırma Şablonu

- En az 5 kullanıcıdan kanıt gerekli.

### AI Sağlayıcı Entegrasyonu

- En az 5 kullanıcıdan kanıt gerekli.

### İzole Codex Worktree Yürütmesi

- En az 5 kullanıcıdan kanıt gerekli.

### Dosya Envanteri ve Güvenlik Filtresi

- En az 5 kullanıcıdan kanıt gerekli.

### Gelişmiş Dışa Aktarım

- En az 5 kullanıcıdan kanıt gerekli.

## Proje desteği özeti

- **stable:** 0 proje türü
- **candidate-stable:** 5 proje türü
- **beta:** 3 proje türü
- **experimental:** 2 proje türü
- **unsupported:** 5 proje türü

Benchmark ve kullanıcı sayıları kaynaklarıyla kaydedilmeden sonuç başarısı iddia edilmez.
