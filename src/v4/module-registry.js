const CATEGORIES = ['core', 'software', 'quality', 'research', 'business', 'content', 'operations', 'event'];
const SECTION_IDS = ['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment', 'operations'];

const BUILTIN_MODULES = [
    { id: 'core.planning', version: '1.0.0', name: 'Canonical Planlama', description: 'Yaşayan plan, revision ve kullanıcı onayı çekirdeği.', category: 'core', dependencies: [], conflicts: [], triggers: [], contributions: { requiredSections: ['vision', 'scope', 'tasks'], suggestedSections: ['objectives', 'requirements'], reviewerRuleIds: ['PLAN-001'], exportDocumentIds: ['master-plan', 'tasks'] } },
    { id: 'software.core', version: '1.0.0', name: 'Yazılım Mimarisi', description: 'Yazılım gereksinimleri, mimari, görev ve test planlaması.', category: 'software', dependencies: ['core.planning'], conflicts: [], triggers: ['software', 'code', 'api', 'uygulama'], contributions: { requiredSections: ['requirements', 'architecture', 'testing'], suggestedSections: ['decisions', 'deployment'], reviewerRuleIds: ['REQ-001', 'TASK-001'], exportDocumentIds: ['requirements', 'architecture', 'test-strategy'] } },
    { id: 'software.web', version: '1.0.0', name: 'Web Uygulaması', description: 'Web istemcisi, API, erişilebilirlik ve dağıtım kararları.', category: 'software', dependencies: ['software.core'], conflicts: [], triggers: ['web', 'react', 'vue', 'svelte', 'next', 'vite', 'html'], contributions: { requiredSections: ['deployment'], suggestedSections: ['security', 'operations'], reviewerRuleIds: ['WEB-ACCESSIBILITY'], exportDocumentIds: ['deployment'] } },
    { id: 'software.desktop-local', version: '1.0.0', name: 'Local-first Masaüstü', description: 'Yerel veri, masaüstü paketleme, offline çalışma ve güncelleme sınırları.', category: 'software', dependencies: ['software.core'], conflicts: [], triggers: ['desktop', 'tauri', 'electron', 'offline', 'local-first', 'yerel'], contributions: { requiredSections: ['security', 'deployment'], suggestedSections: ['operations'], reviewerRuleIds: ['LOCAL-DATA'], exportDocumentIds: ['security', 'deployment'] } },
    { id: 'quality.security', version: '1.0.0', name: 'Güvenlik ve Gizlilik', description: 'Tehdit, veri sınıfı, secret ve güvenlik test planlaması.', category: 'quality', dependencies: ['core.planning'], conflicts: [], triggers: ['security', 'güvenlik', 'auth', 'kimlik', 'ödeme', 'kişisel veri'], contributions: { requiredSections: ['security', 'risks', 'testing'], suggestedSections: ['operations'], reviewerRuleIds: ['RISK-001', 'SECURITY-CONTROLS'], exportDocumentIds: ['security', 'risks'] } },
    { id: 'research.evidence', version: '1.1.0', name: 'Araştırma ve Kanıt', description: 'Araştırma sorusu, yöntem, birincil kaynak ve kanıt defteri.', category: 'research', dependencies: ['core.planning'], conflicts: [], triggers: ['research', 'araştırma', 'kanıt', 'tez', 'makale', 'literatür', 'deney'], contributions: { requiredSections: ['objectives', 'requirements'], suggestedSections: ['decisions', 'risks', 'testing'], reviewerRuleIds: ['RESEARCH-METHOD', 'EVIDENCE-COVERAGE'], exportDocumentIds: ['research-protocol'] } },
    { id: 'business.product', version: '1.0.0', name: 'Ürün ve İş Planı', description: 'Kullanıcı, değer önerisi, başarı metriği ve teslim kapsamı.', category: 'business', dependencies: ['core.planning'], conflicts: [], triggers: ['ürün', 'business', 'müşteri', 'pazar', 'gelir', 'girişim'], contributions: { requiredSections: ['objectives', 'requirements'], suggestedSections: ['risks'], reviewerRuleIds: ['OBJECTIVE-METRIC'], exportDocumentIds: ['prd'] } },
    { id: 'business.operations', version: '1.0.0', name: 'İş ve Operasyon Modeli', description: 'Süreç, sorumluluk, kapasite, maliyet, risk ve günlük operasyon planı.', category: 'operations', dependencies: ['core.planning'], conflicts: [], triggers: ['operasyon', 'operation', 'süreç', 'iş planı', 'organizasyon', 'tedarik', 'lojistik'], contributions: { requiredSections: ['objectives', 'decisions', 'risks', 'operations'], suggestedSections: ['requirements', 'tasks'], reviewerRuleIds: ['OPERATIONS-OWNER', 'OPERATIONS-RISK'], exportDocumentIds: ['operating-model'] } },
    { id: 'content.production', version: '1.0.0', name: 'İçerik ve Yayın Üretimi', description: 'Hedef kitle, editoryal kapsam, üretim akışı, kanal ve yayın takvimi.', category: 'content', dependencies: ['core.planning'], conflicts: [], triggers: ['içerik', 'content', 'youtube', 'podcast', 'kitap', 'bülten', 'yayın', 'video', 'kampanya'], contributions: { requiredSections: ['objectives', 'scope', 'tasks'], suggestedSections: ['requirements', 'risks', 'operations'], reviewerRuleIds: ['CONTENT-AUDIENCE', 'CONTENT-CALENDAR'], exportDocumentIds: ['content-production-plan'] } },
    { id: 'event.delivery', version: '1.0.0', name: 'Etkinlik ve Teslimat', description: 'Katılımcı, program, mekan/kanal, tedarikçi, risk ve etkinlik günü akışı.', category: 'event', dependencies: ['core.planning'], conflicts: [], triggers: ['etkinlik', 'event', 'konferans', 'toplantı', 'workshop', 'atölye', 'festival', 'lansman'], contributions: { requiredSections: ['requirements', 'tasks', 'risks', 'operations'], suggestedSections: ['decisions', 'deployment'], reviewerRuleIds: ['EVENT-MILESTONE', 'EVENT-CONTINGENCY'], exportDocumentIds: ['event-runbook'] } }
];

