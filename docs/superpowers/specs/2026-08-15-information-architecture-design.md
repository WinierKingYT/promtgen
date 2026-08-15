# Arayüz Yenileme — Alt Proje C: Bilgi Mimarisi

**Tarih:** 2026-08-15
**Durum:** Onaylandı, uygulanmayı bekliyor
**Öncülleri:** [Alt Proje A — CSS Temeli](2026-08-06-ui-foundation-design.md),
[Alt Proje B — Görsel Dil Tutarlılığı](2026-08-08-visual-language-consistency-design.md)

## Bağlam

A `styles.css`'i tek token katmanına topladı, B ekrandaki koyu kuşağı tamamen
kaldırdı. İkisi de **görünümü** düzeltti; hiçbiri kullanıcının nerede olduğunu
ya da bir aracı nerede bulacağını değiştirmedi. C bunu ele alıyor.

### Ölçüm

**Gezinme iki seviyeli.** Üst seviye `pg-view-tabs`
(`IdeaStudioPrimitives.tsx:101`) üç görünüm sunuyor: Fikir · Fikir Özeti · Plan.
İçeride ikinci bir seviye var — `pg-map-tabs`
(`IdeaStudioPrimitives.tsx:131`), sağ panelde Özet / Keşif. İkinci seviye
konumu belirsizleştiriyor: kullanıcı "Fikir → Keşif"te mi, yoksa "Keşif"te mi
olduğunu ayırt edemiyor, ve üst seviye ikinci seviyenin durumunu göstermiyor.

**Beş araç tek bir açılırın arkasında.** `Workspace.tsx:388`:

```
<details><summary>Gelişmiş plan araçları</summary>
  StorageHealthPanel · TraceabilityMap · PlanningScenarioPanel
  · PlanCodeAlignmentPanel · SectionRegenerationPanel
</details>
```

Beşi de yalnız Plan görünümünde, yalnız bağlam sütununda, yalnız kullanıcı
açılırı açarsa görünüyor. Aralarında ortak hiçbir şey yok — depolama sağlığı
plana ait bile değil. "Gelişmiş" etiketi bir kategori değil, bir çöp kutusu.

**Plan kapısı içeriği kopyalıyor.** `Workspace.tsx:370-371`: plan kilitliyken
`pg-plan-gate` içinde `IdeaGuidePanel` render ediliyor — aynı bileşen `guide`
görünümünde de render ediliyor (`Workspace.tsx:366`). Aynı panel iki yerde,
ve kapı kullanıcıya **neden** kilitli olduğunu söylemiyor; yalnız aynı paneli
tekrar gösteriyor.

**Uygulamada üç ayrı aşama modeli var, üçü birbirine bağlı değil:**

| Model | Nerede | Adım | Canlı mı |
| --- | --- | --- | --- |
| `IdeaStudioView` | `IdeaStudioPrimitives.tsx:25` | 3 | **Evet** — ekranı bu belirliyor |
| `PHASE_REGISTRY` | `project-document.js:13` | 9 | Veri canlı (`planning-engine.js` yazıyor), UI okumuyor |
| `coach.steps` | `idea-coach-service` | değişken | Evet — Özet sekmesinde liste olarak görünüyor |

`PHASE_REGISTRY`'yi tek okuyan `GuidedHeaderBar.tsx`; onu tek çağıran
`tests/v4/ux-contracts.test.ts:19`. Yani "kanonik aşama kaydı" testte kanonik,
ekranda ölü.

## Hedefler

- Gezinme **tek seviyeye** iner: üç sıralı aşama, ikinci sekme seviyesi kalkar.
- Ulaşılmamış aşama kilitli görünür ve **kilidin nedenini metin olarak söyler**.
- Beş araç ait oldukları ana dağılır; "Gelişmiş plan araçları" açılırı kalkar.
- Hiçbir içerik iki yerde durmaz — plan kapısındaki `IdeaGuidePanel` kopyası
  dahil.
