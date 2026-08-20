import { ListInput, type ListOutput, type PageRole } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { physicalFolders } from '../kb/folders.ts';
import { effectiveRule, matchRules } from '../rules/compile.ts';

/**
 * Browse structure rather than search it. The point of this op is that an agent
 * that knows what folders exist stops guessing slugs: choosing one and avoiding a duplicate
 * page is much easier when the structure is legible.
 */
export async function list(ctx: AknoContext, rawInput: unknown): Promise<ListOutput> {
  const input = ListInput.parse(rawInput);
  const kind = input.kind ?? (input.folder || input.type || input.tag || input.role ? 'pages' : 'folders');

  if (kind === 'tree') return listTree(ctx, input);
  if (kind === 'folders') return listFolders(ctx, input);
  return listPages(ctx, input);
}

interface PageRow {
  slug: string;
  title: string;
  type: string | null;
  role: PageRole;
  tags: string;
  summary: string | null;
  updated_at: string | null;
  bytes: number;
}

function listPages(ctx: AknoContext, input: ReturnType<typeof ListInput.parse>): ListOutput {
  const clauses: string[] = ["role != 'ignored'"];
  const params: unknown[] = [];

  if (input.folder) {
    clauses.push('(slug = ? OR slug LIKE ?)');
    params.push(input.folder, `${input.folder}/%`);
  }
  if (input.type) {
    clauses.push('type = ?');
    params.push(input.type);
  }
  if (input.role) {
    clauses.push('role = ?');
    params.push(input.role);
  }

  const order =
    input.order === 'slug' ? 'slug ASC' : input.order === 'size' ? 'bytes DESC' : 'updated_at DESC';
  const limit = input.limit ?? 100;

  const rows = ctx.store.db
    .prepare(
      `SELECT slug, title, type, role, tags, summary, updated_at, bytes
         FROM pages WHERE ${clauses.join(' AND ')} ORDER BY ${order}`,
    )
    .all(...params) as PageRow[];

  // Tag filtering happens here rather than in SQL: tags are a JSON array, and a
  // LIKE on serialized JSON matches `finance` inside `finance-review`.
  const wanted = input.tag?.toLowerCase();
  const filtered = wanted
    ? rows.filter((row) => (JSON.parse(row.tags) as string[]).some((tag) => tag.toLowerCase() === wanted))
    : rows;

  return {
    status: filtered.length === 0 ? 'empty' : 'ok',
    pages: filtered.slice(0, limit).map((row) => ({
      slug: row.slug,
      title: row.title,
      type: row.type,
      role: row.role,
      tags: JSON.parse(row.tags) as string[],
      summary: row.summary,
      ...(row.updated_at ? { updated: row.updated_at.slice(0, 10) } : {}),
      bytes: row.bytes,
    })),
    total: filtered.length,
  };
}

function listFolders(ctx: AknoContext, input: ReturnType<typeof ListInput.parse>): ListOutput {
  const prefix = input.folder ? `${input.folder}/` : '';
  const rows = ctx.store.db.prepare("SELECT slug FROM pages WHERE role != 'ignored' ORDER BY slug").all() as {
    slug: string;
  }[];

  const direct = new Map<string, number>();
  const deep = new Map<string, number>();
  const subfolders = new Map<string, Set<string>>();

  for (const { slug } of rows) {
    if (prefix && !slug.startsWith(prefix)) continue;
    const remainder = slug.slice(prefix.length);
    const segments = remainder.split('/');
    if (segments.length === 1) {
      // A page sitting directly in this folder, not a child folder.
      continue;
    }
    const child = segments[0]!;
    const childPath = `${prefix}${child}`;
    deep.set(childPath, (deep.get(childPath) ?? 0) + 1);
    if (segments.length === 2) direct.set(childPath, (direct.get(childPath) ?? 0) + 1);
    else {
      if (!subfolders.has(childPath)) subfolders.set(childPath, new Set());
      subfolders.get(childPath)!.add(segments[1]!);
    }
  }

  // A folder that has been declared but holds no page yet is still somewhere to file
  // something — it is, in fact, the folder most likely to be the right answer, because
  // somebody has just said what it is for. Deriving structure from pages alone made a freshly
  // declared folder invisible to the very caller that had declared it.
  const declared = new Set<string>();
  for (const folderPath of declaredFolders(ctx, prefix)) {
    if (folderPath.includes('/') && !prefix) continue;
    if (!deep.has(folderPath)) declared.add(folderPath);
  }

  // Directories are structure even before the first page exists. The index has no row capable of
  // representing an empty folder, so include the user's on-disk taxonomy explicitly.
  const physical = new Set(physicalFolders(ctx.config, { under: input.folder, depth: 1 }));

  const folders = [...new Set([...deep.keys(), ...declared, ...physical])]
    .sort()
    .slice(0, input.limit ?? 200)
    .map((folderPath) => {
      // Reporting which rule governs a folder is what makes "default to visible" true for
      // structure: a rule that quietly excludes half a knowledge base is worse than no rule.
      // The fields come from `effectiveRule` and the attribution from the most specific match,
      // so a `description` on `research/**` and a `rank` on `**` both show rather than one
      // erasing the other.
      const match = matchRules(`${folderPath}/x`, ctx.config.rules);
      const effective = effectiveRule(`${folderPath}/x`, ctx.config.rules);
      return {
        path: folderPath,
        pages: direct.get(folderPath) ?? 0,
        pages_deep: deep.get(folderPath) ?? 0,
        folders: subfolders.get(folderPath)?.size ?? 0,
        ...(declared.has(folderPath) ? { declared: true } : {}),
        ...(match.rule
          ? {
              rule: {
                ...(effective.role ? { role: effective.role } : {}),
                ...(effective.remember ? { remember: effective.remember } : {}),
                ...(effective.description ? { description: effective.description } : {}),
                source: `${match.rule.glob} (${match.rule.source})`,
              },
            }
          : {}),
      };
    });

  return { status: folders.length === 0 ? 'empty' : 'ok', folders, total: folders.length };
}