export function validateModuleManifest(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['Manifest nesne olmalı.'] };
    if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(manifest.id || '')) errors.push('Modül kimliği namespaced olmalı.');
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) errors.push('Modül sürümü semver biçiminde olmalı.');
    if (!manifest.name || !manifest.description) errors.push('Modül adı ve açıklaması gerekli.');
    if (!CATEGORIES.includes(manifest.category)) errors.push('Modül kategorisi geçersiz.');
    for (const key of ['dependencies', 'conflicts', 'triggers']) if (!Array.isArray(manifest[key])) errors.push(`${key} dizi olmalı.`);
    if (!manifest.contributions || typeof manifest.contributions !== 'object') errors.push('Deklaratif contributions gerekli.');
    for (const sectionId of [...(manifest.contributions?.requiredSections || []), ...(manifest.contributions?.suggestedSections || [])]) if (!SECTION_IDS.includes(sectionId)) errors.push(`Bilinmeyen plan bölümü: ${sectionId}`);
    for (const forbidden of ['code', 'script', 'executable', 'command', 'url']) if (forbidden in manifest) errors.push(`Çalıştırılabilir/uzak alan yasak: ${forbidden}`);
    return { valid: errors.length === 0, errors };
}

export function createModuleRegistry(localManifests = []) {
    const modules = new Map(BUILTIN_MODULES.map(manifest => [manifest.id, structuredClone(manifest)]));
    const rejected = [];
    for (const manifest of localManifests) {
        const validation = validateModuleManifest(manifest);
        if (!validation.valid || modules.has(manifest.id)) rejected.push({ manifest, errors: validation.valid ? ['Aynı kimlikte modül zaten var.'] : validation.errors });
        else modules.set(manifest.id, structuredClone(manifest));
    }
    return { modules, rejected, list: () => [...modules.values()].map(item => structuredClone(item)), get: id => modules.get(id) ? structuredClone(modules.get(id)) : null };
}

