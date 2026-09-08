# Legacy Mental Model Inventory — V3-00

**Çalışma:** PromtGen V3 Canonicalization · **Paket:** V3-00 (Faz 0)
**Tarih:** 2026-09-03 · **Dal:** `main` · **Commit:** `4c36bbe`
**Kural:** Bu fazda kod değiştirilmedi. Envanter salt-okunur çıkarıldı.

## Kilitlenen ayrım

> **MVP kavramı yasak değildir. MVP'nin PromtGen'in evrensel yaşam döngüsü
> olması yasaktır.**

Bir projenin kendi kapsamını "MVP" diye adlandırması meşrudur. PromtGen'in
*her* fikri, *her* alanda MVP terimleriyle değerlendirmeye zorlaması değildir.
Bu ayrım aşağıdaki her sınıflandırmanın dayanağıdır.

## Sınıflandırma

| Sınıf | Anlamı |
|---|---|
| **REMOVE** | Eski modeli bugünkü gerçek gibi ilan eden üretim metni |
| **MIGRATE** | Gerçek anlam taşıyor, V3 diliyle yeniden ifade edilmeli |
| **PRESERVE_LEGACY** | Tarihsel kanıt veya göç uyumluluğu — korunur |

Dondurulmuş çalışma kanıtı ve göç haritaları varsayılan olarak
PRESERVE_LEGACY'dir. Tarihsel kanıt yeniden yazılmaz.

---

## 1. Planı değiştiren dört düzeltme

Bunların hepsi ölçülerek doğrulandı ve V3-00 sonrası paketlerin risk
sıralamasını değiştirir.

### 1.1 `mvpHint` DÜŞÜK riskli — planlandığı gibi yüksek değil

Plan, Faz 4 için *"schema migration gerektireceği için ayrı execution package
olmalı"* diyordu. Ölçüm bunu çürütüyor.

`mvpHint` **hiçbir yere kaydedilmiyor**:

- `IdeaExpansionSession` (`contracts.ts:424-429`) yalnız `originalIdea`,
  `answers`, `expandedIdea`, `dimensions` taşır.
- Kabul anında (`idea-expansion-intake.ts:167-173`) karttan `title`,
  `description`, `effort`, `impact` kopyalanır; **`mvpHint` düşürülür.**
- `contracts.ts`, `migrations.js`, `storage.ts` içinde hiç geçmez.

Bütün repoda `mvpHint`'e dokunan **yalnız dört üretim dosyası** vardır:
`schemas.ts:182`, `idea-expansion.ts:73,117,120`,
`idea-expansion-service.ts:16,32,298`, `IdeaExpansionBoard.tsx:708`.

**Veri göçü gerekmez.** Yalnız şema, istem, arayüz metni ve testler.

### 1.2 Bayat bir kod yorumu, yanlış bir bağımlılık iddia ediyor

`tests/v4/idea-expansion-task.test.ts:142-144` şunu yazıyor:

> "ŞEMA DEĞİŞMEZ … şemayı değiştirmek `task-compiler` gibi okuyanları kırardı."

**Bu doğru değil.** `grep -n "mvpHint" src/v4/task-compiler.ts` boş döner;
`mvpHint`'i okuyan başka hiçbir üretim dosyası yoktur (yukarıdaki dört dosya
dışında). Yorum artık var olmayan bir bağlantıyı anlatıyor.

Bu, V3-00 sırasında bir araştırma ajanının analizine olgu olarak sızdı ve
yanlış bir "çürütme" üretti. Kayda geçiriliyor: **bu repoda yorumlar ölçüm
yerine geçmez.**

### 1.3 Asıl yüksek riskli şey planda adı geçmiyor

Gerçek bulaşma `ConceptSummary`'nin üç alanıdır:
**`mvpTarget`, `confirmedFeatures`, `outOfScope`** (`contracts.ts:305,329`).

Bunlar `mvpHint`'in aksine:

- **Kaydedilir** — `ideaLabSession.conceptSummary` ve her
  `IdeaDocumentRevision` anlık görüntüsünde.
- **Kapıyı bloklar** — `readiness-service.ts:408` (`complete.mvp-in`) ve
  `:409` (`complete.mvp-out`), ikisi de `blocking: true`.
