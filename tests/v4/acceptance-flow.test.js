import assert from 'node:assert/strict';
import { normalizeRequirement } from '../../src/v4/canonical-entities.js';
import { createIdeWorkspacePackage, createPromtgenPackage, exportCanonicalMarkdown, readPromtgenPackage } from '../../src/v4/exporter.js';
import { analyzeIdea, applyApprovedChanges, finalizePlan, reopenPlan, updatePlanSection, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { applyCompiledTaskPlan, compileTaskPlan } from '../../src/v4/task-compiler.js';

let project = analyzeIdea('Yerel çalışan küçük bir alışkanlık takip aracı planlamak istiyorum.');
assert.ok(['quick', 'standard'].includes(project.planningDepth.recommended));
const bundle = project.suggestionBundles[0];
const unchangedRevision = project.revision;
assert.equal(applyApprovedChanges(project, bundle.id).revision, unchangedRevision, 'Pending öneriler plana uygulanmamalı');

for (let index = 0; index < bundle.items.length; index += 1) {
    const item = bundle.items[index];
    const status = index === 0 ? 'accepted' : index === 1 ? 'edited' : index === 2 ? 'rejected' : 'deferred';
    project = updateSuggestionStatus(project, bundle.id, item.id, status, status === 'edited' ? 'Veri yalnız cihazda saklanacak ve kullanıcı dışa aktarabilecek.' : '');
}
project = applyApprovedChanges(project, bundle.id);
assert.equal(project.suggestionBundles[0].status, 'resolved');
assert.ok(project.revision > unchangedRevision);
assert.ok(project.dismissedSuggestionFingerprints.length > 0);
assert.ok(Object.values(project.sections).some(section => section.sourceSuggestionIds.length > 0));

project.requirements.push(normalizeRequirement({ id: 'req-local-save', title: 'Yerel kayıt', statement: 'Kayıtlar cihazda kalıcı tutulmalı.', acceptanceCriteria: ['Uygulama yeniden açıldığında kayıtlar görünür.'], status: 'accepted' }));
project = updatePlanSection(project, 'vision', { content: 'Kişisel alışkanlıkları çevrimdışı ve güvenli biçimde takip etmeyi kolaylaştır.' });
project = updatePlanSection(project, 'scope', { content: 'Tek kullanıcı, yerel kayıt ve temel ilerleme görünümü.' });
const compilation = compileTaskPlan(project);
assert.ok(compilation.tasks.length > 0);
assert.equal(applyCompiledTaskPlan(project, compilation).success, false, 'Görev taslağı açık onay olmadan uygulanmamalı');
const approvedTasks = applyCompiledTaskPlan(project, compilation, { approved: true });
assert.equal(approvedTasks.success, true);
project = approvedTasks.project;
assert.deepEqual(project.agentPrompts.map(prompt => prompt.role), ['planner', 'implementer', 'reviewer', 'verifier']);

const finalized = finalizePlan(project, true);
assert.equal(finalized.success, true);
assert.equal(finalized.project.lifecycle.status, 'finalized');
assert.equal(finalized.project.lifecycle.activePhase, 'READY');
const finalRevision = finalized.project.revision;
const canonicalMarkdown = exportCanonicalMarkdown(finalized.project);
assert.ok(canonicalMarkdown.includes('Kişisel alışkanlıkları'));
assert.ok(canonicalMarkdown.includes('Yerel kayıt'));

const portable = await createPromtgenPackage(finalized.project, { adapters: ['codex'] });
const imported = await readPromtgenPackage(portable.blob);
assert.equal(imported.revision, finalRevision);
assert.equal(exportCanonicalMarkdown(imported), canonicalMarkdown);
const ide = await createIdeWorkspacePackage(imported, { adapters: ['codex', 'cursor'] });
assert.equal(ide.manifest.sourceRevision, finalRevision);
assert.ok(ide.files['AGENTS.md'].includes('Yerel kayıt'));
assert.ok(ide.files['.cursor/rules/promtgen-plan.mdc'].includes('alwaysApply: true'));

const reopened = reopenPlan(imported);
assert.equal(reopened.lifecycle.status, 'active');
assert.equal(reopened.revision, finalRevision + 1);
assert.ok(reopened.revisions.some(revision => revision.number === finalRevision));

console.log('✓ V4 end-to-end canonical planning acceptance flow');
