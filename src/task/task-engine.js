import { ENTITY_PREFIXES } from '../core/entity-store.js';

const TASK_STATUS = ['queued', 'active', 'blocked', 'completed', 'verified', 'cancelled', 'deferred'];
const TASK_PRIORITY = ['critical', 'high', 'medium', 'low', 'trivial'];
const TASK_PHASES = [
    'initiation', 'discovery', 'planning', 'design',
    'implementation', 'testing', 'deployment', 'monitoring'
];

let _taskCounter = 0;

function nextTaskId() {
    _taskCounter++;
    return `${ENTITY_PREFIXES.task}-${String(_taskCounter).padStart(3, '0')}`;
}

export function resetTaskCounter() { _taskCounter = 0; }

export function createTask(taskData, revision) {
    return {
        id: taskData.id || nextTaskId(),
        uid: `uid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entityType: 'task',
        title: taskData.title || '',
        description: taskData.description || '',
        status: TASK_STATUS.includes(taskData.status) ? taskData.status : 'queued',
        priority: TASK_PRIORITY.includes(taskData.priority) ? taskData.priority : 'medium',
        phase: TASK_PHASES.includes(taskData.phase) ? taskData.phase : (taskData.phase || 'implementation'),
        assignee: taskData.assignee || null,
        role: taskData.role || null,
        effort: taskData.effort || 'medium',
        dependsOn: taskData.dependsOn || [],
        blockedBy: taskData.blockedBy || [],
        sourceEntityIds: taskData.sourceEntityIds || [],
        outputs: taskData.outputs || [],
        prompts: taskData.prompts || [],
        tags: taskData.tags || [],
        version: 1,
        createdAtRevision: revision,
        updatedAtRevision: revision,
        sourceModule: taskData.sourceModule || 'universal',
        source: taskData.source || { type: 'manual', sourceId: null, evidenceType: 'direct_fact' },
        sensitivity: taskData.sensitivity || 'internal',
        statusHistory: taskData.statusHistory || [
            { status: 'queued', atRevision: revision, timestamp: new Date().toISOString() }
        ],
        completedAtRevision: taskData.completedAtRevision || null,
        verifiedAtRevision: taskData.verifiedAtRevision || null
    };
}

const TASK_TRANSITIONS = {
    queued: ['active', 'cancelled', 'deferred'],
    active: ['blocked', 'completed', 'queued', 'deferred'],
    blocked: ['active', 'cancelled', 'deferred'],
    completed: ['verified', 'active', 'cancelled'],
    verified: ['completed', 'cancelled'],
    cancelled: ['queued', 'deferred'],
    deferred: ['queued', 'active']
};

export function changeTaskStatus(task, newStatus, revision, reason = '') {
    const allowed = TASK_TRANSITIONS[task.status] || [];
    if (!allowed.includes(newStatus)) {
        return {
            success: false,
            reason: `'${task.status}' → '${newStatus}' geçersiz. İzin verilenler: ${allowed.join(', ')}`
        };
    }

    const updated = { ...task };
    updated.status = newStatus;
    updated.updatedAtRevision = revision;

    if (newStatus === 'completed') updated.completedAtRevision = revision;
    if (newStatus === 'verified') updated.verifiedAtRevision = revision;

    if (!updated.statusHistory) updated.statusHistory = [];
    updated.statusHistory.push({
        status: newStatus,
        atRevision: revision,
        timestamp: new Date().toISOString(),
        reason
    });

    updated.dependsOn = [...(task.dependsOn || [])];
    updated.blockedBy = [...(task.blockedBy || [])];

    return { success: true, task: updated };
}

export function resolveTaskDependencies(tasks) {
    const taskMap = {};
    for (const t of tasks) taskMap[t.id] = t;

    const visited = new Set();
    const inStack = new Set();
    const order = [];
    const cycles = [];

    function visit(taskId, path) {
        if (inStack.has(taskId)) {
            const cycle = [...path, taskId];
            const idx = cycle.indexOf(taskId);
            cycles.push(cycle.slice(idx));
            return;
        }
        if (visited.has(taskId)) return;

        visited.add(taskId);
        inStack.add(taskId);

        const task = taskMap[taskId];
        const deps = [...(task?.dependsOn || []), ...(task?.blockedBy || [])];
        for (const depId of deps) {
            if (taskMap[depId]) {
                visit(depId, [...path, taskId]);
            }
        }

        inStack.delete(taskId);
        order.push(taskId);
    }

    for (const task of tasks) {
        if (!visited.has(task.id)) visit(task.id, []);
    }

    const result = order.map(id => taskMap[id]).filter(Boolean);
    return { topologicalOrder: result, cycles };
}

export function getTaskDependencyGraph(tasks) {
    const edges = [];
    const nodeMap = {};
    for (const t of tasks) {
        nodeMap[t.id] = { id: t.id, title: t.title, status: t.status };
        for (const dep of (t.dependsOn || [])) {
            edges.push({ from: dep, to: t.id, type: 'dependsOn' });
        }
        for (const block of (t.blockedBy || [])) {
            edges.push({ from: block, to: t.id, type: 'blockedBy' });
        }
    }
    return { nodes: Object.values(nodeMap), edges };
}

export function getTasksByPhase(tasks, phase) {
    return tasks.filter(t => t.phase === phase);
}

export function getTasksByStatus(tasks, status) {
    return tasks.filter(t => t.status === status);
}

export function calculateTaskProgress(tasks) {
    if (!tasks || tasks.length === 0) return { total: 0, completed: 0, verified: 0, active: 0, blocked: 0, ratio: 0 };
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'verified').length;
    const verified = tasks.filter(t => t.status === 'verified').length;
    const active = tasks.filter(t => t.status === 'active').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    return { total, completed, verified, active, blocked, ratio: Math.round((completed / total) * 10000) / 100 };
}

export function findBlockedChain(tasks, startTaskId) {
    const taskMap = {};
    for (const t of tasks) taskMap[t.id] = t;
    const chain = [];
    let current = taskMap[startTaskId];
    while (current) {
        chain.push({ id: current.id, title: current.title, status: current.status });
        const blockers = (current.blockedBy || []);
        if (blockers.length === 0) break;
        const nextBlocker = blockers.map(bid => taskMap[bid]).find(t => t && t.status !== 'completed' && t.status !== 'verified');
        if (!nextBlocker) break;
        current = nextBlocker;
    }
    return chain;
}
