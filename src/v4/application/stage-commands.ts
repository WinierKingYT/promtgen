import { normalizeConcern, normalizeConcernDecision } from './concerns.js';
import { approveIdeaDesign, reopenIdeaApproval } from './idea-approval.js';
import { approveSolutionDesign, reopenSolutionApproval } from './solution-approval.js';
import { promoteCandidate, rejectCandidate } from './solution-design.js';
import type {
  Concern,
  ConcernStatus,
  Decision,
  ProjectDocumentV5,
  ProjectFraming,
  ProjectStage,
  RejectedAlternative
} from '../contracts.js';

/**
 * V3 aşama komutları — arayüzün çağırdığı yazma işlemleri.
 *
 * Hepsi **saf**: girdiyi değiştirmez, yeni belge döndürür. Kalıcılık,
 * revizyon artışı ve iyimser eşzamanlılık `useProjectState.persist` üzerinden
 * yürür; buraya kopyalanmaz. Aksi hâlde canonical revizyon disiplininin iki
 * uygulaması olurdu.
 *
 * Hepsi aynı sonucu döndürür: `{ project, error }`. Reddedilen komut belgeyi
 * **hiç** değiştirmez ve nedeni taşır — sessiz başarısızlık, kullanıcıya
 * "kaydedildi" izlenimi verirdi.
 */

export interface StageCommandResult {
  project: ProjectDocumentV5;
  error: string | null;
  /** Kullanıcıya gösterilecek bilgi; geri dönüşlerde ne olduğunu anlatır. */
  notice: string;
}

const ok = (project: ProjectDocumentV5, notice = ''): StageCommandResult => ({ project, error: null, notice });
const fail = (project: ProjectDocumentV5, error: string): StageCommandResult => ({ project, error, notice: '' });

/** Konu hangi aşamanın kapsayıcısında duruyor? Aşama, kapsayıcıdan okunur. */
function locateConcern(project: ProjectDocumentV5, concernId: string): {
  stage: 'idea' | 'solution';
  concern: Concern;
} | null {
  const idea = (project.ideaDesign?.concerns || []).find(concern => concern.id === concernId);
  if (idea) return { stage: 'idea', concern: idea };
  const solution = (project.solutionDesign?.concerns || []).find(concern => concern.id === concernId);
  if (solution) return { stage: 'solution', concern: solution };
  return null;
}

const restatus = (concerns: Concern[], concernId: string, status: ConcernStatus) =>
  concerns.map(concern => (concern.id === concernId ? normalizeConcern({ ...concern, status }) : concern));

/**
 * İki kapsayıcı ayrı ayrı yazılır. `IdeaDesign | SolutionDesign` birleşimi
 * üzerinden tek bir yol yazmak, `framing` ve `candidates` gibi yalnız bir
 * tarafta olan alanları tipten düşürüyordu — yani derleyicinin koruduğu şeyi
 * kaybediyorduk.
 */
function withConcernStatus(
  project: ProjectDocumentV5,
  stage: 'idea' | 'solution',
  concernId: string,
  status: ConcernStatus
): ProjectDocumentV5 {
  if (stage === 'idea') {
    return {
      ...project,
      ideaDesign: { ...project.ideaDesign, concerns: restatus(project.ideaDesign.concerns, concernId, status) }
    };
  }
  return {
    ...project,
    solutionDesign: { ...project.solutionDesign, concerns: restatus(project.solutionDesign.concerns, concernId, status) }
  };
}

/**
 * Çerçevelemeyi kullanıcı onayıyla sabitler.
 *
 * `source: 'confirmed'` yalnız burada yazılır: AI çerçevelemeyi tahmin
 * edebilir ama onaylanmış sayamaz.
 */
export function confirmFraming(
  project: ProjectDocumentV5,
  framing: Omit<ProjectFraming, 'source'>
): StageCommandResult {
  if (!String(framing.domain || '').trim() && !String(framing.environment || '').trim()) {
    return fail(project, 'Ne tasarladığımızı anlamak için alan ya da ortam bilgisinden en az biri gerekiyor.');
  }
  return ok({
    ...project,
    ideaDesign: { ...project.ideaDesign, framing: { ...framing, source: 'confirmed' } }
  });
}

