import { reopenStage } from './project-stages.js';
import {
  refusalReason,
  structuralObstacles,
  summarizeReadiness
} from './stage-approval.js';
import type { ApprovalReadiness } from './stage-approval.js';
import type { Concern, ProjectDocumentV5, StageApproval } from '../contracts.js';

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
  const structural = structuralObstacles(concerns, project.ideaDesign?.concernDecisions || []);
  // Yapısal engel varken kapı zaten doğru sebeple kapalı; üstüne "hiçbir konu
  // karara bağlanmadı" eklemek aynı işi iki kez söylemek olurdu. Bu denetim
  // yalnız kapının **açılacağı** durumu yakalamak için var.
  return summarizeReadiness(
    concerns,
    structural.length ? structural : nothingDecidedObstacle(concerns)
  );
}

/**
 * Hiçbir konu karara bağlanmadıysa onaylanacak bir şey yoktur.
 *
 * Yapısal denetimler yalnız **var olan** konuları inceler; boş bir fikir
 * tasarımında hepsi sessizce geçer ve kapı "0 engel" diyerek açılır. Pilot bunu
 * canlıda gösterdi: sağlayıcı turu düştüğü için sıfır konuyla ilerleyen belge
 * her iki onayı da aldı. İmza, altında hiçbir karar yokken atılmış olurdu.
 *
 * Bu denetim yalnız FİKİR aşamasında var. Teknik tarafta boş liste meşru bir
 * sonuçtur — istem modele açıkça "gerçekten karara bağlanacak teknik bir şey
 * yoksa boş dizi döndür" diyor. Aynı kuralı oraya kopyalamak, ürünün kendi
 * söylediği şeyi cezalandırmak olurdu.
 */
function nothingDecidedObstacle(concerns: readonly Concern[]) {
  const decided = concerns.some(concern => concern.status !== 'open');
  if (decided) return [];
  return [{
    kind: 'nothing-decided' as const,
    concernId: '',
    message: concerns.length
      ? 'Hiçbir konu karara bağlanmadı; onaylanacak bir karar yok.'
      : 'Fikir tasarımında hiç konu yok; önce keşif turu çalıştır.'
  }];
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
