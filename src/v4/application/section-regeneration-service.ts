import { getTaskDefinition } from '../ai/registry.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import { normalizeSectionPatchProposal } from '../canonical-entities.js';
import type {
  GenerationProvenance,
  ProjectDocumentV5,
  SectionPatchProposal
} from '../contracts.js';
import { captureCurrentRevision, recalculateReadiness } from '../planning-engine.js';
import type { ProviderSettings } from '../provider-settings.js';

const regenerateAffectedSectionsTask = getTaskDefinition('regenerate-affected-sections');

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localProvenance(reason: string | null): GenerationProvenance {
  const timestamp = now();
  return {
    runId: id('section-run'),
    mode: reason ? 'fallback' : 'rule-engine',
    providerId: 'offline',
    model: null,
    promptVersion: regenerateAffectedSectionsTask.promptVersion,
    requestedAt: timestamp,
    completedAt: timestamp,
    latencyMs: 0,
    retryCount: 0,
    fallbackReason: reason,
    schemaId: regenerateAffectedSectionsTask.schemaId,
    schemaVersion: regenerateAffectedSectionsTask.schemaVersion,
    inputHash: 'not-sent-to-provider'
  };
}

function localOutput(project: ProjectDocumentV5, impactId: string) {
  const impact = (project.impactAnalyses || []).find(item => item.id === impactId);
  if (!impact || impact.status !== 'accepted') throw new Error('Kabul edilmiş etki analizi bulunamadı.');
  return {
    summary: `"${impact.userRequest}" değişikliği için etkilenen plan bölümleri yerel kurallarla hazırlandı.`,
    patches: impact.affectedSections.filter(sectionId => project.sections[sectionId]).map(sectionId => {
      const section = project.sections[sectionId];
      const acceptedDecisions = project.decisions
        .filter(decision => decision.status === 'accepted' && decision.affectedSectionIds.includes(sectionId))
        .map(decision => `Karar: ${decision.decision}`);
      const relevantItems = sectionId === 'requirements'
        ? project.requirements.filter(item => item.status === 'accepted').slice(-5).map(item => `Gereksinim: ${item.statement}`)
        : sectionId === 'risks'
          ? project.risks.filter(item => item.status === 'open').slice(-5).map(item => `Risk: ${item.title} — ${item.mitigation}`)
          : [];
      const addition = [
        `Değişiklik: ${impact.userRequest}`,
        ...acceptedDecisions,
        ...relevantItems
      ].filter(Boolean).join('\n');
      return {
        sectionId,
        proposedContent: [section.content.trim(), addition].filter(Boolean).join('\n\n'),
        rationale: impact.summary,
        warnings: section.warnings
      };
    })
  };
}

function appendProposals(
  project: ProjectDocumentV5,
  impactId: string,
  output: { patches: Array<{ sectionId: string; proposedContent: string; rationale: string; warnings?: string[] }> },
  provenance: GenerationProvenance
) {
  const impact = (project.impactAnalyses || []).find(item => item.id === impactId);
  if (!impact) throw new Error('Etki analizi bulunamadı.');
  const allowed = new Set(impact.affectedSections);
  const seen = new Set<string>();
  const proposals = output.patches.filter(patch => {
    if (!allowed.has(patch.sectionId) || !project.sections[patch.sectionId] || seen.has(patch.sectionId)) return false;
    seen.add(patch.sectionId);
    return true;
  }).map((patch, index) => normalizeSectionPatchProposal({
    id: `${id('section-patch')}-${index}`,
    impactAnalysisId: impactId,
    baseCanonicalRevision: project.canonicalRevision,
    sectionId: patch.sectionId,
    originalContent: project.sections[patch.sectionId].content,
    proposedContent: patch.proposedContent,
    rationale: patch.rationale,
    warnings: patch.warnings || [],
    status: 'pending',
    provenance,
    createdAt: now()
  }) as SectionPatchProposal);
  if (!proposals.length) throw new Error('AI etkilenen canonical bölümler için geçerli patch üretmedi.');
  const next = structuredClone(project);
  for (const existing of next.sectionPatchProposals.filter(item => item.impactAnalysisId === impactId && item.status === 'pending')) {
    existing.status = 'stale';
    existing.resolvedAt = now();
  }
  next.sectionPatchProposals.push(...proposals);
  return { project: next, proposals };
}

