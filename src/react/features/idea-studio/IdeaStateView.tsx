import { Fragment } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { ProjectDocumentV5 } from '../../../v4/contracts.js';
import { buildIdeaStateView, type IdeaFoundationDisplayField, type IdeaStateFoundationFieldView } from '../../../v4/application/idea-state-view.js';

const FOUNDATION_FIELD_ORDER: readonly IdeaFoundationDisplayField[] = ['summary', 'problemStatement', 'targetUser', 'desiredOutcome', 'mvpTarget'];

const FOUNDATION_FIELD_LABELS: Record<IdeaFoundationDisplayField, string> = {
  summary: 'Özet',
  problemStatement: 'Problem',
  targetUser: 'Kullanıcı',
  desiredOutcome: 'Beklenen sonuç',
  mvpTarget: 'Hedeflenen kapsam'
};

/**
 * `idea` ve `unspecified` bilerek rozetsiz kalır: etiketlenmesi gereken tek
 * şey UYDURULAN ya da GÜVENSİZ olduğu için düştüğü bilinen kısımdır --
 * fikirden gelen (veya bu bilginin hiç üretilmediği eski) bir alanı ayrıca
 * işaretlemek "labeled assumptions are a feature, unlabeled ones are a
 * defect" ilkesini tersine çevirirdi.
 */
const FOUNDATION_SOURCE_BADGE: Partial<Record<IdeaStateFoundationFieldView['source'], string>> = {
  assumption: 'Varsayım · fikirde yok',
  fallback: 'Yedek değer · doğrulanamadı'
};

/**
 * Fikrin GÜNCEL HALİ — `buildIdeaStateView`in SAF sonucunu render eder.
 *
 * Bu bileşen kendi başına hiçbir şey SAKLAMAZ: state yok, effect yok, ağ
 * çağrısı yok. `project` her değiştiğinde (kullanıcı bir soruyu cevapladığında,
 * bir kart eklediğinde/kabul ettiğinde) React onu yeniden render eder ve
 * görünüm senkron olarak güncellenir — bkz. `idea-state-view.ts` dosya başı
 * yorumu.
 *
 * Kök `<section>` artık `aria-label` TAŞIMAZ: bu görünüm kendi sütununda
 * duruyor ve o sütun `<aside aria-label="Fikrin güncel hali">` olarak zaten
 * bir landmark. İkisi de adlandırılsaydı ekran okuyucu aynı adı taşıyan
 * iç içe iki bölge duyururdu. Başlık (`FİKRİN GÜNCEL HALİ` + `<h2>`) yerinde.
 */
