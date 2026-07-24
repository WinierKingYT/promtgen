import assert from 'node:assert/strict';
import { analyzeIdea, applyApprovedChanges, applyIdeaExpansion, captureCurrentRevision, comparePlanRevisions, diffTextLines, finalizePlan, overridePlanningDepth, previewApprovedChanges, reopenPlan, restorePlanRevision, updatePlanSection, updateSuggestionStatus } from '../../src/v4/planning-engine.js';
import { generateExpansionDimensions } from '../../src/v4/ai-discovery.js';

// --- Idea Expansion path (short idea < 50 chars) ---
const shortProject = analyzeIdea('web sitesi yap');
assert.equal(shortProject.lifecycle.activePhase, 'IDEA_EXPANSION', 'Kısa fikir IDEA_EXPANSION fazını başlatmalı');
assert.equal(shortProject.suggestionBundles.length, 0, 'IDEA_EXPANSION fazında henüz öneri üretilmemeli');
const dims = generateExpansionDimensions('web sitesi yap');
assert.equal(dims.length, 5, '5 boyut üretilmeli');
const expanded = applyIdeaExpansion(shortProject, { answers: { problem: 'Müşterilere kolay erişim', user: 'KOBİler' }, dimensions: dims });
assert.equal(expanded.lifecycle.activePhase, 'DISCOVERY', 'Genişletme sonrası DISCOVERY fazına geçilmeli');
assert.ok(expanded.identity.originalIdea.includes('Müşterilere kolay erişim'), 'Genişletilmiş fikir cevapları içermeli');
assert.ok(expanded.suggestionBundles.length > 0, 'DISCOVERY fazında öneri bundleları üretilmeli');

// --- Normal DISCOVERY path (long idea >= 50 chars) ---
let project = analyzeIdea('Local çalışan, SQLite tabanlı, CLI destekli küçük bir görev takip ve proje yönetimi uygulaması yapmak istiyorum.');
assert.equal(project.lifecycle.activePhase, 'DISCOVERY', 'Uzun fikir doğrudan DISCOVERY fazını başlatmalı');
assert.equal(project.schemaVersion, 4);
assert.ok(project.suggestionBundles[0].items.length >= 3 && project.suggestionBundles[0].items.length <= 5);
assert.ok(project.suggestionBundles[0].items.every(item => item.status === 'pending'));

const bundle = project.suggestionBundles[0];
const suggestion = bundle.items[0];
const before = project.sections.scope.items.length;
project = updateSuggestionStatus(project, bundle.id, suggestion.id, 'accepted');
assert.equal(project.sections.scope.items.length, before, 'Onay yalnız başına planı değiştirmemeli');
const beforePreview = structuredClone(project);
const blockedPreview = previewApprovedChanges(project, bundle.id);
assert.equal(blockedPreview.canApply, false, 'Bekleyen kararlar varken önizleme uygulanabilir görünmemeli');
assert.ok(blockedPreview.sections.some(section => section.sectionId === 'scope' && section.additions.length > 0));
assert.deepEqual(project, beforePreview, 'Önizleme canonical projeyi değiştirmemeli');
assert.equal(applyApprovedChanges(project, bundle.id).sections.scope.items.length, before, 'Karar bekleyen seçenek varken paket uygulanmamalı');
for (const item of bundle.items.slice(1)) project = updateSuggestionStatus(project, bundle.id, item.id, 'deferred');
const readyPreview = previewApprovedChanges(project, bundle.id);
assert.equal(readyPreview.canApply, true);
assert.equal(readyPreview.nextRevision, project.revision + 1);
project = applyApprovedChanges(project, bundle.id);
assert.ok(project.sections.scope.items.length > before, 'Yalnız onaylanan öneri plana uygulanmalı');

const oldItems = [...project.sections.scope.items];
project = overridePlanningDepth(project, 'enterprise');
assert.deepEqual(project.sections.scope.items, oldItems, 'Derinlik değişimi içeriği silmemeli');
assert.equal(project.sections.operations.required, true);

project = updatePlanSection(project, 'architecture', { content: 'İlk mimari' });
project = updatePlanSection(project, 'testing', { content: 'Mimariye bağlı test stratejisi' });
project = updatePlanSection(project, 'architecture', { content: 'Değişen mimari' });
assert.equal(project.sections.testing.status, 'stale', 'Upstream değişiklik downstream bölümü geçersizleştirmeli');

for (const [id, section] of Object.entries(project.sections)) if (section.required && !section.content && !section.items.length) project = updatePlanSection(project, id, { content: `${section.title} içeriği` });
const finalized = finalizePlan(project);
assert.equal(finalized.success, true);
assert.equal(finalized.project.lifecycle.status, 'finalized');
assert.equal(reopenPlan(finalized.project).lifecycle.status, 'active');

let versioned = captureCurrentRevision(analyzeIdea('Revision geçmişi olan, SQLite tabanlı, sürüm karşılaştırma destekli yerel bir planlama aracı yapmak istiyorum.'));
assert.equal(versioned.revisions[0].number, 1, 'Başlangıç snapshotı yakalanmalı');
versioned.exports.push({ id: 'export-1', format: 'markdown', revision: 1, createdAt: new Date().toISOString() });
versioned = updatePlanSection(versioned, 'scope', { content: 'İlk satır\nEski satır' });
const revisionTwo = versioned.revisions.find(revision => revision.number === 2);
versioned = updatePlanSection(versioned, 'scope', { content: 'İlk satır\nYeni satır' });
const beforeComparison = structuredClone(versioned);
const comparison = comparePlanRevisions(versioned, revisionTwo.id, 'current');
assert.equal(comparison.valid, true);
assert.equal(comparison.summary.changedSections, 1);
assert.ok(comparison.sections[0].content.some(line => line.type === 'removed' && line.text === 'Eski satır'));
assert.ok(comparison.sections[0].content.some(line => line.type === 'added' && line.text === 'Yeni satır'));
assert.deepEqual(versioned, beforeComparison, 'Revision karşılaştırması projeyi mutate etmemeli');
assert.deepEqual(diffTextLines('aynı\nkaldır', 'aynı\nekle').map(line => line.type), ['equal', 'removed', 'added']);
const historyLength = versioned.revisions.length;
const messageCount = versioned.messages.length;
const restored = restorePlanRevision(versioned, revisionTwo.id);
assert.equal(restored.success, true);
assert.equal(restored.project.sections.scope.content, 'İlk satır\nEski satır');
assert.equal(restored.project.revision, versioned.revision + 1, 'Restore yeni revision oluşturmalı');
assert.equal(restored.project.revisions.length, historyLength + 1, 'Eski revision geçmişi korunmalı');
assert.equal(restored.project.exports.length, 1, 'Geçmiş exportlar korunmalı');
assert.equal(restored.project.messages.length, messageCount, 'Keşif konuşması korunmalı');
assert.deepEqual(versioned, beforeComparison, 'Restore kaynak projeyi mutate etmemeli');
assert.equal(restorePlanRevision(versioned, 'current').success, false);
console.log('✓ V4 planning engine');
