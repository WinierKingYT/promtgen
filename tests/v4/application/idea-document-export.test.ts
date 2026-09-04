import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
import { createProjectDocument } from '../../../src/v4/project-document.js';
import { createDocumentSet, createPromtgenPackage } from '../../../src/v4/exporter.js';
import { IDEA_DOCUMENT_PATH } from '../../../src/v4/application/canonical-document-export.js';
import type {
  ConceptSummary,
  ConcernDecision,
  IdeaFoundationGrounding,
  ProjectDocumentV5,
  SuggestionBundle
} from '../../../src/v4/contracts.js';

const RAW_IDEA = 'Küçük stüdyolar için oyun içi hata raporlarını toplayan bir masaüstü aracı';

function baseProject(): ProjectDocumentV5 {
  return createProjectDocument({ idea: RAW_IDEA });
}

const CONCEPT: ConceptSummary = {
  summary: 'Oyun içi hata raporlarını tek panelde toplar.',
  targetUser: 'Oyun geliştiricileri',
  problemStatement: 'Raporlar Discord ve e-posta arasında dağılıyor.',
  currentAlternative: '',
  desiredOutcome: 'Her raporun tek yerde izlenebilmesi',
  interpretationConfidence: 0.7,
  confidenceRationale: [],
  confirmedFeatures: [],
  outOfScope: [],
  technicalApproaches: [],
  openQuestions: ['Raporlar hangi motordan gelecek?'],
  knownRisks: [],
  mvpTarget: 'Tek oyun için rapor akışı',
  userConfirmed: false
};

/**
 * Altı alanın dördü farklı kökende: `idea`, `assumption`, `unknown` ve
 * `fallback`. Köken kaydı hiç OLMAYAN alan senaryosu ayrı bir testte,
 * `foundationGrounding` tamamen yokken kurulur.
 */
const GROUNDING: IdeaFoundationGrounding = {
  summary: { source: 'idea' },
  problemStatement: { source: 'idea' },
  targetUser: { source: 'assumption' },
  currentAlternative: { source: 'unknown', reason: 'fikir metni mevcut çözümden hiç söz etmiyor' },
  desiredOutcome: { source: 'fallback' },
  mvpTarget: { source: 'assumption' }
};

function withConcept(overrides: Partial<ConceptSummary> = {}, grounding?: IdeaFoundationGrounding): ProjectDocumentV5 {
  const project = structuredClone(baseProject());
  project.ideaLabSession = {
    ...project.ideaLabSession!,
    conceptSummary: { ...CONCEPT, ...overrides, ...(grounding ? { foundationGrounding: grounding } : {}) }
  };
  return project;
}

function ideaDocument(project: ProjectDocumentV5): string {
  return createDocumentSet(project, { adapters: [] })[IDEA_DOCUMENT_PATH];
}

