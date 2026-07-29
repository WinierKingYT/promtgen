import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Kanonik sahiplerden import edilir. ai-context.js ve ai-discovery.js yalnız
// export-only compatibility yüzeyleridir ve MODULE_STATUS.md gereği benchmark
// import grafiğinde yer almamalıdır.
import { createProvider } from '../src/v4/ai/provider-adapters.js';
import { testProviderConnection } from '../src/v4/ai/provider-connection.js';
import { generateDiscoveryBundle } from '../src/v4/application/idea-planning-api.js';
import { analyzeIdea } from '../src/v4/planning-engine.js';
import { validateProviderSettings, normalizeProviderSettings } from '../src/v4/provider-url-policy.js';

interface Assertion { label: string; passed: boolean }
interface Capture { url: string; options: { headers?: Record<string, string>; body?: string } }

const originalFetch = globalThis.fetch;
const VALID_DISCOVERY = {
  summary: 'Kullanıcı değerini netleştirelim',
  options: Array.from({ length: 3 }, (_, index) => ({
    kind: index === 1 ? 'decision' : 'feature',
    title: `Canlı seçenek ${index + 1}`,
    description: `Uygulanabilir açıklama ${index + 1}`,
    pros: ['Netlik'], cons: ['Efor'],
    effort: 'low', impact: 'high',
    affectedSections: ['scope'], recommended: index === 0
  })),
  openQuestions: ['İlk kullanıcı grubu kim?']
};

const httpResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

/** Records every outbound request so scenarios can assert on what actually left the process. */
function stubFetch(handler: (url: string, options: Capture['options']) => unknown) {
  const captures: Capture[] = [];
  globalThis.fetch = (async (url: string, options: Capture['options'] = {}) => {
    captures.push({ url: String(url), options });
    const outcome = handler(String(url), options);
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }) as unknown as typeof globalThis.fetch;
  return captures;
}

const idea = 'Yerel çalışan kişisel proje planlama aracı yapmak istiyorum.';
const cloudSettings = { providerId: 'openai', model: 'gpt-test', baseUrl: 'https://api.example/v1' };

// --- 1 -----------------------------------------------------------------------
async function endpointPinning(): Promise<Assertion[]> {
  const captures = stubFetch(() => httpResponse({ choices: [{ message: { content: JSON.stringify(VALID_DISCOVERY) } }] }));
  const openai = createProvider('openai', { credential: 'k', model: 'gpt-test', baseUrl: 'https://attacker.example/v1' });
  await openai.structured({ system: 's', context: {} });
  const nvidia = normalizeProviderSettings({ providerId: 'nvidia', model: 'm', baseUrl: 'https://attacker.example' });
  const openaiNormalized = normalizeProviderSettings({ providerId: 'openai', model: 'm', baseUrl: 'https://attacker.example' });
  return [
    { label: 'OpenAI isteği sabit resmi endpointe gitti', passed: captures[0]?.url === 'https://api.openai.com/v1/chat/completions' },
    { label: 'Saldırgan baseUrl hiçbir isteğe sızmadı', passed: captures.every(item => !item.url.includes('attacker.example')) },
    { label: 'OpenAI baseUrl normalizasyonda sabitleniyor', passed: openaiNormalized.baseUrl === 'https://api.openai.com/v1' },
    { label: 'NVIDIA baseUrl normalizasyonda sabitleniyor', passed: nvidia.baseUrl === 'https://integrate.api.nvidia.com/v1' }
  ];
}

