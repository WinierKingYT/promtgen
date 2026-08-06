import { useRef, useState } from 'react';
import { Check, Clock, LoaderCircle, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react';
import type { ProjectDocumentV5, SuggestionStatus } from '../../../v4/contracts.js';
import type { ProviderSettings } from '../../../v4/provider-settings.js';
import { getExpansionCategories } from '../../../v4/idea-expansion/categories.js';
import {
  generateExpansionCards,
  selectVisibleExpansionResult,
  type ExpansionCard,
  type ExpansionResult
} from '../../../v4/application/idea-expansion-service.js';
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

  const open = async (categoryId: string, refresh = false) => {
    requestedRef.current = categoryId;
    setActiveId(categoryId);
    setLoading(true);
    try {
      const next = await generateExpansionCards(project, categoryId, { settings, refresh });
      if (requestedRef.current !== categoryId) return;
      setResult(next);
    } finally {
      if (requestedRef.current === categoryId) setLoading(false);
    }
  };

  const active = categories.find(category => category.id === activeId) || null;
  const cards = selectVisibleExpansionResult(active?.id ?? null, result);

  const addCard = (card: ExpansionCard, categoryLabel: string) => {
    const intake = addExpansionCardAsSuggestion(project, card, categoryLabel);
    if (!intake.added) {
      onNotice(intake.reason);
      return;
    }
    onPersist(intake.project, `"${card.title}" fikre eklendi.`, 'AddExpansionCard');
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

    {active && <div className="pg-expansion-panel">
      <header>
        <div><b>{active.label}</b><small>{active.hint}</small></div>
        <button type="button" onClick={() => void open(active.id, true)} disabled={loading}>
          <RotateCcw size={14}/> Yenile
        </button>
      </header>

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
