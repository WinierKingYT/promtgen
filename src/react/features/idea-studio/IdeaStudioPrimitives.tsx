import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Menu,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import type {
  ProjectDocumentV5,
  SuggestionItem,
  SuggestionStatus
} from '../../../v4/contracts.js';
import type { ProviderSettings } from '../../../v4/provider-settings.js';
import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';
import type { DiscoveryAnswerDraft } from '../../../v4/application/discovery-answer-service.js';
import { DiscoveryAnswerReview } from '../../components/DiscoveryAnswerReview.js';
import { IdeaExpansionBoard } from './IdeaExpansionBoard.js';
import { IdeaStateView } from './IdeaStateView.js';

export type IdeaStudioView = 'develop' | 'guide' | 'plan';

const VIEW_ITEMS: Array<{
  id: IdeaStudioView;
  label: string;
  detail: string;
  icon: typeof Lightbulb;
}> = [
  { id: 'develop', label: 'Fikir', detail: 'Konuş ve şekillendir', icon: Lightbulb },
  { id: 'guide', label: 'Ortak Anlayış', detail: 'Ortak anlayışı kontrol et', icon: FileText },
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
  onHistory,
  lockedViews
}: {
  project: ProjectDocumentV5;
  view: IdeaStudioView;
  onView: (view: IdeaStudioView) => void;
  onMenu: () => void;
  onExit: () => void;
  onHistory: () => void;
  /**
   * Kilitli aşamalar ve kilidin nedeni. Kilit yalnız görünümü kapatmaz,
   * kullanıcıya ne yapması gerektiğini de söyler — aksi hâlde tıklanamayan
   * bir düğme bozukluk gibi okunur.
   */
  lockedViews?: Partial<Record<IdeaStudioView, string>>;
}) {
  return <header className="pg-studio-header">
    <div className="pg-project-heading">
      <button type="button" className="pg-mobile-menu" aria-label="Projeleri aç" onClick={onMenu}><Menu size={20}/></button>
      <button type="button" className="pg-back-button" aria-label="Başlangıca dön" onClick={onExit}><ArrowLeft size={18}/></button>
      <span><b>{project.identity.name || 'Yeni fikir'}</b><small>Yerel taslak · d{project.documentRevision}</small></span>
    </div>
    {/* Bunlar aşama değil, **görünüm**. Aşamalar V3'te `StageRail`'in işi
        (FİKİR · ÇÖZÜM · PLAN · DEVİR); buradaki sekmeler aynı belgeye üç farklı
        pencereden bakmayı sağlıyor. İkisine de "Proje aşamaları" demek dördüncü
        bir aşama modeli uydurmak olurdu — Alt Proje C'nin dersi tam buydu. */}
    <nav className="pg-view-tabs" aria-label="Çalışma görünümleri">
      {VIEW_ITEMS.map(({ id, label, detail, icon: Icon }) => {
        const lockReason = lockedViews?.[id];
        return <button
          type="button"
          key={id}
          className={`${view === id ? 'is-active' : ''}${lockReason ? ' is-locked' : ''}`.trim()}
          aria-current={view === id ? 'step' : undefined}
          title={lockReason || detail}
          onClick={() => onView(id)}
        ><Icon size={16}/><span>{label}</span></button>;
      })}
    </nav>
    <button type="button" className="pg-history-button" onClick={onHistory}>Geçmiş</button>
  </header>;
}

/**
 * Ekranın BELKEMİĞİ: fikrin kendisi.
 *
 * Keşif panosu (AI'ın ürettiği eksenler ve kartlar) artık dar bir yan sütunda
 * değil, merkez sütunda duruyor — kullanıcının gözü buraya düşsün diye.
 * Sohbet ikincil bir yan kanala indi (bkz. Workspace.tsx `pg-chat-dock`).
 *
 * Stüdyo başlığı ve BAŞLANGIÇ FİKRİ de buraya taşındı. İkisi de sohbete değil
 * fikre ait; ayrıca sohbet katlanmışken sayfanın tek `<h1>`'i yine burada
 * olur — aksi hâlde varsayılan görünümde hiç başlık kalmazdı.
 *
 * Sarmalayıcı bilerek `<div>`: keşif panosu kendi `<section aria-label="Keşif
 * panosu">` bölgesini zaten taşıyor, buraya ikinci bir adlandırılmış landmark
 * koymak ekran okuyucuda gereksiz bir iç içe bölge üretirdi.
 */
