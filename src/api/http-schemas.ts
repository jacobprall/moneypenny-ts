/**
 * Zod schemas for HTTP JSON bodies — single source for validation.
 */

import { z } from "zod/v4";

export const ContextPostBody = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  maxChars: z.number().int().positive().max(16000).optional(),
});
export type ContextPostBodyIn = z.infer<typeof ContextPostBody>;

export const EventsAppendBody = z.object({
  operation: z.string().min(1),
  actor: z.string().min(1),
  sessionId: z.string().nullable().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
});
export type EventsAppendBodyIn = z.infer<typeof EventsAppendBody>;

export const FactsPostBody = z.object({
  content: z.string().min(1),
  keywords: z.union([z.array(z.string()), z.string()]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sessionId: z.string().optional(),
});
export type FactsPostBodyIn = z.infer<typeof FactsPostBody>;

export const FactsSearchBody = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
  minScore: z.number().optional(),
  sessionId: z.string().optional(),
});
export type FactsSearchBodyIn = z.infer<typeof FactsSearchBody>;

export const KnowledgeIngestBody = z.object({
  source: z.enum(["url", "file", "text"]),
  url: z.string().optional(),
  path: z.string().optional(),
  content: z.string().optional(),
  context: z.string().optional(),
  title: z.string().optional(),
  sessionId: z.string().optional(),
});
export type KnowledgeIngestBodyIn = z.infer<typeof KnowledgeIngestBody>;

export const KnowledgeSearchBody = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
  minScore: z.number().optional(),
  sessionId: z.string().optional(),
});
export type KnowledgeSearchBodyIn = z.infer<typeof KnowledgeSearchBody>;

export const PolicyEvaluateBody = z.object({
  actor: z.string().min(1),
  action: z.string().min(1),
  resource: z.string(),
  denyByDefault: z.boolean().optional(),
  sessionId: z.string().optional(),
});
export type PolicyEvaluateBodyIn = z.infer<typeof PolicyEvaluateBody>;