// --- 2 -----------------------------------------------------------------------
async function ollamaLoopbackOnly(): Promise<Assertion[]> {
  const rejected = [
    ['Bulut metadata IP', 'http://169.254.169.254/latest/meta-data'],
    ['Yerel dosya şeması', 'file:///etc/passwd'],
    ['URL içinde kimlik bilgisi', 'http://user:pass@localhost:11434'],
    ['Loopback dışı host', 'http://example.com:11434'],
    ['Ek yol eki', 'http://127.0.0.1:11434/api/chat'],
    ['Sorgu parametresi', 'http://127.0.0.1:11434?x=1']
  ] as const;
  const accepted = [
    ['Varsayılan loopback', 'http://127.0.0.1:11434'],
    ['localhost adı', 'http://localhost:11434']
  ] as const;
  return [
    ...rejected.map(([label, baseUrl]) => ({
      label: `Reddedildi — ${label}`,
      passed: validateProviderSettings({ providerId: 'ollama', model: 'local-test', baseUrl }).valid === false
    })),
    ...accepted.map(([label, baseUrl]) => ({
      label: `Kabul edildi — ${label}`,
      passed: validateProviderSettings({ providerId: 'ollama', model: 'local-test', baseUrl }).valid === true
    }))
  ];
}

// --- 3 -----------------------------------------------------------------------
async function credentialIsolation(): Promise<Assertion[]> {
  const secret = 'sk-super-secret-credential-value';
  const openaiCaptures = stubFetch(() => httpResponse({ choices: [{ message: { content: JSON.stringify(VALID_DISCOVERY) } }] }));
  const openai = createProvider('openai', { credential: secret, model: 'gpt-test', baseUrl: 'https://api.example/v1' });
  await openai.structured({ system: 's', context: { note: 'api_key=embedded-project-secret-value' } });

  const geminiCaptures = stubFetch(() => httpResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_DISCOVERY) }] } }] }));
  const gemini = createProvider('gemini', { credential: secret, model: 'gemini-test' });
  await gemini.structured({ system: 's', context: {} });

  const all = [...openaiCaptures, ...geminiCaptures];
  return [
    { label: 'OpenAI kimlik bilgisi Authorization başlığında', passed: openaiCaptures[0]?.options.headers?.Authorization === `Bearer ${secret}` },
    { label: 'Gemini kimlik bilgisi x-goog-api-key başlığında', passed: geminiCaptures[0]?.options.headers?.['x-goog-api-key'] === secret },
    { label: 'Kimlik bilgisi hiçbir URL içinde geçmiyor', passed: all.every(item => !item.url.includes(secret)) },
    { label: 'Kimlik bilgisi hiçbir istek gövdesinde geçmiyor', passed: all.every(item => !String(item.options.body || '').includes(secret)) },
    { label: 'Proje bağlamındaki sır gövdeye taşınmadı', passed: all.every(item => !String(item.options.body || '').includes('embedded-project-secret-value')) }
  ];
}

// --- 4 -----------------------------------------------------------------------
async function schemaFailureFallback(): Promise<Assertion[]> {
  stubFetch(() => httpResponse({ choices: [{ message: { content: '{"summary":"eksik","options":[]}' } }] }));
  const project = analyzeIdea(idea);
  const result = await generateDiscoveryBundle(project, { settings: cloudSettings, credential: 'k' });
  return fallbackAssertions('Şema dışı yanıt', result);
}

// --- 5 -----------------------------------------------------------------------
async function transportFailureFallback(): Promise<Assertion[]> {
  const project = analyzeIdea(idea);
  stubFetch(() => new Error('ECONNREFUSED'));
  const thrown = await generateDiscoveryBundle(project, { settings: cloudSettings, credential: 'k' });
  stubFetch(() => httpResponse({}, 500));
  const serverError = await generateDiscoveryBundle(project, { settings: cloudSettings, credential: 'k' });
  return [
    ...fallbackAssertions('Ağ hatası', thrown),
    ...fallbackAssertions('HTTP 500', serverError)
  ];
}

