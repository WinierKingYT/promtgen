import { ideaApprovalReadiness } from './idea-approval.js';
import { solutionApprovalReadiness } from './solution-approval.js';
import type { Concern, ProjectDocumentV5 } from '../contracts.js';

/**
 * Conversion V2 — Uygulama Planı'na geçiş.
 *
 * V2'de tek yapısal değişiklik var ama büyük: `Idea → Plan` doğrudan geçişi
 * kaldırıldı. Plan artık **iki kapıdan** sonra üretilir. Bugün teknik kararlar
 * ya hiç konuşulmuyor ya da gereksinimlerin içine gömülüyor; kapı bunu
 * imkânsız hâle getiriyor.
 *
 * **Göç cezaya çevrilmez.** V3 öncesi belgelerde `ideaDesign` boş ve onay
 * `draft`. Bunlara kapıyı uygulasaydık, çalışan her mevcut proje bir anda
 * dönüştürülemez hâle gelirdi. Bu yüzden kapı yalnız aşama modeline **girmiş**
 * belgelerde geçerli; eski belgeler eski yoldan dönüşmeye devam eder. İki model
 * bir süre yan yana yaşar — `planningPhaseToStage` ile kurulan aynı ilke.
 */

/**
 * Belge aşama modeline girmiş mi?
 *
 * Ölçüt **kullanıcının eylemi**, sistemin eylemi değil: bir konuyu karara
 * bağlamak, ertelemek, kapsam dışı bırakmak ya da bir onay sürecini başlatmak.
 *
 * Konuların **var olması** yetmez. Keşif turu her turda konu üretiyor; bunu
 * ölçüt saysaydık, kullanıcı tek bir keşif turu çalıştırdığı anda ürünün akışı
 * altından değişir ve planı iki yeni onayın ardında bulurdu. Konu üretmek
 * sistemin yolu **önermesi**; o yola girmek kullanıcının kararı.
 *
 * Bayrak alanı tutmuyoruz çünkü bayrak, belgenin gerçek durumundan sapabilirdi.
 */
export function usesStageModel(project: ProjectDocumentV5): boolean {
  const idea = project.ideaDesign;
  const solution = project.solutionDesign;
  if (!idea || !solution) return false;
  if (idea.approval.status !== 'draft' || solution.approval.status !== 'draft') return true;
  return [...idea.concerns, ...solution.concerns].some(concern => concern.status !== 'open');
}

/**
 * Aşama paneli gösterilsin mi?
 *
 * `usesStageModel`'den ayrı bir soru: panel, kullanıcının o yola **girmesini**
 * sağlayan şey. Girmiş olmasını beklemek, kapıyı ardından kilitlemek olurdu.
 * Ölçüt "cevaplanacak somut bir konu var mı" — boş bir form kullanıcıya neyi
 * cevapladığını anlatmaz.
 */
export function stageWorkAvailable(project: ProjectDocumentV5): boolean {
  if (!project.ideaDesign || !project.solutionDesign) return false;
  return usesStageModel(project)
    || project.ideaDesign.concerns.length > 0
    || project.solutionDesign.concerns.length > 0;
}

/**
 * Aşama modelinden gelen dönüşüm engelleri.
 *
 * Sırayla bildirilir: fikir kapısı geçilmeden teknik kapının engelini
 * göstermek, kullanıcıya henüz sırası gelmemiş bir işi göstermek olurdu.
 */
export function stageConversionBlockers(project: ProjectDocumentV5): string[] {
  if (!usesStageModel(project)) return [];

  const idea = ideaApprovalReadiness(project);
  if (!idea.canApprove) {
    return [`Fikir tasarımında ${idea.obstacles.length} engel var; plan üretilemez.`];
  }
  if (project.ideaDesign.approval.status !== 'approved') {
    return ['Fikir tasarımı onaylanmadan plan üretilemez.'];
  }

  const solution = solutionApprovalReadiness(project);
  if (!solution.canApprove) {
    return [`Teknik tasarımda ${solution.obstacles.length} engel var; plan üretilemez.`];
  }
  if (project.solutionDesign.approval.status !== 'approved') {
    return ['Teknik çözüm tasarımı onaylanmadan plan üretilemez.'];
  }

  return [];
}

