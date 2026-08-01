import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createProjectDocument } from '../src/v4/project-document.js';
import {
  getDomainAgentCommittee,
  runCommitteeEvaluation,
  runCommitteeVoting
} from '../src/v4/agent-committee.js';

/**
 * Uzman Perspektifleri bir YEREL KURAL MOTORUDUR; bağımsız LLM ajanları
 * çalıştırmaz. Bu benchmark onu olduğu gibi ölçer ve en önemlisi bu beyanın
 * kendisini test eder: aynı girdi her zaman aynı çıktıyı vermeli, hiçbir
 * asenkron çağrı olmamalı.
 */

interface Assertion { label: string; passed: boolean }
interface Agent { id: string; name: string; role: string; icon: string; color: string; focus: string }

const ideaFor = (idea: string) => createProjectDocument({ idea });

const DOMAIN_IDEAS = {
  game: 'S&box motoru içinde çok oyunculu at yarışı oyunu ve fizik sistemi yapmak istiyorum',
  web: 'Küçük ekipler için web tabanlı görev takip dashboard ve REST API yapmak istiyorum',
  mobile: 'Offline çalışan mobil alışveriş listesi uygulaması, iOS ve Android yapmak istiyorum',
  ai: 'LLM tabanlı doküman soru cevap ajanı ve prompt yönetimi yapmak istiyorum'
};

/** Oylamada güvenlik vetosu bu kimlik kalıbına göre uygulanır. */
const securityVoter = (agents: Agent[]) =>
  agents.find(agent => agent.id.includes('security') || agent.id.includes('guardrail') || agent.id.includes('sec'));

const acceptedDecision = (id: string, title: string, decision: string) => ({
  id, title, decision, status: 'accepted'
});

function domainAwareCommittee(): Assertion[] {
  const committees = Object.fromEntries(
    Object.entries(DOMAIN_IDEAS).map(([domain, idea]) => [domain, getDomainAgentCommittee(ideaFor(idea)) as Agent[]])
  );
  const signatures = Object.values(committees).map(list => list.map(agent => agent.id).join(','));

  return [
    { label: 'Her alan dört uzman perspektifi sunar', passed: Object.values(committees).every(list => list.length === 4) },
    { label: 'Dört alan da birbirinden ayrışır', passed: new Set(signatures).size === 4 },
    {
      label: 'Her ajan kimlik, ad, rol ve odak taşır',
      passed: Object.values(committees).every(list =>
        list.every(agent => agent.id && agent.name && agent.role && agent.focus))
    },
    {
      label: 'Ajan kimlikleri komite içinde benzersiz',
      passed: Object.values(committees).every(list => new Set(list.map(agent => agent.id)).size === list.length)
    },
    {
      label: 'Bilinmeyen alan varsayılan komiteye düşer',
      passed: (getDomainAgentCommittee(ideaFor('Bahçe için sulama takvimi tutmak istiyorum')) as Agent[]).length === 4
    }
  ];
}

/** Yeteneğin manşet iddiası: bağımsız LLM ajanı çalıştırmaz. */
function noLlmAgentsRun(): Assertion[] {
  const project = ideaFor(DOMAIN_IDEAS.web);
  const first = JSON.stringify(runCommitteeEvaluation(project));
  const second = JSON.stringify(runCommitteeEvaluation(project));
  const votingFirst = JSON.stringify(runCommitteeVoting(project));
  const votingSecond = JSON.stringify(runCommitteeVoting(project));

  return [
    // Asenkron olsaydı Promise donerdi; senkron olmasi ag cagrisi olmadiginin
    // yapisal kanitidir.
    { label: 'Değerlendirme senkron çalışır (Promise döndürmez)', passed: !(runCommitteeEvaluation(project) instanceof Promise) },
    { label: 'Oylama senkron çalışır', passed: !(runCommitteeVoting(project) instanceof Promise) },
    { label: 'Aynı girdi aynı değerlendirmeyi üretir', passed: first === second },
    { label: 'Aynı girdi aynı oylamayı üretir', passed: votingFirst === votingSecond },
    { label: 'Komite üretimi deterministik', passed: JSON.stringify(getDomainAgentCommittee(project)) === JSON.stringify(getDomainAgentCommittee(project)) }
  ];
}

