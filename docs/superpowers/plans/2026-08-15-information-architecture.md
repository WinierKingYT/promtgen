# Bilgi Mimarisi (Alt Proje C) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gezinmeyi tek seviyeye indir, üç sıralı aşama kur, ve "Gelişmiş plan araçları" açılırındaki beş paneli ait oldukları ana dağıt.

**Architecture:** Uygulamada zaten üç görünüm var (`IdeaStudioView = 'develop' | 'guide' | 'plan'`). Yeni bir kabuk kurulmuyor: mevcut üçü aşama olarak etiketlenir, Plan kilitlenip kilit *nedeni* yazılır, ikinci sekme seviyesi (`pg-map-tabs`) kaldırılır, ve beş panel tek tek yeni yerlerine taşınır. Her taşımanın doğrulaması çift iddiadır — yeni yerinde görünür, eski yerinde yok.

**Tech Stack:** React 19 · TypeScript · Vite 7 · Playwright (chromium) · `node:test`

## Global Constraints

- **Aşama modeli tek kaynaktan türer:** `IdeaStudioView` (`src/react/features/idea-studio/IdeaStudioPrimitives.tsx:25`). `PHASE_REGISTRY` ve `GuidedHeaderBar` silinir. `lifecycle.activePhase` verisi `planning-engine` tarafından yazılmaya devam eder ama gezinmeyi **beslemez**.
- **Sınıf adları değişmez.** `pg-*` adlandırması ve E2E seçicilerinin `data-testid`'e taşınması alt proje D'nin işi. C markup'ı yeniden düzenler, adlandırmayı değil.
- **Hiçbir içerik iki yerde durmaz.** Her taşıma için "eski yerde yok" iddiası zorunludur; bu iddia olmadan görev tamamlanmış sayılmaz.
- **Görsel sözleşme bu alt projede kapı değil, kayıt tutucudur.** Her görevde önce `tests/e2e/visual-contract.spec.ts` gezinmesi onarılır, sonra `UPDATE_VISUAL_BASELINE=1` ile referans yenilenir. Fark sayısı reddetme gerekçesi değildir; **ekran listesinin değişmemesi** gerekçedir.
  - **Diyalog ekranları arkalarındaki sayfayı da yakalar.** `captureComputedStyles` `document.body`'nin tamamını dolaşıyor (`tests/e2e/support/visual-contract.ts:71`), ve diyaloglar içeriğin yerine geçmiyor, üstüne biniyor. Bu yüzden `revizyon-geçmişi` (plan görünümü arkada açık) ve `ayarlar-diyaloğu` ekranları, o an arkalarında ne varsa onun değişimini de gösterir. Böyle bir fark **sızıntı değildir**: dokunulmamış yüzey değil, dokunulan yüzeyi içeren bir yakalamadır. Bir görev plan bağlam sütununu değiştiriyorsa `revizyon-geçmişi`'nde fark beklenir ve kabul edilir. Sızıntı ölçütü, arkasında dokunulan yüzey **bulunmayan** bir ekranda fark çıkmasıdır.
  - **Sayı Task 4'te 12 → 11'e indi ve orada sabittir.** Task 4 Özet içeriğini Ortak Anlayış aşamasına taşıyınca `stüdyo-özet` ile `fikir-özeti` aynı ekranı ölçmeye başladı — ölçüldü ve bayt bayt aynı çıktılar (89.593 karakter). 12 anahtar tutmak sayıyı korurdu ama kapsamı değil: 12 anahtar, 11 benzersiz ekran. Kopya silindi. **Ekran listesi Task 5'ten itibaren 11'de sabittir**; bir anahtarın kaybolması ya da eklenmesi hâlâ commit'i durdurur.
- **E2E kırılmaları susturulmaz.** `tests/e2e/guided-workflow.spec.ts` iddiaları yeni davranışa göre güncellenir; `.skip`, `test.fixme` veya gevşetilmiş seçici kullanılmaz.
- **Kilit koşulu değişmez:** `canonicalPlanningOpen = view === 'plan' && Boolean(project.sourceIdeaRevisionId || hasCanonicalPlan)` (`src/react/Workspace.tsx:131`). Yalnız sunumu değişir.
- **Her görev kendi çevrimini kapatır:** değiştir → birim testleri → E2E → sözleşme gezinmesini onar → referansı yenile → `npm run typecheck && npm run lint` → commit.

---

### Task 1: Ölü aşama modelini sil

`PHASE_REGISTRY` (9 faz) uygulamada yalnız `GuidedHeaderBar` tarafından okunuyor; `GuidedHeaderBar`'ı da yalnız `tests/v4/ux-contracts.test.ts` çağırıyor. Yani ekranda ölü, testte kanonik. Tek kaynak kuralını kurmadan önce bu ikinci model kaldırılır.

**Files:**
- Delete: `src/react/components/GuidedHeaderBar.tsx`
- Modify: `tests/v4/ux-contracts.test.ts:5` (import), `:19-34` (test bloğu)

**Interfaces:**
- Consumes: yok (ilk görev)
- Produces: `PHASE_REGISTRY`'nin artık hiçbir React bileşeni tarafından okunmadığı garantisi. Sonraki görevler aşama sorularının tek cevabının `IdeaStudioView` olduğunu varsayabilir.

- [ ] **Step 1: Silmenin güvenli olduğunu kanıtla**

Run:
```bash
grep -rn "GuidedHeaderBar\|getPhaseGuidance" --include=*.ts --include=*.tsx --include=*.js src/ tests/ scripts/
```

Expected: yalnız üç dosya — `src/react/components/GuidedHeaderBar.tsx` (tanım), `tests/v4/ux-contracts.test.ts` (import + tek test). Başka bir tüketici çıkarsa **DUR ve sor**; bu görev o varsayım üzerine kurulu.

`IconButton`'ı silme — `WorkspaceChrome.js`'in başka dört tüketicisi var (`FinalizePlanDialog`, `ProjectInventoryModal`, `ProviderSettingsDialog`, `RevisionHistoryDialog`).

- [ ] **Step 2: Testten iddiayı kaldır**

`tests/v4/ux-contracts.test.ts` içinde 5. satırdaki importu şu hâle getir:

```ts
import { PlanCodeAlignmentPanel } from '../../src/react/components/PlanCodeAlignmentPanel.js';
```

(`GuidedHeaderBar, getPhaseGuidance` importu tamamen çıkar.)

`'GuidedHeaderBar uses the canonical phase registry and exposes one next action'` test bloğunu (19–34. satırlar) sil ve yerine şunu koy:

