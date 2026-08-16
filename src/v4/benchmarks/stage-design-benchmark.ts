import { nextCoachTurn } from '../application/adaptive-idea-coach.js';
import { isBlocking, normalizeConcern, normalizeConcernDecision } from '../application/concerns.js';
import { discoverConcerns } from '../application/idea-design-service.js';
import { approveIdeaDesign } from '../application/idea-approval.js';
import { applySolutionDiscovery, canDiscoverSolution } from '../application/solution-discovery-service.js';
import { solutionApprovalReadiness } from '../application/solution-approval.js';
import { createProjectDocument } from '../project-document.js';
import type { DiscoveryOutput, SolutionDiscoveryOutput } from '../ai/schemas/schemas.js';
import type { Decision, ProjectDocumentV5 } from '../contracts.js';

/**
 * Idea Design / Solution Design benchmark'ı.
 *
 * **Ne ölçer:** sabitlenmiş AI çıktısı verildiğinde çekirdeğin doğru davranıp
 * davranmadığını. Model kalitesini ölçmez — girdi zaten sabit. Ölçtüğü şey,
 * V3'ün söz verdiği davranışların gerçekten kodda olması:
 *
 * 1. Kritik konular keşfediliyor mu (bilinmeyen alanda da),
 * 2. İlk soru en yüksek bilgi kazançlısı mı,
 * 3. Kapı bloklayan konu varken onayı reddediyor, çözülünce açıyor mu,
 * 4. Gerekçesiz geri dönülemez teknoloji önerisi eleniyor mu,
 * 5. Teknik kapı ADR bağı olmayan kararı geçiriyor mu.
 *
 * Bu ayrım kasıtlı: sağlayıcı değişince bu benchmark'ın sonucu değişmemeli.
 * Değişirse ölçtüğü şey davranış değil, modelin o günkü hâli olurdu.
 */

export interface StageDesignScenario {
  id: string;
  title: string;
  category: string;
  idea: string;
  /** Ön koşul: bu suite çerçevelemeyi ölçmez, geçilmiş sayar. */
  framing: { kind: 'product' | 'feature' | 'system' | 'unknown'; domain: string; environment: string };
  discovery: Pick<DiscoveryOutput, 'options' | 'openQuestions' | 'uncertainty'>;
  /** Keşfedilmesi beklenen kritik konu başlıkları (küçük harf, alt dize eşleşmesi). */
  expectedCriticalTopics: string[];
  /** İlk sorunun hangi konuyu hedeflemesi gerektiği. */
  expectedTopQuestionTopic: string;
  solutionDiscovery: Pick<SolutionDiscoveryOutput, 'technicalConcerns' | 'candidates' | 'openQuestions'>;
  expectedAdmittedCandidates: string[];
  expectedRefusedCandidates: string[];
}

export interface StageDesignChecks {
  /** Beklenen kritik konuların kaçı keşfedildi (0–1). */
  concernRecall: number;
  /** İlk soru doğru konuyu hedefledi mi. */
  topQuestionCorrect: boolean;
  /** Bloklayan konu varken onay reddedildi mi. */
  gateRefusedWhileBlocked: boolean;
  /** Konular çözülünce onay verildi mi. */
  gateOpenedWhenClear: boolean;
  /** Fikir onayından önce teknik keşif kapalı mıydı. */
  solutionLockedBeforeIdea: boolean;
  /** Gerekçesiz adaylar elendi, gerekçeliler kabul edildi mi. */
  candidateFilterCorrect: boolean;
  /** ADR bağı olmayan teknik karar kapıya takıldı mı. */
  adrLinkEnforced: boolean;
}

export interface StageDesignResult {
  id: string;
  title: string;
  category: string;
  passed: boolean;
  checks: StageDesignChecks;
  failures: string[];
}

