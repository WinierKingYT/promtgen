import type { ProjectDocumentV5 } from '../contracts.js';
import { captureCurrentRevision } from '../planning-engine.js';
import { ensureIdeaDocumentRevision } from './idea-document-revision-service.js';

export interface PrepareInitialProjectOptions {
  project: ProjectDocumentV5;
}

export interface PreparedInitialProject {
  project: ProjectDocumentV5;
}

/**
 * Yeni projenin ilk revizyonunu kaydeder — ve başka hiçbir şey yapmaz.
 *
 * **Burada bir çatal vardı.** `analyzeIdea` fikri 50 karakterden kısaysa
 * `IDEA_EXPANSION` fazına yazıyordu; bu fonksiyon o fazı görüp erken
 * dönüyor, aksi hâlde Fikir Laboratuvarı'nı çalıştırıp kullanıcıya ilk
 * esaslı yanıt olarak "mimari alternatifler ve metrik matrisi hazırlandı"
 * diyordu. Çatal `analyzeIdea` içinde kaldırıldı; Laboratuvar çağrısı da
 * burada kaldırıldı. İki gerekçe:
 *
 * 1. **Sıra.** V3 fikir → çözüm → plan → devir diye ilerler
 *    (docs/product/PRODUCT_MODEL_V3.md). Problem henüz konuşulmamışken
 *    mimari önermek bu sırayı tersine çeviriyordu.
 * 2. **Dürüstlük.** Sunulan matris bir ŞABLONDUR ve ürün bunu kendi yetenek
 *    kayıt defterinde beyan eder (`architecture-comparator-template`,
 *    capability-registry.ts): "Metrikler proje verisinden türetilmez; alan
 *    değişse de aynı başlangıç puanları sunulur." Proje verisinden
 *    türetilmemiş sayıları kullanıcının fikrine verilen İLK yanıt yapmak,
 *    şablon olduğunu söylemek için seçilebilecek en kötü andı.
 *
 * Karşılaştırıcı silinmedi, **taşındı**: çözüm aşamasına, kullanıcının fikri
 * onaylayıp "bunu nasıl kuralım?" diye sorduğu yere (SolutionStagePanel).
 *
 * `ensureIdeaDocumentRevision` KALDI ve artık koşulsuz çalışır. Fikir temeli
 * taslağı bir `conceptSummary` ürettiyse ilk fikir belgesi revizyonu burada
 * doğar; bunu eskiden yalnız uzun fikirler alıyordu — uzunluğa bağlı ikinci
 * çatal buydu. `conceptSummary` yoksa fonksiyon zaten hiçbir şey yapmaz.
 */
export function prepareInitialProject({ project }: PrepareInitialProjectOptions): PreparedInitialProject {
  return {
    project: captureCurrentRevision(
      ensureIdeaDocumentRevision(project),
      'Proje fikir aşamasında oluşturuldu'
    )
  };
}
