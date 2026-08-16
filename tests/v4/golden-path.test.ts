import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coachProgress, nextCoachTurn } from '../../src/v4/application/adaptive-idea-coach.js';
import { normalizeConcern, normalizeConcernDecision, selectNextConcern } from '../../src/v4/application/concerns.js';
import { stageConversionBlockers } from '../../src/v4/application/conversion-v2.js';
import { discoverConcerns } from '../../src/v4/application/idea-design-service.js';
import { approveIdeaDesign, reopenIdeaApproval } from '../../src/v4/application/idea-approval.js';
import { invalidationImpact } from '../../src/v4/application/invalidation-graph.js';
import { currentStage } from '../../src/v4/application/project-stages.js';
import { approveSolutionDesign } from '../../src/v4/application/solution-approval.js';
import { promoteCandidate } from '../../src/v4/application/solution-design.js';
import { applySolutionDiscovery, canDiscoverSolution } from '../../src/v4/application/solution-discovery-service.js';
import { stageRail } from '../../src/v4/application/workspace-stages.js';
import { createProjectDocument } from '../../src/v4/project-document.js';
import type { Concern, Decision, ProjectDocumentV5 } from '../../src/v4/contracts.js';

/**
 * Golden Path — Ürün Modeli V3 §14'teki başarı ölçütünün tamamı.
 *
 * ```
 * ham fikir → keşif → karar → FİKİR ONAYI
 *           → teknik keşif → teknik karar → TEKNİK ONAY
 *           → plan → (bir ay sonra) karar değişimi → neyin bayatladığı
 * ```
 *
 * Bu test tek tek modülleri değil **aralarındaki bağı** kanıtlar. Her parça
 * kendi biriminde yeşilken zincir yine kopabilir: bir modülün çıktısı diğerinin
 * beklediği şekilde olmayabilir. Birim testleri bunu göremez, bu test görür.
 */

const AT_SISTEMI = 'Unity’de at sistemi yapmak istiyorum';
const NOW = '2026-08-16T00:00:00.000Z';

/** Keşif çıktısı: model, en önemsiz seçeneği başa koyarak yanıt veriyor. */
const DISCOVERY = {
  options: [
    {
      kind: 'feature' as const, title: 'İsim etiketi rengi', description: 'Atın isim etiketi rengi',
      pros: [], cons: [], effort: 'low' as const, impact: 'low' as const,
      affectedSections: ['scope' as const], recommended: false
    },
    {
      kind: 'architecture' as const, title: 'Sahiplik', description: 'At ulaşım aracı mı, kalıcı sistem mi',
      pros: [], cons: ['Kalıcı karakter kayıt ve ilerleme gerektirir'],
      effort: 'medium' as const, impact: 'high' as const,
      affectedSections: ['scope' as const], recommended: true
    },
    {
      kind: 'decision' as const, title: 'Stamina', description: 'At sürekli stamina tüketir mi',
      pros: [], cons: ['Bakım yükü'], effort: 'medium' as const, impact: 'high' as const,
      affectedSections: ['scope' as const], recommended: false
    }
  ],
  openQuestions: [],
  uncertainty: ['Sahiplik']
};

const SOLUTION_DISCOVERY = {
  technicalConcerns: [{
    title: 'Runtime durum saklama', description: 'At durumu çalışırken nerede tutulacak',
    category: 'Durum', importance: 'critical' as const,
    whyItMatters: 'Kayıt formatını ve animator bağını belirliyor',
    questions: ['Durum nerede tutulacak?'], uncertainty: 0.8, downstreamImpact: 0.9,
    dependsOnTitles: []
  }],
  candidates: [
    {
      concernTitle: 'Runtime durum saklama', title: 'ScriptableObject + JSON',
      category: 'Unity', rationale: 'Stamina kararının gereği.', tradeoffs: ['Editör bağımlılığı'],
      reversibility: 'costly' as const,
      derivedFromIdeaDecisionIds: ['dec-stamina'], derivedFromIdeaConcernIds: []
    },
    {
      concernTitle: 'Runtime durum saklama', title: 'Bulut kayıt servisi',
      category: 'Altyapı', rationale: 'Yaygın çözüm.', tradeoffs: [],
      reversibility: 'irreversible' as const,
      derivedFromIdeaDecisionIds: [], derivedFromIdeaConcernIds: []
    }
  ],
  openQuestions: []
};