/** Öneriler pakette `items` altında durur; `options` sağlayıcı yanıtının alanıdır. */
function fallbackAssertions(label: string, result: {
  usedFallback: boolean;
  error: string | null;
  bundle: { source?: { type?: string; providerId?: string; fallbackReason?: string | null }; items?: unknown[] };
}): Assertion[] {
  return [
    { label: `${label} — fallback devreye girdi`, passed: result.usedFallback === true },
    { label: `${label} — kaynak yerel olarak etiketlendi`, passed: result.bundle?.source?.type === 'local' },
    { label: `${label} — fallback nedeni kaydedildi`, passed: Boolean(result.bundle?.source?.fallbackReason) },
    { label: `${label} — kullanıcıya hata mesajı verildi`, passed: Boolean(result.error) },
    { label: `${label} — yine de kullanılabilir öneri üretildi`, passed: Array.isArray(result.bundle?.items) && result.bundle.items.length > 0 }
  ];
}

// --- 6 -----------------------------------------------------------------------
async function connectionDiagnostics(): Promise<Assertion[]> {
  const cases = [
    ['authentication', 401], ['authentication', 403], ['endpoint', 404],
    ['rate_limit', 429], ['provider', 503]
  ] as const;
  const assertions: Assertion[] = [];
  for (const [expected, status] of cases) {
    stubFetch(() => httpResponse({}, status));
    const outcome = await testProviderConnection({ providerId: 'openai', model: 'gpt-test', baseUrl: 'https://api.example/v1' }, 'k');
    assertions.push({
      label: `HTTP ${status} → errorCode "${expected}"`,
      passed: outcome.ok === false && outcome.errorCode === expected
    });
  }
  stubFetch(() => new Error('offline'));
  const network = await testProviderConnection({ providerId: 'openai', model: 'gpt-test', baseUrl: 'https://api.example/v1' }, 'k');
  const unsafe = await testProviderConnection({ providerId: 'ollama', model: 'm', baseUrl: 'http://example.com:11434' });
  const offline = await testProviderConnection({ providerId: 'offline', model: 'promtgen-local', baseUrl: '' });
  return [
    ...assertions,
    { label: 'Ağ hatası → errorCode "network"', passed: network.ok === false && network.errorCode === 'network' },
    { label: 'Güvensiz Ollama adresi → errorCode "configuration"', passed: unsafe.ok === false && unsafe.errorCode === 'configuration' },
    { label: 'Offline sağlayıcı ağ olmadan hazır bildiriyor', passed: offline.ok === true && offline.errorCode === null }
  ];
}

// --- 7 -----------------------------------------------------------------------
async function offlineMakesNoNetworkCall(): Promise<Assertion[]> {
  const project = analyzeIdea(idea);
  const offlineCaptures = stubFetch(() => httpResponse({ choices: [{ message: { content: JSON.stringify(VALID_DISCOVERY) } }] }));
  const offline = await generateDiscoveryBundle(project, { settings: { providerId: 'offline', model: 'promtgen-local', baseUrl: '' } });
  const offlineCallCount = offlineCaptures.length;

  const disabledCaptures = stubFetch(() => httpResponse({ choices: [{ message: { content: JSON.stringify(VALID_DISCOVERY) } }] }));
  const disabled = await generateDiscoveryBundle(project, {
    settings: { ...cloudSettings, useAiWhenAvailable: false },
    credential: 'k'
  });
  return [
    { label: 'Offline modda hiç ağ isteği yapılmadı', passed: offlineCallCount === 0 },
    { label: 'Offline modda yerel öneri üretildi', passed: offline.usedFallback === true && Array.isArray(offline.bundle?.items) && offline.bundle.items.length > 0 },
    { label: 'Offline fallback hata mesajı üretmiyor', passed: offline.error === null },
    { label: 'AI kapalıyken hiç ağ isteği yapılmadı', passed: disabledCaptures.length === 0 },
    { label: 'AI kapalıyken yerel öneri üretildi', passed: disabled.usedFallback === true }
  ];
}

