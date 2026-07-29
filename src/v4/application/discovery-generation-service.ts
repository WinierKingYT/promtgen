import type {
  GenerationProvenance,
  ProjectDocumentV5,
  SuggestionBundle
} from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { LocalPlanningMemory } from '../planning-memory.js';
import type {
  DiscoveryAnswerExtractionOutput,
  DiscoveryOutput
} from '../ai/schemas/schemas.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import { addExplorationMessage } from '../planning-engine.js';
import {
  buildIdeaDiscussionContext,
  captureDiscussionBundle
} from './idea-discussion-service.js';

export interface DiscoverySuggestionBundle extends SuggestionBundle {
  replyMessage?: string;
  analysisNote?: string;
}

export interface DiscoveryBundleResult {
  bundle: DiscoverySuggestionBundle;
  usedFallback: boolean;
  error: string | null;
}

export interface DiscoveryGenerationOptions {
  settings?: ProviderSettings;
  credential?: string;
  direction?: string;
  memory?: LocalPlanningMemory | null;
  signal?: AbortSignal;
}

export interface DiscoveryGenerationDependencies {
  createFallback(project: ProjectDocumentV5, direction: string, reason?: string): DiscoverySuggestionBundle;
  mapProviderOutput(
    project: ProjectDocumentV5,
    output: DiscoveryOutput,
    providerId: string,
    provenance: GenerationProvenance
  ): DiscoverySuggestionBundle | null;
}

export async function generateDiscoveryBundleService(
  project: ProjectDocumentV5,
  {
    settings,
    credential = '',
    direction = '',
    memory = null,
    signal
  }: DiscoveryGenerationOptions,
  dependencies: DiscoveryGenerationDependencies
): Promise<DiscoveryBundleResult> {
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    return {
      bundle: dependencies.createFallback(project, direction),
      usedFallback: true,
      error: null
    };
  }

  try {
    const run = await runRegisteredAITask<DiscoveryOutput>('discovery', {
      project,
      settings,
      credential,
      input: {
        direction,
        memory: settings.useLocalMemory && memory?.sourceProjectCount ? memory : null
      },
      signal
    });
    const bundle = dependencies.mapProviderOutput(
      project,
      run.output,
      settings.providerId,
      run.provenance
    );
    if (!bundle) throw new Error('AI yeterli sayıda yeni ve benzersiz seçenek üretmedi.');
    return { bundle, usedFallback: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI çağrısı başarısız.';
    return {
      bundle: dependencies.createFallback(project, direction, message),
      usedFallback: true,
      error: message
    };
  }
}

export interface DiscoveryAnswerExtractionOptions {
  settings?: ProviderSettings;
  credential?: string;
  answer?: string;
  question?: string;
  signal?: AbortSignal;
}

export interface DiscoveryAnswerExtractionResult {
  extraction: DiscoveryAnswerExtractionOutput | null;
  provenance: GenerationProvenance | null;
  error: string | null;
}

export async function generateDiscoveryAnswerExtractionService(
  project: ProjectDocumentV5,
  {
    settings,
    credential = '',
    answer = '',
    question = '',
    signal
  }: DiscoveryAnswerExtractionOptions
): Promise<DiscoveryAnswerExtractionResult> {
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    return {
      extraction: null,
      provenance: null,
      error: 'AI karşılaştırması için etkin bir sağlayıcı gerekli.'
    };
  }

  try {
    const run = await runRegisteredAITask<DiscoveryAnswerExtractionOutput>(
      'discovery-answer-extraction',
      {
        project,
        settings,
        credential,
        input: { answer, question },
        signal
      }
    );
    return { extraction: run.output, provenance: run.provenance, error: null };
  } catch (error) {
    return {
      extraction: null,
      provenance: null,
      error: error instanceof Error ? error.message : 'AI alan karşılaştırması başarısız.'
    };
  }
}

export interface ConversationalDiscoveryOptions extends DiscoveryGenerationOptions {
  message: string;
  focusedQuestion?: string;
}

export async function runConversationalDiscoveryTurnService(
  project: ProjectDocumentV5,
  {
    message,
    focusedQuestion = '',
    settings,
    credential = '',
    memory = null,
    signal
  }: ConversationalDiscoveryOptions,
  dependencies: DiscoveryGenerationDependencies
): Promise<DiscoveryBundleResult & {
  project: ProjectDocumentV5;
  assistantMessage: string;
}> {
  const answer = String(message || '').trim();
  if (!answer) throw new Error('Keşif mesajı boş olamaz.');
  const mode = project.ideaDiscussion?.mode || 'explore';
  const modeInstruction = {
    explore: 'Fikrin yeni kullanım biçimlerini ve değerini keşfet.',
    challenge: 'Varsayımları zorla, riskleri ve başarısızlık ihtimallerini görünür yap.',
    compare: 'Uygulanabilir alternatifleri açık trade-offlarla karşılaştır.',
    clarify: 'Belirsiz kapsamı, hedef kullanıcıyı ve başarı ölçütlerini netleştir.'
  }[mode];
  const discussionContext = buildIdeaDiscussionContext(project);
  const historyInstruction = [
    discussionContext.accepted.length
      ? `Kabul edilen kayıtlar: ${discussionContext.accepted.map(item => item.text).join(' | ')}`
      : '',
    discussionContext.rejected.length
      ? `Yeniden önerme: ${discussionContext.rejected.map(item => item.text).join(' | ')}`
      : '',
    discussionContext.deferred.length
      ? `Şimdilik ertele: ${discussionContext.deferred.map(item => item.text).join(' | ')}`
      : ''
  ].filter(Boolean).join('\n');
  const direction = `Tartışma modu: ${mode}. ${modeInstruction}\n${focusedQuestion
    ? `Açık soru: ${String(focusedQuestion).trim()}\nKullanıcı yanıtı: ${answer}`
    : `Kullanıcı mesajı: ${answer}`}${historyInstruction ? `\n${historyInstruction}` : ''}`;
  const withUserMessage = addExplorationMessage(project, 'user', answer);
  const result = await generateDiscoveryBundleService(
    withUserMessage,
    { settings, credential, direction, memory, signal },
    dependencies
  );
  const replyText = result.bundle.replyMessage || result.bundle.title;
  let next = addExplorationMessage(withUserMessage, 'assistant', replyText);
  if (result.bundle.analysisNote && next.messages.length) {
    next.messages[next.messages.length - 1].analysisNote = result.bundle.analysisNote;
  }
  next.proposalStore.bundles.push(result.bundle);
  next = captureDiscussionBundle(next, result.bundle, next.messages.at(-1)?.id || '');
  if (focusedQuestion) {
    next.openQuestions = next.openQuestions.filter(question => question !== focusedQuestion);
  }
  for (const question of result.bundle.openQuestions || []) {
    if (!next.openQuestions.includes(question)) next.openQuestions.push(question);
  }
  next.metadata.lastDiscoveryProvider = result.bundle.source;
  return { ...result, project: next, assistantMessage: replyText };
}
