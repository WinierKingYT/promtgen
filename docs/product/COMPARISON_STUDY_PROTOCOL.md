# Karşılaştırmalı Çalışma Protokolü

**Çalışma:** `promtgen-comparison-v1`
**Durum:** DONDURULDU · yürütülmeyi bekliyor · veri seti boş
**Veri klasörü:** `benchmarks/comparison/`

Bu belge, `benchmarks/comparison/README.md`'deki yedi adımın nasıl yürütüleceğini
tanımlar. Motor, şemalar ve yayın kapısı hazır ve testli
(`tests/v4/comparison-benchmark.test.ts`); eksik olan tek şey veri.

## Cevaplanan soru

> Bir geliştirici neden bunun yerine ChatGPT/Claude'a fikrini anlatıp iyi bir
> master prompt kullanmasın?

Bu soru bugün cevaplanamıyor: `latest-report.json` üç yöntemin üçünde de sıfır
gönderim, sıfır katılımcı gösteriyor. Çalışmanın amacı bu boşluğu kapatmak,
PromtGen'i haklı çıkarmak değil. **Sonucun PromtGen aleyhine çıkması geçerli ve
yayınlanabilir bir sonuçtur.**

## Senaryo seti

Üç yöntem de **aynı** fikirlerle çalıştırılır (README kural 1). Beş senaryo,
`study.json`'daki `minimumScenariosPerMethod: 5` eşiğini karşılar.

| `scenarioId` | Fikir (katılımcıya birebir bu cümle verilir) | Alan |
| --- | --- | --- |
| `s1-fatura` | "Serbest çalışanların fatura takibini kolaylaştıran bir şey yapmak istiyorum, ödeme hatırlatmaları da olsun belki." | `small-saas` |
| `s2-toplanti` | "Küçük ekiplerin toplantı notlarından karar ve aksiyon çıkarmasını istiyorum ama çok karmaşık olmasın." | `web-app` |
| `s3-envanter` | "Depodaki ürünleri takip eden iç bir araç lazım, kim ne almış görebilelim." | `internal-tool` |
| `s4-basvuru` | "İş başvurularını topladığımız bir panel istiyorum, elemeyi kolaylaştırsın." | `admin-panel` |
| `s5-entegrasyon` | "Mevcut sistemimizin verisini başka servislere açacak bir arayüz yapmak istiyorum." | `backend-api` |

**Senaryolar bilerek dağınık.** Hedef kullanıcı, gereksinim, kabul kriteri,
kapsam içi/dışı — hiçbiri verilmez. Sebep şu: mevcut planner benchmark'ı bunları
girdide *hazır* aldığı için 10/10 çıkıyor ve ürünün asıl işini ölçmüyor. Ürünün
işi bu belirsizliği açmak; ölçüm de onu ölçmeli.

**Alanlar bilerek `candidate-stable`.** `product-contract.ts` oyun, 3D, çok
oyunculu, kritik sağlık ve kritik finans alanlarını `experimental` veya
`unsupported` sayıyor. Ürünün desteklemediğini yazdığı bir alanda ölçüm yapmak
ürüne haksızlık olur ve sonucu yorumlanamaz kılar.

## Üç kol

Her senaryo üç yöntemle de çözülür. Katılımcı başına **tek kol** — aynı kişi
aynı senaryoyu ikinci bir yöntemle çözmez, öğrenme etkisi sonucu bozar.

### A — `baseline-chat`
Katılımcı normal bir AI sohbetine girer ve fikri kendi cümleleriyle anlatıp
"bunun MVP planını çıkar" der. Yönlendirme yok, hazır prompt yok.

### B — `master-prompt`
Aynı modele, önceden hazırlanmış yapılandırılmış bir planlama prompt'u verilir.
Prompt tüm katılımcılar için aynıdır ve çalışma öncesi sabitlenir; seans sırasında
değiştirilmez.

### C — `promtgen`
Katılımcı mevcut Golden Path'i kullanır: Fikir → Ortak Anlayış → Plan → dışa
aktarım. Sağlayıcı seans öncesi bağlanmış olmalıdır (kapı bunu zaten zorunlu
kılıyor).

### Sıra dengeleme
Kollar arası hız farkı ölçüldüğü için katılımcılar kollara sırayla değil,
senaryo × kol matrisini dolduracak şekilde dağıtılır. Beş senaryo × üç kol = 15
gönderim; `minimumScenariosPerMethod: 5` bunun karşılığıdır.

## Kaydedilen veri