- **Serbest metin yönlendirmesini sürer** — `discovery-answer-service.ts`
  kullanıcının cümlesini hangi alana yazacağına `/mvp|ilk sürüm|…/` regex'iyle
  karar verir. Bu canlı karar mantığıdır, süsleme değil.
- **Dokuz dosya okur, üç arayüz gösterir.**

Faz 4'ün "ayrı execution package" muamelesini hak eden şey budur.

**Tuzak:** Kod tabanında **iki ayrı `outOfScope`** vardır —
`contracts.ts:305` (kapsam listesi) ve `contracts.ts:616` (görev
sözleşmesindeki **yasak dosya yolları**, `allowedPaths`'in yanında). Toptan
yeniden adlandırma ikincisini bozar. Tek kesişme
`task-compiler.ts:99-100`'dedir.

### 1.4 Karantina (Faz 7) neredeyse bedava

`src/v4/**` ve `src/react/**` içinden uyumluluk katmanına **tek bir import**
vardır:

```
src/v4/project-analyzer.ts:1
  import { scanForSecrets } from '../security/secret-detector.js';
```

Doğrulama yöntemi: uzantı filtresi olmadan statik import, `require(` ve
dinamik `import(` taraması; ayrıca her importun gerçek hedefe çözümlenmesi.
`src/v4/ai/**` ve `src/v4/application/**` içindeki `../security/...`
importları **`src/v4/security/`**'ye çözülür (kendi dizini:
`context-isolation.ts`, `secret-guard.js|ts`, `untrusted-content.ts`),
uyumluluk katmanına değil.

`src/security/` yalnız `secret-detector.js` içerir ve **eski yaşam döngüsü
semantiği taşımaz**. Yani bu bir V3 meselesi bile değil, dizin yerleşimi
meselesidir.

`vite.config.ts` alias'ı, `tsconfig.json` `paths` ve `package.json` `imports`
haritası yoktur; göreli yol taraması bu yüzden eksiksizdir.

---

## 2. Dört yaşam döngüsü sözlüğü

INV-V3-01'in asıl konusu budur. Repoda **dört** sözlük vardır, ikisi değil.

| # | Sözlük | Değer | Konum | Durum |
|---|---|---|---|---|
| 1 | `WORKFLOW_STAGES` | 13 | `src/workflow/stages.js` | uyumluluk |
| 2 | `UNIVERSAL_PHASES` | 10 | `src/workflow/phases.js` | uyumluluk |
| 3 | `PlanningPhase` | 9 | `src/v4/contracts.ts:3` | **ÜRETİM, CANLI** |
| 4 | `ProjectStage` | 4 | `src/v4/application/project-stages.ts:20` | **canonical** |

Artı bir köprü katmanı: `src/v4/migrations.js:6-12` (`PHASE_MAP`), eski
literalleri `PlanningPhase` değerlerine çevirir.

### `PlanningPhase` bir göç tablosu değildir — aktif yazılır

```
planning-engine.ts:474              activePhase = inferNextPhase(next)
deterministic-idea-planning.ts:350  activePhase = 'CONCEPT_CONFIRMATION'
idea-lab-generation-service.ts:63   activePhase = 'IDEA_LAB'
domain/services/project-creation.ts:68  activePhase = routing.phase
```

Okunur: `project-creation-service.ts:29`, `idea-guide-service.ts:84`.
Ve **dışa aktarılan belgeye yazılır**: `canonical-export-core.ts:47`.

Bu bilinçli bir köprüdür ve kodda kendi açıklaması vardır
(`contracts.ts:5-16`): *"İkisi bir süre birlikte yaşayacak; birbirine
bağlantısız iki model bırakmamak için `planningPhaseToStage()` eşlemesi
zorunludur. Alt Proje C'nin dersi buydu: üç ayrı aşama modeli, üçü birbirine
bağlı değil."*

**INV-V3-01 için sonuç:** invariant *"hiçbir servis kendi stage modelini
tanımlayamayacak"* diyor. Bugün tanımlanmış ve çalışan bir tane zaten var.
Invariant yazılmadan önce `PlanningPhase`'in kaderine karar verilmelidir:
köprü olarak kalacak mı, yoksa kapatılacak mı?

