import { z } from 'zod';
import { ResultEnvelope } from '../common.ts';

/**
 * §10. There is no `add_event` op, and nothing about line syntax reaches a
 * prompt. The caller hands over a date and a summary; Akno formats and files
 * the ledger line.
 */
export const EventInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  summary: z.string().min(1),
});
export type EventInput = z.infer<typeof EventInput>;

export const DocumentInput = z.object({
  /** Path on disk to attach. Stored content-addressed as
   *  `<page-basename>-<sha8>.<ext>`, so files are unique by construction and
   *  `label` is a description rather than a disambiguator (§11). */
  path: z.string(),
  label: z.string().optional(),
});
export type DocumentInput = z.infer<typeof DocumentInput>;

/**
 * Create, append, patch or replace a page. Carries documents, events, tags and
 * links. A write with only an `event` and no slug appends a ledger line with no
 * link — still a real line in a real file, addressable as `timeline:47` (§10).
 */
export const WriteInput = z
  .object({
    slug: z.string().optional(),
    /** Akno proposes the slug when the caller does not; the caller may suggest. */
    propose_slug: z.string().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    /** Exactly one body operation. */
    content: z.string().optional(),
    append: z.string().optional(),
    patch: z.string().optional(),
    replace: z.object({ find: z.string(), with: z.string() }).optional(),
    event: EventInput.optional(),
    documents: z.array(DocumentInput).optional(),
    links: z.array(z.string()).optional(),
    /** Report what would happen without touching disk. */
    dry_run: z.boolean().optional(),
    /** Approve past a conflict the caller has already resolved with the user. */
    resolve_conflict: z.string().optional(),
  })
  .refine((v) => Boolean(v.slug || v.propose_slug || v.event), {
    message: 'write requires a slug, a proposed slug, or an event',
  })
  .refine((v) => [v.content, v.append, v.patch, v.replace].filter((x) => x !== undefined).length <= 1, {
    message: 'write takes at most one of: content, append, patch, replace',
  });
export type WriteInput = z.infer<typeof WriteInput>;

export const WriteTarget = z.object({
  slug: z.string(),
  line: z.number().int().positive().optional(),
  action: z.enum(['created', 'appended', 'patched', 'replaced', 'superseded', 'event', 'attached']),
});
export type WriteTarget = z.infer<typeof WriteTarget>;

/** §8. A conflict is two live claims on one attribute, surfaced *before* the write. */
export const ConflictReport = z.object({
  slug: z.string(),
  line: z.number().int().positive(),
  existing: z.string(),
  incoming: z.string(),
  subject: z.string().optional(),
  /** Echo this back as `resolve_conflict` to proceed. */
  token: z.string(),
});
export type ConflictReport = z.infer<typeof ConflictReport>;

/** §5. A declined proposal is remembered, so the agent stops re-asking. */
export const ApprovalRequest = z.object({
  proposal_id: z.string(),
  reason: z.string(),
  /** Where this could go instead, so the agent has something to offer the user. */
  nearest: z.array(z.string()),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

export const WriteOutput = ResultEnvelope.extend({
  /** Distinguishes a committed write from one waiting on the user. */
  outcome: z.enum(['ok', 'requires_approval', 'conflict', 'noop']),
  /** Durable — `undo` takes an id that outlives the session (§17). */
  change_id: z.string().optional(),
  wrote: z.array(WriteTarget).optional(),
  facts: z.object({ retired: z.number().int(), added: z.number().int() }).optional(),
  /** Attachments stored by this write, content-addressed and extracted (§11). */
  documents: z
    .array(z.object({ id: z.string(), rel_path: z.string(), text_from: z.string().optional() }))
    .optional(),
  conflict: ConflictReport.optional(),
  approval: ApprovalRequest.optional(),
});
export type WriteOutput = z.infer<typeof WriteOutput>;
