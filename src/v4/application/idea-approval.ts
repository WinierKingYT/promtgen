import { reopenStage } from './project-stages.js';
import {
  refusalReason,
  structuralObstacles,
  summarizeReadiness
} from './stage-approval.js';
import type { ApprovalReadiness } from './stage-approval.js';
import type { ProjectDocumentV5, StageApproval } from '../contracts.js';

export type {
  ApprovalObstacle,
  ApprovalObstacleKind,
  ApprovalReadiness
} from './stage-approval.js';
export { readinessLines } from './stage-approval.js';

/**
 * Idea Approval Gate — V3'ün birinci kapısı.
 *
 * ```
 * Kritik FİKİR kararları çözülmeden Solution Design onaylanamaz.
 * ```
 *
 * Yapısal denetimler `stage-approval` çekirdeğinde; burada fikir aşamasına özgü
 * onay ve yeniden açma davranışı var.
 *
 * **Kapsam sınırı — dürüstlük notu.** Buradaki çelişki denetimi *yapısaldır*:
 * belgenin kendi içinde tutarsız olduğu, kanıtlanabilir durumları yakalar.
 * Anlamsal çelişki — *"bu karar başka bir kararınızla çelişiyor"* — AI'nin
 * işidir ve sisteme yeni bir `Concern` olarak girer, buradan değil. Kapının
 * yakalayamadığı şeyi yakalıyormuş gibi göstermek, yüzdeden daha zararlı
 * olurdu.
 */
export function ideaApprovalReadiness(project: ProjectDocumentV5): ApprovalReadiness {
  const concerns = project.ideaDesign?.concerns || [];
  return summarizeReadiness(
    concerns,
    structuralObstacles(concerns, project.ideaDesign?.concernDecisions || [])
  );
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
    return { approved: false, reason: refusalReason('Fikir tasarımında', readiness), readiness };
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