```ts
  // Aşama modeli tek kaynaktan türer: IdeaStudioView.
  // PHASE_REGISTRY (9 faz) alan modelinde yaşamaya devam eder ve
  // planning-engine tarafından yazılır, ama hiçbir React bileşeni onu
  // okumaz — gezinme onun üzerinden kurulmaz. Alt Proje C kararı.
  it('hiçbir React bileşeni PHASE_REGISTRY okumaz', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    async function sourceFiles(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const nested = await Promise.all(entries.map(async entry => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      }));
      return nested.flat();
    }

    const files = await sourceFiles('src/react');
    const offenders: string[] = [];
    for (const file of files) {
      if ((await readFile(file, 'utf8')).includes('PHASE_REGISTRY')) offenders.push(file);
    }

    assert.deepEqual(offenders, [], `PHASE_REGISTRY React katmanında okunuyor: ${offenders.join(', ')}`);
  });
```

> Bu test `src/react` ağacını gerçekten tarar ve ihlali dosya adıyla söyler.
> Repoda mimari sözleşme testi deseni zaten var
> (`tests/v4/architecture/ai-runtime-ownership.test.ts`); bu onunla aynı cinsten.
> Testin çalışma dizini repo kökü olmalı — `npm run test:v4` bunu sağlıyor.
> Sağlamıyorsa göreli yol yerine `process.cwd()` yerine
> `new URL('../../src/react', import.meta.url)` kullan.

- [ ] **Step 3: Testi koştur — geçmeli**

Run: `npm run test:v4`
Expected: PASS. `GuidedHeaderBar` hâlâ diskte olduğu için bu adım yalnız testin yeni hâlinin doğru olduğunu gösterir.

- [ ] **Step 4: Bileşeni sil**

```bash
git rm src/react/components/GuidedHeaderBar.tsx
```

- [ ] **Step 5: Bütün kapılar**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`
Expected: hepsi PASS. Build'in geçmesi dosyanın gerçekten hiçbir yerden import edilmediğini kanıtlar.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ui): olu asama modelini sil, tek kaynak IdeaStudioView"
```

---

### Task 2: Panel görünürlük koşullarını saf modüle çıkar

`TraceabilityMap` ve `PlanCodeAlignmentPanel` koşullu görünecek. Koşul yanlışsa özellik hataya düşmez — **sessizce hiç görünmez**. Bu yüzden koşullar UI'dan önce saf fonksiyon olarak yazılır ve her iki yönde test edilir.

**Files:**
- Create: `src/v4/application/plan-panel-visibility.ts`
- Create: `tests/v4/application/plan-panel-visibility.test.ts`

**Interfaces:**
- Consumes: `buildTraceabilityView(project, revision?): TraceabilityView` (`src/v4/application/traceability-view.ts:147`) — dönüşünde `edges: TraceabilityViewEdge[]` var. `project.profile.projectInventory` — varsa `{ inventory: InventoryEntry[] }` şeklinde.
- Produces:
  - `hasTraceabilityLinks(project: ProjectDocumentV5): boolean`
  - `hasProjectInventory(project: ProjectDocumentV5): boolean`

  Task 6 bu iki fonksiyonu tam bu adlarla ve bu imzayla tüketir.

- [ ] **Step 1: Testleri yaz**

`tests/v4/application/plan-panel-visibility.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasProjectInventory, hasTraceabilityLinks } from '../../../src/v4/application/plan-panel-visibility.js';
import { createProjectDocument } from '../../../src/v4/project-document.js';

function baseProject() {
  // createProjectDocument seçenek nesnesi alır, konumlu argüman değil.
  return createProjectDocument({ idea: 'Test fikri' });
}

describe('plan paneli görünürlük koşulları', () => {
  it('yeni projede izlenebilirlik bağlantısı yoktur', () => {
    assert.equal(hasTraceabilityLinks(baseProject()), false);
  });

  it('kanonik kayıtlar arasında bağlantı oluşunca izlenebilirlik görünür', () => {
    const project = baseProject();
    project.decisions.push({
      id: 'dec-1', title: 'Karar', status: 'accepted',
      lastChangedRevision: 1, lastChangeReason: 'test', affectedSectionIds: []
    } as never);
    project.requirements.push({
      id: 'req-1', title: 'Gereksinim', status: 'accepted', decisionId: 'dec-1',
      lastChangedRevision: 1, lastChangeReason: 'test', affectedSectionIds: []
    } as never);

    assert.equal(hasTraceabilityLinks(project), true);
  });

  it('envanter yokken kod hizalaması görünmez', () => {
    assert.equal(hasProjectInventory(baseProject()), false);
  });

  it('envanter boş dizi olsa bile taranmış sayılır', () => {
    const project = baseProject();
    project.profile.projectInventory = { inventory: [] } as never;

    assert.equal(hasProjectInventory(project), true);
  });

  it('envanter dizi değilse görünmez', () => {
    const project = baseProject();
    project.profile.projectInventory = { inventory: null } as never;

    assert.equal(hasProjectInventory(project), false);
  });
});
```

> **Kayıt:** "boş dizi de görünür" bilinçli. `analyzePlanCodeAlignment` envanter boşken kendi boş durumunu gösteriyor (`PlanCodeAlignmentPanel.tsx:48`); tarama yapılıp hiçbir güvenli dosya bulunamaması, tarama hiç yapılmamış olmasından farklı bir bilgidir ve kullanıcıya gösterilmelidir.

Fabrikanın imzası doğrulandı (`src/v4/project-document.js:101`):
`createProjectDocument({ idea, name = 'Yeni Proje', outputLanguage = 'tr', profile = null, planningDepth = null } = {})`.

Fikstürdeki `decisions` / `requirements` alan adları uydurulmuş olabilir — testi koşmadan önce gerçek şekli doğrula:

```bash
grep -n "interface Decision\|interface Requirement" -A 12 src/v4/contracts.ts | head -32
```

Zorunlu alanlar farklıysa testteki nesneleri gerçek şekle göre düzelt. Önemli olan **bir kararın bir gereksinime bağlandığı** durumun kurulması; alan adları o şekle uymalı.

- [ ] **Step 2: Testi koştur — düşmeli**

Run: `npm run test:v4`
Expected: FAIL — `Cannot find module '.../plan-panel-visibility.js'`

- [ ] **Step 3: Modülü yaz**

`src/v4/application/plan-panel-visibility.ts`:

```ts
import { buildTraceabilityView } from './traceability-view.js';
import type { ProjectDocumentV5 } from '../contracts.js';

/**
 * İzlenebilirlik haritası boşken gösterilmez. "Boş" ölçütü düğüm değil
 * kenar sayısıdır: tek başına duran kayıtlar bir harita oluşturmaz,
 * aralarındaki bağlantı oluşturur.
 */
export function hasTraceabilityLinks(project: ProjectDocumentV5): boolean {
  return buildTraceabilityView(project).edges.length > 0;
}

/**
 * Plan–kod hizalaması ancak kullanıcı bir proje envanteri taratmışsa
 * anlamlıdır. Envanterin boş çıkması taranmamış olmaktan farklıdır ve
 * panelin kendi boş durumu bunu anlatır; bu yüzden ölçüt dizinin
 * varlığıdır, uzunluğu değil.
 */
export function hasProjectInventory(project: ProjectDocumentV5): boolean {
  const inventory = project.profile?.projectInventory as { inventory?: unknown } | undefined;
  return Array.isArray(inventory?.inventory);
}
```

