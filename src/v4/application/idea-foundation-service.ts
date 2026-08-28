import type {
  ConceptSummary,
  GenerationProvenance,
  IdeaFoundationFieldName,
  IdeaFoundationGrounding,
  ProjectDocumentV5
} from '../contracts.js';
import { IDEA_FOUNDATION_FIELD_NAMES } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import type { IdeaFoundationOutput } from '../ai/schemas/schemas.js';
import { getTaskDefinition } from '../ai/registry.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import { containsPromptInjection } from '../security/context-isolation.js';
import { verifyIdeaClaim } from './foundation-idea-claim.js';
import { createInitialConceptInterpretation } from './idea-discussion-service.js';

const ideaFoundationTask = getTaskDefinition('idea-foundation');

/** Modelin hedeflediği `ConceptSummary` alanları -- sıra, isteme yazılan sıra ile aynı. */
const FOUNDATION_FIELDS = IDEA_FOUNDATION_FIELD_NAMES;

export type IdeaFoundationField = IdeaFoundationFieldName;

export interface GenerateIdeaFoundationOptions {
  settings?: ProviderSettings;
  credential?: string;
  provider?: StructuredProvider;
  signal?: AbortSignal;
}

export interface IdeaFoundationResult {
  summary: ConceptSummary;
  provenance: GenerationProvenance;
  /** true: hiç AI çağrısı yapılmadı (offline/kapalı) veya çağrı tamamen başarısız oldu. */
  usedFallback: boolean;
  error: string | null;
  /** Enjeksiyon şüphesiyle düşürülüp deterministik değere döndürülen alanlar. */
  rejectedFields: IdeaFoundationField[];
}

function localFoundationProvenance(reason = ''): GenerationProvenance {
  const now = new Date().toISOString();
  return {
    runId: `fallback-run-${globalThis.crypto.randomUUID()}`,
    mode: reason ? 'fallback' : 'rule-engine',
    providerId: 'offline',
    model: null,
    promptVersion: ideaFoundationTask.promptVersion,
    requestedAt: now,
    completedAt: now,
    latencyMs: 0,
    retryCount: 0,
    fallbackReason: reason || null,
    schemaId: ideaFoundationTask.schemaId,
    schemaVersion: ideaFoundationTask.schemaVersion,
    inputHash: 'not-sent-to-provider'
  };
}

/**
 * Modelden fikrin temelini ister: bu şey ne, kimin için, bugün nasıl
 * çözülüyor, beklenen sonuç ve ilk sürümün tek hedefi. Sağlayıcı kapalıyken
 * veya çağrı herhangi bir nedenle başarısız olursa TAMAMEN deterministik
 * `createInitialConceptInterpretation()` çıktısına döner -- bu yol zaten var,
 * güven skoru konusunda dürüst (`interpretationConfidence: 42` gibi düşük
 * sabit değerler) ve offline hiçbir zaman bugünkünden kötü olmaz.
 *
 * GÜVENLİK: model-yazımı her alan `buildBudgetedContext`/plan üretimine geri
 * beslenecek (model-to-model prompt-injection zinciri). Bu yüzden her alan
 * ayrı ayrı `containsPromptInjection` ile denetlenir; şüpheli olan SANİTİZE
 * EDİLİP TUTULMAZ -- yalnız O ALAN için deterministik değere düşülür, temiz
 * alanlar bundan etkilenmez (bkz. application/idea-axis-service.ts, aynı desen).
 */
