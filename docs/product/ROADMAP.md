# PromtGen Ürün Yol Haritası

PromtGen'in ana ürünü Planner'dır: bireysel geliştiricinin kısa fikrini, açık kullanıcı onayıyla izlenebilir bir MVP planına ve dış kodlama araçlarına verilebilen doğrulanabilir görev sözleşmelerine dönüştürür. PromtGen varsayılan olarak kod yazmaz; gerektiğinde yalnız planlama, örnekleme veya doğrulama bağlamında sınırlı kod parçaları üretebilir.

## Güncel çalışma modu — mimari birleştirme

Geçici özellik dondurma kararı etkindir. Yeni sağlayıcı, ajan rolü, domain pack, export formatı veya ana Workspace paneli eklenmez. Öncelik; [özellik dondurma sözleşmesinde](FEATURE_FREEZE.md) ve [modül statü envanterinde](../architecture/MODULE_STATUS.md) tanımlanan tek sahiplik, recursive test keşfi, migration, CI kanıtı ve Golden Path güvenilirliğidir.

Tamamlanan mimari birleştirmeler:

- V4 testleri alt klasörleri recursive keşfeder.
- Canonical traceability motoru `src/v4/traceability` altında tek üretim implementasyonuna taşındı; `src/core/traceability` yalnız compatibility re-export sınırıdır.
- Discovery, Idea Lab ve bölüm yenileme çağrıları ortak `src/v4/ai/runtime.ts` üzerinden task registry’ye bağlandı; `ai-context.js` export-only compatibility sınırına indirildi.
- Readiness, reviewer, görev derleyici, modül önizlemesi ve UI ortak `DomainPackRegistry` kullanır.

## Yol haritası ilkeleri

- Yeni özellik sayısı değil, ana planlama akışındaki doğrulanmış kullanıcı sonucu önceliklidir.
- AI ve yerel kurallar canonical planı kullanıcı onayı olmadan değiştiremez.
- Planner ana akıştır; yürütme, depo analizi ve uzman görünümleri Labs altında kalır.
- Local-first veri sahipliği ve geri alınabilir revizyonlar korunur: plan cihazda saklanır, hesap gerekmez. Plan üretimi için doğrulanmış bir AI sağlayıcısı gerekir; Ollama seçildiğinde bağlam da cihazdan çıkmaz, bulut sağlayıcılarında çıkar.
- Bir aşama kalite kapıları geçmeden sonraki aşamanın kapsamı genişletilmez.

## Faz 1 — Görev Teslim Merkezi V2

Durum: Uygulamada.

Amaç: Codex, Cursor, Claude Code veya geliştiriciden dönen uygulama kanıtını görev sözleşmesiyle karşılaştırmak; canonical görevi yalnız açık onayla tamamlamak.

Teslimatlar:

- Sürümlü ve sıkı doğrulanan `promtgen-implementation-evidence` JSON formatı.
- Proje, görev ve canonical revision bağlamı doğrulaması.
- Secret, bilinmeyen alan ve yabancı proje paketlerinin reddi.
- Agent exportlarında görev bazlı kanıt şablonları ve doldurma talimatları.
- Görev teslim durum panosu, dosyadan içe aktarma ve değişiklik önizlemesi.
- Deterministik kapsam, test ve kabul kriteri benchmarkı.

Çıkış kapısı:

- Geçersiz paket canonical veriyi değiştirmemeli.
- Eski revision'a ait paket engellenmeli.
- Tamamlama açık kullanıcı onayı gerektirmeli.
- Unit, production integration, browser E2E ve build kontrolleri yeşil olmalı.

## Faz 2 — Readiness 3.0 ve plan kalite kapısı

Durum: Uygulamada.

Amaç: Hazırlık skorunu doldurulan alan sayısından çıkarıp planın uygulanabilirliğini ölçen açıklanabilir bir kalite kapısına dönüştürmek.

Teslimatlar:

- Tamlık, tutarlılık, izlenebilirlik, risk kapsamı ve uygulanabilirlik için ayrı kanıtlar.
- Must gereksinim → görev → doğrulama zincirinin zorunlu kontrolü.
- Kapsam dışı özelliklerin görevlerde görünmesini engelleyen çelişki kontrolü.
- Döngüsel görev bağımlılığı, sahipsiz kritik risk ve açık kritik soru blokajları.
- Skorun neden yükseldiğini veya düştüğünü açıklayan kullanıcı görünümü.

Çıkış kapısı:

