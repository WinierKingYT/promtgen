import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  ListChecks,
  Menu,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  ProjectDocumentV5,
  SuggestionItem,
  SuggestionStatus
} from '../../../v4/contracts.js';
import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';
import type { DiscoveryAnswerDraft } from '../../../v4/application/discovery-answer-service.js';
import { DiscoveryAnswerReview } from '../../components/DiscoveryAnswerReview.js';

export type IdeaStudioView = 'develop' | 'guide' | 'plan';

const VIEW_ITEMS: Array<{
  id: IdeaStudioView;
  label: string;
  detail: string;
  icon: typeof Lightbulb;
}> = [
  { id: 'develop', label: 'Fikir', detail: 'Konuş ve şekillendir', icon: Lightbulb },
  { id: 'guide', label: 'Fikir Özeti', detail: 'Ortak anlayışı kontrol et', icon: FileText },
  { id: 'plan', label: 'Plan', detail: 'Uygulama planına geç', icon: ListChecks }
];

export function IdeaStudioSidebar({
  project,
  projects,
  open,
  onClose,
  onSelect,
  onNew,
  onSettings
}: {
  project: ProjectDocumentV5;
  projects: ProjectDocumentV5[];
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
}) {
  return <>
    {open && <button type="button" className="pg-sidebar-scrim" aria-label="Proje menüsünü kapat" onClick={onClose}/>}
    <aside className={`pg-sidebar ${open ? 'is-open' : ''}`} aria-label="Projeler">
      <div className="pg-sidebar-brand"><span><Sparkles size={17}/></span><b>PromtGen</b></div>
      <button type="button" className="pg-new-idea" onClick={onNew}><Plus size={17}/> Yeni fikir</button>
      <div className="pg-project-stack">
        <span className="pg-sidebar-label">Çalışmaların</span>
        {projects.filter(item => item.lifecycle.status !== 'archived').slice(0, 12).map(item => (
          <button
            type="button"
            className={item.id === project.id ? 'is-active' : ''}
            aria-current={item.id === project.id ? 'page' : undefined}
            key={item.id}
            onClick={() => { onSelect(item.id); onClose(); }}
          >
            <span className="pg-project-dot">{(item.identity.name || 'F').slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
            <span><b>{item.identity.name || 'İsimsiz fikir'}</b><small>{item.lifecycle.activePhase.replaceAll('_', ' ').toLocaleLowerCase('tr-TR')}</small></span>
          </button>
        ))}
      </div>
      <button type="button" className="pg-sidebar-settings" onClick={onSettings}><Settings2 size={17}/> Ayarlar</button>
    </aside>
  </>;
}

export function IdeaStudioHeader({
  project,
  view,
  onView,
  onMenu,
  onExit,
  onHistory
}: {
  project: ProjectDocumentV5;
  view: IdeaStudioView;
  onView: (view: IdeaStudioView) => void;
  onMenu: () => void;
  onExit: () => void;
  onHistory: () => void;
}) {
  return <header className="pg-studio-header">
    <div className="pg-project-heading">
      <button type="button" className="pg-mobile-menu" aria-label="Projeleri aç" onClick={onMenu}><Menu size={20}/></button>
      <button type="button" className="pg-back-button" aria-label="Başlangıca dön" onClick={onExit}><ArrowLeft size={18}/></button>
      <span><b>{project.identity.name || 'Yeni fikir'}</b><small>Yerel taslak · d{project.documentRevision}</small></span>
    </div>
    <nav className="pg-view-tabs" aria-label="Fikrinle ne yapmak istiyorsun?">
      {VIEW_ITEMS.map(({ id, label, detail, icon: Icon }) => <button
        type="button"
        key={id}
        className={view === id ? 'is-active' : ''}
        aria-current={view === id ? 'step' : undefined}
        title={detail}
        onClick={() => onView(id)}
      ><Icon size={16}/><span>{label}</span></button>)}
    </nav>
    <button type="button" className="pg-history-button" onClick={onHistory}>Geçmiş</button>
  </header>;
}

export function IdeaSnapshot({ project, coach }: { project: ProjectDocumentV5; coach: IdeaCoachState }) {
  const conceptConfirmed = Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed);
  return <aside className="pg-idea-map" aria-label="Fikir özeti">
    <div className="pg-map-head">
      <div><span>Onaylanmış anlayış</span><h2>Fikir özeti</h2></div>
      <strong className={conceptConfirmed ? 'is-confirmed' : 'is-draft'}>{conceptConfirmed ? 'Onaylandı' : 'Taslak'}</strong>
    </div>
    <ol className="pg-coach-steps" aria-label="Fikir geliştirme aşamaları">
      {coach.steps.map(step => <li key={step.id} className={`is-${step.state}`}><i/>{step.label}</li>)}
    </ol>
    <div className="pg-map-fields">
      {coach.evidence.map(item => <section key={item.id} className={`is-${item.status}`}>
        <span>{item.label}<b>{item.statusLabel}</b></span>
        <p>{item.status === 'confirmed' ? item.value : item.detail}</p>
      </section>)}
    </div>
    <section className="pg-scope-snapshot">
      <div><span>Kritik karar</span><b>{coach.criticalDecisionCount}</b></div>
      <div><span>Ertelenebilir</span><b>{coach.deferrableDecisionCount}</b></div>
    </section>
    <p className="pg-map-note"><ShieldAlert size={15}/> Taslak çıkarımlar burada kesin bilgi gibi gösterilmez. Fikir özetini onayladığında görünür olur.</p>
  </aside>;
}