export async function generateIdeaFoundation(
  project: ProjectDocumentV5,
  { settings, credential = '', provider, signal }: GenerateIdeaFoundationOptions
): Promise<IdeaFoundationResult> {
  const deterministic = createInitialConceptInterpretation(project);
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    return {
      summary: deterministic,
      provenance: localFoundationProvenance(),
      usedFallback: true,
      error: null,
      rejectedFields: []
    };
  }

  try {
    const run = await runRegisteredAITask<IdeaFoundationOutput>('idea-foundation', {
      project,
      settings,
      credential,
      provider,
      signal
    });

    const rejectedFields: IdeaFoundationField[] = [];
    const grounding = {} as IdeaFoundationGrounding;
    const merged: ConceptSummary = { ...deterministic, userConfirmed: false };
    for (const field of FOUNDATION_FIELDS) {
      const output = run.output[field];
      // Model dürüstçe "bu fikirde yok" dedi: metin YOK, yalnız gerekçe var.
      // Deterministik dolgu metnini burada geri getirmek tam bu düzeltmenin
      // önlediği şeydir -- alan boş bırakılır, gerekçe grounding'e yazılır.
      if (output.source === 'unknown') {
        const reason = output.reason.trim();
        if (!reason || containsPromptInjection(reason)) {
          rejectedFields.push(field);
          grounding[field] = { source: 'fallback' };
          continue;
        }
        merged[field] = '';
        grounding[field] = { source: 'unknown', reason };
        continue;
      }
      const value = output.text.trim();
      // Düşürme kararı geri döndürülemez: burada geçen metin plan üretimine
      // ve başka bir modele bağlam olarak gidecek. Sanitize edip tutmak
      // değil, yalnız o alanı deterministik değerde bırakmak güvenlidir.
      // Deterministik değere düşen bir alan idea-grounded İDDİA EDİLEMEZ.
      if (!value || containsPromptInjection(value)) {
        rejectedFields.push(field);
        grounding[field] = { source: 'fallback' };
        continue;
      }
      merged[field] = value;
      // Modelin `idea` iddiası GÜVENİLMEZ: canlı ölçümde `summary` 4/4
      // `source:'idea'` geldi ve fikirde hiç geçmeyen "yarış", "savaş",
      // "ekipman ekleme", "atların rengi, büyüklüğü" içeriyordu. Yanlış etiket
      // etiketsizden KÖTÜDÜR -- uydurmayı "bu senin fikrinden çıktı" diye
      // sunar. Bu yüzden iddia mekanik olarak sınanır (bkz.
      // foundation-idea-claim.ts); doğrulanamayan `idea`, METNİ KORUNARAK
      // `assumption`a düşer ve arayüzde mevcut "Varsayım · fikirde yok"
      // rozetiyle görünür.
      //
      // Yalnız DÜŞÜRME yönü vardır: `assumption`/`unknown` asla `idea`ya
      // YÜKSELTİLMEZ -- model kendine güven puanı veremez. Sınama enjeksiyon
      // denetiminden SONRA gelir; zehirli alan yukarıda `fallback` yazılıp
      // `continue` edildiği için buraya hiç ulaşmaz, dolayısıyla bir
      // `fallback` alanı asla `assumption`a çevrilmez.
      const demoted = output.source === 'idea'
        && !verifyIdeaClaim(value, project.identity.originalIdea).grounded;
      grounding[field] = { source: demoted ? 'assumption' : output.source };
    }
    merged.foundationGrounding = grounding;

    return {
      summary: merged,
      provenance: run.provenance,
      usedFallback: false,
      error: null,
      rejectedFields
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI çağrısı başarısız.';
    return {
      summary: deterministic,
      provenance: localFoundationProvenance(message),
      usedFallback: true,
      error: message,
      rejectedFields: []
    };
  }
}

/**
 * Üretilen temeli projeye taslak olarak yazar. Yalnız GERÇEKTEN üretilmiş bir
 * temel için çağrılmalıdır (`usedFallback === false`) -- aksi hâlde bugünkü
 * davranışı (fikir koçu 'problem' adımında boş başlar) sessizce değiştirmiş
 * oluruz; bkz. planning-engine.ts `analyzeIdea` yorumu ve
 * tests/v4/project-creation-production.test.ts.
 */
export function applyIdeaFoundationDraft(
  project: ProjectDocumentV5,
  result: IdeaFoundationResult
): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.ideaLabSession = {
    ...(next.ideaLabSession || {
      status: 'active',
      approaches: [],
      ideaNotes: [],
      candidateDecisions: [],
      candidateRisks: []
    }),
    conceptSummary: result.summary,
    conceptSummaryProvenance: result.provenance
  };
  return next;
}
