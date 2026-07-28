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

export function getConceptAgreementGate(project: ProjectDocumentV5) {
  const records = project.ideaDiscussion?.records || [];
  const summary = project.ideaLabSession?.conceptSummary;
  const unansweredAcceptedQuestions = records.filter(item =>
    item.kind === 'question' && item.status === 'accepted' && !item.answer.trim()
  );
  const pending = records.filter(item => item.status === 'pending');
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
  if (INTERPRETATION_FIELDS.some(field => !summary[field]?.toString().trim())) {
    throw new Error('Sistem yorumu, hedef kullanıcı, problem, mevcut çözüm, beklenen sonuç ve MVP hedefi boş olamaz.');
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
  const isGame = domainIds.some(domain => domain.includes('game') || domain.includes('oyun')) || /oyun|game|s&box|unity|unreal/.test(text);
  const isMobile = domainIds.some(domain => domain.includes('mobile')) || /mobil|android|ios/.test(text);
  const isWeb = domainIds.some(domain => domain.includes('web')) || /web|saas|panel|site|api/.test(text);
  const targetUser = isGame
    ? 'Oyunun temel döngüsünü deneyimleyecek oyuncu; kesin oyuncu profili kullanıcı tarafından doğrulanmalı.'
    : isMobile
      ? 'Ürünün temel işini telefonundan tamamlamak isteyen bireysel kullanıcı; kesin persona kullanıcı tarafından doğrulanmalı.'
      : isWeb
        ? 'Web üzerinden temel iş akışını tamamlamak isteyen bireysel kullanıcı veya küçük ekip üyesi; kesin persona kullanıcı tarafından doğrulanmalı.'
        : 'Bu ihtiyacı düzenli yaşayan birincil kullanıcı; kesin persona kullanıcı tarafından doğrulanmalı.';
  const confirmedFeatures = isGame
    ? ['Temel oynanış döngüsü', 'Oyuncu etkileşimi ve durum yönetimi']
    : isMobile
      ? ['Temel ekran ve navigasyon akışı', 'Yerel veri saklama']
      : isWeb
        ? ['Temel kullanıcı arayüzü', 'Veri modeli ve ana iş akışı']
        : ['Temel kullanıcı akışı', 'Çekirdek veri ve iş mantığı'];
  const signals = [idea.length >= 120, /,|;| ve | ile /.test(text), domainIds.length > 0].filter(Boolean).length;
  const confidence = 48 + signals * 10;
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
    openQuestions: ['Birincil kullanıcı ve yaşadığı ana problem doğru yorumlandı mı?'],
    knownRisks: ['Kapsamın kullanıcı doğrulaması olmadan genişlemesi'],
    mvpTarget: `${idea.slice(0, 120)} fikrinin tek birincil kullanıcı akışını tamamlayan doğrulanabilir ilk sürümü`,
    userConfirmed: false
  };
}
