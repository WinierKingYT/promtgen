# PromtGen Ürün Modeli V3 — Şartname

**Durum:** ONAY BEKLİYOR · kod değişikliği yok
**Yerini alacağı:** `promtgen-focused-planner` v2 (`product-contract.ts:17`)
**Önerilen kimlik:** `promtgen-project-design-planner` v3

> Bu belge **üretilen bir dosya değildir.** `docs/product/PRODUCT_CONTRACT.md`
> `product-contract.ts`'ten üretiliyor; elle düzenlenirse `check:product-docs`
> düşer. Bu yüzden V3 önce burada, onay bekleyen bir şartname olarak duruyor.
> Onaylandığında kontrat modülü değişir ve üretilen belge kendiliğinden
> güncellenir.

---

## 1. Neden değişiyor

Bugünkü sözleşme çekirdeği şöyle tanımlıyor:

```
kısa fikir → MVP → gereksinim → görev
```

Hedeflenen ürün ise şu:

```
HAM FİKİR → ANLAMA → FİKİR TASARIMI → FİKİR ONAYI
          → TEKNİK ÇÖZÜM TASARIMI → TEKNİK ONAY
          → UYGULAMA PLANI → TASK + TEST + İZLENEBİLİRLİK → AGENT DEVRİ
```

Aradaki fark kozmetik değil: bugün `Idea → Plan` **doğrudan** geçiyor. "Bunu
nasıl kuracağız?" sorusunun kendi aşaması yok, dolayısıyla teknik kararlar ya
hiç konuşulmuyor ya da gereksinimlerin içine gömülüyor.

---

## 2. Yürüyen çalışmaya etkisi — önce bu okunmalı

Bu değişiklik iki gün önce dondurduğumuz karşılaştırma çalışmasıyla çelişiyor
ve bunun sessizce geçilmesi en pahalı hata olurdu.

| Varlık | Neyi ölçüyor | V3 sonrası |
| --- | --- | --- |
| `study.json` (`promtgen-comparison-v1`) | Bugünkü Idea → MVP → Plan akışı | **Eski modeli ölçer** |
| `USER_TEST_SESSIONS.md` T1–T6 | Bugünkü Golden Path | T2, T4 yeniden yazılmalı |
| Product Evidence v1 milestone'u | Bugünkü ürün | Yanlış hipotezi doğrular |

**Sonuç: 15 gönderim ve 5 oturum V3 onaylanmadan toplanmamalı.** Aksi hâlde
değiştirmek üzere olduğumuz ürünün kanıtını üretmiş oluruz.

Çalışma dondurulmuş durumda ve tanımı düzenlenemez — `frozenDigest` bunu
zorluyor. Bu bir engel değil, tasarımın çalışması: **v1 olduğu gibi kalır,
V3 onaylandıktan sonra `promtgen-comparison-v2` açılır.** Böylece hangi
verinin hangi ürün modeli altında toplandığı belirsizleşmez.

---

## 3. Aşamalar ve kapılar

Dört resmî aşama:

| # | Aşama | Cevapladığı soru | Kanonik çıktısı |
| --- | --- | --- | --- |
| 1 | **Idea Design** | Ne yapıyoruz, kim için, hangi davranışlarla | `ideaDesign` |
| 2 | **Solution Design** | Bunu nasıl kuracağız | `solutionDesign` |
| 3 | **Implementation Plan** | Kim ne zaman ne yapacak, nasıl doğrulanacak | `requirements`, `tasks`, `testCases` |
| 4 | **Handoff** | Ajan bunu uygulayabilir mi | dışa aktarım paketi |

### İki değişmez

```
Kritik FİKİR kararları çözülmeden Solution Design canonical olarak
onaylanamaz.

Kritik TEKNİK kararlar çözülmeden Implementation Plan finalleştirilemez.
```

Bunlar iki kapıya karşılık gelir: **Idea Approval Gate** ve **Technical
Approval Gate**. `Idea → Plan` doğrudan geçişi kaldırılır.

### Kapıların ölçütü yüzde değildir

Bugünkü `Hazırlık 98/100` sahte kesinlik veriyor. Kapı şunu göstermeli:

```
Bloklayan konu: 0
Çözülmemiş önemli: 1
Ertelenen: 4
Devam edilebilir.
```

Sayı değil, **engel listesi**. Sıfır engel = geçilebilir.

---

## 4. Çekirdek kavram: `Concern`

Her proje türü için alan bilgisi hardcode edilemez — e-ticaret `cart/checkout`,
at sistemi `mounting/stamina`, REST API `rate limiting/idempotency` demek.
Ama hepsi tek soyutlamayla temsil edilebilir:

```
Concern {
  id · title · description · category
  importance: critical | important | optional | irrelevant
  status: open | answered | decided | deferred | irrelevant
  whyItMatters
  questions[] · options[] · dependencies[] · relatedConcerns[]
  decisionRequired
}
```

Bu, hem fikir hem teknik tarafta kullanılır (`Concern` ve `TechnicalConcern`).

