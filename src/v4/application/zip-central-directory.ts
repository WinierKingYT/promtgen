const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const MAX_ZIP_COMMENT_BYTES = 65_535;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const DATA_DESCRIPTOR_FLAG = 0x0008;

export interface ZipDirectoryEntry {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
  directory: boolean;
}

export interface ZipDirectoryInspection {
  entries: ZipDirectoryEntry[];
  totalUncompressedBytes: number;
}

function invalidZip(detail: string): Error {
  return new Error(`Paket ZIP yapısı geçersiz: ${detail}`);
}

function assertRange(bytes: Uint8Array, offset: number, length: number, detail: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
    || offset < 0 || length < 0 || offset + length > bytes.byteLength) {
    throw invalidZip(detail);
  }
}

function decodeEntryName(bytes: Uint8Array, utf8: boolean): string {
  if (!utf8 && bytes.some(byte => byte > 0x7f)) {
    throw invalidZip('UTF-8 olarak işaretlenmemiş ASCII dışı dosya adı');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalidZip('dosya adı UTF-8 olarak çözümlenemedi');
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView): number {
  const firstCandidate = bytes.byteLength - END_OF_CENTRAL_DIRECTORY_BYTES;
  const lastCandidate = Math.max(0, firstCandidate - MAX_ZIP_COMMENT_BYTES);
  for (let offset = firstCandidate; offset >= lastCandidate; offset -= 1) {
    if (view.getUint32(offset, true) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + END_OF_CENTRAL_DIRECTORY_BYTES + commentLength === bytes.byteLength) return offset;
  }
  throw invalidZip('merkez dizin sonu bulunamadı');
}

function validateLocalHeader(
  bytes: Uint8Array,
  view: DataView,
  centralDirectoryOffset: number,
  localHeaderOffset: number,
  centralFlags: number,
  compressionMethod: number,
  compressedBytes: number,
  expectedName: string
): void {
  assertRange(bytes, localHeaderOffset, 30, 'yerel dosya başlığı eksik');
  if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw invalidZip('yerel dosya başlığı imzası eşleşmiyor');
  }
  const localFlags = view.getUint16(localHeaderOffset + 6, true);
  const localCompressionMethod = view.getUint16(localHeaderOffset + 8, true);
  if ((localFlags & (ENCRYPTED_FLAG | DATA_DESCRIPTOR_FLAG | UTF8_FLAG))
    !== (centralFlags & (ENCRYPTED_FLAG | DATA_DESCRIPTOR_FLAG | UTF8_FLAG))
    || localCompressionMethod !== compressionMethod) {
    throw invalidZip(`yerel ve merkezi başlıklar eşleşmiyor: ${expectedName}`);
  }
  const fileNameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraFieldLength = view.getUint16(localHeaderOffset + 28, true);
  const nameOffset = localHeaderOffset + 30;
  assertRange(bytes, nameOffset, fileNameLength + extraFieldLength, 'yerel dosya adı veya ek alan eksik');
  const localName = decodeEntryName(bytes.subarray(nameOffset, nameOffset + fileNameLength), Boolean(localFlags & UTF8_FLAG));
  if (localName !== expectedName) throw invalidZip(`yerel dosya adı merkez dizinle eşleşmiyor: ${expectedName}`);
  const dataOffset = nameOffset + fileNameLength + extraFieldLength;
  if (dataOffset + compressedBytes > centralDirectoryOffset) {
    throw invalidZip(`sıkıştırılmış veri merkez dizin sınırını aşıyor: ${expectedName}`);
  }
}

export function inspectZipCentralDirectory(bytes: Uint8Array): ZipDirectoryInspection {
  if (bytes.byteLength < END_OF_CENTRAL_DIRECTORY_BYTES) throw invalidZip('dosya çok kısa');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes, view);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectoryBytes = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw invalidZip('çok diskli ZIP paketleri desteklenmiyor');
  }
  if (entryCount === 0xffff || centralDirectoryBytes === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw invalidZip('ZIP64 paketleri desteklenmiyor');
  }
  assertRange(bytes, centralDirectoryOffset, centralDirectoryBytes, 'merkez dizin sınırları geçersiz');
  if (centralDirectoryOffset + centralDirectoryBytes !== endOffset) {
    throw invalidZip('merkez dizin uzunluğu paket sonuyla eşleşmiyor');
  }

  const entries: ZipDirectoryEntry[] = [];
  const names = new Set<string>();
  let cursor = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    assertRange(bytes, cursor, 46, 'merkez dizin girdisi eksik');
    if (view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw invalidZip('merkez dizin girdisi imzası eşleşmiyor');
    }
    const flags = view.getUint16(cursor + 8, true);
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedBytes = view.getUint32(cursor + 20, true);
    const uncompressedBytes = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraFieldLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const variableLength = fileNameLength + extraFieldLength + commentLength;
    assertRange(bytes, cursor + 46, variableLength, 'merkez dizin değişken alanı eksik');

    if (flags & ENCRYPTED_FLAG) throw invalidZip('şifreli girdiler desteklenmiyor');
    if (compressionMethod !== 0 && compressionMethod !== 8) throw invalidZip('desteklenmeyen sıkıştırma yöntemi');
    if (diskStart !== 0 || compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw invalidZip('ZIP64 veya çok diskli girdi desteklenmiyor');
    }

    const nameOffset = cursor + 46;
    const name = decodeEntryName(bytes.subarray(nameOffset, nameOffset + fileNameLength), Boolean(flags & UTF8_FLAG));
    if (!name || names.has(name)) throw invalidZip(name ? `yinelenen dosya yolu: ${name}` : 'boş dosya adı');
    names.add(name);
    validateLocalHeader(bytes, view, centralDirectoryOffset, localHeaderOffset, flags, compressionMethod, compressedBytes, name);

    totalUncompressedBytes += uncompressedBytes;
    if (!Number.isSafeInteger(totalUncompressedBytes)) throw invalidZip('açılmış içerik boyutu güvenli sayı sınırını aşıyor');
    entries.push({ name, compressedBytes, uncompressedBytes, directory: name.endsWith('/') });
    cursor += 46 + variableLength;
  }
  if (cursor !== centralDirectoryOffset + centralDirectoryBytes) {
    throw invalidZip('merkez dizin girdi sayısı ve uzunluğu eşleşmiyor');
  }
  return { entries, totalUncompressedBytes };
}
