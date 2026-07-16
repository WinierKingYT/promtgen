import { UNIVERSAL_PHASES } from '../workflow/phases.js';
import { ENTITY_PREFIXES } from '../core/entity-store.js';

const GAP_DEFINITIONS = [
    {
        id: 'GAP-PROJECT-NAME',
        targetPath: '/identity/name',
        category: 'project_identity',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.PROJECT_PROFILED],
        question: 'Projenizin adı nedir?',
        hint: 'Kısa ve açıklayıcı bir proje adı belirleyin.',
        confidenceField: null,
        check: (state) => !state.identity?.name || state.identity.name.trim().length < 2
    },
    {
        id: 'GAP-PROBLEM',
        targetPath: '/identity/problemStatement',
        category: 'project_identity',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.PROJECT_PROFILED, UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS],
        question: 'Bu proje hangi problemi çözüyor?',
        hint: 'Mevcut durumda ne eksik veya neyin iyileştirilmesi gerekiyor?',
        confidenceField: null,
        check: (state) => !state.identity?.problemStatement || state.identity.problemStatement.trim().length < 5
    },
    {
        id: 'GAP-OUTCOME',
        targetPath: '/identity/desiredOutcome',
        category: 'project_identity',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.PROJECT_PROFILED],
        question: 'Başarılı bir proje sonunda ne elde etmeyi hedefliyorsunuz?',
        hint: 'Proje tamamlandığında nasıl bir sonuç görmek istersiniz?',
        confidenceField: null,
        check: (state) => !state.identity?.desiredOutcome || state.identity.desiredOutcome.trim().length < 5
    },
    {
        id: 'GAP-SUMMARY',
        targetPath: '/identity/summary',
        category: 'project_identity',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.DISCOVERY_IN_PROGRESS],
        question: 'Projenizi kısaca özetler misiniz?',
        hint: 'Projenin ne olduğunu, kimin için olduğunu ve temel amacını 1-2 cümleyle anlatın.',
        confidenceField: null,
        check: (state) => !state.identity?.summary || state.identity.summary.trim().length < 5
    },
    {
        id: 'GAP-OBJECTIVES',
        targetPath: '/objectives',
        category: 'objectives',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.OBJECTIVES_DEFINED],
        question: 'Projenin ana hedefleri nelerdir?',
        hint: 'En önemli 3-5 hedefi sıralayın. Örn: "Kullanıcı kaydı", "Ödeme entegrasyonu"',
        confidenceField: null,
        check: (state) => !state.objectives || state.objectives.length === 0
    },
    {
        id: 'GAP-STAKEHOLDERS',
        targetPath: '/stakeholders',
        category: 'objectives',
        importance: 'high',
        blockingPhases: [UNIVERSAL_PHASES.OBJECTIVES_DEFINED],
        question: 'Projede kimler yer alacak veya projeden kimler etkilenecek?',
        hint: 'Kullanıcılar, yöneticiler, ekip üyeleri, müşteriler gibi paydaşları düşünün.',
        confidenceField: null,
        check: (state) => !state.stakeholders || state.stakeholders.length === 0
    },
    {
        id: 'GAP-CONSTRAINTS',
        targetPath: '/constraints',
        category: 'objectives',
        importance: 'high',
        blockingPhases: [UNIVERSAL_PHASES.SCOPE_DEFINED],
        question: 'Projede hangi kısıtlar var? (Bütçe, zaman, teknoloji, kaynak)',
        hint: 'Örn: "3 ayda tamamlanmalı", "Mevcut API ile uyumlu olmalı"',
        confidenceField: null,
        check: (state) => !state.constraints || state.constraints.length === 0
    },
    {
        id: 'GAP-SCOPE-MUST',
        targetPath: '/scope/mustHave',
        category: 'scope',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.SCOPE_DEFINED],
        question: 'MVP kapsamında mutlaka olması gereken özellikler nelerdir?',
        hint: 'Projenin çalışması için olmazsa olmaz özellikleri listeleyin.',
        confidenceField: 'profile.domains',
        check: (state) => !state.scope?.mustHave || state.scope.mustHave.length === 0
    },
    {
        id: 'GAP-SCOPE-OUT',
        targetPath: '/scope/outOfScope',
        category: 'scope',
        importance: 'medium',
        blockingPhases: [UNIVERSAL_PHASES.SCOPE_DEFINED],
        question: 'Bu projede kesinlikle dahil etmek istemediğiniz şeyler var mı?',
        hint: 'Kapsam dışı alanlar proje sınırlarını netleştirmeye yardımcı olur.',
        confidenceField: null,
        check: (state) => !state.scope?.outOfScope || state.scope.outOfScope.length === 0
    },
    {
        id: 'GAP-ASSUMPTIONS',
        targetPath: '/assumptions',
        category: 'context',
        importance: 'high',
        blockingPhases: [],
        question: 'Projeyle ilgili hangi varsayımlarda bulunuyorsunuz?',
        hint: 'Doğru olduğunu kabul ettiğiniz ancak kesin olmayan şeyler.',
        confidenceField: null,
        check: (state) => !state.assumptions || state.assumptions.length === 0
    },
    {
        id: 'GAP-DECISIONS',
        targetPath: '/decisions',
        category: 'context',
        importance: 'high',
        blockingPhases: [UNIVERSAL_PHASES.DELIVERABLES_DEFINED],
        question: 'Henüz karar verilmemiş önemli konular var mı?',
        hint: 'Teknoloji seçimi, mimari yaklaşım gibi bekleyen kararlar.',
        confidenceField: null,
        check: (state) => !state.decisions || state.decisions.length === 0
    },
    {
        id: 'GAP-RISKS',
        targetPath: '/risks',
        category: 'context',
        importance: 'medium',
        blockingPhases: [UNIVERSAL_PHASES.REVIEW_IN_PROGRESS],
        question: 'Projede öngördüğünüz riskler nelerdir?',
        hint: 'Karşılaşabileceğiniz teknik, operasyonel veya takvim riskleri.',
        confidenceField: null,
        check: (state) => !state.risks || state.risks.length === 0
    },
    {
        id: 'GAP-DELIVERABLES',
        targetPath: '/deliverables',
        category: 'deliverables',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.DELIVERABLES_DEFINED],
        question: 'Proje sonunda hangi somut çıktıları teslim edeceksiniz?',
        hint: 'Doküman, yazılım modülü, rapor, tasarım gibi teslim edilebilir ürünler.',
        confidenceField: null,
        check: (state) => !state.deliverables || state.deliverables.length === 0
    },
    {
        id: 'GAP-TASKS',
        targetPath: '/tasks',
        category: 'tasks',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.EXECUTION_PLAN_DRAFTED],
        question: 'Projeyi gerçekleştirmek için hangi ana görevler tanımlanmalı?',
        hint: 'Her teslim çıktısı için gereken çalışma adımları.',
        confidenceField: null,
        check: (state) => !state.tasks || state.tasks.length === 0
    },
    {
        id: 'GAP-DOMAINS',
        targetPath: '/profile/domains',
        category: 'profile',
        importance: 'critical',
        blockingPhases: [UNIVERSAL_PHASES.PROJECT_PROFILED],
        question: 'Projeniz hangi alan/kategoriye giriyor?',
        hint: 'Web uygulaması, mobil oyun, araştırma, iş süreci, içerik projesi vb.',
        confidenceField: null,
        check: (state) => !state.profile?.domains || state.profile.domains.length === 0
    },
    {
        id: 'GAP-DOMAIN-CONFIDENCE',
        targetPath: '/profile/domains',
        category: 'profile',
        importance: 'medium',
        blockingPhases: [],
        question: 'Proje kategorisinden ne kadar eminsiniz?',
        hint: null,
        confidenceField: 'profile.domains[0].confidence',
        check: (state) => {
            if (!state.profile?.domains || state.profile.domains.length === 0) return false;
            return state.profile.domains.some(d => d.confidence < 0.5);
        }
    },
    {
        id: 'GAP-UNCERTAINTIES',
        targetPath: '/profile/uncertainties',
        category: 'profile',
        importance: 'medium',
        blockingPhases: [],
        question: 'Projeyle ilgili net olmayan veya emin olamadığınız noktalar neler?',
        hint: 'Daha sonra karar vermek üzere ertelediğiniz konular.',
        confidenceField: null,
        check: (state) => !state.profile?.uncertainties || state.profile.uncertainties.length === 0
    }
];

