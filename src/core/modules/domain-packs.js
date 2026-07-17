import { createModuleManifest, MODULE_CATEGORIES } from './module-types.js';

export function getUniversalPack() {
    return createModuleManifest({
        id: 'universal',
        name: 'Universal Core',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CORE,
        description: 'Her projede bulunması gereken evrensel planlama çekirdeği',
        activation: { signals: ['proje', 'proj', 'project', 'plan'], minimumConfidence: 0.1 },
        dependencies: [],
        contributions: {
            stateSchema: { namespace: 'universal', required: ['identity', 'scope', 'objectives'] },
            discovery: { requiredFields: ['identity.name', 'identity.problemStatement', 'scope.mustHave'] },
            artifacts: { required: ['PROJECT_BRIEF.md', 'SCOPE.md', 'DECISION_INDEX.md'] }
        }
    });
}

export function getSoftwareWebPack() {
    return createModuleManifest({
        id: 'software.web',
        name: 'Web Application',
        version: '1.0.0',
        category: MODULE_CATEGORIES.DOMAIN,
        parentModule: 'software',
        description: 'Web uygulaması planlama kuralları ve artifact üreticileri',
        activation: {
            signals: ['web', 'web sitesi', 'web uygulaması', 'browser', 'frontend', 'backend', 'pwa', 'website', 'api'],
            minimumConfidence: 0.55
        },
        dependencies: ['universal'],
        optionalDependencies: ['software.offline', 'software.ai', 'software.auth'],
        conflictsWith: [
            { moduleId: 'game', severity: 'medium', resolution: 'hybrid_possible', description: 'Oyun ve web modülleri aynı projede kullanılabilir' }
        ],
        contributions: {
            stateSchema: { namespace: 'moduleData.software.web', required: ['userRoles', 'pages', 'deploymentTargets'] },
            discovery: { requiredFields: ['moduleData.software.web.userRoles', 'moduleData.software.web.deploymentTargets'] },
            decisions: { types: ['frontend-framework', 'backend-framework', 'database-selection', 'auth-strategy', 'deployment-model'] },
            artifacts: { required: ['REQUIREMENTS.md', 'ARCHITECTURE.md', 'DATA_MODEL.md', 'WORKSPACE_TREE.md', 'TEST_STRATEGY.md'] },
            reviewer: { rules: ['route-coverage', 'auth-security', 'data-model-completeness'] }
        }
    });
}

export function getGamePack() {
    return createModuleManifest({
        id: 'game',
        name: 'Game Development',
        version: '1.0.0',
        category: MODULE_CATEGORIES.DOMAIN,
        parentModule: null,
        description: 'Oyun geliştirme planlama kuralları ve şablonları',
        activation: {
            signals: ['oyun', 'game', 'video game', 'mobil oyun', 'pc oyun', 'multiplayer', 'unity', 'unreal', 'godot', '2d', '3d'],
            minimumConfidence: 0.5
        },
        dependencies: ['universal'],
        optionalDependencies: ['software', 'game.multiplayer', 'game.procedural'],
        conflictsWith: [
            { moduleId: 'research', severity: 'low', resolution: 'compatible' }
        ],
        contributions: {
            stateSchema: { namespace: 'moduleData.game', required: ['genre', 'coreLoop', 'mechanics', 'targetPlatforms'] },
            discovery: { requiredFields: ['moduleData.game.genre', 'moduleData.game.coreLoop', 'moduleData.game.targetPlatforms'] },
            decisions: { types: ['engine-selection', 'camera-perspective', 'core-loop-structure', 'monetization-model', 'save-system'] },
            artifacts: { required: ['GAME_VISION.md', 'CORE_LOOP.md', 'GAME_SYSTEMS.md', 'PROGRESSION.md', 'ASSET_PLAN.md', 'PLAYTEST_PLAN.md'] },
            reviewer: { rules: ['core-loop-completeness', 'mechanic-input-output', 'playtest-coverage'] }
        }
    });
}