/**
 * An indented outline, for the structure section of a `context` bundle. Cheap to
 * produce and worth a lot: it is the difference between an agent that knows
 * `documents/` exists and one that invents `docs/`.
 */
function listTree(ctx: AknoContext, input: ReturnType<typeof ListInput.parse>): ListOutput {
  const maxDepth = input.depth ?? 2;
  const prefix = input.folder ? `${input.folder}/` : '';
  const rows = ctx.store.db.prepare("SELECT slug FROM pages WHERE role != 'ignored' ORDER BY slug").all() as {
    slug: string;
  }[];

  const counts = new Map<string, number>();
  for (const { slug } of rows) {
    if (prefix && !slug.startsWith(prefix)) continue;
    const segments = slug.slice(prefix.length).split('/');
    for (let depth = 1; depth <= Math.min(maxDepth, segments.length - 1); depth++) {
      const key = segments.slice(0, depth).join('/');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Declared folders with nothing in them yet belong in the outline too — an agent choosing a
  // destination should see the folder somebody just created for this, not conclude it has to
  // invent one.
  for (const folderPath of declaredFolders(ctx, prefix)) {
    const key = folderPath.slice(prefix.length);
    if (key.length === 0 || key.split('/').length > maxDepth) continue;
    if (!counts.has(key)) counts.set(key, 0);
  }

  for (const folderPath of physicalFolders(ctx.config, { under: input.folder, depth: maxDepth })) {
    const key = prefix ? folderPath.slice(prefix.length) : folderPath;
    if (key.length === 0 || key.split('/').length > maxDepth) continue;
    if (!counts.has(key)) counts.set(key, 0);
  }

  const lines = [...counts.keys()].sort().map((key) => {
    const depth = key.split('/').length - 1;
    const label = key.split('/').at(-1)!;
    // The description, only at the top level and only in a clause. This outline is the whole
    // of what a turn is told about structure, and `research/ (12)` does not say that research
    // holds findings about the world while `household/` holds claims about this household —
    // which is the distinction a caller gets wrong when nothing tells it.
    const described =
      depth === 0 ? effectiveRule(`${prefix}${key}/x`, ctx.config.rules).description : undefined;
    const note = described ? ` — ${truncate(described, 90)}` : '';
    return `${'  '.repeat(depth)}${label}/ (${counts.get(key)})${note}`;
  });

  const rootPages = rows.filter((row) => !row.slug.slice(prefix.length).includes('/')).length;
  if (rootPages > 0) lines.unshift(`${input.folder ?? '.'}: ${rootPages} pages`);

  return { status: 'ok', tree: lines.join('\n'), total: counts.size };
}

/**
 * Folders named by a rule, under `prefix`, that a caller is allowed to see.
 *
 * A folder with a rule but no pages is still somewhere to file something — it is, in fact,
 * the folder most likely to be right, because somebody has just said what it is for. Deriving
 * structure from pages alone made a freshly declared folder invisible to the very caller that
 * declared it.
 *
 * `ignored` is the exception, and not a small one: ignoring a folder is a statement that it
 * should not be in the index at all, and listing it because it happens to have a rule would
 * make the one role that means "do not look here" the one role that always appears.
 */
function declaredFolders(ctx: AknoContext, prefix: string): string[] {
  const out: string[] = [];
  for (const rule of ctx.config.rules) {
    const folderPath = rule.glob.replace(/\/\*+$/, '');
    if (folderPath.length === 0 || folderPath.includes('*')) continue;
    if (!folderPath.startsWith(prefix)) continue;
    if (effectiveRule(`${folderPath}/x`, ctx.config.rules).role === 'ignored') continue;
    out.push(folderPath);
  }
  return out;
}

/** Cut at a word boundary — half a word reads as a typo rather than as an elision. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:]$/, '')}…`;
}
