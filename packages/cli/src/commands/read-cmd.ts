import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const READ_HELP = `akno read <slug | --id <id> | --document <id>> [options]

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
