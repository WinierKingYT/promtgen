import type { IdeaFoundationFieldGrounding, IdeaFoundationFieldName, ProjectDocumentV5, SuggestionItem } from '../contracts.js';
import { isExpansionBundle } from './proposal-bundle-selectors.js';

/**
 * Bu görünümün gösterdiği beş düzyazı alan -- `currentAlternative` bugünkü
 * gibi bilerek DIŞARIDA (bu, mevcut ekranın önceden beri kapsamı; bu
 * değişiklik onu genişletmiyor). `IdeaFoundationFieldName`den türetilir ki
 * altı alanlık asıl liste değişirse burası tek elden takip etsin.
 */
export type IdeaFoundationDisplayField = Exclude<IdeaFoundationFieldName, 'currentAlternative'>;

const DISPLAY_FIELDS: readonly IdeaFoundationDisplayField[] = ['summary', 'problemStatement', 'targetUser', 'desiredOutcome', 'mvpTarget'];

/**
 * Tek bir foundation alanının EKRANA taşınan hâli: metin + kaynağı.
 * `source: 'unspecified'` -- `conceptSummary.foundationGrounding` hiç
 * yoksa (eski/kısmi belge) düşülen durumdur; bu durumda alanın idea-grounded
 * OLDUĞU iddia EDİLMEZ, yalnızca bu bilginin üretilmediği anlaşılır.
 */
export interface IdeaStateFoundationFieldView {
  text: string;
  source: IdeaFoundationFieldGrounding['source'] | 'unspecified';
  /** yalnız `source === 'unknown'` iken dolu: alan neden bilinmiyor. */
  reason?: string;
}

/**
 * Fikrin GÜNCEL HALİ — sağ paneldeki "fikir bu an ne durumda?" görünümünün
 * saf birleştiricisi.
 *
 * Bilerek hiçbir şey SAKLAMAZ. Kullanıcı `conceptSummary`, öneri kartları ve
 * `concernDecisions` üzerinde zaten düzenleme yapabiliyor; bu modül onların
 * ayrı bir düzyazı kopyasını tutmaz — aksi hâlde `conceptSummary`-vs-aşama
 * modeli ayrışmasının (bkz. `conversion-v2.ts`) bir üçüncüsü doğardı. Yalnız
 * VAR OLAN kayıtları okur ve görüntülenebilir şekle döker.
 *
 * Saflık kuralı: bu dosyada `Date.now()`, ağ çağrısı, rastgelelik veya
 * belgeyi değiştiren hiçbir şey OLAMAZ. Aynı `project` için her zaman aynı
 * sonucu döndürür; React tarafı bunu her render'da yeniden çağırabilir.
 */

export interface IdeaStateFoundationView {
  /** Özetten en az bir alan doluysa true; hiçbiri doldurulmadıysa false. */
  hasContent: boolean;
  /**
   * `conceptSummaryProvenance` set ve kullanıcı henüz onaylamadıysa true.
   * Bu, "bu taslak henüz hiç incelenmedi" etiketinin kaynağıdır (bkz.
   * `contracts.ts` `IdeaLabSession.conceptSummaryProvenance`).
   */
  isUnreviewedDraft: boolean;
  summary: string;
  problemStatement: string;
  targetUser: string;
  desiredOutcome: string;
  mvpTarget: string;
  /**
   * Yukarıdaki beş alanın HER BİRİ için kaynağı ve (varsa) bilinmeme
   * gerekçesi. Metin alanları geriye dönük uyumluluk için AYNEN kalır;
   * bu yalnız ONLARIN üzerine eklenmiş bir açıklamadır (bkz. `fieldView`).
   */
  fields: Record<IdeaFoundationDisplayField, IdeaStateFoundationFieldView>;
}

/**
 * Fikre eklenmiş bir kart. `status` onun HANGİ listede (`acceptedCards` /
 * `pendingCards`) durduğunu da örtük olarak taşır — çağıran ayrıca bir
 * bayrağa bakmaz, hangi diziden geldiği zaten kararın türünü söyler.
 *
 * `rejected` burada hiç YER ALMAZ: o karar verilmiştir ve sonucu hayırdır.
 */
export interface IdeaStateCardView {
  id: string;
  title: string;
  description: string;
  kind: SuggestionItem['kind'];
  /** `edited` ise kullanıcı kartın metnini kendi sözleriyle değiştirmiştir. */
  status: 'accepted' | 'edited' | 'pending' | 'deferred';
}

