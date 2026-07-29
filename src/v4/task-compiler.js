import { normalizeAgentPrompt, normalizeMilestone, normalizeTask, normalizeTestCase, normalizeTraceLink } from './canonical-entities.js';
import { evaluateRequirementQuality } from './application/requirement-quality-service.ts';
import { assessWebSaasPack, enrichWebSaasTaskContract, webSaasTestKind } from './domain-packs/web-saas.ts';

function slug(value) {
    return String(value || 'item').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'item';
}

function uniqueId(prefix, label, used) {
    const base = `${prefix}-${slug(label)}`;
    let candidate = base; let suffix = 2;
    while (used.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
    used.add(candidate); return candidate;
}

const DEFAULT_FORBIDDEN_PATHS = ['.git/**', '.env*', '**/*.pem', '**/*secret*', 'node_modules/**', 'dist/**', 'target/**'];

function projectInventory(project) {
    const value = project.profile?.projectInventory;
    return value && typeof value === 'object' ? value : null;
}

function inventoryAllowedPaths(project) {
    const entries = Array.isArray(projectInventory(project)?.inventory) ? projectInventory(project).inventory : [];
    const paths = entries
        .filter(entry => entry && typeof entry === 'object' && !entry.secretDetected && !entry.injectionDetected)
        .map(entry => String(entry.path || '').replaceAll('\\', '/').replace(/^\.?\//, ''))
        .filter(Boolean)
        .map(path => path.includes('/') ? `${path.split('/')[0]}/**` : path);
    return [...new Set(paths)].slice(0, 12);
}

function inventoryForbiddenPaths(project) {
    const inventory = projectInventory(project);
    const excluded = Array.isArray(inventory?.excluded)
        ? inventory.excluded.map(entry => String(entry?.path || '').replaceAll('\\', '/')).filter(Boolean)
        : [];
    const sensitive = Array.isArray(inventory?.security?.secretFiles)
        ? inventory.security.secretFiles.map(String)
        : [];
    return [...new Set([...DEFAULT_FORBIDDEN_PATHS, ...excluded, ...sensitive])].slice(0, 30);
}

function inventoryTestCommands(project) {
    const inventory = projectInventory(project);
    const scripts = Array.isArray(inventory?.scriptNames) ? inventory.scriptNames.map(String) : [];
    const manifests = Array.isArray(inventory?.manifests) ? inventory.manifests.map(String) : [];
    const packageManager = manifests.some(item => /pnpm-lock/i.test(item))
        ? 'pnpm'
        : manifests.some(item => /yarn\.lock/i.test(item))
            ? 'yarn'
            : 'npm';
    const preferred = ['test', 'typecheck', 'lint', 'build'].filter(name => scripts.includes(name));
    return preferred.map(name => packageManager === 'npm'
        ? (name === 'test' ? 'npm test' : `npm run ${name}`)
        : `${packageManager} ${name}`);
}

function taskContract(project, requirement, taskId) {
    const allowedPaths = inventoryAllowedPaths(project);
    const commands = inventoryTestCommands(project);
    const testCaseId = `test-${taskId.replace(/^task-/, '')}`;
    return enrichWebSaasTaskContract(project, requirement, {
        version: 2,
        objective: requirement.statement,
        inScope: [requirement.title, ...requirement.acceptanceCriteria],
        outOfScope: [
            ...(project.ideaLabSession?.conceptSummary?.outOfScope || []),
            'Bu göreve bağlı olmayan canonical gereksinimler'
        ],
        filePolicy: {
            status: allowedPaths.length ? 'inferred' : 'requires_inventory',
            allowedPaths,
            forbiddenPaths: inventoryForbiddenPaths(project)
        },
        verification: {
            testCaseIds: [testCaseId],
            commands,
            requiresCommandDiscovery: commands.length === 0
        },
        expectedOutputs: [
            `"${requirement.title}" gereksinimini karşılayan değişiklik`,
            'Değiştirilen dosyaların listesi',
            'Kabul kriteri ve test kanıtı',
            'Kalan riskler'
        ],
        completionEvidence: [
            ...requirement.acceptanceCriteria.map(criterion => `Kabul kriteri: ${criterion}`),
            `Test senaryosu: ${testCaseId}`,
            'Çalıştırılan komutların çıktısı veya komut keşfi açıklaması'
        ],
        rollbackPlan: 'Değişiklikleri görev bazlı patch/commit olarak tut; doğrulama başarısızsa yalnız bu görevin değişikliklerini geri al ve canonical planı değiştirme.'
    });
}

export function assertValidCompilation(result) {
    if (!result || typeof result !== 'object') throw new Error('TaskCompilationResult must be a non-null object.');
    if (typeof result.baseRevision !== 'number') throw new Error('TaskCompilationResult.baseRevision must be a number.');
    if (!Array.isArray(result.tasks)) throw new Error('TaskCompilationResult.tasks must be an array.');
    if (!Array.isArray(result.testCases)) throw new Error('TaskCompilationResult.testCases must be an array.');
    if (!Array.isArray(result.milestones)) throw new Error('TaskCompilationResult.milestones must be an array.');
    if (!Array.isArray(result.traceLinks)) throw new Error('TaskCompilationResult.traceLinks must be an array.');
    if (!Array.isArray(result.agentPrompts)) throw new Error('TaskCompilationResult.agentPrompts must be an array.');
    if (!Array.isArray(result.warnings)) throw new Error('TaskCompilationResult.warnings must be an array.');
    const compiledTestIds = new Set(result.testCases.map(testCase => testCase.id));
    for (const task of result.tasks) {
        if (!task.id || !task.title) throw new Error('Each compiled task must have id and title.');
        if (task.contract?.version !== 2) throw new Error(`Compiled task ${task.id} must have TaskContract V2.`);
        if (!task.contract.objective || !task.contract.inScope?.length || !task.contract.outOfScope?.length) throw new Error(`Compiled task ${task.id} scope contract is incomplete.`);
        if (!task.contract.filePolicy?.forbiddenPaths?.length) throw new Error(`Compiled task ${task.id} file policy is incomplete.`);
        if (!task.contract.verification?.testCaseIds?.length || !task.contract.completionEvidence?.length || !task.contract.rollbackPlan) throw new Error(`Compiled task ${task.id} verification contract is incomplete.`);
        if (task.contract.verification.testCaseIds.some(id => !compiledTestIds.has(id))) throw new Error(`Compiled task ${task.id} references a missing contract test case.`);
        if (!task.contract.verification.requiresCommandDiscovery && !task.contract.verification.commands.length) throw new Error(`Compiled task ${task.id} must define verification commands.`);
        if (task.contract.filePolicy.status === 'confirmed' && !task.contract.filePolicy.allowedPaths.length) throw new Error(`Compiled task ${task.id} confirmed file policy must have allowed paths.`);
    }
    for (const testCase of result.testCases) {
        if (!testCase.id || !testCase.title) throw new Error('Each compiled test case must have id and title.');
    }
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
    const webSaasActive = assessWebSaasPack(project).active;
    const domainInstruction = webSaasActive
        ? ' Web/SaaS paketi aktiftir: ana kullanıcı akışı, hata durumları, erişilebilirlik, sunucu yetkisi, veri yaşam döngüsü ve güvenli yayın sınırlarını ilgili olduklarında doğrula.'
        : '';

    const planner = normalizeAgentPrompt({
        id: 'prompt-planner', role: 'planner', title: `"${projName}" Uygulama Sırasını Doğrula`, taskIds,
        instructions: `"${projName}" projesi için canonical gereksinimleri, mimari kararları (${decisionsSummary}), bağımlılıkları ve her görevin TaskContract V2 sözleşmesini kontrol et. Dosya politikası requires_inventory ise değişiklik yapmadan önce dosya envanteri ve kullanıcı onayı iste.${domainInstruction}`,
        expectedOutputs: ['Onaylanmış görev sırası', 'Dosya etki listesi', 'Doğrulama planı'], status: 'ready'
    });
    const implementer = normalizeAgentPrompt({
        id: 'prompt-implementer', role: 'implementer', title: `"${projName}" Kodlama & Uygulama`, taskIds, dependsOnPromptIds: [planner.id],
        instructions: `"${projName}" projesinin görevlerini bağımlılık sırasıyla uygula. Her görevde inScope, outOfScope, izinli/yasak yollar, doğrulama ve rollback sözleşmesine uy; kabul edilen kararları (${decisionsSummary}) sessizce değiştirme.${domainInstruction}`,
        expectedOutputs: ['Kod değişiklikleri', 'Çalıştırılan testler', 'Kalan riskler'], status: 'ready'
    });
    const reviewer = normalizeAgentPrompt({
        id: 'prompt-reviewer', role: 'reviewer', title: `"${projName}" Mimari & Güvenlik İncelemesi`, taskIds, dependsOnPromptIds: [implementer.id],
        instructions: `"${projName}" kod değişikliklerini TaskContract V2 dosya/kapsam politikası, güvenlik, geriye uyumluluk ve mimari kararlar (${decisionsSummary}) açısından incele. Sözleşme dışı değişiklikleri engelleyici bulgu olarak raporla.${domainInstruction}`,
        expectedOutputs: ['Öncelikli bulgular', 'Düzeltme önerileri'], status: 'ready'
    });
    const verifier = normalizeAgentPrompt({
        id: 'prompt-verifier', role: 'verifier', title: `"${projName}" Kabul Testi Doğrulama`, taskIds, dependsOnPromptIds: [reviewer.id],
        instructions: `"${projName}" görev sözleşmelerindeki kabul kriterlerini, test senaryolarını, beklenen çıktıları ve tamamlanma kanıtlarını doğrula; kanıt eksikken görevi tamamlandı sayma ve gerekirse rollback planını uygulat.${domainInstruction}`,
        expectedOutputs: ['Kabul matrisi', 'Test kanıtları', 'Yayın kararı'], status: 'ready'
    });
    return [planner, implementer, reviewer, verifier];
}

export function compileTaskPlan(project) {
    const used = new Set((project.tasks || []).map(task => task.id));
    const tasks = [];
    const sourceRequirements = (project.requirements || []).filter(requirement => requirement.status === 'accepted');
    const quality = evaluateRequirementQuality(project);
    const webSaasActive = assessWebSaasPack(project).active;
    
    // Task compiler strictly uses formal accepted requirements
    if (!sourceRequirements.length) {
        return {
            baseRevision: project.canonicalRevision || 1,
            tasks: [],
            testCases: [],
            milestones: [],
            traceLinks: [],
            agentPrompts: [],
            warnings: ['Görev üretmek için en az bir kabul edilmiş (accepted) gereksinim bulunmalıdır.']
        };
    }
    if (!quality.readyForTaskCompilation) {
        return {
            baseRevision: project.canonicalRevision || 1,
            tasks: [],
            testCases: [],
            milestones: [],
            traceLinks: [],
            agentPrompts: [],
            warnings: quality.issues
        };
    }

    for (const requirement of sourceRequirements) {
        const id = uniqueId('task', requirement.title, used);
        tasks.push(normalizeTask({
            id, title: requirement.title, description: requirement.statement,
            priority: requirement.priority || 'medium', effort: requirement.kind === 'quality' ? 'medium' : 'low',
            requirementIds: [requirement.id], acceptanceCriteria: requirement.acceptanceCriteria || [],
            contract: taskContract(project, requirement, id),
            status: (requirement.acceptanceCriteria || []).length ? 'ready' : 'backlog'
        }));
    }
    const requirementById = new Map(sourceRequirements.map(requirement => [requirement.id, requirement]));
    const testCases = tasks.map(task => normalizeTestCase({
        id: `test-${task.id.replace(/^task-/, '')}`, title: `${task.title} kabul testi`, kind: 'acceptance',
        ...(webSaasActive ? { kind: webSaasTestKind(requirementById.get(task.requirementIds[0])) } : {}),
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
        baseRevision: project.canonicalRevision,
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
    assertValidCompilation(compilation);
    if (!approved) return { success: false, project, reason: 'Görev planı kullanıcı onayı bekliyor.' };
    if (compilation.baseRevision !== project.canonicalRevision) return { success: false, project, reason: 'Plan revision değişti; görev taslağı yeniden üretilmeli.' };
    if (!compilation.tasks.length) return { success: false, project, reason: compilation.warnings[0] || 'Uygulanabilir görev üretilemedi.' };
    const next = structuredClone(project);
    next.tasks = compilation.tasks.map(task => ({
        ...task,
        contract: {
            ...task.contract,
            filePolicy: {
                ...task.contract.filePolicy,
                status: task.contract.filePolicy.status === 'inferred' ? 'confirmed' : task.contract.filePolicy.status
            }
        }
    }));
    next.testCases = compilation.testCases;
    next.milestones = compilation.milestones;
    next.traceLinks = [
        ...next.traceLinks.filter(link => !['task', 'test'].includes(link.fromType) && !['task', 'test'].includes(link.toType)),
        ...compilation.traceLinks
    ];
    next.agentPrompts = compilation.agentPrompts;
    next.documentRevision += 1;
    next.canonicalRevision += 1;
    next.lifecycle.updatedAt = new Date().toISOString();
    next.sections.tasks.items = compilation.tasks.map(task => task.title);
    next.sections.tasks.status = 'draft';
    next.sections.tasks.updatedAtRevision = next.canonicalRevision;
    next.sections.testing.items = compilation.testCases.map(testCase => testCase.title);
    next.sections.testing.status = 'draft';
    next.sections.testing.updatedAtRevision = next.canonicalRevision;
    const snapshot = structuredClone(next);
    snapshot.revisions = [];
    next.revisions.push({
        id: `revision-${Date.now()}`, number: next.canonicalRevision, createdAt: next.lifecycle.updatedAt,
        summary: 'Onaylı görev ve ajan planı oluşturuldu', acceptedSuggestionIds: [],
        affectedSections: ['tasks', 'testing'], snapshot
    });
    return { success: true, project: next, reason: '', warnings: compilation.warnings };
}

export { topologicalOrder };
