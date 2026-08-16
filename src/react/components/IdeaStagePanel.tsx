import { useState } from 'react';
import { Check, CircleHelp, Clock, X } from 'lucide-react';
import { nextCoachTurn } from '../../v4/application/adaptive-idea-coach.js';
import { ideaApprovalReadiness, readinessLines } from '../../v4/application/idea-approval.js';
import {
  answerConcern,
  approveStage,
  confirmFraming,
  deferConcern,
  dismissConcern,
  reopenApproval
} from '../../v4/application/stage-commands.js';
import type { ProjectDocumentV5, ProjectFraming } from '../../v4/contracts.js';
import type { StageCommandResult } from '../../v4/application/stage-commands.js';

/**
 * Fikir aşaması paneli — V3 motorunun kullanıcıyla buluştuğu yer.
 *
 * Altı adımda kurulan aşama modeli buraya kadar **erişilemezdi**: konu
 * cevaplama, erteleme, kapsam dışı bırakma ve onay verme hiçbir yerden
 * çağrılmıyordu. Bu panel o boşluğu kapatıyor.
 *
 * Bileşen karar vermez; her eylem `stage-commands` içindeki saf bir komuta
 * gider ve komut reddederse **nedeni gösterilir**. Sessiz başarısızlık,
 * kullanıcıya "kaydedildi" izlenimi verirdi.
 *
 * Ekranda iç model terimleri (konu haritası, sürüm numarası, izlenebilirlik
 * zinciri) geçmez; kullanıcı sistemi öğrenmek zorunda değil.
 */

const KIND_LABELS: Array<{ value: ProjectFraming['kind']; label: string }> = [
  { value: 'product', label: 'Yeni bir ürün' },
  { value: 'feature', label: 'Mevcut bir ürüne eklenecek parça' },
  { value: 'system', label: 'Bir sistem ya da alt sistem' }
];