export function IdeaStateView({ project }: { project: ProjectDocumentV5 }) {
  const view = buildIdeaStateView(project);

  if (view.isEmpty) {
    return <section className="pg-idea-state">
      <header className="pg-idea-state-head">
        <span>FİKRİN GÜNCEL HALİ</span>
        <h2>Henüz bir şey yok</h2>
      </header>
      <p className="pg-idea-state-empty">Konuştukça, kart ekledikçe ve karar verdikçe fikrin güncel hali burada birikecek.</p>
    </section>;
  }

  return <section className="pg-idea-state">
    <header className="pg-idea-state-head">
      <span>FİKRİN GÜNCEL HALİ</span>
      <h2>Şu an elimizdeki fikir</h2>
    </header>

    <section aria-labelledby="pg-idea-state-foundation-heading" className="pg-idea-state-section">
      <h3 id="pg-idea-state-foundation-heading">Temel</h3>
      {view.foundation.isUnreviewedDraft && (
        <p className="pg-idea-state-draft-note" role="status">
          <TriangleAlert size={12} aria-hidden="true"/> Bu, henüz gözden geçirilmemiş bir taslak — düzeltebilirsin.
        </p>
      )}
      {view.foundation.hasContent ? (
        <dl className="pg-idea-state-foundation">
          {FOUNDATION_FIELD_ORDER.map(field => {
            const info = view.foundation.fields[field];
            // Metin de yoksa (unknown DEĞİL) ve gerekçe de yoksa bu alan hakkında
            // hiçbir şey bilinmiyor -- satır tamamen atlanır, boş satır gösterilmez.
            if (!info.text && !info.reason) return null;
            const badge = FOUNDATION_SOURCE_BADGE[info.source];
            return <Fragment key={field}>
              <dt>{FOUNDATION_FIELD_LABELS[field]}{badge && <small className="pg-idea-state-field-badge"> · {badge}</small>}</dt>
              <dd>{info.text || <em className="pg-idea-state-unknown-reason">{info.reason} <small>(fikirde belirtilmemiş)</small></em>}</dd>
            </Fragment>;
          })}
        </dl>
      ) : <p className="pg-idea-state-empty">Temel özet henüz oluşmadı.</p>}
    </section>

    <section aria-labelledby="pg-idea-state-cards-heading" className="pg-idea-state-section">
      <h3 id="pg-idea-state-cards-heading">Kabul edilenler</h3>
      {view.acceptedCards.length > 0 ? (
        <ul className="pg-idea-state-cards">
          {view.acceptedCards.map(card => <li key={card.id}>
            <b>{card.title}</b>{card.status === 'edited' && <small> · düzenlenerek kabul edildi</small>}
            {card.description && <p>{card.description}</p>}
          </li>)}
        </ul>
      ) : <p className="pg-idea-state-empty">Henüz kabul edilmiş bir kart yok.</p>}
    </section>

    {/* Kullanıcı "Fikre ekle"ye bastığı an bir yere düşmeli — kabul edilmiş
        gibi DEĞİL, ama sessizce de yutulmadan. Ayrı bir başlık ve ayrı bir
        madde işaretiyle (rozet değil, kendi satırı) kabul edilenlerle asla
        karışmaz. */}
    <section aria-labelledby="pg-idea-state-pending-heading" className="pg-idea-state-section is-pending">
      <h3 id="pg-idea-state-pending-heading">Karar bekleyenler</h3>
      {view.pendingCards.length > 0 ? (
        <ul className="pg-idea-state-cards is-pending">
          {view.pendingCards.map(card => <li key={card.id}>
            <div className="pg-idea-state-pending-head">
              <b>{card.title}</b>
              <small className="pg-idea-state-pending-marker">{card.status === 'deferred' ? 'Ertelendi' : 'Karar bekliyor'}</small>
            </div>
            {card.description && <p>{card.description}</p>}
          </li>)}
        </ul>
      ) : <p className="pg-idea-state-empty">Karar bekleyen bir kart yok.</p>}
    </section>

    <section aria-labelledby="pg-idea-state-included-heading" className="pg-idea-state-section is-included">
      <h3 id="pg-idea-state-included-heading">Yapılacaklar</h3>
      {view.included.length > 0 ? (
        <ul className="pg-idea-state-decisions">
          {view.included.map(item => <li key={item.id}>
            {item.concernTitle && <small>{item.concernTitle}</small>}
            <p>{item.text}</p>
          </li>)}
        </ul>
      ) : <p className="pg-idea-state-empty">Henüz karara bağlanmış bir yön yok.</p>}
    </section>

    <section aria-labelledby="pg-idea-state-excluded-heading" className="pg-idea-state-section is-excluded">
      <h3 id="pg-idea-state-excluded-heading">Yapılmayacaklar</h3>
      {view.excluded.length > 0 ? (
        <ul className="pg-idea-state-decisions">
          {view.excluded.map(item => <li key={item.id}>
            {item.concernTitle && <small>{item.concernTitle}</small>}
            <p>{item.text}</p>
          </li>)}
        </ul>
      ) : <p className="pg-idea-state-empty">Kapsam dışı bırakılmış bir madde yok.</p>}
    </section>
  </section>;
}
