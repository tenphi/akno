import { z } from 'zod';
import { DocumentRef, Line, PageClass, ResultEnvelope, SupersededClaim } from '../common.ts';

/** One exact thing: a page by slug or id, or a document by id. */
export const ReadInput = z
  .object({
    slug: z.string().optional(),
    id: z.string().optional(),
    document: z.string().optional(),
    /** Lines to return around a matched region. Whole body when absent. */
    from_line: z.number().int().positive().optional(),
    to_line: z.number().int().positive().optional(),
  })
  .refine((v) => Boolean(v.slug || v.id || v.document), {
    message: 'read requires one of: slug, id, document',
  });
export type ReadInput = z.infer<typeof ReadInput>;

export const PageBody = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  type: z.string().nullable(),
  tags: z.array(z.string()),
  class: PageClass,
  /** Every frontmatter key Akno found, preserved as read. Your own fields are
   *  passed through untouched. */
  frontmatter: z.record(z.string(), z.unknown()),
  summary: z.string().nullable(),
  keywords: z.array(z.string()).optional(),
  /** Numbered so a citation survives being quoted out of context. */
  lines: z.array(Line),
  /** Line at which `<!-- reference -->` switches the page's class mid-body. */
  reference_fence_line: z.number().int().positive().nullable().optional(),
  links: z.array(z.string()),
  backlinks: z.array(z.string()),
  broken_links: z.array(z.string()).optional(),
  superseded: z.array(SupersededClaim).optional(),
  documents: z.array(DocumentRef).optional(),
  updated: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
});
export type PageBody = z.infer<typeof PageBody>;

export const DocumentBody = z.object({
  id: z.string(),
  page: z.string().nullable(),
  rel_path: z.string(),
  mime: z.string().nullable(),
  sha256: z.string(),
  label: z.string().nullable(),
  page_count: z.number().int().nonnegative().nullable(),
  ocr: z.boolean(),
  /** Extracted text. Present because extraction happens on arrival, always. */
  text: z.string().nullable(),
  bytes: z.number().int().nonnegative().optional(),
});
export type DocumentBody = z.infer<typeof DocumentBody>;

export const ReadOutput = ResultEnvelope.extend({
  page: PageBody.optional(),
  document: DocumentBody.optional(),
});
export type ReadOutput = z.infer<typeof ReadOutput>;