- [ ] **Step 4: Testi koştur — geçmeli**

Run: `npm run test:v4`
Expected: PASS, beş iddia da yeşil.

Testlerden biri düşerse gerçek veri şeklini oku (`src/v4/application/traceability-view.ts` `buildTraceabilityView`, `src/v4/application/plan-code-alignment.ts:88` `inventoryState`) ve **testi gerçeğe göre düzelt** — modülü teste uydurmak için değil.

- [ ] **Step 5: Kapılar ve commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/v4/application/plan-panel-visibility.ts tests/v4/application/plan-panel-visibility.test.ts
git commit -m "feat(plan): panel gorunurluk kosullarini saf module cikar"
```

---

### Task 3: Plan aşamasını kilitle ve kilidin nedenini yaz

Bugün plan kilitliyken `pg-plan-gate` içinde `IdeaGuidePanel` render ediliyor (`Workspace.tsx:371`) — aynı bileşen `guide` görünümünde de duruyor (`:366`). Aynı panel iki yerde, ve kapı **neden** kilitli olduğunu söylemiyor. Bu görev kopyayı kaldırır ve yerine nedeni koyar.

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx:27-36` (`VIEW_ITEMS`), `:101-110` (`nav`)
- Modify: `src/react/Workspace.tsx:130-131` (kilit koşulu), `:269-276` (header çağrısı), `:369-371` (kapı)
- Modify: `src/react/styles.css` (kilitli aşama düğmesi)
- Modify: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 1'den — aşama modelinin tek kaynağı `IdeaStudioView`.
- Produces: `IdeaStudioHeader` artık `lockedViews?: Partial<Record<IdeaStudioView, string>>` propunu alır; anahtar kilitli aşama, değer kullanıcıya gösterilecek neden metnidir. Task 4 bu propu değiştirmeden kullanır.

- [ ] **Step 1: E2E iddiasını yaz (düşecek)**

`tests/e2e/guided-workflow.spec.ts` içine, mevcut `test.describe` bloğunun içine ekle:

```ts
  test('plan asamasi kilitliyken nedenini soyler ve kopya panel icermez', async ({ page }) => {
    const planButton = page.getByRole('button', { name: 'Plan', exact: true });

    // Kilit bir kontrol durumu değil, içerik: düğme ETKİN kalır. `disabled`
    // olsa klavyeyle odaklanamaz ve nedeni duyurulmazdı; `aria-disabled` olsa
    // ekran okuyucuya "devre dışı" derdi — oysa tıklamak çalışıyor ve nedeni
    // öğrenmenin yolu tam da o. Kilit; soluk sınıf, title ve kapı metniyle
    // anlatılıyor.
    await expect(planButton).toBeEnabled();
    await expect(planButton).toHaveClass(/is-locked/);
    await expect(planButton).toHaveAttribute(
      'title',
      'Fikrin sınırlarını Ortak Anlayış aşamasında onayladığında açılır.'
    );

    await planButton.click();
    const gate = page.locator('.pg-plan-gate');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('Onayı Ortak Anlayış aşamasında verirsin.');
    // Kapı artık IdeaGuidePanel'i kopyalamıyor: onay paneli tek yerde durur.
    await expect(gate.locator('.idea-guide')).toHaveCount(0);
    // Kapıdan çıkış yolu var ve doğru aşamaya gidiyor.
    await gate.getByRole('button', { name: /Ortak Anlayış'a git/ }).click();
    await expect(page.getByRole('heading', { name: 'Ortak anlayışımızı kontrol et' })).toBeVisible();
  });
```

Kök sınıf doğrulandı: `IdeaGuidePanel` → `.idea-guide` (`src/react/components/IdeaOutcomeBar.tsx:47`).

- [ ] **Step 2: E2E'yi koştur — düşmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: FAIL — `Plan` düğmesi bugün `disabled` değil.

- [ ] **Step 3: `VIEW_ITEMS`'a kilit desteği ekle**

`src/react/features/idea-studio/IdeaStudioPrimitives.tsx`, `IdeaStudioHeader` prop tipine ekle:

```ts
  /**
   * Kilitli aşamalar ve kilidin nedeni. Kilit yalnız görünümü kapatmaz,
   * kullanıcıya ne yapması gerektiğini de söyler — aksi hâlde tıklanamayan
   * bir düğme bozukluk gibi okunur.
   */
  lockedViews?: Partial<Record<IdeaStudioView, string>>;
```

`nav` bloğunu (101–110) şununla değiştir:

```tsx
    <nav className="pg-view-tabs" aria-label="Proje aşamaları">
      {VIEW_ITEMS.map(({ id, label, detail, icon: Icon }) => {
        const lockReason = lockedViews?.[id];
        return <button
          type="button"
          key={id}
          className={`${view === id ? 'is-active' : ''}${lockReason ? ' is-locked' : ''}`.trim()}
          aria-current={view === id ? 'step' : undefined}
          title={lockReason || detail}
          onClick={() => onView(id)}
        ><Icon size={16}/><span>{label}</span></button>;
      })}
    </nav>
```

> **Ne `disabled` ne `aria-disabled` — kilit bir kontrol durumu değil, içerik.**
>
> `disabled` bir düğme klavyeyle odaklanamaz ve `title`'ı ekran okuyucuya
> duyurulmaz; kilidin nedeni tam da ona en çok ihtiyacı olan kullanıcıya
> ulaşmaz. `aria-disabled="true"` ise ekran okuyucuya "bu kontrol devre dışı"
> der — ama değil: tıklamak çalışıyor ve kilidin nedenini öğrenmenin yolu tam
> da o. Attribute yalan söyler.
>
> Doğru markup: düğme **etkin**. Kilitli olma bilgisi üç yerden geliyor —
> görsel olarak `.is-locked` soluklaştırması, ekran okuyucuya etkin düğmenin
> erişilebilir açıklaması olan `title`, ve tıklayınca inilen kapı ekranındaki
> **metin**. Kapı ekranı bu yüzden silinmez; kilidin okunabilir yüzü odur.
>
> Bunu Playwright yakaladı: `aria-disabled="true"` taşıyan bir elemana
> `.click()` eylemlenebilirlik beklemesinde asılıyor
> (`getAriaDisabled = isNativelyDisabled || hasExplicitAriaDisabled`).
> `force: true` ile bastırmak yanlış olurdu — araç gerçek bir anlam hatasını
> bildiriyordu.

> `aria-label` 'Fikrinle ne yapmak istiyorsun?' yerine 'Proje aşamaları' oldu. 'Fikir geliştirme aşamaları' **kullanılamaz** — o ad `pg-coach-steps` listesinde zaten var (`IdeaStudioPrimitives.tsx:138`) ve Task 4'te aynı ekrana taşınıyor; iki eleman aynı erişilebilir adı taşıyamaz.

