const SECRET_PATTERNS = [
  { name: 'ANTHROPIC_KEY', regex: /sk-ant-[a-zA-Z0-9_-]{16,}/g, placeholder: '[REDACTED_ANTHROPIC_KEY]' },
  { name: 'OPENAI_KEY', regex: /sk-[a-zA-Z0-9_-]{16,}/g, placeholder: '[REDACTED_OPENAI_KEY]' },
  { name: 'AWS_KEY', regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, placeholder: '[REDACTED_AWS_KEY]' },
  { name: 'GITHUB_TOKEN', regex: /gh[pousr]_[a-zA-Z0-9]{20,}/g, placeholder: '[REDACTED_GITHUB_TOKEN]' },
  { name: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, placeholder: '[REDACTED_JWT_TOKEN]' },
  { name: 'PRIVATE_KEY', regex: /-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, placeholder: '[REDACTED_PRIVATE_KEY]' },
  { name: 'CONNECTION_STRING', regex: /(postgres|mysql|mongodb|redis|amqp):\/\/[^\s,;"']+/gi, placeholder: '[REDACTED_CONNECTION_STRING]' },
  { name: 'GENERIC_SECRET', regex: /(api[_-]?key|access[_-]?token|secret[_-]?key|password|token)\s*[:=]\s*["']?[^\s,;"']+/gi, placeholder: '$1=[REDACTED]' }
];

export function redactSensitiveData(text) {
  let resultText = String(text || '');
  let totalRedactions = 0;

  for (const item of SECRET_PATTERNS) {
    const matches = resultText.match(item.regex);
    if (matches) {
      totalRedactions += matches.length;
      resultText = resultText.replace(item.regex, item.placeholder);
    }
  }

  return {
    redactedText: resultText,
    redactedCount: totalRedactions
  };
}
