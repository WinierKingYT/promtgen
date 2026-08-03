import type { ConceptSummary, ProjectDocumentV5, SuggestionItem } from '../contracts.js';

export type IdeaCoachStepId = 'problem' | 'user' | 'value' | 'mvp' | 'risks' | 'approval';
export type IdeaEvidenceStatus = 'unknown' | 'draft' | 'confirmed' | 'contradicted' | 'decision-required';

export interface IdeaCoachStep {
  id: IdeaCoachStepId;
  label: string;
  state: 'complete' | 'active' | 'upcoming';
}

export interface IdeaEvidenceField {
  id: IdeaCoachStepId;
  label: string;
  value: string;
  status: IdeaEvidenceStatus;
  statusLabel: string;
  detail: string;
}

export interface IdeaCoachAction {
  id: string;
  title: string;
  reason: string;
  prompt: string;
}

export interface IdeaCoachState {
  activeStep: IdeaCoachStepId;
  activeStepLabel: string;
  activeQuestion: string;
  steps: IdeaCoachStep[];
  evidence: IdeaEvidenceField[];
  actions: IdeaCoachAction[];
  uncertainty: string[];
  criticalDecisionCount: number;
  deferrableDecisionCount: number;
  readyForSummaryReview: boolean;
}

function emptyConceptSummary(): ConceptSummary {
  return {
    summary: '',
    targetUser: '',
    problemStatement: '',
    currentAlternative: '',
    desiredOutcome: '',
    interpretationConfidence: 0,
    confidenceRationale: [],
    confirmedFeatures: [],
    outOfScope: [],
    technicalApproaches: [],
    openQuestions: [],
    knownRisks: [],
    mvpTarget: '',
    userConfirmed: false
  };
}

export function ensureIdeaCoachWorkspace(project: ProjectDocumentV5): ProjectDocumentV5 {
  if (project.ideaLabSession?.conceptSummary) return project;
  const next = structuredClone(project);
  next.ideaLabSession = {
    status: 'active',
    approaches: [],
    ideaNotes: [],
    candidateDecisions: [],
    candidateRisks: [],
    // Deliberately empty, not a heuristic guess: createInitialConceptInterpretation()
    // fabricates full-length "meaningful" text for every field from just the raw idea
    // text, which made buildIdeaCoachState() treat the idea as fully clarified before
    // any real conversation happened (activeStep jumped straight to 'approval' on
    // turn one). Fields here must stay empty until the user's own answers fill them.
    conceptSummary: emptyConceptSummary()
  };
  return next;
}

const PLACEHOLDER_PATTERN = /^(herkes|insanlar|kullanıcılar|işler zor|daha iyi olsun|bir uygulama|belirsiz|bilinmiyor|doğrulanmalı)$/i;
const CONTRADICTION_PATTERN = /çeliş|tutarsız|conflict|contradict/i;

const STEP_LABELS: Record<IdeaCoachStepId, string> = {
  problem: 'Problem',
  user: 'Kullanıcı',
  value: 'Değer',
  mvp: 'MVP',
  risks: 'Riskler',
  approval: 'Onay'
};

function text(value: unknown): string {
  return String(value || '').trim();
}

function meaningful(value: unknown, minimum = 12): boolean {
  const normalized = text(value);
  return normalized.length >= minimum && !PLACEHOLDER_PATTERN.test(normalized);
}

function hasContradiction(project: ProjectDocumentV5, terms: RegExp): boolean {
  return (project.ideaDiscussion?.records || []).some(record =>
    record.status === 'pending'
      && CONTRADICTION_PATTERN.test(`${record.text} ${record.note} ${record.rationale}`)
      && terms.test(`${record.text} ${record.note} ${record.rationale}`)
  );
}

function statusFor(options: {
  exists: boolean;
  confirmed: boolean;
  contradicted?: boolean;
  optional?: boolean;
}): IdeaEvidenceStatus {
  if (options.contradicted) return 'contradicted';
  if (!options.exists) return options.optional ? 'unknown' : 'decision-required';
  return options.confirmed ? 'confirmed' : 'draft';
}

