import { runRegisteredAITask } from '../ai/runtime.js';
import { applySolutionDiscovery, canDiscoverSolution } from './solution-discovery-service.js';
import type { SolutionDiscoveryOutput } from '../ai/schemas/schemas.js';
import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';

/**
 * Teknik keşif turunu çalıştırır.
 *
 * **Yerel kural motoru yok.** Diğer görevlerde fikir tarafı için bir yedek
 * motor var; teknik tarafta yok ve uydurulmayacak. Sağlayıcı bağlı değilse tur
 * dürüstçe hata verir. Sahte bir "teknik tasarım" üretmek, kullanıcıya
 * onaylayacağı bir şey olduğu izlenimi verirdi.
 *
 * Elenen adaylar sessizce düşmez: `refused` listesi kullanıcıya "şunu önerdim
 * ama gerekçelendiremedim" demeyi mümkün kılar.
 */

export interface SolutionDiscoveryRunResult {
  project: ProjectDocumentV5;
  refused: Array<{ title: string; reason: string }>;
  error: string | null;
  notice: string;
}

export async function runSolutionDiscovery(
  project: ProjectDocumentV5,
  options: { settings: ProviderSettings; credential?: string; signal?: AbortSignal }
): Promise<SolutionDiscoveryRunResult> {
  const gate = canDiscoverSolution(project);
  if (!gate.open) {
    return { project, refused: [], error: gate.reason || 'Teknik tasarım henüz açılmadı.', notice: '' };
  }

  let output: SolutionDiscoveryOutput;
  try {
    const result = await runRegisteredAITask<SolutionDiscoveryOutput>('solution-discovery', {
      project,
      settings: options.settings,
      credential: options.credential || '',
      signal: options.signal
    });
    output = result.output;
  } catch (error) {
    return { project, refused: [], error: describeFailure(error), notice: '' };
  }

  const applied = applySolutionDiscovery(output, project);
  const next: ProjectDocumentV5 = {
    ...project,
    solutionDesign: {
      ...project.solutionDesign,
      // Mevcut teknik konular korunur: keşif turu kullanıcının verdiği kararı
      // silmez. Aynı başlık iki kez gelirse mevcut kayıt kazanır.
      concerns: mergeByTitle(project.solutionDesign.concerns, applied.concerns),
      candidates: mergeByTitle(project.solutionDesign.candidates, applied.candidates),
      openQuestions: [...new Set([...project.solutionDesign.openQuestions, ...applied.openQuestions])]
    }
  };

  return {
    project: next,
    refused: applied.refused.map(item => ({ title: item.candidate.title, reason: item.reason })),
    error: null,
    notice: applied.refused.length
      ? `${applied.candidates.length} aday eklendi; ${applied.refused.length} öneri gerekçelendirilemediği için elendi.`
      : `${applied.candidates.length} teknik aday eklendi.`
  };
}

function mergeByTitle<T extends { title: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const key = (value: string) => String(value || '').toLocaleLowerCase('tr-TR').trim();
  const byTitle = new Map(existing.map(item => [key(item.title), item]));
  for (const item of incoming) {
    if (!byTitle.has(key(item.title))) byTitle.set(key(item.title), item);
  }
  return [...byTitle.values()];
}

/**
 * Hatayı kullanıcının okuyabileceği bir cümleye çevirir.
 *
 * Ham `Failed to fetch` kullanıcıya hiçbir şey söylemez ve ne yapacağını da
 * göstermez. Ama orijinal neden **silinmez**: parantez içinde durur, çünkü
 * gerçek nedeni gizlemek hata ayıklamayı imkânsız kılardı.
 */
function describeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/AI sağlayıcısı gerekli/i.test(raw)) {
    return 'Teknik keşif için bir AI sağlayıcısı bağlaman gerekiyor. Teknik tarafta yerel yedek motor yok.';
  }
  if (/failed to fetch|networkerror|load failed|ECONNREFUSED|ENOTFOUND/i.test(raw)) {
    return `AI sağlayıcısına ulaşılamadı; bağlantını ve anahtarını kontrol et. (${raw})`;
  }
  if (/abort/i.test(raw)) return 'Teknik keşif turu iptal edildi.';
  return `Teknik keşif tamamlanamadı: ${raw}`;
}
