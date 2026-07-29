import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { AnonymousUserSession } from '../src/v4/benchmarks/comparison-benchmark.js';
import {
  importAnonymousStudySessions,
  summarizeAnonymousStudySessions
} from '../src/v4/benchmarks/study-import.js';

const inputArg = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const checkOnly = process.argv.includes('--check');
if (!inputArg) {
  throw new Error('Kullanım: npm run study:import -- <oturum.json|klasör> [--check]');
}

const inputPath = path.resolve(inputArg);
const inputStat = await stat(inputPath);
const inputFiles = inputStat.isDirectory()
  ? (await readdir(inputPath))
      .filter(name => name.toLocaleLowerCase('tr-TR').endsWith('.json'))
      .sort()
      .map(name => path.join(inputPath, name))
  : [inputPath];
if (!inputFiles.length) throw new Error('İçe aktarılacak JSON dosyası bulunamadı.');

const parsedInputs: unknown[] = [];
for (const file of inputFiles) parsedInputs.push(JSON.parse(await readFile(file, 'utf8')));

const root = path.resolve('benchmarks', 'comparison');
const sessionsPath = path.join(root, 'user-sessions.json');
let existing: AnonymousUserSession[] = [];
try {
  existing = JSON.parse(await readFile(sessionsPath, 'utf8')) as AnonymousUserSession[];
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const result = importAnonymousStudySessions(existing, parsedInputs);
const summary = summarizeAnonymousStudySessions(result.sessions);
if (checkOnly) {
  console.log(`${result.importedCount} anonim oturum doğrulandı; mevcut kayıtlarla birlikte ${summary.validParticipants} benzersiz katılımcı.`);
  process.exit(0);
}

await mkdir(root, { recursive: true });
const temporaryPath = `${sessionsPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(result.sessions, null, 2)}\n`, 'utf8');
await rename(temporaryPath, sessionsPath);
await writeFile(path.join(root, 'user-study-report.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(path.resolve('docs', 'product', 'USER_STUDY_REPORT.md'), `# Anonim Kullanıcı Çalışması

Bu rapor yalnız açık onayla cihazdan dışa aktarılan, izin verilen metrik alanlarını içeren yerel oturum dosyalarından üretilir. Telemetri veya kişisel veri toplamaz.

- Geçerli katılımcı: ${summary.validParticipants}
- Tamamlama oranı: %${Math.round(summary.completionRate * 100)}
- İlk export oranı: %${Math.round(summary.firstExportRate * 100)}
- Küçük düzenlemeyle MVP kabulü: %${Math.round(summary.minorEditMvpAcceptanceRate * 100)}
- Ortalama memnuniyet: ${summary.averageSatisfaction || '—'}/5
- Ortalama süre: ${summary.averageDurationSeconds} saniye
- Ortalama manuel düzenleme: ${summary.averageManualEditCount}

Bu sayılar örneklem ve çalışma tasarımı yeterli olmadan ürün üstünlüğü kanıtı sayılmaz.
`, 'utf8');
console.log(`${result.importedCount} yeni anonim oturum içe aktarıldı; toplam ${summary.validParticipants} benzersiz katılımcı.`);
console.log('Karşılaştırmalı raporu yenilemek için: npm run comparison:benchmark');