function statusCopy(status: IdeaEvidenceStatus): Pick<IdeaEvidenceField, 'statusLabel' | 'detail'> {
  if (status === 'confirmed') return { statusLabel: 'Doğrulandı', detail: 'Kullanıcı tarafından onaylandı.' };
  if (status === 'draft') return { statusLabel: 'Taslak', detail: 'Konuşmadan çıkarıldı; henüz kesin karar değil.' };
  if (status === 'contradicted') return { statusLabel: 'Çelişki var', detail: 'Birbiriyle uyuşmayan ifadeler çözülmeli.' };
  if (status === 'decision-required') return { statusLabel: 'Karar gerekli', detail: 'Devam etmek için bu alan netleştirilmeli.' };
  return { statusLabel: 'Bilinmiyor', detail: 'Bu alanı şimdi veya daha sonra konuşabilirsin.' };
}

function field(
  id: IdeaCoachStepId,
  label: string,
  value: string,
  status: IdeaEvidenceStatus
): IdeaEvidenceField {
  return { id, label, value, status, ...statusCopy(status) };
}

function turnFieldsFor(project: ProjectDocumentV5, activeStep: IdeaCoachStepId): {
  question: string | null;
  actions: IdeaCoachAction[] | null;
  uncertainty: string[];
} {
  const lastAssistant = [...project.messages].reverse().find(message => message.role === 'assistant');
  if (!lastAssistant || lastAssistant.nextQuestionStep !== activeStep) {
    return { question: null, actions: null, uncertainty: [] };
  }
  return {
    question: lastAssistant.nextQuestionText || null,
    actions: lastAssistant.optionalPaths?.length
      ? lastAssistant.optionalPaths.map((path, index) => ({ id: `turn-path-${index}`, ...path }))
      : null,
    uncertainty: lastAssistant.uncertainty || []
  };
}

function latestOpenItems(project: ProjectDocumentV5): SuggestionItem[] {
  return [...project.proposalStore.bundles].reverse().find(bundle => bundle.status === 'open')?.items || [];
}

function isCriticalDecision(item: SuggestionItem): boolean {
  if (item.kind === 'risk' || item.kind === 'question') return true;
  return item.affectedSections.some(section => ['vision', 'scope', 'requirements', 'architecture', 'security', 'privacy'].includes(section));
}

function derivedQuestion(step: IdeaCoachStepId, project: ProjectDocumentV5): string {
  const summary = project.ideaLabSession?.conceptSummary;
  if (step === 'problem') return 'Kullanıcının hangi somut durumda yaşadığı hangi problemi çözmek istiyorsun?';
  if (step === 'user') return 'Bu problemi ilk ve en sık yaşayan kişi kim? Tek bir kullanıcı grubu seçebilir misin?';
  if (step === 'value') {
    return meaningful(summary?.currentAlternative)
      ? 'Kullanıcı mevcut çözümü bırakıp bu ürünü neden tercih etsin; ölçülebilir kazanımı ne olacak?'
      : 'Kullanıcı bugün bu problemi nasıl çözüyor ve mevcut yöntem neden yetersiz kalıyor?';
  }
  if (step === 'mvp') return 'İlk sürüm tek bir varsayımı kanıtlayacak olsa bu ne olurdu; özellikle neleri dışarıda bırakırdın?';
  if (step === 'risks') return 'Bu fikri geçersiz kılabilecek en kritik varsayım veya risk nedir?';
  return 'Konuşmadan çıkardığımız problem, kullanıcı, değer ve MVP tanımı fikrini doğru yansıtıyor mu?';
}

