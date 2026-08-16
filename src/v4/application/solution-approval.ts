import { reopenStage } from './project-stages.js';
import {
  decisionsByConcern,
  refusalReason,
  structuralObstacles,
  summarizeReadiness
} from './stage-approval.js';
import type { ApprovalObstacle, ApprovalReadiness } from './stage-approval.js';
import type { Decision, ProjectDocumentV5, StageApproval } from '../contracts.js';

/**
 * Technical Approval Gate — V3'ün ikinci kapısı.
 *
 * ```
 * Kritik TEKNİK kararlar çözülmeden Implementation Plan finalleştirilemez.
 * ```
 *
 * Fikir kapısındaki yapısal denetimlerin hepsi burada da geçerli. Üstüne teknik
 * tarafa özgü iki denetim gelir; ikisi de "öneri ≠ karar" ve "kanıt ≠ güven
 * yüzdesi" kurallarının kapıdaki karşılığıdır.
 */

/**
 * Teknik karar bir **ADR** olmak zorunda: konu karara bağlandıysa canonical bir
 * `Decision` kaydına bağlanmış olmalı. Bağlanmamışsa gereksinim ve görev
 * üretimi o kararı hiç göremez — plan, konuşmada kalmış bir karara dayanır.
 */
function unlinkedDecisions(project: ProjectDocumentV5): ApprovalObstacle[] {
  const concerns = project.solutionDesign?.concerns || [];
  const byConcern = decisionsByConcern(project.solutionDesign?.concernDecisions || []);
  const canonicalIds = new Set((project.decisions || []).map(decision => decision.id));
  const obstacles: ApprovalObstacle[] = [];

  for (const concern of concerns) {
    if (concern.status !== 'decided') continue;
    const decision = byConcern.get(concern.id);
    if (!decision) continue; // yapısal denetim bunu zaten yakaladı

    if (!decision.decisionId || !canonicalIds.has(decision.decisionId)) {
      obstacles.push({
        kind: 'unlinked-technical-decision',
        concernId: concern.id,
        message: `“${concern.title}” için verilen teknik karar canonical kayda bağlanmamış.`
      });
    }
  }

  return obstacles;
}

/**
 * Teknik kararın dayandığı fikir kararı hâlâ geçerli mi?
 *
 * Kullanıcı fikir aşamasına dönüp bir kararı geri aldığında, o karara dayanan
 * teknik karar sessizce ayakta kalamaz. Güven yüzdesi yerine kanıt taşımanın
 * asıl faydası burada görünüyor: kanıt zinciri koptuğunda bunu **söyleyebiliriz**;
 * bir yüzde bunu asla gösteremezdi.
 *
 * Kanıtsız teknik kararlar burada bayat sayılmaz — eski (`legacy`) kararlarda
 * `evidence` alanı hiç yok ve onları toptan engel ilan etmek göçü cezaya
 * çevirirdi.
 */
function ungroundedDecisions(project: ProjectDocumentV5): ApprovalObstacle[] {
  const acceptedIdeaDecisions = new Set(
    (project.decisions || [])
      .filter(decision => decision.stage === 'idea' && decision.status === 'accepted')
      .map(decision => decision.id)
  );
  const decidedIdeaConcerns = new Set(
    (project.ideaDesign?.concerns || [])
      .filter(concern => concern.status === 'decided')
      .map(concern => concern.id)
  );

  const technical = (project.decisions || []).filter(
    (decision): decision is Decision => decision.stage === 'technical' && decision.status === 'accepted'
  );
  const obstacles: ApprovalObstacle[] = [];

  for (const decision of technical) {
    const evidence = decision.evidence;
    if (!evidence) continue;
    const cited = evidence.ideaDecisionIds.length + evidence.ideaConcernIds.length;
    if (cited === 0) continue;

    const stillValid = evidence.ideaDecisionIds.some(id => acceptedIdeaDecisions.has(id))
      || evidence.ideaConcernIds.some(id => decidedIdeaConcerns.has(id));

    if (!stillValid) {
      obstacles.push({
        kind: 'ungrounded-technical-decision',
        concernId: decision.id,
        message: `“${decision.title}” kararının dayandığı fikir kararı artık geçerli değil.`
      });
    }
  }

  return obstacles;
}

export function solutionApprovalReadiness(project: ProjectDocumentV5): ApprovalReadiness {
  const concerns = project.solutionDesign?.concerns || [];
  return summarizeReadiness(concerns, [
    ...structuralObstacles(concerns, project.solutionDesign?.concernDecisions || []),
    ...unlinkedDecisions(project),
    ...ungroundedDecisions(project)
  ]);
}

export type SolutionApprovalResult =
  | { approved: true; approval: StageApproval; readiness: ApprovalReadiness }
  | { approved: false; reason: string; readiness: ApprovalReadiness };

/**
 * Teknik onayı üretir. Fikir onayı alınmadan teknik onay **verilemez**:
 * `Idea → Plan` doğrudan geçişi kaldırıldı, `Idea → Solution` atlaması da öyle.
 */
export function approveSolutionDesign(
  project: ProjectDocumentV5,
  options: { revision: number; at: string }
): SolutionApprovalResult {
  const readiness = solutionApprovalReadiness(project);

  if (project.ideaDesign?.approval?.status !== 'approved') {
    return { approved: false, reason: 'Fikir tasarımı onaylanmadan teknik onay verilemez.', readiness };
  }
  if (!readiness.canApprove) {
    return { approved: false, reason: refusalReason('Teknik tasarımda', readiness), readiness };
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

export interface SolutionReopenResult {
  solutionApproval: StageApproval;
  /** Yeniden gözden geçirilmesi gereken canonical teknik karar kimlikleri. */
  affectedDecisionIds: string[];
  notice: string;
}

/**
 * Teknik onayı yeniden açar.
 *
 * Fikir kapısının aksine burada aşağı-akışta bir **onay** yok; etkilenen şey
 * plandır. Bu yüzden hangi teknik kararların yeniden ele alınacağı sayılarak
 * söylenir — kullanıcı neyin bayatladığını bilmeden geri dönmüş olmaz.
 */
export function reopenSolutionApproval(project: ProjectDocumentV5, reason: string): SolutionReopenResult {
  const trimmed = String(reason || '').trim();
  if (!trimmed) {
    throw new Error('Onay yeniden açılırken neden yazılmalıdır; sessiz geri dönüş yapılmaz.');
  }

  const affectedDecisionIds = (project.decisions || [])
    .filter(decision => decision.stage === 'technical' && decision.status === 'accepted')
    .map(decision => decision.id);

  return {
    solutionApproval: reopenStage(project.solutionDesign.approval, trimmed),
    affectedDecisionIds,
    notice: affectedDecisionIds.length
      ? `Teknik onay yeniden açıldı: ${trimmed}. ${affectedDecisionIds.length} teknik karar gözden geçirilmeli.`
      : `Teknik onay yeniden açıldı: ${trimmed}.`
  };
}
