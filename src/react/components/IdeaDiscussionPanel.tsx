import { useState } from 'react';
import { Check, CircleHelp, Edit3, GitCompareArrows, Lightbulb, Pause, Save, Search, ShieldAlert, X } from 'lucide-react';
import type { IdeaDiscussionMode, IdeaDiscussionRecord, IdeaRecordStatus, ProjectDocumentV5 } from '../../v4/contracts.js';
import {
  getConceptAgreementGate,
  setIdeaDiscussionMode,
  updateIdeaRecord,
  updateIdeaRecordStatus
} from '../../v4/application/idea-discussion-service.js';

const MODES: Array<{ id: IdeaDiscussionMode; label: string; detail: string; icon: typeof Search }> = [
  { id: 'explore', label: 'Keşfet', detail: 'Yeni kullanım ve değer alanları bul', icon: Search },
  { id: 'challenge', label: 'Eleştir', detail: 'Varsayımları ve riskleri zorla', icon: ShieldAlert },
  { id: 'compare', label: 'Karşılaştır', detail: 'Alternatifleri trade-offlarla kıyasla', icon: GitCompareArrows },
  { id: 'clarify', label: 'Netleştir', detail: 'Kapsamı ve başarı ölçütünü kesinleştir', icon: CircleHelp }
];
const KIND_LABELS = { decision: 'Karar adayı', hypothesis: 'Hipotez', risk: 'Risk', question: 'Açık soru' };

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => void;

function IdeaRecordCard({ project, record, onCommit }: {
  project: ProjectDocumentV5;
  record: IdeaDiscussionRecord;
  onCommit: Commit;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    text: record.text,
    note: record.note,
    answer: record.answer,
    rationale: record.rationale,
    validationPlan: record.validationPlan
  });
  const resolve = (status: IdeaRecordStatus) =>
    onCommit(updateIdeaRecordStatus(project, record.id, status), 'Fikir kaydı güncellendi.', 'UpdateIdeaRecordStatus');
  const save = () => {
    onCommit(updateIdeaRecord(project, record.id, draft), 'Fikir kaydı ve açıklamaları kaydedildi.', 'EditIdeaRecord');
    setEditing(false);
  };
  const canAccept = record.kind !== 'question' || Boolean(record.answer.trim());

  return <article className={`idea-record status-${record.status}`}>
    <div className="idea-record-main">
      <div className="idea-record-meta">
        <span>{KIND_LABELS[record.kind]}</span>
        {record.history.length > 0 && <small>{record.history.length} düzenleme</small>}
      </div>
      <p>{record.text}</p>
      {record.note && <small className="record-detail">Not: {record.note}</small>}
      {record.rationale && <small className="record-detail">Gerekçe: {record.rationale}</small>}
      {record.validationPlan && <small className="record-detail">Doğrulama: {record.validationPlan}</small>}
      {record.answer && <small className="record-answer">Cevap: {record.answer}</small>}
      {record.history.length > 0 && <details className="record-history">
        <summary>Düzenleme geçmişi</summary>
        {record.history.slice().reverse().map((entry, index) =>
          <p key={`${entry.editedAt}-${index}`}>{entry.text} <time>{entry.editedAt ? new Date(entry.editedAt).toLocaleString('tr-TR') : ''}</time></p>
        )}
      </details>}
    </div>
    <div className="idea-record-controls">
      <button type="button" className="record-edit" onClick={() => setEditing(value => !value)}>
        <Edit3 size={13}/> {editing ? 'Vazgeç' : record.kind === 'question' ? 'Düzenle / cevapla' : 'Düzenle'}
      </button>
      {record.status === 'pending' ? <div className="idea-record-actions">
        <button type="button" className="accept" disabled={!canAccept} title={!canAccept ? 'Önce soruyu cevaplayın.' : undefined} onClick={() => resolve('accepted')}><Check size={13}/> Kabul</button>
        <button type="button" onClick={() => resolve('deferred')}><Pause size={13}/> Sonra</button>
        <button type="button" onClick={() => resolve('rejected')}><X size={13}/> Reddet</button>
      </div> : <button type="button" className="record-reopen" onClick={() => resolve('pending')}>Kararı değiştir</button>}
    </div>
    {editing && <div className="idea-record-editor">
      <label>Kayıt metni<textarea autoFocus aria-invalid={!draft.text.trim()} value={draft.text} maxLength={600} onChange={event => setDraft({ ...draft, text: event.target.value })}/></label>
      <label>Ek not<textarea value={draft.note} maxLength={2400} onChange={event => setDraft({ ...draft, note: event.target.value })}/></label>
      {record.kind === 'question' && <label>Sorunun cevabı<textarea value={draft.answer} maxLength={2400} onChange={event => setDraft({ ...draft, answer: event.target.value })}/></label>}
      {record.kind === 'decision' && <label>Karar gerekçesi<textarea value={draft.rationale} maxLength={2400} onChange={event => setDraft({ ...draft, rationale: event.target.value })}/></label>}
      {record.kind === 'hypothesis' && <label>Nasıl doğrulanacak?<textarea value={draft.validationPlan} maxLength={2400} onChange={event => setDraft({ ...draft, validationPlan: event.target.value })}/></label>}
      <button type="button" className="record-save" disabled={!draft.text.trim()} onClick={save}><Save size={14}/> Kaydet</button>
    </div>}
  </article>;
}