function questionFor(step: IdeaCoachStepId, project: ProjectDocumentV5): string {
  const summary = project.ideaLabSession?.conceptSummary;
  const questions = [...new Set([...(project.openQuestions || []), ...(summary?.openQuestions || [])].map(text).filter(Boolean))];
  const matcher: Record<IdeaCoachStepId, RegExp> = {
    problem: /problem|sorun|acı|ihtiyaç/i,
    user: /kullanıcı|kim|persona|müşteri/i,
    value: /değer|sonuç|alternatif|neden|kazan/i,
    mvp: /mvp|ilk sürüm|kapsam|özellik|hipotez/i,
    risks: /risk|varsayım|engel|güvenlik/i,
    approval: /doğru|onay|yansıt/i
  };
  return questions.find(question => matcher[step].test(question)) || derivedQuestion(step, project);
}

function actionsFor(step: IdeaCoachStepId): IdeaCoachAction[] {
  const actions: Record<IdeaCoachStepId, IdeaCoachAction[]> = {
    problem: [
      { id: 'problem-example', title: 'Somut bir örnek üzerinden düşün', reason: 'Genel problem tanımını gerçek bir kullanım anına indirir.', prompt: 'Bu fikrin çözmek istediği problemi tek bir somut kullanıcı olayı üzerinden anlatmama yardım et.' },
      { id: 'problem-root', title: 'Kök problemi bul', reason: 'Özellik üretmeden önce gerçek acıyı ayırır.', prompt: 'Belirttiğim çözümden bağımsız düşün ve çözmek istediğim kök problemi bulmak için bana sorular sor.' }
    ],
    user: [
      { id: 'user-narrow', title: 'Kullanıcı grubunu daralt', reason: '“Herkes” yerine ilk kullanıcıyı seçmeye yardım eder.', prompt: 'Bu fikir için olası kullanıcı gruplarını karşılaştır ve ilk hedeflemem gereken tek grubu seçmeme yardım et.' },
      { id: 'user-context', title: 'Kullanım bağlamını seç', reason: 'Kimin, ne zaman bu ürünü aradığını netleştirir.', prompt: 'Hedef kullanıcının bu ürünü aramasına neden olacak tetikleyici anları seçenekler halinde göster.' }
    ],
    value: [
      { id: 'value-alternative', title: 'Bugünkü alternatifle karşılaştır', reason: 'Yeni ürünün neden gerekli olduğunu sınar.', prompt: 'Kullanıcının bugünkü çözümüyle bu fikri karşılaştır; değiştirmeye değecek gerçek farkı bul.' },
      { id: 'value-measure', title: 'Ölçülebilir sonucu belirle', reason: '“Daha iyi” gibi belirsiz vaatleri test edilebilir yapar.', prompt: 'Bu fikrin kullanıcıya sağlayacağı sonucu ölçülebilir ve gözlemlenebilir hale getirmeme yardım et.' }
    ],
    mvp: [
      { id: 'mvp-hypothesis', title: 'Tek MVP hipotezi seç', reason: 'İlk sürümün hangi riski test edeceğini belirler.', prompt: 'Bu fikir için ilk sürümde test edilmesi gereken tek ana hipotezi ve en küçük deneyimi öner.' },
      { id: 'mvp-cut', title: 'Kapsam dışını belirle', reason: 'İlk sürümün büyümesini engeller.', prompt: 'Ana değeri bozmadan ilk sürümden çıkarabileceğimiz şeyleri ve nedenlerini öner.' }
    ],
    risks: [
      { id: 'risk-assumption', title: 'En riskli varsayımı bul', reason: 'Yanlışsa fikri en çok etkileyecek iddiayı görünür yapar.', prompt: 'Bu fikrin dayandığı varsayımları sırala ve en riskli olanı nasıl doğrulayacağımızı öner.' },
      { id: 'risk-constraint', title: 'Kısıtları netleştir', reason: 'Zaman, bütçe, platform ve veri sınırlarını erken açığa çıkarır.', prompt: 'Bu fikir için zaman, bütçe, teknik bilgi, platform ve veri kısıtlarını netleştirecek sorular sor.' }
    ],
    approval: [
      { id: 'approval-challenge', title: 'Özeti eleştir', reason: 'Onaydan önce zayıf ve çelişkili noktaları bulur.', prompt: 'Fikir özetimi eleştirel biçimde incele; yalnız en önemli iki belirsizliği göster.' },
      { id: 'approval-simplify', title: 'Tek cümlede sınayalım', reason: 'Ürün fikrinin anlaşılır olup olmadığını test eder.', prompt: 'Fikrimi hedef kullanıcı, problem, değer ve MVP hipotezini içeren tek bir cümlede yeniden anlat.' }
    ]
  };
  return actions[step].slice(0, 3);
}

