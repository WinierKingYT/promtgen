# Yetenek Kanıtları

Bu belge doğrudan `src/v4/capability-registry.ts` kaynağından üretilir. Elle “stable” ilanı yapılamaz; her yetenek makinece denetlenen terfi kapısını geçmelidir.

## Stable terfi kapısı

- En az bir üretim entegrasyon, browser E2E veya native E2E kanıtı.
- Desteklenen her platform için otomatik kanıt.
- En az 5 benchmark senaryosu ve en az %90 başarı oranı.
- Sıfır açık kritik kusur.
- Belgelenmiş kurtarma veya geri alma yolu.
- En az 5 gerçek kullanıcı katılımcısı.
- Son doğrulanan commit kaydı.

## Kanıt tablosu

| Yetenek | İlan | Otomatik kanıt | Senaryo | Kullanıcı | Kurtarma | Son commit | Stable kapısı |
|---|---|---|---|---:|---|---|---|
| Web/SaaS Planlama Paketi | candidate-stable | integration-test: tests/v4/web-saas-domain-pack.test.ts<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 5/5 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Canonical Yaşayan Plan ve Revizyon Yönetimi | candidate-stable | integration-test: tests/v4/acceptance-flow.test.js<br>browser-e2e: tests/e2e/guided-workflow.spec.ts | 10/10 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Görev Teslim Kanıtı | beta | integration-test: tests/v4/implementation-evidence.test.ts<br>browser-e2e: tests/e2e/smoke.spec.ts | 0/0 | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Local-First Depolama ve Yedekleme | candidate-stable | integration-test: tests/v4/storage-durability.test.ts<br>native-e2e: tests/v4/desktop-storage.test.js | 0/0 | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Uzman Perspektifleri | experimental | unit-test: tests/v4/review-engine.test.js | 0/0 | 0 | Belgelenmedi | 2acd7ba | Bloklu |
| Mimari Karşılaştırma Şablonu | beta | unit-test: tests/v4/idea-lab.test.js | 0/0 | 0 | Belgelenmedi | 2acd7ba | Bloklu |
| AI Sağlayıcı Entegrasyonu | beta | unit-test: tests/v4/provider-orchestrator.test.ts<br>integration-test: tests/v4/provider-integration.test.js | 0/0 | 0 | Belgelenmedi | 2acd7ba | Bloklu |
| İzole Codex Worktree Yürütmesi | beta | native-e2e: src-tauri/src/execution.rs | 0/0 | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |
| Dosya Envanteri ve Güvenlik Filtresi | candidate-stable | integration-test: tests/v4/project-analyzer.test.js<br>native-e2e: src-tauri/src/lib.rs | 0/0 | 0 | Belgelenmedi | 2acd7ba | Bloklu |
| Gelişmiş Dışa Aktarım | candidate-stable | integration-test: tests/v4/migration-export.test.js | 10/10 (100%) | 0 | docs/release/rollback.md | 2acd7ba | Bloklu |

## Açık terfi engelleri

### Web/SaaS Planlama Paketi

- En az 5 kullanıcıdan kanıt gerekli.

### Canonical Yaşayan Plan ve Revizyon Yönetimi

- En az 5 kullanıcıdan kanıt gerekli.

### Görev Teslim Kanıtı

- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- En az 5 kullanıcıdan kanıt gerekli.

### Local-First Depolama ve Yedekleme

- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- En az 5 kullanıcıdan kanıt gerekli.

### Uzman Perspektifleri

- En az bir üretim entegrasyon testi gerekli.
- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- Kurtarma veya geri alma yolu belgelenmeli.
- En az 5 kullanıcıdan kanıt gerekli.

### Mimari Karşılaştırma Şablonu

- En az bir üretim entegrasyon testi gerekli.
- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- Kurtarma veya geri alma yolu belgelenmeli.
- En az 5 kullanıcıdan kanıt gerekli.

### AI Sağlayıcı Entegrasyonu

- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- Kurtarma veya geri alma yolu belgelenmeli.
- En az 5 kullanıcıdan kanıt gerekli.

### İzole Codex Worktree Yürütmesi

- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- En az 5 kullanıcıdan kanıt gerekli.

### Dosya Envanteri ve Güvenlik Filtresi

- En az 5 benchmark senaryosu gerekli.
- Benchmark başarı oranı en az %90 olmalı.
- Kurtarma veya geri alma yolu belgelenmeli.
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
