# Dosya Envanteri ve Güvenlik Filtresi — Kurtarma ve Geri Alma

Bu belge `project-inventory-analyzer` yeteneğinin terfi kapısındaki kurtarma koşulunu karşılar.
Genel sürüm geri alma akışı için [rollback.md](rollback.md) belgesine bakın; burada yalnız
envanter filtresinin ürettiği veri sorunları ele alınır.

## Kapsanan başarısızlıklar

| # | Senaryo | Belirti |
|---|---|---|
| 1 | Filtre boşluğu | Hassas bir dosya yolu envantere girdi (`inventory[]` içinde görünüyor) |
| 2 | Yanlış pozitif | Gerekli bir dosya `excluded[]` içinde; plan eksik bağlamla üretildi |
| 3 | Sır işareti kaçağı | `security.secretFiles` boş ama dosya gerçekten sır içeriyordu |
| 4 | Yanlış klasör seçimi | Kullanıcı yanlış dizini içe aktardı; envanter tamamen alakasız |

## Envanterin kalıcı olduğu yüzeyler

Kurtarma yalnız canlı belgeyi temizlemekle bitmez. Aynı veri şu beş yerde durur:

1. `project.profile.projectInventory` — canlı canonical belge ([useProjectState.ts:75](../../src/react/hooks/useProjectState.ts:75))
2. `project.metadata.projectAnalysis` — yalnız sayaçlar; dosya yolu içermez
3. `checkpoints` deposu — revizyon başına tam anlık görüntü ([storage.js:66](../../src/v4/storage.js:66))
4. `.promtgen` ve Markdown/ajan exportları — `profile` bütünüyle taşınır ([exporter.js:50](../../src/v4/exporter.js:50))
5. Zaten gönderilmiş sağlayıcı istekleri — **geri alınamaz**, aşağıya bakın

## Kurtarma adımları

### 1. Sınırla

Etkilenen projede AI önerisi üretmeyi durdurun. Envanter bağlamı yalnız planlama çağrılarında
kullanılır; yeni çağrı yapılmadığı sürece veri cihaz dışına çıkmaz.

### 2. Dışarı çıkıp çıkmadığını belirle

`profile.projectInventory` yalnız *metadata* taşır — dosya adı, uzantı, boyut, satır sayısı.
Dosya **içeriği** hiçbir zaman bağlama girmez ([project-analyzer.js:123](../../src/v4/project-analyzer.js:123)),
ve sır/injection işaretli girdiler listeden tamamen düşürülür. Bu nedenle 1 ve 3 numaralı
senaryolarda sızan şey dosya *yoludur*, içeriği değil. Yol da hassas olabilir
(`musteri-listesi-2026.xlsx`), bu yüzden temizlik yine gereklidir.

Sağlayıcıya istek gitmişse veri üçüncü tarafa ulaşmıştır ve geri çağrılamaz. Sağlayıcının
veri saklama politikasına göre ayrıca silme talebi gerekir. Bunu olay kaydına yazın.

### 3. Canonical belgeden temizle

Envanteri boşaltmak canonical bir değişikliktir ve açık kullanıcı onayıyla yeni revision üretir:

- Projeyi açın, envanteri kaldırın ve değişikliği onaylayın.
- `profile.projectInventory` ve `metadata.projectAnalysis` birlikte temizlenmelidir; yalnız
  birini silmek envanter sayaçlarıyla gerçek durumu çelişkiye düşürür.

### 4. Geçmişi temizle

Yeni revision eski revizyonları silmez. Sızıntı gerçek bir sır içeriyorsa:

- Etkilenen revizyondan **önceki** son sağlam checkpoint'i seçin.
- Bu checkpoint üzerinden yeni revision olarak restore edin (rollback.md adım 4).
- Sızıntıyı taşıyan checkpoint'leri karantinaya alın; saklama sınırı 20 checkpoint olduğu için
  bu sayı aşıldığında eski kayıtlar zaten düşer, ancak buna güvenmeyin.

### 5. Dışa aktarılmış paketleri geri çağır

Etkilenen revizyondan üretilmiş `.promtgen` paketlerini, Markdown çıktılarını ve ajan
paketlerini paylaşıldıkları yerden silin. Bu dosyalar `profile` alanını bütünüyle taşır.

### 6. Yeniden içe aktar

Sorun filtre boşluğuysa (senaryo 1 ve 3), önce politikayı düzeltin:

- Yeni bir hassas ad kalıbı için `PROJECT_ANALYSIS_POLICY.sensitiveNames`
- Yeni bir üretilmiş klasör için `PROJECT_ANALYSIS_POLICY.ignoredDirectories`
- Yeni bir sır biçimi için `SECRET_PATTERNS` ([secret-detector.js](../../src/security/secret-detector.js))

Ardından boşluğu yakalayan bir senaryoyu
[project-inventory-benchmark.ts](../../scripts/project-inventory-benchmark.ts) içine ekleyin;
aksi hâlde aynı boşluk sessizce geri döner. Benchmark `npm run verify` kapsamında çalışır.

Senaryo 2 ve 4 için düzeltme yalnız doğru klasörle yeniden içe aktarmaktır; politika değişmez.

## Doğrulama

Kurtarmanın tamamlandığını şununla kanıtlayın:

```bash
npm run benchmark:project-inventory
```

Ek olarak: proje açılışı, envanter yeniden içe aktarma, plan üretimi ve canonical export
smoke akışını çalıştırın. Olay kaydına sürüm, commit SHA, etkilenen proje kimliği, sızan
yol sayısı ve sağlayıcıya istek gidip gitmediğini yazın.

## Bilinen sınır

Injection tespiti diakritiksiz Türkçe yükleri (`onceki talimatlari yok say`) yakalamaz.
Dosya içeriği planlama bağlamına taşınmadığı için etki, böyle bir dosyanın *adının*
envanterde listelenmesiyle sınırlıdır. Kalıp genişletildiğinde benchmark senaryosu da
güncellenmelidir.
