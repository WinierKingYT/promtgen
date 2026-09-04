import { blockingConcerns } from './concerns.js';
import type {
  PlanningPhase,
  ProjectDocumentV5,
  ProjectStage,
  StageApproval,
  StageStatus
} from '../contracts.js';

/**
 * Ürün Modeli V3 aşama makinesi.
 *
 * Neden ayrı bir modül: Alt Proje C'de uygulamada üç ayrı aşama modeli
 * bulunmuştu ve üçü birbirine bağlı değildi (`IdeaStudioView`,
 * `PHASE_REGISTRY`, `coach.steps`). V3 dördüncüsünü eklemiyor; yenisini
 * canonical yapıp eskisiyle **açık eşleme** kuruyor. Eşleme tabloya bağlı,
 * tahmine değil.
 */

export const PROJECT_STAGES: readonly ProjectStage[] = ['idea', 'solution', 'plan', 'handoff'] as const;

/**
 * Aşamaların tam adları — düzyazının kullandığı biçim.
 *
 * `workspace-stages.ts` içindeki `LABELS` bunun kopyası değildir: orası ekrana
 * sığan kısa ray etiketleridir (`FİKİR · ÇÖZÜM · PLAN · DEVİR`), burası
 * belgelerin ve dışa aktarılan metinlerin yazdığı canonical addır. İkisi de
 * `Record<ProjectStage, string>` olduğu için beşinci bir aşama eklendiğinde
 * ikisi birden derlemeyi düşürür; unutulacak bir taraf kalmaz.
 */
export const STAGE_NAMES: Readonly<Record<ProjectStage, string>> = {
  idea: 'Fikir Tasarımı',
  solution: 'Çözüm Tasarımı',
  plan: 'Uygulama Planı',
  handoff: 'Agent Devri'
};

export const STAGE_STATUSES: readonly StageStatus[] = ['draft', 'discovery', 'review', 'approved'] as const;

/** Boş bir onay kaydı; yeni belgelerin ve göç edenlerin başlangıcı. */
export function createStageApproval(): StageApproval {
  return { status: 'draft', approvedAtRevision: null, approvedAt: null, reopenedReason: null };
}

/**
 * Eski 9 fazlı `PlanningPhase` → V3 aşaması.
 *
 * Bu tablo iki modeli birbirine bağlayan tek yerdir. Yeni bir faz eklenirse
 * burada karşılığı yazılmak zorunda; `planningPhaseToStage` bilinmeyen fazda
 * `idea`'ya düşer çünkü en güvenli varsayım "henüz başlangıçtayız"dır —
 * kullanıcıyı hak etmediği bir aşamaya ilerletmek, geride tutmaktan daha
 * zararlıdır.
 */
const PHASE_TO_STAGE: Readonly<Record<PlanningPhase, ProjectStage>> = {
  IDEA_EXPANSION: 'idea',
  DISCOVERY: 'idea',
  IDEA_LAB: 'idea',
  CONCEPT_CONFIRMATION: 'idea',
  SHAPING: 'solution',
  DESIGN: 'solution',
  PLANNING: 'plan',
  REVIEW: 'plan',
  READY: 'handoff'
};

export function planningPhaseToStage(phase: PlanningPhase | string): ProjectStage {
  return PHASE_TO_STAGE[phase as PlanningPhase] ?? 'idea';
}

/**
 * Belgenin bulunduğu aşama. Onaylar zincirleme okunur: bir aşama ancak
 * öncekiler onaylandıysa açılır.
 *
 * `Idea → Plan` doğrudan geçişi V3'te kaldırıldığı için burada da yok;
 * `solution` aşaması `idea` onaylanmadan dönmez.
 */
export function currentStage(project: ProjectDocumentV5): ProjectStage {
  if (project.ideaDesign?.approval?.status !== 'approved') return 'idea';
  if (project.solutionDesign?.approval?.status !== 'approved') return 'solution';
  return project.lifecycle?.status === 'finalized' ? 'handoff' : 'plan';
}