### Emsal — bu bir kez yapıldı

`16abc11` commit'i zaten kopya aşama sabitlerini tek kaynağa indirdi:
`PROJECT_STAGES` ile `workspace-stages`'teki `ORDER`, `createStageApproval` ve
`project-document`'taki inline literaller, `STAGE_STATUSES` ile
`canonical-entities`'teki dizi.

Aynı commit'in dersi bu çalışmanın da kuralı olmalı:

> "Bir hijyen taraması sırasında sessizce davranış değiştirmek, düzeltmeye
> çalıştığı sorundan kötü olurdu."

---

## 3. Envanter — Belgeler ve ürün modeli

Repoda **`CLAUDE.md` veya `AGENTS.md` yoktur** (Faz 2 sıfırdan başlar).

| ID | Dosya | Sınıf | Risk | Not |
|---|---|---|---|---|
| DOC-01 | `README.md:3` | REMOVE | düşük | "onaylanmış MVP kapsamına… dönüştüren" — doğru metin `PRODUCT_CONTRACT.positioning`'de zaten var, birebir takas |
| DOC-02 | `README.md:5` | REMOVE | düşük | "MVP içi ve dışını seç" adımı; `PRODUCT_CONTRACT.promise` doğrusunu içerir |
| DOC-03 | `docs/product/ROADMAP.md:3` | MIGRATE | orta | "izlenebilir bir MVP planına"; elle yazılmış, hazır karşılık yok |
| DOC-04 | `docs/product/FEATURE_FREEZE.md:9` | MIGRATE | orta | Yürürlükteki önsöz hâlâ MVP çerçevesi; **altındaki tarihli kayıtlar dokunulmaz** |
| DOC-05 | `FEATURE_FREEZE.md:78-143` | PRESERVE_LEGACY + MIGRATE | düşük | Karar gövdesi korunur; yalnız "hâlâ açık" kapanış notu bayat — comparison-v2 açıldı, T2/T4 yeniden yazıldı |
| DOC-06 | `src/v4/product/product-documentation.ts:48` | MIGRATE | **yüksek** | Aşağıya bakın — kapı kör noktası |
| DOC-07 | `contracts.ts:270,296-309` | PRESERVE_LEGACY* | yüksek | `IDEA_FOUNDATION_FIELD_NAMES` içinde `mvpTarget`; köprü `usesStageModel()` (`conversion-v2.ts:34`) |
| DOC-08 | `Workspace.tsx:530,541` | MIGRATE | yüksek | Kullanıcıya görünen "MVP sınırı" / "MVP kapsamı" metni |
| DOC-09 | `study-import.ts:11,74` | MIGRATE | orta | `mvpAcceptedWithMinorEdits` — v1'de donmuş ama **comparison-v2'de de aktif kullanılıyor** |
| DOC-10 | `PRODUCT_MODEL_V3.md` | PRESERVE_LEGACY | düşük | Eski modeli bilerek karşıtlık olarak belgeliyor; denetim izi |
| DOC-11 | `docs/architecture-v4.md:36` | PRESERVE_LEGACY | düşük | Doğru yapılmış etiketleme örneği |

### DOC-06 — üretilen belge kapısının kör noktası

`docs/product/MVP_SCOPE.md` üretilen bir belgedir ve `check:product-docs` ile
denetlenir. Ama denetlenen tek şey **belgenin üreticiyle eşleşmesi**dir.
Üreticinin kendi metni (`product-documentation.ts:48`) `PRODUCT_CONTRACT`'tan
türetilmez — "MVP Kapsamı" başlığı ve "MVP içi ve kapsam dışı alanları onayla"
adımı kaynağa gömülüdür.

Sonuç: **kapı yeşil kalırken yasaklanan modeli ilan eden tek yer burasıdır.**
Faz 9'un dersi de budur — üretmek tek başına yetmez; sözleşmenin *modeli*
veriyle sahiplenmesi gerekir.

---

## 4. Envanter — Üretim uygulaması (`src/v4`, `src/react`)