**Domain paketleri zorunlu olmaz.** Bilinen alan → AI + seçilmiş concern'ler;
bilinmeyen alan → AI dinamik keşif. "Bilinmeyen proje türü = PromtGen
çalışmıyor" durumu kabul edilemez.

---

## 5. Soru seçimi: bilgi kazancı

PromtGen bir anket motoru değildir. Her turda **tek** soru sorar ve o soru
çözülmemiş kararlar arasından en yüksek aşağı-akış etkisine sahip olandır:

```
questionPriority ≈ belirsizlik × aşağı-akış etkisi × bloklayıcılık
```

Formülün mükemmel olması gerekmiyor; **kavram** önemli. "Atın isim etiketi
hangi renkte olsun?" ile "At bir ulaşım aracı mı, bakım yapılan kalıcı bir
sistem mi?" aynı ağırlıkta olamaz — ikincisi save, stats, ownership, death,
progression ve UI'ı birden belirler.

### AI üç şey yapabilir

```
SOR        "Nasıl olsun?"
ÖNER       "Bunu düşünmemiş olabilirsiniz."
İTİRAZ ET  "Bu karar başka bir kararınızla çelişiyor."
```

### Durma koşulu

Bir noktadan sonra AI şunu diyebilmeli: *"Yeni özellik eklemek yerine teknik
tasarıma geçmek daha değerli."* Bu olmadan ürün bir fikir fırtınası makinesine
dönüşür. **Kapsam disiplini bir çıktıdır:** kullanıcının "gerek yok" dediği şey
`Out of Scope` olarak kaydedilir ve bu da değerli bir sonuçtur.

---

## 6. Öneri ≠ Karar

Bugünkü mimarinin en değerli değişmezi korunur ve teknik tarafa genişletilir:

```
AI önerisi → kullanıcı incelemesi → kabul/düzenle/reddet → canonical karar
```

AI `PostgreSQL öneriyorum` dediğinde canonical teknoloji PostgreSQL **olmaz**.
`TechnologyCandidate` bir adaydır; `TechnicalDecision` kullanıcı onayıyla doğar
ve gerekçesini, değerlendirilen alternatifleri ve neden seçilmediklerini taşır
— yani bir ADR.

**Erken teknoloji yasağı:** ürün/sistem kısıtları gerekçelendirmeden geri
dönülemez teknik öneri yapılmaz. "E-ticaret sitesi istiyorum" cümlesine
"React + Node + PostgreSQL + Stripe" cevabı verilmez; problem henüz bilinmiyor.

**Güven yüzdesi yerine kanıt:** `confidence: 92%` sahte kesinliktir. Doğrusu
kararın hangi konuşma turlarından ve hangi kabul edilmiş kararlardan türediğini
göstermektir.

---

## 7. İzlenebilirlik zinciri

```
Idea Concern → Idea Decision → System Behavior
             → Technical Concern → Technical Decision
             → Requirement → Task → Test
```

Ve tersine, **geçersizleştirme grafiği**: bir karar değişince neyin bayatladığı
bilinmeli.

```
3 teknik karar gözden geçirilmeli.
7 gereksinim bayatlamış olabilir.
5 görev geçersiz.
```

