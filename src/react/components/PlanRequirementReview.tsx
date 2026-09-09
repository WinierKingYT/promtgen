import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  acceptRequirementDraft,
  removeRequirementDraft,
  updateRequirementDraft
} from '../../v4/application/requirement-quality-service.js';
import {
  REQUIREMENT_PRIORITY_LABELS,
  selectPlanRequirementReview,
  type PlanRequirementCard
} from '../../v4/application/plan-requirement-review.js';
import type { Priority, ProjectDocumentV5 } from '../../v4/contracts.js';

type Commit = (project: ProjectDocumentV5, message?: string, commandType?: string) => Promise<void> | void;

/**
 * Plan aşamasının "Gereksinimler" bölümündeki karar yüzeyi.
 *
 * ÖLÇÜLEN BOŞLUK. Dönüşüm taslak gereksinim üretiyordu, `compileTaskPlan` ve
 * finalizasyon kapısı yalnız `status === 'accepted'` okuyordu ve taslağı
 * kabul edebilecek üç fonksiyonun (`acceptRequirementDraft`,
 * `updateRequirementDraft`, `removeRequirementDraft`) üretimde SIFIR çağıranı
 * vardı. Kullanıcı ne yazarsa yazsın planı finalleştiremiyordu. Bu bileşen o
 * üç fonksiyonu ekrana bağlar; DÖRDÜNCÜ bir kabul yolu açmaz.
 *
 * SERBEST METİN KUTUSU KALDI, AMA İKİNCİ SIRADA. Bölümün altındaki metin
 * alanı silinmedi: `requirements`, `standard` ve üstü derinliklerde GEREKLİ
 * bir bölümdür ve silmek onu "boş gerekli bölüm" durumuna düşürüp kapıyı
 * yeniden kapatabilirdi. Silmeye gerek de yok — `acceptRequirementDraft`
 * kabul edilen ifadeyi `sections.requirements.items` içine yazıyor
 * (ölçüldü: kabul sonrası "Gereksinimler" boş-bölüm engelinden düşüyor), yani
 * kutu boş kalsa bile bölüm doluyor. Kutu artık bir NOT alanıdır ve bu panel
 * bunu açıkça söyler.
 *
 * GÖRSEL DİL BİLEREK PAYLAŞILIYOR. Kart kabul yüzeyleri Fikir, Ortak Anlayış
 * ve Plan'da tek bir dil konuşmalı; bu yüzden `IdeaExpansionBoard`'ın karar
 * listesiyle AYNI sınıflar kullanılıyor (`pg-expansion-decisions` ve
 * altındakiler). Yeni bir sınıf ailesi üçüncü bir stil doğururdu.
 */

interface EditDraft {
  title: string;
  statement: string;
  priority: Priority;
  acceptanceCriteria: string;
}

function toEditDraft(card: PlanRequirementCard): EditDraft {
  return {
    title: card.title,
    statement: card.statement,
    priority: card.priority,
    acceptanceCriteria: card.acceptanceCriteria.join('\n')
  };
}

