import { openOptionsFrom, parse } from '../args.js';
import { heading, json, kv, line, statusLabel, style, truncate } from '../output.js';
import { resolveOps } from '../ops-handle.js';

export const READ_HELP = `akno read <slug | --id <id> | --document <id>> [options]

  Read one exact thing. Returns the full body regardless of page class — recall
  caps what a reference page contributes unprompted, read never does.

  --from <n> --to <n>   Line range instead of the whole body.
  --json                Machine-readable response.`;

export async function readCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ id?: string; document?: string; from?: string; to?: string }>(
    argv,
    {
      id: { type: 'string' },
      document: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
    },
  );

  if (values.help || (positionals.length === 0 && !values.id && !values.document)) {
    line(READ_HELP);
    return values.help ? 0 : 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.read({
      ...(positionals[0] ? { slug: positionals[0] } : {}),
      ...(values.id ? { id: values.id } : {}),
      ...(values.document ? { document: values.document } : {}),
      ...(values.from ? { from_line: Number(values.from) } : {}),
      ...(values.to ? { to_line: Number(values.to) } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    if (result.document) {
      heading(result.document.rel_path);
      kv([
        ['id', result.document.id],
        ['page', result.document.page],
        ['mime', result.document.mime],
        ['pages', result.document.page_count],
        ['ocr', result.document.ocr ? 'yes' : 'no'],
        ['sha256', result.document.sha256.slice(0, 16)],
        ['bytes', result.document.bytes ?? null],
      ]);
      if (result.note) line(`\n${style.yellow(result.note)}`);
      if (result.document.text) line(`\n${result.document.text.slice(0, 4000)}`);
      return 0;
    }

    const page = result.page;
    if (!page) return 1;

    heading(`${page.slug} ${style.grey(`(${page.class})`)}`);
    kv([
      ['id', page.id],
      ['title', page.title],
      ['type', page.type],
      ['tags', page.tags.length > 0 ? page.tags.join(', ') : null],
      ['updated', page.updated],
      ['summary', page.summary ? truncate(page.summary, 90) : null],
      ['links', page.links.length > 0 ? page.links.join(', ') : null],
      ['backlinks', page.backlinks.length > 0 ? page.backlinks.join(', ') : null],
      ['broken links', page.broken_links?.length ? page.broken_links.join(', ') : null],
      ['reference fence', page.reference_fence_line ?? null],
    ]);

    if (page.documents?.length) {
      line(`  ${style.grey('documents')}  ${page.documents.map((d) => d.rel_path ?? d.id).join(', ')}`);
    }
    for (const entry of page.superseded ?? []) {
      line(style.yellow(`  superseded: ${truncate(entry.claim, 90)} (until ${entry.valid_to})`));
    }

    line();
    for (const bodyLine of page.lines) {
      const confidence = bodyLine.confidence !== undefined ? style.grey(` ~${bodyLine.confidence}`) : '';
      line(`${style.grey(String(bodyLine.n).padStart(5))}  ${bodyLine.text}${confidence}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}

export const LIST_HELP = `akno list [options]

  Browse structure. Folders by default; pages when a filter is given.

  --kind <k>          folders | pages | tree
  --folder <path>     Scope to a folder.
  --type <t>          Filter pages by frontmatter type.
  --tag <t>           Filter pages by tag.
  --class <c>         full | reference | excluded
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
    class?: string;
    order?: string;
    depth?: string;
    limit?: string;
  }>(argv, {
    kind: { type: 'string' },
    folder: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
    class: { type: 'string' },
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
      ...(values.class ? { class: values.class as 'full' | 'reference' | 'excluded' } : {}),
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
        const rule = folder.rule ? style.grey(`  ${folder.rule.class ?? ''} ← ${folder.rule.source}`) : '';
        line(
          `  ${folder.path.padEnd(width)}  ${style.grey(`${folder.pages_deep} pages`)}` +
            `${folder.folders > 0 ? style.grey(`, ${folder.folders} folders`) : ''}${rule}`,
        );
      }
      return 0;
    }

    const pages = result.pages ?? [];
    heading(`${result.total} page${result.total === 1 ? '' : 's'}${pages.length < result.total ? ` (showing ${pages.length})` : ''}`);
    const width = Math.max(8, ...pages.map((p) => p.slug.length));
    for (const page of pages) {
      line(
        `  ${page.slug.padEnd(width)}  ${style.grey(page.class.padEnd(9))}` +
          `${style.grey((page.updated ?? '').padEnd(11))}${truncate(page.summary ?? page.title, 70)}`,
      );
    }
    if (result.status === 'empty') line(style.yellow('  nothing matched'));
    return 0;
  } finally {
    await handle.close();
  }
}

export const TIMELINE_HELP = `akno timeline [options]

  When things happened. Events are indexed from the ledger and from dated lines
  on any page, so a date written where it belongs is found too.

  --since <YYYY[-MM[-DD]]>
  --until <YYYY[-MM[-DD]]>
  --match <text>      Substring match on the summary.
  --subject <slug>    Events linking to, or written on, this page.
  --order <o>         newest | oldest
  --limit <n>
  --json`;

export async function timelineCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    since?: string;
    until?: string;
    match?: string;
    subject?: string;
    order?: string;
    limit?: string;
  }>(argv, {
    since: { type: 'string' },
    until: { type: 'string' },
    match: { type: 'string' },
    subject: { type: 'string' },
    order: { type: 'string' },
    limit: { type: 'string' },
  });

  if (values.help) {
    line(TIMELINE_HELP);
    return 0;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.timeline({
      ...(values.since ? { since: values.since } : {}),
      ...(values.until ? { until: values.until } : {}),
      ...(values.match ? { match: values.match } : {}),
      ...(values.subject ? { subject: values.subject } : {}),
      ...(values.order ? { order: values.order as 'newest' | 'oldest' } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(
      `${statusLabel(result.status)} ${style.grey(`${result.total} event${result.total === 1 ? '' : 's'}`)}` +
        `${result.events.length < result.total ? style.grey(` (showing ${result.events.length})`) : ''}`,
    );
    for (const event of result.events) {
      const target = event.slug ? style.cyan(` → ${event.slug}`) : '';
      const source = style.grey(` [${event.source}${event.line ? `:${event.line}` : ''}]`);
      line(`  ${style.bold(event.date)}  ${truncate(event.summary, 80)}${target}${source}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}
