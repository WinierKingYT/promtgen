import type {
  DesignApproach,
  GenerationProvenance,
  ProjectDocumentV5
} from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { IdeaLabOutput } from '../ai/schemas/schemas.js';
import { getTaskDefinition } from '../ai/registry.js';
import { runRegisteredAITask } from '../ai/runtime.js';

const ideaLabTask = getTaskDefinition('idea-lab');

export interface IdeaLabGenerationOptions {
  settings?: ProviderSettings;
  credential?: string;
  ideaText?: string;
  signal?: AbortSignal;
}

export interface IdeaLabGenerationResult {
  project: ProjectDocumentV5;
  approaches: DesignApproach[];
  usedFallback: boolean;
  error?: string;
}

export type LocalIdeaLabGenerator = (project: ProjectDocumentV5) => IdeaLabOutput;

function localIdeaLabProvenance(reason = ''): GenerationProvenance {
  const now = new Date().toISOString();
  return {
    runId: `fallback-run-${globalThis.crypto.randomUUID()}`,
    mode: reason ? 'fallback' : 'rule-engine',
    providerId: 'offline',
    model: null,
    promptVersion: ideaLabTask.promptVersion,
    requestedAt: now,
    completedAt: now,
    latencyMs: 0,
    retryCount: 0,
    fallbackReason: reason || null,
    schemaId: ideaLabTask.schemaId,
    schemaVersion: ideaLabTask.schemaVersion,
    inputHash: 'not-sent-to-provider'
  };
}

function applyIdeaLabOutput(
  project: ProjectDocumentV5,
  output: IdeaLabOutput,
  provenance: GenerationProvenance
): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.ideaLabSession = {
    ...(next.ideaLabSession || {}),
    status: 'active',
    approaches: output.approaches,
    ideaNotes: output.ideaNotes,
    candidateDecisions: output.candidateDecisions,
    candidateRisks: output.candidateRisks,
    provenance
  };
  next.lifecycle.activePhase = 'IDEA_LAB';
  return next;
}

export async function generateIdeaLabBundleService(
  project: ProjectDocumentV5,
  {
    settings,
    credential = '',
    ideaText = '',
    signal
  }: IdeaLabGenerationOptions,
  localGenerator: LocalIdeaLabGenerator
): Promise<IdeaLabGenerationResult> {
  const text = ideaText || project.identity.originalIdea || '';
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    const fallback = localGenerator(project);
    const next = applyIdeaLabOutput(project, fallback, localIdeaLabProvenance());
    return { project: next, approaches: fallback.approaches, usedFallback: true };
  }

  try {
    const run = await runRegisteredAITask<IdeaLabOutput>('idea-lab', {
      project,
      settings,
      credential,
      input: { ideaText: text },
      signal
    });
    const next = applyIdeaLabOutput(project, run.output, run.provenance);
    return { project: next, approaches: run.output.approaches, usedFallback: false };
  } catch (error) {
    const fallback = localGenerator(project);
    const reason = error instanceof Error ? error.message : String(error);
    const next = applyIdeaLabOutput(project, fallback, localIdeaLabProvenance(reason));
    return {
      project: next,
      approaches: fallback.approaches,
      usedFallback: true,
      error: reason
    };
  }
}
