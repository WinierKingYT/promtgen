import type { ProjectDocumentV5 } from '../contracts.js';

export type IdeaMaturityOutcome = 'develop' | 'guide' | 'plan';

export interface IdeaMaturityAssessment {
  score: number;
  recommended: IdeaMaturityOutcome;
  label: string;
  reason: string;
  missing: string[];
}

function meaningful(value: string | undefined, placeholders: RegExp) {
  const text = String(value || '').trim();
  return text.length >= 8 && !placeholders.test(text.toLocaleLowerCase('tr-TR'));
}

export function assessIdeaMaturity(project: ProjectDocumentV5): IdeaMaturityAssessment {
  const summary = project.ideaLabSession?.conceptSummary;
  if (!summary) {
    return {
      score: 0,
      recommended: 'develop',
      label: 'Fikri geliştir',
      reason: 'Fikrin hedef kullanıcısı, problemi ve sınırları henüz ayrıştırılmadı.',
      missing: ['Sistem yorumu']
    };
  }

  const checks = [
    { points: 15, passed: meaningful(summary.targetUser, /doğrulanmalı|kesin persona|belirsiz/), missing: 'Birincil kullanıcı' },
    { points: 20, passed: meaningful(summary.problemStatement, /doğrulanmalı|ana problem|belirsiz/), missing: 'Ana problem' },
    { points: 10, passed: meaningful(summary.desiredOutcome, /doğrulanmalı|beklenen sonuç|belirsiz/), missing: 'Beklenen sonuç' },
    { points: 15, passed: summary.confirmedFeatures.length > 0, missing: 'Kapsam içi liste' },
    { points: 10, passed: summary.outOfScope.length > 0, missing: 'Kapsam dışı liste' },
    // Alan adı V3-04b-2'de göç etti; aşağıdaki yer tutucu DESENİ bilerek
    // dokunulmadan bırakıldı. Desen, kaydedilmiş belgelerdeki gerçek yer
    // tutucu metni ("mvp hedefi") arar -- o metin diskte duruyor ve alan adı
    // göçü onu yeniden yazmaz. Deseni değiştirmek yeniden adlandırma değil,
    // ölçülen davranışın değişmesi olurdu.
    { points: 10, passed: meaningful(summary.firstReleaseTarget, /doğrulanmalı|mvp hedefi|belirsiz/), missing: 'Hedeflenen kapsam' },
    { points: 10, passed: summary.openQuestions.length === 0, missing: 'Açık sorular' },
    { points: 10, passed: summary.userConfirmed, missing: 'Kullanıcı onayı' }
  ];
  const score = checks.reduce((total, item) => total + (item.passed ? item.points : 0), 0);
  const missing = checks.filter(item => !item.passed).map(item => item.missing);
  const pendingDiscussion = (project.ideaDiscussion?.records || []).some(item => item.status === 'pending');

  if (score < 55 || pendingDiscussion) {
    return {
      score,
      recommended: 'develop',
      label: 'Fikri geliştir',
      reason: pendingDiscussion
        ? 'Bekleyen fikir kararları var; önce bunları tartışmak daha güvenli.'
        : `${missing.slice(0, 2).join(' ve ')} henüz net değil.`,
      missing
    };
  }
  if (score < 90 || !summary.userConfirmed) {
    return {
      score,
      recommended: 'guide',
      label: 'Rehber oluştur',
      reason: 'Fikir anlaşılır durumda; plan öncesi yaşayan fikir belgesini gözden geçir.',
      missing
    };
  }
  return {
    score,
    recommended: 'plan',
    label: 'Detaylı planla',
    reason: 'Hedef kullanıcı, problem ve kapsam sınırları onaylı; canonical plan için hazır.',
    missing
  };
}
