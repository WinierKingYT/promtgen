import { toRequirementId, toDecisionId, toTaskId, toRiskId, toProposalId } from '../ids.js';
import { validateCanonicalProject } from '../validation.js';

const PROCESSED_COMMAND_IDS = new Set();

export function acceptProposalItemAtomically(params) {
  const { project, bundleId, itemId, commandId, expectedRevision } = params;

  if (PROCESSED_COMMAND_IDS.has(commandId)) {
    return {
      success: true,
      project,
      alreadyApplied: true
    };
  }

  if (project.revision !== expectedRevision) {
    return {
      success: false,
      project,
      error: `Çakışan revizyon saptandı! Beklenen revizyon: ${expectedRevision}, Mevcut revizyon: ${project.revision}. Lütfen sayfayı yenileyip tekrar deneyin.`
    };
  }

  const nextProject = structuredClone(project);
  const bundle = (nextProject.proposalStore?.bundles || []).find(b => b.id === bundleId);

  if (!bundle) {
    return {
      success: false,
      project,
      error: `Teklif paketi (${bundleId}) bulunamadı.`
    };
  }

  const item = bundle.items.find(i => i.id === itemId);
  if (!item) {
    return {
      success: false,
      project,
      error: `Teklif öğesi (${itemId}) pakette bulunamadı.`
    };
  }

  if (item.status === 'accepted') {
    return {
      success: true,
      project,
      appliedItem: item,
      alreadyApplied: true
    };
  }

  const nowIso = new Date().toISOString();

  if (item.kind === 'feature') {
    const req = {
      id: toRequirementId(`req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      description: item.description,
      category: 'functional',
      priority: item.impact === 'high' ? 'must' : 'should',
      status: 'accepted',
      acceptanceCriteria: [
        {
          id: `ac-${Date.now()}`,
          statement: `"${item.title}" kabul testi doğrulanmalıdır.`,
          verificationMethod: 'user-acceptance',
          measurable: true,
          linkedTestCaseIds: []
        }
      ],
      relatedDecisionIds: [],
      relatedRiskIds: [],
      relatedTaskIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        acceptedAt: nowIso,
        proposalId: toProposalId(bundleId)
      }
    };
    nextProject.requirements.push(req);
  } else if (item.kind === 'decision' || item.kind === 'architecture') {
    const dec = {
      id: toDecisionId(`dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      context: item.description,
      decision: item.title,
      rationale: item.pros.join('; ') || 'AI Keşif grubundan kabul edildi.',
      alternatives: [],
      status: 'accepted',
      relatedRequirementIds: [],
      relatedRiskIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        acceptedAt: nowIso,
        proposalId: toProposalId(bundleId)
      },
      decidedAt: nowIso
    };
    nextProject.decisions.push(dec);
  } else if (item.kind === 'risk') {
    const risk = {
      id: toRiskId(`risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      title: item.title,
      description: item.description,
      category: 'technical',
      probability: 3,
      impact: item.impact === 'high' ? 4 : 2,
      exposure: 3 * (item.impact === 'high' ? 4 : 2),
      status: 'identified',
      relatedRequirementIds: [],
      relatedDecisionIds: [],
      provenance: {
        origin: 'ai',
        createdAt: nowIso,
        proposalId: toProposalId(bundleId)
      }
    };
    nextProject.risks.push(risk);
  }

  item.status = 'accepted';

  const valResult = validateCanonicalProject(nextProject);
  if (!valResult.valid) {
    return {
      success: false,
      project,
      error: `Transaction Invariant Hatası: ${valResult.errors.map(e => e.message).join('; ')}`
    };
  }

  nextProject.revision += 1;
  nextProject.lifecycle.updatedAt = nowIso;
  PROCESSED_COMMAND_IDS.add(commandId);

  return {
    success: true,
    project: nextProject,
    appliedItem: item
  };
}
