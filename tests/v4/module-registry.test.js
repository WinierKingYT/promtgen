import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { applyLocalModuleImport, applyModuleActivation, createModuleRegistry, previewLocalModuleImport, previewModuleActivation, suggestModules, validateModuleManifest } from '../../src/v4/module-registry.js';
import { createDocumentSet } from '../../src/v4/exporter.js';
import { runPlanReview } from '../../src/v4/review-engine.js';

const project = analyzeIdea('React ve Tauri ile local-first masaüstü web uygulaması');
const suggestions = suggestModules(project);
assert.ok(suggestions.some(item => item.module.id === 'software.core'));
assert.ok(suggestions.some(item => item.module.id === 'software.web'));
assert.ok(suggestions.some(item => item.module.id === 'software.desktop-local'));

const preview = previewModuleActivation(project, ['software.web', 'software.desktop-local']);
assert.deepEqual(preview.moduleIds, ['software.core', 'software.web', 'software.desktop-local']);
assert.equal(preview.errors.length, 0);
assert.equal(applyModuleActivation(project, preview).success, false);
const applied = applyModuleActivation(project, preview, { approved: true });
assert.equal(applied.success, true);
assert.equal(applied.project.modules.active.length, 4);
assert.equal(applied.project.sections.security.required, true);
assert.ok(createDocumentSet(applied.project)['documents/modules.md'].includes('software.web'));

const nonSoftwareCases = [
    ['Bir tez için literatür araştırması ve deney planı hazırla', 'research.evidence'],
    ['Podcast ve bülten içerik yayın takvimi oluştur', 'content.production'],
    ['Lojistik operasyon ve tedarik iş planı oluştur', 'business.operations'],
    ['Bir konferans etkinliği ve katılımcı programı planla', 'event.delivery']
];
for (const [idea, expectedModule] of nonSoftwareCases) {
    const domainProject = analyzeIdea(idea);
    assert.ok(suggestModules(domainProject).some(item => item.module.id === expectedModule), `${expectedModule} önerilmeli`);
}
const eventProject = analyzeIdea('Bir konferans etkinliği ve katılımcı programı planla');
const eventPreview = previewModuleActivation(eventProject, ['event.delivery']);
const eventApplied = applyModuleActivation(eventProject, eventPreview, { approved: true });
assert.equal(eventApplied.success, true);
assert.equal(eventApplied.project.sections.operations.required, true);
assert.ok(createDocumentSet(eventApplied.project)['documents/modules/event-runbook.md'].includes('Etkinlik ve Teslimat'));
const eventReview = runPlanReview(eventApplied.project);
assert.ok(eventReview.findings.some(item => item.ruleId === 'EVENT-MILESTONE'));
assert.ok(eventReview.findings.some(item => item.ruleId === 'EVENT-CONTINGENCY'));

const invalid = validateModuleManifest({ id: 'unsafe.module', version: '1.0.0', name: 'Unsafe', description: 'code', category: 'software', dependencies: [], conflicts: [], triggers: [], contributions: { requiredSections: [], suggestedSections: [] }, command: 'rm -rf' });
assert.equal(invalid.valid, false);
assert.match(invalid.errors.join(' '), /yasak/);
const custom = { id: 'local.accessibility', version: '1.0.0', name: 'Erişilebilirlik', description: 'Erişilebilir arayüz planı', category: 'quality', dependencies: ['core.planning'], conflicts: [], triggers: ['erişilebilirlik'], contributions: { requiredSections: ['requirements', 'testing'], suggestedSections: [], reviewerRuleIds: ['A11Y'], exportDocumentIds: ['accessibility'] } };
const registry = createModuleRegistry([custom]);
assert.equal(registry.rejected.length, 0);
assert.equal(registry.get('local.accessibility').version, '1.0.0');
const localPreview = previewLocalModuleImport(project, custom);
assert.equal(localPreview.errors.length, 0);
assert.equal(applyLocalModuleImport(project, localPreview).success, false);
const localApplied = applyLocalModuleImport(project, localPreview, { approved: true });
assert.equal(localApplied.success, true);
assert.equal(localApplied.project.modules.localManifests[0].id, 'local.accessibility');
console.log('✓ V4 local declarative module registry');
