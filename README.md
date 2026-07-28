# PromtGen V4 — Local-First AI Proje Planlayıcısı

PromtGen, AI kodlama araçlarıyla çalışan bireysel geliştiricilerin dağınık proje fikirlerini; onaylanmış MVP kapsamına, izlenebilir gereksinimlere ve uygulanabilir görev paketlerine dönüştüren local-first proje planlama aracıdır.

Ana ürün **Planner** akışıdır: fikri anlat → sistem yorumunu düzelt/onayla → MVP içi ve dışını seç → gereksinim ve görevleri doğrula → planı dışa aktar. Kod yürütme, mimari karşılaştırma ve uzman perspektifleri **Labs** altında isteğe bağlıdır.

Ürün sınırları ve kanıt sözleşmeleri için [ürün dokümanları](docs/product/PRODUCT_CONTRACT.md) ile [desteklenen proje matrisine](docs/product/SUPPORTED_PROJECTS.md) bakın.

---

## 🛡️ Ürün Dürüstlüğü & Yetenek Seviyeleri

PromtGen'deki her özellik dürüst ürün sözleşmesine ve olgunluk etiketine tabidir:

### 🟡 1. Doğrulanma Adayı Özellikler (Candidate Stable)

Bu yeteneklerin üretim entegrasyon testleri vardır; ancak bütün terfi kanıtları tamamlanmadığı için henüz **Stable** ilan edilmezler. Güncel engeller [Yetenek Kanıtları](docs/product/CAPABILITY_EVIDENCE.md), deterministic sonuçlar [Planner Benchmark Raporu](docs/product/BENCHMARK_REPORT.md), ham fikir ve belirsizlik akışı [Guided Discovery Benchmark Raporu](docs/product/DISCOVERY_BENCHMARK_REPORT.md), gerçek yöntem karşılaştırması ise [Karşılaştırmalı Sonuç Raporu](docs/product/COMPARISON_REPORT.md) üzerinden izlenir.
- **Canonical Yaşayan Plan ve Revizyon Yönetimi**: Proje durumunun JSON formatında saklanması, r1..rN sürüm takibi, etki analizi ve geri alma.
- **Local-First Depolama ve Yedekleme**: Web'de IndexedDB; masaüstünde WAL modlu SQLite, 20 otomatik yedekleme ve kurtarma.
- **Dosya Envanteri ve Güvenlik Filtresi**: Hassas dosyaların (`.env`, `node_modules`, binary içerikler) dışarıda bırakılması ve envantere alınması.
- **Gelişmiş Dışa Aktarım**: Markdown, PRD, görev listeleri, `.promtgen` taşıma paketi ve IDE şablonları (Cursor, Claude Code, Windsurf).

### 🟡 2. Beta Özellikler (Beta Capabilities)
- **AI Sağlayıcı Entegrasyonu**: Ollama, OpenAI, Gemini ve NVIDIA sağlayıcıları üzerinden plan önerileri üretimi. Çağrı başarısız olursa yerel kural motoru otomatik fallback üretir; öneri kartı üzerinde kaynak ve fallback etiketi kalıcı olarak gösterilir.
- **İzole Codex Worktree Yürütmesi**: Desktop ortamında Codex CLI ile izole Git worktree üzerinde görev çalıştırma.
- **Mimari Karşılaştırma Şablonu**: Karar matrisi (Geliştirme hızı, maliyet, operasyon yükü, vendor lock-in kullanıcı tarafından düzenlenebilir başlangıç varsayımıdır).

### 🧪 3. Deneysel Özellikler (Experimental Capabilities)
- **Uzman Perspektifleri (Deneysel Yerel Kural)**: Ayrı LLM ajanları çalıştırmaz; cihaz üzerindeki alan kurallarını kullanarak perspektif değerlendirme kartları üretir.
- **İngilizce Çıktı Desteği (Partial Beta)**: Temel AI istemleri İngilizce yanıt verebilir; yerel kurallar ve UI metinleri Türkçe ağırlıklıdır.

---

## ⚠️ Bilinen Sınırlamalar (Known Limitations)

- **Yerel Kural Motoru**: API gerektirmeyen yerel kural motoru üretken LLM çalıştırmaz; kural tabanlı şablonlar üretir.
- **Codex Executable Doğrulaması**: PromtGen seçilen Codex çalıştırılabilir dosyasının `--version` yanıtını doğrular; binary bütünlüğünü veya imzalayan yayıncı sertifikasını doğrulamaz.
- **Güvenlik Filtresi**: Envanter taraması hassas klasörleri filtreler; antivirüs, SAST veya tam sızma testi taraması sunmaz.
- **Maliyet Analizi**: Mimari karşılaştırmadaki maliyet ve operasyon puanları proje verilerinden otomatik hesaplanmaz, başlangıç varsayımı olarak sunulur.

---

## 🚀 Çalıştırma & Geliştirme

Gereksinimler: Node.js 20+, masaüstü geliştirme için Rust ve Tauri sistem bağımlılıkları.

```bash
npm install
npm run dev
```

Masaüstü geliştirme:
```bash
npm run desktop:dev
```

Windows installer üretimi:
```bash
npm run desktop:build
```

---

## 🧪 Kalite Kapısı & Otomatik Testler

```bash
npm run verify
```

Bu komut sırasıyla tüm birim/entegrasyon/güvenlik testlerini, TypeScript tip kontrolünü, lint kontrolünü, PWA production build'ini ve Tauri Rust testlerini çalıştırır. Browser E2E için ayrıca `npm run test:e2e` kullanılır.
