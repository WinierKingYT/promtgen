import assert from 'node:assert/strict';
import { analyzeIdea } from '../../src/v4/planning-engine.js';
import { buildPortfolioSummary, filterPortfolioProjects } from '../../src/v4/portfolio-engine.js';

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
