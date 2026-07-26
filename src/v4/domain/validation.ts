import type { ProjectDocumentV5 } from '../contracts.js';
import { validateProjectDocument } from '../project-document.js';

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

/**
 * Typed application compatibility adapter. All invariants are evaluated by the
 * single production ProjectDocument validator.
 */
export function validateCanonicalProject(project: ProjectDocumentV5): DomainValidationResult {
  const validation = validateProjectDocument(project);
  const errors = validation.errors.map(toValidationIssue);
  return { valid: validation.valid, errors, warnings: [] };
}

function toValidationIssue(message: string): ValidationIssue {
  if (message.includes('Entity kimliği benzersiz değil')) {
    return { code: 'DUPLICATE_ENTITY_ID', severity: 'error', entityType: 'project', message };
  }
  if (message.includes('Görev kabul edilmiş olmayan gereksinime bağlı')) {
    return { code: 'TASK_INVALID_REQUIREMENT_REF', severity: 'error', entityType: 'task', message };
  }
  if (message.includes('Kabul edilmiş gereksinimin kabul kriteri eksik')) {
    return { code: 'REQUIREMENT_NO_ACCEPTANCE_CRITERIA', severity: 'error', entityType: 'requirement', message };
  }
  if (message.includes('Kabul edilmiş kararın gerekçesi eksik')) {
    return { code: 'DECISION_NO_RATIONALE', severity: 'error', entityType: 'decision', message };
  }
  return { code: 'PROJECT_DOCUMENT_INVALID', severity: 'error', entityType: 'project', message };
}
