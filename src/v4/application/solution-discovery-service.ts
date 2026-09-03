import { normalizeConcern } from './concerns.js';
import { stageGate } from './project-stages.js';
import { admitCandidate, groundEvidence, normalizeTechnologyCandidate } from './solution-design.js';
import type { SolutionDiscoveryOutput } from '../ai/schemas/schemas.js';
import type { Concern, ProjectDocumentV5, TechnologyCandidate } from '../contracts.js';

/**
 * Teknik keşif çıktısını canonical modele bağlar.
 *
 * Servis **AI çağırmaz**: girdi olarak zaten doğrulanmış `SolutionDiscoveryOutput`
 * alır. Ağsız test edilebilir ve sağlayıcı değişse de mantık değişmez —
 * `idea-design-service` ile aynı ayrım.
 *
 * Buranın asıl işi bir süzgeç olmak: model gerekçesiz teknoloji önerebilir,
 * çekirdek onu **reddeder**. Reddedilen sessizce kaybolmaz; nedeniyle birlikte
 * döner ki kullanıcıya "şunu önerdim ama gerekçelendiremedim" denebilsin.
 */

const IMPORTANCE_WEIGHT = { critical: 1, important: 0.7, optional: 0.4 } as const;

function idFromTitle(prefix: string, title: string, index: number): string {
  const slug = String(title || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${slug || index + 1}`;
}

export interface SolutionDiscoveryResult {
  concerns: Concern[];
  candidates: TechnologyCandidate[];
  /** Gerekçelendirilemediği için elenen adaylar; sessiz düşüş olmaz. */
  refused: Array<{ candidate: TechnologyCandidate; reason: string }>;
  /**
   * Belgede karşılığı olmadığı için kanıttan süzülen kimlik sayısı.
   *
   * Aday elenmese bile süzme sessiz kalmaz: bu modülün "reddedilen sessizce
   * kaybolmaz" kuralı, düşen gerekçe kimlikleri için de geçerli. Sayı aynı
   * raporlama kanalında (bu sonuç kaydında) durur; kullanıcı arayüzüne bir
   * bildirim eklenmez, çünkü bu bir veri bütünlüğü düzeltmesi.
   */
  ungroundedEvidenceIdCount: number;
  openQuestions: string[];
}

/**
 * Teknik keşif yalnız fikir onayından **sonra** çalışır.
 *
 * V3'ün birinci değişmezi bu: kritik fikir kararları çözülmeden teknik tasarım
 * konuşulmaz. Kapı kapalıyken keşif çalıştırmak, kullanıcıya henüz cevabı
 * bilinmeyen bir sorunun teknik çözümünü tartıştırmak olurdu.
 */
export function canDiscoverSolution(project: ProjectDocumentV5): { open: boolean; reason: string | null } {
  return stageGate(project, 'solution');
}

export function applySolutionDiscovery(
  output: Pick<SolutionDiscoveryOutput, 'technicalConcerns' | 'candidates' | 'openQuestions'>,
  project: ProjectDocumentV5
): SolutionDiscoveryResult {
  const concerns = (output.technicalConcerns || []).map((item, index) => normalizeConcern({
    id: idFromTitle('tech-concern', item.title, index),
    title: item.title,
    description: item.description,
    category: item.category,
    importance: item.importance,
    status: 'open',
    whyItMatters: item.whyItMatters,
    questions: item.questions,
    // Model başlıkla bağımlılık bildirir; kimliğe çevirmek çekirdeğin işi.
    // Aynı yanıtta karşılığı olmayan başlık düşer — uydurulmuş bağımlılık
    // bütün akışı kilitleyebilirdi.
    dependsOn: (item.dependsOnTitles || [])
      .map(title => (output.technicalConcerns || []).findIndex(other => other.title === title))
      .filter(position => position >= 0)
      .map(position => idFromTitle('tech-concern', output.technicalConcerns[position].title, position)),
    decisionRequired: true,
    uncertainty: item.uncertainty,
    downstreamImpact: item.downstreamImpact * IMPORTANCE_WEIGHT[item.importance]
  }, index));

  const concernIdByTitle = new Map(
    (output.technicalConcerns || []).map((item, index) => [item.title, idFromTitle('tech-concern', item.title, index)])
  );

  const candidates: TechnologyCandidate[] = [];
  const refused: SolutionDiscoveryResult['refused'] = [];

  let ungroundedEvidenceIdCount = 0;

  for (const [index, item] of (output.candidates || []).entries()) {
    const proposed = normalizeTechnologyCandidate({
      id: idFromTitle('candidate', item.title, index),
      concernId: concernIdByTitle.get(item.concernTitle) || '',
      title: item.title,
      category: item.category,
      rationale: item.rationale,
      tradeoffs: item.tradeoffs,
      reversibility: item.reversibility,
      evidence: {
        ideaDecisionIds: item.derivedFromIdeaDecisionIds,
        ideaConcernIds: item.derivedFromIdeaConcernIds
      }
    }, index);

    // Kanıt belgeye girmeden önce gerçeğe süzülür. Süzme burada yapılıyor
    // çünkü belgeye YENİ kanıt yazan yer burası ve proje elde. Aynı işi
    // `normalizeTechnologyCandidate` içinde yapmak, o fonksiyonu belge
    // bağlamına bağımlı kılar ve `canonical-entities` her belge
    // normalleştirmesinde eski adayların kanıtını da yeniden budardı —
    // saklanmış bir kayıt, okunduğu her seferde değişirdi.
    const grounded = groundEvidence(proposed.evidence, project);
    ungroundedEvidenceIdCount +=
      (proposed.evidence.ideaDecisionIds.length - grounded.ideaDecisionIds.length)
      + (proposed.evidence.ideaConcernIds.length - grounded.ideaConcernIds.length);
    const candidate: TechnologyCandidate = { ...proposed, evidence: grounded };

    // Süzme kabul/ret kararını değiştirmez: `admitCandidate` zaten yalnız
    // gerçek kimlikleri sayıyordu.
    const admission = admitCandidate(candidate, project);
    if (admission.admitted) candidates.push(candidate);
    else refused.push({ candidate, reason: admission.reason });
  }

  return {
    concerns,
    candidates,
    refused,
    ungroundedEvidenceIdCount,
    openQuestions: output.openQuestions || []
  };
}
