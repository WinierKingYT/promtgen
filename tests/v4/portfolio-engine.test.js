import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { buildComparativeAnalytics, buildPortfolioSummary, filterPortfolioProjects } from '../../src/v4/portfolio-engine.js';

const alpha = analyzeIdea('Alpha için küçük yerel not projesi');
alpha.id = 'portfolio-alpha'; alpha.identity.name = 'Alpha Notları'; alpha.readiness.score = 30; alpha.lifecycle.updatedAt = '2026-01-01T00:00:00.000Z';
const beta = analyzeIdea('Beta için kapsamlı kurumsal operasyon ve güvenlik projesi');
beta.id = 'portfolio-beta'; beta.identity.name = 'Beta Operasyon'; beta.planningDepth.selected = 'enterprise'; beta.readiness.score = 90; beta.lifecycle.updatedAt = '2026-02-01T00:00:00.000Z'; beta.lifecycle.status = 'finalized';
const gamma = analyzeIdea('Gamma içerik yayın planı');
gamma.id = 'portfolio-gamma'; gamma.identity.name = 'Gamma İçerik'; gamma.readiness.score = 60; gamma.lifecycle.updatedAt = '2026-03-01T00:00:00.000Z';

const summary = buildPortfolioSummary([alpha, beta, gamma]);
assert.equal(summary.total, 3);
assert.equal(summary.statuses.finalized, 1);
assert.equal(summary.depths.enterprise, 1);
assert.equal(summary.averageReadiness, 60);
assert.ok(summary.attention.some(item => item.id === 'portfolio-alpha'));
assert.deepEqual(filterPortfolioProjects([alpha, beta, gamma], { query: 'operasyon' }).map(item => item.id), ['portfolio-beta']);
assert.deepEqual(filterPortfolioProjects([alpha, beta, gamma], { status: 'finalized' }).map(item => item.id), ['portfolio-beta']);
assert.deepEqual(filterPortfolioProjects([alpha, beta, gamma], { depth: 'enterprise' }).map(item => item.id), ['portfolio-beta']);
assert.deepEqual(filterPortfolioProjects([alpha, beta, gamma], { sort: 'readiness' }).map(item => item.id), ['portfolio-beta', 'portfolio-gamma', 'portfolio-alpha']);

console.log('✓ V4 local project portfolio summary and filters');

// buildComparativeAnalytics is currently unused by any src/react caller and had
// zero test coverage before this conversion. It reuses buildPortfolioSummary's
// output and layers on totals + a top-3 "most active" ranking by
// canonicalRevision, so it is pinned here as a characterization test ahead of
// the JS -> TS conversion.
// normalizeProjectDocument clamps canonicalRevision to documentRevision, so
// documentRevision must be raised alongside it for this to take effect.
alpha.documentRevision = 1; alpha.canonicalRevision = 1;
beta.documentRevision = 5; beta.canonicalRevision = 5;
gamma.documentRevision = 3; gamma.canonicalRevision = 3;
alpha.tasks = [{ title: 'Alpha task 1' }];
beta.tasks = [{ title: 'Beta task 1' }, { title: 'Beta task 2' }];
gamma.decisions = [{ title: 'Gamma decision 1' }, { title: 'Gamma decision 2' }, { title: 'Gamma decision 3' }];

const analytics = buildComparativeAnalytics([alpha, beta, gamma]);
assert.equal(analytics.total, 3, 'reuses buildPortfolioSummary fields');
assert.equal(analytics.totalRevisions, 1 + 5 + 3);
assert.equal(analytics.totalTasks, 1 + 2 + 0);
assert.equal(analytics.totalDecisions, 0 + 0 + 3);
assert.deepEqual(analytics.topActive.map(item => item.id), ['portfolio-beta', 'portfolio-gamma', 'portfolio-alpha'], 'topActive is sorted by canonicalRevision descending, capped at 3');
assert.equal(analytics.topActive.length, 3);
assert.equal(analytics.topActive[0].canonicalRevision, 5);
assert.equal(analytics.topActive[0].score, beta.readiness.score);
assert.ok(!Number.isNaN(Date.parse(analytics.analyzedAt)), 'analyzedAt is a parseable ISO timestamp');

console.log('✓ V4 portfolio comparative analytics (characterization)');
