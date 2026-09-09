import { runRegisteredAITask } from '../ai/runtime.js';
import type { StructuredProvider } from '../ai/provider-adapters.js';
import type { DraftPlanSectionOutput } from '../ai/schemas/schemas.js';
import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';

/**
 * Faz D (D1) -- boş bir zorunlu plan bölümü için AI taslağı üretir.
 *
 * **Belgeye HİÇBİR ŞEY YAZMAZ.** `ConceptAgreementEditor`in türetilmiş kapsam
 * taslağıyla aynı sözleşme: taslak yalnız çağıranın state'inde durur, bölüm
 * içeriği kullanıcı "Bölümü kaydet"e basana kadar canonical belgeye geçmez
 * (`Workspace.tsx::saveSection` zaten `UpdatePlanSection` ile bunu yapıyor --
 * burada YENİ bir yazma yolu AÇILMAZ). Bu yüzden `PlanSection`a bir kaynak/
 * provenance alanı EKLENMEZ: taslağın "AI'dan geldiği" bilgisi hiç
 * kalıcılaşmaz, yalnız kaydedilene kadar arayüzde tutulur.
 *
 * **Yerel kural motoru YOK** (`draftPlanSectionTask.fallbackPolicy: 'none'`,
 * `solution-discovery-run.ts`teki emsalin aynısı): bir plan bölümünün
 * düzyazısını şablonla doldurmak, kullanıcıya onaylayacağı gerçek bir taslak
 * olduğu izlenimi verirdi. Dört sonucun DÖRDÜ de kendi cümlesini taşır --
 * aynı disiplin `idea-concern-discovery-run.ts`teki gibi:
 *  1. Sağlayıcı bağlı değil       -> PROVIDER_REQUIRED
 *  2. Sağlayıcı çağrısı düştü      -> describeFailure(error)
 *  3. Çağrı başarılı ama taslak anlamsız/çok kısa -> NOTHING_PRODUCED
 *  4. Çağrı başarılı ve taslak kullanılabilir -> `content` dolu, `error`/`notice` boş
 */

/**
 * "Anlamlı içerik" eşiği. Yeni bir sayı DEĞİL: `readiness-service.ts`teki
 * `tasksWithDetail` / `weakTests` aynı 8 karakter eşiğini kullanır ("bir
 * görevin açıklaması uygulanabilir sayılır mı?"). Aynı eşiği burada da
 * kullanmak, "bu metin gerçekten bir şey mi anlatıyor?" sorusuna repo
 * genelinde tek bir cevap vermek demek.
 */
const MIN_MEANINGFUL_LENGTH = 8;

const PROVIDER_REQUIRED =
  'Bu bölümü taslak olarak doldurmak için bir AI sağlayıcısı bağlaman gerekiyor; boş bölümler için yerel yedek motor yok.';

const NOTHING_PRODUCED =
  'AI çalıştı; bu bölüm için kullanılabilir bir taslak üretmedi.';

const SECTION_NOT_EMPTY =
  'Bu bölümde zaten içerik var; taslak yalnız boş bölümler için üretilir.';

export interface DraftPlanSectionResult {
  content: string;
  warnings: string[];
  error: string | null;
  notice: string;
}

export async function draftPlanSection(
  project: ProjectDocumentV5,
  sectionId: string,
  options: {
    settings: ProviderSettings;
    credential?: string;
    signal?: AbortSignal;
    provider?: StructuredProvider;
  }
): Promise<DraftPlanSectionResult> {
  const section = project.sections[sectionId];
  if (!section) return { content: '', warnings: [], error: 'Geçersiz plan bölümü.', notice: '' };
  // Aynı korumanın ikinci hattı: `draftPlanSectionTask.buildContext` da bunu
  // reddeder, ama o yalnız sağlayıcı çağrısı GERÇEKTEN yapılırsa çalışır.
  // Burada kontrol etmek, sağlayıcı bağlı değilken bile "içerik zaten var"
  // gerçeğini kullanıcı yanlış "sağlayıcı gerekli" cümlesiyle karşılaşmadan
  // önce söyler.
  if (section.content.trim() || section.items.length) {
    return { content: '', warnings: [], error: SECTION_NOT_EMPTY, notice: '' };
  }

  let output: DraftPlanSectionOutput;
  try {
    const run = await runRegisteredAITask<DraftPlanSectionOutput>('draft-plan-section', {
      project,
      settings: options.settings,
      credential: options.credential || '',
      input: { sectionId },
      signal: options.signal,
      provider: options.provider
    });
    output = run.output;
  } catch (error) {
    return { content: '', warnings: [], error: describeFailure(error), notice: '' };
  }

  if (output.content.trim().length < MIN_MEANINGFUL_LENGTH) {
    return { content: '', warnings: output.warnings, error: null, notice: NOTHING_PRODUCED };
  }
  return { content: output.content.trim(), warnings: output.warnings, error: null, notice: '' };
}

/**
 * Hatayı kullanıcının okuyabileceği bir cümleye çevirir. `solution-discovery-run.ts`
 * ile AYNI desen (aynı üç örüntü, aynı gerekçe): ham neden SİLİNMEZ, parantez
 * içinde durur.
 */
function describeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/AI sağlayıcısı gerekli/i.test(raw)) return PROVIDER_REQUIRED;
  if (/failed to fetch|networkerror|load failed|ECONNREFUSED|ENOTFOUND/i.test(raw)) {
    return `AI sağlayıcısına ulaşılamadı; bağlantını ve anahtarını kontrol et. (${raw})`;
  }
  if (/abort/i.test(raw)) return 'Bölüm taslağı isteği iptal edildi.';
  return `Bölüm taslağı üretilemedi: ${raw}`;
}
