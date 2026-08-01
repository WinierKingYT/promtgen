import JSZip, { type JSZipObject } from 'jszip';
import { z } from 'zod';
import type { ProjectDocumentV5 } from '../contracts.js';
import { normalizeProjectDocument } from '../canonical-entities.js';
import { tryMigrateOrPassthrough } from '../migrations.js';
import { validateProjectDocument } from '../project-document.js';
import {
  canonicalHashPayload,
  resolveCanonicalRevision,
  sha256,
  sha256Bytes,
  stableJson
} from './canonical-export-core.js';

const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_PACKAGE_ENTRIES = 500;
const MAX_JSON_DEPTH = 40;
const MAX_JSON_NODES = 50_000;
const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const packageEntrySchema = z.object({
  path: z.string(),
  sha256: z.string(),
  bytes: z.number(),
  role: z.enum(['project', 'history', 'export'])
});

const packageManifestSchema = z.object({
  format: z.literal('promtgen'),
  formatVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  schemaVersion: z.union([z.literal(4), z.literal(5)]),
  schemaRevision: z.number().optional(),
  projectId: z.string().optional(),
  revision: z.number().optional(),
  canonicalRevision: z.number().optional(),
  canonicalHash: z.string().optional(),
  createdAt: z.string().optional(),
  files: z.array(z.string()).optional(),
  entries: z.array(packageEntrySchema).optional(),
  adapters: z.array(z.string()).optional()
});

export type PromtgenPackageEntry = z.infer<typeof packageEntrySchema>;
export type PromtgenPackageManifest = Omit<z.infer<typeof packageManifestSchema>, 'files'> & { files: string[] };
export interface PromtgenPackageIntegrity {
  level: 'full' | 'canonical' | 'legacy';
  verifiedEntries: number;
  totalEntries: number;
  warnings: string[];
}
export interface PromtgenPackageInspection {
  project: ProjectDocumentV5;
  manifest: PromtgenPackageManifest;
  integrity: PromtgenPackageIntegrity;
}

type PackageInput = Blob | ArrayBuffer | Uint8Array;
type SizedZipObject = JSZipObject & { _data?: { uncompressedSize?: number } };

function validateEntryPath(path: string): boolean {
  if (!path || path.length > 240 || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[a-z]:/i.test(path)) return false;
  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 && segments.every(segment => segment !== '.' && segment !== '..' && !segment.includes(':'));
}

function assertSafeJsonValue(value: unknown): unknown {
  let nodes = 0;
  const visit = (current: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES) throw new Error('Paket JSON yapısı izin verilen karmaşıklığı aşıyor.');
    if (depth > MAX_JSON_DEPTH) throw new Error('Paket JSON yapısı izin verilen derinliği aşıyor.');
    if (!current || typeof current !== 'object') return;
    for (const key of Object.keys(current)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) throw new Error(`Paket JSON içeriğinde yasak anahtar var: ${key}`);
      visit((current as Record<string, unknown>)[key], depth + 1);
    }
  };
  visit(value, 0);
  return value;
}

