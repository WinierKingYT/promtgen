export function ok(value) {
  return { ok: true, value };
}

export function err(error) {
  return { ok: false, error };
}

export function createDomainError(code, message, details) {
  return { code, message, details };
}
