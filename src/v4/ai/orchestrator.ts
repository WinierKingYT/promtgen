import type { GenerationProvenance, ProjectDocumentV5 } from '../contracts.js';

interface StructuredProvider {
  model?: string;
  structured(input: {
    system: string;
    context: unknown;
    schema: { parse(value: unknown): unknown };
    signal?: AbortSignal;
  }): Promise<unknown>;
}

interface AITaskDefinition {
  id: string;
  promptVersion: string;
  schemaId: string;
  schemaVersion: number;
  schema: { parse(value: unknown): unknown };
  timeoutMs: number;
  maxRepairAttempts: number;
  buildPrompt(project: ProjectDocumentV5, input?: Record<string, unknown>): string;
  buildContext(project: ProjectDocumentV5, input?: Record<string, unknown>): unknown;
}

export interface AITaskRunResult<T = unknown> {
  output: T;
  provenance: GenerationProvenance;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function runAITask<T = unknown>({
  task,
  project,
  input = {},
  provider,
  providerId,
  model,
  signal
}: {
  task: AITaskDefinition;
  project: ProjectDocumentV5;
  input?: Record<string, unknown>;
  provider: StructuredProvider;
  providerId: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<AITaskRunResult<T>> {
  const requestedAt = new Date().toISOString();
  const startedAt = performance.now();
  const runId = globalThis.crypto.randomUUID();
  const context = task.buildContext(project, input);
  const prompt = task.buildPrompt(project, input);
  const inputHash = await sha256(JSON.stringify({ taskId: task.id, context }));
  let retryCount = 0;
  let lastError: unknown;

  const timeoutController = signal ? null : new AbortController();
  const requestSignal = signal || timeoutController?.signal;
  const timeout = timeoutController
    ? setTimeout(() => timeoutController.abort(), task.timeoutMs)
    : null;

  try {
    for (let attempt = 0; attempt <= task.maxRepairAttempts; attempt += 1) {
      try {
        const system = attempt === 0
          ? prompt
          : `${prompt}\nÖnceki yanıt şemaya uymadı. Eksik/fazla alan bırakmadan yalnız geçerli JSON üret.`;
        const output = await provider.structured({
          system,
          context,
          schema: task.schema,
          signal: requestSignal
        });
        const completedAt = new Date().toISOString();
        return {
          output: output as T,
          provenance: {
            runId,
            mode: providerId === 'ollama' ? 'local-ai' : 'cloud-ai',
            providerId,
            model: model || provider.model || 'unknown',
            promptVersion: task.promptVersion,
            schemaId: task.schemaId,
            schemaVersion: task.schemaVersion,
            requestedAt,
            completedAt,
            latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
            retryCount,
            fallbackReason: null,
            inputHash
          }
        };
      } catch (error) {
        lastError = error;
        if (attempt >= task.maxRepairAttempts) throw error;
        retryCount += 1;
      }
    }
    throw lastError;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
