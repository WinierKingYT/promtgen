import { normalizeEvidence, normalizeResearchQuestion, normalizeResearchSource } from './canonical-entities.js';

const PRIMARY_HOSTS = ['w3.org', 'rfc-editor.org', 'ietf.org', 'nist.gov', 'ecma-international.org', 'github.com', 'docs.rs', 'developer.mozilla.org', 'arxiv.org'];

function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function revision(project, summary, affectedSections = []) {
    const snapshot = structuredClone(project); snapshot.revisions = [];
    project.revisions.push({ id: id('revision'), number: project.revision, createdAt: project.lifecycle.updatedAt, summary, acceptedSuggestionIds: [], affectedSections, snapshot });
}

export function validateResearchUrl(value) {
    try {
        const url = new URL(String(value || ''));
        if (url.protocol !== 'https:') return { valid: false, error: 'Araştırma kaynağı HTTPS kullanmalı.', normalizedUrl: '' };
        if (url.username || url.password) return { valid: false, error: 'Kaynak URL’si kullanıcı bilgisi içeremez.', normalizedUrl: '' };
        url.hash = '';
        return { valid: true, error: '', normalizedUrl: url.toString() };
    } catch { return { valid: false, error: 'Geçerli bir kaynak URL’si gerekli.', normalizedUrl: '' }; }
}

export function inferSourceType(urlValue) {
    const result = validateResearchUrl(urlValue);
    if (!result.valid) return 'unknown';
    const host = new URL(result.normalizedUrl).hostname.toLowerCase();
    return PRIMARY_HOSTS.some(candidate => host === candidate || host.endsWith(`.${candidate}`)) ? 'primary' : 'unknown';
}

export function proposeResearchAgenda(project) {
    const candidates = [];
    const push = (question, rationale, priority, affectedSectionIds) => candidates.push(normalizeResearchQuestion({ id: id('research-question'), question, rationale, priority, affectedSectionIds, status: 'proposed' }));
    if (project.profile?.projectInventory?.manifests?.length) push('Mevcut teknoloji ve bağımlılıkların güncel resmi dokümantasyonu hangi kısıtları getiriyor?', 'Mevcut proje sinyallerini varsayım yerine resmi kaynaklarla doğrulamak.', 'high', ['architecture', 'requirements']);
    if (project.planningDepth.selected !== 'quick') push('Seçilen mimari yaklaşım için hangi resmi öneriler ve bilinen sınırlamalar geçerli?', 'Mimari kararı birincil teknik kaynaklarla desteklemek.', 'medium', ['architecture', 'decisions']);
    if (['advanced', 'enterprise'].includes(project.planningDepth.selected)) push('İşlenen veri ve platformlar için hangi güncel güvenlik standartları uygulanmalı?', 'Güvenlik kontrollerini standart ve üretici dokümantasyonuna dayandırmak.', 'high', ['security', 'risks']);
    if (project.planningDepth.selected === 'enterprise') push('Dağıtım ve operasyon hedefleri için hangi SLO ve kapasite ölçütleri kanıtlanmalı?', 'Operasyon planını ölçülebilir kaynaklarla desteklemek.', 'medium', ['deployment', 'operations']);
    return { baseRevision: project.revision, questions: candidates.slice(0, 5), optional: true };
}

/** @param {any} project @param {any} agenda @param {{ approvedQuestionIds?: string[] }} options */
export function applyResearchAgenda(project, agenda, { approvedQuestionIds = [] } = {}) {
    if (agenda.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; araştırma gündemi yeniden hazırlanmalı.' };
    const selected = agenda.questions.filter(question => approvedQuestionIds.includes(question.id)).map(question => ({ ...question, status: 'active' }));
    if (!selected.length) return { success: false, project, reason: 'En az bir araştırma sorusu kullanıcı tarafından onaylanmalı.' };
    const next = structuredClone(project);
    const existing = new Set(next.researchQuestions.map(question => question.question.toLocaleLowerCase('tr-TR')));
    next.researchQuestions.push(...selected.filter(question => !existing.has(question.question.toLocaleLowerCase('tr-TR'))));
    next.revision += 1; next.lifecycle.updatedAt = new Date().toISOString();
    revision(next, 'Araştırma gündemi kullanıcı tarafından onaylandı', [...new Set(selected.flatMap(question => question.affectedSectionIds))]);
    return { success: true, project: next, reason: '' };
}

export function addApprovedEvidence(project, input, { approved = false } = {}) {
    if (!approved) return { success: false, project, reason: 'Kaynak ve kanıt kullanıcı onayı bekliyor.' };
    const question = project.researchQuestions.find(item => item.id === input.questionId);
    if (!question) return { success: false, project, reason: 'Araştırma sorusu bulunamadı.' };
    const urlResult = validateResearchUrl(input.url);
    if (!urlResult.valid) return { success: false, project, reason: urlResult.error };
    if (!String(input.claim || '').trim() || !String(input.summary || '').trim()) return { success: false, project, reason: 'Kanıt iddiası ve özeti gerekli.' };
    const next = structuredClone(project);
    const source = normalizeResearchSource({ id: id('source'), title: input.title, url: urlResult.normalizedUrl, publisher: input.publisher, sourceType: input.sourceType || inferSourceType(urlResult.normalizedUrl), accessedAt: new Date().toISOString(), status: 'approved', questionIds: [question.id] });
    const evidence = normalizeEvidence({ id: id('evidence'), claim: input.claim, summary: input.summary, sourceId: source.id, questionId: question.id, confidence: input.confidence, affectedSectionIds: input.affectedSectionIds || question.affectedSectionIds, status: 'accepted' });
    next.sources.push(source); next.evidence.push(evidence);
    next.researchQuestions = next.researchQuestions.map(item => item.id === question.id ? { ...item, status: 'answered' } : item);
    next.revision += 1; next.lifecycle.updatedAt = new Date().toISOString();
    for (const sectionId of evidence.affectedSectionIds) {
        const section = next.sections[sectionId];
        if (section && (section.content || section.items.length)) {
            section.status = 'stale';
            const warning = 'Yeni araştırma kanıtı nedeniyle bu bölüm yeniden doğrulanmalı.';
            if (!section.warnings.includes(warning)) section.warnings.push(warning);
        }
    }
    revision(next, `Araştırma kanıtı onaylandı: ${evidence.claim}`, evidence.affectedSectionIds);
    return { success: true, project: next, source, evidence, reason: '' };
}
