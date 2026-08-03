# Idea Studio — Aşama 2a: Yerleşim ve CSS Mimarisi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idea Studio "Fikir" ekranını üç ince şeritli bir yerleşime taşımak (proje sidebar'ı → drawer, aşama
göstergesi → kendi sol şeridi, sağ panel → 6 içerik bloğu), MVP adımında tek soru yerine kısa kart ızgarası
göstermek, ve bunları destekleyen küçük bir CSS değişken katmanı eklemek.

**Architecture:** Tüm değişiklikler `src/react/styles.css` (tek global stylesheet, `.pg-` önekli kurallar),
`src/react/features/idea-studio/IdeaStudioPrimitives.tsx` (bileşenler) ve `src/react/Workspace.tsx`
(kompozisyon/state) içinde kalıyor. Yeni state/mantık `src/v4/application/idea-coach-service.ts`'e eklenir
(pure, `node:test` ile TDD edilebilir). Yeni build aracı veya bağımlılık yok.

**Tech Stack:** React + TypeScript, tek global CSS dosyası, `node:test` (birim), Playwright (`tests/e2e`).

## Global Constraints

- Görsel tasarım sistemi (renk/tipografi) bu plan kapsamında **değişmiyor** — Aşama 2b'ye bırakılıyor.
- `IdeaCoachState`/`buildIdeaCoachState`'in `activeStep` hesaplaması **değişmiyor** — yalnız ek, opsiyonel
  alanlar (`headline`, evidence'a `justUpdated`) eklenir; mevcut testler değişmeden geçmeli.
- CSS Modülleri/Tailwind gibi bir build değişikliği **yok** — tek `styles.css` korunur.
- Yalnız bu planın dokunduğu `.pg-` kuralları CSS değişkenlerine taşınır; ilgisiz kurallar toplu migrate
  edilmez.
- Her görevden sonra `npx tsc --noEmit` ve `node scripts/run-v4-tests.mjs` yeşil kalmalı.
- React bileşen birim test altyapısı yok (bkz. Aşama 1 notları) — davranış/DOM doğrulaması
  `tests/e2e/*.spec.ts` (Playwright, `npm run test:e2e`) ile yapılır.

---

### Task 1: `IdeaCoachState`'e `headline` ve evidence `justUpdated` ekle

**Files:**
- Modify: `src/v4/application/idea-coach-service.ts`
- Test: `tests/v4/idea-coach-service.test.ts`

**Interfaces:**
- Consumes: `project.ideaDocumentRevisions: IdeaDocumentRevision[]` (`src/v4/contracts.ts`, zaten var —
  `{id, number, documentRevision, canonicalRevision, createdAt, summary, source, status, convertedCanonicalRevision, restoredFromRevision, snapshot}`),
  `compareIdeaDocumentRevisions(project, fromId, toId)` (`src/v4/application/idea-document-revision-service.ts`,
  zaten var — döner `{valid, from, to, changes: Array<{field, label, before, after}>}` burada
  `field: keyof IdeaDocumentSnapshot = 'summary'|'targetUser'|'problemStatement'|'currentAlternative'|'desiredOutcome'|'confirmedFeatures'|'outOfScope'|'technicalApproaches'|'openQuestions'|'knownRisks'|'mvpTarget'`).
- Produces: `IdeaCoachState.headline: string`, `IdeaEvidenceField.justUpdated: boolean` — Task 3 bunları
  tüketir.

- [ ] **Step 1: Write the failing tests**

`tests/v4/idea-coach-service.test.ts` dosyasının en üstüne yeni import ekle (mevcut importların hemen
altına, `analyzeIdea` satırından sonra):

```ts
import { applyDiscoveryAnswerDraft, createDiscoveryAnswerDraft } from '../../src/v4/application/discovery-answer-service.js';
```

(Not: `createDiscoveryAnswerDraft` zaten import edilmiş olabilir — varsa tekrar eklemeden mevcut import
satırına `applyDiscoveryAnswerDraft`'ı ekle.)

Dosyanın sonuna (son test bloğundan sonra) şu iki testi ekle:

```ts
test('conceptSummary.summary doluysa IdeaCoachState.headline onu, boşsa adıma göre kısa bir yer tutucu döner', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.summary = '';
  const emptyState = buildIdeaCoachState(project);
  assert.equal(emptyState.headline, 'Henüz netleşmedi — birlikte şekillendiriyoruz.');

  summary.summary = 'Bireysel geliştiriciler için yerel-öncelikli bir fikir netleştirme aracı.';
  const filledState = buildIdeaCoachState(project);
  assert.equal(filledState.headline, 'Bireysel geliştiriciler için yerel-öncelikli bir fikir netleştirme aracı.');
});

test('son turda değişen alanlar evidence üzerinde justUpdated=true olarak işaretlenir', () => {
  let project = projectWithSummary();
  const beforeState = buildIdeaCoachState(project);
  assert.ok(beforeState.evidence.every(item => item.justUpdated === false), 'ilk sürümde hiçbir alan henüz güncellenmemiş olmalı');

  const draft = createDiscoveryAnswerDraft(project, {
    answer: 'Problem: Bireysel geliştiriciler projeye başlamadan önce kapsamı ve kararları netleştiremiyor.',
    focusedQuestion: 'Kullanıcının hangi somut durumda yaşadığı hangi problemi çözmek istiyorsun?'
  });
  assert.ok(draft);
  const accepted = { ...draft!, patches: draft!.patches.map(patch => ({ ...patch, status: 'accepted' as const })) };
  const result = applyDiscoveryAnswerDraft(project, accepted);
  assert.equal(result.success, true);
  if (!result.success) return;
  project = result.project;

  const afterState = buildIdeaCoachState(project);
  const problemField = afterState.evidence.find(item => item.id === 'problem')!;
  assert.equal(problemField.justUpdated, true);
  assert.ok(afterState.evidence.filter(item => item.id !== 'problem').every(item => item.justUpdated === false));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test tests/v4/idea-coach-service.test.ts`
Expected: FAIL — `headline`/`justUpdated` `undefined` (property yok), assertion hatası.

- [ ] **Step 3: Implement `headline`**

`src/v4/application/idea-coach-service.ts` içinde `IdeaCoachState` arayüzüne `headline` ekle (mevcut
`activeQuestion` satırının hemen altına):

```ts
export interface IdeaCoachState {
  activeStep: IdeaCoachStepId;
  activeStepLabel: string;
  activeQuestion: string;
  headline: string;
  steps: IdeaCoachStep[];
  evidence: IdeaEvidenceField[];
  actions: IdeaCoachAction[];
  uncertainty: string[];
  criticalDecisionCount: number;
  deferrableDecisionCount: number;
  readyForSummaryReview: boolean;
}
```

`STEP_LABELS` sabitinin altına yeni bir yardımcı fonksiyon ekle:

```ts
const DEFAULT_HEADLINE = 'Henüz netleşmedi — birlikte şekillendiriyoruz.';

function headlineFor(project: ProjectDocumentV5): string {
  const summary = text(project.ideaLabSession?.conceptSummary?.summary);
  return summary || DEFAULT_HEADLINE;
}
```

`buildIdeaCoachState`'in `return` ifadesine (`activeQuestion` satırının hemen altına) ekle:

```ts
    activeQuestion: turnFields.question || questionFor(activeStep, project),
    headline: headlineFor(project),
```

- [ ] **Step 4: Implement `justUpdated`**

`src/v4/application/idea-coach-service.ts`'in en üstüne, `ProjectDocumentV5` import satırına
`compareIdeaDocumentRevisions`'ı ekle:

```ts
import { compareIdeaDocumentRevisions } from './idea-document-revision-service.js';
```

`IdeaEvidenceField` arayüzüne `justUpdated` ekle:

```ts
export interface IdeaEvidenceField {
  id: IdeaCoachStepId;
  label: string;
  value: string;
  status: IdeaEvidenceStatus;
  statusLabel: string;
  detail: string;
  displayText: string;
  justUpdated: boolean;
}
```

`field()` fonksiyonunun imzasına `justUpdated` parametresi ekle:

```ts
function field(
  id: IdeaCoachStepId,
  label: string,
  value: string,
  status: IdeaEvidenceStatus,
  justUpdated: boolean
): IdeaEvidenceField {
  const copy = statusCopy(status);
  const displayText = value && status !== 'contradicted' ? value : copy.detail;
  return { id, label, value, status, ...copy, displayText, justUpdated };
}
```

`isCriticalDecision` fonksiyonunun üzerine yeni bir yardımcı ekle — son iki `ideaDocumentRevisions`
girdisini karşılaştırıp hangi `IdeaCoachStepId`'lerin değiştiğini döner:

```ts
const SNAPSHOT_FIELD_TO_STEP: Partial<Record<string, IdeaCoachStepId>> = {
  problemStatement: 'problem',
  targetUser: 'user',
  currentAlternative: 'value',
  desiredOutcome: 'value',
  mvpTarget: 'mvp',
  confirmedFeatures: 'mvp',
  outOfScope: 'mvp',
  knownRisks: 'risks'
};

function justUpdatedSteps(project: ProjectDocumentV5): Set<IdeaCoachStepId> {
  const revisions = project.ideaDocumentRevisions || [];
  const current = revisions.find(revision => revision.status === 'draft');
  if (!current) return new Set();
  const previous = [...revisions]
    .filter(revision => revision.number < current.number)
    .sort((left, right) => right.number - left.number)[0];
  if (!previous) return new Set();
  const comparison = compareIdeaDocumentRevisions(project, previous.id, current.id);
  if (!comparison.valid) return new Set();
  const steps = new Set<IdeaCoachStepId>();
  for (const change of comparison.changes) {
    const step = SNAPSHOT_FIELD_TO_STEP[change.field];
    if (step) steps.add(step);
  }
  return steps;
}
```

`buildIdeaCoachState`'in `evidence` dizisini hesapladığı yeri güncelle — önce `justUpdatedSteps`'i bir kere
hesapla, sonra her `field()` çağrısına ilgili adımın üye olup olmadığını geç:

```ts
  const justUpdated = justUpdatedSteps(project);

  const evidence = [
    field('problem', 'Temel problem', text(summary?.problemStatement), statusFor({ exists: problemReady, confirmed, contradicted: contradiction.problem }), justUpdated.has('problem')),
    field('user', 'Hedef kullanıcı', text(summary?.targetUser), statusFor({ exists: userReady, confirmed, contradicted: contradiction.user }), justUpdated.has('user')),
    field('value', 'Ana değer', text(summary?.desiredOutcome || project.identity.desiredOutcome), statusFor({ exists: alternativeReady && outcomeReady, confirmed, contradicted: contradiction.value }), justUpdated.has('value')),
    field('mvp', 'MVP hipotezi', text(summary?.mvpTarget), statusFor({ exists: mvpReady, confirmed, contradicted: contradiction.mvp }), justUpdated.has('mvp')),
    field('risks', 'Kritik risk', text(summary?.knownRisks?.[0]), statusFor({ exists: risksReady, confirmed, contradicted: contradiction.risks, optional: true }), justUpdated.has('risks'))
  ];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test tests/v4/idea-coach-service.test.ts`
Expected: PASS — tüm testler (yeni 2 test dahil) yeşil.

- [ ] **Step 6: Run full suite and typecheck**

Run: `node scripts/run-v4-tests.mjs && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/v4/application/idea-coach-service.ts tests/v4/idea-coach-service.test.ts
git commit -m "feat(v4): idea coach state'e headline ve justUpdated alanlarını ekle"
```

---

### Task 2: Yerleşim — sidebar → drawer (her genişlikte), üç kolonlu grid, aşama şeridi

**Files:**
- Modify: `src/react/styles.css`
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx`
- Modify: `src/react/Workspace.tsx`
- Test: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: `IdeaCoachState.steps` (zaten var, değişmiyor).
- Produces: Yeni `IdeaCoachStageStrip({ steps }: { steps: IdeaCoachStep[] })` bileşeni
  (`IdeaStudioPrimitives.tsx`) — Task 3+ bunu değiştirmez, yalnız `Workspace.tsx` render eder.

- [ ] **Step 1: CSS — spacing/kırılma token'larını `:root`'a ekle**

`src/react/styles.css:605-626` içindeki `:root` bloğuna (`--pg-sidebar:236px;` satırının altına) ekle:

```css
  --pg-space-1:4px;
  --pg-space-2:8px;
  --pg-space-3:12px;
  --pg-space-4:16px;
  --pg-space-5:24px;
  --pg-stage-strip:110px;
  --pg-panel-width:310px;
```

`styles.css:708` içindeki `@media (max-width:1100px) { :root { --pg-sidebar:210px; } ... }` bloğuna
`--pg-panel-width:270px;` ekle (mevcut `.pg-idea-workspace { grid-template-columns:minmax(0,1fr) 270px; }`
satırındaki `270px`'in kaynağı — bu satırı `var(--pg-panel-width)` kullanacak şekilde güncelleyeceğiz, bkz.
Step 3).

**Not (spec sapması):** Onaylanan tasarım dokümanı dar ekranda sağ paneli de kapanabilir bir çekmeceye
dönüştürmeyi öneriyordu. Bu plan bunun yerine mevcut, zaten kanıtlanmış "tek kolona yığılma" desenini
(`.pg-idea-workspace { grid-template-columns:1fr; }`, satır 718) üç kolona genişletiyor — sağ panel dar
ekranda ayrı bir drawer state'i olmadan, sohbetin altına yığılıyor. Gerekçe: üçüncü bir açılır/kapanır panel
(yeni state + toggle buton + CSS drawer mekaniği) mevcut sidebar-drawer'ın neredeyse birebir tekrarı
olacaktı, YAGNI. Kullanıcı manuel duman testinde (Task 7 Step 3) bunu yetersiz bulursa, `.pg-sidebar`'daki
`is-open`/`translateX` deseni `.pg-idea-map`'e aynı şekilde uygulanabilir — ayrı bir küçük görev olarak.

- [ ] **Step 2: CSS — proje sidebar'ını her genişlikte drawer yap**

`src/react/styles.css:671` satırını değiştir:

```css
.pg-studio-shell { display:grid;grid-template-columns:minmax(0,1fr); }
```

(Eskiden: `.pg-studio-shell { display:grid;grid-template-columns:var(--pg-sidebar) minmax(0,1fr); }` —
sidebar artık grid kolonu değil, `position:fixed` overlay.)

`styles.css:672` satırını değiştir (mevcut `.pg-sidebar` temel kuralına `position:fixed` ve kapalı durumu
ekle):

```css
.pg-sidebar { width:min(290px,86vw);min-height:100dvh;display:flex;flex-direction:column;padding:18px 11px;border-right:1px solid var(--pg-border);background:#f0f1ee;position:fixed;inset:0 auto 0 0;transform:translateX(-105%);box-shadow:24px 0 70px rgba(20,30,24,.22);transition:transform .2s ease;z-index:60; }
.pg-sidebar.is-open { transform:translateX(0); }
```

`styles.css:673` satırını değiştir (scrim artık her genişlikte görünür olabilir):

```css
.pg-sidebar-scrim { display:none;position:fixed;inset:0;z-index:50;border:0;background:rgba(17,24,20,.42); }
```

Not: `.pg-sidebar-scrim` yalnız `IdeaStudioSidebar`'ın `open && <button className="pg-sidebar-scrim">`
koşuluyla zaten DOM'a giriyor (bkz. `IdeaStudioPrimitives.tsx:54`); `display:none` varsayılanı yalnız CSS
güvenliği için, pratikte hep `open=true` iken render ediliyor. `display:block` yap:

```css
.pg-sidebar-scrim { display:block;position:fixed;inset:0;z-index:50;border:0;background:rgba(17,24,20,.42); }
```

`styles.css:680` içindeki satırda `.pg-mobile-menu { display:none; }` parçasını kaldır — `.pg-back-button`
tanımı aynı kalsın, yalnız `.pg-mobile-menu`'nün `display:none`'ını sil:

Eski: `...border-radius:9px;background:white;color:var(--pg-muted); }.pg-mobile-menu { display:none; }`
Yeni: `...border-radius:9px;background:white;color:var(--pg-muted); }`

`styles.css:712-717` içindeki `@media (max-width:860px)` bloğundan artık taban kurala taşınan satırları
kaldır (`.pg-onboarding-shell,.pg-studio-shell { grid-template-columns:1fr; }` satırı `.pg-studio-shell`
kısmını kaybediyor çünkü zaten taban kuralda `1fr`; `.pg-sidebar`/`.pg-sidebar-scrim`/`.pg-mobile-menu`
satırları tamamen kaldırılıyor çünkü taban kurala taşındı):

```css
@media (max-width:860px) {
  .pg-onboarding-shell { grid-template-columns:1fr; }
  .pg-onboarding-sidebar { min-height:auto;border-right:0;border-bottom:1px solid var(--pg-border);padding:14px 16px; }.pg-onboarding-sidebar .pg-onboarding-projects,.pg-onboarding-sidebar .pg-onboarding-settings,.pg-onboarding-sidebar .pg-sidebar-new { display:none; }.pg-onboarding-brand { padding:0; }
  .pg-studio-header { grid-template-columns:minmax(120px,1fr) auto; }.pg-view-tabs { order:3;grid-column:1/-1;justify-self:center; }.pg-history-button { grid-column:2;grid-row:1; }
  .pg-idea-workspace { grid-template-columns:1fr; }.pg-conversation-column { border-right:0; }.pg-idea-map { border-top:1px solid var(--pg-border); }
  .pg-plan-layout { grid-template-columns:1fr; }.pg-section-nav { display:flex;overflow:auto; }.pg-section-nav>div { flex:0 0 auto;gap:8px; }.pg-section-nav>button { width:auto;min-width:150px;flex:0 0 auto; }
}
```

(`.pg-idea-workspace`'in üç kolonu bu breakpoint altında tek kolona iner — Step 3'te üç kolonlu hale
getirdiğimiz kural burada hâlâ `1fr`'e düşüyor, bu doğru/istenen davranış.)

- [ ] **Step 3: CSS — `.pg-idea-workspace`'i üç kolona çıkar, sol şerit ve sağ panel için token kullan**

`src/react/styles.css:683` satırını değiştir:

```css
.pg-idea-workspace { min-height:calc(100dvh - 64px);display:grid;grid-template-columns:var(--pg-stage-strip) minmax(0,1fr) var(--pg-panel-width); }
```

`styles.css:1100px` medya bloğundaki (Step 1'de düzenlediğimiz) satırı güncelle:

```css
  .pg-idea-workspace { grid-template-columns:var(--pg-stage-strip) minmax(0,1fr) var(--pg-panel-width); }
```

(`--pg-panel-width` bu breakpoint'te `270px`'e düşüyor çünkü Step 1'de `:root` override'ına eklendi;
`--pg-stage-strip` aynı kalıyor.)

`styles.css:685` içindeki `.pg-thread { ...gap:24px... }` kısmını `gap:var(--pg-space-5)` yap (24px =
`--pg-space-5`), satırın geri kalanı aynı kalsın.

- [ ] **Step 4: CSS — aşama şeridini `.pg-idea-map`'ten çıkar, yeni `.pg-stage-strip` kuralı ekle**

`src/react/styles.css:696` satırındaki `.pg-idea-map { ... }` kuralının İÇİNDEN `.pg-coach-steps` ile
ilgili tüm alt-kuralları (`.pg-coach-steps { ... } .pg-coach-steps li { ... } .pg-coach-steps i { ... }
.pg-coach-steps li.is-active { ... } .pg-coach-steps li.is-active i { ... } .pg-coach-steps li.is-complete
{ ... } .pg-coach-steps li.is-complete i { ... }`) SİL. `.pg-idea-map`'in geri kalanı (`.pg-map-head`,
`.pg-map-fields`, `.pg-scope-snapshot`, `.pg-map-note`) aynı satırda kalsın.

Aynı satırın hemen üstüne (696'dan önce), yeni bir kural ekle:

```css
.pg-stage-strip { min-width:0;padding:32px 14px;border-right:1px solid var(--pg-border);background:var(--pg-surface); }
.pg-coach-steps { display:grid;gap:7px;padding:0;list-style:none; }.pg-coach-steps li { display:flex;align-items:center;gap:8px;color:var(--pg-faint);font-size:9px; }.pg-coach-steps i { width:7px;height:7px;flex:0 0 auto;border:1px solid #bfc5c1;border-radius:50%;background:transparent; }.pg-coach-steps li.is-active { color:var(--pg-text);font-weight:750; }.pg-coach-steps li.is-active i { border-color:var(--pg-accent);background:var(--pg-accent);box-shadow:0 0 0 3px var(--pg-accent-soft); }.pg-coach-steps li.is-complete { color:var(--pg-success); }.pg-coach-steps li.is-complete i { border-color:var(--pg-success);background:var(--pg-success); }
```

Dar ekranda (`@media max-width:860px`, Step 2'de düzenlenen blok) `.pg-stage-strip`'i yatay ince bir çubuğa
çevir — aynı medya bloğuna ekle:

```css
  .pg-stage-strip { border-right:0;border-bottom:1px solid var(--pg-border);padding:10px 14px; }.pg-stage-strip .pg-coach-steps { grid-auto-flow:column;grid-template-columns:repeat(5,1fr);gap:4px; }.pg-stage-strip .pg-coach-steps li { flex-direction:column;gap:3px;font-size:7px;text-align:center; }
```

- [ ] **Step 5: `IdeaCoachStageStrip` bileşenini ekle, `IdeaSnapshot`'tan aşama listesini çıkar**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx` içinde `IdeaSnapshot` fonksiyonunun (satır
113-135) hemen üstüne yeni bir bileşen ekle:

```ts
export function IdeaCoachStageStrip({ steps }: { steps: IdeaCoachStep[] }) {
  return <aside className="pg-stage-strip" aria-label="Fikir geliştirme aşamaları">
    <ol className="pg-coach-steps">
      {steps.map(step => <li key={step.id} className={`is-${step.state}`}><i/>{step.label}</li>)}
    </ol>
  </aside>;
}
```

`IdeaCoachState`'in `steps: IdeaCoachStep[]` alanını import etmek için, dosyanın üstündeki
`import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';` satırını şu şekilde
genişlet:

```ts
import type { IdeaCoachState, IdeaCoachStep } from '../../../v4/application/idea-coach-service.js';
```

(`IdeaCoachStep` zaten `idea-coach-service.ts`'te export edilmiş bir arayüz — satır 6-10.)

`IdeaSnapshot` fonksiyonunun içinden aşama listesi render'ını (satır 120-122) SİL:

```ts
    <ol className="pg-coach-steps" aria-label="Fikir geliştirme aşamaları">
      {coach.steps.map(step => <li key={step.id} className={`is-${step.state}`}><i/>{step.label}</li>)}
    </ol>
```

- [ ] **Step 6: `Workspace.tsx` — üç kolonu render et**

`src/react/Workspace.tsx`'in importlar bölümündeki (satır 50-56) `IdeaCoachTurn, IdeaSnapshot,
IdeaStudioHeader, IdeaStudioSidebar` listesine `IdeaCoachStageStrip` ekle:

```ts
import {
  IdeaCoachStageStrip,
  IdeaCoachTurn,
  IdeaSnapshot,
  IdeaStudioHeader,
  IdeaStudioSidebar,
  type IdeaStudioView
} from './features/idea-studio/IdeaStudioPrimitives.js';
```

`{view === 'develop' && <main ... className="pg-idea-workspace" ...>` bloğunun içine (`<section
className="pg-conversation-column" ...>` satırının hemen üstüne) ekle:

```tsx
        <IdeaCoachStageStrip steps={coach.steps}/>
```

- [ ] **Step 7: e2e testleri güncelle**

`tests/e2e/guided-workflow.spec.ts` içindeki `'opens a conversation-first studio and preserves it across
reload'` testine (satır 32-43), `.pg-idea-map` görünürlük assertion'ından (satır 36) sonra yeni bir satır
ekle:

```ts
    await expect(page.getByRole('complementary', { name: 'Fikir geliştirme aşamaları' })).toBeVisible();
```

Aynı dosyada, `'settings open from the real studio sidebar and restore focus'` testinin (satır 150-158)
başına, `startIdea(page)` çağrısından hemen sonra, sidebar'ın artık masaüstünde de varsayılan kapalı
olduğunu doğrulayan bir kontrol ekle:

```ts
    await expect(page.locator('.pg-sidebar')).not.toHaveClass(/is-open/);
    await page.getByRole('button', { name: 'Projeleri aç' }).click();
    await expect(page.locator('.pg-sidebar')).toHaveClass(/is-open/);
```

(Bu satırları `const trigger = page.getByRole('button', { name: 'Ayarlar', exact: true });` satırından
önce ekle — Ayarlar butonu artık açık sidebar içinde olduğu için önce sidebar'ı açmak gerekiyor.)

- [ ] **Step 8: Doğrula**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build && npx playwright test tests/e2e/guided-workflow.spec.ts`
Expected: tüm testler PASS.

Manuel doğrulama (dev server, `npm run dev`): Idea Studio'yu aç, masaüstü genişlikte proje sidebar'ının
görünmediğini, üstteki menü ikonuna tıklayınca açıldığını, sol tarafta ince bir aşama şeridinin (Problem/
Kullanıcı/Değer/MVP/Onay) her zaman göründüğünü, sağ panelde artık aşama listesinin OLMADIĞINI doğrula.

- [ ] **Step 9: Commit**

```bash
git add src/react/styles.css src/react/features/idea-studio/IdeaStudioPrimitives.tsx src/react/Workspace.tsx tests/e2e/guided-workflow.spec.ts
git commit -m "feat(react): idea studio üç şeritli yerleşime geçsin (sidebar->drawer, aşama şeridi ayrıldı)"
```

---

### Task 3: Sağ panel — başlık, son-değişen vurgusu, genişletilmiş kapsam sayaçları

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx`
- Modify: `src/react/styles.css`
- Test: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: `IdeaCoachState.headline` ve `IdeaEvidenceField.justUpdated` (Task 1), `ConceptSummary.confirmedFeatures`/`outOfScope` (zaten var).

- [ ] **Step 1: `IdeaSnapshot`'a başlık render'ı ekle**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx` içinde `IdeaSnapshot`'ın `.pg-map-head` bloğunun
(satır 116-119) hemen altına ekle:

```tsx
    <p className="pg-map-headline">{coach.headline}</p>
```

- [ ] **Step 2: Alan durumlarına `is-just-updated` sınıfı ekle**

`IdeaSnapshot` içindeki `.pg-map-fields` render'ını (mevcut satır ~124-127) güncelle:

```tsx
      {coach.evidence.map(item => <section key={item.id} className={`is-${item.status} ${item.justUpdated ? 'is-just-updated' : ''}`}>
        <span>{item.label}<b>{item.statusLabel}</b></span>
        <p>{item.displayText}</p>
      </section>)}
```

- [ ] **Step 3: Kapsam sayaçlarına MVP içi/dışı özellik sayısını ekle**

`IdeaSnapshot` içindeki `.pg-scope-snapshot` render'ını (mevcut satır ~129-132) güncelle:

```tsx
    <section className="pg-scope-snapshot">
      <div><span>Kritik karar</span><b>{coach.criticalDecisionCount}</b></div>
      <div><span>Ertelenebilir</span><b>{coach.deferrableDecisionCount}</b></div>
      <div><span>MVP içinde</span><b>{project.ideaLabSession?.conceptSummary?.confirmedFeatures.length ?? 0}</b></div>
      <div><span>MVP dışında</span><b>{project.ideaLabSession?.conceptSummary?.outOfScope.length ?? 0}</b></div>
    </section>
```

- [ ] **Step 4: CSS — başlık ve vurgu stilleri**

`src/react/styles.css:696` içindeki `.pg-idea-map { ... }` kuralına (satır sonuna, `.pg-map-note`
tanımından hemen önce) ekle:

```css
.pg-map-headline { margin:14px 0 0;color:var(--pg-text);font-size:13px;font-weight:650;line-height:1.4; }
```

`.pg-scope-snapshot` kuralını 2 kolon yerine 4 hücreyi 2x2 göstermeye devam edecek şekilde bırak (mevcut
`grid-template-columns:repeat(2,1fr)` zaten 4 öğeyi 2x2 gösterir, değişiklik gerekmiyor).

`.pg-map-fields section` kuralının hemen altına ekle (aynı satır içinde, `.pg-map-fields
section.is-confirmed { ... }` tanımından sonra):

```css
.pg-map-fields section.is-just-updated { animation:pg-field-flash 2.4s ease-out 1; }
@keyframes pg-field-flash { 0% { background:var(--pg-accent-soft);border-color:var(--pg-accent); } 100% { background:transparent; } }
```

- [ ] **Step 5: e2e test ekle**

`tests/e2e/guided-workflow.spec.ts` içindeki `'the single contextual action runs a real discovery turn and
keeps one active question'` testinin (satır 45-56) sonuna ekle:

```ts
    await expect(page.locator('.pg-map-headline')).toBeVisible();
```

- [ ] **Step 6: Doğrula**

Run: `npx tsc --noEmit && npm run build && npx playwright test tests/e2e/guided-workflow.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/react/features/idea-studio/IdeaStudioPrimitives.tsx src/react/styles.css tests/e2e/guided-workflow.spec.ts
git commit -m "feat(react): sağ panele başlık, son-değişen vurgusu ve genişletilmiş sayaçlar eklendi"
```

---

### Task 4: Sağ panel — bağlama duyarlı CTA

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx`
- Modify: `src/react/Workspace.tsx`
- Modify: `src/react/styles.css`
- Test: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: `IdeaCoachState.readyForSummaryReview` (zaten var, değişmiyor).
- Produces: `IdeaSnapshot`'a yeni `onOpenGuide: () => void` prop.

- [ ] **Step 1: `IdeaSnapshot`'a CTA prop'u ve render'ı ekle**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx` içinde `IdeaSnapshot`'ın imzasını (satır 113)
güncelle:

```ts
export function IdeaSnapshot({ project, coach, onOpenGuide }: {
  project: ProjectDocumentV5;
  coach: IdeaCoachState;
  onOpenGuide: () => void;
}) {
```

`.pg-map-note` satırının (mevcut son satır, ~133) hemen üstüne ekle:

```tsx
    <button
      type="button"
      className="pg-map-cta"
      disabled={!coach.readyForSummaryReview}
      onClick={onOpenGuide}
    >
      {coach.readyForSummaryReview ? 'Fikir Özetini incele →' : 'Plana geçmek için daha fazla netlik gerekli'}
    </button>
```

- [ ] **Step 2: `Workspace.tsx` — `onOpenGuide` bağla**

`src/react/Workspace.tsx` içindeki `<IdeaSnapshot project={project} coach={coach}/>` satırını (mevcut
~344) güncelle:

```tsx
        <IdeaSnapshot project={project} coach={coach} onOpenGuide={() => setView('guide')}/>
```

- [ ] **Step 3: CSS**

`src/react/styles.css:696` içindeki `.pg-idea-map { ... }` kuralına ekle (`.pg-scope-snapshot` tanımından
sonra, `.pg-map-note`'tan önce):

```css
.pg-map-cta { width:100%;min-height:42px;margin-top:14px;border:0;border-radius:11px;padding:10px 12px;background:var(--pg-surface-soft);color:var(--pg-faint);font-size:10px;font-weight:700; }
.pg-map-cta:not(:disabled) { background:var(--pg-accent);color:white; }
.pg-map-cta:disabled { cursor:default; }
```

- [ ] **Step 4: e2e test ekle**

`tests/e2e/guided-workflow.spec.ts` içindeki `'guide and plan are separate, approval-gated destinations'`
testinin (satır 99-115) başına, `await startIdea(page);` satırından hemen sonra ekle:

```ts
    await expect(page.getByRole('button', { name: 'Plana geçmek için daha fazla netlik gerekli' })).toBeDisabled();
```

- [ ] **Step 5: Doğrula**

Run: `npx tsc --noEmit && npm run build && npx playwright test tests/e2e/guided-workflow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/react/features/idea-studio/IdeaStudioPrimitives.tsx src/react/Workspace.tsx src/react/styles.css tests/e2e/guided-workflow.spec.ts
git commit -m "feat(react): sağ panele bağlama duyarlı plana-geç CTA'sı eklendi"
```

---

### Task 5: Sağ panel — mini geçmiş

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx`
- Modify: `src/react/Workspace.tsx`
- Modify: `src/react/styles.css`
- Test: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: `project.ideaDocumentRevisions` (zaten var), `restoreIdeaDocumentRevision(project, revisionId)`
  (`src/v4/application/idea-document-revision-service.js`, zaten var, döner
  `{success, project, reason?, canonicalPlanUnchanged?}`).
- Produces: `IdeaSnapshot`'a yeni `onRestore: (project: ProjectDocumentV5, message: string) => void` prop.

- [ ] **Step 1: `IdeaSnapshot`'a mini geçmiş render'ı ekle**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx`'in üstündeki importlara ekle:

```ts
import { restoreIdeaDocumentRevision } from '../../../v4/application/idea-document-revision-service.js';
```

`IdeaSnapshot`'ın imzasını (Task 4'te güncellenmiş haliyle) genişlet:

```ts
export function IdeaSnapshot({ project, coach, onOpenGuide, onRestore }: {
  project: ProjectDocumentV5;
  coach: IdeaCoachState;
  onOpenGuide: () => void;
  onRestore: (project: ProjectDocumentV5, message: string) => void;
}) {
  const recentRevisions = [...(project.ideaDocumentRevisions || [])]
    .sort((left, right) => right.number - left.number)
    .slice(0, 3);
  const undoTarget = recentRevisions[1];
```

`.pg-map-cta` butonunun (Task 4) hemen altına, `.pg-map-note`'tan önce ekle:

```tsx
    {recentRevisions.length > 1 && <section className="pg-map-history" aria-label="Son değişiklikler">
      <span>Son değişiklikler</span>
      <ul>
        {recentRevisions.map(revision => <li key={revision.id}>
          <b>r{revision.number}</b> {revision.summary}
        </li>)}
      </ul>
      {undoTarget && <button type="button" onClick={() => {
        const result = restoreIdeaDocumentRevision(project, undoTarget.id);
        if (result.success) onRestore(result.project, `Fikir belgesi r${undoTarget.number} sürümüne geri alındı.`);
      }}>Son değişikliği geri al</button>}
    </section>}
```

- [ ] **Step 2: `Workspace.tsx` — `onRestore` bağla**

`src/react/Workspace.tsx`'teki `<IdeaSnapshot .../>` satırını (Task 4'te güncellenmiş haliyle) genişlet:

```tsx
        <IdeaSnapshot
          project={project}
          coach={coach}
          onOpenGuide={() => setView('guide')}
          onRestore={(next, message) => commit(next, message, 'RestoreIdeaDocumentRevision')}
        />
```

- [ ] **Step 3: CSS**

`src/react/styles.css:696` içindeki `.pg-idea-map { ... }` kuralına ekle (`.pg-map-cta` tanımından sonra,
`.pg-map-note`'tan önce):

```css
.pg-map-history { margin-top:14px;padding-top:12px;border-top:1px solid var(--pg-border); }
.pg-map-history>span { color:var(--pg-faint);font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase; }
.pg-map-history ul { display:grid;gap:4px;margin:8px 0 0;padding:0;list-style:none; }
.pg-map-history li { color:var(--pg-muted);font-size:9px;line-height:1.4; }
.pg-map-history li b { color:var(--pg-text); }
.pg-map-history>button { min-height:32px;margin-top:8px;border:1px solid var(--pg-border);border-radius:9px;padding:6px 10px;background:white;color:var(--pg-muted);font-size:9px; }
```

- [ ] **Step 4: e2e test ekle**

`tests/e2e/guided-workflow.spec.ts` içindeki `'one explicit choice can be committed while lower-priority
proposals are deferred'` testinin (satır 58-69) sonuna ekle:

```ts
    await expect(page.locator('.pg-map-history li').first()).toBeVisible();
```

- [ ] **Step 5: Doğrula**

Run: `npx tsc --noEmit && npm run build && npx playwright test tests/e2e/guided-workflow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/react/features/idea-studio/IdeaStudioPrimitives.tsx src/react/Workspace.tsx src/react/styles.css tests/e2e/guided-workflow.spec.ts
git commit -m "feat(react): sağ panele mini fikir belgesi geçmişi ve geri al eklendi"
```

---

### Task 6: MVP adımı — kısa kart ızgarası

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx`
- Modify: `src/react/styles.css`
- Test: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: `IdeaCoachState.activeStep`, `IdeaCoachState.actions` (zaten var, değişmiyor).
- Produces: Yeni `IdeaMvpExplorationGrid({ actions, disabled, onChoose }: {...})` bileşeni.

- [ ] **Step 1: `IdeaMvpExplorationGrid` bileşenini ekle**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx` içinde `IdeaCoachFocus` fonksiyonunun (satır
137-155) hemen altına ekle:

```tsx
export function IdeaMvpExplorationGrid({ actions, disabled, onChoose }: {
  actions: IdeaCoachAction[];
  disabled: boolean;
  onChoose: (prompt: string) => void;
}) {
  return <section className="pg-mvp-grid" aria-labelledby="pg-mvp-grid-title">
    <h2 id="pg-mvp-grid-title">MVP'yi birlikte şekillendirelim</h2>
    <div className="pg-mvp-grid-cards">
      {actions.map(action => <button type="button" disabled={disabled} key={action.id} onClick={() => onChoose(action.prompt)}>
        <b>{action.title}</b>
        <span>{action.reason}</span>
      </button>)}
    </div>
  </section>;
}
```

`IdeaCoachAction` tipini import etmek gerekmiyor çünkü zaten aynı dosyada tanımlı değil — kontrol et: dosya
üstündeki `import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';` satırını
genişlet (Task 2'de `IdeaCoachStep` eklenmişti, şimdi `IdeaCoachAction`'ı da ekle):

```ts
import type { IdeaCoachAction, IdeaCoachState, IdeaCoachStep } from '../../../v4/application/idea-coach-service.js';
```

- [ ] **Step 2: `IdeaCoachTurn` içinde MVP adımında ızgarayı göster**

`IdeaCoachTurn` fonksiyonunun (satır 187-226) `return` ifadesindeki üç-yollu render mantığını güncelle.
Mevcut:

```tsx
    {showDecisionTurn
      ? <IdeaDecisionCards items={pendingItems} onStatus={onStatus}/>
      : <IdeaCoachFocus coach={coach} disabled={disabled} onChoose={onChoose}/>}
```

Yeni:

```tsx
    {coach.activeStep === 'mvp'
      ? <IdeaMvpExplorationGrid actions={coach.actions} disabled={disabled} onChoose={onChoose}/>
      : showDecisionTurn
        ? <IdeaDecisionCards items={pendingItems} onStatus={onStatus}/>
        : <IdeaCoachFocus coach={coach} disabled={disabled} onChoose={onChoose}/>}
```

- [ ] **Step 3: CSS**

`src/react/styles.css:691` içindeki `.pg-coach-focus { ... }` kuralının hemen altına ekle:

```css
.pg-mvp-grid { display:grid;gap:14px;margin-left:42px; }.pg-mvp-grid h2 { max-width:620px;margin:0;color:var(--pg-text);font-size:18px;line-height:1.28;letter-spacing:-.025em; }.pg-mvp-grid-cards { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }.pg-mvp-grid-cards button { display:grid;gap:4px;text-align:left;border:1px solid rgba(91,66,214,.16);border-radius:12px;padding:11px 12px;background:rgba(255,255,255,.8);color:var(--pg-muted); }.pg-mvp-grid-cards button:hover:not(:disabled) { border-color:#aa9ee9;background:white;color:var(--pg-accent); }.pg-mvp-grid-cards button b { color:var(--pg-text);font-size:11px; }.pg-mvp-grid-cards button span { font-size:9px;line-height:1.4; }
```

`styles.css:723` içindeki `@media (max-width:600px)` bloğuna, `.pg-coach-actions { grid-template-columns:1fr; }`
satırının hemen sonuna ekle: `.pg-mvp-grid-cards { grid-template-columns:1fr; }`

- [ ] **Step 4: e2e test ekle**

`tests/e2e/guided-workflow.spec.ts`'e yeni bir test ekle (dosyanın sonuna, son `test(...)` bloğundan önce,
`});` ile biten `test.describe` kapanışından önce):

```ts
  test('MVP adımına gelindiğinde tek soru yerine kısa kart ızgarası gösterilir', async ({ page }) => {
    await startIdea(page);
    await page.locator('.pg-coach-actions button').first().click();
    const card = page.locator('.pg-decision-card');
    await card.getByRole('button', { name: 'Bu yönden ilerle', exact: true }).click();
    await page.getByRole('button', { name: /Seçtiğim yönü fikre işle/ }).click();
    await expect(page.locator('.pg-mvp-grid, .pg-coach-focus, .pg-decision-deck')).toBeVisible();
  });
```

(Not: bu test, akışın gerçekte hangi adıma ilerlediğine bağlı olarak `.pg-mvp-grid`'e her zaman
ulaşamayabilir — deterministik olarak `mvp` adımına getirmek, önceki adımların hepsinin
`meaningful()`/`readiness` eşiklerini geçmesini gerektiriyor. Test yalnız "üç olası panelden biri görünür,
akış kilitlenmiyor" diye zayıf bir kontrol yapıyor; gerçek `mvp` adımına ulaşan bir senaryo bulunursa
assertion `.pg-mvp-grid`'e daraltılmalı — bu, görev sırasında dev server ile manuel keşfedilip
netleştirilecek.)

- [ ] **Step 5: Doğrula**

Run: `npx tsc --noEmit && npm run build && npx playwright test tests/e2e/guided-workflow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/react/features/idea-studio/IdeaStudioPrimitives.tsx src/react/styles.css tests/e2e/guided-workflow.spec.ts
git commit -m "feat(react): MVP adımında tek soru yerine kısa kart ızgarası gösterilsin"
```

---

### Task 7: Tam akış regresyon geçişi

**Files:**
- Modify: `tests/e2e/guided-workflow.spec.ts` (yalnız gerekirse — bkz. Step 1)

**Interfaces:**
- Consumes: Task 1-6'nın tüm ürünleri.

- [ ] **Step 1: Tüm e2e paketini çalıştır, kırık senaryoları tek tek düzelt**

Run: `npm run build && npx playwright test`
Expected: tüm `tests/e2e/*.spec.ts` PASS.

Herhangi bir test, üç kolonlu yerleşim veya taşınan `.pg-coach-steps` yüzünden (Task 2) başarısız olursa —
örn. eski selector'lar `.pg-idea-map .pg-coach-steps` gibi bir yola bağımlıysa — ilgili selector'ı yeni
konuma (`.pg-stage-strip .pg-coach-steps`) güncelle. Bu plan yazılırken repo'daki tüm `.spec.ts`
dosyalarında `.pg-coach-steps`'e başka referans bulunmadı (yalnız `guided-workflow.spec.ts`, Task 2 Step 7
içinde ele alındı) — gerçek çalıştırmada yeni bir referans çıkarsa burada düzeltilir.

- [ ] **Step 2: Tam v4 birim paketini ve typecheck'i çalıştır**

Run: `node scripts/run-v4-tests.mjs && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 3: Manuel duman testi**

Dev server ile (`npm run dev`): yeni bir fikir oluştur, problem→kullanıcı→değer adımlarını sohbetle geç,
MVP adımında kart ızgarasının göründüğünü, bir karta tıklamanın normal mesaj gönderme akışını tetiklediğini,
sağ panelde başlık/vurgu/sayaç/CTA/mini-geçmişin hep birlikte tutarlı göründüğünü, "Fikir Özetini incele →"
CTA'sının yalnız `readyForSummaryReview` true olunca aktifleştiğini doğrula.

- [ ] **Step 4: Commit (yalnız Step 1'de değişiklik olduysa)**

```bash
git add tests/e2e/guided-workflow.spec.ts
git commit -m "test(e2e): aşama 2a yerleşim değişikliği sonrası selector düzeltmeleri"
```
