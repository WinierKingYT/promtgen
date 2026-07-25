export class SystemClock {
  nowIso() { return new Date().toISOString(); }
}

export class CryptoIdGenerator {
  generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
