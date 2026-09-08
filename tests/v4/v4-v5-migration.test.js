import assert from 'node:assert/strict';
import { createLegacyProjectStateV4, isLegacyProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { migrateV4toV5, tryMigrateOrPassthrough, LATEST_SCHEMA_VERSION, LATEST_SCHEMA_REVISION } from '../../src/v4/migrations.js';
import { MemoryProjectRepository } from '../../src/v4/storage.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

const v4Project = createLegacyProjectStateV4({ idea: 'Test projesi için migration' });
v4Project.sections.vision.items.push('Korunacak plan girdisi');
v4Project.requirements.push({ id: 'req-legacy', title: 'Legacy kayıt', statement: 'Legacy veri korunmalı.', kind: 'functional', priority: 'must', acceptanceCriteria: ['Kayıt korunur.'], sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted' });
v4Project.tasks.push({ id: 'task-legacy', title: 'Legacy görevi', description: 'Legacy veriyi koru.', status: 'ready', priority: 'must', effort: 'low', dependencies: [], requirementIds: ['req-legacy'], acceptanceCriteria: ['Kayıt korunur.'], verificationIds: ['test-legacy'] });
v4Project.testCases.push({ id: 'test-legacy', title: 'Legacy test', kind: 'acceptance', preconditions: [], steps: [], expectedResult: 'Başarılı', requirementIds: [], status: 'draft' });
v4Project.traceLinks = [];
v4Project.agentPrompts.push({ id: 'prompt-legacy', role: 'implementer', title: 'Legacy prompt', instructions: 'Uygula', taskIds: [], dependsOnPromptIds: [], expectedOutputs: [], status: 'draft' });
v4Project.executionSessions.push({ id: 'execution-legacy', adapterId: 'generic', sourceRevision: 1, status: 'proposed', worktreeLabel: '', steps: [], createdAt: '', updatedAt: '' });
v4Project.exports.push({ id: 'export-legacy', format: 'markdown', revision: 1, createdAt: new Date().toISOString() });
v4Project.revisions.push({ id: 'revision-legacy', number: 1, createdAt: new Date().toISOString(), summary: 'Legacy', acceptedSuggestionIds: [], affectedSections: ['vision'], snapshot: { ...structuredClone(v4Project), revisions: [] } });

const v5Result = migrateV4toV5(v4Project);
assert.equal(v5Result.success, true, 'V4→V5 migration succeeds');
assert.equal(v5Result.project.schemaVersion, 5);
assert.equal(v5Result.project.schemaRevision, 7);
assert.deepEqual(v5Result.backup, v4Project, 'Original V4 document is backed up without mutation');
assert.equal(v5Result.project.suggestionBundles, undefined);
assert.ok(Array.isArray(v5Result.project.proposalStore.bundles));
assert.equal(v5Result.project.sections.vision.items[0], 'Korunacak plan girdisi');
assert.equal(v5Result.project.testCases[0].id, 'test-legacy');
assert.equal(v5Result.project.tasks[0].contract.version, 2);
assert.equal(v5Result.project.tasks[0].contract.filePolicy.status, 'requires_inventory');
assert.ok(v5Result.project.tasks[0].contract.rollbackPlan);
assert.equal(v5Result.project.agentPrompts[0].id, 'prompt-legacy');
assert.equal(v5Result.project.executionSessions[0].id, 'execution-legacy');
assert.equal(v5Result.project.exports[0].id, 'export-legacy');
assert.equal(v5Result.project.revisions[0].id, 'revision-legacy');

// EP-08′ — Geçiş şeffaflığı: V2 akışında ilerlemiş (gereksinim + görev taşıyan)
// bir proje V3 onay adımlarını gözden geçirmesi için uyarı taşır; ama sistem
// kullanıcı adına onay UYDURMAZ, ideaDesign taslak kalır.
assert.equal(v5Result.project.ideaDesign.approval.status, 'draft', 'Uyarı bırakılır ama onay uydurulmaz');
assert.ok(
  Array.isArray(v5Result.project.metadata.migrationWarnings)
    && v5Result.project.metadata.migrationWarnings.some(warning => /V2 modelinde ilerlemişti/.test(warning)),
  'İlerlemiş V2 projesi migration sonrası açıklayıcı uyarı taşır'
);

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
assert.equal(repository.projects.get(v4Project.id).schemaRevision, 7, 'Migration is persisted after validation');
assert.equal(repository.migrationBackups.get(v4Project.id).projectSnapshot.schemaVersion, 4, 'Original record is backed up before migration commit');

const legacyV3 = { id: 'legacy-3', schemaVersion: 3, name: 'Eski V3', stepDepth: 5, workflowStage: 'DISCOVERY', draftDescription: 'Test', tasks: [] };
const passthroughLegacy = tryMigrateOrPassthrough(legacyV3);
assert.equal(passthroughLegacy.migrated, true);
assert.equal(passthroughLegacy.project.schemaVersion, 5);
// EP-08′ negatif durum: hiç ilerlememiş (gereksinim/karar/görev yok) bir eski
// proje gereksiz "gözden geçir" uyarısı taşımaz.
assert.ok(
  !(passthroughLegacy.project.metadata.migrationWarnings || []).some(warning => /V2 modelinde ilerlemişti/.test(warning)),
  'Boş bir eski proje gereksiz geçiş uyarısı taşımaz'
);

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
assert.equal(LATEST_SCHEMA_REVISION, 7);
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
  firstReleaseTarget: 'Yerel çalışan plan',
  userConfirmed: true,
  confirmedAt: '2026-07-27T10:00:00.000Z'
};
const migratedConcept = tryMigrateOrPassthrough(revisionTwoConcept);
assert.equal(migratedConcept.migrated, true);
assert.equal(migratedConcept.project.ideaLabSession.conceptSummary.summary, 'Korunması gereken eski sistem yorumu');
assert.equal(migratedConcept.project.ideaLabSession.conceptSummary.userConfirmed, false);
assert.ok(migratedConcept.project.ideaLabSession.conceptSummary.targetUser);
assert.match(migratedConcept.project.ideaLabSession.conceptSummary.openQuestions.join(' '), /migration sonrası doğrulanmalı/i);

const schema54Project = createProjectDocument({ idea: 'Schema 5.4 görev sözleşmesi migration testi' });
schema54Project.schemaRevision = 4;
schema54Project.requirements.push({ id: 'req-54', title: 'Eski görev kaynağı', statement: 'Eski görev korunmalı.', kind: 'functional', priority: 'must', acceptanceCriteria: ['Görev korunur.'], sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted' });
schema54Project.tasks.push({ id: 'task-54', title: 'Eski görev', description: 'Eski görevi uygula.', status: 'ready', priority: 'must', effort: 'low', dependencies: [], requirementIds: ['req-54'], acceptanceCriteria: ['Görev korunur.'], verificationIds: [] });
const migratedSchema54 = tryMigrateOrPassthrough(schema54Project);
assert.equal(migratedSchema54.migrated, true);
assert.equal(migratedSchema54.project.schemaRevision, 7);
assert.equal(migratedSchema54.project.tasks[0].contract.version, 2);
assert.equal(migratedSchema54.project.tasks[0].contract.filePolicy.status, 'requires_inventory');
assert.equal(tryMigrateOrPassthrough(null).migrated, false);

// isLegacyProjectStateV4 had zero test coverage before this conversion; pin its
// current (schemaVersion-only) behaviour rather than the fuller shape check its
// name implies.
assert.equal(isLegacyProjectStateV4(v4Project), true, 'Bir V4 belgesi V4 olarak tanınır');
assert.equal(isLegacyProjectStateV4(v5Result.project), false, 'Bir V5 belgesi V4 olarak tanınmaz');
assert.equal(isLegacyProjectStateV4(null), false, 'null V4 olarak tanınmaz');
assert.equal(isLegacyProjectStateV4(undefined), false, 'undefined V4 olarak tanınmaz');
assert.equal(isLegacyProjectStateV4('schemaVersion: 4'), false, 'Nesne olmayan bir değer V4 olarak tanınmaz');
assert.equal(isLegacyProjectStateV4({ schemaVersion: 4 }), true, 'Yalnızca schemaVersion alanı kontrol edilir; şeklin geri kalanı doğrulanmaz');

// ── V3-04b-2 · `mvpTarget` → `firstReleaseTarget` alan adı göçü.
//
// Bu alan ÜÇ yerde kaydedilir ve yalnız birini düzelten bir göç, kullanıcının
// kendi geçmişini sessizce boşaltırdı: kayıp ne tip hatası ne test düşürürdü,
// yalnız ekranda boşalmış bir alan olurdu. Test bu yüzden üç konumu da AYRI
// tanınabilir değerlerle kurar ve göçten sonra belgeyi özyinelemeli tarayıp
// hiçbir yerde eski anahtarın kalmadığını kanıtlar.
//
// Fikstür bilerek 5.7'dir: bugün diskte duran belge budur ve
// `tryMigrateOrPassthrough` onu `migrateLegacyToV5`e hiç uğratmadan
// passthrough dalına sokar. Göç `normalizeProjectDocument` içinde durduğu için
// o dal da kapsanır -- eşleme yalnız `migrations.js` içinde olsaydı en yaygın
// okuma yolu kaçardı.
const LEGACY_LIVE_TARGET = 'Canlı özet: tek depoda sayım akışını bitiren ilk sürüm';
const LEGACY_IDEA_REVISION_TARGET = 'Fikir sürümü anlık görüntüsündeki ilk sürüm hedefi';
const LEGACY_PLAN_LIVE_TARGET = 'Plan sürümü kopyasındaki canlı ilk sürüm hedefi';
const LEGACY_PLAN_IDEA_TARGET = 'Plan sürümü kopyasındaki fikir sürümü hedefi';

const legacyConceptSummary = target => ({
    summary: 'Depo sayım aracı',
    targetUser: 'Tek depo sorumlusu',
    problemStatement: 'Sayım kâğıt üzerinde yapılıyor.',
    currentAlternative: 'Excel tablosu',
    desiredOutcome: 'Sayım hatası düşüyor.',
    interpretationConfidence: 60,
    confidenceRationale: ['Göç testi için elle kurulan fikstür.'],
    confirmedFeatures: ['Sayım başlat'],
    outOfScope: ['Bulut senkronizasyonu'],
    technicalApproaches: [],
    openQuestions: [],
    knownRisks: [],
    mvpTarget: target,
    userConfirmed: true,
    confirmedAt: '2026-08-01T10:00:00.000Z'
});

const legacyIdeaRevision = target => ({
    id: 'idea-rev-1', number: 1, documentRevision: 1, canonicalRevision: 1,
    createdAt: '2026-08-01T10:00:00.000Z', summary: 'İlk fikir sürümü',
    source: 'initial', status: 'draft',
    convertedCanonicalRevision: null, restoredFromRevision: null,
    snapshot: {
        summary: 'Depo sayım aracı', targetUser: 'Tek depo sorumlusu',
        problemStatement: 'Sayım kâğıt üzerinde yapılıyor.', currentAlternative: 'Excel tablosu',
        desiredOutcome: 'Sayım hatası düşüyor.', confirmedFeatures: ['Sayım başlat'],
        outOfScope: ['Bulut senkronizasyonu'], technicalApproaches: [], openQuestions: [], knownRisks: [],
        mvpTarget: target
    }
});

/** Belgede eski anahtarın kaldığı her yolu döndürür; boş dizi = temiz göç. */
function findLegacyTargetKeys(value, trail = '$', hits = []) {
    if (!value || typeof value !== 'object') return hits;
    if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'mvpTarget')) hits.push(trail);
    for (const [key, child] of Object.entries(value)) findLegacyTargetKeys(child, `${trail}.${key}`, hits);
    return hits;
}

const legacyTargetProject = createProjectDocument({ idea: 'Depo sayım aracı alan göçü testi' });
legacyTargetProject.ideaLabSession.conceptSummary = legacyConceptSummary(LEGACY_LIVE_TARGET);
legacyTargetProject.ideaDocumentRevisions = [legacyIdeaRevision(LEGACY_IDEA_REVISION_TARGET)];
// `PlanRevision.snapshot` bir `Omit<ProjectDocumentV5,'revisions'>`tir: kendi
// `ideaLabSession` ve `ideaDocumentRevisions`ını taşıyan TAM bir proje kopyası.
// Üçüncü konum burasıdır ve yalnız üst seviyeyi düzelten bir göç onu kaçırır.
const legacyPlanSnapshot = structuredClone(legacyTargetProject);
delete legacyPlanSnapshot.revisions;
legacyPlanSnapshot.ideaLabSession.conceptSummary = legacyConceptSummary(LEGACY_PLAN_LIVE_TARGET);
legacyPlanSnapshot.ideaDocumentRevisions = [legacyIdeaRevision(LEGACY_PLAN_IDEA_TARGET)];
legacyTargetProject.revisions = [{
    id: 'plan-rev-1', number: 1, createdAt: '2026-08-02T10:00:00.000Z',
    summary: 'İlk plan sürümü', acceptedSuggestionIds: [], affectedSections: ['scope'],
    snapshot: legacyPlanSnapshot
}];

assert.equal(legacyTargetProject.schemaRevision, LATEST_SCHEMA_REVISION, 'Fikstür güncel sürümde olmalı; göç passthrough dalında sınanıyor');
assert.equal(findLegacyTargetKeys(legacyTargetProject).length, 4, 'Fikstür eski anahtarı dört konumda taşımalı');

const migratedTarget = tryMigrateOrPassthrough(legacyTargetProject);
assert.equal(migratedTarget.error, null);
assert.equal(migratedTarget.project.ideaLabSession.conceptSummary.firstReleaseTarget, LEGACY_LIVE_TARGET, 'Canlı özet göç etti');
assert.equal(migratedTarget.project.ideaDocumentRevisions[0].snapshot.firstReleaseTarget, LEGACY_IDEA_REVISION_TARGET, 'Fikir sürümü anlık görüntüsü göç etti');
assert.equal(migratedTarget.project.revisions[0].snapshot.ideaLabSession.conceptSummary.firstReleaseTarget, LEGACY_PLAN_LIVE_TARGET, 'Plan sürümü kopyasındaki canlı özet göç etti');
assert.equal(migratedTarget.project.revisions[0].snapshot.ideaDocumentRevisions[0].snapshot.firstReleaseTarget, LEGACY_PLAN_IDEA_TARGET, 'Plan sürümü kopyasındaki fikir sürümü göç etti');
assert.deepEqual(findLegacyTargetKeys(migratedTarget.project), [], 'Göçten sonra belgede hiçbir yerde eski anahtar kalmamalı');

// İkinci geçiş değerleri bozmaz: göç idempotenttir.
const migratedTargetTwice = tryMigrateOrPassthrough(migratedTarget.project);
assert.equal(migratedTargetTwice.project.ideaLabSession.conceptSummary.firstReleaseTarget, LEGACY_LIVE_TARGET);
assert.deepEqual(findLegacyTargetKeys(migratedTargetTwice.project), []);

// Yeni ad zaten yazılıysa eski anahtar onu EZMEZ; yalnız düşürülür.
const bothKeysProject = createProjectDocument({ idea: 'Alan adı çakışması testi' });
bothKeysProject.ideaLabSession.conceptSummary = legacyConceptSummary('Eski anahtarın değeri');
bothKeysProject.ideaLabSession.conceptSummary.firstReleaseTarget = 'Yeni anahtarın değeri';
const bothKeysMigrated = tryMigrateOrPassthrough(bothKeysProject);
assert.equal(bothKeysMigrated.project.ideaLabSession.conceptSummary.firstReleaseTarget, 'Yeni anahtarın değeri');
assert.deepEqual(findLegacyTargetKeys(bothKeysMigrated.project), []);

// Eski şema dalı da aynı eşlemeyi görmeli: `migrateLegacyToV5` `ideaLabSession`ı
// körlemesine klonlar, eşleme `normalizeProjectDocument` içinde durur.
const legacySchemaProject = {
    id: 'legacy-target', schemaVersion: 3, name: 'Eski kayıt', stepDepth: 5,
    workflowStage: 'DISCOVERY', draftDescription: 'Depo sayım aracı', tasks: [],
    ideaLabSession: { status: 'active', approaches: [], ideaNotes: [], candidateDecisions: [], candidateRisks: [], conceptSummary: legacyConceptSummary(LEGACY_LIVE_TARGET) },
    ideaDocumentRevisions: [legacyIdeaRevision(LEGACY_IDEA_REVISION_TARGET)]
};
const legacySchemaMigrated = tryMigrateOrPassthrough(legacySchemaProject);
assert.equal(legacySchemaMigrated.migrated, true);
assert.equal(legacySchemaMigrated.project.ideaLabSession.conceptSummary.firstReleaseTarget, LEGACY_LIVE_TARGET);
assert.equal(legacySchemaMigrated.project.ideaDocumentRevisions[0].snapshot.firstReleaseTarget, LEGACY_IDEA_REVISION_TARGET);
assert.deepEqual(findLegacyTargetKeys(legacySchemaMigrated.project), []);

console.log('✓ mvpTarget → firstReleaseTarget migrates at all three persisted locations');

console.log('✓ lossless V4→V5 migration, passthrough and rollback');
