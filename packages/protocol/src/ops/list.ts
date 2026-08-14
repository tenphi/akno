import { z } from 'zod';
import { PageRole, ResultEnvelope } from '../common.ts';

/** Browse structure: folders, or pages by type / tag / role / recency. */
export const ListInput = z.object({
  folder: z.string().optional(),
  type: z.string().optional(),
  tag: z.string().optional(),
  role: PageRole.optional(),
  /** `folders` walks the tree one level; `pages` lists page stubs. */
  kind: z.enum(['folders', 'pages', 'tree']).optional(),
  order: z.enum(['recent', 'slug', 'size']).optional(),
  limit: z.number().int().positive().max(2000).optional(),
  /** Depth for `tree`. 1 is the top level. */
  depth: z.number().int().positive().max(12).optional(),
});
export type ListInput = z.infer<typeof ListInput>;

export const PageStub = z.object({
  slug: z.string(),
  title: z.string(),
  type: z.string().nullable(),
  role: PageRole,
  tags: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
  updated: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
});
export type PageStub = z.infer<typeof PageStub>;

export const FolderStub = z.object({
  path: z.string(),
  pages: z.number().int().nonnegative(),
  /** Total including subfolders — the useful number when deciding where to look. */
  pages_deep: z.number().int().nonnegative(),
  folders: z.number().int().nonnegative(),
  /** The rule that governs this folder, and where it came from. */
  rule: z
    .object({
      role: PageRole.optional(),
      remember: z.enum(['deny', 'integrate']).optional(),
      /**
       * What belongs in this folder, as its rule states it. This is the field that lets a
       * caller choose a destination by reading rather than by guessing from a name: `research`
       * and `household` are not self-explanatory to anyone who has not been told that one
       * holds findings about the world and the other holds claims about this household.
       */
      description: z.string().optional(),
      source: z.string(),
    })
    .optional(),
  /** True when the folder is declared but holds no page yet. */
  declared: z.boolean().optional(),
});
export type FolderStub = z.infer<typeof FolderStub>;

export const ListOutput = ResultEnvelope.extend({
  folders: z.array(FolderStub).optional(),
  pages: z.array(PageStub).optional(),
  /** Indented outline, for the structure section of a `context` bundle. */
  tree: z.string().optional(),
  total: z.number().int().nonnegative(),
});
export type ListOutput = z.infer<typeof ListOutput>;
