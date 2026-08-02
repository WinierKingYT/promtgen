# Fikir Geliştirme Akışı — Aşama 1: Turu Birleştirme

Status: Draft — kullanıcı onayı bekliyor
Date: 2026-08-02
Kapsam: Idea Studio "Fikir" ekranındaki konuşma turunun tek, tutarlı bir yüzeye indirilmesi.

## Bağlam

Kullanıcı, çalışan uygulamayı deneyerek ayrıntılı bir UX kritiği verdi (bkz. konuşma geçmişi). Özet puanlama:
görsel hiyerarşi 4/10, kullanım kolaylığı 3/10, fikir geliştirme metodolojisi 4/10, AI–kullanıcı iş birliği 4/10,
karar yönetimi 5/10, ürün dili 3/10. Kök neden kozmetik değil: ekran aynı anda sohbet, form doldurma, karar
yönetimi ve belge düzenleme deneyimlerini üst üste bindiriyor; kullanıcı her anda "burada benden ne bekleniyor"
sorusuna net cevap bulamıyor.

Kullanıcı kendi önerisiyle işi 4 aşamaya böldü:
1. **Akışı düzelt** (bu spec) — görsel tasarıma dokunmadan davranış/etkileşim düzeltmeleri.
2. UI'ı yeniden kur — kolon yapısı, sidebar→drawer, görsel tasarım.
3. Fikir geliştirme metodolojisini güçlendir — problem/kullanıcı/alternatif/değer/mvp-hipotez/varsayım/kanıt/
   başarı-ölçütü alanlarının sistemleştirilmesi, kalite kapıları.
4. Gerçek kullanıcı testi.

Bu belge yalnız **Aşama 1**'i kapsar.

Not: Oturumun başında repoda commit edilmemiş bir WIP bulundu (`idea-coach-service.ts`, `IdeaCoachFocus`,
tek-aktif-karar-kartı). Bu WIP, eleştirinin bir kısmını (yüzdelik skor, statik keşif kartları, dört-buton karar
kartları) kısmen zaten hedefliyordu ama yarım kaldı. Bu spec, o WIP'in üzerine inşa edilir; onu çöpe atmaz.

## Hedefler

- Her turda kullanıcının göreceği **tek bir "tur kartı"**: AI'nin kısa yanıtı + anladıklarının özeti + en fazla
  2 belirsizlik + tek bir sıradaki soru + en fazla 3 bağlamsal aksiyon.
- Tur başına **1 AI çağrısı** (bugün örtük olarak 2 çağrı oluyor — `discovery` + otomatikleşmiş
  `discovery-answer-extraction`).