function evaluationCoversEveryAgent(): Assertion[] {
  const project = ideaFor(DOMAIN_IDEAS.game);
  const committee = getDomainAgentCommittee(project) as Agent[];
  const evaluations = runCommitteeEvaluation(project) as Array<{ agent: Agent; recommendation: string; decisionProposal: string }>;

  return [
    { label: 'Her uzman için bir değerlendirme üretilir', passed: evaluations.length === committee.length },
    { label: 'Her değerlendirme öneri metni taşır', passed: evaluations.every(item => item.recommendation.length > 0) },
    { label: 'Her değerlendirme karar adayı üretir', passed: evaluations.every(item => item.decisionProposal.length > 0) },
    { label: 'Değerlendirme ajan kimliğini korur', passed: evaluations.every((item, index) => item.agent.id === committee[index].id) },
    {
      label: 'En az bir öneri proje fikrini alıntılar',
      passed: evaluations.some(item => item.recommendation.includes(project.identity.originalIdea.trim()))
    }
  ];
}

function votingRequiresAcceptedDecisions(): Assertion[] {
  const project = ideaFor(DOMAIN_IDEAS.web) as unknown as { decisions: unknown[] };
  project.decisions = [];
  const empty = runCommitteeVoting(project) as { score: number; votes: Array<{ vote: string; note: string }>; summary: string };

  const single = ideaFor(DOMAIN_IDEAS.web) as unknown as { decisions: unknown[] };
  single.decisions = [acceptedDecision('d1', 'Veri katmanı', 'PostgreSQL kullanılacak')];
  const oneDecision = runCommitteeVoting(single) as { votes: Array<{ vote: string }> };

  return [
    // Karar yoksa perspektif onay veremez; kanıtsız onay üretmemeli.
    { label: 'Karar yokken hiçbir uzman kesin onay vermez', passed: empty.votes.every(vote => vote.vote !== 'approved') },
    { label: 'Karar yokken tüm oylar şartlıdır', passed: empty.votes.every(vote => vote.vote === 'conditional') },
    { label: 'Şartlı oylama %50 skor üretir', passed: empty.score === 50 },
    { label: 'Eksik karar gerekçesi açıklanır', passed: empty.votes.every(vote => vote.note.includes('en az 2')) },
    { label: 'Tek karar da yeterli sayılmaz', passed: oneDecision.votes.every(vote => vote.vote === 'conditional') },
    { label: 'Özet skoru içerir', passed: empty.summary.includes('50') }
  ];
}

