import { analyzeCanonicalTraceability } from './canonical-graph.js';
import { normalizeReviewFinding, normalizeSimulationRun } from './canonical-entities.js';
import { getRequiredSections } from './project-state-v4.js';

const SEVERITY_WEIGHT = { info: 0, low: 3, medium: 8, high: 18, critical: 35 };
function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function finding(ruleId, category, severity, title, description, recommendation, sectionIds = [], entityIds = []) {
    return normalizeReviewFinding({ id: id('finding'), ruleId, category, severity, title, description, recommendation, sectionIds, entityIds, status: 'open' });
}

export function runPlanReview(project, { profile = 'deep' } = {}) {
    const findings = [];
    for (const sectionId of getRequiredSections(project.planningDepth.selected)) {
        const section = project.sections[sectionId];
        if (!section?.content && !section?.items?.length) findings.push(finding('PLAN-001', 'completeness', sectionId === 'vision' || sectionId === 'scope' ? 'critical' : 'high', `${section?.title || sectionId} bölümü boş`, 'Seçilen plan derinliği bu bölümü zorunlu kılıyor.', 'Bölümü kullanıcı onaylı kararlarla doldur.', [sectionId]));
        if (section?.status === 'stale') findings.push(finding('PLAN-002', 'consistency', 'high', `${section.title} güncelliğini yitirdi`, 'Upstream değişikliklerden sonra bölüm yeniden doğrulanmadı.', 'Etkilenen kararları gözden geçir ve bölümü yeniden kaydet.', [sectionId]));
    }
    if (project.openQuestions.length) findings.push(finding('DISC-001', 'discovery', 'medium', 'Açık keşif soruları var', `${project.openQuestions.length} soru henüz yanıtlanmadı.`, 'Finalizasyondan önce soruları yanıtla veya bilinçli olarak ertele.'));
    for (const requirement of project.requirements) {
        if (!requirement.acceptanceCriteria.length) findings.push(finding('REQ-001', 'requirements', 'high', 'Gereksinimin kabul kriteri yok', requirement.title, 'Gözlenebilir ve test edilebilir kabul kriterleri ekle.', ['requirements', 'testing'], [requirement.id]));
        if (!requirement.sourceObjectiveIds.length && project.objectives.length) findings.push(finding('REQ-002', 'traceability', 'medium', 'Gereksinim hedefe bağlı değil', requirement.title, 'Gereksinimi en az bir canonical hedefe bağla.', ['requirements'], [requirement.id]));
    }
    for (const task of project.tasks) {
        if (!task.requirementIds.length) findings.push(finding('TASK-001', 'execution', 'high', 'Görev gereksinime bağlı değil', task.title, 'Göreve kaynak requirement kimliği ekle.', ['tasks'], [task.id]));
        if (!task.acceptanceCriteria.length) findings.push(finding('TASK-002', 'execution', 'high', 'Görevin kabul kriteri yok', task.title, 'Göreve doğrulanabilir kabul kriterleri ekle.', ['tasks', 'testing'], [task.id]));
    }
    if (profile === 'deep') {
        if (['advanced', 'enterprise'].includes(project.planningDepth.selected)) {
            for (const decision of project.decisions.filter(item => item.status === 'accepted')) if (!decision.rationale) findings.push(finding('DEC-001', 'architecture', 'medium', 'Kararın gerekçesi eksik', decision.title, 'Alternatif ve trade-off içeren gerekçe ekle.', ['decisions'], [decision.id]));
            for (const risk of project.risks.filter(item => item.status === 'open')) if (!risk.mitigation) findings.push(finding('RISK-001', 'risk', 'high', 'Açık riskin azaltma planı yok', risk.title, 'Sorumlu, azaltma adımı ve tetikleyici belirle.', ['risks'], [risk.id]));
        }
        const graphReport = analyzeCanonicalTraceability(project).report;
        for (const cycle of graphReport.cycles.details) findings.push(finding('TRACE-001', 'traceability', 'critical', 'Bağımlılık döngüsü bulundu', cycle.join(' → '), 'Döngüyü kır veya görev sınırlarını yeniden düzenle.', ['tasks'], cycle));
        if (project.requirements.length && graphReport.coverage.requirements.taskCoverage < 80) findings.push(finding('TRACE-002', 'traceability', 'high', 'Gereksinim–görev kapsamı düşük', `Kapsam %${graphReport.coverage.requirements.taskCoverage}.`, 'Her zorunlu gereksinimi en az bir göreve bağla.', ['requirements', 'tasks']));
        if (project.requirements.length && graphReport.coverage.requirements.testCoverage < 60) findings.push(finding('TRACE-003', 'traceability', 'high', 'Gereksinim–test kapsamı düşük', `Kapsam %${graphReport.coverage.requirements.testCoverage}.`, 'Kabul testlerini gereksinimlere bağla.', ['requirements', 'testing']));
    }
    const activeModules = new Set((project.modules?.active || []).map(item => item.id));
    if (activeModules.has('research.evidence')) {
        if (!project.researchQuestions.length) findings.push(finding('RESEARCH-METHOD', 'research', 'high', 'Araştırma sorusu tanımlı değil', 'Araştırma paketi etkin ancak yapılandırılmış araştırma sorusu yok.', 'Araştırma sorusu, amaç, yöntem ve beklenen kanıt türünü tanımla.', ['objectives', 'requirements']));
        if (!project.evidence.length) findings.push(finding('EVIDENCE-COVERAGE', 'research', 'medium', 'Kanıt defteri boş', 'Henüz doğrulanmış kaynak veya kanıt kaydı yok.', 'Birincil kaynakları ve destekledikleri iddiaları kaydet.', ['decisions', 'risks']));
    }
    if (activeModules.has('content.production')) {
        if (!project.objectives.length) findings.push(finding('CONTENT-AUDIENCE', 'content', 'high', 'İçerik hedefi ve kitle ölçütü eksik', 'İçerik üretiminin hedef kitlesi veya ölçülebilir sonucu yapılandırılmadı.', 'Hedef kitleyi ve başarı metriğini objective olarak ekle.', ['objectives']));
        if (!project.tasks.length && !project.milestones.length) findings.push(finding('CONTENT-CALENDAR', 'content', 'medium', 'İçerik üretim takvimi eksik', 'Üretim görevleri veya yayın kilometre taşları yok.', 'Taslak, inceleme, yayın ve dağıtım adımlarını takvime bağla.', ['tasks', 'operations']));
    }
    if (activeModules.has('business.operations')) {
        if (!project.sections.operations?.content && !project.sections.operations?.items.length) findings.push(finding('OPERATIONS-OWNER', 'operations', 'high', 'Operasyon sahipliği tanımlı değil', 'Günlük süreç, sorumlu ve kapasite sınırları belirtilmedi.', 'Operasyon bölümüne sahiplik ve işleyiş modeli ekle.', ['operations']));
        if (!project.risks.length) findings.push(finding('OPERATIONS-RISK', 'operations', 'medium', 'Operasyon riski kaydı yok', 'Tedarik, kapasite veya süreklilik riski tanımlanmadı.', 'En az bir operasyon riski ve azaltma planı ekle.', ['risks']));
    }
    if (activeModules.has('event.delivery')) {
        if (!project.milestones.length) findings.push(finding('EVENT-MILESTONE', 'event', 'high', 'Etkinlik kilometre taşları eksik', 'Hazırlık, prova, etkinlik günü ve kapanış zamanları planlanmadı.', 'Etkinlik teslim kilometre taşlarını tanımla.', ['tasks', 'operations']));
        if (!project.risks.some(risk => risk.mitigation)) findings.push(finding('EVENT-CONTINGENCY', 'event', 'high', 'Etkinlik acil durum planı eksik', 'Aksama halinde uygulanacak azaltma veya alternatif akış yok.', 'Kritik etkinlik risklerine yedek plan ekle.', ['risks', 'operations']));
    }
    const counts = Object.fromEntries(['critical', 'high', 'medium', 'low', 'info'].map(severity => [severity, findings.filter(item => item.severity === severity).length]));
    const score = Math.max(0, 100 - findings.reduce((total, item) => total + SEVERITY_WEIGHT[item.severity], 0));
    const gates = {
        discovery: !findings.some(item => item.category === 'discovery' && ['critical', 'high'].includes(item.severity)),
        design: !findings.some(item => ['architecture', 'risk'].includes(item.category) && ['critical', 'high'].includes(item.severity)),
        execution: !findings.some(item => ['requirements', 'execution', 'traceability'].includes(item.category) && ['critical', 'high'].includes(item.severity)),
        final: !findings.some(item => ['critical', 'high'].includes(item.severity))
    };
    return { baseRevision: project.revision, profile, score, counts, gates, findings, reviewedAt: new Date().toISOString() };
}