export function getGapDefinitions() {
    return GAP_DEFINITIONS;
}

export function detectGaps(state, currentPhase) {
    if (!state) return [];

    const gaps = [];
    const answeredIds = new Set();
    if (state.openQuestions && Array.isArray(state.openQuestions)) {
        for (const q of state.openQuestions) {
            if (q.status === 'answered') answeredIds.add(q.id);
        }
    }

    for (const def of GAP_DEFINITIONS) {
        if (def.check(state)) {
            const blocksCurrent = def.blockingPhases.includes(currentPhase);
            gaps.push({
                id: def.id,
                targetPath: def.targetPath,
                category: def.category,
                importance: def.importance,
                blockingPhases: def.blockingPhases,
                blocksCurrent,
                question: def.question,
                hint: def.hint,
                status: 'open'
            });
        }
    }

    return gaps;
}

const IMPORTANCE_SCORE = { critical: 100, high: 60, medium: 30, low: 10 };

export function scoreGap(gap, currentPhase, alreadyAskedCount = 0) {
    const importance = IMPORTANCE_SCORE[gap.importance] || 10;
    const blocking = gap.blocksCurrent ? 25 : (gap.blockingPhases.length > 0 ? 10 : 0);
    const downstream = gap.blockingPhases.length * 5;
    const userEffortPenalty = alreadyAskedCount * 3;
    return (importance * 0.30) + (blocking * 0.25) + (downstream * 0.20) - (userEffortPenalty * 0.10);
}

