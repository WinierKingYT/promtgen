import type { ProjectDocumentV5 } from '../contracts.js';

/**
 * Geçersizleştirme grafiği — bir karar değişince neyin bayatladığı.
 *
 * V3'ün izlenebilirlik zinciri tek yönlü değil:
 *
 * ```
 * Idea Concern → Idea Decision → Technical Concern → Technical Decision
 *                              → Requirement → Task → Test
 * ```
 *
 * Zincirin **tersi** olmadan kullanıcı bir kararı değiştirdiğinde neyi
 * kaybettiğini bilemez. Bir ay sonra *"atın sürekli stamina tüketmesini
 * kaldırmak istiyorum"* dendiğinde sistem hangi teknik kararın etkilendiğini,
 * hangi gereksinimin bayatladığını ve hangi görev/testin yeniden ele alınması
 * gerektiğini söyleyebilmeli.
 *
 * **Hiçbir kenar tahmin edilmez.** Grafik yalnız belgede gerçekten duran
 * bağlardan kurulur: `evidence`, `ConcernDecision.decisionId`, `traceLinks`,
 * `requirementIds`, `verificationIds`. Benzerlik veya AI tahmini kullanılsaydı
 * "5 görev geçersiz" cümlesi güvenilmez olurdu ve kullanıcı ona bakarak karar
 * veriyor.
 */

export interface InvalidationImpact {
  /** Değişen kararın kendisine bağlı fikir/teknik konular. */
  concernIds: string[];
  /** Gerekçesi değişen teknik kararlar. */
  technicalDecisionIds: string[];
  requirementIds: string[];
  taskIds: string[];
  testCaseIds: string[];
  /** Kullanıcıya gösterilecek satırlar; yüzde değil sayı, sıfırsa satır yok. */
  lines: string[];
}

function intersects(a: readonly string[], b: ReadonlySet<string>): boolean {
  return a.some(item => b.has(item));
}

/**
 * Bir canonical kararın değişmesi neyi geçersizleştirir?
 *
 * Yayılma sırası zincirin kendisidir; her adım bir öncekinin sonucunu girdi
 * alır. Değişen kararın kendisi listelerde yer almaz — kullanıcı onu zaten
 * biliyor.
 */
export function invalidationImpact(project: ProjectDocumentV5, changedDecisionId: string): InvalidationImpact {
  const changed = String(changedDecisionId || '');
  if (!changed) return emptyImpact();

  // 1. Bu karara bağlanmış konular (her iki aşamada da).
  const concernDecisions = [
    ...(project.ideaDesign?.concernDecisions || []),
    ...(project.solutionDesign?.concernDecisions || [])
  ];
  const concernIds = concernDecisions
    .filter(decision => decision.decisionId === changed)
    .map(decision => decision.concernId);
  const invalidatedConcerns = new Set(concernIds);

  // 2. Gerekçesi bu karara (ya da bu karara bağlı bir konuya) dayanan teknik
  //    kararlar. Kanıt taşımanın karşılığını burada alıyoruz: bir güven yüzdesi
  //    bu kenarı hiç kuramazdı.
  const technicalDecisionIds = (project.decisions || [])
    .filter(decision => decision.stage === 'technical' && decision.id !== changed)
    .filter(decision => {
      const evidence = decision.evidence;
      if (!evidence) return false;
      return evidence.ideaDecisionIds.includes(changed)
        || intersects(evidence.ideaConcernIds, invalidatedConcerns);
    })
    .map(decision => decision.id);

  // 3. Etkilenen kararlardan gereksinimlere `traceLinks` üzerinden.
  const affectedDecisions = new Set([changed, ...technicalDecisionIds]);
  const requirementIds = [...new Set(
    (project.traceLinks || [])
      .filter(link => link.fromType === 'decision' && affectedDecisions.has(link.fromId) && link.toType === 'requirement')
      .map(link => link.toId)
  )];
  const affectedRequirements = new Set(requirementIds);

  // 4. Bu gereksinimleri uygulayan görevler ve doğrulayan testler.
  const taskIds = (project.tasks || [])
    .filter(task => intersects(task.requirementIds, affectedRequirements))
    .map(task => task.id);
  const verificationIds = new Set(
    (project.tasks || [])
      .filter(task => taskIds.includes(task.id))
      .flatMap(task => task.verificationIds)
  );
  const testCaseIds = (project.testCases || [])
    .filter(testCase => intersects(testCase.requirementIds, affectedRequirements) || verificationIds.has(testCase.id))
    .map(testCase => testCase.id);

  return withLines({ concernIds, technicalDecisionIds, requirementIds, taskIds, testCaseIds, lines: [] });
}

