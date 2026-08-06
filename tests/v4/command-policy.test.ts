import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectDocumentV5, ProjectRepository } from '../../src/v4/contracts.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import {
  DOCUMENT_ONLY_COMMANDS,
  isCanonicalChangeCommand
} from '../../src/v4/application/command-policy.js';
import { commitProjectCandidate } from '../../src/v4/application/command-transaction.js';
import { addExpansionCardAsSuggestion } from '../../src/v4/application/idea-expansion-intake.js';
import type { ExpansionCard } from '../../src/v4/application/idea-expansion-service.js';

class FakeRepository implements ProjectRepository {
  stored: ProjectDocumentV5 | null = null;
  async list() { return this.stored ? [structuredClone(this.stored)] : []; }
  async get(id: string) { return this.stored?.id === id ? structuredClone(this.stored) : null; }
  async save(project: ProjectDocumentV5) {
    this.stored = structuredClone(project);
    return structuredClone(project);
  }
  async archive() { return false; }
  async restore() { return false; }
  async purge() {
    this.stored = null;
    return { projectDeleted: true, checkpointsDeleted: 0, commandLogEntriesDeleted: 0, quarantineEntriesDeleted: 0, backupsDeleted: 0 };
  }
}

const project = () => analyzeIdea('Şehir içi bisiklet rotası öneren bir mobil uygulama') as ProjectDocumentV5;

const aiCard: ExpansionCard = {
  id: 'card-1',
  title: 'Verinin nerede durduğunu açıkça göster',
  description: 'Kullanıcı ilk açılışta verinin cihazda kaldığını görsün.',
  kind: 'feature',
  effort: 'low',
  impact: 'high',
  mvpHint: 'mvp-adayı',
  origin: 'ai'
};

/**
 * Kartın öneri olarak eklenmesi canonical planı değiştirmez. Saf fonksiyonun
 * bunu bilmesi yetmez: komut zarfı `canonicalChange` bayrağını politikadan
 * okur ve canonicalRevision'ı asıl o ilerletir. Buradaki testler bu yolu,
 * yani commit sınırını ölçer.
 */
describe('Command policy: canonical vs document-only', () => {
  it('AddExpansionCard belge-yalnız komut olarak sınıflanır', () => {
    assert.ok(
      DOCUMENT_ONLY_COMMANDS.has('AddExpansionCard'),
      'keşif kartı ekleme canonical plan değişikliği değildir'
    );
    assert.equal(isCanonicalChangeCommand('AddExpansionCard'), false);
  });

  it('bilinmeyen komut güvenli tarafta kalır: canonical sayılır', () => {
    assert.equal(isCanonicalChangeCommand('BilinmeyenKomut'), true);
    assert.equal(isCanonicalChangeCommand('UpdatePlanSection'), true);
  });

  it('AddExpansionCard commit edildiğinde canonicalRevision artmaz', async () => {
    const repository = new FakeRepository();
    const current = project();
    const intake = addExpansionCardAsSuggestion(current, aiCard, 'Güven ve gizlilik');
    assert.equal(intake.added, true);

    const result = await commitProjectCandidate(repository, current, intake.project, {
      commandId: 'cmd-expansion-1',
      commandType: 'AddExpansionCard',
      projectId: current.id,
      expectedDocumentRevision: current.documentRevision,
      expectedCanonicalRevision: current.canonicalRevision,
      canonicalChange: isCanonicalChangeCommand('AddExpansionCard'),
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    assert.equal(result.success, true);
    assert.equal(
      result.project.canonicalRevision,
      current.canonicalRevision,
      'kart eklemek canonical planı değiştirmediği için revision sabit kalmalı'
    );
    assert.equal(result.project.documentRevision, current.documentRevision + 1);

    const record = result.project.commandLog.at(-1);
    assert.ok(record);
    assert.equal(record.commandType, 'AddExpansionCard');
    assert.equal(
      record.committedCanonicalRevision,
      current.canonicalRevision,
      'commandLog gerçekleşmemiş bir canonical değişiklik yazmamalı'
    );
  });

  it('canonical bir komut aynı yoldan geçtiğinde revision ilerler', async () => {
    const repository = new FakeRepository();
    const current = project();
    const candidate = structuredClone(current);
    candidate.sections.vision.content = 'Yeni vizyon metni';

    const result = await commitProjectCandidate(repository, current, candidate, {
      commandId: 'cmd-canonical-1',
      commandType: 'UpdatePlanSection',
      projectId: current.id,
      expectedDocumentRevision: current.documentRevision,
      expectedCanonicalRevision: current.canonicalRevision,
      canonicalChange: isCanonicalChangeCommand('UpdatePlanSection'),
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    assert.equal(result.success, true);
    assert.equal(result.project.canonicalRevision, current.canonicalRevision + 1);
  });
});
