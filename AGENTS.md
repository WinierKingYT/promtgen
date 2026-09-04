# PromtGen — Ajan Yönergesi

<!-- ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
     Kaynaklar: src/v4/product/product-contract.ts · src/v4/application/project-stages.ts · src/v4/source-boundaries.ts
     Üret: npm run product:docs · Denetle: npm run check:product-docs (AGENTS.md kapı kapsamındadır) -->

## PromtGen nedir

> PromtGen, AI kodlama araçlarıyla çalışan bireysel geliştiricilerin dağınık proje fikirlerini; onaylanmış bir fikir tasarımına, gerekçeli teknik kararlara ve izlenebilir gereksinim-görev-test paketlerine dönüştüren local-first proje tasarım aracıdır.

Vaat: Fikrini anlat; birlikte netleştirelim ve onayla. Sonra nasıl kuracağımızı tasarlayıp onayla. Planını kodlama aracına dışa aktar.

## PromtGen ne DEĞİLDİR

- PromtGen bir prompt üreteci değildir; çıktısı istem metni değil, onaylanmış proje tasarımıdır.
- PromtGen bir prompt pazarı veya hazır istem kütüphanesi değildir.
- PromtGen bir MVP anketi değildir; kullanıcıya sabit bir kapsam formu doldurtmaz.
- PromtGen otonom bir kodlama ajanı değildir; kodu kendisi yazıp yürütmez.
- PromtGen bir Fikir → MVP → Görevler hattı değildir; o model V3 ile birlikte bırakıldı.

## Canonical yaşam döngüsü

Fikir Tasarımı (`idea`) → Çözüm Tasarımı (`solution`) → Uygulama Planı (`plan`) → Agent Devri (`handoff`)

MVP kavramı yasak değildir: bir projenin kendi kapsamını “MVP” diye adlandırması meşrudur. Yasak olan, MVP’nin PromtGen’in evrensel yaşam döngüsü aşaması olmasıdır.

## Üretim ve uyumluluk

- Üretim gerçeği: `src/v4` · `src/react`
- Uyumluluk: `src/` altındaki diğer her dizin.
- İzin verilen yön tek taraflıdır: uyumluluk katmanından üretime göç edilir, üretim uyumluluğa bağımlı olamaz. Uyumluluk koduna yeni ürün davranışı eklenmez.

## Nereye bakılır

- `docs/LEGACY_MODEL_INVENTORY.md` — eski zihinsel model envanteri ve sınıflandırmalar.
- `docs/TESHIS_HARITASI.md` — ürünün ölçülmüş alan haritası.
- `docs/product/` — ürün sözleşmesinden üretilen belgeler.

Bu dosya onları tekrar etmez. Ürün modeline dair bir iddia yazmadan önce oradan okunur.

## Sınırı tutan kapılar

- `npm run check:legacy-boundary` — üretim/uyumluluk sınırı düzyazı değil, kapıdır.
- `npm run check:product-docs` — üretilen belgelerin kaynağıyla eşleşmesi; bu dosya da kapsamdadır.
