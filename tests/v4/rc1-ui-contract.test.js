import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../src/react/App.tsx', import.meta.url), 'utf8');

assert.equal(/\bconfirm\s*\(/.test(app), false, 'RC1 arayüzü tarayıcı confirm penceresine bağlı olmamalı');
assert.equal(/\balert\s*\(/.test(app), false, 'RC1 arayüzü tarayıcı alert penceresine bağlı olmamalı');
assert.match(app, /function FinalizePlanDialog/);
assert.match(app, /aria-labelledby="finalize-dialog-title"/);
assert.match(app, /aria-describedby="finalize-dialog-description"/);
assert.match(app, /Uyarılarla finalleştir/);
assert.match(app, /role="alert"/);
assert.match(app, /role="status"/);

console.log('✓ V4 RC1 accessible UI confirmation contract');
