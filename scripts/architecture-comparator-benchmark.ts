import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createProjectDocument } from '../src/v4/project-document.js';
import {
  generateLocalIdeaLabOutput,
  generateConceptSummaryProject
} from '../src/v4/application/deterministic-idea-planning.js';

/**
 * Mimari Karşılaştırma Şablonu bir statik şablondur, hesaplayıcı değildir.
 * Bu benchmark onu olduğu gibi ölçer: üç yaklaşımın her zaman sunulduğunu,
 * başlıkların alana göre değiştiğini, ve METRİKLERİN HESAPLANMADIĞINI —
 * yani yeteneğin beyan ettiği sınırın gerçekten doğru olduğunu.
 */

interface Assertion { label: string; passed: boolean }

const ideaFor = (idea: string) => createProjectDocument({ idea });
const lab = (idea: string) => generateLocalIdeaLabOutput(ideaFor(idea));

const DOMAIN_IDEAS = {
  game: 'S&box içinde çok oyunculu at yarışı oyunu ve fizik tabanlı sürüş yapmak istiyorum',
  web: 'Küçük ekipler için web tabanlı görev takip ve raporlama uygulaması yapmak istiyorum',
  mobile: 'Offline çalışan mobil alışveriş listesi uygulaması yapmak istiyorum',
  ai: 'RAG tabanlı doküman soru cevap sistemi ve model fallback yönetimi yapmak istiyorum'
};

function threeApproachesAlwaysOffered(): Assertion[] {
  const results = Object.values(DOMAIN_IDEAS).map(lab);
  return [
    { label: 'Her fikir için tam üç yaklaşım sunulur', passed: results.every(item => item.approaches.length === 3) },
    {
      label: 'Yaklaşım kimlikleri sabit ve benzersiz',
      passed: results.every(item => item.approaches.map(a => a.id).join(',') === 'approach-simple,approach-modular,approach-advanced')
    },
    {
      label: 'Tam olarak bir yaklaşım önerilen işaretli',
      passed: results.every(item => item.approaches.filter(a => a.recommended).length === 1)
    },
    {
      label: 'Önerilen her zaman orta (modüler) seçenektir',
      passed: results.every(item => item.approaches.find(a => a.recommended)?.id === 'approach-modular')
    },
    {
      label: 'Her yaklaşım açıklama, artı ve eksi taşır',
      passed: results.every(item => item.approaches.every(a => a.description.length > 0 && a.pros.length > 0 && a.cons.length > 0))
    }
  ];
}

function domainAwareTitles(): Assertion[] {
  const titles = Object.fromEntries(
    Object.entries(DOMAIN_IDEAS).map(([domain, idea]) => [domain, lab(idea).approaches.map(a => a.title).join(' | ')])
  );
  const unique = new Set(Object.values(titles));
  return [
    { label: 'Oyun ve web farklı başlıklar üretir', passed: titles.game !== titles.web },
    { label: 'Mobil ve AI farklı başlıklar üretir', passed: titles.mobile !== titles.ai },
    { label: 'Dört alan da birbirinden ayrışır', passed: unique.size === 4 },
    {
      label: 'Aynı fikir aynı başlıkları üretir (deterministik)',
      passed: lab(DOMAIN_IDEAS.web).approaches.map(a => a.title).join('|') === lab(DOMAIN_IDEAS.web).approaches.map(a => a.title).join('|')
    }
  ];
}

/** Yeteneğin en kritik dürüstlük iddiası burada ölçülür. */
function metricsAreDeclaredAssumptions(): Assertion[] {
  const fingerprints = Object.values(DOMAIN_IDEAS).map(idea =>
    lab(idea).approaches.map(a => `${a.metrics.effortScore}-${a.metrics.networkLoad}-${a.metrics.fpsImpact}-${a.metrics.maintainability}`).join(' / ')
  );
  const allIdentical = new Set(fingerprints).size === 1;
  const web = lab(DOMAIN_IDEAS.web).approaches;
  return [
    // "Otomatik benchmark hesaplanmaz; değerler kullanıcı varsayımıdır" iddiası
    // ancak metrikler projeden türetilmiyorsa doğrudur. Ölçülen tam olarak budur.
    { label: 'Metrikler alandan bağımsız aynıdır (hesaplanmıyor)', passed: allIdentical },
    { label: 'Sade yaklaşım en düşük eforu taşır', passed: web[0].metrics.effortScore === 1 },
    { label: 'Modüler yaklaşım orta eforu taşır', passed: web[1].metrics.effortScore === 3 },
    { label: 'Gelişmiş yaklaşım en yüksek eforu taşır', passed: web[2].metrics.effortScore === 5 },
    {
      label: 'Metrikler 1-5 aralığında kalır',
      passed: web.every(a => Object.values(a.metrics).every(value => value >= 1 && value <= 5))
    }
  ];
}

function effortOrderingIsMonotonic(): Assertion[] {
  const approaches = lab(DOMAIN_IDEAS.web).approaches;
  const efforts = approaches.map(a => a.effort);
  const scores = approaches.map(a => a.metrics.effortScore);
  return [
    { label: 'Efor etiketleri low → medium → high', passed: efforts.join(',') === 'low,medium,high' },
    { label: 'Efor skorları artan sırada', passed: scores[0] < scores[1] && scores[1] < scores[2] },
    { label: 'Sade yaklaşım hızlı doğrulama vaat eder', passed: approaches[0].pros.includes('Hızlı doğrulama') },
    { label: 'Gelişmiş yaklaşım yüksek ilk efor riskini bildirir', passed: approaches[2].cons.includes('Yüksek ilk efor') }
  ];
}