/** Bir konu kararının YAPILACAK ya da YAPILMAYACAK yarısından tek bir madde. */
export interface IdeaStateDecisionView {
  id: string;
  concernId: string;
  /** Kararın ait olduğu konunun başlığı; konu artık belgede yoksa boş kalır. */
  concernTitle: string;
  text: string;
}

export interface IdeaStateView {
  foundation: IdeaStateFoundationView;
  /** Kabul edilmiş/düzenlenerek kabul edilmiş kartlar — fikrin SETTLED parçası. */
  acceptedCards: IdeaStateCardView[];
  /**
   * Bekleyen ve ertelenen kartlar — kullanıcı "Fikre ekle"ye bastı ama karar
   * henüz verilmedi (ya da bilerek sonraya bırakıldı). Kabul edilmiş bir kart
   * gibi SUNULMAZ, ama görünmezse de eklemenin sessizce yutulduğu izlenimi
   * doğar — o yüzden ayrı, açıkça işaretli bir liste olarak durur.
   */
  pendingCards: IdeaStateCardView[];
  /** YAPILACAKLAR — kullanıcının verdiği kararların olumlu yarısı. */
  included: IdeaStateDecisionView[];
  /** YAPILMAYACAKLAR — yalnız `scopeSplit: 'confirmed'` kayıtlardan gelir. */
  excluded: IdeaStateDecisionView[];
  /**
   * Foundation boş, hiç kabul edilmiş/bekleyen kart yok ve hiç karar yoksa
   * true — dürüst boş durum. Yalnızca bekleyen bir kart eklenmiş bir proje
   * BOŞ SAYILMAZ: kullanıcı bir şey ekledi, bunu görmeli.
   */
  isEmpty: boolean;
}

const ACCEPTED_CARD_STATUSES: ReadonlySet<SuggestionItem['status']> = new Set(['accepted', 'edited']);
const PENDING_CARD_STATUSES: ReadonlySet<SuggestionItem['status']> = new Set(['pending', 'deferred']);

function trimmed(value: string | undefined): string {
  return (value || '').trim();
}

/**
 * Bir alanın metnini ve `conceptSummary.foundationGrounding`teki kaydını tek
 * bir ekran görünümüne indirger. Grounding hiç yoksa (eski/kısmi belge)
 * `unspecified` döner -- metin dolu olsa bile bunun idea-grounded olduğu
 * İDDİA EDİLMEZ, yalnızca bu bilginin üretilmediği belirtilir.
 */
function fieldView(text: string, grounding: IdeaFoundationFieldGrounding | undefined): IdeaStateFoundationFieldView {
  if (!grounding) return { text, source: 'unspecified' };
  if (grounding.source === 'unknown') return { text, source: 'unknown', reason: grounding.reason };
  return { text, source: grounding.source };
}

function buildFoundation(project: ProjectDocumentV5): IdeaStateFoundationView {
  const session = project.ideaLabSession;
  const concept = session?.conceptSummary;
  const summary = trimmed(concept?.summary);
  const problemStatement = trimmed(concept?.problemStatement);
  const targetUser = trimmed(concept?.targetUser);
  const desiredOutcome = trimmed(concept?.desiredOutcome);
  const mvpTarget = trimmed(concept?.mvpTarget);
  const values: Record<IdeaFoundationDisplayField, string> = { summary, problemStatement, targetUser, desiredOutcome, mvpTarget };
  const grounding = concept?.foundationGrounding;
  const fields = Object.fromEntries(
    DISPLAY_FIELDS.map(field => [field, fieldView(values[field], grounding?.[field])])
  ) as Record<IdeaFoundationDisplayField, IdeaStateFoundationFieldView>;
  // Bir alan düz metinle DOLU olmasa bile, model neden bilmediğini söylediyse
  // (source: 'unknown' + reason) bu GERÇEK bir içeriktir — "henüz hiçbir şey
  // yok" ile "model dürüstçe bilmediğini söyledi" farklı durumlardır.
  const hasContent = DISPLAY_FIELDS.some(field => Boolean(values[field] || fields[field].reason));
  // `userConfirmed` alanı yoksa (eski/kısmi belge) taslak sayılır — bir onayı
  // hiç var olmayan bir alandan varsaymak yanlış tarafa hata yapardı.
  const isUnreviewedDraft = Boolean(session?.conceptSummaryProvenance) && concept?.userConfirmed !== true;
  return { hasContent, isUnreviewedDraft, summary, problemStatement, targetUser, desiredOutcome, mvpTarget, fields };
}

