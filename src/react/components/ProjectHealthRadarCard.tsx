import { CheckCircle2, CircleAlert, Gauge, XCircle } from 'lucide-react';
import type { ProjectDocumentV5, ReadinessDimension } from '../../v4/contracts.js';

const DIMENSION_ORDER: ReadinessDimension[] = [
  'completeness',
  'consistency',
  'traceability',
  'riskCoverage',
  'implementationReadiness'
];

export function ProjectHealthRadarCard({
  project,
  onSection
}: {
  project: ProjectDocumentV5;
  onSection?: (sectionId: string) => void;
}) {
  const readiness = project.readiness;
  const actions = readiness.nextActions || [];

  return (
    <details className="readiness-breakdown">
      <summary>
        <span><Gauge size={14} /> READINESS 3.0</span>
        <b>{readiness.status === 'ready' ? 'Hazır' : readiness.status === 'needs_review' ? 'İnceleme gerekli' : 'Kapı kapalı'}</b>
      </summary>
      <p className="readiness-explanation">Skor kayıt sayısına değil; onay, tutarlılık, izlenebilir bağlantılar, risk sahipliği ve doğrulanabilir görevlere dayanır. Kalite kapısı kritik koşulların tamamını ayrıca denetler.</p>
      <div className={`readiness-gate ${readiness.qualityGate.passed ? 'passed' : 'blocked'}`} role="region" aria-label="Plan hazırlık kalite kapısı">
        <span>
          {readiness.qualityGate.passed ? <CheckCircle2 size={15}/> : <XCircle size={15}/>}
          <b>{readiness.qualityGate.passed ? 'Kalite kapısı açık' : 'Kalite kapısı kapalı'}</b>
        </span>
        <small>Plan sürümü r{readiness.calculatedAtRevision} · kanıt {readiness.evidenceHash}</small>
        <ul>
          {readiness.qualityGate.conditions.map(condition => (
            <li key={condition.id} className={condition.passed ? 'passed' : 'blocked'}>
              {condition.passed ? <CheckCircle2 size={12}/> : <CircleAlert size={12}/>}
              <span><b>{condition.label}</b>{!condition.passed && <small>{condition.message}</small>}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="readiness-dimensions">
        {DIMENSION_ORDER.map(dimension => {
          const value = readiness.dimensions[dimension];
          const evidence = readiness.dimensionEvidence[dimension];
          return (
            <div className="readiness-dimension" key={dimension}>
              <span>{readiness.dimensionLabels[dimension]} <small>%{readiness.dimensionWeights[dimension]}</small></span>
              <b>{value}</b>
              <progress max="100" value={value} aria-label={`${readiness.dimensionLabels[dimension]} ${value}/100`} />
              <small>{evidence.earned}/{evidence.possible} puan · {evidence.passed} geçti · {evidence.blocked} blok</small>
            </div>
          );
        })}
      </div>
      {actions.length > 0 && (
        <ul className="readiness-checks" aria-label="Önerilen sonraki hazırlık eylemleri">
          {actions.map(action => {
            const evidence = readiness.checks.find(item => item.id === action.checkId)?.evidence;
            const canOpen = Boolean(action.sectionId && onSection);
            const open = () => {
              if (action.sectionId) onSection?.(action.sectionId);
            };
            return (
            <li
              className={action.priority === 'critical' ? 'blocked' : 'warning'}
              key={action.checkId}
              role={canOpen ? 'button' : undefined}
              tabIndex={canOpen ? 0 : undefined}
              aria-label={canOpen ? `${action.label}: ilgili plan bölümünü aç` : undefined}
              onClick={canOpen ? open : undefined}
              onKeyDown={canOpen ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open();
                }
              } : undefined}
            >
              {action.priority === 'critical' ? <XCircle size={13} /> : <CircleAlert size={13} />}
              <span>
                <b>{action.label}</b>
                <small>{action.message}</small>
                <small>{evidence ? `${evidence.satisfied}/${evidence.total} kanıt tamamlandı · ` : ''}yaklaşık +{action.scoreImpact} puan{canOpen ? ' · bölümü aç' : ''}</small>
              </span>
            </li>
          )})}
          {readiness.checks.filter(item => item.status !== 'passed').length > actions.length && <li className="more"><CheckCircle2 size={13} /> Öncelik sırasına göre ilk {actions.length} eylem gösteriliyor</li>}
        </ul>
      )}
    </details>
  );
}