Fonksiyon imzasına `lockedViews` parametresini eklemeyi unutma (85–94. satırlardaki destructuring).

- [ ] **Step 4: `Workspace`'te kilidi hesapla ve kapıyı sadeleştir**

`src/react/Workspace.tsx:130-131` civarına ekle:

```tsx
  const hasCanonicalPlan = project.requirements.length > 0 || project.decisions.length > 0 || project.tasks.length > 0;
  const planUnlocked = Boolean(project.sourceIdeaRevisionId || hasCanonicalPlan);
  const canonicalPlanningOpen = view === 'plan' && planUnlocked;
  const lockedViews = planUnlocked
    ? undefined
    : { plan: 'Fikrin sınırlarını Ortak Anlayış aşamasında onayladığında açılır.' } as const;
```

`IdeaStudioHeader` çağrısına (269–276) `lockedViews={lockedViews}` ekle.

`view === 'plan'` bloğundaki kapıyı (369–371) şununla değiştir:

```tsx
        {!canonicalPlanningOpen
          ? <div className="pg-plan-gate">
              <header>
                <span>PLANA GEÇİŞ</span>
                <h1>Önce fikrin sınırlarını onayla</h1>
                <p>Plan; yalnız onayladığın kullanıcı, problem, MVP kapsamı ve kararlar üzerinden oluşturulur. Onayı Ortak Anlayış aşamasında verirsin.</p>
              </header>
              <button type="button" className="is-primary" onClick={() => setView('guide')}>Ortak Anlayış'a git <ArrowRight size={16}/></button>
            </div>
```

`IdeaGuidePanel` kopyası buradan tamamen çıkar; `guide` görünümündeki tek örneği kalır.

- [ ] **Step 5: Kilitli düğme stilini yaz**

`src/react/styles.css` içinde `.pg-view-tabs button` kuralının hemen ardına ekle:

```css
/* Kilitli aşama: silik ama okunur ve hâlâ tıklanabilir — tıklama kilidin
   nedenini yazan kapı ekranına indirir. Bu yüzden `cursor: not-allowed`
   KULLANILMAZ: tıklamanın bir karşılığı var, imleç aksini söylememeli. */
.pg-view-tabs button.is-locked {
  opacity: .55;
}
```

Yeni renk **icat etme** — B'nin `--pg-*` dilinde zaten tanımlı olmayan hiçbir değer eklenmez.

- [ ] **Step 6: Kırılan eski E2E iddialarını yeni davranışa göre güncelle**

`tests/e2e/guided-workflow.spec.ts:40`:

```ts
    await expect(page.getByRole('navigation', { name: 'Proje aşamaları' })).toBeVisible();
```

Diğer düşen iddiaları koşarak bul ve **yeni davranışa göre** düzelt. `.skip` veya seçici gevşetme yasak.

- [ ] **Step 7: E2E'yi koştur — geçmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: PASS.

- [ ] **Step 8: Görsel sözleşmeyi onar ve referansı yenile**

Önce gezinmenin çöküp çökmediğini gör:

Run: `npx playwright test visual-contract`

Bu görev sekmelere dokunmuyor, bu yüzden gezinme çalışmalı; yalnız fark çıkmalı. Farkları oku, hepsinin **plan kapısı** ve **aşama şeridi** yüzeylerine ait olduğunu doğrula. Başka bir yüzeyde fark varsa **DUR ve sor**.

Sonra referansı yenile:

Run: `UPDATE_VISUAL_BASELINE=1 npx playwright test visual-contract`
Sonra doğrula: `npx playwright test visual-contract` → PASS

Ekran sayısını kontrol et:

```bash
node -e "console.log(Object.keys(require('./tests/e2e/visual-contract.baseline.json')).length)"
```

