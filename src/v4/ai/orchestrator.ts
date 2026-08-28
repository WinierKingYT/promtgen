import type { GenerationProvenance, ProjectDocumentV5 } from '../contracts.js';
import { findNonLatinScriptPaths } from './schemas/language-guard.js';

export interface StructuredProvider {
  model?: string;
  structured(input: {
    system: string;
    context: unknown;
    schema: { parse(value: unknown): unknown };
    signal?: AbortSignal;
  }): Promise<unknown>;
}

export interface AITaskDefinition {
  id: string;
  promptVersion: string;
  schemaId: string;
  schemaVersion: number;
  schema: { parse(value: unknown): unknown };
  outputFields: readonly string[];
  timeoutMs: number;
  maxRepairAttempts: number;
  /**
   * Çıktısı kullanıcıya DÜZYAZI olarak gösterilen ve istemi bir çıktı dili
   * BELİRTEN görevler için açılır: şema geçerli olsa bile Latin dışı yazı
   * sistemine sapmış çıktı reddedilir (bkz. schemas/language-guard.ts).
   * İstemi bir dil belirtmeyen görevlerde açılmaz -- orada dili istem değil
   * koruma tanımlamış olurdu.
   */
  guardsOutputLanguage?: boolean;
  buildPrompt(project: ProjectDocumentV5, input?: Record<string, unknown>): string;
  buildContext(project: ProjectDocumentV5, input?: Record<string, unknown>): unknown;
}

export interface AITaskRunResult<T = unknown> {
  output: T;
  provenance: GenerationProvenance;
}

/**
 * Onarım denemesine "şemaya uymadı" demek yetmiyor: model neyi düzelteceğini
 * bilmediği için aynı hatayı tekrarlıyor. Zod hatasından alan yolu ve neden
 * bilgisi çıkarılıp isteme yazılır. Yalnız modelin kendi ürettiği yapı geri
 * beslenir; proje bağlamı buraya girmez.
 */
function describeSchemaFailure(error: unknown): string {
  const issues = (error as { issues?: Array<{ path?: unknown[]; message?: string }> })?.issues;
  if (!Array.isArray(issues) || !issues.length) return '';
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    const path = (issue.path || []).join('.') || '(kök)';
    const line = `- ${path}: ${issue.message || 'geçersiz'}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= 6) break;
  }
  return lines.join('\n');
}

/**
 * Onarım denemesinin BAŞ CÜMLESİ. Şema reddi varsayılandır; başka bir red
 * nedeni kendi cümlesini hatanın üstünde taşır (`repairInstruction`). Aynı
 * mekanizma kullanılır, yeni bir onarım yolu AÇILMAZ.
 */
const SCHEMA_REPAIR_INSTRUCTION =
  'Önceki yanıt şemaya uymadı. Eksik/fazla alan bırakmadan yalnız geçerli JSON üret.';

/**
 * Dil sapması reddi. Hata, şema hatasıyla AYNI biçimi taşır (`issues`), çünkü
 * `describeSchemaFailure` onarım ipucunu oradan çıkarır: model hangi alanı
 * düzelteceğini görür. Denemeler tükenince bu hata çağırana fırlar ve mevcut
 * `fallbackPolicy` yolu devreye girer; mesaj oradaki `fallbackReason` alanına
 * yazılır, yani sapma arayüze yeni bir metin eklemeden izlenebilir kalır.
 */
function createLanguageDeviationError(paths: readonly string[]): Error {
  const error = new Error(
    `Model Latin dışı bir yazı sistemi kullandı (${paths.join(', ')}); çıktı reddedildi.`
  ) as Error & { issues: unknown[]; repairInstruction: string };
  error.issues = paths.map(path => ({
    path: path.split('.'),
    message: 'Latin dışı yazı sistemi kullanılmış; bu alanı Türkçe ve Latin harfleriyle yaz'
  }));
  error.repairInstruction =
    'Önceki yanıt Latin dışı bir yazı sistemiyle (Çince/Kiril/Arap vb.) yazılmıştı. '
    + 'TÜM metin alanlarını Türkçe ve Latin harfleriyle yeniden yaz; '
    + 'Latin harfli teknik terimler (Unity, WebSocket, API) serbesttir.';
  return error;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function runAITask<T = unknown>({
  task,
  project,
  input = {},
  provider,
  providerId,
  model,
  signal
}: {
  task: AITaskDefinition;
  project: ProjectDocumentV5;
  input?: Record<string, unknown>;
  provider: StructuredProvider;
  providerId: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<AITaskRunResult<T>> {
  const requestedAt = new Date().toISOString();
  const startedAt = performance.now();
  const runId = globalThis.crypto.randomUUID();
  const context = task.buildContext(project, input);
  const prompt = task.buildPrompt(project, input);
  const inputHash = await sha256(JSON.stringify({ taskId: task.id, context }));
  let retryCount = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= task.maxRepairAttempts; attempt += 1) {
    // Her deneme kendi zaman bütçesini alır. Ortak bütçede ilk deneme süreyi
    // tükettiğinde onarım denemesi ortada kesiliyor, üretilen iş çöpe gidiyor
    // ve tur kaçınılmaz olarak yerel motora düşüyordu.
    const attemptController = new AbortController();
    const forwardAbort = () => attemptController.abort();
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener('abort', forwardAbort, { once: true });
    const attemptTimeout = setTimeout(() => attemptController.abort(), task.timeoutMs);

    try {
      const failureDetail = attempt === 0 ? '' : describeSchemaFailure(lastError);
      const system = attempt === 0
        ? prompt
        : [
          prompt,
          (lastError as { repairInstruction?: string })?.repairInstruction || SCHEMA_REPAIR_INSTRUCTION,
          failureDetail && `Düzeltilecek noktalar:\n${failureDetail}`
        ].filter(Boolean).join('\n');
      const output = await provider.structured({
        system,
        context,
        schema: task.schema,
        signal: attemptController.signal
      });
      // Şema geçmek yeterli DEĞİLDİR: canlı ölçümde şemaya tam uyan bir çıktının
      // tüm metin alanları Çince geldi. Sapma burada REDDEDİLİR ve aşağıdaki
      // catch aynı onarım döngüsünü yeniden çalıştırır.
      if (task.guardsOutputLanguage) {
        const deviantPaths = findNonLatinScriptPaths(output);
        if (deviantPaths.length) throw createLanguageDeviationError(deviantPaths);
      }
      const completedAt = new Date().toISOString();
      return {
        output: output as T,
        provenance: {
          runId,
          mode: providerId === 'ollama' ? 'local-ai' : 'cloud-ai',
          providerId,
          model: model || provider.model || 'unknown',
          promptVersion: task.promptVersion,
          schemaId: task.schemaId,
          schemaVersion: task.schemaVersion,
          requestedAt,
          completedAt,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          retryCount,
          fallbackReason: null,
          inputHash
        }
      };
    } catch (error) {
      lastError = error;
      // Kullanıcı vazgeçtiyse onarım denemesi başlatılmaz; iptal ettiği iş sürmemeli.
      if (signal?.aborted || attempt >= task.maxRepairAttempts) throw error;
      retryCount += 1;
    } finally {
      clearTimeout(attemptTimeout);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }
  throw lastError;
}
