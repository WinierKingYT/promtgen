export type ProjectDomain = 'game' | 'web' | 'mobile' | 'ai' | 'general';

const DOMAIN_PATTERNS: Record<Exclude<ProjectDomain, 'general'>, RegExp> = {
  game: /oyun|game|s&box|unity|godot|unreal|engine|fizik|arcade|yaratık|entity/i,
  web: /web|site|saas|e-ticaret|portal|dashboard|react|next|api|backend|veritabanı/i,
  mobile: /mobil|mobile|ios|android|flutter|react native|\bapp\b/i,
  ai: /yapay zeka|\bai\b|agent|ajan|llm|prompt|model|gpt|bot/i
};

export function classifyProjectDomain(text: string): ProjectDomain {
  const source = String(text || '');
  for (const domain of ['game', 'web', 'mobile', 'ai'] as const) {
    if (DOMAIN_PATTERNS[domain].test(source)) return domain;
  }
  return 'general';
}

export function projectDomainLabel(domain: ProjectDomain): string {
  return {
    game: 'Oyun / Game Engine',
    web: 'Web / SaaS / API',
    mobile: 'Mobil / Cross-Platform',
    ai: 'AI / LLM Sistemi',
    general: 'Genel Yazılım'
  }[domain];
}