Expected: `12` (Task 4'ten önce; Task 5 ve sonrası için `11`)

- [ ] **Step 9: Bütün kapılar ve commit**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(ui): plan asamasini kilitle, kilit nedenini yaz, kapidaki kopya paneli kaldir"
```

---

### Task 4: İkinci sekme seviyesini kaldır — Özet Ortak Anlayış'a, Keşif Fikir'de tam panel

`pg-map-tabs` (`IdeaStudioPrimitives.tsx:131`) gezinmenin ikinci seviyesi. Özet içeriği zaten Ortak Anlayış'ın işini yapıyor; Keşif ise Fikir'in yardımcısı. İkisi ayrılınca sekme gerekmez.

Bu görev tek parçadır: özeti taşımadan sekmeyi kaldırmak içeriği kaybettirir, sekmeyi kaldırmadan özeti taşımak içeriği iki yerde bırakır.

**Files:**
- Modify: `src/react/features/idea-studio/IdeaStudioPrimitives.tsx:33-36` (etiket), `:115-154` (`IdeaSnapshot`)
- Create: `src/react/features/idea-studio/IdeaUnderstandingSummary.tsx`
- Modify: `src/react/Workspace.tsx:355-361` (Fikir paneli), `:364-367` (Ortak Anlayış görünümü)
- Modify: `tests/e2e/visual-contract.spec.ts:64`, `:182-194`
- Modify: `tests/e2e/guided-workflow.spec.ts:19`, `:42`

**Interfaces:**
- Consumes: Task 3'ten — `IdeaStudioHeader`'ın `lockedViews` propu (değiştirilmeden kalır).
- Produces:
  - `IdeaUnderstandingSummary({ project, coach }: { project: ProjectDocumentV5; coach: IdeaCoachState })` — Ortak Anlayış aşamasında render edilen özet gövdesi.
  - `IdeaSnapshot` artık yalnız Keşif panosunu sarar; prop imzası değişmez.

- [ ] **Step 1: Çift iddiayı E2E'ye yaz (düşecek)**

`tests/e2e/guided-workflow.spec.ts` içine ekle:

```ts
  test('ikinci sekme seviyesi kalkti: Ozet Ortak Anlayis`ta, Kesif Fikir`de', async ({ page }) => {
    // Fikir aşamasında: Keşif tam panel, sekme yok, Özet yok.
    await expect(page.getByRole('tab', { name: 'Keşif' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Özet' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toBeVisible();
    await expect(page.locator('.pg-map-fields')).toHaveCount(0);

    // Ortak Anlayış aşamasında: özet burada, Keşif panosu yok.
    await page.getByRole('button', { name: 'Ortak Anlayış', exact: true }).click();
    await expect(page.locator('.pg-map-fields')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Keşif panosu' })).toHaveCount(0);
  });
```

- [ ] **Step 2: E2E'yi koştur — düşmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: FAIL — `getByRole('tab', { name: 'Keşif' })` bugün 1 tane buluyor.

- [ ] **Step 3: Özet gövdesini kendi bileşenine çıkar**

`src/react/features/idea-studio/IdeaUnderstandingSummary.tsx` oluştur — gövde `IdeaSnapshot`'ın bugünkü `summary` dalından (`IdeaStudioPrimitives.tsx:137-152`) **birebir** taşınır:

```tsx
import { ShieldAlert } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../../v4/contracts.js';
import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';

/**
 * Konuşmadan çıkarılan ortak anlayış. Alt Proje C'ye kadar Fikir panelinin
 * "Özet" sekmesindeydi; artık kendi aşamasında duruyor ve tek örneği var.
 */
export function IdeaUnderstandingSummary({ project, coach }: {
  project: ProjectDocumentV5;
  coach: IdeaCoachState;
}) {
  const conceptConfirmed = Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed);
  return <aside className="pg-idea-map" aria-label="Ortak anlayış">
    <div className="pg-map-head">
      <div><span>Onaylanmış anlayış</span><h2>Fikir özeti</h2></div>
      <strong className={conceptConfirmed ? 'is-confirmed' : 'is-draft'}>{conceptConfirmed ? 'Onaylandı' : 'Taslak'}</strong>
    </div>
    <ol className="pg-coach-steps" aria-label="Fikir geliştirme aşamaları">
      {coach.steps.map(step => <li key={step.id} className={`is-${step.state}`}><i/>{step.label}</li>)}
    </ol>
    <div className="pg-map-fields">
      {coach.evidence.map(item => <section key={item.id} className={`is-${item.status}`}>
        <span>{item.label}<b>{item.statusLabel}</b></span>
        <p>{item.displayText}</p>
      </section>)}
    </div>
    <section className="pg-scope-snapshot">
      <div><span>Kritik karar</span><b>{coach.criticalDecisionCount}</b></div>
      <div><span>Ertelenebilir</span><b>{coach.deferrableDecisionCount}</b></div>
    </section>
    <p className="pg-map-note"><ShieldAlert size={15}/> Taslak alanlar henüz kesinleşmedi; fikir özetini onayladığında sabitlenir.</p>
  </aside>;
}
```

- [ ] **Step 4: `IdeaSnapshot`'ı sadeleştir**

`IdeaStudioPrimitives.tsx:115-154`'teki `IdeaSnapshot`'ı şununla değiştir:

```tsx
export function IdeaSnapshot({ project, settings, onPersist, onNotice }: {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  /** Keşif panosunun ürettiği belge; komut türü çağırana kadar taşınır. */
  onPersist: (project: ProjectDocumentV5, message: string, commandType: string) => void;
  /** Kalıcı bir değişiklik olmadan kullanıcıya durum bildirmek için. */
  onNotice: (message: string) => void;
}) {
  return <aside className="pg-idea-map" aria-label="Keşif">
    <IdeaExpansionBoard project={project} settings={settings} onPersist={onPersist} onNotice={onNotice}/>
  </aside>;
}
```

`coach` propu artık kullanılmıyor — imzadan çıkarıldı. `useState` importu ve `ShieldAlert` importu bu dosyada başka kullanıcı kalmadıysa kaldırılır; `npm run lint` bunu söyleyecek.

- [ ] **Step 5: `Workspace`'i yeni yapıya bağla**

`src/react/Workspace.tsx:355-361`'deki `IdeaSnapshot` çağrısından `coach` propunu çıkar:

```tsx
        <IdeaSnapshot
          project={project}
          settings={providerSettings}
          onPersist={(next, message, commandType) => void persistCandidate(next, message, commandType)}
          onNotice={notify}
        />
```

`guide` görünümüne (364–367) özeti ekle:

```tsx
      {view === 'guide' && <main id="pg-primary-content" className="pg-document-workspace" tabIndex={-1}>
        <header className="pg-document-title"><span>ORTAK ANLAYIŞ</span><h1>Ortak anlayışımızı kontrol et</h1><p>Konuşmadan çıkardığımız kullanıcıyı, problemi, değeri ve MVP sınırını düzeltip onayla.</p></header>
        <IdeaUnderstandingSummary project={project} coach={coach}/>
        <IdeaGuidePanel project={project} onCommit={commit} onConvert={convertIdeaToPlan} onOpenPlan={() => setView('plan')}/>
      </main>}
```

`IdeaUnderstandingSummary`'yi import et.

- [ ] **Step 6: Aşama etiketini değiştir**

`IdeaStudioPrimitives.tsx:34`:

```tsx
  { id: 'guide', label: 'Ortak Anlayış', detail: 'Ortak anlayışı kontrol et', icon: FileText },
```

- [ ] **Step 7: E2E'yi koştur ve kırılanları güncelle**

Run: `npm run test:e2e -- guided-workflow`

Bilinen kırılmalar ve düzeltmeleri:
- `:19` `getByRole('button', { name: 'Fikir Özeti', exact: true })` → `{ name: 'Ortak Anlayış', exact: true }`
- `:42` `getByRole('complementary', { name: 'Fikir özeti' })` → `{ name: 'Keşif' }`

Expected (düzeltmelerden sonra): PASS.

- [ ] **Step 8: Görsel sözleşme gezinmesini onar**

`tests/e2e/visual-contract.spec.ts` sekmelere dayanıyor; bunlar artık yok:

- `:64` `await page.getByRole('tab', { name: 'Keşif' }).click();` → **satırı sil**; Keşif panosu artık doğrudan görünür.
- `:182-194` Özet sekmesi bloğu: `getByRole('tab', { name: 'Özet' })` tıklaması silinir. `stüdyo-özet` ekranı artık **Ortak Anlayış aşamasında** yakalanır; oraya `getByRole('button', { name: 'Ortak Anlayış', exact: true })` ile gidilir.
- `:184` `getByRole('list', { name: 'Fikir geliştirme aşamaları' })` beklemesi **korunur** — liste artık Ortak Anlayış'ta ama adı aynı, ve bu bekleme yerleşimin oturmasını garantiliyor.
- `:196` `getByRole('button', { name: 'Fikir Özeti', exact: true })` → `{ name: 'Ortak Anlayış', exact: true }`

**`stüdyo-keşif` adını değiştirme.** `stüdyo-özet` anahtarı ise bu görevde **silinir**: içerik Ortak Anlayış'a taşınınca `fikir-özeti` ile aynı ekranı ölçmeye başlıyor. Ölçüldü, bayt bayt aynı. Liste 12 → **11**'e iner ve oradan sonra sabittir.

Run: `npx playwright test visual-contract`
Expected: test **çöküyor değil, fark üretiyor**. Çöküyorsa gezinme onarımı eksiktir.

- [ ] **Step 9: Referansı yenile ve ekran listesini doğrula**

Run: `UPDATE_VISUAL_BASELINE=1 npx playwright test visual-contract`
Sonra: `npx playwright test visual-contract` → PASS

```bash
node -e "console.log(Object.keys(require('./tests/e2e/visual-contract.baseline.json')).sort().join('\n'))"
```

Expected: **11** satır — Task 3 sonrası listeden yalnız `stüdyo-özet` eksik, başka hiçbir fark yok. Beklenenden başka bir ekran kaybolduysa ya da yeni bir ad belirdiyse gezinme yanlış onarılmıştır — **DUR ve sor**.

- [ ] **Step 10: Bütün kapılar ve commit**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(ui): ikinci sekme seviyesini kaldir, ozeti Ortak Anlayis`a tasi"
```

---

### Task 5: `SectionRegenerationPanel` editöre, `PlanningScenarioPanel` bağlam sütununa

Bir bölümü yeniden üretmek, o bölümü düzenlemenin parçası — açılırın arkasında olmamalı. Senaryolar ise plan kurulurken bakılan bir şey; bağlam sütununun işi.

**Files:**
- Modify: `src/react/Workspace.tsx:382-385` (editör), `:386-389` (bağlam sütunu)
- Modify: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 4'ten — plan görünümünün yeni gezinme yolu (`Ortak Anlayış` etiketi üzerinden).
- Produces: `details.pg-advanced-tools` açılırında yalnız üç panel kalır (`StorageHealthPanel`, `TraceabilityMap`, `PlanCodeAlignmentPanel`). Task 6 ve 7 kalanları boşaltır.

- [ ] **Step 1: Çift iddiayı yaz (düşecek)**

`tests/e2e/guided-workflow.spec.ts`, plan görünümüne ulaşan mevcut testin ardına:

```ts
  test('bolum yeniden uretimi editorde, senaryolar baglam sutununda', async ({ page }) => {
    // Yeni yerlerinde — açılır açılmadan görünürler.
    await expect(page.locator('.pg-plan-editor .section-regeneration')).toBeVisible();
    await expect(page.locator('.pg-plan-context .scenario-panel')).toBeVisible();

    // Eski yerinde yok.
    const advanced = page.locator('details.pg-advanced-tools');
    await expect(advanced.locator('.section-regeneration')).toHaveCount(0);
    await expect(advanced.locator('.scenario-panel')).toHaveCount(0);
  });
```

Kök sınıflar doğrulandı: `SectionRegenerationPanel` → `.section-regeneration`
(`SectionRegenerationPanel.tsx:73`), `PlanningScenarioPanel` → `.scenario-panel`
(`PlanningScenarioPanel.tsx:69`).

- [ ] **Step 2: E2E'yi koştur — düşmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: FAIL — paneller bugün açılırın içinde.

- [ ] **Step 3: `details` bloğuna sınıf ver**

`src/react/Workspace.tsx:388`'deki `<details>` etiketine `className="pg-advanced-tools"` ekle. Bu geçici bir işaret: Task 7 bloğu tamamen siler, ama o zamana kadar E2E'nin "eski yer"i adresleyebilmesi gerek.

- [ ] **Step 4: `SectionRegenerationPanel`'i editöre taşı**

`Workspace.tsx:383`'te, `activeSection === 'tasks'` bloğunun **hemen ardına**, `{active && <>...</>}` sarmalının içine ekle:

```tsx
<SectionRegenerationPanel project={project} onCommit={commit} providerSettings={providerSettings} credentialVault={credentialVault}/>
```

Ve `:388`'deki `details` içinden `<SectionRegenerationPanel .../>` satırını çıkar.

Bileşen lazy olduğu için editörün etrafında bir `LazyFeatureBoundary` gerekir. `pg-plan-editor` `<section>`'ının içinde, panelin etrafına:

```tsx
<LazyFeatureBoundary label="Bölüm yeniden üretimi" resetKey={activeSection}>
  <SectionRegenerationPanel project={project} onCommit={commit} providerSettings={providerSettings} credentialVault={credentialVault}/>
</LazyFeatureBoundary>
```

`resetKey={activeSection}` bilinçli: bölüm değişince panelin durumu sıfırlanmalı, yoksa önceki bölümün taslağı yeni bölümde görünür.

- [ ] **Step 5: `PlanningScenarioPanel`'i bağlam sütununa taşı**

`Workspace.tsx:387`'deki `<dl>`'in ardına, `details`'ten **önce**:

```tsx
<LazyFeatureBoundary label="Planlama senaryoları" resetKey={project.documentRevision}>
  <PlanningScenarioPanel project={project} onCommit={commit}/>
</LazyFeatureBoundary>
```

Ve `details` içinden `<PlanningScenarioPanel .../>` satırını çıkar.

- [ ] **Step 6: E2E'yi koştur — geçmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: PASS.

- [ ] **Step 7: Sözleşme referansını yenile**

Run: `npx playwright test visual-contract` → farkları oku. Hepsi `plan` ve `plan-gelişmiş-araçlar` ekranlarına ait olmalı. Başka ekranda fark varsa **DUR ve sor**.

Run: `UPDATE_VISUAL_BASELINE=1 npx playwright test visual-contract`
Sonra: `npx playwright test visual-contract` → PASS

- [ ] **Step 8: Bütün kapılar ve commit**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(plan): bolum yeniden uretimini editore, senaryolari baglam sutununa tasi"
```

---

### Task 6: `TraceabilityMap` ve `PlanCodeAlignmentPanel` koşullu belirir

İkisi de boşken gösterilmenin anlamı yok. Görünürlük Task 2'nin saf fonksiyonlarından gelir; koşul UI'da yeniden yazılmaz.

**Files:**
- Modify: `src/react/Workspace.tsx:386-389` (bağlam sütunu)
- Modify: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 2'den — `hasTraceabilityLinks(project: ProjectDocumentV5): boolean` ve `hasProjectInventory(project: ProjectDocumentV5): boolean` (`src/v4/application/plan-panel-visibility.js`).
- Produces: `details.pg-advanced-tools` içinde yalnız `StorageHealthPanel` kalır. Task 7 bloğu siler.

- [ ] **Step 1: Çift iddiayı yaz (düşecek)**

`tests/e2e/guided-workflow.spec.ts`:

```ts
  test('izlenebilirlik ve kod hizalamasi bos durumda gorunmez', async ({ page }) => {
    // Fikstür projesinde kanonik bağlantı var, envanter yok.
    await expect(page.locator('.pg-plan-context .trace-map')).toBeVisible();
    await expect(page.locator('.pg-plan-context .plan-code-alignment')).toHaveCount(0);

    // Eski yerinde ikisi de yok.
    const advanced = page.locator('details.pg-advanced-tools');
    await expect(advanced.locator('.trace-map')).toHaveCount(0);
    await expect(advanced.locator('.plan-code-alignment')).toHaveCount(0);
  });
```

Kök sınıflar doğrulandı: `TraceabilityMap` → `.trace-map` (`TraceabilityMap.tsx:50`),
`PlanCodeAlignmentPanel` → `.plan-code-alignment` (`PlanCodeAlignmentPanel.tsx:41`).

**Bu iddia fikstüre bağlı.** Önce fikstürün gerçek durumunu ölç:

```bash
grep -rn "projectInventory" tests/e2e/support/ | head
```

Envanter fikstürde **varsa** ikinci iddiayı `toBeVisible()` yap. Kanonik bağlantı **yoksa** birinci iddiayı `toHaveCount(0)` yap. Fikstürü iddiaya uydurmak için değiştirme — iddiayı fikstüre uydur; koşulun kendisi Task 2'de zaten iki yönde test edildi.

- [ ] **Step 2: E2E'yi koştur — düşmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: FAIL.

- [ ] **Step 3: Koşulları `Workspace`'e bağla**

Import ekle:

```tsx
import { hasProjectInventory, hasTraceabilityLinks } from '../v4/application/plan-panel-visibility.js';
```

Bileşen gövdesinde, `canonicalPlanningOpen` civarına:

```tsx
  // Boş panel göstermeyiz: harita ancak bağlantı varken, kod hizalaması
  // ancak envanter taranmışken anlamlı. Koşullar saf modülde tanımlı ve
  // iki yönde test edilmiş durumda.
  const traceabilityVisible = useMemo(() => hasTraceabilityLinks(project), [project]);
  const alignmentVisible = useMemo(() => hasProjectInventory(project), [project]);
```

Bağlam sütununda, `PlanningScenarioPanel`'in ardına:

```tsx
{traceabilityVisible && <LazyFeatureBoundary label="İzlenebilirlik haritası" resetKey={project.canonicalRevision}>
  <TraceabilityMap project={project}/>
</LazyFeatureBoundary>}
{alignmentVisible && <LazyFeatureBoundary label="Plan–kod hizalaması" resetKey={project.documentRevision}>
  <PlanCodeAlignmentPanel project={project} onCommit={commit}/>
</LazyFeatureBoundary>}
```

Ve `details` içinden `<TraceabilityMap .../>` ile `<PlanCodeAlignmentPanel .../>` satırlarını çıkar.

- [ ] **Step 4: E2E'yi koştur — geçmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: PASS.

- [ ] **Step 5: Sözleşme referansını yenile**

Run: `npx playwright test visual-contract` → farkları oku, `plan` ve `plan-gelişmiş-araçlar` dışında fark varsa **DUR ve sor**.

Run: `UPDATE_VISUAL_BASELINE=1 npx playwright test visual-contract`
Sonra: `npx playwright test visual-contract` → PASS

- [ ] **Step 6: Bütün kapılar ve commit**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(plan): izlenebilirlik ve kod hizalamasini kosullu goster"
```

---

### Task 7: `StorageHealthPanel` ayarlar diyaloğuna; açılır silinir

Depolama sağlığı hiçbir aşamaya ait değil — sistem tarafına gider. Bu taşıma saf değil: panel `Workspace`'in `persistCandidate`'ini alıyor, `ProviderSettingsDialog` ise bugün yalnız `ProviderSettings` kaydediyor. Diyaloğun prop sözleşmesi genişler; bu spec'te kabul edilmiş bir maliyet.

**Files:**
- Modify: `src/react/components/ProviderSettingsDialog.tsx:11-19` (prop sözleşmesi), gövde
- Modify: `src/react/Workspace.tsx:65` (lazy import), `:386-389` (`details` silinir), `:395` (diyalog çağrısı)
- Modify: `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 5 ve 6'dan — `details.pg-advanced-tools` içinde yalnız `StorageHealthPanel` kaldı.
- Produces: `ProviderSettingsDialogProps` iki alan kazanır:
  - `project: ProjectDocumentV5`
  - `onProjectCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<boolean | void> | boolean | void`

- [ ] **Step 1: Çift iddiayı yaz (düşecek)**

```ts
  test('depolama sagligi ayarlar diyalogunda, planda degil', async ({ page }) => {
    await expect(page.locator('.pg-plan-context .storage-health-panel')).toHaveCount(0);
    await expect(page.locator('details.pg-advanced-tools')).toHaveCount(0);

    await page.getByRole('button', { name: 'AI ayarları' }).click();
    await expect(page.getByRole('dialog').locator('.storage-health-panel')).toBeVisible();
  });
```

Kök sınıf doğrulandı: `StorageHealthPanel` → `.storage-health-panel`
(`StorageHealthPanel.tsx:158`).

- [ ] **Step 2: E2E'yi koştur — düşmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: FAIL.

- [ ] **Step 3: Diyaloğun prop sözleşmesini genişlet**

`src/react/components/ProviderSettingsDialog.tsx:11-19`:

```tsx
interface ProviderSettingsDialogProps {
  open: boolean;
  settings: ProviderSettings;
  onSave: (settings: ProviderSettings) => void;
  onClose: () => void;
  credentialVault: CredentialVault;
  /**
   * Depolama sağlığı paneli hiçbir aşamaya ait olmadığı için sistem
   * tarafında duruyor. Panel yedek geri yükleyebildiği için diyaloğun
   * proje kalıcılığına erişmesi gerekiyor — bu, ayarlar diyaloğunun
   * bilinçli olarak genişletilmiş sorumluluğudur (Alt Proje C).
   */
  project: ProjectDocumentV5;
  onProjectCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<boolean | void> | boolean | void;
}
```

`ProjectDocumentV5` tipini import et. Fonksiyon imzasına `project` ve `onProjectCommit` ekle.

Diyaloğun sağlayıcı formunun ardına, kapatma düğmelerinden önce paneli koy:

```tsx
<StorageHealthPanel project={project} onCommit={onProjectCommit}/>
```

`StorageHealthPanel`'i bu dosyada doğrudan (lazy değil) import et — diyalog zaten `LazyFeatureBoundary` içinde açılıyor.

- [ ] **Step 4: `Workspace`'ten çıkar ve diyaloğa bağla**

`Workspace.tsx:65`'teki `StorageHealthPanel` lazy importunu **sil**.

Bağlam sütunundaki `details` bloğunun tamamını (`:388`) **sil** — içinde artık tek panel kalmıştı, o da taşınıyor. `MoreHorizontal` importu başka kullanıcısı kalmadıysa kaldırılır (`npm run lint` söyleyecek).

`:395`'teki diyalog çağrısına iki prop ekle:

```tsx
    {settingsOpen && <LazyFeatureBoundary label="AI sağlayıcı ayarları" resetKey={settingsOpen}><ProviderSettingsDialog open settings={providerSettings} onSave={onProviderSettings} onClose={() => setSettingsOpen(false)} credentialVault={credentialVault} project={project} onProjectCommit={persistCandidate}/></LazyFeatureBoundary>}
```

- [ ] **Step 5: E2E'yi koştur — geçmeli**

Run: `npm run test:e2e -- guided-workflow`
Expected: PASS.

- [ ] **Step 6: Sözleşme gezinmesini kontrol et**

`plan-gelişmiş-araçlar` ekranı artık açılabilir bir açılır olmadığı için **yakalanamayabilir**. `tests/e2e/visual-contract.spec.ts` içinde o ekranı yakalayan bloğu bul.

Ekran adını **koru**: aynı ad altında artık `pg-plan-context` sütununun tamamı yakalanır (senaryolar + koşullu paneller). Açılırı açan tıklama satırı silinir; ekran anahtarı `plan-gelişmiş-araçlar` olduğu gibi kalır ki liste 11'de sabit kalsın.

> **Kayıt:** Ekran adı artık içeriğini birebir anlatmıyor. Yeniden adlandırma sözleşme referansının tamamını yeniden anlamlandırır ve C'nin ekran-listesi sabitini bozar; bu yüzden ad C'de korunur, D'de düzeltilir.

Run: `npx playwright test visual-contract`
Expected: çökmüyor, fark üretiyor.

- [ ] **Step 7: Referansı yenile ve listeyi doğrula**

Run: `UPDATE_VISUAL_BASELINE=1 npx playwright test visual-contract`
Sonra: `npx playwright test visual-contract` → PASS

```bash
node -e "console.log(Object.keys(require('./tests/e2e/visual-contract.baseline.json')).length)"
```

Expected: `12` (Task 4'ten önce; Task 5 ve sonrası için `11`)

- [ ] **Step 8: Bütün kapılar ve commit**

Run: `npm run test:v4 && npm run typecheck && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(ui): depolama sagligini ayarlar diyaloguna tasi, gelismis araclar acilirini sil"
```

---

### Task 8: Süpürme — hedeflerin karşılandığını ölçüyle kanıtla

C'nin hedefleri iddia değil, ölçü olarak kapanır.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-15-information-architecture-design.md` (durum satırı)
- Modify (gerekirse): `tests/e2e/guided-workflow.spec.ts`

**Interfaces:**
- Consumes: Task 1–7'nin tamamı.
- Produces: yok (kapanış görevi).

- [ ] **Step 1: İkinci gezinme seviyesinin kalmadığını kanıtla**

```bash
grep -rn "pg-map-tabs\|role=\"tablist\"\|role=\"tab\"" --include=*.tsx src/react/
```

Expected: **boş çıktı**. Çıktı varsa kalan sekme seviyesi bu görevde kapatılır.

- [ ] **Step 2: Açılırın ve ölü modelin kalmadığını kanıtla**

```bash
grep -rn "Gelişmiş plan araçları\|pg-advanced-tools\|GuidedHeaderBar" --include=*.tsx --include=*.ts src/
```

Expected: **boş çıktı**.

> `tests/e2e/guided-workflow.spec.ts`'te `details.pg-advanced-tools` seçicisi
> kalır ve **kalmalıdır** — Task 5/6/7'nin "eski yerinde yok" iddiaları onu
> `toHaveCount(0)` ile adresliyor. Bu yüzden tarama yalnız `src/` üzerinde koşar.

```bash
grep -rn "PHASE_REGISTRY" --include=*.tsx src/react/
```

Expected: **boş çıktı** — alan modelinde (`src/v4/`) kalması beklenir ve doğrudur.

- [ ] **Step 3: Hiçbir içeriğin iki yerde olmadığını kanıtla**

```bash
grep -c "IdeaGuidePanel" src/react/Workspace.tsx
```

Expected: `2` — bir import satırı, bir render (`guide` görünümünde). `3` çıkarsa plan kapısındaki kopya geri gelmiştir.

- [ ] **Step 4: Sözleşme ekran listesinin bozulmadığını kanıtla**

```bash
node -e "const b=require('./tests/e2e/visual-contract.baseline.json');const k=Object.keys(b).sort();console.log(k.length);console.log(k.join('\n'))"
```

Expected: `12`. Sonra listeyi C **başlamadan önceki** hâliyle karşılaştır. Dal
adını sabit kullan (`HEAD~N` sayımı ara düzeltme commit'i eklenirse kayar):

```bash
node -e "
const { execSync } = require('child_process');
const base = execSync('git merge-base HEAD main').toString().trim();
const cur = Object.keys(require('./tests/e2e/visual-contract.baseline.json')).sort();
const old = Object.keys(JSON.parse(execSync('git show ' + base + ':tests/e2e/visual-contract.baseline.json', {maxBuffer:1e9}))).sort();
console.log('aynı mı:', JSON.stringify(cur) === JSON.stringify(old));
console.log('kaybolan:', old.filter(k => !cur.includes(k)));
console.log('yeni:', cur.filter(k => !old.includes(k)));
"
```

C bir dalda değil doğrudan `main` üzerinde koşuyorsa `git merge-base HEAD main`
yerine C'nin ilk commit'inden önceki SHA'yı kullan (`git log --oneline` ile bul).

Expected: `aynı mı: true`. Değilse **DUR ve sor** — ekran kaybı sessiz kapsam kaybıdır.

- [ ] **Step 5: Tam doğrulama**

Run: `npm run test:all && npm run typecheck && npm run lint && npm run build && npm run test:e2e`

Expected: hepsi PASS.

> `npm run verify` bu makinede Rust kapılarında (`desktop:test`) duruyor — cargo kurulu değil. Tam `verify` yerine yukarıdaki dizi koşulur ve bu sınır raporda **açıkça** belirtilir.

- [ ] **Step 6: Spec'in durumunu güncelle ve commit**

`docs/superpowers/specs/2026-08-15-information-architecture-design.md` başlığındaki durum satırını şu hâle getir:

```markdown
**Durum:** Uygulandı
```

```bash
git add -A
git commit -m "chore(ui): alt proje C supurmesi, hedefleri olcuyle kapat"
```

---

## Notlar

**Görsel sözleşme neden kapı değil:** Sözleşme farkı ekran + eleman + özellik olarak veriyor. A ve B'de bu kapıydı çünkü CSS değişiklikleri yüzey-yereldi. C bileşenleri ekranlar arasında taşıyor; bir paneli Plan'dan Ayarlar'a almak iki ekranı da baştan sona değiştirir, ve "dokunmadığım yüzeyde fark = sızıntı" kuralı hiçbir şey elemez. Bu yüzden C'de kapı **çift iddia** (yeni yerde var / eski yerde yok), sözleşme ise kayıt tutucudur. Sözleşmenin tek reddetme yetkisi **ekran listesinin değişmesi**dir.

**E2E kırılmaları beklenen:** `guided-workflow.spec.ts`'in `:19`, `:40`, `:41`, `:42` satırları tasarım gereği kırılır. Her biri ilgili görevde **yeni davranışa göre** güncellenir. `.skip`, `test.fixme` veya seçici gevşetme kullanılırsa görev reddedilir.

**Fikstüre bağlı iddialar:** Task 6'nın koşullu görünürlük iddiaları E2E fikstürünün kanonik bağlantı ve envanter durumuna bağlı. Fikstürü iddiaya uydurma; iddiayı ölçtüğün fikstüre uydur. Koşulun kendisi Task 2'de her iki yönde zaten test edildi.
