import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  runDiscoveryBenchmark,
  type DiscoveryBenchmarkReport,
  type DiscoveryBenchmarkScenario
} from '../src/v4/benchmarks/discovery-benchmark.js';

const checkOnly = process.argv.includes('--check');
const scenarioPath = path.resolve('benchmarks', 'discovery', 'scenarios.json');
const reportPath = path.resolve('benchmarks', 'discovery', 'latest-report.json');
const markdownPath = path.resolve('docs', 'product', 'DISCOVERY_BENCHMARK_REPORT.md');
const scenarios = JSON.parse(await readFile(scenarioPath, 'utf8')) as DiscoveryBenchmarkScenario[];

let generatedAt = new Date().toISOString();
if (checkOnly) {
  try {
    const current = JSON.parse(await readFile(reportPath, 'utf8')) as DiscoveryBenchmarkReport;
    generatedAt = current.generatedAt;
  } catch {
    generatedAt = 'missing-report';
  }
}

const report = runDiscoveryBenchmark(scenarios, generatedAt);
const json = `${JSON.stringify(report, null, 2)}\n`;
const rows = report.results.map(result =>
  `| ${result.title} | ${result.category} | ${result.passed ? 'Geçti' : 'Kaldı'} | ${Math.round(result.metrics.concernRecall * 100)}% | ${result.metrics.questionsAsked} | ${result.metrics.correctionFields} | ${result.metrics.interpretationConfidence}% |`
).join('\n');
const markdown = `# Guided Discovery Benchmark Raporu

Bu rapor yalnız ham fikir girdisiyle başlayan üretim discovery zincirini ölçer. Senaryolar hedef kullanıcı, problem, kapsam veya gereksinimleri başlangıç projesine doğrudan eklemez.

Akış:

\`ham fikir → discovery sinyalleri → sistem yorumu ve kritik sorular → simüle kullanıcı düzeltmesi → açık onay → canonical vizyon ve kapsam\`

- Suite: \`${report.suiteId}\`
- Son çalışma: ${report.generatedAt}
- Sonuç: ${report.passedCount}/${report.scenarioCount}
- Başarı oranı: %${Math.round(report.passRate * 100)}
- Kritik sinyal yakalama: %${Math.round(report.aggregate.concernRecall * 100)}
- İlk hedef kullanıcı terim kapsamı: %${Math.round(report.aggregate.initialTargetUserTermRecall * 100)}
- Ortalama kritik soru: ${report.aggregate.averageQuestionsAsked.toFixed(1)}
- Ortalama kullanıcı düzeltme alanı: ${report.aggregate.averageCorrectionFields.toFixed(1)}/8
- Otomatik kullanıcı onayı: ${report.aggregate.automaticConfirmationCount}
- Erken teknik kesinleştirme: ${report.aggregate.prematureTechnicalDecisionCount}

| Senaryo | Tür | Sonuç | Sinyal yakalama | Soru | Düzeltilen alan | İlk güven |
|---|---|---|---:|---:|---:|---:|
${rows}

## Yorumlama sınırı

Bu benchmark gerçek kullanıcı araştırması veya AI sağlayıcı üstünlüğü değildir. Kullanıcı cevapları sürümlenmiş bir simülatörle canonical düzenleme alanlarına uygulanır. Bu nedenle sonuç:

- ham fikirde kritik belirsizliklerin görünür olduğunu,
- sistemin yorumu kendiliğinden onaylamadığını,
- kullanıcı düzeltmesinin canonical kapsamı kayıpsız oluşturduğunu

kanıtlar. Serbest biçimli kullanıcı cevabından doğru structured plan çıkarma kalitesi ve PromtGen'in standart sohbet araçlarına üstünlüğü ayrı kör karşılaştırma verisi gerektirir.
`;

const outputs = [
  [reportPath, json],
  [markdownPath, markdown]
] as const;

if (checkOnly) {
  const mismatches: string[] = [];
  for (const [filePath, expected] of outputs) {
    try {
      const actual = await readFile(filePath, 'utf8');
      if (actual.replace(/\r\n/g, '\n') !== expected.replace(/\r\n/g, '\n')) mismatches.push(path.relative('.', filePath));
    } catch {
      mismatches.push(path.relative('.', filePath));
    }
  }
  if (mismatches.length) {
    console.error(`Discovery benchmark çıktıları güncel değil: ${mismatches.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Discovery benchmark doğrulandı: ${report.passedCount}/${report.scenarioCount} geçti.`);
  }
} else {
  for (const [filePath, content] of outputs) await writeFile(filePath, content, 'utf8');
  console.log(`Discovery benchmark yazıldı: ${report.passedCount}/${report.scenarioCount} geçti.`);
}

if (report.passRate < 0.9) {
  console.error(`Discovery benchmark başarı oranı %${Math.round(report.passRate * 100)}; gerekli sözleşme eşiği %90.`);
  process.exitCode = 1;
}
