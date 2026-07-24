# PromtGen V4 — Yaşayan AI Proje Mimarı

PromtGen, kısa bir fikri kullanıcı onaylı kararlarla uygulanabilir ve sürümlenebilir bir canonical proje planına dönüştüren local-first planlama uygulamasıdır. Küçük projelerde gereksiz ayrıntıyı azaltır; kapsam büyüdükçe mimari, güvenlik, test, dağıtım ve operasyon belgelerini etkinleştirir.

## Bugünkü ürün yüzeyi

- React + TypeScript çalışma alanı ve kurulabilir PWA
- Aynı arayüzü kullanan Tauri masaüstü kabuğu
- `quick`, `standard`, `advanced`, `enterprise` planlama derinlikleri
- Her değişiklik için kabul, düzenleme, erteleme veya reddetme akışı
- Yaşayan plan, hazırlık skoru, revision geçmişi, karşılaştırma ve geri yükleme
- Offline motor, Ollama, OpenAI, Gemini ve NVIDIA sağlayıcıları
- Varsayılan kapalı, kullanıcı kontrollü yerel tercih hafızası; proje adlarını/fikirlerini değil toplulaştırılmış derinlik, karar türü, bölüm ve modül eğilimlerini kullanır
- Yazılım yanında araştırma/kanıt, içerik/yayın, iş/operasyon ve etkinlik projeleri için deklaratif alan paketleri, alan kalite kuralları ve özel export belgeleri
- Başlangıç ekranında tamamen yerel proje portföyü; arama, durum/derinlik filtreleri, hazırlık ortalaması ve dikkat göstergeleri
- Tek ekranda IndexedDB/SQLite, Git, Codex CLI, Ollama ve seçili AI sağlayıcısını denetleyen local-first Sistem Doktoru; bulut bağlantı testi yalnız açık kullanıcı eylemiyle çalışır
- Web’de IndexedDB; masaüstünde SQLite ve işletim sistemi anahtar kasası
- Masaüstünde WAL modlu SQLite bütünlük kontrolü, proje başına son 20 otomatik yedek, bozuk kayıt karantinası ve yeni revision olarak güvenli geri yükleme
- Revision’a bağlı Markdown, PRD, görev, teknik belge ve ajan prompt exportları
- Codex, Cursor, Claude Code, Windsurf, Copilot ve generic hedefler için IDE’nin otomatik keşfettiği talimat dosyalarını içeren revision/hash bağlı çalışma ZIP’i
- Masaüstünde token tabanlı repository seçimi, izole Git worktree ve Planner → Implementer → Reviewer → Verifier Codex execution zinciri
- Codex CLI PATH üzerinde bulunamazsa Sistem Doktoru üzerinden native dosya seçiciyle doğrulanmış `codex`/`codex.exe` seçimi ve güvenli PATH’e dönüş
- Derleme sırasında sahte bir Codex executable üreten; prompt, sandbox argümanları, geçici Git worktree ve patch üretimini gerçek process üzerinden doğrulayan native E2E testi
- SHA-256 özetli, ZIP tabanlı `.promtgen` taşıma paketi

AI önerileri hiçbir zaman doğrudan canonical plana yazılmaz. Kullanıcının kabul ettiği değişiklikler plan motoru tarafından uygulanır ve yeni revision oluşturur.

## Çalıştırma

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

Başarılı build, `src-tauri/target/release/bundle/msi` altında MSI ve `src-tauri/target/release/bundle/nsis` altında kurulum EXE’si üretir. Yerel geliştirme artefaktları varsayılan olarak kod imzasızdır; başka cihazlara dağıtım öncesinde bir Windows kod imzalama sertifikasıyla imzalanmalıdır.

## Kalite kapısı

```bash
npm run verify
```

Bu komut sırasıyla legacy + V4 testlerini, TypeScript kontrolünü, V4 ESLint kontrolünü, PWA production build’ini ve Rust masaüstü testlerini çalıştırır. Tekil komutlar: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run desktop:check`, `npm run desktop:test`.

## V4 mimarisi

```text
src/react/       React çalışma alanı ve sunum katmanı
src/v4/          canonical state, planlama, AI, export ve repository adaptörleri
src-tauri/       Windows-first masaüstü kabuğu, SQLite ve keyring komutları
tests/v4/        V4 birim ve entegrasyon testleri
src/ + tests/    geçiş boyunca korunan V2/V3 domain motoru ve regresyon paketi
```

Canonical model; hedef, gereksinim, karar, varsayım, risk, görev, test, kilometre taşı ve izlenebilirlik bağlantılarını ayrı tipli varlıklar olarak saklar. `sections` kullanıcıya sunulan yaşayan belge görünümüdür; exportlar belirli bir canonical revision’dan türetilir.

## Yerel veri ve güvenlik

- Hesap, bulut senkronizasyonu ve çok kullanıcılı çalışma ilk kapsamda yoktur.
- Offline veya Ollama kullanıldığında planlama bağlamı cihazda kalabilir.
- Bulut sağlayıcılarına tam proje yerine filtrelenmiş canonical bağlam gönderilir.
- Yerel tercih hafızası opt-in’dir; güncel proje hariç geçmiş kayıtlardan yalnız anonim/toplulaştırılmış sinyaller türetilir ve ham proje metni hafıza bağlamına girmez.
- Web API anahtarları oturum belleğinde, masaüstü anahtarları işletim sistemi kasasında tutulur.
- `.promtgen` içe aktarma; paket, girdi ve toplam açılmış boyut, girdi sayısı, yol geçişi, zararlı JSON anahtarları, şema ve canonical özet denetimleri uygular.
- Bulut sağlayıcı uç noktaları sabit allowlist’tedir; Ollama yalnız loopback adresine bağlanabilir. Web ve Tauri CSP’si yalnız gerekli yerel ve sağlayıcı bağlantılarını açar.
- Mevcut proje analizi gizli dosyaları, bağımlılık/build klasörlerini, symlink’leri, binary içerikleri ve prompt-injection sinyallerini dışarıda bırakır; yalnız güvenli envanter özeti planlama bağlamına girer.
- Native ajan yürütme keyfî path veya komut kabul etmez. Her worktree ve ajan adımı işletim sistemi onayı ister; yalnız Implementer `workspace-write`, diğer roller `read-only` sandbox kullanır.
- Native ajan yürütme için erişilebilir bir `codex` CLI kurulumu gerekir; uygulama PATH’i veya kullanıcının native seçiciden belirlediği dosyayı `codex --version` ile doğrular, doğrulanmış executable’ı execution session’a sabitler ve kullanılamıyorsa worktree başlatmayı kapatır.
- Masaüstü yedek geri yükleme native onay ister; güncel plan önce otomatik yedeklenir ve seçilen belge eski revision’ı ezmeden yeni revision olur. Karantina içeriği frontend’e açılmaz.

## Geçiş durumu

Production giriş noktası yalnız React/V4 çalışma alanını yükler. Eski `main.js`, state, presentation, AI ve exporter yolları production import graph’ından çıkarılmıştır; bu sınır otomatik testle korunur. V1–V3 domain/migration kodu veri uyumluluğu ve regresyon kanıtı için tutulur, kayıtlar yedekli migration ile V4’e taşınır ve eski exportlar geçmiş kaydı olarak korunur. Ayrıntılı kabul eşlemesi [docs/acceptance-audit.md](docs/acceptance-audit.md) dosyasındadır.
