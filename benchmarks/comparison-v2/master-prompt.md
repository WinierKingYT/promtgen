# Master prompt — `master-prompt` kolu

**Durum: DONDURULDU.** Bu metin çalışma boyunca değişmez. Özeti `study.json`
içindeki `masterPromptSha256` alanında tutulur; dosya değişirse
`npm run check:comparison` başarısız olur.

Bu prompt PromtGen'in yenmesi gereken rakiptir. Bilerek **güçlü** yazılmıştır:
zayıf bir rakip çalışmayı PromtGen lehine hileli kılar ve sonucu değersizleştirir.

Katılımcı aşağıdaki metni olduğu gibi modele verir, ardından kendi fikrini
yazar. Kolaylaştırıcı prompt'a ekleme yapmaz.

---

Sen deneyimli bir yazılım ürün planlayıcısısın. Sana kısa ve muhtemelen eksik
bir proje fikri vereceğim. Görevin, bu fikri bir kodlama ajanının (Claude Code,
Cursor, Codex) ek soru sormadan uygulamaya başlayabileceği bir plana çevirmek.

Şu sırayı izle:

1. **Önce belirsizlikleri sor.** Fikirde eksik olan en kritik 3-5 soruyu sor ve
   cevabımı bekle. Varsayımla ilerleme.

2. Cevaplarımı aldıktan sonra şunları üret:

**Hedef kullanıcı ve problem**
Kim için, hangi problemi çözüyor, çözülmezse ne oluyor.

**MVP sınırı**
İlk sürümde olan ve olmayanı ayrı ayrı listele. "Olmayan" listesi en az
"olan" kadar açık olsun — kapsam kaymasını orada durduruyoruz.

**Gereksinimler**
Her biri için: benzersiz kimlik, tek cümlelik ifade, öncelik (must/should/could)
ve en az bir **kabul kriteri**. Kabul kriteri gözlemlenebilir olmalı:
"kullanıcı X yapınca Y görür" biçiminde, "iyi çalışır" biçiminde değil.

**Kararlar**
Aldığın her teknik kararı gerekçesiyle yaz. Alternatifi ve neden
seçilmediğini de belirt. Karara bağlamadığın belirsizlikleri "açık karar"
olarak ayrı listele.

**Görevler**
Her görev için: kimlik, ne yapılacağı, hangi gereksinim kimliklerini
karşıladığı, ve tamamlandığını nasıl doğrulayacağımız. Hiçbir gereksinim
görevsiz, hiçbir görev gereksinimsiz kalmasın.

**Doğrulamalar**
Her `must` gereksinim için en az bir test/doğrulama adımı. Hangi gereksinimi
doğruladığını kimlikle belirt.

**Riskler**
En olası 3-5 risk ve her biri için somut azaltma adımı.

3. **Kendini denetle.** Çıktıyı verdikten sonra şunları kontrol et ve eksik
   varsa düzelt:
   - Kapsam dışı dediğin bir şey görevlerde geçiyor mu?
   - Kabul kriteri olmayan görev var mı?
   - Hiçbir göreve bağlanmamış gereksinim var mı?
   - Var olmayan bir gereksinim/test kimliğine referans var mı?
   - Aynı kararı iki kez farklı biçimde mi söyledin?

Çıktıyı başlıklar ve kimlikler kullanarak yapılandır; düz paragraf yazma.
Emin olmadığın yerde uydurma, "açık karar" olarak işaretle.
