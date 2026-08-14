import { z } from 'zod';
import { ResultEnvelope } from '../common.ts';

/**
 * **Declare a folder before writing into it.**
 *
 * A folder used to appear the moment a page was written under it, and a new top-level one
 * became a question for the owner. Both halves were wrong. The owner does not want to be
 * asked where an agent's research note goes; and a folder that appears with no statement of
 * what belongs in it is a folder the next caller has to guess about — which is how evidence
 * and claims end up in the same place, and how a rent figure from a transcript gets filed as
 * a defence strategy.
 *
 * So this op is **never gated**: nothing here waits on a human. What it costs instead is a
 * sentence. Saying what the folder is for is the whole point of the step, which is why
 * `description` is required and everything else is optional.
 */
export const FolderInput = z.object({
  /** The folder, as a slug prefix: `research`, `household/appliances`. No globs, no `.md`. */
  path: z.string().min(1),
  /**
   * What belongs here, in a sentence, written for a caller who has never seen this knowledge
   * base. It is returned by `list` and carried in the pre-turn bundle, so it is the thing that
   * makes the folder self-explanatory later.
   */
  description: z.string().min(1).max(500),
  /**
   * `full` (the default) for claims, `reference` for evidence, `excluded` for what should not
   * be indexed. Only claims become facts, so this is the load-bearing choice: a folder of
   * transcripts or articles declared `full` will be mined for assertions nobody made.
   */
  class: z.enum(['full', 'reference', 'excluded']).optional(),
  /** Default `type` for pages here, when the folder has one. */
  type: z.string().optional(),
  ingest: z.enum(['page', 'document', 'file', 'auto', 'ignore']).optional(),
  /** Multiplied into the recall score. Demotes without hiding. */
  rank: z.number().min(0).max(2).optional(),
  /** Makes this an inbox: arrivals are extracted, named and moved out of it. */
  route: z.boolean().optional(),
  dry_run: z.boolean().optional(),
});
export type FolderInput = z.infer<typeof FolderInput>;

export const FolderOutput = ResultEnvelope.extend({
  /** `noop` when the folder was already declared — its existing rule comes back unchanged. */
  outcome: z.enum(['ok', 'noop']),
  /** The glob the rule was filed under, e.g. `research/**`. */
  glob: z.string().optional(),
  path: z.string().optional(),
  /** The rule now in force for this folder. */
  rule: z.record(z.string(), z.unknown()).optional(),
  /** The file the rule was written to, so a caller can say where the taxonomy lives. */
  rules_file: z.string().optional(),
  change_id: z.string().optional(),
});
export type FolderOutput = z.infer<typeof FolderOutput>;
