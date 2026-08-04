import type {
  ConceptSummary,
  IdeaDiscussionMode,
  IdeaDiscussionRecord,
  IdeaRecordKind,
  IdeaRecordStatus,
  ProjectDocumentV5,
  SuggestionBundle
} from '../contracts.js';

const VALID_MODES = new Set<IdeaDiscussionMode>(['explore', 'challenge', 'compare', 'clarify']);
const VALID_STATUSES = new Set<IdeaRecordStatus>(['pending', 'accepted', 'deferred', 'rejected']);
const MAX_RECORD_TEXT = 600;
const MAX_DETAIL_TEXT = 2400;
const INTERPRETATION_FIELDS = ['summary', 'targetUser', 'problemStatement', 'currentAlternative', 'desiredOutcome', 'mvpTarget'] as const;

export type DiscoveryConcernId =
  | 'target-user'
  | 'scope-conflict'
  | 'over-broad'
  | 'feasibility'
  | 'premature-tech'
  | 'sensitive-data'
  | 'multi-platform'
  | 'mvp-future-mix';

export interface DiscoveryConcern {
  id: DiscoveryConcernId;
  severity: 'medium' | 'high';
  evidence: string;
  question: string;
}

export interface DiscoverySignalAnalysis {
  concerns: DiscoveryConcern[];
  platforms: string[];
  featureSignals: number;
  confidencePenalty: number;
}

function includesEitherOrder(text: string, left: RegExp, right: RegExp): boolean {
  return (left.test(text) && right.test(text));
}

