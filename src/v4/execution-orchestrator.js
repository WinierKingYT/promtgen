import { normalizeExecutionSession } from './canonical-entities.js';
import { buildAgentPrompt } from './exporter.js';
import { redactSensitiveText } from './ai-context.js';

export const EXECUTION_ROLES = Object.freeze(['planner', 'implementer', 'reviewer', 'verifier']);
export const ROLE_RISK = Object.freeze({ planner: 'low', implementer: 'high', reviewer: 'low', verifier: 'medium' });

function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function captureRevision(project, summary) {
    const snapshot = structuredClone(project); snapshot.revisions = [];
    project.revisions.push({ id: id('revision'), number: project.revision, createdAt: project.lifecycle.updatedAt, summary, acceptedSuggestionIds: [], affectedSections: [], snapshot });
}

export function proposeExecution(project, adapterId = 'codex') {
    const blockers = [];
    if (!['codex', 'generic'].includes(adapterId)) blockers.push('Desteklenmeyen ajan adaptörü.');
    if (!project.tasks.length) blockers.push('Execution için onaylı görev planı gerekli.');
    if (!EXECUTION_ROLES.every(role => project.agentPrompts.some(prompt => prompt.role === role))) blockers.push('Planner → Implementer → Reviewer → Verifier prompt zinciri eksik.');
    if (project.readiness.blockers.length) blockers.push(`${project.readiness.blockers.length} readiness blocker çözülmeli veya kullanıcı bilinçli olarak devam etmeli.`);
    return {
        baseRevision: project.revision, adapterId,
        roles: EXECUTION_ROLES.map(role => ({ role, risk: ROLE_RISK[role], sandbox: role === 'implementer' ? 'workspace-write' : 'read-only' })),
        blockers, requiresNativeWorktree: adapterId === 'codex'
    };
}

export function beginExecutionSession(project, proposal, { approved = false, force = false, worktreeLabel = '' } = {}) {
    if (!approved) return { success: false, project, reason: 'Execution session kullanıcı onayı bekliyor.' };
    if (proposal.baseRevision !== project.revision) return { success: false, project, reason: 'Plan revision değişti; execution önerisi yenilenmeli.' };
    if (proposal.blockers.length && !force) return { success: false, project, reason: proposal.blockers.join(' ') };
    const next = structuredClone(project); const now = new Date().toISOString();
    if (!next.revisions.some(revision => revision.number === project.revision)) captureRevision(next, 'Execution kaynak planı');
    const session = normalizeExecutionSession({ id: id('execution'), adapterId: proposal.adapterId, sourceRevision: project.revision, status: proposal.adapterId === 'generic' ? 'external' : 'prepared', worktreeLabel, steps: proposal.roles.map(item => ({ ...item, status: 'pending' })), createdAt: now, updatedAt: now });
    next.executionSessions.push(session); next.revision += 1; next.lifecycle.updatedAt = now;
    captureRevision(next, `${proposal.adapterId} execution session onaylandı`);
    return { success: true, project: next, session, reason: '' };
}

export function getNextExecutionRole(session) {
    const failed = session.steps.find(step => step.status === 'failed');
    if (failed) return { role: failed.role, blocked: false, reason: `${failed.role} adımı başarısız; aynı adım yeniden çalıştırılabilir.` };
    const pending = session.steps.find(step => step.status === 'pending');
    return pending ? { role: pending.role, blocked: false, reason: '' } : { role: null, blocked: false, reason: 'Tüm adımlar tamamlandı.' };
}

export function buildExecutionPrompt(project, sessionId, role) {
    const session = project.executionSessions.find(item => item.id === sessionId);
    if (!session) throw new Error('Execution session bulunamadı.');
    const expected = getNextExecutionRole(session);
    if (expected.blocked || expected.role !== role) throw new Error(expected.reason || `Sıradaki rol ${expected.role}.`);
    const rolePrompt = project.agentPrompts.find(prompt => prompt.role === role);
    if (!rolePrompt) throw new Error(`${role} promptu bulunamadı.`);
    const guard = role === 'implementer' ? 'Yalnız atanmış worktree içinde değişiklik yap. Ana repository, başka worktree, global ayarlar ve credential dosyalarına dokunma.' : 'Bu adım salt okunur. Dosya değiştirme, commit oluşturma veya dış sisteme yazma.';
    return redactSensitiveText([`# ${role.toUpperCase()} ADIMI`, guard, rolePrompt.instructions, `Beklenen çıktılar:\n- ${rolePrompt.expectedOutputs.join('\n- ')}`, buildAgentPrompt(project, 'codex', session.sourceRevision)].join('\n\n')).slice(0, 64 * 1024);
}

export function recordExecutionResult(project, sessionId, result) {
    const next = structuredClone(project);
    const session = next.executionSessions.find(item => item.id === sessionId);
    if (!session) return { success: false, project, reason: 'Execution session bulunamadı.' };
    const expected = getNextExecutionRole(session);
    if (expected.role !== result.role) return { success: false, project, reason: expected.reason || `Sıradaki rol ${expected.role}.` };
    const step = session.steps.find(item => item.role === result.role);
    step.status = 'running'; step.startedAt = result.startedAt || new Date().toISOString();
    step.status = result.success ? 'completed' : 'failed'; step.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
    step.outputSummary = String(result.outputSummary || result.stdout || result.stderr || '').slice(0, 2000);
    step.completedAt = result.completedAt || new Date().toISOString();
    session.status = result.success ? (result.role === 'verifier' ? 'completed' : 'prepared') : 'failed'; session.updatedAt = step.completedAt;
    next.revision += 1; next.lifecycle.updatedAt = step.completedAt;
    captureRevision(next, `${result.role} execution adımı ${result.success ? 'tamamlandı' : 'başarısız oldu'}`);
    return { success: true, project: next, session, reason: '' };
}

export function simulateExecutionRun(project, sessionId) {
    let currentProject = structuredClone(project);
    const session = currentProject.executionSessions?.find(s => s.id === sessionId);
    if (!session) return { success: false, project: currentProject, reason: 'Execution oturumu bulunamadı.' };

    const logs = [];
    for (const role of EXECUTION_ROLES) {
        const nextRole = getNextExecutionRole(session);
        if (!nextRole.role) break;
        const res = recordExecutionResult(currentProject, sessionId, {
            role: nextRole.role,
            success: true,
            exitCode: 0,
            outputSummary: `${nextRole.role.toUpperCase()} simülasyon adımı hatasız tamamlandı. Kontrol noktaları doğrulandı.`,
            completedAt: new Date().toISOString()
        });
        if (res.success) {
            currentProject = res.project;
            logs.push(`✅ [${nextRole.role.toUpperCase()}] Adımı başarıyla simüle edildi.`);
        }
    }
    return { success: true, project: currentProject, logs };
}
