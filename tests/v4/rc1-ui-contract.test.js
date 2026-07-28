import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../src/react/App.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../../src/react/Workspace.tsx', import.meta.url), 'utf8');
const finalizeDialog = readFileSync(new URL('../../src/react/components/FinalizePlanDialog.tsx', import.meta.url), 'utf8');
const revisionDialog = readFileSync(new URL('../../src/react/components/RevisionHistoryDialog.tsx', import.meta.url), 'utf8');

const productionUi = `${app}\n${workspace}`;
assert.equal(/\bconfirm\s*\(/.test(productionUi), false, 'RC1 arayüzü tarayıcı confirm penceresine bağlı olmamalı');
assert.equal(/\balert\s*\(/.test(productionUi), false, 'RC1 arayüzü tarayıcı alert penceresine bağlı olmamalı');
assert.match(app, /import \{ Workspace \}/);
assert.match(workspace, /const FinalizePlanDialog = lazy\(\(\) => import\('\.\/components\/FinalizePlanDialog\.js'\)/);
assert.match(workspace, /<FinalizePlanDialog/);
assert.match(finalizeDialog, /aria-labelledby="finalize-dialog-title"/);
assert.match(finalizeDialog, /aria-describedby="finalize-dialog-description"/);
assert.match(finalizeDialog, /kritik koşul tamamlanmadı/);
assert.doesNotMatch(finalizeDialog, /Uyarılarla finalleştir/);
assert.match(revisionDialog, /role="alert"/);
assert.match(revisionDialog, /role="status"/);

console.log('✓ V4 RC1 accessible UI confirmation contract');