export function analyzeDiscoverySignals(project: ProjectDocumentV5): DiscoverySignalAnalysis {
  const idea = String(project.identity.originalIdea || project.identity.summary || '').trim();
  const text = idea.toLocaleLowerCase('tr-TR');
  const concerns: DiscoveryConcern[] = [];
  const add = (concern: DiscoveryConcern) => {
    if (!concerns.some(item => item.id === concern.id)) concerns.push(concern);
  };
  const platformSignals = [
    ['web', /\bweb\b|tarayıcı|browser|site|saas/],
    ['mobile', /mobil|mobile|android|ios/],
    ['desktop', /masaüstü|desktop|tauri|electron/]
  ] as const;
  const platforms = platformSignals.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const featureSignals = Math.max(1, (text.match(/,|;|\bve\b|\bile\b|\bayrıca\b|\bhem\b|\bsonra\b/g) || []).length + 1);

  if (!/oyuncu|geliştirici|developer|doktor|öğrenci|yönetici|çalışan|müşteri|ebeveyn|öğretmen|operatör|proje sahibi/.test(text)) {
    add({
      id: 'target-user',
      severity: 'high',
      evidence: 'Ham fikir açık bir birincil kullanıcı rolü belirtmiyor.',
      question: 'Bu ürünü ilk sürümde düzenli kullanacak tek birincil kullanıcı kim ve bugün bu işi nasıl yapıyor?'
    });
  }
  if (
    includesEitherOrder(text, /tek kullanıcı|kişisel|bireysel|yalnız/, /ekip|takım|çok kullanıcılı|paylaşım|işbirliği/) ||
    includesEitherOrder(text, /local.?first|yerel|cihazda/, /bulut|cloud|sunucuya gönder|yükle/)
  ) {
    add({
      id: 'scope-conflict',
      severity: 'high',
      evidence: 'Birbiriyle çelişebilecek kullanım veya veri sınırları aynı fikirde birlikte geçiyor.',
      question: 'Çelişen kullanım ya da veri sınırlarından hangisi MVP için zorunlu; hangisi kapsam dışında kalacak?'
    });
  }
  const technologySignals = (text.match(/react|next\.?js|vue|angular|svelte|tauri|electron|flutter|postgres|mongodb|redis|kafka|microservice|mikroservis/g) || []).length;
  if (
    /her şey|her türlü|tüm platform|eksiksiz|devasa|uçtan uca|milyonlarca/.test(text) ||
    featureSignals >= 7 ||
    technologySignals >= 4 ||
    (/mvp|ilk sürüm/.test(text) && (text.match(/analitik|marketplace|rapor|global|kurumsal/g) || []).length >= 2)
  ) {
    add({
      id: 'over-broad',
      severity: 'high',
      evidence: `${featureSignals} ayrı özellik veya kapsam sinyali bulundu.`,
      question: 'Bu geniş fikirde ilk sürümün kanıtlayacağı tek kullanıcı sonucu ve en fazla üç çekirdek özellik ne olmalı?'
    });
  }
  if (/yüzde\s*100|%100|sıfır hata|hatasız|asla çök|anında|sınırsız|garanti|imkansız|imkânsız/.test(text)) {
    add({
      id: 'feasibility',
      severity: 'high',
      evidence: 'Mutlak veya teknik olarak doğrulanması zor bir başarı iddiası bulundu.',
      question: 'Mutlak başarı iddiası yerine hangi ölçülebilir performans, doğruluk veya güvenilirlik eşiği kabul edilebilir?'
    });
  }
  if (/react|next\.?js|vue|angular|svelte|tauri|electron|flutter|kotlin|swift|postgres|mongodb|sqlite|microservice|mikroservis/.test(text)) {
    add({
      id: 'premature-tech',
      severity: 'medium',
      evidence: 'İhtiyaç ve kapsam doğrulanmadan teknoloji veya mimari tercihi belirtilmiş.',
      question: 'Belirtilen teknoloji zorunlu bir kısıt mı, yoksa problem ve MVP netleşince karşılaştırılabilecek bir tercih mi?'
    });
  }
  if (/sağlık|health|hasta|klinik|ödeme|payment|kart|finans|banka|kimlik|biyometr|kişisel veri|çocuk|konum/.test(text)) {
    add({
      id: 'sensitive-data',
      severity: 'high',
      evidence: 'Hassas veya düzenlemeye tabi olabilecek veri sinyali bulundu.',
      question: 'İlk sürüm hangi hassas verileri gerçekten işleyecek, hangilerini hiç toplamamalı ve doğrulama sorumluluğu kimde olacak?'
    });
  }
  if (platforms.length >= 2) {
    add({
      id: 'multi-platform',
      severity: 'high',
      evidence: `Birden fazla platform hedefi bulundu: ${platforms.join(', ')}.`,
      question: 'MVP için birincil platform hangisi; diğer platformlar hangi doğrulamadan sonra kapsama alınacak?'
    });
  }
  if (
    /mvp|ilk sürüm|basit|önce/.test(text) &&
    /ileride|sonra|marketplace|gelişmiş|analitik|rapor|çok oyunculu|multi.?player|global|kurumsal/.test(text)
  ) {
    add({
      id: 'mvp-future-mix',
      severity: 'high',
      evidence: 'MVP hedefleri ile sonraki sürüm özellikleri aynı fikir içinde karışmış.',
      question: 'Hangi maddeler MVP içinde kalacak, hangi maddeler açıkça sonraki sürüme veya kapsam dışına taşınacak?'
    });
  }

  return {
    concerns,
    platforms,
    featureSignals,
    confidencePenalty: concerns.reduce((total, concern) => total + (concern.severity === 'high' ? 10 : 6), 0)
  };
}