Uydurma alan eklenmez — şemalar sabit ve `evaluateBlindSubmission` fazladan
alanları reddeder.

### Gönderim başına — `submissions.json`

`BlindComparisonSubmission`. **Yöntem adı içermez**; yöntem yalnız
`blind-map.json`'da tutulur ve değerlendirme bitene kadar açılmaz.

| Alan | Nasıl doldurulur |
| --- | --- |
| `blindId` | Yöntemi ele vermeyen kimlik (`b-01`, `b-02`, …) |
| `scenarioId` | Yukarıdaki tablodan |
| `inScope` / `outOfScope` | Çıktının kapsam içi/dışı dediği maddeler |
| `requirements` | Çıktıdaki gereksinimler |
| `tasks` / `tests` | Çıktıdaki görevler ve doğrulamalar |
| `decisionStatements` | Çıktının açıkça karara bağladığı ifadeler |
| `planningDurationSeconds` | Fikrin verilmesinden ilk kullanılabilir plana kadar — **kurulum hariç**, bkz. "Kurulum sürtünmesi ayrı ölçülür" |
| `manualEditCount` | Katılımcının geri dönüp düzelttiği sayı |
| `agentFirstPassCompleted` | Planı başka bir kodlama ajanı ek soru sormadan uygulayabildi mi |

### Kör değerlendirme — `human-evaluations.json`

`HumanEvaluation.scores` altı ölçütün **tamamını** 1–5 arası taşır. Ölçütler
`study.json`'da dondurulmuştur; eksik ölçütlü kayıt reddedilir.

| Ölçüt | Değerlendirici neye bakar |
| --- | --- |
| `scopeClarity` | Kapsam içi/dışı ayrımı net mi, "olmayan" listesi gerçekten sınır çiziyor mu |
| `requirementQuality` | Gereksinimler tek ve gözlemlenebilir mi, yoksa dilek listesi mi |
| `applicability` | Bu planla yarın işe başlanabilir mi |
| `taskTestLinkage` | Her gereksinim bir göreve, her `must` bir doğrulamaya bağlı mı |
| `acceptanceCriteria` | Kriterler gözlemlenebilir mi ("X yapınca Y görünür"), yoksa "iyi çalışır" mı |
| `agentReadiness` | Bir kodlama ajanı **ek soru sormadan** başlayabilir mi |

Değerlendirici katılımcıdan **farklı** bir kişidir ve hangi çıktının hangi
yöntemden geldiğini bilmez. Her `blindId` en az iki değerlendirici görür.

### Oturum başına — `user-sessions.json`

`AnonymousUserSession`. Yalnız C kolu için doldurulur; A ve B'de PromtGen
kullanılmıyor.

`completed`, `firstExportReached`, `mvpAcceptedWithMinorEdits`,
`manualEditCount`, `setupDurationSeconds`, `planningDurationSeconds`,
`endToEndDurationSeconds`, `satisfaction` (1–5), `wouldUsePlan`,
`consent: true`.

## Kurulum sürtünmesi ayrı ölçülür

Üç kol eşit başlamıyor ve bunu saklamak ölçümü bozar:

| Kol | Başlamadan önce gereken |
| --- | --- |
| `baseline-chat` | Yok — sohbet penceresi açık |
| `master-prompt` | Yok — prompt hazır verilir |
| `promtgen` | Depoyu çalıştır + bir AI sağlayıcısı bağla |

PromtGen'in sağlayıcı kapısı bilinçli bir üründür (FEATURE_FREEZE "Kayıtlı
istisna 1"): sağlayıcısız yerel motor iki farklı fikre birebir aynı çıktıyı
veriyordu. Kapıyı çalışma için gevşetmek ölçümü **daha çok** bozardı — o zaman
ürünü değil, terk edilmiş deterministik motoru ölçerdiniz.

Doğru olan kapıyı kaldırmak değil, kurulumu planlamadan ayrı tutmak:

- **`planningDurationSeconds` ve `durationSeconds` yalnız planlamayı kapsar** —
  sayaç, katılımcıya fikir cümlesi verildiği anda başlar. Kurulum bu sayıya
  dahil edilmez.
- **Kurulum süresi yapılandırılmış veriye yazılır.** Şema üç alan taşır ve
  üçü de zorunludur:

```
setupDurationSeconds      kurulum (kol B ve A için 0)
planningDurationSeconds   fikir verildiği andan ilk kullanılabilir plana
endToEndDurationSeconds   ilk temastan bitmiş plana, toplam duvar saati
```

