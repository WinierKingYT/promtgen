# Karşılaştırmalı Çalışma Protokolü

**Çalışma:** `promtgen-comparison-v2`
**Durum:** DONDURULDU · yürütülmeyi bekliyor · veri seti boş
**Veri klasörü:** `benchmarks/comparison-v2/`
**Yerini aldığı:** `promtgen-comparison-v1` — hiç veri toplamadan donmuştu ve
artık var olmayan bir ürün modelini (`Fikir → Plan` doğrudan geçişi) ölçüyordu.
Tanımı düzenlenmedi, `benchmarks/comparison/` içinde kayıt olarak duruyor.

Bu belge, `benchmarks/comparison-v2/README.md`'deki yedi adımın nasıl
yürütüleceğini tanımlar. Motor, şemalar ve yayın kapısı hazır ve testli
(`tests/v4/comparison-benchmark.test.ts`); eksik olan tek şey veri.

## Cevaplanan soru

> Bir geliştirici neden bunun yerine ChatGPT/Claude'a fikrini anlatıp iyi bir
> master prompt kullanmasın?

Bu soru bugün cevaplanamıyor: `latest-report.json` üç yöntemin üçünde de sıfır
gönderim, sıfır katılımcı gösteriyor. Çalışmanın amacı bu boşluğu kapatmak,
PromtGen'i haklı çıkarmak değil. **Sonucun PromtGen aleyhine çıkması geçerli ve
yayınlanabilir bir sonuçtur.**

## Senaryo seti

Üç yöntem de **aynı** fikirlerle çalıştırılır (README kural 1). Altı senaryo,
`study.json`'daki `minimumScenariosPerMethod: 5` eşiğini aşar.

| `scenarioId` | Fikir (katılımcıya birebir bu cümle verilir) | Alan |
| --- | --- | --- |
| `s1-fatura` | "Serbest çalışanların fatura takibini kolaylaştıran bir şey yapmak istiyorum, ödeme hatırlatmaları da olsun belki." | `small-saas` |
| `s2-toplanti` | "Küçük ekiplerin toplantı notlarından karar ve aksiyon çıkarmasını istiyorum ama çok karmaşık olmasın." | `web-app` |
| `s3-envanter` | "Depodaki ürünleri takip eden iç bir araç lazım, kim ne almış görebilelim." | `internal-tool` |
| `s4-basvuru` | "İş başvurularını topladığımız bir panel istiyorum, elemeyi kolaylaştırsın." | `admin-panel` |
| `s5-entegrasyon` | "Mevcut sistemimizin verisini başka servislere açacak bir arayüz yapmak istiyorum." | `backend-api` |
| `s6-at-sistemi` | "Unity'de oyuncuyla bağ kuran bir at sistemi yapmak istiyorum." | `game-3d` (**unsupported**) |

**Senaryolar bilerek dağınık.** Hedef kullanıcı, gereksinim, kabul kriteri,
kapsam içi/dışı — hiçbiri verilmez. Sebep şu: mevcut planner benchmark'ı bunları
girdide *hazır* aldığı için 10/10 çıkıyor ve ürünün asıl işini ölçmüyor. Ürünün
işi bu belirsizliği açmak; ölçüm de onu ölçmeli.

**Beş alan `candidate-stable`, biri değil — ve bu bilinçli.**

v1 yalnız `candidate-stable` alanlarla çalışıyordu; gerekçesi *"ürünün
desteklemediğini yazdığı bir alanda ölçüm yapmak ürüne haksızlık olur"*
idi. v2 bu gerekçeyi tutmuyor, çünkü iki farklı iddiayı birbirine karıştırıyor.
Ürün Modeli V3 §10 ikisini ayırır:

> "Tasarlamana yardım edebilirim" ile "bu mimarinin üretime hazır olduğunu
> garanti ediyorum" aynı şey değil.

Bu ayrım artık sözleşmede **kodda** duruyor, burada yazılmış bir yorum değil:
`SupportedProjectType.unsupportedReason` iki `unsupported` türünü ayırıyor.

| Tür | Anlamı | Kanıtla değişir mi |
| --- | --- | --- |
| `unmeasured` | Garanti vermiyoruz, ölçmedik. Tasarım yardımı reddedilmiş değil. | Evet |
| `refused` | Kanıt ne çıkarsa çıksın hizmet etmiyoruz. | **Hayır** |

`game-3d` → `unmeasured`. `critical-health`, `critical-finance` ve
`large-distributed` → `refused`; onlar bu çalışmaya **girmez** ve iyi sonuç
gelse bile girmeyecek. Bu tek yönlü kapı testle korunuyor
(`tests/v4/product-contract.test.ts`): güvenlik-kritik alanları `unmeasured`
yapmak testi düşürür.

V3'ün açık hedefi *"bilinmeyen proje türü = PromtGen çalışmıyor durumu kabul
edilemez"*. Bu iddiayı yalnız desteklenen alanlarda ölçmek, sonucu kendi
lehimize seçilmiş bir örneklemle üretmek olurdu.

