import type { ProjectDocumentV5 } from '../contracts.js';
import { redactSensitiveData } from './secret-guard.js';

// Türkçe kalıplar ASCII biçiminde yazılır; girdi eşleştirmeden önce diakritikten
// arındırılır. Böylece "önceki talimatları yok say" ile klavye düzeni yüzünden
// diakritiksiz yazılan "onceki talimatlari yok say" aynı kalıba düşer.
const INJECTION_SIGNALS = [
  /ignore\b.{0,30}\b(previous|prior|all)\b.{0,20}\b(instruction|prompt)/i,
  /disregard\b.{0,30}\b(instruction|prompt)/i,
  /you\s+are\s+now/i,
  /system\s*(message|prompt|instruction)/i,
  /developer\s*(message|instruction)/i,
  /onceki\b.{0,30}\b(talimat|komut).{0,20}\b(yok\s*say|unut|dinleme|dikkate\s+alma)/i,
  /sistem\b.{0,20}\b(talimat|mesaj|prompt)/i,
  /bu\s+dosyadaki\s+talimatlari\s+uygula/i
];

const TURKISH_FOLD: Array<[RegExp, string]> = [
  [/[ıİ]/g, 'i'], [/[öÖ]/g, 'o'], [/[üÜ]/g, 'u'],
  [/[şŞ]/g, 's'], [/[çÇ]/g, 'c'], [/[ğĞ]/g, 'g']
];

function foldTurkishDiacritics(value: string): string {
  return TURKISH_FOLD.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export interface IsolatedContextResult {
  facts: Array<{ name: string; kind: string; summary: string }>;
  report: {
    inputCount: number;
    includedCount: number;
    rejectedCount: number;
    redactedCount: number;
    reasons: Record<string, number>;
  };
}

export function containsPromptInjection(value: string): boolean {
  const normalized = foldTurkishDiacritics(String(value || '').normalize('NFKC').replace(/\s+/g, ' '));
  return INJECTION_SIGNALS.some(pattern => pattern.test(normalized));
}

export function isolateImportedProjectContext(
  project: ProjectDocumentV5,
  maxEntries = 50
): IsolatedContextResult {
  const source = Array.isArray(project.profile.importedContext)
    ? project.profile.importedContext
    : [];
  const facts: IsolatedContextResult['facts'] = [];
  const reasons: Record<string, number> = {};
  let redactedCount = 0;

  for (const candidate of source.slice(0, maxEntries * 2)) {
    const name = String(candidate?.name || '').slice(0, 240);
    const kind = String(candidate?.kind || '').slice(0, 80);
    const summary = String(candidate?.summary || '').slice(0, 800);
    if (!name || !kind || !summary) {
      reasons.invalid_shape = (reasons.invalid_shape || 0) + 1;
      continue;
    }
    if (containsPromptInjection(`${name}\n${summary}`)) {
      reasons.injection_signal = (reasons.injection_signal || 0) + 1;
      continue;
    }
    const redacted = redactSensitiveData(summary);
    redactedCount += redacted.redactedCount;
    facts.push({ name, kind, summary: redacted.redactedText });
    if (facts.length >= maxEntries) break;
  }

  const rejectedCount = source.length - facts.length;
  return {
    facts,
    report: {
      inputCount: source.length,
      includedCount: facts.length,
      rejectedCount,
      redactedCount,
      reasons
    }
  };
}
