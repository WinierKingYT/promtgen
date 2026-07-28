import assert from 'node:assert/strict';
import { createLegacyProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { migrateV4toV5, tryMigrateOrPassthrough, LATEST_SCHEMA_VERSION, LATEST_SCHEMA_REVISION } from '../../src/v4/migrations.js';
import { MemoryProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

const v4Project = createLegacyProjectStateV4({ idea: 'Test projesi için migration' });
v4Project.sections.vision.items.push('Korunacak plan girdisi');
v4Project.testCases.push({ id: 'test-legacy', title: 'Legacy test', kind: 'acceptance', preconditions: [], steps: [], expectedResult: 'Başarılı', requirementIds: [], status: 'draft' });
v4Project.traceLinks = [];
v4Project.agentPrompts.push({ id: 'prompt-legacy', role: 'implementer', title: 'Legacy prompt', instructions: 'Uygula', taskIds: [], dependsOnPromptIds: [], expectedOutputs: [], status: 'draft' });
v4Project.executionSessions.push({ id: 'execution-legacy', adapterId: 'generic', sourceRevision: 1, status: 'proposed', worktreeLabel: '', steps: [], createdAt: '', updatedAt: '' });
v4Project.exports.push({ id: 'export-legacy', format: 'markdown', revision: 1, createdAt: new Date().toISOString() });
v4Project.revisions.push({ id: 'revision-legacy', number: 1, createdAt: new Date().toISOString(), summary: 'Legacy', acceptedSuggestionIds: [], affectedSections: ['vision'], snapshot: { ...structuredClone(v4Project), revisions: [] } });

const v5Result = migrateV4toV5(v4Project);
assert.equal(v5Result.success, true, 'V4→V5 migration succeeds');
assert.equal(v5Result.project.schemaVersion, 5);
assert.equal(v5Result.project.schemaRevision, 3);
assert.deepEqual(v5Result.backup, v4Project, 'Original V4 document is backed up without mutation');
assert.equal(v5Result.project.suggestionBundles, undefined);
assert.ok(Array.isArray(v5Result.project.proposalStore.bundles));
assert.equal(v5Result.project.sections.vision.items[0], 'Korunacak plan girdisi');
assert.equal(v5Result.project.testCases[0].id, 'test-legacy');
assert.equal(v5Result.project.agentPrompts[0].id, 'prompt-legacy');
assert.equal(v5Result.project.executionSessions[0].id, 'execution-legacy');
assert.equal(v5Result.project.exports[0].id, 'export-legacy');
assert.equal(v5Result.project.revisions[0].id, 'revision-legacy');

const passthroughV5 = tryMigrateOrPassthrough(v5Result.project);
assert.equal(passthroughV5.migrated, false);
assert.equal(passthroughV5.error, null);

const passthroughV4 = tryMigrateOrPassthrough(v4Project);
assert.equal(passthroughV4.migrated, true);
assert.equal(passthroughV4.project.schemaVersion, 5);

const repository = new MemoryProjectRepository();
repository.projects.set(v4Project.id, structuredClone(v4Project));
const migratedOnRead = await repository.get(v4Project.id);
assert.equal(migratedOnRead.schemaVersion, 5, 'Repository read upgrades legacy data');
assert.equal(repository.projects.get(v4Project.id).schemaRevision, 3, 'Migration is persisted after validation');
assert.equal(repository.migrationBackups.get(v4Project.id).projectSnapshot.schemaVersion, 4, 'Original record is backed up before migration commit');

const legacyV3 = { id: 'legacy-3', schemaVersion: 3, name: 'Eski V3', stepDepth: 5, workflowStage: 'DISCOVERY', draftDescription: 'Test', tasks: [] };
const passthroughLegacy = tryMigrateOrPassthrough(legacyV3);
assert.equal(passthroughLegacy.migrated, true);
assert.equal(passthroughLegacy.project.schemaVersion, 5);

const corruptV4 = createLegacyProjectStateV4({ idea: 'Bozuk proje' });
corruptV4.tasks.push({ id: 'task-corrupt', title: 'Bozuk görev', requirementIds: ['missing-requirement'] });
const corruptResult = tryMigrateOrPassthrough(corruptV4);
assert.equal(corruptResult.migrated, false);
assert.match(corruptResult.error, /kabul edilmiş olmayan gereksinime/);
assert.deepEqual(corruptResult.project, corruptV4, 'Failure rolls back to the untouched source');
assert.deepEqual(corruptResult.backup, corruptV4);

assert.equal(migrateV4toV5(null).success, false);
assert.equal(migrateV4toV5({ schemaVersion: 3 }).success, false);
assert.equal(LATEST_SCHEMA_VERSION, 5);
assert.equal(LATEST_SCHEMA_REVISION, 3);
const revisionOne = createProjectDocument({ idea: 'Eski revision alanı migration testi' });
const legacyRevisionValue = 7;
const revisionOnePayload = {
  ...revisionOne,
  schemaRevision: 1,
  revision: legacyRevisionValue
};
delete revisionOnePayload.documentRevision;
delete revisionOnePayload.canonicalRevision;
const revisionTwoResult = tryMigrateOrPassthrough(revisionOnePayload);
assert.equal(revisionTwoResult.migrated, true);
assert.equal(revisionTwoResult.project.documentRevision, legacyRevisionValue);
assert.equal(revisionTwoResult.project.canonicalRevision, legacyRevisionValue);
assert.equal('revision' in revisionTwoResult.project, false);

const revisionTwoConcept = createProjectDocument({ idea: 'Eski yorum sözleşmesi migration testi' });
revisionTwoConcept.schemaRevision = 2;
revisionTwoConcept.ideaLabSession.conceptSummary = {
  summary: 'Korunması gereken eski sistem yorumu',
  confirmedFeatures: ['Yerel kayıt'],
  outOfScope: ['Bulut senkronizasyonu'],
  technicalApproaches: ['IndexedDB'],
  knownRisks: ['Tarayıcı kotası'],
  openQuestions: [],
  mvpTarget: 'Yerel çalışan plan',
  userConfirmed: true,
  confirmedAt: '2026-07-27T10:00:00.000Z'
};
const migratedConcept = tryMigrateOrPassthrough(revisionTwoConcept);
assert.equal(migratedConcept.migrated, true);
assert.equal(migratedConcept.project.ideaLabSession.conceptSummary.summary, 'Korunması gereken eski sistem yorumu');
assert.equal(migratedConcept.project.ideaLabSession.conceptSummary.userConfirmed, false);
assert.ok(migratedConcept.project.ideaLabSession.conceptSummary.targetUser);
assert.match(migratedConcept.project.ideaLabSession.conceptSummary.openQuestions.join(' '), /migration sonrası doğrulanmalı/i);
assert.equal(tryMigrateOrPassthrough(null).migrated, false);

console.log('✓ lossless V4→V5 migration, passthrough and rollback');
