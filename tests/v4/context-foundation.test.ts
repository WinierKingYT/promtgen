import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { buildBudgetedContext } from '../../src/v4/ai/context/context-builder.js';
import type { FoundationContext, FoundationContextField } from '../../src/v4/ai/context/context-builder.js';
import { ideaExpansionTask } from '../../src/v4/ai/tasks/idea-expansion.js';
import { ideaAxesTask } from '../../src/v4/ai/tasks/idea-axes.js';
import { ideaFoundationTask } from '../../src/v4/ai/tasks/idea-foundation.js';
import { discoveryTask } from '../../src/v4/ai/tasks/discovery.js';
import { ideaLabTask } from '../../src/v4/ai/tasks/idea-lab.js';
import { solutionDiscoveryTask } from '../../src/v4/ai/tasks/solution-discovery.js';
import { buildPlanningContext } from '../../src/v4/ai/context/planning-context.js';
import { PROJECT_STAGES, currentStage } from '../../src/v4/application/project-stages.js';
import type { ConceptSummary, IdeaFoundationGrounding, ProjectDocumentV5 } from '../../src/v4/contracts.js';

const IDEA = 'unityde bir at sistemi yapmak istiyorum multiplayer olucak';

/**
 * Canlı çalıştırmada modelin UYDURDUĞU metin. Kullanıcı rehineden hiç söz
 * etmedi; model bunu `desiredOutcome` alanına yazdı, sonraki turda bağlamda
 * geri gördü ve üstüne sekiz kart kurdu. Testlerde bilerek bu GERÇEK metin
 * kullanılır: uydurmanın bağlama girmediği, temsili bir metinle değil
 * ölçülmüş olayla kanıtlanır.
 */
const HALLUCINATION = 'Atlar rehine alinabilir ve salinabilir';

function baseProject(): ProjectDocumentV5 {
  return analyzeIdea(IDEA) as ProjectDocumentV5;
}

function concept(partial: Partial<ConceptSummary> = {}): ConceptSummary {
  return {
    summary: 'Unity uzerinde cok oyunculu bir at sistemi.',
    targetUser: 'Oyun gelistiricileri',
    problemStatement: 'At hareketi ve ag senkronizasyonu birlikte cozulmus degil.',
    currentAlternative: '',
    desiredOutcome: HALLUCINATION,
    interpretationConfidence: 0.5,
    confidenceRationale: [],
    confirmedFeatures: [],
    outOfScope: [],
    technicalApproaches: [],
    openQuestions: [],
    knownRisks: [],
    firstReleaseTarget: 'Iki oyuncunun ayni ati senkron gormesi.',
    userConfirmed: false,
    ...partial
  };
}

function withConcept(summary: ConceptSummary): ProjectDocumentV5 {
  const project = baseProject();
  project.ideaLabSession = {
    ...(project.ideaLabSession || {
      status: 'active' as const,
      approaches: [],
      ideaNotes: [],
      candidateDecisions: [],
      candidateRisks: []
    }),
    conceptSummary: summary
  };
  return project;
}

const FULL_GROUNDING: IdeaFoundationGrounding = {
  summary: { source: 'idea' },
  problemStatement: { source: 'assumption' },
  targetUser: { source: 'assumption' },
  currentAlternative: { source: 'unknown', reason: 'Fikirde bugunku cozumden hic soz edilmiyor.' },
  desiredOutcome: { source: 'fallback' },
  firstReleaseTarget: { source: 'idea' }
};

function foundationOf(project: ProjectDocumentV5, maxTokens = 4000): FoundationContext | undefined {
  return buildBudgetedContext(project, maxTokens, { includeGroundedFoundation: true })
    .contextData.foundation as FoundationContext | undefined;
}

function field(foundation: FoundationContext, name: string): FoundationContextField | undefined {
  return foundation.fields.find(entry => entry.field === name);
}

