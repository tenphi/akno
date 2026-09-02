import { z } from 'zod';
import { GraphEvidenceLocator, GraphNodeRef, GraphRelation, MemoryView, ResultEnvelope } from '../common.ts';

export const GraphDirection = z.enum(['out', 'in', 'both']);
export type GraphDirection = z.infer<typeof GraphDirection>;

/** One exact seed form. Query seeds still resolve only evidence-declared names. */
export const GraphInput = z
  .object({
    slug: z.string().trim().min(1).optional(),
    entity: z.string().trim().min(1).optional(),
    query: z.string().trim().min(1).optional(),
    direction: GraphDirection.optional(),
    relations: z.array(GraphRelation).min(1).max(GraphRelation.options.length).optional(),
    max_hops: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    /** Maximum returned paths. Nodes, edges, and per-node fan-out have separate hard caps. */
    limit: z.number().int().positive().max(100).optional(),
    include_history: z.boolean().optional(),
    /** Restrict typed retained-memory relation edges. Inferred for query seeds, factual otherwise. */
    memory_view: MemoryView.optional(),
  })
  .refine((value) => [value.slug, value.entity, value.query].filter(Boolean).length === 1, {
    message: 'graph requires exactly one of: slug, entity, query',
  });
export type GraphInput = z.infer<typeof GraphInput>;

export const GraphEdgeRef = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  relation: GraphRelation,
  predicate: z.string().optional(),
  confidence: z.number().min(0).max(1),
  derivation: z.enum(['structural', 'fact', 'memory']),
  resolution: z.enum(['exact', 'contextual']),
  evidence: GraphEvidenceLocator,
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
  historical: z.boolean(),
});
export type GraphEdgeRef = z.infer<typeof GraphEdgeRef>;

export const GraphSeed = z.object({
  form: z.enum(['slug', 'entity', 'query']),
  value: z.string(),
  node: z.string(),
});
export type GraphSeed = z.infer<typeof GraphSeed>;

export const GraphPath = z.object({
  seed: z.string(),
  nodes: z.array(z.string()).min(2).max(4),
  edges: z.array(z.string()).min(1).max(3),
  hops: z.number().int().positive().max(3),
  confidence: z.number().min(0).max(1),
  evidence: z.array(GraphEvidenceLocator).min(1).max(3),
});
export type GraphPath = z.infer<typeof GraphPath>;

export const GraphAmbiguity = z.object({
  mention: z.string(),
  normalized: z.string(),
  candidates: z.array(GraphNodeRef),
});
export type GraphAmbiguity = z.infer<typeof GraphAmbiguity>;

export const GraphOutput = ResultEnvelope.extend({
  seeds: z.array(GraphSeed),
  nodes: z.array(GraphNodeRef),
  edges: z.array(GraphEdgeRef),
  paths: z.array(GraphPath),
  ambiguities: z.array(GraphAmbiguity),
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
  reason: z.enum(['seed_not_found', 'no_paths', 'graph_index_unreadable']).optional(),
  memory_view: MemoryView,
});
export type GraphOutput = z.infer<typeof GraphOutput>;

export { GraphEvidenceLocator, GraphNodeRef, GraphRelation } from '../common.ts';
export type { GraphNodeKind } from '../common.ts';
