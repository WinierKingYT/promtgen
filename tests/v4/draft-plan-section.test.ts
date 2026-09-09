import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectDocument } from '../../src/v4/project-document.js';
import { draftPlanSectionTask } from '../../src/v4/ai/tasks/draft-plan-section.js';
import { draftPlanSection } from '../../src/v4/application/draft-plan-section-run.js';
import { updatePlanSection } from '../../src/v4/planning-engine.js';
import { calculateReadiness } from '../../src/v4/application/readiness-service.js';

const freshProject = () => createProjectDocument({
  idea: 'Bireysel geliştiriciler için yerel proje planlama aracı',
  name: 'Draft plan section'
});

const OFFLINE_SETTINGS = { providerId: 'offline', model: 'local', baseUrl: '', useAiWhenAvailable: false, useLocalMemory: false } as const;
const ONLINE_SETTINGS = { providerId: 'openai', model: 'draft-mock', baseUrl: 'https://api.openai.com/v1', useAiWhenAvailable: true, useLocalMemory: false } as const;

function providerReturning(content: string, warnings: string[] = []) {
  return {
    model: 'draft-mock',
    async structured(input: { schema: { parse(value: unknown): unknown } }) {
      return input.schema.parse({ content, warnings });
    }
  };
}

function providerThrowing(message: string) {
  return {
    model: 'draft-mock',
    async structured() {
      throw new Error(message);
    }
  };
}

describe('draft-plan-section task contract', () => {
  it('defines a prompt/schema/context contract scoped to a single empty section', () => {
    const project = freshProject();
    const context = draftPlanSectionTask.buildContext(project, { sectionId: 'objectives' }) as { section: { id: string } };
    assert.equal(context.section.id, 'objectives');
    const output = draftPlanSectionTask.schema.parse({ content: 'İlk taslak metni.', warnings: [] });
    assert.equal(output.content, 'İlk taslak metni.');
    assert.match(draftPlanSectionTask.buildPrompt(project, { sectionId: 'objectives' }), /kullanıcı onayı olmadan uygulanmayacaktır/);
  });

  it('refuses to build context for a section that already has content', () => {
    // `vision` taze projede BOŞ DOĞMAZ: createProjectDocument onu fikir
    // metniyle tohumluyor (ölçüldü). Bu yüzden bu testin amacı için doğal
    // olarak dolu bir bölüm budur -- ayrıca updatePlanSection ile yazılmış
    // `objectives`i de aynı kuralla kontrol ediyoruz.
    const project = freshProject();
    assert.ok(project.sections.vision.content.length > 0, 'vision fikir metniyle tohumlanmalı');
    assert.throws(
      () => draftPlanSectionTask.buildContext(project, { sectionId: 'vision' }),
      /zaten içerik var/
    );
    const withObjectives = updatePlanSection(project, 'objectives', { content: 'Kullanıcının kendi yazdığı hedef.' });
    assert.throws(
      () => draftPlanSectionTask.buildContext(withObjectives, { sectionId: 'objectives' }),
      /zaten içerik var/
    );
  });
});

describe('draftPlanSection — Faz D1 boş bölüm taslağı', () => {
  it('SAĞLAYICI YOKKEN sessiz kalmaz ve belgeyi değiştirmez', async () => {
    const project = freshProject();
    const result = await draftPlanSection(project, 'objectives', { settings: OFFLINE_SETTINGS });
    assert.equal(result.content, '');
    assert.ok(result.error, 'sessizlik yasak: kullanıcıya bir cümle dönmeli');
    assert.match(result.error!, /AI sağlayıcısı bağlaman gerekiyor/);
  });

  it('SAĞLAYICI ÇAĞRISI DÜŞTÜĞÜNDE ham nedeni saklamaz', async () => {
    const project = freshProject();
    const result = await draftPlanSection(project, 'objectives', {
      settings: ONLINE_SETTINGS,
      provider: providerThrowing('Failed to fetch')
    });
    assert.equal(result.content, '');
    assert.ok(result.error);
    assert.match(result.error!, /Failed to fetch/, 'orijinal neden silinmemeli');
  });

  it('ÇAĞRI BAŞARILI ama taslak anlamsız/çok kısaysa hata DEĞİL, ayrı bir bildirim döner', async () => {
    const project = freshProject();
    const result = await draftPlanSection(project, 'objectives', {
      settings: ONLINE_SETTINGS,
      provider: providerReturning('kısa')
    });
    assert.equal(result.error, null, 'bu bir hata değil');
    assert.equal(result.content, '');
    assert.ok(result.notice.length > 0, 'sessizlik yasak: durum bir cümleyle söylenmeli');
  });

  it('BAŞARILI çağrı kullanılabilir taslağı döner ve belgeye YAZMAZ', async () => {
    const project = freshProject();
    const before = structuredClone(project.sections);
    const result = await draftPlanSection(project, 'objectives', {
      settings: ONLINE_SETTINGS,
      provider: providerReturning('İlk sürümde ölçülebilir üç kullanıcı hedefi tanımlanır.')
    });
    assert.equal(result.error, null);
    assert.equal(result.notice, '');
    assert.match(result.content, /ölçülebilir üç kullanıcı hedefi/);
    assert.deepEqual(project.sections, before, 'draftPlanSection projeyi mutasyona uğratmamalı');
  });

  it('İÇERİĞİ OLAN bir bölüm için taslak istenirse kullanıcının yazdığına DOKUNMAZ', async () => {
    const written = 'Kullanıcının kendi elle yazdığı hedef cümlesi.';
    const project = updatePlanSection(freshProject(), 'objectives', { content: written });
    const result = await draftPlanSection(project, 'objectives', {
      settings: ONLINE_SETTINGS,
      provider: providerReturning('AI bunun üstüne yazmaya çalışırdı.')
    });
    assert.equal(result.content, '');
    assert.match(result.error!, /zaten içerik var/);
    assert.equal(project.sections.objectives.content, written, 'canonical içerik değişmemeli');
  });
});

describe('Faz D — boş zorunlu bölüm readiness kapısını, doldurulunca kapatır', () => {
  it('boş zorunlu bölüm blocker üretir; AI taslağı kaydedilince blocker kalkar', async () => {
    const project = freshProject();
    const emptyBlockers = calculateReadiness(project).readiness.blockers;
    assert.ok(
      emptyBlockers.some(message => /bölüm/.test(message) && /boş/.test(message)),
      'taze projede zorunlu bölüm boş blocker üretmeli'
    );

    const draft = await draftPlanSection(project, 'objectives', {
      settings: ONLINE_SETTINGS,
      provider: providerReturning('İlk sürümde ölçülebilir üç kullanıcı hedefi tanımlanır.')
    });
    assert.equal(draft.error, null);
    assert.ok(draft.content.length > 0);

    // Gerçek uygulama yolu: kullanıcı taslağı GÖZDEN GEÇİRİR ve "Bölümü
    // kaydet"e basar -- Workspace.tsx::saveSection ile birebir aynı çağrı.
    const saved = updatePlanSection(project, 'objectives', { content: draft.content });
    const afterBlockers = calculateReadiness(saved).readiness.blockers;
    assert.ok(
      !afterBlockers.some(message => message.includes('objectives') || (/Hedefler/.test(message) && /boş/.test(message))),
      'objectives artık dolu olduğu için blocker listesinde görünmemeli'
    );
    assert.equal(saved.sections.objectives.status, 'draft', 'PlanSectionStatus draft olmalı (contracts.ts:232)');
  });
});
