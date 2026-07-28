import type { AnonymousUserSession } from '../benchmarks/comparison-benchmark.js';
import type { ProjectDocumentV5 } from '../contracts.js';

export interface IdeaGuide {
  title: string;
  improvedIdea: string;
  targetUser: string;
  problem: string;
  mvp: string[];
  outOfScope: string[];
  risks: string[];
  nextSteps: string[];
}

const compact = (values: Array<string | undefined>, fallback: string) => {
  const unique = [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 6);
  return unique.length ? unique : [fallback];
};

export function buildIdeaGuide(project: ProjectDocumentV5): IdeaGuide {
  const concept = project.ideaLabSession?.conceptSummary;
  const accepted = project.ideaDiscussion.records.filter(record => record.status === 'accepted');
  const decisions = accepted.filter(record => record.kind === 'decision').map(record => record.text);
  const risks = accepted.filter(record => record.kind === 'risk').map(record => record.text);
  const questions = accepted.filter(record => record.kind === 'question').map(record => record.answer || record.text);

  return {
    title: project.identity.name,
    improvedIdea: concept?.summary || project.identity.summary || project.identity.originalIdea,
    targetUser: concept?.targetUser || 'Hedef kullanıcı henüz netleştirilmedi.',
    problem: concept?.problemStatement || project.identity.desiredOutcome || 'Çözülecek problem henüz netleştirilmedi.',
    mvp: compact([...(concept?.confirmedFeatures || []), ...decisions], 'Önce tek ana kullanım akışını doğrula.'),
    outOfScope: compact(concept?.outOfScope || [], 'İlk sürüm dışındaki özellikleri ayrıca işaretle.'),
    risks: compact([...(concept?.knownRisks || []), ...risks], 'En büyük teknik ve ürün belirsizliğini küçük bir prototiple doğrula.'),
    nextSteps: compact([
      ...questions,
      ...(concept?.openQuestions || []),
      'Hedef kullanıcıyla problemi doğrula.',
      'MVP içi ve kapsam dışı özellikleri kesinleştir.',
      'İlk çalışan dilimi ve başarı ölçütünü belirle.'
    ], 'Bir sonraki en küçük doğrulama adımını seç.')
  };
}

export function ideaGuideToMarkdown(guide: IdeaGuide): string {
  const list = (items: string[]) => items.map(item => `- ${item}`).join('\n');
  return `# ${guide.title}\n\n## Geliştirilmiş fikir\n\n${guide.improvedIdea}\n\n## Kim için?\n\n${guide.targetUser}\n\n## Hangi problem?\n\n${guide.problem}\n\n## İlk sürümde\n\n${list(guide.mvp)}\n\n## Şimdilik dışında\n\n${list(guide.outOfScope)}\n\n## Riskler\n\n${list(guide.risks)}\n\n## Sıradaki adımlar\n\n${list(guide.nextSteps)}\n`;
}

export function buildAnonymousStudySession(
  project: ProjectDocumentV5,
  satisfaction: 1 | 2 | 3 | 4 | 5,
  now = new Date()
): AnonymousUserSession {
  const startedAt = Date.parse(project.lifecycle.createdAt);
  return {
    schemaVersion: 1,
    anonymousSessionId: crypto.randomUUID(),
    capabilityId: 'canonical-planning',
    consent: true,
    completed: project.lifecycle.status === 'finalized' || project.lifecycle.activePhase === 'READY',
    firstExportReached: project.exports.length > 0,
    mvpAcceptedWithMinorEdits: Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed),
    manualEditCount: project.commandLog.filter(record =>
      ['UpdateConceptAgreement', 'UpdatePlanSection', 'UpdateSuggestionStatus'].includes(record.commandType)
    ).length,
    durationSeconds: Number.isFinite(startedAt) ? Math.max(0, Math.round((now.getTime() - startedAt) / 1000)) : 0,
    satisfaction
  };
}
