import { normalizeObjective } from '../canonical-entities.js';
import type { ProjectDocumentV5 } from '../contracts.js';
import { confirmConceptSummary } from '../planning-engine.js';
import { getConceptAgreementGate, updateIdeaRecordStatus } from './idea-discussion-service.js';
import { createRequirementDraftsFromConcept } from './requirement-quality-service.js';
import { markCurrentIdeaRevisionConverted } from './idea-document-revision-service.js';

export interface IdeaPlanConversionPreview {
  baseDocumentRevision: number;
  baseCanonicalRevision: number;
  canConvert: boolean;
  alreadyConverted: boolean;
  blockers: string[];
  objective: string;
  objectiveCount: number;
  requirementTitles: string[];
  acceptedDecisions: number;
  risks: number;
  affectedSections: string[];
}

export type IdeaPlanConversionResult =
  | { success: true; project: ProjectDocumentV5 }
  | { success: false; project: ProjectDocumentV5; reason: string };

function conversionBlockers(project: ProjectDocumentV5): string[] {
  const gate = getConceptAgreementGate(project);
  return [
    ...gate.missingInterpretationFields.map(field => `${field} alanı tamamlanmalı.`),
    ...gate.missingScopeLists.map(field => `${field} listesi en az bir madde içermeli.`),
    ...gate.unresolvedSummaryQuestions.map(question => `Açık soru kapatılmalı: ${question}`),
    // Yalnız kritik kayıtlar blokler. Ertelenebilir kayıtlar dönüşüm sırasında
    // otomatik ertelenir ve plana varsayım/risk olarak taşınır; kullanıcı üç
    // cevap sonrası biriken onlarca kaydı tek tek karara bağlamak zorunda değil.
    ...(gate.criticalPending.length
      ? [`${gate.criticalPending.length} kritik karar veya açık soru çözülmeli.`]
      : []),
    ...(gate.unansweredAcceptedQuestions.length
      ? [`${gate.unansweredAcceptedQuestions.length} kabul edilmiş soru cevaplanmalı.`]
      : [])
  ];
}

function objectiveId(project: ProjectDocumentV5): string {
  const base = `objective-mvp-${project.id}`.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80);
  if (!project.objectives.some(item => item.id === base)) return base;
  let suffix = 2;
  while (project.objectives.some(item => item.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function buildConversionCandidate(project: ProjectDocumentV5): ProjectDocumentV5 {
  // Ertelenebilir kayıtlar sessizce yok sayılmaz: dönüşüm anında açıkça
  // "deferred" olarak damgalanır, böylece defterde izleri kalır ve kullanıcı
  // daha sonra geri dönebilir.
  const deferrable = getConceptAgreementGate(project).deferrablePending;
  let next = confirmConceptSummary(
    deferrable.reduce((carry, record) => updateIdeaRecordStatus(carry, record.id, 'deferred'), project)
  ) as ProjectDocumentV5;
  const summary = next.ideaLabSession?.conceptSummary;
  if (!summary) throw new Error('Plan dönüşümü için fikir belgesi bulunamadı.');

  if (!next.objectives.some(item => item.status === 'accepted')) {
    next.objectives.push(normalizeObjective({
      id: objectiveId(next),
      title: summary.mvpTarget,
      description: summary.desiredOutcome,
      metric: 'Kullanıcı onaylı ilk sürüm akışının tamamlanması',
      target: 'MVP kapsamındaki kabul kriterlerinin karşılanması',
      priority: 'must',
      status: 'accepted'
    }));
  }
  next = createRequirementDraftsFromConcept(next);
  return markCurrentIdeaRevisionConverted(next, project.canonicalRevision + 1);
}

export function previewIdeaPlanConversion(project: ProjectDocumentV5): IdeaPlanConversionPreview {
  const summary = project.ideaLabSession?.conceptSummary;
  const alreadyConverted = Boolean(summary?.userConfirmed);
  const blockers = alreadyConverted
    ? []
    : conversionBlockers(project);
  const candidate = !alreadyConverted && blockers.length === 0
    ? buildConversionCandidate(project)
    : null;
  const existingRequirementIds = new Set(project.requirements.map(item => item.id));

  return {
    baseDocumentRevision: project.documentRevision,
    baseCanonicalRevision: project.canonicalRevision,
    canConvert: !alreadyConverted && blockers.length === 0,
    alreadyConverted,
    blockers,
    objective: summary?.mvpTarget || '',
    objectiveCount: candidate ? Math.max(0, candidate.objectives.length - project.objectives.length) : 0,
    requirementTitles: candidate
      ? candidate.requirements.filter(item => !existingRequirementIds.has(item.id)).map(item => item.title)
      : [...new Set(summary?.confirmedFeatures || [])],
    acceptedDecisions: candidate ? Math.max(0, candidate.decisions.length - project.decisions.length) : 0,
    risks: candidate ? Math.max(0, candidate.risks.length - project.risks.length) : 0,
    affectedSections: ['vision', 'scope', 'requirements', 'decisions', 'architecture', 'risks']
  };
}

export function applyIdeaPlanConversion(
  project: ProjectDocumentV5,
  preview: Pick<IdeaPlanConversionPreview, 'baseDocumentRevision' | 'baseCanonicalRevision'>
): IdeaPlanConversionResult {
  if (
    project.documentRevision !== preview.baseDocumentRevision
    || project.canonicalRevision !== preview.baseCanonicalRevision
  ) {
    return {
      success: false,
      project,
      reason: 'Fikir belgesi önizlemeden sonra değişti. Güncel dönüşüm önizlemesini yeniden aç.'
    };
  }
  const current = previewIdeaPlanConversion(project);
  if (current.alreadyConverted) {
    return { success: false, project, reason: 'Bu fikir belgesi zaten canonical plana dönüştürüldü.' };
  }
  if (!current.canConvert) {
    return { success: false, project, reason: current.blockers[0] || 'Fikir belgesi henüz plana dönüştürülemez.' };
  }
  try {
    return { success: true, project: buildConversionCandidate(project) };
  } catch (error) {
    return {
      success: false,
      project,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
