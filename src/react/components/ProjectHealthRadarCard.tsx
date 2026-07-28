import { CheckCircle2, CircleAlert, Gauge, XCircle } from 'lucide-react';
import type { ProjectDocumentV5, ReadinessDimension } from '../../v4/contracts.js';

const DIMENSION_ORDER: ReadinessDimension[] = [
  'completeness',
  'consistency',
  'traceability',
  'riskCoverage',
  'implementationReadiness'
];

export function ProjectHealthRadarCard({ project }: { project: ProjectDocumentV5 }) {
  const readiness = project.readiness;
  const unresolved = readiness.checks.filter(item => item.status !== 'passed');

  return (
    <details className="readiness-breakdown">
      <summary>
        <span><Gauge size={14} /> READINESS 2.0</span>
        <b>{readiness.status === 'ready' ? 'Hazır' : readiness.status === 'needs_review' ? 'İnceleme gerekli' : 'Kapı kapalı'}</b>
      </summary>
      <p className="readiness-explanation">Skor kayıt sayısına değil; onay, tutarlılık, izlenebilir bağlantılar, risk sahipliği ve doğrulanabilir görevlere dayanır.</p>
      <div className="readiness-dimensions">
        {DIMENSION_ORDER.map(dimension => {
          const value = readiness.dimensions[dimension];
          return (
            <div className="readiness-dimension" key={dimension}>
              <span>{readiness.dimensionLabels[dimension]} <small>%{readiness.dimensionWeights[dimension]}</small></span>
              <b>{value}</b>
              <progress max="100" value={value} aria-label={`${readiness.dimensionLabels[dimension]} ${value}/100`} />
            </div>
          );
        })}
      </div>
      {unresolved.length > 0 && (
        <ul className="readiness-checks">
          {unresolved.slice(0, 6).map(item => (
            <li className={item.status} key={item.id}>
              {item.status === 'blocked' ? <XCircle size={13} /> : <CircleAlert size={13} />}
              <span><b>{item.label}</b><small>{item.message}</small></span>
            </li>
          ))}
          {unresolved.length > 6 && <li className="more"><CheckCircle2 size={13} /> +{unresolved.length - 6} ek kontrol</li>}
        </ul>
      )}
    </details>
  );
}
