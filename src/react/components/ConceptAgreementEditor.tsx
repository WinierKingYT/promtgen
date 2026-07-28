import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import type { ConceptSummary, ProjectDocumentV5 } from '../../v4/contracts.js';
import { getConceptAgreementGate, updateConceptAgreement } from '../../v4/application/idea-discussion-service.js';

type EditableAgreement = Pick<
  ConceptSummary,
  'summary' | 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'mvpTarget'
>;

function toDraft(summary: ConceptSummary) {
  return {
    summary: summary.summary,
    mvpTarget: summary.mvpTarget,
    confirmedFeatures: summary.confirmedFeatures.join('\n'),
    outOfScope: summary.outOfScope.join('\n'),
    technicalApproaches: summary.technicalApproaches.join('\n'),
    knownRisks: summary.knownRisks.join('\n'),
    openQuestions: summary.openQuestions.join('\n')
  };
}

function lines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

export function ConceptAgreementEditor({ project, onCommit }: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void;
}) {
  const summary = project.ideaLabSession?.conceptSummary;
  const [draft, setDraft] = useState(() => summary ? toDraft(summary) : null);
  useEffect(() => setDraft(summary ? toDraft(summary) : null), [project.id, project.canonicalRevision, summary]);
  const gate = getConceptAgreementGate(project);
  const ledger = useMemo(() => ({
    decisions: gate.accepted.filter(record => record.kind === 'decision'),
    assumptions: gate.accepted.filter(record => record.kind === 'hypothesis'),
    risks: gate.accepted.filter(record => record.kind === 'risk'),
    questions: gate.accepted.filter(record => record.kind === 'question')
  }), [gate.accepted]);
  if (!summary || !draft) return null;
  const valid = Boolean(draft.summary.trim() && draft.mvpTarget.trim());

  const save = () => {
    const changes: EditableAgreement = {
      summary: draft.summary,
      mvpTarget: draft.mvpTarget,
      confirmedFeatures: lines(draft.confirmedFeatures),
      outOfScope: lines(draft.outOfScope),
      technicalApproaches: lines(draft.technicalApproaches),
      knownRisks: lines(draft.knownRisks),
      openQuestions: lines(draft.openQuestions)
    };
    onCommit(updateConceptAgreement(project, changes), 'Konsept mutabakat özeti güncellendi.', 'UpdateConceptAgreement');
  };
  const listField = (
    key: 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions',
    label: string,
    hint: string
  ) => <label>{label}<small>{hint}</small><textarea value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}/></label>;

  return <div className="concept-agreement">
    <div className="agreement-head">
      <div><span className="meta">DÜZENLENEBİLİR MUTABAKAT</span><h3><CheckCircle2 size={17}/> Planın başlangıç sözleşmesi</h3></div>
      <span>{gate.accepted.length} kabul · {gate.deferred.length} ertelenen · {gate.rejected.length} reddedilen</span>
    </div>
    <div className="agreement-primary">
      <label>Konsept özeti<textarea aria-invalid={!draft.summary.trim()} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })}/></label>
      <label>MVP hedefi<input aria-invalid={!draft.mvpTarget.trim()} value={draft.mvpTarget} onChange={event => setDraft({ ...draft, mvpTarget: event.target.value })}/></label>
    </div>
    <div className="agreement-grid">
      {listField('confirmedFeatures', 'Kesinleşen özellikler', 'Her satıra bir özellik')}
      {listField('outOfScope', 'Kapsam dışı', 'Her satıra bir madde')}
      {listField('technicalApproaches', 'Teknik yaklaşım', 'Her satıra bir yaklaşım')}
      {listField('knownRisks', 'Bilinen riskler', 'Her satıra bir risk')}
      {listField('openQuestions', 'Özette kalan sorular', 'Her satıra bir soru')}
    </div>
    {gate.accepted.length > 0 && <div className="agreement-ledger">
      <b>Tartışmadan plana taşınacak kayıtlar</b>
      {([
        ['Kararlar', ledger.decisions],
        ['Varsayımlar', ledger.assumptions],
        ['Riskler', ledger.risks],
        ['Cevaplanan sorular', ledger.questions]
      ] as const).map(([label, records]) => records.length > 0 && <div key={label}><span>{label}</span>{records.map(record => <p key={record.id}>{record.text}{record.answer ? ` — ${record.answer}` : ''}</p>)}</div>)}
    </div>}
    {!valid && <p className="agreement-error" role="alert">Konsept özeti ve MVP hedefi boş bırakılamaz.</p>}
    <button type="button" className="agreement-save" disabled={!valid} onClick={save}><Save size={15}/> Mutabakat özetini kaydet</button>
  </div>;
}