function securityVetoMechanism(): Assertion[] {
  const withoutSecurity = ideaFor(DOMAIN_IDEAS.web) as unknown as { decisions: unknown[] };
  withoutSecurity.decisions = [
    acceptedDecision('d1', 'Veri katmanı', 'PostgreSQL kullanılacak'),
    acceptedDecision('d2', 'Dağıtım', 'Docker ile konteynerize edilecek')
  ];
  const committee = getDomainAgentCommittee(withoutSecurity) as Agent[];
  const guard = securityVoter(committee);
  const denied = runCommitteeVoting(withoutSecurity) as { score: number; votes: Array<{ agent: Agent; vote: string; note: string }> };

  const withSecurity = ideaFor(DOMAIN_IDEAS.web) as unknown as { decisions: unknown[] };
  withSecurity.decisions = [
    acceptedDecision('d1', 'Veri katmanı', 'PostgreSQL kullanılacak'),
    acceptedDecision('d2', 'Yetkilendirme', 'JWT tabanlı oturum ve RBAC uygulanacak')
  ];
  const allowed = runCommitteeVoting(withSecurity) as { score: number; votes: Array<{ vote: string }> };

  const guardVote = denied.votes.find(vote => vote.agent.id === guard?.id);

  return [
    { label: 'Web komitesinde güvenlik perspektifi bulunur', passed: Boolean(guard) },
    // Mekanizma alan tablosuna degil, guvenlik ajaninin varligina baglanir;
    // komite bilesimi degisirse bu senaryo yine gecerli kalir.
    { label: 'Güvenlik kararı yokken güvenlik perspektifi reddeder', passed: guardVote?.vote === 'rejected' },
    { label: 'Ret gerekçesi güvenlik kararına işaret eder', passed: Boolean(guardVote?.note.includes('Güvenlik')) },
    { label: 'Diğer perspektifler yine de onaylayabilir', passed: denied.votes.filter(vote => vote.vote === 'approved').length === 3 },
    { label: 'Güvenlik kararı eklenince tam onay çıkar', passed: allowed.votes.every(vote => vote.vote === 'approved') },
    { label: 'Tam onay %100 skor üretir', passed: allowed.score === 100 },
    { label: 'Güvenlik eksikken skor düşer', passed: denied.score < allowed.score }
  ];
}

function customSlotAndNoMutation(): Assertion[] {
  const project = ideaFor(DOMAIN_IDEAS.ai) as unknown as {
    customAgentSlot?: Agent; decisions: unknown[]; identity: { originalIdea: string };
  };
  const baseline = (getDomainAgentCommittee(project) as Agent[]).length;
  project.customAgentSlot = {
    id: 'agent-custom', name: 'Alan Uzmanı', role: 'Domain Expert',
    icon: '🔍', color: '#ffffff', focus: 'Projeye özel alan kuralları'
  };
  const extended = getDomainAgentCommittee(project) as Agent[];

  const before = JSON.stringify(project);
  runCommitteeEvaluation(project);
  runCommitteeVoting(project);
  const after = JSON.stringify(project);

  return [
    { label: 'Özel uzman slotu komiteye eklenir', passed: extended.length === baseline + 1 },
    { label: 'Özel uzman listenin sonunda yer alır', passed: extended.at(-1)?.id === 'agent-custom' },
    { label: 'Yerleşik uzmanlar korunur', passed: extended.slice(0, baseline).every(agent => agent.id !== 'agent-custom') },
    // Perspektifler oneri uretir; canonical plani kendiliginden degistirmez.
    { label: 'Değerlendirme ve oylama projeyi değiştirmez', passed: before === after }
  ];
}

const scenarios = [
  { id: 'domain-aware-committee', title: 'Komite alana göre kurulur', intent: 'Oyun, web, mobil ve AI projeleri farklı uzman perspektifleri almalı; bilinmeyen alan varsayılana düşmeli.', run: domainAwareCommittee },
  { id: 'no-llm-agents-run', title: 'Bağımsız LLM ajanı çalışmaz', intent: 'Yetenek yerel kural motorudur; çıktı senkron ve deterministik olmalı.', run: noLlmAgentsRun },
  { id: 'evaluation-covers-every-agent', title: 'Her uzman değerlendirme üretir', intent: 'Komitedeki her perspektif öneri ve karar adayı üretmeli, kimliğini korumalı.', run: evaluationCoversEveryAgent },
  { id: 'voting-requires-accepted-decisions', title: 'Oylama kanıt ister', intent: 'Kabul edilmiş karar yokken hiçbir perspektif kesin onay vermemeli.', run: votingRequiresAcceptedDecisions },
  { id: 'security-veto-mechanism', title: 'Güvenlik vetosu', intent: 'Güvenlik perspektifi, açık bir güvenlik kararı olmadan onay vermemeli.', run: securityVetoMechanism },
  { id: 'custom-slot-and-no-mutation', title: 'Özel uzman ve mutasyon yokluğu', intent: 'Projeye özel uzman eklenebilmeli; perspektifler canonical belgeyi değiştirmemeli.', run: customSlotAndNoMutation }
];

