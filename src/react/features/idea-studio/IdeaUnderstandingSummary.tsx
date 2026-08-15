import { ShieldAlert } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../../v4/contracts.js';
import type { IdeaCoachState } from '../../../v4/application/idea-coach-service.js';

/**
 * Konuşmadan çıkarılan ortak anlayış. Alt Proje C'ye kadar Fikir panelinin
 * "Özet" sekmesindeydi; artık kendi aşamasında duruyor ve tek örneği var.
 */
export function IdeaUnderstandingSummary({ project, coach }: {
  project: ProjectDocumentV5;
  coach: IdeaCoachState;
}) {
  const conceptConfirmed = Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed);
  return <aside className="pg-idea-map" aria-label="Ortak anlayış">
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
        <p>{item.displayText}</p>
      </section>)}
    </div>
    <section className="pg-scope-snapshot">
      <div><span>Kritik karar</span><b>{coach.criticalDecisionCount}</b></div>
      <div><span>Ertelenebilir</span><b>{coach.deferrableDecisionCount}</b></div>
    </section>
    <p className="pg-map-note"><ShieldAlert size={15}/> Taslak alanlar henüz kesinleşmedi; fikir özetini onayladığında sabitlenir.</p>
  </aside>;
}