Kullanıcı Solution aşamasında kapsamı maddi olarak değiştirirse (*"aslında
multiplayer istiyorum"*) sistem Idea onayını yeniden açmalı ve bunu söylemeli.

---

## 8. Yaşam döngüsü

```
IDEA_DRAFT → IDEA_DISCOVERY → IDEA_REVIEW → IDEA_APPROVED
→ SOLUTION_DISCOVERY → SOLUTION_REVIEW → SOLUTION_APPROVED
→ PLAN_DRAFT → PLAN_REVIEW → PLAN_APPROVED → READY_FOR_HANDOFF
```

Geri dönüş her zaman mümkündür; geri dönüş **sessiz olmaz**, hangi onayın
yeniden açıldığı söylenir.

Bu, bugünkü 9 fazlı `PHASE_REGISTRY` ile çelişir. V3'te tek yaşam döngüsü bu
olur; `PHASE_REGISTRY` ya buna eşlenir ya da kaldırılır. (Alt proje C'de React
katmanı zaten onu okumayı bırakmıştı.)

---

## 9. UX sınırı: kullanıcı sistemi yönetmez

Üst düzey dört aşama görünür: `FİKİR · ÇÖZÜM · PLAN · DEVİR`.

Kullanıcı `Concern Map`, `Decision Graph`, `Canonical Revision`,
`Requirement Trace` gibi kavramları **öğrenmek zorunda kalmaz**. Bunlar iç
modeldir. Ekranda görünen şey şudur:

> "Şimdi atın oyuncuyla ilişkisini netleştiriyoruz."

İlerleme de anket gibi görünmez. `47/62 soru` yerine:

```
Fikir tasarımı
✓ Ana sistem davranışı
✓ Oyuncu etkileşimi
● Bakım ve ilerleme
○ Riskler
2 kritik karar kaldı
```

`Yeni Plan` ifadesi de yanlış: kullanıcı ilk aşamada plan yapmıyor, proje
tasarlıyor. **`Yeni Proje`** olur.

---

## 10. Destek matrisi çok boyutlu olur

Bugün `3D oyun: unsupported` yazıyor. Ama "tasarlamana yardım edebilirim" ile
"bu mimarinin üretime hazır olduğunu garanti ediyorum" aynı şey değil. V3
bunları ayırır:

```
3D Oyun
  Idea Design       Beta
  Solution Design   Experimental
  Implementation    Experimental
  Motor doğrulaması Doğrulanmadı
```

Bu hem daha dürüst hem de evrensel tasarım hedefiyle tutarlı.

---

## 11. Göç ilkesi

`ProjectDocumentV5 → V6`. Eşlemeler:

```
conceptSummary        → ideaDesign.framing
technicalApproaches   → solutionDesign.legacyApproaches
mevcut decisions      → güvenle sınıflandırılabilenler idea/technical
```

**Emin olunamayan eski kararlar AI ile sessizce sınıflandırılmaz.**
`decisionStage: legacy-unclassified` olarak bırakılır. Sessiz sınıflandırma,
kullanıcının hiç vermediği bir kararı ona atfetmek olurdu.

Revizyon geçmişi kaybedilmez.

---

## 12. Korunacaklar — yeniden yazılmayacak

Bu dönüşüm bahanesiyle aşağıdakiler yeniden yazılmaz. Hepsi bugün çalışıyor ve
ürün değerinin taşıyıcısı:

```
canonical revizyon sistemi · onay-öncesi-değişiklik-yok değişmezi
reddedilen öneri hafızası · depolama ve kurtarma · yedekleme
izlenebilirlik · gereksinim kalite kapıları · task compiler
test compiler · agent sözleşmeleri · dışa aktarım
sağlayıcı adaptörleri · AI runtime · güvenlik izolasyonu
```

---

## 13. Yapılmayacaklar

Freeze tamamen kalkmaz; yalnız ürün yeniden hizalaması için dar bir koridor
açılır (bkz. `FEATURE_FREEZE.md` — Kayıtlı istisna 2).

Hâlâ yasak: yeni sağlayıcı · marketplace · bulut · işbirliği · yeni ajan
rolleri · rastgele Labs özellikleri · dashboard · sosyal özellikler · mobil
uygulama · Codex orkestrasyonunu büyütmek.

---

## 14. Başarı ölçütü

V3 ancak şu senaryo çalışıyorsa bitmiş sayılır:

Kullanıcı *"Unity'de at sistemi yapmak istiyorum"* der. PromtGen bunu doğrudan
göreve çevirmez; mounting, movement, stamina, feeding, ownership, AI ve save
gibi noktaları keşfeder, kullanıcı karar verir, kararlar canonical Idea
Design'a yazılır. Sistem *"fikir tasarımı yeterince net"* der. Teknik aşamada
ScriptableObject, runtime state, animator, save modeli gereksinimlere
dayanarak konuşulur. Kullanıcı onaylar. Gereksinim, görev, test ve ajan
sözleşmeleri üretilir.

Bir ay sonra kullanıcı *"atın sürekli stamina tüketmesini kaldırmak
istiyorum"* dediğinde sistem hangi fikir kararının değiştiğini, hangi teknik
kararın etkilendiğini, hangi gereksinimin bayatladığını ve hangi görev/testin
yeniden ele alınması gerektiğini bilir.

---

## 15. Onay sonrası sıra

Bu belge onaylanana kadar kod değişmez.

```
1  PRODUCT_CONTRACT v3 + freeze istisnası        (bu belge + FEATURE_FREEZE)
2  Canonical aşama modeli, onay durumları, göç iskeleti
3  Concern modeli + birim testleri
4  Idea Design servisi
5  Adaptif Idea Coach
6  Idea Approval Gate
7  Solution Design canonical modeli
8  Solution Design AI görevleri
9  Solution Approval Gate
10 Conversion V2
11 İzlenebilirlik genişletmesi
12 Workspace UX
13 Göç
14 Benchmark (Idea Design / Solution Design)
15 E2E Golden Path
```

UI 12. adımda gelir, önce değil. Canonical model doğru olmadan her şey yine
konuşma metninin içinde kaybolur.

---

## Formül

```
PROMTGEN ≠ PROMPT GENERATOR · ANKET · GÖREV ÜRETİCİ · KODLAMA AJANI

PROMTGEN = ANLA → KEŞFET → KARAR VER → TASARLA → PLANLA → DEVRET
```

Her yeni özellik için tek soru: *bu özellik kullanıcının fikrini daha iyi
anlamamıza, önemli bir kararı ortaya çıkarmamıza, çözümü daha doğru
tasarlamamıza veya daha uygulanabilir plan üretmemize yardım ediyor mu?*
Cevap hayırsa çekirdekte yeri yoktur.
