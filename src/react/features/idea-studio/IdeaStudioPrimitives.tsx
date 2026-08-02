import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  ListChecks,
  Menu,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import type {
  ProjectDocumentV5,
  SuggestionItem,
  SuggestionStatus
} from '../../../v4/contracts.js';

export type IdeaStudioView = 'develop' | 'guide' | 'plan';

const VIEW_ITEMS: Array<{
  id: IdeaStudioView;
  label: string;
  detail: string;
  icon: typeof Lightbulb;
}> = [
  { id: 'develop', label: 'Fikir', detail: 'Konuş ve şekillendir', icon: Lightbulb },
  { id: 'guide', label: 'Rehber', detail: 'Fikri anlaşılırlaştır', icon: FileText },
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

export function IdeaSnapshot({ project }: { project: ProjectDocumentV5 }) {
  const concept = project.ideaLabSession?.conceptSummary;
  const fields = [
    { label: 'Kullanıcı', value: concept?.targetUser, empty: 'Henüz net değil' },
    { label: 'Problem', value: concept?.problemStatement, empty: 'Henüz net değil' },
    { label: 'Beklenen sonuç', value: concept?.desiredOutcome || project.identity.desiredOutcome, empty: 'Henüz net değil' }
  ];
  const completed = fields.filter(item => item.value?.trim()).length
    + (concept?.confirmedFeatures?.length ? 1 : 0)
    + (concept?.outOfScope?.length ? 1 : 0);
  const total = 5;
  const percent = Math.round((completed / total) * 100);
  const questions = [...new Set([...(project.openQuestions || []), ...(concept?.openQuestions || [])].filter(Boolean))];

  return <aside className="pg-idea-map" aria-label="Canlı fikir özeti">
    <div className="pg-map-head">
      <div><span>CANLI FİKİR HARİTASI</span><h2>Şu ana kadar anladığım</h2></div>
      <strong>{percent}%</strong>
    </div>
    <div className="pg-map-progress" aria-label={`Fikir netliği yüzde ${percent}`}><i style={{ width: `${percent}%` }}/></div>
    <div className="pg-map-fields">
      {fields.map(item => <section key={item.label} className={item.value?.trim() ? 'is-filled' : 'is-empty'}>
        <span>{item.label}</span><p>{item.value?.trim() || item.empty}</p>
      </section>)}
    </div>
    <section className="pg-scope-snapshot">
      <div><span>MVP içinde</span><b>{concept?.confirmedFeatures?.length || 0}</b></div>
      <div><span>Şimdilik dışında</span><b>{concept?.outOfScope?.length || 0}</b></div>
      <div><span>Açık soru</span><b>{questions.length}</b></div>
    </section>
    <p className="pg-map-note"><ShieldAlert size={15}/> Bu özet konuşmadan türetilir. Sen onaylamadan canonical plana dönüşmez.</p>
  </aside>;
}

const EXPLORATION_ACTIONS = [
  { title: 'Fikri büyüt', detail: 'Değer katabilecek özellikleri bul', prompt: 'Bu fikri daha değerli hale getirecek özellikleri, kullanım senaryolarını ve geliştirme yönlerini seçenekler halinde öner.' },
  { title: 'MVP’yi küçült', detail: 'İlk sürümün sınırını çiz', prompt: 'Bu fikrin en küçük ama anlamlı ilk sürümünü çıkar. MVP içinde ve dışında kalacakları karşılaştır.' },
  { title: 'Riskleri zorla', detail: 'Sorunları erkenden gör', prompt: 'Bu fikrin teknik, ürün ve kullanıcı deneyimi risklerini bul. Her risk için azaltma seçeneği sun.' },
  { title: 'Yaklaşımları karşılaştır', detail: '3 sistem alternatifi gör', prompt: 'Bu fikri gerçekleştirmek için üç farklı sistem yaklaşımını artıları, eksileri ve eforlarıyla karşılaştır.' }
];

export function ExplorationDeck({ disabled, onChoose }: { disabled: boolean; onChoose: (prompt: string) => void }) {
  return <section className="pg-exploration-deck" aria-labelledby="pg-explore-title">
    <div><span>Bir sonraki yön</span><h3 id="pg-explore-title">Neyi birlikte düşünelim?</h3></div>
    <div className="pg-exploration-grid">
      {EXPLORATION_ACTIONS.map(item => <button type="button" disabled={disabled} key={item.title} onClick={() => onChoose(item.prompt)}>
        <span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={17}/>
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

  return <section className="pg-decision-deck" aria-labelledby="pg-decisions-title">
    <div className="pg-decision-heading"><span>SEÇENEKLER</span><h3 id="pg-decisions-title">Bunlardan hangileri fikrine uyuyor?</h3><p>Her seçeneğe ayrı karar verebilirsin.</p></div>
    <div className="pg-decision-list">
      {items.map(item => <article key={item.id} className={`pg-decision-card is-${item.status}`}>
        <header><span className={`pg-kind is-${item.kind}`}>{item.kind === 'feature' ? 'Özellik' : item.kind === 'risk' ? 'Risk' : item.kind === 'architecture' ? 'Yaklaşım' : item.kind === 'question' ? 'Soru' : 'Karar'}</span>{item.recommended && <span className="pg-recommended"><Sparkles size={12}/> Önerilen</span>}</header>
        <h4>{item.title}</h4><p>{item.editedDescription || item.description}</p>
        <div className="pg-tradeoffs"><span>Efor: {item.effort}</span><span>Etki: {item.impact}</span></div>
        {editing === item.id && <div className="pg-inline-edit"><label htmlFor={`edit-${item.id}`}>Seçeneği düzenle</label><textarea id={`edit-${item.id}`} value={editedText} onChange={event => setEditedText(event.target.value)}/><button type="button" disabled={!editedText.trim()} onClick={() => { onStatus(item.id, 'edited', editedText.trim()); setEditing(null); }}>Düzenleyerek kabul et</button></div>}
        <footer>
          <button type="button" className={item.status === 'accepted' ? 'is-selected' : ''} onClick={() => onStatus(item.id, 'accepted')}><Check size={14}/> Kabul</button>
          <button type="button" className={item.status === 'edited' ? 'is-selected' : ''} onClick={() => { setEditedText(item.editedDescription || item.description); setEditing(item.id); }}><Pencil size={14}/> Düzenle</button>
          <button type="button" className={item.status === 'deferred' ? 'is-selected' : ''} onClick={() => onStatus(item.id, 'deferred')}><Clock3 size={14}/> Sonra</button>
          <button type="button" className={item.status === 'rejected' ? 'is-selected is-danger' : ''} onClick={() => onStatus(item.id, 'rejected')}><X size={14}/> Reddet</button>
        </footer>
      </article>)}
    </div>
  </section>;
}

export function QuestionChips({ questions, active, onChoose }: { questions: string[]; active: string; onChoose: (question: string) => void }) {
  if (!questions.length) return null;
  return <section className="pg-question-block" aria-labelledby="pg-questions-title">
    <div><CircleHelp size={17}/><span><b id="pg-questions-title">Netleştirmemiz gerekenler</b><small>Bir soruyu seç ve doğal şekilde cevapla.</small></span></div>
    <div>{questions.slice(0, 5).map(question => <button type="button" className={active === question ? 'is-active' : ''} key={question} onClick={() => onChoose(question)}>{question}</button>)}</div>
  </section>;
}