export function rankGaps(gaps, currentPhase, askedHistory = []) {
    const scored = gaps.map(g => {
        const alreadyAsked = askedHistory.filter(id => id === g.id).length;
        return { gap: g, score: scoreGap(g, currentPhase, alreadyAsked) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.gap);
}

export function selectQuestions(gaps, currentPhase, maxQuestions = 3, askedHistory = []) {
    const ranked = rankGaps(gaps, currentPhase, askedHistory);
    const selected = [];
    const categories = new Set();

    for (const gap of ranked) {
        if (selected.length >= maxQuestions) break;
        if (categories.has(gap.category) && !gap.blocksCurrent) continue;
        selected.push(gap);
        categories.add(gap.category);
    }

    return selected;
}

export function processDiscoveryAnswer(state, gapId, answer, revision) {
    if (!answer || typeof answer !== 'string') return { patches: [], newGaps: [] };

    const def = GAP_DEFINITIONS.find(g => g.id === gapId);
    if (!def) return { patches: [], newGaps: [] };

    const patches = [];
    const trimmed = answer.trim();

    if (def.targetPath === '/identity/name') {
        patches.push({ operation: 'replace', path: '/identity/name', value: trimmed });
    } else if (def.targetPath === '/identity/problemStatement') {
        patches.push({ operation: 'replace', path: '/identity/problemStatement', value: trimmed });
    } else if (def.targetPath === '/identity/desiredOutcome') {
        patches.push({ operation: 'replace', path: '/identity/desiredOutcome', value: trimmed });
    } else if (def.targetPath === '/identity/summary') {
        patches.push({ operation: 'replace', path: '/identity/summary', value: trimmed });
    } else if (def.targetPath === '/profile/domains') {
        const domains = trimmed.split(',').map(d => ({ name: d.trim(), confidence: 0.7 }));
        patches.push({ operation: 'replace', path: '/profile/domains', value: domains });
    } else if (def.targetPath === '/profile/uncertainties') {
        const uncertainties = trimmed.split(',').map(u => u.trim()).filter(Boolean);
        if (uncertainties.length > 0) {
            const existing = state.profile?.uncertainties || [];
            patches.push({ operation: 'replace', path: '/profile/uncertainties', value: [...existing, ...uncertainties] });
        }
    } else if (def.targetPath === '/objectives') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const objectives = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.objective}-${i + 1}`,
            title: l.replace(/^[•\-\d.]+/, '').trim(),
            description: '',
            entityType: 'objective',
            status: 'draft',
            priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal',
            version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/objectives', value: objectives });
    } else if (def.targetPath === '/stakeholders') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const stakeholders = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.stakeholder}-${i + 1}`,
            name: l.replace(/^[•\-\d.]+/, '').trim(),
            entityType: 'stakeholder', status: 'draft', priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/stakeholders', value: stakeholders });
    } else if (def.targetPath === '/constraints') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const constraints = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.constraint}-${i + 1}`,
            description: l.replace(/^[•\-\d.]+/, '').trim(),
            entityType: 'constraint', status: 'draft', priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/constraints', value: constraints });
    } else if (def.targetPath === '/scope/mustHave') {
        const items = trimmed.split('\n').filter(l => l.trim()).map(l => l.replace(/^[•\-\d.]+/, '').trim());
        const existing = state.scope?.mustHave || [];
        patches.push({ operation: 'replace', path: '/scope/mustHave', value: [...existing, ...items] });
    } else if (def.targetPath === '/scope/outOfScope') {
        const items = trimmed.split('\n').filter(l => l.trim()).map(l => l.replace(/^[•\-\d.]+/, '').trim());
        const existing = state.scope?.outOfScope || [];
        patches.push({ operation: 'replace', path: '/scope/outOfScope', value: [...existing, ...items] });
    } else if (def.targetPath === '/assumptions') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const assumptions = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.assumption}-${i + 1}`,
            text: l.replace(/^[•\-\d.]+/, '').trim(),
            confidence: 'medium', status: 'active',
            entityType: 'assumption', title: '', description: '',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/assumptions', value: assumptions });
    } else if (def.targetPath === '/risks') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const risks = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.risk}-${i + 1}`,
            description: l.replace(/^[•\-\d.]+/, '').trim(),
            impact: 'medium', likelihood: 'medium', mitigation: '',
            entityType: 'risk', title: '', status: 'draft', priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/risks', value: risks });
    } else if (def.targetPath === '/deliverables') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const deliverables = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.deliverable}-${i + 1}`,
            name: l.replace(/^[•\-\d.]+/, '').trim(),
            entityType: 'deliverable', title: '', status: 'draft', priority: 'medium',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/deliverables', value: deliverables });
    } else if (def.targetPath === '/tasks') {
        const lines = trimmed.split('\n').filter(l => l.trim());
        const tasks = lines.map((l, i) => ({
            id: `${ENTITY_PREFIXES.task}-${i + 1}`,
            title: l.replace(/^[•\-\d.]+/, '').trim(),
            description: '', status: 'draft', priority: 'medium', complexity: 'M',
            sourceModule: 'universal',
            source: { type: 'user_message', sourceId: null, evidenceType: 'direct_fact' },
            sensitivity: 'internal', version: 1, createdAtRevision: revision, updatedAtRevision: revision, tags: []
        }));
        patches.push({ operation: 'replace', path: '/tasks', value: tasks });
    }

    return { patches, newGaps: [] };
}

export function assessReadiness(state, currentPhase) {
    const gaps = detectGaps(state, currentPhase);
    const blockingGaps = gaps.filter(g => g.blocksCurrent);
    const total = GAP_DEFINITIONS.length;
    const answered = total - gaps.length;

    return {
        total,
        answered,
        openGaps: gaps.length,
        blockingGaps: blockingGaps.length,
        blocked: blockingGaps.length > 0,
        blockingGapIds: blockingGaps.map(g => g.id),
        completionRatio: total > 0 ? answered / total : 1
    };
}