export function IdeaDiscussionPanel({ project, onCommit }: {
  project: ProjectDocumentV5;
  onCommit: Commit;
}) {
  const discussion = project.ideaDiscussion;
  const gate = getConceptAgreementGate(project);
  const records = [...discussion.records].reverse();
  const changeMode = (mode: IdeaDiscussionMode) =>
    onCommit(setIdeaDiscussionMode(project, mode), `Tartışma modu ${MODES.find(item => item.id === mode)?.label} olarak değiştirildi.`, 'SetIdeaDiscussionMode');
  const moveModeFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const offset = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    const nextIndex = (index + offset + MODES.length) % MODES.length;
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[nextIndex]?.focus();
    changeMode(MODES[nextIndex].id);
  };
  const deferRemaining = () => {
    let next = project;
    for (const record of gate.pending) next = updateIdeaRecordStatus(next, record.id, 'deferred');
    onCommit(next, 'Bekleyen fikir kayıtları sonraya ertelendi.', 'DeferIdeaRecords');
  };

  return <section className="idea-discussion" aria-labelledby="idea-discussion-title">
    <div className="idea-discussion-head">
      <div><span className="meta">FİKİR TARTIŞMA MOTORU</span><h2 id="idea-discussion-title"><Lightbulb size={18}/> Fikri hangi açıdan tartışalım?</h2></div>
      <span className={gate.ready ? 'gate-ready' : 'gate-pending'}>{gate.ready ? <><Check size={14}/> Mutabakata hazır</> : <>{gate.unresolvedCount} kayıt tamamlanmalı</>}</span>
    </div>
    <div className="discussion-modes" role="radiogroup" aria-label="Fikir tartışma modu">
      {MODES.map((mode, index) => {
        const Icon = mode.icon;
        return <button type="button" role="radio" aria-checked={discussion.mode === mode.id} tabIndex={discussion.mode === mode.id ? 0 : -1} className={discussion.mode === mode.id ? 'active' : ''} key={mode.id} onKeyDown={event => moveModeFocus(event, index)} onClick={() => changeMode(mode.id)}>
          <Icon size={15}/><span><b>{mode.label}</b><small>{mode.detail}</small></span>
        </button>;
      })}
    </div>
    {records.length > 0 ? <div className="idea-record-board">
      <div className="record-board-head">
        <span>{gate.accepted.length} kabul · {gate.deferred.length} ertelendi · {gate.rejected.length} reddedildi</span>
        {gate.pending.length > 0 && <button type="button" onClick={deferRemaining}><Pause size={13}/> Kalanları ertele</button>}
      </div>
      {records.slice(0, 16).map(record => <IdeaRecordCard key={record.id} project={project} record={record} onCommit={onCommit}/>)}
    </div> : <p className="discussion-empty">Sohbette yeni bir yön açtığında karar adayları, hipotezler, riskler ve açık sorular burada birikecek.</p>}
  </section>;
}
