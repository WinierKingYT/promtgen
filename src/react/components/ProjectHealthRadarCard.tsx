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
        <span><Gauge size={14} /> READINESS 2.1</span>
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
