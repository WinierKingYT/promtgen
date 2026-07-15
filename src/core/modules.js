export const MODULE_NAMES = {
    UNIVERSAL: 'universal',
    SOFTWARE: 'software',
    GAME: 'game',
    RESEARCH: 'research',
    BUSINESS: 'business',
    CONTENT: 'content'
};

export const MODULE_REGISTRY = {
    [MODULE_NAMES.UNIVERSAL]: {
        label: 'Evrensel',
        description: 'Her projede bulunan çekirdek alanlar',
        icon: 'globe',
        alwaysActive: true,
        subStages: []
    },
    [MODULE_NAMES.SOFTWARE]: {
        label: 'Yazılım',
        description: 'Web, mobil, backend, masaüstü yazılım projeleri',
        icon: 'code',
        alwaysActive: false,
        subStages: [
            { key: 'REQUIREMENTS_DEFINED', label: 'Gereksinim Belgesi', afterPhase: 'OBJECTIVES_DEFINED' },
            { key: 'TECHNOLOGY_EVALUATED', label: 'Teknoloji Değerlendirmesi', afterPhase: 'SCOPE_DEFINED' },
            { key: 'ARCHITECTURE_DEFINED', label: 'Mimari Tasarım', afterPhase: 'DELIVERABLES_DEFINED' },
            { key: 'FILE_STRUCTURE_DEFINED', label: 'Dosya Yapısı', afterPhase: 'EXECUTION_PLAN_DRAFTED' },
            { key: 'DEVELOPMENT_TASKS_DEFINED', label: 'Geliştirme Görevleri', afterPhase: 'FILE_STRUCTURE_DEFINED' }
        ]
    },
    [MODULE_NAMES.GAME]: {
        label: 'Oyun',
        description: 'Oyun tasarımı ve geliştirme projeleri',
        icon: 'gamepad-2',
        alwaysActive: false,
        subStages: [
            { key: 'CORE_LOOP_DEFINED', label: 'Ana Oyun Döngüsü', afterPhase: 'OBJECTIVES_DEFINED' },
            { key: 'GAME_SYSTEMS_DEFINED', label: 'Oyun Sistemleri', afterPhase: 'SCOPE_DEFINED' },
            { key: 'CONTENT_PLAN_DEFINED', label: 'İçerik Planı', afterPhase: 'DELIVERABLES_DEFINED' },
            { key: 'TECHNICAL_ARCHITECTURE_DEFINED', label: 'Teknik Mimari', afterPhase: 'CONTENT_PLAN_DEFINED' },
            { key: 'PRODUCTION_PLAN_DEFINED', label: 'Üretim Planı', afterPhase: 'TECHNICAL_ARCHITECTURE_DEFINED' }
        ]
    },
    [MODULE_NAMES.RESEARCH]: {
        label: 'Araştırma',
        description: 'Akademik araştırma, literatür taraması, bilimsel çalışmalar',
        icon: 'flask-conical',
        alwaysActive: false,
        subStages: [
            { key: 'RESEARCH_QUESTION_DEFINED', label: 'Araştırma Sorusu', afterPhase: 'OBJECTIVES_DEFINED' },
            { key: 'HYPOTHESES_DEFINED', label: 'Hipotezler', afterPhase: 'SCOPE_DEFINED' },
            { key: 'METHODOLOGY_DEFINED', label: 'Yöntem', afterPhase: 'HYPOTHESES_DEFINED' },
            { key: 'SOURCE_STRATEGY_DEFINED', label: 'Kaynak Stratejisi', afterPhase: 'METHODOLOGY_DEFINED' },
            { key: 'ANALYSIS_PLAN_DEFINED', label: 'Analiz Planı', afterPhase: 'SOURCE_STRATEGY_DEFINED' }
        ]
    },
    [MODULE_NAMES.BUSINESS]: {
        label: 'İş / Operasyon',
        description: 'İş planı, operasyon süreçleri, girişim projeleri',
        icon: 'building-2',
        alwaysActive: false,
        subStages: [
            { key: 'STAKEHOLDERS_DEFINED', label: 'Paydaşlar', afterPhase: 'OBJECTIVES_DEFINED' },
            { key: 'PROCESS_DEFINED', label: 'Süreç Tanımı', afterPhase: 'SCOPE_DEFINED' },
            { key: 'RESOURCE_PLAN_DEFINED', label: 'Kaynak Planı', afterPhase: 'PROCESS_DEFINED' },
            { key: 'TIMELINE_DEFINED', label: 'Zaman Çizelgesi', afterPhase: 'RESOURCE_PLAN_DEFINED' },
            { key: 'KPI_PLAN_DEFINED', label: 'KPI Planı', afterPhase: 'TIMELINE_DEFINED' }
        ]
    },
    [MODULE_NAMES.CONTENT]: {
        label: 'İçerik',
        description: 'İçerik üretimi, yayıncılık, medya projeleri',
        icon: 'file-text',
        alwaysActive: false,
        subStages: [
            { key: 'CONTENT_STRATEGY_DEFINED', label: 'İçerik Stratejisi', afterPhase: 'OBJECTIVES_DEFINED' },
            { key: 'AUDIENCE_DEFINED', label: 'Hedef Kitle', afterPhase: 'SCOPE_DEFINED' },
            { key: 'CHANNELS_DEFINED', label: 'Kanal Planı', afterPhase: 'AUDIENCE_DEFINED' },
            { key: 'PRODUCTION_CALENDAR_DEFINED', label: 'Üretim Takvimi', afterPhase: 'CHANNELS_DEFINED' },
            { key: 'DISTRIBUTION_PLAN_DEFINED', label: 'Dağıtım Planı', afterPhase: 'PRODUCTION_CALENDAR_DEFINED' }
        ]
    }
};