function toCardView(item: SuggestionItem): IdeaStateCardView {
  return {
    id: item.id,
    title: item.title,
    description: item.editedDescription || item.description,
    kind: item.kind,
    status: item.status as IdeaStateCardView['status']
  };
}

/**
 * Fikre eklenmiş kartlar — tüm keşif paketlerinden (açık ya da kapalı;
 * paketler karara bağlandıkça dönüşümlüdür, bkz. `proposal-bundle-selectors.ts`).
 * Yalnız `isExpansionBundle` yeniden kullanılır; ikinci bir "bu bir keşif
 * paketi mi?" tanımı burada YAZILMAZ.
 *
 * `pending`/`deferred` de döner — kabul edilmişten AYRI bir dizide. Kart
 * eklendiği an bir yere düşmezse kullanıcı "Fikre ekle"ye bastığında hiçbir
 * şey olmamış gibi görünür; bu, sessiz bir kayıp izlenimi verir (bkz. bu
 * değişikliğin gerekçesi). `rejected` hiçbir diziye girmez: o kapanmış bir
 * karardır.
 */
function buildCards(project: ProjectDocumentV5): {
  acceptedCards: IdeaStateCardView[];
  pendingCards: IdeaStateCardView[];
} {
  const bundles = project.proposalStore?.bundles || [];
  const items = bundles.filter(isExpansionBundle).flatMap(bundle => bundle.items);
  return {
    acceptedCards: items.filter(item => ACCEPTED_CARD_STATUSES.has(item.status)).map(toCardView),
    pendingCards: items.filter(item => PENDING_CARD_STATUSES.has(item.status)).map(toCardView)
  };
}

/**
 * `concernDecisions`i YAPILACAK/YAPILMAYACAK iki listesine ayırır.
 *
 * `scopeSplit === 'confirmed'`: kullanıcı ikisini ayrı ayrı verdi, ikisi de
 * olduğu gibi kullanılır. `scopeSplit === 'legacy-unsplit'`: yalnız `answer`
 * anlamlıdır; bu fonksiyon o kayıtlar için ASLA `excluded` üretmez — kaydın
 * `excluded` alanı dolu olsa bile (bugünkü yazma yolu bunu boş bırakır, ama
 * bu okuyucu yine de kendi ayrıştırmasını yapmaz; bkz. `contracts.ts`
 * `ConcernDecision.scopeSplit` dokümantasyonu).
 */
function buildDecisions(project: ProjectDocumentV5): {
  included: IdeaStateDecisionView[];
  excluded: IdeaStateDecisionView[];
} {
  const decisions = project.ideaDesign?.concernDecisions || [];
  const concerns = project.ideaDesign?.concerns || [];
  const titleFor = (concernId: string) => concerns.find(concern => concern.id === concernId)?.title || '';

  const included: IdeaStateDecisionView[] = [];
  const excluded: IdeaStateDecisionView[] = [];

  for (const decision of decisions) {
    const concernTitle = titleFor(decision.concernId);
    const answer = decision.answer.trim();
    if (answer) {
      included.push({ id: decision.id, concernId: decision.concernId, concernTitle, text: answer });
    }
    if (decision.scopeSplit === 'confirmed') {
      decision.excluded.forEach((line, index) => {
        const text = line.trim();
        if (!text) return;
        excluded.push({ id: `${decision.id}-excluded-${index}`, concernId: decision.concernId, concernTitle, text });
      });
    }
  }

  return { included, excluded };
}

export function buildIdeaStateView(project: ProjectDocumentV5): IdeaStateView {
  const foundation = buildFoundation(project);
  const { acceptedCards, pendingCards } = buildCards(project);
  const { included, excluded } = buildDecisions(project);
  const isEmpty = !foundation.hasContent
    && acceptedCards.length === 0
    && pendingCards.length === 0
    && included.length === 0
    && excluded.length === 0;
  return { foundation, acceptedCards, pendingCards, included, excluded, isEmpty };
}
