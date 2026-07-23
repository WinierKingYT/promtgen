import assert from 'node:assert/strict';
import { createProvider } from '../../src/v4/ai-context.js';
import { generateDiscoveryBundle, runConversationalDiscoveryTurn, testProviderConnection } from '../../src/v4/ai-discovery.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { normalizeProviderSettings, validateProviderSettings } from '../../src/v4/provider-url-policy.js';

const originalFetch = globalThis.fetch;
const validPayload = {
    summary: 'Kullanıcı değerini netleştirelim',
    options: Array.from({ length: 3 }, (_, index) => ({
        kind: index === 1 ? 'decision' : 'feature', title: `Canlı seçenek ${index + 1}`,
        description: `Uygulanabilir açıklama ${index + 1}`, pros: ['Netlik'], cons: ['Efor'],
        effort: 'low', impact: 'high', affectedSections: ['scope'], recommended: index === 0
    })),
    openQuestions: ['İlk kullanıcı grubu kim?']
};
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

try {
    let captured;
    globalThis.fetch = async (url, options) => {
        captured = { url, options };
        return response({ choices: [{ message: { content: JSON.stringify(validPayload) } }] });
    };
    const openai = createProvider('openai', { credential: 'test-key', model: 'gpt-test', baseUrl: 'https://api.example/v1' });
    assert.equal((await openai.structured({ system: 'system', context: { secret: 'token=hidden' } })).options.length, 3);
    assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(captured.options.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(captured.options.body).response_format.type, 'json_object');
    assert.ok(!captured.options.body.includes('token=hidden'));

    globalThis.fetch = async (url, options) => {
        captured = { url, options };
        return response({ candidates: [{ content: { parts: [{ text: JSON.stringify(validPayload) }] } }] });
    };
    const gemini = createProvider('gemini', { credential: 'gem-key', model: 'gemini-test' });
    assert.equal((await gemini.structured({ system: 'system', context: {} })).openQuestions.length, 1);
    assert.ok(captured.url.endsWith('/models/gemini-test:generateContent'));
    assert.equal(captured.options.headers['x-goog-api-key'], 'gem-key');
    assert.ok(!captured.url.includes('gem-key'));

    globalThis.fetch = async (url, options) => {
        captured = { url, options };
        return response({ message: { content: JSON.stringify(validPayload) } });
    };
    const ollama = createProvider('ollama', { model: 'local-test', baseUrl: 'http://localhost:11434' });
    assert.equal((await ollama.structured({ system: 'system', context: {} })).options.length, 3);
    assert.equal(captured.url, 'http://localhost:11434/api/chat');
    assert.equal(normalizeProviderSettings({ providerId: 'openai', model: 'gpt-test', baseUrl: 'https://attacker.example/v1' }).baseUrl, 'https://api.openai.com/v1');
    assert.equal(validateProviderSettings({ providerId: 'ollama', model: 'local-test', baseUrl: 'http://169.254.169.254/latest/meta-data' }).valid, false);
    assert.equal(validateProviderSettings({ providerId: 'ollama', model: 'local-test', baseUrl: 'file:///etc/passwd' }).valid, false);
    assert.equal(validateProviderSettings({ providerId: 'ollama', model: 'local-test', baseUrl: 'http://user:pass@localhost:11434' }).valid, false);

    const project = analyzeIdea('Yerel çalışan kişisel proje planlama aracı yapmak istiyorum.');
    globalThis.fetch = async () => response({ choices: [{ message: { content: '{"summary":"eksik","options":[]}' } }] });
    const fallback = await generateDiscoveryBundle(project, { settings: { providerId: 'openai', model: 'gpt-test', baseUrl: 'https://api.example/v1' }, credential: 'test-key' });
    assert.equal(fallback.usedFallback, true);
    assert.equal(fallback.bundle.source.type, 'local');
    assert.ok(fallback.error);

    globalThis.fetch = async (url, options) => {
        captured = { url, options };
        return response({ choices: [{ message: { content: JSON.stringify(validPayload) } }] });
    };
    const beforeMessages = project.messages.length;
    const turn = await runConversationalDiscoveryTurn(project, {
        message: 'Önce tek kişilik kullanım olsun.', focusedQuestion: 'İlk kullanıcı grubu kim?',
        settings: { providerId: 'openai', model: 'gpt-test', baseUrl: 'https://api.example/v1', useLocalMemory: true }, credential: 'test-key',
        memory: { version: 1, sourceProjectCount: 2, depthAffinity: [{ id: 'advanced', count: 2 }] }
    });
    assert.equal(project.messages.length, beforeMessages, 'Girdi proje mutate edilmemeli');
    assert.equal(turn.project.messages.at(-2).role, 'user');
    assert.equal(turn.project.messages.at(-1).role, 'assistant');
    assert.equal(turn.project.suggestionBundles.at(-1).status, 'open');
    assert.ok(turn.project.openQuestions.includes('İlk kullanıcı grubu kim?'));
    assert.ok(captured.options.body.includes('localPlanningMemory'));
    assert.ok(captured.options.body.includes('sourceProjectCount'));

    globalThis.fetch = async () => response({}, 401);
    const auth = await testProviderConnection({ providerId: 'openai', baseUrl: 'https://api.example/v1' }, 'bad-key');
    assert.equal(auth.ok, false);
    assert.equal(auth.errorCode, 'authentication');
    assert.equal(auth.providerId, 'openai');
    assert.equal(typeof auth.latencyMs, 'number');
    const unsafe = await testProviderConnection({ providerId: 'ollama', model: 'test', baseUrl: 'http://example.com:11434' });
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.errorCode, 'configuration');
} finally {
    globalThis.fetch = originalFetch;
}

console.log('✓ V4 provider integration and conversational discovery');