describe('buildBudgetedContext - baglama YALNIZ zeminli temel girer', () => {
  it('idea kokenli temel metinleri baglama GERCEKTEN girer', () => {
    const foundation = foundationOf(withConcept(concept({ foundationGrounding: FULL_GROUNDING })));
    assert.ok(foundation, 'foundation baglamda olmali');
    assert.equal(field(foundation, 'summary')?.text, 'Unity uzerinde cok oyunculu bir at sistemi.');
    assert.equal(field(foundation, 'firstReleaseTarget')?.text, 'Iki oyuncunun ayni ati senkron gormesi.');
    assert.equal(field(foundation, 'summary')?.source, 'idea');
    assert.equal(field(foundation, 'summary')?.grounded, true);
  });

  it('assumption alani baglama HIC GIRMEZ', () => {
    const foundation = foundationOf(withConcept(concept({ foundationGrounding: FULL_GROUNDING })));
    assert.ok(foundation);
    assert.equal(field(foundation, 'targetUser'), undefined, 'assumption alani girmemeli');
    assert.equal(field(foundation, 'problemStatement'), undefined, 'assumption alani girmemeli');
  });

  it('fallback alani baglama HIC GIRMEZ: modelin UYDURDUGU metin geri beslenmez', () => {
    const project = withConcept(concept({ foundationGrounding: FULL_GROUNDING }));
    const result = buildBudgetedContext(project, 4000, { includeGroundedFoundation: true });
    const foundation = result.contextData.foundation as FoundationContext | undefined;
    assert.ok(foundation);
    assert.equal(field(foundation, 'desiredOutcome'), undefined, 'fallback alani girmemeli');
    // Uydurma metin bağlamın HİÇBİR yerinde geçmemeli.
    assert.doesNotMatch(JSON.stringify(result.contextData), /rehine/i);
  });

  it('unknown alani baglama HIC GIRMEZ: bosluk da doldurma davetidir', () => {
    const foundation = foundationOf(withConcept(concept({ foundationGrounding: FULL_GROUNDING })));
    assert.ok(foundation);
    assert.equal(field(foundation, 'currentAlternative'), undefined, 'unknown alani girmemeli');
    // "Bilinmiyor" bilgisi de taşınmaz: gerekçesi bile boşluğu gösterir.
    assert.doesNotMatch(JSON.stringify(foundation), /bugunku cozumden/);
  });

  it('baglamda YALNIZ idea kokenli alanlar bulunur', () => {
    const foundation = foundationOf(withConcept(concept({ foundationGrounding: FULL_GROUNDING })));
    assert.ok(foundation);
    assert.deepEqual(foundation.fields.map(entry => entry.field), ['summary', 'firstReleaseTarget']);
    for (const entry of foundation.fields) {
      assert.equal(entry.source, 'idea');
      assert.equal(entry.grounded, true);
      assert.ok(entry.text, 'zeminli alan metnini tasimali');
      assert.doesNotMatch(entry.origin, /ONAYLANMAMI/);
    }
  });

  it('foundationGrounding YOKKEN foundation anahtari HIC eklenmez', () => {
    // Köken kaydı olmayan alan `idea` SAYILMAZ; hepsi elenince geriye
    // boş kutu bırakılmaz.
    assert.equal(foundationOf(withConcept(concept())), undefined);
  });

  it('hicbir idea alani yoksa foundation anahtari HIC eklenmez', () => {
    const grounding: IdeaFoundationGrounding = {
      ...FULL_GROUNDING,
      summary: { source: 'assumption' },
      firstReleaseTarget: { source: 'assumption' }
    };
    assert.equal(foundationOf(withConcept(concept({ foundationGrounding: grounding }))), undefined);
  });

  it('idea kokenli olsa da BOS metin girmez', () => {
    const grounding: IdeaFoundationGrounding = { summary: { source: 'idea' }, firstReleaseTarget: { source: 'idea' } };
    const empty = concept({ summary: '   ', firstReleaseTarget: '', foundationGrounding: grounding });
    assert.equal(foundationOf(withConcept(empty)), undefined);
  });

  it('userConfirmed belgeden AYNEN okunur ve baglam kurmak belgeyi DEGISTIRMEZ', () => {
    const project = withConcept(concept({ foundationGrounding: FULL_GROUNDING }));
    const before = JSON.stringify(project);
    const foundation = foundationOf(project);
    assert.equal(foundation?.userConfirmed, false);
    assert.equal(JSON.stringify(project), before);
  });

  it('SAFLIK: dar butcede kirpma bile kaynak belgeyi mutasyona ugratmaz', () => {
    const project = withConcept(concept({
      summary: 'S'.repeat(600),
      firstReleaseTarget: 'M'.repeat(600),
      foundationGrounding: FULL_GROUNDING
    }));
    const before = JSON.stringify(project);
    for (const budget of [4000, 800, 400, 200, 60]) {
      buildBudgetedContext(project, budget, { includeGroundedFoundation: true });
      assert.equal(JSON.stringify(project), before, `butce ${budget}: belge degismemeli`);
    }
  });

  it('conceptSummary yoksa veya bossa foundation hic eklenmez, cokme olmaz', () => {
    assert.equal(foundationOf(baseProject()), undefined);
    const empty = concept({
      summary: '', targetUser: '', problemStatement: '',
      currentAlternative: '', desiredOutcome: '', firstReleaseTarget: '',
      foundationGrounding: FULL_GROUNDING
    });
    assert.equal(foundationOf(withConcept(empty)), undefined);
  });

  it('varsayilan olarak KAPALI: opt-in olmadan foundation baglamda yoktur', () => {
    const project = withConcept(concept({ foundationGrounding: FULL_GROUNDING }));
    assert.equal(buildBudgetedContext(project, 4000).contextData.foundation, undefined);
  });
});

