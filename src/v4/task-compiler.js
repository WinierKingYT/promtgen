import { normalizeAgentPrompt, normalizeMilestone, normalizeTask, normalizeTestCase, normalizeTraceLink } from './canonical-entities.js';

function slug(value) {
    return String(value || 'item').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'item';
}

function uniqueId(prefix, label, used) {
    const base = `${prefix}-${slug(label)}`;
    let candidate = base; let suffix = 2;
    while (used.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
    used.add(candidate); return candidate;
}

function topologicalOrder(tasks) {
    const byId = new Map(tasks.map(task => [task.id, task]));
    const visiting = new Set(); const visited = new Set(); const ordered = []; const cycles = [];
    function visit(task) {
        if (visited.has(task.id)) return;
        if (visiting.has(task.id)) { cycles.push(task.id); return; }
        visiting.add(task.id);
        for (const dependencyId of task.dependencies) if (byId.has(dependencyId)) visit(byId.get(dependencyId));
        visiting.delete(task.id); visited.add(task.id); ordered.push(task);
    }
    tasks.forEach(visit);
    return { ordered, cycles: [...new Set(cycles)] };
}

function buildPromptChain(project, tasks) {
    if (!tasks.length) return [];
    const taskIds = tasks.map(task => task.id);
    const projName = project.identity?.name || project.identity?.originalIdea || 'Proje';
    const decisionsSummary = (project.decisions || []).slice(0, 3).map(d => d.title).join(', ') || 'Temel mimari kararlar';

    const planner = normalizeAgentPrompt({
        id: 'prompt-planner', role: 'planner', title: `"${projName}" Uygulama Sırasını Doğrula`, taskIds,
        instructions: `"${projName}" projesi için canonical gereksinimleri, mimari kararları (${decisionsSummary}) ve bağımlılıkları kontrol et; dosya kapsamı, riskler ve doğrulama komutlarıyla uygulanabilir bir çalışma sırası çıkar.`,
        expectedOutputs: ['Onaylanmış görev sırası', 'Dosya etki listesi', 'Doğrulama planı'], status: 'ready'
    });
    const implementer = normalizeAgentPrompt({
        id: 'prompt-implementer', role: 'implementer', title: `"${projName}" Kodlama & Uygulama`, taskIds, dependsOnPromptIds: [planner.id],
        instructions: `"${projName}" projesinin görevlerini bağımlılık sırasıyla uygula. Kabul edilen kararları (${decisionsSummary}) bozmadan her görevin kabul kriterlerini tek tek karşıla.`,
        expectedOutputs: ['Kod değişiklikleri', 'Çalıştırılan testler', 'Kalan riskler'], status: 'ready'
    });
    const reviewer = normalizeAgentPrompt({
        id: 'prompt-reviewer', role: 'reviewer', title: `"${projName}" Mimari & Güvenlik İncelemesi`, taskIds, dependsOnPromptIds: [implementer.id],
        instructions: `"${projName}" kod değişikliklerini güvenlik, geriye uyumluluk ve mimari kararlar (${decisionsSummary}) açısından incele. Bulguları önem derecesiyle raporla.`,
        expectedOutputs: ['Öncelikli bulgular', 'Düzeltme önerileri'], status: 'ready'
    });
    const verifier = normalizeAgentPrompt({
        id: 'prompt-verifier', role: 'verifier', title: `"${projName}" Kabul Testi Doğrulama`, taskIds, dependsOnPromptIds: [reviewer.id],
        instructions: `"${projName}" kabul kriterlerini ve test senaryolarını test kanıtıyla doğrula; tüm kabul kriterleri geçmeden sürümü tamamlama.`,
        expectedOutputs: ['Kabul matrisi', 'Test kanıtları', 'Yayın kararı'], status: 'ready'
    });
    return [planner, implementer, reviewer, verifier];
}

export function compileTaskPlan(project) {
    const used = new Set((project.tasks || []).map(task => task.id));
    const tasks = [];
    const sourceRequirements = [...(project.requirements || [])];
    
    // Fallback: If formal requirements array is empty, derive task candidates from scope items & accepted decisions
    if (!sourceRequirements.length) {
        const scopeItems = project.sections?.scope?.items || [];
        const decisions = (project.decisions || []).filter(d => d.status === 'accepted');
        
        scopeItems.forEach((item, idx) => {
            sourceRequirements.push({
                id: `req-scope-${idx + 1}`,
                title: item,
                statement: item,
                priority: 'medium',
                kind: 'functional',
                acceptanceCriteria: [`"${item}" özelliği başarıyla entegre ve test edilmelidir.`]
            });
        });
        
        decisions.forEach((dec, idx) => {
            sourceRequirements.push({
                id: `req-dec-${idx + 1}`,
                title: dec.title,
                statement: dec.decision,
                priority: 'high',
                kind: 'architecture',
                acceptanceCriteria: [`"${dec.title}" mimari kararı koda yansıtılmalıdır: ${dec.decision}`]
            });
        });
    }

    for (const requirement of sourceRequirements) {
        const id = uniqueId('task', requirement.title, used);
        tasks.push(normalizeTask({
            id, title: requirement.title, description: requirement.statement,
            priority: requirement.priority || 'medium', effort: requirement.kind === 'quality' ? 'medium' : 'low',
            requirementIds: [requirement.id], acceptanceCriteria: requirement.acceptanceCriteria || [],
            status: (requirement.acceptanceCriteria || []).length ? 'ready' : 'backlog'
        }));
    }
    const testCases = tasks.map(task => normalizeTestCase({
        id: `test-${task.id.replace(/^task-/, '')}`, title: `${task.title} kabul testi`, kind: 'acceptance',
        steps: task.acceptanceCriteria, expectedResult: task.acceptanceCriteria.join('; ') || 'Gereksinim davranışı doğrulanır.',
        requirementIds: task.requirementIds, status: task.acceptanceCriteria.length ? 'ready' : 'draft'
    }));
    for (let index = 0; index < tasks.length; index += 1) tasks[index].verificationIds = [testCases[index].id];
    const orderedResult = topologicalOrder(tasks);
    const milestone = tasks.length ? normalizeMilestone({ id: 'milestone-initial', title: 'İlk uygulanabilir teslim', outcome: project.identity.desiredOutcome || project.identity.summary, taskIds: orderedResult.ordered.map(task => task.id), status: 'planned' }) : null;
    const traceLinks = [
        ...tasks.flatMap(task => task.requirementIds.map(requirementId => normalizeTraceLink({ id: `trace-${requirementId}-${task.id}`, fromType: 'requirement', fromId: requirementId, toType: 'task', toId: task.id, relation: 'implements' }))),
        ...testCases.flatMap(testCase => testCase.requirementIds.map(requirementId => normalizeTraceLink({ id: `trace-${requirementId}-${testCase.id}`, fromType: 'requirement', fromId: requirementId, toType: 'test', toId: testCase.id, relation: 'validated_by' })))
    ];
    return {
        baseRevision: project.revision,
        tasks: orderedResult.ordered,
        testCases,
        milestones: milestone ? [milestone] : [],
        traceLinks,
        agentPrompts: buildPromptChain(project, orderedResult.ordered),
        warnings: [
            ...orderedResult.cycles.map(id => `Görev bağımlılık döngüsü: ${id}`),
            ...(project.requirements?.length ? [] : ['Görev üretmek için önce canonical gereksinim oluşturulmalı.']),
            ...tasks.filter(task => !task.acceptanceCriteria.length).map(task => `${task.title} için kabul kriteri eksik.`)
        ]
    };
}

export function applyCompiledTaskPlan(project, compilation, { approved = false } = {}) {
    if (!approved) return { success: false, project, reason: 'Görev planı kullanıcı onayı bekliyor.' };
    if (compilation.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; görev taslağı yeniden üretilmeli.' };
    if (!compilation.tasks.length) return { success: false, project, reason: compilation.warnings[0] || 'Uygulanabilir görev üretilemedi.' };
    const next = structuredClone(project);
    next.tasks = compilation.tasks;
    next.testCases = compilation.testCases;
    next.milestones = compilation.milestones;
    next.traceLinks = compilation.traceLinks;
    next.agentPrompts = compilation.agentPrompts;
    next.revision += 1;
    next.lifecycle.updatedAt = new Date().toISOString();
    next.sections.tasks.items = compilation.tasks.map(task => task.title);
    next.sections.tasks.status = 'draft';
    next.sections.tasks.updatedAtRevision = next.revision;
    next.sections.testing.items = compilation.testCases.map(testCase => testCase.title);
    next.sections.testing.status = 'draft';
    next.sections.testing.updatedAtRevision = next.revision;
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-${Date.now()}`, number: next.revision, createdAt: next.lifecycle.updatedAt,
        summary: 'Onaylı görev ve ajan planı oluşturuldu', acceptedSuggestionIds: [],
        affectedSections: ['tasks', 'testing'], snapshot
    });
    return { success: true, project: next, reason: '', warnings: compilation.warnings };
}

export { topologicalOrder };