function check(idValue, label, passed, detail) { return { id: idValue, label, passed, detail }; }

export function simulatePlan(project) {
    const scenarios = [
        { scenario: 'delivery', title: 'Normal teslim', checks: [check('tasks', 'Görev planı var', project.tasks.length > 0, `${project.tasks.length} görev`), check('tests', 'Test planı var', project.testCases.length > 0, `${project.testCases.length} test`), check('milestone', 'Teslim hedefi var', project.milestones.length > 0, `${project.milestones.length} kilometre taşı`)] },
        { scenario: 'dependency_failure', title: 'Bağımlılık başarısızlığı', checks: [check('dependencies', 'Bağımlılıklar açık', project.tasks.every(task => Array.isArray(task.dependencies)), 'Görev bağımlılık alanları'), check('risk', 'Teknik risk azaltımı var', project.risks.some(risk => risk.mitigation), 'Azaltma planlı risk')] },
        { scenario: 'security_privacy', title: 'Güvenlik ve gizlilik olayı', checks: [check('security-section', 'Güvenlik bölümü tanımlı', Boolean(project.sections.security?.content || project.sections.security?.items.length), 'Güvenlik planı'), check('security-risk', 'Güvenlik riski kaydı var', project.risks.length > 0, `${project.risks.length} risk`)] },
        { scenario: 'rollback', title: 'Yayın geri alma', checks: [check('deployment', 'Dağıtım planı var', Boolean(project.sections.deployment?.content || project.sections.deployment?.items.length), 'Dağıtım bölümü'), check('rollback', 'Geri alma yaklaşımı belirtilmiş', /rollback|geri\s+al/i.test(`${project.sections.deployment?.content || ''} ${(project.sections.deployment?.items || []).join(' ')}`), 'Rollback/geri alma ifadesi')] }
    ];
    return scenarios.map(item => {
        const passed = item.checks.filter(value => value.passed).length;
        const status = passed === item.checks.length ? 'passed' : passed === 0 ? 'failed' : 'warning';
        return normalizeSimulationRun({ id: id('simulation'), scenario: item.scenario, title: item.title, status, summary: `${passed}/${item.checks.length} kontrol geçti.`, checks: item.checks, createdAt: new Date().toISOString(), projectRevision: project.revision });
    });
}

export function applyReviewResult(project, review, simulations = []) {
    if (review.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; inceleme yeniden çalıştırılmalı.' };
    const next = structuredClone(project);
    next.reviewFindings = review.findings;
    next.simulationRuns = [...next.simulationRuns, ...simulations].slice(-20);
    next.metadata = { ...(next.metadata || {}), lastReview: { revision: project.revision, score: review.score, counts: review.counts, gates: review.gates, reviewedAt: review.reviewedAt } };
    next.revision += 1; next.lifecycle.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(next); snapshot.revisions = [];
    next.revisions.push({ id: id('revision'), number: next.revision, createdAt: next.lifecycle.updatedAt, summary: 'Deterministic plan incelemesi kaydedildi', acceptedSuggestionIds: [], affectedSections: [], snapshot });
    return { success: true, project: next, reason: '' };
}
