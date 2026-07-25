export interface UntrustedContentWrapper {
  safeText: string;
  originalByteLength: number;
}

export function wrapUntrustedContext(content: string, label: string = 'User Exported Context'): UntrustedContentWrapper {
  const raw = String(content || '');

  // Escape system prompt override attempt patterns
  const sanitized = raw
    .replace(/<\|im_start\|>/g, '[ESCAPED_TOKEN]')
    .replace(/<\|im_end\|>/g, '[ESCAPED_TOKEN]')
    .replace(/\[SYSTEM_PROMPT\]/gi, '[ESCAPED_SYSTEM_PROMPT]')
    .replace(/Ignore previous instructions/gi, '[POTENTIAL_PROMPT_INJECTION_DEFLECTED]');

  const safeText = `
--- UNTRUSTED DATA BOUNDARY BEGIN: ${label} ---
${sanitized}
--- UNTRUSTED DATA BOUNDARY END: ${label} ---
`.trim();

  return {
    safeText,
    originalByteLength: new TextEncoder().encode(raw).byteLength
  };
}