export interface StageDesignReport {
  suiteId: 'stage-design-v1';
  generatedAt: string;
  scenarioCount: number;
  passedCount: number;
  passRate: number;
  aggregate: {
    concernRecall: number;
    topQuestionAccuracy: number;
  };
  results: StageDesignResult[];
}

/**
 * Beklenti ile başlık karşılaştırması.
 *
 * Türkçe yerel küçültme **bilerek** kullanılmıyor: `toLocaleLowerCase('tr-TR')`
 * "Idempotency"yi "ıdempotency" yapar ve teknik terim beklentisi sessizce
 * ıskalanır. Burada karşılaştırılan şey Türkçe metin değil, kimlik niyetli
 * başlıklar.
 */
const normalize = (value: string) => String(value || '').toLowerCase();

function ideaDecision(id: string, title: string): Decision {
  return {
    stage: 'idea', id, title, decision: title, rationale: 'Benchmark senaryosunda karara bağlandı.',
    alternatives: [], consequences: [], status: 'accepted', sourceSuggestionId: '', affectedSectionIds: []
  };
}

function runScenario(scenario: StageDesignScenario): StageDesignResult {
  const failures: string[] = [];
  const base = createProjectDocument({ idea: scenario.idea }) as ProjectDocumentV5;
  // Çerçeveleme bu suite'in ÖLÇTÜĞÜ şey değil, ön koşulu: senaryolar koçun
  // ilk sorusunu geçmiş durumdan başlar. Bu yüzden senaryo verisinden gelir,
  // harness tarafından uydurulmaz.
  base.ideaDesign.framing = { ...scenario.framing, source: 'confirmed' };

  // --- Fikir tasarımı ---
  const concerns = discoverConcerns(scenario.discovery);
  base.ideaDesign.concerns = concerns;

  const found = scenario.expectedCriticalTopics.filter(topic =>
    concerns.some(concern => normalize(concern.title).includes(normalize(topic)))
  );
  const concernRecall = scenario.expectedCriticalTopics.length
    ? found.length / scenario.expectedCriticalTopics.length
    : 1;
  if (concernRecall < 1) {
    failures.push(`Keşfedilmeyen kritik konu: ${scenario.expectedCriticalTopics.filter(topic => !found.includes(topic)).join(', ')}`);
  }

  const turn = nextCoachTurn(base);
  const askedConcern = concerns.find(concern => concern.id === turn.concernId);
  const topQuestionCorrect = Boolean(askedConcern && normalize(askedConcern.title).includes(normalize(scenario.expectedTopQuestionTopic)));
  if (!topQuestionCorrect) {
    failures.push(`İlk soru "${scenario.expectedTopQuestionTopic}" yerine "${askedConcern?.title ?? turn.kind}" konusunu hedefledi.`);
  }

  // --- Fikir kapısı ---
  const blocked = concerns.filter(isBlocking);
  const refusal = approveIdeaDesign(base, { revision: 1, at: '2026-08-16T00:00:00.000Z' });
  const gateRefusedWhileBlocked = blocked.length > 0 && !refusal.approved;
  if (!gateRefusedWhileBlocked) failures.push('Bloklayan konu varken kapı onayı reddetmedi.');

  const solutionLockedBeforeIdea = !canDiscoverSolution(base).open;
  if (!solutionLockedBeforeIdea) failures.push('Fikir onaylanmadan teknik keşif açıldı.');

  // Kullanıcı kritik konuları karara bağlıyor; her karar canonical kayda geçiyor.
  const resolved = { ...base };
  resolved.ideaDesign = {
    ...base.ideaDesign,
    concerns: concerns.map(concern => normalizeConcern({ ...concern, status: 'decided' })),
    concernDecisions: concerns.map((concern, index) => normalizeConcernDecision({
      id: `cd-${index}`, concernId: concern.id, answer: 'Benchmark cevabı', decisionId: `dec-${concern.id}`
    }, index))
  };
  resolved.decisions = concerns.map(concern => ideaDecision(`dec-${concern.id}`, concern.title));

  const approval = approveIdeaDesign(resolved, { revision: 2, at: '2026-08-16T00:00:00.000Z' });
  const gateOpenedWhenClear = approval.approved;
  if (!gateOpenedWhenClear) {
    failures.push(`Konular çözüldüğü hâlde kapı açılmadı: ${approval.approved ? '' : approval.reason}`);
  } else {
    resolved.ideaDesign = { ...resolved.ideaDesign, approval: approval.approval };
  }

  // --- Teknik tasarım ---
  // Adaylar gerekçelerini konu BAŞLIĞIYLA gösteriyor; başlığı gerçek kimliğe
  // yalnız burada çeviriyoruz. Karşılığı olmayan başlık çevrilmez ve aday
  // gerekçesiz kalır — uydurulmuş gerekçenin benchmark'taki karşılığı budur.
  const idByTitle = new Map(concerns.map(concern => [normalize(concern.title), concern.id]));
  const wired = {
    ...scenario.solutionDiscovery,
    candidates: scenario.solutionDiscovery.candidates.map(candidate => ({
      ...candidate,
      derivedFromIdeaConcernIds: (candidate.derivedFromIdeaConcernIds || [])
        .map(title => idByTitle.get(normalize(title)))
        .filter((id): id is string => Boolean(id))
    }))
  };

  const discovery = applySolutionDiscovery(wired, resolved);
  const admitted = discovery.candidates.map(candidate => candidate.title).sort();
  const refused = discovery.refused.map(item => item.candidate.title).sort();
  const candidateFilterCorrect =
    JSON.stringify(admitted) === JSON.stringify([...scenario.expectedAdmittedCandidates].sort())
    && JSON.stringify(refused) === JSON.stringify([...scenario.expectedRefusedCandidates].sort());
  if (!candidateFilterCorrect) {
    failures.push(`Aday süzgeci beklenenden farklı: kabul=${admitted.join('|')} ret=${refused.join('|')}`);
  }

  // Teknik konu karara bağlanmış ama ADR'ye bağlanmamış: kapı takılmalı.
  const unlinked = { ...resolved };
  unlinked.solutionDesign = {
    ...resolved.solutionDesign,
    concerns: discovery.concerns.map(concern => normalizeConcern({ ...concern, status: 'decided' })),
    concernDecisions: discovery.concerns.map((concern, index) => normalizeConcernDecision({
      id: `tcd-${index}`, concernId: concern.id, answer: 'Teknik cevap', decisionId: null
    }, index))
  };
  const adrLinkEnforced = solutionApprovalReadiness(unlinked).obstacles
    .some(obstacle => obstacle.kind === 'unlinked-technical-decision');
  if (!adrLinkEnforced) failures.push('ADR bağı olmayan teknik karar kapıya takılmadı.');

  const checks: StageDesignChecks = {
    concernRecall,
    topQuestionCorrect,
    gateRefusedWhileBlocked,
    gateOpenedWhenClear,
    solutionLockedBeforeIdea,
    candidateFilterCorrect,
    adrLinkEnforced
  };

  return {
    id: scenario.id,
    title: scenario.title,
    category: scenario.category,
    passed: failures.length === 0,
    checks,
    failures
  };
}

export function runStageDesignBenchmark(
  scenarios: readonly StageDesignScenario[],
  generatedAt: string
): StageDesignReport {
  const results = scenarios.map(runScenario);
  const passedCount = results.filter(result => result.passed).length;

  return {
    suiteId: 'stage-design-v1',
    generatedAt,
    scenarioCount: results.length,
    passedCount,
    passRate: results.length ? passedCount / results.length : 0,
    aggregate: {
      concernRecall: average(results.map(result => result.checks.concernRecall)),
      topQuestionAccuracy: average(results.map(result => (result.checks.topQuestionCorrect ? 1 : 0)))
    },
    results
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
