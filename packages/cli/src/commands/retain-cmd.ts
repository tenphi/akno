import fsp from 'node:fs/promises';
import { RetainInput } from '@tenphi/akno-protocol';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const RETAIN_HELP = `akno retain <json-file | -> [options]

  Replay-safe retention for identified source revisions. The JSON input follows
  the public retain schema: use inline text/items or an indexed source page/document,
  extract or provide typed candidates, preserve an inline source page explicitly,
  atomically correct prior support, or issue a standalone retraction.

  --dry-run       Validate and preview without brain writes or replay receipts.
  --actor <who>   user | agent.
  --json`;

export async function retainCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ 'dry-run': boolean; actor?: string }>(argv, {
    'dry-run': { type: 'boolean', default: false },
    actor: { type: 'string' },
  });
  if (values.help || positionals.length !== 1) {
    line(RETAIN_HELP);
    return values.help ? 0 : 1;
  }
  const raw = positionals[0] === '-' ? await readStdin() : await fsp.readFile(positionals[0]!, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    line(style.red(`retain input is not JSON: ${error instanceof Error ? error.message : String(error)}`));
    return 1;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    line(style.red('retain input must be one JSON object'));
    return 1;
  }
  const input = RetainInput.parse({
    ...(parsed as Record<string, unknown>),
    ...(values['dry-run'] ? { dry_run: true } : {}),
  });
  const handle = await resolveOps(values, openOptionsFrom(values), {
    write: true,
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });
  try {
    const result = await handle.ops.retain(input);
    if (values.json) {
      json(result);
      return result.outcome === 'partial' ? 2 : 0;
    }
    line(`${statusLabel(result.status)} ${style.grey(result.outcome)}`);
    for (const source of result.sources) {
      heading(`${source.source_id} @ ${source.revision}`);
      line(
        `  ${source.outcome}${source.reason_code ? ` · ${source.reason_code}` : ''}` +
          `${source.change_id ? ` · ${source.change_id}` : ''}`,
      );
      if (source.source) {
        line(
          style.grey(
            `  source: ${source.source.kind} · ${source.source.availability}` +
              `${source.source.reference ? ` · ${source.source.reference}` : ''}` +
              `${source.source.reextractable ? ' · reextractable' : ''}` +
              `${source.source.preserved_slug ? ` · archived at ${source.source.preserved_slug}` : ''}`,
          ),
        );
      }
      if (source.note) line(style.grey(`  ${source.note}`));
      for (const candidate of source.candidates) {
        line(
          `  ${candidate.outcome.padEnd(13)} ${candidate.candidate_id}` +
            `${candidate.slug ? ` → ${candidate.slug}` : ''}` +
            `${candidate.reason_code ? ` · ${candidate.reason_code}` : ''}` +
            `${candidate.reason ? style.grey(` (${candidate.reason})`) : ''}`,
        );
      }
    }
    return result.outcome === 'partial' ? 2 : 0;
  } finally {
    await handle.close();
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
