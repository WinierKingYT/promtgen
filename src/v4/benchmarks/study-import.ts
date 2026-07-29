import {
  validateAnonymousUserSessions,
  type AnonymousUserSession
} from './comparison-benchmark.js';

export interface UserStudySummary {
  schemaVersion: 1;
  validParticipants: number;
  completionRate: number;
  firstExportRate: number;
  minorEditMvpAcceptanceRate: number;
  averageSatisfaction: number;
  averageDurationSeconds: number;
  averageManualEditCount: number;
  participantsByCapability: Record<string, number>;
}

const PII_VALUE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?90|0)?5\d{9}\b/,
  /\b(?:\d[ -]*?){13,19}\b/
];

function asSessions(value: unknown): AnonymousUserSession[] {
  const candidates = Array.isArray(value) ? value : [value];
  if (candidates.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Çalışma dosyası bir anonim oturum nesnesi veya oturum dizisi içermeli.');
  }
  for (const candidate of candidates) {
    for (const value of Object.values(candidate as Record<string, unknown>)) {
      if (typeof value === 'string' && PII_VALUE_PATTERNS.some(pattern => pattern.test(value))) {
        throw new Error('Anonim kullanıcı evidence kaydı olası kişisel veri içeriyor.');
      }
    }
  }
  return candidates as AnonymousUserSession[];
}

export function importAnonymousStudySessions(
  existing: AnonymousUserSession[],
  inputs: unknown[]
): { sessions: AnonymousUserSession[]; importedCount: number } {
  const incoming = inputs.flatMap(asSessions);
  const sessions = validateAnonymousUserSessions([...existing, ...incoming]);
  return { sessions, importedCount: incoming.length };
}

const ratio = (count: number, total: number) => total ? count / total : 0;
const average = (values: number[]) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length
  : 0;
const round = (value: number) => Math.round(value * 1000) / 1000;

export function summarizeAnonymousStudySessions(sessions: AnonymousUserSession[]): UserStudySummary {
  const valid = validateAnonymousUserSessions(sessions);
  const participantsByCapability = Object.fromEntries(
    [...new Set(valid.map(item => item.capabilityId))]
      .sort()
      .map(capabilityId => [
        capabilityId,
        valid.filter(item => item.capabilityId === capabilityId).length
      ])
  );
  return {
    schemaVersion: 1,
    validParticipants: valid.length,
    completionRate: round(ratio(valid.filter(item => item.completed).length, valid.length)),
    firstExportRate: round(ratio(valid.filter(item => item.firstExportReached).length, valid.length)),
    minorEditMvpAcceptanceRate: round(ratio(valid.filter(item => item.mvpAcceptedWithMinorEdits).length, valid.length)),
    averageSatisfaction: round(average(valid.map(item => item.satisfaction))),
    averageDurationSeconds: round(average(valid.map(item => item.durationSeconds))),
    averageManualEditCount: round(average(valid.map(item => item.manualEditCount))),
    participantsByCapability
  };
}