| ID | Dosya | Sınıf | Risk | Not |
|---|---|---|---|---|
| APP-01 | `ai/schemas/schemas.ts:182` | MIGRATE | düşük | `mvpHint: z.enum(['mvp-adayı','sonraya'])`, zorunlu |
| APP-02 | `ai/tasks/idea-expansion.ts:73,117,120` | MIGRATE | düşük | "Her kartta mvpHint zorunludur" |
| APP-03 | `application/idea-expansion-service.ts:16,32,298` | MIGRATE | düşük | Geçişli alan, hiçbir yerde dallanma yok |
| APP-04 | `IdeaExpansionBoard.tsx:708` | MIGRATE | düşük | "İlk sürüm adayı" / "Sonraya bırakılabilir" |
| APP-05 | `src/v4/migrations.js:6-12` | PRESERVE_LEGACY | düşük | Göç makinesi, üretimde ama meşru |
| APP-06 | `readiness-service.ts:200` | MIGRATE | orta | Grup etiketi "Ürün yorumu ve MVP kapsamı onaylı" |
| APP-07 | `readiness-service.ts:408` | MIGRATE | **yüksek** | `complete.mvp-in`, **blocking**, `evidenceHash`'e girer |
| APP-08 | `readiness-service.ts:409` | MIGRATE | **yüksek** | `complete.mvp-out`, **blocking** |
| APP-09 | `readiness-service.ts:410` | MIGRATE | orta | `summary.mvpTarget` okur, uyarı seviyesi |
| APP-10 | `contracts.ts:296-330` | MIGRATE | **yüksek** | `ConceptSummary` üçlüsü — **kaydedilir, göç gerektirir** |
| APP-11 | `ConceptAgreementEditor.tsx:143,146,147` | MIGRATE | orta | "MVP hedefi / MVP içinde / MVP dışında" |
| APP-12 | `idea-state-view.ts` + `canonical-document-export.ts:34` | MIGRATE | düşük | Aynı alana iki farklı etiket: "MVP sınırı" ve "MVP hedefi" |
| APP-13 | `idea-coach-service.ts:256-258,290` | MIGRATE | orta | `mvpReady` koç akışını sürer — karar mantığı |
| APP-14 | `idea-maturity-service.ts:34-36` | MIGRATE | orta | **İkinci** puanlama yüzeyi, readiness ile aynı alanları puanlar |
| APP-15 | `discovery-answer-service.ts:65-69,111-128,189-195` | MIGRATE | **yüksek** | Regex ile serbest metin yönlendirme — canlı karar |
| APP-16 | `domain/idea-plan-alignment.ts:14-28` | MIGRATE | orta | Alan adları anahtar; APP-10 ile senkron kalmalı |
| APP-17 | `task-compiler.ts:99-100` / `plan-code-alignment.ts` | PRESERVE_LEGACY | düşük | **İkinci `outOfScope`** = dosya yolları; dokunulmaz |
| APP-18 | `contracts.ts:3` + `planning-engine.ts:474,482` | PRESERVE_LEGACY* | — | `PlanningPhase`; bkz. §2 |
| APP-19 | `Workspace.tsx:541` | MIGRATE | düşük | Tek arayüz metni, testte iddia edilmiyor |

\* PRESERVE_LEGACY ama INV-V3-01 kararı bekliyor.

### 4.1 V3-04c ölçümü — üretilen içerik ve yazma yolları

Faz 0'ın araması bu satırları HİÇ görmedi (sebep §8'de). Hepsi V3-04c
sırasında ölçülerek eklendi; sınıfı `V3-04c` olanlar o pakette düzeltildi.
Satır numaraları **düzeltme öncesi** hâli gösterir (ölçüldüğü an).

