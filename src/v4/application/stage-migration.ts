import { classifyProjectDomain } from '../ai/domain-classifier.js';
import type { Decision, DecisionStage, ProjectDocumentV5, ProjectFraming } from '../contracts.js';

/**
 * V3 öncesi belgelerin aşama modeline göçü.
 *
 * Göç eklemelidir: hiçbir eski alan silinmez, revizyon geçmişi kaybedilmez.
 * Belge yüklenirken `normalizeProjectDocument` boş `ideaDesign`/`solutionDesign`
 * kapsayıcılarını zaten kuruyor; bu modül onların içini eski verilerden
 * **türetilebilen** kadarıyla doldurur.
 *
 * **Emin olunamayan hiçbir şey doldurulmaz.** Sessiz sınıflandırma,
 * kullanıcının hiç vermediği bir kararı ona atfetmek olurdu — ve bu, göçün
 * yapabileceği en pahalı hata. AI tahmini kullanılmaz; kural tabanı açık ve
 * denetlenebilir.
 */

/** Yalnız fikir tarafını ilgilendiren bölümler. */
const IDEA_SECTIONS = new Set(['vision', 'objectives', 'scope', 'requirements']);

/** Yalnız teknik tarafı ilgilendiren bölümler. */
const TECHNICAL_SECTIONS = new Set(['architecture', 'security', 'deployment', 'operations', 'testing']);

/**
 * Eski bir kararın aşaması **güvenle** belirlenebilir mi?
 *
 * Tek ölçüt kararın etkilediği bölümler. Yalnız fikir bölümlerine dokunuyorsa
 * fikir kararı, yalnız teknik bölümlere dokunuyorsa teknik karardır. Karışıksa
 * ya da hiç bölüm bildirmiyorsa **sınıflandırılmaz** — ikisinin arasında kalan
 * bir kararı bir tarafa itmek, kullanıcının vermediği bir kararı ona atfetmek
 * olur.
 *
 * Zaten sınıflandırılmış kararlara dokunulmaz: göç, mevcut bilgiyi tahminle
 * ezmez.
 */
export function classifyLegacyDecision(decision: Decision): DecisionStage {
  if (decision.stage === 'idea' || decision.stage === 'technical') return decision.stage;

  const sections = decision.affectedSectionIds || [];
  if (!sections.length) return 'legacy-unclassified';

  const ideaOnly = sections.every(section => IDEA_SECTIONS.has(section));
  const technicalOnly = sections.every(section => TECHNICAL_SECTIONS.has(section));

  if (ideaOnly) return 'idea';
  if (technicalOnly) return 'technical';
  return 'legacy-unclassified';
}

/**
 * Eski fikir özetinden çerçeveleme türetir.
 *
 * `source` **her zaman** `inferred` kalır. Göç sırasında `confirmed` yazmak,
 * kullanıcının hiç onaylamadığı bir çerçevelemeyi onaylanmış göstermek olurdu;
 * koç ilk soruyu bu yüzden atlar ve kullanıcı hiç sorulmayan bir soruya
 * "cevap vermiş" sayılırdı.
 */
export function framingFromLegacy(project: ProjectDocumentV5): ProjectFraming {
  const existing = project.ideaDesign?.framing;
  // Göç ikinci kez çalışırsa kullanıcının onayladığı çerçeveleme ezilmez.
  if (existing?.source === 'confirmed') return existing;

  const summary = project.ideaLabSession?.conceptSummary;
  const text = [project.identity?.originalIdea, summary?.summary, summary?.problemStatement]
    .filter(Boolean).join(' ');
  const domain = classifyProjectDomain(text);

  return {
    // Tür eski belgeden çıkarılamaz: "ürün mü, özellik mi, alt sistem mi"
    // sorusunun cevabı hiç sorulmadı. Uydurmak yerine sorulacak.
    kind: 'unknown',
    // `general`, sınıflandırıcının "bilmiyorum"u. Onu bir alan etiketi gibi
    // yazmak, hiç yapılmamış bir tespiti yapılmış göstermek olurdu.
    domain: domain === 'general' ? '' : domain,
    environment: existing?.environment || '',
    source: 'inferred'
  };
}

export interface StageMigrationReport {
  /** Aşamaya atanabilen ve atanamayan karar kimlikleri. */
  idea: string[];
  technical: string[];
  unclassified: string[];
  /** Teknik tarafa taşınan eski serbest metin yaklaşımlar. */
  legacyApproaches: string[];
  framing: ProjectFraming;
  /** Kullanıcıya gösterilecek özet; göç sessiz olmaz. */
  notes: string[];
}

/**
 * Belgeyi aşama modeline taşır ve **ne yapıldığını raporlar**.
 *
 * Yeni bir belge döndürür; girdi değiştirilmez.
 */
export function migrateToStageModel(project: ProjectDocumentV5): {
  project: ProjectDocumentV5;
  report: StageMigrationReport;
} {
  const decisions = (project.decisions || []).map(decision => ({
    ...decision,
    stage: classifyLegacyDecision(decision)
  }));

  const framing = framingFromLegacy(project);
  const legacyApproaches = [...new Set(project.ideaLabSession?.conceptSummary?.technicalApproaches || [])]
    .filter(item => typeof item === 'string' && item.trim());

  const report: StageMigrationReport = {
    idea: decisions.filter(decision => decision.stage === 'idea').map(decision => decision.id),
    technical: decisions.filter(decision => decision.stage === 'technical').map(decision => decision.id),
    unclassified: decisions.filter(decision => decision.stage === 'legacy-unclassified').map(decision => decision.id),
    legacyApproaches,
    framing,
    notes: []
  };

  report.notes = buildNotes(report);

  return {
    project: {
      ...project,
      decisions,
      ideaDesign: { ...project.ideaDesign, framing },
      solutionDesign: { ...project.solutionDesign, legacyApproaches }
    },
    report
  };
}

function buildNotes(report: StageMigrationReport): string[] {
  const notes: string[] = [];
  if (report.idea.length) notes.push(`${report.idea.length} karar fikir aşamasına yerleşti.`);
  if (report.technical.length) notes.push(`${report.technical.length} karar teknik aşamaya yerleşti.`);
  if (report.unclassified.length) {
    // Sınıflandırılamayan kararlar bir hata değil, dürüst bir sonuç. Ama
    // görünmez kalırlarsa kullanıcı onların var olduğunu hiç öğrenemez.
    notes.push(`${report.unclassified.length} kararın hangi aşamaya ait olduğu belirlenemedi; sınıflandırmayı sen yapacaksın.`);
  }
  if (report.legacyApproaches.length) {
    notes.push(`${report.legacyApproaches.length} eski teknik yaklaşım, teknik tasarım aşamasına not olarak taşındı.`);
  }
  return notes;
}