export function IdeaExpansionColumn({
  project,
  settings,
  onPersist,
  onNotice,
  discoveringConcerns,
  onDiscoverConcerns
}: {
  project: ProjectDocumentV5;
  settings: ProviderSettings;
  /** Keşif panosunun ürettiği belge; komut türü çağırana kadar taşınır. */
  onPersist: (project: ProjectDocumentV5, message: string, commandType: string) => void;
  /** Kalıcı bir değişiklik olmadan kullanıcıya durum bildirmek için. */
  onNotice: (message: string) => void;
  discoveringConcerns: boolean;
  /** Konu çıkarımı; kimlik bilgisi kasada olduğu için eylemin sahibi Workspace. */
  onDiscoverConcerns: () => void;
}) {
  return <div className="pg-expansion-column">
    <header className="pg-idea-headline">
      <div className="pg-assistant-mark"><Sparkles size={19}/></div>
      <div>
        <span>FİKİR STÜDYOSU</span>
        <h1>Fikrini birlikte şekillendirelim</h1>
        <p>Aşağıdaki başlıklardan ilerle, önerileri fikre ekle ya da kendi önerini yaz. Konuşmak istersen sohbeti açman yeterli — zorunlu değil.</p>
      </div>
    </header>
    <article className="pg-original-idea"><span>Başlangıç fikrin</span><p>{project.identity.originalIdea}</p></article>

    {/* İSTEĞE BAĞLI ileri eylem. Konu çıkarımı bugün yalnız sohbet turunda
        yaşıyor; sohbet ise katlanmış açılıyor ve Faz F'te atlanabilir hâle
        geliyor. Bu düğme aynı işin ana yüzeydeki ikinci kapısı — bir kapı,
        bir yönlendirme değil: basmadan da fikir panodan geliştirilmeye,
        Ortak Anlayış'tan plana geçilmeye devam eder. */}
    <section className="pg-concern-discovery" aria-label="Bekleyen kararları çıkar">
      <div>
        <b>Fikrin bekleyen kararlarını çıkar</b>
        <small>Fikrinde hangi kararların verilmediğini çıkarır ve Fikir tasarımı panelinde tek tek sorar. İsteğe bağlı; bir AI sağlayıcısı gerekir.</small>
      </div>
      <button type="button" onClick={onDiscoverConcerns} disabled={discoveringConcerns}>
        {discoveringConcerns ? <LoaderCircle className="spin" size={14}/> : <ListChecks size={14}/>}
        {discoveringConcerns ? 'Çıkarılıyor…' : 'Kararları çıkar'}
      </button>
    </section>

    <IdeaExpansionBoard project={project} settings={settings} onPersist={onPersist} onNotice={onNotice}/>
  </div>;
}

/**
 * Fikrin GÜNCEL HALİ — salt görüntüleme (derived view, bkz. idea-state-view.ts).
 *
 * Eskiden keşif panosuyla AYNI dar sütunu paylaşıyordu ve bilerek panonun
 * ALTINA konmuştu: üstte dursaydı bir karar değiştiğinde (ör. bir kart
 * "bekliyor"a düşünce) özetin boyu değişir, altındaki kartların "Fikre ekle"
 * düğmeleri dikey olarak kayardı. Artık AYRI bir sütunda: o geometri bağı
 * kendiliğinden koptu, sıra kısıtı da ortadan kalktı.
 *
 * `aria-label` buradaki `<aside>`e ait; iç `IdeaStateView` bölümü artık
 * adlandırılmıyor (bkz. IdeaStateView.tsx yorumu).
 */
export function IdeaStateColumn({ project }: { project: ProjectDocumentV5 }) {
  return <aside className="pg-idea-map pg-idea-state-column" aria-label="Fikrin güncel hali">
    <IdeaStateView project={project}/>
  </aside>;
}

export function IdeaCoachFocus({ coach, disabled, onChoose }: {
  coach: IdeaCoachState;
  disabled: boolean;
  onChoose: (prompt: string) => void;
}) {
  return <section className="pg-coach-focus" aria-labelledby="pg-coach-question">
    <div className="pg-coach-focus-copy">
      {/* Soru bir TALEP değil, bir DAVET: kullanıcı fikrini panodan da
          geliştirebiliyor, bu yüzden dil "şimdi bunu netleştiriyoruz"dan
          "istersen buradan devam edelim"e çekildi. */}
      <span>Konuşmak istersen · {coach.activeStepLabel}</span>
      <h2 id="pg-coach-question">{coach.activeQuestion}</h2>
      <p>Cevaplamak zorunda değilsin; panodan da ilerleyebilirsin. İstersen aşağıdaki yollardan biriyle birlikte düşünelim.</p>
      {coach.uncertainty.map(item => <p key={item}>Henüz emin olmadığım: {item}</p>)}
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
  stageOwnsQuestion,
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
  /**
   * Aşama paneli o an bir konuyu soruyorsa buradaki sabit koç sorusu
   * gösterilmez. İki farklı soru aynı anda ekranda durursa kullanıcı hangisini
   * cevapladığını bilemez — V3'ün "her turda tek soru" kuralı tam olarak bunu
   * yasaklıyor.
   */
  stageOwnsQuestion: boolean;
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
      : stageOwnsQuestion
        ? null
        : <IdeaCoachFocus coach={coach} disabled={disabled} onChoose={onChoose}/>}
  </>;
}