| ID | Dosya | Sınıf | Risk | Not |
|---|---|---|---|---|
| APP-20 | `idea-plan-conversion-service.ts:83` | MIGRATE → V3-04c | **yüksek** | Fikir→plan dönüşümünde kullanıcının planına YAZILAN sabit `target` metni. Canlı yol: `Workspace.tsx:375` → `applyIdeaPlanConversion`, `IdeaOutcomeBar.tsx:31` → `previewIdeaPlanConversion` |
| APP-21 | `deterministic-idea-planning.ts:154,155,157` | MIGRATE → V3-04c | **yüksek** | Sağlayıcı bağlı DEĞİLKEN sorulan fallback keşif soruları — ilk çalıştırma yolu. Bir oyun projesine MVP sorusu buradan geliyordu |
| APP-22 | `deterministic-idea-planning.ts:212,218,230` | MIGRATE → V3-04c | orta | Mimari yaklaşım ADLARI. `scripts/architecture-comparator-benchmark.ts::domainAwareTitles()` bunları ölçer ama **tam metni sabitlemez**; sabitlediği şey dört alanın AYRIŞMASI ve determinizm |
| APP-23 | `deterministic-idea-planning.ts:272,273,297` | MIGRATE → V3-04c | orta | `ideaNotes`, `candidateDecisions` ve `CONCEPT_PROFILES.general.question` |
| APP-24 | `change-impact-service.ts:453` + `planning-engine.ts:727` | MIGRATE → V3-04c | **yüksek** | Aynı satırın (`sections.scope.content` ilk satırı) **iki ayrı yazıcısı**. Yalnız biri düzeltilseydi belgenin aynı bölümü hangi yolun koştuğuna göre iki farklı etiket taşırdı |
| APP-25 | `idea-document-revision-service.ts:25,26,30` + `discovery-answer-service.ts:65,66,69` | MIGRATE | orta | `mvpTarget`/`confirmedFeatures`/`outOfScope` üçlüsünün **iki kopya etiket kümesi daha**. V3-04c'de DOKUNULMADI: APP-11/APP-15 ile aynı üçlü, tek pakette birlikte gitmeli |
| APP-26 | `planning-engine.ts:295,317,319` | MIGRATE | orta | `analyzeIdea` önerilerinin üretilen metni ("MVP sınırını çiz", "MVP teslim süresini kısaltır") — her alanda gösterilir. V3-04c'de DOKUNULMADI |

**APP-12 düzeltmesi.** Satır `idea-state-view.ts` diyor; ölçüldü, orada etiket
yok. `'MVP sınırı'` etiketi `src/react/features/idea-studio/IdeaStateView.tsx:13`
içindedir (`.ts` dosyası veriyi taşır, `.tsx` etiketi). V3-04c ikisini de
`'Hedeflenen kapsam'`a getirdi (`canonical-document-export.ts:34` ile birlikte).

**V3-04c'nin bulduğu davranışsal kilit.** `tests/e2e/guided-workflow.spec.ts:384`
`/MVP.nin çözeceği tek kritik sorun/i` diye iddia ediyordu — yani APP-21'deki
fallback sorusunun ÜSTÜNE yazılmış bir regresyon kilidi. V3-03'teki
`planning-engine.test.js:61` ile aynı desen: yasaklanan çerçeve kendi testini
edinmişti. Silinmedi, yeni metne yeniden hedeflendi.

**Kanıt kapıları kıpırdamadı.** `check:architecture-comparator-benchmark`,
`check:discovery-benchmark` ve `check:stage-design-benchmark` işlenmiş kanıtı
yeniden üretmeden geçti: karşılaştırıcı raporu senaryo sayılarını ve
başlıklarını yazar, yaklaşım adlarını değil; keşif raporundaki MVP satırları
`idea-discussion-service.ts`'ten gelir, `DISCOVERY_QUESTIONS`'tan değil.

---

## 5. Envanter — Uyumluluk katmanı

Tümü **PRESERVE_LEGACY** ve tümü **üretimden erişilemez** (tek istisna §1.4).

| ID | Modül | V4 karşılığı |
|---|---|---|
| COMPAT-01 | `src/workflow/stages.js` (13 durum) | `project-stages.ts` (PlanningPhase köprüsüyle) |
| COMPAT-02 | `src/workflow/phases.js` (10 durum) | doğrudan karşılık yok |
| COMPAT-03 | `stage-contracts.js`, `phase-contracts.js` | `project-stages.ts::stageGate()` |
| COMPAT-04 | `workflow/transitions.js` | yapısal olarak farklı; birebir karşılık yok |
| COMPAT-05 | `state/project-state.js` | `project-document.ts` |
| COMPAT-06 | `state/project-state-v3.js:413-421` | **öksüz paralel göç yolu** — üretimin kullandığı yol `v4/migrations.js` |
| COMPAT-07 | `state/state-migrations.js:104-125` | `migrateLegacyToV5` — bu yol artık gereksiz |
| COMPAT-08 | `core/v3-application-service.js` | tek V4 sahibi yok; `src/v4/application/*` bölüşür |
| COMPAT-09 | `discovery/discovery-engine.js` | karşılık yok (concern tabanlı model farklı) |
| COMPAT-10 | `domain/artifact-dependencies.js` | `reopenStage()` kaskadları |
| COMPAT-11 | `prompt/`, `artifact/`, `decision/`, `core/**` | `src/v4/*` bağımsız olarak yeniden yazılmış |
| COMPAT-12 | `src/security/secret-detector.js` | **uyumluluk DEĞİL** — canlı üretim kodu, yanlış dizinde |
| COMPAT-13 | `src/v4/migrations.js` | kendisi güncel köprü |
| COMPAT-14 | `experiments/legacy-web-prototype/` | tamamen izole; **üçüncü bir yazım**: `SCOPE_DRAFTED` |