- Aşama modeli **tek kaynaktan** türer.

## Kararlar

### Aşama kaynağı: `IdeaStudioView` kalır

Üç aşama zaten `develop | guide | plan` olarak var ve ekranı bugün bu belirliyor.
C yeni bir kabuk kurmuyor; mevcut üçünü etiketleyip kilitliyor.

`PHASE_REGISTRY` ve `GuidedHeaderBar` **açıkça terk edilir**: ikisi de silinir,
`tests/v4/ux-contracts.test.ts`'in `GuidedHeaderBar` iddiası kaldırılır.
`lifecycle.activePhase` verisi `planning-engine` tarafından yazılmaya devam eder
(dışa aktarım ve geçmiş onu kullanıyor) ama gezinmeyi beslemez — bu bilinçli bir
ayrım, spec'te kayıtlı.

`coach.steps` dördüncü bir model değil; Fikir aşamasının **içindeki** ilerleme.
Özet içeriğiyle birlikte Ortak Anlayış'a taşınır.

### Aşama adları ve kilit

| # | Aşama | `IdeaStudioView` | Kilit koşulu |
| --- | --- | --- | --- |
| 1 | Fikir | `develop` | Yok — her zaman açık |
| 2 | Ortak Anlayış | `guide` | Yok — her zaman açık |
| 3 | Plan | `plan` | `canonicalPlanningOpen` false ise kilitli |

`canonicalPlanningOpen` bugünkü tanımıyla korunur
(`project.sourceIdeaRevisionId || hasCanonicalPlan`, `Workspace.tsx:131`).
Değişen tek şey: kilitliyken **neden** kilitli olduğu yazılır ve kilidi açan
eylem Ortak Anlayış aşamasına yönlendirir — orada zaten duran `IdeaGuidePanel`'e.
Kapı içindeki kopya panel silinir.

### Ne nereye taşınıyor

| Bugün | Yeni yeri | Neden |
| --- | --- | --- |
| Özet sekmesi (`pg-map-tabs` → `summary`) | **Ortak Anlayış** aşaması | Zaten o aşamanın işini yapıyordu; tekrar biter |
| Keşif sekmesi (`expansion`) | **Fikir**'de kalır, sekmesiz tam panel | Sohbetin yardımcısı, aşamasıyla aynı yerde |
| `SectionRegenerationPanel` | Plan → **editörün içine** | Bir bölümü yeniden üretmek, o bölümü düzenlemenin parçası |
| `PlanningScenarioPanel` | Plan → **bağlam sütununa** | Plan kurulurken bakılan bir şey |
| `TraceabilityMap` | Plan → ilk bağlantı oluşunca **belirir** | Boşken göstermenin anlamı yok |
| `PlanCodeAlignmentPanel` | Plan → ilk kod referansında **belirir** | Plandan sonraki an |
| `StorageHealthPanel` | **Ayarlar diyaloğu** | Hiçbir aşamaya ait değil |

Depolama sağlığı için yeni yüzey icat edilmiyor; `ProviderSettingsDialog` zaten
sistem tarafındaki tek yer.

## Doğrulama

### Görsel sözleşme bu alt projede kapı değil

A ve B'de sözleşme kapıydı: fark **ekran + eleman + özellik** olarak geliyordu ve
"dokunmadığım yüzeyde fark = sızıntı" kuralı işe yarıyordu. C bileşenleri
ekranlar arasında taşıyor — `StorageHealthPanel`'i Plan'dan Ayarlar'a almak iki
ekranı da baştan sona değiştirir. Üç kova disiplini çöker; neredeyse her fark
"kova 1" olur ve kural hiçbir şey elemez.

Ayrıca sözleşme testi kendi gezinmesinde kaldırılacak sekmeleri kullanıyor:

```
tests/e2e/visual-contract.spec.ts:64   getByRole('tab', { name: 'Keşif' })
tests/e2e/visual-contract.spec.ts:182  getByRole('tab', { name: 'Özet' })
```

