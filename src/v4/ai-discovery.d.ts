import type { ExpansionDimension, GenerationProvenance, ImpactAnalysis, ProjectDocumentV5 } from './contracts.js';
import type { IdeaLabOutput } from './ai/schemas/schemas.js';
import type { ProviderSettings } from './provider-settings.js';
import type { LocalPlanningMemory } from './planning-memory.js';
import type { DiscoveryAIExtraction } from './application/discovery-answer-service.js';

export interface GenerationTurnResult {
  project: ProjectDocumentV5;
  usedFallback?: boolean;
  error?: string | null;
  bundle?: unknown;
}
export interface ProviderConnectionResult {
  ok: boolean;
  message: string;
  providerId: string;
  latencyMs: number;
  errorCode: string | null;
  checkedAt: string;
}

export function getSeenSuggestionFingerprints(project: ProjectDocumentV5): Set<string>;
export function generateExpansionDimensions(idea: string): ExpansionDimension[];
export function buildDiscoverySystemPrompt(project: ProjectDocumentV5): string;
export function generateDiscoveryBundle(project: ProjectDocumentV5, options: { settings: ProviderSettings; credential?: string; direction?: string; memory?: LocalPlanningMemory | null; signal?: AbortSignal }): Promise<GenerationTurnResult>;
export function runConversationalDiscoveryTurn(project: ProjectDocumentV5, options: { message: string; focusedQuestion?: string; settings: ProviderSettings; credential?: string; memory?: LocalPlanningMemory | null; signal?: AbortSignal }): Promise<GenerationTurnResult>;
export function generateDiscoveryAnswerExtraction(project: ProjectDocumentV5, options: { settings: ProviderSettings; credential?: string; answer: string; question?: string; signal?: AbortSignal }): Promise<{
  extraction: DiscoveryAIExtraction | null;
  provenance: GenerationProvenance | null;
  error: string | null;
}>;
export function localFallbackIdeaLab(project: ProjectDocumentV5): IdeaLabOutput;
export function generateIdeaLabBundle(project: ProjectDocumentV5, options: { settings: ProviderSettings; credential?: string; ideaText?: string; signal?: AbortSignal }): Promise<GenerationTurnResult>;
export function generateConceptSummary(project: ProjectDocumentV5, options?: { selectedApproachId?: string }): Promise<ProjectDocumentV5>;
export function generateImpactAnalysis(project: ProjectDocumentV5, userRequest: string, options?: { pendingCommit?: boolean }): Promise<{ project: ProjectDocumentV5; impact: ImpactAnalysis }>;
export function testProviderConnection(settings: Partial<ProviderSettings> & Pick<ProviderSettings, 'providerId' | 'model' | 'baseUrl'>, credential?: string, signal?: AbortSignal): Promise<ProviderConnectionResult>;
