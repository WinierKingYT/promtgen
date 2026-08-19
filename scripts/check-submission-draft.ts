import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  evaluateBlindSubmission,
  type BlindComparisonSubmission
} from '../src/v4/benchmarks/comparison-benchmark.js';

/**
 * Bir gönderim taslağını çalışmaya girmeden önce denetler.
 *
 * Pilotun ortaya çıkardığı ihtiyaç: `submissions.json` elle dolduruluyor ve
 * bir alan eksik/yanlışsa bu ancak rapor üretilirken, yani bütün veri
 * toplandıktan SONRA anlaşılıyordu. Kayıt sırasında söylemek, 18 gönderimin
 * sonunda söylemekten iyidir.
 *
 * Kullanım:  tsx scripts/check-submission-draft.ts <dosya.json> [--study=comparison-v2]
 */

const file = process.argv.find(argument => argument.endsWith('.json'));
if (!file) {
  console.error('Kullanım: tsx scripts/check-submission-draft.ts <dosya.json> [--study=comparison-v2]');
  process.exit(1);
}

const studyArgument = process.argv.find(argument => argument.startsWith('--study='));
const studyDirectory = studyArgument ? studyArgument.slice('--study='.length) : 'comparison-v2';
const study = JSON.parse(readFileSync(path.resolve('benchmarks', studyDirectory, 'study.json'), 'utf8')) as {
  scenarios: Array<{ id: string }>;
  evaluationCriteria: string[];
};

const raw = JSON.parse(readFileSync(path.resolve(file), 'utf8')) as unknown;
const drafts: BlindComparisonSubmission[] = Array.isArray(raw) ? raw : [raw as BlindComparisonSubmission];

const scenarioIds = new Set(study.scenarios.map(scenario => scenario.id));
const problems: string[] = [];

for (const draft of drafts) {
  const label = draft.blindId || '(kimliksiz)';

  // Yöntem sızıntısı en pahalı hata: körlük bozulunca çalışma geri alınamaz.
  for (const key of Object.keys(draft as Record<string, unknown>)) {
    if (/method|yontem|provider|arm|kol/i.test(key)) {
      problems.push(`${label}: "${key}" alanı yöntemi ele veriyor; kör gönderimde bulunamaz.`);
    }
  }
  const serialized = JSON.stringify(draft).toLowerCase();
  for (const leak of ['promtgen', 'master-prompt', 'baseline-chat', 'ollama', 'qwen', 'gemini', 'nvidia']) {
    if (serialized.includes(leak)) {
      problems.push(`${label}: metin içinde "${leak}" geçiyor; yöntem ya da sağlayıcı adı gönderime yazılmaz.`);
    }
  }

  if (!scenarioIds.has(draft.scenarioId)) {
    problems.push(`${label}: scenarioId "${draft.scenarioId}" çalışmanın senaryo listesinde yok.`);
  }

  try {
    evaluateBlindSubmission(draft, study.evaluationCriteria);
  } catch (error) {
    problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`${drafts.length} taslakta ${problems.length} sorun bulundu.`);
  process.exit(1);
}

console.log(`${drafts.length} gönderim taslağı geçerli; çalışmaya alınabilir.`);
