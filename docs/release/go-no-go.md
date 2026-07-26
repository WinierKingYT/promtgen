# Go / No-Go

PromtGen ancak aşağıdaki kanıtların aynı commit için başarılı olması halinde yayınlanabilir:

- `test:all`, typecheck, lint ve production build
- Browser E2E; kısa fikir, reload, provider fallback görünürlüğü ve export smoke akışı
- Rust/Tauri testleri ve Windows desktop build
- V4→V5 migration, storage recovery ve adversarial context testleri
- Performance budget ve package/Cargo/Tauri version eşitliği
- PWA ve masaüstü artefact SHA-256 değerleri, SBOM ve build provenance

`npm run release:readiness` eksik kanıtta `NO-GO` döndürür. İmzasız Windows paketi test için üretilebilir ancak production kanalına taşınamaz.

Required checks: TypeScript Typecheck, ESLint, Unit & Integration Tests, Security Tests, Build, Tauri Tests, Tauri Check (Windows), Playwright E2E, Verify Command Parity.