---

## 6. Envanter — Testler ve kanıt

**Testler.** Eski yaşam döngüsü sabitleri (`WORKFLOW_STAGES`,
`UNIVERSAL_PHASES` ve yedi eski durum) **yalnızca uyumluluk paketlerinde**
geçer: `tests/unit`, `tests/workflow`, `tests/state`, `tests/domain`,
`tests/discovery`, `tests/core`, `tests/integration`. Hepsi
`scripts/run-test-suites.mjs` içindeki `COMPAT_FILES` listesindedir ve hepsi
**PRESERVE_LEGACY**'dir.

Üretim paketlerinde (`tests/v4`, `tests/e2e`) eski yaşam döngüsü sabiti
**hiç geçmez**. Oradaki 41 isabetin tamamı `mvpHint` alanıdır.

İki adlandırma çakışması not edildi: `tests/state/v3-state.test.js` ve
`tests/core/v3-application-service.test.js` — bu "v3"ler canonical V3'ten
**önceki** modeldir. İleride yeniden adlandırılmalı.

**Kanıt.** İki gerçek MIGRATE adayı vardır ve ikisi de
`scripts/planner-benchmark.ts`'te değil, `src/v4/benchmarks/planner-benchmark.ts`'tedir:

| ID | Dosya | Metin | Risk |
|---|---|---|---|
| BENCH-01 | `src/v4/benchmarks/planner-benchmark.ts:114` | `${scenario.title} MVP sonucunu doğrula` | yüksek — işlenmiş kanıt |
| BENCH-02 | `src/v4/benchmarks/planner-benchmark.ts:129` | `MVP kapsamını sabitle` | yüksek — işlenmiş kanıt |

Risk sebebi: bu metinler `benchmarks/planner/latest-report.json`,
`docs/product/BENCHMARK_REPORT.md` ve
`src/v4/product/generated-benchmark-evidence.ts`'e akar. Üçü de commit'lidir
ve `check:benchmark` ile denetlenir. **Üçü atomik commit edilmezse kapı
kırılır.**

**Dondurulmuş kanıt korunur.** `benchmarks/comparison/` (v1) eski modeli
ölçer ve `frozenDigest` ile mühürlüdür. Etiket eklemek için `study.json`'a
**dokunulamaz** — mühür kırılır. Ama etiket zaten dışarıda var:
`PRODUCT_MODEL_V3.md:53,61` ve `COMPARISON_STUDY_PROTOCOL.md:6-8`. İstenirse
yalnız yeni bir `benchmarks/comparison/LEGACY.md` eklenebilir.

`master-prompt.md` **rakip metnidir**, PromtGen'in dili değildir;
`masterPromptSha256` ile mühürlüdür ve v1/v2'de bilerek aynıdır.
`comparison-v2/study.json` zaten V3 diliyle yazılmıştır
(`"productModel": "V3 — Idea Design → Solution Design → Implementation Plan"`).

---

## 7. Paketlere yansıyan revize risk

