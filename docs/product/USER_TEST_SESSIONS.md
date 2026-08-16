# Kullanıcı Test Oturumları

**Amaç:** PromtGen'in Golden Path'ini gerçek geliştiricilerle koşup nerede
bırakıldığını, nerede geri dönüldüğünü ve nerede "bunu ChatGPT'de daha hızlı
yapardım" dendiğini ölçmek.

Altı oturum var ve her biri **farklı bir riski** ölçüyor. Aynı akışın altı
kopyası değiller; bir kişiye hepsini yaptırmak gerekmiyor.

Kaydedilen alanlar [karşılaştırma protokolündeki](COMPARISON_STUDY_PROTOCOL.md)
`AnonymousUserSession` şemasıyla birebir eşleşir. Uydurma alan eklenmez;
`validateAnonymousUserSessions` fazladan anahtarı reddeder.

---

## Bütün oturumlar için geçerli kurallar

**Kolaylaştırıcı soru sormaz.** Katılımcı takılırsa "ne yapmak istersiniz?"
denir, yol gösterilmez. Soruyu **araç** sormalı; kolaylaştırıcı sorarsa ölçülen
şey araç değil kolaylaştırıcı olur.

**Sesli düşünme istenir.** "Aklınızdan geçeni söyleyin" denir. Sessizlik veri
kaybıdır.

**Süre üç parça hâlinde tutulur:**

```
setupDurationSeconds      depoyu çalıştırma + sağlayıcı bağlama
planningDurationSeconds   fikir cümlesi verildiği andan ilk kullanılabilir plana
endToEndDurationSeconds   ilk temastan oturum bitene kadar, toplam
```

**Bir oturumu geçersiz kılan şeyler:** kolaylaştırıcının fikri netleştirmesi,
rıza alınmamış olması, katılımcının aynı senaryoyu ikinci bir yöntemle daha
önce çözmüş olması.

**Gizlilik:** gerçek ad, e-posta, serbest metin ve proje içeriği veri setine
yazılmaz. Yalnız şemadaki alanlar kaydedilir.

---

## T1 — İlk çalıştırma ve kurulum sürtünmesi

**Ölçtüğü risk:** Kullanıcı ürünü hiç göremeden vazgeçiyor mu?

Bu, karşılaştırmanın en kırılgan noktası: ChatGPT'nin kurulumu sıfır,
PromtGen'inki değil. Kapı bilinçli bir üründür (sağlayıcısız yerel motor iki
farklı fikre aynı çıktıyı veriyordu) ama bedeli ölçülmeli.

**Katılımcıya verilen:** Depo adresi ve şu cümle — *"Bunu kendi makinenizde
çalıştırıp bir proje planı çıkarmaya çalışın."* Başka hiçbir yönerge yok.

**Kolaylaştırıcı hiç konuşmaz.** README yetiyorsa yetiyordur.

**Gözlenecekler**
- İlk takıldığı adım (bağımlılık kurulumu? sağlayıcı? model indirme?)
- README'ye kaç kez döndü
- "Bu kadar uğraşmaya değer mi" dediği an var mı
- Sağlayıcı seçiminde tereddüt: hangi seçeneği neden seçti

**Kaydedilecek:** `setupDurationSeconds`. Katılımcı vazgeçerse süre yine
kaydedilir ve `completed: false` işaretlenir — **vazgeçme de veridir**, oturum
geçersiz sayılmaz.

**Durdurma noktası:** 45 dakika. O ana kadar sağlayıcı bağlanmadıysa bu başlı
başına bir bulgudur.

---

## T2 — Golden Path uçtan uca

**Ölçtüğü risk:** Ana akış tek oturumda bitiyor mu?

**Ön koşul:** T1 tamamlanmış ya da sağlayıcı önceden bağlanmış (bu durumda
`setupDurationSeconds: 0` değil, T1'de ölçülen gerçek süre yazılır; kurulum
yapılmadıysa 0).

**Katılımcıya verilen:** [Senaryo setinden](COMPARISON_STUDY_PROTOCOL.md) bir
fikir cümlesi, birebir. Hedef kullanıcı, gereksinim, kapsam **verilmez** —
onları çıkarmak ürünün işi.

**Görev:** *"Bu fikirden başlayıp, bir kodlama ajanına verebileceğiniz bir plan
çıkarın."*

**Gözlenecekler**
- Fikir → Ortak Anlayış → Plan geçişlerini kendi buluyor mu
- Kilitli Plan aşamasına tıklıyor mu, kilidin nedenini okuyor mu
- Ortak Anlayış'ı onaylamadan plana geçmeye çalışıyor mu
- Dışa aktarmayı buluyor mu

**Kaydedilecek:** `completed`, `firstExportReached`, `planningDurationSeconds`,
`endToEndDurationSeconds`, `manualEditCount`, `satisfaction`, `wouldUsePlan`.

---

## T3 — Keşif panosu gerçekten fikri büyütüyor mu

**Ölçtüğü risk:** Kartlar değerli mi, yoksa genel geçer mi?

Bu, ürünün çekirdek vaadi ve şu an hiçbir ölçümü yok: mevcut benchmark kart
**sayısını** ölçüyor, kartın işe yarayıp yaramadığını değil.

**Görev:** Katılımcı Fikir aşamasında Keşif panosunu açar, bir kategori seçer
ve gelen kartları okur.

**Kolaylaştırıcı her kart için tek soru sorar:** *"Bunu siz düşünmüş müydünüz?"*
Üç cevaptan biri işaretlenir:

| Cevap | Anlamı |
| --- | --- |
| Düşünmüştüm | Kart değer katmadı |
| Düşünmemiştim ve işime yarar | **Aranan sonuç** |
| Düşünmemiştim ama alakasız | Gürültü |