export function isModuleActive(state, moduleName) {
    if (moduleName === MODULE_NAMES.UNIVERSAL) return true;
    if (!state || !state.profile || !state.profile.activatedModules) return false;
    return state.profile.activatedModules.includes(moduleName);
}

export function getActiveModules(state) {
    if (!state || !state.profile || !state.profile.activatedModules) return [MODULE_NAMES.UNIVERSAL];
    return [MODULE_NAMES.UNIVERSAL, ...state.profile.activatedModules];
}

export function getActiveSubStages(state, phase) {
    const active = getActiveModules(state);
    const stages = [];
    for (const modName of active) {
        const mod = MODULE_REGISTRY[modName];
        if (mod && mod.subStages) {
            for (const ss of mod.subStages) {
                if (ss.afterPhase === phase) {
                    stages.push({ ...ss, module: modName });
                }
            }
        }
    }
    return stages;
}

export function getModuleForSubStage(subStageKey) {
    for (const [name, mod] of Object.entries(MODULE_REGISTRY)) {
        if (mod.subStages) {
            for (const ss of mod.subStages) {
                if (ss.key === subStageKey) return name;
            }
        }
    }
    return null;
}

export function getModuleDataTemplate(moduleName) {
    switch (moduleName) {
        case MODULE_NAMES.SOFTWARE:
            return {
                platforms: [],
                technologyOptions: [],
                selectedStack: [],
                architecture: { components: [], dataFlows: [], integrations: [] },
                dataModel: [],
                apiContracts: [],
                fileBlueprints: [],
                testStrategy: {}
            };
        case MODULE_NAMES.GAME:
            return {
                genre: '',
                platforms: [],
                targetAudience: [],
                coreLoop: [],
                mechanics: [],
                progression: [],
                gameSystems: [],
                levels: [],
                assets: [],
                balancingRules: [],
                productionPlan: []
            };
        case MODULE_NAMES.RESEARCH:
            return {
                researchQuestions: [],
                hypotheses: [],
                methodology: '',
                sourceCriteria: [],
                evidencePlan: [],
                analysisMethods: [],
                limitations: [],
                expectedOutputs: []
            };
        case MODULE_NAMES.BUSINESS:
            return {
                stakeholders: [],
                processes: [],
                resources: [],
                timeline: [],
                kpis: [],
                budget: {}
            };
        case MODULE_NAMES.CONTENT:
            return {
                contentStrategy: '',
                targetAudience: [],
                channels: [],
                productionCalendar: [],
                distributionPlan: [],
                metrics: []
            };
        default:
            return {};
    }
}
