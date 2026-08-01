import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { migrateLegacyToV5 } from '../../src/v4/migrations.js';
import { createDocumentSet, createExportBundle, createIdeWorkspaceFiles, createIdeWorkspacePackage, createPromtgenPackage, exportCanonicalMarkdown, inspectPromtgenPackage, readPromtgenPackage, resolveCanonicalRevision } from '../../src/v4/exporter.js';
import { redactSensitiveText } from '../../src/v4/ai-context.js';

const legacy = { id: 'legacy-1', schemaVersion: 3, name: 'Eski Plan', stepDepth: 5, workflowStage: 'EXPORTED', draftDescription: 'Bir yerel not uygulaması', tasks: [{ title: 'Editörü oluştur' }] };
const result = migrateLegacyToV5(legacy);
assert.equal(result.success, true);
assert.deepEqual(result.backup, legacy);
assert.equal(result.project.lifecycle.status, 'finalized');
assert.equal(result.project.lifecycle.activePhase, 'READY');
assert.equal(result.project.exports.length, 1);
assert.equal(result.project.metadata.canonicalModelVersion, 1);
assert.equal(result.project.tasks[0].id, 'task-1');
const docs = createDocumentSet(result.project);
assert.ok(docs['agents/codex.md'].includes('Bir yerel not uygulaması'));
assert.ok(docs['documents/prd.md']);
assert.ok(exportCanonicalMarkdown(result.project).includes('Editörü oluştur'));
const bundle = await createExportBundle(result.project, { adapters: ['codex'] });
assert.equal(bundle.canonicalHash.length, 64);
assert.deepEqual(bundle.record.adapterIds, ['codex']);
assert.equal(bundle.record.canonicalRevision, result.project.canonicalRevision);
const packaged = await createPromtgenPackage(result.project, { adapters: ['codex'] });
assert.equal(packaged.manifest.formatVersion, 3);
assert.ok(packaged.manifest.entries.every(entry => entry.sha256.length === 64 && entry.bytes > 0));
const inspected = await inspectPromtgenPackage(packaged.blob);
assert.equal(inspected.integrity.level, 'full');
assert.equal(inspected.integrity.verifiedEntries, packaged.manifest.entries.length);
const imported = await readPromtgenPackage(packaged.blob);
assert.equal(imported.id, result.project.id);
assert.equal(resolveCanonicalRevision(imported, imported.canonicalRevision).canonicalRevision, imported.canonicalRevision);
const ideFiles = createIdeWorkspaceFiles(result.project, { adapters: ['codex', 'cursor', 'claude'] });
assert.ok(ideFiles.files['AGENTS.md'].includes(`canonical plan **r${result.project.canonicalRevision}**`));
assert.ok(ideFiles.files['.cursor/rules/promtgen-plan.mdc'].includes('alwaysApply: true'));
assert.ok(ideFiles.files['CLAUDE.md'].includes('Zorunlu rol sırası'));
assert.equal(JSON.parse(ideFiles.files['.promtgen/execution.json']).sourceRevision, result.project.canonicalRevision);
assert.throws(() => createIdeWorkspaceFiles(result.project, { adapters: ['unknown'] }), /En az bir IDE/);
const idePackage = await createIdeWorkspacePackage(result.project, { adapters: ['codex', 'cursor'] });
assert.equal(idePackage.manifest.format, 'promtgen-ide-workspace');
assert.equal(idePackage.manifest.canonicalHash.length, 64);
assert.deepEqual(idePackage.record.adapterIds, ['codex', 'cursor']);
const ideZip = await JSZip.loadAsync(await idePackage.blob.arrayBuffer());
assert.ok(ideZip.file('AGENTS.md'));
assert.ok(ideZip.file('.cursor/rules/promtgen-plan.mdc'));
assert.equal(JSON.parse(await ideZip.file('.promtgen/manifest.json').async('string')).sourceRevision, result.project.canonicalRevision);

const tamperedZip = await JSZip.loadAsync(await packaged.blob.arrayBuffer());
tamperedZip.file('plan/master-plan.md', '# değiştirilmiş içerik');
await assert.rejects(
    inspectPromtgenPackage(await tamperedZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })),
    /boyutu doğrulanamadı|bütünlük doğrulamasını geçemedi/
);
const extraEntryZip = await JSZip.loadAsync(await packaged.blob.arrayBuffer());
extraEntryZip.file('unexpected.txt', 'manifest dışında');
await assert.rejects(
    inspectPromtgenPackage(await extraEntryZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })),
    /bütünlük listesi eşleşmiyor/
);

const v2Zip = new JSZip();
v2Zip.file('manifest.json', JSON.stringify({
    format: 'promtgen', formatVersion: 2, schemaVersion: 5, schemaRevision: 5,
    projectId: result.project.id, revision: result.project.canonicalRevision,
    canonicalRevision: result.project.canonicalRevision, canonicalHash: bundle.canonicalHash, files: []
}));
v2Zip.file('project.json', JSON.stringify(result.project));
const v2Inspection = await inspectPromtgenPackage(await v2Zip.generateAsync({ type: 'uint8array' }));
assert.equal(v2Inspection.integrity.level, 'canonical');
assert.equal(v2Inspection.integrity.warnings.length, 1);

const legacyInspection = await inspectPromtgenPackage(await maliciousPackage(JSON.stringify(result.project)));
assert.equal(legacyInspection.integrity.level, 'legacy');

async function maliciousPackage(projectJson, extras = [], compression = 'DEFLATE') {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ format: 'promtgen', formatVersion: 1, schemaVersion: 5, schemaRevision: 1, files: [] }));
    zip.file('project.json', projectJson);
    for (const [name, content] of extras) zip.file(name, content);
    return zip.generateAsync({ type: 'uint8array', compression });
}

const pollutedJson = JSON.stringify(result.project).replace(/^\{/, '{"__proto__":{"polluted":true},');
await assert.rejects(readPromtgenPackage(await maliciousPackage(pollutedJson)), /yasak anahtar/);
const tooManyEntries = Array.from({ length: 499 }, (_, index) => [`entry-${index}.txt`, 'x']);
await assert.rejects(readPromtgenPackage(await maliciousPackage(JSON.stringify(result.project), tooManyEntries)), /500 girdi sınırını/);
await assert.rejects(readPromtgenPackage(await maliciousPackage(JSON.stringify(result.project), [['oversized.txt', 'x'.repeat(5 * 1024 * 1024 + 1)]])), /girdisi çok büyük/);
const inflatedEntries = Array.from({ length: 11 }, (_, index) => [`inflated-${index}.txt`, 'z'.repeat(5 * 1024 * 1024)]);
await assert.rejects(readPromtgenPackage(await maliciousPackage(JSON.stringify(result.project), inflatedEntries)), /açılmış içerik boyutu/);
assert.equal(redactSensitiveText('api_key=super-secret-value'), 'api_key=[REDACTED_SECRET]');
console.log('✓ Legacy migration and canonical V5 exports');