function selectionPrecedence(): Assertion[] {
  const base = ideaFor(DOMAIN_IDEAS.web);

  const explicit = generateConceptSummaryProject(base, 'approach-advanced');
  const fallbackRecommended = generateConceptSummaryProject(base, '');
  const unknownSelection = generateConceptSummaryProject(base, 'approach-does-not-exist');

  return [
    { label: 'Açık seçim uygulanır', passed: explicit.ideaLabSession?.selectedApproachId === 'approach-advanced' },
    { label: 'Seçim yoksa önerilen kullanılır', passed: fallbackRecommended.ideaLabSession?.selectedApproachId === 'approach-modular' },
    { label: 'Bilinmeyen seçim önerilene düşer', passed: unknownSelection.ideaLabSession?.selectedApproachId === 'approach-modular' },
    {
      label: 'Seçilen yaklaşım konsept özetine taşınır',
      passed: explicit.ideaLabSession?.conceptSummary?.technicalApproaches?.length === 1
    },
    // Şablon canonical planı kendiliğinden onaylamaz.
    { label: 'Konsept kullanıcı onayı bekler', passed: explicit.ideaLabSession?.conceptSummary?.userConfirmed === false },
    { label: 'Girdi projesi değiştirilmez', passed: base.ideaLabSession?.selectedApproachId === undefined }
  ];
}

function preferenceChipsPresent(): Assertion[] {
  const results = Object.values(DOMAIN_IDEAS).map(lab);
  return [
    {
      label: 'Her yaklaşım en az bir tercih çipi taşır',
      passed: results.every(item => item.approaches.every(a => (a.presetAnswers?.length || 0) > 0))
    },
    {
      label: 'Çipler köşeli parantez biçiminde sunulur',
      passed: results.every(item => item.approaches.every(a => (a.presetAnswers?.[0] || '').startsWith('[')))
    },
    {
      label: 'Aday risk listesi boş değil',
      passed: results.every(item => item.candidateRisks.length > 0)
    },
    {
      label: 'Aday kararlar üretilir',
      passed: results.every(item => item.candidateDecisions.length > 0)
    }
  ];
}

const scenarios = [
  { id: 'three-approaches-always-offered', title: 'Üç yaklaşım her zaman sunulur', intent: 'Karşılaştırma matrisi her fikir için sade/modüler/gelişmiş üçlüsünü ve tek bir öneriyi vermeli.', run: threeApproachesAlwaysOffered },
  { id: 'domain-aware-titles', title: 'Başlıklar alana göre değişir', intent: 'Oyun, web, mobil ve AI projeleri farklı mimari adlandırmaları almalı.', run: domainAwareTitles },
  { id: 'metrics-are-declared-assumptions', title: 'Metrikler hesaplanmaz, varsayımdır', intent: 'Yeteneğin "otomatik hesaplanmaz" beyanı doğru olmalı; metrikler projeden türetilmemeli.', run: metricsAreDeclaredAssumptions },
  { id: 'effort-ordering-is-monotonic', title: 'Efor sıralaması tutarlı', intent: 'Efor etiketi ve skoru sade→gelişmiş yönünde artmalı, riskler buna uygun bildirilmeli.', run: effortOrderingIsMonotonic },
  { id: 'selection-precedence', title: 'Seçim önceliği', intent: 'Kullanıcı seçimi öneriyi geçmeli; seçim yoksa önerilene, o da yoksa ilkine düşmeli.', run: selectionPrecedence },
  { id: 'preference-chips-present', title: 'Tercih çipleri ve aday kayıtlar', intent: 'Her yaklaşım hızlı seçim çipi taşımalı; aday karar ve risk listeleri üretilmeli.', run: preferenceChipsPresent }
];

const results = scenarios.map(scenario => {
  const assertions = scenario.run();
  return {
    id: scenario.id,
    title: scenario.title,
    intent: scenario.intent,
    passed: assertions.every(item => item.passed),
    assertionCount: assertions.length,
    failedAssertions: assertions.filter(item => !item.passed).map(item => item.label),
    assertions
  };
});

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'architecture-comparator-template',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/idea-lab/architecture-comparator/latest-report.json');
const markdownPath = resolve('docs/product/ARCHITECTURE_COMPARATOR_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-architecture-comparator-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Mimari Karşılaştırma Şablonu Benchmark',
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
  '- Bu bir şablondur, hesaplayıcı değildir. Benchmark önerilen mimarinin **doğru**',
  '  olduğunu göstermez; şablonun tutarlı, alan farkındalı ve dürüst davrandığını gösterir.',
  '- Metrik değerleri gerçek ölçüme değil başlangıç varsayımına dayanır. Bu bir eksiklik',
  '  değil, açıkça beyan edilmiş sınırdır ve `metrics-are-declared-assumptions` senaryosu',
  '  tam olarak bu beyanın doğruluğunu ölçer.',
  '- Maliyet, operasyon yükü ve vendor lock-in puanları proje verisinden türetilmez;',
  '  kullanıcı tarafından düzenlenmek üzere sunulur.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/architecture-comparator-benchmark.ts tarafından üretilir.',
  'export const ARCHITECTURE_COMPARATOR_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/ARCHITECTURE_COMPARATOR_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const files = [[jsonPath, json], [markdownPath, markdown], [evidencePath, evidence]] as const;
  const stale = files.filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Mimari karşılaştırma kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Architecture comparator benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) {
  for (const item of results.filter(entry => !entry.passed)) {
    console.error(`  ✗ ${item.id}: ${item.failedAssertions.join(' | ')}`);
  }
  process.exit(1);
}
