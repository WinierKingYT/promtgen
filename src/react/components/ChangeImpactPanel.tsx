import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, GitBranch, ShieldAlert, X } from 'lucide-react'
import {
  applyChangeImpact,
  rejectChangeImpact
} from '../../v4/application/change-impact-service.js'
import type { ImpactAnalysis, ProjectDocumentV5 } from '../../v4/contracts.js'

interface ChangeImpactPanelProps {
  project: ProjectDocumentV5
  onCommit: (project: ProjectDocumentV5, message?: string, commandType?: string) => void
}

const EFFECT_LABELS: Record<string, string> = {
  invalidate: 'Geçersiz kalabilir',
  stale: 'Yeniden doğrulanmalı',
  regenerate: 'Yeniden üretilmeli',
  review: 'İncelenmeli',
  no_action: 'İşlem gerekmiyor'
}

export function ChangeImpactPanel({ project, onCommit }: ChangeImpactPanelProps) {
  const [error, setError] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, 'supersede' | 'keep'>>({})
  const proposed = (project.impactAnalyses || []).filter(impact => impact.status === 'proposed')
  if (!proposed.length) return null

  const resolve = (impact: ImpactAnalysis, decisionId: string, resolution: 'supersede' | 'keep') => {
    setError('')
    setResolutions(current => ({ ...current, [`${impact.id}:${decisionId}`]: resolution }))
  }

  const apply = (impact: ImpactAnalysis) => {
    setError('')
    const selected = Object.fromEntries(
      impact.contradictionDetails
        .map(detail => [detail.decisionId, resolutions[`${impact.id}:${detail.decisionId}`] || detail.resolution])
        .filter((entry): entry is [string, 'supersede' | 'keep'] => Boolean(entry[1]))
    )
    const result = applyChangeImpact(project, impact.id, selected)
    if (!result.success) {
      setError(result.reason)
      if (result.project !== project) onCommit(result.project, result.reason, 'MarkImpactStale')
      return
    }
    onCommit(
      result.project,
      `Değişiklik canonical plana uygulandı; r${result.project.revision} oluşturuldu.`,
      'ApplyChangeImpact'
    )
  }

  return (
    <div className="change-impact-stack">
      {proposed.map(impact => {
        const unresolved = impact.contradictionDetails.filter(detail => !resolutions[`${impact.id}:${detail.decisionId}`] && !detail.resolution).length
        return (
          <section className="change-impact-card" key={impact.id} aria-labelledby={`${impact.id}-title`}>
            <header className="change-impact-header">
              <div className="change-impact-icon"><GitBranch size={19} /></div>
              <div>
                <span className="meta">CANONICAL DEĞİŞİKLİK ÖNİZLEMESİ</span>
                <h3 id={`${impact.id}-title`}>{impact.userRequest}</h3>
                <p>r{impact.baseRevision} → r{impact.preview.nextRevision} · Henüz plana uygulanmadı</p>
              </div>
            </header>

            <p className="change-impact-summary">{impact.summary}</p>

            <div className="change-impact-metrics" aria-label="Önerilen canonical kayıtlar">
              <span><b>+{impact.preview.requirementCount}</b> gereksinim</span>
              <span><b>+{impact.preview.taskCount}</b> görev</span>
              <span><b>+{impact.preview.testCount}</b> test</span>
              <span><b>+{impact.preview.riskCount}</b> risk</span>
              <span><b>+{impact.preview.traceLinkCount}</b> bağlantı</span>
            </div>

            <div className="change-impact-grid">
              <div>
                <h4>Etkilenen plan bölümleri</h4>
                <div className="change-impact-tags">
                  {impact.affectedSections.map(section => <span key={section}>{section}</span>)}
                </div>
                <p>{impact.architectureImpact}</p>
              </div>
              <div>
                <h4>İzlenebilir entity etkileri</h4>
                {impact.entityEffects.length ? (
                  <ul className="entity-effect-list">
                    {impact.entityEffects.slice(0, 8).map(effect => (
                      <li key={`${effect.sourceEntityId}-${effect.targetEntityId}`}>
                        <span className={`severity-dot ${effect.severity}`} aria-hidden="true" />
                        <span>
                          <b>{effect.targetLabel}</b>
                          <small>{EFFECT_LABELS[effect.effect] || effect.effect} · {effect.targetType}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : <p>Doğrudan bağlı canonical entity bulunamadı; yeni izlenebilir zincir oluşturulacak.</p>}
              </div>
            </div>

            {impact.contradictionDetails.length > 0 && (
              <div className="impact-conflicts">
                <h4><AlertTriangle size={16} /> Karar çelişkileri</h4>
                <p>Plan uygulanmadan önce her eski karar için bilinçli bir çözüm seç.</p>
                {impact.contradictionDetails.map(detail => (
                  <fieldset key={detail.decisionId}>
                    <legend>{detail.decisionTitle}</legend>
                    <p>{detail.decisionText}</p>
                    <label>
                      <input
                        type="radio"
                        name={`${impact.id}-${detail.decisionId}`}
                        checked={(resolutions[`${impact.id}:${detail.decisionId}`] || detail.resolution) === 'supersede'}
                        onChange={() => resolve(impact, detail.decisionId, 'supersede')}
                      />
                      Eski kararı geçersiz kıl ve yenisiyle değiştir
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`${impact.id}-${detail.decisionId}`}
                        checked={(resolutions[`${impact.id}:${detail.decisionId}`] || detail.resolution) === 'keep'}
                        onChange={() => resolve(impact, detail.decisionId, 'keep')}
                      />
                      Eski kararı koru; yeni isteği sınırlı uygula
                    </label>
                  </fieldset>
                ))}
              </div>
            )}

            {error && <div className="impact-error" role="alert"><ShieldAlert size={16} /> {error}</div>}

            <footer className="change-impact-actions">
              <button
                type="button"
                className="secondary danger"
                onClick={() => onCommit(rejectChangeImpact(project, impact.id), 'Değişiklik önerisi reddedildi; geçmiş kaydı korundu.', 'RejectChangeImpact')}
              >
                <X size={16} /> Reddet
              </button>
              <button type="button" className="primary" disabled={unresolved > 0} onClick={() => apply(impact)}>
                <Check size={16} />
                {unresolved ? `${unresolved} çelişki çözülmeli` : `Onayla ve r${impact.preview.nextRevision} oluştur`}
                <ArrowRight size={16} />
              </button>
            </footer>
          </section>
        )
      })}
    </div>
  )
}