/** `### Başlık` ile bir sonraki `##`/`###` arasındaki gövdeyi döndürür. */
function section(markdown: string, heading: string): string {
  const marker = `### ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `"${heading}" bölümü belgede yok`);
  const rest = markdown.slice(start + marker.length);
  const end = rest.search(/\n#{2,3} /);
  return end === -1 ? rest : rest.slice(0, end);
}

function expansionBundle(items: SuggestionBundle['items']): SuggestionBundle {
  return {
    id: 'bundle-idea-expansion-1',
    title: 'Keşiften eklenenler',
    phase: 'IDEA_EXPANSION',
    status: 'open',
    createdAt: new Date().toISOString(),
    items,
    openQuestions: [],
    source: { type: 'local', providerId: 'idea-expansion' }
  };
}

function concernDecision(overrides: Partial<ConcernDecision>): ConcernDecision {
  return {
    id: 'concern-decision-1',
    concernId: 'concern-1',
    chosenOptionId: null,
    answer: '',
    excluded: [],
    scopeSplit: 'legacy-unsplit',
    rationale: '',
    decidedAtRevision: 1,
    decisionId: null,
    ...overrides
  };
}

describe('fikir aşaması belgesi', () => {
  it('her plan derinliğinde üretilir -- fikir planın temelidir', () => {
    for (const depth of ['quick', 'standard', 'advanced', 'enterprise'] as const) {
      const project = withConcept({}, GROUNDING);
      project.planningDepth.selected = depth;
      const documents = createDocumentSet(project, { adapters: [] });
      assert.ok(documents[IDEA_DOCUMENT_PATH], `${depth} derinliğinde fikir belgesi yok`);
    }
  });

  it('kullanıcının ham fikrini aynen taşır', () => {
    assert.ok(ideaDocument(withConcept({}, GROUNDING)).includes(RAW_IDEA));
  });

  it('varsayım alanı belgede VARSAYIM olarak işaretlenir', () => {
    const body = section(ideaDocument(withConcept({}, GROUNDING)), 'Hedef kullanıcı');
    assert.ok(body.includes('Oyun geliştiricileri'));
    assert.match(body, /VARSAYIM/);
    assert.doesNotMatch(body, /FİKİRDEN/);
  });

  it('fikirden gelen alan kullanıcının sözü olarak durur', () => {
    const body = section(ideaDocument(withConcept({}, GROUNDING)), 'Özet');
    assert.match(body, /FİKİRDEN/);
    assert.doesNotMatch(body, /VARSAYIM|KÖKEN BELİRSİZ/);
  });

  it('köken kaydı OLMAYAN alan fikirden gelmiş gibi SUNULMAZ', () => {
    const markdown = ideaDocument(withConcept());
    for (const heading of ['Özet', 'Problem', 'Hedef kullanıcı', 'Bugünkü alternatif', 'İstenen sonuç', 'Hedeflenen kapsam']) {
      const body = section(markdown, heading);
      assert.match(body, /KÖKEN BELİRSİZ/, `${heading} kökensiz olmasına rağmen işaretlenmemiş`);
      assert.doesNotMatch(body, /FİKİRDEN/, `${heading} kökensizken fikirden gelmiş gibi sunulmuş`);
    }
  });

  it('bilinmeyen alan gerekçesiyle görünür, uydurma metinle doldurulmaz', () => {
    const body = section(ideaDocument(withConcept({}, GROUNDING)), 'Bugünkü alternatif');
    assert.match(body, /BİLİNMİYOR/);
    assert.ok(body.includes('fikir metni mevcut çözümden hiç söz etmiyor'));
    assert.match(body, /_Metin yok\._/);
  });

  it('fallback metin sistem metni olarak işaretlenir', () => {
    const body = section(ideaDocument(withConcept({}, GROUNDING)), 'İstenen sonuç');
    assert.match(body, /SİSTEM METNİ/);
    assert.doesNotMatch(body, /FİKİRDEN/);
  });

  it('boş kapsam dürüstçe boş görünür, doldurulmaz', () => {
    const markdown = ideaDocument(withConcept({}, GROUNDING));
    assert.match(section(markdown, 'Kapsam dışı'), /Henüz karar verilmedi/);
    assert.match(section(markdown, 'Kapsam içi'), /Henüz karar verilmedi/);
  });

  it('legacy-unsplit kaydın excluded alanı belgeye YAZILMAZ', () => {
    const project = withConcept({}, GROUNDING);
    project.ideaDesign = {
      ...project.ideaDesign!,
      concerns: [],
      concernDecisions: [
        concernDecision({ answer: 'E-posta ile bildirim gönderilecek', excluded: ['SMS gönderilmeyecek'] }),
        concernDecision({
          id: 'concern-decision-2',
          scopeSplit: 'confirmed',
          answer: 'Panelde filtre olacak',
          excluded: ['Mobil sürüm yapılmayacak']
        })
      ]
    };
    const markdown = ideaDocument(project);
    assert.ok(markdown.includes('E-posta ile bildirim gönderilecek'));
    assert.ok(markdown.includes('Mobil sürüm yapılmayacak'));
    assert.ok(!markdown.includes('SMS gönderilmeyecek'), 'legacy-unsplit excluded satırı belgeye sızmış');
  });

  it('kabul edilmiş genişletme kartlarını gösterir', () => {
    const project = withConcept({}, GROUNDING);
    project.proposalStore = {
      ...project.proposalStore!,
      bundles: [expansionBundle([
        {
          id: 's1',
          kind: 'feature',
          title: 'Otomatik ekran görüntüsü',
          description: 'Rapora ekran görüntüsü eklenir',
          status: 'accepted',
          rationale: '',
          impact: 'medium',
          targetSectionId: null
        },
        {
          id: 's2',
          kind: 'feature',
          title: 'Sesli not',
          description: 'Rapora ses eklenir',
          status: 'pending',
          rationale: '',
          impact: 'low',
          targetSectionId: null
        }
      ] as SuggestionBundle['items'])]
    };
    const markdown = ideaDocument(project);
    assert.match(section(markdown, 'Fikre kabul edilen kartlar'), /Otomatik ekran görüntüsü/);
  });

  it('açık soruları taşır', () => {
    assert.ok(ideaDocument(withConcept({}, GROUNDING)).includes('Raporlar hangi motordan gelecek?'));
  });

  it('saf kalır -- projeyi değiştirmez', () => {
    const project = withConcept({}, GROUNDING);
    const before = structuredClone(project);
    ideaDocument(project);
    assert.deepEqual(project, before);
  });

  it('zip paketine girer', async () => {
    const packaged = await createPromtgenPackage(withConcept({}, GROUNDING), { adapters: ['generic'] });
    const zip = await JSZip.loadAsync(await packaged.blob.arrayBuffer());
    assert.ok(zip.file(IDEA_DOCUMENT_PATH), 'fikir belgesi zip içinde yok');
    assert.ok(packaged.manifest.files.includes(IDEA_DOCUMENT_PATH));
    assert.ok((await zip.file(IDEA_DOCUMENT_PATH)!.async('string')).includes(RAW_IDEA));
  });
});
