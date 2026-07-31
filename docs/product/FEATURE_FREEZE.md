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

## Kayıtlı istisna 1 — AI sağlayıcı zorunluluğu

Tarih: 2026-07-31 · Durum: Uygulandı

**1. Çözdüğü problem.** Ürün, sağlayıcı yapılandırılmadan açılıyordu ve varsayılan
`offline` moddaydı. Yerel kural motorunun ürettiği mimari alternatifler fikre özel
değil; tarayıcıda doğrulandı: iki tamamen farklı fikir (toplantı notu uygulaması ve
serbest çalışan fatura takibi) için tradeoff metrikleri ve risk metinleri birebir
aynı çıktı. Kullanıcı ürünü "çalışmıyor" olarak deneyimliyordu. Mevcut akışla
çözülemezdi çünkü hiçbir yerde sağlayıcı bağlaması istenmiyordu.

**2. Canonical, migration, güvenlik ve geri alma etkisi.** Canonical şema
değişmedi; kapı yalnız proje oluşturma öncesinde çalışır. Migration gerekmez.
Kimlik bilgisi mevcut credential vault'ta kalır, plan belgesine yazılmaz. Geri
alma: `provider-readiness-service` devre dışı bırakılırsa akış eski davranışa
döner, veri kaybı olmaz.

**3. Testler.** `tests/v4/provider-readiness.test.ts` (7 senaryo, ağsız, probe
enjekte edilir) ve `tests/e2e/smoke.spec.ts` içinde kapının açık/kapalı iki E2E
testi. Toplam JS testleri 218 → 225, E2E 22 → 24.

**4. Yeni kullanıcı kanıtı üretme amacı.** Bu maddenin gerekçesi budur.
13 yeteneğin tamamı "en az 5 gerçek kullanıcı kanıtı" engelinde bloklu. Ürün
sahibi dahil hiç kimse AI'sız açılan üründen anlamlı bir oturum üretemiyordu.
Kapı, toplanacak her oturumun gerçek deneyimi yansıtmasını sağlar.

**5. Planner odağı kontrolü.** Yeni ana özellik, panel veya navigasyon
eklenmedi. Mevcut başlangıç ekranına bir önkoşul denetimi eklendi; Planner'ın
kapsamı genişlemedi.

**Sözleşme etkisi:** README'de "AI sağlayıcısı zorunludur" sınırı ve kurulum
tablosu eklendi. Yerel kural motoru bağımsız çalışma modu değil, yedek yol
olarak yeniden tanımlandı.