function inferTargetUser(idea: string, domainIds: string[]): string {
  const text = idea.toLocaleLowerCase('tr-TR');
  if (/restoran|kafe|cafe/.test(text)) return 'Restoran sahibi veya günlük operasyonu yöneten çalışan; kesin rol kullanıcı tarafından doğrulanmalı.';
  if (/geliştirici|developer|kodlama|cursor|codex|claude code/.test(text)) return 'AI kodlama aracı kullanan bireysel geliştirici; deneyim seviyesi kullanıcı tarafından doğrulanmalı.';
  if (/oyun|game|s&box|unity|unreal/.test(text) || domainIds.some(domain => domain.includes('game'))) return 'Oyunun temel döngüsünü deneyimleyecek oyuncu; kesin oyuncu profili kullanıcı tarafından doğrulanmalı.';
  if (/doktor|hasta|klinik|sağlık/.test(text)) return 'Sağlık hizmeti kullanıcısı veya çalışanı; klinik rol ve doğrulama sınırı kullanıcı tarafından kesinleştirilmeli.';
  if (/yönetim|admin|operasyon|iç araç/.test(text)) return 'Günlük operasyonu yürüten yönetici veya çalışan; birincil rol kullanıcı tarafından doğrulanmalı.';
  if (/mobil|android|ios/.test(text) || domainIds.some(domain => domain.includes('mobile'))) return 'Ürünün temel işini telefonundan tamamlamak isteyen bireysel kullanıcı; kesin persona kullanıcı tarafından doğrulanmalı.';
  if (/web|saas|panel|site|api/.test(text) || domainIds.some(domain => domain.includes('web'))) return 'Web üzerinden temel iş akışını tamamlayan bireysel kullanıcı veya küçük ekip üyesi; tek persona kullanıcı tarafından seçilmeli.';
  return 'Bu ihtiyacı düzenli yaşayan birincil kullanıcı; kesin persona kullanıcı tarafından doğrulanmalı.';
}

function ensureState(project: ProjectDocumentV5): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.ideaDiscussion ||= { mode: 'explore', records: [], updatedAt: new Date().toISOString() };
  next.ideaDiscussion.records ||= [];
  return next;
}

function recordKind(kind: string): IdeaRecordKind {
  if (kind === 'risk') return 'risk';
  if (kind === 'question') return 'question';
  if (kind === 'decision' || kind === 'architecture') return 'decision';
  return 'hypothesis';
}

function fingerprint(kind: IdeaRecordKind, text: string): string {
  return `${kind}:${text.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')}`;
}

function bounded(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max);
}

function discussionSnapshot(record: IdeaDiscussionRecord) {
  return {
    editedAt: new Date().toISOString(),
    text: record.text,
    note: record.note,
    answer: record.answer,
    rationale: record.rationale,
    validationPlan: record.validationPlan
  };
}

