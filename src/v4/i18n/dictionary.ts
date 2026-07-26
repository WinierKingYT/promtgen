export type SupportedLocale = 'tr-TR' | 'en-US';

export const DICTIONARY: Record<SupportedLocale, Record<string, string>> = {
  'tr-TR': {
    'start.skip': 'Ana içeriğe geç',
    'start.eyebrow': 'YAŞAYAN PROJE MİMARI · V4',
    'start.title': 'Fikrini söyle.',
    'start.titleAccent': 'Planı birlikte büyütelim.',
    'start.lead': 'Kısa bir düşünceden, kararları sana ait olan uygulanabilir bir proje planına. Teknolojiyi baştan bilmen gerekmiyor.',
    'start.ideaLabel': 'Ne yapmak istiyorsun?',
    'start.ideaPlaceholder': 'Örn. Yerel çalışan, kısa bir fikri adım adım geliştirip kodlama araçları için plana dönüştüren bir uygulama...',
    'start.characterCount': '{count} karakter',
    'start.amplifierHint': '(Fikir Büyütücü açılacak)',
    'start.minimum': 'En az 10 karakter gerekli',
    'start.shortcut': 'Ctrl + Enter ile başlat',
    'start.examples': 'Örnek fikirler:',
    'start.files': 'Proje dosyaları',
    'start.folder': 'Proje klasörü',
    'start.outputLanguage': 'Çıktı dili',
    'start.analyze': 'Fikri analiz et',
    'start.analyzing': 'Fikir analiz ediliyor',
    'start.previous': 'Daha önce başladın mı?',
    'start.openPackage': '.promtgen paketi aç',
    'start.inventoryNotice': 'Dosyalar cihazda envantere alınır; hassas dosya, secret ve şüpheli talimat filtreleri uygulanır. Bu işlem antivirüs veya SAST taraması değildir.',
    'language.turkish': 'Türkçe',
    'language.english': 'English',
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
    'start.skip': 'Skip to main content',
    'start.eyebrow': 'LIVING PROJECT ARCHITECT · V4',
    'start.title': 'Share your idea.',
    'start.titleAccent': 'Let’s shape the plan together.',
    'start.lead': 'Turn a short thought into an actionable project plan while keeping every decision under your control. You do not need to choose the technology up front.',
    'start.ideaLabel': 'What do you want to build?',
    'start.ideaPlaceholder': 'Example: A local-first app that develops a short idea step by step and turns it into a plan for coding tools...',
    'start.characterCount': '{count} characters',
    'start.amplifierHint': '(Idea Amplifier will open)',
    'start.minimum': 'At least 10 characters required',
    'start.shortcut': 'Press Ctrl + Enter to start',
    'start.examples': 'Example ideas:',
    'start.files': 'Project files',
    'start.folder': 'Project folder',
    'start.outputLanguage': 'Output language',
    'start.analyze': 'Analyze idea',
    'start.analyzing': 'Analyzing idea',
    'start.previous': 'Already started?',
    'start.openPackage': 'Open .promtgen package',
    'start.inventoryNotice': 'Files are inventoried on this device and filtered for sensitive files, secrets, and suspicious instructions. This is not antivirus or SAST scanning.',
    'language.turkish': 'Türkçe',
    'language.english': 'English',
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
