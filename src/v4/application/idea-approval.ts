import { blockingConcerns, isResolved } from './concerns.js';
import { reopenStage } from './project-stages.js';
import type {
  Concern,
  ConcernDecision,
  ProjectDocumentV5,
  StageApproval
} from '../contracts.js';

/**
 * Idea Approval Gate — V3'ün birinci kapısı.
 *
 * ```
 * Kritik FİKİR kararları çözülmeden Solution Design onaylanamaz.
 * ```
 *
 * Kapı bir yüzde göstermez. `Hazırlık 98/100` sahte kesinlik veriyordu:
 * yüzde, neyin eksik olduğunu söylemeden eksiksizlik iddia eder. Bunun yerine
 * kapı **engel listesi** döndürür; her engelin somut bir sahibi ve somut bir
 * düzeltmesi vardır. Sıfır engel = geçilebilir.
 *
 * **Kapsam sınırı — dürüstlük notu.** Buradaki çelişki denetimi *yapısaldır*:
 * belgenin kendi içinde tutarsız olduğu, kanıtlanabilir durumları yakalar
 * (kaydı olmayan karar, var olmayan konuya bağlı cevap, bilinmeyen seçenek,
 * bayat öncül). Anlamsal çelişki — *"bu karar başka bir kararınızla
 * çelişiyor"* — AI'nin işidir ve sisteme yeni bir `Concern` olarak girer,
 * buradan değil. Kapının yakalayamadığı şeyi yakalıyormuş gibi göstermek,
 * yüzdeden daha zararlı olurdu.
 */

export type ApprovalObstacleKind =
  | 'blocking-concern'
  | 'undocumented-decision'
  | 'orphan-decision'
  | 'unknown-option'
  | 'stale-answer';

export interface ApprovalObstacle {
  kind: ApprovalObstacleKind;
  /** Engelin sahibi olan konu; yörüngesiz kararda kararın işaret ettiği kimlik. */
  concernId: string;
  /** Kullanıcıya gösterilecek cümle; jargon değil, yapılacak iş. */
  message: string;
}

export interface ApprovalReadiness {
  obstacles: ApprovalObstacle[];
  /** Çözülmemiş kritik karar sayısı. */
  blocking: number;
  /** Çözülmemiş ama bloklamayan önemli konular; bilgi amaçlı. */
  unresolvedImportant: number;
  /** Ertelenenler kaybolmaz; "sonra" da bir karardır ve sayılır. */
  deferred: number;
  canApprove: boolean;
}

function decisionsByConcern(decisions: readonly ConcernDecision[]): Map<string, ConcernDecision> {
  const map = new Map<string, ConcernDecision>();
  for (const decision of decisions) {
    if (decision.concernId) map.set(decision.concernId, decision);
  }
  return map;
}

/**
 * Fikir tasarımının onaya hazır olup olmadığı.
 *
 * Salt okunur: belgeyi değiştirmez, yalnız neyin engel olduğunu söyler.
 */
export function ideaApprovalReadiness(project: ProjectDocumentV5): ApprovalReadiness {
  const concerns: readonly Concern[] = project.ideaDesign?.concerns || [];
  const decisions: readonly ConcernDecision[] = project.ideaDesign?.concernDecisions || [];
  const byConcern = decisionsByConcern(decisions);
  const known = new Set(concerns.map(concern => concern.id));
  const obstacles: ApprovalObstacle[] = [];

  for (const concern of blockingConcerns(concerns)) {
    obstacles.push({
      kind: 'blocking-concern',
      concernId: concern.id,
      message: `“${concern.title}” konusunda henüz karar verilmedi.`
    });
  }

  for (const concern of concerns) {
    const decision = byConcern.get(concern.id);

    // "Karar verildi" demek kararı var etmez: kaydı olmayan bir karar
    // sonradan hiçbir gereksinime bağlanamaz, yani izlenebilirlik zinciri
    // daha ilk halkasında kopar.
    if (concern.status === 'decided' && !decision) {
      obstacles.push({
        kind: 'undocumented-decision',
        concernId: concern.id,
        message: `“${concern.title}” karara bağlanmış görünüyor ama kararın kaydı yok.`
      });
      continue;
    }
    if (!decision) continue;

    if (decision.chosenOptionId && !concern.options.some(option => option.id === decision.chosenOptionId)) {
      obstacles.push({
        kind: 'unknown-option',
        concernId: concern.id,
        message: `“${concern.title}” için seçilen seçenek artık listede yok.`
      });
    }

    const staleDependency = concern.dependsOn
      .map(id => byConcern.get(id))
      .find(dependency => dependency && dependency.decidedAtRevision > decision.decidedAtRevision);

    // Önkoşul sonradan yeniden karara bağlandıysa, buradaki cevap artık
    // geçerli olmayan bir öncüle dayanıyor. Kullanıcı yeniden onaylayabilir;
    // ama sessizce geçerli sayılamaz.
    if (staleDependency) {
      obstacles.push({
        kind: 'stale-answer',
        concernId: concern.id,
        message: `“${concern.title}” cevabı, sonradan değişen bir karara dayanıyor; teyit gerekiyor.`
      });
    }
  }

  for (const decision of decisions) {
    // Konu silinmiş ama cevabı duruyorsa, kullanıcının artık sorulmayan bir
    // soruya verdiği cevabı onaylamış oluruz.
    if (!known.has(decision.concernId)) {
      obstacles.push({
        kind: 'orphan-decision',
        concernId: decision.concernId,
        message: 'Bir cevap, artık var olmayan bir konuya bağlı.'
      });
    }
  }

  return {
    obstacles,
    blocking: obstacles.filter(item => item.kind === 'blocking-concern').length,
    unresolvedImportant: concerns.filter(concern => concern.importance === 'important' && !isResolved(concern)).length,
    deferred: concerns.filter(concern => concern.status === 'deferred').length,
    canApprove: obstacles.length === 0
  };
}

