import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style, truncate } from '../output.ts';

const INGEST_HELP = `akno ingest <path | url> [options]

  Pull a file, a folder, or a URL into memory: extract the text, OCR it if there is no
  text layer, name it from its contents, summarize it, and route it to a folder. You
  never run an extraction tool.

  A folder is walked one level deep — a recursive pass over a folder pointed at by
  mistake is a thousand model calls — and every file gets its own verdict.

  Extraction uses what macOS already has — PDFKit for a text layer, the Vision
  framework for OCR. A small helper is compiled on first use and cached.

  Two things it deliberately refuses to do:
    · A file whose text cannot be read keeps its name and gets no page, rather than
      being given a confident wrong one.
    · A file with no clear destination stays where it is, with a proposal. A misfiled
      document is a lost one.

  --folder <path>     Put it here, instead of letting routing decide.
  --label <text>      A description for the stored file.
  --limit <n>         Files to look at when ingesting a folder (default 50).
  --move              Move the source instead of copying it.
  --actor <who>       user | agent. The user is never gated.
  --json`;

export async function ingestCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    folder?: string;
    label?: string;
    limit?: string;
    move: boolean;
    actor?: string;
  }>(argv, {
    folder: { type: 'string' },
    label: { type: 'string' },
    limit: { type: 'string' },
    move: { type: 'boolean', default: false },
    actor: { type: 'string' },
  });

  if (values.help || positionals.length === 0) {
    line(INGEST_HELP);
    return values.help ? 0 : 1;
  }

  const mem = await open({
    ...openOptionsFrom(values),
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });

  try {
    const target = positionals[0]!;
    const result = await mem.ingest({
      // A URL and a path are told apart here rather than by the op, so `./https-notes`
      // stays a path and does not become a fetch.
      ...(/^https?:\/\//i.test(target) ? { url: target } : { path: target }),
      ...(values.folder ? { folder: values.folder } : {}),
      ...(values.label ? { label: values.label } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.move ? { route: true } : {}),
    });

    if (values.json) {
      json(result);
      return result.outcome === 'ok' || result.outcome === 'duplicate' ? 0 : 2;
    }

    if (result.batch) {
      // A folder: one line per file, because three filing themselves and two needing a
      // decision is not one outcome.
      heading(result.note ?? `${result.batch.length} files`);
      const width = Math.max(...result.batch.map((entry) => entry.source.length));
      for (const entry of result.batch) {
        const label =
          entry.outcome === 'ok'
            ? style.green('filed')
            : entry.outcome === 'duplicate'
              ? style.grey('already stored')
              : entry.outcome === 'error'
                ? style.red('error')
                : style.yellow(entry.outcome === 'requires_approval' ? 'needs a home' : 'skipped');
        line(
          `  ${entry.source.padEnd(width)}  ${label}  ${style.grey(entry.slug ?? truncate(entry.note ?? '', 60))}`,
        );
      }
      return result.batch.some((entry) => entry.outcome === 'ok') ? 0 : 2;
    }

    if (result.outcome === 'duplicate') {
      line(`${statusLabel('ok')} ${style.grey('already stored')}`);
      kv([
        ['document', result.document],
        ['file', result.rel_path],
        ['page', result.slug],
      ]);
      return 0;
    }

    if (result.outcome === 'skipped') {
      // Not a failure. A guard firing is the layer working, and the caller needs
      // to know which one so it can decide whether to help.
      line(`${statusLabel(result.status)} ${style.yellow('left where it is')}`);
      line(`  ${result.note}`);
      if (result.ocr) line(style.grey('  (OCR ran, but produced nothing usable)'));
      return 2;
    }

    if (result.outcome === 'requires_approval' && result.approval) {
      heading(style.yellow('needs a destination — the file stays where it is'));
      kv([
        ['what it is', result.approval.reason],
        ['proposal', result.approval.proposal_id],
        ['pages', result.page_count ?? null],
        ['text from', describeSource(result.text_from)],
      ]);
      if (result.approval.nearest.length > 0) {
        line(`  ${style.grey('folders that came closest')}  ${result.approval.nearest.join(', ')}`);
      }
      line(`\n  ${style.grey('decide with')} ${style.bold('akno ingest <path> --folder <folder>')}`);
      return 2;
    }

    line(`${statusLabel(result.status)} ${style.grey(`change ${result.change_id}`)}`);
    kv([
      ['page', result.slug],
      ['file', result.rel_path],
      ['pages', result.page_count ?? null],
      ['text from', describeSource(result.text_from)],
      ['renamed from', result.renamed_from ?? null],
    ]);
    if (result.summary) line(`\n  ${truncate(result.summary, 150)}`);
    if (result.related?.length) line(`\n  ${style.grey('related')}  ${result.related.join(', ')}`);
    if (result.note) line(`\n  ${style.grey(result.note)}`);
    line(`\n  ${style.grey('reverse with')} ${style.bold(`akno undo ${result.change_id}`)}`);
    return 0;
  } finally {
    await mem.close();
  }
}

/**
 * `ocr: true/false` cannot distinguish a PDF's own text layer from a vision model's
 * description of a photograph, and printing them the same way claims something untrue
 * about where the text came from.
 */
function describeSource(via: string | undefined): string {
  switch (via) {
    case 'text-layer':
      return "the document's own text layer";
    case 'ocr':
      return 'OCR (macOS Vision)';
    case 'plain':
      return 'the file itself';
    case 'textutil':
      return 'textutil';
    case 'vision':
      return "a vision model's description — not text found in the image";
    default:
      return 'nothing could be extracted';
  }
}
