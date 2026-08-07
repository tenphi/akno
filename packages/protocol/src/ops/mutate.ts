import { z } from 'zod';
import { ResultEnvelope } from '../common.ts';
import { ApprovalRequest, WriteTarget } from './write.ts';

/**
 * Hand over a transcript or notes; Akno runs the retain mission with its
 * own model and produces the writes itself. The answer for a host that does not
 * want to build a curator. An agent that wants control uses `write`.
 */
export const RememberInput = z.object({
  text: z.string().min(1),
  /** Free-form provenance note, e.g. `telegram:2026-08-06`. */
  source: z.string().optional(),
  /** Report the candidate writes without touching disk. */
  dry_run: z.boolean().optional(),
});
export type RememberInput = z.infer<typeof RememberInput>;

export const RememberOutput = ResultEnvelope.extend({
  outcome: z.enum(['ok', 'requires_approval', 'noop']),
  change_id: z.string().optional(),
  wrote: z.array(WriteTarget).optional(),
  facts: z.object({ retired: z.number().int(), added: z.number().int() }).optional(),
  /** Candidates that cleared the retain mission but not `route_threshold`. */
  approvals: z.array(ApprovalRequest).optional(),
  /** What the retain mission decided was worth keeping, and what it dropped. */
  considered: z
    .array(z.object({ claim: z.string(), kept: z.boolean(), slug: z.string().nullable(), score: z.number() }))
    .optional(),
});
export type RememberOutput = z.infer<typeof RememberOutput>;

/**
 * All three forms operate on Markdown. Retracting a fact removes the
 * sentence that produced it — expiring a row while the sentence stays in the
 * file means the assistant "forgets" and reads it again tomorrow.
 */
export const ForgetInput = z
  .object({
    fact: z.string().optional(),
    slug: z.string().optional(),
    document: z.string().optional(),
  })
  .refine((v) => [v.fact, v.slug, v.document].filter(Boolean).length === 1, {
    message: 'forget takes exactly one of: fact, slug, document',
  });
export type ForgetInput = z.infer<typeof ForgetInput>;

export const ForgetOutput = ResultEnvelope.extend({
  change_id: z.string().optional(),
  removed_from: z.string().optional(),
  /** The exact bytes removed, so the caller can show the user what went. */
  removed: z.string().optional(),
  trashed: z.string().optional(),
});
export type ForgetOutput = z.infer<typeof ForgetOutput>;

export const UndoInput = z.object({ change_id: z.string().min(1) });
export type UndoInput = z.infer<typeof UndoInput>;

export const UndoOutput = ResultEnvelope.extend({
  reversed: z.string().optional(),
  /** Files whose previous content was put back. */
  restored: z.array(z.string()).optional(),
  /**
   * Files the change had created, and which reversing it therefore deleted.
   *
   * Separate from `restored` because they are opposite events. Reporting the removal of a
   * page as "restored" tells the caller a file is there when it is not — and after an
   * `undo` that is precisely the thing they are about to act on.
   */
  removed: z.array(z.string()).optional(),
});
export type UndoOutput = z.infer<typeof UndoOutput>;

/** Relocate a page with its documents, rewriting embeds and reporting inbound links. */
export const MoveInput = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type MoveInput = z.infer<typeof MoveInput>;

export const MoveOutput = ResultEnvelope.extend({
  outcome: z.enum(['ok', 'requires_approval']),
  change_id: z.string().optional(),
  moved: z.array(z.string()).optional(),
  /** Links that now point nowhere. Reported, never silently rewritten. */
  broken_inbound: z.array(z.string()).optional(),
  approval: ApprovalRequest.optional(),
});
export type MoveOutput = z.infer<typeof MoveOutput>;

/**
 * Pull documents into memory: extract, OCR, name, summarize, and route.
 * Extraction happens on arrival, always — no caller ever runs an extraction tool.
 */
export const IngestInput = z
  .object({
    /** A file, or a folder to walk one level deep. */
    path: z.string().optional(),
    /** An http or https URL. Fetched, then treated as a file. */
    url: z.string().url().optional(),
    /** Destination folder. Omit to let routing decide. */
    folder: z.string().optional(),
    /**
     * Move the file instead of copying it. The inbox is the only place Akno
     * moves files, and it sets this by rule — a file dropped straight into
     * `documents/` was put there on purpose.
     */
    route: z.boolean().optional(),
    label: z.string().optional(),
    /** Cap for a folder walk, so a wrong path cannot start a thousand model calls. */
    limit: z.number().int().positive().max(500).optional(),
  })
  .refine((v) => Boolean(v.path || v.url), { message: 'ingest requires a path or a url' });
export type IngestInput = z.infer<typeof IngestInput>;

export const IngestOutput = ResultEnvelope.extend({
  outcome: z.enum(['ok', 'requires_approval', 'duplicate', 'skipped']),
  change_id: z.string().optional(),
  document: z.string().optional(),
  slug: z.string().optional(),
  rel_path: z.string().optional(),
  summary: z.string().optional(),
  page_count: z.number().int().nonnegative().optional(),
  ocr: z.boolean().optional(),
  /**
   * Where the text actually came from. `ocr` alone cannot say: a vision model's
   * *description* of a photo is not a transcription of it, and reporting the two the
   * same way is a false claim about provenance, which cite-or-stay-quiet exists to
   * prevent.
   */
  text_from: z.enum(['text-layer', 'ocr', 'plain', 'textutil', 'vision', 'none']).optional(),
  /** Set when a rename fired: the original name added nothing the content did
   *  not already say. A good name is left alone. */
  renamed_from: z.string().optional(),
  related: z.array(z.string()).optional(),
  approval: ApprovalRequest.optional(),
  /**
   * One entry per file when a folder was ingested. The outer `outcome` is `ok` if
   * anything landed — a folder where three files filed themselves and two need a
   * decision is not a failure, and collapsing it to one verdict would lose the two.
   */
  batch: z
    .array(
      z.object({
        source: z.string(),
        outcome: z.enum(['ok', 'requires_approval', 'duplicate', 'skipped', 'error']),
        slug: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
});
export type IngestOutput = z.infer<typeof IngestOutput>;