export function buildIdeaCoachState(project: ProjectDocumentV5): IdeaCoachState {
  const summary = project.ideaLabSession?.conceptSummary;
  const confirmed = Boolean(summary?.userConfirmed);
  const problemReady = meaningful(summary?.problemStatement, 18);
  const userReady = meaningful(summary?.targetUser, 8);
  const alternativeReady = meaningful(summary?.currentAlternative, 12);
  const outcomeReady = meaningful(summary?.desiredOutcome || project.identity.desiredOutcome, 12);
  const mvpReady = meaningful(summary?.mvpTarget, 12)
    && Boolean(summary?.confirmedFeatures?.length)
    && Boolean(summary?.outOfScope?.length);
  const risksReady = Boolean(summary?.knownRisks?.length);

  const readiness: Record<IdeaCoachStepId, boolean> = {
    problem: problemReady,
    user: userReady,
    value: alternativeReady && outcomeReady,
    mvp: mvpReady,
    risks: risksReady,
    approval: confirmed
  };
  const orderedSteps = Object.keys(STEP_LABELS) as IdeaCoachStepId[];
  const activeStep = orderedSteps.find(step => !readiness[step]) || 'approval';

  const contradiction = {
    problem: hasContradiction(project, /problem|sorun|ihtiyaç/i),
    user: hasContradiction(project, /kullanıcı|persona|müşteri|kim/i),
    value: hasContradiction(project, /değer|sonuç|alternatif|fayda/i),
    mvp: hasContradiction(project, /mvp|kapsam|özellik|ilk sürüm/i),
    risks: hasContradiction(project, /risk|varsayım|engel/i)
  };

  const evidence = [
    field('problem', 'Temel problem', text(summary?.problemStatement), statusFor({ exists: problemReady, confirmed, contradicted: contradiction.problem })),
    field('user', 'Hedef kullanıcı', text(summary?.targetUser), statusFor({ exists: userReady, confirmed, contradicted: contradiction.user })),
    field('value', 'Ana değer', text(summary?.desiredOutcome || project.identity.desiredOutcome), statusFor({ exists: alternativeReady && outcomeReady, confirmed, contradicted: contradiction.value })),
    field('mvp', 'MVP hipotezi', text(summary?.mvpTarget), statusFor({ exists: mvpReady, confirmed, contradicted: contradiction.mvp })),
    field('risks', 'Kritik risk', text(summary?.knownRisks?.[0]), statusFor({ exists: risksReady, confirmed, contradicted: contradiction.risks, optional: true }))
  ];

  const pendingItems = latestOpenItems(project).filter(item => item.status === 'pending');
  const criticalDecisionCount = pendingItems.filter(isCriticalDecision).length;

  const turnFields = turnFieldsFor(project, activeStep);

  return {
    activeStep,
    activeStepLabel: STEP_LABELS[activeStep],
    activeQuestion: turnFields.question || questionFor(activeStep, project),
    steps: orderedSteps.map((id, index) => ({
      id,
      label: STEP_LABELS[id],
      state: id === activeStep ? 'active' : index < orderedSteps.indexOf(activeStep) ? 'complete' : 'upcoming'
    })),
    evidence,
    actions: turnFields.actions || actionsFor(activeStep),
    uncertainty: turnFields.uncertainty,
    criticalDecisionCount,
    deferrableDecisionCount: pendingItems.length - criticalDecisionCount,
    readyForSummaryReview: problemReady && userReady && alternativeReady && outcomeReady && mvpReady && risksReady
  };
}