async function readSafeJsonEntry(zip: JSZip, name: string): Promise<unknown> {
  const entry = zip.file(name);
  if (!entry) throw new Error(`Paket zorunlu girdiyi içermiyor: ${name}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await entry.async('string')) as unknown;
  } catch {
    throw new Error(`Paket JSON girdisi okunamadı: ${name}`);
  }
  return assertSafeJsonValue(parsed);
}

async function packageBytes(file: PackageInput): Promise<ArrayBuffer | Uint8Array> {
  const size = 'size' in file ? file.size : file.byteLength;
  if (size > MAX_PACKAGE_BYTES) throw new Error('Paket 25 MB sınırını aşıyor.');
  const data = 'arrayBuffer' in file ? await file.arrayBuffer() : file;
  if (data.byteLength > MAX_PACKAGE_BYTES) throw new Error('Paket 25 MB sınırını aşıyor.');
  return data;
}

function parseManifest(value: unknown): PromtgenPackageManifest {
  const parsed = packageManifestSchema.safeParse(value);
  if (!parsed.success) throw new Error('Desteklenmeyen .promtgen paketi.');
  const files = parsed.data.files ?? (parsed.data.formatVersion === 1 ? [] : null);
  if (!files || files.length > MAX_PACKAGE_ENTRIES || files.some(path => !validateEntryPath(path))) {
    throw new Error('Paket manifest dosya listesi geçersiz.');
  }
  return { ...parsed.data, files };
}

function validateDeclaredEntries(entries: PromtgenPackageEntry[] | undefined): PromtgenPackageEntry[] {
  if (!entries || entries.length > MAX_PACKAGE_ENTRIES) throw new Error('Paket bütünlük listesi geçersiz.');
  for (const entry of entries) {
    if (!validateEntryPath(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > MAX_ENTRY_BYTES) {
      throw new Error('Paket bütünlük kaydı geçersiz.');
    }
  }
  return entries;
}

export async function inspectPromtgenPackage(file: PackageInput): Promise<PromtgenPackageInspection> {
  if (!file) throw new Error('Paket 25 MB sınırını aşıyor.');
  const zip = await JSZip.loadAsync(await packageBytes(file));
  const entries = Object.values(zip.files) as SizedZipObject[];
  if (entries.length > MAX_PACKAGE_ENTRIES) throw new Error(`Paket ${MAX_PACKAGE_ENTRIES} girdi sınırını aşıyor.`);

  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    if (!validateEntryPath(entry.name)) throw new Error(`Güvensiz paket yolu: ${entry.name}`);
    if (entry.dir) continue;
    const size = Number(entry._data?.uncompressedSize);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Paket girdisi boyutu doğrulanamadı: ${entry.name}`);
    if (size > MAX_ENTRY_BYTES) throw new Error(`Paket girdisi çok büyük: ${entry.name}`);
    totalUncompressedBytes += size;
    if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) throw new Error('Paket açılmış içerik boyutu 50 MB sınırını aşıyor.');
  }

  const manifest = parseManifest(await readSafeJsonEntry(zip, 'manifest.json'));
  if (manifest.files.some(path => !zip.file(path))) throw new Error('Paket manifestinde belirtilen bir dosya eksik.');

  let integrity: PromtgenPackageIntegrity = {
    level: 'legacy',
    verifiedEntries: 0,
    totalEntries: entries.filter(entry => !entry.dir && entry.name !== 'manifest.json').length,
    warnings: ['Bu eski paket sürümünde kriptografik bütünlük kaydı bulunmuyor.']
  };

  if (manifest.formatVersion === 3) {
    const declaredEntries = validateDeclaredEntries(manifest.entries);
    const declaredPaths = new Set<string>();
    for (const declared of declaredEntries) {
      if (declaredPaths.has(declared.path)) throw new Error(`Paket bütünlük listesinde yinelenen yol var: ${declared.path}`);
      declaredPaths.add(declared.path);
    }
    const actualPaths = entries.filter(entry => !entry.dir && entry.name !== 'manifest.json').map(entry => entry.name);
    if (!declaredPaths.has('project.json') || !declaredPaths.has('history/revisions.json')) throw new Error('Paket zorunlu bütünlük kayıtlarını içermiyor.');
    if (actualPaths.some(path => !declaredPaths.has(path)) || [...declaredPaths].some(path => !actualPaths.includes(path))) {
      throw new Error('Paket içeriği ile bütünlük listesi eşleşmiyor.');
    }
    if (manifest.files.some(path => !declaredPaths.has(path))) throw new Error('Export dosyası bütünlük listesinde bulunmuyor.');
    for (const declared of declaredEntries) {
      const bytes = await zip.file(declared.path)!.async('uint8array');
      if (bytes.byteLength !== declared.bytes) throw new Error(`Paket girdisi boyutu doğrulanamadı: ${declared.path}`);
      if (await sha256Bytes(bytes) !== declared.sha256) throw new Error(`Paket girdisi bütünlük doğrulamasını geçemedi: ${declared.path}`);
    }
    await readSafeJsonEntry(zip, 'history/revisions.json');
    integrity = { level: 'full', verifiedEntries: declaredEntries.length, totalEntries: declaredEntries.length, warnings: [] };
  }

  const projectJson = await readSafeJsonEntry(zip, 'project.json');
  if (manifest.formatVersion >= 2 && manifest.canonicalHash) {
    const hashSource = resolveCanonicalRevision(projectJson, manifest.canonicalRevision || manifest.revision);
    if (await sha256(stableJson(canonicalHashPayload(hashSource))) !== manifest.canonicalHash) {
      throw new Error('Paket canonical özeti doğrulanamadı; içerik değiştirilmiş olabilir.');
    }
    if (manifest.formatVersion === 2) {
      integrity = {
        level: 'canonical',
        verifiedEntries: 1,
        totalEntries: entries.filter(entry => !entry.dir && entry.name !== 'manifest.json').length,
        warnings: ['Canonical plan doğrulandı; bu eski sürümde export belgeleri ve geçmiş ayrı ayrı hashlenmiyor.']
      };
    }
  }

  const migration = tryMigrateOrPassthrough(projectJson) as { project: unknown; error?: string | null };
  if (migration.error) throw new Error(`Paket migration başarısız: ${migration.error}`);
  const project = normalizeProjectDocument(migration.project) as ProjectDocumentV5;
  const validation = validateProjectDocument(project);
  if (!validation.valid) throw new Error(`Paket proje şeması geçersiz: ${validation.errors.join(' ')}`);
  if (manifest.projectId && manifest.projectId !== project.id) throw new Error('Paket manifesti ile proje kimliği eşleşmiyor.');
  return { project, manifest, integrity };
}

export async function readPromtgenPackage(file: PackageInput): Promise<ProjectDocumentV5> {
  return (await inspectPromtgenPackage(file)).project;
}