export interface AnswerConcernInput {
  concernId: string;
  /** Seçilen seçenek; kullanıcı kendi cevabını yazdıysa null. */
  chosenOptionId: string | null;
  answer: string;
  rationale: string;
  revision: number;
}

/**
 * Bir konuyu karara bağlar.
 *
 * Üç kayıt birlikte doğar: konunun durumu, `ConcernDecision` bağı ve canonical
 * `Decision`. Üçü ayrı ayrı yazılabilseydi izlenebilirlik zinciri yarım kalan
 * bir durumda kalabilirdi — kapılar da tam bunu engel sayıyor.
 */
export function answerConcern(project: ProjectDocumentV5, input: AnswerConcernInput): StageCommandResult {
  const located = locateConcern(project, input.concernId);
  if (!located) return fail(project, 'Bu konu artık belgede yok.');

  const answer = String(input.answer || '').trim();
  if (!answer) return fail(project, 'Karar boş bırakılamaz.');

  if (input.chosenOptionId && !located.concern.options.some(option => option.id === input.chosenOptionId)) {
    return fail(project, 'Seçilen seçenek bu konuda bulunmuyor.');
  }

  const decisionId = `decision-${located.concern.id}`;
  const next = withConcernStatus(project, located.stage, located.concern.id, 'decided');
  const concernDecision = normalizeConcernDecision({
    id: `concern-decision-${located.concern.id}`,
    concernId: located.concern.id,
    chosenOptionId: input.chosenOptionId,
    answer,
    rationale: String(input.rationale || '').trim(),
    decidedAtRevision: input.revision,
    decisionId
  });

  const decision: Decision = {
    stage: located.stage === 'idea' ? 'idea' : 'technical',
    id: decisionId,
    title: located.concern.title,
    decision: answer,
    rationale: String(input.rationale || '').trim() || located.concern.whyItMatters,
    alternatives: located.concern.options
      .filter(option => option.id !== input.chosenOptionId)
      .map(option => option.title),
    consequences: located.concern.options.find(option => option.id === input.chosenOptionId)?.tradeoffs || [],
    status: 'accepted',
    sourceSuggestionId: '',
    // Bölüm ataması **uydurulmaz**: konu hangi plan bölümünü etkilediğini
    // bilmiyor. İzlenebilirlik `traceLinks` üzerinden kurulur.
    affectedSectionIds: []
  };

  const withDecision: ProjectDocumentV5 = {
    ...next,
    decisions: [...next.decisions.filter(item => item.id !== decisionId), decision]
  };
  // Aynı konunun eski cevabı düşer: kullanıcı fikrini değiştirebilir ve
  // kayıtlar çoğalmaz.
  const link = (existing: typeof concernDecision[]) =>
    [...existing.filter(item => item.concernId !== located.concern.id), concernDecision];

  return ok(located.stage === 'idea'
    ? {
        ...withDecision,
        ideaDesign: { ...withDecision.ideaDesign, concernDecisions: link(withDecision.ideaDesign.concernDecisions) }
      }
    : {
        ...withDecision,
        solutionDesign: { ...withDecision.solutionDesign, concernDecisions: link(withDecision.solutionDesign.concernDecisions) }
      });
}

/**
 * "Sonra" da bir karardır: konu kapıyı bloklamaz ama kaybolmaz ve dönüşümde
 * plana taşınır.
 */
export function deferConcern(project: ProjectDocumentV5, concernId: string): StageCommandResult {
  const located = locateConcern(project, concernId);
  if (!located) return fail(project, 'Bu konu artık belgede yok.');
  return ok(
    withConcernStatus(project, located.stage, concernId, 'deferred'),
    `“${located.concern.title}” sonraya bırakıldı; kapsam dışı sayılmadı.`
  );
}

/** "Bu projeye ait değil" — kapsam disiplini bir çıktıdır, kayıp değil. */
export function dismissConcern(project: ProjectDocumentV5, concernId: string): StageCommandResult {
  const located = locateConcern(project, concernId);
  if (!located) return fail(project, 'Bu konu artık belgede yok.');
  return ok(
    withConcernStatus(project, located.stage, concernId, 'irrelevant'),
    `“${located.concern.title}” kapsam dışı olarak kaydedildi.`
  );
}

