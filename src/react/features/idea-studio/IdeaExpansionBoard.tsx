import { useRef, useState } from 'react';
import { LoaderCircle, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../../v4/contracts.js';
import type { ProviderSettings } from '../../../v4/provider-settings.js';
import { getExpansionCategories } from '../../../v4/idea-expansion/categories.js';
import {
  generateExpansionCards,
  selectVisibleExpansionResult,
  type ExpansionCard,
  type ExpansionResult
} from '../../../v4/application/idea-expansion-service.js';
import { addExpansionCardAsSuggestion } from '../../../v4/application/idea-expansion-intake.js';

export function IdeaExpansionBoard({ project, settings, onAddCard, onNotice }: {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  onAddCard: (project: ProjectDocumentV5, message: string) => void;
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
    onAddCard(intake.project, `"${card.title}" fikre eklendi.`);
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
  </section>;
}
