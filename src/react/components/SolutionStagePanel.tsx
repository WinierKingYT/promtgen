import { useState } from 'react';
import { Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import { solutionApprovalReadiness } from '../../v4/application/solution-approval.js';
import { readinessLines } from '../../v4/application/stage-approval.js';
import { selectNextConcern } from '../../v4/application/concerns.js';
import { OUT_OF_SCOPE_PATTERN, splitClauses } from '../../v4/application/discovery-answer-service.js';
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

const ANSWER_EXCLUSION_HINT_ID = 'solution-answer-exclusion-hint';

/**
 * IdeaStagePanel.tsx'teki `answerLooksLikeExclusion` ile KASITLI olarak
 * birebir aynı mantık — iki panel bağımsız kalsın diye burada da tutuluyor
 * (bkz. oradaki yorum: GENİŞ `OUT_OF_SCOPE_PATTERN` neden dar
 * `EXPLICIT_EXCLUSION_PATTERN` DEĞİL). Bu fonksiyon SADECE SEZER; hiçbir
 * çağıran onu taşımak/bölmek/temizlemek için kullanmaz.
 */
export function answerLooksLikeExclusion(answer: string): boolean {
  return splitClauses(answer).some(clause => OUT_OF_SCOPE_PATTERN.test(clause.toLocaleLowerCase('tr-TR')));
}

export function SolutionStagePanel({ project, running, onCommand, onDiscover }: {
  project: ProjectDocumentV5;
  running: boolean;
  onCommand: (result: StageCommandResult, commandType: string) => void;
  onDiscover: () => void;
}) {
  const [statement, setStatement] = useState('');
  const [rationale, setRationale] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState('');
  const [excludedText, setExcludedText] = useState('');
  const [error, setError] = useState('');

  const readiness = solutionApprovalReadiness(project);
  const concern = selectNextConcern(project.solutionDesign.concerns);
  const approved = project.solutionDesign.approval.status === 'approved';

  // Adaylar konu konu değerlendirilir: aynı teknik konu için sunulmuş bütün
  // adaylar birlikte görünür. Tek tek gösterseydik kullanıcı neyi neye karşı
  // seçtiğini göremez, ADR de "değerlendirilen alternatifler" bölümünü boş
  // doldururdu.
  const proposed = project.solutionDesign.candidates.filter(item => item.status === 'proposed');
  const activeConcernId = proposed[0]?.concernId ?? null;
  const group = proposed.filter(item => item.concernId === activeConcernId);
  const chosen = group.find(item => item.id === chosenId) || null;
  const alternatives = chosenId ? group.filter(item => item.id !== chosenId) : [];

  const run = (result: StageCommandResult, commandType: string) => {
    setError(result.error || '');
    if (result.error) return;
    setStatement('');
    setRationale('');
    setChosenId(null);
    setReasons({});
    setAnswer('');
    setExcludedText('');
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

    {group.length > 0 ? (
      <>
        <p className="pg-stage-why">
          Bunlar <b>öneri</b>; sen onaylamadan hiçbiri seçilmiş sayılmaz.
        </p>
        <fieldset className="pg-stage-options">
          <legend>Adaylar</legend>
          {group.map(item => (
            <label key={item.id}>
              <input
                type="radio"
                name="candidate"
                value={item.id}
                checked={chosenId === item.id}
                onChange={() => { setChosenId(item.id); setStatement(item.title); }}
              />
              <span>
                <b>{item.title}</b>
                <small>{item.rationale}</small>
                {item.tradeoffs.length > 0 && <small>Bedeli: {item.tradeoffs.join(' · ')}</small>}
              </span>
            </label>
          ))}
        </fieldset>

        <label>
          Kararın
          <input type="text" value={statement} onChange={event => setStatement(event.target.value)}/>
        </label>
        <label>
          Neden bu? <small>(gerekçesiz karar kaydedilmez)</small>
          <input type="text" value={rationale} onChange={event => setRationale(event.target.value)}/>
        </label>

        {/* Bir ADR'yi ADR yapan şey budur: "PostgreSQL'i değerlendirdik" demek,
            neden seçilmediğini söylemeden bir karar kaydı oluşturmaz. */}
        {alternatives.map(item => (
          <label key={item.id}>
            “{item.title}” neden olmadı?
            <input
              type="text"
              value={reasons[item.id] || ''}
              onChange={event => setReasons({ ...reasons, [item.id]: event.target.value })}
            />
          </label>
        ))}

        {error && <p className="pg-stage-error" role="alert">{error}</p>}
        <div className="pg-stage-actions">
          <button
            type="button"
            className="pg-stage-primary"
            onClick={() => {
              if (!chosen) { setError('Önce hangi adayı seçtiğini işaretle.'); return; }
              run(acceptCandidate(project, {
                candidateId: chosen.id,
                statement: statement || chosen.title,
                rationale,
                rejectedAlternatives: alternatives.map(item => ({
                  candidateId: item.id,
                  title: item.title,
                  reason: reasons[item.id] || ''
                })),
                revision: project.canonicalRevision + 1
              }), 'AcceptTechnologyCandidate');
            }}
          ><Check size={15}/> Karar olarak kaydet</button>
          {group.length === 1 && (
            <button
              type="button"
              onClick={() => run(
                declineCandidate(project, group[0].id, reasons[group[0].id] || ''),
                'DeclineTechnologyCandidate'
              )}
            ><X size={14}/> Hiçbiri uygun değil</button>
          )}
        </div>
        {group.length === 1 && !chosenId && (
          <label>
            Reddetme nedeni
            <input
              type="text"
              value={reasons[group[0].id] || ''}
              onChange={event => setReasons({ ...reasons, [group[0].id]: event.target.value })}
              placeholder="Neden uygun değil?"
            />
          </label>
        )}
      </>
    ) : concern ? (
      <>
        <h3 className="pg-stage-subhead">{concern.questions[0] || concern.title}</h3>
        <p className="pg-stage-why">{concern.whyItMatters}</p>
        <label>
          Kararın
          <textarea
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            rows={2}
            aria-describedby={answerLooksLikeExclusion(answer) ? ANSWER_EXCLUSION_HINT_ID : undefined}
          />
        </label>
        {/* Non-blocking, salt-öneri ipucu — asla taşımaz/temizlemez/bölmez
            (bkz. `answerLooksLikeExclusion` üstteki yorum ve
            IdeaStagePanel.tsx'teki dar/geniş kalıp ayrımı). `role="status"`
            örtük `aria-live="polite"` taşır; odağı ÇALMADAN duyurulur — aynı
            desen `pg-expansion-hint` (IdeaExpansionBoard.tsx) için de
            kullanılıyor. */}
        {answerLooksLikeExclusion(answer) && (
          <p id={ANSWER_EXCLUSION_HINT_ID} className="pg-stage-hint" role="status">
            Bu cümle bir dışlama gibi görünüyor — aşağıdaki “neyi YAPMAYACAĞIZ” kutusuna taşımak ister misin?
          </p>
        )}
        {/* Sınırı kullanıcı burada, arayüzde, çizer; sistem `answer` metnini
            ayrıştırıp tahmin etmez (bkz. `stage-commands.ts` `AnswerConcernInput.
            excluded`). Alan isteğe bağlı — boş bırakmak da anlamlı bir cevaptır. */}
        <label>
          Bu kararla neyi YAPMAYACAĞIZ? <small>(isteğe bağlı)</small>
          <textarea
            value={excludedText}
            onChange={event => setExcludedText(event.target.value)}
            rows={2}
            placeholder="Her satıra bir madde"
          />
        </label>
        {error && <p className="pg-stage-error" role="alert">{error}</p>}
        <div className="pg-stage-actions">
          <button
            type="button"
            className="pg-stage-primary"
            onClick={() => run(answerConcern(project, {
              concernId: concern.id, chosenOptionId: null, answer,
              excluded: excludedText.split('\n').map(line => line.trim()).filter(Boolean),
              rationale: '',
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
