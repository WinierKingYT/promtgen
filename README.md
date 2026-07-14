# PromtGen V2 — Evrensel AI Proje Planlama Motoru

PromtGen, yazılım fikirlerini (Web, Mobil, Oyun, Backend, CLI veya AI) geliştirmeye başlamadan önce analiz eden, eksik noktaları gideren ve yapay zeka geliştirme ajanlarına (Cursor, Windsurf, Copilot, Antigravity vb.) adım adım kodlatabileceğiniz optimize **prompt dizilimleri** hazırlayan modüler, güvenli ve local-first bir proje planlama motorudur.

---

## 🚀 Özellikler

- **Kategori Bağımsız Profiling**: Oyun, mobil, web, backend, CLI veya AI projelerini otomatik olarak tanır ve karışık projeleri de destekler
- **Canonical Project State**: RFC 6902 benzeri JSON Patch sistemiyle revizyon takipli tek bir güvenilir proje veri kaynağı
- **Deterministik Workflow Motoru**: `IDEA_CAPTURED → PROFILE_DRAFTED → DISCOVERY → MVP → REQUIREMENTS → TECH → ARCHITECTURE → TASKS → AGENT_PACKAGE → REVIEW → READY → EXPORTED` — her geçiş koşul kontrolüyle onaylanır
- **Güvenlik Katmanı**: XSS sanitizer, dosya boyutu/tür politikası, secret tarayıcı, prototype pollution koruması ve prompt injection izolasyonu
- **Gemini API & Çevrimdışı Mod**: API anahtarınız olmasa bile yerleşik akıllı şablon motoruyla çalışmaya devam eder
- **ZIP Export**: Tüm proje belgelerini, promptları, editör kurallarını ve ajan paketlerini zip olarak indirir

---

## 📁 Proje Yapısı

```
.
├── apps/
│   └── web-prototype/          ← V1 Legacy (dondurulmuş, çalışır durumdadır)
├── src/
│   ├── ai/                     ← LLM provider katmanı (Gemini)
│   ├── exporters/              ← ZIP export motoru
│   ├── planning/               ← Kategori bağımsız profiler
│   ├── presentation/           ← DOM render modülleri
│   ├── security/               ← XSS, dosya politikası, secret tarayıcı
│   ├── state/                  ← Canonical Project State + App State
│   ├── storage/                ← localStorage repository
│   ├── workflow/               ← Workflow stages + transition rules
│   └── main.js                 ← Ana orkestratör
├── index.html                  ← V2 Ana arayüz
├── style.css                   ← V2 Stil dosyası
├── test.js                     ← 42 birim testi
└── package.json
```

---

## ⚙️ Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+

### Geliştirme Sunucusu
```bash
npm install
npm run dev
```
Tarayıcınızda `http://localhost:5173` adresine gidin.

### Testleri Çalıştırma
```bash
npm test
```

### Production Build
```bash
npm run build
```

---

## 🔑 API Anahtarı

1. Sağ üstteki **API Ayarları** simgesine tıklayın
2. [Google AI Studio](https://aistudio.google.com/app/apikey) üzerinden aldığınız Gemini API anahtarınızı yapıştırın
3. Anahtar tarayıcınızda yerel olarak saklanır, hiçbir sunucuya gönderilmez

> **Not:** API anahtarı olmadan da çevrimdışı şablon modu ile çalışabilirsiniz.

---

## 🧪 Test Kapsamı

`npm test` komutuyla çalışan 42 birim testi:

- **XSS Sanitizer**: `escapeHTML` fonksiyonu, attribute injection dahil tüm vektörler
- **File Policy**: Uzantı ve boyut denetimleri
- **Secret Detector**: API key, private key ve AIzaSy prefix tespiti
- **Canonical State & JSON Patch**: `add`, `replace`, `remove` patch operasyonları ve revision sayacı
- **Prototype Pollution**: `__proto__`, `constructor`, `prototype` yollarına karşı koruma
- **Strict Schema Validation**: Tip, aralık, benzersizlik denetimleri
- **Workflow Transitions**: Fail-closed geçişler, tam pipeline zinciri
- **Project Profiler**: Kategori tespiti, `unknown` fallback, `buildProfilePromptBlock`

---

## 📋 Nasıl Kullanılır?

1. **Fikrinizi Yazın**: Yapmak istediğiniz proje ya da ürünü doğal dilde tanımlayın
2. **Odakları Seçin**: UI, Güvenlik, Performans veya Ölçeklenebilirlik önceliklerini işaretleyin
3. **Planlama Derinliğini Seçin**: Quick, Standard, Advanced veya Enterprise
4. **Sohbet Edin**: Proje Mimarı ile projenizi şekillendirin ve her adımda canonical state güncellensin
5. **Promptları Kopyalayın**: Adım adım prompt zincirini sırayla kodlama ajanınıza verin
6. **ZIP Olarak İndirin**: Tüm belgeleri, editör kurallarını ve ajan paketlerini tek dosyada alın

---

## 🛡️ Güvenlik Politikaları

| Kural | Detay |
|---|---|
| Dosya boyutu | Maks 1 MB |
| İzin verilen uzantılar | `.js .ts .jsx .tsx .py .md .json .yaml .toml .txt .html .css .vue .go .rs` |
| Secret tespit | API key, private key ve AIzaSy pattern'leri → **yükleme engellendi** |
| XSS | Tüm dinamik içerik `escapeHTML` ile sanitize edilir |
| Attribute breakout | `dataset` API ile programatik atama |
| Prompt injection | Dosya içeriği `<UNTRUSTED_FILE_CONTENT>` bloğuna sarılır |
| Prototype pollution | `applyStatePatch` içinde `__proto__`, `constructor`, `prototype` yolları engellenir |

---

## 🗺️ Yol Haritası

- [ ] Tauri masaüstü uygulaması (SQLite local-first)
- [ ] ESLint + CI quality gate entegrasyonu
- [ ] DOM testleri (jsdom)
- [ ] LLM streaming desteği
- [ ] Çoklu LLM provider (OpenAI, Anthropic)
