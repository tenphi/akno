import { ListInput, type ListOutput, type PageClass } from '@akno/protocol';
import type { AknoContext } from '../context.ts';
import { matchRules } from '../rules/compile.ts';

/**
 * Browse structure rather than search it. The point of this op is that an agent
 * that knows what folders exist stops guessing slugs — §17's "choose a slug and
 * avoid duplicate pages" is much easier when the structure is legible.
 */
export async function list(ctx: AknoContext, rawInput: unknown): Promise<ListOutput> {
  const input = ListInput.parse(rawInput);
  const kind = input.kind ?? (input.folder || input.type || input.tag || input.class ? 'pages' : 'folders');

  if (kind === 'tree') return listTree(ctx, input);
  if (kind === 'folders') return listFolders(ctx, input);
  return listPages(ctx, input);
}

interface PageRow {
  slug: string;
  title: string;
  type: string | null;
  class: PageClass;
  tags: string;
  summary: string | null;
  updated_at: string | null;
  bytes: number;
}

function listPages(ctx: AknoContext, input: ReturnType<typeof ListInput.parse>): ListOutput {
  const clauses: string[] = ["class != 'excluded'"];
  const params: unknown[] = [];

  if (input.folder) {
    clauses.push('(slug = ? OR slug LIKE ?)');
    params.push(input.folder, `${input.folder}/%`);
  }
  if (input.type) {
    clauses.push('type = ?');
    params.push(input.type);
  }
  if (input.class) {
    clauses.push('class = ?');
    params.push(input.class);
  }

  const order =
    input.order === 'slug' ? 'slug ASC' : input.order === 'size' ? 'bytes DESC' : 'updated_at DESC';
  const limit = input.limit ?? 100;

  const rows = ctx.store.db
    .prepare(
      `SELECT slug, title, type, class, tags, summary, updated_at, bytes
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
      class: row.class,
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
  const rows = ctx.store.db
    .prepare("SELECT slug FROM pages WHERE class != 'excluded' ORDER BY slug")
    .all() as { slug: string }[];

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

  const folders = [...deep.keys()]
    .sort()
    .slice(0, input.limit ?? 200)
    .map((folderPath) => {
      // Reporting which rule governs a folder is what makes §2's "default to
      // visible" true for structure: a rule that quietly excludes half a
      // knowledge base is worse than no rule.
      const match = matchRules(`${folderPath}/x`, ctx.config.rules);
      return {
        path: folderPath,
        pages: direct.get(folderPath) ?? 0,
        pages_deep: deep.get(folderPath) ?? 0,
        folders: subfolders.get(folderPath)?.size ?? 0,
        ...(match.rule
          ? {
              rule: {
                ...(match.rule.class ? { class: match.rule.class } : {}),
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
  const rows = ctx.store.db
    .prepare("SELECT slug FROM pages WHERE class != 'excluded' ORDER BY slug")
    .all() as { slug: string }[];

  const counts = new Map<string, number>();
  for (const { slug } of rows) {
    if (prefix && !slug.startsWith(prefix)) continue;
    const segments = slug.slice(prefix.length).split('/');
    for (let depth = 1; depth <= Math.min(maxDepth, segments.length - 1); depth++) {
      const key = segments.slice(0, depth).join('/');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const lines = [...counts.keys()].sort().map((key) => {
    const depth = key.split('/').length - 1;
    const label = key.split('/').at(-1)!;
    return `${'  '.repeat(depth)}${label}/ (${counts.get(key)})`;
  });

  const rootPages = rows.filter((row) => !row.slug.slice(prefix.length).includes('/')).length;
  if (rootPages > 0) lines.unshift(`${input.folder ?? '.'}: ${rootPages} pages`);

  return { status: 'ok', tree: lines.join('\n'), total: counts.size };
}
