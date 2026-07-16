import { ENTITY_PREFIXES } from '../core/entity-store.js';

const PROMPT_STATUS = ['draft', 'ready', 'sent', 'responded', 'completed', 'failed', 'cancelled'];
const PROMPT_CATEGORIES = [
    'analysis', 'design', 'implementation', 'review',
    'test', 'documentation', 'research', 'decision', 'general'
];

let _promptCounter = 0;

function nextPromptId() {
    _promptCounter++;
    return `${ENTITY_PREFIXES.prompt}-${String(_promptCounter).padStart(3, '0')}`;
}

export function resetPromptCounter() { _promptCounter = 0; }

export function createPrompt(promptData, revision) {
    return {
        id: promptData.id || nextPromptId(),
        uid: `uid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType: 'prompt',
        title: promptData.title || '',
        category: PROMPT_CATEGORIES.includes(promptData.category) ? promptData.category : 'general',
        status: PROMPT_STATUS.includes(promptData.status) ? promptData.status : 'draft',
        systemPrompt: promptData.systemPrompt || '',
        userPrompt: promptData.userPrompt || '',
        contextBindings: promptData.contextBindings || [],
        taskIds: promptData.taskIds || [],
        sourceEntityIds: promptData.sourceEntityIds || [],
        response: promptData.response || null,
        responseValidation: promptData.responseValidation || null,
        variables: promptData.variables || {},
        tags: promptData.tags || [],
        version: 1,
        createdAtRevision: revision,
        updatedAtRevision: revision,
        sentAtRevision: null,
        respondedAtRevision: null,
        sourceModule: promptData.sourceModule || 'universal',
        source: promptData.source || { type: 'manual', sourceId: null, evidenceType: 'direct_fact' },
        sensitivity: promptData.sensitivity || 'internal',
        statusHistory: promptData.statusHistory || [
            { status: 'draft', atRevision: revision, timestamp: new Date().toISOString() }
        ]
    };
}

const PROMPT_TRANSITIONS = {
    draft: ['ready', 'cancelled'],
    ready: ['sent', 'draft', 'cancelled'],
    sent: ['responded', 'failed', 'cancelled'],
    responded: ['completed', 'sent', 'failed'],
    completed: ['sent', 'cancelled'],
    failed: ['ready', 'cancelled'],
    cancelled: ['draft']
};

export function changePromptStatus(prompt, newStatus, revision, reason = '') {
    const allowed = PROMPT_TRANSITIONS[prompt.status] || [];
    if (!allowed.includes(newStatus)) {
        return {
            success: false,
            reason: `'${prompt.status}' → '${newStatus}' geçersiz. İzin verilenler: ${allowed.join(', ')}`
        };
    }

    const updated = { ...prompt };
    updated.status = newStatus;
    updated.updatedAtRevision = revision;

    if (newStatus === 'sent') updated.sentAtRevision = revision;
    if (newStatus === 'responded') updated.respondedAtRevision = revision;

    if (!updated.statusHistory) updated.statusHistory = [];
    updated.statusHistory.push({
        status: newStatus,
        atRevision: revision,
        timestamp: new Date().toISOString(),
        reason
    });

    return { success: true, prompt: updated };
}

export function bindPromptContext(prompt, state, contextMap = {}) {
    const bindings = prompt.contextBindings || [];
    const resolved = {};

    for (const binding of bindings) {
        const path = binding.path || '';
        const parts = path.split('.');
        let value = state;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                value = undefined;
                break;
            }
        }
        if (value !== undefined) {
            resolved[binding.alias || parts[parts.length - 1]] = value;
        }
    }

    Object.assign(resolved, contextMap);
    return resolved;
}

export function renderPromptTemplate(prompt, context, options = {}) {
    let system = prompt.systemPrompt || '';
    let user = prompt.userPrompt || '';

    const allVars = { ...context, ...options.extraVars };

    for (const [key, val] of Object.entries(allVars)) {
        const placeholder = `{{${key}}}`;
        const strVal = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
        system = system.split(placeholder).join(strVal);
        user = user.split(placeholder).join(strVal);
    }

    const unresolvedSystem = system.match(/\{\{.+?\}\}/g) || [];
    const unresolvedUser = user.match(/\{\{.+?\}\}/g) || [];

    return {
        systemPrompt: system,
        userPrompt: user,
        unresolved: [...new Set([...unresolvedSystem, ...unresolvedUser])]
    };
}

export function validatePromptResponse(prompt, response, rules = {}) {
    if (!response || typeof response !== 'string') {
        return { valid: false, reason: 'Yanıt boş veya geçersiz' };
    }

    const checks = [];

    if (rules.minLength && response.length < rules.minLength) {
        checks.push(`Minimum ${rules.minLength} karakter gerekli (${response.length} mevcut)`);
    }

    if (rules.maxLength && response.length > rules.maxLength) {
        checks.push(`Maksimum ${rules.maxLength} karakter aşıldı (${response.length} mevcut)`);
    }

    if (rules.requiredKeywords) {
        for (const kw of rules.requiredKeywords) {
            if (!response.toLowerCase().includes(kw.toLowerCase())) {
                checks.push(`Gerekli anahtar kelime eksik: "${kw}"`);
            }
        }
    }

    if (rules.startsWith && !response.startsWith(rules.startsWith)) {
        checks.push(`"${rules.startsWith}" ile başlamalı`);
    }

    if (rules.jsonOnly) {
        try { JSON.parse(response); }
        catch { checks.push('Geçerli JSON olmalı'); }
    }

    return {
        valid: checks.length === 0,
        checks,
        response
    };
}

export function getPromptsByTask(prompts, taskId) {
    return prompts.filter(p => (p.taskIds || []).includes(taskId));
}

export function getTasksForPrompt(tasks, promptId) {
    return tasks.filter(t => (t.prompts || []).includes(promptId));
}