| Paket | Plandaki risk | Ölçülen risk | Sebep |
|---|---|---|---|
| V3-01 Canonical lifecycle | yüksek | **yüksek** | `PlanningPhase` canlı; önce kaderine karar verilmeli |
| V3-02 Kök AI truth | düşük | **düşük** | Sıfırdan başlar, çakışacak dosya yok |
| V3-03 Readiness + gates | yüksek | **yüksek** | `blocking` kapılar + `evidenceHash` |
| V3-04 MVP şema temizliği | yüksek | **iki parçaya ayrılmalı** | `mvpHint` düşük; `ConceptSummary` üçlüsü yüksek |
| V3-05 UI terminoloji | orta | **düşük-orta** | Metinlerin çoğu testte iddia edilmiyor |
| V3-06 Benchmark hizalama | yüksek | **yüksek** | İşlenmiş kanıt üçlüsü atomik gider |
| V3-07 Uyumluluk karantinası | yüksek | **düşük** | Tek ihlal, o da V3 meselesi değil |
| V3-08 CI model tutarlılığı | orta | **orta** | Allowlist gerekli; §3 ve §5 sınırları hazır |
| V3-09 Belge hizalama | düşük | **orta** | DOC-06 kör noktası üretici metnini de kapsamalı |
| V3-10 Fiziksel silme | yüksek | **yüksek** | Değişmedi; en sonda kalmalı |

**Önerilen tek sıra değişikliği:** V3-07 (karantina) beklenenin aksine
neredeyse bedava. V3-01'den önce alınabilir ve alınmalıdır — çünkü karantina
kapısı yürürlükteyken sonraki paketler yanlışlıkla yeni bağımlılık ekleyemez.

**V3-04 ikiye bölünmeli:** `V3-04a` (`mvpHint`, düşük risk, veri göçü yok) ve
`V3-04b` (`ConceptSummary` üçlüsü, yüksek risk, gerçek göç).

---

## 8. Bu faz neyi kapsamadı

- **Davranış ölçümü yok.** Envanter statiktir: hiçbir akış canlı modele karşı
  koşturulmadı. Sınıflandırmalar kaynak okumasına ve erişilebilirlik
  taramasına dayanır.
- **`PlanningPhase` kararı verilmedi.** Köprü kalacak mı, kapanacak mı — bu
  V3-01'in ilk sorusudur, V3-00'ın çıktısı değildir.
- **`discovery-answer-service` test kapsamı doğrulanmadı.** Canlı karar
  mantığı taşıyor ama adına eşleşen test dosyası bulunamadı; V3-03 öncesi
  ayrıca bakılmalı.
- **Fiziksel silme adayı listelenmedi.** Bilinçli: silme V3-10'dur ve beş
  koşulu vardır.
- **Üretilen Türkçe içerikte çıplak `MVP` kelimesi hiç aranmadı.** Faz 0'ın
  taraması eski yaşam döngüsü SABİTLERİNİ (`MVP_DEFINED`, `mvpHint`,
  `mvpScope`, `ConceptSummary` alan adları) hedefledi. Bu yüzden envanter
  alan adlarını ve etiketleri yakaladı ama ürünün kullanıcının belgesine
  YAZDIĞI ve kullanıcıya SORDUĞU cümleleri kaçırdı — §4.1'deki yedi satır.
  Kaçanlar yakalananlardan daha görünürdü: biri sağlayıcısız ilk çalıştırma
  yolunun soru metni, biri plana yazılan kabul kriteri. **Yöntem dersi:**
  sabit adı aramak bir modelin kodda nerede yaşadığını bulur; o modelin
  ürünün AĞZINDAN çıkıp çıkmadığını bulmak için kelimenin kendisi, üretilen
  metinde aranmalıdır.

## Yöntem notu

Ajan çıktıları olduğu gibi alınmadı. Dört iddia örnekleyerek doğrulandı ve
ikisi düzeltildi: `mvpHint`'in kalıcı olmadığı (planın risk varsayımını
çürüttü) ve `task-compiler`'ın onu okumadığı (hem bayat bir kod yorumunu hem
de ona dayanan bir ajan çürütmesini düzeltti). Bu belgede bir iddia varsa,
ya doğrudan ölçülmüştür ya da ölçüm yöntemi yazılıdır.

---

## 9. V3-10 — Fiziksel silme hazırlık değerlendirmesi

**Ölçüm tarihi:** 2026-09-08 · **Commit:** `8d2007b`
**Sonuç: HAZIR DEĞİL.** Beş koşuldan **ikisi** sağlanıyor.