export async function generateSectionPatchProposals(project: ProjectDocumentV5, impactId: string, options: {
  settings: ProviderSettings;
  credential?: string;
  signal?: AbortSignal;
  provider?: StructuredProvider;
}) {
  const settings = options.settings;
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    const provenance = localProvenance(null);
    return { ...appendProposals(project, impactId, localOutput(project, impactId), provenance), usedFallback: true, error: null };
  }
  try {
    const run = await runRegisteredAITask<{ summary: string; patches: Array<{ sectionId: string; proposedContent: string; rationale: string; warnings: string[] }> }>('regenerate-affected-sections', {
      project,
      settings,
      credential: options.credential,
      input: { impactId },
      signal: options.signal,
      provider: options.provider
    });
    return { ...appendProposals(project, impactId, run.output, run.provenance), usedFallback: false, error: null };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    const provenance = localProvenance(error);
    return { ...appendProposals(project, impactId, localOutput(project, impactId), provenance), usedFallback: true, error };
  }
}

export function setSectionPatchStatus(
  project: ProjectDocumentV5,
  proposalId: string,
  status: SectionPatchProposal['status'],
  editedContent = ''
) {
  const next = structuredClone(project);
  const proposal = next.sectionPatchProposals.find(item => item.id === proposalId);
  if (!proposal || proposal.status === 'stale') return project;
  if (status === 'edited' && !editedContent.trim()) throw new Error('Düzenlenmiş patch içeriği boş olamaz.');
  proposal.status = status;
  proposal.editedContent = status === 'edited' ? editedContent.trim() : '';
  proposal.resolvedAt = status === 'pending' ? null : now();
  return next;
}

export function applySectionPatchProposals(project: ProjectDocumentV5, impactId: string) {
  const proposals = project.sectionPatchProposals.filter(item => item.impactAnalysisId === impactId && item.status !== 'stale');
  if (!proposals.length) return { success: false as const, project, reason: 'Uygulanabilir bölüm patch paketi bulunamadı.' };
  if (proposals.some(item => item.status === 'pending')) return { success: false as const, project, reason: 'Her bölüm için kabul, düzenleme, erteleme veya ret kararı gerekli.' };
  if (proposals.some(item => item.baseCanonicalRevision !== project.canonicalRevision)) {
    const stale = structuredClone(project);
    for (const proposal of stale.sectionPatchProposals.filter(item => item.impactAnalysisId === impactId && ['accepted', 'edited'].includes(item.status))) {
      proposal.status = 'stale';
      proposal.resolvedAt = now();
    }
    return { success: false as const, project: stale, reason: 'Canonical plan değişti; bölüm patch’leri yeniden üretilmeli.' };
  }
  const approved = proposals.filter(item => item.status === 'accepted' || item.status === 'edited');
  if (!approved.length) return { success: false as const, project, reason: 'Canonical plana uygulanacak kabul edilmiş bölüm yok.' };
  const next = structuredClone(project);
  for (const proposal of approved) {
    const section = next.sections[proposal.sectionId];
    section.content = proposal.status === 'edited' ? proposal.editedContent : proposal.proposedContent;
    section.status = 'ready';
    section.updatedAtRevision = project.canonicalRevision + 1;
  }
  next.documentRevision += 1;
  next.canonicalRevision += 1;
  next.lifecycle.updatedAt = now();
  const recalculated = recalculateReadiness(next);
  const versioned = captureCurrentRevision(recalculated, `Kontrollü bölüm güncellemesi: ${approved.map(item => item.sectionId).join(', ')}`);
  return { success: true as const, project: versioned, reason: '' };
}
