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
