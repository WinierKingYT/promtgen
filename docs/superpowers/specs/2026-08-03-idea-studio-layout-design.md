# Fikir Geliştirme Akışı — Aşama 2a: Yerleşim ve CSS Mimarisi

Status: Draft — kullanıcı onayı bekliyor
Date: 2026-08-03
Kapsam: Idea Studio "Fikir" ekranının üç bölgeli yerleşime geçmesi (proje sidebar'ının drawer'a dönüşmesi,
sağ panelin zenginleştirilmesi, MVP adımında kart ızgarası) ve bunu destekleyen küçük bir CSS token katmanı.

## Bağlam

Aşama 1 (bkz. [[2026-08-02-idea-coach-turn-design]]), turu tek bir yüzeye indirdi ama görsel/layout'a
dokunmadı — o zaten bu aşamanın kapsamıydı. Bu arada iki kök-neden bulgusu ayrıca düzeltildi (bu spec'in
konusu değil, sadece bu spec'in varsayımlarını etkiliyor):
- `analyzeIdea`/`ensureIdeaCoachWorkspace` artık `conceptSummary`'yi hiçbir alan kullanıcı tarafından
  doldurulmadan toptan doldurmuyor (`940d2eb`, `f3f4f69`).
- `IdeaSnapshot` artık "taslak" statüsündeki alanları da gerçek değeriyle gösteriyor, yalnız "onaylandı"
  statüsünü jenerik metinle gizlemiyordu (`a87b7f5`). Yani sağ panel artık gerçekten "konuşmadan çıkan
  anlayışı" yansıtıyor — bu spec'in "sağ panel" bölümü bunun üzerine inşa edilir, onunla çelişmez.

Kullanıcının kritiğinde bu aşamayla ilgili somut noktalar: proje sidebar'ı gereksiz yer kaplıyor; sağ panel
yalnız "onaylanmış" göstererek konuşmanın büyük kısmında boş/işe yaramaz kalıyor; MVP/özellik adımında tek
soru yerine "ne ekleyebiliriz" tarzı kart tabanlı bir keşif isteniyor.

Görsel companion ile karşılaştırmalı mockup'lar üzerinden üç karar netleşti (bu spec onları resmileştirir):
1. Yerleşim: **Seçenek A** (üç ince şerit, sidebar → drawer).
2. Sağ panel: **6 içerik bloğunun tamamı**, aşağıdaki öncelik sırasıyla.
3. MVP adımı kart yoğunluğu: **kısa kartlar** (başlık + tek satır, "ağır 4-buton karar kartı" şikayetiyle aynı
   yönde — bilişsel yükü azaltır).

## Hedefler

- Proje sidebar'ı (`.project-rail`) masaüstünde de varsayılan kapalı bir drawer olur; ekranın çoğunu Idea
  Studio'ya bırakır.
- Aşama göstergesi (`.pg-coach-steps`) sağ panelden ayrılıp kendi ince sol şeridine taşınır.
- Sağ panel (`.pg-idea-map`), yalnız "alan durumları" değil; başlık, son-değişen vurgusu, genişletilmiş
  sayaçlar, bağlama duyarlı CTA ve mini geçmişi de içerir — ama tek bir yeni blok yerine mümkün olduğunca
  mevcut yapıyı zenginleştirerek (bkz. aşağıdaki "Son değişen vurgusu" notu).
- MVP/özellik adımında (`coach.activeStep === 'mvp'`), tek soru + 3 aksiyon yerine kısa-yoğunluklu bir kart
  ızgarası gösterilir ("bu özelliği derinleştir", "ek özellik öner", "kapsam dışı tut", "alternatif MVP" gibi).
- Dağınık sabit piksel değerleri (`gap:24px` vb.) `.pg-` bileşenleri için tanımlı CSS değişkenlerine taşınır.
- Dar ekranda (mevcut `@media max-width:1100px` deseni) sağ panel de kapanabilir bir çekmeceye döner.

## Kapsam dışı

- Görsel tasarım sistemi (renk paleti, tipografi ölçeği, ikon dili) — Aşama 2b, bu spec'ten sonra ayrı bir
  brainstorm.
- Fikir geliştirme metodolojisi / kalite kapıları / claim-confidence modeli — Aşama 3.
- Gerçek kullanıcı testi — Aşama 4.
- CSS Modülleri, Tailwind veya başka bir build-araç değişikliği — mevcut tek `styles.css` korunur, yalnız
  içine bir değişken katmanı eklenir.
- `.pg-` dışındaki ekranlar (Plan, eski Studio bileşenleri) — bu spec yalnız Idea Studio "Fikir" ekranını
  kapsar.

## Mimari

### Bulgular (mevcut kod)

- `src/react/Workspace.tsx` — `develop` görünümü `.pg-idea-workspace` içinde iki kolon render ediyor:
  `.pg-conversation-column` (sohbet) + `<IdeaSnapshot/>` (`.pg-idea-map`, sağ panel). `sidebarOpen` state'i
  zaten var, `onMenu={() => setSidebarOpen(true)}` ile `.pg-mobile-menu` butonuna bağlı.
- `src/react/styles.css:64` — `.project-rail` masaüstünde normal blok, yalnız `@media max-width:1100px`
  altında (satır 314) `position:fixed` + `transform:translateX(-100%)` ile drawer'a dönüyor. Yani drawer
  mekanizması **zaten var**, sadece masaüstünde devre dışı — bu, sidebar→drawer geçişini davranış değil
  büyük ölçüde CSS/media-query kapsamı değişikliğine indiriyor.
- `src/react/styles.css:683-696` — `.pg-idea-workspace { grid-template-columns:minmax(0,1fr) 310px; }`
  (2 kolon). `.pg-coach-steps` şu an `.pg-idea-map` (sağ panel) içinde tanımlı (satır 696).
- `src/react/features/idea-studio/IdeaStudioPrimitives.tsx:113-135` — `IdeaSnapshot` bileşeni hem aşama
  göstergesini (`coach.steps`) hem alan durumlarını hem kapsam sayaçlarını tek `<aside>` içinde render
  ediyor.
- `src/react/features/idea-studio/IdeaStudioPrimitives.tsx:187-226` — `IdeaCoachTurn`, orta kolonda ya
  `IdeaDecisionCards` ya `IdeaCoachFocus` render ediyor (`showDecisionTurn` bayrağıyla, zaten `mvp`/`risks`/
  `approval` adımlarında `true`). MVP adımına özel bir kart ızgarası şu an yok — `IdeaDecisionCards` tekli
  odak kartı (`activeItem`), ızgara değil.

### Yerleşim değişikliği

`.pg-idea-workspace` üç kolona çıkar: `minmax(90px,120px) minmax(0,1fr) 310px`. Yeni sol şerit için
`IdeaCoachStageStrip` bileşeni (`IdeaStudioPrimitives.tsx`), `coach.steps`'i mevcut `.pg-coach-steps`
biçimiyle (nokta + etiket, `is-active`/`is-complete` durumları) render eder — `IdeaSnapshot`'tan çıkarılır.

`.project-rail`'in `@media max-width:1100px` bloğundaki drawer kuralları (satır 314) taban kurala taşınır;
masaüstünde de varsayılan kapalı olur. `.pg-mobile-menu` her genişlikte görünür hale gelir (adı, davranışı
zaten genel olduğu için değişmez, yalnız görünürlük media-query'si kaldırılır).

Dar ekranda (`@media max-width:1100px`, mevcut `.pg-idea-workspace` kırılma noktasıyla aynı) üç kolon tek
kolona döner (mevcut `718` satırındaki davranışın devamı): sol şerit, üstte ince bir yatay ilerleme çubuğuna
döner (B/C mockup'larındaki desen — dikey liste dar genişlikte okunaksız kalır); sağ panel de kapanabilir bir
çekmeceye döner.

### Sağ panel içeriği (öncelik sırasıyla)

1. **Başlık** — "fikrin son hali", tek cümle, her turda güncellenir. Yeni türetilmiş alan:
   `IdeaCoachState.headline` — `buildIdeaCoachState` içinde `summary?.summary` doluysa onu, değilse
   `activeStep`'e göre kısa bir yer tutucu ("Henüz netleşmedi — birlikte şekillendiriyoruz.") döner. Yeni bir
   AI çağrısı gerekmiyor; mevcut `conceptSummary.summary` alanı kullanılıyor (`applyDiscoveryAnswerDraft`
   zaten bunu `desiredOutcome`/`problemStatement` gibi diğer alanlarla aynı yoldan doldurabiliyor —
   `discovery-answer-service.ts`'e yeni patch alanı eklenmesi gerekebilir, plan aşamasında netleşecek).
2. **Alan durumları** — mevcut `.pg-map-fields`, değişmiyor (Aşama 1/düzeltmelerle zaten doğru davranıyor).
3. **Son değişen vurgusu** — ayrı blok değil; `IdeaEvidenceField`'a `justUpdated: boolean` eklenir (son
   `applyDiscoveryAnswerDraft` çağrısında bu alan değiştiyse `true`), ilgili `.pg-map-fields section`'a
   `is-just-updated` sınıfı ve kısa bir CSS geçiş/vurgu (arka plan flaş) uygulanır. Yeni state: Workspace.tsx
   son başarılı `applyDiscoveryAnswerDraft` sonucundaki `appliedFields`'i bir sonraki `buildIdeaCoachState`
   çağrısına aktarır.
4. **Kapsam sayaçları** — mevcut `.pg-scope-snapshot` (kritik/ertelenebilir karar) + 2 yeni hücre (MVP içi/
   dışı özellik sayısı — `summary.confirmedFeatures.length`/`summary.outOfScope.length`, zaten var olan
   veriden, yeni hesaplama gerekmiyor).
5. **Bağlama duyarlı CTA** — `coach.readyForSummaryReview` false iken pasif "Plana geçmek için daha fazla
   netlik gerekli", true iken aktif "Fikir Özetini incele →" (`view=guide`'a yönlendirir). Sohbet
   kolonundaki `.pg-decision-commit` barından **kavramsal olarak farklı**: o bar "bu turdaki önerileri fikre
   işle" der (yerel, anlık), bu CTA "genel anlayış plana geçmeye hazır mı" der (küresel, `readyForSummaryReview`
   bayrağına bağlı). İkisi aynı anda görünebilir, çakışmaz.
6. **Mini geçmiş** — son 2-3 `appliedFields` değişikliğinin kısa listesi (`"Kullanıcı" güncellendi`, vb.) +
   geri al bağlantısı. Geri al, mevcut revizyon sistemine (`restorePlanRevision`/`IdeaDocumentRevision`)
   bağlanır; tam "Geçmiş" ekranını (`RevisionHistoryDialog`) tekrarlamaz, yalnız en son değişikliğe hızlı
   erişim sağlar.

### MVP adımı kart ızgarası

`IdeaCoachTurn`, `coach.activeStep === 'mvp'` olduğunda `IdeaDecisionCards`/`IdeaCoachFocus` yerine yeni
`IdeaMvpExplorationGrid` bileşenini render eder — kısa kartlar (başlık + tek satır açıklama), 2x2 ızgara.
Kart içerikleri `coach.actions`'ın (mevcut `turnFieldsFor`/`actionsFor(step)` kaynaklı) aynısıdır; yalnız
sunum farklıdır (tek odaklı soru yerine tarama yapılabilir ızgara). Bir karta tıklamak mevcut `onChoose`
akışını (mesaj olarak gönderilir) kullanır — yeni bir etkileşim modeli gerekmiyor.

### CSS mimarisi

`src/react/styles.css`'in başına, `.pg-` bileşenleri için bir `:root` değişken bloğu eklenir:

```css
:root {
  --pg-space-1: 4px; --pg-space-2: 8px; --pg-space-3: 12px; --pg-space-4: 16px;
  --pg-space-5: 24px; --pg-space-6: 32px;
  --pg-stage-strip-width: 110px; --pg-panel-width: 310px;
  --pg-breakpoint-narrow: 1100px; --pg-breakpoint-mobile: 780px;
}
```

Bu spec kapsamında değiştirilen/eklenen `.pg-` kurallarındaki sabit piksel değerleri (`gap:24px` →
`var(--pg-space-5)`, `310px` → `var(--pg-panel-width)`, vb.) bu değişkenlere taşınır. **Var olan, bu işle
ilgisiz `.pg-` kuralları toplu olarak migrate edilmez** — YAGNI; yalnız dokunulan kurallar temizlenir, ayrı
bir "tüm CSS'i tokenlara taşı" görevi açılmaz.

## Hata yönetimi

- Drawer state'i (`sidebarOpen`) zaten var ve test edilmiş; yeni bir hata yüzeyi eklemiyor.
- "Son değişen vurgusu" için `appliedFields` bilgisi bir sonraki render'a taşınamazsa (örn. sayfa yenilenirse)
  vurgu sessizce gösterilmez — engelleyici değil, yalnız kozmetik bir bilgi kaybı.
- CTA'nın hedeflediği `readyForSummaryReview` zaten var olan, test edilmiş bir alan; yeni bir hesaplama
  eklenmiyor.

## Test planı

- `tests/v4/idea-coach-service.test.ts` — `headline` ve `justUpdated` alanları için yeni testler (var olan
  deterministik `activeStep` testleri değişmeden geçmeli).
- Bileşen düzeyinde otomatik test yok (React test altyapısı yok, bkz. Aşama 1 notları) — doğrulama
  `tests/e2e/*.spec.ts` (Playwright) ve elle tarayıcı incelemesiyle yapılır.
- `tests/e2e/guided-workflow.spec.ts` — üç kolonlu yerleşim ve MVP kart ızgarası için selector güncellemeleri.
- `npm run test:v4` ve `npx tsc --noEmit` yeşil kalmalı.

## Riskler

- "Başlık" alanı için `conceptSummary.summary`'nin ne zaman/nasıl dolacağı netleşmemiş olabilir — plan
  aşamasında `discovery-answer-service.ts`'e yeni bir patch alanı gerekip gerekmediği netleştirilecek.
- Sidebar'ın masaüstünde de varsayılan kapalı olması, projeler arası geçişi bir tık daha zorlaştırıyor —
  kullanıcı testinde (Aşama 4) izlenecek, bloklayıcı değil.
- 6 blokla zenginleştirilmiş sağ panel, orijinal kritikteki "çok fazla eleman" riskini kısmen geri
  getirebilir — bu bilerek kabul edilen bir trade-off (kullanıcı seçimi); "son değişen vurgusu"nun ayrı blok
  değil mevcut yapının bir durumu olması bu riski azaltıyor.
