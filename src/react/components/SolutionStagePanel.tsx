import { useState } from 'react';
import { Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { solutionApprovalReadiness } from '../../v4/application/solution-approval.js';
import { readinessLines } from '../../v4/application/stage-approval.js';
import { selectNextConcern } from '../../v4/application/concerns.js';
import {
  acceptCandidate,
  answerConcern,
  approveStage,
  declineCandidate,
  deferConcern
} from '../../v4/application/stage-commands.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { StageCommandResult } from '../../v4/application/stage-commands.js';

/**
 * Teknik çözüm aşaması paneli.
 *
 * "Öneri ≠ karar" kuralının ekrandaki karşılığı: adaylar **aday** olarak
 * gösterilir, kabul etmek için gerekçe istenir ve reddetmek de gerekçe ister.
 * Gerekçesiz kabul bir ADR üretmez; gerekçesiz ret sonraki turda hatırlanamaz.
 */

export function SolutionStagePanel({ project, running, onCommand, onDiscover }: {
  project: ProjectDocumentV5;
  running: boolean;
  onCommand: (result: StageCommandResult, commandType: string) => void;
  onDiscover: () => void;
}) {
  const [statement, setStatement] = useState('');
  const [rationale, setRationale] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const readiness = solutionApprovalReadiness(project);
  const candidate = project.solutionDesign.candidates.find(item => item.status === 'proposed') || null;
  const concern = selectNextConcern(project.solutionDesign.concerns);
  const approved = project.solutionDesign.approval.status === 'approved';

  const run = (result: StageCommandResult, commandType: string) => {
    setError(result.error || '');
    if (result.error) return;
    setStatement('');
    setRationale('');
    setDeclineReason('');
    setAnswer('');
    onCommand(result, commandType);
  };

  if (approved) {
    return <aside className="pg-stage-panel" aria-label="Teknik tasarım">
      <h2>Teknik tasarım onaylandı</h2>
      <p className="pg-stage-note">Plan üretilebilir.</p>
    </aside>;
  }

  return <aside className="pg-stage-panel" aria-label="Teknik tasarım">
    <h2>Bunu nasıl kuracağız?</h2>

    {candidate ? (
      <>
        <p className="pg-stage-why">
          <b>{candidate.title}</b> bir <b>öneri</b>; sen onaylamadan hiçbir şey seçilmiş sayılmaz.
        </p>
        <p className="pg-stage-note">{candidate.rationale}</p>
        {candidate.tradeoffs.length > 0 && (
          <p className="pg-stage-note">Bedeli: {candidate.tradeoffs.join(' · ')}</p>
        )}
        <label>
          Kararın
          <input type="text" value={statement} onChange={event => setStatement(event.target.value)} placeholder={candidate.title}/>
        </label>
        <label>
          Neden bu? <small>(gerekçesiz karar kaydedilmez)</small>
          <input type="text" value={rationale} onChange={event => setRationale(event.target.value)}/>
        </label>
        {error && <p className="pg-stage-error" role="alert">{error}</p>}
        <div className="pg-stage-actions">
          <button
            type="button"
            className="pg-stage-primary"
            onClick={() => run(acceptCandidate(project, {
              candidateId: candidate.id,
              statement: statement || candidate.title,
              rationale,
              rejectedAlternatives: [],
              revision: project.canonicalRevision + 1
            }), 'AcceptTechnologyCandidate')}
          ><Check size={15}/> Karar olarak kaydet</button>
        </div>
        <label>
          Reddetme nedeni
          <input type="text" value={declineReason} onChange={event => setDeclineReason(event.target.value)} placeholder="Neden uygun değil?"/>
        </label>
        <button
          type="button"
          onClick={() => run(declineCandidate(project, candidate.id, declineReason), 'DeclineTechnologyCandidate')}
        ><X size={14}/> Bu adayı reddet</button>
      </>
    ) : concern ? (
      <>
        <h3 className="pg-stage-subhead">{concern.questions[0] || concern.title}</h3>
        <p className="pg-stage-why">{concern.whyItMatters}</p>
        <label>
          Kararın
          <textarea value={answer} onChange={event => setAnswer(event.target.value)} rows={2}/>
        </label>
        {error && <p className="pg-stage-error" role="alert">{error}</p>}
        <div className="pg-stage-actions">
          <button
            type="button"
            className="pg-stage-primary"
            onClick={() => run(answerConcern(project, {
              concernId: concern.id, chosenOptionId: null, answer, rationale: '',
              revision: project.canonicalRevision + 1
            }), 'AnswerConcern')}
          ><Check size={15}/> Karara bağla</button>
          <button type="button" onClick={() => run(deferConcern(project, concern.id), 'DeferConcern')}>Sonraya bırak</button>
        </div>
      </>
    ) : (
      <>
        <p className="pg-stage-note">
          {project.solutionDesign.concerns.length
            ? 'Teknik konular karara bağlandı.'
            : 'Henüz teknik konu çıkarılmadı. Keşif turu çalıştırabilir ya da teknik karar gerekmediğine karar verip onaylayabilirsin.'}
        </p>
        <ul className="pg-stage-readiness">
          {readinessLines(readiness).map(line => <li key={line}>{line}</li>)}
        </ul>
        {error && <p className="pg-stage-error" role="alert">{error}</p>}
        <div className="pg-stage-actions">
          <button type="button" onClick={onDiscover} disabled={running}>
            {running ? <LoaderCircle className="spin" size={15}/> : <Sparkles size={15}/>} Teknik keşif çalıştır
          </button>
          <button
            type="button"
            className="pg-stage-primary"
            onClick={() => run(
              approveStage(project, 'solution', { revision: project.canonicalRevision + 1, at: new Date().toISOString() }),
              'ApproveSolutionDesign'
            )}
          ><Check size={15}/> Teknik tasarımı onayla</button>
        </div>
      </>
    )}
  </aside>;
}