function decide(project: ProjectDocumentV5, concern: Concern, answer: string, decisionId: string): ProjectDocumentV5 {
  const next = structuredClone(project);
  next.ideaDesign.concerns = next.ideaDesign.concerns.map(item =>
    item.id === concern.id ? normalizeConcern({ ...item, status: 'decided' }) : item
  );
  next.ideaDesign.concernDecisions = [
    ...next.ideaDesign.concernDecisions,
    normalizeConcernDecision({
      id: `cd-${concern.id}`, concernId: concern.id, answer, decidedAtRevision: 1, decisionId
    })
  ];
  next.decisions = [...next.decisions, {
    stage: 'idea', id: decisionId, title: concern.title, decision: answer,
    rationale: 'Kullanıcı kararı.', alternatives: [], consequences: [],
    status: 'accepted', sourceSuggestionId: '', affectedSectionIds: ['scope']
  } as Decision];
  return next;
}

describe('Golden Path — ham fikirden ajan devrine', () => {
  it('bastan sona calisir ve her asamada dogru seyi soyler', () => {
    // ---------- 1. Ham fikir ----------
    let project = createProjectDocument({ idea: AT_SISTEMI }) as ProjectDocumentV5;
    assert.equal(currentStage(project), 'idea');

    // Çerçeveleme bilinmiyorken ilk soru odur: "Unity'de at sistemi" diyen
    // birine "hedef kullanıcı kim?" sormak yanlış ilk sorudur.
    assert.equal(nextCoachTurn(project).kind, 'framing');
    project.ideaDesign.framing = { kind: 'system', domain: 'game', environment: 'Unity', source: 'confirmed' };

    // ---------- 2. Keşif ----------
    project.ideaDesign.concerns = discoverConcerns(DISCOVERY);
    const titles = project.ideaDesign.concerns.map(concern => concern.title);
    assert.ok(titles.includes('Sahiplik') && titles.includes('Stamina'), 'kritik konular keşfedilmedi');

    // Fikir doğrudan göreve çevrilmedi.
    assert.deepEqual(project.tasks, []);

    // İlk soru en yüksek bilgi kazançlısı: isim etiketi rengi değil.
    const first = nextCoachTurn(project);
    assert.equal(first.concernId, 'concern-sahiplik');

    // Teknik aşama henüz kapalı.
    assert.equal(canDiscoverSolution(project).open, false);

    // ---------- 3. Kullanıcı karar veriyor ----------
    const sahiplik = project.ideaDesign.concerns.find(concern => concern.id === 'concern-sahiplik')!;
    project = decide(project, sahiplik, 'At kalıcı bir karakter.', 'dec-sahiplik');

    const stamina = project.ideaDesign.concerns.find(concern => concern.id === 'concern-stamina')!;
    project = decide(project, stamina, 'Stamina sürekli tükenir.', 'dec-stamina');

    // Önemsiz konu hâlâ açık ama kapıyı bloklamıyor.
    assert.equal(selectNextConcern(project.ideaDesign.concerns)?.title, 'İsim etiketi rengi');
    assert.equal(coachProgress(project).blocking, 0);

    // Engel kalmadı ama onay hâlâ verilmedi: teknik aşama açılmaz. Bloklayan
    // konuyu çözmek onaylamakla aynı şey değil; aksi hâlde kullanıcı son
    // kararı vermeden bir sonraki aşamaya sürüklenirdi.
    assert.equal(canDiscoverSolution(project).open, false);
    assert.match(canDiscoverSolution(project).reason || '', /henüz onaylanmadı/);

    // ---------- 4. "Fikir tasarımı yeterince net" ----------
    const ideaApproval = approveIdeaDesign(project, { revision: 2, at: NOW });
    assert.equal(ideaApproval.approved, true, ideaApproval.approved ? '' : ideaApproval.reason);
    project.ideaDesign.approval = ideaApproval.approved ? ideaApproval.approval : project.ideaDesign.approval;

    assert.equal(currentStage(project), 'solution');
    assert.equal(canDiscoverSolution(project).open, true);

    // ---------- 5. Teknik keşif ----------
    const solution = applySolutionDiscovery(SOLUTION_DISCOVERY, project);

    // Gerekçesiz geri dönülemez öneri elendi; sessizce değil, nedeniyle.
    assert.deepEqual(solution.candidates.map(item => item.title), ['ScriptableObject + JSON']);
    assert.equal(solution.refused.length, 1);
    assert.match(solution.refused[0].reason, /hangi fikir kararından/i);

    project.solutionDesign.concerns = solution.concerns;
    project.solutionDesign.candidates = solution.candidates;

    // ---------- 6. Öneri → karar ----------
    const promotion = promoteCandidate(solution.candidates[0], project, {
      statement: 'Runtime durum ScriptableObject + JSON ile tutulacak.',
      rationale: 'Stamina kararının gereği; editörde düzenlenebilir kalmalı.',
      rejectedAlternatives: [{ candidateId: 'x', title: 'Bulut kayıt servisi', reason: 'Çevrimdışı oynanışı bozar.' }],
      revision: 3
    });
    assert.equal(promotion.promoted, true, promotion.promoted ? '' : promotion.reason);
    if (!promotion.promoted) return;

    // Karar bir ADR: neden seçilmediği de duruyor, güven yüzdesi yok.
    assert.equal(promotion.decision.rejectedAlternatives?.[0].reason, 'Çevrimdışı oynanışı bozar.');
    assert.deepEqual(promotion.decision.evidence?.ideaDecisionIds, ['dec-stamina']);

    project.decisions = [...project.decisions, promotion.decision];
    project.solutionDesign.concernDecisions = [promotion.concernDecision];
    project.solutionDesign.concerns = project.solutionDesign.concerns.map(concern =>
      concern.id === promotion.concernDecision.concernId
        ? normalizeConcern({ ...concern, status: 'decided' })
        : concern
    );

    // ---------- 7. Teknik onay ----------
    const solutionApproval = approveSolutionDesign(project, { revision: 4, at: NOW });
    assert.equal(solutionApproval.approved, true, solutionApproval.approved ? '' : solutionApproval.reason);
    project.solutionDesign.approval = solutionApproval.approved
      ? solutionApproval.approval
      : project.solutionDesign.approval;

    // ---------- 8. Plan açıldı ----------
    assert.deepEqual(stageConversionBlockers(project), []);
    assert.equal(currentStage(project), 'plan');

    const rail = stageRail(project);
    assert.equal(rail.find(entry => entry.id === 'idea')?.state, 'done');
    assert.equal(rail.find(entry => entry.id === 'plan')?.state, 'current');
    assert.equal(rail.find(entry => entry.id === 'handoff')?.lockReason, null);

    // ---------- 9. Bir ay sonra: "stamina tüketimini kaldırmak istiyorum" ----------
    project.requirements = [{
      id: 'req-stamina', title: 'Stamina azalır', statement: 'At koşarken stamina azalır.',
      kind: 'functional', priority: 'must', acceptanceCriteria: ['Koşarken stamina düşer'],
      sourceObjectiveIds: [], sourceSuggestionIds: [], status: 'accepted'
    }];
    project.traceLinks = [{
      id: 'tl-1', fromType: 'decision', fromId: promotion.decision.id,
      toType: 'requirement', toId: 'req-stamina', relation: 'drives'
    }];

    const impact = invalidationImpact(project, 'dec-stamina');

    // Sistem hangi fikir kararının değiştiğini, hangi teknik kararın
    // etkilendiğini ve hangi gereksinimin bayatladığını biliyor.
    assert.deepEqual(impact.concernIds, ['concern-stamina']);
    assert.deepEqual(impact.technicalDecisionIds, [promotion.decision.id]);
    assert.deepEqual(impact.requirementIds, ['req-stamina']);
    assert.deepEqual(impact.lines, [
      '1 teknik karar gözden geçirilmeli.',
      '1 gereksinim bayatlamış olabilir.'
    ]);

    // ---------- 10. Geri dönüş sessiz olmaz ----------
    const reopened = reopenIdeaApproval(project, 'Stamina sürekli tükenmesin');
    assert.equal(reopened.ideaApproval.reopenedReason, 'Stamina sürekli tükenmesin');
    assert.equal(reopened.solutionApproval.status, 'discovery');
    assert.match(reopened.notice, /teknik onay da yeniden açıldı/);
  });
});
