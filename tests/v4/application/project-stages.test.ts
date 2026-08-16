import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PROJECT_STAGES,
  createStageApproval,
  currentStage,
  planningPhaseToStage,
  reopenStage,
  stageGate
} from '../../../src/v4/application/project-stages.js';
import { createProjectDocument, PLANNING_PHASES } from '../../../src/v4/project-document.js';
import { normalizeProjectDocument } from '../../../src/v4/canonical-entities.js';
import type { ProjectDocumentV5 } from '../../../src/v4/contracts.js';

function project(): ProjectDocumentV5 {
  return createProjectDocument({ idea: 'Aşama modeli testi' }) as ProjectDocumentV5;
}

function approve(document: ProjectDocumentV5, stage: 'ideaDesign' | 'solutionDesign') {
  document[stage].approval = {
    status: 'approved',
    approvedAtRevision: document.canonicalRevision,
    approvedAt: '2026-08-16T00:00:00.000Z',
    reopenedReason: null
  };
}

describe('V3 aşama modeli', () => {
  it('yeni belge fikir asamasinda ve iki tasarim da taslak baslar', () => {
    const document = project();

    assert.equal(document.ideaDesign.approval.status, 'draft');
    assert.equal(document.solutionDesign.approval.status, 'draft');
    assert.equal(currentStage(document), 'idea');
  });

  it('Idea -> Plan dogrudan gecisi yok: fikir onaylanmadan cozum kapisi acilmaz', () => {
    const document = project();

    const solution = stageGate(document, 'solution');
    assert.equal(solution.open, false);
    // Kilit sessiz olmaz; nedeni taşır.
    assert.equal(solution.reason, 'Fikir tasarımı henüz onaylanmadı.');

    const plan = stageGate(document, 'plan');
    assert.equal(plan.open, false);
  });

  it('fikir onaylaninca cozum acilir ama plan hala kapali kalir', () => {
    const document = project();
    approve(document, 'ideaDesign');

    assert.equal(stageGate(document, 'solution').open, true);
    assert.equal(currentStage(document), 'solution');

    const plan = stageGate(document, 'plan');
    assert.equal(plan.open, false);
    assert.equal(plan.reason, 'Teknik çözüm tasarımı henüz onaylanmadı.');
  });

  it('iki onay da tamamlaninca plan acilir', () => {
    const document = project();
    approve(document, 'ideaDesign');
    approve(document, 'solutionDesign');

    assert.equal(stageGate(document, 'plan').open, true);
    assert.equal(currentStage(document), 'plan');
  });

  it('geri donus sessiz olmaz: yeniden acilan onay nedenini saklar', () => {
    const approval = {
      status: 'approved' as const,
      approvedAtRevision: 4,
      approvedAt: '2026-08-16T00:00:00.000Z',
      reopenedReason: null
    };

    const reopened = reopenStage(approval, 'Kapsam değişti: multiplayer isteniyor.');

    assert.equal(reopened.status, 'discovery');
    assert.equal(reopened.approvedAtRevision, null);
    assert.equal(reopened.reopenedReason, 'Kapsam değişti: multiplayer isteniyor.');
  });

  it('eski 9 fazin tamami bir V3 asamasina eslenir - bagimsiz dorduncu model birakilmaz', () => {
    // Alt Proje C'de uygulamada birbirine bağlantısız üç aşama modeli
    // bulunmuştu. Bu test aynı hatanın tekrarlanmasını engelliyor: yeni bir
    // PlanningPhase eklenirse eşlemesi de yazılmak zorunda.
    const phases = Object.values(PLANNING_PHASES) as string[];
    assert.ok(phases.length > 0);

    for (const phase of phases) {
      const stage = planningPhaseToStage(phase);
      assert.ok(
        PROJECT_STAGES.includes(stage),
        `${phase} fazının V3 aşama karşılığı yok: ${stage}`
      );
    }

    assert.equal(planningPhaseToStage(PLANNING_PHASES.DISCOVERY), 'idea');
    assert.equal(planningPhaseToStage(PLANNING_PHASES.DESIGN), 'solution');
    assert.equal(planningPhaseToStage(PLANNING_PHASES.PLANNING), 'plan');
    assert.equal(planningPhaseToStage(PLANNING_PHASES.READY), 'handoff');
  });

  it('bilinmeyen faz en guvenli asamaya duser', () => {
    // İleri sarmak, geride tutmaktan daha zararlı: kullanıcıyı hak etmediği
    // bir aşamaya taşımak yerine başlangıca düşer.
    assert.equal(planningPhaseToStage('BILINMEYEN_FAZ'), 'idea');
  });

  it('createStageApproval bos ve onaysiz baslar', () => {
    assert.deepEqual(createStageApproval(), {
      status: 'draft',
      approvedAtRevision: null,
      approvedAt: null,
      reopenedReason: null
    });
  });
});

describe('V3 göç iskeleti', () => {
  it('V3 oncesi belge asama kapsayicilarini kazanir', () => {
    const legacy = project() as unknown as Record<string, unknown>;
    delete legacy.ideaDesign;
    delete legacy.solutionDesign;

    const normalized = normalizeProjectDocument(legacy) as ProjectDocumentV5;

    assert.equal(normalized.ideaDesign.approval.status, 'draft');
    assert.equal(normalized.solutionDesign.approval.status, 'draft');
    assert.equal(normalized.schemaRevision, 6);
  });

  it('eski kararlar SESSIZCE siniflandirilmaz, legacy-unclassified etiketlenir', () => {
    const document = project();
    document.decisions.push({
      id: 'dec-eski',
      title: 'Eski karar',
      decision: 'V3 öncesi alınmış',
      rationale: 'Gerekçe',
      alternatives: [],
      consequences: [],
      status: 'accepted',
      sourceSuggestionId: '',
      affectedSectionIds: []
    } as never);

    const normalized = normalizeProjectDocument(document) as ProjectDocumentV5;

    // AI tahminiyle "bu fikir kararı" demek, kullanıcının hiç vermediği bir
    // kararı ona atfetmek olurdu.
    assert.equal(normalized.decisions[0].stage, 'legacy-unclassified');
  });

  it('zaten siniflandirilmis karar yeniden etiketlenmez', () => {
    const document = project();
    document.decisions.push({
      id: 'dec-yeni',
      title: 'Teknik karar',
      decision: 'ScriptableObject kullanılacak',
      rationale: 'Designer tarafından düzenlenebilir',
      alternatives: [],
      consequences: [],
      status: 'accepted',
      sourceSuggestionId: '',
      affectedSectionIds: [],
      stage: 'technical'
    } as never);

    const normalized = normalizeProjectDocument(document) as ProjectDocumentV5;

    assert.equal(normalized.decisions[0].stage, 'technical');
  });
});