/** Aşamayı onaylar; kapı reddederse belge değişmez ve neden döner. */
export function approveStage(
  project: ProjectDocumentV5,
  stage: Extract<ProjectStage, 'idea' | 'solution'>,
  options: { revision: number; at: string }
): StageCommandResult {
  if (stage === 'idea') {
    const result = approveIdeaDesign(project, options);
    if (!result.approved) return fail(project, result.reason);
    return ok(
      { ...project, ideaDesign: { ...project.ideaDesign, approval: result.approval } },
      'Fikir tasarımı onaylandı. Artık nasıl kuracağımızı konuşabiliriz.'
    );
  }

  const result = approveSolutionDesign(project, options);
  if (!result.approved) return fail(project, result.reason);
  return ok(
    { ...project, solutionDesign: { ...project.solutionDesign, approval: result.approval } },
    'Teknik tasarım onaylandı. Plan üretilebilir.'
  );
}

/** Onayı gerekçesiyle geri alır; geri dönüş sessiz olmaz. */
export function reopenApproval(
  project: ProjectDocumentV5,
  stage: Extract<ProjectStage, 'idea' | 'solution'>,
  reason: string
): StageCommandResult {
  if (!String(reason || '').trim()) {
    return fail(project, 'Onayı geri almak için nedenini yazman gerekiyor.');
  }

  if (stage === 'idea') {
    const result = reopenIdeaApproval(project, reason);
    return ok({
      ...project,
      ideaDesign: { ...project.ideaDesign, approval: result.ideaApproval },
      solutionDesign: { ...project.solutionDesign, approval: result.solutionApproval }
    }, result.notice);
  }

  const result = reopenSolutionApproval(project, reason);
  return ok(
    { ...project, solutionDesign: { ...project.solutionDesign, approval: result.solutionApproval } },
    result.notice
  );
}

export interface AcceptCandidateInput {
  candidateId: string;
  statement: string;
  rationale: string;
  rejectedAlternatives: RejectedAlternative[];
  revision: number;
}

/** Adayı canonical teknik karara yükseltir — "öneri ≠ karar"ın yazma tarafı. */
export function acceptCandidate(project: ProjectDocumentV5, input: AcceptCandidateInput): StageCommandResult {
  const candidate = (project.solutionDesign?.candidates || []).find(item => item.id === input.candidateId);
  if (!candidate) return fail(project, 'Bu aday artık belgede yok.');

  const promotion = promoteCandidate(candidate, project, {
    statement: input.statement,
    rationale: input.rationale,
    rejectedAlternatives: input.rejectedAlternatives,
    revision: input.revision
  });
  if (!promotion.promoted) return fail(project, promotion.reason);

  return ok({
    ...project,
    decisions: [...project.decisions.filter(item => item.id !== promotion.decision.id), promotion.decision],
    solutionDesign: {
      ...project.solutionDesign,
      candidates: project.solutionDesign.candidates.map(item =>
        item.id === candidate.id ? promotion.candidate : item
      ),
      concerns: project.solutionDesign.concerns.map(concern =>
        concern.id === candidate.concernId ? normalizeConcern({ ...concern, status: 'decided' }) : concern
      ),
      concernDecisions: [
        ...project.solutionDesign.concernDecisions.filter(item => item.concernId !== candidate.concernId),
        promotion.concernDecision
      ]
    }
  }, `“${candidate.title}” teknik karar olarak kaydedildi.`);
}

/** Adayı nedeniyle reddeder; aynı teknoloji sonraki turda yeniden önerilmez. */
export function declineCandidate(
  project: ProjectDocumentV5,
  candidateId: string,
  reason: string
): StageCommandResult {
  const candidate = (project.solutionDesign?.candidates || []).find(item => item.id === candidateId);
  if (!candidate) return fail(project, 'Bu aday artık belgede yok.');

  let rejected;
  try {
    rejected = rejectCandidate(candidate, reason);
  } catch (error) {
    return fail(project, error instanceof Error ? error.message : String(error));
  }

  return ok({
    ...project,
    solutionDesign: {
      ...project.solutionDesign,
      candidates: project.solutionDesign.candidates.map(item => (item.id === candidateId ? rejected : item))
    }
  }, `“${candidate.title}” reddedildi; bir daha önerilmeyecek.`);
}
