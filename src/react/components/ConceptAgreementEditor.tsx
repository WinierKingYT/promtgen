import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save, Sparkles, TriangleAlert } from 'lucide-react';
import type { ConceptSummary, ProjectDocumentV5 } from '../../v4/contracts.js';
import { getConceptAgreementGate } from '../../v4/application/idea-discussion-service.js';
import { updateIdeaDocumentWithRevision } from '../../v4/application/idea-document-revision-service.js';
import { findRemovedScopeDefaults } from '../../v4/application/legacy-scope-defaults.js';
import { resolveConceptScopeDraft } from '../../v4/application/idea-scope-draft.js';
// Kutu adları dönüşüm engelleriyle ORTAK sabitten okunur: kullanıcı hangi
// kutuyu dolduracağını hata metninden okuyabilsin diye ikisi ayrılamaz.
import { CONCEPT_FIELD_LABELS } from '../../v4/application/concept-field-labels.js';

type EditableAgreement = Pick<
  ConceptSummary,
  'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' |
  'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'firstReleaseTarget'
>;

/**
 * Kapsam kutuları BOŞ doğmaz artık: fikir aşamasında "Fikre ekle" ile kabul
 * edilmiş kartlar buraya taslak olarak düşer (bkz.
 * v4/application/idea-scope-draft.ts). Kullanıcının aynı şeyi ikinci kez
 * yazması ölçülmüş bir kusurdu.
 *
 * TASLAK BELGEYE YAZILMAZ. Türetme yalnız burada, okuma anında olur; belgeye
 * geçmesi için kullanıcının kaydetmesi gerekir. `derived` alanı hangi
 * satırların türetildiğini taşır — köken bildirimi yalnız onlar için çıkar.
 */
