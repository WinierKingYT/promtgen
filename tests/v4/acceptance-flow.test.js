import assert from 'node:assert/strict';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { createIdeWorkspacePackage, createPromtgenPackage, exportCanonicalMarkdown, readPromtgenPackage } from '../../src/v4/exporter.js';
import { analyzeIdea, applyApprovedChanges, confirmConceptSummary, finalizePlan, reopenPlan, updatePlanSection, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../../src/v4/task-compiler.js';

let project = analyzeIdea('Yerel çalışan küçük bir alışkanlık takip aracı planlamak istiyorum.');
assert.ok(['quick', 'standard'].includes(project.planningDepth.recommended));
const bundle = project.proposalStore.bundles[0];
const unchangedRevision = project.canonicalRevision;
assert.equal(applyApprovedChanges(project, bundle.id).canonicalRevision, unchangedRevision, 'Pending öneriler plana uygulanmamalı');

for (let index = 0; index < bundle.items.length; index += 1) {
    const item = bundle.items[index];
    const status = index === 0 ? 'accepted' : index === 1 ? 'edited' : index === 2 ? 'rejected' : 'deferred';
    project = updateSuggestionStatus(project, bundle.id, item.id, status, status === 'edited' ? 'Veri yalnız cihazda saklanacak ve kullanıcı dışa aktarabilecek.' : '');
}
project = applyApprovedChanges(project, bundle.id);
assert.equal(project.proposalStore.bundles[0].status, 'resolved');
assert.ok(project.canonicalRevision > unchangedRevision);
assert.ok(project.dismissedSuggestionFingerprints.length > 0);
assert.ok(Object.values(project.sections).some(section => section.sourceSuggestionIds.length > 0));

project.ideaLabSession.conceptSummary = {
    summary: 'Yerel çalışan küçük bir alışkanlık takip aracı.',
    targetUser: 'Kişisel alışkanlıklarını takip etmek isteyen bireysel kullanıcılar',
    problemStatement: 'Kullanıcı alışkanlıklarını düzenli ve izlenebilir biçimde takip edemiyor.',
    currentAlternative: 'Kağıt üzerinde takip veya genel amaçlı not uygulamaları',
    desiredOutcome: 'Çevrimdışı, güvenli ve kolay bir alışkanlık takip deneyimi',
    interpretationConfidence: 90,
    confidenceRationale: ['Kullanıcı tarafından doğrulandı.'],
    confirmedFeatures: ['Alışkanlık ekleme', 'İlerleme görünümü'],
    outOfScope: ['Bulut senkronizasyonu'],
    technicalApproaches: [],
    openQuestions: [],
    knownRisks: ['Kapsamın kullanıcı doğrulaması olmadan genişlemesi'],
    mvpTarget: 'Alışkanlık ekleme ve ilerleme görünümünü tamamlayan ilk sürüm',
    userConfirmed: false
};
project = confirmConceptSummary(project);
project.requirements.push(normalizeRequirement({ id: 'req-local-save', title: 'Yerel kayıt', statement: 'Kayıtlar cihazda kalıcı tutulmalı.', priority: 'must', acceptanceCriteria: ['Uygulama yeniden açıldığında kayıtlar görünür.'], status: 'accepted' }));
project = updatePlanSection(project, 'vision', { content: 'Kişisel alışkanlıkları çevrimdışı ve güvenli biçimde takip etmeyi kolaylaştır.' });
project = updatePlanSection(project, 'scope', { content: 'Tek kullanıcı, yerel kayıt ve temel ilerleme görünümü.' });
const compilation = compileTaskPlan(project);
assert.ok(compilation.tasks.length > 0);
assert.equal(applyCompiledTaskPlan(project, compilation).success, false, 'Görev taslağı açık onay olmadan uygulanmamalı');
const approvedTasks = applyCompiledTaskPlan(project, compilation, { approved: true });
assert.equal(approvedTasks.success, true);
project = approvedTasks.project;
assert.deepEqual(project.agentPrompts.map(prompt => prompt.role), ['planner', 'implementer', 'reviewer', 'verifier']);

for (const risk of project.risks) {
    if (risk.status === 'open' && risk.impact === 'high') {
        risk.owner = 'Proje sahibi';
        risk.mitigation = risk.mitigation || 'Riski azaltan görev planlama sırasında doğrulanacak.';
    }
}
for (let pass = 0; pass < 3; pass += 1) {
    for (const [id, section] of Object.entries(project.sections)) {
        if (section.required && (section.status === 'stale' || (!section.content && !section.items.length))) {
            project = updatePlanSection(project, id, { content: section.content || `${section.title} kullanıcı kararlarıyla doğrulandı.` });
        }
    }
}
const finalized = finalizePlan(project);
assert.equal(finalized.success, true, finalized.blockers.join(' · '));
assert.equal(finalized.project.lifecycle.status, 'finalized');
assert.equal(finalized.project.lifecycle.activePhase, 'READY');
const finalRevision = finalized.project.canonicalRevision;
const canonicalMarkdown = exportCanonicalMarkdown(finalized.project);
assert.ok(canonicalMarkdown.includes('Kişisel alışkanlıkları'));
assert.ok(canonicalMarkdown.includes('Yerel kayıt'));

const portable = await createPromtgenPackage(finalized.project, { adapters: ['codex'] });
const imported = await readPromtgenPackage(portable.blob);
assert.equal(imported.canonicalRevision, finalRevision);
assert.equal(exportCanonicalMarkdown(imported), canonicalMarkdown);
const ide = await createIdeWorkspacePackage(imported, { adapters: ['codex', 'cursor'] });
assert.equal(ide.manifest.sourceRevision, finalRevision);
assert.ok(ide.files['AGENTS.md'].includes('Yerel kayıt'));
assert.ok(ide.files['.cursor/rules/promtgen-plan.mdc'].includes('alwaysApply: true'));

const reopened = reopenPlan(imported);
assert.equal(reopened.lifecycle.status, 'active');
assert.equal(reopened.canonicalRevision, finalRevision + 1);
assert.ok(reopened.revisions.some(revision => revision.number === finalRevision));

console.log('✓ V4 end-to-end canonical planning acceptance flow');
