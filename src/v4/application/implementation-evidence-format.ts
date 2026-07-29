import { z } from 'zod';
import { redactSensitiveData } from '../security/secret-guard.js';
import type { ImplementationEvidencePackage, ProjectDocumentV5 } from '../contracts.js';
import {
  createImplementationEvidenceReview,
  type ImplementationEvidenceInput
} from './implementation-evidence-service.js';

export const IMPLEMENTATION_EVIDENCE_FORMAT = 'promtgen-implementation-evidence';
export const IMPLEMENTATION_EVIDENCE_FORMAT_VERSION = 2;
export const MAX_IMPLEMENTATION_EVIDENCE_BYTES = 256 * 1024;

const shortText = z.string().trim().min(1).max(500);
const evidenceSchema = z.object({
  format: z.literal(IMPLEMENTATION_EVIDENCE_FORMAT),
  formatVersion: z.literal(IMPLEMENTATION_EVIDENCE_FORMAT_VERSION),
  packageId: z.string().trim().min(3).max(160).regex(/^[a-zA-Z0-9._:-]+$/),
  projectId: z.string().trim().min(1).max(200),
  taskId: z.string().trim().min(1).max(200),
  baseCanonicalRevision: z.number().int().positive(),
  source: z.enum(['manual', 'codex', 'cursor', 'claude-code', 'other']),
  createdAt: z.string().datetime(),
  summary: z.string().trim().min(1).max(4000),
  changedFiles: z.array(z.object({
    path: z.string().trim().min(1).max(240),
    changeType: z.enum(['added', 'modified', 'deleted']),
    note: z.string().trim().max(1000)
  }).strict()).max(500),
  testRuns: z.array(z.object({
    command: z.string().trim().min(1).max(500),
    status: z.enum(['passed', 'failed', 'not_run']),
    outputSummary: z.string().trim().max(2000)
  }).strict()).max(100),
  acceptanceEvidence: z.array(z.object({
    criterion: z.string().trim().min(1).max(1000),
    status: z.enum(['met', 'not_met', 'unclear']),
    evidence: z.string().trim().max(2000)
  }).strict()).max(100),
  remainingIssues: z.array(shortText).max(100),
  rollbackNotes: z.string().trim().max(4000)
}).strict();

export type ImplementationEvidenceEnvelope = z.infer<typeof evidenceSchema>;

function assertSafeJson(value: unknown) {
  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    nodes += 1;
    if (nodes > 10_000) throw new Error('Kanıt paketi izin verilen JSON karmaşıklığını aşıyor.');
    if (depth > 20) throw new Error('Kanıt paketi izin verilen JSON derinliğini aşıyor.');
    if (!current || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Kanıt paketinde yasak JSON anahtarı var: ${key}`);
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

function sourceForAdapter(adapter: string): ImplementationEvidencePackage['source'] {
  if (adapter === 'claude') return 'claude-code';
  return ['codex', 'cursor'].includes(adapter) ? adapter as 'codex' | 'cursor' : 'other';
}

export function buildImplementationEvidenceTemplate(
  project: ProjectDocumentV5,
  taskId: string,
  source: ImplementationEvidencePackage['source'] = 'manual',
  createdAt = new Date().toISOString()
): ImplementationEvidenceEnvelope {
  const task = project.tasks.find(item => item.id === taskId);
  if (!task) throw new Error('Kanıt şablonu için canonical görev bulunamadı.');
  return {
    format: IMPLEMENTATION_EVIDENCE_FORMAT,
    formatVersion: IMPLEMENTATION_EVIDENCE_FORMAT_VERSION,
    packageId: `evidence:${task.id}:r${project.canonicalRevision}`,
    projectId: project.id,
    taskId: task.id,
    baseCanonicalRevision: project.canonicalRevision,
    source,
    createdAt,
    summary: `Görev teslim özeti: ${task.title}`,
    changedFiles: [],
    testRuns: task.contract.verification.commands.map(command => ({
      command,
      status: 'not_run',
      outputSummary: ''
    })),
    acceptanceEvidence: task.acceptanceCriteria.map(criterion => ({
      criterion,
      status: 'unclear',
      evidence: ''
    })),
    remainingIssues: [],
    rollbackNotes: task.contract.rollbackPlan
  };
}

export function buildImplementationEvidenceInstructions(
  project: ProjectDocumentV5,
  taskId: string,
  adapter = 'generic'
) {
  const task = project.tasks.find(item => item.id === taskId);
  if (!task) throw new Error('Kanıt talimatı için canonical görev bulunamadı.');
  const template = buildImplementationEvidenceTemplate(project, taskId, sourceForAdapter(adapter));
  return [
    `# Görev Teslim Kanıtı — ${task.title}`,
    `Kaynak canonical plan: r${project.canonicalRevision}`,
    '',
    'PromtGen canonical planı veya görev durumunu otomatik değiştirmez. Uygulama tamamlandığında aşağıdaki JSON şablonunu gerçek dosya, test ve kabul kanıtlarıyla doldur.',
    '',
    'Kurallar:',
    '- Yalnız gerçekten değişen dosyaları yaz.',
    '- Çalıştırılmayan testi `passed` olarak işaretleme.',
    '- Secret, token, kişisel veri veya tam test logu ekleme; yalnız kısa çıktı özeti kullan.',
    '- Açık sorun varsa `remainingIssues` içinde bildir.',
    '- JSON dışına başarı iddiası eklemek bu kanıt paketinin yerine geçmez.',
    '',
    '```json',
    JSON.stringify(template, null, 2),
    '```'
  ].join('\n');
}

