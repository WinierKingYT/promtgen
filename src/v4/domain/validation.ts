import { CanonicalProject, Requirement, Decision, Task, Risk } from './types.js';

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  entityType?: 'requirement' | 'decision' | 'risk' | 'task' | 'project';
  entityId?: string;
  message: string;
}

export interface DomainValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateCanonicalProject(project: CanonicalProject): DomainValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!project.identity?.name?.trim()) {
    errors.push({ code: 'PROJECT_NAME_EMPTY', severity: 'error', entityType: 'project', message: 'Proje adı boş olamaz.' });
  }

  // Check unique IDs across entity sets
  const seenIds = new Set<string>();

  for (const req of project.requirements || []) {
    if (seenIds.has(req.id)) {
      errors.push({ code: 'DUPLICATE_ENTITY_ID', severity: 'error', entityType: 'requirement', entityId: req.id, message: `Çift entity ID saptandı: ${req.id}` });
    }
    seenIds.add(req.id);

    // Invariant: Accepted requirement should have acceptance criteria
    if (req.status === 'accepted' && (!req.acceptanceCriteria || req.acceptanceCriteria.length === 0)) {
      warnings.push({ code: 'REQUIREMENT_NO_ACCEPTANCE_CRITERIA', severity: 'warning', entityType: 'requirement', entityId: req.id, message: `Kabul edilen gereksinimin (${req.title}) kabul kriteri bulunmuyor.` });
    }
  }

  for (const dec of project.decisions || []) {
    if (seenIds.has(dec.id)) {
      errors.push({ code: 'DUPLICATE_ENTITY_ID', severity: 'error', entityType: 'decision', entityId: dec.id, message: `Çift entity ID saptandı: ${dec.id}` });
    }
    seenIds.add(dec.id);

    if (dec.status === 'accepted' && (!dec.rationale || !dec.rationale.trim())) {
      warnings.push({ code: 'DECISION_NO_RATIONALE', severity: 'warning', entityType: 'decision', entityId: dec.id, message: `Kabul edilen kararın (${dec.title}) gerekçesi belirtilmemiş.` });
    }
  }

  const validReqIds = new Set((project.requirements || []).map(r => r.id));

  for (const task of project.tasks || []) {
    if (seenIds.has(task.id)) {
      errors.push({ code: 'DUPLICATE_ENTITY_ID', severity: 'error', entityType: 'task', entityId: task.id, message: `Çift entity ID saptandı: ${task.id}` });
    }
    seenIds.add(task.id);

    // Cross-entity check: Task requirement reference validity
    for (const reqId of task.requirementIds || []) {
      if (!validReqIds.has(reqId)) {
        errors.push({ code: 'TASK_INVALID_REQUIREMENT_REF', severity: 'error', entityType: 'task', entityId: task.id, message: `Görev (${task.title}), var olmayan gereksinime (${reqId}) referans veriyor.` });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