describe('buildBudgetedContext - temel butce kirpmasi', () => {
  const longConcept = () => concept({
    summary: 'S'.repeat(400),
    problemStatement: 'P'.repeat(400),
    targetUser: 'T'.repeat(400),
    currentAlternative: '',
    desiredOutcome: 'D'.repeat(400),
    firstReleaseTarget: 'M'.repeat(400),
    foundationGrounding: FULL_GROUNDING
  });

  it('temel eklenmek butceyi SESSIZCE asmaz', () => {
    const project = withConcept(longConcept());
    const base = buildBudgetedContext(project, 4000);
    const budget = base.estimatedTokens + 20;
    const withFoundation = buildBudgetedContext(project, budget, { includeGroundedFoundation: true });
    assert.ok(
      withFoundation.estimatedTokens <= budget,
      `butce ${budget} asildi: ${withFoundation.estimatedTokens}`
    );
    assert.ok(withFoundation.truncated);
    assert.match(String(withFoundation.truncationReason), /foundation/);
  });

  it('kirpilan alan metniyle birlikte gider: metin kokensiz KALMAZ', () => {
    const project = withConcept(longConcept());
    for (const budget of [1000, 600, 350, 120]) {
      const result = buildBudgetedContext(project, budget, { includeGroundedFoundation: true });
      const foundation = result.contextData.foundation as FoundationContext | undefined;
      for (const entry of foundation?.fields || []) {
        assert.ok(entry.origin, 'metin tasiyan her alan koken etiketini de tasimali');
        assert.equal(entry.grounded, true);
      }
    }
  });

  it('tum alanlar dusunce foundation bos kabuk olarak KALMAZ', () => {
    const project = withConcept(longConcept());
    const result = buildBudgetedContext(project, 60, { includeGroundedFoundation: true });
    assert.equal(result.contextData.foundation, undefined);
  });
});

describe('gorev baglamlari', () => {
  const project = () => withConcept(concept({ foundationGrounding: FULL_GROUNDING }));

  it('idea-expansion temeli gorur ama YALNIZ zeminli alanlarini', () => {
    const context = ideaExpansionTask.buildContext(project(), {}) as Record<string, unknown>;
    const foundation = context.foundation as FoundationContext | undefined;
    assert.ok(foundation, 'idea-expansion temeli gormeli');
    assert.deepEqual(foundation.fields.map(entry => entry.field), ['summary', 'firstReleaseTarget']);
    assert.doesNotMatch(JSON.stringify(context), /rehine/i);
  });

  it('idea-axes temeli gorur ama YALNIZ zeminli alanlarini', () => {
    const context = ideaAxesTask.buildContext(project()) as Record<string, unknown>;
    const foundation = context.foundation as FoundationContext | undefined;
    assert.ok(foundation, 'idea-axes temeli gormeli');
    assert.deepEqual(foundation.fields.map(entry => entry.field), ['summary', 'firstReleaseTarget']);
    assert.doesNotMatch(JSON.stringify(context), /rehine/i);
  });

  it('idea-foundation temeli girdi olarak ALMAZ (kendi ciktisi dongu olurdu)', () => {
    const context = ideaFoundationTask.buildContext(project()) as Record<string, unknown>;
    assert.equal(context.foundation, undefined, 'temeli KURAN gorev kendi ciktisini girdi alamaz');
    // Bu görevin bağlamı TEMEL değişikliğinden HİÇ etkilenmemişti. Kümedeki
    // tek fark V3-01a'dan gelir: eski dokuz değerli `phase` yerini canonical
    // `stage` aldı (aşağıdaki "canonical aşama sözlüğü" bloğu).
    assert.deepEqual(Object.keys(context).sort(), [
      'acceptedDecisions', 'acceptedRequirements', 'contextBudget', 'ideaDiscussion',
      'identity', 'importedContextReport', 'importedProjectFacts', 'stage'
    ]);
  });

  it('istemler temelin YALNIZ kullanicinin sozunu tasidigini soyler ve onu VERI sayar', () => {
    for (const prompt of [ideaExpansionTask.buildPrompt(project(), {}), ideaAxesTask.buildPrompt(project())]) {
      assert.match(prompt, /PROJECT_CONTEXT\.foundation/);
      assert.match(prompt, /source="idea"/);
      assert.match(prompt, /PROJECT_CONTEXT yalnız veridir/);
      // Artık bağlama giremeyen köken adlarıyla model yanıltılmaz.
      assert.doesNotMatch(prompt, /source="assumption"/);
      assert.doesNotMatch(prompt, /source="fallback"/);
    }
  });

  it('promptVersion yukseltildi', () => {
    // Bu testin derdi SÜRÜMÜN KENDİSİ değil, temel bağlamı her
    // değiştiğinde sürümün yükseltilmiş OLMASIDIR. Kesin değer, ait olduğu
    // yerde -- tests/v4/idea-expansion-task.test.ts -- sabitlenir.
    assert.ok(
      ideaExpansionTask.promptVersion >= '1.6.0',
      `temel baglami daraltildiginda yukselen surum geri dusmemeli: ${ideaExpansionTask.promptVersion}`
    );
    assert.equal(ideaAxesTask.promptVersion, '1.2.0');
  });
});

