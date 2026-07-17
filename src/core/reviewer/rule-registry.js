import { NODE_TYPES, EDGE_TYPES } from '../traceability/traceability-types.js';
import { REVIEW_CATEGORIES, SEVERITY } from './reviewer-types.js';

export class RuleRegistry {
    constructor() {
        this._rules = [];
        this._loadDefaults();
    }

    register(rule) {
        if (!rule.id) throw new Error('Kural ID zorunlu');
        if (!rule.category) throw new Error('Kural kategorisi zorunlu');
        this._rules.push(rule);
        return rule;
    }

    registerModuleRules(moduleId, rules) {
        for (const r of rules) {
            r.moduleId = moduleId;
            this.register(r);
        }
    }

    getRules(category = null, severity = null, moduleId = null) {
        let result = this._rules;
        if (category) result = result.filter(r => r.category === category);
        if (severity) result = result.filter(r => r.severity === severity);
        if (moduleId) result = result.filter(r => !r.moduleId || r.moduleId === moduleId || r.moduleId === 'universal');
        return [...result];
    }

    getRule(ruleId) { return this._rules.find(r => r.id === ruleId) || null; }

    getAllRules() { return [...this._rules]; }

    getCategories() {
        const cats = new Set(this._rules.map(r => r.category));
        return [...cats];
    }

    getCountsByCategory() {
        const counts = {};
        for (const r of this._rules) {
            counts[r.category] = (counts[r.category] || 0) + 1;
        }
        return counts;
    }

    evaluateRule(rule, context) {
        if (typeof rule.evaluate === 'function') {
            return rule.evaluate(context);
        }
        if (rule.check) {
            const passed = rule.check(context);
            return passed ? { passed: true } : {
                passed: false,
                finding: {
                    ruleId: rule.id,
                    category: rule.category,
                    severity: rule.severity,
                    title: rule.title,
                    message: rule.message || `Kural başarısız: ${rule.id}`,
                    affectedEntities: rule.affectedEntities ? rule.affectedEntities(context) : [],
                    evidence: rule.evidence ? rule.evidence(context) : []
                }
            };
        }
        return { passed: true };
    }

