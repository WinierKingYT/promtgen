export type DomainErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'INVARIANT_VIOLATION'
  | 'CONCURRENCY_CONFLICT'
  | 'IDEMPOTENCY_DUPLICATE'
  | 'PROVIDER_FAILURE'
  | 'SCHEMA_MISMATCH'
  | 'PERSISTENCE_FAILURE'
  | 'UNAUTHORIZED_ACTION';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  details?: Record<string, any>;
  cause?: unknown;
}

export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function createDomainError(code: DomainErrorCode, message: string, details?: Record<string, any>): DomainError {
  return { code, message, details };
}