export function getResearchPack() {
    return createModuleManifest({
        id: 'research',
        name: 'Academic Research',
        version: '1.0.0',
        category: MODULE_CATEGORIES.DOMAIN,
        parentModule: null,
        description: 'Akademik araştırma planlama kuralları ve metodoloji şablonları',
        activation: {
            signals: ['araştırma', 'research', 'literatür', 'literature', 'akademik', 'academic', 'tez', 'thesis', 'makale', 'paper', 'çalışma', 'study', 'analiz', 'analysis'],
            minimumConfidence: 0.55
        },
        dependencies: ['universal'],
        optionalDependencies: ['research.qualitative', 'research.quantitative', 'data-analysis'],
        conflictsWith: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.research', required: ['researchQuestions', 'methodology', 'sourceStrategy'] },
            discovery: { requiredFields: ['moduleData.research.researchQuestions', 'moduleData.research.methodology', 'moduleData.research.sourceStrategy'] },
            decisions: { types: ['methodology-selection', 'sampling-method', 'source-strategy', 'analysis-method', 'evidence-standard'] },
            artifacts: { required: ['RESEARCH_BRIEF.md', 'RESEARCH_QUESTIONS.md', 'METHODOLOGY.md', 'SOURCE_STRATEGY.md', 'EVIDENCE_MATRIX.md', 'ANALYSIS_PLAN.md'] },
            reviewer: { rules: ['source-traceability', 'evidence-quality', 'methodology-completeness'] }
        }
    });
}

export function getSoftwareOfflinePack() {
    return createModuleManifest({
        id: 'software.offline',
        name: 'Offline / Local-First',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'software',
        description: 'Çevrimdışı çalışma ve yerel veri saklama planlaması',
        activation: {
            signals: ['offline', 'çevrimdışı', 'local', 'yerel', 'internet olmadan', 'no internet'],
            minimumConfidence: 0.6
        },
        dependencies: ['software'],
        optionalDependencies: [],
        conflictsWith: [
            { moduleId: 'cloud-only', severity: 'high', resolution: 'decision_required' }
        ],
        contributions: {
            stateSchema: { namespace: 'moduleData.software.offline', required: ['syncStrategy', 'storageMethod'] },
            decisions: { types: ['local-storage-selection', 'sync-strategy', 'conflict-resolution'] }
        }
    });
}

export function getSoftwareAuthPack() {
    return createModuleManifest({
        id: 'software.auth',
        name: 'Authentication & Authorization',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'software',
        description: 'Kimlik doğrulama ve yetkilendirme planlaması',
        activation: {
            signals: ['auth', 'login', 'kayıt', 'register', 'giriş', 'kimlik', 'authentication', 'kullanıcı girişi'],
            minimumConfidence: 0.6
        },
        dependencies: ['software'],
        optionalDependencies: ['privacy'],
        contributions: {
            decisions: { types: ['auth-strategy', 'session-management', 'oauth-providers'] },
            artifacts: { required: ['AUTH_STRATEGY.md', 'SECURITY_MODEL.md'] }
        }
    });
}

export function getSoftwarePack() {
    return createModuleManifest({
        id: 'software',
        name: 'Software Development',
        version: '1.0.0',
        category: MODULE_CATEGORIES.DOMAIN,
        parentModule: null,
        description: 'Genel yazılım geliştirme planlama çekirdeği',
        activation: { signals: ['yazılım', 'software', 'uygulama', 'application', 'kod', 'code', 'development'], minimumConfidence: 0.4 },
        dependencies: ['universal'],
        optionalDependencies: ['software.web', 'software.offline', 'software.ai', 'software.auth', 'software.mobile'],
        contributions: {
            stateSchema: { namespace: 'moduleData.software', required: ['techStack', 'architecture'] },
            discovery: { requiredFields: ['moduleData.software.techStack', 'moduleData.software.architecture'] }
        }
    });
}

export function getSoftwareAiPack() {
    return createModuleManifest({
        id: 'software.ai',
        name: 'AI / Machine Learning',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'software',
        description: 'Yapay zeka ve makine öğrenimi planlaması',
        activation: { signals: ['ai', 'yapay zeka', 'machine learning', 'ml', 'deep learning', 'sinir ağı', 'neural', 'tahmin', 'prediction'], minimumConfidence: 0.5 },
        dependencies: ['software'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.software.ai', required: ['modelSelection', 'trainingStrategy'] },
            decisions: { types: ['ai-model-selection', 'training-strategy', 'deployment-approach'] }
        }
    });
}