export interface StageGateResult {
  open: boolean;
  /** Kapalıysa nedeni; kilit sessiz olmaz. */
  reason: string | null;
}

/**
 * V3'ün üç değişmezi:
 *   - Kritik fikir kararları çözülmeden Solution Design onaylanamaz.
 *   - Kritik teknik kararlar çözülmeden Plan finalleştirilemez.
 *   - Plan finalize edilmeden Agent Devri (`handoff`) açılmaz.
 *
 * Kapı iki şeye birden bakar: aşamanın onayı ve **bloklayan concern'ler**.
 * Onay alınmış görünse bile çözülmemiş kritik bir karar varsa kapı kapalıdır
 * — aksi hâlde onay, altındaki boşluğu örtbas eden bir imza olurdu.
 */
export function stageGate(project: ProjectDocumentV5, target: ProjectStage): StageGateResult {
  if (target === 'idea') return { open: true, reason: null };

  const ideaBlockers = blockingConcerns(project.ideaDesign?.concerns || []);
  if (ideaBlockers.length) {
    return { open: false, reason: blockerReason('Fikir tasarımında', ideaBlockers.length) };
  }
  if (project.ideaDesign?.approval?.status !== 'approved') {
    return { open: false, reason: 'Fikir tasarımı henüz onaylanmadı.' };
  }
  if (target === 'solution') return { open: true, reason: null };

  const solutionBlockers = blockingConcerns(project.solutionDesign?.concerns || []);
  if (solutionBlockers.length) {
    return { open: false, reason: blockerReason('Teknik tasarımda', solutionBlockers.length) };
  }
  if (project.solutionDesign?.approval?.status !== 'approved') {
    return { open: false, reason: 'Teknik çözüm tasarımı henüz onaylanmadı.' };
  }
  if (target === 'plan') return { open: true, reason: null };

  // target === 'handoff': Agent Devri yalnızca plan finalize edildiğinde açılır.
  // Yarım bir planı coding agent'a devretmek, onayın örttüğü boşluğu doğrudan
  // koda taşırdı. Aynı koşul `currentStage` içinde de var.
  if (project.lifecycle?.status !== 'finalized') {
    return { open: false, reason: 'Plan henüz finalize edilmedi.' };
  }
  return { open: true, reason: null };
}

/** Kapı yüzde değil engel sayar; "98/100" sahte kesinlik veriyordu. */
function blockerReason(prefix: string, count: number): string {
  return `${prefix} çözülmemiş ${count} kritik karar var.`;
}

/**
 * Bir aşamanın onayını yeniden açar ve **nedenini kaydeder**.
 *
 * Geri dönüş sessiz olmaz: kullanıcı Solution aşamasında kapsamı maddi olarak
 * değiştirdiğinde ("aslında multiplayer istiyorum") hangi onayın neden
 * açıldığı belgede durur. Aşağı-akış onayları da açılır — fikir değişince
 * teknik onay ayakta kalamaz.
 */
export function reopenStage(approval: StageApproval, reason: string): StageApproval {
  return {
    status: 'discovery',
    approvedAtRevision: null,
    approvedAt: null,
    reopenedReason: reason
  };
}

/**
 * Eski akışta plan aşamasının açılma koşulu.
 *
 * Bu koşul UI'da yaşıyordu ve V3 aşama rayı geldiğinde ekranın iki yarısı
 * çelişti: ray "plan kilitli" derken Plan sekmesi açıktı. Koşul artık tek
 * yerde duruyor ki iki taraf da aynı şeyi okusun.
 */
export function legacyPlanUnlocked(project: ProjectDocumentV5): boolean {
  return Boolean(
    project.sourceIdeaRevisionId
    || project.requirements?.length
    || project.decisions?.length
    || project.tasks?.length
  );
}
