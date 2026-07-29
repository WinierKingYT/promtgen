// Type declarations for src/v4/ai-schemas.js
import { z } from 'zod';

export const discoverySchema: z.ZodObject<{
  reply: z.ZodDefault<z.ZodString>;
  analysisNote: z.ZodDefault<z.ZodString>;
  summary: z.ZodString;
  options: z.ZodArray<any>;
  openQuestions: z.ZodDefault<z.ZodArray<any>>;
}>;
export const DISCOVERY_SCHEMA_ID: string;
export const discoveryAnswerExtractionSchema: z.ZodObject<any>;
export const DISCOVERY_ANSWER_EXTRACTION_SCHEMA_ID: string;
export const ideaLabSchema: z.ZodObject<any>;
export const IDEA_LAB_SCHEMA_ID: string;
export const architectureReviewSchema: z.ZodObject<any>;
export const ARCHITECTURE_REVIEW_SCHEMA_ID: string;
