import type { ProjectDocumentV5 } from '../contracts.js';
import type { ProviderSettings } from '../provider-settings.js';
import {
  generateDiscoveryBundleService,
  type DiscoveryBundleResult,
  type DiscoveryGenerationDependencies,
  type DiscoveryGenerationOptions
} from './discovery-generation-service.js';
import { concernsFromBundle } from './concern-intake.js';

/**
 * Fikir konularını üreten **ikinci** giriş kapısı.
 *
 * Konu üretimi bugün tek bir yola bağlı: sohbet turu
 * (`Workspace.tsx` → `runConversationalDiscoveryTurn` →
 * `runConversationalDiscoveryTurnService` → `concernsFromBundle`). O yol
 * ÇALIŞIYOR — bu modül kırık bir zinciri onarmıyor, zincirin tek sahibi
 * olmasını bitiriyor. Ölçülen gerekçe üç parça:
 *
 * 1. **Sohbet katlanmış geliyor.** `chatOpen` varsayılanı `false`
 *    (Workspace.tsx) ve taze projede `chatAttention` 0'dır
 *    (`discoveryAnswerDraft` null, `showDecisionTurn` false) — yani rozet bile
 *    çıkmaz. Ana sütunda çalışan kullanıcının kapının varlığını öğreneceği
 *    hiçbir işaret yok.
 * 2. **Ana yüzey pano.** `develop` görünümünde `IdeaExpansionColumn` baskın
 *    sütundur; sohbet yanda katlanabilir bir kanaldır.
 * 3. **Sohbet atlanabilir olacak.** Faz F sohbeti Ortak Anlayış'tan SONRAYA
 *    taşıyor ve açıkça atlanabilir kılıyor (F4). Konu üretimi o panelin özel
 *    mülkü kalırsa, sohbeti atlayan kullanıcı Çözüm aşamasına hiç ulaşamaz —
 *    aynı tuzak, yeri değişmiş hâlde.
 *
 * Bu yüzden ikinci kapı bir tekrar değil, gerekliliğin kendisidir.
 *
 * **Yeni üretim mantığı yok.** Aynı `discovery` görevi, aynı
 * `generateDiscoveryBundleService`, aynı `concernsFromBundle`. Bu modülün
 * tamamı bağlantı ve kullanıcıya söylenen cümledir.
 */

/**
 * Ağ ile dönüşüm AYRILIR — `concern-intake.ts` kendi başlığında aynı ilkeyi
 * yazıyor: dönüşümün sağlayıcıyla işi yoktur ve ağsız test edilebilmelidir.
 * `applyConcernDiscoveryResult` saf olduğu için dört sonucun DÖRDÜ de
 * sağlayıcısız test edilebiliyor; aşağıdaki async sarmalayıcıda karar kalmaz.
 */
export interface IdeaConcernDiscoveryResult {
  project: ProjectDocumentV5;
  /** Bu koşuda `ideaDesign.concerns`e eklenen konu sayısı. */
  addedConcerns: number;
  error: string | null;
  notice: string;
}

/**
 * Modele giden istem yönü. Bir PARAMETRE değeridir, yeni bir görev ya da yeni
 * bir şema değil: `direction` alanını `runConversationalDiscoveryTurnService`
 * de aynı biçimde kuruyor.
 */
const CONCERN_DIRECTION =
  'Fikrin karara bağlanmamış yönlerini çıkar: hangi kararlar verilmeden ilerlenemez?';

/**
 * Sağlayıcı YOKLUĞU ile çağrının DÜŞMESİ ayrı cümlelerdir.
 *
 * Ayrım `generateDiscoveryBundleService`in kendi dönüşünden okunur ve
 * tahmine dayanmaz: sağlayıcı ayarlı değilse servis `usedFallback: true`
 * ve `error: null` döner; çağrı düştüyse `error` dolu döner.
 *
 * İki cümle de yeni değil, yerleşik olanı sürdürür — açılış yan cümlesi
 * `solution-discovery-run.ts`ten ("… için bir AI sağlayıcısı bağlaman
 * gerekiyor"), düşüş cümlesi `Workspace.sendMessage`ten ("<sağlayıcı> yanıt
 * vermedi (<neden>)"). Sonuç yan cümlesi bu eyleme göre düzeltilir: burada
 * yerel motor VARDIR ama çıktısı bilerek konuya çevrilmez (bkz.
 * `concern-intake.ts`, `isLocalRuleEngineBundle`), o yüzden "yerel yedek
 * motor yok" demek yanlış olurdu.
 */
const PROVIDER_REQUIRED =
  'Karar çıkarımı için bir AI sağlayıcısı bağlaman gerekiyor; yerel kural motorunun ürettiği şablon metin konuya çevrilmez.';

/**
 * Sağlayıcı çalıştı ama ortaya YENİ konu çıkmadı.
 *
 * Bu bir hata değil ve hata gibi sunulmaz — ama sessiz de bırakılmaz.
 * Düğmeye basıp hiçbir şey görmemek, düğmenin hiç olmamasından kötüdür:
 * kullanıcı ürünü bozuk sanar.
 */
const NOTHING_NEW =
  'Karar çıkarımı çalıştı; karara bağlanmamış yeni bir konu çıkmadı.';

/**
 * Paket sonucunu belgeye ve kullanıcıya söylenen cümleye çevirir. SAF.
 *
 * Belge yalnız GERÇEKTEN konu eklendiğinde değişir: değişmemiş bir belgeyi
 * kalıcılaştırmak, hiçbir şey olmadığı hâlde revizyon numarasını ilerletirdi.
 */
export function applyConcernDiscoveryResult(
  project: ProjectDocumentV5,
  result: DiscoveryBundleResult,
  providerLabel: string
): IdeaConcernDiscoveryResult {
  if (result.usedFallback) {
    return {
      project,
      addedConcerns: 0,
      error: result.error
        ? `${providerLabel} yanıt vermedi (${result.error}) — konu çıkarılamadı.`
        : PROVIDER_REQUIRED,
      notice: ''
    };
  }

  const next = concernsFromBundle(project, result.bundle);
  const addedConcerns = next.ideaDesign.concerns.length - project.ideaDesign.concerns.length;
  if (addedConcerns <= 0) {
    return { project, addedConcerns: 0, error: null, notice: NOTHING_NEW };
  }

  return {
    project: next,
    addedConcerns,
    error: null,
    notice: `${addedConcerns} konu çıkarıldı; Fikir tasarımı panelinde karara bağlayabilirsin.`
  };
}

/**
 * Keşif turunu konu üretmek için çalıştırır.
 *
 * `runSolutionDiscovery` ile aynı sözleşme: sahte bir sonuç UYDURULMAZ,
 * sağlayıcı yoksa ya da düştüyse hata dürüstçe döner ve belge değişmez.
 */
export async function runIdeaConcernDiscoveryService(
  project: ProjectDocumentV5,
  options: DiscoveryGenerationOptions & { settings?: ProviderSettings; providerLabel: string },
  dependencies: DiscoveryGenerationDependencies
): Promise<IdeaConcernDiscoveryResult> {
  const result = await generateDiscoveryBundleService(
    project,
    { ...options, direction: options.direction || CONCERN_DIRECTION },
    dependencies
  );
  return applyConcernDiscoveryResult(project, result, options.providerLabel);
}
