import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const LIST_HELP = `akno list [options]

  Browse structure. Folders by default; pages when a filter is given.

  --kind <k>          folders | pages | tree
  --folder <path>     Scope to a folder.
  --type <t>          Filter pages by frontmatter type.
  --tag <t>           Filter pages by tag.
  --role <r>          knowledge | source | inference | ignored
  --order <o>         recent | slug | size
  --depth <n>         Tree depth.
  --limit <n>
  --json`;

export async function listCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    kind?: string;
    folder?: string;
    type?: string;
    tag?: string;
    role?: string;
    order?: string;
    depth?: string;
    limit?: string;
  }>(argv, {
    kind: { type: 'string' },
    folder: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
    role: { type: 'string' },
    order: { type: 'string' },
    depth: { type: 'string' },
    limit: { type: 'string' },
  });

  if (values.help) {
    line(LIST_HELP);
    return 0;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.list({
      ...(values.kind ? { kind: values.kind as 'folders' | 'pages' | 'tree' } : {}),
      ...(values.folder ? { folder: values.folder } : {}),
      ...(values.type ? { type: values.type } : {}),
      ...(values.tag ? { tag: values.tag } : {}),
      ...(values.role ? { role: values.role as 'knowledge' | 'source' | 'inference' | 'ignored' } : {}),
      ...(values.order ? { order: values.order as 'recent' | 'slug' | 'size' } : {}),
      ...(values.depth ? { depth: Number(values.depth) } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    if (result.tree) {
      line(result.tree);
      return 0;
    }

    if (result.folders) {
      heading(`${result.total} folder${result.total === 1 ? '' : 's'}`);
      const width = Math.max(8, ...result.folders.map((f) => f.path.length));
      for (const folder of result.folders) {
        const rule = folder.rule ? style.grey(`  ${folder.rule.role ?? ''} ← ${folder.rule.source}`) : '';
        line(
          `  ${folder.path.padEnd(width)}  ${style.grey(`${folder.pages_deep} pages`)}` +
            `${folder.folders > 0 ? style.grey(`, ${folder.folders} folders`) : ''}${rule}`,
        );
      }
      return 0;
    }

    const pages = result.pages ?? [];
    heading(
      `${result.total} page${result.total === 1 ? '' : 's'}${pages.length < result.total ? ` (showing ${pages.length})` : ''}`,
    );
    const width = Math.max(8, ...pages.map((p) => p.slug.length));
    for (const page of pages) {
      line(
        `  ${page.slug.padEnd(width)}  ${style.grey(page.role.padEnd(9))}` +
          `${style.grey((page.updated ?? '').padEnd(11))}${truncate(page.summary ?? page.title, 70)}`,
      );
    }
    if (result.status === 'empty') line(style.yellow('  nothing matched'));
    return 0;
  } finally {
    await handle.close();
  }
}
