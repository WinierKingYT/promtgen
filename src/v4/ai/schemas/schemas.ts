import { z } from 'zod';

const shortText = z.string().trim().min(1).max(500);
export const PLAN_SECTION_IDS = ['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment', 'operations'] as const;
export const planSectionSchema = z.enum(PLAN_SECTION_IDS);

export const DISCOVERY_SCHEMA_ID = 'discovery-v1';

export const MINIMUM_DISCOVERY_OPTIONS = 3;

export const discoveryOptionSchema = z.object({
  kind: z.enum(['feature', 'decision', 'risk', 'question', 'architecture']).default('feature'),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  pros: z.array(shortText).max(8),
  cons: z.array(shortText).max(8),
  effort: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  affectedSections: z.array(planSectionSchema).min(1).max(12),
  recommended: z.boolean()
}).strict();

/**
 * Seçenekleri kullanılabilir ve kullanılamaz diye ayırır.
 * Model tek bir seçenekte alan atlayabiliyor veya olmayan bir bölüm adı
 * uydurabiliyor; hepsi-ya-hiçbiri doğrulama bu yüzden geçerli 3-5 seçeneğin
 * tamamını çöpe atıyordu. Hiçbir alan tamamlanmaz veya uydurulmaz: bozuk
 * seçenek yalnızca dışarıda bırakılır.
 */
export function partitionDiscoveryOptions(value: unknown): { usable: unknown[]; dropped: unknown[] } {
  if (!Array.isArray(value)) return { usable: [], dropped: [] };
  const usable: unknown[] = [];
  const dropped: unknown[] = [];
  for (const item of value) {
    (discoveryOptionSchema.safeParse(item).success ? usable : dropped).push(item);
  }
  return { usable, dropped };
}

/**
 * Kurtarma bir kaçış kapısı değildir. Geriye yeterli seçenek kalmıyorsa ham
 * dizi olduğu gibi döndürülür; şema reddeder, hata mesajı gerçek nedeni
 * gösterir ve tur dürüstçe yerel motora düşer.
 */
function dropUnusableOptions(value: unknown): unknown {
  const { usable } = partitionDiscoveryOptions(value);
  return usable.length >= MINIMUM_DISCOVERY_OPTIONS ? usable : value;
}

export const discoverySchema = z.object({
  reply: z.string().trim().min(1).max(4000).default(''),
  analysisNote: z.string().trim().min(1).max(2000).default(''),
  summary: z.string().trim().min(1).max(1200),
  options: z.preprocess(dropUnusableOptions, z.array(discoveryOptionSchema).min(MINIMUM_DISCOVERY_OPTIONS).max(5)),
  openQuestions: z.array(shortText).max(12).default([]),
  uncertainty: z.array(shortText).max(2).default([]),
  nextQuestionText: shortText.default(''),
  optionalPaths: z.array(z.object({
    title: shortText,
    reason: shortText,
    prompt: shortText
  }).strict()).max(3).default([])
}).strict();

export const IDEA_LAB_SCHEMA_ID = 'idea-lab-v1';
export const ideaLabSchema = z.object({
  approaches: z.array(z.object({
    id: z.string(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2000),
    pros: z.array(shortText).max(6),
    cons: z.array(shortText).max(6),
    risks: z.array(shortText).max(6),
    effort: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    recommended: z.boolean(),
    metrics: z.object({
      effortScore: z.number().min(1).max(5),
      networkLoad: z.number().min(1).max(5),
      fpsImpact: z.number().min(1).max(5),
      maintainability: z.number().min(1).max(5)
    }).optional(),
    presetAnswers: z.array(shortText).optional()
  })).min(2).max(4),
  ideaNotes: z.array(shortText).max(10).default([]),
  candidateDecisions: z.array(shortText).max(10).default([]),
  candidateRisks: z.array(shortText).max(10).default([])
});

export const ARCHITECTURE_REVIEW_SCHEMA_ID = 'architecture-review-v1';
export const architectureReviewSchema = z.object({
  findings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    recommendation: z.string()
  })),
  conflicts: z.array(z.string()),
  score: z.number().min(0).max(100)
});

export const SECTION_REGENERATION_SCHEMA_ID = 'section-regeneration-v1';
export const sectionRegenerationSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  patches: z.array(z.object({
    sectionId: planSectionSchema,
    proposedContent: z.string().trim().min(1).max(12_000),
    rationale: z.string().trim().min(1).max(1200),
    warnings: z.array(shortText).max(8).default([])
  }).strict()).min(1).max(12)
}).strict();

export type DiscoveryOutput = z.infer<typeof discoverySchema>;
export type IdeaLabOutput = z.infer<typeof ideaLabSchema>;
export type ArchitectureReviewOutput = z.infer<typeof architectureReviewSchema>;
export type SectionRegenerationOutput = z.infer<typeof sectionRegenerationSchema>;

export const IDEA_EXPANSION_SCHEMA_ID = 'idea-expansion-v1';
export const MINIMUM_EXPANSION_CARDS = 3;

export const expansionCardSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  kind: z.enum(['feature', 'decision', 'risk', 'question', 'architecture']),
  effort: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  mvpHint: z.enum(['mvp-adayı', 'sonraya'])
}).strict();

/**
 * Kartları kullanılabilir ve kullanılamaz diye ayırır. Tek bozuk kart yüzünden
 * kategori boş kalmasın diye discovery'deki kurtarma deseni burada da geçerlidir.
 * Hiçbir alan tamamlanmaz; bozuk kart yalnızca dışarıda bırakılır.
 */
export function partitionExpansionCards(value: unknown): { usable: unknown[]; dropped: unknown[] } {
  if (!Array.isArray(value)) return { usable: [], dropped: [] };
  const usable: unknown[] = [];
  const dropped: unknown[] = [];
  for (const item of value) {
    (expansionCardSchema.safeParse(item).success ? usable : dropped).push(item);
  }
  return { usable, dropped };
}

/**
 * Kurtarma bir kaçış kapısı değildir: geriye yeterli kart kalmıyorsa ham dizi
 * döner, şema reddeder ve tur dürüstçe seedTitles'a düşer.
 */
function dropUnusableCards(value: unknown): unknown {
  const { usable } = partitionExpansionCards(value);
  return usable.length >= MINIMUM_EXPANSION_CARDS ? usable : value;
}

export const ideaExpansionSchema = z.object({
  cards: z.preprocess(dropUnusableCards, z.array(expansionCardSchema).min(MINIMUM_EXPANSION_CARDS).max(10))
}).strict();

export type IdeaExpansionOutput = z.infer<typeof ideaExpansionSchema>;
