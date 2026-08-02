import { z } from 'zod';
import type { ExportRecord, ProjectDocumentV5 } from '../contracts.js';
import { validateProjectDocument } from '../project-document.js';
import {
  canonicalHashPayload,
  type CanonicalRevisionReference,
  resolveCanonicalRevision,
  sha256,
  stableJson
} from './canonical-export-core.js';

const exportOptionsSchema = z.object({
  revision: z.union([z.literal('current'), z.string().trim().min(1).max(200), z.number().int().nonnegative()]).optional(),
  adapters: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  format: z.string().trim().min(1).max(80).optional()
});

export interface CanonicalExportOptions {
  revision?: CanonicalRevisionReference;
  adapters?: string[];
  format?: string;
}

export interface CanonicalExportBundle {
  source: ProjectDocumentV5;
  documents: Record<string, string>;
  canonicalHash: string;
  record: ExportRecord;
}

export type CanonicalDocumentFactory = (
  source: ProjectDocumentV5,
  adapters: string[]
) => Record<string, string>;

export function assertIdeaPlanAlignment(source: ProjectDocumentV5): void {
  if (source.planAlignment?.status === 'aligned') return;
  throw new Error('Fikir belgesi canonical plandan farklı. Güncel planı dışa aktarmadan önce etki analizini inceleyip onaylayın.');
}

export function createExportRecordId(): string {
  return globalThis.crypto?.randomUUID?.() || `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createCanonicalExportBundle(
  project: ProjectDocumentV5,
  options: CanonicalExportOptions,
  createDocuments: CanonicalDocumentFactory
): Promise<CanonicalExportBundle> {
  const parsedOptions = exportOptionsSchema.parse(options);
  const revision = parsedOptions.revision ?? 'current';
  const adapters = parsedOptions.adapters ?? [];
  const format = parsedOptions.format ?? 'promtgen';
  const source = resolveCanonicalRevision(project, revision);
  assertIdeaPlanAlignment(source);
  const validation = validateProjectDocument(source);
  if (!validation.valid) throw new Error(`Geçersiz proje: ${validation.errors.join(' ')}`);
  const documents = createDocuments(source, adapters);
  const canonicalHash = await sha256(stableJson(canonicalHashPayload(source)));
  const record: ExportRecord = {
    id: createExportRecordId(),
    format,
    canonicalRevision: source.canonicalRevision,
    createdAt: new Date().toISOString(),
    canonicalHash,
    adapterIds: [...adapters],
    fileNames: Object.keys(documents)
  };
  return { source, documents, canonicalHash, record };
}
