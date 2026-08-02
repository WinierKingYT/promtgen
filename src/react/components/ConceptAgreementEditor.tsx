import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import type { ConceptSummary, ProjectDocumentV5 } from '../../v4/contracts.js';
import { getConceptAgreementGate } from '../../v4/application/idea-discussion-service.js';
import { updateIdeaDocumentWithRevision } from '../../v4/application/idea-document-revision-service.js';

type EditableAgreement = Pick<
  ConceptSummary,
  'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' |
  'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'mvpTarget'
>;

function toDraft(summary: ConceptSummary) {
  return {
    summary: summary.summary,
    targetUser: summary.targetUser,
    problemStatement: summary.problemStatement,
    currentAlternative: summary.currentAlternative,
    desiredOutcome: summary.desiredOutcome,
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
  const requiredText = [
    draft.summary,
    draft.targetUser,
    draft.problemStatement,
    draft.currentAlternative,
    draft.desiredOutcome,
    draft.mvpTarget
  ];
  const valid = requiredText.every(value => value.trim())
    && lines(draft.confirmedFeatures).length > 0
    && lines(draft.outOfScope).length > 0
    && lines(draft.openQuestions).length === 0;

  const save = () => {
    const changes: EditableAgreement = {
      summary: draft.summary,
      targetUser: draft.targetUser,
      problemStatement: draft.problemStatement,
      currentAlternative: draft.currentAlternative,
      desiredOutcome: draft.desiredOutcome,
      mvpTarget: draft.mvpTarget,
      confirmedFeatures: lines(draft.confirmedFeatures),
      outOfScope: lines(draft.outOfScope),
      technicalApproaches: lines(draft.technicalApproaches),
      knownRisks: lines(draft.knownRisks),
      openQuestions: lines(draft.openQuestions)
    };
    onCommit(updateIdeaDocumentWithRevision(project, changes), 'Fikir belgesi yeni sürüm olarak kaydedildi.', 'UpdateConceptAgreement');
  };
  const listField = (
    key: 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions',
    label: string,
    hint: string
  ) => <label>{label}<small>{hint}</small><textarea value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })}/></label>;

  return <div className="concept-agreement">
    <div className="agreement-head">
      <div><span className="meta">SİSTEM YORUMU · KULLANICI ONAYI GEREKLİ</span><h3><CheckCircle2 size={17}/> Projeyi doğru anladık mı?</h3></div>
      <span className="interpretation-confidence">%{summary.interpretationConfidence} yorum güveni</span>
    </div>
    <div className="confidence-explanation">
      <b>Bu oran doğruluk garantisi değildir.</b>
      <span>Eksik bağlam göstergesidir; sen alanları düzeltip onaylamadan plana aktarılmaz.</span>
      {summary.confidenceRationale.map(reason => <small key={reason}>• {reason}</small>)}
    </div>
    <div className="agreement-primary">
      <label>Sistem yorumu<small>Projeyi tek paragrafta nasıl anladığımız</small><textarea aria-invalid={!draft.summary.trim()} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })}/></label>
      <label>Birincil kullanıcı<small>Bu ürünü düzenli kullanacak tek ana persona</small><textarea aria-invalid={!draft.targetUser.trim()} value={draft.targetUser} onChange={event => setDraft({ ...draft, targetUser: event.target.value })}/></label>
      <label>Ana problem<small>Kullanıcının bugün yaşadığı somut sorun</small><textarea aria-invalid={!draft.problemStatement.trim()} value={draft.problemStatement} onChange={event => setDraft({ ...draft, problemStatement: event.target.value })}/></label>
      <label>Bugünkü çözüm<small>Bu problem şu anda nasıl çözülüyor?</small><textarea aria-invalid={!draft.currentAlternative.trim()} value={draft.currentAlternative} onChange={event => setDraft({ ...draft, currentAlternative: event.target.value })}/></label>
      <label>Beklenen ana sonuç<small>Ürün kullanıldığında ne değişecek?</small><textarea aria-invalid={!draft.desiredOutcome.trim()} value={draft.desiredOutcome} onChange={event => setDraft({ ...draft, desiredOutcome: event.target.value })}/></label>
      <label>MVP hedefi<small>İlk sürümün tek doğrulanabilir sonucu</small><textarea aria-invalid={!draft.mvpTarget.trim()} value={draft.mvpTarget} onChange={event => setDraft({ ...draft, mvpTarget: event.target.value })}/></label>
    </div>
    <div className="agreement-grid">
      {listField('confirmedFeatures', 'MVP içinde', 'En az bir madde · her satıra bir özellik')}
      {listField('outOfScope', 'MVP dışında', 'En az bir madde · kapsam kaymasını önler')}
      {listField('technicalApproaches', 'Teknik yaklaşım', 'Her satıra bir yaklaşım')}
      {listField('knownRisks', 'Bilinen riskler', 'Her satıra bir risk')}
      {listField('openQuestions', 'Açık kritik sorular', 'Onaydan önce cevapla ve bu listeyi temizle')}
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
    {!valid && <p className="agreement-error" role="alert">Tüm yorum alanlarını doldur; MVP içi/dışı listelerine en az birer madde ekle ve açık kritik soruları kapat.</p>}
    <div className="agreement-footer">
      <span>{gate.accepted.length} fikir kabul · {gate.deferred.length} ertelendi · {gate.rejected.length} reddedildi</span>
      <button type="button" className="agreement-save" disabled={!valid} onClick={save}><Save size={15}/> Yorumu ve MVP sınırlarını kaydet</button>
    </div>
  </div>;
}
