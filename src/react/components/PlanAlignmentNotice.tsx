import { AlertTriangle, GitCompare, RotateCcw, TimerReset } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import { createIdeaAlignmentImpactAnalysis } from '../../v4/application/change-impact-service.js';
import { restoreIdeaDocumentRevision } from '../../v4/application/idea-document-revision-service.js';
import { deferPlanAlignment } from '../../v4/domain/idea-plan-alignment.js';

export function PlanAlignmentNotice({ project, onCommit, onInspect }: {
  project: ProjectDocumentV5;
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void;
  onInspect: () => void;
}) {
  const alignment = project.planAlignment;
  if (!alignment || alignment.status === 'aligned') return null;

  const inspect = () => {
    const result = createIdeaAlignmentImpactAnalysis(project);
    onCommit(result.project, 'Fikir değişikliğinin canonical plan etkileri hazırlandı.', 'ProposeIdeaAlignmentImpact');
    onInspect();
  };
  const restore = () => {
    if (!alignment.sourceIdeaRevisionId) return;
    const result = restoreIdeaDocumentRevision(project, alignment.sourceIdeaRevisionId);
    if (result.success) {
      onCommit(result.project, 'Fikir belgesi canonical planın kaynak sürümüne geri alındı.', 'RestoreAlignedIdeaRevision');
    }
  };

  return <section className={`plan-alignment-notice ${alignment.status}`} role="alert" aria-labelledby="plan-alignment-title">
    <AlertTriangle size={20}/>
    <div>
      <span className="meta">{alignment.status === 'stale' ? 'PLAN GÜNCEL DEĞİL' : 'PLAN İNCELEME BEKLİYOR'}</span>
      <h2 id="plan-alignment-title">Fikir r{alignment.currentIdeaRevisionNumber}, planın kaynak r{alignment.sourceIdeaRevisionNumber} sürümünden farklı</h2>
      <p>{alignment.reason}</p>
      <small>Etkilenen bölümler: {alignment.affectedSections.join(', ')}</small>
    </div>
    <div className="change-impact-actions">
      <button type="button" className="primary" onClick={inspect}><GitCompare size={15}/> Etkiyi incele</button>
      <button type="button" onClick={() => onCommit(deferPlanAlignment(project), 'Plan hizalama incelemesi ertelendi.', 'DeferPlanAlignment')}><TimerReset size={15}/> Şimdilik ertele</button>
      <button type="button" disabled={!alignment.sourceIdeaRevisionId} onClick={restore}><RotateCcw size={15}/> Fikir değişikliğini geri al</button>
    </div>
  </section>;
}