export type ApprovalResult =
  | { approved: true; approval: StageApproval; readiness: ApprovalReadiness }
  | { approved: false; reason: string; readiness: ApprovalReadiness };

/**
 * Onay kaydını üretir; **belgeyi değiştirmez** — yazma işini çağıran yapar,
 * böylece canonical revizyon disiplini tek yerde kalır.
 *
 * Engel varken onay reddedilir. Onayın altındaki boşluğu örtbas eden bir imza
 * olmaması, kapının bütün varlık nedenidir.
 */
export function approveIdeaDesign(
  project: ProjectDocumentV5,
  options: { revision: number; at: string }
): ApprovalResult {
  const readiness = ideaApprovalReadiness(project);
  if (!readiness.canApprove) {
    return { approved: false, reason: refusalReason(readiness), readiness };
  }

  return {
    approved: true,
    approval: {
      status: 'approved',
      approvedAtRevision: options.revision,
      approvedAt: options.at,
      reopenedReason: null
    },
    readiness
  };
}

function refusalReason(readiness: ApprovalReadiness): string {
  if (readiness.blocking) {
    return `Fikir tasarımında çözülmemiş ${readiness.blocking} kritik karar var.`;
  }
  return `Fikir tasarımında ${readiness.obstacles.length} engel var.`;
}

export interface ReopenResult {
  ideaApproval: StageApproval;
  solutionApproval: StageApproval;
  /** Kullanıcıya gösterilecek metin; geri dönüş sessiz olmaz. */
  notice: string;
}

/**
 * Fikir onayını yeniden açar ve aşağı-akışı da açar.
 *
 * Fikir değişince teknik onay ayakta kalamaz: altındaki gerekçe değişmiştir.
 * Ama **hiç onaylanmamış** bir aşama "geri alındı" diye bildirilmez —
 * olmayan bir şeyi geri aldığını söylemek kullanıcıya yanlış bir kayıp hissi
 * verir.
 */
export function reopenIdeaApproval(project: ProjectDocumentV5, reason: string): ReopenResult {
  const trimmed = String(reason || '').trim();
  if (!trimmed) {
    throw new Error('Onay yeniden açılırken neden yazılmalıdır; sessiz geri dönüş yapılmaz.');
  }

  const currentIdea = project.ideaDesign.approval;
  const currentSolution = project.solutionDesign.approval;
  const solutionWasApproved = currentSolution.status === 'approved';

  return {
    ideaApproval: reopenStage(currentIdea, trimmed),
    solutionApproval: solutionWasApproved ? reopenStage(currentSolution, trimmed) : currentSolution,
    notice: solutionWasApproved
      ? `Fikir onayı yeniden açıldı: ${trimmed}. Buna dayandığı için teknik onay da yeniden açıldı.`
      : `Fikir onayı yeniden açıldı: ${trimmed}.`
  };
}

/**
 * Kapının kullanıcıya gösterdiği satırlar.
 *
 * Yüzde ve `X/Y` skoru **bilerek** üretilmez; testte de bu yasaklanır. Sayı
 * değil, engel listesi.
 */
export function readinessLines(readiness: ApprovalReadiness): string[] {
  const lines = [
    `Bloklayan konu: ${readiness.blocking}`,
    `Çözülmemiş önemli: ${readiness.unresolvedImportant}`,
    `Ertelenen: ${readiness.deferred}`
  ];

  const structural = readiness.obstacles.filter(item => item.kind !== 'blocking-concern');
  for (const obstacle of structural) lines.push(obstacle.message);

  if (readiness.canApprove) lines.push('Devam edilebilir.');
  return lines;
}
