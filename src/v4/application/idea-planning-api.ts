import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { LocalPlanningMemory } from '../planning-memory.js';
import {
  buildDiscoverySystemPrompt,
  createDiscoveryFallback,
  generateExpansionDimensions,
  generateLocalIdeaLabOutput,
  getSeenSuggestionFingerprints,
  mapDiscoveryOutput
} from './deterministic-idea-planning.js';
import {
  generateDiscoveryBundleService,
  runConversationalDiscoveryTurnService
} from './discovery-generation-service.js';
import { generateIdeaLabBundleService } from './idea-lab-generation-service.js';
import { runIdeaConcernDiscoveryService } from './idea-concern-discovery-run.js';
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

/**
 * Konu çıkarımı — sohbetin yanındaki İKİNCİ giriş kapısı. Bağımlılıklar
 * sohbet turuyla AYNI (`discoveryDependencies`): iki kapı da aynı görevi,
 * aynı eşlemeyi ve aynı yerel-yedek elemesini kullanır.
 */
export async function runIdeaConcernDiscovery(
  project: ProjectDocumentV5,
  options: {
    settings?: ProviderSettings;
    credential?: string;
    providerLabel: string;
    signal?: AbortSignal;
  }
) {
  return runIdeaConcernDiscoveryService(project, options, discoveryDependencies);
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

export async function generateImpactAnalysis(
  project: ProjectDocumentV5,
  userRequest: string,
  options: { pendingCommit?: boolean } = {}
) {
  return createChangeImpactAnalysis(project, userRequest, options);
}
