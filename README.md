# AI-Architect | Yapay Zeka Yazılım Mimarı & Prompt Otomasyonu

AI-Architect, yazılım fikirlerinizi (Web, Mobil, Oyun veya API) geliştirmeye başlamadan önce analiz eden, eksik kalan kritik noktaları gideren ve yapay zeka geliştirme ajanlarına (Antigravity, Cursor, v.b.) adım adım kodlatabileceğiniz en optimize **prompt dizilimlerini** hazırlayan ultra premium bir web arayüzüdür.

## Özellikler

1. **Çok Platformlu Analiz**: Web Siteleri, Mobil Uygulamalar, Oyun Mekanikleri ve Backend servisleri için optimize edilmiştir.
2. **Kriter Odaklı Yapılandırma**: Projenizi UI/UX, Güvenlik, Performans ve Ölçeklenebilirlik hedefleriyle şekillendirebilirsiniz.
3. **Akıllı Öneri & Analiz**: Ajanlara kodlatmaya başlamadan önce, projenizin güvenlik açıklarını kapatacak ve performansını artıracak ek özellik önerileri sunar.
4. **Çok Adımlı Prompt Akışı (Pipeline)**: Kodlama ajanıza tek seferde devasa bir kod yazdırmak yerine, projeyi mantıklı parçalara bölerek adım adım yaptırmanızı sağlar.
5. **SKILL.md & Agent Entegrasyonu**: Projenizin ana dizinine kaydedip kodlama ajanına okutabileceğiniz kurallar kılavuzunu (`SKILL.md`) tek tıkla indirmenizi sağlar.
6. **Gemini API & Çevrimdışı Mod**: Gemini API kullanarak tamamen dinamik analiz yapar. API anahtarınız olmasa veya internetiniz olmasa bile yerleşik akıllı şablon motoruyla üst düzey promptlar üretmeye devam eder.

## Kurulum ve Çalıştırma

Projeyi çalıştırmak için herhangi bir kuruluma veya paket yüklemesine gerek yoktur. Sadece statik dosyaları açmanız yeterlidir.

### Seçenek 1: Doğrudan Tarayıcıda Açma
1. `index.html` dosyasına çift tıklayarak tarayıcınızda açın.
2. Sağ üstteki **API Ayarları** menüsünden Gemini API anahtarınızı girin (Otomatik olarak eklediğiniz anahtar yüklüdür).
3. Fikrinizi girip analiz etmeye başlayın.

### Seçenek 2: Yerel Sunucu (Dev Server) ile Çalıştırma
Eğer projeyi yerel bir HTTP sunucusunda çalıştırmak isterseniz:

**Python ile:**
```bash
python -m http.server 8000
```
Daha sonra tarayıcınızda `http://localhost:8000` adresine gidin.

**Node.js / npx ile:**
```bash
npx serve
```

## Nasıl Kullanılır?

1. **Platform ve Odak Seçin**: Yapmak istediğiniz proje türünü ve hangi alanlarda (UI, Güvenlik, Performans) kusursuz olmasını istediğinizi belirtin.
2. **Fikrinizi Yazın**: Yapmak istediğiniz uygulamayı veya oyun mekaniğini detaylandırın.
3. **Önerileri İnceleyin**: 1. sekmedeki **Mimari & Öneriler** alanını okuyup sistem mimarisine göz atın.
4. **Promptları Kopyalayın**: 2. sekmedeki **Adım Adım Prompt Akışı** sırasını takip ederek promptları sırayla kodlama ajanıza verin. Her adım tamamlandığında bir sonrakini kopyalayıp gönderin.
5. **SKILL.md İndirin**: 3. sekmedeki `SKILL.md` içeriğini projenizin kök dizinine yerleştirin. Bu sayede ajana projenin kurallarını tek seferde öğretmiş olursunuz.
