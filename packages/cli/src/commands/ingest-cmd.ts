import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style, truncate } from '../output.ts';

const INGEST_HELP = `akno ingest <path> [options]

  Pull a file into memory: extract its text, OCR it if there is no text layer, name it
  from its contents, summarize it, and route it to a folder. You never run an
  extraction tool.

  Extraction uses what macOS already has — PDFKit for a text layer, the Vision
  framework for OCR. A small helper is compiled on first use and cached.

  Two things it deliberately refuses to do:
    · A file whose text cannot be read keeps its name and gets no page, rather than
      being given a confident wrong one.
    · A file with no clear destination stays where it is, with a proposal. A misfiled
      document is a lost one.

  --folder <path>     Put it here, instead of letting routing decide.
  --label <text>      A description for the stored file.
  --actor <who>       user | agent. The user is never gated.
  --json`;

export async function ingestCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ folder?: string; label?: string; actor?: string }>(argv, {
    folder: { type: 'string' },
    label: { type: 'string' },
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
    const result = await mem.ingest({
      path: positionals[0]!,
      ...(values.folder ? { folder: values.folder } : {}),
      ...(values.label ? { label: values.label } : {}),
    });

    if (values.json) {
      json(result);
      return result.outcome === 'ok' || result.outcome === 'duplicate' ? 0 : 2;
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
      // Not a failure. §11's guards firing is the layer working, and the caller needs
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
