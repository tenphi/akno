import { openOptionsFrom, parse } from '../args.ts';
import { runMaintenance } from '../ops-handle.ts';
import { heading, json, line, style, truncate } from '../output.ts';

const INBOX_HELP = `akno inbox [options]

  Process whatever is sitting in an inbox folder: extract, name, summarize, and route.
  A file that finds a home moves there with its page. A file that does not **stays in
  the inbox**, with a proposal.

  That failure mode is the point. An unrouted file sits visibly where you dropped it
  rather than being filed confidently into the wrong place, where you would never look
  for it. An inbox with three things in it is a to-do list; a misfiled document is a
  lost one.

  An inbox is any folder with \`route: true\` in its rule:

      "inbox/**": { "ingest": "auto", "route": true }

  \`akno serve\` does this automatically as files arrive. This command is for a
  one-off pass, or for a machine that is not running the service.

  --limit <n>     Files to process in this pass (default 50).
  --json`;

export async function inboxCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ limit?: string }>(argv, { limit: { type: 'string' } });

  if (values.help) {
    line(INBOX_HELP);
    return 0;
  }

  const input = values.limit ? { limit: Number(values.limit) } : {};
  // Through the service when one is running: filing a document writes, and exactly one
  // process may write. The user running this by hand is the user, so a new folder is not gated.
  const result = await runMaintenance('inbox', input, values, openOptionsFrom(values), (mem) =>
    mem.inbox(input),
  );
  {
    if (values.json) {
      json(result);
      return result.waiting.length > 0 ? 2 : 0;
    }

    const total = result.filed.length + result.waiting.length + result.skipped.length;
    if (total === 0) {
      line(style.grey('the inbox is empty'));
      return 0;
    }

    if (result.filed.length > 0) {
      heading(`${result.filed.length} filed`);
      for (const entry of result.filed) {
        line(`  ${style.green('→')} ${entry.source}  ${style.grey('became')}  ${entry.slug}`);
      }
    }

    if (result.waiting.length > 0) {
      heading(`${result.waiting.length} still in the inbox`);
      for (const entry of result.waiting) {
        line(`  ${style.yellow('·')} ${entry.source}`);
        line(`    ${style.grey(truncate(entry.reason, 96))}`);
        if (entry.proposalId) {
          line(`    ${style.grey('decide with')} ${style.bold(`akno ingest <file> --folder <folder>`)}`);
        }
      }
    }

    if (result.skipped.length > 0) {
      heading(`${result.skipped.length} skipped`);
      for (const entry of result.skipped) {
        line(`  ${style.grey(`${entry.source} — ${entry.reason}`)}`);
      }
    }

    return result.waiting.length > 0 ? 2 : 0;
  }
}