function toDraft(project: ProjectDocumentV5, summary: ConceptSummary) {
  const scope = resolveConceptScopeDraft(project, summary);
  return {
    draft: {
      summary: summary.summary,
      targetUser: summary.targetUser,
      problemStatement: summary.problemStatement,
      currentAlternative: summary.currentAlternative,
      desiredOutcome: summary.desiredOutcome,
      firstReleaseTarget: summary.firstReleaseTarget,
      confirmedFeatures: scope.confirmedFeatures.join('\n'),
      outOfScope: scope.outOfScope.join('\n'),
      technicalApproaches: summary.technicalApproaches.join('\n'),
      knownRisks: summary.knownRisks.join('\n'),
      openQuestions: summary.openQuestions.join('\n')
    },
    derived: scope.derived
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
  const [state, setState] = useState(() => summary ? toDraft(project, summary) : null);
  useEffect(
    () => setState(summary ? toDraft(project, summary) : null),
    // `project` bilerek bağımlılık DEĞİL: taslak yalnız belge kimliği, sürümü
    // ya da özetin kendisi değiştiğinde yeniden kurulur. Her render'da
    // kurulsaydı kullanıcının yazdığı satırlar her tuşta silinirdi.
    [project.id, project.canonicalRevision, summary]
  );
  const draft = state?.draft || null;
  const setDraft = (next: NonNullable<typeof draft>) =>
    setState(current => current ? { ...current, draft: next } : current);
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
    draft.firstReleaseTarget
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
      firstReleaseTarget: draft.firstReleaseTarget,
      confirmedFeatures: lines(draft.confirmedFeatures),
      outOfScope: lines(draft.outOfScope),
      technicalApproaches: lines(draft.technicalApproaches),
      knownRisks: lines(draft.knownRisks),
      openQuestions: lines(draft.openQuestions)
    };
    onCommit(updateIdeaDocumentWithRevision(project, changes), 'Fikir belgesi yeni sürüm olarak kaydedildi.', 'UpdateConceptAgreement');
  };
  // Kaldırılmış kapsam varsayılanları için dürüstlük uyarısı.
  //
  // `38bc893`/`06d2541` öncesinde oluşturulmuş belgeler, sistemin kullanıcı
  // adına UYDURDUĞU kapsam satırlarını hâlâ taşıyor. Belgeyi sessizce
  // düzeltmiyoruz — kullanıcının belgesi. Ama yalanı biz koyduk; haber
  // vermemek onu sürdürmek olurdu.
  //
  // Uyarı KENDİLİĞİNDEN kaybolur: satır düzeltilince ya da silinince eşleşme
  // biter. Ayrı bir "kapatıldı" durumu TUTULMAZ — tutulsaydı uyarı, uydurma
  // belgede dururken susabilirdi.
  // Silme, yalnız kullanıcının tıklamasıyla ve yalnız TASLAKTA olur; belgeye
  // geçmesi için ayrıca "kaydet" gerekir. Sistem kendiliğinden hiçbir satırı
  // kaldırmaz.
  const removeLegacyLines = (key: 'confirmedFeatures' | 'outOfScope') => {
    const kept = draft[key].split('\n').filter(line => findRemovedScopeDefaults([line.trim()]).length === 0);
    setDraft({ ...draft, [key]: kept.join('\n') });
  };
  const listField = (
    key: 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions',
    label: string,
    hint: string
  ) => {
    const isScopeField = key === 'confirmedFeatures' || key === 'outOfScope';
    const legacy = isScopeField ? findRemovedScopeDefaults(lines(draft[key])) : [];
    const noticeId = `legacy-scope-${key}`;
    // Köken bildirimi KUTUDA HÂLÂ DURAN satırlarla sınırlıdır: kullanıcı bir
    // satırı silince ya da yeniden yazınca o satır listeden düşer, hepsi
    // düşerse bildirim kendiliğinden kaybolur. Ayrı bir "kapatıldı" durumu
    // tutulmaz — legacy uyarısıyla aynı kural.
    const derivedAll = (key === 'confirmedFeatures' || key === 'outOfScope')
      ? (state?.derived[key] || [])
      : [];
    const present = new Set(lines(draft[key]));
    const derived = derivedAll.filter(item => present.has(item));
    const derivedNoticeId = `derived-scope-${key}`;
    const describedBy = [
      legacy.length > 0 ? noticeId : '',
      derived.length > 0 ? derivedNoticeId : ''
    ].filter(Boolean).join(' ');
    return <div className="agreement-field">
      <label>{label}<small>{hint}</small><textarea
        aria-describedby={describedBy || undefined}
        value={draft[key]}
        onChange={event => setDraft({ ...draft, [key]: event.target.value })}
      /></label>
      {derived.length > 0 && <div className="derived-scope-notice" id={derivedNoticeId} role="note">
        <Sparkles size={14} aria-hidden="true"/>
        <div>
          <b>Fikir aşamasında kabul ettiğin kartlardan geldi.</b>
          <span>
            Aşağıdaki {derived.length > 1 ? `${derived.length} satır` : 'satır'} "Fikre ekle" ile kabul
            ettiğin kartlardan TASLAK olarak türetildi; belgene henüz yazılmadı. Bir oku: doğruysa kalsın,
            değilse düzelt ya da sil. Kaydedene kadar hiçbiri belgeye geçmez.
          </span>
          <ul>{derived.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>}
      {isScopeField && legacy.length > 0 && <div className="legacy-scope-notice" id={noticeId} role="note">
        <TriangleAlert size={14} aria-hidden="true"/>
        <div>
          <b>Bunu sen yazmadın.</b>
          <span>
            Aşağıdaki {legacy.length > 1 ? 'satırları' : 'satırı'} bu alana sistem koydu; eski bir
            varsayılandan geldi, senin cümlen değil. Bir oku: doğruysa kalsın, değilse düzelt ya da sil.
            Kararı sen verirsin — biz kendiliğimizden dokunmuyoruz.
          </span>
          <ul>{legacy.map(item => <li key={item}>{item}</li>)}</ul>
          <button type="button" onClick={() => removeLegacyLines(key)}>
            Yukarıdaki {legacy.length > 1 ? `${legacy.length} satırı` : 'satırı'} taslaktan sil
          </button>
        </div>
      </div>}
    </div>;
  };

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
      <label>{CONCEPT_FIELD_LABELS.summary}<small>Projeyi tek paragrafta nasıl anladığımız</small><textarea aria-invalid={!draft.summary.trim()} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })}/></label>
      <label>{CONCEPT_FIELD_LABELS.targetUser}<small>Bu ürünü düzenli kullanacak tek ana persona</small><textarea aria-invalid={!draft.targetUser.trim()} value={draft.targetUser} onChange={event => setDraft({ ...draft, targetUser: event.target.value })}/></label>
      <label>{CONCEPT_FIELD_LABELS.problemStatement}<small>Kullanıcının bugün yaşadığı somut sorun</small><textarea aria-invalid={!draft.problemStatement.trim()} value={draft.problemStatement} onChange={event => setDraft({ ...draft, problemStatement: event.target.value })}/></label>
      <label>{CONCEPT_FIELD_LABELS.currentAlternative}<small>Bu problem şu anda nasıl çözülüyor?</small><textarea aria-invalid={!draft.currentAlternative.trim()} value={draft.currentAlternative} onChange={event => setDraft({ ...draft, currentAlternative: event.target.value })}/></label>
      <label>{CONCEPT_FIELD_LABELS.desiredOutcome}<small>Ürün kullanıldığında ne değişecek?</small><textarea aria-invalid={!draft.desiredOutcome.trim()} value={draft.desiredOutcome} onChange={event => setDraft({ ...draft, desiredOutcome: event.target.value })}/></label>
      <label>{CONCEPT_FIELD_LABELS.firstReleaseTarget}<small>İlk sürümün tek doğrulanabilir sonucu</small><textarea aria-invalid={!draft.firstReleaseTarget.trim()} value={draft.firstReleaseTarget} onChange={event => setDraft({ ...draft, firstReleaseTarget: event.target.value })}/></label>
    </div>
    <div className="agreement-grid">
      {listField('confirmedFeatures', CONCEPT_FIELD_LABELS.confirmedFeatures, 'En az bir madde · her satıra bir özellik')}
      {listField('outOfScope', CONCEPT_FIELD_LABELS.outOfScope, 'En az bir madde · kapsam kaymasını önler')}
      {/* Etiket ve ipucu bu alanın DERİNLİĞİNİ söyler. "Teknik yaklaşım"
          tek başına, Çözüm aşamasının ADR disiplinli karar yüzeyiyle
          (SolutionStagePanel: aday, gerekçe, kabul/red) aynı şeymiş gibi
          okunuyordu; ikisi farklı derinlikte ve kullanıcılar bunları
          karıştırıyor. Burası bir ilk izlenim: gerekçe istemez, kararı
          bağlamaz. Alanın yapısı değişmedi — yalnız ne olduğu yazıldı. */}
      {listField('technicalApproaches', 'Aklındaki teknik yön (ilk izlenim)', 'Her satıra bir yön · kaba fikir yeter, teknik kararlar Çözüm aşamasında gerekçesiyle verilir')}
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
    {!valid && <p className="agreement-error" role="alert">Tüm yorum alanlarını doldur; kapsam içi/dışı listelerine en az birer madde ekle ve açık kritik soruları kapat.</p>}
    <div className="agreement-footer">
      <span>{gate.accepted.length} fikir kabul · {gate.deferred.length} ertelendi · {gate.rejected.length} reddedildi</span>
      <button type="button" className="agreement-save" disabled={!valid} onClick={save}><Save size={15}/> Yorumu ve kapsam sınırlarını kaydet</button>
    </div>
  </div>;
}
