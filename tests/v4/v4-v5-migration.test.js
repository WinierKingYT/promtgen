import assert from 'node:assert/strict';
import { createProjectStateV4 } from '../../src/v4/project-state-v4.js';
import { migrateV4toV5, migrateToV4, tryMigrateOrPassthrough, LATEST_SCHEMA_VERSION } from '../../src/v4/migrations.js';

const v4Project = createProjectStateV4({ idea: 'Test projesi için migration' });
assert.equal(v4Project.schemaVersion, 4, 'V4 project starts with schemaVersion 4');
assert.ok(v4Project.suggestionBundles !== undefined, 'V4 has suggestionBundles');

const v5Result = migrateV4toV5(v4Project);
assert.equal(v5Result.success, true, 'V4→V5 migration succeeds');
assert.equal(v5Result.project.schemaVersion, 5, 'Migrated project has schemaVersion 5');
assert.ok(v5Result.project.proposalStore, 'Migrated project has proposalStore');
assert.ok(Array.isArray(v5Result.project.proposalStore.bundles), 'proposalStore.bundles is array');
assert.equal(v5Result.project.suggestionBundles, undefined, 'suggestionBundles removed after migration');
assert.ok(v5Result.project.metadata.migratedFromV4, 'Migration metadata recorded');

const alreadyV5 = migrateV4toV5(v5Result.project);
assert.equal(alreadyV5.success, true, 'Already V5 returns success');
assert.equal(alreadyV5.migratedFrom, 5, 'Already V5 reports migratedFrom 5');

const nullResult2 = migrateV4toV5(null);
assert.equal(nullResult2.success, false, 'Null input fails');
assert.ok(nullResult2.error.includes('Geçersiz'), 'Null input error message');

const wrongVersion = migrateV4toV5({ schemaVersion: 3 });
assert.equal(wrongVersion.success, false, 'Wrong version fails');

const passthroughV5 = tryMigrateOrPassthrough(v5Result.project);
assert.equal(passthroughV5.migrated, false, 'V5 passthrough without migration');
assert.equal(passthroughV5.error, null, 'No error for V5 passthrough');

const passthroughV4 = tryMigrateOrPassthrough(v4Project);
assert.equal(passthroughV4.migrated, true, 'V4 gets migrated');
assert.equal(passthroughV4.project.schemaVersion, 5, 'Migrated to V5');

const legacyV3 = { id: 'legacy-3', schemaVersion: 3, name: 'Eski V3', stepDepth: 5, workflowStage: 'DISCOVERY', draftDescription: 'Test', tasks: [] };
const passthroughLegacy = tryMigrateOrPassthrough(legacyV3);
assert.equal(passthroughLegacy.migrated, true, 'Legacy V3 gets migrated');
assert.equal(passthroughLegacy.project.schemaVersion, 5, 'Legacy migrated to V5');

assert.equal(LATEST_SCHEMA_VERSION, 5, 'Latest schema version is 5');

const nullResult = tryMigrateOrPassthrough(null);
assert.equal(nullResult.migrated, false, 'Null input not migrated');

console.log('✓ V4→V5 migration and dual-read passthrough');