function emptyImpact(): InvalidationImpact {
  return { concernIds: [], technicalDecisionIds: [], requirementIds: [], taskIds: [], testCaseIds: [], lines: [] };
}

/**
 * Etki cümleleri.
 *
 * Fiiller kasıtlı olarak farklı: teknik karar **gözden geçirilmeli** (gerekçesi
 * değişti, kararın kendisi hâlâ doğru olabilir), gereksinim **bayatlamış
 * olabilir** (dayandığı karar değişti), görev **geçersiz** (uyguladığı
 * gereksinimin öncülü kalmadı). Hepsine aynı kesinlikte davranmak ya paniğe ya
 * da kayıtsızlığa yol açardı.
 */
function withLines(impact: InvalidationImpact): InvalidationImpact {
  const lines: string[] = [];
  if (impact.technicalDecisionIds.length) lines.push(`${impact.technicalDecisionIds.length} teknik karar gözden geçirilmeli.`);
  if (impact.requirementIds.length) lines.push(`${impact.requirementIds.length} gereksinim bayatlamış olabilir.`);
  if (impact.taskIds.length) lines.push(`${impact.taskIds.length} görev geçersiz.`);
  if (impact.testCaseIds.length) lines.push(`${impact.testCaseIds.length} test yeniden ele alınmalı.`);
  return { ...impact, lines };
}

export interface ConcernTrace {
  concernId: string;
  found: boolean;
  /** Konuyu karara bağlayan canonical karar; henüz yoksa null. */
  decisionId: string | null;
  requirementIds: string[];
  taskIds: string[];
  testCaseIds: string[];
}

/**
 * Bir konudan ileriye doğru zincir: konu → karar → gereksinim → görev → test.
 *
 * `found: false`, bilinmeyen bir kimlik için boş zincir döndürmekten farklıdır:
 * "bu konunun hiçbir izi yok" ile "böyle bir konu yok" aynı şey değil ve ikisi
 * ekranda aynı görünürse kullanıcı yanlış sonuca varır.
 */
export function concernTrace(project: ProjectDocumentV5, concernId: string): ConcernTrace {
  const exists = [...(project.ideaDesign?.concerns || []), ...(project.solutionDesign?.concerns || [])]
    .some(concern => concern.id === concernId);
  if (!exists) {
    return { concernId, found: false, decisionId: null, requirementIds: [], taskIds: [], testCaseIds: [] };
  }

  const decision = [...(project.ideaDesign?.concernDecisions || []), ...(project.solutionDesign?.concernDecisions || [])]
    .find(item => item.concernId === concernId);
  const decisionId = decision?.decisionId || null;

  if (!decisionId) {
    return { concernId, found: true, decisionId: null, requirementIds: [], taskIds: [], testCaseIds: [] };
  }

  const requirementIds = [...new Set(
    (project.traceLinks || [])
      .filter(link => link.fromType === 'decision' && link.fromId === decisionId && link.toType === 'requirement')
      .map(link => link.toId)
  )];
  const affectedRequirements = new Set(requirementIds);
  const taskIds = (project.tasks || [])
    .filter(task => intersects(task.requirementIds, affectedRequirements))
    .map(task => task.id);
  const testCaseIds = (project.testCases || [])
    .filter(testCase => intersects(testCase.requirementIds, affectedRequirements))
    .map(testCase => testCase.id);

  return { concernId, found: true, decisionId, requirementIds, taskIds, testCaseIds };
}