Bu bölüm silme yapmaz. Planın kendi tablosu bu paketi *"deletion readiness"*
diye adlandırıyor; çıktısı da budur.

### Koşul denetimi

| # | Koşul | Durum | Dayanak |
|---|---|---|---|
| 1 | Üretim giriş noktalarında sıfır legacy import | **SAĞLANDI** | `check:legacy-boundary`: 200 dosya, 599 kenar, 0 ihlal — üstelik artık kapı |
| 2 | Eski davranışların V4 parity karşılığı var | **SAĞLANMADI** | Üç modülün karşılığı yok: COMPAT-02, COMPAT-04, COMPAT-09 |
| 3 | Göç gidiş-dönüşü çalışıyor | **SAĞLANDI** | `migrations.js` yalnız `src/v4`'ten import ediyor; `v4-v5-migration.test.js` dört kalıcı konumu sabitliyor |
| 4 | Eski testlerin V4 eşdeğeri var | **SAĞLANMADI** | 21 uyumluluk test dosyası; koşul 2'deki davranışların V4 testi yok çünkü V4 uygulaması yok |
| 5 | En az bir sürüm boyunca sıfır kullanım | **SAĞLANMADI** | Hiç sürüm çıkmadı; gözlem penceresi yok |

### Yapısal bulgu — öksüz modül yok

Silinebilecek tek tek ölü dosya aramak sonuç vermez. Uyumluluk katmanı
**birbirine bağlı bir ağdır**. Ölçüldü: `state/project-state-v3.js` tek
başına dört uyumluluk kaynağı (`application/patch-transaction.js`,
`core/state/state-engine.js`, `core/v3-application-service.js`,
`state/state-migrations.js`) ve altı uyumluluk testi tarafından import
ediliyor.

Yani ya katman **bütün olarak** gider, ya hiçbiri. Aradaki her seçim, kalanı
kırık bırakır.

### Karşılığı olmayan üç davranış

Koşul 2'yi bloklayan bunlar:

- **COMPAT-02** `workflow/phases.js` — 10 durumlu `UNIVERSAL_PHASES`.
  Doğrudan karşılığı yok; kavramsal olarak `PlanningPhase → ProjectStage`
  zincirine devredildi ama birebir eşlenmedi.
- **COMPAT-04** `workflow/transitions.js` — geçiş tablosu modeli. V3'ün
  kapısı (`stageGate`) yapısal olarak farklı: tablo değil, concern ve onay
  denetimi. Drop-in karşılık değil.
- **COMPAT-09** `discovery/discovery-engine.js` — boşluk tespiti. V3 concern
  tabanlı çalışıyor; aynı işi yapan bir V4 modülü yok.

### Tek gerçekten izole aday — yine de silinmedi

`experiments/legacy-web-prototype/` kendi `index.html`'iyle duruyor ve
`src/` içinden hiçbir referans almıyor. Teknik olarak silinebilir.

Silinmedi çünkü: `docs/architecture/MODULE_STATUS.md:33` onu bilerek
`archive` olarak işaretlemiş, ve `tests/v4/product-contract.test.ts:39-40`
varlığını sabitliyor. Testin niyeti *"aktif çalışma alanında olmasın"* —
silmek niyeti fazlasıyla karşılar ama repo'nun bilinçli olarak sakladığı
tarihsel malzemeyi yok eder. Envanterin kendi kuralı burada da geçerli:
tarihsel kanıt yeniden yazılmaz, silinmez.

### V3-10'u ne açar

Sırayla, ve üçü de gerçek iş:

1. Koşul 2 için üç davranışın V4 karşılığını yaz — ya da her biri için
   "bu davranış bilerek taşınmadı" kararını gerekçesiyle kaydet.
2. Koşul 4 için o davranışların V4 testlerini yaz; uyumluluk testleri ancak
   o zaman kapsamsız kalmaz.
3. Koşul 5 için bir gözlem penceresi tanımla. "Bir sürüm" bu proje için
   anlamsız — yayın yok. Yerine ölçülebilir bir ölçüt konmalı, örneğin
   *"ürün gerçek bir fikirle uçtan uca N kez koşuldu ve uyumluluk katmanına
   hiç düşmedi"*.

Üçü bitmeden silme, kanıtı olmayan bir iddiadır.