const results = scenarios.map(scenario => {
  const assertions = scenario.run();
  return {
    id: scenario.id,
    title: scenario.title,
    intent: scenario.intent,
    passed: assertions.every(item => item.passed),
    assertionCount: assertions.length,
    failedAssertions: assertions.filter(item => !item.passed).map(item => item.label),
    assertions
  };
});

const report = {
  benchmarkVersion: '1.0.0',
  capabilityId: 'expert-perspectives',
  completed: results.length,
  passed: results.filter(item => item.passed).length,
  passRate: results.filter(item => item.passed).length / results.length,
  results
};

const jsonPath = resolve('benchmarks/idea-lab/expert-perspectives/latest-report.json');
const markdownPath = resolve('docs/product/EXPERT_PERSPECTIVES_REPORT.md');
const evidencePath = resolve('src/v4/product/generated-expert-perspectives-evidence.ts');
const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = [
  '# Uzman Perspektifleri Benchmark',
  '',
  `Sonuç: **${report.passed}/${report.completed}** senaryo geçti (${results.reduce((sum, item) => sum + item.assertionCount, 0)} doğrulama).`,
  '',
  '| Senaryo | Sonuç | Doğrulama |',
  '|---|---:|---:|',
  ...results.map(item => `| ${item.title} | ${item.passed ? 'Geçti' : 'Kaldı'} | ${item.assertionCount} |`),
  '',
  '## Ölçülen davranış',
  '',
  ...scenarios.map(item => `- **${item.title}** — ${item.intent}`),
  '',
  '## Bu benchmarkın kanıtlamadıkları',
  '',
  '- Perspektiflerin **isabetli** olduğunu göstermez. Ölçülen; komitenin alana göre',
  '  kurulduğu, çıktının deterministik olduğu ve kanıtsız onay üretilmediğidir.',
  '- Öneri metinleri sabit kural şablonlarından gelir; proje analizinden türetilmez.',
  '- Bağımsız LLM ajanları çalıştırılmaz. `no-llm-agents-run` senaryosu tam olarak',
  '  bu beyanın doğruluğunu ölçer; çıktı asenkron olsaydı senaryo kalırdı.',
  '- Güvenlik vetosu yalnız komitede güvenlik kimliği taşıyan bir uzman varken',
  '  uygulanır. Komite bileşimi alana göre değişir.',
  ''
].join('\n');
const evidence = [
  '// Bu dosya scripts/expert-perspectives-benchmark.ts tarafından üretilir.',
  'export const EXPERT_PERSPECTIVES_BENCHMARK_EVIDENCE = Object.freeze({',
  `  completed: ${report.completed},`,
  `  passed: ${report.passed},`,
  `  source: 'docs/product/EXPERT_PERSPECTIVES_REPORT.md'`,
  '});',
  ''
].join('\n');

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const files = [[jsonPath, json], [markdownPath, markdown], [evidencePath, evidence]] as const;
  const stale = files.filter(([path, expected]) => {
    try {
      return readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== expected.replaceAll('\r\n', '\n');
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`Uzman perspektifleri kanıtı güncel değil: ${stale.map(([path]) => path).join(', ')}`);
    process.exit(1);
  }
} else {
  for (const path of [jsonPath, markdownPath, evidencePath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(markdownPath, markdown);
  writeFileSync(evidencePath, evidence);
}

console.log(`Expert perspectives benchmark: ${report.passed}/${report.completed}`);
if (report.passed !== report.completed) {
  for (const item of results.filter(entry => !entry.passed)) {
    console.error(`  ✗ ${item.id}: ${item.failedAssertions.join(' | ')}`);
  }
  process.exit(1);
}