`s6-at-sistemi` toplu ortalamalara **dahildir**; ayrı bir kefeye konmaz.
Sonucu düşürürse iddia yanlıştır ve bunu öğrenmek çalışmanın amacıdır.

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
Katılımcı V3 akışını kullanır:

```
FİKİR → (fikir onayı) → ÇÖZÜM → (teknik onay) → PLAN → dışa aktarım
```

Somut olarak: aşama panelinde çıkan konuları cevaplar, erteler ya da kapsam
dışı bırakır; fikir tasarımını onaylar; teknik keşif turunu çalıştırıp adaylar
arasından seçim yapar ve **seçmediğinin neden olmadığını yazar**; teknik
tasarımı onaylar; planı üretir.

Sağlayıcı seans öncesi bağlanmış olmalıdır (kapı bunu zaten zorunlu kılıyor).
Teknik keşif için **yerel yedek motor yoktur**; sağlayıcı yoksa C kolu
çalıştırılamaz ve oturum geçersizdir.

### Sıra dengeleme
Kollar arası hız farkı ölçüldüğü için katılımcılar kollara sırayla değil,
senaryo × kol matrisini dolduracak şekilde dağıtılır. Altı senaryo × üç kol =
**18 gönderim**; `minimumScenariosPerMethod: 5` bunun alt sınırıdır.

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

`HumanEvaluation.scores` **yedi** ölçütün tamamını 1–5 arası taşır. Ölçütler
`study.json`'da dondurulmuştur. Eksik ölçütlü kayıt da, çalışmada tanımsız
ölçüt taşıyan kayıt da reddedilir — `validateHumanEvaluations` bunu zorlar.
Daha önce bu yalnız bir yorumdu ve eksik ölçüt sessizce ortalamadan düşüyordu;
kötü giden bir ölçütü kaybetmenin en kolay yolu buydu.

| Ölçüt | Değerlendirici neye bakar |
| --- | --- |
| `scopeClarity` | Kapsam içi/dışı ayrımı net mi, "olmayan" listesi gerçekten sınır çiziyor mu |
| `requirementQuality` | Gereksinimler tek ve gözlemlenebilir mi, yoksa dilek listesi mi |
| `applicability` | Bu planla yarın işe başlanabilir mi |
| `taskTestLinkage` | Her gereksinim bir göreve, her `must` bir doğrulamaya bağlı mı |
| `acceptanceCriteria` | Kriterler gözlemlenebilir mi ("X yapınca Y görünür"), yoksa "iyi çalışır" mı |
| `agentReadiness` | Bir kodlama ajanı **ek soru sormadan** başlayabilir mi |
| `technicalDecisionQuality` | Teknik kararlar açıkça mı duruyor yoksa gereksinimlerin içine mi gömülmüş; gerekçesi ve **seçilmeyen alternatifin nedeni** var mı |

`technicalDecisionQuality` V3'ün merkezi iddiasını sınar. Ölçüt PromtGen lehine
seçilmiş değildir: master prompt zaten *"alternatifi ve neden seçilmediğini de
belirt"* diyor, yani B kolu bu ölçütte tam puan alabilecek durumda.

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

`benchmarks/comparison-v2/README.md`'nin kuralı bağlayıcıdır: gerçek kullanıcı adı,
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
`npm run check:comparison-v2` ikisini de doğrular. Bir eşiği düşürmek, bir senaryo
cümlesini değiştirmek ya da master prompt'a bir satır eklemek betiği düşürür.

Doğrulandı (v1'de 0.05'e indirme ve master prompt'a satır ekleme; v2'de
`minimumPromtgenScopeImprovement` 0.3'ten 0.1'e indirme): kontrol her seferinde
*"Çalışma tanımı dondurulduktan sonra değişmiş"* diyerek düştü.

**Meşru bir değişiklik gerekiyorsa yürüyen çalışmanın tanımı düzenlenmez; yeni
bir `studyId` açılır.** Böylece hangi verinin hangi tanım altında toplandığı
belirsizleşmez.

## Yürütme

```bash
npm run comparison:benchmark-v2
```

```bash
npm run comparison:publish-gate-v2
```

Yayın kapısı bugün altı engelle kapalı: üç yöntemin her biri için 5 kör senaryo,
5 anonim oturum, ve PromtGen'in kapsam koruması ile kabul kriteri kapsamında
baseline üstünlük eşiği. **Kapıyı gevşetmek bir çözüm değildir** — eşikler
`study.json`'da, sonucu değil yöntemi tanımlar.

## Bitti sayılma ölçütü

```
6 senaryo × 3 kol = 18 gönderim
her blindId için ≥ 2 kör değerlendirme (7 ölçütün tamamı dolu)
≥ 5 anonim PromtGen oturumu
comparison:publish-gate-v2 çıkışı 0
```

Kapı açıldığında rapor üç yöntemi karşılaştırılabilir hâle gelir. Sonuç ne
çıkarsa çıksın, o gün PromtGen'in ilk gerçek ürün kanıtı olur.