- Bağlamsal aksiyonlar projenin gerçek eksiklerinden türer; artık adım başına sabit statik metin değildir.
- Kritik/ertelenebilir karar ayrımı uçtan uca tamamlanır (WIP'te sayaçlar var, kopyalanmış metin tamamlanacak).
- "AI çıkarımıyla karşılaştır" özelliği ve ona bağlı ikinci AI çağrısı tamamen kaldırılır.

## Kapsam dışı

- Görsel/layout yeniden tasarımı (renk, tipografi, kolon sayısı, sidebar→drawer) — Aşama 2.
- Yeni claim/confidence veri modeli, kalite kapıları (Gate 1-4), karar tipi çeşitlendirmesi (tekli/çoklu
  seçim/sıralama) — Aşama 3. Mevcut `SuggestionItem` ve `ConceptSummary` modelleri bu spec'te değişmiyor.
- Gerçek kullanıcı testi — Aşama 4.
- `idea-guide-service.ts` / "Fikir Özeti" ekranının yeniden yazımı — yalnız zaten yapılmış "canonical" dil
  temizliğinin ötesinde dokunulmuyor.

## Mimari

### Bulgular (mevcut kod)

- `src/v4/ai/registry.ts` — provider-agnostic, zod şemalı, `local-rule-engine` fallback destekli görev kaydı.
  Zaten `discovery` görevi bunu kullanıyor; yeni altyapı gerekmiyor.
- `src/v4/ai/tasks/discovery.ts` — her turda çalışan tek görev. Şema: `{reply, analysisNote, summary, options,
  openQuestions}`.
- `src/v4/ai/tasks/discovery-answer-extraction.ts` — yalnız "AI ile karşılaştır" tetiklendiğinde çalışan **ikinci**
  görev. `src/react/Workspace.tsx`'teki WIP, bunu checkbox'sız otomatik hale getirmiş (`shouldCompareWithAi`),
  yani bugün pratikte her turda sessizce 2. bir AI çağrısı oluyor. Bu spec bu görevi ve şemasını **kaldırır**.
- `src/v4/application/discovery-answer-service.ts` — `createDiscoveryAnswerDraft`: yerel, deterministik,
  revizyon-korumalı (`baseDocumentRevision`/`baseCanonicalRevision` eşleşmesi) alan çıkarım motoru. Çelişki,
  belirsizlik, ironi, çoklu-persona tespiti ve güven skorlaması içeriyor. **Değişmiyor** — bu spec'in
  "understood" kaynağı budur, AI şemasına taşınmaz.
- `src/v4/application/idea-coach-service.ts` (WIP) — `activeStep`'i yerel `readiness` kurallarından deterministik
  hesaplıyor; `IdeaEvidenceStatus` enum'u (`unknown|draft|confirmed|contradicted|decision-required`) zaten var.
  Bu spec'te `actionsFor(step)` statik fonksiyonu kaldırılıp yerine AI'nin `optionalPaths` alanı (offline'da yerel
  fallback listesiyle) geçer.

### Veri modeli değişikliği

`src/v4/ai/schemas/schemas.ts` — `discoverySchema` (promptVersion `2.1.0` → `2.2.0`):

```ts
export const discoverySchema = z.object({
  reply: ...,            // değişmiyor — AI'nin doğal dil yanıtı
  analysisNote: ...,     // değişmiyor ama artık ayrı <details> yerine acknowledgment'ın ikincil satırı
  summary: ...,           // değişmiyor
  options: [...],         // değişmiyor — karar kartlarının kaynağı
  openQuestions: [...],   // değişmiyor

  // YENİ:
  uncertainty: z.array(shortText).max(2).default([]),
  nextQuestionText: shortText,
  optionalPaths: z.array(z.object({
    title: shortText,
    reason: shortText,
    prompt: shortText
  }).strict()).max(3).default([])
}).strict();
```

Kaldırılanlar:
- `DISCOVERY_ANSWER_EXTRACTION_SCHEMA_ID`, `discoveryAnswerExtractionSchema`, `DiscoveryAnswerExtractionOutput`
  (`schemas.ts`)
- `src/v4/ai/tasks/discovery-answer-extraction.ts` (dosya)
- `discovery-answer-extraction` girdisi (`registry.ts` — `AITaskType`'tan çıkar)
- `generateDiscoveryAnswerExtractionService`, `DiscoveryAnswerExtractionOptions/Result`
  (`discovery-generation-service.ts`)
- `compareDiscoveryAnswerWithAI`, `DiscoveryAnswerComparison`, `DiscoveryAIExtraction`, `draft.comparison`
  (`discovery-answer-service.ts`) — `createDiscoveryAnswerDraft`/`applyDiscoveryAnswerDraft`/
  `updateDiscoveryAnswerPatch` **korunur**.
- `generateDiscoveryAnswerExtraction`, `shouldCompareWithAi` (`idea-planning-api.ts`, `Workspace.tsx`)

### Prompt değişikliği

`discoveryTask.buildPrompt` şu talimatları ekler: en fazla 2 gerçek belirsizlik bildir (yoksa boş dizi — icat
etme); `nextQuestionText`'i `PROJECT_CONTEXT.ideaCoach.activeStep` alanına göre üret (adım seçimi istemciden
gelir, AI değiştirmez); `optionalPaths`'ı projenin somut eksiklerine göre üret, jenerik ("fikri büyüt" gibi)
ifadelerden kaçın.

`discoveryTask.buildContext` PROJECT_CONTEXT'e `ideaCoach: { activeStep, activeStepLabel }` ekler (istemci
`buildIdeaCoachState`'ten hesaplanmış).

### Yerel kural motoru (fallback)

`fallbackPolicy: 'local-rule-engine'` zaten var; yerel üretici fonksiyon (planning-engine.js içindeki mevcut
fallback) `uncertainty: []`, `nextQuestionText` (mevcut `derivedQuestion()`'dan), `optionalPaths` (mevcut
`actionsFor(step)`'ten, artık yalnız offline fallback olarak) döner. Yani bugünkü statik metinler **silinmiyor**
— sadece "AI varsa öncelik AI'nin ürettiğinde, yoksa yerel statik listede" fallback'ine dönüşüyor.

### State/UI değişikliği

`src/v4/application/idea-coach-service.ts`:
- `IdeaCoachState`'e `uncertainty: string[]` ve turdan gelen `optionalPaths`'i taşıyan alan eklenir
  (AI/yerel kaynaklıdır, `buildIdeaCoachState` artık son AI turunu da parametre olarak alabilir).
- `actionsFor(step)` yerel statik fonksiyonu **fallback'e** indirilir (yalnız offline/hata durumunda kullanılır).

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx`:
- Yeni `IdeaCoachTurn` bileşeni: AI yanıtı + anladıklarım (mevcut `createDiscoveryAnswerDraft` patch'lerinden,
  temiz olanlar ön-seçili) + belirsizlik + tek soru + `optionalPaths` — hepsi tek `<article>` içinde.
- `IdeaCoachFocus` bu bileşenin içine taşınır (ayrı bileşen olarak kalmaz).

`src/react/components/DiscoveryAnswerReview.tsx`:
- `.comparison` bloğu ve karşılaştırma UI'ı kaldırılır.
- Varsayılan davranış: `assessment.warnings` boş ve `patch.confidence >= 70` olan patch'ler `accepted` ön-seçili
  gelir; kullanıcı yalnız uyarılı/düşük güvenli patch'lerle manuel karar verir. Tüm patch'ler otomatik kabulse
  panel tek bir "Bu haliyle kaydet" onayına indirgenir (dört buton kalmaz).
- Bu bileşen artık ayrı bir "mod" değil, `IdeaCoachTurn` kartının bir alt bölümüdür.

`src/react/Workspace.tsx`:
- `shouldCompareWithAi`, `generateDiscoveryAnswerExtraction` çağrısı kaldırılır — tur başına tek
  `runConversationalDiscoveryTurn` çağrısı kalır.
- Kritik/ertelenebilir karar kopyası (`showDecisionTurn` bloğu) mevcut sayaçlarla tamamlanır (metin zaten WIP'te
  var, doğrulanacak/gerekirse düzeltilecek).

## Hata yönetimi

- AI çağrısı başarısız olursa: mevcut `usedFallback` mekanizması aynen çalışır, yerel motor devreye girer —
  davranış değişmiyor.
- `applyDiscoveryAnswerDraft`'ın revizyon koruması (`baseDocumentRevision`/`baseCanonicalRevision` eşleşmesi)
  korunur — bu spec bu güvenliği zayıflatmaz.
- Şema doğrulaması (`zod .strict()`) `maxRepairAttempts: 1` ile aynı kalır; yeni alanlar (`uncertainty`,
  `nextQuestionText`, `optionalPaths`) `.default([])`/gerekli metin olarak tanımlanır ki repair olmadan da makul
  bir çıktı geçerli sayılsın.

## Test planı

- `tests/v4/idea-coach-service.test.ts` — `optionalPaths`/`uncertainty` taşıyan yeni state alanları için testler
  eklenir; mevcut deterministik `activeStep` testleri değişmeden geçmeli.
- `discoverySchema` için şema testi: yeni alanların `.strict()` ile birlikte eski `options`/`reply` davranışını
  bozmadığını doğrulayan birim test.
- `discovery-answer-extraction` task/schema testleri **silinir** (görev kaldırıldığı için).
- `discovery-answer-service.test.js` (varsa) — `createDiscoveryAnswerDraft`/`applyDiscoveryAnswerDraft`
  değişmediği için mevcut testler aynen geçmeli; `compareDiscoveryAnswerWithAI` testleri silinir.
- `tests/e2e/guided-workflow.spec.ts` — checkbox kaldırıldığı, tek tur kartı deseni geldiği için akış adımları
  güncellenir.
- `npm run test:v4` ve `npx tsc --noEmit` yeşil kalmalı.

## Riskler

- Prompt değişikliği modelin `optionalPaths`'ı yine jenerik üretmesi riskini tamamen ortadan kaldırmaz — bu,
  prompt mühendisliğiyle iyileştirilecek bir kalite konusu, bloklayıcı değil.
- `DiscoveryAnswerReview`'ın "otomatik ön-seçim" davranışı, kullanıcının fark etmeden yanlış bir alanı
  onaylamasına yol açabilir — bu yüzden ön-seçim yalnız `confidence >= 70 && !warnings.length` koşuluyla
  sınırlanıyor; düşük güvenli/çelişkili hiçbir şey otomatik kabul edilmiyor.
