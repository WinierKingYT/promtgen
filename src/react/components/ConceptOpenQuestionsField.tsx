import { CircleCheck } from 'lucide-react';
import { closeOpenQuestion, lines } from '../../v4/application/concept-agreement-fields.js';

/**
 * A4 -- "Açık kritik sorular" artık serbest-metin kutusu DEĞİL.
 *
 * ÖLÇÜLEN TUZAK (canlı test, `ConceptAgreementEditor.tsx`): bu alan diğer
 * dört liste alanıyla AYNI `listField` serbest-metin kutusunda gösteriliyordu
 * — kutu görsel olarak "buraya yaz" diyordu, ama kapı kuralı ("Onaydan önce
 * cevapla ve bu listeyi TEMİZLE") kullanıcıdan tam tersini, listeyi
 * BOŞALTMASINI istiyordu. Kaydet düğmesi devre dışı kalıyor, kullanıcı
 * nedenini kutunun şeklinden okuyamıyordu.
 *
 * Kullanıcının işi burada YAZMAK değil KAPATMAKTIR; arayüz bunu artık bir
 * metin kutusuyla değil satırların ŞEKLİYLE söylüyor: sistemin sorduğu her
 * soru salt-okunur bir satır olarak durur, tek eylem "Cevaplandı, kapat"
 * düğmesidir. Kullanıcı burada yeni bir soru YAZAMAZ — plan bunu bilerek
 * dışarıda bırakıyor; bu bir metin editörü değil, bir kapatma listesidir.
 *
 * KALDIRMA YALNIZ TASLAKTA olur: `onChange` üst bileşenin (ConceptAgreementEditor)
 * taslak state'ini günceller, hiçbir komut tetiklemez ve belgeye dokunmaz.
 * Belgeye geçmesi için kullanıcının ayrıca "kaydet"e basması gerekir — aynen
 * `removeLegacyLines`teki kural. Sistem kendiliğinden hiçbir satırı kaldırmaz.
 *
 * ERİŞİLEBİLİRLİK DÜZELTMESİ (df7dff3'ten hemen sonra ölçüldü): her satırın
 * düğmesi AYNI erişilebilir ada sahipti ("Cevaplandı, kapat") — ekranda
 * gezinen bir ekran okuyucu kullanıcısı hangi soruyu kapattığını hiçbir
 * düğme adından ayırt edemiyordu. `aria-label` her düğmeye kendi sorusunu
 * ekler; görünen etiket DEĞİŞMEDİ (yalnız `<button>` içeriği), WCAG 2.5.3
 * (Label in Name) görünen metnin erişilebilir adın İÇİNDE geçmesini ister —
 * `Workspace.tsx`teki sohbet düğmesi aynı maddeyi anar. Metin burada
 * kısaltılmadan aynen tekrarlanır, satır başına gelir.
 */
export function ConceptOpenQuestionsField({ value, onChange }: {
  value: string;
  onChange: (next: string) => void;
}) {
  const questions = lines(value);
  const close = (index: number) => onChange(closeOpenQuestion(questions, index).join('\n'));

  return <div className="agreement-field agreement-open-questions" role="group" aria-labelledby="open-questions-heading">
    <p className="agreement-field-heading" id="open-questions-heading">
      Açık kritik sorular<small>Onaydan önce cevapla ve aşağıdan kapat</small>
    </p>
    {questions.length === 0
      ? <p className="agreement-open-questions-empty" role="note">
        <CircleCheck size={14} aria-hidden="true"/> Açık soru kalmadı.
      </p>
      : <ul className="agreement-open-questions-list">
        {questions.map((question, index) => <li key={`${index}:${question}`}>
          <span>{question}</span>
          <button type="button" aria-label={`Cevaplandı, kapat: ${question}`} onClick={() => close(index)}>
            <CircleCheck size={14} aria-hidden="true"/> Cevaplandı, kapat
          </button>
        </li>)}
      </ul>}
  </div>;
}
