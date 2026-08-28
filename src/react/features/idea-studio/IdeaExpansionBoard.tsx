import { useEffect, useRef, useState } from 'react';
import { Check, Clock, LoaderCircle, Plus, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { ProjectDocumentV5, SuggestionStatus } from '../../../v4/contracts.js';
import type { ProviderSettings } from '../../../v4/provider-settings.js';
import { getExpansionCategories, mergeExpansionCategories, type ExpansionCategory } from '../../../v4/idea-expansion/categories.js';
import {
  createUserExpansionCard,
  generateExpansionCards,
  selectVisibleExpansionResult,
  type ExpansionCard,
  type ExpansionResult
} from '../../../v4/application/idea-expansion-service.js';
import { generateIdeaAxes } from '../../../v4/application/idea-axis-service.js';
import { addExpansionCardAsSuggestion } from '../../../v4/application/idea-expansion-intake.js';
import { selectExpansionBundle } from '../../../v4/application/proposal-bundle-selectors.js';
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

export function IdeaExpansionBoard({ project, settings, onPersist, onNotice }: {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  /** Kalıcılaştırılacak yeni belge; komut türü, komut politikası kapısını belirler. */
  onPersist: (project: ProjectDocumentV5, message: string, commandType: string) => void;
  onNotice: (message: string) => void;
}) {
  const categories = getExpansionCategories(project);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExpansionResult | null>(null);
  // Kategoriler farklı hızlarda döner (önbellekli anında, üretim ~25 sn).
  // Son istenen kategori burada tutulur; geç gelen yanıt başka bir kategorinin
  // kartlarını onun başlığı altına yazamaz.
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
  // sorulmadan önerildiğini tutar; panel bunu okuyup köken notunu gösterir.
  // Kullanıcı bir kategoriye kendi tıkladığında (open()) sıfırlanır: o andan
  // sonra görülen panel artık "otomatik" değil, kullanıcının kendi seçimidir.
  const [autoAxisId, setAutoAxisId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAiAxes([]);
    setAutoAxisId(null);
    setAiAxesLoading(true);
    generateIdeaAxes(project, { settings })
      .then(axes => {
        if (cancelled) return;
        setAiAxes(axes);
        if (!axes.length) return;
        // Proaktif öneri: kullanıcı hiçbir kategoriye tıklamadan, en alakalı
        // eksen (modelin döndürdüğü ilk eksen) için AYNI generateExpansionCards
        // çağrılır — ikinci bir üretim borusu yok, tıklama yolunun birebir
        // aynısı. Maliyet disiplini: bu, projeye girişte yalnız BİR KEZ olur
        // (bu effect yalnız project.id değişince yeniden çalışır); kullanıcının
        // yazması, chip değiştirmesi veya yeniden render, burayı asla
        // tetiklemez.
        const primaryAxis = axes[0];
        requestedRef.current = primaryAxis.id;
        setLoading(true);
        generateExpansionCards(project, primaryAxis.id, { settings, category: primaryAxis })
          .then(next => {
            if (cancelled || requestedRef.current !== primaryAxis.id) return;
            // Sağlayıcı bu çağrı sırasında düşerse veya hata dönerse (offline
            // ön-kontrolü generateIdeaAxes'te zaten geçildiği için burada asla
            // "sessizce offline" değil, gerçek bir hata olabilir): otomatik
            // girişte hiçbir ekstra şey ve hiçbir hata banner'ı gösterilmez.
            // Kullanıcı chip'e kendi tıklarsa aynı kategori için yerel
            // başlangıç kartlarını ve "AI bağlı değil" uyarısını zaten görür.
            if (next.mode === 'fallback') return;
            setAutoAxisId(primaryAxis.id);
            setActiveId(primaryAxis.id);
            setResult(next);
          })
          .finally(() => {
            if (!cancelled && requestedRef.current === primaryAxis.id) setLoading(false);
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

  const open = async (categoryId: string, refresh = false) => {
    requestedRef.current = categoryId;
    setActiveId(categoryId);
    // Kullanıcı artık kendi tıkladı; görülecek panel otomatik öneri değil,
    // kendi seçimi. Otomatik köken notu bir sonraki tıklamaya taşınmamalı.
    setAutoAxisId(null);
    setLoading(true);
    try {
      const categoryOverride = aiAxes.find(axis => axis.id === categoryId);
      const next = await generateExpansionCards(project, categoryId, { settings, refresh, category: categoryOverride });
      if (requestedRef.current !== categoryId) return;
      setResult(next);
    } finally {
      if (requestedRef.current === categoryId) setLoading(false);
    }
  };

  const active = allCategories.find(category => category.id === activeId) || null;
  const cards = selectVisibleExpansionResult(active?.id ?? null, result);

  const addCard = (card: ExpansionCard, categoryLabel: string): boolean => {
    const intake = addExpansionCardAsSuggestion(project, card, categoryLabel);
    if (!intake.added) {
      onNotice(intake.reason);
      return false;
    }
    onPersist(intake.project, `"${card.title}" fikre eklendi.`, 'AddExpansionCard');
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

  return <section className="pg-expansion-board" aria-label="Keşif panosu">
    <p className="pg-expansion-lead">Bir başlık seç; o konuda bu projeye özel öneriler getireyim. Seçtiklerin fikir defterine aday olarak düşer.</p>

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

    <div className="pg-expansion-chips">
      {categories.map(category => <button
        key={category.id}
        type="button"
        className={category.id === activeId ? 'is-active' : ''}
        aria-pressed={category.id === activeId}
        title={category.hint}
        onClick={() => void open(category.id)}
      >{category.label}</button>)}
    </div>

    {/* Tier 3: fikre özel eksenler. Ayrı başlık altında, aynı chip
        etkileşimiyle — kullanıcı bunun model tarafından bu fikre özel
        üretildiğini görür ama karta tıklama davranışı farklılaşmaz. */}
    {(aiAxes.length > 0 || aiAxesLoading) && <div className="pg-expansion-ai-axes">
      <p className="pg-expansion-ai-axes-heading"><Sparkles size={14}/> Fikrine özel başlıklar</p>
      {aiAxesLoading && aiAxes.length === 0 && <p className="pg-expansion-hint" role="status">
        Bu fikre özel başlıklar hazırlanıyor…
      </p>}
      {aiAxes.length > 0 && <div className="pg-expansion-chips">
        {aiAxes.map(category => <button
          key={category.id}
          type="button"
          className={category.id === activeId ? 'is-active' : ''}
          aria-pressed={category.id === activeId}
          title={category.hint}
          onClick={() => void open(category.id)}
        >{category.label}</button>)}
      </div>}
    </div>}

    {active && <div className="pg-expansion-panel">
      <header>
        <div><b>{active.label}</b><small>{active.hint}</small></div>
        <button type="button" onClick={() => void open(active.id, true)} disabled={loading}>
          <RotateCcw size={14}/> Yenile
        </button>
      </header>

      {/* Bu panel kullanıcı hiçbir chip'e tıklamadan, girişte otomatik açıldı.
          Kökenin açık olması için ayrıca söylenir; başka bir chip'e tıklandığı
          an (open()) bu not kalkar ve panel kullanıcının kendi seçimi olur. */}
      {active.id === autoAxisId && <p className="pg-expansion-auto-note" role="status">
        <Sparkles size={13}/> Fikrine bakarak bu başlığı otomatik önerdim; istersen başka bir başlık seçebilirsin.
      </p>}

      {loading && <p className="pg-expansion-loading" role="status">
        <LoaderCircle className="spin" size={16}/> Bu başlık için öneriler hazırlanıyor…
      </p>}

      {!loading && cards?.mode === 'fallback' && <p className="pg-expansion-fallback" role="status">
        <TriangleAlert size={15}/> AI bağlı değil; yalnız başlangıç önerileri gösteriliyor.
      </p>}

      {/* Kart sayısı sessizce azalmaz: gizlenenin nedeni ekranda yazılı olur,
          yoksa kullanıcı kategoriyi "az öneri üretti" sanır. */}
      {!loading && !!cards?.hiddenCount && <p className="pg-expansion-hint" role="status">
        {cards.cards.length
          ? `${cards.hiddenCount} öneriyi daha önce karara bağladığın için gizledim.`
          : 'Bu başlıktaki önerilerin hepsini daha önce karara bağladın. Yenile diyerek yeni öneri isteyebilirsin.'}
      </p>}

      {!loading && cards?.cards.map(card => <article key={card.id} className="pg-expansion-card">
        <h4>{card.title}</h4>
        <p>{card.description}</p>
        <footer>
          {/* Efor/etki yalnız değerlendirildiğinde gösterilir; başlangıç kartında
              bunlar ölçülmedi ve ölçülmüş gibi sunulmaz. */}
          {card.origin === 'ai' ? <>
            <span>{card.effort === 'low' ? 'Az efor' : card.effort === 'medium' ? 'Orta efor' : 'Yüksek efor'}</span>
            <span>{card.impact === 'high' ? 'Yüksek etki' : card.impact === 'medium' ? 'Orta etki' : 'Düşük etki'}</span>
            <span>{card.mvpHint === 'mvp-adayı' ? 'İlk sürüm adayı' : 'Sonraya bırakılabilir'}</span>
          </> : <span className="is-unassessed">Başlangıç önerisi · efor ve etki değerlendirilmedi</span>}
          <button type="button" onClick={() => addCard(card, active.label)}><Plus size={14}/> Fikre ekle</button>
        </footer>
      </article>)}
    </div>}

    {bundle && decisionItems.length > 0 && <section className="pg-expansion-decisions" aria-label="Eklediğin kartlar">
      <header>
        <div><b>Eklediğin kartlar</b><small>Her kartı karara bağla; sonra kabul ettiklerin plana geçer.</small></div>
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
