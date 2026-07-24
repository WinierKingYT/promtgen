import assert from 'node:assert/strict';
import { generateDiscoveryBundle, getSeenSuggestionFingerprints, testProviderConnection } from '../../src/v4/ai-discovery.js';
import { analyzeIdea, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { validateSuggestionResponse } from '../../src/v4/ai-context.js';
import { getDefaultProviderSettings } from '../../src/v4/provider-settings.js';

let project = analyzeIdea('Yerel çalışan, SQLite tabanlı, güvenlik ve rol yönetimi destekli bir proje planlama uygulaması yapmak istiyorum.');
const initial = project.suggestionBundles[0];
for (const item of initial.items) project = updateSuggestionStatus(project, initial.id, item.id, item === initial.items[0] ? 'rejected' : 'accepted');

const result = await generateDiscoveryBundle(project, { settings: getDefaultProviderSettings(), direction: 'güvenliğe odaklan' });
assert.equal(result.usedFallback, true);
assert.ok(result.bundle.items.length >= 3 && result.bundle.items.length <= 5);
const seen = getSeenSuggestionFingerprints(project);
assert.ok(result.bundle.items.every(item => !seen.has(item.fingerprint)), 'Yeni tur kabul/reddedilmiş önerileri tekrarlamamalı');
assert.ok(result.bundle.title.includes('güvenliğe odaklan'));

const parsed = validateSuggestionResponse({ summary: 'Özet', options: Array.from({ length: 3 }, (_, index) => ({ title: `Seçenek ${index}`, description: 'Açıklama', pros: ['Artı'], cons: ['Eksi'], effort: 'low', impact: 'high', affectedSections: ['scope'], recommended: index === 0 })), openQuestions: [] });
assert.ok(parsed.options.every(option => option.kind === 'feature'));
assert.throws(() => validateSuggestionResponse({ summary: 'x'.repeat(1201), options: parsed.options, openQuestions: [] }));
assert.throws(() => validateSuggestionResponse({ summary: 'Özet', options: parsed.options.map(option => ({ ...option, affectedSections: ['unknown'] })), openQuestions: [] }));
assert.throws(() => validateSuggestionResponse({ summary: 'Özet', options: parsed.options, openQuestions: Array.from({ length: 13 }, () => 'Soru') }));
const connection = await testProviderConnection(getDefaultProviderSettings());
assert.equal(connection.ok, true);
assert.equal(connection.providerId, 'offline');
assert.equal(connection.message, 'Yerel akıllı motor hazır.');
console.log('✓ V4 AI discovery and provider fallback');
