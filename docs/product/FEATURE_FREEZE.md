# PromtGen Geçici Özellik Dondurma Kararı

Durum: Etkin
Başlangıç: 2026-07-29
Kapsam: Alpha öncesi mimari birleştirme ve kanıt dönemi

## Amaç

PromtGen’in çekirdek ürünü; kısa bir fikri kullanıcı onaylı MVP kapsamına, izlenebilir gereksinimlere ve dış kodlama araçlarında uygulanabilir görev sözleşmelerine dönüştüren local-first Planner’dır.

Bu dönemde başarı yeni özellik sayısıyla değil, mevcut üretim akışının tek sahipli, testli, geri alınabilir ve anlaşılır olmasıyla ölçülür.

## Dondurulan geliştirmeler

- Yeni AI sağlayıcıları ve yeni ajan rolleri.
- Yeni domain paketleri; Web/SaaS ve Backend/API yalnız mevcut kalite kapıları kapsamında bakım alır.
- Yeni export formatları.
- Yeni ana navigasyon, dashboard veya Workspace paneli.
- Otomatik kod yürütmenin ana ürüne taşınması.
- Marketplace, cloud sync ve çok kullanıcılı işbirliği.
- Mobile, AI/RAG, oyun, 3D veya multiplayer alan genişlemesi.

## İzin verilen çalışmalar

- Veri kaybı, güvenlik veya yanlış canonical değişiklik üreten hata düzeltmeleri.
- Mevcut davranışları tek üretim sahibine taşıyan mimari birleştirme.
- Migration, recovery, typed command, typed IPC ve invariant güçlendirmesi.
- Golden Path’i sadeleştiren UX düzeltmeleri; yeni ana özellik oluşturmamak koşuluyla.
- Test keşfi, CI kanıtı, benchmark dürüstlüğü ve gerçek kullanıcı araştırması.
- Web/SaaS ve Backend/API paketlerinin var olan sınırları içinde doğrulama ve hata düzeltmesi.

## İstisna kapısı

Dondurma dışı bir iş ancak aşağıdakilerin tümü yazılıysa değerlendirilebilir:

1. Çözdüğü kullanıcı problemi ve neden mevcut akışla çözülemediği.
2. Canonical plan, migration, güvenlik ve geri alma etkisi.
3. Unit/integration ve gerekiyorsa E2E kabul testleri.
4. Yeni kullanıcı kanıtı üretme amacı.
5. Planner odağını genişletmediğine dair ürün sözleşmesi kontrolü.

Bu koşullar karşılanmadığında iş backlog’a alınır; üretime eklenmez.