export function setIdeaDiscussionMode(project: ProjectDocumentV5, mode: IdeaDiscussionMode): ProjectDocumentV5 {
  if (!VALID_MODES.has(mode)) throw new Error(`Geçersiz fikir tartışma modu: ${mode}`);
  const next = ensureState(project);
  next.ideaDiscussion.mode = mode;
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function captureDiscussionBundle(
  project: ProjectDocumentV5,
  bundle: SuggestionBundle,
  sourceMessageId = ''
): ProjectDocumentV5 {
  const next = ensureState(project);
  const existing = new Set(next.ideaDiscussion.records.map(item => fingerprint(item.kind, item.text)));
  const createdAt = new Date().toISOString();
  const candidates = [
    ...bundle.items.map(item => ({ kind: recordKind(item.kind), text: item.title || item.description })),
    ...(bundle.openQuestions || []).map(text => ({ kind: 'question' as const, text }))
  ];

  for (const [index, candidate] of candidates.entries()) {
    const value = String(candidate.text || '').trim();
    const key = fingerprint(candidate.kind, value);
    if (!value || existing.has(key)) continue;
    const record: IdeaDiscussionRecord = {
      id: `idea-record-${Date.now()}-${index}`,
      kind: candidate.kind,
      text: value,
      originalText: value,
      note: '',
      answer: '',
      rationale: '',
      validationPlan: '',
      history: [],
      status: 'pending',
      sourceBundleId: bundle.id,
      sourceMessageId,
      createdAt
    };
    next.ideaDiscussion.records.push(record);
    existing.add(key);
  }
  next.ideaDiscussion.updatedAt = createdAt;
  return next;
}

export function updateIdeaRecord(
  project: ProjectDocumentV5,
  recordId: string,
  changes: Partial<Pick<IdeaDiscussionRecord, 'text' | 'note' | 'answer' | 'rationale' | 'validationPlan'>>
): ProjectDocumentV5 {
  const next = ensureState(project);
  const record = next.ideaDiscussion.records.find(item => item.id === recordId);
  if (!record) throw new Error('Fikir kaydı bulunamadı.');
  const updated = {
    text: changes.text === undefined ? record.text : bounded(changes.text, MAX_RECORD_TEXT),
    note: changes.note === undefined ? record.note : bounded(changes.note, MAX_DETAIL_TEXT),
    answer: changes.answer === undefined ? record.answer : bounded(changes.answer, MAX_DETAIL_TEXT),
    rationale: changes.rationale === undefined ? record.rationale : bounded(changes.rationale, MAX_DETAIL_TEXT),
    validationPlan: changes.validationPlan === undefined ? record.validationPlan : bounded(changes.validationPlan, MAX_DETAIL_TEXT)
  };
  if (!updated.text) throw new Error('Fikir kaydı metni boş olamaz.');
  const changed = Object.entries(updated).some(([key, value]) => record[key as keyof typeof updated] !== value);
  if (!changed) return next;
  record.history ||= [];
  record.history.push(discussionSnapshot(record));
  Object.assign(record, updated);
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function updateIdeaRecordStatus(
  project: ProjectDocumentV5,
  recordId: string,
  status: IdeaRecordStatus
): ProjectDocumentV5 {
  if (!VALID_STATUSES.has(status)) throw new Error(`Geçersiz fikir kaydı durumu: ${status}`);
  const next = ensureState(project);
  const record = next.ideaDiscussion.records.find(item => item.id === recordId);
  if (!record) throw new Error('Fikir kaydı bulunamadı.');
  if (record.kind === 'question' && status === 'accepted' && !record.answer.trim()) {
    throw new Error('Açık soru kabul edilmeden önce cevaplanmalı.');
  }
  record.status = status;
  record.resolvedAt = status === 'pending' ? undefined : new Date().toISOString();
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

/**
 * Bir öneri paketi karara bağlandığında, o paketten üretilmiş fikir kayıtları
 * da kapanır.
 *
 * Öneri öğeleri (proposalStore.bundles[].items) ile fikir kayıtları
 * (ideaDiscussion.records) aynı önerinin iki ayrı defterdeki izidir. Paket
 * çözüldüğünde yalnız öğeler güncelleniyordu; kayıtlar sonsuza dek "pending"
 * kalıyor ve plana geçişi blokluyordu. Kullanıcı aynı öneriyi iki kez karara
 * bağlayamayacağı için ikinci defter burada paketi takip eder.
 */
export function resolveIdeaRecordsForBundle(
  project: ProjectDocumentV5,
  bundleId: string,
  status: IdeaRecordStatus = 'deferred'
): ProjectDocumentV5 {
  const stale = (project.ideaDiscussion?.records || [])
    .filter(record => record.sourceBundleId === bundleId && record.status === 'pending');
  return stale.reduce((carry, record) => updateIdeaRecordStatus(carry, record.id, status), project);
}

export function getConceptAgreementGate(project: ProjectDocumentV5) {
  const records = project.ideaDiscussion?.records || [];
  const summary = project.ideaLabSession?.conceptSummary;
  const unansweredAcceptedQuestions = records.filter(item =>
    item.kind === 'question' && item.status === 'accepted' && !item.answer.trim()
  );
  const pending = records.filter(item => item.status === 'pending');
  // Kritik / ertelenebilir ayrimi: karar ve soru plani belirsiz birakir, bu
  // yuzden plana gecmeden once cozulmelidir. Hipotez ve risk ise kaybolmaz —
  // canonical planin varsayim ve risk bolumlerine tasinir ve orada izlenir.
  // Boylece kullanici her kaydi tek tek karara baglamak zorunda kalmaz.
  const criticalPending = pending.filter(item => item.kind === 'decision' || item.kind === 'question');
  const deferrablePending = pending.filter(item => item.kind !== 'decision' && item.kind !== 'question');
  const missingInterpretationFields = summary
    ? INTERPRETATION_FIELDS.filter(field => !summary[field]?.toString().trim())
    : [...INTERPRETATION_FIELDS];
  const missingScopeLists = summary
    ? [
        ...(summary.confirmedFeatures.length ? [] : ['confirmedFeatures']),
        ...(summary.outOfScope.length ? [] : ['outOfScope'])
      ]
    : ['confirmedFeatures', 'outOfScope'];
  const unresolvedSummaryQuestions = summary?.openQuestions || [];
  const interpretationReady = Boolean(summary)
    && missingInterpretationFields.length === 0
    && missingScopeLists.length === 0
    && unresolvedSummaryQuestions.length === 0;
  return {
    ready: pending.length === 0 && unansweredAcceptedQuestions.length === 0 && interpretationReady,
    interpretationReady,
    missingInterpretationFields,
    missingScopeLists,
    unresolvedSummaryQuestions,
    pending,
    criticalPending,
    deferrablePending,
    unresolvedCount: pending.length + unansweredAcceptedQuestions.length + missingInterpretationFields.length + missingScopeLists.length + unresolvedSummaryQuestions.length,
    unansweredAcceptedQuestions,
    accepted: records.filter(item => item.status === 'accepted'),
    deferred: records.filter(item => item.status === 'deferred'),
    rejected: records.filter(item => item.status === 'rejected')
  };
}

export function buildIdeaDiscussionContext(project: ProjectDocumentV5) {
  const records = project.ideaDiscussion?.records || [];
  const projectRecord = (record: IdeaDiscussionRecord) => ({
    kind: record.kind,
    text: record.text,
    note: record.note || undefined,
    answer: record.answer || undefined,
    rationale: record.rationale || undefined,
    validationPlan: record.validationPlan || undefined
  });
  return {
    mode: project.ideaDiscussion?.mode || 'explore',
    accepted: records.filter(item => item.status === 'accepted').slice(-20).map(projectRecord),
    deferred: records.filter(item => item.status === 'deferred').slice(-12).map(projectRecord),
    rejected: records.filter(item => item.status === 'rejected').slice(-20).map(projectRecord),
    pending: records.filter(item => item.status === 'pending').slice(-12).map(projectRecord)
  };
}

export function updateConceptAgreement(
  project: ProjectDocumentV5,
  changes: Partial<Pick<ConceptSummary, 'summary' | 'targetUser' | 'problemStatement' | 'currentAlternative' | 'desiredOutcome' | 'interpretationConfidence' | 'confidenceRationale' | 'confirmedFeatures' | 'outOfScope' | 'technicalApproaches' | 'knownRisks' | 'openQuestions' | 'mvpTarget'>>
): ProjectDocumentV5 {
  const next = ensureState(project);
  const summary = next.ideaLabSession?.conceptSummary;
  if (!summary) throw new Error('Düzenlenecek konsept özeti bulunamadı.');
  const normalizeList = (items: unknown) => Array.isArray(items)
    ? [...new Set(items.map(item => bounded(item, MAX_RECORD_TEXT)).filter(Boolean))].slice(0, 50)
    : [];
  if (changes.summary !== undefined) summary.summary = bounded(changes.summary, MAX_DETAIL_TEXT);
  if (changes.targetUser !== undefined) summary.targetUser = bounded(changes.targetUser, MAX_RECORD_TEXT);
  if (changes.problemStatement !== undefined) summary.problemStatement = bounded(changes.problemStatement, MAX_DETAIL_TEXT);
  if (changes.currentAlternative !== undefined) summary.currentAlternative = bounded(changes.currentAlternative, MAX_DETAIL_TEXT);
  if (changes.desiredOutcome !== undefined) summary.desiredOutcome = bounded(changes.desiredOutcome, MAX_DETAIL_TEXT);
  if (changes.interpretationConfidence !== undefined) {
    summary.interpretationConfidence = Math.max(0, Math.min(100, Math.round(Number(changes.interpretationConfidence) || 0)));
  }
  if (changes.mvpTarget !== undefined) summary.mvpTarget = bounded(changes.mvpTarget, MAX_RECORD_TEXT);
  for (const key of ['confidenceRationale', 'confirmedFeatures', 'outOfScope', 'technicalApproaches', 'knownRisks', 'openQuestions'] as const) {
    if (changes[key] !== undefined) summary[key] = normalizeList(changes[key]);
  }
  summary.userConfirmed = false;
  delete summary.confirmedAt;
  next.ideaDiscussion.updatedAt = new Date().toISOString();
  return next;
}

export function createInitialConceptInterpretation(project: ProjectDocumentV5): ConceptSummary {
  const idea = String(project.identity.originalIdea || project.identity.summary || 'Proje fikri').trim();
  const text = idea.toLocaleLowerCase('tr-TR');
  const domainIds = (project.profile?.domains || []).map(domain => String(domain.name || '').toLowerCase());
  const signalAnalysis = analyzeDiscoverySignals(project);
  const isGame = domainIds.some(domain => domain.includes('game') || domain.includes('oyun')) || /oyun|game|s&box|unity|unreal/.test(text);
  const isMobile = domainIds.some(domain => domain.includes('mobile')) || /mobil|android|ios/.test(text);
  const isWeb = domainIds.some(domain => domain.includes('web')) || /web|saas|panel|site|api/.test(text);
  const targetUser = inferTargetUser(idea, domainIds);
  const confirmedFeatures = isGame
    ? ['Temel oynanış döngüsü', 'Oyuncu etkileşimi ve durum yönetimi']
    : isMobile
      ? ['Temel ekran ve navigasyon akışı', 'Yerel veri saklama']
      : isWeb
        ? ['Temel kullanıcı arayüzü', 'Veri modeli ve ana iş akışı']
        : ['Temel kullanıcı akışı', 'Çekirdek veri ve iş mantığı'];
  const signals = [idea.length >= 120, /,|;| ve | ile /.test(text), domainIds.length > 0].filter(Boolean).length;
  const confidence = Math.max(25, Math.min(85, 52 + signals * 9 - signalAnalysis.confidencePenalty));
  return {
    summary: `PromtGen fikri şu şekilde yorumladı: ${idea}`,
    targetUser,
    problemStatement: `Kullanıcı, “${idea.slice(0, 180)}” ihtiyacını mevcut yöntemlerle tutarlı ve izlenebilir biçimde karşılamakta zorlanıyor. Bu problem tanımı kullanıcı tarafından düzeltilmelidir.`,
    currentAlternative: 'Manuel adımlar, dağınık araçlar veya genel amaçlı çözümler; gerçek mevcut yöntem kullanıcı tarafından doğrulanmalı.',
    desiredOutcome: project.identity.desiredOutcome || 'Kullanıcının temel ihtiyacını az adımla ve doğrulanabilir biçimde tamamlayan çalışan bir ilk sürüm.',
    interpretationConfidence: confidence,
    confidenceRationale: [
      domainIds.length ? 'Proje alanı için metinsel sinyal bulundu.' : 'Proje alanı kesin değil.',
      idea.length >= 120 ? 'Fikir işlev ve bağlam ayrıntıları içeriyor.' : 'Fikir kısa; kullanıcı ayrıntısı gerekiyor.',
      'Bu değer doğruluk garantisi değil, eksik bağlam göstergesidir.'
    ],
    confirmedFeatures,
    outOfScope: ['İleri seviye raporlama ve optimizasyon', 'Bulut senkronizasyonu ve çok kullanıcılı işbirliği'],
    technicalApproaches: [],
    openQuestions: signalAnalysis.concerns.length
      ? signalAnalysis.concerns.slice(0, 5).map(concern => concern.question)
      : ['Birincil kullanıcı, yaşadığı ana problem ve ilk sürüm kapsamı doğru yorumlandı mı?'],
    knownRisks: [
      'Kapsamın kullanıcı doğrulaması olmadan genişlemesi',
      ...signalAnalysis.concerns.filter(concern => concern.severity === 'high').map(concern => concern.evidence)
    ],
    mvpTarget: `${idea.slice(0, 120)} fikrinin tek birincil kullanıcı akışını tamamlayan doğrulanabilir ilk sürümü`,
    userConfirmed: false
  };
}