- Yüksek skor anlamsız kayıt çoğaltılarak elde edilememeli.
- Bloklayıcılar çözülmeden `READY` önerilmemeli.
- Aynı canonical revision aynı readiness sonucu ve kanıt hash'ini üretmeli.

## Faz 3 — Plan–kod hizalama V2

Durum: Uygulamada.

Amaç: Mevcut bir depoda canonical plan ile gerçekleşen kod değişiklikleri arasındaki sapmayı açıklamak; kodu otomatik değiştirmeden kullanıcıya karar desteği vermek.

Teslimatlar:

- Güvenli dosya envanteri ve sınırlı değişiklik özeti.
- Görev sözleşmesindeki izin verilen yollar ile değişen yolların karşılaştırılması.
- Uygulandı, kısmi, şüpheli ve kapsam dışı değişiklik durumları.
- Sapmadan doğan öneri paketi; doğrudan canonical mutasyon yok.
- Plan değişikliği, kod geri alma veya bilinçli sapmayı kabul etme seçenekleri.

Çıkış kapısı:

- Gizli ve binary içerik modele veya rapora ham taşınmamalı.
- Dosya sistemi erişimi açık kullanıcı seçimine dayanmalı.
- Sapma sonucu kanıt olmadan görev tamamlanmış sayılmamalı.

## Faz 4 — Web/SaaS ve Backend/API alan paketleri

Durum: Uygulamada — Web/SaaS kararlı adayı, Backend/API beta.

Amaç: “Her projeyi planlar” iddiası yerine desteklenen alanlarda tekrarlanabilir derinlik sağlamak.

Teslimatlar:

- Alan soru setleri, risk kuralları, gereksinim kalıpları ve reviewer kontrolleri.
- Web/SaaS paketinin kararlılaştırılması.
- Backend/API paketinin beta olarak eklenmesi.
- Readiness, reviewer, görev derleyici, modül önizlemesi ve UI'ın ortak `DomainPackRegistry` sözleşmesinden beslenmesi.
- Her paket için desteklenmeyen sınırlar ve benchmark senaryoları.
- Paketlerin çekirdek domain modelini çatallamadan katkı sunması.

Çıkış kapısı:

- Paket önerileri kullanıcı onayı olmadan karara dönüşmemeli.
- Paket başına golden scenario ve sözleşme testleri bulunmalı.
- Destek matrisi gerçek evidence kaydıyla uyumlu olmalı.

## Faz 5 — Yerel araştırma ve sonuç kanıtı

Amaç: Telemetri zorunluluğu olmadan PromtGen'in sıradan sohbet ve uzun master prompt yaklaşımına göre sağladığı sonucu ölçmek.

Teslimatlar:

- Anonim, kullanıcı tarafından dışa aktarılan çalışma oturumu paketi.
- Güvenli `study:import` doğrulaması, yinelenen oturum engeli ve toplu rapor.
- Baseline chat, master prompt ve PromtGen için kör karşılaştırma seti.
- İlk export süresi, düzenleme sayısı, MVP kabulü, kapsam sapması ve yeniden çalışma ölçümleri.

Çıkış kapısı:

- En az 10 gönüllü kullanıcı oturumu.
- Yöntem başına en az 5 karşılaştırılabilir senaryo.
- Sonuçlar başarısız örnekleri de içeren tekrar üretilebilir bir raporda yayımlanmalı.

## Faz 6 — Profesyonel dayanıklılık ve yayın

Amaç: Local-first proje verisini güvenilir biçimde korumak ve masaüstü/web dağıtımını denetlenebilir hâle getirmek.

Teslimatlar:

- Kalıcı checkpoint, karantina ve command log sözleşmesi.
- Migration, import/export round-trip ve çökme sonrası kurtarma testleri.
- Büyük proje ve uzun revision geçmişi benchmarkları.
- Windows artifact hash/signing raporu, SBOM, provenance ve rollback smoke akışı.

Çıkış kapısı:

- Veri kaybı senaryolarında doğrulanmış kurtarma.
- Required CI kontrolleri ve commit seviyesinde görünür kanıt.
- İmzalanmamış veya eksik kanıtlı yapıların production-ready olarak sunulmaması.

## Bilinçli olarak ertelenenler

- PromtGen'in genel amaçlı kod yazma aracına dönüşmesi.
- Planner doğrulanmadan otomatik kod yürütme ve merge kapsamının büyütülmesi.
- 3D/multiplayer oyun ve kritik sağlık/finans planlama iddiaları.
- Yeni AI sağlayıcıları, yeni ajan rolleri veya her IDE için ayrı export formatları.
- Bulut senkronizasyonu ve çok kullanıcılı işbirliği.