**Gözlenecekler**
- Kaç kartı fikre ekledi, kaçını görmezden geldi
- "Bunların hepsi her projeye yazılabilir" diyor mu
- İkinci kategoriyi açma isteği doğuyor mu

**Kaydedilecek:** Yukarıdaki üç sayı kolaylaştırıcı notunda tutulur (şemada
karşılığı yok, uydurma alan eklenmez). Oturum kaydı normal alanlarla yazılır.

---

## T4 — Plan üzerinde çalışma ve düzeltme

**Ölçtüğü risk:** Üretilen plan kullanıcının kendi planı hâline geliyor mu,
yoksa kabul edilip bırakılıyor mu?

**Ön koşul:** T2'den çıkmış bir plan.

**Görev:** *"Bu planda katılmadığınız üç şeyi düzeltin."*

**Gözlenecekler**
- Bölüm editörünü buluyor mu
- Kaydetmeden başka bölüme geçip kaybediyor mu
- Senaryolar ve bölüm yeniden üretimi panellerini fark ediyor mu
- Düzeltmekten vazgeçip "böyle kalsın" dediği yer var mı

**Kaydedilecek:** `manualEditCount` (bu oturumun asıl metriği),
`mvpAcceptedWithMinorEdits`.

**Dikkat:** Yüksek `manualEditCount` tek başına kötü değil — kullanıcının
sahiplenmesi de olabilir. Düşük olması da iyi değil — vazgeçme olabilir. Sayıyı
sesli düşünme notlarıyla birlikte okuyun.

---

## T5 — Hata yaptıktan sonra geri dönebilme

**Ölçtüğü risk:** Güvenlik ağı gerçekten yakalıyor mu, kullanıcı onu bulabiliyor
mu?

Depolama ve revizyon sistemi ürünün en çok mühendislik yatırımı yapılmış
tarafı; hiç kullanıcı kanıtı yok.

**Görev:** İki adım, sırayla.
1. *"Planınızın bir bölümünü bilerek bozun — silin ya da yanlış bir şey
   yazın."*
2. *"Şimdi bunu geri alın."*

**Gözlenecekler**
- Geçmiş/revizyon yolunu buluyor mu, kaç saniyede
- Ctrl+Z arıyor mu (bulamazsa bu bir bulgudur)
- Geri yüklemenin **yeni bir revizyon** ürettiğini fark ediyor mu, bu onu
  şaşırtıyor mu
- "Kaybettim mi?" endişesi yaşadığı an var mı

**Kaydedilecek:** Bu oturum ayrı bir `AnonymousUserSession` üretmez; T2 ya da
T4 oturumunun devamı sayılır. Bulgular kolaylaştırıcı notunda tutulur.

---

## T6 — Planı bir kodlama ajanına devretme

**Ölçtüğü risk:** Ürünün asıl değer iddiası. Plan gerçekten "ek soru sormadan
uygulanabilir" mi?

**Görev:** Katılımcı T2'de ürettiği planı dışa aktarır ve bir kodlama ajanına
(Claude Code, Cursor, Codex — hangisini kullanıyorsa) verir. Ajana tek cümle
söyler: *"Bu planı uygula."*

**Gözlenecekler**
- Ajan kaç soru sordu (sıfır olması hedef)
- Sorduğu soru planın hangi boşluğunu gösteriyor
- Katılımcı ajana plan dışından ne kadar bilgi eklemek zorunda kaldı
- Ajanın ilk denemesi çalıştı mı

**Kaydedilecek:** `agentFirstPassCompleted` — bu alan kör submission kaydına
gider ve karşılaştırmanın en ağır metriğidir. Sorulan soru sayısı
kolaylaştırıcı notunda tutulur.

**Not:** Bu oturum uzun sürebilir. Amaç kodun bitmesi değil, **ajanın plana
bakıp ek soru sorup sormadığı**. İlk beş dakika yeterli sinyali verir.

---

## Oturum sonu — her oturumda sorulacak üç soru

1. *"Bunu yine kullanır mıydınız?"* → `wouldUsePlan`
2. *"1'den 5'e, ne kadar memnunsunuz?"* → `satisfaction`
3. *"Aynı işi ChatGPT'de yapsaydınız ne olurdu?"* → serbest cevap, nota yazılır

Üçüncü soru veri setine girmez ama en değerli cevabı genellikle o verir.

---

## Kaç kişi, hangi dağılım

Yayın kapısı en az **5 anonim PromtGen oturumu** istiyor. Öneri:

| Profil | Kişi | Öncelikli oturumlar |
| --- | --- | --- |
| AI araçlarıyla başlamış junior | 2 | T1, T2, T6 |
| Orta seviye, kendi projesi olan | 2 | T2, T3, T4 |
| Deneyimli solo geliştirici | 2 | T2, T5, T6 |

Aynı kişi aynı senaryoyu iki farklı yöntemle çözmez — karşılaştırma kollarının
bağımsızlığı buna bağlı.

## Sonuçların işlenmesi

Oturumlar bittiğinde kayıtlar `benchmarks/comparison/user-sessions.json`
dosyasına yazılır ve:

```bash
npm run comparison:benchmark
```

çalıştırılır. Yayın kapısı durumu:

```bash
npm run comparison:publish-gate
```

**Kapı kapalı kalırsa eşik düşürülmez.** Çalışma dondurulmuştur; `study.json`
kendi özetini taşır ve değiştirilirse kontrol düşer. Sonuç PromtGen aleyhine
çıkarsa bu da geçerli ve yayınlanabilir bir sonuçtur.
