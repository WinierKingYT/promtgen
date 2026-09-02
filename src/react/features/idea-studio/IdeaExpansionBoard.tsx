import { useEffect, useRef, useState } from 'react';
import { Check, Clock, LoaderCircle, Plus, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { ProjectDocumentV5, SuggestionStatus } from '../../../v4/contracts.js';
import type { ProviderSettings } from '../../../v4/provider-settings.js';
import {
  getExpansionCategorySet,
  mergeExpansionCategories,
  orderExpansionCategoriesForPresentation,
  type ExpansionCategory
} from '../../../v4/idea-expansion/categories.js';
import {
  createUserExpansionCard,
  expansionGenerationKey,
  generateExpansionCards,
  selectVisibleExpansionResult,
  type ExpansionCard,
  type ExpansionResult
} from '../../../v4/application/idea-expansion-service.js';
import {
  canPrefetchExpansion,
  createExpansionPrefetch,
  type ExpansionPrefetchRunner,
  type ExpansionReadiness
} from '../../../v4/application/expansion-prefetch.js';
import { dropCrossSectionDuplicates } from '../../../v4/application/expansion-section-dedup.js';
import { generateIdeaAxes } from '../../../v4/application/idea-axis-service.js';
import { addExpansionCardAsSuggestion } from '../../../v4/application/idea-expansion-intake.js';
import { findExpansionItemByTitle, selectExpansionBundle } from '../../../v4/application/proposal-bundle-selectors.js';
import { resolveIdeaRecordsForBundle } from '../../../v4/application/idea-discussion-service.js';
import { applyApprovedChanges, updateSuggestionStatus } from '../../../v4/planning-engine.js';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Karar bekliyor',
  accepted: 'Kabul edildi',
  edited: 'Düzenlenerek kabul edildi',
  deferred: 'Ertelendi',
  rejected: 'Reddedildi'
};

const DECISIONS: { status: SuggestionStatus; label: string; Icon: typeof Check }[] = [
  { status: 'accepted', label: 'Kabul et', Icon: Check },
  { status: 'deferred', label: 'Ertele', Icon: Clock },
  { status: 'rejected', label: 'Reddet', Icon: X }
];

/**
 * Kullanıcının kendi yazdığı kartlar bu sabit etiketle işaretlenir; hem
 * fingerprint'te hem (dolayısıyla) dışa aktarılan planda kökeni AI
 * kategorilerinden ayırt edilebilir kalır.
 */
const USER_CARD_CATEGORY_LABEL = 'Kullanıcının kendi önerisi';

/**
 * Chip'in yanındaki noktanın sözle karşılığı. Kurumsal değil, günlük dilde:
 * kullanıcı "bu başlık şu an ne durumda" sorusunun cevabını tek kelimede
 * görsün. Erişilebilir AD değiştirilmez (kategori etiketi öyle kalır); bu
 * metin `title` ile AÇIKLAMA olarak taşınır.
 */
const READINESS_LABEL: Record<ExpansionReadiness, string> = {
  ready: 'hazır',
  running: 'hazırlanıyor',
  queued: 'sırada',
  failed: 'olmadı'
};

/**
 * Durum henüz bilinmiyorsa ipucu OLDUĞU GİBİ kalır: "durum yok" diye bir şey
 * yazmak, kullanıcıya ölçülmemiş bir bilgi vermek olurdu.
 */
function readinessTitle(hint: string, state: ExpansionReadiness | undefined): string {
  return state ? `${hint} · ${READINESS_LABEL[state]}` : hint;
}

/**
 * Bölümün DOM kimliği. Kategori kimlikleri model üretimi eksenlerde nokta
 * içerebiliyor (`ai.<fingerprint>`, bkz. idea-axis-service.ts); id özniteliği
 * bunu kabul etse de seçicilerde kaçış gerektirdiği için burada sadeleştirilir.
 */