const scenarios = [
  { id: 'endpoint-pinning', title: 'Bulut endpoint sabitleme', intent: 'Kullanıcıdan gelen baseUrl bulut sağlayıcıları için yok sayılmalı; istek yalnız resmi adrese gitmeli.', run: endpointPinning },
  { id: 'ollama-loopback-only', title: 'Ollama yalnız loopback', intent: 'Yerel sağlayıcı adresi SSRF yüzeyine dönüşmemeli; metadata IP, file:// ve loopback dışı host reddedilmeli.', run: ollamaLoopbackOnly },
  { id: 'credential-isolation', title: 'Kimlik bilgisi izolasyonu', intent: 'API anahtarı yalnız başlıkta taşınmalı; URL, gövde veya proje bağlamı üzerinden sızmamalı.', run: credentialIsolation },
  { id: 'schema-failure-fallback', title: 'Şema dışı yanıtta fallback', intent: 'Sağlayıcı geçersiz yapı döndürdüğünde yerel kural motoru devralmalı ve etiket kalıcı olmalı.', run: schemaFailureFallback },
  { id: 'transport-failure-fallback', title: 'Taşıma hatasında fallback', intent: 'Ağ hatası ve HTTP 500 aynı fallback sözleşmesini üretmeli.', run: transportFailureFallback },
  { id: 'connection-diagnostics', title: 'Bağlantı tanılama kodları', intent: 'Her başarısızlık sınıfı kullanıcının düzeltebileceği ayrı bir errorCode üretmeli.', run: connectionDiagnostics },
  { id: 'offline-local-first', title: 'Offline local-first garantisi', intent: 'Offline modda ve AI kapalıyken hiçbir ağ isteği yapılmamalı.', run: offlineMakesNoNetworkCall }
];

const results = [];
try {
  for (const scenario of scenarios) {
    const assertions = await scenario.run();
    results.push({
      id: scenario.id,
      title: scenario.title,
      intent: scenario.intent,
      passed: assertions.every(item => item.passed),
      assertionCount: assertions.length,
      failedAssertions: assertions.filter(item => !item.passed).map(item => item.label),
      assertions
    });
  }
} finally {
  globalThis.fetch = originalFetch;
}

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'ai-discovery-provider',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/providers/ai-discovery/latest-report.json');
const markdownPath = resolve('docs/product/PROVIDER_INTEGRATION_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-provider-integration-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# AI Sağlayıcı Entegrasyonu Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti (${results.reduce((sum, item) => sum + item.assertionCount, 0)} doğrulama).`,
  '',
  '| Senaryo | Sonuç | Doğrulama |',
  '|---|---:|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} | ${item.assertionCount} |`),
  '',
  '## Ölçülen davranış',
  '',
  ...scenarios.map(item => `- **${item.title}** — ${item.intent}`),
  '',
  '## Bu benchmarkın kanıtlamadıkları',
  '',
  '- Gerçek sağlayıcıya ağ çağrısı yapılmaz; `fetch` stub üzerinden sözleşme ölçülür.',
  '  Bu, sağlayıcının yanıt kalitesini değil PromtGen tarafındaki sınırları doğrular.',
  '- Üretilen plan önerisinin isabetli olduğunu göstermez; yalnız fallback ve etiketleme',
  '  sözleşmesinin bozulmadığını gösterir.',
  '- Sağlayıcının kendi veri saklama politikası kapsam dışıdır.',
  '- Ollama performansı kullanıcı donanımına bağlıdır ve ölçülmez.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/provider-integration-benchmark.ts tarafından üretilir.',
  'export const PROVIDER_INTEGRATION_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/PROVIDER_INTEGRATION_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const files = [
    [jsonPath, json],
    [markdownPath, markdown],
    [evidencePath, evidence]
  ] as const;
  const stale = files.filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Sağlayıcı entegrasyon kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Provider integration benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) {
  for (const item of results.filter(entry => !entry.passed)) {
    console.error(`  ✗ ${item.id}: ${item.failedAssertions.join(' | ')}`);
  }
  process.exit(1);
}
