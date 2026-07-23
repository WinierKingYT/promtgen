import { useMemo, useState } from 'react';
import { BookOpenCheck, Check, CircleAlert, Plus, Search } from 'lucide-react';
import { addApprovedEvidence, applyResearchAgenda, proposeResearchAgenda } from '../../v4/research-engine.js';

export function ResearchPanel({ project, onCommit }: { project: any; onCommit: (project: any, message: string) => void }) {
  const [agenda, setAgenda] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ questionId: '', url: '', title: '', publisher: '', claim: '', summary: '', confidence: 'medium' });
  const activeQuestions = useMemo(() => project.researchQuestions.filter((item: any) => item.status === 'active'), [project.researchQuestions]);

  const prepareAgenda = () => {
    const next = proposeResearchAgenda(project);
    setAgenda(next);
    setSelected(new Set(next.questions.filter((item: any) => item.priority === 'high').map((item: any) => item.id)));
    setMessage('');
  };
  const approveAgenda = () => {
    const result = applyResearchAgenda(project, agenda, { approvedQuestionIds: [...selected] });
    if (!result.success) { setMessage(result.reason); return; }
    onCommit(result.project, `${selected.size} araştırma sorusu plana eklendi.`);
    setAgenda(null); setSelected(new Set());
  };
  const approveEvidence = () => {
    const result = addApprovedEvidence(project, form, { approved: true });
    if (!result.success) { setMessage(result.reason); return; }
    onCommit(result.project, 'Kaynak ve araştırma kanıtı onaylandı.');
    setForm({ questionId: '', url: '', title: '', publisher: '', claim: '', summary: '', confidence: 'medium' });
    setMessage('');
  };

  return <details className="research-panel">
    <summary><BookOpenCheck size={16}/><span>Araştırma ve kanıt<small>{project.researchQuestions.length} soru · {project.evidence.length} kanıt</small></span></summary>
    <div className="research-body">
      <p>İsteğe bağlıdır. Kaynaklar otomatik uygulanmaz; soru ve kanıtları sen onaylarsın.</p>
      {!agenda && <button type="button" onClick={prepareAgenda}><Search size={15}/> Araştırma gündemi öner</button>}
      {agenda && <section aria-labelledby="research-agenda-title"><h3 id="research-agenda-title">Önerilen araştırma soruları</h3>{agenda.questions.map((question: any) => <label key={question.id}><input type="checkbox" checked={selected.has(question.id)} onChange={() => setSelected(current => { const next = new Set(current); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })}/><span><b>{question.question}</b><small>{question.rationale} · {question.priority}</small></span></label>)}<div className="research-actions"><button type="button" onClick={() => setAgenda(null)}>Vazgeç</button><button type="button" className="primary" disabled={!selected.size} onClick={approveAgenda}><Check size={14}/> Seçilenleri onayla</button></div></section>}
      {activeQuestions.length > 0 && <fieldset className="evidence-form"><legend>Kaynak ve kanıt ekle</legend><label htmlFor="evidence-question">Araştırma sorusu<select id="evidence-question" value={form.questionId} onChange={event => setForm({ ...form, questionId: event.target.value })}><option value="">Seç…</option>{activeQuestions.map((question: any) => <option key={question.id} value={question.id}>{question.question}</option>)}</select></label><label htmlFor="evidence-url">HTTPS kaynak URL’si<input id="evidence-url" type="url" value={form.url} onChange={event => setForm({ ...form, url: event.target.value })}/></label><label htmlFor="evidence-title">Kaynak başlığı<input id="evidence-title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label htmlFor="evidence-claim">Desteklenen iddia<input id="evidence-claim" value={form.claim} onChange={event => setForm({ ...form, claim: event.target.value })}/></label><label htmlFor="evidence-summary">Kanıt özeti<textarea id="evidence-summary" rows={3} value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })}/></label><button type="button" disabled={!form.questionId || !form.url || !form.claim || !form.summary} onClick={approveEvidence}><Plus size={14}/> Kaynak ve kanıtı onayla</button></fieldset>}
      {message && <p className="research-error" role="alert"><CircleAlert size={14}/>{message}</p>}
    </div>
  </details>;
}