Sekme seviyesi kalktığı an test fark üretmez, **çöker**. Her görevde önce
gezinme onarılır, sonra referans yenilenir. Sözleşme C boyunca kayıt tutucudur:
değişimi belgeler, değişimi onaylamaz.

### Birincil kapı: çift iddia

Yedi taşımanın her biri için **iki** E2E iddiası — yeni yerinde görünür, eski
yerinde yok:

| Taşınan | Yeni yerde | Eski yerde |
| --- | --- | --- |
| Özet içeriği | Ortak Anlayış'ta görünür | Fikir panelinde `toHaveCount(0)` |
| Keşif panosu | Fikir'de sekmesiz görünür | `role="tab"` yok |
| `SectionRegenerationPanel` | Editörün içinde | `details` açılırı yok |
| `PlanningScenarioPanel` | Bağlam sütununda | `details` açılırı yok |
| `TraceabilityMap` | Bağlantı varken görünür | Bağlantı yokken yok |
| `PlanCodeAlignmentPanel` | Kod referansı varken görünür | Referans yokken yok |
| `StorageHealthPanel` | Ayarlar diyaloğunda | Plan'da `toHaveCount(0)` |
| Plan kilidi | Kilit nedeni metin olarak okunur | `pg-plan-gate` içinde `IdeaGuidePanel` yok |

"Eski yerde yok" sütunu asıl değerli olan: taşıma yerine **kopyalama** yaptığımızı
yakalayan tek iddia bu.

### Koşullu görünürlük birim testiyle çivilenir

`TraceabilityMap` ve `PlanCodeAlignmentPanel` koşullu belirecek. Koşul yanlışsa
özellik hataya düşmez — **sessizce hiç görünmez**. Bu ikisinin görünürlük koşulu
saf bir fonksiyona çıkarılır ve birim testiyle her iki yönde doğrulanır; E2E'ye
bırakılmaz.

## Riskler

**`StorageHealthPanel`'in taşınması saf bir taşıma değil.**
`onCommit: (project, message?, commandType?) => Promise<boolean|void>|boolean|void`
alıyor — bu `Workspace`'in `persistCandidate`'i. `ProviderSettingsDialog` lazy ve
ayrı kapsamda; bugünkü sözleşmesi yalnız `ProviderSettings` kaydediyor. Panel
oraya giderken proje kalıcılığını da yanında götürmesi gerekiyor, yani diyaloğun
prop sözleşmesi genişliyor. Bu genişleme spec'te kabul edilmiş bir maliyettir;
alternatif (paneli üçüncü bir yüzeye koymak) daha kötü.

**E2E `guided-workflow.spec.ts` tasarım gereği kırılır.** Bilinen kırılmalar:

```
:19  getByRole('button', { name: 'Fikir Özeti' })       — etiket değişiyor
:40  getByRole('navigation', { name: 'Fikrinle ne ...' }) — etiket değişiyor
:41  aria-current='step' üzerinde 'Fikir'                — kilit durumu ekleniyor
:42  getByRole('complementary', { name: 'Fikir özeti' }) — panel taşınıyor
```

Bunlar beklenen kırılmalardır ve her görevde **yeni davranışa göre** güncellenir,
susturulmaz.

**Sınıf adları bu alt projede değişmez.** Yerleşim değişse de `pg-*` sınıf
adlandırması ve E2E seçicilerinin `data-testid`'e taşınması D'nin işi. C
markup'ı yeniden düzenler, adlandırmayı değil.

## Kapsam dışı

- Sınıf adlandırma, bileşen başına CSS, `data-testid` geçişi — **D**.
- Renk, tipografi ölçeği, ikon dili — A ve B kapandı; tipografi ayrı karar.
- Kart içeriğinin kalitesi (fikir genişletmenin *değeri*) — ayrı iş; bu alt
  projeler yalnız kabuğu düzeltiyor.
- `lifecycle.activePhase`'in 9 fazını gezinmeye bağlamak — açıkça reddedildi.
