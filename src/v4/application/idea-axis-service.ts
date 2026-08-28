import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import type { IdeaAxesOutput } from '../ai/schemas/schemas.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import { containsPromptInjection } from '../security/context-isolation.js';
import { fingerprint } from './deterministic-idea-planning.js';
import type { ExpansionCategory } from '../idea-expansion/categories.js';

/** Tier 3 en fazla bu kadar eksen katkıda bulunabilir. */
const MAX_AI_AXES = 3;
const MAX_LABEL_LENGTH = 80;
const MAX_HINT_LENGTH = 200;
/** Model-authored kimlikler her zaman bu önekle başlar; CORE/BY_DOMAIN/pack kimlikleriyle asla çakışmaz. */
const AI_AXIS_ID_PREFIX = 'ai.';

export interface GenerateIdeaAxesOptions {
  settings: ProviderSettings;
  credential?: string;
  provider?: StructuredProvider;
  signal?: AbortSignal;
}

/**
 * Modelden bu fikre özel genişletme eksenleri ister. Senkron ve saf
 * `getExpansionCategories`'in AKSİNE bu fonksiyon ağa çıkar; bilerek ayrı
 * tutulur ve yalnız React tarafında render zamanında, state içinde
 * birleştirilir — bkz. idea-expansion/categories.ts başlık yorumu.
 *
 * Sağlayıcı kapalıyken (veya çağrı herhangi bir nedenle başarısız olursa)
 * sessizce boş dizi döner: pano zaten tier 1-2 ile tam işlevseldir, bu
 * katman yalnız katkı ekler, hiçbir zaman hata yüzeyi açmaz.
 *
 * GÜVENLİK: model-yazımı `label`/`hint` ikinci bir modele (idea-expansion
 * görevi) categoryLabel/categoryHint olarak geri beslenecek. Bu, model-to-
 * model prompt-injection zinciri kurar: zehirli bir eksen ikinci çağrıyı
 * ele geçirebilir. Her eksen burada `containsPromptInjection` ile denetlenir
 * ve şüpheli olan SANİTİZE EDİLİP TUTULMAZ — doğrudan düşürülür.
 */
export async function generateIdeaAxes(
  project: ProjectDocumentV5,
  { settings, credential = '', provider, signal }: GenerateIdeaAxesOptions
): Promise<ExpansionCategory[]> {
  if (!settings || settings.providerId === 'offline' || settings.useAiWhenAvailable === false) {
    return [];
  }

  try {
    const run = await runRegisteredAITask<IdeaAxesOutput>('idea-axes', {
      project,
      settings,
      credential,
      provider,
      signal
    });

    const axes: ExpansionCategory[] = [];
    for (const axis of run.output.axes) {
      const label = axis.label.trim().slice(0, MAX_LABEL_LENGTH);
      const hint = axis.hint.trim().slice(0, MAX_HINT_LENGTH);
      if (!label || !hint) continue;
      // Düşürme kararı geri döndürülemez: burada geçen bir eksen ikinci
      // modele isim/soru olarak gönderilecek. Sanitize edip tutmak değil,
      // yalnız reddetmek güvenlidir.
      if (containsPromptInjection(label) || containsPromptInjection(hint)) continue;

      const slug = fingerprint(label);
      if (!slug) continue;
      const id = `${AI_AXIS_ID_PREFIX}${slug}`;

      axes.push({ id, label, hint, seedTitles: [] });
      if (axes.length >= MAX_AI_AXES) break;
    }
    return axes;
  } catch {
    // Zaman aşımı, şema hatası veya sağlayıcı hatası: tier 3 sıfır eksen
    // katkıda bulunur, tier 1-2 dokunulmadan kalır. Hata burada asla
    // kullanıcıya yansıtılmaz.
    return [];
  }
}
