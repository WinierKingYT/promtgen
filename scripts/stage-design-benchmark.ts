import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  runStageDesignBenchmark,
  type StageDesignReport,
  type StageDesignScenario
} from '../src/v4/benchmarks/stage-design-benchmark.js';

const checkOnly = process.argv.includes('--check');
const scenarioPath = path.resolve('benchmarks', 'stage-design', 'scenarios.json');
const reportPath = path.resolve('benchmarks', 'stage-design', 'latest-report.json');
const markdownPath = path.resolve('docs', 'product', 'STAGE_DESIGN_BENCHMARK_REPORT.md');
const scenarios = JSON.parse(await readFile(scenarioPath, 'utf8')) as StageDesignScenario[];

if (scenarios.length < 4 || new Set(scenarios.map(item => item.id)).size !== scenarios.length) {
  throw new Error('Aşama tasarımı benchmark\'ı en az 4 benzersiz senaryo içermeli.');
}
// Bilinmeyen alan senaryosu zorunlu: "bilinmeyen proje türü = PromtGen
// çalışmıyor" durumu kabul edilemez ve bunu ölçmeyen bir suite bunu kanıtlamaz.
if (!scenarios.some(scenario => scenario.category === 'other')) {
  throw new Error('Suite en az bir bilinmeyen alan (category: other) senaryosu içermeli.');
}

let generatedAt = new Date().toISOString();
if (checkOnly) {
  try {
    generatedAt = (JSON.parse(await readFile(reportPath, 'utf8')) as StageDesignReport).generatedAt;
  } catch {
    generatedAt = 'missing-report';
  }
}

const report = runStageDesignBenchmark(scenarios, generatedAt);
const json = `${JSON.stringify(report, null, 2)}\n`;
const rows = report.results.map(result => {
  const checks = result.checks;
  const mark = (value: boolean) => (value ? '✓' : '✗');
  return `| ${result.title} | ${result.category} | ${result.passed ? 'Geçti' : 'Kaldı'} | ${Math.round(checks.concernRecall * 100)}% | ${mark(checks.topQuestionCorrect)} | ${mark(checks.gateRefusedWhileBlocked)} | ${mark(checks.gateOpenedWhenClear)} | ${mark(checks.candidateFilterCorrect)} | ${mark(checks.adrLinkEnforced)} |`;
}).join('\n');

const markdown = `# Aşama Tasarımı Benchmark Raporu

Bu suite Idea Design ve Solution Design aşamalarının **çekirdek davranışını** ölçer.

- Suite: \`${report.suiteId}\`
- Son çalışma: ${report.generatedAt}
- Sonuç: ${report.passedCount}/${report.scenarioCount}
- Başarı oranı: %${Math.round(report.passRate * 100)}
- Kritik konu yakalama: %${Math.round(report.aggregate.concernRecall * 100)}
- İlk soru isabeti: %${Math.round(report.aggregate.topQuestionAccuracy * 100)}

| Senaryo | Alan | Sonuç | Konu yakalama | İlk soru | Kapı reddi | Kapı açılışı | Aday süzgeci | ADR bağı |
|---|---|---|---:|:-:|:-:|:-:|:-:|:-:|
${rows}

## Ne ölçer, ne ölçmez

AI çıktısı **sabittir**; bu suite model kalitesini ölçmez. Ölçtüğü şey, V3'ün
söz verdiği davranışların gerçekten kodda olması:

1. Kritik konular keşfediliyor mu — bilinmeyen alanda da,
2. İlk soru en yüksek bilgi kazançlısı mı (isim etiketi rengi değil, sahiplik modeli),
3. Kapı bloklayan konu varken onayı reddediyor, çözülünce açıyor mu,
4. Gerekçesiz geri dönülemez teknoloji önerisi eleniyor mu,
5. ADR'ye bağlanmamış teknik karar kapıya takılıyor mu.

Ayrım kasıtlı: **sağlayıcı değişince bu benchmark'ın sonucu değişmemeli.**
Değişirse ölçtüğü şey davranış değil, modelin o günkü hâli olurdu. Gerçek
model kalitesi ve kullanıcı faydası ayrı kör karşılaştırma verisi gerektirir
(bkz. \`COMPARISON_STUDY_PROTOCOL.md\`).

Bilinmeyen alan senaryosu (arı kovanı izleme) suite'te **zorunludur**: alan
paketi olmayan bir projede PromtGen'in çalışmaması kabul edilebilir bir sonuç
değil ve bunu ölçmeyen bir suite bunu kanıtlamaz.
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
    console.error(`Aşama tasarımı benchmark çıktıları güncel değil: ${mismatches.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Aşama tasarımı benchmark doğrulandı: ${report.passedCount}/${report.scenarioCount} geçti.`);
  }
} else {
  for (const [filePath, content] of outputs) await writeFile(filePath, content, 'utf8');
  console.log(`Aşama tasarımı benchmark yazıldı: ${report.passedCount}/${report.scenarioCount} geçti.`);
}

// Eşik diğer suite'lerle aynı. Altına düşen bir sonuç sessizce raporlanmaz.
if (report.passRate < 0.9) {
  for (const result of report.results.filter(item => !item.passed)) {
    console.error(`  ${result.title}: ${result.failures.join(' · ')}`);
  }
  console.error(`Aşama tasarımı benchmark başarı oranı %${Math.round(report.passRate * 100)}; gerekli eşik %90.`);
  process.exitCode = 1;
}