export function IdeaStagePanel({ project, onCommand }: {
  project: ProjectDocumentV5;
  onCommand: (result: StageCommandResult, commandType: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [rationale, setRationale] = useState('');
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [framingKind, setFramingKind] = useState<ProjectFraming['kind']>('product');
  const [framingDomain, setFramingDomain] = useState('');
  const [framingEnvironment, setFramingEnvironment] = useState('');
  const [error, setError] = useState('');

  const turn = nextCoachTurn(project);
  const readiness = ideaApprovalReadiness(project);
  const approved = project.ideaDesign.approval.status === 'approved';

  const run = (result: StageCommandResult, commandType: string) => {
    setError(result.error || '');
    if (result.error) return;
    setAnswer('');
    setRationale('');
    setChosenOptionId(null);
    setReopenReason('');
    onCommand(result, commandType);
  };

  if (approved) {
    return <aside className="pg-stage-panel" aria-label="Fikir tasarımı">
      <h2>Fikir tasarımı onaylandı</h2>
      <p className="pg-stage-note">Artık bunu nasıl kuracağımızı konuşabiliriz.</p>
      <label>
        Onayı geri almak istersen nedenini yaz
        <input
          type="text"
          value={reopenReason}
          onChange={event => setReopenReason(event.target.value)}
          placeholder="Örn. aslında çok oyunculu olsun istiyorum"
        />
      </label>
      {error && <p className="pg-stage-error" role="alert">{error}</p>}
      <button
        type="button"
        className="pg-stage-secondary"
        onClick={() => run(reopenApproval(project, 'idea', reopenReason), 'ReopenIdeaApproval')}
      >Onayı geri al</button>
    </aside>;
  }

  if (turn.kind === 'framing') {
    return <aside className="pg-stage-panel" aria-label="Fikir tasarımı">
      <h2>Ne tasarlıyoruz?</h2>
      <p className="pg-stage-why">{turn.why}</p>
      <fieldset className="pg-stage-options">
        <legend>Bu proje ne?</legend>
        {KIND_LABELS.map(option => (
          <label key={option.value}>
            <input
              type="radio"
              name="framing-kind"
              value={option.value}
              checked={framingKind === option.value}
              onChange={() => setFramingKind(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label>
        Hangi alanda?
        <input type="text" value={framingDomain} onChange={event => setFramingDomain(event.target.value)} placeholder="Örn. oyun, e-ticaret, veri işleme"/>
      </label>
      <label>
        Nerede çalışacak?
        <input type="text" value={framingEnvironment} onChange={event => setFramingEnvironment(event.target.value)} placeholder="Örn. Unity, web tarayıcı, sunucu"/>
      </label>
      {error && <p className="pg-stage-error" role="alert">{error}</p>}
      <button
        type="button"
        className="pg-stage-primary"
        onClick={() => run(
          confirmFraming(project, { kind: framingKind, domain: framingDomain, environment: framingEnvironment }),
          'ConfirmProjectFraming'
        )}
      ><Check size={15}/> Devam et</button>
    </aside>;
  }

  if (turn.kind === 'ready') {
    return <aside className="pg-stage-panel" aria-label="Fikir tasarımı">
      <h2>Fikir tasarımı yeterince net</h2>
      <p className="pg-stage-why">{turn.why}</p>
      <ul className="pg-stage-readiness">
        {readinessLines(readiness).map(line => <li key={line}>{line}</li>)}
      </ul>
      {error && <p className="pg-stage-error" role="alert">{error}</p>}
      <button
        type="button"
        className="pg-stage-primary"
        onClick={() => run(
          approveStage(project, 'idea', { revision: project.canonicalRevision + 1, at: new Date().toISOString() }),
          'ApproveIdeaDesign'
        )}
      ><Check size={15}/> Fikir tasarımını onayla</button>
    </aside>;
  }

  const concernId = turn.concernId || '';

  return <aside className="pg-stage-panel" aria-label="Fikir tasarımı">
    <h2>{turn.question}</h2>
    <p className="pg-stage-why"><CircleHelp size={14} aria-hidden="true"/> {turn.why}</p>

    {turn.options.length > 0 && (
      <fieldset className="pg-stage-options">
        <legend>Seçenekler</legend>
        {turn.options.map(option => (
          <label key={option.id}>
            <input
              type="radio"
              name="concern-option"
              value={option.id}
              checked={chosenOptionId === option.id}
              onChange={() => { setChosenOptionId(option.id); setAnswer(option.title); }}
            />
            <span>
              <b>{option.title}</b>
              {/* Bedeli olmayan seçenek karşılaştırılamaz; varsa gösterilir. */}
              {option.tradeoffs.length > 0 && <small>Bedeli: {option.tradeoffs.join(' · ')}</small>}
            </span>
          </label>
        ))}
      </fieldset>
    )}

    <label>
      Kararın
      <textarea
        value={answer}
        onChange={event => { setAnswer(event.target.value); setChosenOptionId(null); }}
        rows={2}
        placeholder="Kendi cümlenle yazabilirsin"
      />
    </label>
    <label>
      Neden böyle karar verdin? <small>(isteğe bağlı)</small>
      <input type="text" value={rationale} onChange={event => setRationale(event.target.value)}/>
    </label>

    {error && <p className="pg-stage-error" role="alert">{error}</p>}

    <div className="pg-stage-actions">
      <button
        type="button"
        className="pg-stage-primary"
        onClick={() => run(
          answerConcern(project, {
            concernId,
            chosenOptionId,
            answer,
            rationale,
            revision: project.canonicalRevision + 1
          }),
          'AnswerConcern'
        )}
      ><Check size={15}/> Karara bağla</button>
      <button type="button" onClick={() => run(deferConcern(project, concernId), 'DeferConcern')}>
        <Clock size={14}/> Sonraya bırak
      </button>
      <button type="button" onClick={() => run(dismissConcern(project, concernId), 'DismissConcern')}>
        <X size={14}/> Bu projeye ait değil
      </button>
    </div>
  </aside>;
}
