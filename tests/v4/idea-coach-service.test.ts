import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIdeaCoachState, ensureIdeaCoachWorkspace } from '../../src/v4/application/idea-coach-service.js';
import { createDiscoveryAnswerDraft } from '../../src/v4/application/discovery-answer-service.js';
import { analyzeIdea } from '../../src/v4/planning-engine.js';

function projectWithSummary() {
  const project = analyzeIdea('Bireysel geliştiricilerin dağınık proje fikirlerini yerel olarak netleştiren bir web uygulaması yapmak istiyorum.');
  const initialized = ensureIdeaCoachWorkspace(project);
  assert.ok(initialized.ideaLabSession?.conceptSummary);
  return initialized;
}

test('taze bir kısa fikir, hiçbir alan elle doldurulmadan problem adımında başlar', () => {
  const project = analyzeIdea('Bir uygulama yapmak istiyorum.');
  assert.equal(project.ideaLabSession?.conceptSummary, undefined);

  const initialized = ensureIdeaCoachWorkspace(project);
  const state = buildIdeaCoachState(initialized);

  assert.equal(state.activeStep, 'problem');
  assert.equal(state.evidence.find(item => item.id === 'problem')?.status, 'decision-required');
  assert.equal(state.readyForSummaryReview, false);
});

test('idea coach rejects vague placeholders and exposes one evidence-based focus without a score', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.problemStatement = 'İşler zor';
  summary.targetUser = 'Herkes';
  summary.currentAlternative = '';
  summary.desiredOutcome = 'Daha iyi olsun';
  summary.confirmedFeatures = [];
  summary.outOfScope = [];
  summary.knownRisks = [];
  summary.userConfirmed = false;

  const state = buildIdeaCoachState(project);

  assert.equal(state.activeStep, 'problem');
  assert.equal(state.evidence.find(item => item.id === 'problem')?.status, 'decision-required');
  assert.ok(state.actions.length > 0 && state.actions.length <= 3);
  assert.equal('score' in state, false);
});

test('the first discussion turn initializes an editable idea draft without changing the source project', () => {
  const project = analyzeIdea('Bir uygulama yapmak istiyorum.');
  assert.equal(project.ideaLabSession?.conceptSummary, undefined);

  const initialized = ensureIdeaCoachWorkspace(project);
  const question = buildIdeaCoachState(project).activeQuestion;
  const draft = createDiscoveryAnswerDraft(initialized, {
    answer: 'Problem: Bireysel geliştiriciler projeye başlamadan önce kapsamı ve kararları netleştiremiyor.',
    focusedQuestion: question
  });

  assert.equal(project.ideaLabSession?.conceptSummary, undefined);
  assert.equal(initialized.ideaLabSession?.status, 'active');
  assert.ok(initialized.ideaLabSession?.conceptSummary);
  assert.ok(draft?.patches.some(patch => patch.field === 'problemStatement'));
  assert.equal(initialized.canonicalRevision, project.canonicalRevision);
});

test('idea coach changes its contextual actions as the conversation becomes clearer', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.problemStatement = 'Kısa fikirler proje boyunca kapsamını ve alınan kararların nedenini kaybediyor.';
  summary.targetUser = '';
  summary.currentAlternative = '';
  summary.desiredOutcome = '';
  summary.userConfirmed = false;

  const userState = buildIdeaCoachState(project);
  assert.equal(userState.activeStep, 'user');
  assert.ok(userState.actions.every(action => action.id.startsWith('user-')));

  summary.targetUser = 'AI kodlama araçlarıyla çalışan bireysel geliştiriciler';
  const valueState = buildIdeaCoachState(project);
  assert.equal(valueState.activeStep, 'value');
  assert.ok(valueState.actions.every(action => action.id.startsWith('value-')));
});

test('idea coach shows claims as confirmed only after explicit summary approval', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.problemStatement = 'Dağınık fikirler geliştirme boyunca izlenebilir karar ve görev bağlarını kaybediyor.';
  summary.targetUser = 'AI kodlama araçlarıyla çalışan bireysel geliştiriciler';
  summary.currentAlternative = 'Serbest biçimli sohbet ve birbirinden kopuk Markdown dosyaları';
  summary.desiredOutcome = 'Kullanıcı onaylı, izlenebilir ve uygulanabilir bir proje planı';
  summary.mvpTarget = 'Bir fikri onaylı MVP kapsamına ve bağlantılı görevlere dönüştürmek';
  summary.confirmedFeatures = ['Fikir geliştirme', 'MVP kapsamı'];
  summary.outOfScope = ['Otomatik kod yazma'];
  summary.knownRisks = ['Kural tabanlı çıkarımın bağlamı yanlış yorumlaması'];
  summary.userConfirmed = false;

  const draftState = buildIdeaCoachState(project);
  assert.ok(draftState.evidence.every(item => item.status === 'draft'));

  summary.userConfirmed = true;
  const confirmedState = buildIdeaCoachState(project);
  assert.ok(confirmedState.evidence.every(item => item.status === 'confirmed'));
  assert.equal(confirmedState.readyForSummaryReview, true);
});

test('aktif adımla eşleşen AI turu, soruyu ve aksiyonları yerel varsayılanların yerine kullanır', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.problemStatement = 'İşler zor';
  summary.targetUser = 'Herkes';
  summary.userConfirmed = false;
  const state = buildIdeaCoachState(project);
  assert.equal(state.activeStep, 'problem');

  project.messages.push({
    id: 'm1',
    role: 'assistant',
    content: 'Anladım.',
    createdAt: new Date().toISOString(),
    nextQuestionStep: 'problem',
    nextQuestionText: 'Bu proje tam olarak hangi somut anı düzeltiyor?',
    optionalPaths: [{ title: 'Somut örnek ver', reason: 'Genel tanımı netleştirir.', prompt: 'Örnek anlat.' }],
    uncertainty: ['Problem tanımı hâlâ çok genel']
  });

  const turnState = buildIdeaCoachState(project);
  assert.equal(turnState.activeQuestion, 'Bu proje tam olarak hangi somut anı düzeltiyor?');
  assert.equal(turnState.actions.length, 1);
  assert.equal(turnState.actions[0].title, 'Somut örnek ver');
  assert.deepEqual(turnState.uncertainty, ['Problem tanımı hâlâ çok genel']);
});

test('AI turu farklı bir adım için üretildiyse (adım ilerlediyse) yerel varsayılana döner', () => {
  const project = projectWithSummary();
  const summary = project.ideaLabSession!.conceptSummary;
  summary.problemStatement = 'İşler zor';
  summary.targetUser = 'Herkes';
  summary.userConfirmed = false;

  project.messages.push({
    id: 'm1',
    role: 'assistant',
    content: 'Anladım.',
    createdAt: new Date().toISOString(),
    nextQuestionStep: 'value',
    nextQuestionText: 'Bu, adım ilerlemeden önce üretilmiş eski bir soru.',
    optionalPaths: [{ title: 'Eski aksiyon', reason: 'Eski', prompt: 'Eski' }],
    uncertainty: ['Eski belirsizlik']
  });

  const state = buildIdeaCoachState(project);
  assert.equal(state.activeStep, 'problem');
  assert.notEqual(state.activeQuestion, 'Bu, adım ilerlemeden önce üretilmiş eski bir soru.');
  assert.deepEqual(state.uncertainty, []);
});
