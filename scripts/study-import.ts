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
  throw new Error('Kullanım: npm run study:import -- <oturum.json|klasör> --study=<çalışma-adı> [--check]');
}

/**
 * Hangi çalışma? Varsayılan YOK — bilinçli bir tercih.
 *
 * comparison-benchmark.ts'nin aksine bu betik veri toplar (yazar), rapor
 * üretmez. Sessiz bir varsayılan, bugünün oturumlarını donmuş `comparison`
 * (v1) çalışmasına gömerdi — düzeltilen hatanın ta kendisi. Bu yüzden
 * `--study=` burada zorunludur: hangi çalışmaya veri eklendiği her seferinde
 * açıkça belirtilir, sessizce yanlış (ve dondurulmuş) çalışmaya yazılmaz.
 */
const studyArgument = process.argv.find(argument => argument.startsWith('--study='));
if (!studyArgument) {
  throw new Error('Kullanım: npm run study:import -- <oturum.json|klasör> --study=<çalışma-adı> [--check]. `--study=` zorunludur; sessiz varsayılan donmuş çalışmaya veri yazılmasına yol açar.');
}
const studyDirectory = studyArgument.slice('--study='.length);
if (
  !studyDirectory ||
  studyDirectory.includes('/') ||
  studyDirectory.includes('\\') ||
  studyDirectory.includes('..') ||
  /^[a-zA-Z]:/.test(studyDirectory)
) {
  throw new Error(`Geçersiz çalışma adı: "${studyDirectory}". Çalışma adı yol ayracı, ".." veya sürücü harfi içeremez.`);
}
const benchmarksRoot = path.resolve('benchmarks');
const root = path.resolve(benchmarksRoot, studyDirectory);
if (path.dirname(root) !== benchmarksRoot) {
  throw new Error(`Geçersiz çalışma adı: "${studyDirectory}". Çalışma "benchmarks" klasörünün dışına çıkamaz.`);
}
const rootStat = await stat(root).catch(() => null);
if (!rootStat || !rootStat.isDirectory()) {
  throw new Error(`Çalışma bulunamadı: "benchmarks/${studyDirectory}" bir klasör değil. Var olan bir çalışma adı belirtin (örn. --study=comparison-v2).`);
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

/**
 * Katılımcılar yetenek yetenek listelenir.
 *
 * Terfi yetenek başına kapılıdır: 3 yeteneğe dağılmış 5 katılımcı hiçbir
 * yeteneği terfi ettirmez. Yalnız toplam sayıyı yazan bir rapor, kapının
 * neden hâlâ kapalı olduğunu gizlerdi.
 */
const capabilityLines = Object.entries(summary.participantsByCapability)
  .map(([capabilityId, count]) => `- ${capabilityId}: ${count} katılımcı`)
  .join('\n') || '- (henüz katılımcı yok)';

await writeFile(path.resolve('docs', 'product', 'USER_STUDY_REPORT.md'), `# Anonim Kullanıcı Çalışması

Bu rapor yalnız açık onayla cihazdan dışa aktarılan, izin verilen metrik alanlarını içeren yerel oturum dosyalarından üretilir. Telemetri veya kişisel veri toplamaz.

- Geçerli katılımcı: ${summary.validParticipants}
- Tamamlama oranı: %${Math.round(summary.completionRate * 100)}
- İlk export oranı: %${Math.round(summary.firstExportRate * 100)}
- Küçük düzenlemeyle MVP kabulü: %${Math.round(summary.minorEditMvpAcceptanceRate * 100)}
- Ortalama memnuniyet: ${summary.averageSatisfaction || '—'}/5
- Ortalama kurulum süresi: ${summary.averageSetupSeconds} saniye
- Ortalama planlama süresi: ${summary.averagePlanningSeconds} saniye
- Ortalama uçtan uca süre: ${summary.averageEndToEndSeconds} saniye
- Planı kullanmayı sürdürme niyeti: %${Math.round(summary.wouldUsePlanRate * 100)}
- Ortalama manuel düzenleme: ${summary.averageManualEditCount}

Süre üç parça hâlinde tutulur; tek bir ortalama, kolların eşitsiz başlangıç koşullarını gizlerdi.

## Yeteneğe göre katılımcı

${capabilityLines}

Terfi yetenek başına kapılıdır: toplam katılımcı sayısı tek başına hiçbir yeteneği terfi ettirmez.

Bu sayılar örneklem ve çalışma tasarımı yeterli olmadan ürün üstünlüğü kanıtı sayılmaz.
`, 'utf8');
console.log(`${result.importedCount} yeni anonim oturum içe aktarıldı; toplam ${summary.validParticipants} benzersiz katılımcı.`);
console.log('Karşılaştırmalı raporu yenilemek için: npm run comparison:benchmark');
