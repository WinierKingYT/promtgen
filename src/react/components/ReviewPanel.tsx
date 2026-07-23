import { useState } from 'react';
import { CheckCircle2, CircleAlert, FlaskConical, ScanSearch } from 'lucide-react';
import { applyReviewResult, runPlanReview, simulatePlan } from '../../v4/review-engine.js';

export function ReviewPanel({ project, onCommit }: { project: any; onCommit: (project: any, message: string) => void }) {
  const [running, setRunning] = useState(false);
  const lastReview = project.metadata?.lastReview;
  const latestRuns = project.simulationRuns.slice(-4);
  const run = () => {
    setRunning(true);
    try {
      const review = runPlanReview(project, { profile: 'deep' });
      const result = applyReviewResult(project, review, simulatePlan(project));
      if (result.success) onCommit(result.project, `Plan incelemesi tamamlandı: ${review.score}/100.`);
    } finally { setRunning(false); }
  };
  return <details className="review-panel" open={Boolean(project.reviewFindings.length && project.reviewFindings.some((item: any) => ['critical', 'high'].includes(item.severity)))}>
    <summary><ScanSearch size={16}/><span>Deterministic plan incelemesi<small>{lastReview ? `${lastReview.score}/100 · r${lastReview.revision}` : 'Henüz çalıştırılmadı'}</small></span></summary>
    <div className="review-body">
      <p>Canonical planı eksik, çelişki, izlenebilirlik, risk ve uygulanabilirlik kurallarıyla inceler; dört teslim senaryosunu simüle eder.</p>
      <button type="button" onClick={run} disabled={running}><ScanSearch size={15}/> {running ? 'İnceleniyor…' : 'Planı yeniden incele'}</button>
      {project.reviewFindings.length > 0 && <section aria-label="Plan inceleme bulguları">{project.reviewFindings.slice(0, 8).map((finding: any) => <article key={finding.id} className={`finding severity-${finding.severity}`}>{['critical', 'high'].includes(finding.severity) ? <CircleAlert size={14}/> : <CheckCircle2 size={14}/>}<span><b>{finding.title}</b><small>{finding.severity} · {finding.ruleId}</small><p>{finding.recommendation}</p></span></article>)}</section>}
      {latestRuns.length > 0 && <div className="simulation-grid" aria-label="Plan simülasyonları">{latestRuns.map((simulation: any) => <div key={simulation.id} className={simulation.status}><FlaskConical size={14}/><span><b>{simulation.title}</b><small>{simulation.summary} · {simulation.status}</small></span></div>)}</div>}
    </div>
  </details>;
}
