import { blockingConcerns, isResolved } from './concerns.js';
import type { Concern, ConcernDecision } from '../contracts.js';

/**
 * İki kapının ortak çekirdeği.
 *
 * Idea Approval Gate ve Technical Approval Gate aynı yapısal soruları sorar:
 * bloklayan konu var mı, iddia edilen kararların kaydı var mı, kayıtlar hâlâ
 * geçerli konulara mı bağlı. Bu mantık iki yere kopyalansaydı biri düzeltilip
 * diğeri unutulurdu — kapı davranışının iki farklı doğruluğu olurdu.
 *
 * Aşamaya özgü denetimler (teknik kararın ADR'ye bağlı olması gibi) çağıran
 * modülde durur; burada yalnız her aşamada aynı olan şey vardır.
 */

export type ApprovalObstacleKind =
  | 'blocking-concern'
  | 'undocumented-decision'
  | 'orphan-decision'
  | 'unknown-option'
  | 'stale-answer'
  | 'unlinked-technical-decision'
  | 'ungrounded-technical-decision'
  | 'nothing-decided';

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

export function decisionsByConcern(decisions: readonly ConcernDecision[]): Map<string, ConcernDecision> {
  const map = new Map<string, ConcernDecision>();
  for (const decision of decisions) {
    if (decision.concernId) map.set(decision.concernId, decision);
  }
  return map;
}

/** Her aşamada geçerli olan yapısal tutarsızlıklar. */
export function structuralObstacles(
  concerns: readonly Concern[],
  decisions: readonly ConcernDecision[]
): ApprovalObstacle[] {
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

  return obstacles;
}

export function summarizeReadiness(
  concerns: readonly Concern[],
  obstacles: ApprovalObstacle[]
): ApprovalReadiness {
  return {
    obstacles,
    blocking: obstacles.filter(item => item.kind === 'blocking-concern').length,
    unresolvedImportant: concerns.filter(concern => concern.importance === 'important' && !isResolved(concern)).length,
    deferred: concerns.filter(concern => concern.status === 'deferred').length,
    canApprove: obstacles.length === 0
  };
}

/**
 * Kapının kullanıcıya gösterdiği satırlar.
 *
 * Yüzde ve `X/Y` skoru **bilerek** üretilmez; testte de bu yasaklanır.
 * `Hazırlık 98/100` sahte kesinlik veriyordu: yüzde, neyin eksik olduğunu
 * söylemeden eksiksizlik iddia eder. Sayı değil, engel listesi.
 */
export function readinessLines(readiness: ApprovalReadiness): string[] {
  const lines = [
    `Bloklayan konu: ${readiness.blocking}`,
    `Çözülmemiş önemli: ${readiness.unresolvedImportant}`,
    `Ertelenen: ${readiness.deferred}`
  ];

  for (const obstacle of readiness.obstacles.filter(item => item.kind !== 'blocking-concern')) {
    lines.push(obstacle.message);
  }

  if (readiness.canApprove) lines.push('Devam edilebilir.');
  return lines;
}

export function refusalReason(stageLabel: string, readiness: ApprovalReadiness): string {
  if (readiness.blocking) {
    return `${stageLabel} çözülmemiş ${readiness.blocking} kritik karar var.`;
  }
  return `${stageLabel} ${readiness.obstacles.length} engel var.`;
}