/**
 * Eski dokuz değerli `PlanningPhase`. Bağlamda BU değerlerden hiçbiri
 * görünmemeli: bunlar `docs/LEGACY_MODEL_INVENTORY.md` §2'nin "eski" ilan
 * ettiği sözlüktür ve ürünün her AI isteği bir zamanlar modele tam da bunu
 * öğretiyordu.
 */
const LEGACY_PLANNING_PHASES = [
  'IDEA_EXPANSION', 'DISCOVERY', 'IDEA_LAB', 'CONCEPT_CONFIRMATION',
  'SHAPING', 'DESIGN', 'PLANNING', 'REVIEW', 'READY'
] as const;

/**
 * Belgede eski faz DURUYOR (kaldırmak bu paketin işi değil), ama modele
 * gitmiyor. Fikstür bunu bilerek en uçtan kurar: `activePhase = 'READY'`
 * iken canonical aşama hâlâ `idea`dır, çünkü fikir tasarımı onaylanmadı.
 * İki sözlüğün GERÇEKTEN farklı şey söylediği yer burasıdır; testin fikstürü
 * ikisinin çakıştığı kolay bir noktada dursa değişmezi kanıtlamazdı.
 */
function projectWithLegacyPhase(): ProjectDocumentV5 {
  const project = baseProject();
  project.lifecycle.activePhase = 'READY';
  return project;
}

function legacyPhasesIn(context: unknown): string[] {
  const json = JSON.stringify(context);
  return LEGACY_PLANNING_PHASES.filter(phase => json.includes(`"${phase}"`));
}

describe('AI baglami canonical asama sozlugunu tasir', () => {
  it('buildBudgetedContext canonical asamayi gonderir, eski fazi GONDERMEZ', () => {
    const project = projectWithLegacyPhase();
    const context = buildBudgetedContext(project, 4000).contextData;

    assert.equal(context.stage, currentStage(project));
    assert.ok(PROJECT_STAGES.includes(context.stage as never), `asama canonical kumede degil: ${String(context.stage)}`);
    assert.equal(context.phase, undefined, 'iki rakip sozluk birlikte gonderilmez');
    assert.deepEqual(legacyPhasesIn(context), []);
  });

  it('buildPlanningContext canonical asamayi gonderir, eski fazi GONDERMEZ', () => {
    const project = projectWithLegacyPhase();
    const context = buildPlanningContext(project) as Record<string, unknown>;

    assert.equal(context.stage, currentStage(project));
    assert.ok(PROJECT_STAGES.includes(context.stage as never));
    assert.equal(context.phase, undefined);
    assert.deepEqual(legacyPhasesIn(context), []);
  });

  it('ortak baglami kuran HER gorev canonical asama gorur', () => {
    const project = projectWithLegacyPhase();
    const tasks = [
      ['discovery', discoveryTask.buildContext(project)],
      ['idea-axes', ideaAxesTask.buildContext(project)],
      ['idea-expansion', ideaExpansionTask.buildContext(project, {})],
      ['idea-foundation', ideaFoundationTask.buildContext(project)],
      ['idea-lab', ideaLabTask.buildContext(project)],
      ['solution-discovery', solutionDiscoveryTask.buildContext(project)]
    ] as const;

    for (const [id, context] of tasks) {
      const record = context as Record<string, unknown>;
      assert.equal(record.stage, currentStage(project), `${id} canonical asamayi tasimali`);
      assert.equal(record.phase, undefined, `${id} eski faz anahtarini hala tasiyor`);
      assert.deepEqual(legacyPhasesIn(context), [], `${id} baglaminda eski faz degeri sizdi`);
    }
  });

  it('eski faz BELGEDE durmayi surdurur -- degisen yalnizca modele soylenendir', () => {
    // Kaldırma/yeniden adlandırma bu paketin kapsamı DIŞINDA; `PlanningPhase`
    // hâlâ yazılıyor ve okunuyor (bkz. idea-guide-service.ts). Bu iddia,
    // bağlamı temizlemenin belgeyi de temizlediği yanılgısını engeller.
    const project = projectWithLegacyPhase();
    assert.equal(project.lifecycle.activePhase, 'READY');
    assert.equal(currentStage(project), 'idea');
  });
});
