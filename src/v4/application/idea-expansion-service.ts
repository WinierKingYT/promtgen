import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import { runRegisteredAITask } from '../ai/runtime.js';
import { getExpansionCategories, type ExpansionCategory } from '../idea-expansion/categories.js';
import type { IdeaExpansionOutput } from '../ai/schemas/schemas.js';

/** Kartın nereden geldiği kartın kendisinde taşınır; tüketici tahmin etmez. */
export type ExpansionCardOrigin = 'ai' | 'local-seed';

export interface ExpansionCard {
  id: string;
  title: string;
  description: string;
  kind: string;
  /**
   * Efor, etki ve MVP etiketi bir değerlendirmedir: yalnız AI kartlarında
   * bulunur. Başlangıç kartlarında bu alanlar yoktur, uydurulmuş nötr
   * değerlerle doldurulmaz.
   */
  effort?: string;
  impact?: string;
  mvpHint?: string;
  origin: ExpansionCardOrigin;
}

export interface ExpansionResult {
  categoryId: string;
  cards: ExpansionCard[];
  mode: 'local-ai' | 'cloud-ai' | 'fallback';
  fallbackReason: string | null;
}

/**
 * Hangi sonucun ekranda gösterileceğini kategoriye bağlar. Kategoriler farklı
 * hızlarda döner (önbellekli anında, üretim ~25 sn); geç gelen bir yanıt başka
 * bir kategorinin kartlarını onun başlığı altına yazamaz. Aksi hâlde "Fikre
 * ekle" yanlış kategori etiketini fingerprint'e ve tartışma kaydına basar.
 */
export function selectVisibleExpansionResult(
  activeCategoryId: string | null,
  result: ExpansionResult | null
): ExpansionResult | null {
  if (!activeCategoryId || !result) return null;
  return result.categoryId === activeCategoryId ? result : null;
}

export interface GenerateExpansionOptions {
  settings: ProviderSettings;
  credential?: string;
  provider?: StructuredProvider;
  signal?: AbortSignal;
  refresh?: boolean;
}

/**
 * Kategori başına ~25 saniyelik üretim maliyeti olduğu için sonuç bellekte
 * tutulur. Anahtar canonical revision içerir: fikir değişince önbellek doğal
 * olarak geçersizleşir.
 */
const cache = new Map<string, ExpansionResult>();

export function clearExpansionCache(): void {
  cache.clear();
}

function cacheKey(project: ProjectDocumentV5, categoryId: string): string {
  return `${project.id}::${project.canonicalRevision}::${project.documentRevision}::${categoryId}`;
}

/**
 * Başlangıç başlıklarından kart üretir. Hiçbir alan uydurulmaz; başlık açıklama
 * olarak da kullanılır ve değerlendirme gerektiren alanlar boş bırakılır.
 * `origin` alanı kartı tüketen her yerde yerel köken bilgisini taşır.
 */
function seedCards(category: ExpansionCategory): ExpansionCard[] {
  return category.seedTitles.map((title, index) => ({
    id: `seed-${category.id}-${index}`,
    title,
    description: `${category.hint} sorusuna bu başlangıç önerisiyle bakabilirsin.`,
    kind: 'feature',
    origin: 'local-seed'
  }));
}

export async function generateExpansionCards(
  project: ProjectDocumentV5,
  categoryId: string,
  options: GenerateExpansionOptions
): Promise<ExpansionResult> {
  const category = getExpansionCategories(project).find(item => item.id === categoryId);
  if (!category) throw new Error(`Bilinmeyen genişletme kategorisi: ${categoryId}`);

  const key = cacheKey(project, categoryId);
  if (!options.refresh) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  let result: ExpansionResult;
  try {
    const run = await runRegisteredAITask<IdeaExpansionOutput>('idea-expansion', {
      project,
      settings: options.settings,
      credential: options.credential,
      provider: options.provider,
      signal: options.signal,
      input: {
        categoryId: category.id,
        categoryLabel: category.label,
        categoryHint: category.hint,
        seedTitles: category.seedTitles
      }
    });
    result = {
      categoryId,
      cards: run.output.cards.map(card => ({ ...card, origin: 'ai' as const })),
      mode: run.provenance.mode === 'cloud-ai' ? 'cloud-ai' : 'local-ai',
      fallbackReason: null
    };
  } catch (error) {
    // Sağlayıcı yok, şema tutmadı veya zaman aşımı: pano yine açılır ama
    // bunun AI üretimi olmadığı açıkça bildirilir.
    result = {
      categoryId,
      cards: seedCards(category),
      mode: 'fallback',
      fallbackReason: error instanceof Error ? error.message : 'AI çağrısı başarısız.'
    };
  }

  cache.set(key, result);
  return result;
}