export function suggestModules(project) {
    const registry = createModuleRegistry(project.modules?.localManifests || []);
    const active = new Set((project.modules?.active || []).map(item => item.id));
    const signals = [project.identity.originalIdea, ...(project.profile?.domains || []).map(item => item.name), ...(project.profile?.projectInventory?.frameworks || []), ...(project.profile?.projectInventory?.manifests || [])].join(' ').toLocaleLowerCase('tr-TR');
    return registry.list().filter(module => !active.has(module.id) && !project.modules?.dismissed?.includes(module.id)).map(module => {
        const matchedTriggers = module.triggers.filter(trigger => signals.includes(trigger.toLocaleLowerCase('tr-TR')));
        return { module, matchedTriggers, score: matchedTriggers.length * 25 + (module.category === 'software' && project.profile?.domains?.some(item => item.name === 'software') ? 20 : 0) };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}

function resolveDependencies(registry, requestedIds) {
    const resolved = []; const visiting = new Set(); const errors = [];
    function visit(moduleId) {
        if (resolved.includes(moduleId)) return;
        if (visiting.has(moduleId)) { errors.push(`Döngüsel modül bağımlılığı: ${moduleId}`); return; }
        const module = registry.get(moduleId);
        if (!module) { errors.push(`Modül bulunamadı: ${moduleId}`); return; }
        visiting.add(moduleId); module.dependencies.forEach(visit); visiting.delete(moduleId); resolved.push(moduleId);
    }
    requestedIds.forEach(visit); return { resolved, errors };
}

export function previewModuleActivation(project, requestedIds) {
    const registry = createModuleRegistry(project.modules?.localManifests || []);
    const resolution = resolveDependencies(registry, requestedIds);
    const active = new Set((project.modules?.active || []).map(item => item.id));
    const moduleIds = resolution.resolved.filter(moduleId => !active.has(moduleId));
    const conflicts = moduleIds.flatMap(moduleId => registry.get(moduleId).conflicts.filter(conflict => active.has(conflict) || moduleIds.includes(conflict)).map(conflict => `${moduleId} ↔ ${conflict}`));
    const manifests = moduleIds.map(moduleId => registry.get(moduleId));
    return { baseRevision: project.revision, moduleIds, manifests, requiredSections: [...new Set(manifests.flatMap(item => item.contributions.requiredSections))], suggestedSections: [...new Set(manifests.flatMap(item => item.contributions.suggestedSections))], errors: [...resolution.errors, ...conflicts.map(item => `Modül çatışması: ${item}`)] };
}

export function applyModuleActivation(project, preview, { approved = false } = {}) {
    if (!approved) return { success: false, project, reason: 'Modül aktivasyonu kullanıcı onayı bekliyor.' };
    if (preview.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; modül önizlemesi yenilenmeli.' };
    if (preview.errors.length) return { success: false, project, reason: preview.errors.join(' ') };
    const next = structuredClone(project);
    for (const manifest of preview.manifests) next.modules.active.push({ id: manifest.id, version: manifest.version, enabledAtRevision: project.revision + 1, config: {} });
    next.revision += 1; next.lifecycle.updatedAt = new Date().toISOString();
    for (const sectionId of preview.requiredSections) next.sections[sectionId].required = true;
    for (const sectionId of preview.suggestedSections) {
        const warning = 'Aktif modül bu bölümü öneriyor.';
        if (!next.sections[sectionId].warnings.includes(warning)) next.sections[sectionId].warnings.push(warning);
    }
    const snapshot = structuredClone(next); snapshot.revisions = [];
    next.revisions.push({ id: `revision-${Date.now()}`, number: next.revision, createdAt: next.lifecycle.updatedAt, summary: `Modüller etkinleştirildi: ${preview.moduleIds.join(', ')}`, acceptedSuggestionIds: [], affectedSections: preview.requiredSections, snapshot });
    return { success: true, project: next, reason: '' };
}

export function previewLocalModuleImport(project, manifest) {
    const validation = validateModuleManifest(manifest);
    const registry = createModuleRegistry(project.modules?.localManifests || []);
    const duplicate = registry.get(manifest?.id);
    return { baseRevision: project.revision, manifest: validation.valid ? structuredClone(manifest) : manifest, errors: [...validation.errors, ...(duplicate ? ['Aynı kimlikte modül zaten kayıtlı.'] : [])] };
}

export function applyLocalModuleImport(project, preview, { approved = false } = {}) {
    if (!approved) return { success: false, project, reason: 'Yerel modül içe aktarma kullanıcı onayı bekliyor.' };
    if (preview.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; modül yeniden doğrulanmalı.' };
    if (preview.errors.length) return { success: false, project, reason: preview.errors.join(' ') };
    const next = structuredClone(project);
    next.modules.localManifests.push(preview.manifest);
    next.revision += 1; next.lifecycle.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(next); snapshot.revisions = [];
    next.revisions.push({ id: `revision-${Date.now()}`, number: next.revision, createdAt: next.lifecycle.updatedAt, summary: `Yerel modül kaydedildi: ${preview.manifest.id}@${preview.manifest.version}`, acceptedSuggestionIds: [], affectedSections: [], snapshot });
    return { success: true, project: next, reason: '' };
}

export { BUILTIN_MODULES };