    _loadDefaults() {
        this._rules.push(
            // Schema rules
            { id: 'SCHEMA-001', category: REVIEW_CATEGORIES.SCHEMA, severity: SEVERITY.CRITICAL,
              title: 'Canonical state geçerli olmalı', moduleId: 'universal',
              message: 'Canonical state bozuk veya eksik',
              check: ctx => ctx.state && typeof ctx.state === 'object' },

            { id: 'SCHEMA-002', category: REVIEW_CATEGORIES.SCHEMA, severity: SEVERITY.HIGH,
              title: 'Entity ID\'leri benzersiz olmalı', moduleId: 'universal',
              message: 'Tekrarlanan entity ID tespit edildi',
              check: ctx => { const ids = new Set(); for (const e of (ctx.entities || [])) { if (ids.has(e.id)) return false; ids.add(e.id); } return true; },
              affectedEntities: ctx => [] },

            // Discovery rules
            { id: 'DISC-001', category: REVIEW_CATEGORIES.DISCOVERY, severity: SEVERITY.CRITICAL,
              title: 'Proje amacı tanımlanmalı', moduleId: 'universal',
              message: 'Proje amacı veya problemi belirtilmemiş',
              check: ctx => !!(ctx.state?.identity?.name || ctx.state?.identity?.problemStatement) },

            { id: 'DISC-002', category: REVIEW_CATEGORIES.DISCOVERY, severity: SEVERITY.HIGH,
              title: 'Hedef kullanıcı tanımlanmalı', moduleId: 'universal',
              message: 'Ana kullanıcı kitlesi belirtilmemiş',
              check: ctx => !!(ctx.state?.stakeholders?.length > 0 || ctx.state?.identity?.targetAudience) },

            { id: 'DISC-003', category: REVIEW_CATEGORIES.DISCOVERY, severity: SEVERITY.MEDIUM,
              title: 'Başarı kriteri belirtilmeli', moduleId: 'universal',
              message: 'Proje başarısının nasıl ölçüleceği tanımlanmamış',
              check: ctx => !!(ctx.state?.successCriteria || ctx.state?.objectives?.length > 0) },

            // Scope rules
            { id: 'SCOPE-001', category: REVIEW_CATEGORIES.SCOPE, severity: SEVERITY.CRITICAL,
              title: 'İlk sürüm kapsamı belirlenmeli', moduleId: 'universal',
              message: 'MVP veya ilk sürüm kapsamı tanımlanmamış',
              check: ctx => !!(ctx.state?.scope?.mustHave?.length > 0 || ctx.state?.deliverables?.length > 0) },

            { id: 'SCOPE-002', category: REVIEW_CATEGORIES.SCOPE, severity: SEVERITY.MEDIUM,
              title: 'Kapsam dışı alanlar belirtilmeli', moduleId: 'universal',
              message: 'Out-of-scope alanları tanımlanmamış',
              check: ctx => !!(ctx.state?.scope?.outOfScope?.length > 0 || ctx.state?.scope?.notNow) },

            // Decision rules
            { id: 'DEC-001', category: REVIEW_CATEGORIES.DECISION, severity: SEVERITY.HIGH,
              title: 'Kararlar gerekçelendirilmeli', moduleId: 'universal',
              message: 'Onaylanan kararların gerekçesi bulunmalı',
              check: ctx => {
                  const decs = ctx.decisions || [];
                  return decs.every(d => !!(d.rationale || d.reason));
              },
              affectedEntities: ctx => (ctx.decisions || []).filter(d => !d.rationale && !d.reason).map(d => d.id) },

            { id: 'DEC-002', category: REVIEW_CATEGORIES.DECISION, severity: SEVERITY.HIGH,
              title: 'Kararlar gereksinimlere bağlanmalı', moduleId: 'universal',
              message: 'Kararlar en az bir gereksinim veya kısıta dayanmalı',
              check: ctx => (ctx.decisions || []).every(d => d.sourceRequirementIds?.length > 0 || d.constraints?.length > 0) },

            // Artifact rules
            { id: 'ART-001', category: REVIEW_CATEGORIES.ARTIFACT, severity: SEVERITY.HIGH,
              title: 'Kritik artifact\'lerin amacı belirtilmeli', moduleId: 'universal',
              message: 'Artifact amacı veya açıklaması eksik',
              check: ctx => (ctx.artifacts || []).every(a => !!(a.purpose || a.description)) },

            { id: 'ART-002', category: REVIEW_CATEGORIES.ARTIFACT, severity: SEVERITY.MEDIUM,
              title: 'Artifact bağımlılıkları belirtilmeli', moduleId: 'universal',
              message: 'Artifact bağımlılıkları tanımlanmamış',
              check: ctx => (ctx.artifacts || []).every(a => Array.isArray(a.dependencies) || Array.isArray(a.sourceEntities)) },

            // Task rules
            { id: 'TASK-001', category: REVIEW_CATEGORIES.TASK, severity: SEVERITY.CRITICAL,
              title: 'Kritik görevlerin kabul kriteri olmalı', moduleId: 'universal',
              message: 'Görev tamamlanma koşullarını tanımlayan kabul kriterleri bulunmalı',
              check: ctx => {
                  const criticalTasks = (ctx.tasks || []).filter(t => t.priority === 'critical' || t.priority === 'high');
                  return criticalTasks.every(t => t.acceptanceCriteria?.length > 0);
              },
              affectedEntities: ctx => (ctx.tasks || []).filter(t => (t.priority === 'critical' || t.priority === 'high') && !t.acceptanceCriteria?.length).map(t => t.id) },

            { id: 'TASK-002', category: REVIEW_CATEGORIES.TASK, severity: SEVERITY.HIGH,
              title: 'Her görevin dosya kapsamı belirtilmeli', moduleId: 'universal',
              message: 'Görevin hangi dosyaları etkileyeceği tanımlanmalı',
              check: ctx => (ctx.tasks || []).every(t => t.filesToCreate?.length > 0 || t.filesToModify?.length > 0 || t.filesToRead?.length > 0) },

            { id: 'TASK-003', category: REVIEW_CATEGORIES.TASK, severity: SEVERITY.HIGH,
              title: 'Görevler gereksinim veya artifact\'e bağlanmalı', moduleId: 'universal',
              message: 'Her görev en az bir gereksinim veya artifact kaynağına sahip olmalı',
              check: ctx => (ctx.tasks || []).every(t => t.sourceRequirementIds?.length > 0 || t.sourceArtifactIds?.length > 0) },

            { id: 'TASK-004', category: REVIEW_CATEGORIES.TASK, severity: SEVERITY.MEDIUM,
              title: 'Büyük görevler parçalanmalı', moduleId: 'universal',
              message: 'Görev çok büyük; parçalanması önerilir',
              check: ctx => {
                  const maxFiles = 8, maxDeps = 5;
                  return (ctx.tasks || []).every(t => (t.filesToCreate?.length || 0) + (t.filesToModify?.length || 0) <= maxFiles && (t.dependsOn?.length || 0) <= maxDeps);
              },
              affectedEntities: ctx => (ctx.tasks || []).filter(t => (t.filesToCreate?.length || 0) + (t.filesToModify?.length || 0) > 8 || (t.dependsOn?.length || 0) > 5).map(t => t.id) },

            // Prompt rules
            { id: 'PROMPT-001', category: REVIEW_CATEGORIES.PROMPT, severity: SEVERITY.HIGH,
              title: 'Prompt\'ta ajan rolü belirtilmeli', moduleId: 'universal',
              message: 'Ajanın hangi rolü üstleneceği tanımlanmalı',
              check: ctx => (ctx.prompts || []).every(p => !!(p.role || p.systemPrompt)) },

            { id: 'PROMPT-002', category: REVIEW_CATEGORIES.PROMPT, severity: SEVERITY.MEDIUM,
              title: 'Prompt\'ta izin verilen/yasak yollar tanımlanmalı', moduleId: 'universal',
              message: 'Ajanın hangi dosyaları değiştirebileceği belirtilmeli',
              check: ctx => (ctx.prompts || []).every(p => p.allowedPaths?.length > 0 || p.forbiddenPaths?.length > 0) },

            { id: 'PROMPT-003', category: REVIEW_CATEGORIES.PROMPT, severity: SEVERITY.MEDIUM,
              title: 'Prompt çıktı formatı belirtilmeli', moduleId: 'universal',
              message: 'Ajandan beklenen çıktı yapısı tanımlanmamış',
              check: ctx => (ctx.prompts || []).every(p => !!(p.outputMode || p.outputSchema)) },

            // Traceability rules
            { id: 'TRACE-001', category: REVIEW_CATEGORIES.TRACEABILITY, severity: SEVERITY.HIGH,
              title: 'Kritik gereksinimler görevlere bağlı olmalı', moduleId: 'universal',
              message: 'Kritik gereksinimlerin uygulama görevi bulunmuyor',
              check: ctx => true }, // Delegate to coverage calculator

            { id: 'TRACE-002', category: REVIEW_CATEGORIES.TRACEABILITY, severity: SEVERITY.MEDIUM,
              title: 'Kritik gereksinimler testlere bağlı olmalı', moduleId: 'universal',
              message: 'Kritik gereksinimlerin doğrulama bağlantısı eksik',
              check: ctx => true },

            // Approval rules
            { id: 'APPR-001', category: REVIEW_CATEGORIES.APPROVAL, severity: SEVERITY.HIGH,
              title: 'Onaylar güncel olmalı', moduleId: 'universal',
              message: 'Bazı onaylar eski revision\'da kalmış',
              check: ctx => {
                  const approvals = ctx.state?.approvals || {};
                  const currentRev = ctx.state?.revision || 0;
                  for (const [key, app] of Object.entries(approvals)) {
                      if (app === null) continue;
                      if (!app.status || !app.approvedAt) return false;
                      if (app.status !== 'approved' && app.status !== 'rejected') return false;
                      if (app.revision !== undefined && app.revision < currentRev) return false;
                  }
                  return true;
              } },

            { id: 'APPR-002', category: REVIEW_CATEGORIES.APPROVAL, severity: SEVERITY.CRITICAL,
              title: 'Final onayı alt onaylardan sonra gelmeli', moduleId: 'universal',
              message: 'Final review alt onaylar tamamlanmadan verilmiş',
              check: ctx => {
                  const approvals = ctx.state?.approvals || {};
                  const finalReview = approvals.finalReview;
                  if (!finalReview || finalReview.status !== 'approved') return true;
                  const finalTime = new Date(finalReview.approvedAt).getTime();
                  const subKeys = ['profile', 'scope', 'objectives', 'deliverables', 'executionPlan'];
                  for (const key of subKeys) {
                      const app = approvals[key];
                      if (app && app.status === 'approved' && new Date(app.approvedAt).getTime() <= finalTime) return true;
                  }
                  return false;
              } },

            // Export rules
            { id: 'EXPORT-001', category: REVIEW_CATEGORIES.EXPORT, severity: SEVERITY.CRITICAL,
              title: 'Kritik bulgular export\'u engellemeli', moduleId: 'universal',
              message: 'Açık kritik bulgular varken export yapılamaz',
              check: ctx => !ctx.findings || !ctx.findings.some(f => f.severity === SEVERITY.CRITICAL && f.status === 'open') },

            { id: 'EXPORT-002', category: REVIEW_CATEGORIES.EXPORT, severity: SEVERITY.HIGH,
              title: 'Export manifest dosyaları tamam olmalı', moduleId: 'universal',
              message: 'Proje manifest veya artifact index dosyası eksik',
              check: ctx => {
                  const artifacts = ctx.state?.artifacts || [];
                  const docs = ctx.state?.documents || [];
                  const esArtifacts = ctx.state?.entityStores?.artifact || [];
                  const allArtifacts = [...artifacts, ...esArtifacts];
                  return allArtifacts.some(a => /manifest|index/i.test(a.title || a.name || a.artifactType || ''))
                      || docs.some(d => /manifest|index/i.test(d.name || ''));
              } },

            { id: 'EXPORT-003', category: REVIEW_CATEGORIES.EXPORT, severity: SEVERITY.HIGH,
              title: 'Proje sağlık skoru export eşiğini geçmeli', moduleId: 'universal',
              message: 'Proje sağlık skoru export için yetersiz',
              check: ctx => {
                  const approvals = ctx.state?.approvals || {};
                  const allRequired = ['profile', 'scope', 'objectives', 'deliverables', 'executionPlan', 'finalReview'];
                  const subApproved = allRequired.filter(k => approvals[k]?.status === 'approved').length;
                  return subApproved >= 4;
              } },

            // Risk rules
            { id: 'RISK-001', category: REVIEW_CATEGORIES.RISK, severity: SEVERITY.HIGH,
              title: 'Kritik riskler için mitigasyon planı olmalı', moduleId: 'universal',
              message: 'Yüksek önemli risklerin azaltma stratejisi bulunmuyor',
              check: ctx => { const risks = ctx.risks || []; return risks.every(r => !!(r.mitigation || r.mitigations?.length > 0)); } },

            // Consistency rules
            { id: 'CONS-001', category: REVIEW_CATEGORIES.CONSISTENCY, severity: SEVERITY.CRITICAL,
              title: 'Görev bağımlılık döngüsü olmamalı', moduleId: 'universal',
              message: 'Görev bağımlılıklarında döngü tespit edildi',
              check: ctx => !ctx.cycles || ctx.cycles.length === 0 },

            // Module specific
            { id: 'MOD-SW-001', category: REVIEW_CATEGORIES.MODULE_SPECIFIC, severity: SEVERITY.MEDIUM,
              title: 'Web modülü: kullanıcı rolleri tanımlanmalı', moduleId: 'software.web',
              message: 'Kullanıcı rolleri ve izinleri belirtilmemiş',
              check: ctx => !ctx.activeModules?.includes('software.web') || !!(ctx.state?.moduleData?.software?.web?.userRoles?.length > 0) }
        );
    }
}
