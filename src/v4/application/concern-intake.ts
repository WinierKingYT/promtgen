import { discoverConcerns, mergeConcerns } from './idea-design-service.js';
import type { DiscoverySuggestionBundle } from './discovery-generation-service.js';
import type { ProjectDocumentV5 } from '../contracts.js';

/**
 * Keşif turunun ürettiği öneri paketini `Concern` modeline bağlar.
 *
 * Bu, V3 motorunun **giriş kapısı**. Bu bağ olmadan `ideaDesign.concerns` her
 * projede boş kalır: kapılar hiç engel görmez, koç hiç soru üretmez, aşama
 * rayı hiç ilerlemez — yani bütün aşama modeli ölü kod olur.
 *
 * Kaynak olarak ham AI çıktısı değil **paket** kullanılıyor: paket doğrulanmış,
 * kalıcı ve kullanıcının ekranda gördüğü şey. Ham çıktıdan türetseydik
 * kullanıcının gördüğü öneriler ile konular ayrışabilirdi.
 *
 * Ayrı bir modülde duruyor çünkü `discovery-generation-service` ağ, sağlayıcı
 * ve mesaj akışıyla uğraşıyor; bu dönüşümün hiçbiriyle işi yok ve ağsız test
 * edilebilmeli.
 */

/**
 * Kullanıcının **kapattığı** öneriler konuya çevrilmez.
 *
 * Reddedilen bir öneriyi konu yapmak, kullanıcının "istemiyorum" dediği şeyi
 * karar bekleyen bir engel hâline getirirdi — mevcut mimarinin reddedilen
 * öneri hafızasıyla doğrudan çelişirdi.
 */
const OPEN_STATUSES = new Set(['pending', 'accepted', 'edited']);

export function concernsFromBundle(project: ProjectDocumentV5, bundle: DiscoverySuggestionBundle): ProjectDocumentV5 {
  const options = (bundle.items || [])
    .filter(item => OPEN_STATUSES.has(item.status))
    .map(item => ({
      kind: item.kind,
      title: item.title,
      description: item.editedDescription || item.description,
      pros: item.pros || [],
      cons: item.cons || [],
      effort: item.effort,
      impact: item.impact,
      affectedSections: item.affectedSections,
      recommended: item.recommended
    }));

  const discovered = discoverConcerns({
    options: options as never,
    openQuestions: bundle.openQuestions || [],
    uncertainty: bundle.uncertainty || []
  });

  if (!discovered.length) return project;

  return {
    ...project,
    ideaDesign: {
      ...project.ideaDesign,
      // Birleştirme çözülmüş konuyu diriltmez: kullanıcı bir konuyu karara
      // bağladıysa sonraki keşif turu onu yeniden açamaz.
      concerns: mergeConcerns(project.ideaDesign.concerns, discovered)
    }
  };
}
