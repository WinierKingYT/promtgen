import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import { normalizeProviderSettings } from '../provider-url-policy.js';
import { runAITask, type AITaskRunResult } from './orchestrator.js';
import { createProvider, type StructuredProvider } from './provider-adapters.js';
import { getTaskDefinition, type AITaskType } from './registry.js';

export interface RegisteredAITaskRunOptions {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  credential?: string;
  input?: Record<string, unknown>;
  signal?: AbortSignal;
  provider?: StructuredProvider;
}

export async function runRegisteredAITask<T = unknown>(
  taskId: AITaskType,
  {
    project,
    settings,
    credential = '',
    input = {},
    signal,
    provider
  }: RegisteredAITaskRunOptions
): Promise<AITaskRunResult<T>> {
  const normalized = normalizeProviderSettings(settings, { defaultModel: settings.model });
  if (normalized.providerId === 'offline' || normalized.useAiWhenAvailable === false) {
    throw new Error(`"${taskId}" görevi için etkin bir AI sağlayıcısı gerekli.`);
  }
  const task = getTaskDefinition(taskId);
  const selectedProvider = provider || createProvider(normalized.providerId, {
    model: normalized.model,
    baseUrl: normalized.baseUrl,
    credential
  });
  return runAITask<T>({
    task,
    project,
    input,
    provider: selectedProvider,
    providerId: normalized.providerId,
    model: normalized.model,
    signal
  });
}