export function PlanRequirementReview({ project, onCommit, onNotice }: {
  project: ProjectDocumentV5;
  onCommit: Commit;
  onNotice: (message: string) => void;
}) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const review = selectPlanRequirementReview(project);

  const closeEditor = () => { setEditingId(''); setDraft(null); };

  const openEditor = (card: PlanRequirementCard) => {
    if (editingId === card.id) { closeEditor(); return; }
    setEditingId(card.id);
    setDraft(toEditDraft(card));
  };

  // Geçerlilik kuralı BURADA TEKRARLANMIYOR: `acceptRequirementDraft` eksik
  // başlık/ifade/kabul kriteri durumunda kendi gerekçesiyle atıyor ve o
  // gerekçe kullanıcıya olduğu gibi gösteriliyor. İkinci bir kopya, kural
  // değiştiğinde sessizce yalan söylerdi.
  const accept = (card: PlanRequirementCard) => {
    try {
      onCommit(
        acceptRequirementDraft(project, card.id),
        `"${card.title}" gereksinimi kabul edildi.`,
        'AcceptRequirementDraft'
      );
      closeEditor();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const reject = (card: PlanRequirementCard) => {
    try {
      onCommit(
        removeRequirementDraft(project, card.id),
        `"${card.title}" gereksinimi listeden çıkarıldı.`,
        'RemoveRequirementDraft'
      );
      closeEditor();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const saveDraft = (card: PlanRequirementCard) => {
    if (!draft) return;
    try {
      onCommit(
        updateRequirementDraft(project, card.id, {
          title: draft.title,
          statement: draft.statement,
          priority: draft.priority,
          acceptanceCriteria: draft.acceptanceCriteria.split('\n')
        }),
        `"${draft.title || card.title}" taslağı güncellendi.`,
        'UpdateRequirementDraft'
      );
      closeEditor();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return <section className="pg-expansion-decisions pg-requirement-review" aria-label="Gereksinim kartları">
    <header>
      <div>
        <b>Gereksinimler</b>
        <small>
          Görev taslakları yalnız KABUL ETTİĞİN gereksinimlerden üretilir;
          aşağıdaki serbest metin kutusu bir not alanıdır.
        </small>
      </div>
      <span className="pg-requirement-review-count">
        {review.acceptedCount} kabul · {review.draftCount} bekliyor
      </span>
    </header>

    <p className="pg-expansion-hint" role="status">{review.hint}</p>

    {review.cards.length > 0 && <ul>
      {review.cards.map(card => <li key={card.id} className={`is-${card.status}`}>
        <div className="pg-expansion-decision-head">
          <b>{card.title}</b>
          <small>{card.statusLabel}</small>
        </div>
        <p>{card.statement}</p>
        <small className="pg-expansion-decision-origin">
          {card.priorityLabel}
          {card.acceptanceCriteria.length > 0 && ` · ${card.acceptanceCriteria.length} kabul kriteri`}
        </small>
        {card.acceptanceCriteria.length > 0 && <ul className="pg-requirement-review-criteria">
          {card.acceptanceCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}
        </ul>}

        {editingId === card.id && draft && <div className="pg-requirement-review-editor">
          <label>Başlık
            <input
              type="text"
              value={draft.title}
              onChange={event => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label>Gereksinim ifadesi
            <textarea
              rows={2}
              value={draft.statement}
              onChange={event => setDraft({ ...draft, statement: event.target.value })}
            />
          </label>
          <label>Öncelik
            <select
              value={draft.priority}
              onChange={event => setDraft({ ...draft, priority: event.target.value as Priority })}
            >
              {(Object.keys(REQUIREMENT_PRIORITY_LABELS) as Priority[]).map(priority =>
                <option key={priority} value={priority}>{REQUIREMENT_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label>Kabul kriterleri (her satır bir kriter)
            <textarea
              rows={3}
              value={draft.acceptanceCriteria}
              onChange={event => setDraft({ ...draft, acceptanceCriteria: event.target.value })}
            />
          </label>
          <div className="pg-requirement-review-editor-actions">
            <button type="button" onClick={closeEditor}>Vazgeç</button>
            <button type="button" className="is-primary" onClick={() => saveDraft(card)}>Taslağı kaydet</button>
          </div>
        </div>}

        <div className="pg-expansion-decision-actions">
          <button
            type="button"
            className={card.status === 'draft' ? '' : 'is-active'}
            aria-pressed={card.status !== 'draft'}
            disabled={!card.decidable}
            title={card.decidable ? 'Bu gereksinimi plana kabul et.' : 'Bu gereksinim zaten karara bağlandı.'}
            onClick={() => accept(card)}
          ><Check size={13}/> Kabul et</button>
          <button
            type="button"
            className={editingId === card.id ? 'is-active' : ''}
            aria-pressed={editingId === card.id}
            disabled={!card.editable}
            title={card.editable ? 'Taslağı düzenle.' : 'Kabul edilmiş gereksinim taslak olarak düzenlenemez.'}
            onClick={() => openEditor(card)}
          ><Pencil size={13}/> Düzenle</button>
          <button
            type="button"
            disabled={!card.editable}
            title={card.editable ? 'Bu taslağı listeden çıkar.' : 'Kabul edilmiş gereksinim silinemez.'}
            onClick={() => reject(card)}
          ><X size={13}/> Reddet</button>
        </div>
      </li>)}
    </ul>}
  </section>;
}
