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

export const SOLUTION_DISCOVERY_SCHEMA_ID = 'solution-discovery-v1';

/**
 * Teknik konu — Idea tarafındaki `Concern` ile aynı soyutlama, teknik alanda.
 * `dependsOnTitles` kimlik değil başlık taşır: model henüz kimlikleri bilmez ve
 * uydurmasına izin verilirse bağımlılık grafiği kırılır.
 */
export const technicalConcernSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(80),
  importance: z.enum(['critical', 'important', 'optional']),
  whyItMatters: z.string().trim().min(1).max(1200),
  questions: z.array(shortText).max(5).default([]),
  uncertainty: z.number().min(0).max(1),
  downstreamImpact: z.number().min(0).max(1),
  dependsOnTitles: z.array(shortText).max(4).default([])
}).strict();

/**
 * Teknoloji **adayı** — karar değil. `derivedFrom*` alanları boş bırakılabilir;
 * çekirdek onları doğrular ve gerekçesiz geri dönülemez adayı reddeder. Şemanın
 * bunu zorlaması yanlış olurdu: model o zaman uydurmayı öğrenirdi.
 */
export const technologyCandidateSchema = z.object({
  concernTitle: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  rationale: z.string().trim().min(1).max(1200),
  tradeoffs: z.array(shortText).max(6).default([]),
  reversibility: z.enum(['reversible', 'costly', 'irreversible']),
  derivedFromIdeaDecisionIds: z.array(shortText).max(6).default([]),
  derivedFromIdeaConcernIds: z.array(shortText).max(6).default([])
}).strict();

export const solutionDiscoverySchema = z.object({
  reply: z.string().trim().min(1).max(4000).default(''),
  /**
   * Alt sınır **yok**, bilerek. `min(1)` modelden her turda en az bir teknik
   * konu istiyordu ve bu iki şeyi birden bozuyordu: proje gerçekten teknik
   * karar gerektirmediğinde dürüst cevap şemadan düşüyor (teknik tarafta yerel
   * yedek motor yok, yani tur hata veriyor), ve model listeyi doldurmak için
   * konu uydurmaya itiliyor. Ürün "teknik karar gerekmiyor"u zaten meşru bir
   * sonuç sayıyor.
   */
  technicalConcerns: z.array(technicalConcernSchema).max(8).default([]),
  candidates: z.array(technologyCandidateSchema).max(10).default([]),
  openQuestions: z.array(shortText).max(8).default([]),
  uncertainty: z.array(shortText).max(3).default([])
}).strict();

export type SolutionDiscoveryOutput = z.infer<typeof solutionDiscoverySchema>;

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
  /**
   * Teslim sırası hakkında modelin görüşü: "core" bu şeyin fikrin ŞU ANKİ
   * çekirdek kapsamına ait göründüğü, "later" beklemesinin sorun olmadığı
   * anlamına gelir. Eski adı `mvpHint`, eski değerleri `mvp-adayı|sonraya`
   * idi; her fikri alanından bağımsız olarak MVP terimleriyle değerlendirmeye
   * zorluyordu. Değerler İngilizce çünkü karttaki diğer bütün numaralandırmalar
   * (`kind`, `effort`, `impact`) İngilizce. Alan gösterim amaçlıdır:
   * hiçbir yere kaydedilmez ve hiçbir dallanmayı sürmez.
   */
  deliveryHorizon: z.enum(['core', 'later'])
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

export const IDEA_AXES_SCHEMA_ID = 'idea-axes-v1';

/**
 * Fikre özel genişletme ekseni (tier 3). CORE ve BY_DOMAIN tablolarının
 * kapsamadığı, tek bu fikre özgü başlıklar için. `id` burada bilerek yok:
 * kimlik modelden gelmez, çağıran servis fingerprint'ten türetir — model
 * kimlik uydurursa CORE/BY_DOMAIN kimlikleriyle çakışabilir.
 */
export const ideaAxisSchema = z.object({
  label: z.string().trim().min(1).max(80),
  hint: z.string().trim().min(1).max(200)
}).strict();

export const ideaAxesSchema = z.object({
  axes: z.array(ideaAxisSchema).max(5).default([])
}).strict();

export type IdeaAxesOutput = z.infer<typeof ideaAxesSchema>;

export const IDEA_FOUNDATION_SCHEMA_ID = 'idea-foundation-v1';

/**
 * Tek bir foundation alanı için model çıktısı. Modelin altı alanın HER
 * BİRİNDE dürüstçe üç yoldan birini seçebilmesi gerekir -- aksi hâlde fikrin
 * yanıtlamadığı bir alanda (ör. `problemStatement`, `currentAlternative`)
 * "boş bırakamıyorum, bir şey yazmalıyım" baskısı UYDURMAYA yol açar (bkz.
 * `idea-foundation.ts` dosya başı yorumu):
 * - `idea`: fikir metninde bunun gerçek karşılığı var, `text` onu taşır.
 * - `assumption`: fikirde karşılığı YOK ama model ürün ortağı olarak bunu
 *   ÖNERİYOR; `text` öneriyi taşır. Kullanıcı zaten ek öneri istiyor --
 *   yasak olan öneri değil, öneriyi `idea` diye yutturmaktır.
 * - `unknown`: fikirden bu alan hiç çıkarılamıyor; `text` YOKTUR, yalnız
 *   `reason` kısaca nedenini taşır. Bu, önceki şemada mümkün OLMAYAN dürüst
 *   bir çıkıştır.
 * Alan sınırı (`maxLength`) çağıran alan için `updateConceptAgreement`in
 * kullandığı MAX_RECORD_TEXT (600) / MAX_DETAIL_TEXT (2400) ile birebir
 * aynıdır -- kullanıcı bu alanları elle düzenlerken aynı sınırla karşılaşır.
 */
function ideaFoundationFieldSchema(maxLength: number) {
  return z.discriminatedUnion('source', [
    z.object({ source: z.literal('idea'), text: z.string().trim().min(1).max(maxLength) }).strict(),
    z.object({ source: z.literal('assumption'), text: z.string().trim().min(1).max(maxLength) }).strict(),
    z.object({ source: z.literal('unknown'), reason: z.string().trim().min(1).max(300) }).strict()
  ]);
}

export type IdeaFoundationFieldOutput = z.infer<ReturnType<typeof ideaFoundationFieldSchema>>;

/**
 * Fikrin temelini modelden ister: bu şey ne, kimin için, bugün nasıl
 * çözülüyor, beklenen sonuç ve ilk sürümün tek hedefi ne -- her biri
 * `ideaFoundationFieldSchema` ile kaynağı işaretlenmiş olarak.
 * `interpretationConfidence`, `confidenceRationale`, `userConfirmed` ve
 * `confirmedAt` bilinçli olarak burada YOK: güven skoru ve onay modelin işi
 * değildir (bkz. application/idea-foundation-service.ts). Üst seviye
 * `.strict()` modelin bunları eklemesini reddeder.
 */
export const ideaFoundationSchema = z.object({
  summary: ideaFoundationFieldSchema(2400),
  problemStatement: ideaFoundationFieldSchema(2400),
  targetUser: ideaFoundationFieldSchema(600),
  currentAlternative: ideaFoundationFieldSchema(2400),
  desiredOutcome: ideaFoundationFieldSchema(2400),
  mvpTarget: ideaFoundationFieldSchema(600)
}).strict();

export type IdeaFoundationOutput = z.infer<typeof ideaFoundationSchema>;
