import { useState } from 'react';
import { Check, Clock3, Pencil, ShieldCheck, X } from 'lucide-react';
import type {
  DiscoveryAnswerDraft,
  DiscoveryAnswerPatch,
  DiscoveryAnswerPatchStatus,
  DiscoveryAnswerPatchValue
} from '../../v4/application/discovery-answer-service.js';

function display(value: DiscoveryAnswerPatchValue) {
  return Array.isArray(value) ? value.join('\n') : value;
}

function editedValue(patch: DiscoveryAnswerPatch, raw: string): DiscoveryAnswerPatchValue {
  return Array.isArray(patch.proposedValue)
    ? raw.split('\n').map(item => item.trim()).filter(Boolean)
    : raw.trim();
}

export function DiscoveryAnswerReview({
  draft,
  onChange,
  onApply,
  onDiscard
}: {
  draft: DiscoveryAnswerDraft;
  onChange: (draft: DiscoveryAnswerDraft) => void;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const setStatus = (patch: DiscoveryAnswerPatch, status: DiscoveryAnswerPatchStatus) => {
    onChange({
      ...draft,
      patches: draft.patches.map(item => item.id === patch.id
        ? {
            ...item,
            status,
            editedValue: status === 'edited'
              ? editedValue(item, editing[item.id] ?? display(item.proposedValue))
              : undefined
          }
        : item)
    });
  };
  const selected = draft.patches.filter(patch => patch.status === 'accepted' || patch.status === 'edited').length;
  const qualityLabel = draft.assessment.quality === 'actionable'
    ? 'İşlenebilir yanıt'
    : draft.assessment.quality === 'conflicting'
      ? 'Çelişkili yanıt'
      : 'Belirsiz yanıt';

  return <section className="discovery-answer-review" aria-labelledby="discovery-answer-review-title">
    <div className="answer-review-head">
      <div>
        <span className="meta">YAPISAL ALAN ÖNERİSİ · OTOMATİK UYGULANMAZ</span>
        <h3 id="discovery-answer-review-title"><ShieldCheck size={17}/> Yanıtından çıkarılan değişiklikleri incele</h3>
      </div>
      <div className="answer-review-badges">
        <span className={`answer-quality ${draft.assessment.quality}`}>{qualityLabel}</span>
        <span className="answer-source">{draft.provenance.label}</span>
      </div>
    </div>
    <p className="answer-source-question"><b>Soru:</b> {draft.sourceQuestion}</p>
    {draft.assessment.warnings.length > 0 && <div className="answer-assessment-warnings" role="alert">
      {draft.assessment.warnings.map(warning => <p key={warning}>{warning}</p>)}
    </div>}
    {draft.patches.length === 0 && <p className="answer-empty">
      Plan alanı bulunamadı. Soru açık kaldı; alan adıyla netleştir.
    </p>}
    <div className="answer-patch-list">
      {draft.patches.map(patch => {
        const proposed = display(patch.proposedValue);
        const isEditing = patch.status === 'edited';
        return <article className={`answer-patch ${patch.status}`} key={patch.id}>
          <div className="answer-patch-title">
            <b>{patch.label}</b>
            <span>%{patch.confidence} eşleme güveni</span>
          </div>
          <small>{patch.rationale}</small>
          <ul className="answer-evidence">
            {patch.evidence.map(item => <li key={item}>{item}</li>)}
          </ul>
          <div className="answer-value-comparison">
            <div><span>Mevcut</span><pre>{display(patch.currentValue) || '—'}</pre></div>
            <div><span>Önerilen</span>{isEditing
              ? <textarea
                  aria-label={`${patch.label} düzenlenen değer`}
                  value={editing[patch.id] ?? proposed}
                  onChange={event => {
                    const raw = event.target.value;
                    setEditing(current => ({ ...current, [patch.id]: raw }));
                    onChange({
                      ...draft,
                      patches: draft.patches.map(item => item.id === patch.id
                        ? { ...item, editedValue: editedValue(item, raw) }
                        : item)
                    });
                  }}
                />
              : <pre>{proposed || '—'}</pre>}
            </div>
          </div>
          <div className="answer-patch-actions" role="group" aria-label={`${patch.label} kararı`}>
            <button type="button" className={patch.status === 'accepted' ? 'active accept' : ''} onClick={() => setStatus(patch, 'accepted')}><Check size={13}/> Kabul</button>
            <button type="button" className={isEditing ? 'active edit' : ''} onClick={() => setStatus(patch, 'edited')}><Pencil size={13}/> Düzenle</button>
            <button type="button" className={patch.status === 'deferred' ? 'active defer' : ''} onClick={() => setStatus(patch, 'deferred')}><Clock3 size={13}/> Ertele</button>
            <button type="button" className={patch.status === 'rejected' ? 'active reject' : ''} onClick={() => setStatus(patch, 'rejected')}><X size={13}/> Reddet</button>
          </div>
        </article>;
      })}
    </div>
    <div className="answer-review-footer">
      <button type="button" className="ghost" onClick={onDiscard}>Taslağı kapat</button>
      <button type="button" className="primary" disabled={selected === 0} onClick={onApply}>{selected} alanı sistem yorumuna uygula</button>
    </div>
  </section>;
}
