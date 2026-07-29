import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { LocalPlanningMemory } from '../planning-memory.js';
import {
  buildDiscoverySystemPrompt,
  createDiscoveryFallback,
  generateConceptSummaryProject,
  generateExpansionDimensions,
  generateLocalIdeaLabOutput,
  getSeenSuggestionFingerprints,
  mapDiscoveryOutput
} from './deterministic-idea-planning.js';
import {
  generateDiscoveryAnswerExtractionService,
  generateDiscoveryBundleService,
  runConversationalDiscoveryTurnService
} from './discovery-generation-service.js';
import { generateIdeaLabBundleService } from './idea-lab-generation-service.js';
import { createChangeImpactAnalysis } from './change-impact-service.js';

export {
  buildDiscoverySystemPrompt,
  generateExpansionDimensions,
  generateLocalIdeaLabOutput as localFallbackIdeaLab,
  getSeenSuggestionFingerprints
};

const discoveryDependencies = {
  createFallback: createDiscoveryFallback,
  mapProviderOutput: mapDiscoveryOutput
};

export async function generateDiscoveryBundle(
  project: ProjectDocumentV5,
  options: {
    settings?: ProviderSettings;
    credential?: string;
    direction?: string;
    memory?: LocalPlanningMemory | null;
    signal?: AbortSignal;
  } = {}
) {
  return generateDiscoveryBundleService(project, options, discoveryDependencies);
}

export async function generateDiscoveryAnswerExtraction(
  project: ProjectDocumentV5,
  options: {
    settings?: ProviderSettings;
    credential?: string;
    answer?: string;
    question?: string;
    signal?: AbortSignal;
  } = {}
) {
  return generateDiscoveryAnswerExtractionService(project, options);
}

export async function runConversationalDiscoveryTurn(
  project: ProjectDocumentV5,
  options: {
    message: string;
    focusedQuestion?: string;
    settings?: ProviderSettings;
    credential?: string;
    memory?: LocalPlanningMemory | null;
    signal?: AbortSignal;
  }
) {
  return runConversationalDiscoveryTurnService(project, options, discoveryDependencies);
}

export async function generateIdeaLabBundle(
  project: ProjectDocumentV5,
  options: {
    settings?: ProviderSettings;
    credential?: string;
    ideaText?: string;
    signal?: AbortSignal;
  } = {}
) {
  return generateIdeaLabBundleService(project, options, generateLocalIdeaLabOutput);
}

export async function generateConceptSummary(
  project: ProjectDocumentV5,
  { selectedApproachId = '' }: { selectedApproachId?: string } = {}
): Promise<ProjectDocumentV5> {
  return generateConceptSummaryProject(project, selectedApproachId);
}

export async function generateImpactAnalysis(
  project: ProjectDocumentV5,
  userRequest: string,
  options: { pendingCommit?: boolean } = {}
) {
  return createChangeImpactAnalysis(project, userRequest, options);
}
