import { coachProgress, nextCoachTurn } from './adaptive-idea-coach.js';
import { ideaApprovalReadiness } from './idea-approval.js';
import { currentStage, legacyPlanUnlocked, PROJECT_STAGES, stageGate } from './project-stages.js';
import { stageWorkAvailable } from './conversion-v2.js';
import { solutionApprovalReadiness } from './solution-approval.js';
import { readinessLines } from './stage-approval.js';
import type { ProjectDocumentV5, ProjectStage } from '../contracts.js';

/**
 * Workspace görünüm modeli — ekranın okuduğu tek kaynak.
 *
 * **Kullanıcı sistemi yönetmez.** `Concern Map`, `Decision Graph`,
 * `Canonical Revision`, `Requirement Trace` iç modeldir; kullanıcı bunları
 * öğrenmek zorunda kalmaz. Ekranda görünen şey şudur:
 *
 * > "Şimdi atın oyuncuyla ilişkisini netleştiriyoruz."
 *
 * Bu modül React'ten bağımsız çünkü asıl karar burada veriliyor: hangi aşama
 * açık, kilitliyse neden, şu an ne konuşuluyor. Bileşende dursaydı test etmek
 * için DOM gerekirdi ve dil kuralları (jargon yok, yüzde yok) denetlenemezdi.
 */

export type StageState = 'done' | 'current' | 'locked';

export interface StageProgressGroup {
  label: string;
  /** `done` tamamlandı, `active` üzerinde çalışılıyor, `todo` sırada. */
  state: 'done' | 'active' | 'todo';
}

export interface StageRailEntry {
  id: ProjectStage;
  label: string;
  /** Şu an ne olduğunu anlatan sade cümle; sistem terimi içermez. */
  caption: string;
  state: StageState;
  /** Kilitliyse nedeni; kilit sessiz olmaz. */
  lockReason: string | null;
  /** Yalnız içinde bulunulan aşama için: engel satırları. */
  lines: string[];
  /** Yalnız fikir aşaması için: konu grupları. Anket görünümü verilmez. */
  groups: StageProgressGroup[];
}

const LABELS: Readonly<Record<ProjectStage, string>> = {
  idea: 'FİKİR',
  solution: 'ÇÖZÜM',
  plan: 'PLAN',
  handoff: 'DEVİR'
};

// Aşama sırası `project-stages` içinde tanımlı. Buraya kopyalamak, beşinci bir
// aşama eklendiğinde birini değiştirip diğerini unutmanın yoluydu.
const ORDER = PROJECT_STAGES;

const STATIC_CAPTIONS: Readonly<Record<Exclude<ProjectStage, 'idea'>, string>> = {
  solution: 'Bunu nasıl kuracağımızı tasarlıyoruz.',
  plan: 'Gereksinimleri, görevleri ve testleri hazırlıyoruz.',
  handoff: 'Kodlama aracına devredilecek paketi hazırlıyoruz.'
};

/**
 * Fikir aşamasının başlığı, koçun sıradaki turundan gelir — sabit bir metin
 * değil. Kullanıcı ekranda kendi projesinin cümlesini görür.
 */
function ideaCaption(project: ProjectDocumentV5): string {
  const turn = nextCoachTurn(project);
  if (turn.kind === 'framing') return 'Ne tasarladığımızı netleştiriyoruz.';
  if (turn.kind === 'ready') return 'Fikir tasarımı yeterince net.';

  const concern = (project.ideaDesign?.concerns || []).find(item => item.id === turn.concernId);
  return concern ? `Şimdi “${concern.title}” konusunu netleştiriyoruz.` : 'Fikri birlikte netleştiriyoruz.';
}

/**
 * İlerleme anket gibi görünmez. `47/62 soru` yerine konular kendi adlarıyla
 * gruplanır: tamamlanan, üzerinde çalışılan, sırada olan.
 */
function ideaGroups(project: ProjectDocumentV5): StageProgressGroup[] {
  const progress = coachProgress(project);
  const activeConcernId = nextCoachTurn(project).concernId;
  const activeCategory = (project.ideaDesign?.concerns || [])
    .find(concern => concern.id === activeConcernId)?.category;

  return progress.groups.map(group => ({
    label: group.category,
    state: group.resolved === group.total
      ? 'done'
      : group.category === activeCategory ? 'active' : 'todo'
  }));
}

function stateOf(stage: ProjectStage, active: ProjectStage, open: boolean): StageState {
  if (stage === active) return 'current';
  if (ORDER.indexOf(stage) < ORDER.indexOf(active)) return 'done';
  return open ? 'current' : 'locked';
}

/**
 * Üst düzey dört aşama: `FİKİR · ÇÖZÜM · PLAN · DEVİR`.
 *
 * Kilitli aşama gizlenmez. Kullanıcı nereye gittiğini görmeli; görmediği bir
 * yolun kapalı olduğunu anlayamaz. Kilidin nedeni de yazılır.
 */
export function stageRail(project: ProjectDocumentV5): StageRailEntry[] {
  if (!railApplies(project)) return [];
  const active = currentStage(project);

  return ORDER.map(stage => {
    const gate = stageGate(project, stage);
    const state = stateOf(stage, active, gate.open);
    const isCurrent = state === 'current' && stage === active;

    return {
      id: stage,
      label: LABELS[stage],
      caption: stage === 'idea' ? ideaCaption(project) : STATIC_CAPTIONS[stage],
      state,
      lockReason: state === 'locked' ? gate.reason : null,
      lines: isCurrent ? currentStageLines(project, stage) : [],
      groups: isCurrent && stage === 'idea' ? ideaGroups(project) : []
    };
  });
}

function currentStageLines(project: ProjectDocumentV5, stage: ProjectStage): string[] {
  if (stage === 'idea') return readinessLines(ideaApprovalReadiness(project));
  if (stage === 'solution') return readinessLines(solutionApprovalReadiness(project));
  return [];
}

/**
 * Ray ne zaman gösterilir?
 *
 * Aşama modeline girmiş belgelerde her zaman. Girmemiş olanlarda **yalnız
 * henüz canonical planı yoksa** — çünkü eski akışla üretilmiş bir planı olan
 * belgede ray "PLAN kilitli: fikir tasarımı onaylanmadı" derdi, oysa plan
 * çalışıyor ve erişilebilir. Ekranın iki yarısının birbiriyle çelişmesi,
 * ilerleme göstergesi hiç olmamasından kötüdür.
 *
 * Yeni bir proje ise doğal olarak fikir aşamasındadır; orada ray doğru şeyi
 * söyler ve gösterilir.
 */
function railApplies(project: ProjectDocumentV5): boolean {
  return stageWorkAvailable(project) || !legacyPlanUnlocked(project);
}