export function IdeaCoachFocus({ coach, disabled, onChoose }: {
  coach: IdeaCoachState;
  disabled: boolean;
  onChoose: (prompt: string) => void;
}) {
  return <section className="pg-coach-focus" aria-labelledby="pg-coach-question">
    <div className="pg-coach-focus-copy">
      <span>Şimdi netleştirdiğimiz konu · {coach.activeStepLabel}</span>
      <h2 id="pg-coach-question">{coach.activeQuestion}</h2>
      <p>Tek bir cevap yeterli. Emin değilsen aşağıdaki yollardan biriyle birlikte düşünebiliriz.</p>
    </div>
    <div className="pg-coach-actions" aria-label="Bağlamsal düşünme yolları">
      {coach.actions.map(action => <button type="button" disabled={disabled} key={action.id} onClick={() => onChoose(action.prompt)}>
        <span><b>{action.title}</b><small>{action.reason}</small></span><ChevronRight size={16}/>
      </button>)}
    </div>
  </section>;
}

export function IdeaDecisionCards({
  items,
  onStatus
}: {
  items: SuggestionItem[];
  onStatus: (id: string, status: SuggestionStatus, edited?: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  if (!items.length) return null;
  const activeItem = items.find(item => item.status === 'pending' && item.recommended)
    || items.find(item => item.status === 'pending');
  const reviewedCount = items.filter(item => item.status !== 'pending').length;
  if (!activeItem) return <section className="pg-decision-deck is-complete"><p>{reviewedCount} yön incelendi. Seçtiklerini fikre işleyebilir veya konuşmaya devam edebilirsin.</p></section>;

  return <section className="pg-decision-deck" aria-labelledby="pg-decisions-title">
    <div className="pg-decision-heading"><span>Bir yön seçelim</span><h3 id="pg-decisions-title">{activeItem.title}</h3><p>{reviewedCount + 1}/{items.length} · Bu yalnız bir öneri; sen seçmeden fikir kararına dönüşmez.</p></div>
    <article className={`pg-decision-card is-${activeItem.status}`}>
      <header><span className={`pg-kind is-${activeItem.kind}`}>{activeItem.kind === 'feature' ? 'Olası yön' : activeItem.kind === 'risk' ? 'Dikkat edilmesi gereken' : activeItem.kind === 'architecture' ? 'Yaklaşım' : activeItem.kind === 'question' ? 'Netleştirilecek konu' : 'Karar'}</span>{activeItem.recommended && <span className="pg-recommended"><Sparkles size={12}/> Önerilen yön</span>}</header>
      <p>{activeItem.editedDescription || activeItem.description}</p>
      {editing === activeItem.id && <div className="pg-inline-edit"><label htmlFor={`edit-${activeItem.id}`}>Bu yönü kendi fikrine göre yaz</label><textarea id={`edit-${activeItem.id}`} value={editedText} onChange={event => setEditedText(event.target.value)}/><button type="button" disabled={!editedText.trim()} onClick={() => { onStatus(activeItem.id, 'edited', editedText.trim()); setEditing(null); }}>Bu haliyle seç</button></div>}
      <footer>
        <button type="button" className="is-primary-choice" onClick={() => onStatus(activeItem.id, 'accepted')}>Bu yönden ilerle</button>
        <button type="button" onClick={() => { setEditedText(activeItem.editedDescription || activeItem.description); setEditing(activeItem.id); }}>Kendime göre düzenle</button>
        <details><summary>Diğer seçenekler</summary><button type="button" onClick={() => onStatus(activeItem.id, 'deferred')}>Şimdilik karar verme</button><button type="button" className="is-danger" onClick={() => onStatus(activeItem.id, 'rejected')}>Bu yön uymuyor</button></details>
      </footer>
    </article>
  </section>;
}

export function IdeaCoachTurn({
  draft,
  coach,
  showDecisionTurn,
  pendingItems,
  disabled,
  onChoose,
  onStatus,
  onDraftChange,
  onDraftDiscard,
  onDraftApply
}: {
  draft: DiscoveryAnswerDraft | null;
  coach: IdeaCoachState;
  showDecisionTurn: boolean;
  pendingItems: SuggestionItem[];
  disabled: boolean;
  onChoose: (prompt: string) => void;
  onStatus: (id: string, status: SuggestionStatus, edited?: string) => void;
  onDraftChange: (draft: DiscoveryAnswerDraft) => void;
  onDraftDiscard: () => void;
  onDraftApply: () => void;
}) {
  // Fragment — NOT a wrapper <div>. .pg-thread uses `display:flex; gap:24px`
  // directly on its children (.pg-inline-review, .pg-coach-focus, .pg-decision-deck
  // all carry their own layout CSS as flex items). A wrapper element would swallow
  // that gap between the review and the focus/decision block. See spec constraint:
  // no visual/CSS changes in this task.
  return <>
    {draft && <div className="pg-inline-review"><DiscoveryAnswerReview
      draft={draft}
      onChange={onDraftChange}
      onDiscard={onDraftDiscard}
      onApply={onDraftApply}
    /></div>}
    {showDecisionTurn
      ? <IdeaDecisionCards items={pendingItems} onStatus={onStatus}/>
      : <IdeaCoachFocus coach={coach} disabled={disabled} onChoose={onChoose}/>}
  </>;
}
