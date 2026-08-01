# Uzman Perspektifleri — Kurtarma ve Geri Alma

Bu belge `expert-perspectives` yeteneğinin terfi kapısındaki kurtarma koşulunu
karşılar. Genel sürüm geri alma akışı için [rollback.md](rollback.md) belgesine
bakın.

## Yeteneğin gerçekte ne olduğu

Bu bir **yerel kural motorudur**. Bağımsız LLM ajanları çalıştırmaz; proje
metnindeki alan sinyallerine göre dört uzman perspektifi kurar ve her biri için
sabit kural şablonlarından öneri üretir. Çıktı senkron ve deterministiktir —
aynı girdi her zaman aynı sonucu verir.

Bu beyan [expert-perspectives-benchmark.ts](../../scripts/expert-perspectives-benchmark.ts)
içindeki `no-llm-agents-run` senaryosuyla her `verify` çalışmasında ölçülür.
Çıktı asenkron hâle gelseydi senaryo kalırdı.

## Kapsanan başarısızlıklar

| # | Senaryo | Belirti |
|---|---|---|
| 1 | Yanlış komite kuruldu | Web projesine oyun uzmanları geldi |
| 2 | Perspektif önerisi gerçek analiz sanıldı | Kullanıcı şablon metni uzman görüşü zannetti |
| 3 | Oylama skoru karar dayanağı yapıldı | Yüzde değeri plan kalitesi gibi okundu |
| 4 | Özel uzman slotu görünmedi | Eklenen alan uzmanı komiteye girmedi |

## Neden geri alma çoğunlukla gerekmez

Perspektifler **öneri üretir, canonical planı değiştirmez**. Değerlendirme ve
oylama girdi belgesini mutate etmez; bu davranış
[expert-perspectives.test.ts](../../tests/v4/expert-perspectives.test.ts)
içinde doğrulanır. Bir perspektif önerisi plana ancak kullanıcı onayıyla ve
normal karar akışından geçerek girer.

## Kurtarma adımları

### Senaryo 1 — Yanlış komite kuruldu

Komite, fikir metnindeki anahtar sözcüklerden seçilir. Yanlış eşleşme varsa
fikri daha açık yazıp yeniden üretin (örneğin "web uygulaması", "mobil
uygulama"). Politika değişikliği gerekmez.

Tekrarlayan yanlış eşleşme varsa
[agent-committee.js](../../src/v4/agent-committee.js) içindeki alan sinyalleri
gözden geçirilmeli ve `domain-aware-committee` senaryosuna yeni bir örnek
eklenmelidir.

### Senaryo 2 — Öneri gerçek analiz sanıldı

Öneri metinleri sabit kural şablonlarındandır; projeye özel analiz değildir.
Kararınızı bu metinlere dayandırdıysanız:

- Kararı kendi gerekçenizle yeniden değerlendirin.
- Yetenek `experimental` etiketlidir ve bu etiket arayüzde görünmelidir.
  Görünmüyorsa bu bir **hatadır** ve ayrı bir E2E kontrolü gerekir.

### Senaryo 3 — Oylama skoru yanlış okundu

Skor bir plan kalite ölçütü **değildir**. Yalnız iki şeye bakar: kabul edilmiş
karar sayısı en az iki mi, ve güvenlik kararı açıkça var mı. Readiness skoru
için [Açıklanabilir Plan Kalite Kapısı](../product/CAPABILITY_EVIDENCE.md)
yeteneği kullanılmalıdır.

`%50` skoru "plan yarı hazır" demek değildir; "henüz yeterli karar yok" demektir.

### Senaryo 4 — Özel uzman slotu görünmedi

Bu bir hataydı ve düzeltildi. Slot yalnız bilinmeyen alanda çalışıyordu; oyun,
web, mobil ve AI dalları erken `return` ettiği için sessizce yok sayılıyordu.
Artık slot tek noktada uygulanır ve beş alanda da çalışır.

Slot yine görünmüyorsa `custom-slot-and-no-mutation` senaryosunu çalıştırın;
geçiyorsa sorun sunum katmanındadır.

## Doğrulama

```bash
npm run benchmark:expert-perspectives
```

Ek olarak farklı alanlardan iki fikirle komitenin gerçekten değiştiğini ve
`experimental` etiketinin arayüzde göründüğünü gözle doğrulayın.

## Bilinen sınır

Perspektifler bağımsız model çağrısı yapmaz ve öneri metinleri projeden
türetilmez. Gerçek LLM ajanları çalıştırmak yeteneğin kapsamını genişletir ve
[FEATURE_FREEZE.md](../product/FEATURE_FREEZE.md) istisna kapısından geçmelidir;
dondurma listesinde "yeni ajan rolleri" açıkça yer alır.