export interface ConversionSources {
  /** Plana taşınacak kabul edilmiş fikir kararlarının kimlikleri. */
  ideaDecisionIds: string[];
  /** Plana taşınacak kabul edilmiş teknik kararların kimlikleri. */
  technicalDecisionIds: string[];
  /**
   * Kullanıcının "gerek yok" dediği konular. Kapsam disiplini bir **çıktıdır**:
   * elenen şey de değerli bir sonuçtur ve plana kapsam dışı olarak yazılır.
   */
  outOfScope: string[];
  /** Ertelenenler kaybolmaz; plana varsayım/açık konu olarak taşınır. */
  deferred: string[];
  openQuestions: string[];
}

const titlesWithStatus = (concerns: readonly Concern[], status: Concern['status']) =>
  concerns.filter(concern => concern.status === status).map(concern => concern.title);

/**
 * Dönüşümün besleneceği kaynaklar.
 *
 * Hiçbir şey uydurulmaz ve hiçbir şey sessizce düşmez: ertelenen ve "bu projeye
 * ait değil" denen konular da adlarıyla taşınır. Sessiz düşüş, kullanıcının
 * verdiği kararı görünmez kılardı.
 */
export function conversionSources(project: ProjectDocumentV5): ConversionSources {
  const ideaConcerns = project.ideaDesign?.concerns || [];
  const solutionConcerns = project.solutionDesign?.concerns || [];
  const accepted = (project.decisions || []).filter(decision => decision.status === 'accepted');

  return {
    ideaDecisionIds: accepted.filter(decision => decision.stage === 'idea').map(decision => decision.id),
    technicalDecisionIds: accepted.filter(decision => decision.stage === 'technical').map(decision => decision.id),
    outOfScope: [
      ...titlesWithStatus(ideaConcerns, 'irrelevant'),
      ...titlesWithStatus(solutionConcerns, 'irrelevant')
    ],
    deferred: [
      ...titlesWithStatus(ideaConcerns, 'deferred'),
      ...titlesWithStatus(solutionConcerns, 'deferred')
    ],
    openQuestions: [
      ...(project.ideaDesign?.openQuestions || []),
      ...(project.solutionDesign?.openQuestions || [])
    ]
  };
}

/** Aşama kararlarının plana yazıldığı blok; her dönüşümde yeniden kurulur. */
const SCOPE_MARKER = 'Aşama kararların:';

/**
 * Kapsam kararlarını plana taşır.
 *
 * **Kapsam disiplini bir çıktıdır.** Kullanıcı "bu projeye ait değil" ya da
 * "sonra" dediğinde bir iş yapmıştır; bunu plana yazmazsak o emek görünmez
 * olur ve aynı konu bir sonraki turda yeniden tartışılır.
 *
 * Ertelenen ile kapsam dışı **ayrı** yazılır: "sonra" geri dönülebilir bir
 * karardır, "ait değil" değil. İkisini aynı listeye koymak, kullanıcının
 * verdiği iki farklı kararı tek karara indirgerdi.
 *
 * Blok işaretli ve her seferinde yeniden kurulduğu için dönüşüm tekrarlansa da
 * içerik çoğalmaz.
 */
export function applyStageScopeToPlan(project: ProjectDocumentV5): ProjectDocumentV5 {
  const sources = conversionSources(project);
  if (!sources.outOfScope.length && !sources.deferred.length) return project;

  const scope = project.sections?.scope;
  if (!scope) return project;

  const block = [
    SCOPE_MARKER,
    ...(sources.outOfScope.length
      ? ['Kapsam dışı bırakılanlar:', ...sources.outOfScope.map(title => `- ${title}`)]
      : []),
    ...(sources.deferred.length
      ? ['Sonraya bırakılanlar:', ...sources.deferred.map(title => `- ${title}`)]
      : [])
  ].join('\n');

  const existing = String(scope.content || '');
  const base = existing.includes(SCOPE_MARKER)
    ? existing.slice(0, existing.indexOf(SCOPE_MARKER)).trimEnd()
    : existing.trimEnd();

  return {
    ...project,
    sections: {
      ...project.sections,
      scope: { ...scope, content: base ? [base, block].join('\n\n') : block, status: 'draft' }
    }
  };
}
