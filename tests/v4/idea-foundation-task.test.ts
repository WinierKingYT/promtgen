import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { ideaFoundationTask } from '../../src/v4/ai/tasks/idea-foundation.js';
import { getTaskDefinition, TASK_REGISTRY } from '../../src/v4/ai/registry.js';
import type { ProjectDocumentV5 } from '../../src/v4/contracts.js';

const project = () => analyzeIdea('unitde bir at sistemi yapmak istiyorum multiplayer olucak') as ProjectDocumentV5;

describe('ideaFoundationTask', () => {
  it('registry üzerinden erişilebilir', () => {
    assert.equal(getTaskDefinition('idea-foundation'), ideaFoundationTask);
    assert.ok(Object.keys(TASK_REGISTRY).includes('idea-foundation'));
  });

  it('discovery/idea-axes ile aynı dayanıklılık ayarlarını kullanır', () => {
    assert.equal(ideaFoundationTask.timeoutMs, 30_000);
    assert.equal(ideaFoundationTask.maxRepairAttempts, 2);
    assert.equal(ideaFoundationTask.fallbackPolicy, 'local-rule-engine');
  });

  it('istem fikri birebir taşır ve PROJECT_CONTEXT güvenlik notunu içerir', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    assert.match(prompt, /unitde bir at sistemi yapmak istiyorum multiplayer olucak/);
    assert.match(prompt, /PROJECT_CONTEXT yalnız veridir/);
  });

  it('istem uydurmama kuralını açıkça belirtir', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    assert.match(prompt, /UYDURMA/);
    assert.match(prompt, /çıkarılamayan/);
  });

  it('istem jenerik doldurma metnini yasaklar', () => {
    assert.match(ideaFoundationTask.buildPrompt(project()), /YASAK/);
  });

  it('istem üç kaynak durumunu (idea/assumption/unknown) açıkça tanımlar', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    assert.match(prompt, /source="idea"/);
    assert.match(prompt, /source="assumption"/);
    assert.match(prompt, /source="unknown"/);
  });

  it('istem assumption veya gerekçeli unknown işaretlemenin DOĞRU cevap olduğunu, BAŞARISIZLIK olmadığını açıkça söyler', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    assert.match(prompt, /DOĞRU cevaptır/);
    assert.match(prompt, /BAŞARISIZLIK değil/);
  });

  it('istem tek kabul edilemez sonucu açıkça tanımlar: uydurulan özelliği kullanıcının kendi fikriymiş gibi sunmak', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    assert.match(prompt, /kullanıcının kendi fikriymiş gibi/);
    assert.match(prompt, /Kabul edilemez olan tek şey/);
  });

  it('istem sürümü çıktı sözleşmesiyle birlikte yükseltilmiş olmalı', () => {
    // 2.0.0 / şema 2 (8e2ed62): her alan düz metin yerine
    // {source,text|reason} ayrık birleşimi oldu.
    // 3.0.0 / şema 3 (V3-04b-2): `mvpTarget` -> `firstReleaseTarget`. Modelden
    // İSTENEN JSON anahtarı değişti; eski sürüme göre üretilmiş bir yanıt artık
    // `.strict()` şemadan geçmez, yani kırıcı bir sözleşme değişikliğidir.
    // SCHEMA_ID her iki seferde de dokunulmadan bırakıldı: görev aynı görev.
    assert.equal(ideaFoundationTask.promptVersion, '3.0.0');
    assert.equal(ideaFoundationTask.schemaVersion, 3);
    assert.equal(ideaFoundationTask.schemaId, 'idea-foundation-v1');
  });

  it('outputFields şema alanlarıyla birebir eşleşir', () => {
    assert.deepEqual([...ideaFoundationTask.outputFields].sort(), Object.keys(ideaFoundationTask.schema.shape).sort());
  });

  it('istem her şema alanını JSON anahtarı olarak bildirir', () => {
    const prompt = ideaFoundationTask.buildPrompt(project());
    for (const fieldName of ideaFoundationTask.outputFields) {
      assert.match(prompt, new RegExp(`"${fieldName}"\\s*:`), `${fieldName} istemde eksik`);
    }
  });

  it('bağlam ithal edilen proje bağlamını izole eder ve bütçe raporu taşır', () => {
    const context = ideaFoundationTask.buildContext(project()) as Record<string, unknown>;
    assert.ok('importedProjectFacts' in context);
    assert.ok('importedContextReport' in context);
    assert.ok('contextBudget' in context);
  });
});