export function getPrivacyPack() {
    return createModuleManifest({
        id: 'privacy',
        name: 'Privacy & Data Protection',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: null,
        description: 'Veri gizliliği ve KVKK/GDPR uyumluluğu planlaması',
        activation: { signals: ['kvkk', 'gdpr', 'gizlilik', 'privacy', 'veri koruma', 'data protection', 'pii'], minimumConfidence: 0.5 },
        dependencies: ['universal'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.privacy', required: ['dataClassification', 'retentionPolicy'] },
            decisions: { types: ['data-classification', 'retention-strategy', 'consent-model'] }
        }
    });
}

export function getGameMultiplayerPack() {
    return createModuleManifest({
        id: 'game.multiplayer',
        name: 'Multiplayer',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'game',
        description: 'Çok oyunculu oyun altyapısı planlaması',
        activation: { signals: ['multiplayer', 'çok oyunculu', 'online', 'co-op', 'pvp', 'sunucu', 'server'], minimumConfidence: 0.5 },
        dependencies: ['game'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.game.multiplayer', required: ['networkModel', 'matchmaking'] },
            decisions: { types: ['network-architecture', 'matchmaking-strategy', 'state-sync'] }
        }
    });
}

export function getGameProceduralPack() {
    return createModuleManifest({
        id: 'game.procedural',
        name: 'Procedural Generation',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'game',
        description: 'Prosedürel içerik üretimi planlaması',
        activation: { signals: ['procedural', 'prosedürel', 'rastgele', 'random', 'generation', 'üretim', 'harita', 'map gen'], minimumConfidence: 0.5 },
        dependencies: ['game'],
        optionalDependencies: [],
        contributions: {
            decisions: { types: ['generation-method', 'seed-strategy', 'content-pipeline'] }
        }
    });
}

export function getResearchQualitativePack() {
    return createModuleManifest({
        id: 'research.qualitative',
        name: 'Qualitative Research',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'research',
        description: 'Nitel araştırma yöntemleri planlaması',
        activation: { signals: ['qualitative', 'nitel', 'görüşme', 'interview', 'gözlem', 'observation', 'vaka', 'case study'], minimumConfidence: 0.5 },
        dependencies: ['research'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.research.qualitative', required: ['interviewProtocol', 'codingScheme'] },
            decisions: { types: ['interview-method', 'coding-approach', 'sampling-strategy'] }
        }
    });
}

export function getResearchQuantitativePack() {
    return createModuleManifest({
        id: 'research.quantitative',
        name: 'Quantitative Research',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: 'research',
        description: 'Nicel araştırma yöntemleri planlaması',
        activation: { signals: ['quantitative', 'nicel', 'istatistik', 'statistics', 'anket', 'survey', 'deney', 'experiment', 'regresyon'], minimumConfidence: 0.5 },
        dependencies: ['research'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.research.quantitative', required: ['hypotheses', 'variables', 'sampleSize'] },
            decisions: { types: ['statistical-method', 'sampling-technique', 'measurement-model'] }
        }
    });
}

export function getDataAnalysisPack() {
    return createModuleManifest({
        id: 'data-analysis',
        name: 'Data Analysis',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: null,
        description: 'Veri analizi araçları ve metodolojisi planlaması',
        activation: { signals: ['veri analizi', 'data analysis', 'veri madenciliği', 'data mining', 'dashboard', 'raporlama', 'reporting', 'görselleştirme', 'visualization'], minimumConfidence: 0.5 },
        dependencies: ['universal'],
        optionalDependencies: [],
        contributions: {
            stateSchema: { namespace: 'moduleData.dataAnalysis', required: ['dataSources', 'analysisMethods'] },
            decisions: { types: ['tool-selection', 'visualization-method', 'data-pipeline'] }
        }
    });
}

export function getCloudOnlyPack() {
    return createModuleManifest({
        id: 'cloud-only',
        name: 'Cloud-Only',
        version: '1.0.0',
        category: MODULE_CATEGORIES.CAPABILITY,
        parentModule: null,
        description: 'Yalnızca bulut üzerinde çalışan uygulamalar için planlama',
        activation: { signals: ['cloud', 'bulut', 'saaS', 'aws', 'azure', 'gcp', 'serverless'], minimumConfidence: 0.5 },
        dependencies: ['universal'],
        optionalDependencies: [],
        contributions: {
            decisions: { types: ['cloud-provider', 'deployment-model', 'scaling-strategy'] }
        },
        conflictsWith: [
            { moduleId: 'software.offline', severity: 'high', resolution: 'decision_required', description: 'Cloud-only ve offline modüller çelişir' }
        ]
    });
}
