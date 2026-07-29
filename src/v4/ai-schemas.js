import { z } from 'zod';

const shortText = z.string().trim().min(1).max(500);
const planSectionSchema = z.enum(['vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture', 'security', 'tasks', 'risks', 'testing', 'deployment', 'operations']);

// 1. Discovery Bundle Schema
export const DISCOVERY_SCHEMA_ID = 'discovery-v1';
export const discoverySchema = z.object({
  reply: z.string().trim().min(1).max(4000).default(''),
  analysisNote: z.string().trim().min(1).max(2000).default(''),
  summary: z.string().trim().min(1).max(1200),
  options: z.array(z.object({
    kind: z.enum(['feature', 'decision', 'risk', 'question', 'architecture']).default('feature'),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(3000),
    pros: z.array(shortText).max(8),
    cons: z.array(shortText).max(8),
    effort: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    affectedSections: z.array(planSectionSchema).min(1).max(12),
    recommended: z.boolean()
  }).strict()).min(3).max(5),
  openQuestions: z.array(shortText).max(12).default([])
}).strict();

export const DISCOVERY_ANSWER_EXTRACTION_SCHEMA_ID = 'discovery-answer-extraction-v1';
export const discoveryAnswerExtractionSchema = z.object({
  fields: z.array(z.object({
    field: z.enum([
      'targetUser',
      'problemStatement',
      'currentAlternative',
      'desiredOutcome',
      'confirmedFeatures',
      'outOfScope',
      'technicalApproaches',
      'knownRisks',
      'mvpTarget'
    ]),
    value: z.union([shortText, z.array(shortText).min(1).max(12)]),
    confidence: z.number().int().min(0).max(100),
    rationale: shortText
  }).strict()).max(10),
  warnings: z.array(shortText).max(8).default([])
}).strict();

// 2. Idea Lab Schema (Dedicated for Fikir Laboratuvarı)
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

// 3. Architecture Review Schema
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
