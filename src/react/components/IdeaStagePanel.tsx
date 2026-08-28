import { useState } from 'react';
import { Check, CircleHelp, Clock, X } from 'lucide-react';
import { nextCoachTurn } from '../../v4/application/adaptive-idea-coach.js';
import { OUT_OF_SCOPE_PATTERN, splitClauses } from '../../v4/application/discovery-answer-service.js';
import { ideaApprovalReadiness, readinessLines } from '../../v4/application/idea-approval.js';
import { invalidationImpact } from '../../v4/application/invalidation-graph.js';
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

const ANSWER_EXCLUSION_HINT_ID = 'idea-answer-exclusion-hint';

/**
 * Kalan boşluk: kullanıcı karışık bir cümleyi TAMAMEN "Kararın" kutusuna
 * yazıp "neyi YAPMAYACAĞIZ" kutusunu boş bırakabilir — "SMS yok" o zaman
 * yine `must` gereksinimine dönüşür, ama bu sefer sessiz bir kuralla değil,
 * kullanıcının kendi görünür eylemiyle. Bu fonksiyon SADECE SEZER: hiçbir
 * çağıran onu taşımak, bölmek ya da temizlemek için kullanmaz — sınırı
 * kullanıcı hâlâ arayüzde kendi çiziyor.
 *
 * Kasıtlı olarak GENİŞ kalıbı (`OUT_OF_SCOPE_PATTERN`,
 * discovery-answer-service.ts) kullanıyoruz — `conversion-v2.ts`'teki dar
 * `EXPLICIT_EXCLUSION_PATTERN`i DEĞİL. Bu, bilinçli bir TERS orantı: dar
 * kalıp OTOMATİK ve gözden geçirilmeden `excluded` alanını dolduruyor, orada
 * yanlış pozitif SESSİZCE gerçek bir gereksinimi düşürür — o yüzden dar
 * kalması ZORUNLU. Burası tam tersi: bu, gözden geçirilebilir salt-öneri bir
 * yüzey — yanlış pozitifin bedeli kullanıcının bir bakışta atlayabileceği
 * görmezden gelinebilir bir ipucu, yanlış negatifin bedeli ise KUSURUN
 * SESSİZCE tekrar üretilmesi. Advisory yüzeyler hassas tarafa yaslanır, oto-
 * uygulanan yüzeyler tutucu tarafa. Bu ikisini "tek kalıpta birleştirmek"
 * (harmonise) tam bu asimetriyi kaybeder — YAPMA.
 */
export function answerLooksLikeExclusion(answer: string): boolean {
  return splitClauses(answer).some(clause => OUT_OF_SCOPE_PATTERN.test(clause.toLocaleLowerCase('tr-TR')));
}

export function IdeaStagePanel({ project, onCommand }: {
  project: ProjectDocumentV5;
  onCommand: (result: StageCommandResult, commandType: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [excludedText, setExcludedText] = useState('');
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
    setExcludedText('');
    setRationale('');
    setChosenOptionId(null);
    setReopenReason('');
    onCommand(result, commandType);
  };

  if (approved) {
    // Geri dönüşün bedeli ÖNCEDEN gösterilir. Kullanıcı neyin bayatlayacağını
    // bilmeden onayı geri alırsa, kaybını ancak sonradan fark eder.
    const cost = [...new Set(
      project.decisions
        .filter(decision => decision.stage === 'idea' && decision.status === 'accepted')
        .flatMap(decision => invalidationImpact(project, decision.id).lines)
    )];

    return <aside className="pg-stage-panel" aria-label="Fikir tasarımı">
      <h2>Fikir tasarımı onaylandı</h2>
      <p className="pg-stage-note">Artık bunu nasıl kuracağımızı konuşabiliriz.</p>
      {cost.length > 0 && <>
        <p className="pg-stage-note">Onayı geri alırsan etkilenecekler:</p>
        <ul className="pg-stage-readiness">{cost.map(line => <li key={line}>{line}</li>)}</ul>
      </>}
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
  // `turn.why` boş kalmaz — koç kendi varsayılan cümlesini koyar. Gerekçenin
  // zorunlu olup olmadığını belirleyen şey KONUNUN kendi `whyItMatters` alanı;
  // boşsa canonical karar için doldurulacak başka kaynak yok.
  const rationaleRequired = !project.ideaDesign.concerns
    .find(concern => concern.id === concernId)?.whyItMatters;

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
        aria-describedby={answerLooksLikeExclusion(answer) ? ANSWER_EXCLUSION_HINT_ID : undefined}
      />
    </label>
    {/* Non-blocking, salt-öneri ipucu — asla taşımaz/temizlemez/bölmez (bkz.
        `answerLooksLikeExclusion` üstteki yorum). `role="status"` örtük
        `aria-live="polite"` taşır; bu yüzden odağı ÇALMADAN, yazarken görünüp
        kaybolduğunda ekran okuyucuya duyurulur — projede aynı desen
        `pg-expansion-hint` (IdeaExpansionBoard.tsx) için de kullanılıyor. */}
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
        placeholder="Her satıra bir madde — örn. SMS bildirimi göndermeyeceğiz"
      />
    </label>
    {/* Gerekçe her zaman isteğe bağlı DEĞİL: canonical karar gerekçesiz
        kaydedilemez ve konunun kendi "neden önemli" metni yoksa doldurulacak
        başka bir kaynak yok. Bunu tıklamadan önce söylemek, kullanıcıyı
        reddedilecek bir forma göndermekten iyidir. */}
    <label>
      Neden böyle karar verdin? <small>{rationaleRequired ? '(bu konu için gerekli)' : '(isteğe bağlı)'}</small>
      <input
        type="text"
        value={rationale}
        onChange={event => setRationale(event.target.value)}
        required={rationaleRequired}
        placeholder={rationaleRequired ? 'Kısaca neden' : ''}
      />
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
            excluded: excludedText.split('\n').map(line => line.trim()).filter(Boolean),
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
