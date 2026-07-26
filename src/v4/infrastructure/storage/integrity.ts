export const INTEGRITY_ALGORITHM = 'SHA-256';

export async function computeSha256(data: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(data ?? null));
  const digest = await globalThis.crypto.subtle.digest(INTEGRITY_ALGORITHM, encoded);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifySha256(data: unknown, expectedDigest: string): Promise<boolean> {
  return (await computeSha256(data)) === expectedDigest;
}
