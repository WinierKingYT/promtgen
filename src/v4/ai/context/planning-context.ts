import type { ProjectDocumentV5 } from '../../contracts.js';
import {
  projectInventoryContext,
  wrapUntrustedProjectContext,
  type ProjectInventoryReport
} from '../../project-analyzer.js';

export function buildPlanningContext(project: ProjectDocumentV5, sectionId: string | null = null) {
  const section = sectionId ? project.sections[sectionId] : null;
  return {
    project: {
      name: project.identity.name,
      idea: project.identity.originalIdea,
      summary: project.identity.summary,
      depth: project.planningDepth.selected
    },
    phase: project.lifecycle.activePhase,
    acceptedDecisions: project.decisions.filter(item => item.status === 'accepted'),
    openQuestions: project.openQuestions,
    rejectedSuggestions: project.dismissedSuggestionFingerprints,
    importedProject: project.profile?.projectInventory
      ? wrapUntrustedProjectContext(
        projectInventoryContext(project.profile.projectInventory as unknown as ProjectInventoryReport)
      )
      : null,
    relevantPlan: section
      ? { [section.id]: section }
      : Object.fromEntries(
        Object.values(project.sections)
          .filter(item => item.required)
          .map(item => [item.id, { content: item.content, items: item.items, status: item.status }])
      )
  };
}