function sectionDomId(categoryId: string): string {
  return `pg-expansion-section-${categoryId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/**
 * Fikre girmiş kart panodan ANINDA kalkar.
 *
 * Servis tarafındaki `hideDecidedCards` (idea-expansion-service.ts) aynı işi
 * yapıyor ama yalnız YENİDEN ÜRETİMDE: kart eklendiği an belge revizyonu
 * artıyor, arka plan sırası baştan kuruluyor ve kart ancak o tur bitince
 * düşüyordu. O ana kadar tıklanan kart panoda, aynı "Fikre ekle" düğmesiyle
 * duruyordu — kullanıcı neyi aldığını göremiyor, aynı karta ikinci kez
 * basmaya çağrılıyordu (ölçüldü: "kart panoda kaldı: true").
 *
 * Bu bir GÖSTERİM TAZELEMESİDİR, yeni bir eleme ölçütü değil: `hideDecidedCards`
 * ile AYNI anahtarı (başlık) ve AYNI seçiciyi kullanır, `results` state'ine ve
 * servisin önbelleğine dokunmaz, üretim tetiklemez. Aynı `project` ve aynı
 * kartlar için her zaman aynı sonucu verir.
 */
function dropCardsAlreadyInIdea(project: ProjectDocumentV5, cards: readonly ExpansionCard[]): ExpansionCard[] {
  return cards.filter(card => !findExpansionItemByTitle(project, card.title));
}

export function IdeaExpansionBoard({ project, settings, onPersist, onNotice }: {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  /** Kalıcılaştırılacak yeni belge; komut türü, komut politikası kapısını belirler. */
  onPersist: (project: ProjectDocumentV5, message: string, commandType: string) => void;
  onNotice: (message: string) => void;
}) {
  /**
   * Kimlik çözümünün çıktısı (sıra: CORE → BY_DOMAIN → pack) ve alana özel
   * kimliklerin etiketi. SIRA burada kullanılmaz; sunum sırası aşağıda ayrı
   * kurulur — bkz. idea-expansion/categories.ts.
   */
  const categorySet = getExpansionCategorySet(project);
  const categories = categorySet.categories;
  /**
   * Kullanıcının EN SON gittiği bölüm. Artık bir SEÇİCİ değil: hangi bölümün
   * vurgulandığını ve hangi bölümün durum satırlarını canlı bölge olarak
   * duyurduğunu belirler. Kartların görünürlüğüyle ilgisi yoktur — hazır olan
   * her bölüm zaten aynı anda duruyor.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Kategori BAŞINA sonuç. Eskiden tek bir `result` vardı ve pano, arka planda
   * altı kategori hazırlarken kullanıcıya yalnız birini gösteriyordu:
   * "çokluk" tam burada kayboluyordu. Anahtar kategori kimliğidir, bu yüzden
   * geç gelen bir yanıt başka bir kategorinin kartlarını onun başlığı altına
   * yazamaz — `selectVisibleExpansionResult` bu bağı ikinci kez doğrular.
   */
  const [results, setResults] = useState<Record<string, ExpansionResult>>({});
  /**
   * Kullanıcının (ya da otomatik önerinin) AÇIKÇA istediği kategoriler. Arka
   * plan penceresinin (BACKGROUND_PREFETCH_FLOOR/CEILING) dışında kalan bir kategori
   * ancak böyle bir istekle bölüm sahibi olur.
   */
  const [openedIds, setOpenedIds] = useState<string[]>([]);
  /** Bir sonraki render'da kaydırılacak bölüm; başlık düğmeleri bunu kurar. */
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  // Kategoriler farklı hızlarda döner (önbellekli anında, üretim ~25 sn).
  // Son istenen kategori burada tutulur; otomatik açılan eksenin sonucu,
  // kullanıcı bu arada başka bir başlığa gittiyse vurguyu geri çalamaz.
  const requestedRef = useRef<string | null>(null);

  // Tier 3: fikre özel eksenler. getExpansionCategories SENKRON ve SAF kalmalı
  // (bkz. idea-expansion/categories.ts); bu yüzden model-üretimi eksenler
  // yalnız burada, React state'inde, render zamanında birleştirilir — hiçbir
  // zaman categories.ts'e girmez. Sağlayıcı kapalıysa veya çağrı başarısız
  // olursa servis sessizce boş dizi döner; pano tier 1-2 ile zaten tam
  // işlevseldir.
  const [aiAxes, setAiAxes] = useState<ExpansionCategory[]>([]);
  const [aiAxesLoading, setAiAxesLoading] = useState(false);
  // En alakalı eksen otomatik açıldığında bu, hangi eksenin kullanıcıya
  // sorulmadan önerildiğini tutar; bölüm bunu okuyup köken notunu gösterir.
  // Kullanıcı bir başlığa kendi gittiğinde (goToCategory()) sıfırlanır: o
  // andan sonra görülen pano artık "otomatik" değil, kullanıcının kendi
  // gezinmesidir.
  const [autoAxisId, setAutoAxisId] = useState<string | null>(null);

  // Arka plan doldurma: kullanıcı ilk bölümü okurken kalan kategoriler
  // SIRAYLA hazırlanır. Çokluk kategori BAŞINA kart sayısından değil,
  // aynı anda hazır kategori sayısından gelir.
  const [readiness, setReadiness] = useState<Record<string, ExpansionReadiness>>({});
  const runnerRef = useRef<ExpansionPrefetchRunner | null>(null);
  // Yürütücü proje ömrü boyunca TEK kalır (revizyon başına yeniden
  // kurulmaz); güncel proje/ayar/eksenleri ref üzerinden okur. Aksi hâlde
  // birincil eksen effect'i eski bir yürütücüyü tutar ve arka plan sırası
  // ona yol veremezdi.
  const projectRef = useRef(project);
  const settingsRef = useRef(settings);
  const axesRef = useRef<ExpansionCategory[]>([]);
  projectRef.current = project;
  settingsRef.current = settings;
  axesRef.current = aiAxes;

  useEffect(() => {
    const runner = createExpansionPrefetch({
      isEnabled: () => canPrefetchExpansion(settingsRef.current),
      onStatus: setReadiness,
      generate: async (categoryId, { signal, refresh }) => {
        const next = await generateExpansionCards(
          projectRef.current,
          categoryId,
          {
            settings: settingsRef.current,
            refresh,
            signal,
            category: axesRef.current.find(axis => axis.id === categoryId)
          }
        );
        // TEK KAYIT NOKTASI. Arka plan doldurma da, kullanıcının tıklaması da
        // (requestNow) bu fonksiyondan geçiyor — bkz. expansion-prefetch.ts.
        // Sonucu burada yakalamak, "hazır olan her kategori aynı anda
        // görünür" sözünü İKİNCİ bir üretim yolu açmadan tutar.
        //
        // İptal edilmiş istek EKRANA YAZILMAZ: ya proje değişti ya da
        // kullanıcı sırayı atladı; iki hâlde de bu sonuç artık istenmiyor ve
        // yürütücü de onu "hazır" saymıyor.
        if (!signal.aborted) setResults(previous => ({ ...previous, [next.categoryId]: next }));
        return next;
      }
    });
    runnerRef.current = runner;
    // Proje değişti: eldeki her şey ÖNCEKİ fikre aitti. Durum damgaları,
    // kartlar ve açılmış başlıklar birlikte sıfırlanır; biri kalsaydı yeni
    // fikrin panosunda eski fikrin önerileri görünürdü.
    setReadiness({});
    setResults({});
    setOpenedIds([]);
    setActiveId(null);
    return () => {
      // Unmount / proje değişimi: uçuştaki her şey iptal edilir. Yürütücü
      // hiç zamanlayıcı kurmadığı için geride sızacak bir şey kalmaz.
      runner.stop();
      if (runnerRef.current === runner) runnerRef.current = null;
    };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    setAiAxes([]);
    setAutoAxisId(null);
    setAiAxesLoading(true);
    generateIdeaAxes(project, { settings })
      .then(axes => {
        if (cancelled) return;
        setAiAxes(axes);
        // Ref state'in BİR RENDER GERİSİNDE kalmaz: hemen aşağıdaki
        // `requestNow` bu render'da çağrılıyor ve üretim, eksen nesnesini
        // buradan okuyor. `setAiAxes` ile yetinilirse yürütücü model-üretimi
        // ekseni `getExpansionCategories` içinde arar (orada YOKTUR, bkz.
        // idea-expansion/categories.ts) ve "bilinmeyen kategori" ile düşer.
        axesRef.current = axes;
        if (!axes.length) return;
        // Proaktif öneri: kullanıcı hiçbir başlığa gitmeden, en alakalı
        // eksen (modelin döndürdüğü ilk eksen) için AYNI generateExpansionCards
        // çağrılır — ikinci bir üretim borusu yok, tıklama yolunun birebir
        // aynısı. Maliyet disiplini: bu, projeye girişte yalnız BİR KEZ olur
        // (bu effect yalnız project.id değişince yeniden çalışır); kullanıcının
        // yazması, başlık değiştirmesi veya yeniden render, burayı asla
        // tetiklemez.
        const primaryAxis = axes[0];
        requestedRef.current = primaryAxis.id;
        // `requestNow` ile: bu üretim kullanıcının BEKLEDİĞİ üretimdir ve
        // arka plan sırası ona yol verir. Arka plan sırası bu bittikten
        // SONRA ilerler — bkz. expansion-prefetch.ts.
        (runnerRef.current?.requestNow(primaryAxis.id)
          ?? generateExpansionCards(project, primaryAxis.id, { settings, category: primaryAxis })
            .then(next => {
              setResults(previous => ({ ...previous, [next.categoryId]: next }));
              return next;
            }))
          .then(next => {
            if (cancelled || requestedRef.current !== primaryAxis.id || !next) return;
            // Sağlayıcı bu çağrı sırasında düşerse veya hata dönerse (offline
            // ön-kontrolü generateIdeaAxes'te zaten geçildiği için burada asla
            // "sessizce offline" değil, gerçek bir hata olabilir): otomatik
            // girişte KÖKEN NOTU yazılmaz. Yani "bunu senin için ben seçtim"
            // iddiası, arkasında model üretimi olmayan bir sonuç için
            // kurulmaz. Bölümün kendisi (yerel başlangıç kartları ve "AI bağlı
            // değil" uyarısıyla) arka plandaki diğer kategorilerle aynı
            // kurala tabi kalır.
            if (next.mode === 'fallback') return;
            setAutoAxisId(primaryAxis.id);
            setActiveId(primaryAxis.id);
            setOpenedIds(ids => (ids.includes(primaryAxis.id) ? ids : [...ids, primaryAxis.id]));
          })
          .catch(() => {
            // `requestNow` yalnız gerçek bir üretim hatasında fırlatır ve o
            // hâlde kategorinin hazırlık durumu 'olmadı' olarak damgalanır --
            // yani hata YUTULMUYOR, hem başlık düğmesinin noktasında hem de
            // bölümün kendi durum satırında izlenebilir kalıyor. Burada
            // yapılmayan tek şey OTOMATİK girişte bir hata banner'ı açmak;
            // yukarıdaki fallback kararıyla aynı gerekçe.
          });
      })
      .finally(() => {
        if (!cancelled) setAiAxesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Bilerek yalnız project.id: yeniden istek yalnız proje değişince atılır;
    // settings değişimi bir sonraki tıklamada (open()) zaten güncel halini kullanır.
  }, [project.id]);

  // Model kimliği her zaman "ai." önekiyle gelir (bkz. idea-axis-service.ts);
  // CORE/BY_DOMAIN/pack kimlikleriyle asla çakışmaz. mergeExpansionCategories
  // yine de aynı çakışma-korumasını uygular: kimlik çakışırsa CORE/BY_DOMAIN
  // her zaman kazanır, AI ekseni asla mevcut bir kategoriyi yerinden etmez.
  const allCategories = mergeExpansionCategories(categories, [], aiAxes);

  /**
   * SUNUM SIRASI, kimlik çözümünden AYRI: fikre özel AI eksenleri → alana özel
   * eksenler → genel CORE kategorileri. Ölçülen sorun buydu — CORE'un 8
   * kategorisi önde durduğu için alana özel eksenler arka plan sınırının
   * dışında kalıyor ve tıklanmadıkça HİÇ üretilmiyordu. Bir sıralamadır,
   * filtreleme değil: hiçbir kategori düşmez.
   */
  const orderedCategories: ExpansionCategory[] = orderExpansionCategoriesForPresentation(allCategories, {
    ideaSpecificIds: aiAxes.map(axis => axis.id),
    domainSpecificIds: categorySet.domainSpecificIds
  });
  /** Başlık düğmelerinin sırası: fikre özel eksenler kendi navigasyonunda durur. */
  const orderedDictionaryCategories: ExpansionCategory[] = orderExpansionCategoriesForPresentation(categories, {
    domainSpecificIds: categorySet.domainSpecificIds
  });

  // Sıranın kuşağı: önbellek anahtarının kategoriden ÖNCEKİ kısmı — aynı saf
  // fonksiyon (`expansionGenerationKey`). Değişmesi "eldeki her şey geçersiz"
  // demektir; yürütücü uçuştaki işi iptal eder ve hazır damgalarını siler.
  //
  // İKİSİ AYNI KAYNAKTAN OKUR, çünkü ayrılırlarsa düzeltme yarım kalırdı:
  // eskiden buradaki anahtar `documentRevision` içeriyordu ve kart eklemek onu
  // artırıyordu. Önbellek korunsa bile yürütücü her kabulde sırayı sıfırlar,
  // altı bölümün ~2,5 dakikalık üretimini baştan başlatırdı.
  const generationKey = expansionGenerationKey(project);
  // Sıra GÖSTERİM SIRASININ AYNISI: fikre özel eksenler, sonra alana özel
  // eksenler, sonra genel kategoriler. Kullanıcının gördüğü sıra ile dolan
  // sıra böylece tutarlı olur. Kategori kimlikleri sabit sırada geldiği için
  // bu dizi deterministiktir.
  const prefetchKey = orderedCategories.map(category => category.id).join('|');
  // ARKA PLAN PENCERESİ İLGİDEN TÜRER: fikre özel (AI) eksenler ve alana özel
  // eksenler "bu fikre ait" başlıklardır ve pencereye önce onlar girer. Genel
  // CORE kategorileri yalnız pencere tabanı dolmadığında girer; kalanı
  // tıklamayla üretilir (bkz. expansion-prefetch.ts).
  const relevantKey = [...aiAxes.map(axis => axis.id), ...categorySet.domainSpecificIds].join('|');
  useEffect(() => {
    // Çevrimdışıyken arka plan doldurma HİÇ başlamaz: sağlayıcı ayarı
    // önceden okunur, `runRegisteredAITask`'ın fırlatması kontrol akışı
    // olarak kullanılmaz.
    if (!canPrefetchExpansion(settings)) return;
    // Sıra listesi anahtarın KENDİSİNDEN çözülür: effect'in bağımlılığı bir
    // dizi olsaydı her render'da yeni kimlik alır ve sıra durmadan yeniden
    // kurulurdu. Anahtar bir dize olduğu için effect yalnız kategori kümesi
    // gerçekten değişince çalışır.
    runnerRef.current?.fill(generationKey, prefetchKey.split('|').filter(Boolean), {
      relevantIds: relevantKey.split('|').filter(Boolean)
    });
  }, [project.id, generationKey, prefetchKey, relevantKey, settings.providerId, settings.useAiWhenAvailable]);

  // Kaydırma DOM yerleştikten SONRA yapılır: sınırın dışındaki bir başlığa
  // gidildiğinde bölüm aynı commit'te doğuyor, ama düğmenin `onClick`'i
  // koşarken henüz DOM'da değil.
  useEffect(() => {
    if (!scrollTargetId) return;
    const node = sectionRefs.current.get(scrollTargetId);
    setScrollTargetId(null);
    // `smooth` bilerek istenmiyor: kullanıcı "oraya götür" dedi, animasyon
    // izlemek istemedi; ayrıca azaltılmış hareket ayarında da doğru davranış
    // budur.
    node?.scrollIntoView({ block: 'start' });
  }, [scrollTargetId]);

  const open = async (categoryId: string, refresh = false) => {
    try {
      // Kullanıcının tıklaması SIRAYI ATLAR: uçuştaki arka plan üretimi
      // iptal edilir ve bu istek hemen koşar. Aksi hâlde kullanıcı, arka
      // plandaki kategoriler bitene kadar beklerdi — çözmeye çalıştığımız
      // sorunun daha kötüsü.
      if (runnerRef.current) {
        await runnerRef.current.requestNow(categoryId, refresh);
        return;
      }
      const categoryOverride = aiAxes.find(axis => axis.id === categoryId);
      const next = await generateExpansionCards(project, categoryId, { settings, refresh, category: categoryOverride });
      setResults(previous => ({ ...previous, [next.categoryId]: next }));
    } catch {
      // SESSİZ YUTMA DEĞİL: yürütücü hatayı yakaladığı kategoriyi 'failed'
      // damgalıyor ve bölüm bunu "öneri getiremedim" satırıyla, başlık
      // düğmesi de noktasıyla gösteriyor. Burada yalnız yakalanmamış bir
      // promise reddi engelleniyor; kullanıcıya söylenen şey değişmiyor.
    }
  };

  /**
   * Başlık düğmesinin işi: SEÇMEK değil, GÖTÜRMEK. Bölüm zaten hazırsa
   * yalnız oraya kaydırılır — hazır bir kategoriyi yeniden üretmek arka plan
   * sırasını boş yere keserdi.
   */
  const goToCategory = (categoryId: string) => {
    // Kullanıcı artık kendi gezindi; görülen pano otomatik öneri değil, kendi
    // seçimi. Otomatik köken notu bir sonraki gezinmeye taşınmamalı.
    setAutoAxisId(null);
    setActiveId(categoryId);
    setOpenedIds(ids => (ids.includes(categoryId) ? ids : [...ids, categoryId]));
    setScrollTargetId(categoryId);
    if (!results[categoryId]) void open(categoryId);
  };

  /**
   * "Fikre ekle" GERÇEKTEN ekler: tek tık, tek sonuç.
   *
   * Kart `accepted` girer, `pending` DEĞİL. Ölçülen kusur buydu: düğme "Fikre
   * ekle" diyor, kart "KARAR BEKLİYOR" oluyor ve onu çözecek "Kabul et"
   * düğmesi 1400 piksel aşağıda duruyordu — eylem, durum ve çözüm üç ayrı
   * yerde, ikisi ekran dışında. Kullanıcı zaten tıklayarak karar verdi;
   * ikinci bir onay adımı istemek dürüstlük değil tören.
   *
   * Durum burada, ÇAĞIRAN tarafta seçilir. Servis onu sabitlemiyor: sohbet ya
   * da keşif yolundan gelen, kullanıcının hiç dokunmadığı öneriler `pending`
   * kalmayı sürdürüyor (bkz. idea-expansion-intake.ts).
   *
   * Kararın kendisi geri alınabilir kalır: kart aşağıdaki "Eklediğin kartlar"
   * listesinde durur ve oradan ertelenebilir ya da reddedilebilir. Plana geçiş
   * yine ayrı bir kapıdır ("Kararları uygula"); kart eklemek planı değiştirmez.
   */
  const addCard = (card: ExpansionCard, categoryLabel: string): boolean => {
    const intake = addExpansionCardAsSuggestion(project, card, categoryLabel, { status: 'accepted' });
    if (!intake.added) {
      onNotice(intake.reason);
      return false;
    }
    // Bildirim kartın NEREYE gittiğini de söyler: kart panodan kalktığı için
    // "eklendi" tek başına, kullanıcının onu nerede bulacağını anlatmıyordu.
    onPersist(intake.project, `"${card.title}" fikre eklendi; artık kabul edilenler arasında.`, 'AddExpansionCard');
    return true;
  };

  // Kullanıcı AI'ın sorup önermesini beklemeden kendi önerisini yazabilir;
  // aynı `addExpansionCardAsSuggestion` yolundan geçer — aynı tekilleştirme,
  // aynı karar döngüsü, aynı plana geçiş yolu.
  const [ownIdeaText, setOwnIdeaText] = useState('');
  const addOwnIdea = () => {
    const card = createUserExpansionCard(ownIdeaText);
    // Boş/yalnız boşluk giriş sessizce yok sayılır; bildirim spamlamaz.
    if (!card) return;
    // Yalnız gerçekten eklendiyse alan temizlenir; mükerrer reddinde kullanıcı
    // yazdığını kaybetmez, düzenleyip yeniden deneyebilir.
    if (addCard(card, USER_CARD_CATEGORY_LABEL)) setOwnIdeaText('');
  };

  // Kartlar kendi paketinde durur ve kararları burada verilir; konuşma turunun
  // paneline hiç uğramaz. Bkz. proposal-bundle-selectors.ts.
  const bundle = selectExpansionBundle(project);
  const decisionItems = bundle?.items || [];
  const pendingCount = decisionItems.filter(item => item.status === 'pending').length;
  const acceptedCount = decisionItems.filter(item => item.status === 'accepted' || item.status === 'edited').length;

  const decide = (suggestionId: string, status: SuggestionStatus) => {
    if (!bundle) return;
    onPersist(
      updateSuggestionStatus(project, bundle.id, suggestionId, status),
      '',
      'UpdateSuggestionStatus'
    );
  };

  const applyDecisions = () => {
    // applyApprovedChanges bekleyen kart varsa sessizce hiçbir şey yapmaz. Bu
    // kapı bekleyenleri toplu "ertelendi" damgalayarak aşılmaz: kullanıcı
    // kartları kendi ekledi, kararı da kendi vermeli.
    if (!bundle || pendingCount > 0) return;
    const resolved = resolveIdeaRecordsForBundle(project, bundle.id);
    onPersist(
      applyApprovedChanges(resolved, bundle.id),
      acceptedCount
        ? `${acceptedCount} kart plana taşındı.`
        : 'Kartlar karara bağlandı; plana geçen olmadı.',
      'ApplyApprovedChanges'
    );
  };

  // Bölüm sırası arka plan doldurma sırasının AYNISI (orderedCategories
  // yukarıda bir kez kuruldu): kullanıcı bölümlerin doldukları sırada
  // dizildiğini görür; ekran altından yeni bölüm eklenir, aradan değil.
  /**
   * Görünen bölümler. Bir kategori ya arka plan sırasına girmiştir (durum
   * damgası vardır) ya da kullanıcı onu açıkça istemiştir. Sırasına hiç
   * girmemiş kategoriler yalnız başlık düğmesi olarak durur: on dört başlığın
   * "sırada" yazan boş bölümlerini göstermek, hazır olanları gürültüye
   * gömerdi.
   */
  const visibleSections = orderedCategories.filter(category => (
    openedIds.includes(category.id) || readiness[category.id] !== undefined || !!results[category.id]
  ));

  /**
   * BÖLÜMLER ARASI eleme. Kategori içi eleme (idea-expansion-service.ts) her
   * partide doğru çalışıyor ama ayrı partileri hiç görmüyor; dokuz bölüm aynı
   * anda açılınca aynı kart üç ayrı başlık altında birden göründü (ölçüm:
   * expansion-section-dedup.ts).
   *
   * BURADA yapılır, serviste DEĞİL: hangi bölümlerin gösterildiği ve hangi
   * sırada durdukları yalnız burada bilinir. Sonuç SAF TÜRETİLMİŞ bir
   * görünümdür -- `results` state'i ve servisin önbelleği HAM kalır, üretim
   * tetiklenmez. Girdi sırası `visibleSections`in kendisidir; bölüm sırası
   * değişmedikçe sonuç da değişmez.
   */
  /**
   * `dropCardsAlreadyInIdea`nın BU RENDER'da düşürdüğü kart sayısı, kategori
   * başına.
   *
   * NEDEN GEREKLİ. Kart kabulü artık yeniden üretim tetiklemiyor (bkz.
   * `expansionGenerationKey`); eldeki önbellekli sonuç HAM kalıyor ve
   * `hiddenCount` -- üretim ANINDA gizlenenlerin sayısı -- 0 kalıyor. Kart
   * yine panodan kalkıyor, ama nedenini söyleyen satır bu sayaca bağlı
   * olduğu için susuyordu: kart SESSİZCE kaybolurdu. Aşağıdaki satır iki
   * sayacı toplar; kullanıcı açısından ikisi de aynı cümledir ("bunu zaten
   * karara bağladın"), yalnız hangi anda anlaşıldıkları farklıdır.
   */
  const decidedNowCounts = new Map<string, number>();

  const sectionViews = new Map(
    dropCrossSectionDuplicates(
      visibleSections.map(category => {
        const result = selectVisibleExpansionResult(category.id, results[category.id] ?? null);
        const raw = result?.cards ?? [];
        const kept = dropCardsAlreadyInIdea(project, raw);
        decidedNowCounts.set(category.id, raw.length - kept.length);
        return {
          categoryId: category.id,
          cards: kept,
          // Yedek yolu elemenin dışındadır -- gerekçesi
          // expansion-section-dedup.ts'te `isExemptFromDedup` üstünde yazılı.
          isExemptFromDedup: result?.mode === 'fallback'
        };
      })
    ).map(view => [view.categoryId, view])
  );

  return <section className="pg-expansion-board" aria-label="Keşif panosu">
    <div className="pg-expansion-intro">
      <h2 className="pg-expansion-title">Neler ekleyebiliriz?</h2>
      <p className="pg-expansion-lead">Başlık başlık öneri getiriyorum; hazır olanlar aşağıda birikiyor. Beğendiğini fikre ekle, istersen kendi önerini yaz.</p>
    </div>

    {/* Kullanıcı AI'ın sormasını/önermesini beklemeden kendi fikrini
        yazabilir. Aynı fikre-eklenme yolundan geçer: aynı tekilleştirme
        (findExpansionItemByTitle), aynı karar döngüsü, aynı plana geçiş. */}
    <form
      className="pg-expansion-own-idea"
      onSubmit={event => { event.preventDefault(); addOwnIdea(); }}
    >
      <label htmlFor="pg-expansion-own-idea-input">Kendi önerini yaz</label>
      <div className="pg-expansion-own-idea-row">
        <textarea
          id="pg-expansion-own-idea-input"
          value={ownIdeaText}
          onChange={event => setOwnIdeaText(event.target.value)}
          placeholder="Aklındaki öneriyi buraya yaz…"
          rows={2}
        />
        <button type="submit" disabled={!ownIdeaText.trim()}>
          <Plus size={14}/> Kendi önerini ekle
        </button>
      </div>
    </form>

    {/* Başlık düğmeleri artık bir SEÇİCİ değil, bir GEZİNME: hazır olan her
        başlık aşağıda kendi bölümüyle zaten duruyor, düğme oraya götürüyor.
        Bu yüzden landmark da `nav`. Henüz sıraya girmemiş bir başlığa
        tıklamak üretimi başlatır ve bölümünü açar — sınırın dışında kalan
        kategori kaybolmadı. */}
    <nav className="pg-expansion-chips" aria-label="Başlıklar arasında gezin">
      {orderedDictionaryCategories.map(category => <button
        key={category.id}
        type="button"
        className={category.id === activeId ? 'is-active' : ''}
        aria-current={category.id === activeId ? 'true' : undefined}
        // Hazırlık durumu ERİŞİLEBİLİR ADI değiştirmez: kategori etiketi
        // olduğu gibi kalır (WCAG 2.5.3), durum yalnız açıklamaya (title) ve
        // düğmenin yanındaki küçük noktaya (data-ready + CSS) düşer.
        title={readinessTitle(category.hint, readiness[category.id])}
        data-ready={readiness[category.id]}
        onClick={() => goToCategory(category.id)}
      >{category.label}</button>)}
    </nav>

    {/* Tier 3: fikre özel eksenler. Ayrı başlık altında, aynı gezinme
        etkileşimiyle — kullanıcı bunun model tarafından bu fikre özel
        üretildiğini görür ama davranış farklılaşmaz. */}
    {(aiAxes.length > 0 || aiAxesLoading) && <div className="pg-expansion-ai-axes">
      <p className="pg-expansion-ai-axes-heading"><Sparkles size={14}/> Fikrine özel başlıklar</p>
      {aiAxesLoading && aiAxes.length === 0 && <p className="pg-expansion-hint" role="status">
        Bu fikre özel başlıklar hazırlanıyor…
      </p>}
      {aiAxes.length > 0 && <nav className="pg-expansion-chips" aria-label="Fikrine özel başlıklar arasında gezin">
        {aiAxes.map(category => <button
          key={category.id}
          type="button"
          className={category.id === activeId ? 'is-active' : ''}
          aria-current={category.id === activeId ? 'true' : undefined}
          title={readinessTitle(category.hint, readiness[category.id])}
          data-ready={readiness[category.id]}
          onClick={() => goToCategory(category.id)}
        >{category.label}</button>)}
      </nav>}
    </div>}

    <div className="pg-expansion-sections">
      {visibleSections.map(category => {
        const state = readiness[category.id];
        const cards = selectVisibleExpansionResult(category.id, results[category.id] ?? null);
        // Bölümün ekrana çıkan kartları: yukarıdaki bölümler arası elemeden
        // GEÇMİŞ hâli. `cards` ham sonuç olarak kalır -- "daha önce karara
        // bağladın" satırı ona bakar, çünkü o satır gizlemenin nedenini
        // anlatıyor ve bu iki neden birbirine karışmamalı.
        const view = sectionViews.get(category.id);
        const shownCards = view?.cards ?? [];
        // "Zaten karara bağladın" sayacının İKİ kaynağı: üretim anında
        // gizlenenler (`hiddenCount`) ve bu render'da düşenler. Bölümler arası
        // eleme buraya KARIŞMAZ; onun kendi satırı aşağıda.
        const decidedNow = decidedNowCounts.get(category.id) ?? 0;
        const decidedCount = (cards?.hiddenCount ?? 0) + decidedNow;
        const decidedRemaining = (cards?.cards.length ?? 0) - decidedNow;
        const busy = state === 'running';
        // "Hazırlanıyor" satırı YALNIZ kullanıcının beklediği yerde çıkar:
        // elinde kart olmayan bir bölümde ya da kullanıcının kendi
        // yenilediği/gittiği bölümde. Fikir metni ya da zeminli temel
        // değiştiğinde arka plan sırası altı kategoriyi yeniden üretiyor
        // (kart eklemek ARTIK üretmiyor, bkz. `expansionGenerationKey`);
        // bunu her seferinde altı ayrı "hazırlanıyor"
        // satırıyla duyurmak, kullanıcının okuduğu kartların üstünde
        // durmadan titreyen bir pano üretirdi. Eldeki kartlar yerinde kalır,
        // yenisi geldiğinde sessizce değişir.
        const showBusyLine = busy && (!cards || category.id === activeId);
        // Canlı bölge YALNIZ kullanıcının gittiği bölümde açılır. Altı bölüm
        // aynı anda "hazırlanıyor" diye duyursaydı ekran okuyucu kullanıcısı
        // panoyu hiç okuyamazdı; beklediği bölümü ise duymak istiyor.
        const liveRegion = category.id === activeId ? { role: 'status' as const } : {};
        return <section
          key={category.id}
          id={sectionDomId(category.id)}
          ref={node => {
            if (node) sectionRefs.current.set(category.id, node);
            else sectionRefs.current.delete(category.id);
          }}
          className={`pg-expansion-section${category.id === activeId ? ' is-active' : ''}`}
          aria-labelledby={`${sectionDomId(category.id)}-title`}
          data-ready={state}
        >
          <header>
            <div>
              <h3 id={`${sectionDomId(category.id)}-title`}>{category.label}</h3>
              <small>{category.hint}</small>
            </div>
            {/* Görünen metin ile erişilebilir ad aynı ("Yenile"); hangi başlığı
                yenilediği bölümün kendi adlandırmasından (aria-labelledby)
                ve açıklamadan (title) okunur. */}
            <button
              type="button"
              title={`"${category.label}" için yeniden öneri iste`}
              // Yenileyen kullanıcıdır: bölüm etkin sayılır, böylece bekleme
              // satırı görünür ve ekran okuyucuya da yalnız burada duyurulur.
              onClick={() => { setActiveId(category.id); void open(category.id, true); }}
              disabled={busy}
            >
              <RotateCcw size={14}/> Yenile
            </button>
          </header>

          {/* Bu bölüm kullanıcı hiçbir başlığa gitmeden, girişte otomatik
              önerildi. Kökenin açık olması için ayrıca söylenir; kullanıcı
              başka bir başlığa gittiği an bu not kalkar. */}
          {category.id === autoAxisId && <p className="pg-expansion-auto-note" role="status">
            <Sparkles size={13}/> Fikrine bakarak bu başlığı otomatik önerdim; istersen başka bir başlığa da bakabilirsin.
          </p>}

          {showBusyLine && <p className="pg-expansion-loading" {...liveRegion}>
            <LoaderCircle className="spin" size={16}/> Bu başlık için öneriler hazırlanıyor…
          </p>}

          {!busy && !cards && state === 'queued' && <p className="pg-expansion-hint" {...liveRegion}>
            Bu başlık sırada; öndekiler bitince buraya öneriler düşecek.
          </p>}

          {!busy && !cards && state === 'failed' && <p className="pg-expansion-hint" {...liveRegion}>
            Bu başlık için öneri getiremedim. "Yenile" ile yeniden deneyebilirim.
          </p>}

          {cards?.mode === 'fallback' && <p className="pg-expansion-fallback" {...liveRegion}>
            <TriangleAlert size={15}/> AI bağlı değil; yalnız başlangıç önerileri gösteriliyor.
          </p>}

          {/* Kart sayısı sessizce azalmaz: gizlenenin nedeni ekranda yazılı olur,
              yoksa kullanıcı başlığı "az öneri üretti" sanır. Sayaç ÜRETİM
              anında gizlenenlerle BU RENDER'da düşenleri toplar; ikisi de aynı
              nedendir (bkz. `decidedNowCounts`). */}
          {!!decidedCount && <p className="pg-expansion-hint" {...liveRegion}>
            {decidedRemaining
              ? `${decidedCount} öneriyi daha önce karara bağladığın için gizledim.`
              : 'Bu başlıktaki önerilerin hepsini daha önce karara bağladın. Yenile diyerek yeni öneri isteyebilirsin.'}
          </p>}

          {/* Bölümün bütün kartları başka başlıklarla aynı çıktı. Boş bir kutu
              bırakmak, kullanıcıya "bu başlık bir şey üretemedi" dedirtirdi;
              olan bu değil. Nedeni tek cümleyle yazılır. */}
          {view?.isCoveredByOtherSections && <p className="pg-expansion-hint" {...liveRegion}>
            Bu başlıkta çıkan öneriler yukarıdaki başlıklarla aynıydı; tekrar yazmadım.
          </p>}

          {!!shownCards.length && <div className="pg-expansion-cards">
            {shownCards.map(card => <article key={card.id} className="pg-expansion-card">
              <h4>{card.title}</h4>
              <p>{card.description}</p>
              {/* Efor/etki/MVP etiketi kart YÜZÜNDE durmuyor. Üçü de modelin
                  TAHMİNİ ve yüzde durduklarında ölçülmüş bir sonuç gibi
                  okunuyorlardı; ayrıca ikisi (efor/etki) plan düşüncesidir ve
                  kullanıcı planı bilerek arkaya attı. Silinmediler: şemada
                  duruyorlar, burada bir tık uzaktalar ve ne oldukları
                  yanlarında yazılı. */}
              <details className="pg-expansion-card-detail">
                <summary>{card.origin === 'ai' ? 'Modelin tahmini' : 'Bu kart nereden geldi?'}</summary>
                {card.origin === 'ai' ? <div className="pg-expansion-card-guesses">
                  <span>{card.effort === 'low' ? 'Az efor' : card.effort === 'medium' ? 'Orta efor' : 'Yüksek efor'}</span>
                  <span>{card.impact === 'high' ? 'Yüksek etki' : card.impact === 'medium' ? 'Orta etki' : 'Düşük etki'}</span>
                  <span>{card.mvpHint === 'mvp-adayı' ? 'İlk sürüm adayı' : 'Sonraya bırakılabilir'}</span>
                  <small>Bunlar modelin tahmini; ölçülmüş bir sonuç değil.</small>
                </div> : <p className="is-unassessed">Başlangıç önerisi · efor ve etki değerlendirilmedi.</p>}
              </details>
              <footer>
                <button type="button" onClick={() => addCard(card, category.label)}><Plus size={14}/> Fikre ekle</button>
              </footer>
            </article>)}
          </div>}
        </section>;
      })}
    </div>

    {bundle && decisionItems.length > 0 && <section className="pg-expansion-decisions" aria-label="Eklediğin kartlar">
      <header>
        {/* Eski metin ("Her kartı karara bağla") artık doğru değil: kart
            tıklandığı an kabul ediliyor. Yeni metin ne over-claim eder ne de
            kullanıcıyı olmayan bir işe çağırır — burası kararı DEĞİŞTİRME
            yeridir ve plana geçişin ayrı bir kapı olduğu yazılı kalır. */}
        <div><b>Eklediğin kartlar</b><small>Kararını buradan değiştirebilirsin; plana yalnız kabul ettiklerin geçer.</small></div>
        <button
          type="button"
          onClick={applyDecisions}
          disabled={pendingCount > 0}
          title={pendingCount > 0 ? 'Önce bütün kartları karara bağla.' : 'Kabul ettiğin kartları plana taşı.'}
        >Kararları uygula</button>
      </header>
      {pendingCount > 0 && <p className="pg-expansion-hint" role="status">
        {pendingCount} kart hâlâ karar bekliyor. Hepsi karara bağlanınca uygulayabilirsin.
      </p>}
      <ul>
        {decisionItems.map(item => <li key={item.id} className={`is-${item.status}`}>
          <div className="pg-expansion-decision-head">
            <b>{item.title}</b>
            <small>{STATUS_LABEL[item.status] || item.status}</small>
          </div>
          <p>{item.editedDescription || item.description}</p>
          {/* AI kartlarında bu alan boştur (assessed=true); yerel başlangıç ve
              kullanıcı-yazımı kartlarda kökeni açıkça söyler — bkz.
              idea-expansion-intake.ts LOCAL_SEED_REASON/USER_AUTHORED_REASON. */}
          {item.recommendationReason && <small className="pg-expansion-decision-origin">{item.recommendationReason}</small>}
          <div className="pg-expansion-decision-actions">
            {DECISIONS.map(({ status, label, Icon }) => <button
              key={status}
              type="button"
              className={item.status === status ? 'is-active' : ''}
              aria-pressed={item.status === status}
              onClick={() => decide(item.id, status)}
            ><Icon size={13}/> {label}</button>)}
          </div>
        </li>)}
      </ul>
    </section>}
  </section>;
}