export function parseImplementationEvidenceText(
  project: ProjectDocumentV5,
  text: string
): {
  success: true;
  envelope: ImplementationEvidenceEnvelope;
  input: ImplementationEvidenceInput;
  review: ImplementationEvidencePackage;
  warnings: string[];
} | {
  success: false;
  errors: string[];
} {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (!text.trim()) return { success: false, errors: ['Kanıt paketi boş.'] };
  if (bytes > MAX_IMPLEMENTATION_EVIDENCE_BYTES) {
    return { success: false, errors: [`Kanıt paketi ${MAX_IMPLEMENTATION_EVIDENCE_BYTES} byte sınırını aşıyor.`] };
  }
  const redaction = redactSensitiveData(text);
  if (redaction.redactedCount > 0) {
    return { success: false, errors: [`Kanıt paketinde ${redaction.redactedCount} olası secret bulundu; içe aktarmadan önce kaldır.`] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
    assertSafeJson(raw);
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const parsed = evidenceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.slice(0, 20).map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    };
  }
  const envelope = parsed.data;
  const errors: string[] = [];
  if (envelope.projectId !== project.id) errors.push('Kanıt paketi başka bir projeye ait.');
  if (!project.tasks.some(task => task.id === envelope.taskId)) errors.push('Kanıt paketinin canonical görevi bulunamadı.');
  if (project.implementationEvidencePackages.some(item => item.id === envelope.packageId)) errors.push('Bu kanıt paketi daha önce içe aktarılmış.');
  if (errors.length) return { success: false, errors };

  const input: ImplementationEvidenceInput = {
    taskId: envelope.taskId,
    source: envelope.source,
    summary: envelope.summary,
    changedFiles: envelope.changedFiles,
    testRuns: envelope.testRuns,
    acceptanceEvidence: envelope.acceptanceEvidence,
    remainingIssues: envelope.remainingIssues,
    rollbackNotes: envelope.rollbackNotes
  };
  const review = createImplementationEvidenceReview(project, input, {
    id: envelope.packageId,
    now: envelope.createdAt,
    baseCanonicalRevision: envelope.baseCanonicalRevision
  });
  return {
    success: true,
    envelope,
    input,
    review,
    warnings: envelope.baseCanonicalRevision === project.canonicalRevision
      ? []
      : [`Paket r${envelope.baseCanonicalRevision} planına ait; güncel plan r${project.canonicalRevision}.`]
  };
}