Doğrulama `endToEndDurationSeconds`'ın diğer ikisinden kısa olamayacağını
zorlar; parçaların toplamına **eşit olması şart değil** çünkü aralarda mola
olabilir.

Karşılaştırma sunulurken iki sayı birlikte verilir. "PromtGen daha iyi plan
üretiyor ama başlamak 20 dakika alıyor" geçerli ve yayınlanabilir bir
sonuçtur; tek sayıya indirgemek onu gizlerdi.

## Kullanım niyeti

`wouldUsePlan` alanı **"Bu planı gerçekten kullanır mıydın?"** sorusunun
cevabıdır ve her PromtGen oturumunda kaydedilir. Rapor bunu
`wouldUsePlanRate` olarak sunar.

Bu, memnuniyetten farklı bir şey ölçer: kullanıcı bir plandan memnun olup yine
de kullanmayabilir. İkisi birlikte okunmalıdır.

**Ölçülmeyen tek şey tekrar kullanım.** "Kullanıcı PromtGen'e ikinci kez gelir
mi?" sorusu tek seanslık bir çalışmayla ölçülemez; ayrı ve sonraki bir takip
gerektirir. Bu bilinçli bir sınırdır.

## Bir oturumu geçersiz kılan şeyler

- Kolaylaştırıcının katılımcıya fikri netleştiren soru sorması. Soruyu **araç**
  sormalı; kolaylaştırıcı sorarsa ölçülen şey araç değil kolaylaştırıcı olur.
- Master prompt'un seans sırasında değiştirilmesi.
- Aynı katılımcının aynı senaryoyu ikinci bir kolda çözmesi.
- Rıza alınmamış olması (`consent` yalnız `true` olabilir).
- C kolunda sağlayıcının bağlı olmaması.

## Gizlilik

`benchmarks/comparison/README.md`'nin kuralı bağlayıcıdır: gerçek kullanıcı adı,
e-posta, serbest metin ve proje içeriği bu klasöre yazılmaz.

Bu yalnız bir kural değil, kodda zorlanıyor: `validateAnonymousUserSessions`
(`src/v4/benchmarks/comparison-benchmark.ts:210`) izin verilen alan listesi
dışında bir anahtar görürse *"Kullanıcı evidence kaydı izin verilmeyen alan
içeriyor"* diye atar. Davranış testli
(`tests/v4/comparison-benchmark.test.ts` — "rejects PII-shaped extra fields",
`email` alanı eklenmiş bir kayıtla doğrulanıyor).

## Çalışma dondurulmuştur

Senaryolar, üç kol, ölçütler, eşikler ve master prompt **veri toplanmadan önce**
sabitlendi. Amaç tek: sonuç kötü çıkınca ölçüt değiştirme ihtimalini ortadan
kaldırmak.

Bu bir söz değil, kontrol: `study.json` kendi özetini (`frozenDigest`) taşır ve
`master-prompt.md`'nin SHA-256'sını (`masterPromptSha256`) kaydeder.
`npm run check:comparison` ikisini de doğrular. Bir eşiği düşürmek, bir senaryo
cümlesini değiştirmek ya da master prompt'a bir satır eklemek betiği düşürür.

Doğrulandı: `minimumPromtgenScopeImprovement` 0.3'ten 0.05'e indirilince
kontrol `exit 1` verdi; master prompt'a tek yorum satırı eklenince de öyle.

**Meşru bir değişiklik gerekiyorsa yürüyen çalışmanın tanımı düzenlenmez; yeni
bir `studyId` açılır.** Böylece hangi verinin hangi tanım altında toplandığı
belirsizleşmez.

## Yürütme

```bash
npm run comparison:benchmark
```

```bash
npm run comparison:publish-gate
```

Yayın kapısı bugün altı engelle kapalı: üç yöntemin her biri için 5 kör senaryo,
5 anonim oturum, ve PromtGen'in kapsam koruması ile kabul kriteri kapsamında
baseline üstünlük eşiği. **Kapıyı gevşetmek bir çözüm değildir** — eşikler
`study.json`'da, sonucu değil yöntemi tanımlar.

## Bitti sayılma ölçütü

```
5 senaryo × 3 kol = 15 gönderim
her blindId için ≥ 2 kör değerlendirme
≥ 5 anonim PromtGen oturumu
comparison:publish-gate çıkışı 0
```

Kapı açıldığında rapor üç yöntemi karşılaştırılabilir hâle gelir. Sonuç ne
çıkarsa çıksın, o gün PromtGen'in ilk gerçek ürün kanıtı olur.
