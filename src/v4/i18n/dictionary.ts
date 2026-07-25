export type SupportedLocale = 'tr-TR' | 'en-US';

export const DICTIONARY: Record<SupportedLocale, Record<string, string>> = {
  'tr-TR': {
    'term.canonicalPlan': 'Canonical Plan',
    'term.requirement': 'Gereksinim',
    'term.decision': 'Karar',
    'term.risk': 'Risk',
    'term.task': 'Görev',
    'term.proposal': 'Öneri Paketi',
    'term.readiness': 'Hazır Olma Skoru',
    'action.save': 'Kaydet',
    'action.cancel': 'İptal',
    'action.accept': 'Kabul Et',
    'action.reject': 'Reddet',
    'status.active': 'Aktif',
    'status.archived': 'Arşivlendi',
    'status.accepted': 'Kabul Edildi'
  },
  'en-US': {
    'term.canonicalPlan': 'Canonical Plan',
    'term.requirement': 'Requirement',
    'term.decision': 'Decision',
    'term.risk': 'Risk',
    'term.task': 'Task',
    'term.proposal': 'Proposal Bundle',
    'term.readiness': 'Readiness Score',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.accept': 'Accept',
    'action.reject': 'Reject',
    'status.active': 'Active',
    'status.archived': 'Archived',
    'status.accepted': 'Accepted'
  }
};

export function t(key: string, locale: SupportedLocale = 'tr-TR', params?: Record<string, string>): string {
  const dict = DICTIONARY[locale] || DICTIONARY['tr-TR'];
  let text = dict[key] || DICTIONARY['tr-TR'][key] || key;

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(new RegExp(`{\\s*${pKey}\\s*}`, 'g'), pVal);
    }
  }

  return text;
}
